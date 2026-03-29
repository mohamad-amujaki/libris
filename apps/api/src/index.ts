import "./env.js";
import { constants, access, readdir, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import type { Prisma } from "@libris/db";
import { prisma } from "@libris/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import open from "open";
import { z } from "zod";
import { auth } from "./auth.js";
import { isPathUnderRoot, normalizeFsPath } from "./lib/paths.js";
import { scanLibraryRoot } from "./lib/scanner.js";
import { slugify } from "./lib/slug.js";
import { getTrustedWebOrigins } from "./lib/trusted-origins.js";

const trustedOrigins = getTrustedWebOrigins();

const app = new Hono<{
  Variables: {
    user:
      | NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"]
      | null;
    session:
      | NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["session"]
      | null;
  };
}>();

app.use(
  "*",
  cors({
    origin: trustedOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/api/health", (c) => c.json({ ok: true }));

app.use("/api/*", async (c, next) => {
  const p = c.req.path;
  if (p.startsWith("/api/auth") || p === "/api/health") {
    return next();
  }
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

const libraryRootCreate = z.object({
  path: z.string().min(1),
  label: z.string().optional(),
});

app.get("/api/library-roots", async (c) => {
  const roots = await prisma.libraryRoot.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { books: true } } },
  });
  return c.json({
    roots: roots.map((r) => ({
      id: r.id,
      path: r.path,
      label: r.label,
      createdAt: r.createdAt.toISOString(),
      lastScannedAt: r.lastScannedAt?.toISOString() ?? null,
      bookCount: r._count.books,
    })),
  });
});

/** Telusuri subfolder di disk (untuk UI pemilih path lokal). Tanpa query → folder home user. */
app.get("/api/browse-folders", async (c) => {
  const raw = c.req.query("path")?.trim();
  const target = raw ? normalizeFsPath(raw) : normalizeFsPath(homedir());
  try {
    const st = await stat(target);
    if (!st.isDirectory()) {
      return c.json({ error: "Bukan folder" }, 400);
    }
  } catch {
    return c.json(
      { error: "Folder tidak ditemukan atau tidak dapat diakses" },
      404,
    );
  }
  const resolvedBase = normalizeFsPath(target);
  const entries: { name: string; path: string }[] = [];
  try {
    const dirents = await readdir(resolvedBase, { withFileTypes: true });
    for (const d of dirents) {
      if (!d.isDirectory()) {
        continue;
      }
      const full = path.join(resolvedBase, d.name);
      entries.push({ name: d.name, path: normalizeFsPath(full) });
    }
    entries.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  } catch {
    return c.json({ error: "Tidak dapat membaca isi folder" }, 403);
  }
  const parentRaw = path.dirname(resolvedBase);
  const parentPath =
    parentRaw === resolvedBase ? null : normalizeFsPath(parentRaw);

  return c.json({
    currentPath: resolvedBase,
    parentPath,
    entries,
  });
});

app.post(
  "/api/library-roots",
  zValidator("json", libraryRootCreate),
  async (c) => {
    const { path: rawPath, label } = c.req.valid("json");
    const pathNorm = normalizeFsPath(rawPath);
    try {
      await access(pathNorm, constants.R_OK);
    } catch {
      return c.json({ error: "Path not readable or does not exist" }, 400);
    }
    const stat = await import("node:fs/promises").then((fs) =>
      fs.stat(pathNorm),
    );
    if (!stat.isDirectory()) {
      return c.json({ error: "Path must be a directory" }, 400);
    }
    const root = await prisma.libraryRoot.create({
      data: { path: pathNorm, label: label ?? null },
    });
    return c.json({
      root: {
        id: root.id,
        path: root.path,
        label: root.label,
        createdAt: root.createdAt.toISOString(),
        lastScannedAt: null,
      },
    });
  },
);

app.delete("/api/library-roots/:id", async (c) => {
  const id = c.req.param("id");
  await prisma.libraryRoot.delete({ where: { id } });
  return c.json({ ok: true });
});

app.post(
  "/api/scan",
  zValidator("json", z.object({ rootId: z.string().optional() })),
  async (c) => {
    const body = c.req.valid("json");
    const rootId = body.rootId;
    if (rootId) {
      const root = await prisma.libraryRoot.findUnique({
        where: { id: rootId },
      });
      if (!root) {
        return c.json({ error: "Library root not found" }, 404);
      }
      const summary = await scanLibraryRoot(root);
      return c.json({ summary });
    }
    const roots = await prisma.libraryRoot.findMany();
    const summaries: Record<
      string,
      Awaited<ReturnType<typeof scanLibraryRoot>>
    > = {};
    for (const root of roots) {
      summaries[root.id] = await scanLibraryRoot(root);
    }
    return c.json({ summaries });
  },
);

const listQuery = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  format: z.enum(["PDF", "EPUB"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
});

app.get("/api/books", zValidator("query", listQuery), async (c) => {
  const { q, tag, format, page = 1, pageSize = 20 } = c.req.valid("query");
  const where: Prisma.BookWhereInput = {};
  if (format) {
    where.format = format;
  }
  if (q?.trim()) {
    const needle = q.trim();
    where.OR = [
      { title: { contains: needle } },
      { absolutePath: { contains: needle } },
      { authorsJson: { contains: needle } },
      { description: { contains: needle } },
    ];
  }
  if (tag?.trim()) {
    where.tags = {
      some: {
        tag: {
          OR: [{ slug: tag.trim() }, { name: tag.trim() }],
        },
      },
    };
  }
  const [total, books] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      include: { tags: { include: { tag: true } }, libraryRoot: true },
      orderBy: { title: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return c.json({
    total,
    page,
    pageSize,
    books: books.map((b) => ({
      id: b.id,
      title: b.title,
      authors: JSON.parse(b.authorsJson) as string[],
      format: b.format,
      absolutePath: b.absolutePath,
      description: b.description,
      fileSize: b.fileSize?.toString() ?? null,
      fileMtime: b.fileMtime?.toISOString() ?? null,
      libraryRootId: b.libraryRootId,
      libraryRootPath: b.libraryRoot.path,
      tags: b.tags.map((bt) => ({
        id: bt.tag.id,
        name: bt.tag.name,
        slug: bt.tag.slug,
      })),
    })),
  });
});

app.get("/api/books/:id", async (c) => {
  const id = c.req.param("id");
  const book = await prisma.book.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, libraryRoot: true },
  });
  if (!book) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({
    book: {
      id: book.id,
      title: book.title,
      authors: JSON.parse(book.authorsJson) as string[],
      format: book.format,
      absolutePath: book.absolutePath,
      description: book.description,
      isbn: book.isbn,
      coverCachePath: book.coverCachePath,
      fileSize: book.fileSize?.toString() ?? null,
      fileMtime: book.fileMtime?.toISOString() ?? null,
      checksum: book.checksum,
      libraryRootId: book.libraryRootId,
      libraryRootPath: book.libraryRoot.path,
      tags: book.tags.map((bt) => ({
        id: bt.tag.id,
        name: bt.tag.name,
        slug: bt.tag.slug,
      })),
    },
  });
});

const patchBook = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  authors: z.array(z.string()).optional(),
  tagNames: z.array(z.string()).optional(),
});

app.patch("/api/books/:id", zValidator("json", patchBook), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: "Not found" }, 404);
  }
  const { tagNames, title, description, authors } = body;
  await prisma.$transaction(async (tx) => {
    await tx.book.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(authors !== undefined
          ? {
              authorsJson: JSON.stringify(
                authors.map((a) => a.trim()).filter(Boolean),
              ),
            }
          : {}),
      },
    });
    if (tagNames) {
      await tx.bookTag.deleteMany({ where: { bookId: id } });
      for (const name of tagNames) {
        const trimmed = name.trim();
        if (!trimmed) {
          continue;
        }
        const slug = slugify(trimmed);
        const tag = await tx.tag.upsert({
          where: { slug },
          create: { name: trimmed, slug },
          update: { name: trimmed },
        });
        await tx.bookTag.create({
          data: { bookId: id, tagId: tag.id },
        });
      }
    }
  });
  const book = await prisma.book.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, libraryRoot: true },
  });
  if (!book) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({
    book: {
      id: book.id,
      title: book.title,
      authors: JSON.parse(book.authorsJson) as string[],
      format: book.format,
      absolutePath: book.absolutePath,
      description: book.description,
      tags: book.tags.map((bt) => ({
        id: bt.tag.id,
        name: bt.tag.name,
        slug: bt.tag.slug,
      })),
    },
  });
});

app.delete("/api/books/:id", async (c) => {
  const id = c.req.param("id");
  const book = await prisma.book.findUnique({
    where: { id },
    include: { libraryRoot: true },
  });
  if (!book) {
    return c.json({ error: "Not found" }, 404);
  }
  const rootPath = book.libraryRoot.path;
  const filePath = normalizeFsPath(book.absolutePath);
  if (!isPathUnderRoot(filePath, rootPath)) {
    return c.json({ error: "Path is not under library root" }, 403);
  }
  try {
    await unlink(filePath);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      return c.json(
        {
          error: `Gagal menghapus file di disk: ${e instanceof Error ? e.message : String(e)}`,
        },
        500,
      );
    }
  }
  if (book.coverCachePath) {
    try {
      await unlink(normalizeFsPath(book.coverCachePath));
    } catch {
      /* cache cover opsional */
    }
  }
  await prisma.book.delete({ where: { id } });
  return c.json({ ok: true });
});

app.post("/api/books/:id/open", async (c) => {
  const id = c.req.param("id");
  const book = await prisma.book.findUnique({
    where: { id },
    include: { libraryRoot: true },
  });
  if (!book) {
    return c.json({ error: "Not found" }, 404);
  }
  const rootPath = book.libraryRoot.path;
  const filePath = normalizeFsPath(book.absolutePath);
  if (!isPathUnderRoot(filePath, rootPath)) {
    return c.json({ error: "Path is not under library root" }, 403);
  }
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return c.json({ error: "File not found on disk" }, 404);
  }
  await open(filePath);
  return c.json({ ok: true });
});

app.get("/api/tags", async (c) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return c.json({
    tags: tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
  });
});

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (addr) => {
  const p =
    typeof addr === "object" && addr && "port" in addr ? addr.port : port;
  console.log(`Libris API listening on http://127.0.0.1:${p}`);
});

export type AppType = typeof app;

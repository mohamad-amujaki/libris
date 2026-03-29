import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { BookFormat, LibraryRoot } from "@libris/db";
import { prisma } from "@libris/db";
import { extractEpubMetadata, extractPdfMetadata } from "./metadata.js";

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function inner(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const p = join(current, e.name);
      if (e.isSymbolicLink()) {
        continue;
      }
      if (e.isDirectory()) {
        await inner(p);
      } else if (e.isFile()) {
        out.push(p);
      }
    }
  }
  await inner(dir);
  return out;
}

async function fileChecksum(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

export type ScanSummary = {
  examined: number;
  upserted: number;
  skipped: number;
  errors: { path: string; message: string }[];
};

export async function scanLibraryRoot(root: LibraryRoot): Promise<ScanSummary> {
  const errors: { path: string; message: string }[] = [];
  let examined = 0;
  let upserted = 0;
  let skipped = 0;

  const allFiles = await walkFiles(root.path);
  const ebooks = allFiles.filter((f) => {
    const lower = f.toLowerCase();
    return lower.endsWith(".pdf") || lower.endsWith(".epub");
  });

  for (const absolutePath of ebooks) {
    examined++;
    const lower = absolutePath.toLowerCase();
    const format: BookFormat = lower.endsWith(".pdf") ? "PDF" : "EPUB";
    try {
      let title: string;
      let authors: string[];
      let description: string | undefined;
      if (format === "PDF") {
        const m = await extractPdfMetadata(absolutePath);
        title = m.title;
        authors = m.authors;
      } else {
        const m = await extractEpubMetadata(absolutePath);
        title = m.title;
        authors = m.authors;
        description = m.description;
      }
      const st = await stat(absolutePath);
      const fileSize = BigInt(st.size);
      const fileMtime = st.mtime;
      let checksum: string | undefined;
      try {
        checksum = await fileChecksum(absolutePath);
      } catch {
        checksum = undefined;
      }

      await prisma.book.upsert({
        where: { absolutePath },
        create: {
          libraryRootId: root.id,
          absolutePath,
          format,
          title,
          authorsJson: JSON.stringify(authors),
          description: description ?? null,
          fileSize,
          fileMtime,
          checksum: checksum ?? null,
        },
        update: {
          libraryRootId: root.id,
          format,
          title,
          authorsJson: JSON.stringify(authors),
          description: description ?? null,
          fileSize,
          fileMtime,
          checksum: checksum ?? null,
        },
      });
      upserted++;
    } catch (e) {
      skipped++;
      errors.push({
        path: absolutePath,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await prisma.libraryRoot.update({
    where: { id: root.id },
    data: { lastScannedAt: new Date() },
  });

  return { examined, upserted, skipped, errors };
}

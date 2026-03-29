import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename } from "node:path";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (data: Buffer) => Promise<{
  info?: Record<string, unknown>;
}>;

function textVal(v: unknown): string | undefined {
  if (v == null) {
    return undefined;
  }
  if (typeof v === "string") {
    return v;
  }
  if (typeof v === "object" && v !== null && "#text" in v) {
    const t = (v as { "#text": unknown })["#text"];
    return typeof t === "string" ? t : String(t);
  }
  return String(v);
}

function collectStringish(v: unknown): string[] {
  if (v == null) {
    return [];
  }
  if (Array.isArray(v)) {
    return v.flatMap((x) => collectStringish(x));
  }
  const t = textVal(v);
  return t ? [t.trim()].filter(Boolean) : [];
}

export async function extractPdfMetadata(filePath: string): Promise<{
  title: string;
  authors: string[];
}> {
  const buf = await readFile(filePath);
  const data = await pdfParse(buf);
  const info = data.info ?? {};
  const titleRaw = info.Title ?? info.title;
  const authorRaw = info.Author ?? info.author ?? info.Creator ?? info.creator;
  const title =
    typeof titleRaw === "string" && titleRaw.trim()
      ? titleRaw.trim()
      : basename(filePath, ".pdf");
  let authors: string[] = [];
  if (typeof authorRaw === "string" && authorRaw.trim()) {
    authors = authorRaw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return { title, authors };
}

export async function extractEpubMetadata(filePath: string): Promise<{
  title: string;
  authors: string[];
  description?: string;
}> {
  const fallback = basename(filePath, ".epub");
  try {
    const zip = new AdmZip(filePath);
    const containerEntry = zip.getEntry("META-INF/container.xml");
    if (!containerEntry) {
      return { title: fallback, authors: [] };
    }
    const containerXml = containerEntry.getData().toString("utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      attributeNamePrefix: "@_",
    });
    const container = parser.parse(containerXml) as Record<string, unknown>;
    const root = container.container as Record<string, unknown> | undefined;
    const rootfiles = root?.rootfiles as Record<string, unknown> | undefined;
    const rf = rootfiles?.rootfile as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined;
    const rootfile = Array.isArray(rf) ? rf[0] : rf;
    const opfPath =
      (rootfile?.["@_full-path"] as string | undefined) ??
      (rootfile?.["full-path"] as string | undefined);
    if (!opfPath || typeof opfPath !== "string") {
      return { title: fallback, authors: [] };
    }
    const opfEntry = zip.getEntry(opfPath);
    if (!opfEntry) {
      return { title: fallback, authors: [] };
    }
    const opfXml = opfEntry.getData().toString("utf8");
    const opf = parser.parse(opfXml) as Record<string, unknown>;
    const pkg = (opf.package ?? opf) as Record<string, unknown>;
    const metadata = (pkg.metadata ?? {}) as Record<string, unknown>;
    const titleRaw = metadata.title ?? metadata["dc:title"];
    const creatorRaw = metadata.creator ?? metadata["dc:creator"];
    const descRaw = metadata.description ?? metadata["dc:description"];
    const title = textVal(titleRaw)?.trim() || fallback;
    const authors = collectStringish(creatorRaw);
    const description = textVal(descRaw)?.trim();
    return {
      title,
      authors,
      ...(description ? { description } : {}),
    };
  } catch {
    return { title: fallback, authors: [] };
  }
}

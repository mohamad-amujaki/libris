import type { BookTableRow } from "../components/BooksTable";
import { apiFetch } from "./api";

export type ExportBooksFilters = {
  q: string;
  format: "" | "PDF" | "EPUB";
  tagFilter: string;
};

/** Mengambil semua buku yang cocok dengan filter (paginasi server, hingga total). */
export async function fetchAllBooksForExport(
  filters: ExportBooksFilters,
): Promise<BookTableRow[]> {
  const base = new URLSearchParams();
  if (filters.q.trim()) {
    base.set("q", filters.q.trim());
  }
  if (filters.format) {
    base.set("format", filters.format);
  }
  if (filters.tagFilter.trim()) {
    base.set("tag", filters.tagFilter.trim());
  }
  base.set("pageSize", "500");

  const all: BookTableRow[] = [];
  let page = 1;
  let total = 0;

  for (;;) {
    const p = new URLSearchParams(base);
    p.set("page", String(page));
    const res = await apiFetch<{ total: number; books: BookTableRow[] }>(
      `/api/books?${p.toString()}`,
    );
    total = res.total;
    all.push(...res.books);
    page += 1;
    if (res.books.length === 0 || all.length >= total) {
      break;
    }
  }

  return all;
}

export function formatExportFilenameStem(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function buildBooksPdfBlob(books: BookTableRow[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  doc.setFontSize(14);
  doc.text("Libris — Daftar ebook", 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Diekspor ${new Date().toLocaleString("id-ID")} · ${books.length} buku`,
    14,
    22,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 26,
    head: [["No", "Judul", "Penulis", "Format", "Path", "Tag"]],
    body: books.map((b, i) => [
      String(i + 1),
      b.title,
      b.authors.join(", "),
      b.format,
      b.absolutePath,
      b.tags.map((t) => t.name).join(", "),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [79, 108, 247] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 16 },
      4: { cellWidth: 75 },
      5: { cellWidth: 35 },
    },
    margin: { left: 10, right: 10 },
  });

  return doc.output("blob");
}

export async function buildBooksXlsxBlob(books: BookTableRow[]): Promise<Blob> {
  const XLSX = await import("xlsx");
  const rows = books.map((b, i) => ({
    No: i + 1,
    Judul: b.title,
    Penulis: b.authors.join(", "),
    Format: b.format,
    Path: b.absolutePath,
    Tag: b.tags.map((t) => t.name).join(", "),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Buku");
  const buf = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
  });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

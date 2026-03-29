import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type BookTableRow, BooksTable } from "../components/BooksTable";
import { IconSearch, PageHeader } from "../components/PageHeader";
import { apiFetch } from "../lib/api";

type LibraryRoot = {
  id: string;
  path: string;
  label: string | null;
  createdAt: string;
  lastScannedAt: string | null;
  bookCount: number;
};

export function DashboardPage() {
  const [q, setQ] = useState("");
  const [format, setFormat] = useState<"" | "PDF" | "EPUB">("");
  const [tagFilter, setTagFilter] = useState("");

  const rootsQuery = useQuery({
    queryKey: ["library-roots"],
    queryFn: () => apiFetch<{ roots: LibraryRoot[] }>("/api/library-roots"),
  });

  const booksQuery = useQuery({
    queryKey: ["books", q, format, tagFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set("q", q.trim());
      }
      if (format) {
        params.set("format", format);
      }
      if (tagFilter.trim()) {
        params.set("tag", tagFilter.trim());
      }
      params.set("pageSize", "500");
      return apiFetch<{
        total: number;
        books: BookTableRow[];
      }>(`/api/books?${params.toString()}`);
    },
  });

  const books = booksQuery.data?.books ?? [];

  const pdfOnPage = useMemo(
    () => books.filter((b) => b.format === "PDF").length,
    [books],
  );
  const epubOnPage = useMemo(
    () => books.filter((b) => b.format === "EPUB").length,
    [books],
  );

  return (
    <div className="page-inner">
      <PageHeader showSearch={false} />

      <section>
        <h2 className="section-title">Koleksi</h2>
        <div className="filters-row filters-row--collection">
          <div className="page-header-search filters-row-search">
            <IconSearch />
            <input
              type="search"
              placeholder="Cari judul, penulis, path…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari judul, penulis, atau path"
            />
          </div>
          <select
            className="select"
            value={format}
            onChange={(e) => setFormat(e.target.value as "" | "PDF" | "EPUB")}
            aria-label="Filter format"
          >
            <option value="">Semua format</option>
            <option value="PDF">PDF</option>
            <option value="EPUB">EPUB</option>
          </select>
          <input
            className="input"
            style={{ flex: "0 1 180px" }}
            placeholder="Filter tag"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </div>

        {booksQuery.data !== undefined && (
          <p className="muted" style={{ marginBottom: 12 }}>
            {booksQuery.data.total} buku dalam koleksi
            {books.length < booksQuery.data.total
              ? ` · menampilkan ${books.length} hasil filter`
              : null}
          </p>
        )}
        <BooksTable data={books} isLoading={booksQuery.isLoading} />
      </section>

      <div className="stats-row">
        <div className="stat-card" title="Total dari server">
          <div className="stat-icon stat-icon--purple">📚</div>
          <div>
            <div className="stat-value">{booksQuery.data?.total ?? "—"}</div>
            <div className="stat-label">Buku terindeks</div>
          </div>
        </div>
        <div
          className="stat-card"
          title="Jumlah PDF pada hasil filter saat ini (maks. 500 diunduh)"
        >
          <div className="stat-icon stat-icon--orange">📄</div>
          <div>
            <div className="stat-value">
              {booksQuery.isLoading ? "…" : pdfOnPage}
            </div>
            <div className="stat-label">PDF (halaman)</div>
          </div>
        </div>
        <div
          className="stat-card"
          title="Jumlah EPUB pada halaman daftar saat ini"
        >
          <div className="stat-icon stat-icon--blue">📗</div>
          <div>
            <div className="stat-value">
              {booksQuery.isLoading ? "…" : epubOnPage}
            </div>
            <div className="stat-label">EPUB (halaman)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon--green">📁</div>
          <div>
            <div className="stat-value">
              {rootsQuery.data?.roots.length ?? "—"}
            </div>
            <div className="stat-label">Folder aktif</div>
          </div>
        </div>
      </div>
    </div>
  );
}

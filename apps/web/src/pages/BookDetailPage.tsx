import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { apiFetch } from "../lib/api";

type BookDetail = {
  id: string;
  title: string;
  authors: string[];
  format: "PDF" | "EPUB";
  absolutePath: string;
  description: string | null;
  tags: { id: string; name: string; slug: string }[];
  libraryRootPath: string;
};

type BookDetailPageProps = {
  bookId: string;
};

export function BookDetailPage({ bookId }: BookDetailPageProps) {
  const queryClient = useQueryClient();
  const [tagInput, setTagInput] = useState("");

  const bookQuery = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => apiFetch<{ book: BookDetail }>(`/api/books/${bookId}`),
  });

  const patchBook = useMutation({
    mutationFn: (body: { title?: string; tagNames?: string[] }) =>
      apiFetch<{ book: BookDetail }>(`/api/books/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book", bookId] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const openFile = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>(`/api/books/${bookId}/open`, {
        method: "POST",
      }),
  });

  const book = bookQuery.data?.book;

  useEffect(() => {
    if (!book) {
      return;
    }
    setTagInput(book.tags.map((t) => t.name).join(", "));
  }, [book]);

  function saveTags() {
    const names = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    patchBook.mutate({ tagNames: names });
  }

  return (
    <div className="page-inner">
      <PageHeader showSearch={false} />

      <Link to="/" className="back-link">
        ← Kembali ke perpustakaan
      </Link>

      {bookQuery.isLoading && <p className="muted">Memuat…</p>}

      {book && (
        <>
          <div className="detail-hero">
            <div
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 88,
                  height: 120,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.75)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 40,
                  flexShrink: 0,
                  boxShadow: "var(--shadow-sm)",
                }}
                aria-hidden
              >
                {book.format === "PDF" ? "📄" : "📗"}
              </div>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <h1
                  style={{
                    margin: "0 0 8px",
                    fontSize: "1.65rem",
                    fontWeight: 800,
                  }}
                >
                  {book.title}
                </h1>
                <p className="muted" style={{ margin: "0 0 8px" }}>
                  {book.authors.join(", ") || "—"} ·{" "}
                  <span
                    className={`badge-format ${book.format === "PDF" ? "badge-pdf" : "badge-epub"}`}
                  >
                    {book.format}
                  </span>
                </p>
                <p
                  className="muted"
                  style={{ margin: 0, fontSize: 13, wordBreak: "break-all" }}
                >
                  {book.absolutePath}
                </p>
              </div>
            </div>
          </div>

          {book.description && (
            <div className="card card--pad" style={{ marginBottom: 20 }}>
              <p style={{ margin: 0, lineHeight: 1.65 }}>{book.description}</p>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              className="btn-primary"
              onClick={() => openFile.mutate()}
              disabled={openFile.isPending}
            >
              Buka file
            </button>
          </div>
          {openFile.isError && (
            <p
              className="error-text"
              style={{ marginTop: -12, marginBottom: 16 }}
            >
              {(openFile.error as Error).message}
            </p>
          )}

          <section className="card card--pad">
            <h2 className="section-title" style={{ fontSize: "1.1rem" }}>
              Tag
            </h2>
            <p className="muted" style={{ fontSize: 14, marginTop: -8 }}>
              Pisahkan dengan koma. Menyimpan mengganti semua tag buku ini.
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                className="input"
                style={{ flex: 1, minWidth: 200 }}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="contoh: fiksi, teknologi"
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={saveTags}
                disabled={patchBook.isPending}
              >
                Simpan tag
              </button>
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {book.tags.map((t) => (
                <span key={t.id} className="tag-pill">
                  {t.name}
                </span>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

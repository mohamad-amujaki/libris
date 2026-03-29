import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  const navigate = useNavigate();
  const [tagInput, setTagInput] = useState("");
  const [authorsInput, setAuthorsInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");

  const bookQuery = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => apiFetch<{ book: BookDetail }>(`/api/books/${bookId}`),
  });

  const patchBook = useMutation({
    mutationFn: (body: {
      title?: string;
      description?: string | null;
      authors?: string[];
      tagNames?: string[];
    }) =>
      apiFetch<{ book: BookDetail }>(`/api/books/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book", bookId] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      navigate({ to: "/" });
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
    setAuthorsInput(book.authors.join(", "));
    setDescriptionInput(book.description ?? "");
  }, [book]);

  function saveAuthorsAndDescription() {
    const authors = authorsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const description =
      descriptionInput.trim() === "" ? null : descriptionInput.trim();
    toast.promise(patchBook.mutateAsync({ authors, description }), {
      loading: "Menyimpan…",
      success: "Penulis dan ringkasan diperbarui.",
      error: (e) => (e instanceof Error ? e.message : "Gagal menyimpan."),
    });
  }

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

          <section className="card card--pad" style={{ marginBottom: 20 }}>
            <h2 className="section-title" style={{ fontSize: "1.1rem" }}>
              Penulis & ringkasan
            </h2>
            <p className="muted" style={{ fontSize: 14, marginTop: -8 }}>
              Pisahkan beberapa nama penulis dengan koma. Ringkasan disimpan
              sebagai deskripsi buku di indeks.
            </p>
            <label
              className="muted"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginTop: 14,
                marginBottom: 6,
              }}
              htmlFor="book-authors-input"
            >
              Penulis
            </label>
            <input
              id="book-authors-input"
              className="input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={authorsInput}
              onChange={(e) => setAuthorsInput(e.target.value)}
              placeholder="contoh: Andrea Hirata, Dewi Lestari"
            />
            <label
              className="muted"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginTop: 14,
                marginBottom: 6,
              }}
              htmlFor="book-description-input"
            >
              Ringkasan
            </label>
            <textarea
              id="book-description-input"
              className="input"
              style={{
                width: "100%",
                minHeight: 120,
                boxSizing: "border-box",
                resize: "vertical",
                lineHeight: 1.55,
              }}
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Sinopsis atau catatan singkat tentang buku ini…"
            />
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 14 }}
              disabled={patchBook.isPending}
              onClick={saveAuthorsAndDescription}
            >
              Simpan penulis & ringkasan
            </button>
          </section>

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

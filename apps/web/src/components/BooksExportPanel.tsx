import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type ExportBooksFilters,
  buildBooksPdfBlob,
  buildBooksXlsxBlob,
  fetchAllBooksForExport,
  formatExportFilenameStem,
} from "../lib/export-books";
import type { BookTableRow } from "./BooksTable";

type PreviewMode = "pdf" | "excel";

type BooksExportPanelProps = {
  filters: ExportBooksFilters;
};

export function BooksExportPanel({ filters }: BooksExportPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<PreviewMode | null>(null);
  const [books, setBooks] = useState<BookTableRow[]>([]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const revokePdfObjectUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const resetPreview = useCallback(() => {
    revokePdfObjectUrl();
    setBlob(null);
    setMode(null);
    setBooks([]);
  }, [revokePdfObjectUrl]);

  const openModal = useCallback(() => {
    const el = dialogRef.current;
    if (el && !el.open) {
      el.showModal();
    }
  }, []);

  const closeModal = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const handleDialogClose = useCallback(() => {
    resetPreview();
  }, [resetPreview]);

  async function runExport(kind: PreviewMode) {
    setBusy(true);
    try {
      const list = await fetchAllBooksForExport(filters);
      if (list.length === 0) {
        toast.error("Tidak ada buku untuk diekspor dengan filter saat ini.");
        return;
      }
      revokePdfObjectUrl();
      const nextBlob =
        kind === "pdf"
          ? await buildBooksPdfBlob(list)
          : await buildBooksXlsxBlob(list);
      setBooks(list);
      setBlob(nextBlob);
      setMode(kind);
      if (kind === "pdf") {
        setPreviewUrl(URL.createObjectURL(nextBlob));
      }
      openModal();
      toast.success(
        kind === "pdf"
          ? "PDF siap — pratinjau di bawah, lalu unduh jika perlu."
          : "Excel siap — pratinjau tabel di bawah, lalu unduh file .xlsx.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyiapkan ekspor.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!blob || !mode) {
      return;
    }
    const stem = formatExportFilenameStem();
    const ext = mode === "pdf" ? "pdf" : "xlsx";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `libris-ebook-${stem}.${ext}`;
    a.rel = "noopener";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success("Unduhan dimulai.");
  }

  return (
    <>
      <div className="export-books-panel">
        <span className="muted export-books-panel__label">Ekspor Daftar Ebook</span>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => runExport("pdf")}
        >
          PDF — pratinjau & unduh
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => runExport("excel")}
        >
          Excel — pratinjau & unduh
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="export-preview-dialog"
        aria-labelledby="export-preview-title"
        onClose={handleDialogClose}
      >
        <div className="export-preview-dialog__header">
          <h2 id="export-preview-title" className="section-title">
            {mode === "pdf"
              ? "Pratinjau PDF"
              : mode === "excel"
                ? "Pratinjau Excel"
                : "Ekspor"}
          </h2>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            {books.length} baris · memakai filter pencarian saat ini
          </p>
        </div>

        {mode === "pdf" && previewUrl ? (
          <iframe
            title="Pratinjau PDF"
            className="export-preview-dialog__frame"
            src={previewUrl}
          />
        ) : null}

        {mode === "excel" ? (
          <div className="export-preview-dialog__table-scroll">
            <table className="export-preview-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Judul</th>
                  <th>Penulis</th>
                  <th>Format</th>
                  <th>Path</th>
                  <th>Tag</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b, i) => (
                  <tr key={b.id}>
                    <td>{i + 1}</td>
                    <td>{b.title}</td>
                    <td>{b.authors.join(", ")}</td>
                    <td>{b.format}</td>
                    <td className="export-preview-table__path">
                      {b.absolutePath}
                    </td>
                    <td>{b.tags.map((t) => t.name).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="export-preview-dialog__actions">
          <button
            type="button"
            className="btn-primary"
            disabled={!blob}
            onClick={handleDownload}
          >
            Unduh file
          </button>
          <button type="button" className="btn-secondary" onClick={closeModal}>
            Tutup
          </button>
        </div>
      </dialog>
    </>
  );
}

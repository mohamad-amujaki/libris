import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "../components/PageHeader";
import { apiFetch } from "../lib/api";

type LibraryRoot = {
  id: string;
  path: string;
  label: string | null;
  createdAt: string;
  lastScannedAt: string | null;
  bookCount: number;
};

type BrowseFoldersResponse = {
  currentPath: string;
  parentPath: string | null;
  entries: { name: string; path: string }[];
};

const BROWSE_HOME_KEY = "__home__";

export function LibraryRootsPage() {
  const queryClient = useQueryClient();
  const browseDialogRef = useRef<HTMLDialogElement>(null);
  const [rootPath, setRootPath] = useState("");
  const [rootLabel, setRootLabel] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseKey, setBrowseKey] = useState<string>(BROWSE_HOME_KEY);

  const rootsQuery = useQuery({
    queryKey: ["library-roots"],
    queryFn: () => apiFetch<{ roots: LibraryRoot[] }>("/api/library-roots"),
  });

  const browseQuery = useQuery({
    queryKey: ["browse-folders", browseKey],
    queryFn: () =>
      apiFetch<BrowseFoldersResponse>(
        browseKey === BROWSE_HOME_KEY
          ? "/api/browse-folders"
          : `/api/browse-folders?path=${encodeURIComponent(browseKey)}`,
      ),
    enabled: browseOpen,
  });

  useEffect(() => {
    const el = browseDialogRef.current;
    if (!el) {
      return;
    }
    if (browseOpen) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [browseOpen]);

  const addRoot = useMutation({
    mutationFn: (body: { path: string; label?: string }) =>
      apiFetch<{ root: LibraryRoot }>("/api/library-roots", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-roots"] });
      setRootPath("");
      setRootLabel("");
    },
  });

  const scan = useMutation({
    mutationFn: (rootId?: string) =>
      apiFetch<{ summary?: unknown; summaries?: unknown }>("/api/scan", {
        method: "POST",
        body: JSON.stringify(rootId ? { rootId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["library-roots"] });
    },
  });

  function openBrowse() {
    setBrowseKey(BROWSE_HOME_KEY);
    setBrowseOpen(true);
  }

  function closeBrowseDialog() {
    browseDialogRef.current?.close();
    setBrowseOpen(false);
  }

  function confirmBrowseSelection() {
    const p = browseQuery.data?.currentPath;
    if (!p) {
      return;
    }
    setRootPath(p);
    closeBrowseDialog();
    toast.success(
      "Path folder dipilih. Anda dapat menambah label lalu klik Tambah folder.",
    );
  }

  return (
    <div className="page-inner">
      <PageHeader showSearch={false} />

      <section style={{ marginBottom: 8 }}>
        <h1 className="section-title" style={{ fontSize: "1.35rem" }}>
          Folder perpustakaan
        </h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: 1280 }}>
          Tambahkan folder di laptop Anda, lalu scan untuk mengindeks PDF dan
          EPUB. Gunakan <strong>Telusuri folder</strong> untuk memilih path dari
          daftar folder.
        </p>
      </section>

      <section className="card card--pad" style={{ marginBottom: 28 }}>
        <div className="filters-row">
          <input
            className="input"
            style={{ flex: "1 1 240px" }}
            placeholder="Path absolut folder"
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: "0 0 auto" }}
            onClick={openBrowse}
          >
            Telusuri folder
          </button>
          <input
            className="input"
            style={{ flex: "0 1 160px" }}
            placeholder="Label (opsional)"
            value={rootLabel}
            onChange={(e) => setRootLabel(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!rootPath.trim() || addRoot.isPending}
            onClick={() => {
              const path = rootPath.trim();
              const label = rootLabel.trim();
              toast.promise(
                addRoot.mutateAsync({
                  path,
                  ...(label ? { label } : {}),
                }),
                {
                  loading: "Menambahkan folder…",
                  success: "Folder perpustakaan ditambahkan.",
                  error: (e) =>
                    e instanceof Error ? e.message : "Gagal menambah folder.",
                },
              );
            }}
          >
            Tambah folder
          </button>
        </div>
        {rootsQuery.isLoading && <p className="muted">Memuat…</p>}
        {rootsQuery.data?.roots.map((r) => (
          <div key={r.id} className="root-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{r.label ?? r.path}</div>
              <div
                className="muted"
                style={{ fontSize: 13, wordBreak: "break-all" }}
              >
                {r.path}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {r.bookCount} buku
                {r.lastScannedAt
                  ? ` · terakhir scan ${new Date(r.lastScannedAt).toLocaleString("id-ID")}`
                  : ""}
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              disabled={scan.isPending}
              onClick={() => {
                toast.promise(scan.mutateAsync(r.id), {
                  loading: "Memindai folder…",
                  success: "Scan selesai. Koleksi diperbarui.",
                  error: (e) =>
                    e instanceof Error ? e.message : "Scan gagal.",
                });
              }}
            >
              Scan
            </button>
          </div>
        ))}
      </section>

      <dialog
        ref={browseDialogRef}
        className="folder-browse-dialog"
        aria-labelledby="folder-browse-title"
        onClose={() => setBrowseOpen(false)}
      >
        <h2
          id="folder-browse-title"
          className="section-title"
          style={{ fontSize: "1.1rem", marginBottom: 12 }}
        >
          Pilih folder
        </h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
          Klik nama folder untuk masuk, lalu <strong>Gunakan folder ini</strong>{" "}
          untuk mengisi path. Awalnya dibuka dari folder beranda Anda.
        </p>

        {browseQuery.isLoading && (
          <p className="muted" style={{ margin: "16px 0" }}>
            Memuat daftar folder…
          </p>
        )}
        {browseQuery.isError && (
          <p className="error-text" style={{ margin: "16px 0" }}>
            {(browseQuery.error as Error).message}
          </p>
        )}
        {browseQuery.data ? (
          <>
            <div className="folder-browse-current">
              {browseQuery.data.currentPath}
            </div>
            <div className="folder-browse-toolbar">
              <button
                type="button"
                className="btn-secondary"
                disabled={!browseQuery.data.parentPath}
                onClick={() => {
                  const p = browseQuery.data?.parentPath;
                  if (p) {
                    setBrowseKey(p);
                  }
                }}
              >
                ↑ Folder atas
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmBrowseSelection}
              >
                Gunakan folder ini
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={closeBrowseDialog}
              >
                Batal
              </button>
            </div>
            <ul className="folder-browse-list">
              {browseQuery.data.entries.length === 0 ? (
                <li className="muted" style={{ padding: "12px 8px" }}>
                  Tidak ada subfolder di sini.
                </li>
              ) : (
                browseQuery.data.entries.map((e) => (
                  <li key={e.path}>
                    <button
                      type="button"
                      className="folder-browse-item"
                      onClick={() => setBrowseKey(e.path)}
                    >
                      <span className="folder-browse-item-icon" aria-hidden>
                        📁
                      </span>
                      <span>{e.name}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        ) : null}
      </dialog>
    </div>
  );
}

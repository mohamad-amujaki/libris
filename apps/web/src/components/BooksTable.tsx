import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";

export type BookTableRow = {
  id: string;
  title: string;
  authors: string[];
  format: "PDF" | "EPUB";
  absolutePath: string;
  tags: { id: string; name: string; slug: string }[];
};

const DEFAULT_PAGE_SIZE = 6;

type PaginationItem = number | "ellipsis";

/** Nomor halaman (0-indexed) + elipsis untuk UI seperti « 1 2 3 … 10 » */
function getTablePaginationItems(
  pageIndex: number,
  pageCount: number,
): PaginationItem[] {
  if (pageCount < 1) {
    return [0];
  }
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }

  const last = pageCount - 1;
  const showAtStart = pageIndex < 3;
  const showAtEnd = pageIndex > last - 3;

  if (showAtStart) {
    return [0, 1, 2, "ellipsis", last];
  }
  if (showAtEnd) {
    return [0, "ellipsis", last - 2, last - 1, last];
  }
  return [
    0,
    "ellipsis",
    pageIndex - 1,
    pageIndex,
    pageIndex + 1,
    "ellipsis",
    last,
  ];
}

function IconChevronsLeft({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17 18l-6-6 6-6M11 18l-6-6 6-6" />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function IconChevronsRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 18l6-6-6-6M13 18l6-6-6-6" />
    </svg>
  );
}

function IconView() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconDelete() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

type BooksTableProps = {
  data: BookTableRow[];
  isLoading?: boolean;
  /** Ukuran halaman tabel (default 10). */
  pageSize?: number;
};

export function BooksTable({
  data,
  isLoading,
  pageSize = DEFAULT_PAGE_SIZE,
}: BooksTableProps) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const requestDelete = useCallback(
    (book: BookTableRow) => {
      toast("Hapus buku ini?", {
        description:
          "File dihapus dari disk dan entri di database. Tindakan tidak dapat dibatalkan.",
        action: {
          label: "Hapus",
          onClick: () => {
            toast.promise(
              apiFetch<{ ok: boolean }>(`/api/books/${book.id}`, {
                method: "DELETE",
              }),
              {
                loading: "Menghapus…",
                success: () => {
                  void queryClient.invalidateQueries({ queryKey: ["books"] });
                  void queryClient.invalidateQueries({ queryKey: ["book"] });
                  return `${book.title} dihapus dari koleksi dan penyimpanan.`;
                },
                error: (e) =>
                  e instanceof Error ? e.message : "Penghapusan gagal.",
              },
            );
          },
        },
        cancel: { label: "Batal", onClick: () => {} },
      });
    },
    [queryClient],
  );

  useEffect(() => {
    setPagination((p) => {
      const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
      let nextIndex = p.pageIndex;
      if (p.pageSize !== pageSize) {
        nextIndex = 0;
      } else {
        nextIndex = Math.min(p.pageIndex, pageCount - 1);
      }
      if (p.pageSize === pageSize && nextIndex === p.pageIndex) {
        return p;
      }
      return { pageSize, pageIndex: nextIndex };
    });
  }, [data.length, pageSize]);

  const columns = useMemo<ColumnDef<BookTableRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Judul",
        cell: ({ row }) => (
          <Link
            to="/books/$bookId"
            params={{ bookId: row.original.id }}
            className="table-link"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "authors",
        accessorFn: (row) => row.authors.join(", "),
        header: "Penulis",
        cell: ({ row }) => (
          <span>{row.original.authors.join(", ") || "—"}</span>
        ),
      },
      {
        accessorKey: "format",
        header: "Format",
        cell: ({ getValue }) => {
          const fmt = getValue<string>();
          return (
            <span
              className={`badge-format ${fmt === "PDF" ? "badge-pdf" : "badge-epub"}`}
            >
              {fmt}
            </span>
          );
        },
      },
      {
        id: "tags",
        accessorFn: (row) =>
          row.tags
            .map((t) => t.name)
            .sort()
            .join(", "),
        header: "Tag",
        enableSorting: true,
        cell: ({ row }) => (
          <div
            style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 280 }}
          >
            {row.original.tags.length === 0 ? (
              <span className="muted">—</span>
            ) : (
              row.original.tags.map((t) => (
                <span key={t.id} className="tag-pill">
                  {t.name}
                </span>
              ))
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Aksi",
        enableSorting: false,
        cell: ({ row }) => {
          const title = row.original.title;
          return (
            <div className="table-actions">
              <Link
                to="/books/$bookId"
                params={{ bookId: row.original.id }}
                className="btn-table btn-table--icon btn-table--primary"
                aria-label={`Lihat detail: ${title}`}
                title="Lihat detail"
              >
                <IconView />
              </Link>
              <button
                type="button"
                className="btn-table btn-table--icon btn-table--danger"
                aria-label={`Hapus dari koleksi: ${title}`}
                title="Hapus dari koleksi"
                onClick={() => requestDelete(row.original)}
              >
                <IconDelete />
              </button>
            </div>
          );
        },
      },
    ],
    [requestDelete],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (isLoading) {
    return (
      <p className="muted" style={{ margin: "16px 0" }}>
        Memuat buku…
      </p>
    );
  }

  if (data.length === 0) {
    return (
      <p className="muted" style={{ margin: "16px 0" }}>
        Belum ada buku. Buka Folder perpustakaan di menu samping, lalu jalankan
        scan.
      </p>
    );
  }

  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const currentPageSize = table.getState().pagination.pageSize;
  const pageRows = table.getRowModel().rows.length;
  const pageCount = table.getPageCount();
  const from = total === 0 ? 0 : pageIndex * currentPageSize + 1;
  const to = pageIndex * currentPageSize + pageRows;
  const pageItems = getTablePaginationItems(pageIndex, pageCount);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      className="sort-btn"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getCanSort() && (
                        <span style={{ fontSize: 10, opacity: 0.7 }}>
                          {{
                            asc: "▲",
                            desc: "▼",
                          }[header.column.getIsSorted() as string] ?? "◇"}
                        </span>
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-pagination">
        <span className="muted table-pagination-summary">
          Baris {from}–{to} dari {total} · {currentPageSize} per halaman
        </span>
        <nav className="table-pagination-nav" aria-label="Paginasi daftar buku">
          <button
            type="button"
            className="table-pagination-circle"
            disabled={!table.getCanPreviousPage()}
            aria-label="Halaman pertama"
            onClick={() => table.setPageIndex(0)}
          >
            <IconChevronsLeft />
          </button>
          <button
            type="button"
            className="table-pagination-circle"
            disabled={!table.getCanPreviousPage()}
            aria-label="Halaman sebelumnya"
            onClick={() => table.previousPage()}
          >
            <IconChevronLeft />
          </button>
          {pageItems.map((item, idx) => {
            if (item === "ellipsis") {
              const prev = pageItems[idx - 1];
              const next = pageItems[idx + 1];
              const gapKey =
                typeof prev === "number" && typeof next === "number"
                  ? `gap-${prev}-${next}`
                  : "ellipsis";
              return (
                <span
                  key={gapKey}
                  className="table-pagination-ellipsis"
                  aria-hidden
                >
                  …
                </span>
              );
            }
            return (
              <button
                key={item}
                type="button"
                className={`table-pagination-circle${item === pageIndex ? " table-pagination-circle--active" : ""}`}
                aria-label={`Halaman ${item + 1}`}
                aria-current={item === pageIndex ? "page" : undefined}
                onClick={() => table.setPageIndex(item)}
              >
                {item + 1}
              </button>
            );
          })}
          <button
            type="button"
            className="table-pagination-circle"
            disabled={!table.getCanNextPage()}
            aria-label="Halaman berikutnya"
            onClick={() => table.nextPage()}
          >
            <IconChevronRight />
          </button>
          <button
            type="button"
            className="table-pagination-circle"
            disabled={!table.getCanNextPage()}
            aria-label="Halaman terakhir"
            onClick={() => table.setPageIndex(Math.max(0, pageCount - 1))}
          >
            <IconChevronsRight />
          </button>
        </nav>
      </div>
    </div>
  );
}

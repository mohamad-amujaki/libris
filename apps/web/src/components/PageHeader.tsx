import { authClient } from "../lib/auth-client";
import { ThemeToggle } from "./ThemeToggle";

type PageHeaderProps = {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Jika false, bilah pencarian disembunyikan (mis. halaman detail). */
  showSearch?: boolean;
};

export function IconSearch() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <title>Cari</title>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function PageHeader({
  searchPlaceholder = "Cari…",
  searchValue = "",
  onSearchChange,
  showSearch = true,
}: PageHeaderProps) {
  const { data: session, isPending } = authClient.useSession();
  const displayName =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Pengguna";

  const dateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="page-header">
      {showSearch && onSearchChange ? (
        <div className="page-header-search">
          <IconSearch />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Pencarian"
          />
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      <div className="page-header-meta">
        <div className="page-header-date">{dateStr}</div>
        <div className="page-header-user-row">
          <div className="page-header-actions">
            <ThemeToggle />
          </div>
          <div className="user-avatar" aria-hidden>
            {isPending ? "…" : initialsFromName(displayName)}
          </div>
          <span className="user-name">{isPending ? "…" : displayName}</span>
        </div>
      </div>
    </header>
  );
}

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";

const SIDEBAR_COLLAPSED_KEY = "libris-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function IconLibrary() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      focusable="false"
    >
      <title>Perpustakaan</title>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      focusable="false"
    >
      <title>Folder perpustakaan</title>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      focusable="false"
    >
      <title>Libris</title>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      focusable="false"
    >
      <title>Keluar</title>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconHamburger() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <title>Menu</title>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function IconSidebarCollapse() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <title>Ciutkan panel</title>
      <path d="M11 5 6 12l5 7" />
      <path d="M18 5v14" />
    </svg>
  );
}

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLibrary = pathname === "/" || pathname.startsWith("/books/");
  const isFolders = pathname === "/folders";

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(readSidebarCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? "app-shell--sidebar-collapsed" : ""}`}
    >
      <aside
        className={`sidebar ${sidebarCollapsed ? "sidebar--collapsed" : ""}`}
        aria-label="Navigasi utama"
      >
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((c) => !c)}
          aria-expanded={!sidebarCollapsed}
          aria-controls={sidebarCollapsed ? undefined : "sidebar-main-nav"}
          title={sidebarCollapsed ? "Buka menu" : "Ciutkan menu"}
        >
          {sidebarCollapsed ? <IconHamburger /> : <IconSidebarCollapse />}
        </button>

        {!sidebarCollapsed ? (
          <>
            <div className="sidebar-logo" title="Libris">
              <IconBook />
            </div>
            <nav
              id="sidebar-main-nav"
              className="sidebar-nav"
              aria-label="Menu aplikasi"
            >
              <Link
                to="/"
                className={`sidebar-link ${isLibrary ? "sidebar-link--active" : ""}`}
                aria-current={isLibrary ? "page" : undefined}
                title="Perpustakaan"
              >
                <IconLibrary />
              </Link>
              <Link
                to="/folders"
                className={`sidebar-link ${isFolders ? "sidebar-link--active" : ""}`}
                aria-current={isFolders ? "page" : undefined}
                title="Folder perpustakaan"
              >
                <IconFolder />
              </Link>
            </nav>
            <button
              type="button"
              className="sidebar-link"
              onClick={handleLogout}
              title="Keluar"
            >
              <IconLogout />
            </button>
          </>
        ) : null}
      </aside>
      <div className="main-area">
        <Outlet />
      </div>
    </div>
  );
}

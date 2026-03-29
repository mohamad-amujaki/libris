import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { authClient } from "../lib/auth-client";

function LogoMark() {
  return (
    <span className="login-hero__logo-infinity" aria-hidden="true">
      ∞
    </span>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "User",
        });
        if (err) {
          setError(err.message ?? "Sign up failed");
          return;
        }
      } else {
        const { error: err } = await authClient.signIn.email({
          email,
          password,
        });
        if (err) {
          setError(err.message ?? "Sign in failed");
          return;
        }
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-split">
      <div className="login-theme-wrap">
        <ThemeToggle />
      </div>

      <aside className="login-hero" aria-label="Libris">
        <div className="login-hero__decor" aria-hidden="true">
          <span className="login-hero__ring login-hero__ring--1" />
          <span className="login-hero__ring login-hero__ring--2" />
          <span className="login-hero__ring login-hero__ring--3" />
        </div>
        <div className="login-hero__top">
          <div className="login-hero__brand">
            <LogoMark />
            <span className="login-hero__brand-text">libris</span>
          </div>
        </div>
        <div className="login-hero__welcome">
          <span className="login-hero__welcome-line">Halo</span>
          <span className="login-hero__welcome-line">Selamat datang di</span>
          <span className="login-hero__welcome-line login-hero__welcome-line--emph">
            Libris
          </span>
        </div>
      </aside>

      <div className="login-panel">
        <div className="login-form-shell">
          <h1 className="login-form-title">
            {mode === "signin" ? "Login" : "Daftar"}
          </h1>
          <p className="login-form-subtitle">
            Akun hanya dipakai di mesin ini (localhost).
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label className="login-field">
                <span className="visually-hidden">Nama</span>
                <input
                  className="login-pill-input"
                  placeholder="Nama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
            )}
            <label className="login-field">
              <span className="visually-hidden">Email</span>
              <input
                className="login-pill-input"
                placeholder="Email"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="login-field">
              <span className="visually-hidden">Password</span>
              <input
                className="login-pill-input"
                placeholder="Password"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
            </label>

            <div className="login-form-links">
              {mode === "signin" ? (
                <button
                  type="button"
                  className="login-inline-link"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                >
                  Belum punya akun?{" "}
                  <span className="login-inline-link--accent">Daftar</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="login-inline-link"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                >
                  Sudah punya akun?{" "}
                  <span className="login-inline-link--accent">Masuk</span>
                </button>
              )}
              <span
                className="login-inline-link login-inline-link--ghost"
                title="Akun lokal — tidak ada reset password otomatis."
              >
                Lupa password?
              </span>
            </div>

            {error ? <p className="login-form-error">{error}</p> : null}

            <button
              type="submit"
              className="login-pill-submit"
              disabled={loading}
            >
              {loading ? "…" : mode === "signup" ? "DAFTAR" : "MASUK"}
            </button>
          </form>

          <p className="login-form-footer">
            Jika mengalami kendala, pastikan layanan API dan database berjalan
            di mesin Anda.
          </p>
        </div>
      </div>
    </div>
  );
}

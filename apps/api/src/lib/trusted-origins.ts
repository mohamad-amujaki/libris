/**
 * Origins allowed for CORS + Better Auth `trustedOrigins`.
 * In development, common Vite ports are included so auth still works if 5173 is taken.
 */
export function getTrustedWebOrigins(): string[] {
  const primary = process.env.WEB_ORIGIN ?? "http://localhost:5173";
  const extras =
    process.env.WEB_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const isProd = process.env.NODE_ENV === "production";

  const devDefaults = !isProd
    ? [
        primary,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
      ]
    : [primary];

  return [...new Set([...extras, ...devDefaults])];
}

export function getPrimaryWebOrigin(): string {
  return process.env.WEB_ORIGIN ?? "http://localhost:5173";
}

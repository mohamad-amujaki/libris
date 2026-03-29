# Libris

Aplikasi web lokal untuk mengindeks dan mengelola file PDF/EPUB di komputer Anda (metadata + tag di SQLite; file tetap di path asli).

## Prasyarat

- Node.js 20+
- [pnpm](https://pnpm.io) 9+

## Setup

```bash
pnpm install
cp packages/db/.env.example packages/db/.env
pnpm db:migrate
```

Sesuaikan `BETTER_AUTH_SECRET` di `packages/db/.env` untuk lingkungan non-dev.

## Pengembangan

Jalankan API (port **3001**, hanya `127.0.0.1`) dan Vite (port **5173**) bersamaan:

```bash
pnpm dev
```

Buka `http://localhost:5173`, daftar akun lokal pertama, lalu tambahkan path folder berisi ebook dan pilih **Scan**.

## Skrip

| Skrip            | Keterangan                          |
| ---------------- | ----------------------------------- |
| `pnpm dev`       | API + web (hot reload)              |
| `pnpm build`     | Build `apps/web` dan `apps/api`     |
| `pnpm db:migrate`| Prisma migrate (`packages/db`)      |
| `pnpm lint`      | Biome check                         |

Basis data SQLite default: `packages/db/prisma/dev.db` (relatif ke folder `prisma`).

# Libris — Dokumentasi produk & teknis

Dokumen ini merangkum **Product Requirements Document (PRD)**, arsitektur, model data, API, dan panduan operasional untuk aplikasi **Libris** (manajer ebook lokal PDF/EPUB).

---

## 1. Ringkasan eksekutif

**Libris** adalah aplikasi **self-hosted lokal** untuk:

- Mendaftarkan **folder perpustakaan** (path absolut di mesin pengguna).
- **Memindai** rekursif file `.pdf` dan `.epub`, mengekstrak metadata, dan menyimpan **indeks di SQLite**.
- Menyediakan **UI web** untuk pencarian, filter, tag, detail buku, membuka file di aplikasi default OS, dan menghapus buku dari indeks **serta** file di disk (dengan validasi keamanan path).

File ebook **tidak diunggah ke cloud**; yang disimpan di basis data adalah metadata, path, tag, dan referensi ke cache cover opsional.

---

## 2. PRD (Product Requirements Document)

### 2.1 Latar belakang & masalah

Pengguna dengan banyak file PDF/EPUB di disk sering kesulitan:

- Menemukan judul berdasarkan ingatan parsial.
- Mengelompokkan koleksi tanpa menggandakan file.
- Membuka file cepat dari satu antarmuka.

Libris menargetkan **satu pengguna atau lingkungan rumah kecil** pada **localhost**, bukan multi-tenant SaaS.

### 2.2 Tujuan produk

| ID   | Tujuan                                                         | Ukuran keberhasilan                          |
| ---- | -------------------------------------------------------------- | -------------------------------------------- |
| G1   | Indeks PDF/EPUB di folder yang dipilih pengguna                | Scan menyelesaikan tanpa error fatal        |
| G2   | Pencarian & filter judul, penulis, path, format, tag             | Respons API & UI dapat diterima di <500 buku |
| G3   | Autentikasi lokal agar API tidak terbuka tanpa sesi            | Endpoint sensitif mengembalikan 401         |
| G4   | Buka file hanya jika path masih di bawah root perpustakaan     | Validasi path menolak traversal             |
| G5   | Hapus buku menghapus DB + file (opsional cover cache)          | DELETE konsisten dengan kebijakan keamanan   |

### 2.3 Persona (target pengguna)

- **Pengguna pribadi**: mengelola ebook di laptop/desktop, nyaman menjalankan Node.js dan `pnpm dev` atau build lokal.
- **Bukan** fokus: pustaka institusi besar, DRM komersial, atau sinkronisasi multi-perangkat bawaan.

### 2.4 Ruang lingkup fungsional (in scope)

- Registrasi & login **email + password** (Better Auth, SQLite).
- CRUD konsep untuk **Library root** (tambah path, daftar, hapus root di API; UI utama untuk tambah + scan).
- **Scan** dari UI dilakukan **per root** (tombol Scan pada setiap baris folder); endpoint `POST /api/scan` tanpa `rootId` tetap dapat memindai semua root jika dipanggil secara programatis.
- Daftar buku dengan **pagination**, filter **format**, **tag**, query teks **q**.
- Halaman **detail** buku: metadata, path, tag (replace via PATCH), tombol **buka file**.
- **Hapus** buku: unlink file + hapus record (dengan cek path di bawah root).
- **Tema** terang/gelap (`data-theme` di `<html>`).
- Sidebar **expand/collapse** dengan state persisten `localStorage`.
- Toast (Sonner) untuk aksi folder scan, tambah root, hapus buku, dll.

### 2.5 Di luar ruang lingkup (out of scope / belum menjadi produk jadi)

- Hosting publik internet, HTTPS termination, atau skala multi-user terpisah.
- Reset password email / SMTP (akun lokal; “lupa password” di UI bersifat informatif).
- Pembaca EPUB/PDF di dalam browser (hanya **open** ke aplikasi OS).
- Sinkronisasi cloud, OPDS, atau mobile app resmi.

### 2.6 User stories (contoh)

1. Sebagai pengguna, saya ingin **menambahkan folder** berisi ebook agar koleksi terindeks.
2. Sebagai pengguna, saya ingin **scan** folder agar PDF/EPUB baru muncul di daftar.
3. Sebagai pengguna, saya ingin **mencari** berdasarkan judul/penulis/path agar menemukan file cepat.
4. Sebagai pengguna, saya ingin **menandai** buku dengan tag agar bisa difilter.
5. Sebagai pengguna, saya ingin **membuka file** dari aplikasi agar tidak perlu mencari manual di Finder/Explorer.
6. Sebagai pengguna, saya ingin **menghapus** buku dari koleksi dan disk agar ruang bersih dan indeks konsisten.

### 2.7 Persyaratan non-fungsional

- **Keamanan**: API listen **127.0.0.1** saja; CORS ke origin web terpercaya; path file wajib **di bawah** `LibraryRoot` untuk open/delete.
- **Privasi**: data tetap lokal; tidak ada unggahan file ke server pihak ketiga oleh desain inti.
- **Kompatibilitas dev**: Node.js **≥ 20**, **pnpm**; browser modern dengan ES modules.
- **Maintainability**: monorepo pnpm, TypeScript, Biome untuk lint/format, Prisma untuk schema.

---

## 3. Arsitektur sistem

```
┌─────────────────┐     proxy /api      ┌─────────────────┐
│  apps/web       │ ──────────────────► │  apps/api       │
│  Vite + React   │   cookie session    │  Hono + Better  │
│  TanStack *     │                     │  Auth + Prisma  │
└─────────────────┘                     └────────┬────────┘
                                                 │
                                        ┌────────▼────────┐
                                        │  packages/db    │
                                        │  Prisma + SQLite│
                                        └─────────────────┘
                                                 │
                                        ┌────────▼────────┐
                                        │  File system    │
                                        │  (ebook paths)  │
                                        └─────────────────┘
```

- **Web** (`apps/web`): antarmuka; memanggil `/api/*` dengan **credentials** (cookie).
- **API** (`apps/api`): otorisasi sesi, bisnis domain, scanner, `open` file via paket `open`.
- **DB** (`packages/db`): schema Prisma + migrasi; klien diekspor ke API.

---

## 4. Stack teknologi

| Lapisan        | Teknologi |
| -------------- | --------- |
| Runtime        | Node.js 20+ |
| Package manager| pnpm (workspace) |
| Web UI         | React 19, Vite 6, TypeScript |
| Routing        | TanStack Router **file-based** (`@tanstack/router-plugin`) |
| Data fetching  | TanStack Query |
| Tabel          | TanStack Table |
| Styling        | Tailwind CSS **v4** (`@tailwindcss/vite`), CSS variabel tema + `@apply` |
| Toasts         | Sonner |
| Auth           | Better Auth (adapter Prisma, email/password) |
| API            | Hono, Zod (`@hono/zod-validator`) |
| ORM / DB       | Prisma, SQLite (`DATABASE_URL`) |
| Lint / format  | Biome |
| Git hooks      | Husky (prepare) |

---

## 5. Struktur monorepo

| Path | Isi |
| ---- | --- |
| `apps/web/` | Frontend Vite; `src/routes/*` definisi rute; `src/pages/*` halaman; `src/components/*` |
| `apps/api/` | Server Hono; `src/index.ts` rute REST; `src/lib/*` scanner, path, metadata |
| `packages/db/` | `prisma/schema.prisma`, migrasi, `.env` untuk `DATABASE_URL` |
| `docs.md` | Dokumentasi ini (akar repo) |
| `README.md` | Quick start singkat |

---

## 6. Model data (ringkas)

Lihat `packages/db/prisma/schema.prisma` untuk definisi penuh.

| Entitas / area | Keterangan |
| -------------- | ---------- |
| **User, Session, Account, Verification** | Tabel Better Auth (email/password) |
| **LibraryRoot** | Path unik folder perpustakaan, label opsional, `lastScannedAt` |
| **Book** | `absolutePath` unik, `format` PDF/EPUB, `title`, `authorsJson`, metadata lain, relasi ke root |
| **Tag**, **BookTag** | Tag unik (name/slug), many-to-many ke buku |

---

## 7. API HTTP (ringkasan)

Base URL dev: `http://127.0.0.1:3001` (diproxy dari Vite sebagai `/api`).

**Publik / tanpa sesi (kecuali health):**

| Metode | Path | Keterangan |
| ------ | ---- | ---------- |
| GET/POST | `/api/auth/*` | Handler Better Auth |
| GET | `/api/health` | `{ ok: true }` |

**Memerlukan cookie sesi (401 jika tidak login):**

| Metode | Path | Keterangan |
| ------ | ---- | ---------- |
| GET | `/api/library-roots` | Daftar root + jumlah buku |
| GET | `/api/browse-folders` | Query `path` opsional — telusuri subfolder di disk; tanpa `path` = folder home user. Respons: `currentPath`, `parentPath`, `entries[]` |
| POST | `/api/library-roots` | Body `{ path, label? }` — path harus folder yang ada & readable |
| DELETE | `/api/library-roots/:id` | Hapus root (API; pastikan dampak ke buku sesuai schema cascade) |
| POST | `/api/scan` | Body `{ rootId? }` — scan satu root atau semua |
| GET | `/api/books` | Query: `q`, `tag`, `format`, `page`, `pageSize` (maks 500) |
| GET | `/api/books/:id` | Detail buku |
| PATCH | `/api/books/:id` | `title`, `description`, `tagNames[]` |
| DELETE | `/api/books/:id` | Hapus file di disk (jika di bawah root) + DB + cover cache opsional |
| POST | `/api/books/:id/open` | Validasi path → `open()` file default OS |
| GET | `/api/tags` | Daftar tag |

**Keamanan path**: `open` dan `delete` memakai `normalizeFsPath` + `isPathUnderRoot` relatif ke path `LibraryRoot` buku tersebut.

---

## 8. Frontend — rute & halaman

File-based routing (`apps/web/src/routes/`):

| URL | File rute | Komponen halaman |
| --- | --------- | ---------------- |
| `/login` | `login.tsx` | `LoginPage` — login/daftar |
| `/` | `_authenticated/index.tsx` | `DashboardPage` — sorotan, koleksi, tabel |
| `/folders` | `_authenticated/folders.tsx` | `LibraryRootsPage` — tambah root (input path + **Telusuri folder** membuka dialog pemilih folder), scan **per root**; tidak ada tombol scan semua folder di UI |
| `/books/$bookId` | `_authenticated/books/$bookId.tsx` | `BookDetailPage` |

Layout terautentikasi: `_authenticated.tsx` — guard sesi + `AppShell` (sidebar + outlet).

**Halaman `/folders`:** dialog **Pilih folder** hanya muncul sebagai modal setelah **Telusuri folder** diklik; dialog ditutup setelah **Gunakan folder ini** atau **Batal**, lalu dapat dibuka lagi dari **Telusuri folder**. Path terpilih mengisi field path absolut untuk **Tambah folder**. Gaya untuk `.folder-browse-dialog` di `global.css` memisahkan tampilan tertutup/terbuka (`:not([open])` vs `[open]`) agar konten dialog tidak ikut tampil di layout halaman saat modal belum dibuka.

---

## 9. Konfigurasi lingkungan

Variabel utama (`packages/db/.env`, contoh di `.env.example`):

| Variabel | Keterangan |
| -------- | ---------- |
| `DATABASE_URL` | SQLite, mis. `file:./dev.db` |
| `BETTER_AUTH_SECRET` | Rahasia signing — wajib kuat di non-dev |
| `WEB_ORIGIN` | Origin web utama (CORS / trusted origins) |
| `WEB_ORIGINS` | Opsional, daftar tambahan dipisah koma |
| `BETTER_AUTH_URL` | Base URL auth (sering sama dengan origin web dev) |

API membaca env terkait melalui `apps/api/src/env.ts` dan `trusted-origins.ts`.

---

## 10. Alur pengembangan & build

```bash
pnpm install
cp packages/db/.env.example packages/db/.env
pnpm db:migrate
pnpm dev          # API :3001 + Web :5173
pnpm build        # build recursive workspace
pnpm lint         # biome check
```

Basis data default relatif ke folder Prisma (`dev.db`).

---

## 11. Risiko & asumsi

- **Penghapusan root** atau buku bersifat **destruktif** untuk indeks/file; backup menjadi tanggung jawab pengguna.
- **Lupa password** tidak diotomatisasi; akun lokal memerlukan akses DB atau alur admin manual.
- Port Vite berubah → sesuaikan `WEB_ORIGIN` / `WEB_ORIGINS` agar cookie & CORS tetap valid.

---

## 12. Roadmap ide (bukan komitmen)

- Export/backup daftar buku (CSV/JSON).
- Pengaturan admin untuk reset password.
- Dukungan format tambahan (cbz, dll.) jika ada kebutuhan.
- Packaging desktop (Tauri/Electron) untuk pengguna non-CLI.

---

## 13. Referensi cepat file kunci

| Area | File |
| ---- | ---- |
| Rute API | `apps/api/src/index.ts` |
| Auth | `apps/api/src/auth.ts` |
| Scanner | `apps/api/src/lib/scanner.ts` |
| Metadata PDF/EPUB | `apps/api/src/lib/metadata.ts` |
| Path security | `apps/api/src/lib/paths.ts` |
| Entry web | `apps/web/src/main.tsx` |
| Halaman folder perpustakaan | `apps/web/src/pages/LibraryRootsPage.tsx` |
| Router tree (generated) | `apps/web/src/routeTree.gen.ts` |
| Gaya global + Tailwind | `apps/web/src/styles/global.css` |

---

*Dokumen ini mencerminkan kondisi codebase pada saat penulisan; untuk detail implementasi terbaru, rujuk langsung ke sumber di repositori.*

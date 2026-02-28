# Road Detect - Frontend (Demo)

Singkat: aplikasi demo Next.js untuk menangkap gambar dari kamera, mengirim ke model Roboflow untuk deteksi kerusakan jalan, dan menyimpan ringkasan metrik/admin.

Fitur utama:
- Halaman kamera untuk mengambil gambar dan memanggil API inference.
- Endpoint server `POST /api/roboflow` yang membersihkan input gambar dan meneruskan ke Roboflow (multipart `file`).
- Dashboard admin untuk melihat riwayat deteksi dan statistik Roboflow API key.
- Persistence lokal (localStorage) untuk riwayat dan metrik; ada skrip sinkronisasi server-side dan workflow GitHub Actions untuk menyinkronkan setiap jam.

Quick start (lokal):

1. Install dependencies

```bash
npm ci
```

2. Jalankan development server

```bash
npm run dev
```

3. Build untuk produksi

```bash
npm run build
npm run start
```

Script penting:
- `npm run dev` — jalankan Next.js dev server
- `npm run build` — build produksi
- `npm run start` — jalankan server produksi
- `npm run sync:roboflow` — skrip untuk mengirimkan `.data/roboflow-admin-stats.json` ke endpoint sinkronisasi (dipakai di Actions)

Variabel environment yang relevan:
- `ROBOFLOW_API_KEY` — kunci Roboflow (wajib untuk inference)
- `ROBOFLOW_MODEL_ID`, `ROBOFLOW_MODEL_VERSION` — identitas model default
- `ROBOFLOW_ENDPOINT_SECRET` — (opsional tetapi direkomendasikan) secret yang harus dikirim pada header `x-roboflow-endpoint-secret` saat memanggil endpoint admin/server
- `SYNC_ROBOFLOW_ENDPOINT` — (Action) endpoint eksternal untuk sinkronisasi
- `SYNC_ROBOFLOW_SECRET` — (Action) secret yang dikirim sebagai header `x-roboflow-endpoint-secret` saat Action menjalankan sinkronisasi

Keamanan:
- Jangan menyimpan secrets di repo. Gunakan GitHub Secrets untuk workflow dan Vercel/hosting env vars untuk runtime.
- `.env` sudah ditambahkan ke `.gitignore`.

Catatan:
- Aplikasi ini dibuat sebagai demo; beberapa mekanisme (localStorage persistence, file-based server persistence) dirancang sederhana untuk kemudahan demo dan bukan untuk skala produksi.

Setup Secrets (langkah-demi-langkah)
----------------------------------

1) Buat secret aman (contoh cepat):

```bash
# OpenSSL
openssl rand -hex 32

# atau Node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2) GitHub Actions (agar workflow hourly dapat mengirim):

- Buka repository → Settings → Secrets and variables → Actions → New repository secret
- Tambahkan:
	- `SYNC_ROBOFLOW_ENDPOINT` = `https://road-detect-fe.vercel.app/api/admin/roboflow-stats` (atau endpoint tujuan Anda)
	- `SYNC_ROBOFLOW_SECRET` = <nilai secret dari langkah #1>

3) Vercel (agar server menerima POST dari Actions):

- Buka Project → Settings → Environment Variables
- Tambahkan (Production / Preview sesuai kebutuhan):
	- `ROBOFLOW_API_KEY` = <kunci Roboflow Anda>
	- `ROBOFLOW_MODEL_ID` = <model id>
	- `ROBOFLOW_MODEL_VERSION` = <model version>
	- `ROBOFLOW_ENDPOINT_SECRET` = <nilai secret dari langkah #1> (harus sama dengan `SYNC_ROBOFLOW_SECRET`)

4) Uji dari lokal (opsional):

```bash
# GET (cek publik)
curl -sS https://road-detect-fe.vercel.app/api/admin/roboflow-stats | jq .

# POST (uji sinkronisasi) — sertakan header jika server menuntut secret
curl -sS -X POST \
	-H "Content-Type: application/json" \
	-H "x-roboflow-endpoint-secret: <SECRET>" \
	-d '{"stats":{"invalidCount":1},"cache":null}' \
	https://road-detect-fe.vercel.app/api/admin/roboflow-stats
```

Keamanan dan catatan:
- Jangan men-commit secrets ke repo. Gunakan GitHub Secrets dan Vercel Environment Variables.
- Setelah menambahkan secrets di GitHub & Vercel, workflow hourly (`.github/workflows/sync-roboflow-stats.yml`) akan menjalankan `npm run sync:roboflow` dan mengirim payload ke `SYNC_ROBOFLOW_ENDPOINT` dengan header `x-roboflow-endpoint-secret`.
- Jika Anda butuh bantuan untuk men-setup Secrets di GitHub atau Vercel, beri tahu; saya bisa memandu langkah demi langkah.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

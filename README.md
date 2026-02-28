# ROADSTER - Frontend

ROADSTER (ROAd Damage System TEchnology with AI Recognition) adalah aplikasi Next.js untuk deteksi kerusakan jalan berbasis AI dari kamera perangkat, dengan monitoring admin dan konteks GIS.

## Ringkasan Fitur

- Halaman kamera untuk inferensi realtime kerusakan jalan.
- Endpoint `POST /api/roboflow` untuk meneruskan file gambar ke Roboflow.
- Dashboard admin untuk riwayat deteksi, statistik API, dan konfigurasi GIS.
- Penyimpanan lokal (localStorage) untuk history/metrics di sisi client.
- Sinkronisasi statistik admin via script dan GitHub Actions berkala.

## Halaman Utama

- `/` landing page ROADSTER.
- `/camera` mode kamera dan inferensi.
- `/admin/login` autentikasi admin.
- `/admin/dashboard` monitoring deteksi + GIS.

## Branding Single Source of Truth

Konstanta branding disimpan di:

- `lib/app-brand.ts`

Gunakan konstanta dari file ini untuk judul, deskripsi metadata, dan narasi UI agar konsisten di seluruh modul.

## Quick Start (Lokal)

1. Install dependency

```bash
npm ci
```

2. Jalankan development server

```bash
npm run dev
```

3. Build dan jalankan mode produksi

```bash
npm run build
npm run start
```

## Script Penting

- `npm run dev` : jalankan Next.js dev server.
- `npm run build` : build produksi.
- `npm run start` : jalankan server produksi.
- `npm run lint` : cek linting.
- `npm run test:unit` : jalankan unit tests (termasuk migrasi legacy storage key).
- `npm run test:smoke` : jalankan smoke tests untuk route utama (`/`, `/camera`, `/admin/login`, `/admin/dashboard`) pada server produksi lokal (jalankan `npm run build` dulu).
- `npm run test:ab` : jalankan unit test utilitas assignment A/B variant.
- `npm run sync:roboflow` : kirim `.data/roboflow-admin-stats.json` ke endpoint sinkronisasi.

## CI/CD

- Workflow CI ada di `.github/workflows/ci.yml`.
- Pipeline menjalankan `lint`, `build`, `test:unit`, dan `test:smoke` pada setiap push dan pull request.
- Workflow sinkronisasi statistik Roboflow terjadwal tetap ada di `.github/workflows/sync-roboflow-stats.yml`.

## Environment Variables

- `ROBOFLOW_API_KEY` : kunci Roboflow (wajib untuk inference).
- `ROBOFLOW_INFERENCE_ENDPOINT` : (opsional) endpoint inferensi penuh. Default diarahkan ke endpoint serverless ROADSTER.
  Untuk endpoint serverless workflows, gunakan format `https://serverless.roboflow.com/<workspace>/workflows/<workflow-id>`.
- `ROBOFLOW_MODEL_ID` : model id default.
- `ROBOFLOW_MODEL_VERSION` : model version default.
- `ROBOFLOW_ENDPOINT_SECRET` : secret header `x-roboflow-endpoint-secret` untuk endpoint admin/server.
- `SYNC_ROBOFLOW_ENDPOINT` : endpoint tujuan sinkronisasi dari Actions.
- `SYNC_ROBOFLOW_SECRET` : secret yang dikirim Action pada header `x-roboflow-endpoint-secret`.

## Setup Secrets (Langkah Ringkas)

1. Generate secret acak.

```bash
# OpenSSL
openssl rand -hex 32

# atau Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Tambahkan GitHub Actions secrets:
- `SYNC_ROBOFLOW_ENDPOINT` = `https://<your-domain>/api/admin/roboflow-stats`
- `SYNC_ROBOFLOW_SECRET` = `<SECRET_DARI_LANGKAH_1>`

3. Tambahkan environment variables di hosting (mis. Vercel):
- `ROBOFLOW_API_KEY`
- `ROBOFLOW_MODEL_ID`
- `ROBOFLOW_MODEL_VERSION`
- `ROBOFLOW_ENDPOINT_SECRET` (harus sama dengan `SYNC_ROBOFLOW_SECRET`)

4. Uji endpoint (opsional):

```bash
# GET
curl -sS https://<your-domain>/api/admin/roboflow-stats

# POST
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "x-roboflow-endpoint-secret: <SECRET>" \
  -d '{"stats":{"invalidCount":1},"cache":null}' \
  https://<your-domain>/api/admin/roboflow-stats
```

## Keamanan

- Jangan commit secrets ke repository.
- Gunakan GitHub Secrets untuk workflow.
- Gunakan environment variables pada platform deployment untuk runtime.
- Pastikan `.env` tetap masuk `.gitignore`.

## Catatan

- Project ini berfokus pada workflow demo dan validasi fitur.
- Untuk skala produksi, gunakan persistence backend/database dan observability yang lebih kuat.

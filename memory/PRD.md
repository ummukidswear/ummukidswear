# PRD — ummu-abdullah-bos (branch main6)

## Problem Statement
Import project dari GitHub `monevbbihpmm-svg/ummu-abdullah-bos` branch `main6`, setup & install semua dependencies di environment Emergent.

## Arsitektur
- Frontend: Expo SDK 57 / React Native 0.86.3 / React 19, expo-router, yarn 1.22.22 — jalan via `expo start --port 3000` (supervisor)
- Backend: FastAPI + MongoDB (motor) di port 8001, deps di `/root/.venv`
- App bersifat offline-first: data di `frontend/src/data/` (storage lokal), TIDAK ada panggilan API ke backend
- Backend saat ini scaffold default (endpoint /api/status); belum ada logic bisnis/auth meski requirements berisi pyjwt/bcrypt

## Implementasi (10 Okt 2026)
- [x] Clone repo branch main6 → disinkron ke /app (.git platform dipertahankan)
- [x] backend/.env: MONGO_URL=mongodb://localhost:27017, DB_NAME=ummu_abdullah_bos, CORS_ORIGINS=*
- [x] Backend deps terinstall ke /root/.venv (emergentintegrations==0.2.0 via extra-index cloudfront)
- [x] Frontend yarn install sukses (cmd-guard preinstall lolos)
- [x] package.json start script diubah ke `expo start --port 3000` agar sesuai ingress
- [x] Verifikasi: GET/POST /api/status OK; app web render sempurna (dashboard Analytics)

## Catatan
- Warning non-blocking: require cycle store.tsx ↔ useAnalyticsMonth.ts; React Native DevTools gagal install (root/no-sandbox) — tidak mempengaruhi app
- Tidak ada auth/akun uji di app ini

## Backlog
- P0: — (setup selesai)
- P1: implementasi backend bisnis bila app perlu sinkronisasi data ke server
- P2: docker-compose backend+mongo (opsional, ditawarkan user di runbook)

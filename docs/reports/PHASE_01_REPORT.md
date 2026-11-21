# Completion Report — Phase 1 (Foundation & Tech Spikes)

Tanggal: 2026-11-21 · Status: **Selesai secara teknis, menunggu uji manual & persetujuan owner** · Branch: `main` (remote `origin` = github.com/dimasabdhi/OceanSurvival)

## 1. Ringkasan
Phase 1 membangun fondasi project dan membuktikan empat teknologi paling berisiko **sebelum** gameplay dibangun di atasnya. Keempatnya lulus:

| Uji teknis (spike) | Hasil |
|---|---|
| TypeScript 7 (compiler baru) | ✅ Semua package lulus typecheck dalam ±1 detik, tidak perlu versi cadangan |
| Fisika Rapier sama persis di server & browser | ✅ Hash simulasi 600 langkah `8941d541` identik di Node.js, Chrome, dan Edge |
| Server multiplayer Colyseus 0.18 | ✅ State sinkron, data privat per pemain, validasi pesan, input dikendalikan server (5 test) |
| Laut 3D di browser | ✅ ±165 FPS di 1920×1080 kualitas Tinggi (target ≥ 60) |

Temuan penting: Colyseus 0.18 ternyata sudah punya sistem **prediction/reconciliation bawaan** untuk gerakan pemain. Ini mengurangi pekerjaan & risiko Phase 2–3 secara signifikan → diusulkan di [ADR-0013](../adr/0013-colyseus-builtin-netcode.md) (status *Proposed*, dibuktikan di Phase 2).

## 2. Apa yang dibuat
**Fondasi repo**
- Monorepo pnpm: `apps/client`, `apps/server`, `packages/shared`; TypeScript strict; Biome (lint+format); Vitest; Playwright; skrip `pnpm dev / verify / test / test:e2e / bench:ocean / build`.
- Semua versi dikunci persis; paket yang rilis < 7 hari tidak dipakai.
- Keamanan instalasi: pnpm 12 hanya boleh menjalankan build script `esbuild`; dependency dari URL GitHub tetap diblokir.

**packages/shared** (kode yang dipakai client & server)
- `constants.ts` (tick 60 Hz, patch 50 ms, siklus hari 24 menit), `math/prng.ts` (random deterministik), `ocean/waves.ts` (model gelombang Gerstner untuk shader **dan** gameplay, plus generator GLSL), `protocol/spike.ts`, `physics-spike/determinism.ts`.

**apps/server**
- Server Colyseus terikat ke `127.0.0.1` (tidak terbuka ke jaringan), konfigurasi `.env` divalidasi saat start.
- `SpikeRoom`: state schema builder, `onAuth` dengan validasi zod, pesan `chat` tervalidasi, input pemain via `defineInput` + `sanitize`, simulasi `setFixedTimestep` 60 Hz, reconnection 30 detik.

**apps/client**
- Three.js WebGL2: laut Gerstner bergaya low-poly (satu mesh radial tanpa celah LOD), langit gradien, siklus siang–senja–malam, kotak apung debug (**PLACEHOLDER**) yang posisinya dihitung CPU untuk membuktikan CPU & shader sepakat soal tinggi ombak.
- UI Preact (Bahasa Indonesia via `locales/id.json`): layar mulai, menu jeda (kualitas, waktu, kecepatan waktu, FOV, sensitivitas), overlay performa (F3), status koneksi server + ping.
- Mode: `?bench=ocean`, `?spike=rapier`, `?net=0`, `?quality=…`. Rapier dimuat hanya bila dibutuhkan (bundle utama 839 KB / 228 KB gzip).

**tools & tests**
- `tools/validate-assets.ts`: memeriksa manifest aset (lisensi, atribusi, ukuran file, file tanpa entri, placeholder).
- 22 unit/integration test, 8 test E2E (Chrome + Edge), benchmark otomatis.

**Dokumentasi**: ADR-0013 baru; TECHNICAL_ARCHITECTURE (versi terpasang, konfigurasi pnpm, hasil spike), MULTIPLAYER_DESIGN (update netcode bawaan), RISK_REGISTER (R2/R6 turun, R18–R20 baru), DEV_SETUP_WINDOWS (diverifikasi), ACCEPTANCE_CRITERIA, CLAUDE.md, README.

## 3. Hasil pengujian
| Pemeriksaan | Hasil |
|---|---|
| `pnpm verify` (lint + typecheck + test + aset) | ✅ hijau, ±4 detik |
| Unit & integration test | ✅ 22/22 |
| E2E Chrome 157 & Edge 158 | ✅ 8/8 (boot WebGL2 tanpa error konsol, hash Rapier, pointer lock → jeda → lanjut, koneksi server) |
| `pnpm dev` | ✅ client :5173 + server 127.0.0.1:2567 siap ±1 detik |
| `pnpm build` | ✅ |

### Benchmark laut (reference PC, Chrome 157, 1920×1080, kualitas Tinggi, 3 × 30 detik)
| Metrik | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| FPS rata-rata | 164,3 | 164,9 | 165,0 |
| FPS 1% terendah | 113,4 | 155,1 | 161,1 |
| Frame time p50 / p95 / p99 | 6,1 / 6,1 / 6,2 ms | 6,1 / 6,1 / 6,2 ms | 6,1 / 6,2 / 6,2 ms |
| Frame maks | 18,3 ms | 18,2 ms | 6,3 ms |
| Draw calls / segitiga | 3 / 126.720 | sama | sama |

Catatan jujur: angka ±165 FPS = batas refresh monitor (vsync), jadi kemampuan GPU sebenarnya lebih tinggi dan belum terukur. Ini **belum** benchmark game penuh (belum ada rakit, pemain, makhluk). Frame maks 18 ms di run 1–2 kemungkinan saat shader/kompilasi awal; dipantau di phase berikutnya.

## 4. Cara Anda menguji (manual, ±10 menit)
1. Buka PowerShell di folder project, lalu:
   ```powershell
   pnpm dev
   ```
2. Buka `http://localhost:5173` di **Chrome**. Expected: laut bergelombang, kotak kayu mengapung, pojok kanan atas "Server: terhubung · 1 pemain".
3. Klik **Klik untuk mulai** → gerakkan mouse & WASD. Tekan **Esc** di keyboard → menu Jeda muncul. Klik **Lanjutkan**.
4. Di menu Jeda, geser **Waktu** ke sore & malam. Expected: langit senja oranye-ungu, malam biru gelap.
5. Buka tab kedua `http://localhost:5173` → angka pemain menjadi 2.
6. Ulangi langkah 2–3 di **Edge**.
7. (Opsional) `http://localhost:5173/?spike=rapier` → panel harus menulis **COCOK dengan hash Node.js**.
8. Hentikan dengan `Ctrl + C`.

Mohon laporkan: apakah langkah 1–7 berhasil tanpa bantuan, dan kesan Anda tentang tampilan laut/langit.

## 5. Masalah yang ditemukan & penyelesaiannya
| Masalah | Akar masalah | Solusi |
|---|---|---|
| `pnpm install` gagal (`ERR_PNPM_EXOTIC_SUBDEP`) | `colyseus` mendeklarasikan transport uWebSockets sebagai peer, yang bergantung pada kode dari URL GitHub; pnpm 12 memblokirnya | `autoInstallPeers: false` — proteksi tetap aktif, transport `ws` bawaan dipakai |
| Build script diblokir | pnpm 12 menolak build script secara default | Izinkan hanya `esbuild`; tolak `msgpackr-extract` (opsional) |
| Dua versi `@colyseus/schema` (client 5.0.50, server 5.0.48) | SDK mengambil versi terbaru secara terpisah | `overrides` → satu versi untuk semua |
| `listen()` dari `@colyseus/tools` bind ke semua interface jaringan | Desain fungsi tersebut | Panggil `server.listen(port, SERVER_HOST)` langsung |
| Error konsol 404 di E2E | Browser meminta `/favicon.ico` | Deklarasi ikon kosong di `index.html` |
| Busa laut menyala di malam hari | Warna busa tidak ikut redup | Intensitas busa mengikuti cahaya siang |
| Bundle 5,2 MB | Rapier (WASM) ikut di bundle utama | Dimuat dinamis hanya saat dibutuhkan |

## 6. Known limitations (belum final, disengaja)
- Kamera terbang adalah **debug**; controller pemain baru di Phase 3.
- `SpikeRoom`, `protocol/spike`, `physics-spike` dan `DebugFloaters` (**PLACEHOLDER**) adalah kode spike — diganti di Phase 2/4.
- Laut: grid mengikuti kamera sehingga titik sampel "bergeser" (swimming) — belum terlihat mengganggu; busa masih berbentuk bercak; tidak ada bintang/bulan. Laut final di Phase 4.
- Benchmark dibatasi vsync 165 Hz; minimum spec belum diuji (Phase 15).
- Tombol Esc fisik hanya bisa diuji manual (browser tidak mengizinkan otomatisasi keluar pointer lock).
- Rapier chunk 4,3 MB (1,67 MB gzip) — R18.

## 7. Risiko diperbarui
R2 (Rapier) & R6 (TS7) turun setelah spike lulus. R1 (jitter di rakit) turun karena netcode bawaan Colyseus. Baru: R18 ukuran Rapier, R19 performa `StateView` untuk dataset besar, R20 netcode Colyseus masih baru. Detail: [RISK_REGISTER](../RISK_REGISTER.md).

## 8. Keputusan yang perlu Anda setujui
1. **ADR-0013** — memakai netcode bawaan Colyseus 0.18 untuk gerakan pemain (bukan buatan sendiri). Rekomendasi: setuju; dibuktikan di Phase 2.

## 9. Langkah berikutnya
1. Jalankan uji manual §4 dan beri kabar hasilnya.
2. Setujui ADR-0013.
3. Setujui mulainya **Phase 2 — Multiplayer foundation** (WorldRoom, join/leave/reconnect, gerakan server-authoritative dengan prediction, 2–4 pemain saling terlihat).

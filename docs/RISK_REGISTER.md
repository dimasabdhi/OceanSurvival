# Risk Register — OceanSurvival

Status: **Draft v1 (Phase 0)** · Ditinjau ulang di akhir setiap phase.
Skala: Probabilitas (P) & Dampak (D) 1–5; Skor = P × D. ≥ 15 = kritis.

| ID | Risiko | P | D | Skor | Mitigasi | Pemicu / indikator | Owner | Phase cek |
|---|---|---|---|---|---|---|---|---|
| R1 | Prediction/reconciliation pada **rakit bergerak** menimbulkan jitter/rubber-band | 1 | 5 | 5 | **Phase 3: ADR-0014 frame rakit → 0 cm koreksi termasuk transisi air↔rakit.** Netcode bawaan Colyseus 0.18 (ADR-0013, mengurangi kode buatan sendiri); raft-local frame; dt fixed identik; `stepMovement` shared; Rapier versi exact; spike di Phase 2–3 sebelum fitur lain; fallback: smoothing visual + toleransi koreksi lebih besar | Koreksi rata-rata > 5 cm di RTT 150 ms | Claude | 2, 3, 11 |
| R2 | Rapier compat tidak berperilaku sama di Node vs browser / perubahan API (0.20–0.21 sudah breaking) | 1 | 5 | 5 | **Phase 1: hash identik Node/Chrome/Edge (test otomatis).** Pin exact; determinism hash test di CI lokal; baca CHANGELOG `dimforge/rapier/bindings/typescript` sebelum upgrade; wrapper `physics/` agar API terisolasi | Hash berbeda; error init WASM di Node | Claude | 1 |
| R3 | Scope sangat besar untuk tim kecil | 5 | 4 | **20** | Milestone ketat, vertical slice Phase 6, item Deferred eksplisit, owner memprioritaskan tiap phase | Phase > 2× estimasi | Owner + Claude | Setiap phase |
| R4 | Ocean tidak cukup cantik atau terlalu berat di browser | 3 | 4 | 12 | Prototype Phase 1 + benchmark; quality preset; tanpa planar reflection v1 | FPS < 60 di reference PC | Claude | 1, 4 |
| R5 | Contoh/tutorial Colyseus lama (0.15–0.17) menyebabkan kode salah | 4 | 3 | 12 | CLAUDE.md berisi daftar API terlarang; wajib cek `docs.colyseus.io/*.md`; tidak ada official agent skill | Import `colyseus.js`, decorator, `setSimulationInterval` muncul di kode | Claude | 1, 2 |
| R6 | TypeScript 7 (compiler native) belum kompatibel dengan tooling (editor, Vitest types, schema types) | 1 | 2 | 2 | **Phase 1: lulus tanpa fallback.** Spike Phase 1; fallback TS 5.9/6.x via ADR-0011 | Error typecheck yang tidak muncul di TS 5.9 | Claude | 1 |
| R7 | Lisensi aset tidak jelas / gaya tidak konsisten / repo membengkak | 3 | 4 | 12 | Manifest wajib + validator, art bible, review 4 kondisi lighting; keputusan Git LFS saat batch aset pertama | File biner > 10 MB, total > 50 MB | Owner + Claude | 1, 7, 14 |
| R8 | Save rusak atau format berubah merusak world lama | 3 | 5 | **15** | Revisi berganda, `formatVersion` + migrasi + fixture test, transaksi DB, uji restore | Load gagal validasi zod | Claude | 2, 8 |
| R9 | Perilaku browser: tab background menghentikan rAF, pointer lock, memory leak Three.js | 4 | 3 | 12 | Server toleran input kosong; Timer.connect(document); dispose discipline + heap check 30 menit | Heap naik terus; pemain "freeze" saat alt-tab | Claude | 1, 3, 15 |
| R10 | Server crash → progress hilang | 3 | 4 | 12 | Autosave 120 s, `onBeforeShutdown`, uncaught exception handler per room | Laporan kehilangan progress | Claude | 2, 8 |
| R11 | Setup Windows: pnpm build-script approval, path panjang, firewall, Docker/WSL2 | 3 | 2 | 6 | DEV_SETUP_WINDOWS langkah demi langkah; `allowBuilds` (pnpm 12) + `autoInstallPeers: false` sudah dikonfigurasi; uji oleh owner | Owner gagal setup | Claude | 1, 8 |
| R12 | Hosting internet: TLS, NAT, biaya, latensi antar negara | 3 | 3 | 9 | Client/server terpisah sejak awal, WSS-ready config, evaluasi provider di Phase 16 | — | Owner | 16 |
| R13 | Owner bukan programmer full-time → sulit memverifikasi | 3 | 3 | 9 | Report Bahasa Indonesia, perintah PowerShell siap pakai, demo manual per phase | Owner ragu menyetujui | Claude | Setiap phase |
| R14 | Desain terlalu mirip Raft (risiko hukum/identitas) | 2 | 4 | 8 | Nama, makhluk, mekanik riset Insight, setting Hushed Sea orisinal; review identitas di Phase 14 | Kemiripan nama/aset/UI | Owner | 6, 14 |
| R15 | Paket baru rilis dengan bug/regresi (supply chain) | 2 | 3 | 6 | Pin exact, tahan rilis < 7 hari, `pnpm audit`, upgrade terjadwal | Breaking setelah upgrade | Claude | Setiap phase |
| R16 | Bandwidth/CPU melonjak saat rakit besar & banyak creature | 3 | 3 | 9 | AOI, instancing, benchmark Phase 7/10, quantization bila perlu | > 64 kbps/client | Claude | 7, 10 |
| R17 | Kode world (join code) ditebak orang asing di internet | 2 | 3 | 6 | 8 char + password opsional + rate limit join gagal + kick/ban | Join tidak dikenal | Claude | 8, 16 |
| R18 | Ukuran download Rapier compat (WASM base64): chunk 4,3 MB / 1,67 MB gzip | 3 | 2 | 6 | Lazy-load (sudah); evaluasi paket non-compat (.wasm terpisah) atau `-simd` di Phase 2–3 bila waktu load > budget | Load > 20 s cold | Claude | 2, 15 |
| R19 | `StateView` belum dioptimalkan untuk dataset besar (peringatan docs resmi) → AOI debris/creature mahal | 3 | 3 | 9 | Benchmark Phase 4; alternatif `t.stream()` / pembagian region | Tick server > budget saat AOI aktif | Claude | 4, 10 |
| R20 | Netcode bawaan Colyseus 0.18 masih baru; perilaku dengan Rapier + platform bergerak belum terbukti | 2 | 4 | 8 | **Phase 2: 0 cm koreksi pada RTT 150 ms (platform statis); platform bergerak = Phase 3.** Spike Phase 2 terfokus; ADR-0013 Proposed sampai lulus AC Phase 2 | Koreksi > 5 cm, bug framework | Claude | 2, 3 |
| R21 | Catatan pemain di file save tumbuh tanpa batas (setiap pemain yang pernah masuk) | 2 | 2 | 4 | Retensi/cleanup di Phase 8 (PostgreSQL); dev: hapus `data/saves` | File save > 1 MB | Claude | 8 |
| R22 | Satu room per world hanya dijaga dalam satu proses (registry in-memory) | 2 | 4 | 8 | Lock PostgreSQL (advisory lock) di Phase 8 sebelum multi-proses/hosting | Lebih dari 1 proses server | Claude | 8, 16 |

| R23 | Frame relatif-rakit (ADR-0014) perlu perluasan saat rakit berbelok/berubah kecepatan (Phase 11) dan saat ada pulau diam di dunia (Phase 12) | 3 | 4 | 12 | Rancang ADR lanjutan sebelum Phase 11; kecepatan rakit menjadi state yang dibaca step; jangkar → frame diam | Koreksi prediksi saat layar/kemudi dipakai | Claude | 11, 12 |

## Risiko teratas saat ini
1. **R1 / R20** — jitter rakit & netcode bawaan Colyseus → di-spike pertama kali di Phase 2–3.
2. **R3** — scope → dikelola lewat vertical slice dan disiplin phase.
3. **R8** — fondasi data → save migration test sejak Phase 2. (R2 & R6 turun setelah spike Phase 1.)

## Log perubahan
| Tanggal | Perubahan |
|---|---|
| 2026-11-21 | Register awal (Phase 0) |
| 2026-11-21 | Phase 1: R2, R6 turun (spike lulus); R1 turun (ADR-0013); tambah R18–R20 |
| 2026-11-21 | Phase 2: R20 turun (prediksi exact); tambah R21–R22 |
| 2026-11-21 | Phase 3: R1 turun (frame rakit, 0 cm di rakit hanyut); tambah R23 |

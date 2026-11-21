# OceanSurvival

> Nama kerja. Nama final game akan diputuskan kemudian.

Game **survival 3D first-person di tengah lautan** yang berjalan langsung di browser desktop (Chrome / Edge), dengan **co-op multiplayer 2–4 pemain** dalam satu dunia bersama yang persisten.

Pemain mulai di atas rakit kecil, mengait sampah dan resource yang hanyut, membuat alat, memperluas rakit, menjaga lapar–haus–kesehatan–oksigen, menghadapi predator laut, lalu menjelajahi pulau dan dasar laut sambil membuka teknologi baru.

Terinspirasi oleh *jenis* gameplay seperti Raft, tetapi **seluruh identitas, dunia, aset, audio, UI, dan kode adalah orisinal**.

## Status

| Phase | Status |
|---|---|
| Phase 0 — Arsitektur & dokumentasi | ✅ Dokumen dibuat, menunggu persetujuan owner |
| Phase 1 — Fondasi repo & tech spikes | ⏳ Belum dimulai |

Belum ada kode yang bisa dijalankan. Roadmap lengkap: [docs/ROADMAP.md](docs/ROADMAP.md).

## Teknologi

TypeScript · Three.js (WebGL 2) · Vite · Rapier (WASM physics) · Colyseus 0.18 (authoritative multiplayer server, Node.js 24) · Preact · PostgreSQL 18 (Docker) · pnpm monorepo · Vitest · Playwright · Biome.

Alasan pemilihan: [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) dan [docs/adr/](docs/adr/README.md).

## Struktur repository (target)

```
apps/client      Game client di browser (Vite + Three.js + Preact)
apps/server      Game server authoritative (Colyseus, Node.js)
packages/shared  Kode & data yang dipakai client dan server (protokol, item, movement)
assets/          Aset runtime + manifest lisensi
assets-src/      File sumber aset (Blender, dll.)
tools/           Skrip validasi aset, benchmark
tests/e2e/       Tes end-to-end multi-pemain
infra/           Docker Compose (PostgreSQL)
docs/            Seluruh dokumentasi desain
```

## Menjalankan development

> Tersedia mulai **Phase 1**. Panduan lengkap untuk Windows: [docs/DEV_SETUP_WINDOWS.md](docs/DEV_SETUP_WINDOWS.md).

Prasyarat: Node.js 24.13.0, pnpm 12.21.0, Git, Docker Desktop (untuk PostgreSQL mulai Phase 8), Chrome atau Edge terbaru.

Rencana perintah (PowerShell, dari folder project):

```powershell
pnpm install
```

```powershell
pnpm dev
```

Lalu buka `http://localhost:5173` di Chrome/Edge.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [PRODUCT_VISION](docs/PRODUCT_VISION.md) | Visi, target pemain, pilar desain |
| [GAME_DESIGN_DOCUMENT](docs/GAME_DESIGN_DOCUMENT.md) | GDD lengkap: loop, progression, konten |
| [GAMEPLAY_SYSTEMS](docs/GAMEPLAY_SYSTEMS.md) | Spesifikasi teknis tiap sistem gameplay |
| [TECHNICAL_ARCHITECTURE](docs/TECHNICAL_ARCHITECTURE.md) | Arsitektur, modul, stack, folder |
| [MULTIPLAYER_DESIGN](docs/MULTIPLAYER_DESIGN.md) | Netcode, protokol, tick, reconnection |
| [DATABASE_DESIGN](docs/DATABASE_DESIGN.md) | Data model & persistence |
| [ASSET_PIPELINE](docs/ASSET_PIPELINE.md) | Alur aset & lisensi |
| [ART_DIRECTION](docs/ART_DIRECTION.md) | Art bible |
| [UI_UX_SPECIFICATION](docs/UI_UX_SPECIFICATION.md) | Layar, HUD, kontrol |
| [PERFORMANCE_BUDGET](docs/PERFORMANCE_BUDGET.md) | Target & budget performa |
| [SECURITY_DESIGN](docs/SECURITY_DESIGN.md) | Threat model |
| [TESTING_STRATEGY](docs/TESTING_STRATEGY.md) | Strategi pengujian |
| [ROADMAP](docs/ROADMAP.md) | Milestone |
| [ACCEPTANCE_CRITERIA](docs/ACCEPTANCE_CRITERIA.md) | Definisi selesai per phase |
| [RISK_REGISTER](docs/RISK_REGISTER.md) | Risiko & mitigasi |
| [GLOSSARY](docs/GLOSSARY.md) | Istilah |
| [adr/](docs/adr/README.md) | Architecture Decision Records |

## Lisensi & kredit aset

Semua aset pihak ketiga dicatat di [assets/manifest.json](assets/manifest.json) dan [CREDITS.md](CREDITS.md). Lisensi kode project belum ditentukan (keputusan owner).

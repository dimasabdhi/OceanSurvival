# CLAUDE.md — Instruksi permanen untuk Claude Code

Project: **OceanSurvival** (nama kerja). Game survival-lautan 3D first-person, co-op 2–4 pemain, berjalan di browser desktop (Chrome/Edge). Terinspirasi *jenis* gameplay Raft, tetapi seluruh identitas, aset, nama, cerita, dan kode **orisinal**.

## Status saat ini
- Phase 0 (dokumentasi) ✅ · **Phase 1 (fondasi & tech spikes) selesai, menunggu review owner** — laporan: [docs/reports/PHASE_01_REPORT.md](docs/reports/PHASE_01_REPORT.md). Phase 2 hanya setelah owner menyetujui.
- Kode `Spike*` (SpikeRoom, protocol/spike, physics-spike, DebugFloaters) adalah **spike Phase 1**, bukan fitur final — diganti di Phase 2.
- Git: remote `origin` = github.com/dimasabdhi/OceanSurvival, branch `main`. Setelah setiap phase/perubahan terverifikasi: commit lalu push.
- Sumber kebenaran urutan kerja: [docs/ROADMAP.md](docs/ROADMAP.md) dan [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md).
- Keputusan arsitektur: [docs/adr/](docs/adr/README.md). Jangan melanggar ADR berstatus *Accepted*; usulkan ADR baru bila perlu berubah.

## Komunikasi dengan owner
- Owner = project owner, **bukan programmer full-time**. Laporan & instruksi dalam **Bahasa Indonesia**; identifier/kode/commit message dalam **English**.
- Setiap laporan: apa yang dikerjakan, kenapa, file yang diubah, cara menguji, hasil uji, masalah, langkah owner berikutnya.
- Perintah terminal untuk owner: **PowerShell**, sedikit demi sedikit, dengan konteks.
- Prioritas owner: kualitas, konsistensi gameplay, stabilitas multiplayer, visual > kecepatan.

## Stack terkunci (lihat ADR untuk alasan)
| Area | Paket (pin **exact**, tanpa `^`/`~`) |
|---|---|
| Runtime | Node.js 24.13.0 (`.node-version`), pnpm 12.21.0 via `packageManager` |
| Bahasa | TypeScript 7.0.x (fallback ADR-0011) — `strict: true` |
| Client | Vite 8.3.x, three 0.187.0 (`WebGLRenderer`, WebGL2), Preact 11 + @preact/signals |
| Physics | `@dimforge/rapier3d-compat` 0.21.0 — **versi identik di client & server** |
| Multiplayer | `colyseus` 0.18.x, `@colyseus/sdk` 0.18.x, `@colyseus/schema` 5.x, zod 4 |
| DB (Phase 8+) | PostgreSQL 18 (Docker Compose, port 5433), Kysely + pg |
| Tooling | Biome, Vitest 5, Playwright, tsx |

Versi persis: `package.json` tiap package + `pnpm-workspace.yaml` (overrides `@colyseus/schema` 5.0.48 & `@colyseus/core` 0.18.28 — satu versi untuk client & server). Jangan pakai rilis berumur < 7 hari. Jangan aktifkan `autoInstallPeers` atau izinkan build script baru tanpa alasan (lihat TECHNICAL_ARCHITECTURE §2).

## Aturan arsitektur (wajib)
1. **Server authoritative** untuk: posisi/movement pemain, item, inventory, crafting, building, spawn, world event, creature, damage, vitals, save. Client hanya mengirim **input/intent**.
2. Movement: client prediction + server reconciliation; kode movement di `packages/shared/movement` dipakai client & server; fixed step **60 Hz**. Pemain di atas rakit memakai **raft-local frame** (ADR-0005).
3. `packages/shared` = TypeScript murni (tanpa DOM, tanpa Node API). Data game (item, recipe, building piece) adalah **data**, bukan kode tersebar.
4. Setiap network message punya **zod schema** di `packages/shared/protocol`; server memvalidasi semua payload. Tidak ada `any` di batas jaringan.
5. Logic gameplay tidak boleh ditulis di layer render/UI client.
6. Jangan kirim seluruh world state per frame; pakai Schema delta + `StateView` (interest management).
7. Semua resource Three.js yang dibuat harus punya jalur `dispose()`.

## Colyseus 0.18 — hindari API usang
- Tidak ada official agent-skill Colyseus. **Wajib** cek dokumentasi resmi versi terpasang sebelum menulis kode: `https://docs.colyseus.io/llms.txt` (tiap halaman tersedia sebagai `.md`).
- Pakai: `defineServer`/`defineRoom`, `messages = { name: validate(zodSchema, handler) }`, `setFixedTimestep`/`setTimestep`, `onDrop`/`onReconnect`/`allowReconnection`, `onBeforeShutdown`, `StateView`, `CloseCode`, `Callbacks.get(room)` di client, `schema({...})` builder.
- Netcode bawaan 0.18 untuk movement (ADR-0013): server `defineInput(schema, { sanitize })` + `setFixedTimestep`; client `room.input()`, `room.clock`, `Predict`/`predict.sim`. Room generic: `Room<{ state: S; input: I }>`.
- Jalankan server dengan `server.listen(port, SERVER_HOST)` (bukan `listen()` dari `@colyseus/tools`, yang bind ke semua interface).
- **Jangan**: paket `colyseus.js` (diganti `@colyseus/sdk`), `@type` decorators, `defineTypes`, `setSimulationInterval`, `onLeave(client, consented: boolean)`, `client.id`, `Room<State>` generic lama, `this.onMessage` tanpa validasi.
- Three.js: cek Migration Guide untuk r187+ (mis. `Timer` menggantikan `Clock`). Rapier 0.21: `SoftBodySet` di signature `step/remove` — cek CHANGELOG `dimforge/rapier/bindings/typescript`.

## Cara kerja
- Kerja **per milestone**; tiap phase wajib: scope, desain, rencana, test otomatis, prosedur tes manual, cek performa, known limitations, completion report (`docs/reports/PHASE_XX_REPORT.md`).
- Fitur **belum selesai** sampai acceptance criteria-nya terbukti (test + manual). Jangan klaim "teroptimasi" tanpa benchmark.
- Placeholder harus ditandai eksplisit (`placeholder: true` di manifest aset, `// PLACEHOLDER:` di kode, dan disebut di report).
- Bug: cari akar masalah; jangan workaround tanpa memahami penyebab.
- Tidak ada rewrite besar tanpa justifikasi + persetujuan owner.
- Jangan install dependency di luar stack tanpa alasan tertulis.
- Jangan hapus file pengguna / perintah destruktif. Commit hanya bila owner meminta. Branch utama: `main`.

## Aset & lisensi
- Hanya CC0, CC-BY 3.0/4.0, MIT/BSD, OFL, atau buatan sendiri. Tolak NC/ND/tidak jelas. **Tidak boleh** aset/kode/audio/UI dari Raft atau game lain.
- Setiap file di `assets/` wajib punya entri di `assets/manifest.json`. Art style: **stylized low-poly** ([docs/ART_DIRECTION.md](docs/ART_DIRECTION.md)).

## Keamanan
- Credential hanya di `.env` (git-ignored). Server dev bind `127.0.0.1`/LAN, tidak diekspos ke internet.
- Database tidak pernah diakses langsung oleh client.

## Perintah
`pnpm install` · `pnpm dev` (client :5173 + server :2567) · `pnpm verify` (lint+typecheck+test+assets, gate wajib) · `pnpm test` · `pnpm test:e2e` (Chrome+Edge terpasang, tanpa download browser) · `pnpm bench:ocean` (headed, GPU asli; `BENCH_SECONDS`, `BENCH_RUNS`, `BENCH_QUALITY`) · `pnpm build` · `pnpm format`
- Mode URL client: `?net=0` (tanpa server), `?spike=rapier`, `?bench=ocean&seconds=60`, `?quality=low|medium|high`. Dev-only: `window.__OS_DEBUG__ = { game, store }`.
- Golden hash Rapier (`GOLDEN_RAPIER_HASH_600`) harus sama di Node & browser; bila upgrade Rapier mengubahnya → review ADR-0003.

## Peta dokumentasi
Visi [PRODUCT_VISION](docs/PRODUCT_VISION.md) · GDD [GAME_DESIGN_DOCUMENT](docs/GAME_DESIGN_DOCUMENT.md) · Sistem [GAMEPLAY_SYSTEMS](docs/GAMEPLAY_SYSTEMS.md) · Arsitektur [TECHNICAL_ARCHITECTURE](docs/TECHNICAL_ARCHITECTURE.md) · Netcode [MULTIPLAYER_DESIGN](docs/MULTIPLAYER_DESIGN.md) · DB [DATABASE_DESIGN](docs/DATABASE_DESIGN.md) · Aset [ASSET_PIPELINE](docs/ASSET_PIPELINE.md) · Art [ART_DIRECTION](docs/ART_DIRECTION.md) · UI [UI_UX_SPECIFICATION](docs/UI_UX_SPECIFICATION.md) · Performa [PERFORMANCE_BUDGET](docs/PERFORMANCE_BUDGET.md) · Security [SECURITY_DESIGN](docs/SECURITY_DESIGN.md) · Testing [TESTING_STRATEGY](docs/TESTING_STRATEGY.md) · Risiko [RISK_REGISTER](docs/RISK_REGISTER.md) · Istilah [GLOSSARY](docs/GLOSSARY.md) · Setup [DEV_SETUP_WINDOWS](docs/DEV_SETUP_WINDOWS.md)

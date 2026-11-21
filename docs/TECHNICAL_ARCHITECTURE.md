# Technical Architecture — OceanSurvival

Status: **Draft v1 (Phase 0)** · Keputusan detail: [adr/](adr/README.md) · Netcode: [MULTIPLAYER_DESIGN](MULTIPLAYER_DESIGN.md) · Data: [DATABASE_DESIGN](DATABASE_DESIGN.md)

## 1. Environment baseline (diperiksa 2026-11-21)
| Item | Nilai |
|---|---|
| OS | Windows 11 Pro 10.0.26300 |
| Reference PC | AMD Ryzen 5 7500F · AMD Radeon RX 9060 XT · 31.6 GB RAM |
| Node.js / npm | 24.13.0 (LTS) / 11.6.2 |
| pnpm | belum terpasang → 12.21.0 (Phase 1) |
| Git / Docker | 2.52.0 / 29.5.3 |
| PostgreSQL native | 18.3 service di :5432 (tidak dipakai project; project memakai container di :5433) |
| Browser | Chrome 157, Edge 158 |

## 2. Stack & versi (diverifikasi via npm registry 2026-11-21)
| Area | Paket | Versi kandidat | ADR |
|---|---|---|---|
| Monorepo | pnpm workspaces | 12.21.0 | [0001](adr/0001-pnpm-monorepo.md) |
| Bahasa | typescript | 7.0.2 | [0011](adr/0011-typescript-7.md) |
| Rendering | three, @types/three | 0.187.0 | [0002](adr/0002-threejs-webgl2-renderer.md) |
| Bundler | vite | 8.3.8 | [0001](adr/0001-pnpm-monorepo.md) |
| Physics | @dimforge/rapier3d-compat | 0.21.0 | [0003](adr/0003-rapier-physics-both-sides.md) |
| Server MP | colyseus | 0.18.12 | [0004](adr/0004-colyseus-018-authoritative-server.md) |
| Client MP | @colyseus/sdk | 0.18.10 | [0004](adr/0004-colyseus-018-authoritative-server.md) |
| State sync | @colyseus/schema | 5.0.x (pin saat Phase 1; 5.0.50 rilis 2026-11-19 → tunggu ≥ 7 hari atau pakai patch sebelumnya) | [0004](adr/0004-colyseus-018-authoritative-server.md) |
| Validasi | zod | 4.6.7 | [0004](adr/0004-colyseus-018-authoritative-server.md) |
| UI | preact, @preact/signals | 11.2.0, 2.11.4 | [0008](adr/0008-preact-signals-ui.md) |
| DB | kysely, pg | 0.29.9, 8.23.1 | [0007](adr/0007-persistence-strategy.md) |
| Test | vitest, @playwright/test | 5.1.1, 1.65.1 | [0012](adr/0012-tooling-biome-vitest-playwright.md) |
| Lint/format | @biomejs/biome | 2.6.8 | [0012](adr/0012-tooling-biome-vitest-playwright.md) |
| Dev runner | tsx | 4.23.15 | [0012](adr/0012-tooling-biome-vitest-playwright.md) |

Kebijakan: semua versi **exact pin**; upgrade hanya lewat PR/commit tersendiri dengan catatan changelog dan test hijau. Kompatibilitas engine terverifikasi: Colyseus `node >= 22`, Vite `>=22.12`, Vitest `^24` → Node 24.13 memenuhi semua.

### Evaluasi pertanyaan owner
| Pertanyaan | Keputusan | Alasan |
|---|---|---|
| Framework UI tambahan? | **Preact + signals** untuk menu/inventory/crafting; HUD sederhana juga Preact tapi di-update via signals | Inventory/crafting/research = banyak state & komponen; vanilla DOM akan menjadi framework buatan sendiri. Preact kecil (~4 KB gz) dan tidak menyentuh render loop 3D |
| Monorepo? | **Ya** (`apps/*`, `packages/*`) | Client & server berbagi protokol, data item, fungsi movement & wave — satu sumber kebenaran |
| npm vs pnpm? | **pnpm** (keputusan owner) | Strict node_modules, cepat, workspace protocol |
| Client & server terpisah? | **Ya**, dua app terpisah | Deploy berbeda (static hosting vs Node), dependency berbeda |
| Shared types & data? | `packages/shared` (TS murni) + zod schema | Satu definisi → tipe TS + validasi runtime |
| PostgreSQL sejak awal? | **Tidak** — interface `WorldRepository`, implementasi `file` dulu, PostgreSQL di Phase 8 | Bentuk data masih berubah cepat di Phase 2–7; migrasi DB terus-menerus = biaya tanpa nilai |
| Dev vs prod environment? | `.env` per environment, `NODE_ENV`, config server divalidasi zod saat startup; client `VITE_*` | Gagal cepat bila config salah; tidak ada secret di client |

## 3. Arsitektur sistem
```
┌───────────────────────────── apps/client (browser) ─────────────────────────────┐
│ app/      AppStateMachine: Boot → MainMenu → Lobby → Loading → InGame → (Pause) │
│ net/      NetClient (Colyseus SDK) · StateMirror · ServerClock · Interpolator   │
│ player/   InputSampler (pointer lock) · Predictor (shared movement + Rapier)    │
│           Reconciler · CameraController · Viewmodel                             │
│ physics/  ClientPhysicsWorld (Rapier mirror: raft colliders, terrain)           │
│ world/    EntityViewRegistry: RaftView, PlayerView, DebrisView, CreatureView    │
│ render/   Renderer (WebGLRenderer) · SceneGraph · OceanRenderer · SkyRenderer   │
│           QualityManager · FloatingOrigin · PerfOverlay                         │
│ systems/  BuildPreview · HookVisual · VFX · Interaction prompts                  │
│ ui/       Preact app (HUD, menus, inventory, crafting) ⇄ signals store          │
│ audio/    AudioManager (Web Audio, spatial)                                     │
│ assets/   AssetLoader (GLTFLoader + KTX2 + Meshopt) · AssetRegistry             │
└──────────────────────────────────────▲──────────────────────────────────────────┘
                                       │ WebSocket (Colyseus: schema patches + messages)
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│ apps/server (Node 24)                                                           │
│ config/      env + zod validation                                               │
│ rooms/       LobbyRoom (daftar world) · WorldRoom (1 world aktif)               │
│ net/         message handlers (zod) · RateLimiter · auth (onAuth)               │
│ sim/         Simulation: fixed-step loop, SystemScheduler, EventBus, WorldClock │
│ systems/     Movement · Hook · Debris · Inventory · Crafting · Building ·       │
│              Survival · Damage · CreatureAI · Spawning · Weather · Navigation   │
│ physics/     ServerPhysicsWorld (Rapier) per WorldRoom                          │
│ state/       Colyseus schema (replicated) + server-only state                   │
│ persistence/ WorldRepository (file | postgres) · SaveSerializer · migrations    │
└─────────────────────────────────────────────────────────────────────────────────┘
packages/shared: data/ (items, recipes, pieces, creatures, loot) · protocol/ (zod msgs, ids,
quantization) · movement/ · ocean/ (wave fn + GLSL source string) · grid/ (placement, support)
· math/ (vec, quat, PRNG, noise) · constants (tick rates, limits)
```

### 3.1 Tanggung jawab modul
| Modul | Tanggung jawab | Tidak boleh |
|---|---|---|
| Rendering | Menggambar state; LOD; instancing; post-processing | Mengubah state gameplay |
| Gameplay simulation (server) | Semua aturan permainan, fixed step | Bergantung pada waktu wall-clock langsung (pakai `WorldClock`) |
| Player controller | Input → command; prediction; kamera | Mengirim posisi sebagai kebenaran |
| Physics | Collision, raycast, character controller | Menyimpan state gameplay non-fisik |
| World simulation | Waktu, cuaca, arus, angin, region | — |
| Entity management | ID, lifecycle entity, registry per tipe | — |
| Building / Inventory / Crafting / Survival / AI | Lihat [GAMEPLAY_SYSTEMS](GAMEPLAY_SYSTEMS.md) | Saling memanggil internal sistem lain secara langsung (lewat service interface / EventBus) |
| Networking | Transport, validasi, replikasi, interpolasi | Logika gameplay |
| Persistence | Serialisasi, save/load, migrasi format | Dipanggil per tick |
| UI | Tampilan & input menu | Mengakses Colyseus/Three langsung |
| Audio | Mixer, spatial sound dari event | — |
| Asset loading | Load/cache/dispose, registry dari manifest | — |

### 3.2 Pola simulasi server
- **Entity data per sistem** (struktur data sederhana, bukan ECS framework). Alasan: skala entity kecil (< 2.000 per world), ECS penuh menambah kompleksitas tanpa manfaat terukur. Dievaluasi ulang bila benchmark Phase 15 menunjukkan bottleneck.
- `SystemScheduler` memanggil sistem dalam **urutan tetap** setiap step: `Input → Movement → Physics step → Hook → Debris → Creature (setiap 6 step) → Damage → Survival (setiap 30 step) → Building → Spawning → Weather/World (setiap 60 step) → Replication sync`.
- `EventBus` sinkron dalam step (mis. `PieceDestroyed` → Building collapse → Debris drop → Audio event ke client).

### 3.3 Client frame loop
```
requestAnimationFrame:
  timer.update()  (THREE.Timer, connect(document))
  accumulator += dt
  while accumulator >= 1/60: sampleInput → predictor.step → send batched cmds; accumulator -= 1/60
  reconciler.apply(serverAcks)               // re-sim dari ack terakhir
  interpolator.update(renderTime = serverTime - 100ms)
  views.sync() → render() → perfOverlay.update()
UI (Preact) bereaksi terhadap signals; signals vital/hotbar di-update maksimal 10 Hz.
```
Tab di background: rAF berhenti → client berhenti mengirim input; server menganggap input kosong (pemain diam) — bukan disconnect. Setelah 5 menit tanpa input dari tab aktif → status `idle` (tidak di-kick v1).

## 4. Proposed folder structure
```
OceanSurvival/
├─ apps/
│  ├─ client/
│  │  ├─ index.html · vite.config.ts · tsconfig.json · package.json
│  │  └─ src/{app,net,player,physics,world,render,systems,ui,audio,assets}/  main.ts
│  └─ server/
│     ├─ tsconfig.json · package.json
│     ├─ migrations/                 (Kysely, Phase 8)
│     └─ src/{config,rooms,net,sim,systems,physics,state,persistence}/  index.ts · app.config.ts
├─ packages/shared/src/{data,protocol,movement,ocean,grid,math}/  index.ts
├─ assets/          runtime assets (models/, textures/, audio/, icons/) + manifest.json
├─ assets-src/      blend/, raw/ (download asli + file lisensi)
├─ tools/           validate-assets.ts · gen-credits.ts · bench/
├─ tests/e2e/       Playwright specs (multi-context)
├─ infra/           docker-compose.yml · backup/restore scripts (.ps1)
├─ docs/            dokumen + adr/ + reports/
├─ biome.json · pnpm-workspace.yaml · package.json · tsconfig.base.json   (Phase 1)
└─ CLAUDE.md · README.md · CREDITS.md · .env.example · .editorconfig · .gitattributes · .gitignore · .node-version
```
Aturan dependency antar package: `client → shared`, `server → shared`, `shared → (zod, rapier types only)`. Client **tidak boleh** import dari server dan sebaliknya (dicek lint `noRestrictedImports`).

## 5. Rendering
- `THREE.WebGLRenderer` (WebGL 2 wajib; tampilkan pesan bila tidak tersedia). `outputColorSpace = SRGBColorSpace`, tone mapping `ACESFilmic` atau `AgX` (diputuskan di art spike).
- Shadow: 1 directional light (matahari/bulan) dengan cascaded/fit-to-raft shadow camera; shadow map 2048 (High), 1024 (Medium), off (Low).
- Instancing wajib untuk: building pieces, debris, prop pulau, ikan.
- Post-processing minimal: FXAA/SMAA, bloom ringan (High), fog. Tidak ada SSR/SSAO v1.
- WebGPU: ditunda (ADR-0002); `render/` diabstraksi agar migrasi tidak menyentuh gameplay.
- Floating origin: rebase scene saat kamera > 2.000 m dari origin.

## 6. Physics
- Rapier `-compat` di kedua sisi, versi identik. Server: satu `World` per WorldRoom (gravity −9.81). Client: `ClientPhysicsWorld` hanya untuk collider yang relevan bagi prediction (rakit di sekitar, terrain pulau dekat) — tidak mensimulasi creature/debris.
- Rakit = kinematic body; piece = collider compound. Pemain = kinematic character controller.
- Debris tidak memakai rigid body (buoyancy analitik murah). Raycast hook/interaksi memakai query Rapier.

## 7. Networking (ringkas)
Detail di [MULTIPLAYER_DESIGN](MULTIPLAYER_DESIGN.md). Server fixed **60 Hz**, patch **20 Hz**, AI **10 Hz**, vitals **2 Hz**, input batch **30 Hz** (2 command per pesan). Remote entity interpolasi 100 ms. Prediction + reconciliation untuk pemain lokal.

## 8. Persistence (ringkas)
Detail di [DATABASE_DESIGN](DATABASE_DESIGN.md). `WorldRepository` (interface) → `FileWorldRepository` (Phase 2–7) → `PostgresWorldRepository` (Phase 8+). Autosave 120 s, save saat semua pemain keluar, saat `onBeforeShutdown`.

## 9. Asset loading
`AssetRegistry` dibangun dari `assets/manifest.json` (build-time import). Loader: `GLTFLoader` + `KTX2Loader` + `MeshoptDecoder`. Cache referensi + refcount; `dispose()` saat region di-unload. Preload set per layar (menu vs in-game).

## 10. Logging & observability
- Server: logger terstruktur JSON (level dari env), konteks `roomId`, `playerId`, `tick`. Metrik in-process: tick duration (avg/p95/max), patch bytes/s per client, jumlah entity, memory. Endpoint debug lokal `/debug/metrics` hanya di development.
- Colyseus Monitor & Playground hanya aktif `NODE_ENV=development`.
- Client: PerfOverlay (FPS, frame ms, draw calls, triangles, textures/geometries count dari `renderer.info`, RTT, prediction error).

## 11. Environment separation
| | development | production |
|---|---|---|
| Client | Vite dev server :5173, HMR | `vite build` → static files (CDN/hosting) |
| Server | `tsx watch`, bind 127.0.0.1/LAN, monitor aktif | Node build (`tsc`/bundle), bind sesuai hosting, monitor nonaktif, TLS via reverse proxy |
| DB | Docker Compose :5433 | Managed PostgreSQL / container dengan backup terjadwal |
| Config | `.env` lokal | Secret dari environment hosting |

## 12. Graceful shutdown
SIGINT/SIGTERM → Colyseus `gracefullyShutdown` → setiap WorldRoom `onBeforeShutdown`: broadcast "server restarting", flush save (timeout 10 s) → `onDispose` → close DB pool.

## 13. Tech spikes wajib di Phase 1 (sebelum fitur)
1. TypeScript 7: typecheck monorepo + Vite + Vitest + Colyseus schema types.
2. Rapier compat: init & step di Node 24 dan di Chrome via Vite; hash snapshot sama setelah 600 step dengan input sama (determinism check).
3. Colyseus 0.18: `defineServer/defineRoom`, schema builder, `validate(zod)`, `StateView`, `setFixedTimestep` — prototipe kecil + test integrasi.
4. Ocean shader: 4 Gerstner + foam pada grid clipmap, ukur frame time di reference PC.
5. Preact overlay di atas canvas dengan pointer lock (fokus/escape handling).
Hasil spike dicatat di `docs/reports/PHASE_01_REPORT.md`; ADR diperbarui bila ada perubahan.

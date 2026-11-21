# Roadmap — OceanSurvival

Status: **Draft v1 (Phase 0)** · Definisi selesai tiap phase: [ACCEPTANCE_CRITERIA](ACCEPTANCE_CRITERIA.md)

## Perubahan dari roadmap awal owner & alasannya
| Perubahan | Alasan |
|---|---|
| **Multiplayer foundation dipindah dari Phase 7 → Phase 2** | Owner memilih movement **full server-authoritative** (ADR-0005). Jika controller, hook, dan inventory dibuat single-player dulu, semuanya harus ditulis ulang untuk berjalan di server. Dengan server sejak awal, setiap fitur lahir dalam bentuk akhirnya. Single-player = room solo di server lokal |
| Rendering foundation digabung dengan **tech spikes** di Phase 1 | Risiko teknis terbesar (TS 7, Rapier di Node, Colyseus 0.18, ocean shader) harus dibuktikan sebelum membangun di atasnya |
| **Persistence dimajukan dari Phase 13 → Phase 8** (setelah building) | World tanpa save tidak bisa dimainkan berulang; data building/inventory sudah stabil di titik itu |
| Navigation (11) sebelum Islands (12) | Pulau hanya bermakna bila rakit bisa diarahkan ke sana |
| Vertical Slice ditetapkan di akhir Phase 6 | Bukti loop inti co-op (rakit → hook → inventory → craft) sedini mungkin |

## Ringkasan phase
| # | Nama | Tujuan utama | Bergantung pada | Ukuran relatif |
|---|---|---|---|---|
| 0 | Architecture & documentation | Keputusan, dokumen, ADR | — | S |
| 1 | Foundation & tech spikes | Monorepo, tooling, spike TS7/Rapier/Colyseus/ocean, render loop, perf overlay | 0 | M |
| 2 | Multiplayer foundation | WorldRoom, join/leave/reconnect, fixed tick, prediction+reconciliation kapsul, interpolasi, file persistence stub | 1 | L |
| 3 | First-person controller & starting raft | Controller lengkap, swim, rakit 2×2 bergerak (raft-local frame), interaksi raycast, pause/settings dasar | 2 | L |
| 4 | Ocean & floating resources | Ocean final v1, day/night, debris spawn/drift/despawn server, AOI | 3 | M |
| 5 | Hook gameplay | Lempar/tarik/ambil, rope visual, validasi server | 4 | M |
| 6 | Inventory & basic crafting → **Vertical Slice v0.1** | Inventory/hotbar/drop, hand-craft, UI | 5 | L |
| 7 | Building system | Grid, ghost, socket, struktur, demolish/repair, instancing | 6 | XL |
| 8 | Persistence & world management | PostgreSQL, migrations, create/join/continue world, lobby, backup | 7 | L |
| 9 | Survival & progression | Vitals, makan/minum, stasiun, Insight research, farming, downed/revive | 8 | XL |
| 10 | Animals & combat | Fish, Reefjaw, Needlefin, damage rakit, senjata, repair | 9 | L |
| 11 | Navigation | Sail, paddle, anchor, steering, wind, world chunk & floating origin | 10 | L |
| 12 | Islands & underwater | Pulau seed-based, resource node, loot, bawah laut, oxygen upgrade, streaming | 11 | XL |
| 13 | World progression & events | Weather penuh, Beacon, event lingkungan, engine | 12 | L |
| 14 | UI, audio & visual polish | Final UI, audio mix, VFX, art pass, teks UI Indonesia lengkap | 13 | L |
| 15 | Performance, QA & balancing | Benchmark penuh, minimum spec, balancing data, bug bash | 14 | L |
| 16 | Deployment & hosting | Build produksi, hosting server+client, TLS, backup terjadwal, monitoring | 15 | M |

## Detail scope per phase
### Phase 1 — Foundation & tech spikes
- pnpm workspace (`apps/client`, `apps/server`, `packages/shared`), tsconfig base, Biome, Vitest, scripts `dev/test/lint/typecheck/verify`.
- Spike: TS 7 typecheck lintas package; Rapier init+step di Node & Chrome + determinism hash; Colyseus 0.18 hello room (schema builder, `validate(zod)`, `StateView`); Preact overlay + pointer lock.
- Render: WebGLRenderer, kamera debug, ocean shader prototype (4 Gerstner, foam), sky + day/night dasar, PerfOverlay, bench scene `?bench=ocean`.
- `tools/validate-assets` + manifest schema; DEV_SETUP_WINDOWS divalidasi di mesin owner.
- **Tidak termasuk**: gameplay, persistence.

### Phase 2 — Multiplayer foundation
- LobbyRoom minimal (alamat server + nama), WorldRoom, identitas guest token, `onAuth/onJoin/onDrop/onReconnect/onLeave/onBeforeShutdown`.
- Fixed 60 Hz loop + SystemScheduler; `stepMovement` shared (lantai datar + air sederhana); prediction + reconciliation; interpolasi remote; ServerClock.
- `tools/netsim`, bot client, metrik tick/bandwidth; `FileWorldRepository` stub (save posisi pemain).

### Phase 3 — First-person controller & starting raft
- Controller lengkap (walk/sprint/jump/swim surface & under), kamera FP, head bob opsional, viewmodel placeholder.
- Rakit 2×2 sebagai kinematic body bergerak (drift), raft-local frame, naik/turun rakit dari air.
- Interaction raycast + prompt; Pause & Settings dasar (sensitivitas, FOV, grafik preset).

### Phase 4 — Ocean & floating resources
- Ocean shader final v1 (LOD ring, depth color, fresnel), sinkron wave fn client/server, day/night penuh, fog.
- Debris: spawn/drift/despawn server, buoyancy analitik, AOI via StateView, InstancedMesh.

### Phase 5 — Hook gameplay
- Grapple Line: charge/throw/reel/cancel, balistik server, tangkap debris, rope visual, animasi & SFX placeholder.

### Phase 6 — Inventory & basic crafting (Vertical Slice v0.1)
- InventoryService atomik + txId, hotbar, drop/pickup, hand-craft Rope/Plank/Foundation sederhana/Spear, UI inventory & crafting, teks UI via `locales/id.json`.
- Playtest co-op 2–4 pemain 30 menit.

### Phase 7 — Building system
- BuildingPieceDef data, socket & grid, ghost preview, `validatePlacement` shared, support graph & collapse, Builder's Mallet, demolish/repair, collider compound incremental, InstancedMesh per piece.

### Phase 8 — Persistence & world management
- Docker Compose PostgreSQL 18, Kysely migrations, `PostgresWorldRepository`, snapshot + revisi, advisory lock, create/join/continue world, lobby UI, roles owner/member, backup/restore script + uji restore.

### Phase 9 — Survival & progression
- Vitals & status effect, makanan/air, Brazier/Solar Still/Drip Catcher/Smelter/Planter, Survey Table & Insight tech tree, downed/revive/respawn & Wreck Bag, mode Calm/Normal/Harsh.

### Phase 10 — Animals & combat
- Fish boids, Reefjaw AI (patrol/stalk/attack/retreat), Needlefin, damage rakit & collapse, Spear/Metal Spear, lag-compensated melee, repair loop.

### Phase 11 — Navigation
- RaftMotion (drift/sail/paddle/anchor/steer), angin, world chunk server, floating origin client, Navigation Desk dasar.

### Phase 12 — Islands & underwater
- Generator pulau seed-based (4 tipe), resource node & respawn, loot table, seabed & coral, Needlefin habitat, Diving Mask/Oxygen Bladder, region streaming.

### Phase 13 — World progression & events
- Weather state machine penuh (storm), Beacon & sinyal navigasi, event (bangkai kapal, kawanan ikan), Propeller Engine & Biofuel, The Last Atoll (akhir v1.0).

### Phase 14 — Complete UI, audio & visual polish
- Semua layar final, audio mix & ambience, VFX, art pass per ART_DIRECTION, credits in-game, aksesibilitas.

### Phase 15 — Performance, QA & balancing
- Benchmark seluruh PERFORMANCE_BUDGET, minimum spec nyata, load test, balancing data (vital, drop rate, biaya), bug bash, sesi co-op 2 jam tanpa blocker.

### Phase 16 — Deployment & multiplayer hosting
- Build produksi, hosting client statis + server Node, WSS/TLS, CORS, secret management, backup terjadwal, monitoring/log, runbook operasional.

## Aturan pengelolaan roadmap
- Satu phase aktif dalam satu waktu; phase berikutnya dimulai hanya setelah completion report disetujui owner.
- Fitur yang ditunda dicatat di report sebagai **Deferred** dengan phase tujuan.
- Perubahan urutan phase → update dokumen ini + catatan alasan.

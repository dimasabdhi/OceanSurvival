# Multiplayer Design — OceanSurvival

Status: **Draft v1 (Phase 0)** · ADR: [0004](adr/0004-colyseus-018-authoritative-server.md), [0005](adr/0005-server-authoritative-movement.md), [0006](adr/0006-tick-and-replication-rates.md)

> API Colyseus yang disebut di sini berdasarkan dokumentasi 0.18 (`docs.colyseus.io`, dibaca 2026-11-21). **Sebelum implementasi, verifikasi signature persis** dari halaman `.md` resmi untuk versi terpasang.

> **Update Phase 1 (2026-11-21):**
> - Colyseus 0.18 menyediakan netcode bawaan (`defineInput`, `setFixedTimestep`, `room.input()`, `room.clock`, `Predict`/`predict.sim`, `allowRewindState`). Mekanisme §5–§6 (queue input, ack, replay, time sync) akan **memakai primitive ini** alih-alih ditulis sendiri — lihat [ADR-0013](adr/0013-colyseus-builtin-netcode.md) (Proposed, divalidasi Phase 2). Pesan `input.cmds` dan `time.sync` di §9 digantikan oleh `room.input()` dan `room.clock`.
> - Dokumentasi `StateView` memperingatkan bahwa fitur ini belum dioptimalkan untuk dataset besar. AOI debris/creature (§8.2) harus di-benchmark di Phase 4; alternatif resmi: *Streaming Collections* (`t.stream()`).
> - Simulasi latensi untuk test: `server.simulateLatency(ms)` / env `COLYSEUS_LATENCY` (bawaan Colyseus) menggantikan rencana `tools/netsim`.

> **Implementasi Phase 2 (2026-11-21)** — detail yang berlaku sekarang (menggantikan rencana di bawah bila berbeda):
> | Topik | Implementasi |
> |---|---|
> | Movement | `stepCharacter` di `packages/shared/src/movement/characterMovement.ts`: Rapier `KinematicCharacterController` sebagai query murni terhadap geometri **statis**; antar-pemain tidak bertabrakan (interaction groups). Hasil di-`Math.fround` agar state float32 server = client bit-per-bit. |
> | Prediction | Client `predict.reconciler(self, { input, fields: CHARACTER_STATE_FIELDS, step: stepCharacter, smoothMs: 65, snap: 3 })`; remote `attachAll("players")` lerp 100 ms (+ yaw/pitch `angle: true`). Hasil uji RTT 150 ms: **0 cm koreksi** (lihat PHASE_02_REPORT). |
> | Konsumsi input server | Kredit per pemain: +1 per tick, maks 4; tiap input memakai 1 → laju berkelanjutan = 60 input/s (anti speed-hack), burst kecil untuk jitter. |
> | Client macet | Tanpa input > 15 tick (250 ms: tab di background, baru join) → server menjalankan langkah idle (gravitasi/renang tetap jalan) **tanpa** memajukan ack, sehingga jitter normal tidak memengaruhi determinisme. |
> | Satu room per world | Registry proses: `onCreate` menolak world yang sudah punya room (`WORLD_FULL`) — mencegah Colyseus membuat room kedua saat world penuh (bug ditemukan di E2E). Multi-proses: lock DB di Phase 8. |
> | Identitas | `playerId` (16 char) + token 32 byte di localStorage; server simpan SHA-256 (trust-on-first-use). Tiap **tab** browser yang terbuka bersamaan memegang Web Lock profil berbeda (profil 1, 2, …) sehingga tab kedua = pemain kedua, bukan menendang tab pertama. |
> | Sesi ganda | Pemain yang sama join lagi (perangkat lain) → sesi lama ditutup `4100`. |
> | Rate limit | `chat.send`: burst 3, 1/s; 50 pelanggaran → tutup `4101`. Payload salah → `4002` (bawaan `validate`). |
> | Reconnect | Grace `RECONNECT_GRACE_SECONDS` (30 s). Catatan SDK: auto-reconnect tidak dicoba bila koneksi < 5 s (`minUptime`). |
> | World time | `state.timeOrigin + room.clock.serverNow()/1000` di client; disimpan saat save. |
> | Pesan aktif Phase 2 | input (`room.input()`), `chat.send`; server → `chat`, `server.notice`. |

## 1. Prinsip
1. **Server authoritative** untuk semua state bersama dan posisi pemain.
2. Client mengirim **input & intent**, bukan hasil.
3. Client tetap terasa responsif lewat **prediction** (pemain lokal) dan **interpolation** (entity lain).
4. Replikasi **delta** + **interest management**; tidak pernah full state per frame.
5. Setiap pesan divalidasi (zod) dan dibatasi lajunya.

## 2. Topologi & rooms
```
Browser ──WS──► Colyseus server (Node 24)
                 ├─ LobbyRoom  ("lobby")   : daftar world milik/diikuti pemain, create world
                 └─ WorldRoom  ("world")   : 1 instance per world aktif, maxClients = MAX_PLAYERS_PER_WORLD (4)
```
- WorldRoom dibuat saat pemain pertama join world tertentu (`filterBy(["worldId"])`), dispose setelah semua keluar + save (autoDispose dengan delay 30 s untuk reconnect).
- Satu proses server cukup untuk tahap LAN; skala horizontal (Redis presence/driver) dievaluasi di Phase 16.

## 3. Player lifecycle
| Tahap | Server | Client |
|---|---|---|
| Identitas | — | `playerId` + `playerToken` (32 byte random) dibuat sekali, disimpan di localStorage |
| Join | `onAuth(client, options)`: validasi zod options, cek token (hash cocok atau registrasi guest pertama), cek password world (bila ada), cek ban/kapasitas | `client.joinOrCreate("world", { worldId, playerId, playerToken, password? })` |
| Join sukses | `onJoin`: load/attach `PlayerRecord` dari repository, spawn entity pemain, tambahkan ke `StateView` | Tunggu state awal → Loading → InGame |
| Drop | `onDrop(client, code)`: tandai `connected=false`, karakter diam (input kosong), `allowReconnection(client, 30)` | SDK auto-reconnect (`room.reconnection`, default maxRetries 15); UI "Reconnecting…" |
| Reconnect | `onReconnect(client)`: pulihkan view, kirim `resync` (seq terakhir yang di-ack) | Re-attach callbacks, reset predictor ke state server |
| Leave | `onLeave(client, code)`: simpan `PlayerRecord`, hapus entity pemain dari state | Kembali ke menu |
| Room kosong | autosave → dispose | — |
| Shutdown | `onBeforeShutdown`: broadcast `server.notice`, save | Tampilkan pesan, kembali ke menu |

Duplikasi sesi: bila `playerId` yang sama join saat sesi lama masih tersambung → sesi lama di-kick (`CloseCode` custom 4100 "duplicate session").

## 4. Tick strategy
| Loop | Rate | Catatan |
|---|---|---|
| Simulation (server) | **60 Hz fixed** (`setFixedTimestep`) | Movement, hook, physics |
| State patch | **20 Hz** (`patchRate` 50 ms, default Colyseus) | Delta schema |
| Creature AI | 10 Hz | Movement creature tetap diintegrasi 60 Hz |
| Survival vitals | 2 Hz | |
| World/weather | 1 Hz | |
| Client input send | 30 Hz (2 command/pesan) | Command = 1 step 1/60 s |
| Client render | rAF (≥ 60 FPS target) | Tidak terikat tick |

Jika server tertinggal (step > 16.6 ms berturut-turut), scheduler menjalankan maks 4 step catch-up per frame lalu membuang sisa akumulasi dan mencatat warning (`tick_overrun`). Angka ini dikunci setelah benchmark Phase 2–3.

## 5. Movement: prediction & reconciliation (ADR-0005)
```
Client (step k):  cmd_k = sample input → predictedState = stepMovement(predictedState, cmd_k) → simpan history[k]
                  kirim [cmd_{k-1}, cmd_k] setiap 2 step
Server:           queue per pemain → setiap tick konsumsi 1 command (maks 3 bila backlog) → stepMovement(serverState, cmd)
                  replikasi { x,y,z (frame), frameId, vel, mode, lastProcessedSeq }
Client (patch):   ambil serverState @ lastProcessedSeq → bandingkan history[seq]
                  error > 0.01 m → set state = server, re-simulasikan cmd seq+1..k (replay)
                  error kecil → koreksi visual di-smooth 100 ms (tidak mengubah state prediksi)
```
- **Shared code**: `stepMovement()` di `packages/shared/movement` + adapter Rapier character controller yang sama di kedua sisi. Rapier versi exact sama.
- **Raft-local frame**: posisi pemain yang berdiri di rakit = koordinat lokal rakit (`frameId = raftId`). Gerak rakit (kinematic, deterministik dari `RaftMotion` + world time) diterapkan terpisah, sehingga reconciliation tidak "melawan" gerak rakit. Transisi frame (melompat ke air / naik ke rakit) dilakukan di dalam `stepMovement` dan ikut di-replay.
- **Input starvation**: bila queue kosong saat tick, server mengulang command terakhir maks 3 tick lalu memakai input kosong.
- **Anti-speedhack**: server hanya memproses ≤ 1 command per tick (rata-rata), maks backlog 10 command; kelebihan dibuang + counter pelanggaran.
- **Look**: yaw/pitch ikut command (bukan intent terpisah) agar hit-scan/hook memakai arah yang tepat waktu.

## 6. Time sync & interpolation
- `ServerClock`: client melakukan ping `time.sync` (request/response) setiap 2 s, estimasi offset dengan median 5 sampel terakhir dan RTT/2.
- Remote entity: buffer snapshot (dari patch 20 Hz) dengan timestamp server; render pada `serverTime − 100 ms`; interpolasi linear posisi + slerp rotasi; ekstrapolasi maks 200 ms bila paket telat, lalu freeze.
- Rakit & debris yang mengikuti fungsi deterministik (wave + RaftMotion) dievaluasi client langsung dari world time → mulus tanpa bergantung pada patch rate.

## 7. Latency handling target
| Kondisi | Target perilaku |
|---|---|
| RTT ≤ 50 ms (LAN) | Tidak ada koreksi yang terlihat |
| RTT 100–150 ms | Movement lokal tetap instan; koreksi < 5 cm rata-rata; aksi intent (craft, build) terkonfirmasi ≤ 1 RTT dengan feedback "pending" |
| RTT 300 ms / jitter 50 ms | Dapat dimainkan; interpolasi delay adaptif sampai 200 ms |
| Paket hilang / stall 2 s | Freeze entity remote, indikator koneksi kuning |
| Putus > 2 s | UI "Reconnecting…", auto-reconnect |

Simulasi latensi untuk test: proxy WS sederhana di `tools/netsim` (delay/jitter/drop) — Phase 2.

## 8. State replication
### 8.1 Schema (builder `schema({...})`, ≤ 63 field per schema)
```
WorldState
 ├─ time: number (world seconds), weather: WeatherState, wind: Vec2
 ├─ players: MapSchema<PlayerPublic>   (id, name, frameId, x,y,z, yaw, pitch, mode, anim, equipped, healthBucket, connected, lastProcessedSeq*)
 ├─ rafts: MapSchema<RaftState>        (id, x,z, heading, speed, angVel, anchor, sail, pieces: MapSchema<Piece>)
 ├─ debris: MapSchema<Debris>          (id, type, x,z, spawnTime)            ← StateView AOI
 ├─ hooks: MapSchema<HookState>        (id, ownerId, x,y,z, phase, attached[])
 ├─ creatures: MapSchema<Creature>     (id, species, x,y,z, yaw, anim, hp)   ← StateView AOI
 ├─ stations: MapSchema<StationState>  (id, type, slots, progress)           ← detail via StateView saat dibuka
 └─ progress: WorldProgress            (insight, unlocked, beaconsLit)
PlayerPrivate (StateView, hanya pemilik): inventory, hotbar, equipment, vitals detail, craftQueue
```
`*lastProcessedSeq` terlihat semua tetapi hanya dipakai pemilik (dapat dipindah ke private view bila perlu).

### 8.2 Interest management (`StateView`)
| Entity | Radius visibilitas |
|---|---|
| Debris | 120 m dari pemain |
| Creature | 150 m |
| Dropped item | 60 m |
| Pemain, rakit, progress | selalu |
| Isi container/stasiun | hanya saat dibuka (dan pemiliknya) |
Pembaruan view setiap 4 tick (15 Hz), dengan hysteresis +10 m untuk mencegah flicker.

### 8.3 Quantization & bandwidth
- Posisi dikirim `float32` di schema (sederhana) pada v1; bila bandwidth > budget, beralih ke int16 relatif region (cm) — diukur dulu.
- Budget: rata-rata **≤ 64 kbps downstream per client**, ≤ 16 kbps upstream (lihat [PERFORMANCE_BUDGET](PERFORMANCE_BUDGET.md)).

## 9. Protocol — messages client → server
Semua zod schema di `packages/shared/protocol/messages.ts`; server mendeklarasikan `messages = { "<name>": validate(schema, handler) }`. Payload invalid → disconnect code 4002 (perilaku bawaan Colyseus 0.18).

| Message | Payload | Rate limit | Phase |
|---|---|---|---|
| `input.cmds` | `{ cmds: InputCommand[1..4] }` | 40/s | 2 |
| `time.sync` (request) | `{ clientTime }` → `{ serverTime }` | 2/s | 2 |
| `interact.use` | `{ targetId }` | 10/s | 3 |
| `hook.throw` | `{ power: 0..1 }` | 2/s | 5 |
| `hook.reel` | `{ active: bool }` | 10/s | 5 |
| `hook.cancel` | `{}` | 5/s | 5 |
| `hotbar.select` | `{ index: 0..7 }` | 20/s | 6 |
| `inventory.move` | `{ txId, from: SlotRef, to: SlotRef, qty? }` | 20/s | 6 |
| `inventory.drop` | `{ txId, from: SlotRef, qty }` | 10/s | 6 |
| `craft.request` (request) | `{ recipeId, qty: 1..10 }` → `{ ok, reason? }` | 5/s | 6 |
| `item.use` | `{ slot }` | 5/s | 9 |
| `build.place` (request) | `{ raftId, pieceId, gx, gy, gz, rot }` | 10/s | 7 |
| `build.demolish` / `build.repair` | `{ pieceKey }` | 5/s | 7 |
| `station.open` / `station.close` | `{ stationId }` | 5/s | 9 |
| `research.study` / `research.unlock` | `{ slot }` / `{ blueprintId }` | 5/s | 9 |
| `combat.attack` | `{ seq, yaw, pitch }` | 4/s | 10 |
| `nav.sail` / `nav.anchor` / `nav.steer` / `nav.paddle` | lihat GAMEPLAY_SYSTEMS §J | 10/s | 11 |
| `revive.start` / `revive.cancel` | `{ targetPlayerId }` | 2/s | 9 |
| `chat.send` | `{ text: 1..200 char, sanitized }` | 1/s | 14 |

Server → client (broadcast/targeted): `event.fx` (sound/VFX trigger), `event.damage`, `server.notice`, `inventory.reject {txId, reason}`, `save.status`.

## 10. Entity ownership
| Entity | Owner | Mutasi oleh |
|---|---|---|
| Player body | Server (input dari pemilik) | Movement system |
| Hook | Server (atas nama pemilik) | Hook system |
| Raft & pieces | World | Building/Navigation/Damage system |
| Debris, dropped items | World | Debris/Inventory system; lock saat di-hook |
| Container/stasiun | World | Inventory/Crafting; akses semua anggota world |
| Creature | World | AI system |

## 11. Reconnection & resync
- Grace 30 s (`allowReconnection`). Selama grace, karakter tetap di dunia (diam) dan bisa diserang — sengaja, agar tidak dieksploit sebagai "kebal".
- Setelah reconnect, client membuang prediction history, mengambil state penuh dari schema (otomatis oleh Colyseus), lalu melanjutkan seq baru (`seq` direset via pesan `resync { seqBase }`).

## 12. Security & validation
Lihat [SECURITY_DESIGN](SECURITY_DESIGN.md). Ringkas: zod untuk semua payload, rate limit token-bucket per message per client, `maxPayload` WebSocket 16 KB, validasi jarak/LOS dengan posisi server, transaksi inventory atomik ber-`txId`, room join butuh token + password world opsional.

## 13. Testing multiplayer
- Integration test room dengan `@colyseus/testing` (verifikasi ketersediaan & API 0.18 di Phase 1).
- Bot client headless (Node, `@colyseus/sdk`) mengirim input acak untuk load test 4–16 pemain.
- Playwright: 2–4 browser context di satu test (join, gerak, lihat satu sama lain, disconnect/reconnect).
- Determinism test: `stepMovement` client vs server menghasilkan state identik untuk 10.000 command acak.

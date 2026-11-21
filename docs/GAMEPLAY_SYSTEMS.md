# Gameplay Systems Specification — OceanSurvival

Status: **Draft v1 (Phase 0)**. Dokumen ini adalah spesifikasi implementasi per sistem. Nilai desain berasal dari [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md); arsitektur di [TECHNICAL_ARCHITECTURE](TECHNICAL_ARCHITECTURE.md); protokol di [MULTIPLAYER_DESIGN](MULTIPLAYER_DESIGN.md).

## Konvensi
- **Authority**: `S` = server authoritative, `C` = client-only (visual/presentasi), `S+P` = server authoritative dengan client prediction.
- **Data** = definisi statis di `packages/shared/data/*.ts` (divalidasi zod saat startup).
- **State** = state runtime server (Colyseus Schema bila direplikasi; plain object bila server-only).
- **Msg** = message client→server (nama `domain.action`), semuanya divalidasi zod.
- Unit: meter, detik, derajat untuk data desain; radian di runtime. Koordinat **Y-up**, kanan-tangan (konvensi Three.js & Rapier).
- Semua ID entity = string pendek unik per world (`nanoid` 10 karakter) dibuat server.

---

## A. Player System
| Aspek | Spesifikasi |
|---|---|
| Authority | Posisi/rotasi/velocity: `S+P`. Look (yaw/pitch): client mengirim, server menerima dengan clamp pitch ±89°. Vitals, inventory, death: `S`. Animasi & viewmodel: `C` |
| Controller | Rapier `KinematicCharacterController` (offset 0.02 m, autostep 0.3 m, max slope 45°, snap-to-ground 0.3 m). Langkah movement = fungsi murni `stepMovement(state, input, env, dt)` di `packages/shared/movement` dengan adapter collision Rapier |
| Mode gerak | `walk`, `sprint`, `crouch` (v2), `swim_surface`, `swim_under`, `downed`, `dead`. Transisi ditentukan dari water height sample (fungsi gelombang shared) vs eye height |
| Platform | Saat grounded di collider milik rakit → `frame = raftId`, posisi disimpan lokal terhadap rakit. Saat lepas (lompat ke air) → konversi ke world frame |
| Input | `InputCommand { seq, buttons(bitmask), moveX, moveZ (-1..1, quantized int8), yaw, pitch (uint16 quantized) }` per fixed step 1/60 s |
| Interaction | Client raycast dari kamera untuk **prompt** (visual). Aksi dikirim sebagai intent `interact.use { targetId }`; server memvalidasi jarak ≤ 3.0 m dari posisi server + line-of-sight ray Rapier |
| Death/respawn | `health ≤ 0` → `downed` 30 s → `dead` → respawn di spawn point (Bed atau foundation pertama yang masih ada). Wreck Bag dibuat sesuai mode world |
| Representasi remote | Model karakter low-poly + nama; posisi diinterpolasi 100 ms; animasi dari state (speed, mode, equipped tool) |
| Phase | 2 (kapsul), 3 (lengkap), 9 (vitals/death) |

## B. Ocean System
| Aspek | Spesifikasi |
|---|---|
| Wave model | Jumlah **4 Gerstner wave** (amplitudo total ≤ 0.6 m pada cuaca tenang, ≤ 1.6 m saat badai). Fungsi `sampleWaveHeight(x, z, t, weatherParams)` di `packages/shared/ocean` — **sama persis** dipakai shader (port GLSL) & gameplay (buoyancy, swim detection) |
| Waktu | `t` = server world time (detik, float64), disinkronkan via state; client memakai estimasi waktu server (lihat MULTIPLAYER_DESIGN §6) |
| Rendering (`C`) | Mesh grid kamera-relatif (clipmap 3 ring LOD), `ShaderMaterial` GLSL: Gerstner displacement, depth color, foam crest, fresnel, specular matahari, fog. Tanpa planar reflection di v1 (mahal); reflection dari sky env map |
| Floating objects | Debris/rakit: buoyancy disederhanakan — tinggi = sample wave + offset; pitch/roll dari normal wave rata-rata 4 titik. Dihitung server untuk gameplay; client menghitung ulang untuk visual (deterministik karena fungsi & waktu sama) |
| Day/night | Siklus 24 menit real-time (default; 16 menit siang, 8 malam). `worldTime` di state. Sky: `Sky` addon Three.js atau shader custom stylized (diputuskan di spike Phase 1) |
| Weather | State machine `calm → breezy → rain → storm` dengan durasi acak berbobot (server). Memengaruhi wave params, angin, hujan (Drip Catcher), visibilitas fog |
| Ambience | Audio loop ombak (intensitas dari weather), angin, hujan (`C`) |
| Boundary | Dunia efektif tak terbatas di X/Z; koordinat besar ditangani dengan **floating origin** di client (rebase ketika kamera > 2 km dari origin) dan region-based world di server (chunk 256 m) |
| Phase | 1 (shader prototype), 4 (gameplay), 13 (weather penuh) |

## C. Hook & Resource Collection
| Aspek | Spesifikasi |
|---|---|
| Authority | `S`. Client hanya memainkan animasi lempar & rope visual berdasar state hook yang direplikasi |
| Alur | `hook.charge` (client lokal, 0–1.2 s) → `hook.throw { power(0..1) }` → server membuat entity `Hook` dengan posisi awal = tangan pemain (posisi server), velocity = arah look × (8 + 14·power) m/s, gravitasi 9.81 |
| Flight | Server simulasi balistik per tick; saat menyentuh permukaan air → state `floating`; jarak maks 25 m |
| Reel | `hook.reel { active }` saat ditahan: hook bergerak ke pemain 3.5 m/s di permukaan air. Debris dalam radius **0.8 m** dari hook tertangkap (maks 3 item per hook); diangkut bersama |
| Retrieve | Saat hook ≤ 1.5 m dari pemain → item masuk inventory (transaksi inventory server); jika penuh, item dijatuhkan sebagai `DroppedItem` di rakit |
| Cancel | `hook.cancel` atau pemain mati/terlalu jauh (> 30 m) → hook hilang, item lepas & kembali hanyut |
| Rope (`C`) | Kurva Bezier/catenary sederhana dari tangan ke hook, segment 16; bukan physics rope |
| Debris spawn | Server, per rakit: spawn zone 40–90 m di arah hulu arus, laju dasar 1 debris / 2.2 s (skala dengan jumlah pemain: ×(1 + 0.25·(n−1))), maks 60 debris aktif per rakit. Despawn: > 120 m di hilir atau umur > 180 s |
| Multiplayer | Satu debris hanya bisa dipegang satu hook (lock oleh server); hook pemain lain melewati |
| Validasi | throw rate ≤ 1 per 0.5 s; hanya bila item aktif = Grapple Line; pemain tidak `downed`/`swim_under` |
| Phase | 4 (debris), 5 (hook) |

## D. Raft Building System
| Aspek | Spesifikasi |
|---|---|
| Data | `BuildingPieceDef { id, category, tier, size (cells), sockets[], maxHp, cost[], supports: rule }` |
| Grid | Koordinat **raft-local** integer `(gx, gy(level), gz)`; cell 1.5 m; level tinggi 2.4 m. Piece memiliki rotasi 0/90/180/270 |
| Socket | Edge socket (wall, fence, half wall, window, door frame), cell socket (foundation, floor, stasiun, storage), vertex socket (pillar), level socket (stair, roof) |
| Preview (`C`) | Ghost mesh mengikuti raycast; warna hijau/merah dari validasi **lokal** memakai fungsi shared `validatePlacement(raftGrid, piece, pose)`; server memakai fungsi yang sama → hasil konsisten |
| Placement | `build.place { pieceId, gx, gy, gz, rot, raftId }` → server: cek blueprint unlocked, material di inventory, validasi grid/support/overlap pemain (tidak menaruh piece di dalam kapsul pemain), jarak ≤ 6 m → transaksi atomic (kurangi material + tambah piece) |
| Structural | Graph support: foundation = root. Piece valid bila punya jalur dukung ke foundation; maks level 3. Saat piece hancur/didemolish: BFS dari foundation, piece yang tidak terjangkau → collapse (drop 50% material) |
| Demolish/Repair | Tool: *Builder's Mallet*. `build.demolish { pieceId }`, `build.repair { pieceId }` (biaya 25% material per 50% HP) |
| Physics | Tiap piece menambah collider ke rigid body kinematic rakit (compound). Rebuild collider incremental, bukan seluruh rakit |
| Replikasi | `RaftState.pieces: MapSchema<Piece>` keyed `"gx:gy:gz:slot"`; client membangun mesh dengan **InstancedMesh per (pieceType, tier)** |
| Phase | 3 (rakit awal statis 2×2), 7 (system penuh), 10 (damage dari Reefjaw) |

## E. Inventory & Item System
| Aspek | Spesifikasi |
|---|---|
| Model | **Slot-based** (tanpa berat): 20 slot backpack + 8 slot hotbar + 3 equipment (head, body, feet). Storage Crate 24 slot, Large Crate 40 slot |
| Data | `ItemDef { id, name, category, rarity (common/uncommon/rare/epic), maxStack, durability?, tool?, food?, equipSlot?, icon, model }`. Stack tipikal: material 20, makanan 10, tool 1 |
| Instance | `ItemStack { itemId, qty, durability?, meta? }` — tool punya durability (mis. Grapple Line 120 lemparan) |
| Authority | `S`. Semua mutasi lewat `InventoryService` dengan operasi atomik: `move`, `split`, `merge`, `swap`, `transfer(containerA→B)`, `consume`, `give`, `drop` |
| Invariant | Total kuantitas item sebelum = sesudah untuk `move/split/merge/swap/transfer`; `give` hanya dari sumber terdaftar (hook, loot, craft output); setiap transaksi punya `txId` untuk dedup bila client mengirim ulang |
| Replikasi | Inventory pemain hanya terlihat pemiliknya (`StateView`). Container terlihat oleh pemain yang membukanya (lock: maks 2 viewer bersamaan, mutasi tetap serial di server) |
| Pickup/drop | `DroppedItem` entity (di rakit/air); pickup via `interact.use`; despawn 10 menit di air, 30 menit di rakit |
| Client UX | Drag & drop optimistik **hanya visual** (ghost); slot dikunci sampai ack server (< 1 RTT); bila ditolak → kembali ke posisi semula + pesan |
| Phase | 6 |

## F. Crafting & Technology
| Aspek | Spesifikasi |
|---|---|
| Data | `RecipeDef { id, station?: StationId, inputs[{itemId, qty}], outputs[], craftTimeSec, unlockedBy: BlueprintId? }` |
| Alur | `craft.request { recipeId, qty }` via Colyseus `room.request` → server cek unlock, stasiun dalam jarak 3 m (bila perlu), bahan → consume + antrean craft (per pemain, maks 5) → output ke inventory saat selesai |
| Stasiun pemrosesan | Brazier, Solar Still, Smelter, Planter: entity dengan **slot input/fuel/output** & timer server; dapat diakses semua anggota world |
| Insight | `ResearchState { insight: Record<Category, number>, unlockedBlueprints: Set<BlueprintId> }` per world. `research.study { slot }` mengonsumsi item → menambah insight (nilai dari ItemDef). `research.unlock { blueprintId }` |
| Farming | Planter: tahap tumbuh (seed → sprout → mature) dengan durasi data; butuh air (manual atau Drip Catcher terhubung); panen menghasilkan item + peluang seed |
| Phase | 6 (craft dasar), 9 (stasiun, riset, farming) |

## G. Survival System
| Aspek | Spesifikasi |
|---|---|
| Authority | `S`, tick vital 2 Hz (cukup; tidak perlu 60 Hz) |
| State | `PlayerVitals { health, hunger, thirst, oxygen, effects[] }` — direplikasi hanya ke pemilik (detail) + `health` bulat untuk pemain lain (nameplate) |
| Rumus | Laju turun = base × mode multiplier × activity (sprint 1.3×, swim 1.2×). Nilai di [GDD §5](GAME_DESIGN_DOCUMENT.md#5-survival) |
| Damage | `DamageEvent { targetId, amount, type (bite, starvation, dehydration, drowning, fall), sourceId? }` diproses di satu `DamageSystem` server; emit event ke client untuk VFX/audio |
| Makanan | `item.use { slot }` → efek dari `ItemDef.food { hunger, thirst, health, effects }`; cooldown 1 s |
| Phase | 9 |

## H. Animal & Combat System
| Aspek | Spesifikasi |
|---|---|
| Authority | `S`. AI tick 10 Hz; movement creature diintegrasikan setiap tick simulasi (60 Hz) dari target velocity AI |
| AI | State machine per spesies (Reefjaw: `patrol → stalk → attackRaft/attackSwimmer → retreat`). Steering behaviors (seek, arrive, circle, avoid) tanpa navmesh di laut terbuka; navmesh sederhana/raycast untuk Shellback di pulau |
| Perception | Jarak + kedalaman (Reefjaw mendeteksi pemain di air ≤ 35 m; di rakit tidak); Needlefin ≤ 8 m |
| Attack raft | Target foundation tepi acak (tidak memilih piece di dalam). Animasi gigit 3 kali × 10 dmg; piece HP 0 → hancur + collapse check |
| Combat pemain | Melee: client mengirim `combat.attack { aimYaw, aimPitch, seq }`; server melakukan **sweep test** pada posisi server dengan **lag compensation** sederhana (rewind posisi creature ≤ 150 ms dari history buffer) |
| Spawn/despawn | Reefjaw: 1 per rakit (aktif setelah 3 menit pertama). Fish: pool per region, maks 40 per region aktif. Despawn bila > 150 m dari semua pemain |
| Replikasi | `CreatureState { id, species, x, y, z, yaw, anim, hp }` di-quantize; hanya dalam AOI 150 m |
| Phase | 10 |

## I. Island & Exploration
| Aspek | Spesifikasi |
|---|---|
| Generasi | Seed-based: `worldSeed` + `regionCoord` → PRNG (mulberry32/xoshiro di shared) → tipe pulau, posisi, radius. Terrain = heightfield dari noise (simplex) dengan mask radial; dihasilkan **identik** di client (render) & server (collider) — tidak dikirim lewat jaringan |
| Konten | Prop (pohon, batu, semak) via InstancedMesh; resource node (pohon kelapa, batu, deposit tanah liat) punya ID deterministik `islandId:nodeIndex`; status (sudah dipanen, respawn timer) disimpan server sebagai **delta** |
| Bawah laut | Seabed heightfield dangkal di sekitar pulau (0–25 m); coral & deposit sebagai node. Visual underwater: fog biru, caustics sederhana, gerak lambat |
| Oxygen | Lihat G; upgrade dari Diving Mask & Oxygen Bladder |
| Loot | Loot crate dengan loot table (data) dan seed → isi deterministik, status dibuka di server |
| Streaming | Region 256 m dimuat/dibongkar berdasarkan jarak rakit/pemain (load ≤ 600 m, unload > 900 m) |
| Phase | 12 |

## J. Navigation & World Progression
| Aspek | Spesifikasi |
|---|---|
| Raft motion | Rakit = rigid body **kinematic** dengan `RaftMotion { heading, speed, angularVel }` dihitung server dari drift + sail + paddle + engine + anchor; bukan simulasi fluida |
| Kontrol | `nav.sail { open, angle }`, `nav.anchor { down }`, `nav.steer { input }`, `nav.paddle { active }` — validasi jarak ke piece terkait |
| Wind | Vektor angin global dari weather state, berubah perlahan (±20° per 10 menit) |
| Beacon | Entity di Beacon Island; `beacon.activate` setelah syarat (item + puzzle sederhana) → `worldProgress.beaconsLit++`, membuka sinyal navigasi berikutnya |
| Events | Event lingkungan server: badai, kawanan ikan, bangkai kapal hanyut (loot), migrasi Reefjaw. Dijadwalkan dari `EventScheduler` berbasis seed + world time |
| Phase | 11, 13 |

## K. UI/UX
Lihat [UI_UX_SPECIFICATION](UI_UX_SPECIFICATION.md). Prinsip sistem: UI membaca state dari **client store** (signals) yang diisi oleh lapisan net; UI tidak pernah memanggil Colyseus langsung, melainkan `GameActions` (fungsi yang mengirim intent).

---

## Ketergantungan antar sistem
```
Ocean(wave fn) ─► Player movement (swim) ─► Hook ─► Inventory ─► Crafting ─► Building
       │                     │                                      │          │
       └─► Floating objects ─┘                  Survival ◄──────────┘          │
                                     Creatures ─► Damage ─► Building HP ◄──────┘
Islands ─► Resource nodes ─► Inventory          Navigation ─► Raft motion ─► Player platform
```
Urutan implementasi di [ROADMAP](ROADMAP.md) mengikuti graph ini.

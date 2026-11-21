# Game Design Document — OceanSurvival

Status: **Draft v1 (Phase 0)**. Semua angka balancing adalah **nilai awal** untuk di-tune pada Phase 15; disimpan sebagai data di `packages/shared/data/`, bukan hardcode.
Terkait: [PRODUCT_VISION](PRODUCT_VISION.md) · [GAMEPLAY_SYSTEMS](GAMEPLAY_SYSTEMS.md) (spesifikasi teknis) · [GLOSSARY](GLOSSARY.md)

---

## 1. Ringkasan
| Item | Nilai |
|---|---|
| Genre | Survival · crafting · building · exploration, co-op |
| Perspektif | First-person |
| Pemain | 1–4 per world (solo = room 1 pemain di server lokal) |
| Sesi tipikal | 30–120 menit, world persisten |
| Platform | Browser desktop (Chrome/Edge), keyboard + mouse |
| Gaya visual | Stylized low-poly ([ART_DIRECTION](ART_DIRECTION.md)) |

## 2. Core loop
```
          ┌────────────── Kumpulkan ──────────────┐
          │  Hook debris · pancing · selam ·       │
          │  jarah pulau                           │
          ▼                                        │
   Olah & Crafting ──► Bangun/perluas rakit ──► Bertahan (makan, minum, lindungi)
          │                                        │
          └──► Riset (Insight) ──► Teknologi baru ──► Jelajah lebih jauh ─┘
```
- **Loop menit-ke-menit**: mengait debris yang hanyut melewati rakit, memilah, menjaga vital.
- **Loop jam-ke-jam**: membuka blueprint, membangun stasiun (air, masak, kebun), mempertahankan rakit dari Reefjaw, memperbesar rakit.
- **Loop sesi**: berlayar ke pulau/mercusuar berikutnya, menjarah, kembali dengan material tier lebih tinggi.

## 3. Setting & narasi (ringkas)
*The Hushed Sea*: kepulauan tropis fiktif yang tenggelam oleh "Long Tide". Pemain terbangun di atas 2×2 foundation rakit dengan sebuah **Grapple Line** (alat kait). Cerita disampaikan lewat **environmental storytelling**: catatan di botol, mural di mercusuar, sisa kampung panggung. Setiap **Beacon** (mercusuar) yang dinyalakan membuka fragmen peta dan cerita menuju **The Last Atoll** (tujuan akhir v1.0). Tidak ada cutscene wajib.

## 4. Pemain
| Atribut | Nilai awal |
|---|---|
| Tinggi kapsul / radius | 1.8 m / 0.35 m; eye height 1.62 m |
| Jalan / sprint / jongkok | 3.6 m/s / 5.6 m/s / 1.8 m/s |
| Renang permukaan / selam | 2.4 m/s / 2.0 m/s (sprint renang 3.2 m/s, menguras stamina tidak ada; menguras oksigen 1.5×) |
| Lompat | tinggi ±1.1 m |
| Jangkauan interaksi | 2.5 m (server-validated, +0.5 m toleransi) |
| Health / Hunger / Thirst / Oxygen | 100 / 100 / 100 / 30 detik napas dasar |

**Kematian**: pemain jatuh pingsan (*downed*) 30 detik; teman bisa menolong (tahan E 3 detik) → bangun dengan 25 HP. Jika tidak ditolong → respawn di rakit (Bed bila ada, jika tidak di foundation awal). Item hotbar tetap; item inventory utama dijatuhkan dalam **Wreck Bag** yang mengapung 10 menit (mode Normal). Mode lain di §12.

## 5. Survival
| Vital | Laju turun dasar | Saat 0 | Pemulihan |
|---|---|---|---|
| Hunger | 100 → 0 dalam ±40 menit real-time | −1 HP / 4 s | Makanan (lihat tabel) |
| Thirst | 100 → 0 dalam ±25 menit | −1 HP / 3 s | Air bersih; air laut **menambah** −10 thirst |
| Oxygen | 30 s di bawah air (upgrade s/d 90 s) | −5 HP / s | Naik ke permukaan: penuh dalam 3 s |
| Health | — | Downed | Regen pasif +1 HP / 10 s bila Hunger & Thirst > 60; perban/makanan tertentu |

Status effect awal: *Well Fed* (regen 2×, Hunger ≥ 90 & Thirst ≥ 90), *Soaked* (di bawah hujan/renang: suhu tidak dimodelkan v1, efek kosmetik saja), *Bleeding* (dari Reefjaw, −1 HP/2 s selama 10 s, dihentikan perban), *Food Poisoning* (makan mentah: −10 Hunger lagi setelah 20 s, peluang 50%).

## 6. Resource & material
| Tier | Material | Sumber utama |
|---|---|---|
| T0 | Driftwood, Flotsam Plastic, Seagrass, Coconut | Debris hanyut (hook) |
| T0 | Barrel (berisi campuran acak) | Debris hanyut (jarang) |
| T1 | Rope (crafted), Plank (crafted), Shell, Sand, Clay, Stone | Craft, dasar laut dangkal, pulau |
| T2 | Scrap Metal, Copper Ore, Tin Ore → Ingot (Smelter) | Dasar laut, bangkai kapal, pulau |
| T3 | Bioresin, Glass, Circuit Fragment | Pulau besar, bangkai, mercusuar |
| T4 | Engine Parts, Battery Cell | Lokasi akhir (mercusuar & atoll) |

Debris spawn ditentukan server (lihat [GAMEPLAY_SYSTEMS §C](GAMEPLAY_SYSTEMS.md#c-hook--resource-collection)). Distribusi awal debris: Driftwood 40%, Plastic 30%, Seagrass 22%, Barrel 5%, Coconut 3%.

## 7. Crafting & progression
### 7.1 Stasiun
| Stasiun | Fungsi | Unlock |
|---|---|---|
| Hand craft (tanpa stasiun) | Rope, Plank, alat dasar, foundation | Awal |
| Salvage Bench | Item T1–T2, building pieces lanjutan | Insight Wood 1 |
| Survey Table | Membelanjakan Insight untuk blueprint | Awal (dibuat dari 6 Plank + 4 Rope + 2 Plastic) |
| Brazier | Masak makanan, rebus air (butuh bahan bakar) | Awal |
| Solar Still | Menyuling air laut tanpa bahan bakar, hanya siang (2× lebih cepat saat cerah) | Insight Plastic 1 |
| Drip Catcher | Menampung air hujan bersih | Insight Plastic 1 |
| Smelter | Ore → Ingot, Sand → Glass | Insight Metal 1 |
| Planter Box | Tanam (Coconut palm sapling, Kelp, Tuber) | Insight Botany 1 |
| Workshop (tier 3) | Navigasi & alat lanjutan | Insight Metal 3 |

### 7.2 Sistem riset **Insight** (mekanik khas OceanSurvival)
- Setiap kali pemain **mengambil material jenis baru pertama kali** dan setiap kali memasukkan material ke **Survey Table** untuk "dipelajari", pemain (seluruh tim — progress per world) memperoleh **Insight** pada kategori: `wood`, `fiber`, `plastic`, `metal`, `marine`, `botany`, `navigation`.
- Blueprint dibeli dengan Insight di **tech tree** per kategori (tier 1–4). Contoh: *Sail* = navigation 2 + wood 2.
- Tujuan: pemain didorong mengumpulkan **beragam** material, bukan satu item tunggal; berbeda dari sistem riset per-item.
- Progress riset **dibagi untuk seluruh anggota world** (co-op friendly).

### 7.3 Progression milestone (target waktu kumulatif, 2 pemain)
| Milestone | Waktu target |
|---|---|
| Rakit 3×3, air bersih, masak ikan | 0–30 menit |
| Spear, perbaikan rakit, Planter Box | 30–90 menit |
| Sail + Anchor, pulau pertama | 1.5–3 jam |
| Smelter, alat logam, selam 60 s | 3–6 jam |
| Beacon pertama menyala | 5–8 jam |
| Engine (propeller), Beacon ke-3 | 10–15 jam |
| The Last Atoll (akhir v1.0) | 15–25 jam |

## 8. Building
- Grid: **cell 1.5 m × 1.5 m**, tinggi lantai 2.4 m. Rotasi 90°. Snapping ke socket (lihat [GAMEPLAY_SYSTEMS §D](GAMEPLAY_SYSTEMS.md#d-raft-building-system)).
- Piece set v1: Foundation, Floor, Wall, Half Wall, Window Wall, Door Frame + Door, Pillar, Roof (flat & slope), Stair, Fence, Storage Crate, stasiun, Anchor, Sail, Steering Oar.
- Material tier piece: Thatch (awal) → Plank → Reinforced (logam). Piece tier lebih tinggi punya HP lebih besar dan tahan Reefjaw lebih lama.
- **Structural rule** v1: piece harus terhubung ke foundation lewat rantai dukungan; maksimal lantai 3 di atas foundation; foundation hanya bisa ditambahkan bersebelahan dengan foundation yang ada. Demolish piece pendukung memicu kolaps piece yang tidak lagi didukung (material dikembalikan 50%).
- Demolish mengembalikan 100% material bila piece dibangun < 60 detik lalu, selain itu 50%.

## 9. Makhluk & combat
| Makhluk | Perilaku | Ancaman |
|---|---|---|
| **Reefjaw** (predator besar) | Patroli melingkari rakit 20–35 m; tiap 2–4 menit menyerang satu foundation tepi; menyerang pemain yang berenang | Merusak foundation 10 HP/gigitan; 20 dmg ke pemain + Bleeding |
| **Needlefin** | Kawanan kecil di area karang, menyerang penyelam dekat | 5 dmg/serangan |
| Fish (Silverscale, Mudsnapper) | Boids sederhana, kabur dari pemain | Sumber makanan (pancing/spear) |
| **Shellback** (kepiting pulau) | Patroli di pantai, agresif bila didekati < 4 m | 8 dmg |
- Senjata v1: Spear (melee, 12 dmg), Metal Spear (20 dmg), Harpoon Gun (T3, ranged).
- Reefjaw: 200 HP, mundur 60 detik bila terkena 40 dmg dalam satu kali "serangan rakit"; tidak bisa dibunuh permanen di v1 (respawn 5 menit) — mencegah "rakit aman selamanya".

## 10. Eksplorasi
- **Pulau** seed-based (lihat [GAMEPLAY_SYSTEMS §I](GAMEPLAY_SYSTEMS.md#i-island--exploration)): Small Islet (radius 25–40 m), Reef Island (40–70 m, laguna dangkal), Ruin Island (rumah panggung & loot crate), Beacon Island (mercusuar, dungeon ringan).
- **Bawah laut**: kedalaman 0–25 m di sekitar pulau; coral, deposit ore, chest bangkai.
- Pulau muncul di depan arah drift rakit; jarak antar pulau ±600–1200 m.

## 11. Navigasi
| Alat | Efek |
|---|---|
| Drift (default) | Rakit hanyut mengikuti arus 0.6 m/s ke arah arus global |
| Paddle | Pemain mendayung: +0.4 m/s per pemain (maks 2 pemain), arah bebas |
| Sail | +1.6 m/s dipengaruhi angin (efektif bila sudut < 90° dari arah angin); dibuka/ditutup, diputar |
| Anchor | Menghentikan rakit (drop/raise 2 detik) |
| Steering Oar | Mengubah heading rakit ±15°/s |
| Propeller Engine (T4) | +2.5 m/s, butuh Biofuel |
| Navigation Desk (T3) | Menerima sinyal Beacon: menampilkan arah & jarak lokasi |

## 12. Mode & kesulitan
| Mode | Vital | Kematian | Reefjaw |
|---|---|---|---|
| Calm | laju vital 0.5× | tidak kehilangan item | serangan 2× lebih jarang |
| Normal (default) | 1× | Wreck Bag | normal |
| Harsh | 1.5× | item hilang di tempat (bag tenggelam 3 menit) | 1.5× lebih sering |
Mode ditentukan saat create world dan disimpan di `worlds.settings`.

## 13. Co-op design
- Progress riset, blueprint, dan rakit **dimiliki world**, bukan pemain. Inventory & vital per pemain.
- Aksi bersama: menolong pemain downed, mendayung (stack), membawa barang via Storage Crate bersama.
- Tidak ada friendly fire v1.
- Host world = pembuat world (role `owner`): bisa kick, ganti password, mengatur mode sebelum mulai.

## 14. Session flow
Main Menu → (Create World | Join World | Continue) → Lobby (daftar pemain, ready, setting world bila owner) → Load → In-game → Pause/Quit (autosave) → kembali ke Main Menu.

## 15. Konten minimum untuk **Vertical Slice v0.1** (akhir Phase 6)
Rakit 2×2, ocean + day/night, debris (Driftwood/Plastic/Seagrass/Barrel), Grapple Line, inventory + hotbar, hand-craft: Rope, Plank, Foundation (tempat sederhana, belum building system penuh), Spear (crafted, belum combat), 2–4 pemain co-op. Tanpa: survival vitals, makhluk, pulau, save DB.

## 16. Pertanyaan terbuka (diputuskan pada phase terkait)
1. Apakah perlu sistem suhu/cuaca dingin? (default: tidak di v1)
2. Seberapa besar dunia? Infinite procedural vs rute bertahap ke Last Atoll (default: rute bertahap dengan seed).
3. Apakah ada boss per Beacon? (default: tidak, ancaman lingkungan saja)
4. Kebijakan kepemilikan item di Storage bersama (default: semua anggota world bisa akses).

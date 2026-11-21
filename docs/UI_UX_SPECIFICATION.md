# UI/UX Specification — OceanSurvival

Status: **Draft v1 (Phase 0)** · ADR: [0008](adr/0008-preact-signals-ui.md) · Visual: [ART_DIRECTION §9](ART_DIRECTION.md#9-ui-art)

## 1. Prinsip
1. **Dunia dulu** — HUD minimal; informasi muncul saat relevan (vital pudar bila > 70%).
2. **Satu sentuhan ke aksi utama** — hook, makan, bangun bisa dilakukan tanpa membuka menu.
3. **Feedback jaringan jujur** — aksi yang menunggu server terlihat "pending"; penolakan diberi alasan singkat.
4. **Terbaca** — kontras teks ≥ 4.5:1, ukuran teks minimum 14 px pada 1080p, skala UI 80–150%.
5. Bahasa UI: **Bahasa Indonesia saja** (keputusan owner 2026-11-21). Teks UI tetap disimpan lewat key di satu file `locales/id.json` (bukan ditulis langsung di komponen) agar bahasa lain bisa ditambahkan kelak tanpa mengubah kode UI. Nama item/makhluk mengikuti daftar nama di [GLOSSARY](GLOSSARY.md) (nama kerja, dapat dilokalkan saat finalisasi).

## 2. Arsitektur UI
- Preact app di `<div id="ui-root">` di atas `<canvas>`. Store berbasis `@preact/signals` diisi oleh lapisan `net/`.
- UI memanggil `GameActions.*` (mis. `GameActions.moveItem(from, to)`) — tidak pernah Colyseus/Three langsung.
- Saat menu terbuka: pointer lock dilepas, input gameplay di-mask (karakter diam, bukan pause dunia — dunia multiplayer tetap berjalan).

## 3. Peta layar
```
Boot/Loading ─► Main Menu ─┬─► Create World ─► Lobby ─► Loading World ─► In-Game
                           ├─► Join World (kode) ─► Lobby ─┘                │
                           ├─► Continue (daftar world) ─► Lobby ─┘          ├─► Pause Menu ─► Settings / Quit to Menu
                           ├─► Settings                                      ├─► Inventory / Crafting / Research / Build menu / Station UI
                           └─► Credits                                       ├─► Death / Downed screen
                                                                             └─► Connection lost / Reconnecting overlay
```

## 4. Spesifikasi layar
| Layar | Isi | Phase |
|---|---|---|
| Boot | Logo kerja, cek WebGL2 (pesan jelas bila tidak didukung), progress load aset | 1 |
| Main Menu | Continue, Create World, Join World, Settings, Credits, Quit; nama pemain (editable, 2–24 char) | 2 (dasar), 14 (final) |
| Create World | Nama world, mode (Calm/Normal/Harsh), password opsional, seed (opsional, advanced) | 8 |
| Join World | Input kode world (6–8 char) + password bila diminta; daftar world LAN yang dikenal | 2 (alamat server), 8 |
| Lobby | Daftar pemain (nama, status ready, ping), kode undangan (tombol salin), tombol Start (owner) / Ready | 8 |
| HUD | Lihat §5 | 3–9 |
| Inventory (Tab) | Grid 20 slot + hotbar 8 + equipment 3; tooltip; drag & drop; shift-click transfer; panel container di kanan saat membuka storage | 6 |
| Crafting (Tab → tab Craft) | Kategori, daftar recipe (unlocked/locked dengan syarat), detail bahan (punya/kurang), qty, tombol Craft, antrean | 6 |
| Research (di Survey Table) | Slot "study", bar Insight per kategori, tech tree per kategori dengan biaya | 9 |
| Build menu (klik kanan saat memegang Mallet) | Radial menu kategori → piece; menampilkan biaya | 7 |
| Station UI | Slot input/fuel/output, progress bar, status (mis. "butuh matahari") | 9 |
| Pause (Esc) | Resume, Settings, Invite code, Save status, Quit to Menu (tidak menghentikan dunia bila ada pemain lain) | 3 |
| Settings | Grafik (preset Low/Medium/High/Ultra, render scale, shadow, view distance, FOV 70–100), Audio (bus volume), Kontrol (sensitivitas, invert Y, rebind), Gameplay (bahasa, skala UI, crosshair), Network (tampilkan ping/FPS) | 3 (dasar), 14 |
| Downed/Death | Timer downed 30 s, "Teman bisa menolongmu", tombol "Give up" → respawn; info Wreck Bag | 9 |
| Connection | Indikator koneksi di pojok (hijau/kuning/merah + ping); overlay "Reconnecting… (n/15)"; "Connection lost" + kembali ke menu | 2 |
| Save feedback | Ikon kecil "Saving…" → "Saved" (2 s) di pojok kanan atas; error save hanya ke owner | 8 |

## 5. HUD layout (1920×1080 referensi)
```
┌──────────────────────────────────────────────────────────────────────┐
│ [conn ● 32ms]                                   [💾 Saved] [☀ 14:20] │
│                                                                      │
│                                                                      │
│                       (crosshair · titik 4px)                        │
│                  [E] Ambil Driftwood   ← interaction prompt          │
│                                                                      │
│ ❤ ████  🍖 ███  💧 ██                         notif feed (item +3)   │
│ 🫧 ████ (hanya saat menyelam)                                         │
│            [1][2][3][4][5][6][7][8]  ← hotbar, slot aktif disorot   │
└──────────────────────────────────────────────────────────────────────┘
```
- Vital: bar horizontal kecil kiri bawah; berkedip saat < 20%.
- Hook: indikator power (arc) di sekitar crosshair saat charge.
- Building: ghost hijau/merah + teks alasan bila merah ("Butuh dukungan", "Material kurang: Plank 2").
- Nameplate pemain lain: nama + bar health kecil bila < 100%, memudar > 30 m.

## 6. Kontrol default (dapat di-rebind)
| Aksi | Key |
|---|---|
| Gerak | W A S D |
| Lompat / naik (berenang) | Space |
| Sprint | Shift |
| Menyelam (saat berenang) | C (bukan Ctrl: Ctrl+W menutup tab browser). Jongkok di darat: Deferred |
| Interaksi | E (tahan untuk revive/aksi lama) |
| Aksi utama (lempar hook: tahan = isi tenaga, lepas = lempar; tahan lagi = tarik; serang/place nanti) | Klik kiri |
| Aksi sekunder (lepas/batal kait; menu build nanti) | Klik kanan |
| Rotasi piece | R |
| Hotbar | 1–8, scroll wheel |
| Inventory / crafting | Tab |
| Drop item | Q |
| Pause | Esc |
| Fullscreen | F11 (browser) + tombol di Settings (`requestFullscreen`) |
| Toggle perf overlay (dev) | F3 |

## 7. Pointer lock & fokus
- Klik canvas → `requestPointerLock` (dengan `unadjustedMovement` bila didukung). Esc dilepas oleh browser → otomatis buka Pause.
- Kembali ke game: klik tombol Resume (gesture user diperlukan browser).
- Tidak ada keybind gameplay pada Esc selain pause (browser memaksa Esc untuk keluar pointer lock).

## 8. Feedback & juiciness (target Phase 14)
Hit marker, angka damage kecil opsional, suara pickup, getaran kamera ringan saat Reefjaw menggigit rakit, highlight rim objek yang dibidik, animasi slot hotbar.

## 9. Aksesibilitas
Mode buta warna (ubah merah/hijau ghost ke biru/oranye), subtitle untuk audio penting (Reefjaw mendekat: "Suara gemuruh di air"), opsi kurangi gerak kamera (head bob off), skala UI.

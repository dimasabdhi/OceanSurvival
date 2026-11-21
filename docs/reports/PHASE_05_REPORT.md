# Completion Report — Phase 5 (Hook Gameplay)

Tanggal: 2026-11-21 · Status: **Selesai secara teknis, menunggu uji manual & persetujuan owner** · Branch: `main`

## 1. Ringkasan
Pemain sekarang memegang **alat kait (Grapple Line)**: tahan klik kiri untuk mengumpulkan tenaga (cincin di sekitar crosshair), lepas untuk melempar. Kait melayang membawa tali, jatuh ke laut, dan ikut terbawa arus. Tahan klik kiri lagi untuk menariknya. Debris yang tersentuh ikut tertangkap (maksimal 3), lalu begitu kait kembali ke tangan, isinya masuk **tas sementara** (pojok kanan bawah) disertai notifikasi "+1 Kayu apung". Klik kanan melepas kait; debris yang tertangkap kembali hanyut.

| Pengukuran | Target (AC Phase 5) | Hasil |
|---|---|---|
| Charge, jarak maks 25 m, tarik, maks 3 debris | ✅ | Unit test (jangkauan ≤ 25 m di semua sudut) + integration + E2E mouse asli |
| Dua pemain menarget debris yang sama | hanya satu dapat | ✅ integration test |
| Kait & tali konsisten untuk semua pemain | ✅ | Lintasan terbang dihitung dari parameter lemparan yang sama di server & semua client |
| Tas privat | hanya pemilik melihat | ✅ (StateView; pemain lain menerima tas kosong) |
| Server dengan 60 debris + 4 pemain | tick ≤ 2 ms | 0,039 ms, 9,3 kbps/pemain |

## 2. Apa yang dibuat
**Shared**: `hook.ts` berisi aturan kait (kecepatan lempar, batas tali 25 m, tarik 3,5 m/s, radius tangkap 0,8 m, maks 3, jarak kembali 1,5 m, jarak putus 30 m, jeda lempar 0,5 s), lintasan analitik (`hookFlightPosition`), waktu jatuh ke air, dan validasi pesan (zod). State baru: `HookState`, `Debris.hookId`, dan `PlayerState.carried` (tas sementara, privat).

**Server**: `sim/HookSystem.ts` menjalankan siklus terbang → mengapung → ditarik → kembali ke tangan, menangkap debris dengan "kunci" agar satu debris hanya di satu kait, membatalkan bila kait terlalu jauh atau pemilik keluar, dan melepas debris saat dibatalkan. Room menambah pesan `hook.throw/reel/cancel` (divalidasi dan dibatasi lajunya); pemain yang sedang menyelam tidak bisa melempar. Isi tas ikut tersimpan di save.

**Client**:
- `HookController`: kontrol mouse (tahan/lepas/klik kanan).
- `HookRenderer`: kait tiga cabang dan tali melengkung (Bézier 16 segmen) dari tangan pemilik, berlaku untuk pemain lain juga.
- `Viewmodel`: gulungan tali dan kait di tangan kanan, yang tertarik ke belakang saat mengisi tenaga.
- "Kait bayangan" lokal sehingga lemparan terasa instan sebelum server menjawab.
- Debris yang tertangkap menggantung di kait. Menu klik kanan browser dinonaktifkan di area game.
- HUD: cincin tenaga, panel tas, dan notifikasi item.

## 3. Hasil pengujian
| Pemeriksaan | Hasil |
|---|---|
| `pnpm verify` | ✅ lint + typecheck + 73 test + aset; seluruh suite 6× berturut-turut tanpa gagal setelah perbaikan di §4 |
| Test kait (integration, 6) | ✅ lempar → mendarat → hanyut; tangkap → tarik → tas privat; satu debris satu kait; tolak lempar kedua; batal melepas debris; tidak bisa lempar saat menyelam; putus > 30 m. Stabil 2× berturut-turut |
| E2E Chrome & Edge | ✅ 12/12, termasuk kait dengan **mouse sungguhan** (tahan → cincin tenaga → lepas → mendarat → tahan → kembali) |
| Uji beban 4 bot × 60 s | ✅ tick 0,039 ms, 9,3 kbps, 60 debris |
| Visual | ✅ tali dari tangan ke air, viewmodel (diperbaiki agar gulungan terlihat) |

## 4. Masalah yang ditemukan & penyelesaiannya
| Masalah | Akar masalah | Solusi |
|---|---|---|
| Gulungan tali di tangan terlihat seperti batang oranye | Gulungan menghadap samping ke kamera | Diputar agar lingkarannya menghadap kamera |
| Test daftar field debris gagal | Debris mendapat field baru `hookId` (disengaja) | Test diperbarui |
| Test kait "dua pemain" gagal | Nama test "A"/"B" ditolak server (minimal 2 huruf) — validasi bekerja benar | Nama test diganti |
| Test *reconnect* gagal **sekali** (dari ±20 run) | Penyelidikan menemukan pemain yang diam tepat di pertemuan papan rakit bergeser ±1,6 µm/menit (dorongan samping mesin tabrakan di tepi papan); posisi "sebelum/sesudah" bisa berbeda mikrometer | Diam di tanah tanpa input = geseran samping < 1 mm diabaikan (server & client sama, prediksi tetap 0 cm); test baru 60 s di 3 titik sambungan; pesan test reconnect diperjelas. Run asli tidak bisa direproduksi lagi (6× hijau) — dipantau |
| **Kesalahan proses**: commit `2969777` di-push walau run verify-nya merah | Skrip commit saya tidak berhenti saat test gagal | Perbaikan di commit berikutnya; commit kini hanya dibuat bila `pnpm verify` lulus |

## 5. Cara Anda menguji (±10 menit)
1. Hentikan `pnpm dev` lama (Ctrl + C), lalu:
   ```powershell
   pnpm dev
   ```
2. Gabung ke dunia. Lihat ke depan (debris datang dari depan).
3. **Tahan klik kiri**: cincin tenaga terisi. **Lepas**: kait terbang dengan tali dan jatuh ke air.
4. **Tahan klik kiri** lagi: kait ditarik. Arahkan lemparan ke dekat debris agar tertangkap; saat kait kembali muncul "+1 …" dan isi tas (kanan bawah) bertambah.
5. Coba **klik kanan** saat kait di air: kait lepas, debris yang tertangkap hanyut lagi.
6. Buka tab kedua: lemparan pemain lain terlihat (kait + tali dari tangannya). Tas pemain lain tidak terlihat.
7. Keluar lalu masuk lagi: isi tas tetap.

Mohon kabari rasanya: apakah tenaga lempar, jangkauan, dan kecepatan tarik terasa pas, dan apakah radius tangkap terlalu sulit atau terlalu mudah.

## 6. Known limitations
- **Tas sementara**: belum ada slot, stack, buang item, atau crafting. Inventory penuh di Phase 6.
- Semua pemain otomatis memegang kait (belum ada hotbar/ganti alat). Viewmodel, kait, dan tali = **PLACEHOLDER** visual; animasi lempar karakter belum ada.
- Isi tong (barrel) belum dibuka menjadi campuran material (GDD) — Phase 6.
- Durabilitas kait (120 lemparan, GDD) belum diterapkan — Phase 6 bersama item.
- Tidak ada suara lempar/cebur.
- Bot uji beban belum melempar kait (hanya bergerak); beban kait diukur lewat test integrasi.

## 7. Langkah berikutnya
1. Uji manual §5.
2. Setujui mulainya **Phase 6 — Inventory & basic crafting → Vertical Slice v0.1**: inventory 20 slot + hotbar 8, drag & drop, buang/ambil item, crafting tangan (Tali, Papan, Fondasi, Tombak), dan tas sementara dipindahkan otomatis ke inventory.

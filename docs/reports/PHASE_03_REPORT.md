# Completion Report — Phase 3 (First-person Controller & Starting Raft)

Tanggal: 2026-11-21 · Status: **Selesai secara teknis, menunggu uji manual & persetujuan owner** · Branch: `main`

## 1. Ringkasan
Dek uji diganti dengan **rakit 2×2 yang hanyut** di laut (0,6 m/s). Pemain bisa berjalan, lari, dan lompat di atasnya. Kalau jatuh ke laut, pemain terbawa arus dan rakit menjauh, sehingga ia harus berenang mengejar lalu melompat naik lagi. Pemain juga bisa menyelam dan melihat permukaan laut dari bawah. Rakit bergoyang oleh ombak, dan di sudutnya ada lentera yang bisa dinyalakan dengan **E**.

Tantangan utama phase ini adalah bergerak di atas platform yang bergerak tanpa goyang/jitter. Solusinya, semua gerak pemain dihitung **relatif terhadap rakit**, sehingga rakit "diam" dalam hitungan gerak dan airlah yang mengalir. Keputusan ini dicatat di [ADR-0014](../adr/0014-raft-relative-simulation-frame.md).

| Pengukuran | Target (AC Phase 3) | Hasil |
|---|---|---|
| Koreksi prediksi di rakit yang hanyut (ping 150 ms) | tanpa jitter | **0 cm** (gerak lurus, campuran, dan perjalanan rakit→air→selam→naik lagi: 119 sinkronisasi) |
| Diam di rakit 10 detik | tidak tergeser | 0 mm |
| Melintasi sambungan antar papan rakit | tanpa guncangan | < 1 cm naik-turun |
| Interaksi di luar 3,0 m (posisi server) | ditolak | ✅ ditolak (`too-far`) |
| Tick server, 4 bot | ≤ 2 ms | 0,023 ms (p95 0,056); 8,6 kbps/pemain |

## 2. Apa yang dibuat
**Shared**
- `world/raft.ts`: rakit awal (4 fondasi 1,5 m, dek 0,25 m di atas air), lentera, titik spawn, kecepatan rakit & arus air, `raftWorldPosition`.
- `movement`: arus air untuk perenang, menyelam (C, 2 m/s, maks 25 m), naik ke permukaan (Space), mengapung pelan saat dilepas, mode baru `Diving`.
- `interaction.ts`: aturan interaksi bersama (2,5 m prompt / 3,0 m server), `InteractUse` (zod).
- `ocean/waves.ts`: ombak bisa diambil relatif terhadap rakit tanpa kehilangan presisi, bahkan 100 km dari titik awal (test).
- `MovementWorld.hasLineOfSight` (cek terhalang dengan Rapier).

**Server**
- State rakit (posisi dunia + kecepatan + lentera), pesan `interact.use` (jarak + line of sight + rate limit).
- **Format save v2** dengan **migrasi otomatis dari v1**: save Phase 2 Anda tetap bisa dimuat. Posisi lama di-reset ke rakit karena dek uji sudah tidak ada.
- Perenang yang terbawa arus lebih dari 200 m dari rakit dikembalikan ke rakit (jaring pengaman sampai sistem oksigen/kematian ada di Phase 9).

**Client**
- Render dalam frame rakit: laut mengalir melewati rakit, kotak apung tertinggal di belakang.
- Rakit prosedural (**PLACEHOLDER**): papan, balok, pelampung, tali, dan lentera yang menyala dengan cahaya oranye.
- Goyangan rakit oleh ombak (hanya visual) untuk rakit, pemain di atasnya, dan kamera. Perenang naik-turun mengikuti ombak.
- Bawah air: kabut biru-hijau, permukaan terlihat dari bawah, langit tersembunyi.
- Prompt interaksi "[E] Nyalakan/Padamkan lentera", head bob saat berjalan, pengaturan baru (goyangan kepala, goyangan rakit) yang tersimpan per browser.

## 3. Hasil pengujian
| Pemeriksaan | Hasil |
|---|---|
| `pnpm verify` | ✅ lint + typecheck + 48 test + aset |
| E2E Chrome & Edge | ✅ 10/10 (termasuk berjalan ke lentera dengan tombol W sungguhan → prompt → E → lentera menyala, server memvalidasi; pengaturan tetap setelah reload) |
| Prediksi vs server, RTT 150 ms | ✅ 0 cm (3 skenario) + kontrol divergen terdeteksi |
| Uji beban 4 bot × 60 s | ✅ tick 0,023 ms, 8,6 kbps |
| Visual (browser): siang, malam + lentera, bawah air | ✅ dicek dengan screenshot |

## 4. Masalah yang ditemukan & penyelesaiannya
| Masalah | Akar masalah | Solusi |
|---|---|---|
| Rakit bergerak tidak bisa diprediksi (desain) | Posisi rakit bergantung pada waktu server saat input diproses, yang tidak diketahui client | Frame relatif-rakit (ADR-0014) |
| Presisi ombak memburuk setelah rakit hanyut jauh | Koordinat dunia besar di shader (float32) | Offset rakit dilipat ke fase gelombang di CPU (float64) |
| Langit terlihat dari bawah air | Langit tidak terkena kabut | Saat di bawah air langit disembunyikan, latar = warna kabut |
| Menyelam dengan Ctrl berbahaya | Ctrl+W menutup tab browser | Menyelam hanya dengan **C** |
| Test lama tidak lagi akurat | Pemain yang berenang terus terbawa arus | Toleransi = arus × latensi saat berenang, tetap ketat (5 mm) saat di rakit |

## 5. Cara Anda menguji (±10 menit)
1. Hentikan `pnpm dev` lama (Ctrl + C), lalu jalankan lagi:
   ```powershell
   pnpm dev
   ```
2. Buka `http://localhost:5173`, lalu **Gabung ke dunia**. Anda muncul di rakit yang bergoyang pelan; kotak kayu di laut tampak tertinggal di belakang.
3. Jalan, lari, dan lompat di rakit. Rasakan apakah ada getaran/jitter.
4. Jalan ke sudut ber-tiang, arahkan crosshair ke lampu, tekan **E**. Lentera menyala (paling terasa di malam hari).
5. Lompat ke laut. Anda terbawa arus menjauh. Tahan **C** untuk menyelam dan lihat permukaan dari bawah, lalu lepas untuk naik.
6. Berenang kembali ke rakit, menghadap tepinya, lalu tekan **Space** untuk naik.
7. Buka tab kedua dan gabung. Pemain lain tampak ikut bergoyang bersama rakit.
8. Esc: coba matikan "Goyangan rakit"/"Goyangan kepala", reload, dan pastikan pengaturan tetap.

Mohon laporkan hasilnya, terutama: apakah goyangan rakit nyaman (tidak bikin pusing), apakah naik dari air terasa wajar, dan apakah arus terlalu cepat/lambat.

## 6. Known limitations (disengaja / ditunda)
- Rakit, lentera, kapsul pemain, dan kotak apung = **PLACEHOLDER** visual.
- Air gameplay rata. Goyangan dan ombak hanya visual, jadi saat ombak tinggi perenang bisa terlihat sedikit "menembus" ombak.
- Belum ada jongkok, animasi karakter, tangan/alat di layar (viewmodel → Phase 5/6 bersama alat), atau suara.
- Belum ada oksigen. Menyelam tanpa batas waktu sampai Phase 9.
- Rakit selalu hanyut lurus ke satu arah. Layar/kemudi ada di Phase 11 (frame rakit perlu diperluas, R23).
- Kapsul di tab lain tampak sedikit tersendat bila tab itu di latar belakang (browser memperlambat tab latar).

## 7. Langkah berikutnya
1. Uji manual §5.
2. Setujui mulainya **Phase 4 — Ocean & floating resources**: laut versi final v1, siklus hari penuh, dan debris yang di-spawn server lalu hanyut melewati rakit (menggantikan kotak apung placeholder).

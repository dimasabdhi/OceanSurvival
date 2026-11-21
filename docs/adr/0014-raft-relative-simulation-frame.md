# ADR-0014: Simulasi pemain dalam satu frame relatif-rakit

- **Status**: Accepted (implementasi ADR-0005 untuk Phase 3; ditinjau ulang di Phase 11 & 12)
- **Tanggal**: 2026-11-21
- **Terkait**: [ADR-0005](0005-server-authoritative-movement.md), [ADR-0013](0013-colyseus-builtin-netcode.md), [RISK_REGISTER R1](../RISK_REGISTER.md)

## Konteks
Rakit hanyut di laut (GDD §11: 0,6 m/s). Pemain harus bisa berjalan & melompat di rakit yang bergerak tanpa jitter, dan prediksi client harus identik dengan server (Phase 2: 0 cm koreksi).

Kontrak netcode Colyseus: fungsi `step` hanya boleh membaca state + input. **Waktu server saat input diproses tidak bisa diketahui client** (input menunggu di buffer server dengan latensi berubah-ubah). Jadi bila tabrakan bergantung pada posisi rakit "sekarang" di dunia, prediksi pasti meleset tiap kali rakit bergerak.

## Keputusan
1. **Semua pemain disimulasikan dalam frame relatif-rakit** (rakit = titik asal, diam di frame ini). Geometri rakit statis → tabrakan tidak bergantung waktu → prediksi tetap deterministik.
2. Rakit bergerak dengan **kecepatan konstan** terhadap air → frame ini inersial: lompat di atas rakit otomatis "ikut" rakit (benar secara fisika).
3. **Air mengalir melewati rakit**: pemain yang berenang ikut terbawa arus relatif-rakit (`WATER_FLOW`, konstanta shared) → jatuh dari rakit berarti rakit menjauh, pemain harus berenang mengejar (renang 2,4 m/s > hanyut 0,6 m/s). Ini sesuai genre & GDD.
4. Posisi rakit di dunia = fungsi deterministik waktu dunia (`raft.originX/Z + velocity × (worldTime − originTime)`), direplikasi lewat state, **hanya dipakai untuk rendering** (ombak, langit, objek dunia) dan nanti untuk spawn debris/pulau.
5. Client merender dalam frame rakit (rakit dekat titik 0 → presisi float bagus = floating origin gratis); laut digeser `uRaftWorld` sehingga ombak tampak mengalir melewati rakit.
6. Goyangan rakit oleh ombak (heave/pitch/roll) **hanya visual**, diterapkan pada rakit, pemain di atasnya, dan kamera; gameplay memakai permukaan air rata-rata. Bisa dimatikan di pengaturan.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| Frame dunia, rakit = kinematic body bergerak | Pose rakit bergantung waktu server saat input diproses → prediksi meleset terus (melanggar kontrak determinisme) |
| Frame berganti (rakit ↔ air) saat masuk/keluar air | Konversi koordinat butuh pose rakit pada waktu tertentu → koreksi di setiap transisi |
| Rakit terikat arus (tidak bergerak relatif air) | Pemain yang jatuh tidak tertinggal; debris tidak "mengalir lewat"; tidak sesuai GDD |

## Konsekuensi
- Positif: prediksi tetap exact di atas rakit bergerak; tidak perlu floating origin terpisah; satu frame sederhana.
- Negatif / ditunda:
  - **Phase 11 (layar/dayung/kemudi)**: kecepatan & arah rakit berubah. `WATER_FLOW` menjadi state (dibaca step) → koreksi kecil hanya pada saat perubahan; rotasi rakit memutar frame (efek sentrifugal diabaikan).
  - **Phase 12 (pulau)**: pulau diam di dunia → bergerak di frame rakit. Saat rakit berlabuh (jangkar), kecepatan 0 → pulau statis di frame rakit. Saat rakit bergerak, tabrakan dengan pulau perlu keputusan lanjutan (ADR baru).
  - Hanya satu rakit per dunia (sesuai GDD).

## Validasi
AC Phase 3: berjalan/lompat di rakit 0,6 m/s tanpa jitter pada RTT 0 & 100 ms (test prediksi); transisi air↔rakit deterministik (test).

# Completion Report — Phase 4 (Ocean & Floating Resources)

Tanggal: 2026-11-21 · Status: **Selesai & disetujui owner (2026-11-21)** — jumlah debris dan tampilan laut/langit dinilai pas · Branch: `main`

## 1. Ringkasan
Laut kini berisi **debris yang di-spawn oleh server** (kayu apung, plastik, rumput laut, tong, kelapa), menggantikan kotak placeholder. Debris muncul di depan rakit, hanyut melewatinya, lalu menghilang di belakang. Semua pemain melihat debris yang sama di tempat yang sama. Tampilan laut dan langit juga dipoles: busa ombak berupa guratan, puncak ombak berpendar saat menghadap cahaya, serta ada bintang dan bulan di malam hari. Selain itu sebuah bug "kedipan cahaya" saat senja ditemukan lewat test baru dan sudah diperbaiki.

| Pengukuran | Target (AC Phase 4) | Hasil |
|---|---|---|
| Tinggi ombak client = server | selisih < 1 mm | ✅ satu fungsi bersama + test formula shader (juga 100 km dari titik awal) |
| Debris maks per rakit | 60 | ✅ tidak pernah lebih (test 5 menit, 4 pemain) |
| Debris di luar 120 m tidak dikirim | ✅ | Pemain 190 m dari rakit menerima **0** debris (StateView asli) |
| Siklus siang–malam tanpa artefak | ✅ | Test 4.000 titik sepanjang 24 menit |
| `?bench=full4p` | ≥ 60 FPS | **164,7 FPS** (batas monitor 165 Hz), 63 draw call, 130 ribu segitiga |
| Bandwidth dengan 57 debris | ≤ 64 kbps | **8,1 kbps** per pemain; tick server 0,045 ms |

## 2. Apa yang dibuat
**Shared**: `world/debris.ts` berisi 5 jenis debris, bobot GDD (40/30/22/5/3 %), radius tangkap (dipakai hook di Phase 5), aturan spawn (40–90 m di depan, ±35 m ke samping), laju sesuai jumlah pemain, umur 180 s, dan AOI 120 m.

**Server**: `sim/DebrisSystem.ts` menangani spawn, despawn, pengisian awal laut saat dunia dibuka, dan AOI per pemain via `StateView`. Generator acaknya diberi seed per dunia, sehingga bisa diuji ulang. Debris **tidak pernah dikirim ulang per tick**: hanya data "muncul" (posisi dunia + waktu) dan "hilang".

**Client**:
- `world/DebrisRenderer.ts`: satu InstancedMesh per jenis (5 draw call untuk semua debris). Debris naik-turun dan miring mengikuti ombak, berputar pelan, serta muncul dan hilang perlahan. Plastiknya berwarna merah, biru, kuning, atau putih.
- `world/localDebris.ts`: debris lokal untuk mode tanpa server, menu, dan benchmark.
- Laut v1: busa dipecah noise yang menempel di air (tidak ikut bergerak bersama rakit), pendar di puncak ombak, dan presisi tetap terjaga saat rakit hanyut jauh.
- Langit: bintang (hanya di atas cakrawala) dan bulan di sisi berlawanan matahari, muncul perlahan saat matahari terbenam.
- Benchmark `?bench=full4p` (rakit, 3 pemain, 60 debris, lentera menyala) dan `BENCH_SCENE` di skrip benchmark.

## 3. Hasil pengujian
| Pemeriksaan | Hasil |
|---|---|
| `pnpm verify` | ✅ lint + typecheck + 61 test + aset |
| E2E Chrome & Edge | ✅ 10/10 (termasuk "tanpa error konsol" setelah perubahan shader) |
| Benchmark full4p 3 × 30 s | ✅ 164,4 / 164,8 / 164,7 FPS; frame p99 6,2 ms; maks 18 ms (frame pertama) |
| Uji beban 4 bot × 90 s | ✅ tick 0,045 ms (p95 0,099), 8,1 kbps, 57 debris |
| Visual (siang, senja, malam + bintang/bulan) | ✅ screenshot |

## 4. Masalah yang ditemukan & penyelesaiannya
| Masalah | Akar masalah | Solusi |
|---|---|---|
| **Kedipan cahaya saat senja** (bayangan & pencahayaan melompat ke sisi berlawanan dalam 1 frame) | Arah cahaya utama berganti matahari → bulan secara instan dengan intensitas penuh | Intensitas meredup ke ~0 di cakrawala, jadi pergantian tidak terlihat. Ditangkap oleh test kontinuitas baru |
| Busa ombak berupa bercak besar | Busa hanya bergantung pada tinggi puncak gelombang panjang | Dipecah dengan noise dunia 2 oktaf |
| Shader gagal compile | Nama variabel `n` bentrok dengan normal permukaan | Ganti nama. Kegagalan ini juga akan tertangkap oleh E2E "tanpa error konsol" |
| `StateView` tidak bekerja di unit test | StateView butuh state yang terpasang di room | Unit test memakai view tiruan untuk logika jarak; perilaku StateView asli diuji di test integrasi room |

## 5. Cara Anda menguji (±5 menit)
1. Hentikan `pnpm dev` lama (Ctrl + C), lalu:
   ```powershell
   pnpm dev
   ```
2. Gabung ke dunia. Lihat ke depan (arah rakit bergerak): debris berwarna mengapung dan perlahan mendekat, lalu lewat di samping rakit.
3. Buka tab kedua: debris yang sama terlihat di tempat yang sama di kedua tab.
4. Tunggu senja/malam, atau buka `http://localhost:5173/?net=0` dan geser **Waktu** di menu Esc: perhatikan bintang, bulan, dan tidak ada kedipan cahaya saat matahari terbenam.
5. (Opsional) `http://localhost:5173/?bench=full4p&net=0` → setelah ±1 menit hasil FPS tampil di layar.

Mohon kabari kesan Anda: apakah jumlah debris pas (terlalu ramai/sepi), dan apakah tampilan laut/langit malam sudah sesuai selera.

## 6. Known limitations
- Debris belum bisa diambil. Hook datang di Phase 5, dan radius tangkap sudah disiapkan.
- Bentuk debris = **PLACEHOLDER** prosedural (model final di art pass).
- Cuaca (hujan/badai) belum ada; laut selalu "tenang". Weather penuh = Phase 13.
- Debris tidak disimpan di save (sesuai desain); laut diisi ulang saat dunia dibuka.
- 63 draw call di full4p, sebagian besar papan rakit yang masih mesh terpisah. Instancing rakit datang bersama building system (Phase 7).

## 7. Langkah berikutnya
1. Uji manual §5.
2. Setujui mulainya **Phase 5 — Hook gameplay**: lempar kait dengan tenaga (charge), tarik, tangkap debris (maks 3), tali terlihat oleh semua pemain, dan validasi server.

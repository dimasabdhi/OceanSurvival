# Product Vision — OceanSurvival

Status: **Draft v1 (Phase 0)** · Owner approval: pending · Terkait: [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md), [ROADMAP](ROADMAP.md)

## 1. Pernyataan visi
> **"Bertahan hidup bersama teman di lautan yang luas — dari beberapa keping kayu apung menjadi rumah terapung yang menjelajahi kepulauan yang tenggelam — langsung di browser, tanpa instalasi."**

## 2. Masalah & peluang
- Game survival co-op berkualitas biasanya butuh instalasi besar dan PC/console khusus. Browser modern (WebGL 2, WASM, WebSocket) sudah cukup kuat untuk game 3D co-op skala kecil.
- Peluang: pengalaman survival-lautan yang **langsung bisa dimainkan dari link**, cocok untuk sesi bersama teman 30–120 menit, dengan dunia yang tersimpan dan bisa dilanjutkan.

## 3. Target pemain
| Segmen | Deskripsi | Kebutuhan utama |
|---|---|---|
| Primer | Kelompok 2–4 teman, usia 16+, pemain PC kasual–menengah | Mudah join (link/kode), progres bersama, sesi bisa dilanjutkan |
| Sekunder | Pemain solo penyuka survival/crafting | Loop jelas, progression memuaskan, tidak terlalu menghukum |
| Bukan target (saat ini) | Pemain mobile/console, PvP kompetitif, MMO ratusan pemain | — |

## 4. Pilar desain (dipakai untuk memutuskan konflik desain)
1. **Laut yang hidup** — ombak, cuaca, siang–malam, arus, dan makhluk laut selalu terasa bergerak dan memengaruhi keputusan pemain.
2. **Membangun rumah terapung** — rakit adalah markas, kendaraan, dan ekspresi kreativitas pemain; building harus memuaskan dan mudah dibaca.
3. **Bertahan bersama** — co-op adalah inti: tugas bisa dibagi (mengait, memasak, menjaga, membangun), tidak ada fitur yang hanya masuk akal untuk solo.
4. **Penasaran pada cakrawala** — selalu ada sesuatu di kejauhan (pulau, mercusuar, bangkai kapal) yang memancing eksplorasi.
5. **Hormat pada waktu pemain** — progress tersimpan, sesi pendek tetap bermakna, kematian tidak menghapus jam bermain.

## 5. Identitas orisinal (draft, perlu persetujuan owner)
- **Setting**: *The Hushed Sea* — kepulauan tropis fiktif yang perlahan tenggelam akibat "Long Tide" (kenaikan air laut bertahap). Sisa peradaban: atap rumah panggung, menara mercusuar, dermaga, pelabuhan kecil yang terendam. Nuansa: hangat, tropis, sedikit melankolis, tidak post-apocalyptic gelap.
- **Tujuan jangka panjang**: menyalakan kembali jaringan **mercusuar (Beacon)** yang tersebar untuk memetakan rute dan menemukan **The Last Atoll**, tempat para penyintas berkumpul.
- **Makhluk khas**: *Reefjaw* (predator utama yang menyerang tepi rakit), *Needlefin* (pengganggu penyelam), ikan-ikan kecil, kepiting pulau *Shellback*.
- **Mekanik khas yang membedakan**: sistem riset **Insight** (mempelajari kategori material, bukan item tunggal), alat air berbasis cuaca/matahari (*Solar Still*, *Drip Catcher*), mercusuar sebagai navigasi & cerita.
- Semua nama di atas adalah nama kerja; tidak boleh menyalin nama, karakter, atau cerita dari game lain.

## 6. Pengalaman yang ingin dirasakan pemain
| Waktu | Perasaan |
|---|---|
| Menit pertama | "Aku terdampar, tapi aku langsung tahu harus mengait barang yang hanyut." |
| 30 menit | "Rakitku tumbuh, kami punya air bersih dan makanan; Reefjaw membuat kami waspada." |
| 3 jam | "Kami punya layar, kebun kecil, dan baru saja menemukan pulau pertama." |
| 10+ jam | "Rakit kami adalah rumah bertingkat yang berlayar ke mercusuar berikutnya." |

## 7. Platform & batasan produk
- Browser desktop Windows: **Chrome & Edge terbaru** (target pertama). Firefox/Safari: tidak diblokir, tapi tidak dijamin sampai diuji.
- Keyboard + mouse, first-person, fullscreen, pointer lock.
- Tidak boleh mensyaratkan instalasi aplikasi desktop.
- Multiplayer awal: LAN / satu PC; kemudian server di internet (Phase 16).

## 8. Ukuran keberhasilan (diukur mulai Vertical Slice)
| Metrik | Target |
|---|---|
| Waktu dari buka link → bermain | < 60 detik pada koneksi broadband (first load), < 15 detik (cached) |
| FPS pada reference PC (Ryzen 5 7500F / RX 9060 XT) | ≥ 60 FPS stabil, quality High, 4 pemain |
| Sesi co-op 2 jam tanpa disconnect/desync fatal | 100% pada LAN dalam QA |
| Kehilangan progress akibat crash server | ≤ 1 interval autosave (default 120 detik) |
| Pemain baru memahami loop inti tanpa tutorial teks panjang | ≥ 4 dari 5 playtester |

## 9. Di luar scope (sampai diputuskan lain)
PvP, mod support, mobile/touch, VR, monetisasi, akun email/OAuth, cross-world trading, server dedicated publik dengan matchmaking global, lebih dari 4 pemain per world (dievaluasi setelah load test Phase 15).

## 10. Keputusan terbuka
- Nama final game dan nama-nama konten final.
- Lisensi kode project (proprietary vs open source).
- Tingkat kedalaman cerita (environmental storytelling saja vs quest berantai).

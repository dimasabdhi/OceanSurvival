# Art Direction (Art Bible) — OceanSurvival

Status: **Draft v1 (Phase 0)** · Keputusan owner: **Stylized low-poly** · ADR: [0009](adr/0009-art-direction-stylized-lowpoly.md)

## 1. Kata kunci gaya
**Hangat · tropis · lapang · sedikit melankolis · terbaca jelas.**
Low-poly bersih dengan bentuk tegas dan siluet mudah dikenali; permukaan **flat atau gradient shading** (bukan tekstur foto); kedalaman suasana datang dari **lighting, fog, dan warna langit**, bukan detail geometri.

Referensi *suasana* (bukan untuk ditiru asetnya): ilustrasi travel poster tropis, diorama low-poly, lukisan cat air laut senja.

## 2. Hal yang dihindari
- Mencampur model realistis/PBR foto-skan dengan low-poly.
- Outline tebal ala kartun pada model 3D (ikon UI boleh).
- Warna jenuh penuh (neon) kecuali bioluminesensi malam hari yang disengaja.
- Gaya visual, siluet, atau palet yang meniru game tertentu (termasuk Raft).

## 3. Palet utama
| Peran | Hex | Catatan |
|---|---|---|
| Laut dangkal | `#3FC1C9` | Turquoise, dekat pulau/karang |
| Laut dalam | `#1B4F72` | Laut terbuka |
| Laut sangat dalam | `#0B2540` | Bawah laut > 20 m |
| Busa / buih | `#F4FBF8` | |
| Pasir | `#E8D3A2` | |
| Kayu apung | `#A27B5C` / gelap `#6B4F3A` | Kayu lapuk keabu-abuan |
| Tali / serat | `#C9B37E` | |
| Plastik hanyut | `#E2574C`, `#3E8ED0`, `#F2C14E` | Aksen warna di dunia yang kalem |
| Logam berkarat | `#8C5A3C` / `#5E6B70` | |
| Vegetasi | `#5BA35B` / gelap `#2F6B3A` | |
| Langit siang | `#8FD3F4` → horizon `#FBEAC8` | |
| Senja | `#F28C5B` → `#6A4C93` | |
| Malam | `#14213D` + bulan `#DDE7F2` | |
| Bahaya (UI/Reefjaw stripe) | `#E63946` | Dipakai hemat |

Palet disimpan juga sebagai **palette atlas texture** 256×256 (Phase 1–3) — model di-UV ke swatch, sehingga banyak model berbagi 1 material → batching/instancing lebih efisien.

## 4. Lighting & atmosfer
| Waktu | Matahari | Ambient/hemisphere | Fog |
|---|---|---|---|
| Siang | Putih hangat, intensitas tinggi, bayangan tegas | Langit biru / laut biru | Tipis, jauh (start 150 m) |
| Senja | Oranye rendah, bayangan panjang | Ungu-oranye | Sedang, berwarna senja |
| Malam | Bulan biru-pucat, intensitas rendah | Biru gelap | Lebih dekat; plankton bercahaya opsional |
| Badai | Matahari tertutup, kontras rendah | Abu kebiruan | Dekat (start 40 m), hujan |
| Bawah air | — | Biru kehijauan | Sangat dekat (8–25 m sesuai kedalaman), caustics |

## 5. Budget geometri & tekstur
| Kategori | Triangles (LOD0) | LOD | Tekstur |
|---|---|---|---|
| Building piece | 100–600 | LOD1 bila > 300 tris | Palette atlas |
| Tool/viewmodel | 500–2.000 | — | Palette atlas / 256² |
| Pemain (3rd person) | 3.000–5.000 | LOD1 50% | 512² |
| Reefjaw | 3.000–6.000 | LOD1, LOD2 | 512² |
| Ikan kecil | 100–300 | — (instanced) | Palette |
| Pohon pulau | 300–1.200 | LOD1 + impostor jauh | Palette |
| Batu/prop kecil | 50–400 | — | Palette |
| Debris | 50–300 | — | Palette |
Total budget per frame di [PERFORMANCE_BUDGET](PERFORMANCE_BUDGET.md).

## 6. Skala & dimensi
- 1 unit = 1 meter. Pemain 1.8 m. Cell building 1.5 m, tinggi dinding 2.4 m, pintu 1.0 × 2.1 m.
- Ketebalan foundation 0.35 m, freeboard (tinggi lantai rakit di atas air rata-rata) 0.25 m.

## 7. Bahasa bentuk
- **Material alami** (kayu, daun) = bentuk organik sedikit miring/tidak sempurna, ujung tumpul.
- **Material buatan** (logam, plastik) = bentuk lebih geometris, aksen warna.
- **Ancaman** (Reefjaw, Needlefin) = siluet bersudut, garis merah sebagai tanda bahaya yang konsisten.
- Interaktif = sedikit lebih terang/kontras dari lingkungan; highlight rim saat dibidik.

## 8. Ocean look
Gerstner waves berlapis, crest foam putih, gradient warna berdasar kedalaman & sudut pandang (fresnel), pantulan langit stylized (bukan cermin), sparkle specular matahari. Garis pantai: busa pecahan ombak di pinggir pulau (depth-based).

## 9. UI art
Flat, sudut membulat 6 px, panel semi-transparan gelap laut (`#0B2540` @ 80%), aksen pasir/kayu, font sans yang mudah dibaca (OFL, dipilih Phase 14; sementara system font). Ikon item: flat + outline gelap 2 px. Detail di [UI_UX_SPECIFICATION](UI_UX_SPECIFICATION.md).

## 10. Proses review visual
Setiap aset/scene baru di-screenshot pada 4 kondisi (siang, senja, malam, bawah air) di Asset Viewer dan dibandingkan dengan palet di atas sebelum dianggap final.

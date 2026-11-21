# Glossary — OceanSurvival

Istilah yang dipakai konsisten di dokumen dan kode (identifier kode memakai kolom "Kode").

## Istilah teknis
| Istilah | Kode | Arti |
|---|---|---|
| Authoritative server | — | Server memegang kebenaran state; client hanya mengirim input/intent |
| Input command | `InputCommand` | Input pemain untuk satu fixed step (1/60 s) dengan nomor urut `seq` |
| Intent | message `domain.action` | Permintaan aksi (mis. craft) yang divalidasi server |
| Prediction | `Predictor` | Client mensimulasikan gerak pemain lokal sebelum konfirmasi server |
| Reconciliation | `Reconciler` | Client menyelaraskan prediksi dengan state server lalu me-replay input |
| Interpolation | `Interpolator` | Menampilkan entity remote di masa lalu (100 ms) secara halus |
| Fixed timestep / tick | `FIXED_DT = 1/60` | Langkah simulasi berukuran tetap |
| Patch | — | Paket delta state Colyseus (20 Hz) |
| AOI (Area of Interest) | `StateView` | Hanya entity di dekat pemain yang dikirim |
| Frame (reference frame) | `frameId` | Ruang koordinat posisi: `world` atau id rakit (raft-local) |
| Floating origin | `FloatingOrigin` | Menggeser origin scene agar koordinat tetap kecil |
| Region / chunk | `RegionCoord` | Petak dunia 256 m untuk streaming & spawn |
| Snapshot | `WorldSnapshot` | Data world untuk disimpan (save) |
| Revision | `world_saves.revision` | Nomor urut save per world |
| Format version | `formatVersion` | Versi struktur save untuk migrasi |
| Transaction id | `txId` | ID unik operasi inventory untuk mencegah duplikasi |
| Placeholder | `placeholder: true` | Aset/kode sementara yang wajib diganti |

## Istilah game (nama kerja)
| Istilah | Kode | Arti |
|---|---|---|
| The Hushed Sea | — | Nama setting dunia |
| Long Tide | — | Peristiwa naiknya air laut (latar cerita) |
| Raft | `Raft` | Rakit milik world; kendaraan & markas |
| Building piece | `BuildingPieceDef` / `Piece` | Elemen bangunan (foundation, wall, …) |
| Foundation | `foundation_*` | Piece dasar di permukaan air; akar struktur |
| Debris | `Debris` | Benda hanyut yang dapat dikait |
| Grapple Line | `grapple_line` | Alat kait awal pemain |
| Builder's Mallet | `builders_mallet` | Alat membangun/demolish/repair |
| Salvage Bench | `salvage_bench` | Stasiun crafting T1–T2 |
| Survey Table | `survey_table` | Stasiun riset (Insight) |
| Insight | `insight` | Poin riset per kategori material |
| Blueprint | `BlueprintId` | Resep/piece yang dibuka lewat Insight |
| Solar Still | `solar_still` | Penyuling air tenaga matahari |
| Drip Catcher | `drip_catcher` | Penampung air hujan |
| Brazier | `brazier` | Tungku masak & rebus air |
| Wreck Bag | `wreck_bag` | Tas berisi item pemain yang mati |
| Downed | `mode: "downed"` | Pingsan, bisa ditolong teman |
| Reefjaw | `reefjaw` | Predator laut utama |
| Needlefin | `needlefin` | Ikan pengganggu penyelam |
| Shellback | `shellback` | Kepiting agresif di pulau |
| Beacon | `beacon` | Mercusuar; titik navigasi & progres cerita |
| The Last Atoll | — | Tujuan akhir v1.0 |
| World | `World` | Satu dunia tersimpan (seed, rakit, progres) |
| Owner / member | `role` | Pembuat world / pemain yang bergabung |

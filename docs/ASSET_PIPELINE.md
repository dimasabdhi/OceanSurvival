# Asset Pipeline & Licensing — OceanSurvival

Status: **Draft v1 (Phase 0)** · ADR: [0009](adr/0009-art-direction-stylized-lowpoly.md), [0010](adr/0010-asset-license-policy.md) · Gaya: [ART_DIRECTION](ART_DIRECTION.md)

## 1. Kebijakan lisensi
| Diterima | Syarat |
|---|---|
| `CC0-1.0` | Tidak wajib atribusi, tetap dicatat di manifest |
| `CC-BY-3.0`, `CC-BY-4.0` | Atribusi wajib di CREDITS.md + layar Credits in-game |
| `MIT`, `BSD-2-Clause`, `BSD-3-Clause` | Sertakan teks lisensi di `assets-src/raw/<asset>/LICENSE` |
| `OFL-1.1` | Khusus font |
| `Original` | Dibuat untuk project ini (pemilik: owner project) |

**Ditolak**: CC-BY-NC (non-commercial), CC-BY-ND (no derivatives), CC-BY-SA* (share-alike — butuh keputusan owner per kasus), "free for personal use", lisensi tidak tercantum, aset hasil rip/ekstrak dari game lain (termasuk Raft), aset yang menyerupai aset proprietary secara jelas. Aset AI-generated: **tidak dipakai** tanpa keputusan owner (status hukum & konsistensi gaya).

## 2. Sumber
| Sumber | Lisensi umum | Penggunaan | Catatan |
|---|---|---|---|
| Kenney (kenney.nl) | CC0 | Prop, UI icon dasar, audio UI | Gaya cocok low-poly |
| Quaternius (quaternius.com) | CC0 | Karakter, hewan, alam | Cek animasi rig |
| Poly Haven | CC0 | HDRI langit, beberapa tekstur noise | Tekstur PBR realistis **tidak** dipakai langsung (benturan gaya) |
| OpenGameArt | campuran | Audio/SFX tertentu | Cek lisensi per file, simpan screenshot halaman lisensi |
| Freesound | campuran | SFX | Hanya CC0/CC-BY |
| Procedural (kode) | Original | Ocean, sky, terrain pulau, rope, debris sederhana | Prioritas untuk elemen inti |
| Blender (buatan sendiri) | Original | Piece building, tool, stasiun, Reefjaw | Mengikuti art bible |

Urutan bila aset tidak tersedia: (1) alternatif legal, (2) procedural geometry, (3) model sederhana Blender, (4) commission/buatan sendiri.

## 3. Struktur folder
```
assets-src/
  blend/<category>/<asset>.blend        sumber Blender (Original)
  raw/<source>/<asset>/                 download asli + LICENSE + source.txt (URL, tanggal)
assets/
  models/<category>/<asset>.glb         runtime (teroptimasi)
  textures/<category>/<name>.ktx2
  audio/<category>/<name>.ogg           (+ .mp3 fallback bila perlu)
  icons/items/<itemId>.webp             128×128
  hdri/<name>.ktx2 | .hdr
  manifest.json
```
Penamaan: `snake_case`, English, tanpa spasi. ID aset = path tanpa ekstensi (`models/building/foundation_plank`).

## 4. Manifest (`assets/manifest.json`)
Setiap file di `assets/` wajib punya entri. Schema entri:
```jsonc
{
  "id": "models/building/foundation_plank",
  "name": "Plank Foundation",
  "category": "model",                // model | texture | audio | icon | hdri | font | vfx
  "file": "models/building/foundation_plank.glb",
  "format": "glb",
  "source": { "type": "original" },   // atau { "type": "third_party", "url": "...", "author": "...", "retrievedAt": "2026-12-01" }
  "license": "Original",              // salah satu acceptedLicenses
  "attribution": null,                // string wajib bila CC-BY
  "modified": false,                  // true bila aset pihak ketiga diubah
  "bytes": 48213,
  "stats": { "triangles": 640, "materials": 1, "textures": 0, "maxTextureSize": 0 },
  "usage": ["building piece: foundation tier plank"],
  "placeholder": false,
  "notes": ""
}
```
`tools/validate-assets` (Phase 1) memeriksa: semua file punya entri & sebaliknya, lisensi diterima, atribusi ada untuk CC-BY, `bytes` & `stats` sesuai file, budget per kategori tidak dilanggar, `placeholder: true` dilaporkan sebagai warning. `tools/gen-credits` menghasilkan CREDITS.md.

## 5. Workflow model
1. **Blockout** di Blender sesuai skala (1 unit = 1 m, Y-up saat export, origin di dasar/pivot fungsional).
2. Modeling low-poly sesuai budget ([ART_DIRECTION §5](ART_DIRECTION.md#5-budget-geometri--tekstur)); UV ke **palette atlas** bersama (lihat ART_DIRECTION) bila memungkinkan → 1 material per aset.
3. Export glTF 2.0 binary (`.glb`): apply transforms, +Y up, tanpa kamera/lampu, nama mesh/material English.
4. Optimasi (script Phase 1 memakai **glTF-Transform** CLI — versi di-pin saat diadopsi): `dedup`, `prune`, `weld`, `quantize`, kompresi **Meshopt**; tekstur → **KTX2** (ETC1S untuk albedo, UASTC untuk normal bila dipakai).
5. `pnpm validate:assets` → update manifest → commit.
6. Uji tampil di **Asset Viewer** debug scene (Phase 1) di bawah lighting siang & malam.

## 6. Animasi
- Rig karakter pemain: humanoid sederhana (≤ 30 tulang); clip: idle, walk, run, jump, swim, swim_idle, throw_charge, throw, reel, hit, downed, use. Viewmodel first-person (tangan + tool) terpisah dari model 3rd-person.
- Creature: clip swim, attack, hurt, retreat. Ikan kecil: animasi vertex shader (tanpa skinning) untuk performa.
- Format: animasi di dalam GLB, nama clip English konsisten; diputar via `AnimationMixer`, mixer di-pool.

## 7. Audio
- Format runtime: **OGG Vorbis** (Chrome/Edge mendukung), 44.1 kHz; SFX mono, ambience/music stereo.
- Loudness target: SFX −16 LUFS short-term peak normalisasi, ambience −23 LUFS; dinormalisasi sebelum masuk manifest.
- Kategori bus: master, music, ambience, sfx, ui, voice (tidak ada voice v1).

## 8. UI icons & VFX
- Ikon item 128×128 WebP, gaya flat dengan outline gelap 2 px (konsisten), dibuat dari render model atau digambar.
- VFX: partikel ringan berbasis `Points`/instanced quads (percikan, busa hook, debu kayu, darah stylized = splash gelap, bukan realistis). Tekstur sprite di atlas 1024².

## 9. Placeholder policy
Placeholder diperbolehkan **hanya** bila: ditandai `placeholder: true` di manifest, memakai warna magenta/abu-abu yang jelas atau primitive, tercantum di completion report phase sebagai "belum final". Tidak boleh membuat ratusan placeholder sekaligus; buat seperlunya per phase.

## 10. Git & ukuran repo
- Git LFS **belum** diaktifkan. Diputuskan saat batch aset pertama (> 50 MB total biner atau file > 10 MB) — lihat RISK_REGISTER R7.
- `assets-src/raw` dapat berisi file besar; bila LFS tidak dipakai, raw download besar disimpan di luar repo dengan `source.txt` berisi URL & hash.

## 11. Checklist penerimaan aset
- [ ] Lisensi diterima & tercatat · [ ] Atribusi (bila perlu) · [ ] Skala & pivot benar · [ ] Dalam budget tris/tekstur · [ ] Palet sesuai art bible · [ ] Tampil benar siang/malam & di bawah air · [ ] `validate-assets` lulus

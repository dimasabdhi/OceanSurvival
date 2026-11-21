# ADR-0010: Kebijakan lisensi aset & manifest wajib

- **Status**: Accepted
- **Tanggal**: 2026-11-21
- **Terkait**: [ASSET_PIPELINE §1](../ASSET_PIPELINE.md#1-kebijakan-lisensi)

## Konteks
Project tidak boleh memakai aset proprietary (termasuk dari Raft) dan setiap aset pihak ketiga harus jelas lisensinya, sumbernya, dan atribusinya.

## Keputusan
- Lisensi diterima: CC0-1.0, CC-BY-3.0/4.0, MIT, BSD-2/3-Clause, OFL-1.1 (font), Original.
- Ditolak: NC, ND, "personal use", tanpa lisensi, rip game lain. CC-BY-SA dan aset AI-generated hanya dengan keputusan owner per kasus.
- Setiap file di `assets/` wajib punya entri `assets/manifest.json` (sumber, author, lisensi, atribusi, path, format, ukuran, stats, penggunaan, flag placeholder); `tools/validate-assets` memblokir pelanggaran; CREDITS.md di-generate.
- File download asli + teks lisensi disimpan di `assets-src/raw/<source>/<asset>/`.

## Konsekuensi
Sedikit overhead per aset, tetapi audit lisensi selalu siap dan atribusi tidak terlupa.

## Validasi
`pnpm validate:assets` sebagai gate di setiap phase mulai Phase 1.

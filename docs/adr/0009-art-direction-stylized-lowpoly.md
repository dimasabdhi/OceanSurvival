# ADR-0009: Art direction stylized low-poly

- **Status**: Accepted (keputusan owner)
- **Tanggal**: 2026-11-21
- **Terkait**: [ART_DIRECTION](../ART_DIRECTION.md), [ASSET_PIPELINE](../ASSET_PIPELINE.md)

## Konteks
Visual harus konsisten, ringan di browser, dan dapat diproduksi tim kecil. Sumber aset CC0 utama (Kenney, Quaternius) bergaya low-poly.

## Keputusan
Gaya **stylized low-poly**: flat/gradient shading, palette atlas bersama, lighting & fog atmosferik sebagai sumber mood; ocean shader stylized. Tekstur PBR foto-realistis tidak dipakai langsung.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| Stylized semi-realistic (PBR) | Aset berat, konsistensi sulit, butuh lebih banyak kerja Blender |
| Realistis | Tidak realistis untuk tim kecil & budget browser |

## Konsekuensi
- Positif: performa baik (palette atlas → sedikit material → instancing), aset CC0 cocok, produksi Blender cepat.
- Negatif: kualitas visual bergantung pada lighting/shader → investasi di ocean, sky, fog.

## Validasi
Review visual 4 kondisi lighting tiap aset; art pass Phase 14.

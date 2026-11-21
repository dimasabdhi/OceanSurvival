# ADR-0008: Preact + signals untuk UI DOM

- **Status**: Accepted
- **Tanggal**: 2026-11-21
- **Terkait**: [UI_UX_SPECIFICATION](../UI_UX_SPECIFICATION.md)

## Konteks
UI mencakup menu, lobby, inventory drag-and-drop, crafting, research tree, station UI, settings, HUD. Owner bertanya apakah perlu framework UI atau cukup DOM/CSS + TypeScript.

## Keputusan
- **Preact 11.2.0 + @preact/signals 2.11.4**, JSX via TS, CSS biasa (CSS modules / file per komponen; tanpa framework CSS).
- UI di-overlay di atas canvas; state dari store signals yang diisi `net/`; aksi lewat `GameActions`.
- HUD yang berubah cepat (vital, crosshair) di-update via signals dengan throttle ≤ 10 Hz; tidak ada render Preact per frame.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| Vanilla DOM + TS | Inventory/crafting/research akan memerlukan sistem komponen & state buatan sendiri |
| React | Lebih besar (~40 KB+), fitur ekstra tidak dibutuhkan |
| Svelte / Solid | Valid, tetapi menambah compiler/plugin khusus; Preact cukup dan sederhana |
| UI di dalam WebGL | Aksesibilitas & teks lebih sulit, effort tinggi |

## Konsekuensi
Bundle UI kecil; komponen mudah diuji. Harus disiplin memisahkan UI dari render loop.

## Validasi
Phase 1: overlay + pointer lock; Phase 6: inventory drag & drop tanpa drop FPS (> 1 ms frame time tambahan saat UI terbuka diukur).

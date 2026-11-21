# ADR-0002: Three.js WebGLRenderer (WebGL 2) sebagai baseline; WebGPU ditunda

- **Status**: Accepted
- **Tanggal**: 2026-11-21
- **Terkait**: [TECHNICAL_ARCHITECTURE §5](../TECHNICAL_ARCHITECTURE.md#5-rendering), [PERFORMANCE_BUDGET](../PERFORMANCE_BUDGET.md)

## Konteks
three 0.187.0 (r187, rilis 2026-10-30) menyediakan `WebGLRenderer` dan `WebGPURenderer` (`three/webgpu`, TSL di `three/tsl`). Penelusuran migration guide (dibaca 2026-11-21): WebGL1 dihapus sejak r163; WebGLRenderer masih aktif dipelihara (tidak ada deprecation); node material/TSL secara historis terikat ke WebGPURenderer; fallback otomatis WebGPU→WebGL2 **belum terverifikasi** dari dokumentasi resmi (halaman terkait 404 saat dicek).

## Keputusan
- Renderer: **`THREE.WebGLRenderer` dengan WebGL 2 wajib**.
- Shader custom (ocean, sky, foam, underwater) ditulis **GLSL `ShaderMaterial`/`onBeforeCompile`**, bukan TSL.
- Lapisan `apps/client/src/render/` mengabstraksi renderer agar migrasi WebGPU di masa depan tidak menyentuh gameplay.
- Evaluasi WebGPU dibuka ulang bila: (a) ada kebutuhan nyata (compute ocean FFT, GPU particles besar) **dan** (b) fallback WebGL2 resmi terbukti di Chrome & Edge.
- Perhatian migrasi r170–r187: `Timer` menggantikan `Clock` (deprecated r183; panggil `timer.connect(document)`), PCFSoftShadowMap dihapus untuk WebGL (r186), rename API color space (r177), `WaterMesh.resolution` → `resolutionScale` (r181), PMREM memakai cube render target (r187).

## Alternatif
| Opsi | Alasan ditolak (untuk sekarang) |
|---|---|
| WebGPURenderer + TSL | Fallback & stabilitas belum terverifikasi; risiko tambahan tanpa kebutuhan terukur |
| Babylon.js / PlayCanvas | Stack owner menetapkan Three.js; ekosistem & kontrol low-level Three.js cocok untuk shader ocean custom |

## Konsekuensi
- Positif: dukungan browser luas, API matang, banyak referensi.
- Negatif: tidak memakai compute shader; ocean memakai Gerstner analitik, bukan FFT.

## Validasi
Phase 1: `?bench=ocean` ≥ 60 FPS di reference PC (preset High).

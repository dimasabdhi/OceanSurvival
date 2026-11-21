# ADR-0003: Rapier compat di client dan server dengan versi identik

- **Status**: Accepted
- **Tanggal**: 2026-11-21
- **Terkait**: [ADR-0005](0005-server-authoritative-movement.md), [RISK_REGISTER R2](../RISK_REGISTER.md)

## Konteks
Movement server-authoritative dengan client prediction membutuhkan collision & character controller yang **sama** di client dan server. Fakta (2026-11-21):
- `@dimforge/rapier3d-compat` 0.21.0 (rilis 2026-09-25); 0.20.0 (2026-08-08); repo lama `dimforge/rapier.js` diarsipkan Juli 2026, binding pindah ke `dimforge/rapier/bindings/typescript` dan tetap rilis.
- Varian `-compat` meng-embed WASM sebagai base64 → bekerja dengan bundler apa pun dan di Node; membutuhkan `await RAPIER.init()`.
- Dokumentasi determinisme: build WASM deterministik lintas platform untuk versi & kondisi awal yang sama (hindari `Math.sin/cos` untuk setup scene).
- Breaking 0.20/0.21: file compat pindah ke `dist/`, `SoftBodySet` ditambahkan pada signature `PhysicsPipeline.step`, `RigidBodySet.remove`, `ColliderSet.remove`, constructor `World`; `solverContactFriction` → `friction()`.
- `KinematicCharacterController` tersedia (`world.createCharacterController(offset)`, autostep, snap-to-ground, slope).

## Keputusan
- Pakai **`@dimforge/rapier3d-compat` 0.21.0**, versi **exact & identik** di client dan server (satu deklarasi via catalog/override pnpm).
- Akses Rapier hanya lewat wrapper `physics/` (client & server) + adapter di `packages/shared/movement` → perubahan API terisolasi.
- Debris & creature tidak memakai rigid body dinamis (buoyancy/steering analitik) untuk biaya CPU rendah.
- Determinism test (hash state setelah N step) wajib di Node & Chrome.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| `@dimforge/rapier3d` (non-compat, wasm file terpisah) | Butuh plugin wasm di Vite & penanganan berbeda di Node; compat lebih sederhana di dua sisi |
| cannon-es / ammo.js | Tidak deterministik lintas platform / tidak aktif / lebih lambat |
| Physics hanya di client | Bertentangan dengan server-authoritative |
| Collision buatan sendiri | Biaya tinggi, risiko bug |

## Konsekuensi
- Positif: satu engine fisika, prediksi akurat.
- Negatif: ukuran bundle client bertambah (WASM base64, ±1–2 MB sebelum kompresi) — diukur di Phase 1.
- Risiko: perubahan API saat upgrade → upgrade hanya terencana dengan membaca CHANGELOG.

## Validasi
Phase 1 spike: init + 600 step di Node 24 & Chrome, hash identik. Node support belum dinyatakan eksplisit di README resmi → **dibuktikan oleh spike**.

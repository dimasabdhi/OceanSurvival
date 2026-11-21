# Architecture Decision Records

ADR mencatat keputusan arsitektur penting: konteks, keputusan, alternatif, konsekuensi. ADR **Accepted** tidak diedit isinya; perubahan dibuat lewat ADR baru yang men-*supersede*.

Status: `Proposed` → `Accepted` → (`Superseded by ADR-XXXX` | `Deprecated`).
Template: [0000-template.md](0000-template.md).

| ADR | Judul | Status | Tanggal |
|---|---|---|---|
| [0001](0001-pnpm-monorepo.md) | pnpm monorepo dengan apps client/server dan package shared | Accepted | 2026-11-21 |
| [0002](0002-threejs-webgl2-renderer.md) | Three.js WebGLRenderer (WebGL 2) sebagai baseline; WebGPU ditunda | Accepted | 2026-11-21 |
| [0003](0003-rapier-physics-both-sides.md) | Rapier compat di client dan server dengan versi identik | Accepted | 2026-11-21 |
| [0004](0004-colyseus-018-authoritative-server.md) | Colyseus 0.18 authoritative server + schema builder + zod | Accepted | 2026-11-21 |
| [0005](0005-server-authoritative-movement.md) | Movement full server-authoritative dengan prediction & raft-local frame | Accepted | 2026-11-21 |
| [0006](0006-tick-and-replication-rates.md) | Tick & replication rates (60/20/10/2 Hz) | Accepted (angka dikunci setelah benchmark Phase 2–3) | 2026-11-21 |
| [0007](0007-persistence-strategy.md) | Persistence bertahap: file → PostgreSQL 18 + Kysely, snapshot hybrid | Accepted | 2026-11-21 |
| [0008](0008-preact-signals-ui.md) | Preact + signals untuk UI DOM | Accepted | 2026-11-21 |
| [0009](0009-art-direction-stylized-lowpoly.md) | Art direction stylized low-poly | Accepted | 2026-11-21 |
| [0010](0010-asset-license-policy.md) | Kebijakan lisensi aset & manifest wajib | Accepted | 2026-11-21 |
| [0011](0011-typescript-7.md) | TypeScript 7 dengan fallback | Accepted (bersyarat spike Phase 1) | 2026-11-21 |
| [0012](0012-tooling-biome-vitest-playwright.md) | Tooling: Biome, Vitest, Playwright, tsx | Accepted | 2026-11-21 |

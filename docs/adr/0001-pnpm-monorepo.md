# ADR-0001: pnpm monorepo dengan apps client/server dan package shared

- **Status**: Accepted
- **Tanggal**: 2026-11-21
- **Pengambil keputusan**: Owner (pnpm), Claude (struktur)
- **Terkait**: [TECHNICAL_ARCHITECTURE §4](../TECHNICAL_ARCHITECTURE.md#4-proposed-folder-structure)

## Konteks
Client (browser) dan server (Node) harus berbagi definisi protokol, data item/recipe/piece, fungsi movement & gelombang. Keduanya di-deploy terpisah. Node 24.13 + npm 11.6 terpasang; pnpm belum.

## Keputusan
- Monorepo **pnpm workspaces** (pnpm 12.21.0, di-pin lewat `packageManager` di root `package.json`).
- Layout: `apps/client` (Vite 8), `apps/server` (Colyseus), `packages/shared` (TypeScript murni, tanpa DOM/Node API).
- Dependency internal memakai `workspace:*`. Dependency eksternal **exact pin**.
- Build script dependency hanya untuk paket yang di-allowlist (`onlyBuiltDependencies`).
- Aturan import: client ↛ server, server ↛ client.

## Alternatif yang dipertimbangkan
| Opsi | Kelebihan | Kekurangan | Alasan ditolak |
|---|---|---|---|
| npm workspaces | Tanpa tool tambahan | Hoisting longgar (phantom deps), lebih lambat | Owner memilih pnpm |
| Repo terpisah client/server | Isolasi | Duplikasi tipe & data, sinkronisasi versi sulit | Bertentangan dengan kebutuhan kode shared |
| Turborepo/Nx | Cache build | Kompleksitas tambahan untuk 3 package | Belum perlu; dievaluasi bila build > 60 s |

## Konsekuensi
- Positif: satu sumber kebenaran untuk tipe/data; `pnpm -r` menjalankan test semua package.
- Negatif: owner harus memasang pnpm (didokumentasikan di DEV_SETUP_WINDOWS).
- Risiko: approval build script pnpm di Windows (R11) — dimitigasi allowlist.

## Validasi
Phase 1: `pnpm install` bersih di PC owner; `pnpm dev` menjalankan client+server.

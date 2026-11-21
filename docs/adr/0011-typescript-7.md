# ADR-0011: TypeScript 7 dengan fallback

- **Status**: Accepted (bersyarat hasil spike Phase 1)
- **Tanggal**: 2026-11-21
- **Terkait**: [RISK_REGISTER R6](../RISK_REGISTER.md)

## Konteks
`typescript` npm `latest` = 7.0.2 (compiler native, rilis 2026-07-08; `rc` 7.0.1-rc, `beta` 7.1.0-beta). Transpile kode dilakukan Vite (client) dan tsx (server dev) — TypeScript hanya untuk **typecheck**. `@colyseus/schema` 5.0.50 mendeklarasikan peer `typescript >=5.0.0` dan dikembangkan dengan TS 5.9.

## Keputusan
- Pakai **TypeScript 7.0.x** untuk `tsc --noEmit` (typecheck) di semua package, `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, module `ESNext`/`Bundler` resolution (client & shared), `NodeNext` (server).
- Tidak memakai decorator (lihat ADR-0004).
- **Fallback**: bila spike Phase 1 menemukan inkompatibilitas (types Colyseus/Three/Vitest, editor) yang tidak bisa diselesaikan dengan wajar, pin ke rilis TS 5.9.x/6.x terakhir yang stabil dan catat di ADR baru.

## Konsekuensi
Typecheck jauh lebih cepat; risiko kecil karena TS tidak ikut menghasilkan output runtime.

## Validasi
Phase 1: `pnpm typecheck` lintas package lulus, < 10 s.

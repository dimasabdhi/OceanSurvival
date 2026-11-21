# ADR-0012: Tooling — Biome, Vitest, Playwright, tsx

- **Status**: Accepted
- **Tanggal**: 2026-11-21
- **Terkait**: [TESTING_STRATEGY](../TESTING_STRATEGY.md)

## Konteks
Butuh lint/format, unit/integration test, E2E multi-browser, dan runner TS untuk server dev, dengan sesedikit mungkin tool untuk owner non-programmer.

## Keputusan
| Kebutuhan | Tool | Versi kandidat |
|---|---|---|
| Lint + format | `@biomejs/biome` | 2.6.8 |
| Unit & integration test | `vitest` (Node ^24 didukung) | 5.1.1 |
| E2E | `@playwright/test` (Chromium + channel `msedge`) | 1.65.1 |
| Server dev runner | `tsx` (watch mode) | 4.23.15 |
| Room integration | `@colyseus/testing` | diverifikasi Phase 1 |
| Script gabungan | `pnpm verify` = lint + typecheck + test + validate:assets | — |

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| ESLint 10 + Prettier | Dua tool & konfigurasi lebih banyak; Biome cukup untuk project TS ini |
| Jest | Integrasi Vite/ESM lebih lemah dibanding Vitest |
| Cypress | Multi-tab/multi-context lebih sulit dibanding Playwright |

## Konsekuensi
Konfigurasi minimal. Bila aturan lint tertentu (mis. import boundaries) tidak tersedia di Biome, dibuat test arsitektur kecil di Vitest yang memeriksa import.

## Validasi
Phase 1: `pnpm verify` berjalan < 60 s pada repo awal.

# Testing Strategy — OceanSurvival

Status: **Draft v1 (Phase 0)** · ADR: [0012](adr/0012-tooling-biome-vitest-playwright.md)

## 1. Prinsip
- Fitur **tidak selesai** sampai acceptance criteria terbukti dengan test otomatis (bila memungkinkan) **dan** prosedur manual tercatat.
- Logika gameplay ditulis sebagai fungsi/sistem yang bisa diuji tanpa browser dan tanpa jaringan (pure function + service dengan dependency injection).
- Bug → tulis test yang mereproduksi dulu, baru perbaiki.

## 2. Piramida test
| Level | Alat | Cakupan | Lokasi | Kapan dijalankan |
|---|---|---|---|---|
| Unit | Vitest 5 | `packages/shared` (data validation, inventory ops, recipe, grid placement, support graph, wave fn, PRNG, quantization, movement step), server systems dengan fake clock | `**/*.test.ts` di samping kode | Setiap perubahan (`pnpm test`) |
| Property / fuzz | Vitest + generator sederhana (fast-check bila diadopsi, versi di-pin) | Invariant inventory (jumlah item kekal), placement tidak tumpang tindih, determinism movement | `*.prop.test.ts` | `pnpm test` |
| Integration (server) | Vitest + `@colyseus/testing` (diverifikasi Phase 1) | Room lifecycle, join/auth, message validation, reconnection, save/load roundtrip | `apps/server/test/` | `pnpm test` |
| Determinism | Vitest (Node) + Playwright (browser) | `stepMovement` + Rapier menghasilkan hash state sama di Node & Chrome untuk input identik | `tests/determinism/` | Per phase yang menyentuh movement/physics |
| E2E | Playwright 1.65 (Chromium + msedge channel) | 2–4 browser context: join, gerak, saling lihat, hook, inventory, reconnect | `tests/e2e/` | Sebelum menutup phase; `pnpm test:e2e` |
| Visual smoke | Playwright screenshot (toleransi tinggi) | Scene tidak hitam/crash, HUD tampil | `tests/e2e/visual/` | Per phase render |
| Performance | Bench scene + bot load test | Lihat [PERFORMANCE_BUDGET §7](PERFORMANCE_BUDGET.md#7-prosedur-benchmark-dipakai-mulai-phase-1) | `tools/bench/` | Per checkpoint |
| Manual QA | Checklist | Feel, visual, audio, UX | `docs/reports/PHASE_XX_REPORT.md` | Akhir phase |

## 3. Target cakupan
- `packages/shared`: ≥ 85% line coverage, 100% untuk modul inventory/crafting/grid validation.
- Server systems: ≥ 70%.
- Client: fokus pada `net/` (reconciler, interpolator, clock) ≥ 70%; render diuji via smoke/visual, bukan coverage.

## 4. Test khusus multiplayer
| Skenario | Metode |
|---|---|
| 4 pemain join/leave berulang 100× | Bot Node (`@colyseus/sdk`) |
| Disconnect 10 s → reconnect, state utuh | Integration (`room.leave(false)` simulasi drop) + E2E (offline network context) |
| RTT 150 ms + jitter 30 ms | `tools/netsim` proxy + Playwright |
| Dua pemain mengambil item yang sama di tick yang sama | Integration: hanya satu sukses, total item kekal |
| Double-send `inventory.move` dengan `txId` sama | Integration: hanya diproses sekali |
| Payload invalid / flood | Integration: disconnect 4002 / rate limit aktif |
| Save → restart server → load | Integration (file driver, lalu postgres) |

## 5. Fixture & data
- Seed tetap untuk test (`TEST_SEED = 1337`), fake `WorldClock` yang dapat dimajukan manual.
- Fixture save tiap `formatVersion` disimpan di `apps/server/test/fixtures/saves/` untuk test migrasi.
- PostgreSQL test: database terpisah `oceansurvival_test` di container yang sama; di-reset per suite.

## 6. Prosedur manual (template untuk tiap phase)
```
Pra-syarat: pnpm install, pnpm dev, browser Chrome & Edge
Langkah:    1) … 2) …
Expected:   …
Hasil:      PASS/FAIL + catatan + screenshot/video bila perlu
Lingkungan: OS, browser+versi, preset, jumlah pemain, RTT
```

## 7. Gates (definisi hijau)
`pnpm lint` ✔ · `pnpm typecheck` ✔ · `pnpm test` ✔ · `pnpm validate:assets` ✔ · E2E phase ✔ · benchmark checkpoint tercatat · prosedur manual PASS · known limitations tertulis.
Continuous integration (GitHub Actions) ditambahkan saat repo punya remote (keputusan owner) — sementara gate dijalankan lokal lewat `pnpm verify` (Phase 1).

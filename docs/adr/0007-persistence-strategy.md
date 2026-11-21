# ADR-0007: Persistence bertahap — file → PostgreSQL 18 + Kysely, snapshot hybrid

- **Status**: Accepted (Docker Compose: keputusan owner)
- **Tanggal**: 2026-11-21
- **Terkait**: [DATABASE_DESIGN](../DATABASE_DESIGN.md)

## Konteks
World harus persisten dan bisa dilanjutkan. Bentuk data gameplay akan sering berubah selama Phase 2–7. PC owner punya PostgreSQL 18.3 native (:5432) dan Docker 29.5.3.

## Keputusan
1. Interface `WorldRepository` sejak Phase 2. Implementasi `FileWorldRepository` (JSON, dev) untuk Phase 2–7; `PostgresWorldRepository` di **Phase 8**.
2. PostgreSQL 18 di **Docker Compose**, port host `127.0.0.1:5433`, volume bernama.
3. Model **hybrid**: tabel relasional (players, worlds, world_members, world_saves) + **snapshot world JSONB berversi** (`formatVersion`) dengan retensi multi-revisi.
4. Query builder **Kysely 0.29.x** + driver **pg 8.23.x**; DDL via Kysely Migrator.
5. Save atomik dalam satu transaksi; advisory lock per world.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| PostgreSQL sejak Phase 1 | Migrasi schema berulang selama data belum stabil |
| Normalisasi penuh (tabel per piece/slot) | Banyak tabel & query tanpa kebutuhan query lintas world; snapshot cukup |
| SQLite | Kurang cocok untuk hosting multi-proses nanti; stack owner PostgreSQL |
| Prisma / Drizzle | Prisma: engine tambahan & codegen; Drizzle (0.45.x) valid, tetapi Kysely lebih dekat ke SQL eksplisit dan migrator sederhana |
| PostgreSQL native owner | Owner memilih Docker (isolasi, reproducible, mirip deploy) |

## Konsekuensi
- Positif: iterasi cepat di awal; integritas transaksi di akhir; backup mudah.
- Negatif: query analitik isi world (mis. "semua rakit dengan Smelter") tidak efisien — tidak dibutuhkan.
- Risiko: R8 (format save) — migrasi + fixture test.

## Validasi
AC Phase 8: roundtrip save/load, kill-test, migrasi up/down, uji backup-restore.

# Database & Persistence Design — OceanSurvival

Status: **Draft v1 (Phase 0)** · ADR: [0007](adr/0007-persistence-strategy.md)

## 1. Strategi bertahap
| Phase | Driver | Alasan |
|---|---|---|
| 1 | — (tidak ada persistence) | Spike teknis |
| 2–7 | `FileWorldRepository` — JSON per world di `DEV_SAVE_DIR` (git-ignored) | Bentuk data masih berubah; tetap melatih jalur save/load & `formatVersion` |
| 8+ | `PostgresWorldRepository` — PostgreSQL 18 (Docker Compose :5433) via Kysely + pg | Integritas transaksi, multi-world, backup, siap hosting |

Semua driver mengimplementasikan interface yang sama sehingga gameplay tidak berubah:
```ts
interface WorldRepository {
  createWorld(input: CreateWorldInput): Promise<WorldMeta>;
  listWorldsForPlayer(playerId: PlayerId): Promise<WorldMeta[]>;
  loadWorld(worldId: WorldId): Promise<WorldSnapshot | null>;
  saveWorld(worldId: WorldId, snapshot: WorldSnapshot, members: MemberRecord[]): Promise<SaveResult>; // atomic
  getOrCreatePlayer(playerId: PlayerId, tokenHash: string, displayName: string): Promise<PlayerRecord>;
  loadMember(worldId: WorldId, playerId: PlayerId): Promise<MemberRecord | null>;
}
```

## 2. Apa yang disimpan & tidak
| Disimpan | Tidak disimpan (diregenerasi) |
|---|---|
| Rakit (posisi, heading, pieces + HP), stasiun & isinya, container | Debris hanyut (spawn ulang) |
| Inventory, hotbar, equipment, vitals, posisi (frame) per pemain | Creature (spawn ulang dari aturan; Reefjaw cooldown disimpan) |
| World progress: insight, blueprint, beacons, waktu & cuaca | Terrain pulau (dari seed) |
| Delta resource node pulau (dipanen + respawn timer), loot crate dibuka | Hook aktif, efek visual |
| Dropped items di rakit (bukan di air) | State koneksi |

## 3. Skema relasional (PostgreSQL, Phase 8)
```sql
CREATE TABLE players (
  id            text PRIMARY KEY,               -- nanoid dari client (divalidasi format)
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 24),
  token_hash    text NOT NULL,                  -- SHA-256(token + server pepper); token asli tidak pernah disimpan
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE worlds (
  id              text PRIMARY KEY,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  seed            bigint NOT NULL,
  join_code       text NOT NULL UNIQUE,         -- 6–8 char, untuk undangan
  password_hash   text,                         -- argon2id/scrypt; NULL = tanpa password
  owner_player_id text NOT NULL REFERENCES players(id),
  settings        jsonb NOT NULL,               -- mode (calm/normal/harsh), maxPlayers, dll.
  current_revision integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_played_at  timestamptz
);

CREATE TABLE world_members (
  world_id    text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  player_id   text NOT NULL REFERENCES players(id),
  role        text NOT NULL CHECK (role IN ('owner','member','banned')),
  state       jsonb NOT NULL,                   -- {formatVersion, inventory, hotbar, equipment, vitals, position}
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (world_id, player_id)
);

CREATE TABLE world_saves (
  world_id        text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  revision        integer NOT NULL,
  format_version  integer NOT NULL,
  saved_at        timestamptz NOT NULL DEFAULT now(),
  reason          text NOT NULL CHECK (reason IN ('autosave','empty','shutdown','manual')),
  byte_size       integer NOT NULL,
  data            jsonb NOT NULL,               -- WorldSnapshot
  PRIMARY KEY (world_id, revision)
);
CREATE INDEX world_members_player_idx ON world_members(player_id);
```
- Retensi: simpan **10 revisi terakhir** per world (+ 1 revisi per hari selama 7 hari) — pembersihan oleh job setelah save.
- `worlds.current_revision` menunjuk save terbaru yang **berhasil**; load memakai revisi itu.

## 4. Format snapshot (`WorldSnapshot`)
```jsonc
{
  "formatVersion": 1,
  "worldTime": 12345.6,
  "weather": { "state": "breezy", "remaining": 220.0 },
  "rafts": [{ "id": "r_x1", "x": 0, "z": 0, "heading": 1.57, "anchor": false,
              "pieces": [{ "key": "0:0:0:cell", "pieceId": "foundation_plank", "rot": 0, "hp": 120 }] }],
  "stations": [{ "id": "st_1", "type": "brazier", "raftId": "r_x1", "pieceKey": "1:0:0:cell", "slots": [] }],
  "containers": [{ "id": "c_1", "slots": [{ "itemId": "plank", "qty": 12 }] }],
  "progress": { "insight": { "wood": 3 }, "unlocked": ["salvage_bench"], "beaconsLit": 0 },
  "islandDeltas": { "isl_3_-2": { "harvested": { "12": 1712345678 }, "lootOpened": [3] } },
  "creatures": { "reefjawCooldownUntil": 12400.0 }
}
```
- Divalidasi zod saat load. **Migrasi format**: fungsi `migrations[n]: (v_n) => v_{n+1}` di `apps/server/src/persistence/saveMigrations.ts`, dijalankan berurutan saat load; tiap migrasi punya unit test dengan fixture save lama.

## 5. Alur save
1. Trigger: autosave tiap `AUTOSAVE_INTERVAL_SECONDS` (120), room kosong, `onBeforeShutdown`, perintah owner (manual).
2. Simulasi membuat snapshot **di antara tick** (konsisten, tidak di tengah step) — serialisasi ≤ 5 ms target; bila lebih, snapshot diambil sebagai struktur immutable lalu di-serialize async.
3. Satu transaksi DB: insert `world_saves (revision+1)` + upsert semua `world_members` yang online/berubah + update `worlds.current_revision`. Gagal → rollback, retry dengan backoff (3×), status `save.status {ok:false}` ke owner.
4. Client menampilkan ikon save (lihat UI spec).

## 6. Integritas
- Hanya server yang mengakses DB; kredensial di `.env`; user DB aplikasi **bukan superuser** (hanya CRUD di schema `public` project).
- Transaksi inventory terjadi di memori server (authoritative) dan dipersist sebagai snapshot → tidak ada race antar request DB.
- Satu world hanya boleh dibuka oleh **satu** WorldRoom: lock via `pg_try_advisory_lock(hash(worldId))` saat room dibuat (Phase 8).

## 7. Migrations (DDL)
- Kysely `Migrator` + `FileMigrationProvider`; file `apps/server/migrations/NNNN_description.ts` dengan `up`/`down`.
- Perintah (Phase 8): `pnpm --filter server db:migrate`, `db:rollback`, `db:status`.
- Migrasi tidak boleh destruktif tanpa langkah backup otomatis sebelumnya.

## 8. Docker Compose (Phase 8, `infra/docker-compose.yml`)
- Image `postgres:18` (tag exact minor dipilih saat Phase 8), port `127.0.0.1:5433:5432` (hanya localhost), volume bernama `oceansurvival_pgdata`, env dari `.env`.
- Healthcheck `pg_isready`.

## 9. Backup & restore
| Aksi | Perintah (PowerShell, Phase 8) |
|---|---|
| Backup | `infra/backup.ps1` → `docker compose exec db pg_dump -Fc` → `backups/oceansurvival_YYYYMMDD_HHmm.dump` |
| Restore | `infra/restore.ps1 -File <dump>` → `pg_restore --clean --if-exists` (konfirmasi interaktif) |
| Export 1 world | `pnpm --filter server world:export <worldId>` → JSON snapshot |
| Import 1 world | `pnpm --filter server world:import <file>` |
Backup diuji **restore** minimal sekali per milestone (bukan hanya dibuat).

## 10. Estimasi ukuran
Rakit 400 piece × ~60 byte + 40 container × 40 slot × ~30 byte + progress ≈ 80–150 KB JSON per revisi; 11 revisi × 10 world ≈ < 20 MB. Aman untuk JSONB.

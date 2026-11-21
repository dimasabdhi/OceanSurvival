# ADR-0013: Gunakan netcode bawaan Colyseus 0.18 untuk prediction & reconciliation

- **Status**: Accepted (disetujui owner 2026-11-21; bukti perilaku dengan Rapier & rakit di AC Phase 2–3)
- **Tanggal**: 2026-11-21
- **Terkait**: [ADR-0005](0005-server-authoritative-movement.md) (tetap berlaku), [ADR-0004](0004-colyseus-018-authoritative-server.md), [MULTIPLAYER_DESIGN §5](../MULTIPLAYER_DESIGN.md#5-movement-prediction--reconciliation-adr-0005)

## Konteks
ADR-0005 memutuskan movement **full server-authoritative** dengan client prediction & reconciliation. Saat Phase 0, rencananya adalah menulis sendiri input queue, ack `lastProcessedSeq`, history & replay. Saat membaca dokumentasi resmi untuk Phase 1 (`docs.colyseus.io/netcode*.md`, 2026-11-21), ternyata Colyseus 0.18 sudah menyediakan seluruh mekanisme itu:
- Server: `defineInput(schema, { bufferMaxSize, sanitize, idle })` (buffer input per client, sanitasi nilai NaN/out-of-range), `setFixedTimestep(step, tickRate, { subSteps })` (fixed step yang di-*advertise* ke client), `allowRewindState()` + `rewind.lastSeenBy()` (lag compensation).
- Client (`@colyseus/sdk`): `room.input()` (delta-encoded per step), `room.clock` (RTT, server time, render time), `Predict` / `predict.reconciler` / `predict.sim` (rollback + replay + smoothing; mendukung handle engine fisika seperti Rapier), interpolasi remote (`lerp`) dan dead reckoning.
- Dokumen "Determinism & The Contract": satu step function bersama, satu input per fixed step, dt identik.

Spike Phase 1 (`apps/server/src/rooms/SpikeRoom.ts`, test `apps/server/test/spikeRoom.test.ts`) membuktikan sisi server: `defineInput` + `sanitize` menjepit input speed-hack (`moveZ = -127` → `-1`), dan posisi hanya berubah dari input yang dikonsumsi `setFixedTimestep`.

## Keputusan (usulan)
Implementasi ADR-0005 memakai **primitive netcode bawaan Colyseus 0.18**, bukan sistem buatan sendiri:
- Server: `defineInput` + `sanitize` + `setFixedTimestep(…, 60)` (atau 30 Hz input + `subSteps: 2` bila benchmark Phase 2 menunjukkan bandwidth/CPU lebih baik — keputusan diukur, bukan ditebak).
- Client: `predict.sim` dengan world Rapier untuk pemain lokal; `Predict` lerp untuk pemain lain; `room.clock` untuk sinkronisasi waktu dunia (ocean, day/night).
- Lag compensation (Phase 10): `allowRewindState` + `rewind.lastSeenBy`.
- Kode langkah movement tetap di `packages/shared/movement` (dipanggil oleh server *dan* oleh `predict.sim`).
- Raft-local frame (ADR-0005) tetap: posisi pemain di rakit disimpan relatif rakit.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| Prediction & reconciliation buatan sendiri (rencana Phase 0) | Menduplikasi fitur framework yang sudah teruji; lebih banyak kode & bug potensial |
| Netcode library lain | Tidak terintegrasi dengan state sync & clock Colyseus |

## Konsekuensi
- Positif: kode jauh lebih sedikit, risiko R1 berkurang, clock sync & RTT tersedia gratis.
- Negatif: lebih terikat ke API Colyseus 0.18 (API ini baru di 0.18); upgrade versi wajib membaca changelog.
- Perlu divalidasi: perilaku `predict.sim` dengan Rapier + platform bergerak (rakit) — inti spike Phase 2–3.

## Validasi
Phase 2: dua+ client, RTT simulasi 150 ms (`COLYSEUS_LATENCY` / `server.simulateLatency()`), koreksi rata-rata < 5 cm (AC Phase 2). Jika gagal setelah investigasi akar masalah, owner diminta memutuskan (kembali ke implementasi sendiri atau opsi lain).

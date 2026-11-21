# ADR-0004: Colyseus 0.18 authoritative server + schema builder + zod

- **Status**: Accepted
- **Tanggal**: 2026-11-21
- **Terkait**: [MULTIPLAYER_DESIGN](../MULTIPLAYER_DESIGN.md)

## Konteks
Dibutuhkan server game WebSocket dengan room, state sync delta, reconnection, dan validasi message. Fakta (npm & docs.colyseus.io, 2026-11-21):
- `colyseus` 0.18.12 (engine `node >= 22`), `@colyseus/sdk` 0.18.10 (pengganti `colyseus.js` sejak 0.17), `@colyseus/schema` 5.0.x (peer `^5.0.8`), `@colyseus/core` peer `zod ^4.1.12`.
- API 0.18: `defineServer`/`defineRoom`; lifecycle `onCreate/onAuth/onJoin/onDrop/onReconnect/onLeave(client, code)/onDispose/onBeforeShutdown`; `messages = { name: validate(z.object(...), handler) }` (invalid → disconnect 4002); `patchRate` default 50 ms; `setTimestep` (alias lama `setSimulationInterval`) dan `setFixedTimestep` untuk client-predicted games; `room.request()`; `StateView`; auto-reconnect di SDK (`room.reconnection`); `Callbacks.get(room)`.
- Schema v5: builder `schema({...}, "Name")` (tanpa compiler flag) atau decorator (butuh `experimentalDecorators` + `useDefineForClassFields:false`); maks 63 field per schema.
- **Tidak ada official coding-agent skill** Colyseus; sumber AI resmi: `https://docs.colyseus.io/llms.txt` dan halaman `.md`.

## Keputusan
- Server: **Colyseus 0.18** dengan `ws-transport` bawaan, satu proses untuk tahap LAN.
- State: **schema builder** (`schema()`), bukan decorator — menghindari flag compiler legacy (penting untuk TS 7 & transpiler Vite).
- Message: semua via `messages = {...}` + `validate(zodSchema)`; zod schema didefinisikan di `packages/shared/protocol` dan dipakai juga oleh client untuk tipe.
- Interest management & data privat: `StateView`.
- Monitor/Playground hanya `NODE_ENV=development`.
- API terlarang dicatat di CLAUDE.md.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| WebSocket mentah (`ws`) + protokol sendiri | Harus membangun room, delta sync, reconnection sendiri |
| geckos.io (WebRTC UDP) | Lebih kompleks (signaling, NAT), manfaat UDP kecil untuk co-op 4 pemain |
| Nakama / server non-Node | Bahasa/stack berbeda, tidak bisa berbagi kode TS shared |

## Konsekuensi
- Positif: room lifecycle, reconnection, delta state, validasi sudah tersedia.
- Negatif: terikat ke API Colyseus; perubahan versi minor pernah breaking (0.16→0.17→0.18).
- Mitigasi: lapisan `net/` server membungkus API Colyseus; pin exact.

## Validasi
Phase 1 spike (hello room, schema builder, validate, StateView) + integration test `@colyseus/testing` (ketersediaan & API diverifikasi saat itu).

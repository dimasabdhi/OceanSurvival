# ADR-0006: Tick & replication rates

- **Status**: Accepted — angka dikunci setelah benchmark Phase 2–3
- **Tanggal**: 2026-11-21
- **Terkait**: [MULTIPLAYER_DESIGN §4](../MULTIPLAYER_DESIGN.md#4-tick-strategy), [PERFORMANCE_BUDGET](../PERFORMANCE_BUDGET.md)

## Konteks
Prediction membutuhkan dt identik di client & server. Bandwidth target ≤ 64 kbps/client. Colyseus default patch 50 ms; timestep default 16.6 ms.

## Keputusan
| Loop | Rate |
|---|---|
| Simulation server (movement, hook, physics) | 60 Hz fixed (`FIXED_DT = 1/60`) |
| State patch | 20 Hz |
| Creature AI decision | 10 Hz |
| Survival vitals | 2 Hz |
| World/weather | 1 Hz |
| Client input send | 30 Hz (2 command/pesan) |
| StateView AOI update | 15 Hz (setiap 4 tick) |
| Remote interpolation delay | 100 ms (adaptif s/d 200 ms) |
Konstanta di `packages/shared/src/constants.ts`.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| Simulasi 30 Hz | Prediction kurang halus, jump/collision kasar; CPU hemat tapi tidak perlu untuk 4 pemain |
| Patch 30–60 Hz | Bandwidth 1.5–3× tanpa manfaat besar (interpolasi menutupi) |

## Konsekuensi
CPU server per room lebih tinggi daripada 30 Hz, masih jauh di bawah budget (target tick ≤ 2 ms). Dapat diturunkan bila benchmark menunjukkan perlu.

## Validasi
Bot load test Phase 2 (tick avg/p95, bandwidth) dan prediction error Phase 3.

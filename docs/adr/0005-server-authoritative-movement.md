# ADR-0005: Movement full server-authoritative dengan prediction & raft-local frame

- **Status**: Accepted (keputusan owner)
- **Tanggal**: 2026-11-21
- **Terkait**: [MULTIPLAYER_DESIGN §5](../MULTIPLAYER_DESIGN.md#5-movement-prediction--reconciliation-adr-0005), [ADR-0003](0003-rapier-physics-both-sides.md), [RISK_REGISTER R1](../RISK_REGISTER.md)

## Konteks
Owner memilih movement **full server-authoritative** (dibanding hybrid client-authoritative tervalidasi). Tantangan utama: pemain berdiri di atas rakit yang terus bergerak di atas ombak; prediction naif menimbulkan jitter/rubber-band.

## Keputusan
1. Client mengirim `InputCommand` per fixed step 1/60 s (batch 2 per pesan). Server satu-satunya yang menentukan posisi.
2. Client menjalankan **prediction** memakai `stepMovement()` dari `packages/shared/movement` + Rapier versi identik, menyimpan history, dan melakukan **reconciliation** (reset ke state server pada `lastProcessedSeq` + replay) bila error > 0.01 m; error kecil di-smooth visual 100 ms.
3. **Raft-local frame**: saat grounded pada collider rakit, posisi pemain disimpan relatif terhadap rakit (`frameId = raftId`). Gerak rakit dihitung terpisah secara deterministik dari `RaftMotion` + world time, sehingga prediction tidak perlu memprediksi rakit melalui fisika.
4. Server: ≤ 1 command per tick rata-rata, backlog maks 10, input kosong bila starvation > 3 tick.
5. Remote players: snapshot interpolation 100 ms.

## Alternatif
| Opsi | Alasan ditolak |
|---|---|
| Hybrid (client-authoritative + validasi server) | Lebih sederhana, tetapi owner memprioritaskan otoritas server penuh |
| Lockstep deterministik penuh | Tidak toleran latensi browser/WS; semua client harus menunggu yang paling lambat |
| Server-auth tanpa prediction | Input terasa lambat (≥ 1 RTT) |

## Konsekuensi
- Positif: anti-cheat movement kuat; posisi yang dipakai validasi hook/build/combat selalu benar.
- Negatif: kompleksitas tinggi (shared movement, replay, frame transition); CPU server menjalankan character controller tiap pemain 60 Hz.
- Risiko: R1 (jitter rakit) — spike wajib di Phase 2–3 sebelum fitur lain bergantung padanya. Jika ambang AC Phase 3 tidak tercapai setelah investigasi akar masalah, owner akan diminta memutuskan ulang (ADR baru), bukan diam-diam diubah.

## Validasi
AC Phase 2 & 3: koreksi rata-rata < 5 cm pada RTT 150 ms; tidak ada jitter terlihat di rakit 0.6 m/s; determinism test client vs server 10.000 command.

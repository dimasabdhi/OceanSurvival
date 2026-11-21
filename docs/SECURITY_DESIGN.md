# Security Design & Threat Model — OceanSurvival

Status: **Draft v1 (Phase 0)**. Konteks: game co-op antar teman; ancaman utama adalah **cheat/exploit oleh client yang dimodifikasi**, **gangguan oleh pihak luar yang mendapat link**, dan **kehilangan/korupsi data**. Bukan target bernilai finansial.

## 1. Aset yang dilindungi
| Aset | Mengapa penting |
|---|---|
| Integritas world (inventory, building, progress) | Inti nilai pemain; duplikasi item merusak game |
| Ketersediaan server | Sesi co-op terganggu |
| Save data & backup | Jam bermain pemain |
| Kredensial DB & secret server | Akses penuh data |
| Token pemain | Impersonasi di world |
| Mesin owner (development) | Server lokal tidak boleh membuka akses tak perlu |

## 2. Trust boundary
```
[Browser client — TIDAK dipercaya] ──WS──► [Game server — dipercaya] ──► [PostgreSQL — hanya server]
```
Semua yang datang dari client adalah **input tak dipercaya**, termasuk dari client resmi.

## 3. Threat model (STRIDE ringkas)
| # | Ancaman | Contoh | Mitigasi | Phase |
|---|---|---|---|---|
| T1 | Spoofing pemain | Memakai `playerId` orang lain | Token 32 byte acak per pemain, server simpan hash (SHA-256 + pepper); join gagal bila hash tidak cocok | 2/8 |
| T2 | Tampering movement | Speedhack, teleport, fly | Movement server-authoritative (ADR-0005); server memproses ≤ 1 cmd/tick, clamp input ke [-1,1] | 2–3 |
| T3 | Tampering inventory | Duplikasi lewat double-send, race transfer | Transaksi atomik serial di server, `txId` dedup (LRU 256 per pemain), invariant test, tidak ada `give` dari client | 6 |
| T4 | Tampering crafting/building | Craft tanpa bahan, build tanpa unlock/di luar jangkauan | Validasi resep, unlock, stasiun, jarak & LOS dengan posisi server; fungsi validasi shared tapi **server yang memutuskan** | 6–7 |
| T5 | Payload jahat | JSON besar, NaN/Infinity, string panjang, tipe salah | zod strict schema (`z.number().finite()`, batas panjang), `maxPayload` WS 16 KB, disconnect code 4002 | 2 |
| T6 | DoS ringan | Flood pesan, join spam | Rate limit token-bucket per message per client; batas koneksi per IP (8); seat reservation timeout bawaan Colyseus; `maxClients` | 2 |
| T7 | Information disclosure | Melihat inventory/posisi creature di luar jangkauan (wallhack) | `StateView`: inventory privat, AOI untuk entity | 4–6 |
| T8 | Elevation of privilege | Member melakukan aksi owner (kick, setting) | Role (`owner/member/banned`) diperiksa server untuk aksi admin | 8 |
| T9 | Injection | SQL injection via nama world/pemain | Kysely parameterized query; tidak ada SQL string concat; validasi panjang/karakter nama | 8 |
| T10 | XSS di UI | Nama pemain/chat berisi HTML | Preact escape default; larang `dangerouslySetInnerHTML`; sanitasi & batas karakter di server | 2/14 |
| T11 | Kebocoran secret | Password DB di repo | `.env` git-ignored, `.env.example` tanpa secret asli, config divalidasi saat start, tidak ada secret di bundle client (`VITE_*` hanya non-secret) | 1 |
| T12 | Korupsi/kehilangan data | Crash saat save, bug migrasi | Transaksi, revisi berganda, migrasi teruji, backup + uji restore | 8 |
| T13 | Eksposur server dev | Port terbuka ke internet | Bind `127.0.0.1`/IP LAN; tidak port-forward; Colyseus monitor/playground hanya development & localhost | 1 |
| T14 | Supply chain | Paket npm berbahaya | Versi exact + lockfile, pnpm build-script allowlist (`onlyBuiltDependencies`), `pnpm audit` per milestone, minimal dependency | 1 |
| T15 | Room joining tak sah | Orang asing tebak kode world | Kode 8 char (alfabet 32 → 2^40), password opsional, rate limit join gagal (5/menit per IP), owner bisa kick/ban | 8 |

## 4. Aturan implementasi
1. Setiap handler message: `validate(zodSchema)` → cek state pemain (hidup, tidak downed bila perlu) → cek rate → cek jarak/izin → mutasi.
2. Tidak ada `eval`, `new Function`, atau deserialisasi object arbitrer.
3. Angka dari client: `finite`, di-clamp, di-quantize.
4. Error ke client: pesan generik + kode alasan; detail hanya di log server.
5. Log keamanan: pelanggaran rate limit, payload invalid, aksi ditolak berulang → counter per pemain; ambang (mis. 50 pelanggaran/menit) → kick.
6. Dependency baru wajib alasan tertulis di commit/ADR.

## 5. Kebijakan jaringan per tahap
| Tahap | Kebijakan |
|---|---|
| Phase 1–15 (dev/LAN) | HTTP/WS tanpa TLS di LAN; bind 127.0.0.1 default, LAN IP bila uji multi-perangkat; firewall Windows hanya untuk profil Private |
| Phase 16 (internet) | TLS wajib (WSS) via reverse proxy, CORS origin allowlist, secret dari environment hosting, backup terjadwal, monitoring |

## 6. Checklist review keamanan per milestone
- [ ] Semua message baru punya zod schema & rate limit
- [ ] Tidak ada state penting yang diterima dari client
- [ ] Test anti-duplikasi/invariant untuk transaksi baru
- [ ] Tidak ada secret di repo (`git grep` pola password/token)
- [ ] `pnpm audit` tanpa high/critical yang relevan

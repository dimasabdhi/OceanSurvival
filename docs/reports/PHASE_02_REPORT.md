# Completion Report — Phase 2 (Multiplayer Foundation)

Tanggal: 2026-11-21 · Status: **Selesai secara teknis, menunggu uji manual & persetujuan owner** · Branch: `main`

## 1. Ringkasan
Sekarang 1–4 pemain bisa masuk ke dunia yang sama dari browser. Mereka bisa berjalan, lari, lompat, jatuh ke laut, berenang, dan melompat kembali ke dek uji, sambil saling melihat dan chat. Server yang menentukan posisi semua pemain; client hanya mengirim tombol yang ditekan. Supaya tetap terasa instan, client "menebak" gerakannya sendiri dengan kode yang **sama persis** dengan server.

Hasil terpenting:

| Pengukuran | Target (AC Phase 2) | Hasil |
|---|---|---|
| Koreksi prediksi pada ping 150 ms | rata-rata < 5 cm, tidak ada lompatan > 25 cm | **0 cm** (gerak lurus & campuran: lari, lompat, belok, jatuh ke air) |
| Kontrol: client yang sengaja salah | harus terdeteksi | dikoreksi rata-rata 93 cm → alat ukur terbukti bekerja |
| Tick server, 4 bot × 10 menit | avg ≤ 2 ms, p95 ≤ 5 ms | **avg 0,025 ms · p95 0,066 ms** (60 s terakhir) · maks 0,54 ms (seluruh 10 menit) |
| Bandwidth per pemain | ≤ 64 kbps | **7,4 kbps** (±540 KB per pemain per 10 menit) |
| 3 pemain di browser nyata (Chrome & Edge) | saling lihat bergerak | ✅ E2E, stabil 2× berturut-turut |

## 2. Apa yang dibuat
**Shared (`packages/shared`)**
- `movement/characterMovement.ts`: satu fungsi gerak `stepCharacter` untuk server & client. Memakai Rapier character controller sebagai mesin tabrakan, hasil dibulatkan ke float32 agar server dan client identik bit-per-bit. Nilai gerak (GDD): jalan 3,6 m/s, lari 5,6, renang 2,4, lompat ±1,1 m.
- `protocol/world.ts` (pesan & validasi zod), `state/worldState.ts` (state tersinkron), `world/testLevel.ts` (**PLACEHOLDER** dek uji 8 × 8 m + peti + anak tangga).

**Server (`apps/server`)**
- `WorldRoom`: satu room per dunia, input dikonsumsi 60 kali/detik (sistem kredit anti speed-hack), langkah idle saat client macet, reconnect 30 detik, sesi ganda ditutup, chat dengan rate limit.
- Identitas tamu (`auth/PlayerAuth.ts`): token rahasia, server hanya menyimpan hash.
- Penyimpanan (`persistence/`): interface `WorldRepository` dengan driver `memory` dan `file` (JSON atomik di `data/saves`). Disimpan otomatis tiap 120 detik, saat pemain keluar, dan saat server dimatikan.
- Metrik dev `GET /debug/metrics`: durasi tick, bandwidth per pemain.

**Client (`apps/client`)**
- Layar join (nama pemain), kamera orang pertama, crosshair, pemain lain sebagai **kapsul PLACEHOLDER** berwarna dengan nama, chat (Enter/T), banner "menyambung ulang", layar "terputus" dengan alasan jelas (tab lain, dunia penuh, server mati, jaringan).
- `net/WorldConnection.ts`: netcode bawaan Colyseus (ADR-0013). `player/InputSampler.ts`: keyboard & mouse.
- Tiap tab yang terbuka bersamaan otomatis menjadi pemain berbeda (Web Locks), jadi Anda bisa menguji multiplayer di satu PC.
- Overlay F3 kini menampilkan ping & "koreksi prediksi".

**Tools & test**
- `pnpm load-test` (bot), `?world=<id>` untuk dunia terpisah.
- Test baru: 7 movement, 10 WorldRoom, 6 penyimpanan file, 2 prediksi-latensi, 1 E2E multiplayer (Chrome+Edge).

## 3. Hasil pengujian
| Pemeriksaan | Hasil |
|---|---|
| `pnpm verify` | ✅ lint + typecheck + 42 test + aset |
| E2E Chrome 157 & Edge 158 | ✅ 8/8, dua kali berturut-turut |
| Prediksi vs server, RTT 150 ms (`tests/integration/prediction.test.ts`) | ✅ 0 cm koreksi; kontrol divergen 93 cm |
| Bot load test 4 × 10 menit (60 input/s/bot, jalan/lari/lompat acak) | ✅ tick avg 0,025 ms, p95 0,066 ms, maks 0,54 ms; 7,4 kbps/pemain; RAM server 132 MB |
| Penyimpanan file di server dev Anda | ✅ `data/saves/worlds/dev-world.json` ditulis & dimuat ulang |

## 4. Bug yang ditemukan & akar masalahnya
| Masalah | Akar masalah | Solusi |
|---|---|---|
| Pemain membeku di udara bila tidak mengirim input (tab di-minimize, baru join) | Server hanya mensimulasikan saat ada input | Bila client diam > 250 ms, server menjalankan langkah idle (gravitasi tetap jalan) tanpa mengganggu prediksi |
| **Dunia terbelah dua** saat penuh | Saat room penuh, `joinOrCreate` Colyseus membuat room **kedua** untuk world yang sama → pemain terpisah & dua room menimpa save yang sama | Satu world = satu room (`WORLD_FULL`), pemain ke-5 mendapat pesan "dunia penuh" |
| Dua tab di satu browser saling menendang | Identitas sama di localStorage → aturan satu sesi per pemain | Profil per tab via Web Locks (tab 1 tetap profil 1) |
| Test E2E gagal acak di run berikutnya | Test menutup browser tanpa keluar → pemain tertahan 30 s (grace) → dunia penuh | Test keluar dengan benar & memakai dunia `e2e` sendiri |
| Auto-reconnect tidak terjadi di test | SDK tidak reconnect bila koneksi < 5 s (`minUptime`, perilaku wajar) | Test menyetel `minUptime = 0`; perilaku game tetap default |

## 5. Cara Anda menguji (±10 menit)
1. Hentikan `pnpm dev` lama (Ctrl + C), lalu jalankan lagi:
   ```powershell
   pnpm dev
   ```
2. Buka `http://localhost:5173` di **Chrome** → isi nama → **Gabung ke dunia**.
3. Jalan (WASD), lari (Shift), lompat (Space) ke peti di dek. Berjalan keluar dek → jatuh ke laut dan berenang → hadap dek lalu tekan **Space** untuk melompat naik.
4. Buka **Edge** (atau tab kedua) ke alamat yang sama → gabung dengan nama lain. Expected: kedua pemain saling melihat (kapsul berwarna + nama) dan gerakannya halus.
5. Tekan **Enter**, ketik pesan, Enter → muncul di pemain lain.
6. Tekan **F3** → lihat "Koreksi prediksi" (harus 0 cm atau mendekati 0).
7. Di terminal, tekan **Ctrl + C** (server menyimpan dunia), jalankan `pnpm dev` lagi, gabung → Anda muncul di posisi terakhir.

Mohon laporkan apakah langkah 1–7 berhasil dan bagaimana rasa gerakannya (kecepatan jalan/lompat).

## 6. Known limitations (disengaja)
- Dek uji, kapsul pemain, dan kotak apung = **PLACEHOLDER**. Rakit yang bergerak (raft-local frame) = Phase 3.
- Air untuk gameplay masih datar (permukaan laut rata-rata). Ombak visual ±0,6 m bisa "menembus" pemain yang berenang. Renang mengikuti ombak menyusul di Phase 3–4.
- Belum ada menyelam, jongkok, animasi karakter, atau suara.
- Satu world = satu room hanya dijaga dalam satu proses server (lock database di Phase 8 — R22).
- File save menyimpan semua pemain yang pernah masuk, termasuk pemain test awal di `dev-world` (R21). Hapus folder `data/saves` bila ingin bersih.
- Batas koneksi per IP & ukuran pesan WebSocket: Phase 16 (hosting).
- Ukuran unduhan awal naik ke ±5,2 MB (±1,9 MB gzip) karena Rapier kini dibutuhkan untuk prediksi gerak (budget 25 MB; evaluasi paket WASM non-compat → R18).
- Catatan teknis: `boot()` dari `@colyseus/testing` 0.18.6 mengabaikan port untuk instance Server; test memakai `server.listen(port, "127.0.0.1")` langsung (lihat `apps/server/test/helpers.ts`).

## 7. Langkah berikutnya
1. Uji manual §5.
2. Setujui mulainya **Phase 3 — First-person controller & rakit awal** (rakit 2×2 yang hanyut, naik-turun rakit, interaksi raycast, gerak di atas platform bergerak).

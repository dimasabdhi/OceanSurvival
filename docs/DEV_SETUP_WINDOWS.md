# Development Setup (Windows) — OceanSurvival

Status: **Diverifikasi di PC owner pada Phase 1 (2026-11-21)** oleh Claude. Owner diminta mencoba sendiri langkah 3–7 sebagai bagian review Phase 1.

Semua perintah dijalankan di **PowerShell** dari folder project:
`C:\Users\Dimas\Documents\Dimas-data\Project-Dimas\OceanSurvival`

## 1. Prasyarat (kondisi PC owner, dicek 2026-11-21)
| Tool | Dibutuhkan | Status |
|---|---|---|
| Node.js | 24.13.0 | ✅ terpasang |
| Git | 2.4x+ | ✅ 2.52.0 |
| pnpm | 12.21.0 | ✅ dipasang di Phase 1 (langkah 2) |
| Docker Desktop | 29.x (mulai Phase 8) | ✅ 29.5.3 |
| Chrome / Edge | terbaru | ✅ 157 / 158 |

Cek versi kapan saja:
```powershell
node --version; git --version; pnpm --version
```

## 2. Pasang pnpm (sekali saja, Phase 1)
```powershell
npm install --global pnpm@12.21.0
```
Tutup lalu buka lagi PowerShell, kemudian cek:
```powershell
pnpm --version
```
Hasil yang diharapkan: `12.21.0`.

## 3. Install dependency project (Phase 1+)
```powershell
pnpm install
```
pnpm hanya menjalankan build script dari paket yang diizinkan (`allowBuilds` di `pnpm-workspace.yaml`; saat ini hanya `esbuild`). Bila muncul error "Ignored build scripts", laporkan ke Claude — jangan menyetujui semua paket sekaligus.

Peringatan yang **normal** (bukan masalah):
- `Issues with peer dependencies found` → `missing peer @colyseus/uwebsockets-transport`: sengaja tidak dipasang (alasan keamanan, lihat TECHNICAL_ARCHITECTURE §2).
- `1 deprecated subdependencies found: uuid@8.3.2`: berasal dari dependency Colyseus, tidak berdampak.

## 4. Siapkan file environment (opsional)
Tanpa `.env`, nilai default sudah aman untuk satu PC (server hanya mendengarkan `127.0.0.1:2567`). Bila perlu mengubah:
```powershell
Copy-Item .env.example .env
```
Isi `.env` hanya untuk komputer Anda; file ini tidak masuk Git.

## 5. Jalankan development
```powershell
pnpm dev
```
- Client: buka `http://localhost:5173` di Chrome atau Edge → isi **Nama pemain** → **Gabung ke dunia**.
- Kontrol: WASD jalan, mouse melihat, **klik kiri tahan** isi tenaga lalu lepas untuk melempar kait, tahan lagi untuk menarik, **klik kanan** lepas kait, **Space** lompat (di air: naik / melompat keluar air ke rakit), **C** menyelam, **Shift** lari, **E** interaksi (lentera), **Enter/T** chat, **Esc** jeda (kualitas grafik, FOV, sensitivitas, goyangan kepala & rakit, **Keluar ke menu**), **F3** overlay performa (termasuk ping & "koreksi prediksi").
- Pojok kanan atas: status server ("Server: terhubung · n pemain · ping") dan jam dunia (diatur server).
- Server: berjalan di `ws://127.0.0.1:2567`. Hentikan keduanya dengan `Ctrl + C` — server menyimpan dunia sebelum mati.
- Simpanan dunia (dev): `data/saves/worlds/<world>.json`. Hapus folder `data/saves` untuk mereset semua dunia & identitas.

**Main bersama di satu PC**: buka tab/jendela kedua (bisa Chrome + Edge). Setiap tab yang terbuka bersamaan otomatis menjadi pemain berbeda (profil 1, 2, …). Maksimal 4 pemain per dunia.

Mode khusus (tambahkan di akhir alamat):
| Alamat | Fungsi |
|---|---|
| `http://localhost:5173/?world=coba` | Masuk dunia lain bernama `coba` (huruf kecil, angka, `-`) |
| `http://localhost:5173/?net=0` | Tanpa koneksi server (kamera terbang debug) |
| `http://localhost:5173/?spike=rapier` | Uji fisika Rapier di browser (hasil harus "COCOK") |
| `http://localhost:5173/?bench=ocean&seconds=60` | Benchmark laut 60 detik (hasil tampil di layar) |
| `http://localhost:5173/?quality=low` | Paksa kualitas Rendah/Sedang/Tinggi (`low`/`medium`/`high`) |

## 6. Menjalankan pemeriksaan kualitas
```powershell
pnpm verify
```
(lint + typecheck + unit/integration test + validasi aset; ±5 detik)

Tes end-to-end di Chrome & Edge (memakai browser yang sudah terpasang, otomatis menjalankan server bila belum jalan):
```powershell
pnpm test:e2e
```

Benchmark otomatis (membuka jendela Chrome ±3,5 menit; jangan pakai PC selama berjalan):
```powershell
pnpm bench:ocean
```
Hasil disimpan di folder `bench-results/` (tidak masuk Git).

Uji beban server dengan bot (butuh `pnpm dev` berjalan di terminal lain; default 4 bot × 10 menit di dunia `loadtest`):
```powershell
pnpm load-test
```
Benchmark scene lengkap (rakit + 3 pemain + 60 debris):
```powershell
$env:BENCH_SCENE="full4p"; pnpm bench:ocean
```
Atau buka `http://localhost:5173/?bench=full4p&net=0` di browser.

Versi singkat uji beban, 2 menit dengan 8 bot:
```powershell
$env:BOTS=8; $env:DURATION_SECONDS=120; pnpm load-test
```

Merasakan internet lambat di LAN: isi `SIMULATED_LATENCY_MS=150` di `.env`, lalu jalankan ulang `pnpm dev`. Metrik server langsung: buka `http://127.0.0.1:2567/debug/metrics`.

## 7. Tes multiplayer di satu PC
Buka 2–4 tab/jendela (bisa campur Chrome & Edge) ke `http://localhost:5173` dan join world yang sama.

## 8. Tes multiplayer di LAN (perangkat lain, Phase 2+)
1. Cari IP LAN PC Anda:
   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' } | Select-Object IPAddress, InterfaceAlias
   ```
2. Ubah `.env`: `SERVER_HOST=<IP LAN>`, `VITE_SERVER_URL=http://<IP LAN>:2567`, tambahkan `http://<IP LAN>:5173` ke `CLIENT_ORIGINS`.
3. Windows Firewall akan bertanya saat Node pertama kali membuka port → izinkan **hanya Private networks**.
4. Pastikan jaringan Wi-Fi rumah diset sebagai **Private**, bukan Public. Jangan lakukan port forwarding di router.

## 9. PostgreSQL via Docker (Phase 8+)
```powershell
docker compose -f infra/docker-compose.yml up -d
```
Container memakai port **5433** (service PostgreSQL native Anda di 5432 tidak terganggu). Detail backup/restore: [DATABASE_DESIGN §9](DATABASE_DESIGN.md#9-backup--restore).

## 10. Masalah umum
| Gejala | Penyebab | Solusi |
|---|---|---|
| `pnpm` tidak dikenali | PATH belum diperbarui | Tutup & buka ulang PowerShell |
| Script diblokir "running scripts is disabled" | Execution policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (hanya bila diperlukan; tanyakan dulu) |
| Port 5173/2567 sudah dipakai | Proses lama masih jalan | Tutup terminal lama atau ubah port di `.env` |
| Layar hitam "WebGL2 tidak didukung" | Akselerasi hardware mati | Chrome/Edge Settings → System → aktifkan hardware acceleration |
| Mouse tidak terkunci | Pointer lock butuh klik | Klik di area game; Esc untuk keluar |

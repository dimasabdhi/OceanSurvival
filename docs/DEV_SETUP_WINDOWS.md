# Development Setup (Windows) — OceanSurvival

Status: **Draft untuk Phase 1** — langkah akan diuji langsung di PC owner saat Phase 1 dan diperbaiki bila ada kendala. Saat Phase 0 belum ada kode untuk dijalankan.

Semua perintah dijalankan di **PowerShell** dari folder project:
`C:\Users\Dimas\Documents\Dimas-data\Project-Dimas\OceanSurvival`

## 1. Prasyarat (kondisi PC owner, dicek 2026-11-21)
| Tool | Dibutuhkan | Status |
|---|---|---|
| Node.js | 24.13.0 | ✅ terpasang |
| Git | 2.4x+ | ✅ 2.52.0 |
| pnpm | 12.21.0 | ❌ belum — langkah 2 |
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
pnpm hanya menjalankan build script dari paket yang di-allowlist (`onlyBuiltDependencies` di konfigurasi workspace). Bila muncul peringatan "ignored build scripts", laporkan ke Claude — jangan menyetujui semua paket sekaligus.

## 4. Siapkan file environment
```powershell
Copy-Item .env.example .env
```
Isi `.env` hanya untuk komputer Anda; file ini tidak masuk Git.

## 5. Jalankan development
```powershell
pnpm dev
```
- Client: buka `http://localhost:5173` di Chrome atau Edge.
- Server: berjalan di `http://localhost:2567` (monitor Colyseus hanya di development).
- Hentikan dengan `Ctrl + C`.

## 6. Menjalankan pemeriksaan kualitas
```powershell
pnpm verify
```
(lint + typecheck + unit/integration test + validasi aset)

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

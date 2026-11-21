# Performance Budget & Profiling — OceanSurvival

Status: **Draft v1 (Phase 0)**. Angka di bawah adalah **target desain**, bukan klaim. Status "terpenuhi" hanya boleh ditulis setelah benchmark tercatat di `docs/reports/`.

## 1. Mesin uji
| Profil | Spesifikasi | Status |
|---|---|---|
| **Reference PC** | Ryzen 5 7500F, Radeon RX 9060 XT, 32 GB, Windows 11, Chrome 157 / Edge 158, 1920×1080 | Tersedia (PC owner) |
| **Minimum target** | Ditentukan lewat pengujian nyata (kandidat: laptop iGPU kelas 2022, mis. Radeon 680M / Iris Xe, 16 GB) | **Belum diuji** — Phase 15 |

## 2. Target client (reference PC, preset High, 1080p, 4 pemain, rakit 100 piece)
| Metrik | Target | Batas keras |
|---|---|---|
| FPS | ≥ 60 stabil | p1-low ≥ 50 |
| Frame time CPU (main thread) | ≤ 8 ms | 12 ms |
| Frame time GPU | ≤ 10 ms | 14 ms |
| Draw calls | ≤ 250 | 400 |
| Triangles terlihat | ≤ 1.5 juta | 2.5 juta |
| Texture memory | ≤ 384 MB | 512 MB |
| JS heap | ≤ 300 MB | 450 MB, tidak tumbuh > 5% / 30 menit (leak check) |
| GC pause | ≤ 4 ms | 8 ms |
| Initial download (gz/br) | ≤ 25 MB sampai bisa bermain | 40 MB |
| Waktu load (broadband 50 Mbps, cold) | ≤ 20 s | 40 s |
| Input → render latency (lokal) | ≤ 1 frame tambahan | — |

### Preset kualitas
| Preset | Render scale | Shadow | View distance | Ocean LOD | Post |
|---|---|---|---|---|---|
| Low | 0.75 | off | 300 m | 2 ring | FXAA |
| Medium | 1.0 | 1024, 1 cascade | 600 m | 3 ring | FXAA |
| High | 1.0 | 2048, 2 cascade | 900 m | 3 ring + foam detail | SMAA + bloom ringan |
| Ultra | 1.0–1.5 | 4096 | 1200 m | 4 ring | + bloom |
`QualityManager` dapat menurunkan render scale otomatis bila FPS < 50 selama 5 s (opsional, bisa dimatikan).

## 3. Target server (per WorldRoom, 4 pemain, rakit 200 piece, 60 debris, 40 creature)
| Metrik | Target | Batas |
|---|---|---|
| Durasi tick (60 Hz) rata-rata | ≤ 2 ms | p95 ≤ 5 ms, max ≤ 12 ms |
| Memory per room | ≤ 150 MB | 250 MB |
| CPU per room (1 core) | ≤ 15% | 30% |
| Save serialisasi | ≤ 5 ms sinkron | 20 ms |
| Room per proses (LAN) | ≥ 4 world aktif | — |

## 4. Target jaringan
| Metrik | Target |
|---|---|
| Downstream per client (rata-rata) | ≤ 64 kbps (≈ 8 KB/s) |
| Downstream puncak (join/state awal) | ≤ 1 MB state awal |
| Upstream per client | ≤ 16 kbps |
| Ukuran pesan input | ≤ 64 byte/pesan |

## 5. Teknik wajib
- **Instancing** (`InstancedMesh`/`BatchedMesh`) untuk building pieces, debris, prop, ikan.
- **Pooling** objek: debris view, partikel, audio source, `Vector3/Quaternion` temp (tanpa alokasi per frame di hot path).
- **LOD** dan frustum culling (bawaan Three.js) + jarak cull per kategori.
- **Dispose discipline**: setiap geometry/material/texture/render target punya owner yang memanggil `dispose()`; `renderer.info.memory` dipantau di overlay.
- Ocean: satu draw call per ring LOD; displacement di vertex shader.
- Hindari `castShadow` pada objek kecil/jauh; shadow camera mengikuti rakit.
- Server: tidak ada alokasi besar per tick; struktur data typed array untuk debris/creature bila perlu (setelah profiling).

## 6. Alat profiling
| Area | Alat |
|---|---|
| Client CPU/GPU | Chrome DevTools Performance, `renderer.info`, Spector.js (WebGL capture), `EXT_disjoint_timer_query_webgl2` bila tersedia untuk GPU time |
| Client memory | DevTools Memory (heap snapshot sebelum/sesudah 30 menit), `performance.memory` (Chrome) |
| Server | `node --cpu-prof`, `--heap-prof`, metrik tick internal (`/debug/metrics`), clinic.js (opsional) |
| Jaringan | Colyseus monitor, counter byte per client di server, DevTools WS frames |
| Asset | `tools/validate-assets` (budget), glTF-Transform `inspect` |

## 7. Prosedur benchmark (dipakai mulai Phase 1)
1. Scene benchmark deterministik `?bench=ocean|raft100|full4p` (kamera jalur tetap, 60 s).
2. Tutup aplikasi lain, browser fullscreen, preset ditentukan, jalankan 3×; catat median.
3. Output JSON otomatis (FPS avg/p1, frame ms p50/p95/p99, draw calls, tris, heap) → `bench-results/` (git-ignored) dan ringkasan ke report phase.
4. Server: bot load test N klien 10 menit → tick avg/p95/max, bandwidth per client.
5. Regresi > 10% dibanding baseline phase sebelumnya = blocker untuk acceptance.

## 7a. Hasil terukur (reference PC)
| Phase | Skenario | Hasil |
|---|---|---|
| 1 | `?bench=ocean` High 1080p | 164,9 FPS (vsync 165 Hz), 3 draw calls, 126.720 tris |
| 2 | 4 bot × 10 menit | tick avg 0,025 ms / p95 0,066 / maks 0,54; 7,4 kbps/pemain |
| 3 | 4 bot × 60 s (rakit + LOS) | tick avg 0,023 ms; 8,6 kbps |
| 4 | `?bench=full4p` High 1080p (rakit, 3 pemain, 60 debris, lentera) | 164,7 FPS (vsync), 63 draw calls, 129.786 tris |
| 4 | 4 bot × 90 s, 57 debris | tick avg 0,045 ms / p95 0,099 / maks 0,96; 8,1 kbps |

## 8. Checkpoint per phase
| Phase | Benchmark wajib |
|---|---|
| 1 | Ocean scene FPS & frame time; Rapier step cost Node vs browser |
| 2 | Bandwidth & tick dengan 4 bot |
| 3 | Prediction error rata-rata/max pada RTT 0/100/150 ms |
| 4–6 | Debris 60 aktif: draw calls, bandwidth |
| 7 | Rakit 100 & 400 piece: draw calls, collider rebuild time |
| 10 | 40 creature + AI tick |
| 12 | Pulau + streaming: hitch saat load region (< 50 ms) |
| 15 | Seluruh tabel di dokumen ini + minimum spec |

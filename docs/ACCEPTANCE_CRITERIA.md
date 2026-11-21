# Acceptance Criteria — OceanSurvival

Status: **Draft v1 (Phase 0)**. Kriteria phase yang jauh (≥ 9) akan diperinci saat phase sebelumnya selesai; perubahan dicatat di dokumen ini.

## Definition of Done (berlaku untuk SEMUA phase)
1. Scope phase terimplementasi; item yang tidak selesai ditandai **Deferred** dengan phase tujuan.
2. Gates hijau: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm validate:assets` (mulai Phase 1), E2E relevan.
3. Prosedur tes manual dijalankan di **Chrome dan Edge** pada reference PC; hasil tercatat.
4. Benchmark checkpoint (lihat [PERFORMANCE_BUDGET §8](PERFORMANCE_BUDGET.md#8-checkpoint-per-phase)) tercatat; tidak ada regresi > 10% tanpa penjelasan.
5. Tidak ada placeholder tersembunyi: semua placeholder terdaftar.
6. Dokumentasi & ADR diperbarui; `CLAUDE.md` mencerminkan status terbaru.
7. Completion report `docs/reports/PHASE_XX_REPORT.md` (Bahasa Indonesia): ringkasan, file, cara uji, hasil uji, benchmark, known limitations, risiko baru, langkah berikutnya.
8. Owner menyetujui report.

---

## Phase 0 — Architecture & documentation ✅ (disetujui owner 2026-11-21, commit `03b65cc`)
- [x] 17 dokumen wajib + CLAUDE.md + README ada dan spesifik (memuat angka, tabel data, daftar message, AC per phase).
- [x] ADR 0001–0012 + template + index.
- [x] Konsistensi silang: versi stack, tick rate (60/20/10/2), folder structure, urutan phase sama di semua dokumen.
- [x] File pendukung: `.gitignore`, `.gitattributes`, `.editorconfig`, `.node-version`, `.env.example`, `assets/manifest.json`, `CREDITS.md`.
- [x] Tidak ada kode gameplay, tidak ada dependency terinstal.
- [x] Owner menyetujui.

## Phase 1 — Foundation & tech spikes ✅ (disetujui owner 2026-11-21; bukti: [PHASE_01_REPORT](reports/PHASE_01_REPORT.md))
- [x] `pnpm install` bersih di Windows (tanpa error build-script), `pnpm dev` menjalankan client (:5173) dan server (:2567) bersamaan.
- [x] `pnpm verify` (lint+typecheck+test+validate:assets) hijau.
- [x] Spike TS 7: typecheck semua package < 10 s; atau fallback terdokumentasi di ADR-0011. (±1 s, tanpa fallback)
- [x] Spike Rapier: init & 600 step di Node dan Chrome; hash state identik untuk input sama (test otomatis). (juga Edge)
- [x] Spike Colyseus: room dengan schema builder, message `validate(zod)`, StateView; integration test lulus.
- [x] Ocean prototype + sky + day/night dasar tampil; `?bench=ocean` ≥ 60 FPS (median 3 run) di reference PC preset High; frame time & draw calls tercatat. (median 164,9 FPS, dibatasi monitor 165 Hz)
- [x] Preact overlay + pointer lock + Esc → pause berfungsi di Chrome & Edge. (otomatis + uji manual owner 2026-11-21)
- [x] Owner berhasil menjalankan project mengikuti DEV_SETUP_WINDOWS tanpa bantuan tambahan. (2026-11-21)

## Phase 2 — Multiplayer foundation ✅ (disetujui owner 2026-11-21; bukti: [PHASE_02_REPORT](reports/PHASE_02_REPORT.md))
- [x] 4 tab/browser bergabung ke world yang sama, saling melihat kapsul bergerak mulus (interpolasi 100 ms). (E2E 3 pemain Chrome/Edge + uji integrasi 4 pemain; 4 tab manual: owner)
- [x] Movement server-authoritative: posisi hanya berubah lewat input; test menolak cmd berlebih (speedhack) lulus.
- [x] Reconciliation: pada RTT 150 ms (netsim) rata-rata koreksi < 5 cm, tidak ada snap > 25 cm saat bergerak lurus. (0 cm; `server.simulateLatency`)
- [x] Drop koneksi → auto-reconnect, posisi & identitas utuh; drop melewati grace → pemain dikeluarkan bersih & disimpan.
- [x] Payload invalid → disconnect 4002; flood → rate limit (integration test).
- [x] Bot load test 4 pemain 10 menit: tick avg ≤ 2 ms, p95 ≤ 5 ms; downstream ≤ 64 kbps/client. (0,025 / 0,066 ms; 7,4 kbps)
- [x] Restart server (Ctrl+C) → `onBeforeShutdown` menyimpan posisi (file driver), load kembali benar. (otomatis + uji manual owner 2026-11-21)

## Phase 3 — First-person controller & starting raft
- [ ] Walk/sprint/jump/swim permukaan & bawah air sesuai nilai GDD (test unit `stepMovement`).
- [ ] Berjalan & melompat di rakit yang hanyut 0.6 m/s tanpa jitter terlihat (RTT 0 dan 100 ms); tidak tergelincir dari rakit saat diam.
- [ ] Naik dari air ke rakit dan sebaliknya mulus; transisi frame benar di prediction & server (test determinism).
- [ ] Prompt interaksi muncul pada objek interaktif ≤ 2.5 m; aksi di luar 3.0 m (posisi server) ditolak.
- [ ] Pause & settings (sensitivitas, FOV, preset grafik) tersimpan per browser.

## Phase 4 — Ocean & floating resources
- [ ] Tinggi gelombang client & server untuk (x,z,t) sama (selisih < 1 mm, test).
- [ ] Debris spawn hulu, hanyut, despawn sesuai GAMEPLAY_SYSTEMS §C; maks 60 aktif per rakit.
- [ ] Debris di luar 120 m tidak dikirim ke client (StateView test).
- [ ] Siklus siang–malam 24 menit lengkap tanpa artefak; `?bench=full4p` ≥ 60 FPS.

## Phase 5 — Hook gameplay
- [ ] Lempar dengan charge, jarak maks 25 m, tarik, ambil debris (maks 3), item masuk inventory sementara (tanpa UI penuh).
- [ ] Dua pemain menarget debris yang sama: hanya satu yang mendapat (test).
- [ ] Rope & hook terlihat konsisten bagi semua pemain.

## Phase 6 — Inventory & basic crafting → Vertical Slice v0.1
- [ ] Inventory 20 + hotbar 8: move/split/merge/swap/drop/pickup, tooltip, drag & drop.
- [ ] Invariant: property test 10.000 operasi acak — total item kekal; `txId` ganda diproses sekali.
- [ ] Hand-craft Rope, Plank, Foundation (tempel ke rakit sederhana), Spear; bahan kurang → ditolak dengan alasan.
- [ ] Inventory pemain lain tidak terlihat di jaringan (StateView test).
- [ ] Playtest: 2–4 pemain 30 menit tanpa desync/crash; owner menilai loop inti "menyenangkan untuk dilanjutkan".

## Phase 7 — Building system
- [ ] Semua piece v1 dapat dipasang dengan snapping & rotasi; ghost hijau/merah sesuai `validatePlacement` (hasil client = server).
- [ ] Support & collapse: demolish pendukung meruntuhkan piece tak didukung (test graph).
- [ ] Rakit 400 piece: draw calls ≤ 250, rebuild collider incremental ≤ 2 ms.
- [ ] Dua pemain membangun di sel yang sama bersamaan: satu sukses, material yang gagal tidak hilang.

## Phase 8 — Persistence & world management
- [ ] Create → main → keluar → Continue: rakit, inventory, progress identik (test roundtrip + manual).
- [ ] Kill proses server (bukan graceful) → kehilangan maksimal 1 interval autosave.
- [ ] Migrasi DB up/down berjalan; migrasi format save v1→v2 dengan fixture lulus.
- [ ] Backup → hapus DB → restore → world dapat dimainkan.
- [ ] Join via kode + password; pemain banned ditolak; satu world hanya dibuka satu room (advisory lock test).

## Phase 9 — Survival & progression
- [ ] Laju vital sesuai data & mode; efek status bekerja; downed → revive/respawn → Wreck Bag sesuai mode.
- [ ] Stasiun berjalan di server meski tidak ada yang membuka UI; Solar Still hanya siang.
- [ ] Insight & unlock berbagi untuk seluruh world; progression milestone GDD §7.3 tercapai di playtest (±30%).

## Phase 10 — Animals & combat
- [ ] Reefjaw patrol/attack/retreat sesuai spesifikasi; menyerang foundation tepi; repair memulihkan HP.
- [ ] Melee hit dengan lag compensation: pada RTT 150 ms, serangan yang terlihat kena di client kena di server ≥ 90% (test bot).
- [ ] 40 creature aktif: AI tick dalam budget server.

## Phase 11 — Navigation
- [ ] Sail/paddle/anchor/steer mengubah gerak rakit sesuai GDD §11; pemain di atas rakit tetap stabil pada kecepatan maks.
- [ ] Perjalanan 5 km tanpa artefak floating point (floating origin aktif).

## Phase 12 — Islands & underwater
- [ ] Seed sama → pulau identik di client & server (hash geometri).
- [ ] Panen node tersimpan & respawn sesuai timer; loot crate deterministik.
- [ ] Load region tanpa hitch > 50 ms; oxygen & bawah laut sesuai spesifikasi.

## Phase 13 — World progression & events
- [ ] Badai memengaruhi ombak/visibilitas/angin; Beacon menyala membuka sinyal berikutnya; engine berfungsi dengan biofuel.
- [ ] The Last Atoll dapat dicapai dalam playtest (akhir v1.0).

## Phase 14 — UI, audio & visual polish
- [ ] Semua layar di UI_UX_SPECIFICATION final, seluruh teks UI dalam Bahasa Indonesia lewat `locales/id.json` (tidak ada teks hardcode di komponen), aksesibilitas §9.
- [ ] Review visual 4 kondisi lighting lulus untuk semua aset; tidak ada placeholder tersisa.

## Phase 15 — Performance, QA & balancing
- [ ] Seluruh target PERFORMANCE_BUDGET terpenuhi (atau penyimpangan disetujui owner) pada reference PC; minimum spec ditetapkan dari uji nyata.
- [ ] Sesi co-op 2 jam (4 pemain, LAN) tanpa crash/desync/blocker.
- [ ] Heap tidak tumbuh > 5% dalam 30 menit.

## Phase 16 — Deployment & hosting
- [ ] Teman di jaringan berbeda dapat join via WSS; TLS valid; CORS allowlist.
- [ ] Backup terjadwal & uji restore di lingkungan produksi; runbook operasional tersedia.

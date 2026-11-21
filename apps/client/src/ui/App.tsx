import type { Game } from "../app/Game";
import type { QualityPreset } from "../render/quality";
import { t } from "./i18n";
import * as store from "./store";

/** Phase 1 UI shell: start/pause overlay, perf overlay, connection badge, spike/bench panels. */
export function App({ game }: { game: Game }) {
  const benchState = store.bench.value;
  const benchMode = benchState.running || benchState.result !== null;
  const paused = !store.pointerLocked.value && !benchMode;

  return (
    <>
      <TopBar />
      {store.showPerf.value && <PerfPanel />}
      {store.rapierSpike.value && <RapierPanel />}
      {benchMode && <BenchPanel />}
      {paused && !store.started.value && <StartScreen game={game} />}
      {paused && store.started.value && <PauseMenu game={game} />}
    </>
  );
}

function TopBar() {
  const c = store.connection.value;
  const label =
    c.status === "connected"
      ? t("net.connected")
      : c.status === "connecting"
        ? t("net.connecting")
        : c.status === "reconnecting"
          ? t("net.reconnecting")
          : t("net.offline");
  return (
    <div class="topbar">
      {c.status !== "disabled" && (
        <span class={`badge badge-${c.status}`} data-testid="net-status">
          ● {label}
          {c.status === "connected" && ` · ${c.players} ${t("net.players")}`}
          {c.rttMs !== null && ` · ${Math.round(c.rttMs)} ms`}
        </span>
      )}
      <span class="badge">☀ {store.clock.value}</span>
    </div>
  );
}

function PerfPanel() {
  const p = store.perf.value;
  if (!p) return null;
  const fmt = (n: number) => n.toLocaleString("id-ID");
  return (
    <div class="panel perf" data-testid="perf-panel">
      <div>
        {t("perf.fps")}: <b>{p.fps.toFixed(0)}</b>
      </div>
      <div>
        {t("perf.frame")}: {p.frameMsAvg.toFixed(2)} ms (maks {p.frameMsMax.toFixed(1)})
      </div>
      <div>
        {t("perf.drawCalls")}: {fmt(p.drawCalls)}
      </div>
      <div>
        {t("perf.triangles")}: {fmt(p.triangles)}
      </div>
      <div>
        {t("perf.geometries")}: {p.geometries} · {t("perf.textures")}: {p.textures}
      </div>
    </div>
  );
}

function RapierPanel() {
  const r = store.rapierSpike.value;
  if (!r) return null;
  return (
    <div class="panel spike" data-testid="rapier-spike">
      <b>{t("spike.rapier.title")}</b>
      <div>
        Rapier {r.rapierVersion} · hash <code>{r.hash}</code> ({r.stepMs} ms)
      </div>
      <div class={r.match ? "ok" : "bad"}>
        {r.match ? t("spike.rapier.match") : t("spike.rapier.mismatch")} ({r.expected})
      </div>
    </div>
  );
}

function BenchPanel() {
  const { running, result } = store.bench.value;
  return (
    <div class="panel bench" data-testid="bench-panel">
      <b>{running ? t("bench.running") : t("bench.done")}</b>
      {result && (
        <pre>
          {`FPS rata-rata : ${result.fpsAvg}
FPS 1% low    : ${result.fps1Low}
Frame p50/p95/p99 : ${result.frameMsP50} / ${result.frameMsP95} / ${result.frameMsP99} ms
Frame maks    : ${result.frameMsMax} ms
Draw calls    : ${result.drawCalls}
Segitiga      : ${result.triangles.toLocaleString("id-ID")}
Resolusi      : ${result.resolution} (pixel ratio ${result.pixelRatio})
Kualitas      : ${result.quality} · ${result.frames} frame / ${result.seconds} s`}
        </pre>
      )}
    </div>
  );
}

function StartScreen({ game }: { game: Game }) {
  return (
    <div class="overlay" data-testid="start-screen">
      <div class="card">
        <h1>{t("app.title")}</h1>
        <p class="muted">{t("app.devBuild")}</p>
        <button type="button" class="primary" onClick={() => game.requestPointerLock()}>
          {t("start.clickToPlay")}
        </button>
        <p class="muted small">{t("start.controls")}</p>
      </div>
    </div>
  );
}

function PauseMenu({ game }: { game: Game }) {
  return (
    <div class="overlay" data-testid="pause-menu">
      <div class="card">
        <h2>{t("pause.title")}</h2>
        <button type="button" class="primary" onClick={() => game.requestPointerLock()}>
          {t("pause.resume")}
        </button>
        <label>
          {t("pause.quality")}
          <select
            value={store.quality.value}
            onChange={(e) => {
              store.quality.value = (e.currentTarget as HTMLSelectElement).value as QualityPreset;
            }}
          >
            <option value="low">{t("pause.quality.low")}</option>
            <option value="medium">{t("pause.quality.medium")}</option>
            <option value="high">{t("pause.quality.high")}</option>
          </select>
        </label>
        <label>
          {t("pause.timeOfDay")} ({store.clock.value})
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={store.timeOfDayPhase.value}
            onInput={(e) => {
              const v = Number((e.currentTarget as HTMLInputElement).value);
              store.timeOfDayPhase.value = v;
              game.setTimeOfDay(v);
            }}
          />
        </label>
        <label>
          {t("pause.timeSpeed")} (×{store.timeSpeed.value})
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={store.timeSpeed.value}
            onInput={(e) => {
              store.timeSpeed.value = Number((e.currentTarget as HTMLInputElement).value);
            }}
          />
        </label>
        <label>
          {t("pause.fov")} ({store.fov.value}°)
          <input
            type="range"
            min={60}
            max={100}
            step={1}
            value={store.fov.value}
            onInput={(e) => {
              store.fov.value = Number((e.currentTarget as HTMLInputElement).value);
            }}
          />
        </label>
        <label>
          {t("pause.sensitivity")} (×{store.sensitivity.value.toFixed(1)})
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.1}
            value={store.sensitivity.value}
            onInput={(e) => {
              store.sensitivity.value = Number((e.currentTarget as HTMLInputElement).value);
            }}
          />
        </label>
      </div>
    </div>
  );
}

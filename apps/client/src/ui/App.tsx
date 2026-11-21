import { useEffect, useRef, useState } from "preact/hooks";
import type { Game } from "../app/Game";
import { loadPlayerName } from "../net/identity";
import type { QualityPreset } from "../render/quality";
import { type TextKey, t } from "./i18n";
import * as store from "./store";

/** UI shell (Phase 2): join, pause, connection state, chat, perf/net overlay, dev panels. */
export function App({ game }: { game: Game }) {
  const benchState = store.bench.value;
  const benchMode = benchState.running || benchState.result !== null;
  const phase = store.session.value.phase;
  const locked = store.pointerLocked.value;

  let overlay = null;
  if (!benchMode) {
    if (game.online) {
      if (phase === "menu") overlay = <JoinScreen game={game} />;
      else if (phase === "joining") overlay = <Joining />;
      else if (phase === "lost") overlay = <LostScreen game={game} />;
      else if (!locked) overlay = <PauseMenu game={game} />;
    } else if (!locked) {
      overlay = store.started.value ? <PauseMenu game={game} /> : <OfflineStart game={game} />;
    }
  }

  return (
    <>
      <TopBar />
      {store.showPerf.value && <PerfPanel />}
      {store.rapierSpike.value && <RapierPanel />}
      {benchMode && <BenchPanel />}
      {phase === "in-world" && <Chat game={game} />}
      {phase === "in-world" && store.connection.value.status === "reconnecting" && (
        <div class="banner" data-testid="reconnecting">
          {t("net.reconnectingOverlay")}
        </div>
      )}
      {phase === "in-world" && store.underwater.value && <div class="underwater" />}
      {phase === "in-world" && locked && <div class="crosshair" />}
      {phase === "in-world" && locked && store.interactPrompt.value && (
        <div class="prompt" data-testid="interact-prompt">
          <kbd>{t("interact.key")}</kbd> {store.interactPrompt.value.action}
        </div>
      )}
      {overlay}
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
          {c.rttMs !== null && c.status === "connected" && ` · ${Math.round(c.rttMs)} ms`}
        </span>
      )}
      <span class="badge">☀ {store.clock.value}</span>
    </div>
  );
}

function PerfPanel() {
  const p = store.perf.value;
  if (!p) return null;
  const n = store.netStats.value;
  const fmt = (v: number) => v.toLocaleString("id-ID");
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
      {n && (
        <>
          <div>
            {t("perf.rtt")}: {n.rttMs} ms
          </div>
          <div data-testid="net-correction">
            {t("perf.correction")}: {n.corrAvgCm} cm (maks {n.corrMaxCm})
          </div>
        </>
      )}
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

function JoinScreen({ game }: { game: Game }) {
  const [name, setName] = useState(
    () => store.playerName.value || loadPlayerName(store.profile.value),
  );
  const error = store.session.value.reason === "error" ? store.session.value.detail : "";
  const submit = (e: Event) => {
    e.preventDefault();
    game.join(name);
  };
  return (
    <div class="overlay" data-testid="join-screen">
      <form class="card" onSubmit={submit}>
        <h1>{t("app.title")}</h1>
        <p class="muted">{t("app.devBuild")}</p>
        <label>
          {t("join.name")}
          <input
            data-testid="name-input"
            value={name}
            maxLength={24}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        {error && <p class="bad small">{error}</p>}
        <button type="submit" class="primary" data-testid="join-button">
          {t("join.button")}
        </button>
        <p class="muted small">{t("start.controls")}</p>
      </form>
    </div>
  );
}

function Joining() {
  return (
    <div class="overlay" data-testid="joining">
      <div class="card">
        <p>{t("join.joining")}</p>
      </div>
    </div>
  );
}

function LostScreen({ game }: { game: Game }) {
  const s = store.session.value;
  const key = `lost.${s.reason ?? "network"}` as TextKey;
  return (
    <div class="overlay" data-testid="lost-screen">
      <div class="card">
        <h2>{t("lost.title")}</h2>
        <p>{t(key)}</p>
        <p class="muted small">{s.detail}</p>
        <button
          type="button"
          class="primary"
          onClick={() => game.join(store.playerName.value || loadPlayerName(store.profile.value))}
        >
          {t("lost.retry")}
        </button>
      </div>
    </div>
  );
}

function OfflineStart({ game }: { game: Game }) {
  return (
    <div class="overlay" data-testid="start-screen">
      <div class="card">
        <h1>{t("app.title")}</h1>
        <p class="muted">{t("app.devBuild")}</p>
        <button type="button" class="primary" onClick={() => game.requestPointerLock()}>
          {t("start.clickToPlay")}
        </button>
        <p class="muted small">{t("start.offlineControls")}</p>
      </div>
    </div>
  );
}

function Chat({ game }: { game: Game }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = store.chatOpen.value;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  // Lines fade after 15 s unless the chat box is open.
  const lines = store.chatLog.value.filter((l) => open || now - l.at < 15_000);
  return (
    <div class="chat" data-testid="chat">
      {lines.map((l) => (
        <div key={l.id} class="chat-line">
          <b>{l.from}:</b> {l.text}
        </div>
      ))}
      {open && (
        <input
          ref={inputRef}
          class="chat-input"
          data-testid="chat-input"
          maxLength={200}
          placeholder={t("chat.placeholder")}
          onKeyDown={(e) => {
            e.stopPropagation();
            const el = e.currentTarget as HTMLInputElement;
            if (e.key === "Enter") {
              game.sendChat(el.value);
              el.value = "";
              store.chatOpen.value = false;
            } else if (e.key === "Escape") {
              store.chatOpen.value = false;
            }
          }}
        />
      )}
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
        {game.online ? (
          <p class="muted small">
            {t("pause.timeOfDay")}: {store.clock.value} — {t("pause.timeOnlineNote")}
          </p>
        ) : (
          <>
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
          </>
        )}
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
        <label class="check">
          <input
            type="checkbox"
            checked={store.headBob.value}
            onChange={(e) => {
              store.headBob.value = (e.currentTarget as HTMLInputElement).checked;
            }}
          />
          {t("pause.headBob")}
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={store.raftSway.value}
            onChange={(e) => {
              store.raftSway.value = (e.currentTarget as HTMLInputElement).checked;
            }}
          />
          {t("pause.raftSway")}
        </label>
        {game.online && (
          <button type="button" data-testid="leave-button" onClick={() => void game.leaveWorld()}>
            {t("pause.leave")}
          </button>
        )}
      </div>
    </div>
  );
}

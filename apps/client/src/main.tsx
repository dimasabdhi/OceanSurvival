import { render } from "preact";
import { Game } from "./app/Game";
import { readLaunchParams } from "./app/params";
import { acquireProfile, loadPlayerName } from "./net/identity";
import { loadQualityPreset } from "./render/quality";
import { App } from "./ui/App";
import { t } from "./ui/i18n";
import * as store from "./ui/store";
import "./ui/styles.css";

function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

const gameRoot = document.getElementById("game-root");
const uiRoot = document.getElementById("ui-root");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game-root / #ui-root");

if (!hasWebGL2()) {
  render(
    <div class="boot-error" data-testid="webgl2-missing">
      <div class="card">
        <h2>{t("boot.webgl2Missing.title")}</h2>
        <p>{t("boot.webgl2Missing.body")}</p>
      </div>
    </div>,
    uiRoot,
  );
} else {
  const params = readLaunchParams(window.location.search);
  store.quality.value = params.quality ?? loadQualityPreset();
  store.connection.value = { status: params.net ? "offline" : "disabled", players: 0, rttMs: null };
  store.profile.value = await acquireProfile();
  store.playerName.value = loadPlayerName(store.profile.value);
  const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:2567";
  const game = new Game(gameRoot, params, serverUrl);
  render(<App game={game} />, uiRoot);
  game.start();

  if (import.meta.env.DEV) {
    // Dev-only handle for debugging & automated checks (not present in production builds).
    (window as unknown as { __OS_DEBUG__: unknown }).__OS_DEBUG__ = { game, store };
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(() => game.dispose());
  }
}

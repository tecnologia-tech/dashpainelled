import { useState, useEffect, useCallback, useRef } from "react";
import { CONFIG } from "./config.js";
import LedCanvas from "./components/LedCanvas.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import DebugHud from "./components/DebugHud.jsx";
import VideoPlayer from "./components/VideoPlayer.jsx";
import { getSettings, saveSettings } from "./services/settingsService.js";
import * as textTickerLayer from "./layers/textTickerLayer.js";

function buildWelcomeMessage(name) {
  return `BEM-VINDO À TOCA DA PANTERA ${name}. SUA IMPORTAÇÃO COMEÇA AQUI.`;
}

function detectPanelMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("panel");
}

function isValidMode(m) {
  return typeof m === "string" && Object.values(CONFIG.MODES).includes(m);
}

const LEGACY_MODE_ALIAS = {
  bemVindo: "bemVindoCliente",
};

function normalizeMode(m) {
  return LEGACY_MODE_ALIAS[m] ?? m;
}

function deriveLegacyMode(s) {
  if (s.sinoEnabled === true) return CONFIG.MODES.SINO;
  if (s.videoMode === "LAST_DANCE")   return CONFIG.MODES.LAST_DANCE;
  if (s.videoMode === "BLACK_FRIDAY") return CONFIG.MODES.BLACK_FRIDAY;
  return CONFIG.MODES.NORMAL;
}

const KEY_TO_MODE = {
  F13: CONFIG.MODES.NORMAL,
  F14: CONFIG.MODES.SINO,
  F15: CONFIG.MODES.LAST_DANCE,
  F16: CONFIG.MODES.BLACK_FRIDAY,
  F17: CONFIG.MODES.TOGETHER,
  F18: CONFIG.MODES.BEM_VINDO_CLIENTE,
  F19: CONFIG.MODES.BEM_VINDO_COLABORADOR,
  F20: CONFIG.MODES.NUT_DAY,
};

export default function App() {
  const [frameCount] = useState(CONFIG.FRAME_COUNT);
  const [isPanelMode] = useState(detectPanelMode);
  const [displayMode, setDisplayMode] = useState("dash");
  const [activeMode, setActiveMode] = useState(CONFIG.ACTIVE_MODE_DEFAULT);
  const activeModeRef = useRef(activeMode);
  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);

  const [metrics, setMetrics] = useState({
    fps: 0,
    progress: 0,
    cycle: 0,
    offsetX: 0,
  });

  const [goalsStatus, setGoalsStatus] = useState("idle");
  const [iconStatus, setIconStatus] = useState({});
  const [welcomeName, setWelcomeName] = useState("");
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeDraft, setWelcomeDraft] = useState("");

  const activateMode = useCallback((mode) => {
    if (!isValidMode(mode)) return null;
    if (activeModeRef.current === mode) return mode;
    activeModeRef.current = mode;
    setActiveMode(mode);
    saveSettings({
      activeMode: mode,
      sinoEnabled: mode === CONFIG.MODES.SINO,
    }).catch((err) => console.warn("saveSettings failed:", err));
    fetch(CONFIG.MODE_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch((err) => console.warn("Falha ao chamar backend para modo:", mode, err));
    return mode;
  }, []);

  useEffect(() => {
    getSettings()
      .then((s) => {
        const normalized = normalizeMode(s.activeMode);
        if (isValidMode(normalized)) {
          setActiveMode(normalized);
        } else {
          setActiveMode(deriveLegacyMode(s));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const mode = KEY_TO_MODE[e.key];
      if (!mode) return;
      activateMode(mode);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activateMode]);

  // Em modo painel, forçar sempre o branch normal (faixa principal do dash).
  // activeMode persistido pode estar em blackFriday/together/nutDay/etc → SVG
  // placeholder mostraria o label desses modos. Painel ignora activeMode.
  const isNormal = isPanelMode || activeMode === CONFIG.MODES.NORMAL;
  const isWelcomeCliente = !isPanelMode && activeMode === CONFIG.MODES.BEM_VINDO_CLIENTE;

  useEffect(() => {
    if (isWelcomeCliente) {
      setWelcomeDraft(welcomeName);
      setWelcomeModalOpen(true);
    } else {
      setWelcomeModalOpen(false);
    }
  }, [isWelcomeCliente]);

  useEffect(() => {
    if (isWelcomeCliente && welcomeName) {
      textTickerLayer.setText(buildWelcomeMessage(welcomeName));
    }
  }, [isWelcomeCliente, welcomeName]);

  function submitWelcomeName(e) {
    e?.preventDefault?.();
    const trimmed = welcomeDraft.trim();
    if (!trimmed) return;
    setWelcomeName(trimmed);
    textTickerLayer.setText(buildWelcomeMessage(trimmed));
    setWelcomeModalOpen(false);
  }

  useEffect(() => {
    if (!CONFIG.DISPLAY_ROTATION.ENABLED) return;
    if (!isNormal) return;
    if (isPanelMode) return; // painel só mostra a faixa, sem rotação para vídeo
    const ms = displayMode === "dash"
      ? CONFIG.DISPLAY_ROTATION.DASH_DURATION_MS
      : CONFIG.DISPLAY_ROTATION.VIDEO_DURATION_MS;
    const id = setTimeout(() => {
      setDisplayMode((prev) => (prev === "dash" ? "video" : "dash"));
    }, ms);
    return () => clearTimeout(id);
  }, [displayMode, isNormal, isPanelMode]);

  const isDash = displayMode === "dash";
  const isVideo = displayMode === "video";
  const videoKey = CONFIG.MODE_TO_VIDEO_KEY[activeMode] ?? "NORMAL";
  const videoPath = CONFIG.VIDEO_MODES[videoKey]?.path ?? CONFIG.VIDEO_MODES.NORMAL.path;
  const placeholderText = CONFIG.MODE_PLACEHOLDERS[activeMode] ?? activeMode;

  const panelW = CONFIG.PANEL_SIGNAL?.WIDTH;
  const panelStripH = CONFIG.PANEL_SIGNAL?.STRIP_HEIGHT;
  const layoutStyle = isPanelMode && panelW && panelStripH
    ? { "--panel-aspect": `${panelW} / ${panelStripH}` }
    : undefined;

  return (
    <div
      className={"app-layout" + (isPanelMode ? " app-panel-mode" : "")}
      style={layoutStyle}
    >
      {CONFIG.SHOW_CONTROLS && !isPanelMode && (
        <header className="controls-area">
          <ControlPanel
            activeMode={activeMode}
            activateMode={activateMode}
          />
        </header>
      )}

      <main className="preview-area">
        {isNormal ? (
          <>
            <div className={`mode-layer${isDash ? "" : " mode-hidden"}`}>
              <LedCanvas
                playing={true}
                speed={CONFIG.TICKER.SPEED_PX_PER_SECOND}
                onMetrics={setMetrics}
                onGoalsStatus={setGoalsStatus}
                onIconStatus={setIconStatus}
                width={isPanelMode ? panelW : undefined}
                height={isPanelMode ? panelStripH : undefined}
              />
              {CONFIG.SHOW_DEBUG && (
                <DebugHud
                  metrics={metrics}
                  speed={CONFIG.TICKER.SPEED_PX_PER_SECOND}
                  frameCount={frameCount}
                  goalsStatus={goalsStatus}
                  iconStatus={iconStatus}
                />
              )}
            </div>

            {CONFIG.DISPLAY_ROTATION.ENABLED && !isPanelMode && (
              <div className={`mode-layer${isVideo ? "" : " mode-hidden"}`}>
                <VideoPlayer active={isVideo} videoPath={videoPath} />
              </div>
            )}
          </>
        ) : isWelcomeCliente && welcomeName ? (
          <LedCanvas
            playing={true}
            speed={CONFIG.TICKER.SPEED_PX_PER_SECOND}
            onMetrics={setMetrics}
            tickerLayer={textTickerLayer}
            loadGoals={false}
          />
        ) : (
          <svg
            className="mode-placeholder"
            data-mode={activeMode}
            viewBox={`0 0 ${CONFIG.WIDTH} ${CONFIG.HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <rect x="0" y="0" width={CONFIG.WIDTH} height={CONFIG.HEIGHT} fill="#000" />
            <text
              x={CONFIG.WIDTH / 2}
              y={CONFIG.HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily='Montserrat, Arial, sans-serif'
              fontWeight="900"
              fontSize="120"
              letterSpacing="6"
              fill="#ffd200"
              style={{ color: "#ffd200", filter: "drop-shadow(0 0 3px currentColor)" }}
              lengthAdjust="spacingAndGlyphs"
              textLength={Math.min(CONFIG.WIDTH - 80, placeholderText.length * 90)}
            >
              {placeholderText}
            </text>
          </svg>
        )}
      </main>

      {welcomeModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={submitWelcomeName}>
            <h2 className="modal-title">Bem-vindo Cliente</h2>
            <label className="modal-label" htmlFor="welcome-name-input">
              Nome do cliente
            </label>
            <input
              id="welcome-name-input"
              className="modal-input"
              autoFocus
              type="text"
              value={welcomeDraft}
              onChange={(e) => setWelcomeDraft(e.target.value)}
              placeholder="Digite o nome"
            />
            <div className="modal-actions">
              <button type="submit" className="control-btn primary" disabled={!welcomeDraft.trim()}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

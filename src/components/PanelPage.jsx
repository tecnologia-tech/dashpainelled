import { useEffect, useRef, useState } from "react";
import { CONFIG } from "../config.js";
import * as background from "../layers/backgroundLayer.js";
import * as barsTest from "../layers/barsTestLayer.js";
import * as colaboradorTickerLayer from "../layers/colaboradorTickerLayer.js";
import * as goalsTicker from "../layers/goalsTickerLayer.js";
import * as textTickerLayer from "../layers/textTickerLayer.js";
import { ensureLoaded as ensureGoals } from "../services/goalsService.js";
import { getSettings, saveSettings } from "../services/settingsService.js";

const PANEL_WIDTH = 2112;
const PANEL_HEIGHT = 192;
const MODULE_COUNT = 16;

const COLAB_MESSAGE = "SEJAM BEM VINDOS A TOCA DA PANTERA";

function buildWelcomeMessage(name) {
  return `BEM-VINDO À TOCA DA PANTERA ${name}. SUA IMPORTAÇÃO COMEÇA AQUI.`;
}

const MODE_OVERLAY_LABELS = {
  sino: "Modo Sino",
  lastDance: "Modo Last Dance",
  blackFriday: "Modo Black Friday",
  together: "Modo Together",
  nutDay: "Modo NutDay",
};

const LEGACY_MODE_ALIAS = { bemVindo: "bemVindoCliente" };
const KEY_TO_MODE = {
  F13: CONFIG.MODES.NORMAL,
  F14: CONFIG.MODES.SINO,
  F15: CONFIG.MODES.LAST_DANCE,
  F16: CONFIG.MODES.BLACK_FRIDAY,
  F17: CONFIG.MODES.TOGETHER,
  F18: CONFIG.MODES.BEM_VINDO_CLIENTE,
  F19: CONFIG.MODES.BEM_VINDO_COLABORADOR,
  F20: CONFIG.MODES.NUT_DAY,
  F21: CONFIG.MODES.PANTERA_VIDEO,
};
function normalizeMode(m) {
  return LEGACY_MODE_ALIAS[m] ?? m;
}
function isValidMode(m) {
  return typeof m === "string" && Object.values(CONFIG.MODES).includes(m);
}

function readParams() {
  if (typeof window === "undefined") return { test: null, debug: null };
  const p = new URLSearchParams(window.location.search);
  return { test: p.get("test"), debug: p.get("debug") };
}

function drawModeOverlay(ctx, W, H, label) {
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const fontSize = Math.max(40, Math.round(H * 0.42));
  ctx.font = `900 ${fontSize}px Montserrat, Arial, sans-serif`;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = Math.round(H * 0.06);
  ctx.lineWidth = Math.max(6, Math.round(fontSize * 0.14));
  ctx.strokeStyle = "#000";
  ctx.strokeText(label, W / 2, H / 2);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#FFD200";
  ctx.fillText(label, W / 2, H / 2);
  ctx.restore();
}

function drawModulesOverlay(ctx, W, H) {
  const moduleW = W / MODULE_COUNT;
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.font = `900 ${Math.max(40, Math.round(H * 0.1))}px Montserrat, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let i = 0; i < MODULE_COUNT; i++) {
    const x = i * moduleW;
    ctx.lineWidth = 2;
    ctx.strokeStyle = i % 2 ? "#0f0" : "#00f";
    ctx.strokeRect(x + 1, 1, moduleW - 2, H - 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000";
    ctx.strokeText(String(i + 1), x + moduleW / 2, H / 2);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + moduleW / 2, H / 2);
  }
  ctx.restore();
}

function ensureSize(c, w, h) {
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
}

export default function PanelPage({
  embedded = false,
  activeMode: controlledMode,
  welcomeName = "",
} = {}) {
  void embedded;
  const loopARef = useRef(null);
  const loopBRef = useRef(null);
  const { test, debug } = readParams();
  const isBars = test === "bars";
  const debugModules = debug === "modules";
  const debugSeam = debug === "seam";

  const isControlled = controlledMode != null;
  const [internalMode, setInternalMode] = useState(CONFIG.ACTIVE_MODE_DEFAULT);
  const activeMode = isControlled ? controlledMode : internalMode;
  const setActiveMode = setInternalMode;
  const activeModeRef = useRef(activeMode);
  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  const isPanteraVideo = activeMode === CONFIG.MODES.PANTERA_VIDEO;
  const isWelcomeColaborador =
    activeMode === CONFIG.MODES.BEM_VINDO_COLABORADOR;
  const isWelcomeCliente =
    activeMode === CONFIG.MODES.BEM_VINDO_CLIENTE && !!welcomeName;
  const overlayLabel = MODE_OVERLAY_LABELS[activeMode];
  const isStaticOverlay = isBars || !!overlayLabel;

  useEffect(() => {
    if (isControlled) return;
    let cancelled = false;
    function loadOnce() {
      getSettings()
        .then((s) => {
          if (cancelled) return;
          const m = normalizeMode(s.activeMode);
          if (isValidMode(m) && m !== activeModeRef.current) setActiveMode(m);
        })
        .catch(() => {});
    }
    loadOnce();
    const id = setInterval(loadOnce, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isControlled]);

  useEffect(() => {
    if (isControlled) return;
    function onKeyDown(e) {
      const mode = KEY_TO_MODE[e.key];
      if (!mode) return;
      if (activeModeRef.current === mode) return;
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
      }).catch(() => {});
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isControlled]);

  useEffect(() => {
    if (isWelcomeCliente) {
      textTickerLayer.setText(buildWelcomeMessage(welcomeName));
    }
  }, [isWelcomeCliente, welcomeName]);

  useEffect(() => {
    if (isPanteraVideo) return;
    const canvasA = loopARef.current;
    const canvasB = loopBRef.current;
    if (!canvasA || !canvasB) return;

    canvasA.width = PANEL_WIDTH;
    canvasA.height = PANEL_HEIGHT;
    canvasB.width = PANEL_WIDTH;
    canvasB.height = PANEL_HEIGHT;
    const ctxA = canvasA.getContext("2d");
    const ctxB = canvasB.getContext("2d");
    ctxA.imageSmoothingEnabled = true;
    ctxA.imageSmoothingQuality = "high";
    ctxB.imageSmoothingEnabled = true;
    ctxB.imageSmoothingQuality = "high";

    const offscreen = document.createElement("canvas");
    offscreen.width = PANEL_WIDTH;
    offscreen.height = PANEL_HEIGHT;
    const offCtx = offscreen.getContext("2d");
    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = "high";

    const cycleCanvas = document.createElement("canvas");
    const cycleCtx = cycleCanvas.getContext("2d");
    cycleCtx.imageSmoothingEnabled = true;
    cycleCtx.imageSmoothingQuality = "high";

    const bgPromise = background.ensureLoaded();
    goalsTicker.ensureLoaded?.();
    colaboradorTickerLayer.setText(COLAB_MESSAGE);
    const colabImgPromise = colaboradorTickerLayer.ensureLoaded();
    if (!isBars && !isWelcomeColaborador) ensureGoals();

    let raf;
    let cancelled = false;

    function renderOffscreen() {
      const W = PANEL_WIDTH;
      const H = PANEL_HEIGHT;
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.clearRect(0, 0, W, H);

      if (isBars) {
        barsTest.render(offCtx, { width: W, height: H, progress: 0 });
        return;
      }

      background.render(offCtx, { width: W, height: H, progress: 0 });

      if (overlayLabel) {
        drawModeOverlay(offCtx, W, H, overlayLabel);
        return;
      }

      const tickerSrc = isWelcomeColaborador
        ? colaboradorTickerLayer
        : isWelcomeCliente
          ? textTickerLayer
          : goalsTicker;

      offCtx.font = CONFIG.TICKER.FONT;
      const naturalCycle = Math.max(
        1,
        Math.round(tickerSrc.measureCycle(offCtx, H)),
      );

      const N = naturalCycle <= W
        ? Math.max(1, Math.floor(W / naturalCycle))
        : 1;
      const eff = W / N;

      ensureSize(cycleCanvas, naturalCycle, H);
      cycleCtx.setTransform(1, 0, 0, 1, 0, 0);
      cycleCtx.clearRect(0, 0, naturalCycle, H);
      tickerSrc.render(cycleCtx, {
        width: naturalCycle,
        height: H,
        progress: 0,
      });

      offCtx.save();
      offCtx.beginPath();
      offCtx.rect(0, 0, W, H);
      offCtx.clip();
      const needScale = naturalCycle > eff;
      for (let i = 0; i < N; i++) {
        const x = i * eff;
        if (needScale) {
          offCtx.drawImage(cycleCanvas, 0, 0, naturalCycle, H, x, 0, eff, H);
        } else {
          offCtx.drawImage(cycleCanvas, x, 0);
        }
      }
      offCtx.restore();

      if (debugSeam) {
        offCtx.save();
        offCtx.shadowColor = "transparent";
        offCtx.shadowBlur = 0;
        offCtx.strokeStyle = "#f0f";
        offCtx.lineWidth = 2;
        offCtx.fillStyle = "#f0f";
        offCtx.font = "900 24px Montserrat, Arial, sans-serif";
        offCtx.textBaseline = "top";
        offCtx.textAlign = "left";
        for (let i = 0; i < N; i++) {
          const x = i * eff;
          offCtx.beginPath();
          offCtx.moveTo(Math.round(x) + 0.5, 0);
          offCtx.lineTo(Math.round(x) + 0.5, H);
          offCtx.stroke();
          offCtx.fillText(`tile #${i} x=${Math.round(x)}`, x + 6, 4);
        }
        offCtx.restore();
      }
    }

    function paintCopies() {
      ctxA.setTransform(1, 0, 0, 1, 0, 0);
      ctxA.clearRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
      ctxA.drawImage(offscreen, 0, 0);

      ctxB.setTransform(1, 0, 0, 1, 0, 0);
      ctxB.clearRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
      ctxB.drawImage(offscreen, 0, 0);

      if (debugModules) {
        drawModulesOverlay(ctxA, PANEL_WIDTH, PANEL_HEIGHT);
        drawModulesOverlay(ctxB, PANEL_WIDTH, PANEL_HEIGHT);
      }
    }

    function loop() {
      if (cancelled) return;
      renderOffscreen();
      paintCopies();
      raf = requestAnimationFrame(loop);
    }

    (async () => {
      if (document.fonts) await document.fonts.ready;
      await bgPromise;
      if (isWelcomeColaborador) await colabImgPromise;
      if (cancelled) return;
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    isBars,
    debugModules,
    debugSeam,
    isPanteraVideo,
    isWelcomeColaborador,
    isWelcomeCliente,
    overlayLabel,
  ]);

  const panteraPath = CONFIG.VIDEO_MODES.PANTERA?.path ?? "/assets/pantera.mp4";
  const speed = CONFIG.TICKER.SPEED_PX_PER_SECOND || 180;
  const duration = `${(PANEL_WIDTH / speed).toFixed(3)}s`;

  const screenStyle = {
    "--panel-w": `${PANEL_WIDTH}px`,
    "--panel-h": `${PANEL_HEIGHT}px`,
    "--duration": duration,
  };

  if (isPanteraVideo) {
    return (
      <div className="ledScreen" style={screenStyle}>
        <video
          src={panteraPath}
          autoPlay
          loop
          muted
          playsInline
          className="ledVideo"
        />
      </div>
    );
  }

  if (isStaticOverlay) {
    return (
      <div className="ledScreen" style={screenStyle}>
        <canvas ref={loopARef} className="ledStaticCanvas" />
        <canvas ref={loopBRef} style={{ display: "none" }} />
      </div>
    );
  }

  return (
    <div className="ledScreen" style={screenStyle}>
      <div className="ticker">
        <section className="loop">
          <canvas ref={loopARef} />
        </section>
        <section className="loop" aria-hidden="true">
          <canvas ref={loopBRef} />
        </section>
      </div>
    </div>
  );
}

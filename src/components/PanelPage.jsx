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

// Tile da sequência do ticker dentro da viewport, 1:1.
// Wrap por `total` (largura natural da sequência).
function drawTickerTiled(ctx, items, total, offset, W) {
  const cycle = Math.max(1, total);
  const wrapped = ((offset % cycle) + cycle) % cycle;
  for (let baseX = -cycle; baseX < W + cycle; baseX += cycle) {
    for (const item of items) {
      const drawX = item.x + baseX - wrapped;
      if (drawX + item.w < 0 || drawX > W) continue;
      item.draw(ctx, drawX);
    }
  }
}

export default function PanelPage({
  embedded = false,
  activeMode: controlledMode,
  welcomeName = "",
} = {}) {
  void embedded;
  const canvasRef = useRef(null);
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas interno fixo 2112x192. CSS força mesmo tamanho. Sem DPR, sem scale.
    canvas.width = PANEL_WIDTH;
    canvas.height = PANEL_HEIGHT;
    canvas.style.width = `${PANEL_WIDTH}px`;
    canvas.style.height = `${PANEL_HEIGHT}px`;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const bgPromise = background.ensureLoaded();
    goalsTicker.ensureLoaded?.();
    colaboradorTickerLayer.setText(COLAB_MESSAGE);
    const colabImgPromise = colaboradorTickerLayer.ensureLoaded();
    if (!isBars && !isWelcomeColaborador) ensureGoals();

    let raf;
    let cancelled = false;
    let offset = 0;
    let lastT = 0;
    const speed = CONFIG.TICKER.SPEED_PX_PER_SECOND || 180;

    function frame(t) {
      if (cancelled) return;
      if (!lastT) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;

      const W = PANEL_WIDTH;
      const H = PANEL_HEIGHT;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (isBars) {
        barsTest.render(ctx, { width: W, height: H, progress: 0 });
        if (debugModules) drawModulesOverlay(ctx, W, H);
        raf = requestAnimationFrame(frame);
        return;
      }

      background.render(ctx, { width: W, height: H, progress: 0 });

      if (overlayLabel) {
        drawModeOverlay(ctx, W, H, overlayLabel);
        if (debugModules) drawModulesOverlay(ctx, W, H);
        raf = requestAnimationFrame(frame);
        return;
      }

      offset += speed * dt;

      const tickerSrc = isWelcomeColaborador
        ? colaboradorTickerLayer
        : isWelcomeCliente
          ? textTickerLayer
          : goalsTicker;

      ctx.font = CONFIG.TICKER.FONT;
      const { items, total } = tickerSrc.getItems(ctx, H);
      if (total > 0) offset = ((offset % total) + total) % total;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      drawTickerTiled(ctx, items, total, offset, W);
      ctx.restore();

      if (debugSeam) {
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#f0f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0.5, 0);
        ctx.lineTo(0.5, H);
        ctx.moveTo(W - 0.5, 0);
        ctx.lineTo(W - 0.5, H);
        ctx.stroke();
        ctx.fillStyle = "#f0f";
        ctx.font = "900 18px Montserrat, Arial, sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText(`PW=${W} off=${offset.toFixed(1)} cycle=${total}`, 8, 4);
        ctx.restore();
      }

      if (debugModules) drawModulesOverlay(ctx, W, H);

      raf = requestAnimationFrame(frame);
    }

    (async () => {
      if (document.fonts) await document.fonts.ready;
      await bgPromise;
      if (isWelcomeColaborador) await colabImgPromise;
      if (cancelled) return;
      raf = requestAnimationFrame(frame);
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

  if (isPanteraVideo) {
    return (
      <div className="ledScreen">
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

  return (
    <div className="ledScreen">
      <canvas
        ref={canvasRef}
        className="ledCanvas"
        width={PANEL_WIDTH}
        height={PANEL_HEIGHT}
      />
    </div>
  );
}

// PanelPage.jsx
// Render do painel circular via espelhamento de tela. Canvas full-screen
// (100vw × 100vh) — 16 módulos recebem pixels úteis via tile vertical.
//
// Pipeline:
//   1) cycleCanvas (offscreen, cycleWidth × bandH): renderiza UM ciclo
//      fechado do ticker (ícone+texto+separador). Bg transparente.
//   2) bandCanvas  (offscreen, W × bandH): bg full-width + drawImage do
//      cycleCanvas tilado horizontalmente em offsets inteiros.
//   3) main canvas (W × H): drawImage do bandCanvas tilado verticalmente.
//
// Vantagem: cada ciclo é bit-exact (drawImage de bitmap, não re-render
// de texto), então emenda do loop X é pixel-perfect, sem deriva sub-pixel.
//
// Sem stretch vertical. Sem áreas pretas (tile cobre H inteiro).
// Debug só com ?debug=modules.

import { useEffect, useRef, useState } from "react";
import { CONFIG } from "../config.js";
import * as background from "../layers/backgroundLayer.js";
import * as goalsTicker from "../layers/goalsTickerLayer.js";
import * as colaboradorTickerLayer from "../layers/colaboradorTickerLayer.js";
import * as barsTest from "../layers/barsTestLayer.js";
import { ensureLoaded as ensureGoals } from "../services/goalsService.js";
import { getSettings, saveSettings } from "../services/settingsService.js";

const COLAB_MESSAGE = "SEJAM BEM VINDOS A TOCA DA PANTERA";

const REF_W = 2048;
const REF_H = 192;
const MODULE_COUNT = 16;
const DEFAULT_BAND_MUL = 1.1;
const DEFAULT_CYCLE_GAP = 0;

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
function normalizeMode(m) { return LEGACY_MODE_ALIAS[m] ?? m; }
function isValidMode(m) {
  return typeof m === "string" && Object.values(CONFIG.MODES).includes(m);
}

function numParam(p, key, def, validate = (n) => Number.isFinite(n)) {
  const raw = p.get(key);
  if (raw === null || raw === "") return def;
  const n = Number(raw);
  return validate(n) ? n : def;
}

function readParams() {
  if (typeof window === "undefined") {
    return {
      test: null,
      debug: null,
      bandMul: DEFAULT_BAND_MUL,
      cycleGap: DEFAULT_CYCLE_GAP,
    };
  }
  const p = new URLSearchParams(window.location.search);
  return {
    test: p.get("test"),
    debug: p.get("debug"),
    bandMul: numParam(p, "bandMul", DEFAULT_BAND_MUL, (n) => Number.isFinite(n) && n > 0),
    cycleGap: Math.max(0, Math.round(numParam(p, "cycleGap", DEFAULT_CYCLE_GAP))),
  };
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

export default function PanelPage() {
  const canvasRef = useRef(null);
  const { test, debug, bandMul, cycleGap } = readParams();
  const isBars = test === "bars";
  const debugModules = debug === "modules";
  const debugSeam = debug === "seam";

  const [activeMode, setActiveMode] = useState(CONFIG.ACTIVE_MODE_DEFAULT);
  const activeModeRef = useRef(activeMode);
  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
  const isPanteraVideo = activeMode === CONFIG.MODES.PANTERA_VIDEO;
  const isWelcomeColaborador = activeMode === CONFIG.MODES.BEM_VINDO_COLABORADOR;

  const [viewportW, setViewportW] = useState(
    typeof window !== "undefined" ? window.innerWidth : REF_W
  );
  useEffect(() => {
    function onResize() { setViewportW(window.innerWidth); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const bandH = Math.max(1, Math.round(viewportW * REF_H / REF_W * bandMul));

  useEffect(() => {
    let cancelled = false;
    function loadOnce() {
      getSettings().then((s) => {
        if (cancelled) return;
        const m = normalizeMode(s.activeMode);
        if (isValidMode(m) && m !== activeModeRef.current) setActiveMode(m);
      }).catch(() => {});
    }
    loadOnce();
    const id = setInterval(loadOnce, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (isPanteraVideo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const cycleCanvas = document.createElement("canvas");
    const cycleCtx = cycleCanvas.getContext("2d");
    const bandCanvas = document.createElement("canvas");
    const bandCtx = bandCanvas.getContext("2d");

    const view = { W: 0, H: 0, dpr: 1 };

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = Math.max(1, Math.round(w * REF_H / REF_W * bandMul));
      canvas.style.width = "100vw";
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      view.W = w;
      view.H = h;
      view.dpr = dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    const bgPromise = background.ensureLoaded();
    goalsTicker.ensureLoaded?.();
    colaboradorTickerLayer.setText(COLAB_MESSAGE);
    const colabImgPromise = colaboradorTickerLayer.ensureLoaded();
    if (!isBars && !isWelcomeColaborador) ensureGoals();

    let raf;
    let cancelled = false;
    let elapsedSec = 0;
    let lastT = 0;
    const speed = CONFIG.TICKER.SPEED_PX_PER_SECOND;

    function ensureSize(c, w, h) {
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    }

    function loop(t) {
      if (!lastT) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;
      elapsedSec += dt;

      const W = view.W;
      const H = view.H;
      if (W <= 0 || H <= 0) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const bandH = H;

      ensureSize(bandCanvas, W, bandH);
      bandCtx.setTransform(1, 0, 0, 1, 0, 0);
      bandCtx.imageSmoothingEnabled = true;
      bandCtx.imageSmoothingQuality = "high";

      if (isBars) {
        bandCtx.clearRect(0, 0, W, bandH);
        barsTest.render(bandCtx, { width: W, height: bandH, progress: 0 });
      } else {
        const tickerSrc = isWelcomeColaborador ? colaboradorTickerLayer : goalsTicker;
        bandCtx.font = CONFIG.TICKER.FONT;
        const naturalCycle = Math.max(1, Math.round(tickerSrc.measureCycle(bandCtx, bandH)));
        const cycleW = naturalCycle + cycleGap;

        ensureSize(cycleCanvas, cycleW, bandH);
        cycleCtx.setTransform(1, 0, 0, 1, 0, 0);
        cycleCtx.imageSmoothingEnabled = true;
        cycleCtx.imageSmoothingQuality = "high";
        cycleCtx.clearRect(0, 0, cycleW, bandH);
        tickerSrc.render(cycleCtx, { width: naturalCycle, height: bandH, progress: 0 });

        bandCtx.clearRect(0, 0, W, bandH);
        background.render(bandCtx, { width: W, height: bandH, progress: 0 });

        const offset = Math.floor(((elapsedSec * speed) % cycleW + cycleW) % cycleW);
        for (let x = -offset; x < W; x += cycleW) {
          bandCtx.drawImage(cycleCanvas, x, 0);
        }

        if (debugSeam) {
          bandCtx.save();
          bandCtx.shadowColor = "transparent";
          bandCtx.shadowBlur = 0;
          bandCtx.strokeStyle = "#f0f";
          bandCtx.lineWidth = 2;
          bandCtx.fillStyle = "#f0f";
          bandCtx.font = "900 24px Montserrat, Arial, sans-serif";
          bandCtx.textBaseline = "top";
          bandCtx.textAlign = "left";
          let k = 0;
          for (let x = -offset; x < W; x += cycleW) {
            bandCtx.beginPath();
            bandCtx.moveTo(Math.round(x) + 0.5, 0);
            bandCtx.lineTo(Math.round(x) + 0.5, bandH);
            bandCtx.stroke();
            bandCtx.fillText(`seam #${k++} x=${Math.round(x)}`, x + 6, 4);
          }
          bandCtx.restore();
        }
      }

      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      ctx.drawImage(bandCanvas, 0, 0);

      if (debugModules) drawModulesOverlay(ctx, W, H);

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
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isBars, debugModules, debugSeam, bandMul, cycleGap, isPanteraVideo, isWelcomeColaborador]);

  const panteraPath = CONFIG.VIDEO_MODES.PANTERA?.path ?? "/assets/pantera.mp4";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {isPanteraVideo ? (
        <video
          src={panteraPath}
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "block",
            width: "100vw",
            height: `${bandH}px`,
            objectFit: "cover",
            background: "#000",
            margin: 0,
            padding: 0,
            border: 0,
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "block",
            width: "100vw",
            height: `${bandH}px`,
            margin: 0,
            padding: 0,
            border: 0,
          }}
        />
      )}
    </div>
  );
}

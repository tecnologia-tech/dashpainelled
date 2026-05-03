// PanelPage.jsx
// Render do painel circular via espelhamento de tela. Canvas ocupa
// 100vw × 100vh. Painel quebra essa tela em pedaços pelo anel — toda
// área visível precisa conter pixels úteis do dash, sem áreas pretas.
//
// Estratégia: render do dash em offscreen (W × bandH) e blit no main
// canvas em modo `tile` (repete vertical) ou `stretch` (estica vertical).
// Default = tile.
//
// Bitmap = innerWidth*dpr × innerHeight*dpr (HiDPI). Coordenadas de
// desenho em CSS px via setTransform(dpr,...).

import { useEffect, useRef } from "react";
import { CONFIG } from "../config.js";
import * as background from "../layers/backgroundLayer.js";
import * as goalsTicker from "../layers/goalsTickerLayer.js";
import * as barsTest from "../layers/barsTestLayer.js";
import { ensureLoaded as ensureGoals } from "../services/goalsService.js";

const REF_W = 2048;
const REF_H = 192;
const MODULE_COUNT = 16;

function readParams() {
  if (typeof window === "undefined") {
    return { test: null, debug: null, fill: "tile" };
  }
  const p = new URLSearchParams(window.location.search);
  const fillRaw = p.get("fill");
  const fill = fillRaw === "stretch" ? "stretch" : "tile";
  return { test: p.get("test"), debug: p.get("debug"), fill };
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
  const { test, debug, fill } = readParams();
  const isBars = test === "bars";
  const debugModules = debug === "modules";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const offCanvas = document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d");

    const view = { W: 0, H: 0, dpr: 1 };

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
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
    if (!isBars) ensureGoals();

    let raf;
    let cancelled = false;
    let elapsedSec = 0;
    let lastT = 0;
    const speed = CONFIG.TICKER.SPEED_PX_PER_SECOND;

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

      const bandH = Math.max(1, Math.round(W * REF_H / REF_W));

      if (offCanvas.width !== W || offCanvas.height !== bandH) {
        offCanvas.width = W;
        offCanvas.height = bandH;
      }
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = "high";
      offCtx.clearRect(0, 0, W, bandH);

      if (isBars) {
        barsTest.render(offCtx, { width: W, height: bandH, progress: 0 });
      } else {
        const cycle = goalsTicker.measureCycle(offCtx);
        const period = cycle / Math.max(1, speed);
        const progress = (elapsedSec / period) % 1;
        const bandState = { width: W, height: bandH, progress };
        background.render(offCtx, bandState);
        goalsTicker.render(offCtx, bandState);
      }

      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      if (fill === "stretch") {
        ctx.drawImage(offCanvas, 0, 0, W, bandH, 0, 0, W, H);
      } else {
        for (let y = 0; y < H; y += bandH) {
          ctx.drawImage(offCanvas, 0, y);
        }
      }

      if (debugModules) drawModulesOverlay(ctx, W, H);

      raf = requestAnimationFrame(loop);
    }

    (async () => {
      if (document.fonts) await document.fonts.ready;
      await bgPromise;
      if (cancelled) return;
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isBars, debugModules, fill]);

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
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100vw",
          height: "100vh",
          margin: 0,
          padding: 0,
          border: 0,
        }}
      />
    </div>
  );
}

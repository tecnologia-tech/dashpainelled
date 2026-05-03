// PanelPage.jsx
// Render do painel circular via espelhamento de tela. Canvas ocupa
// 100vw × 100vh do notebook. Painel físico recebe a viewport visível
// inteira escalada nos 16 módulos. Sem largura fixa em pixels.
//
// Bitmap = innerWidth*dpr × innerHeight*dpr (HiDPI). Coordenadas de
// desenho em CSS px via setTransform(dpr,...).
//
// Strip do ticker: 2048:192 proporcional a W. stripH = round(W * 192/2048).

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
  if (typeof window === "undefined") return { test: null, debug: null };
  const p = new URLSearchParams(window.location.search);
  return { test: p.get("test"), debug: p.get("debug") };
}

function drawModulesOverlay(ctx, W, stripH) {
  const moduleW = W / MODULE_COUNT;
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.font = `900 ${Math.round(stripH * 0.45)}px Montserrat, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let i = 0; i < MODULE_COUNT; i++) {
    const x = i * moduleW;
    ctx.lineWidth = 2;
    ctx.strokeStyle = i % 2 ? "#0f0" : "#00f";
    ctx.strokeRect(x + 1, 1, moduleW - 2, stripH - 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000";
    ctx.strokeText(String(i + 1), x + moduleW / 2, stripH / 2);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + moduleW / 2, stripH / 2);
  }
  ctx.restore();
}

export default function PanelPage() {
  const canvasRef = useRef(null);
  const { test, debug } = readParams();
  const isBars = test === "bars";
  const debugModules = debug === "modules";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

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

      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const W = view.W;
      const H = view.H;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      const stripW = W;
      const stripH = Math.round(W * REF_H / REF_W);
      const stripY = 0;

      ctx.save();
      ctx.translate(0, stripY);

      if (isBars) {
        barsTest.render(ctx, { width: stripW, height: stripH, progress: 0 });
      } else {
        const cycle = goalsTicker.measureCycle(ctx);
        const period = cycle / Math.max(1, speed);
        const progress = (elapsedSec / period) % 1;
        const stripState = { width: stripW, height: stripH, progress };
        background.render(ctx, stripState);
        goalsTicker.render(ctx, stripState);
      }

      ctx.restore();

      if (debugModules) {
        ctx.save();
        ctx.translate(0, stripY);
        drawModulesOverlay(ctx, W, stripH);
        ctx.restore();
      }

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
  }, [isBars, debugModules]);

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

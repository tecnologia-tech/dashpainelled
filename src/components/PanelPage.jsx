// PanelPage.jsx
// Render fixo do painel circular. Sinal Windows = 2112x1048. Pixel mapping
// 1:1, sem layout responsivo, sem viewport units, sem transforms, sem flex.
// Canvas único cobrindo toda a tela. Faixa do ticker no topo (STRIP_H px).
// Resto preto. Debug opcional via ?debug=modules. Bars test via ?test=bars.

import { useEffect, useRef } from "react";
import { CONFIG } from "../config.js";
import * as background from "../layers/backgroundLayer.js";
import * as goalsTicker from "../layers/goalsTickerLayer.js";
import * as barsTest from "../layers/barsTestLayer.js";
import { ensureLoaded as ensureGoals } from "../services/goalsService.js";

const SCREEN_W = 2112;
const SCREEN_H = 1048;
const MODULE_COUNT = 16;
const MODULE_W = 132;
const STRIP_Y = 0;
const STRIP_H = 192; // alinhado a CONFIG.HEIGHT/TICKER.TEXT_Y. Não usar 180 sem reajustar TEXT_Y.

// Compensação horizontal do sinal capturado pelo painel.
// Painel físico mostra apenas 12/16 módulos quando scaleX=1 → 16/12 = 1.333333
// estica visualmente o canvas para preencher os 16 módulos.
const DEFAULT_SCALE_X = 1.333333;

function readParams() {
  if (typeof window === "undefined") {
    return { test: null, debug: null, scaleX: DEFAULT_SCALE_X };
  }
  const p = new URLSearchParams(window.location.search);
  const raw = p.get("scaleX");
  let scaleX = DEFAULT_SCALE_X;
  if (raw !== null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) scaleX = n;
  }
  return { test: p.get("test"), debug: p.get("debug"), scaleX };
}

function drawModulesOverlay(ctx) {
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.font = "900 56px Montserrat, Arial, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  for (let i = 0; i < MODULE_COUNT; i++) {
    const x = i * MODULE_W;
    ctx.strokeStyle = i % 2 ? "#0f0" : "#00f";
    ctx.strokeRect(x + 1, STRIP_Y + 1, MODULE_W - 2, STRIP_H - 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000";
    ctx.strokeText(String(i + 1), x + 12, STRIP_Y + 12);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + 12, STRIP_Y + 12);
    ctx.lineWidth = 2;
  }
  ctx.restore();
}

export default function PanelPage() {
  const canvasRef = useRef(null);
  const { test, debug, scaleX } = readParams();
  const isBars = test === "bars";
  const debugModules = debug === "modules";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    canvas.style.width = SCREEN_W + "px";
    canvas.style.height = SCREEN_H + "px";

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

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

      ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

      const stripState = { width: SCREEN_W, height: STRIP_H, progress: 0 };

      ctx.save();
      ctx.translate(0, STRIP_Y);

      if (isBars) {
        barsTest.render(ctx, stripState);
      } else {
        const cycle = goalsTicker.measureCycle(ctx);
        const period = cycle / Math.max(1, speed);
        stripState.progress = (elapsedSec / period) % 1;
        background.render(ctx, stripState);
        goalsTicker.render(ctx, stripState);
      }

      ctx.restore();

      if (debugModules) drawModulesOverlay(ctx);

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
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isBars, debugModules]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: SCREEN_W * scaleX + "px",
        height: SCREEN_H + "px",
        margin: 0,
        padding: 0,
        background: "#000",
        overflow: "hidden",
        transformOrigin: "top left",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          position: "absolute",
          top: 0,
          left: 0,
          width: SCREEN_W + "px",
          height: SCREEN_H + "px",
          margin: 0,
          padding: 0,
          border: 0,
          transformOrigin: "top left",
          transform: `scaleX(${scaleX})`,
        }}
      />
    </div>
  );
}

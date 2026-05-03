import { useEffect, useRef } from "react";
import { CONFIG } from "../config.js";
import * as background from "../layers/backgroundLayer.js";
import * as goalsTicker from "../layers/goalsTickerLayer.js";
import { ensureLoaded as ensureGoals, getGoalsStatus } from "../services/goalsService.js";

/**
 * LedCanvas
 * - canvas interno em CONFIG.WIDTH x CONFIG.HEIGHT (2048x192).
 * - CSS escala mantendo proporção (contain) na viewport.
 * - requestAnimationFrame conduz progress do loop.
 * - reporta métricas para o pai a cada ~250ms.
 */
function drawModulesDebug(ctx, W, H) {
  const moduleCount = CONFIG.PANEL?.MODULE_COUNT | 0;
  const moduleWidth = CONFIG.PANEL?.MODULE_WIDTH | 0;
  if (moduleCount <= 0 || moduleWidth <= 0) return;
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  for (let i = 0; i < moduleCount; i++) {
    ctx.fillStyle = i % 2 === 0
      ? "rgba(0, 80, 200, 0.55)"
      : "rgba(0, 160, 60, 0.55)";
    ctx.fillRect(i * moduleWidth, 0, moduleWidth, H);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 110px Montserrat, Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000000";
  ctx.lineJoin = "round";
  for (let i = 0; i < moduleCount; i++) {
    const cx = i * moduleWidth + moduleWidth / 2;
    const cy = H / 2;
    const label = String(i + 1);
    ctx.strokeText(label, cx, cy);
    ctx.fillText(label, cx, cy);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1;
  for (let i = 1; i < moduleCount; i++) {
    const x = i * moduleWidth + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.strokeStyle = "#ff0000";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.restore();
}

export default function LedCanvas({
  playing,
  speed,
  onMetrics,
  onGoalsStatus,
  onIconStatus,
  tickerLayer,
  loadGoals = true,
  width,
  height,
  debugModules = false,
  offsetX = 0,
}) {
  const ticker = tickerLayer ?? goalsTicker;
  const canvasRef = useRef(null);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const debugRef = useRef(debugModules);
  const offsetRef = useRef(offsetX);
  const W = width  ?? CONFIG.WIDTH;
  const H = height ?? CONFIG.HEIGHT;

  useEffect(() => { debugRef.current = debugModules; }, [debugModules]);
  useEffect(() => { offsetRef.current = offsetX; }, [offsetX]);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current  = speed; },   [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Dispara loaders e propaga status para o pai conforme resolvem.
    const bgPromise = background.ensureLoaded();
    ticker.ensureLoaded?.().then?.(() => onIconStatus?.(ticker.getIconStatus?.() ?? {}));
    if (loadGoals) {
      ensureGoals().then(() => onGoalsStatus?.(getGoalsStatus()));
    }

    let raf;
    let cancelled = false;
    let elapsedSec = 0;
    let lastT = 0;
    let metricsAccum = 0;
    let fpsAcc = 0;
    let fpsSamples = 0;
    let lastGoalsStatus = "";

    function loop(t) {
      if (!lastT) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;

      if (dt > 0) {
        fpsAcc += 1 / dt;
        fpsSamples++;
      }

      if (playingRef.current) elapsedSec += dt;

      const cycle = ticker.measureCycle(ctx, { width: W });
      const period = cycle / Math.max(1, speedRef.current);
      const progress = (elapsedSec / period) % 1;
      const tickerOffsetX = -(progress * cycle);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const state = {
        width: W,
        height: H,
        progress,
      };

      const rawOffset = offsetRef.current | 0;
      const ox = ((rawOffset % W) + W) % W;

      const drawAll = () => {
        background.render(ctx, state);
        ticker.render(ctx, state);
        if (debugRef.current) drawModulesDebug(ctx, W, H);
      };

      ctx.save(); ctx.translate(ox, 0); drawAll(); ctx.restore();
      if (ox !== 0) {
        ctx.save(); ctx.translate(ox - W, 0); drawAll(); ctx.restore();
      }

      metricsAccum += dt;
      if (metricsAccum >= 0.25) {
        const fps = fpsSamples ? fpsAcc / fpsSamples : 0;
        onMetrics?.({ fps, progress, cycle, offsetX: tickerOffsetX });

        if (loadGoals) {
          const gs = getGoalsStatus();
          if (gs !== lastGoalsStatus) {
            lastGoalsStatus = gs;
            onGoalsStatus?.(gs);
          }
        }
        onIconStatus?.(ticker.getIconStatus?.() ?? {});

        metricsAccum = 0;
        fpsAcc = 0;
        fpsSamples = 0;
      }

      raf = requestAnimationFrame(loop);
    }

    (async () => {
      if (document.fonts) {
        await document.fonts.ready;
      }
      await bgPromise;
      if (cancelled) return;
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [onMetrics, onGoalsStatus, onIconStatus, ticker, loadGoals, W, H]);

  return (
    <div className="led-stage">
      <canvas ref={canvasRef} className="led-canvas" />
    </div>
  );
}

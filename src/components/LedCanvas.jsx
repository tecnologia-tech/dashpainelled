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
export default function LedCanvas({
  playing,
  speed,
  onMetrics,
  onGoalsStatus,
  onIconStatus,
  tickerLayer,
  loadGoals = true,
}) {
  const ticker = tickerLayer ?? goalsTicker;
  const canvasRef = useRef(null);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current  = speed; },   [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = CONFIG.WIDTH;
    canvas.height = CONFIG.HEIGHT;
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

      const cycle = ticker.measureCycle(ctx);
      const period = cycle / Math.max(1, speedRef.current);
      const progress = (elapsedSec / period) % 1;
      const offsetX = -(progress * cycle);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const state = {
        width: CONFIG.WIDTH,
        height: CONFIG.HEIGHT,
        progress,
      };

      ctx.save(); background.render(ctx, state); ctx.restore();
      ctx.save(); ticker.render(ctx, state);     ctx.restore();

      metricsAccum += dt;
      if (metricsAccum >= 0.25) {
        const fps = fpsSamples ? fpsAcc / fpsSamples : 0;
        onMetrics?.({ fps, progress, cycle, offsetX });

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
  }, [onMetrics, onGoalsStatus, onIconStatus, ticker, loadGoals]);

  return (
    <div className="led-stage">
      <canvas ref={canvasRef} className="led-canvas" />
    </div>
  );
}

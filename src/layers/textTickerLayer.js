// textTickerLayer.js
// Render de mensagem única em ticker infinito, mesmo loop visual do goalsTicker.

import { CONFIG } from "../config.js";

const FALLBACK_GAP = 600;

let currentText = "";

export const id = "textTicker";

export function setText(s) {
  currentText = String(s ?? "");
}

export function getText() {
  return currentText;
}

export function ensureLoaded() {
  return Promise.resolve();
}

export function getIconStatus() {
  return {};
}

/**
 * Cycle paddado para múltiplo de CONFIG.WIDTH. Garante emenda perfeita
 * na borda do canvas para painel circular.
 */
function cycleWidth(ctx) {
  const w = Math.ceil(ctx.measureText(currentText).width);
  const minGap = (CONFIG.TICKER.GAP | 0) || FALLBACK_GAP;
  const natural = w + minGap;
  const N = Math.max(1, Math.ceil(natural / CONFIG.WIDTH));
  return N * CONFIG.WIDTH;
}

export function measureCycle(ctx) {
  if (!currentText) return 1;
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const total = cycleWidth(ctx);
  ctx.font = prevFont;
  return total;
}

function drawAt(ctx, x) {
  const fillColor = CONFIG.TICKER.COLOR;
  if (CONFIG.TICKER.SHADOW) {
    ctx.shadowColor   = fillColor;
    ctx.shadowBlur    = CONFIG.TICKER.SHADOW_BLUR;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  if (CONFIG.TICKER.STROKE) {
    ctx.lineWidth   = CONFIG.TICKER.STROKE_WIDTH;
    ctx.strokeStyle = CONFIG.TICKER.STROKE_COLOR;
    ctx.lineJoin    = "round";
    ctx.miterLimit  = 2;
    ctx.strokeText(currentText, x, CONFIG.TICKER.TEXT_Y);
  }
  ctx.fillStyle = fillColor;
  ctx.fillText(currentText, x, CONFIG.TICKER.TEXT_Y);
}

export function render(ctx, state) {
  if (!currentText) return;

  ctx.font = CONFIG.TICKER.FONT;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const cycle  = cycleWidth(ctx);
  if (cycle <= 0) return;
  const offset = Math.floor(-((state.progress % 1) * cycle));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  ctx.clip();
  for (let x = offset; x < CONFIG.WIDTH + cycle; x += cycle) {
    drawAt(ctx, x);
  }
  ctx.restore();
}

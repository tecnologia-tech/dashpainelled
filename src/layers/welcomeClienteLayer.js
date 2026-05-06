import { CONFIG } from "../config.js";

const TEXT_COLOR = "#FFFFFF";

let currentName = "";

export const id = "welcomeCliente";

export function setName(name) {
  currentName = String(name ?? "").trim().toUpperCase();
}

export function getName() {
  return currentName;
}

export function ensureLoaded() {
  return Promise.resolve();
}

export function getIconStatus() {
  return {};
}

export function buildWelcomeMessage(name) {
  const cliente = String(name ?? "").trim().toUpperCase();
  if (!cliente) {
    return "BEM-VINDO AO 12P, SUA IMPORTAÇÃO COMEÇOU!!!";
  }
  return `${cliente}, BEM-VINDO AO 12P, SUA IMPORTAÇÃO COMEÇOU!!!`;
}

function endGap() {
  return (CONFIG.TICKER.GAP | 0) || (CONFIG.TICKER_SPACING?.BULLET_PAD | 0) || 600;
}

function makeDrawer(text, y) {
  return function draw(ctx, drawX) {
    ctx.globalAlpha = 1;
    ctx.font = CONFIG.TICKER.FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    if (CONFIG.TICKER.SHADOW) {
      ctx.shadowColor = TEXT_COLOR;
      ctx.shadowBlur = CONFIG.TICKER.SHADOW_BLUR;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    if (CONFIG.TICKER.STROKE) {
      ctx.lineWidth = CONFIG.TICKER.STROKE_WIDTH;
      ctx.strokeStyle = CONFIG.TICKER.STROKE_COLOR;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(text, drawX, y);
    }
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(text, drawX, y);
  };
}

export function getItems(ctx, H) {
  const text = buildWelcomeMessage(currentName);
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const tail = endGap();
  const y = (H || CONFIG.HEIGHT) / 2;
  const w = Math.ceil(ctx.measureText(text).width);
  ctx.font = prevFont;
  const items = [
    {
      type: "text",
      x: 0,
      w,
      draw: makeDrawer(text, y),
    },
  ];
  return { items, total: w + tail };
}

export function measureCycle(ctx) {
  const text = buildWelcomeMessage(currentName);
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const w = Math.ceil(ctx.measureText(text).width);
  ctx.font = prevFont;
  return w + endGap();
}

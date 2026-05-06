import { CONFIG } from "../config.js";

const MESSAGE = "BEM-VINDO À TODA 12P";
const SEPARATOR = "•";
const NAME_COLOR = "#FFD400";
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

function segGap() {
  return (CONFIG.TICKER_SPACING?.BULLET_PAD | 0) || 80;
}

function endGap() {
  return (CONFIG.TICKER.GAP | 0) || segGap() || 600;
}

function buildSegments() {
  const safeName = currentName;
  if (!safeName) return [];
  return [
    { text: safeName, color: NAME_COLOR },
    { text: SEPARATOR, color: TEXT_COLOR },
    { text: MESSAGE, color: TEXT_COLOR },
  ];
}

function makeDrawer(text, color, y) {
  return function draw(ctx, drawX) {
    ctx.globalAlpha = 1;
    ctx.font = CONFIG.TICKER.FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    if (CONFIG.TICKER.SHADOW) {
      ctx.shadowColor = color;
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
    ctx.fillStyle = color;
    ctx.fillText(text, drawX, y);
  };
}

export function getItems(ctx, H) {
  const segments = buildSegments();
  if (segments.length === 0) return { items: [], total: 1 };

  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const gap = segGap();
  const tail = endGap();
  const y = (H || CONFIG.HEIGHT) / 2;

  const items = [];
  let cursor = 0;
  for (let i = 0; i < segments.length; i++) {
    const { text, color } = segments[i];
    const w = Math.ceil(ctx.measureText(text).width);
    items.push({
      type: "text",
      x: cursor,
      w,
      draw: makeDrawer(text, color, y),
    });
    cursor += w;
    if (i < segments.length - 1) cursor += gap;
  }
  const total = cursor + tail;
  ctx.font = prevFont;
  return { items, total };
}

export function measureCycle(ctx) {
  if (!currentName) return 1;
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const segments = buildSegments();
  const gap = segGap();
  const tail = endGap();
  let cursor = 0;
  for (let i = 0; i < segments.length; i++) {
    cursor += Math.ceil(ctx.measureText(segments[i].text).width);
    if (i < segments.length - 1) cursor += gap;
  }
  ctx.font = prevFont;
  return cursor + tail;
}

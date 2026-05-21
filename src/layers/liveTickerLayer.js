// liveTickerLayer.js
// Modo Live — sequência por ciclo:
//   [pulseDot] DOT_TO_TEXT [texto "ESTAMOS EM LIVE!!!"] TEXT_TO_DOT
//   [pulseDot] DOT_TO_LOGO [logo 12P] LOGO_TO_DOT → wrap
// Pulse dos dois dots em sincronia: ambos usam performance.now() dentro
// do draw, no mesmo frame do rAF.
// Logo 12P: mesmo asset / escala / Y de colaboradorTickerLayer.
// Convenção idêntica a goalsTickerLayer / colaboradorTickerLayer:
// exporta ensureLoaded / measureCycle / getItems / render.

import { CONFIG } from "../config.js";

// Texto bicolor: "ESTAMOS EM " branco + "LIVE!!!" vermelho.
// Espaço já está no fim do PART1, portanto os dois desenham sem gap entre si.
const PART1_TEXT = "ESTAMOS EM ";
const PART2_TEXT = "LIVE!!!";
const PART1_COLOR = "#ffffff";
const PART1_STROKE_COLOR = "#1a1a1a";
const PART1_STROKE_WIDTH = 0.8;
const PART2_COLOR = "#ff1a1a";
const PART2_STROKE_COLOR = "#3a0000";
const DOT_COLOR = "#ff1a1a";

// Logo 12P — altura local fixa, menor que colaboradorTickerLayer.
// Funciona como "pausa visual" entre repetições, não parte da frase.
const IMG_PATH = "/assets/12P.png";
const LOGO_HEIGHT_PX = 96;

// Diâmetro do dot = bandH * DOT_DIAMETER_RATIO (~27.5% da altura).
// Slot horizontal (w no item) = diâmetro — sem espaço fantasma.
const DOT_DIAMETER_RATIO = 0.275;
const PULSE_HZ = 1;

// Fallbacks caso TICKER_SPACING não esteja definido (esperado no config atual).
const FALLBACK_DOT_TO_TEXT = 24;
const FALLBACK_TEXT_TO_DOT = 24;
const FALLBACK_DOT_TO_LOGO = 80;
const FALLBACK_LOGO_TO_DOT = 80;

export const id = "liveTicker";

let img = null;
let imgPromise = null;
let imgStatus = "idle";

export function setText() {
  // hardcoded — noop intencional pra manter contrato com outros layers.
}

export function getText() {
  return PART1_TEXT + PART2_TEXT;
}

export function getIconStatus() {
  return { "12p": imgStatus };
}

export function ensureLoaded() {
  if (imgPromise) return imgPromise;
  imgStatus = "loading";
  imgPromise = new Promise((resolve) => {
    const i = new Image();
    i.onload = () => { img = i; imgStatus = "ready"; resolve(i); };
    i.onerror = () => { imgStatus = "error"; resolve(null); };
    i.src = IMG_PATH;
  });
  return imgPromise;
}
ensureLoaded();

function spacing() {
  const sp = CONFIG.TICKER_SPACING || {};
  return {
    dotToText: sp.LIVE_DOT_TO_TEXT ?? FALLBACK_DOT_TO_TEXT,
    textToDot: sp.LIVE_TEXT_TO_DOT ?? FALLBACK_TEXT_TO_DOT,
    dotToLogo: sp.LIVE_DOT_TO_LOGO ?? FALLBACK_DOT_TO_LOGO,
    logoToDot: sp.LIVE_LOGO_TO_DOT ?? FALLBACK_LOGO_TO_DOT,
  };
}

function dotDiameter(bandH) {
  return Math.max(20, Math.round((bandH ?? CONFIG.HEIGHT) * DOT_DIAMETER_RATIO));
}

function measureTextWidth(ctx, s) {
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const w = Math.ceil(ctx.measureText(s).width);
  ctx.font = prevFont;
  return w;
}

function scaledImgSize() {
  if (!img || !img.naturalWidth || !img.naturalHeight) return { w: 0, h: 0 };
  const targetH = LOGO_HEIGHT_PX;
  const scale = targetH / img.naturalHeight;
  return { w: Math.max(1, Math.round(img.naturalWidth * scale)), h: targetH };
}

function nowSec() {
  return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
}

function makeDotItem(x, diameter, bandH) {
  const r = diameter / 2;
  const cy = bandH / 2;
  return {
    type: "pulseDot",
    x,
    w: diameter,
    draw(ctx, drawX) {
      const t = nowSec();
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin(t * Math.PI * PULSE_HZ));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.fillStyle = DOT_COLOR;
      ctx.beginPath();
      ctx.arc(drawX + r, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}

function drawPart(ctx, text, drawX, y, fillColor, strokeColor, strokeWidth) {
  if (CONFIG.TICKER.SHADOW) {
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = CONFIG.TICKER.SHADOW_BLUR;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  if (strokeColor && strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(text, drawX, y);
  }
  ctx.fillStyle = fillColor;
  ctx.fillText(text, drawX, y);
}

function makeBicolorTextItem(x, totalW, part1W, y) {
  return {
    type: "text",
    x,
    w: totalW,
    draw(ctx, drawX) {
      ctx.globalAlpha = 1;
      ctx.font = CONFIG.TICKER.FONT;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      drawPart(ctx, PART1_TEXT, drawX, y, PART1_COLOR, PART1_STROKE_COLOR, PART1_STROKE_WIDTH);
      drawPart(
        ctx,
        PART2_TEXT,
        drawX + part1W,
        y,
        PART2_COLOR,
        PART2_STROKE_COLOR,
        CONFIG.TICKER.STROKE ? CONFIG.TICKER.STROKE_WIDTH : 0,
      );
    },
  };
}

function makeLogoItem(x, w, h, bandH) {
  const dy = Math.round((bandH - h) / 2);
  return {
    type: "icon",
    x,
    w,
    draw(ctx, drawX) {
      if (!img || imgStatus !== "ready") return;
      ctx.globalAlpha = 1;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.drawImage(img, drawX, dy, w, h);
    },
  };
}

function measurePhrase(ctx) {
  const part1W = measureTextWidth(ctx, PART1_TEXT);
  const part2W = measureTextWidth(ctx, PART2_TEXT);
  return { part1W, part2W, totalW: part1W + part2W };
}

export function measureCycle(ctx, bandH) {
  const H = bandH ?? CONFIG.HEIGHT;
  const { totalW: textW } = measurePhrase(ctx);
  const dotW = dotDiameter(H);
  const { w: logoW } = scaledImgSize();
  const sp = spacing();
  return (
    dotW + sp.dotToText +
    textW + sp.textToDot +
    dotW + sp.dotToLogo +
    logoW + sp.logoToDot
  );
}

export function getItems(ctx, bandH) {
  const H = bandH ?? CONFIG.HEIGHT;
  const { part1W, totalW: textW } = measurePhrase(ctx);
  const dotW = dotDiameter(H);
  const { w: logoW, h: logoH } = scaledImgSize();
  const sp = spacing();
  const y = H / 2;

  const items = [];
  let x = 0;

  // 1. pulseDot
  items.push(makeDotItem(x, dotW, H));
  x += dotW + sp.dotToText;

  // 2. texto bicolor (PART1 branco + PART2 vermelho, sem gap interno)
  items.push(makeBicolorTextItem(x, textW, part1W, y));
  x += textW + sp.textToDot;

  // 3. pulseDot
  items.push(makeDotItem(x, dotW, H));
  x += dotW + sp.dotToLogo;

  // 4. logo 12P (separador entre ciclos). Se ainda não carregou, ocupa 0 —
  // PanelPage aguarda liveImgPromise antes do primeiro frame, então isso
  // só ocorre em fallback.
  if (logoW > 0) {
    items.push(makeLogoItem(x, logoW, logoH, H));
    x += logoW;
  }
  x += sp.logoToDot;

  return { items, total: x };
}

export function render(ctx, state) {
  const W = state?.width ?? CONFIG.WIDTH;
  const H = state?.height ?? CONFIG.HEIGHT;
  const cycle = measureCycle(ctx, H);
  if (cycle <= 0) return;
  const offset = Math.floor(-((state.progress % 1) * cycle));

  const { items } = getItems(ctx, H);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  for (let baseX = offset - cycle; baseX < W + cycle; baseX += cycle) {
    for (const item of items) {
      item.draw(ctx, item.x + baseX);
    }
  }
  ctx.restore();
}

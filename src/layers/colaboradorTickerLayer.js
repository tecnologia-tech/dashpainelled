import { CONFIG } from "../config.js";

const FALLBACK_GAP = 600;
const TEXT_IMG_GAP = 40;
const IMG_HEIGHT_RATIO = 0.85;
const IMG_PATH = "/assets/12P.png";

let currentText = "";
let img = null;
let imgPromise = null;
let imgStatus = "idle";

export const id = "colaboradorTicker";

export function setText(s) { currentText = String(s ?? ""); }
export function getText() { return currentText; }
export function getIconStatus() { return { "12p": imgStatus }; }

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

function scaledImgSize(bandH) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return { w: 0, h: 0 };
  const targetH = Math.max(1, Math.round(bandH * IMG_HEIGHT_RATIO));
  const scale = targetH / img.naturalHeight;
  return { w: Math.max(1, Math.round(img.naturalWidth * scale)), h: targetH };
}

export function measureCycle(ctx, bandH) {
  if (!currentText) return 1;
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const textW = Math.ceil(ctx.measureText(currentText).width);
  ctx.font = prevFont;
  const gap = (CONFIG.TICKER.GAP | 0) || FALLBACK_GAP;
  const { w: imgW } = scaledImgSize(bandH ?? CONFIG.HEIGHT);
  const trailing = imgW > 0 ? TEXT_IMG_GAP + imgW : 0;
  return textW + trailing + gap;
}

export function getItems(ctx, bandH) {
  if (!currentText) return { items: [], total: 1 };
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const textW = Math.ceil(ctx.measureText(currentText).width);
  ctx.font = prevFont;
  const gap = (CONFIG.TICKER.GAP | 0) || FALLBACK_GAP;
  const H = bandH ?? CONFIG.HEIGHT;
  const { w: imgW, h: imgH } = scaledImgSize(H);
  const text = currentText;
  const color = CONFIG.TICKER.COLOR;

  const items = [];
  items.push({
    type: "text",
    x: 0,
    w: textW,
    draw(ctx, drawX) {
      ctx.font = CONFIG.TICKER.FONT;
      ctx.textBaseline = "alphabetic";
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
        ctx.strokeText(text, drawX, CONFIG.TICKER.TEXT_Y);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, drawX, CONFIG.TICKER.TEXT_Y);
    },
  });

  const trailing = imgW > 0 ? TEXT_IMG_GAP + imgW : 0;
  if (imgW > 0) {
    const imgX = textW + TEXT_IMG_GAP;
    const imgY = Math.round((H - imgH) / 2);
    items.push({
      type: "icon",
      x: imgX,
      w: imgW,
      draw(ctx, drawX) {
        if (!img || imgStatus !== "ready") return;
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.drawImage(img, drawX, imgY, imgW, imgH);
      },
    });
  }

  return { items, total: textW + trailing + gap };
}

function drawText(ctx, x) {
  const fillColor = CONFIG.TICKER.COLOR;
  if (CONFIG.TICKER.SHADOW) {
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = CONFIG.TICKER.SHADOW_BLUR;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  if (CONFIG.TICKER.STROKE) {
    ctx.lineWidth = CONFIG.TICKER.STROKE_WIDTH;
    ctx.strokeStyle = CONFIG.TICKER.STROKE_COLOR;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(currentText, x, CONFIG.TICKER.TEXT_Y);
  }
  ctx.fillStyle = fillColor;
  ctx.fillText(currentText, x, CONFIG.TICKER.TEXT_Y);
}

export function render(ctx, state) {
  if (!currentText) return;
  const W = state?.width ?? CONFIG.WIDTH;
  const H = state?.height ?? CONFIG.HEIGHT;

  ctx.font = CONFIG.TICKER.FONT;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  drawText(ctx, 0);

  if (img && imgStatus === "ready") {
    const textW = Math.ceil(ctx.measureText(currentText).width);
    const { w: imgW, h: imgH } = scaledImgSize(H);
    const x = textW + TEXT_IMG_GAP;
    const y = Math.round((H - imgH) / 2);
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.drawImage(img, x, y, imgW, imgH);
    ctx.restore();
  }

  void W;
}

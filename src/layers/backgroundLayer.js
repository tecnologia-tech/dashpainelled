// backgroundLayer.js
// Pinta o fundo no canvas (CONFIG.WIDTH x CONFIG.HEIGHT).
// TYPE "solid": cor sólida. TYPE "image": carrega imagem com FIT cover/contain/stretch
// e usa FALLBACK_COLOR enquanto carrega ou em erro.

import { CONFIG } from "../config.js";

export const id = "background";

let bgImage = null;
let bgStatus = "idle"; // idle | loading | ready | error
let bgPromise = null;

function tryLoad(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function ensureLoaded() {
  if (bgPromise) return bgPromise;
  if (CONFIG.BACKGROUND.TYPE !== "image" || !CONFIG.BACKGROUND.PATH) {
    bgStatus = "ready";
    bgPromise = Promise.resolve(null);
    return bgPromise;
  }
  bgStatus = "loading";
  const path = CONFIG.BACKGROUND.PATH;
  bgPromise = (async () => {
    const img = await tryLoad(path);
    if (img) {
      bgImage = img;
      bgStatus = "ready";
      console.log(`Background carregado: ${path}`);
      return img;
    }
    bgStatus = "error";
    console.warn(`Background não carregou — usando cor sólida. Caminho tentado: ${path}`);
    return null;
  })();
  return bgPromise;
}
ensureLoaded();

function fitRect(fit, sw, sh, W, H) {
  if (fit === "stretch") return { dx: 0, dy: 0, dw: W, dh: H };
  const scale = fit === "cover" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  const dw = sw * scale, dh = sh * scale;
  return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
}

export function render(ctx /*, state */) {
  const W = CONFIG.WIDTH;
  const H = CONFIG.HEIGHT;
  const cfg = CONFIG.BACKGROUND;

  const baseColor = cfg.TYPE === "solid"
    ? (cfg.COLOR || "#000")
    : (cfg.FALLBACK_COLOR || cfg.COLOR || "#000");

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, W, H);

  if (cfg.TYPE !== "image" || bgStatus !== "ready" || !bgImage) return;

  const fit = cfg.FIT || "cover";
  const { dx, dy, dw, dh } = fitRect(fit, bgImage.naturalWidth, bgImage.naturalHeight, W, H);
  ctx.drawImage(bgImage, dx, dy, dw, dh);
}

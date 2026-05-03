// barsTestLayer.js
// Modo de diagnóstico do canvas. Pinta barras animadas cobrindo state.width
// inteiro + borda vermelha. Se módulos ficarem pretos aqui, problema é
// largura/captura do canvas, não do ticker.

export const id = "barsTest";

export function ensureLoaded() {
  return Promise.resolve();
}

export function getIconStatus() {
  return {};
}

export function measureCycle() {
  return 1;
}

export function render(ctx, state) {
  const W = state?.width  ?? 0;
  const H = state?.height ?? 0;
  if (W <= 0 || H <= 0) return;

  const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;

  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const BAR = 64;
  for (let x = 0; x < W; x += BAR) {
    const k = Math.floor((x + t * 120) / BAR);
    ctx.fillStyle = (k % 2 === 0) ? "#ff0" : "#0ff";
    ctx.fillRect(x, 0, BAR, H);
  }

  ctx.fillStyle = "#fff";
  ctx.font = "900 96px Montserrat, Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000";
  ctx.lineJoin = "round";
  const label = `W=${W} H=${H}`;
  ctx.strokeText(label, 24, H / 2);
  ctx.fillText(label, 24, H / 2);

  ctx.strokeStyle = "#f00";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  ctx.restore();
}

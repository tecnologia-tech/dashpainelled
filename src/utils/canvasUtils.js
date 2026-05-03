// canvasUtils.js
// Helpers de fit/scale (caso queira customizar o preview no futuro).

export function getFitRect(mode, sw, sh, tw, th) {
  const sx = tw / sw;
  const sy = th / sh;
  const scale = mode === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
  const width  = sw * scale;
  const height = sh * scale;
  return { x: (tw - width) / 2, y: (th - height) / 2, width, height, scale };
}

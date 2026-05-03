// exporter.js
// Exporta frames PNG (.zip), spritesheet PNG e JSON metadata.
// Usa o MESMO render do preview (mesmas layers).

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { CONFIG } from "./config.js";
import * as background from "./layers/backgroundLayer.js";
import * as ticker from "./layers/goalsTickerLayer.js";
import { ensureLoaded as ensureGoals, getGoals } from "./services/goalsService.js";

async function prepare() {
  await Promise.all([
    background.ensureLoaded(),
    ticker.ensureLoaded(),
    ensureGoals(),
  ]);
  if (document.fonts) {
    await document.fonts.ready;
  }
}

function makeCanvas() {
  const c = document.createElement("canvas");
  c.width = CONFIG.WIDTH;
  c.height = CONFIG.HEIGHT;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

function renderFrame(i, total) {
  const { c, ctx } = makeCanvas();
  const progress = i / total; // nunca 1 -> evita frame duplicado no loop
  const state = { width: CONFIG.WIDTH, height: CONFIG.HEIGHT, progress };
  ctx.save(); background.render(ctx, state); ctx.restore();
  ctx.save(); ticker.render(ctx, state);     ctx.restore();
  return c;
}

function canvasToBlob(c) {
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

export async function exportFrames(frameCount, _speed, onProgress) {
  await prepare();
  const zip = new JSZip();
  const folder = zip.folder("frames");
  for (let i = 0; i < frameCount; i++) {
    const c = renderFrame(i, frameCount);
    const blob = await canvasToBlob(c);
    folder.file(`frame_${String(i).padStart(4, "0")}.png`, blob);
    onProgress?.(i + 1, frameCount);
  }
  const z = await zip.generateAsync({ type: "blob" });
  saveAs(z, `led-dash-frames-${frameCount}.zip`);
}

export async function exportSpritesheet(frameCount, _speed, onProgress) {
  await prepare();
  const cols = Math.max(1, CONFIG.EXPORT.SPRITESHEET_COLUMNS | 0);
  const rows = Math.ceil(frameCount / cols);

  const sheet = document.createElement("canvas");
  sheet.width  = CONFIG.WIDTH  * cols;
  sheet.height = CONFIG.HEIGHT * rows;
  const sctx = sheet.getContext("2d");
  sctx.imageSmoothingEnabled = false;

  for (let i = 0; i < frameCount; i++) {
    const c = renderFrame(i, frameCount);
    const cx = (i % cols) * CONFIG.WIDTH;
    const cy = Math.floor(i / cols) * CONFIG.HEIGHT;
    sctx.drawImage(c, cx, cy);
    onProgress?.(i + 1, frameCount);
  }

  const blob = await canvasToBlob(sheet);
  saveAs(blob, `led-dash-spritesheet-${frameCount}.png`);
}

export function exportMetadata(frameCount, speed) {
  const tmp = document.createElement("canvas").getContext("2d");
  const cycle = ticker.measureCycle(tmp);
  const durationSec = cycle / Math.max(1, speed);
  const fps = frameCount / durationSec;

  const meta = {
    name: "led-circular-dash",
    width: CONFIG.WIDTH,
    height: CONFIG.HEIGHT,
    frameCount,
    fps: Number(fps.toFixed(3)),
    durationSec: Number(durationSec.toFixed(3)),
    speedPxPerSec: speed,
    cyclePx: cycle,
    loop: true,
    direction: "right-to-left",
    spritesheet: {
      columns: CONFIG.EXPORT.SPRITESHEET_COLUMNS,
      rows: Math.ceil(frameCount / CONFIG.EXPORT.SPRITESHEET_COLUMNS),
    },
    goalsSnapshot: getGoals(),
    note: "progress=1 == progress=0; frame final NÃO incluso.",
  };

  saveAs(
    new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" }),
    "led-dash-metadata.json"
  );
  return meta;
}

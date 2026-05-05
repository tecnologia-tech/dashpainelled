// goalsTickerLayer.js
// Render do ticker (CONFIG.WIDTH x CONFIG.HEIGHT).
//
// Ordem dos blocos por meta (cada meta inclui dot + gap final):
//   icon -> gap LABEL_TO_ICON -> text label -> gap ICON_TO_VALUE
//   -> "Alcançado: " -> valor -> gap ICON_TO_VALUE -> "Meta: " -> meta
//   -> gap VALUE_TO_DOT -> "•" -> gap DOT_TO_NEXT_LABEL
//
// Loop perfeito: cycle = soma das larguras dos blocos + GAP.
// Conteúdo desenhado duas vezes (offset e offset+cycle).
// Em progress=1 a segunda cópia ocupa exatamente o lugar da primeira.

import { CONFIG } from "../config.js";
import { getGoals } from "../services/goalsService.js";
import { formatAtingido, formatMeta } from "../utils/dataHelpers.js";

export const id = "goalsTicker";

const METAS = [
  { iconKey: "NETO",    label: "Global 12P",     field: "meta12p",         colorKey: "GLOBAL_12P" },
  { iconKey: "CAMONHA", label: "Consultoria",    field: "metaConsultoria", colorKey: "CONSULTORIA" },
  { iconKey: "ARIANE",  label: "Novos Negócios", field: "metaLtda",        colorKey: "NOVOS_NEGOCIOS" },
];

const FALLBACK_PALETTE = { dark: "#888", mid: "#BBB", light: "#DDD", strong: "#FFF" };
function sectorPalette(colorKey) {
  const p = CONFIG.SECTOR_COLORS?.[colorKey];
  if (!p) return FALLBACK_PALETTE;
  if (typeof p === "string") return { dark: p, mid: p, light: p, strong: p };
  return { ...FALLBACK_PALETTE, ...p };
}

// --- Carregamento dos ícones ---
const icons = {}; // { NETO: { img, status } }
let iconPromise = null;

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
  if (iconPromise) return iconPromise;
  for (const m of METAS) icons[m.iconKey] = { img: null, status: "idle" };

  iconPromise = Promise.all(METAS.map(async (m) => {
    const cfg = CONFIG.ICONS?.[m.iconKey];
    if (!cfg?.PATH) {
      icons[m.iconKey] = { img: null, status: "skipped" };
      return;
    }
    icons[m.iconKey] = { img: null, status: "loading" };
    const img = await tryLoad(cfg.PATH);
    if (img) {
      icons[m.iconKey] = { img, status: "ready" };
      console.log(`Ícone ${m.iconKey} carregado: ${cfg.PATH} (${img.naturalWidth}x${img.naturalHeight})`);
    } else {
      icons[m.iconKey] = { img: null, status: "error" };
      console.warn(`Ícone ${m.iconKey} não carregou — bloco será pulado. Caminho: ${cfg.PATH}`);
    }
  }));
  return iconPromise;
}
ensureLoaded();

export function getIconStatus() {
  return Object.fromEntries(Object.entries(icons).map(([k, v]) => [k, v.status]));
}

function iconReady(key) {
  const item = icons[key];
  return item && item.status === "ready" && item.img;
}

// --- Construção dos blocos ---

function buildBlocks(ctx, goals) {
  const slot = CONFIG.ICON_SLOT;
  const sp = CONFIG.TICKER_SPACING;
  ctx.font = CONFIG.TICKER.FONT;

  const text = (s, color = CONFIG.TICKER.COLOR) => ({
    type: "text",
    text: s,
    color,
    width: Math.ceil(ctx.measureText(s).width),
  });

  const gap = (width) => ({ type: "gap", width: width | 0 });

  const icon = (key) => ({
    type: "icon",
    key,
    width: slot.WIDTH + (slot.MARGIN_X | 0),
  });

  const addGoalBlock = (blocks, label, iconKey, atingido, meta, palette) => {
    blocks.push(icon(iconKey));
    blocks.push(gap(sp.ICON_TO_LABEL));
    blocks.push(text(label, palette.mid));
    blocks.push(gap(sp.LABEL_TO_ALCANCADO));
    blocks.push(text("Alcançado:", palette.light));
    blocks.push(gap(sp.LABEL_VALUE_GAP));
    blocks.push(text(atingido, palette.strong));
    blocks.push(gap(sp.ALCANCADO_TO_META));
    blocks.push(text("Meta:", palette.light));
    blocks.push(gap(sp.LABEL_VALUE_GAP));
    blocks.push(text(meta, palette.mid));
    blocks.push(gap(sp.BULLET_PAD));
    blocks.push(text("•", "#FFFFFF"));
    blocks.push(gap(sp.BULLET_PAD));
  };

  const blocks = [];
  for (const m of METAS) {
    const entry = goals[m.field] || { atingido: 0, meta: 0 };
    addGoalBlock(
      blocks,
      m.label,
      m.iconKey,
      formatAtingido(entry.atingido),
      formatMeta(entry.meta),
      sectorPalette(m.colorKey),
    );
  }
  return blocks;
}

function drawBlocks(ctx, blocks, startX) {
  let x = startX;
  for (const b of blocks) {
    if (b.type === "text") {
      const fillColor = b.color || CONFIG.TICKER.COLOR;
      if (CONFIG.TICKER.SHADOW) {
        ctx.shadowColor   = fillColor;
        ctx.shadowBlur    = CONFIG.TICKER.SHADOW_BLUR;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      if (CONFIG.TICKER.STROKE) {
        ctx.lineWidth = CONFIG.TICKER.STROKE_WIDTH;
        ctx.strokeStyle = CONFIG.TICKER.STROKE_COLOR;
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(b.text, x, CONFIG.TICKER.TEXT_Y);
      }
      ctx.fillStyle = fillColor;
      ctx.fillText(b.text, x, CONFIG.TICKER.TEXT_Y);
    } else if (b.type === "icon" && iconReady(b.key)) {
      ctx.shadowColor   = "transparent";
      ctx.shadowBlur    = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      const cfg = CONFIG.ICONS[b.key];
      const slot = CONFIG.ICON_SLOT;
      const item = icons[b.key];
      const scale = cfg.SCALE ?? 1;
      const boxW = slot.WIDTH * scale;
      const boxH = slot.HEIGHT * scale;
      const nat = item.img;
      const ratio = (nat.naturalWidth && nat.naturalHeight)
        ? nat.naturalWidth / nat.naturalHeight
        : 1;
      // contain: maior lado da imagem ocupa o lado correspondente da box
      let drawW = boxW;
      let drawH = boxW / ratio;
      if (drawH > boxH) {
        drawH = boxH;
        drawW = boxH * ratio;
      }
      const drawX = x + (slot.WIDTH  - drawW) / 2 + (cfg.OFFSET_X || 0);
      const drawY = slot.Y + (slot.HEIGHT - drawH) / 2 + (cfg.OFFSET_Y || 0);
      if (cfg.FLIP_X) {
        ctx.save();
        ctx.translate(drawX + drawW, drawY);
        ctx.scale(-1, 1);
        ctx.drawImage(item.img, 0, 0, drawW, drawH);
        ctx.restore();
      } else {
        ctx.drawImage(item.img, drawX, drawY, drawW, drawH);
      }
    }
    x += b.width;
  }
}

/** Soma natural dos blocos + GAP final. Sem padding artificial. */
function naturalCycle(blocks) {
  return blocks.reduce((s, b) => s + b.width, 0) + (CONFIG.TICKER.GAP | 0);
}

/** Texto puro (apenas para metadados/JSON). */
export function buildText(goals = getGoals()) {
  return METAS.map((m) => {
    const ic = iconReady(m.iconKey) ? `[${m.iconKey.toLowerCase()}] ` : "";
    const entry = goals[m.field] || { atingido: 0, meta: 0 };
    return `${ic}${m.label} Alcançado ${formatAtingido(entry.atingido)} Meta ${formatMeta(entry.meta)} •`;
  }).join(" ");
}

/** Largura natural do ciclo (sem padding). LedCanvas usa para período de loop. */
export function measureCycle(ctx, opts = {}) {
  const goals = opts.goals ?? getGoals();
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const cycle = naturalCycle(buildBlocks(ctx, goals));
  ctx.font = prevFont;
  return cycle || 1;
}

function makeTextItem(text, color, x, w, y) {
  return {
    type: "text",
    x,
    w,
    draw(ctx, drawX) {
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
    },
  };
}

function makeIconItem(key, x, w) {
  return {
    type: "icon",
    x,
    w,
    draw(ctx, drawX) {
      if (!iconReady(key)) return;
      const cfg = CONFIG.ICONS[key];
      const slot = CONFIG.ICON_SLOT;
      const entry = icons[key];
      const scale = cfg.SCALE ?? 1;
      const boxW = slot.WIDTH * scale;
      const boxH = slot.HEIGHT * scale;
      const nat = entry.img;
      const ratio =
        nat.naturalWidth && nat.naturalHeight
          ? nat.naturalWidth / nat.naturalHeight
          : 1;
      let drawW = boxW;
      let drawH = boxW / ratio;
      if (drawH > boxH) {
        drawH = boxH;
        drawW = boxH * ratio;
      }
      const dX = drawX + (slot.WIDTH - drawW) / 2 + (cfg.OFFSET_X || 0);
      const dY = slot.Y + (slot.HEIGHT - drawH) / 2 + (cfg.OFFSET_Y || 0);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      if (cfg.FLIP_X) {
        ctx.save();
        ctx.translate(dX + drawW, dY);
        ctx.scale(-1, 1);
        ctx.drawImage(entry.img, 0, 0, drawW, drawH);
        ctx.restore();
      } else {
        ctx.drawImage(entry.img, dX, dY, drawW, drawH);
      }
    },
  };
}

/** Lista plana de itens com posição absoluta. Total inclui gaps. */
export function getItems(ctx, H, opts = {}) {
  const goals = opts.goals ?? getGoals();
  const prevFont = ctx.font;
  ctx.font = CONFIG.TICKER.FONT;
  const blocks = buildBlocks(ctx, goals);
  const items = [];
  const bandH = H || CONFIG.HEIGHT;
  const y = bandH / 2;
  let x = 0;
  for (const b of blocks) {
    if (b.type === "text") {
      items.push(makeTextItem(b.text, b.color || CONFIG.TICKER.COLOR, x, b.width, y));
    } else if (b.type === "icon") {
      items.push(makeIconItem(b.key, x, b.width));
    }
    x += b.width;
  }
  x += CONFIG.TICKER.GAP | 0;
  ctx.font = prevFont;
  return { items, total: Math.max(1, x) };
}

// --- Render ---

export function render(ctx, state) {
  const goals = getGoals();

  ctx.font = CONFIG.TICKER.FONT;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = CONFIG.TICKER.COLOR;
  if (CONFIG.TICKER.SHADOW) {
    ctx.shadowColor = CONFIG.TICKER.SHADOW_COLOR;
    ctx.shadowBlur  = CONFIG.TICKER.SHADOW_BLUR;
  }

  const W = state?.width  ?? CONFIG.WIDTH;
  const H = state?.height ?? CONFIG.HEIGHT;
  const blocks = buildBlocks(ctx, goals);
  const cycle  = naturalCycle(blocks);
  if (cycle <= 0) return;
  const offset = Math.floor(-((state.progress % 1) * cycle));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  // Tile contínuo: começa um ciclo antes de offset (margem de segurança) e
  // desenha cópias até cobrir toda a largura W. Quando cycle < W, várias
  // cópias preenchem; quando cycle >= W, basta uma ou duas.
  for (let x = offset - cycle; x < W + cycle; x += cycle) {
    drawBlocks(ctx, blocks, x);
  }
  ctx.restore();
}

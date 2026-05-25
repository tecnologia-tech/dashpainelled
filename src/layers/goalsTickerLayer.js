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

// Ícones extra carregados além dos das metas (separadores, logos, etc.).
// LAST_DANCE entra aqui para o lastDanceLayer reusar o mesmo cache de ícones.
const EXTRA_ICON_KEYS = ["LOGO_12P", "LAST_DANCE"];

// Fonte do ticker: theme.font sobrepõe a fonte padrão (modo Metas).
function tickerFont(theme) {
  return theme?.font || CONFIG.TICKER.FONT;
}

const FALLBACK_PALETTE = { dark: "#888", mid: "#BBB", light: "#DDD", strong: "#FFF" };
function sectorPalette(colorKey, theme) {
  // Com theme: paleta única (sem cor por setor). mid/strong = fg (valores e
  // nomes), light/dark = accent (rótulos "Alcançado:"/"Meta:").
  if (theme) {
    return { dark: theme.accent, mid: theme.fg, light: theme.accent, strong: theme.fg };
  }
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
  // Tarefas de carga: ícones base (CONFIG.ICONS) + variantes LD (CONFIG.ICONS_LD),
  // estas últimas no cache sob a chave `${BASE}_LD`.
  const baseKeys = [...METAS.map((m) => m.iconKey), ...EXTRA_ICON_KEYS];
  const tasks = baseKeys.map((k) => ({ cacheKey: k, path: CONFIG.ICONS?.[k]?.PATH }));
  const ld = CONFIG.ICONS_LD || {};
  for (const k of Object.keys(ld)) tasks.push({ cacheKey: `${k}_LD`, path: ld[k] });

  for (const t of tasks) icons[t.cacheKey] = { img: null, status: "idle" };

  iconPromise = Promise.all(tasks.map(async ({ cacheKey, path }) => {
    if (!path) {
      icons[cacheKey] = { img: null, status: "skipped" };
      return;
    }
    icons[cacheKey] = { img: null, status: "loading" };
    const img = await tryLoad(path);
    if (img) {
      icons[cacheKey] = { img, status: "ready" };
      console.log(`Ícone ${cacheKey} carregado: ${path} (${img.naturalWidth}x${img.naturalHeight})`);
    } else {
      icons[cacheKey] = { img: null, status: "error" };
      console.warn(`Ícone ${cacheKey} não carregou — bloco será pulado. Caminho: ${path}`);
    }
  }));
  return iconPromise;
}
ensureLoaded();

// Resolve a imagem do ícone considerando o iconSet do theme (ex.: "LD").
// Se a variante não carregou, cai no ícone base e avisa uma vez.
const warnedLd = new Set();
function resolveImgKey(key, theme) {
  if (theme?.iconSet === "LD") {
    const ldKey = `${key}_LD`;
    if (iconReady(ldKey)) return ldKey;
    if (CONFIG.ICONS_LD?.[key] && !warnedLd.has(key)) {
      warnedLd.add(key);
      console.warn(`Variante LD de ${key} indisponível — usando ícone normal.`);
    }
  }
  return key;
}

// Desenha um ícone (compartilhado entre render e getItems — sem duplicar geometria).
// Sizing vem de CONFIG.ICONS[baseKey]; imagem pode ser a variante LD.
// - separador (iconScale): box escalada normal.
// - boneco LD de setor (iconSet "LD" + tem variante LD): dimensiona pela ALTURA
//   da strip (sectorIconScale), centralizado, com clamp p/ não cortar.
// - demais: box slot * scale com contain (modo Metas inalterado).
function paintIcon(ctx, { baseKey, theme, drawX, blockWidth, iconScale, bandH }) {
  const imgKey = resolveImgKey(baseKey, theme);
  if (!iconReady(imgKey)) return;
  const cfg = CONFIG.ICONS[baseKey] || {};
  const slot = CONFIG.ICON_SLOT;
  const img = icons[imgKey].img;
  const H = bandH ?? CONFIG.HEIGHT;
  const ratio = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 1;
  const isLdSector = theme?.iconSet === "LD" && !!CONFIG.ICONS_LD?.[baseKey];

  let drawW, drawH;
  if (isLdSector) {
    const pad = theme.sectorIconPadding | 0;
    // Override por ícone (ex.: CAMONHA mais alto) sobrepõe o sectorIconScale base.
    const mul = theme.iconOverrides?.[baseKey]?.scale ?? theme.sectorIconScale ?? 1;
    const capH = H - pad * 2;
    let targetH = slot.HEIGHT * mul;
    if (targetH > capH) targetH = capH; // não estoura a strip
    drawH = targetH;
    drawW = targetH * ratio;
    if (drawW > blockWidth) { drawH *= blockWidth / drawW; drawW = blockWidth; }
  } else {
    const scale = iconScale ?? cfg.SCALE ?? 1;
    let boxW = slot.WIDTH * scale;
    let boxH = slot.HEIGHT * scale;
    const maxH = theme ? H - 16 : Infinity; // margem só em modos temáticos
    if (boxH > maxH) { boxW *= maxH / boxH; boxH = maxH; }
    drawW = boxW;
    drawH = boxW / ratio;
    if (drawH > boxH) { drawH = boxH; drawW = boxH * ratio; }
  }

  // Bonecos LD: centraliza exato (ignora offsets do ícone base headshot).
  const offX = isLdSector ? 0 : (cfg.OFFSET_X || 0);
  const offY = isLdSector ? 0 : (cfg.OFFSET_Y || 0);
  const dX = drawX + (blockWidth - drawW) / 2 + offX;
  const dY = (H - drawH) / 2 + offY;
  // Sombra só nos bonecos LD (iconShadow). Separador (logo) nunca leva sombra.
  const sh = isLdSector ? theme?.iconShadow : null;
  if (sh?.enabled) {
    ctx.shadowColor = sh.color;
    ctx.shadowBlur = sh.blur ?? 0;
    ctx.shadowOffsetX = sh.offsetX ?? 0;
    ctx.shadowOffsetY = sh.offsetY ?? 0;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  if (cfg.FLIP_X) {
    ctx.save();
    ctx.translate(dX + drawW, dY);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, drawW, drawH);
    ctx.restore();
  } else {
    ctx.drawImage(img, dX, dY, drawW, drawH);
  }
  // Reseta sombra para não vazar em desenhos seguintes.
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function getIconStatus() {
  return Object.fromEntries(Object.entries(icons).map(([k, v]) => [k, v.status]));
}

function iconReady(key) {
  const item = icons[key];
  return item && item.status === "ready" && item.img;
}

// --- Construção dos blocos ---

function buildBlocks(ctx, goals, theme) {
  const slot = CONFIG.ICON_SLOT;
  const sp = CONFIG.TICKER_SPACING;
  const baseFont = tickerFont(theme);
  const numFont = theme?.numberFont || baseFont;
  ctx.font = baseFont;
  // Separador entre blocos: ícone do theme (ex.: logo Last Dance) ou bolinha "•".
  const sepKey = theme?.separatorIconKey;
  const useIconSep = !!sepKey && iconReady(sepKey);
  // theme pode esconder ícones de setor e alargar os respiros.
  const hideSectorIcons = !!theme?.hideSectorIcons;
  const sepGap = theme?.separatorGap;
  const blockGap = theme?.blockGap | 0;
  const sepScale = theme?.separatorImageScale ?? 1;
  const sepPad = theme?.separatorPadding | 0;

  // Mede com a fonte do bloco (label vs número podem diferir) e guarda a fonte.
  const text = (s, color = CONFIG.TICKER.COLOR, font = baseFont) => {
    const prev = ctx.font;
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(s).width);
    ctx.font = prev;
    return { type: "text", text: s, color, width, font };
  };

  const gap = (width) => ({ type: "gap", width: width | 0 });

  const icon = (key) => {
    // Boneco LD ocupa mais largura (proporcional à escala efetiva, com override).
    const ldSector = theme?.iconSet === "LD" && !!CONFIG.ICONS_LD?.[key];
    const ldScale = theme?.iconOverrides?.[key]?.scale ?? theme?.sectorIconScale ?? 1;
    const width = ldSector
      ? Math.ceil(slot.WIDTH * ldScale + (theme.sectorIconPadding | 0) * 2)
      : slot.WIDTH + (slot.MARGIN_X | 0);
    return { type: "icon", key, width };
  };

  // Separador (logo Last Dance): box escalada + padding lateral próprio.
  const separatorIcon = (key) => ({
    type: "icon",
    key,
    iconScale: sepScale,
    width: Math.ceil(slot.WIDTH * sepScale + sepPad * 2),
  });

  const addGoalBlock = (blocks, label, iconKey, atingido, meta, palette, opts = {}) => {
    const leadBulletPad = opts.leadBulletPad ?? sepGap ?? sp.BULLET_PAD;
    const tailBulletPad = opts.tailBulletPad ?? sepGap ?? sp.BULLET_PAD;
    const omitTailBullet = !!opts.omitTailBullet;
    if (!hideSectorIcons) {
      blocks.push(icon(iconKey));
      blocks.push(gap(sp.ICON_TO_LABEL));
    }
    blocks.push(text(label, palette.mid));
    blocks.push(gap(sp.LABEL_TO_ALCANCADO));
    blocks.push(text("Alcançado:", palette.light));
    blocks.push(gap(sp.LABEL_VALUE_GAP));
    blocks.push(text(atingido, palette.strong, numFont));
    blocks.push(gap(sp.ALCANCADO_TO_META));
    blocks.push(text("Meta:", palette.light));
    blocks.push(gap(sp.LABEL_VALUE_GAP));
    blocks.push(text(meta, palette.mid, numFont));
    if (omitTailBullet) {
      blocks.push(gap(leadBulletPad + tailBulletPad));
      if (blockGap > 0) blocks.push(gap(blockGap));
    } else if (useIconSep) {
      // Logo separador centrado no respiro entre blocos: lead + tail + blockGap
      // distribuídos igualmente nos dois lados. Espaço antes == espaço depois.
      const side = Math.round((leadBulletPad + tailBulletPad + blockGap) / 2);
      blocks.push(gap(side));
      blocks.push(separatorIcon(sepKey));
      blocks.push(gap(side));
    } else {
      blocks.push(gap(leadBulletPad));
      blocks.push(text("•", "#FFFFFF"));
      blocks.push(gap(tailBulletPad));
      if (blockGap > 0) blocks.push(gap(blockGap));
    }
  };

  const blocks = [];
  for (const m of METAS) {
    const entry = goals[m.field] || { atingido: 0, meta: 0 };
    // Separador especial do logo 12P só no modo Metas (sem theme). Com theme,
    // o separador é uniforme (icon do theme) entre todos os blocos.
    const isLogoSeparator =
      !theme && m.colorKey === "GLOBAL_12P" && iconReady("LOGO_12P");
    const innerPad = sp.LOGO_INNER_PAD ?? sp.BULLET_PAD;
    const outerPad = sp.LOGO_OUTER_PAD ?? sp.BULLET_PAD;

    // Quando seguido pelo separador 12P: bullet de fechamento omitido,
    // gap combinado (outer+inner) preserva respiro entre texto verde e logo.
    addGoalBlock(
      blocks,
      m.label,
      m.iconKey,
      formatAtingido(entry.atingido),
      entry.metaText ?? formatMeta(entry.meta),
      sectorPalette(m.colorKey, theme),
      isLogoSeparator
        ? { leadBulletPad: outerPad, tailBulletPad: innerPad, omitTailBullet: true }
        : {},
    );

    // Separador 12P entre verde e laranja, sem bullets ao redor:
    // ... verde texto → (outer+inner) → 12P → (inner+outer) → laranja.
    if (isLogoSeparator) {
      const logoCfg = CONFIG.ICONS.LOGO_12P;
      const logoScale = logoCfg?.SCALE ?? 1;
      const logoWidth = Math.ceil(slot.WIDTH * logoScale + (slot.MARGIN_X | 0));

      blocks.push({ type: "icon", key: "LOGO_12P", width: logoWidth });
      blocks.push(gap(innerPad + outerPad));
    }
  }
  return blocks;
}

function drawBlocks(ctx, blocks, startX, theme, bandH) {
  let x = startX;
  const noStroke = !!theme?.noStroke;
  const textShadow = theme?.textShadow;
  ctx.font = tickerFont(theme);
  for (const b of blocks) {
    if (b.type === "text") {
      const fillColor = b.color || CONFIG.TICKER.COLOR;
      if (b.font) ctx.font = b.font;
      if (textShadow?.enabled) {
        ctx.shadowColor   = textShadow.color;
        ctx.shadowBlur    = textShadow.blur ?? 0;
        ctx.shadowOffsetX = textShadow.offsetX ?? 0;
        ctx.shadowOffsetY = textShadow.offsetY ?? 0;
      } else if (!noStroke && CONFIG.TICKER.SHADOW) {
        ctx.shadowColor   = fillColor;
        ctx.shadowBlur    = CONFIG.TICKER.SHADOW_BLUR;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur  = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      if (!noStroke && CONFIG.TICKER.STROKE) {
        ctx.lineWidth = CONFIG.TICKER.STROKE_WIDTH;
        ctx.strokeStyle = CONFIG.TICKER.STROKE_COLOR;
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(b.text, x, CONFIG.TICKER.TEXT_Y);
      }
      ctx.fillStyle = fillColor;
      ctx.fillText(b.text, x, CONFIG.TICKER.TEXT_Y);
    } else if (b.type === "icon") {
      paintIcon(ctx, {
        baseKey: b.key,
        theme,
        drawX: x,
        blockWidth: b.width,
        iconScale: b.iconScale,
        bandH,
      });
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
    return `${ic}${m.label} Alcançado ${formatAtingido(entry.atingido)} Meta ${entry.metaText ?? formatMeta(entry.meta)} •`;
  }).join(" ");
}

/** Largura natural do ciclo (sem padding). LedCanvas usa para período de loop. */
export function measureCycle(ctx, opts = {}) {
  const goals = opts.goals ?? getGoals();
  const prevFont = ctx.font;
  ctx.font = tickerFont(opts.theme);
  const cycle = naturalCycle(buildBlocks(ctx, goals, opts.theme));
  ctx.font = prevFont;
  return cycle || 1;
}

function makeTextItem(text, color, x, w, y, font, noStroke = false, shadow = null) {
  return {
    type: "text",
    x,
    w,
    draw(ctx, drawX) {
      ctx.globalAlpha = 1;
      ctx.font = font || CONFIG.TICKER.FONT;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      if (shadow?.enabled) {
        ctx.shadowColor = shadow.color;
        ctx.shadowBlur = shadow.blur ?? 0;
        ctx.shadowOffsetX = shadow.offsetX ?? 0;
        ctx.shadowOffsetY = shadow.offsetY ?? 0;
      } else if (!noStroke && CONFIG.TICKER.SHADOW) {
        ctx.shadowColor = color;
        ctx.shadowBlur = CONFIG.TICKER.SHADOW_BLUR;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur  = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      if (!noStroke && CONFIG.TICKER.STROKE) {
        ctx.lineWidth = CONFIG.TICKER.STROKE_WIDTH;
        ctx.strokeStyle = CONFIG.TICKER.STROKE_COLOR;
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(text, drawX, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, drawX, y);
      // reset sombra p/ não vazar no próximo item
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    },
  };
}

function makeIconItem(b, x, theme, bandH) {
  return {
    type: "icon",
    x,
    w: b.width,
    draw(ctx, drawX) {
      paintIcon(ctx, {
        baseKey: b.key,
        theme,
        drawX,
        blockWidth: b.width,
        iconScale: b.iconScale,
        bandH,
      });
    },
  };
}

/** Lista plana de itens com posição absoluta. Total inclui gaps. */
export function getItems(ctx, H, opts = {}) {
  const goals = opts.goals ?? getGoals();
  const theme = opts.theme;
  const font = tickerFont(theme);
  const noStroke = !!theme?.noStroke;
  const prevFont = ctx.font;
  ctx.font = font;
  const blocks = buildBlocks(ctx, goals, theme);
  const items = [];
  const bandH = H || CONFIG.HEIGHT;
  const y = bandH / 2;
  let x = 0;
  for (const b of blocks) {
    if (b.type === "text") {
      items.push(makeTextItem(b.text, b.color || CONFIG.TICKER.COLOR, x, b.width, y, b.font || font, noStroke, theme?.textShadow));
    } else if (b.type === "icon") {
      items.push(makeIconItem(b, x, theme, bandH));
    }
    x += b.width;
  }
  x += CONFIG.TICKER.GAP | 0;
  ctx.font = prevFont;
  return { items, total: Math.max(1, x) };
}

// --- Render ---

export function render(ctx, state, opts = {}) {
  const goals = getGoals();
  const theme = opts.theme;

  ctx.font = tickerFont(theme);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = CONFIG.TICKER.COLOR;
  if (CONFIG.TICKER.SHADOW) {
    ctx.shadowColor = CONFIG.TICKER.SHADOW_COLOR;
    ctx.shadowBlur  = CONFIG.TICKER.SHADOW_BLUR;
  }

  const W = state?.width  ?? CONFIG.WIDTH;
  const H = state?.height ?? CONFIG.HEIGHT;
  const blocks = buildBlocks(ctx, goals, theme);
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
    drawBlocks(ctx, blocks, x, theme, H);
  }
  ctx.restore();
}

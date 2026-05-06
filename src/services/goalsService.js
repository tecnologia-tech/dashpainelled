// goalsService.js
// Busca /api/wons e /api/metas, calcula atingidos do mês corrente.
// Forma final exposta:
//   {
//     meta12p:         { atingido, meta },
//     metaConsultoria: { atingido, meta },
//     metaLtda:        { atingido, meta },
//   }

import { CONFIG } from "../config.js";
import {
  parseDataBR,
  toNumber,
  normalizeRows,
} from "../utils/dataHelpers.js";

const FALLBACK_GOALS = Object.freeze({
  meta12p:         { atingido: 0, meta: CONFIG.METAS_FALLBACK.meta12p },
  metaConsultoria: { atingido: 0, meta: CONFIG.METAS_FALLBACK.metaConsultoria },
  metaLtda:        { atingido: 0, meta: CONFIG.METAS_FALLBACK.metaLtda },
});

let current = JSON.parse(JSON.stringify(FALLBACK_GOALS));
let lastMetas = { ...CONFIG.METAS_FALLBACK };
let wonsStatus  = "idle"; // idle | loading | ok | error
let metasStatus = "idle";
let lastRefresh = null;
let lastDebug = { rowsMonth: 0, pipelines: [] };

let initialPromise = null;
let timer = null;

function normalizePipelineName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // diacríticos
    .replace(/[^\w\s]/g, "")          // emojis, pontuação, símbolos
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getPipelineName(item) {
  return (
    item.pipeline ||
    item.pipeline_name ||
    item.nome_pipeline ||
    item.pipelineName ||
    item.funil ||
    ""
  );
}

function getItemDate(item) {
  return item.data || item.date || item.created_at || item.createdAt || item.won_at || null;
}

function getItemValor(item) {
  return item.valor ?? item.value ?? item.amount ?? 0;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function fetchJson(url) {
  const r = await withTimeout(fetch(url, { cache: "no-store" }), CONFIG.API.TIMEOUT_MS);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function monthRange(now = new Date()) {
  const inicioMes     = new Date(now.getFullYear(), now.getMonth(),     1, 0, 0, 0);
  const inicioProxMes = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  return { inicioMes, inicioProxMes };
}

function computeAtingidos(rawWons) {
  const geral = normalizeRows(rawWons);
  const { inicioMes, inicioProxMes } = monthRange();

  const inRange = (item) => {
    const d = parseDataBR(getItemDate(item));
    return d && d >= inicioMes && d < inicioProxMes;
  };

  const monthRows = geral.filter(inRange);

  const sumWhere = (predicate) =>
    monthRows
      .filter(predicate)
      .reduce((acc, cur) => acc + toNumber(getItemValor(cur) || 0), 0);

  const consultoriaSet = new Set(
    CONFIG.CONSULTORIA_PIPELINES.map(normalizePipelineName),
  );

  const isConsultoria = (item) => {
    const pipeline = normalizePipelineName(getPipelineName(item));
    return consultoriaSet.has(pipeline);
  };

  const isLtda = (item) => {
    const pipeline = normalizePipelineName(getPipelineName(item));
    return pipeline.includes("DISNEYLEADS");
  };

  const pipelinesDoMes = [...new Set(
    monthRows.map((i) => getPipelineName(i)).filter(Boolean),
  )];
  lastDebug = { rowsMonth: monthRows.length, pipelines: pipelinesDoMes };
  if (CONFIG.SHOW_DEBUG) {
    console.log("Pipelines do mês:", pipelinesDoMes);
  }

  return {
    atingido12p:         sumWhere(() => true),
    atingidoConsultoria: sumWhere(isConsultoria),
    atingidoLtda:        sumWhere(isLtda),
  };
}

// Formata número para "1,50M" / "3,00M" / "1,61M". Sempre 2 casas.
function formatMeta(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0M";
  const m = n / 1_000_000;
  return `${m.toFixed(2).replace(".", ",")}M`;
}

async function refresh() {
  wonsStatus  = "loading";
  metasStatus = "loading";

  // /api/wons → array de vendas → calcula "Alcançado".
  let atingidos = null;
  try {
    const rawWons = await fetchJson(CONFIG.API.WONS_URL);
    atingidos = computeAtingidos(rawWons);
    wonsStatus = "ok";
  } catch (err) {
    wonsStatus = "error";
    console.warn(`WONS fetch falhou (${err.message}) — mantendo último valor.`);
  }

  // /api/metas → metas por setor. Aceita { metas: {...} } ou shape plano.
  let metas = null;
  let metasText = null;
  try {
    const rawMetas = await fetchJson(CONFIG.API.METAS_URL);
    if (CONFIG.SHOW_DEBUG) console.log("RAW METAS:", rawMetas);
    const src = (rawMetas?.metas && typeof rawMetas.metas === "object")
      ? rawMetas.metas
      : (rawMetas ?? {});
    const metaLtda        = Number(src.LTDA        ?? src.metaLtda        ?? 0);
    const metaConsultoria = Number(src.Consultoria ?? src.metaConsultoria ?? 0);
    const meta12p         = Number(src["12P"]      ?? src.meta12p         ?? 0);
    if (metaLtda || metaConsultoria || meta12p) {
      metas = { meta12p, metaConsultoria, metaLtda };
      lastMetas = metas;
      metasStatus = "ok";
      metasText = {
        metaNovosNegocios: formatMeta(metaLtda),
        metaConsultoria:   formatMeta(metaConsultoria),
        metaGlobal12P:     formatMeta(meta12p),
      };
    } else {
      throw new Error("payload metas inválido");
    }
  } catch (err) {
    metasStatus = "error";
    console.warn(`METAS fetch falhou (${err.message}) — usando último valor.`);
  }

  const useMetas = metas || lastMetas;
  const fallbackText = {
    metaGlobal12P:     formatMeta(useMetas.meta12p),
    metaConsultoria:   formatMeta(useMetas.metaConsultoria),
    metaNovosNegocios: formatMeta(useMetas.metaLtda),
  };
  const useText = metasText || fallbackText;
  const next = {
    meta12p:         { ...current.meta12p,         meta: useMetas.meta12p,         metaText: useText.metaGlobal12P },
    metaConsultoria: { ...current.metaConsultoria, meta: useMetas.metaConsultoria, metaText: useText.metaConsultoria },
    metaLtda:        { ...current.metaLtda,        meta: useMetas.metaLtda,        metaText: useText.metaNovosNegocios },
  };
  if (atingidos) {
    next.meta12p.atingido         = atingidos.atingido12p;
    next.metaConsultoria.atingido = atingidos.atingidoConsultoria;
    next.metaLtda.atingido        = atingidos.atingidoLtda;
  }
  current = next;
  lastRefresh = new Date();
  console.log("Goals atualizados:", current);
}

export function getGoals()        { return current; }
export function getGoalsStatus()  { return wonsStatus === "ok" && metasStatus === "ok" ? "ok" : (wonsStatus === "loading" || metasStatus === "loading" ? "loading" : "error"); }
export function getApiStatus()    {
  return {
    wons: wonsStatus,
    metas: metasStatus,
    lastRefresh,
    rowsMonth: lastDebug.rowsMonth,
    pipelines: lastDebug.pipelines,
  };
}

export function ensureLoaded() {
  if (initialPromise) return initialPromise;
  initialPromise = refresh();
  if (CONFIG.API.REFRESH_MS > 0) {
    timer = setInterval(refresh, CONFIG.API.REFRESH_MS);
  }
  return initialPromise;
}
ensureLoaded();

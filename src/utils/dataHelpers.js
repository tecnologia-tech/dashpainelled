// dataHelpers.js
// Parsers/formatadores compartilhados pelo goalsService.

const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** Aceita Date, número (ms), string ISO ou string BR (DD/MM/YYYY [HH:MM[:SS]]). */
export function parseDataBR(value) {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d) ? null : d;
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;

  const m = s.match(BR_DATE_RE);
  if (m) {
    const [, dd, mm, yyyy, h = "0", mi = "0", se = "0"] = m;
    const d = new Date(+yyyy, +mm - 1, +dd, +h, +mi, +se);
    return isNaN(d) ? null : d;
  }

  const iso = new Date(s);
  return isNaN(iso) ? null : iso;
}

/** Aceita number, "1.234,56", "R$ 1.234,56", "1234.56", "1234". */
export function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return isFinite(value) ? value : 0;
  let s = String(value).trim();
  if (!s) return 0;
  s = s.replace(/R\$\s*/i, "").replace(/\s/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // formato BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/** 1623000 -> "1,6M" | 529400 -> "529,4K" | 0 -> "0". (1 decimal) */
export function formatAtingido(value) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs === 0) return "0";
  if (abs >= 1e9) {
    return sign + (abs / 1e9).toFixed(1).replace(".", ",") + "B";
  }
  if (abs >= 1e6) {
    return sign + (abs / 1e6).toFixed(1).replace(".", ",") + "M";
  }
  if (abs >= 1e3) {
    return sign + (abs / 1e3).toFixed(1).replace(".", ",") + "K";
  }
  return sign + Math.round(abs).toString();
}

/** 3000000 -> "3M" | 1500000 -> "1,50M" | 1020000 -> "1,02M".
 *  Inteiro exato: sem decimais. Caso contrário: sempre 2 casas. */
function formatScaled(abs, divisor, suffix, sign) {
  const v = abs / divisor;
  const str = Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2);
  return sign + str.replace(".", ",") + suffix;
}

export function formatMeta(value) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs === 0) return "0";
  if (abs >= 1e9) return formatScaled(abs, 1e9, "B", sign);
  if (abs >= 1e6) return formatScaled(abs, 1e6, "M", sign);
  if (abs >= 1e3) return formatScaled(abs, 1e3, "K", sign);
  return sign + Math.round(abs).toString();
}

/** Alias mantido para DebugHud e outros callers. */
export function formatMoneyShort(value) {
  return formatAtingido(value);
}

/** Aceita array direto, { rows }, { data }, { items } e similares. */
export function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const k of ["rows", "data", "items", "results", "wons"]) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  for (const v of Object.values(payload)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

// lastDanceLayer.js
// Modo Last Dance = MESMO ticker de metas (mesma fonte de dados, mesmos blocos,
// mesmo loop matemático e omissão do frame final) com tema visual próprio.
//
// ZERO duplicação: delega 100% a goalsTickerLayer e só injeta o theme do
// config (CONFIG.MODE_THEMES.lastDance). O theme troca fonte (script), paleta
// (rosa+amarelo) e o ícone separador (logo Last Dance no lugar da bolinha "•").
//
// O ícone LAST_DANCE já é carregado por goalsTickerLayer.ensureLoaded
// (está em EXTRA_ICON_KEYS), então ensureLoaded é reaproveitado direto.

import { CONFIG } from "../config.js";
import * as core from "./goalsTickerLayer.js";

export const id = "lastDanceTicker";

const THEME = CONFIG.MODE_THEMES?.lastDance ?? null;

// Contrato de layer: ensureLoaded / getIconStatus reusados do core.
export const ensureLoaded = core.ensureLoaded;
export const getIconStatus = core.getIconStatus;

// noop intencional — mantém contrato com os layers que aceitam texto dinâmico.
export function setText() {}

export function measureCycle(ctx, opts = {}) {
  return core.measureCycle(ctx, { ...opts, theme: THEME });
}

export function getItems(ctx, H, opts = {}) {
  return core.getItems(ctx, H, { ...opts, theme: THEME });
}

export function render(ctx, state, opts = {}) {
  return core.render(ctx, state, { ...opts, theme: THEME });
}

export function buildText(goals) {
  return core.buildText(goals);
}

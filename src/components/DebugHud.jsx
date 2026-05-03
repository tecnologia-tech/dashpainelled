import { CONFIG } from "../config.js";
import { getGoals, getApiStatus } from "../services/goalsService.js";
import { formatMoneyShort } from "../utils/dataHelpers.js";

function fmtTime(d) {
  if (!d) return "—";
  return d.toLocaleTimeString("pt-BR");
}

export default function DebugHud({ metrics, speed, frameCount, iconStatus }) {
  const iconLines = Object.entries(iconStatus || {}).map(([k, s]) => `  ${k.padEnd(8)} ${s}`).join("\n");
  const fps = (metrics?.fps ?? 0).toFixed(1);
  const progress = (metrics?.progress ?? 0).toFixed(3);
  const cycle = Math.round(metrics?.cycle ?? 0);
  const offsetX = (metrics?.offsetX ?? 0).toFixed(1);

  const goals = getGoals();
  const api = getApiStatus();

  const line = (label, entry) =>
    `  ${label.padEnd(12)} ${formatMoneyShort(entry.atingido).padStart(6)} / ${formatMoneyShort(entry.meta)}`;

  const pipelinesTxt = (api.pipelines && api.pipelines.length)
    ? api.pipelines.map((p) => `  • ${p}`).join("\n")
    : "  —";

  return (
    <pre className="debug-hud">
      {`Resolução:  ${CONFIG.WIDTH}x${CONFIG.HEIGHT}
Speed:      ${speed} px/s
Frames:     ${frameCount}
FPS:        ${fps}
Cycle:      ${cycle} px  (period ${(cycle / Math.max(1, speed)).toFixed(2)}s)
offsetX:    ${offsetX} px
progress:   ${progress}
API wons:   ${api.wons}
API metas:  ${api.metas}
Refresh:    ${fmtTime(api.lastRefresh)}
Linhas mês: ${api.rowsMonth ?? 0}
Metas:
${line("12P",         goals.meta12p)}
${line("Consultoria", goals.metaConsultoria)}
${line("LTDA",        goals.metaLtda)}
Pipelines do mês:
${pipelinesTxt}
Icons:
${iconLines || "  —"}`}
    </pre>
  );
}

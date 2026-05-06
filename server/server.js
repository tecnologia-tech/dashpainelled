// server/server.js
// Backend Express — expõe /api/goals.
// Plugar banco real implementando getGoalsFromDatabase().

import express from "express";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = join(__dirname, "settings.json");

const allowedModes = [
  "normal",
  "sino",
  "lastDance",
  "blackFriday",
  "together",
  "bemVindoCliente",
  "bemVindoColaborador",
  "nutDay",
  "panteraVideo",
  "textoLivre",
];

function readSettings() {
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return { speedPxPerSecond: 180 };
  }
}

function writeSettings(data) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), "utf8");
}

// =====================================================================
// Plugar banco real aqui.
// Substitua o conteúdo desta função por uma consulta a Postgres/MySQL/
// MongoDB/HTTP externo. Mantenha o formato de retorno.
// =====================================================================
async function getGoalsFromDatabase() {
  return {
    meta12p:         "3M",
    metaConsultoria: "1,5M",
    metaLtda:        "1,5M",
  };
}

const app = express();
app.disable("x-powered-by");

// CORS minimalista — útil quando o front é servido em outra porta.
app.use(express.json());

app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.options("*", (_req, res) => res.sendStatus(204));

app.get("/api/settings", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(readSettings());
});

app.put("/api/settings", (req, res) => {
  const { speedPxPerSecond, dashMinutes, videoMinutes, videoMode, sinoEnabled, activeMode } = req.body ?? {};
  const patch = {};

  if (speedPxPerSecond !== undefined) {
    if (!Number.isFinite(speedPxPerSecond) || speedPxPerSecond <= 0)
      return res.status(400).json({ error: "speedPxPerSecond must be positive number" });
    patch.speedPxPerSecond = speedPxPerSecond;
  }
  if (dashMinutes !== undefined) {
    if (!Number.isFinite(dashMinutes) || dashMinutes <= 0)
      return res.status(400).json({ error: "dashMinutes must be positive number" });
    patch.dashMinutes = dashMinutes;
  }
  if (videoMinutes !== undefined) {
    if (!Number.isFinite(videoMinutes) || videoMinutes <= 0)
      return res.status(400).json({ error: "videoMinutes must be positive number" });
    patch.videoMinutes = videoMinutes;
  }
  if (videoMode !== undefined) {
    if (typeof videoMode !== "string" || !videoMode.trim())
      return res.status(400).json({ error: "videoMode must be non-empty string" });
    patch.videoMode = videoMode;
  }
  if (sinoEnabled !== undefined) {
    patch.sinoEnabled = Boolean(sinoEnabled);
  }
  if (activeMode !== undefined) {
    if (typeof activeMode !== "string" || !activeMode.trim())
      return res.status(400).json({ error: "activeMode must be non-empty string" });
    patch.activeMode = activeMode;
  }

  const updated = { ...readSettings(), ...patch };
  writeSettings(updated);
  res.json(updated);
});

app.post("/mode", (req, res) => {
  const { mode } = req.body ?? {};
  if (typeof mode !== "string" || !allowedModes.includes(mode)) {
    return res.status(400).json({ error: "mode must be one of allowedModes", allowedModes });
  }
  console.log(`/mode → ${mode}`);
  res.json({ mode });
});

app.get("/api/goals", async (_req, res) => {
  try {
    const data = await getGoalsFromDatabase();
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (err) {
    console.error("Falha em /api/goals:", err);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// Plugar fonte real das metas aqui (Postgres/MySQL/HTTP/etc.).
// Formato: { meta12p, metaConsultoria, metaLtda } em centavos? não — em
// reais (number). O front converte para formatMoneyShort.
// =====================================================================
async function getMetasFromDatabase() {
  return {
    meta12p:         3000000,
    metaConsultoria: 1500000,
    metaLtda:        1500000,
  };
}

app.get("/api/metas", async (_req, res) => {
  try {
    const data = await getMetasFromDatabase();
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (err) {
    console.error("Falha em /api/metas:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`API em http://localhost:${PORT}`);
  console.log(`  GET /api/goals`);
  console.log(`  GET /api/metas`);
  console.log(`  GET /api/settings`);
  console.log(`  PUT /api/settings`);
  console.log(`  POST /mode`);
});

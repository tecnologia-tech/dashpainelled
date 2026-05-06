// Vercel serverless: proxy puro upstream /api/metas. Sem hardcode local.
// Erro upstream propaga 502 — front cai em lastMetas.

const UPSTREAM = process.env.METAS_UPSTREAM_URL || "https://dados-4ew4.onrender.com/api/metas";

export default async function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const r = await fetch(UPSTREAM, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);
    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: String(err?.message || err) });
  }
}

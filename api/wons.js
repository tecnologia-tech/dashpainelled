// Vercel serverless proxy → onrender WONS API.
// Bypasses CORS: fetch is server-side, no browser Origin header sent upstream.

const UPSTREAM = process.env.WONS_UPSTREAM_URL || "https://dados-4ew4.onrender.com/api/wons";

export default async function handler(_req, res) {
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `upstream HTTP ${upstream.status}` });
      return;
    }
    const data = await upstream.json();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: String(err?.message || err) });
  }
}

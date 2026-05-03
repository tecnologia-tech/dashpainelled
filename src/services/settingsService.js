const BASE = import.meta.env.VITE_API_BASE ?? "";

export async function getSettings() {
  const res = await fetch(`${BASE}/api/settings`);
  if (!res.ok) throw new Error(`GET /api/settings → ${res.status}`);
  return res.json();
}

export async function saveSettings(settings) {
  const res = await fetch(`${BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`PUT /api/settings → ${res.status}`);
  return res.json();
}

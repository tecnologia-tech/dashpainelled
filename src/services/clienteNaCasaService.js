export const CLIENTE_NA_CASA_STORAGE_KEY = "cliente-na-casa:list";
export const CLIENTE_NA_CASA_POINTER_KEY = "cliente-na-casa:pointer";
export const CLIENTE_NA_CASA_EXPIRATION_MS = 2 * 60 * 60 * 1000;

function isValidCliente(c) {
  return (
    c &&
    typeof c.id === "string" &&
    typeof c.nome === "string" &&
    typeof c.createdAt === "string" &&
    typeof c.expiresAt === "string"
  );
}

function isAtivo(c) {
  const t = new Date(c.expiresAt).getTime();
  return Number.isFinite(t) && t > Date.now();
}

function byCreatedAtAsc(a, b) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function loadClientesNaCasa() {
  try {
    const raw = localStorage.getItem(CLIENTE_NA_CASA_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidCliente);
  } catch {
    return [];
  }
}

export function saveClientesNaCasa(clientes) {
  try {
    localStorage.setItem(CLIENTE_NA_CASA_STORAGE_KEY, JSON.stringify(clientes));
  } catch (err) {
    console.warn("saveClientesNaCasa failed:", err);
  }
}

export function removeClientesNaCasaExpirados() {
  const all = loadClientesNaCasa();
  const ativos = all.filter(isAtivo);
  if (ativos.length !== all.length) {
    saveClientesNaCasa(ativos);
  }
  return ativos;
}

export function getClientesNaCasaAtivos() {
  return loadClientesNaCasa().filter(isAtivo).sort(byCreatedAtAsc);
}

function readPointer() {
  try {
    const raw = localStorage.getItem(CLIENTE_NA_CASA_POINTER_KEY);
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writePointer(p) {
  try {
    localStorage.setItem(CLIENTE_NA_CASA_POINTER_KEY, String(p));
  } catch (err) {
    console.warn("writePointer failed:", err);
  }
}

export function getNextClienteNaCasa() {
  removeClientesNaCasaExpirados();
  const ativos = getClientesNaCasaAtivos();
  if (ativos.length === 0) return null;
  let pointer = readPointer();
  if (!Number.isFinite(pointer) || pointer < 0 || pointer >= ativos.length) {
    pointer = 0;
  }
  const cliente = ativos[pointer];
  writePointer((pointer + 1) % ativos.length);
  return cliente;
}

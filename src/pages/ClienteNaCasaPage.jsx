import { useState, useEffect, useRef, useCallback } from "react";
import {
  CLIENTE_NA_CASA_EXPIRATION_MS,
  loadClientesNaCasa,
  saveClientesNaCasa,
  removeClientesNaCasaExpirados,
} from "../services/clienteNaCasaService.js";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortByExpires(clientes) {
  return [...clientes].sort(
    (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
  );
}

function pruneExpired(clientes) {
  const now = Date.now();
  return clientes.filter((c) => new Date(c.expiresAt).getTime() > now);
}

function createCliente(nome) {
  const now = new Date();
  return {
    id: genId(),
    nome,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CLIENTE_NA_CASA_EXPIRATION_MS).toISOString(),
  };
}

function getRemainingMs(expiresAt) {
  return new Date(expiresAt).getTime() - Date.now();
}

function formatRemaining(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function ClienteNaCasaPage() {
  const [clientes, setClientes] = useState(() =>
    sortByExpires(removeClientesNaCasaExpirados())
  );
  const [nome, setNome] = useState("");
  const [, forceTick] = useState(0);
  const clientesRef = useRef(clientes);

  useEffect(() => {
    clientesRef.current = clientes;
  }, [clientes]);

  useEffect(() => {
    saveClientesNaCasa(clientes);
  }, [clientes]);

  useEffect(() => {
    const id = setInterval(() => {
      const current = clientesRef.current;
      const pruned = pruneExpired(current);
      if (pruned.length !== current.length) {
        setClientes(sortByExpires(pruned));
      } else {
        forceTick((n) => (n + 1) % 1_000_000);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onStorage(e) {
      if (e.key === null || e.key === undefined) return;
      if (e.key !== "cliente-na-casa:list") return;
      setClientes(sortByExpires(pruneExpired(loadClientesNaCasa())));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const trimmed = nome.trim();
      if (!trimmed) return;
      setClientes((prev) => sortByExpires([...prev, createCliente(trimmed)]));
      setNome("");
    },
    [nome]
  );

  const handleRemove = useCallback((id) => {
    setClientes((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleClearExpired = useCallback(() => {
    setClientes((prev) => sortByExpires(pruneExpired(prev)));
  }, []);

  const hasExpired = clientes.some((c) => getRemainingMs(c.expiresAt) <= 0);

  return (
    <div className="cnc-page">
      <div className="cnc-container">
        <header className="cnc-header">
          <h1 className="cnc-title">Cliente na Casa</h1>
          <span className="cnc-subtitle">Expira em 2 horas</span>
        </header>

        <form className="cnc-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="cnc-input"
            placeholder="Nome do cliente"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
          />
          <button type="submit" className="control-btn primary" disabled={!nome.trim()}>
            Cadastrar
          </button>
          <button
            type="button"
            className="control-btn"
            onClick={handleClearExpired}
            disabled={!hasExpired}
            title="Remove clientes expirados"
          >
            Limpar expirados
          </button>
        </form>

        <div className="cnc-table-wrap">
          {clientes.length === 0 ? (
            <p className="cnc-empty">Nenhum cliente na casa.</p>
          ) : (
            <table className="cnc-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Criado em</th>
                  <th>Expira em</th>
                  <th>Tempo restante</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => {
                  const remaining = getRemainingMs(c.expiresAt);
                  const expired = remaining <= 0;
                  return (
                    <tr key={c.id} className={expired ? "cnc-row-expired" : ""}>
                      <td>{c.nome}</td>
                      <td>{formatDateTime(c.createdAt)}</td>
                      <td>{formatDateTime(c.expiresAt)}</td>
                      <td className="cnc-remaining">{formatRemaining(remaining)}</td>
                      <td>
                        <button
                          type="button"
                          className="control-btn"
                          onClick={() => handleRemove(c.id)}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

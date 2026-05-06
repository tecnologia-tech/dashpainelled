import { useState, useEffect, useCallback, useRef } from "react";
import { CONFIG } from "./config.js";
import ControlPanel from "./components/ControlPanel.jsx";
import PanelPage from "./components/PanelPage.jsx";
import { getSettings, saveSettings } from "./services/settingsService.js";
import { getNextClienteNaCasa } from "./services/clienteNaCasaService.js";

function isValidMode(m) {
  return typeof m === "string" && Object.values(CONFIG.MODES).includes(m);
}

const LEGACY_MODE_ALIAS = {
  bemVindo: "bemVindoCliente",
};

function normalizeMode(m) {
  return LEGACY_MODE_ALIAS[m] ?? m;
}

function deriveLegacyMode(s) {
  if (s.sinoEnabled === true) return CONFIG.MODES.SINO;
  if (s.videoMode === "LAST_DANCE")   return CONFIG.MODES.LAST_DANCE;
  if (s.videoMode === "BLACK_FRIDAY") return CONFIG.MODES.BLACK_FRIDAY;
  return CONFIG.MODES.NORMAL;
}

const KEY_TO_MODE = {
  F13: CONFIG.MODES.NORMAL,
  F14: CONFIG.MODES.SINO,
  F15: CONFIG.MODES.LAST_DANCE,
  F16: CONFIG.MODES.BLACK_FRIDAY,
  F17: CONFIG.MODES.TOGETHER,
  F18: CONFIG.MODES.BEM_VINDO_CLIENTE,
  F19: CONFIG.MODES.BEM_VINDO_COLABORADOR,
  F20: CONFIG.MODES.NUT_DAY,
  F21: CONFIG.MODES.PANTERA_VIDEO,
};

export default function App() {
  const [activeMode, setActiveMode] = useState(CONFIG.ACTIVE_MODE_DEFAULT);
  const activeModeRef = useRef(activeMode);
  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);

  const [welcomeName, setWelcomeName] = useState("");
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeDraft, setWelcomeDraft] = useState("");
  const suppressWelcomeModalRef = useRef(false);

  const [customText, setCustomText] = useState("");
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");

  const activateMode = useCallback((mode) => {
    if (!isValidMode(mode)) return null;

    let autoCliente = null;
    if (mode === CONFIG.MODES.BEM_VINDO_CLIENTE) {
      autoCliente = getNextClienteNaCasa();
      if (autoCliente) {
        suppressWelcomeModalRef.current = true;
        setWelcomeName(autoCliente.nome);
        setWelcomeModalOpen(false);
      }
    }

    if (activeModeRef.current === mode) return mode;
    activeModeRef.current = mode;
    setActiveMode(mode);
    saveSettings({
      activeMode: mode,
      sinoEnabled: mode === CONFIG.MODES.SINO,
    }).catch((err) => console.warn("saveSettings failed:", err));
    fetch(CONFIG.MODE_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch((err) => console.warn("Falha ao chamar backend para modo:", mode, err));
    return mode;
  }, []);

  useEffect(() => {
    getSettings()
      .then((s) => {
        const normalized = normalizeMode(s.activeMode);
        if (isValidMode(normalized)) {
          setActiveMode(normalized);
        } else {
          setActiveMode(deriveLegacyMode(s));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const mode = KEY_TO_MODE[e.key];
      if (!mode) return;
      activateMode(mode);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activateMode]);

  const isWelcomeCliente = activeMode === CONFIG.MODES.BEM_VINDO_CLIENTE;
  const isTextoLivre = activeMode === CONFIG.MODES.TEXTO_LIVRE;

  useEffect(() => {
    if (isWelcomeCliente) {
      if (suppressWelcomeModalRef.current) {
        suppressWelcomeModalRef.current = false;
        return;
      }
      setWelcomeDraft(welcomeName);
      setWelcomeModalOpen(true);
    } else {
      setWelcomeModalOpen(false);
    }
  }, [isWelcomeCliente]);

  useEffect(() => {
    if (isTextoLivre) {
      setTextDraft(customText);
      setTextModalOpen(true);
    } else {
      setTextModalOpen(false);
    }
  }, [isTextoLivre]);

  function submitWelcomeName(e) {
    e?.preventDefault?.();
    const trimmed = welcomeDraft.trim();
    if (!trimmed) return;
    setWelcomeName(trimmed);
    setWelcomeModalOpen(false);
  }

  function submitCustomText(e) {
    e?.preventDefault?.();
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    setCustomText(trimmed);
    setTextModalOpen(false);
  }

  return (
    <div className="app-layout">
      <main className="preview-area">
        <PanelPage
          embedded
          activeMode={activeMode}
          welcomeName={welcomeName}
          customText={customText}
        />
      </main>

      {CONFIG.SHOW_CONTROLS && (
        <footer className="controls-area">
          <ControlPanel
            activeMode={activeMode}
            activateMode={activateMode}
          />
        </footer>
      )}

      {welcomeModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={submitWelcomeName}>
            <h2 className="modal-title">Bem-vindo Cliente</h2>
            <label className="modal-label" htmlFor="welcome-name-input">
              Nome do cliente
            </label>
            <input
              id="welcome-name-input"
              className="modal-input"
              autoFocus
              type="text"
              value={welcomeDraft}
              onChange={(e) => setWelcomeDraft(e.target.value)}
              placeholder="Digite o nome"
            />
            <div className="modal-actions">
              <button type="submit" className="control-btn primary" disabled={!welcomeDraft.trim()}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {textModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={submitCustomText}>
            <h2 className="modal-title">Texto Livre</h2>
            <label className="modal-label" htmlFor="custom-text-input">
              Texto a exibir no painel
            </label>
            <textarea
              id="custom-text-input"
              className="modal-input"
              autoFocus
              rows={3}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Digite o texto"
            />
            <div className="modal-actions">
              <button type="submit" className="control-btn primary" disabled={!textDraft.trim()}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { CONFIG } from "./config.js";
import ControlPanel from "./components/ControlPanel.jsx";
import PanelPage from "./components/PanelPage.jsx";
import { getSettings, saveSettings } from "./services/settingsService.js";

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

  const activateMode = useCallback((mode) => {
    if (!isValidMode(mode)) return null;
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

  useEffect(() => {
    if (isWelcomeCliente) {
      setWelcomeDraft(welcomeName);
      setWelcomeModalOpen(true);
    } else {
      setWelcomeModalOpen(false);
    }
  }, [isWelcomeCliente]);

  function submitWelcomeName(e) {
    e?.preventDefault?.();
    const trimmed = welcomeDraft.trim();
    if (!trimmed) return;
    setWelcomeName(trimmed);
    setWelcomeModalOpen(false);
  }

  return (
    <div className="app-layout">
      <main className="preview-area">
        <PanelPage
          embedded
          activeMode={activeMode}
          welcomeName={welcomeName}
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
    </div>
  );
}

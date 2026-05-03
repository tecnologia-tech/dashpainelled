import { CONFIG } from "../config.js";

export default function ControlPanel({ activeMode, activateMode }) {
  return (
    <div className="control-panel">
      <div className="control-group" style={{ borderRight: "none" }}>
        <span className="group-title">Modo</span>
        {Object.values(CONFIG.MODES).map((mode) => (
          <button
            key={mode}
            className={`control-btn${activeMode === mode ? " active" : ""}`}
            onClick={() => activateMode(mode)}
          >
            {CONFIG.MODE_LABELS[mode] ?? mode}
          </button>
        ))}
      </div>
    </div>
  );
}

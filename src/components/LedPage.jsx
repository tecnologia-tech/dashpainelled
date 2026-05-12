import { CONFIG } from "../config.js";
import LedCanvas from "./LedCanvas.jsx";

function getParams() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

function shouldDebugModules() {
  if (CONFIG.PANEL?.DEBUG_MODULES) return true;
  const p = getParams();
  return !!p?.has("modules");
}

function shouldFullScreen() {
  const p = getParams();
  return !!p?.has("full");
}

function readOffsetX() {
  const p = getParams();
  const raw = p?.get("offset");
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return CONFIG.PANEL?.OFFSET_X ?? 0;
} 

export default function LedPage() {
  const debugModules = shouldDebugModules();
  const fullScreen = shouldFullScreen();
  const offsetX = readOffsetX();
  const pageClass = "led-page" + (fullScreen ? " led-page-full" : "");
  return (
    <div className={pageClass}>
      <div className="led-strip">
        <LedCanvas
          playing={true}
          speed={CONFIG.TICKER.SPEED_PX_PER_SECOND}
          width={CONFIG.PANEL.WIDTH}
          height={CONFIG.PANEL.HEIGHT}
          debugModules={debugModules}
          offsetX={offsetX}
        />
      </div>
    </div>
  );
}

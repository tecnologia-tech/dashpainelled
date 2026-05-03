import { CONFIG } from "../config.js";
import LedCanvas from "./LedCanvas.jsx";

function shouldDebugModules() {
  if (CONFIG.PANEL?.DEBUG_MODULES) return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("modules");
}

export default function LedPage() {
  const debugModules = shouldDebugModules();
  return (
    <div className="led-page">
      <div className="led-strip">
        <LedCanvas
          playing={true}
          speed={CONFIG.TICKER.SPEED_PX_PER_SECOND}
          width={CONFIG.PANEL.WIDTH}
          height={CONFIG.PANEL.HEIGHT}
          debugModules={debugModules}
        />
      </div>
    </div>
  );
}

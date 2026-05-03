import { CONFIG } from "../config.js";
import LedCanvas from "./LedCanvas.jsx";

export default function LedPage() {
  return (
    <div className="led-page">
      <div className="led-strip">
        <LedCanvas
          playing={true}
          speed={CONFIG.TICKER.SPEED_PX_PER_SECOND}
        />
      </div>
    </div>
  );
}

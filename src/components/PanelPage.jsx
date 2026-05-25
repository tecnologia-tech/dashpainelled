import { useEffect, useRef, useState } from "react";
import { CONFIG } from "../config.js";
import * as background from "../layers/backgroundLayer.js";
import * as barsTest from "../layers/barsTestLayer.js";
import * as colaboradorTickerLayer from "../layers/colaboradorTickerLayer.js";
import * as goalsTicker from "../layers/goalsTickerLayer.js";
import * as lastDanceLayer from "../layers/lastDanceLayer.js";
import * as liveTickerLayer from "../layers/liveTickerLayer.js";
import * as textTickerLayer from "../layers/textTickerLayer.js";
import * as welcomeClienteLayer from "../layers/welcomeClienteLayer.js";
import { ensureLoaded as ensureGoals } from "../services/goalsService.js";
import { getSettings, saveSettings } from "../services/settingsService.js";
import { KEY_TO_MODE } from "../services/modeKeymap.js";

const PANEL_WIDTH = 2112;
const PANEL_HEIGHT = 192;
const MODULE_COUNT = 16;

const COLAB_MESSAGE = "SEJAM BEM VINDOS A TOCA DA PANTERA";

const MODE_OVERLAY_LABELS = {
  // lastDance removido: agora renderiza o ticker temático, não um overlay estático.
  blackFriday: "Modo Black Friday",
  nutDay: "Modo NutDay",
  ra: "RA",
};

const LEGACY_MODE_ALIAS = { bemVindo: "bemVindoCliente" };
function normalizeMode(m) {
  return LEGACY_MODE_ALIAS[m] ?? m;
}
function isValidMode(m) {
  return typeof m === "string" && Object.values(CONFIG.MODES).includes(m);
}

function readParams() {
  if (typeof window === "undefined") return { test: null, debug: null };
  const p = new URLSearchParams(window.location.search);
  return { test: p.get("test"), debug: p.get("debug") };
}

function drawModeOverlay(ctx, W, H, label) {
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const fontSize = Math.max(40, Math.round(H * 0.42));
  ctx.font = `900 ${fontSize}px Montserrat, Arial, sans-serif`;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = Math.round(H * 0.06);
  ctx.lineWidth = Math.max(6, Math.round(fontSize * 0.14));
  ctx.strokeStyle = "#000";
  ctx.strokeText(label, W / 2, H / 2);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#FFD200";
  ctx.fillText(label, W / 2, H / 2);
  ctx.restore();
}

// Moldura pontilhada estática (overlay fixo). Lados configuráveis via b.sides.
function drawDottedBorder(ctx, W, H, b) {
  const m = b.margin ?? 6;
  const sides = b.sides || ["top", "bottom", "left", "right"];
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.globalAlpha = b.opacity ?? 1;
  ctx.strokeStyle = b.color ?? "#F5D90A";
  ctx.lineWidth = b.width ?? 4;
  ctx.setLineDash(Array.isArray(b.dash) ? b.dash : [10, 12]);
  ctx.lineCap = "butt";
  const line = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  if (sides.includes("top")) line(m, m, W - m, m);
  if (sides.includes("bottom")) line(m, H - m, W - m, H - m);
  if (sides.includes("left")) line(m, m, m, H - m);
  if (sides.includes("right")) line(W - m, m, W - m, H - m);
  ctx.restore();
}

function drawModulesOverlay(ctx, W, H) {
  const moduleW = W / MODULE_COUNT;
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.font = `900 ${Math.max(40, Math.round(H * 0.1))}px Montserrat, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let i = 0; i < MODULE_COUNT; i++) {
    const x = i * moduleW;
    ctx.lineWidth = 2;
    ctx.strokeStyle = i % 2 ? "#0f0" : "#00f";
    ctx.strokeRect(x + 1, 1, moduleW - 2, H - 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000";
    ctx.strokeText(String(i + 1), x + moduleW / 2, H / 2);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + moduleW / 2, H / 2);
  }
  ctx.restore();
}

// Tile da sequência do ticker dentro da viewport, 1:1.
// Wrap por `total` (largura natural da sequência).
function drawTickerTiled(ctx, items, total, offset, W) {
  const cycle = Math.max(1, total);
  const wrapped = ((offset % cycle) + cycle) % cycle;
  for (let baseX = -cycle; baseX < W + cycle; baseX += cycle) {
    for (const item of items) {
      const drawX = item.x + baseX - wrapped;
      if (drawX + item.w < 0 || drawX > W) continue;
      item.draw(ctx, drawX);
    }
  }
}

export default function PanelPage({
  embedded = false,
  activeMode: controlledMode,
  welcomeName = "",
  customText = "",
  forceMetas = false,
} = {}) {
  void embedded;
  const canvasRef = useRef(null);
  const { test, debug } = readParams();
  const isBars = test === "bars";
  const debugModules = debug === "modules";
  const debugSeam = debug === "seam";

  const isControlled = controlledMode != null;
  const [internalMode, setInternalMode] = useState(CONFIG.ACTIVE_MODE_DEFAULT);
  const activeMode = isControlled ? controlledMode : internalMode;
  const setActiveMode = setInternalMode;
  const activeModeRef = useRef(activeMode);
  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  const isPanteraVideo = activeMode === CONFIG.MODES.PANTERA_VIDEO;
  const isSinoVideo = activeMode === CONFIG.MODES.SINO;
  const isTogetherVideo = activeMode === CONFIG.MODES.TOGETHER;
  const isNormal = activeMode === CONFIG.MODES.NORMAL;
  const isWelcomeColaborador =
    activeMode === CONFIG.MODES.BEM_VINDO_COLABORADOR;
  const isWelcomeCliente =
    activeMode === CONFIG.MODES.BEM_VINDO_CLIENTE;
  const isTextoLivre =
    activeMode === CONFIG.MODES.TEXTO_LIVRE && !!customText;
  const isLive = activeMode === CONFIG.MODES.LIVE;
  const isLastDance = activeMode === CONFIG.MODES.LAST_DANCE;
  const overlayLabel = MODE_OVERLAY_LABELS[activeMode];

  // NORMAL mode: alternate dash/video each cycle.
  const [metasPhase, setMetasPhase] = useState("dash");
  useEffect(() => {
    if (!isNormal || forceMetas) {
      setMetasPhase("dash");
      return;
    }
    const dashMs = CONFIG.METAS_ROTATION?.DASH_DURATION_MS ?? 60_000;
    const videoMs = CONFIG.METAS_ROTATION?.VIDEO_DURATION_MS ?? 60_000;
    let timeoutId;
    function schedule(phase) {
      setMetasPhase(phase);
      const wait = phase === "dash" ? dashMs : videoMs;
      timeoutId = setTimeout(() => {
        schedule(phase === "dash" ? "video" : "dash");
      }, wait);
    }
    schedule("dash");
    return () => clearTimeout(timeoutId);
  }, [isNormal, forceMetas]);
  const isMetasVideo = isNormal && metasPhase === "video";
  useEffect(() => {
    if (isControlled || forceMetas) return;
    let cancelled = false;
    function loadOnce() {
      getSettings()
        .then((s) => {
          if (cancelled) return;
          const m = normalizeMode(s.activeMode);
          if (isValidMode(m) && m !== activeModeRef.current) setActiveMode(m);
        })
        .catch(() => {});
    }
    loadOnce();
    const id = setInterval(loadOnce, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isControlled, forceMetas]);

  useEffect(() => {
    if (isControlled || forceMetas) return;
    function onKeyDown(e) {
      const mode = KEY_TO_MODE[e.key];
      if (!mode) return;
      if (activeModeRef.current === mode) return;
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
      }).catch(() => {});
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isControlled, forceMetas]);

  useEffect(() => {
    if (isWelcomeCliente) {
      welcomeClienteLayer.setName(welcomeName || "");
    }
  }, [isWelcomeCliente, welcomeName]);

  useEffect(() => {
    if (isTextoLivre) {
      textTickerLayer.setText(customText);
    }
  }, [isTextoLivre, customText]);

  useEffect(() => {
    if (isPanteraVideo || isSinoVideo || isTogetherVideo || isMetasVideo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas interno fixo 2112x192. CSS força mesmo tamanho. Sem DPR, sem scale.
    canvas.width = PANEL_WIDTH;
    canvas.height = PANEL_HEIGHT;
    canvas.style.width = `${PANEL_WIDTH}px`;
    canvas.style.height = `${PANEL_HEIGHT}px`;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const bgPromise = background.ensureLoaded();
    goalsTicker.ensureLoaded?.();
    colaboradorTickerLayer.setText(COLAB_MESSAGE);
    const colabImgPromise = colaboradorTickerLayer.ensureLoaded();
    const liveImgPromise = liveTickerLayer.ensureLoaded();
    if (!isBars && !isWelcomeColaborador) ensureGoals();

    let raf;
    let cancelled = false;
    let offset = 0;
    let lastT = 0;
    const speed = CONFIG.TICKER.SPEED_PX_PER_SECOND || 180;
    // Theme do modo (Last Dance). null nos demais modos.
    const theme = isLastDance ? (CONFIG.MODE_THEMES?.lastDance ?? null) : null;
    // Fundo sólido do tema (Last Dance = rosa). null → usa background padrão.
    const themeBg = theme?.bg ?? null;

    function frame(t) {
      if (cancelled) return;
      if (!lastT) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;

      const W = PANEL_WIDTH;
      const H = PANEL_HEIGHT;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);

      if (isBars) {
        barsTest.render(ctx, { width: W, height: H, progress: 0 });
        if (debugModules) drawModulesOverlay(ctx, W, H);
        raf = requestAnimationFrame(frame);
        return;
      }

      if (themeBg) {
        ctx.fillStyle = themeBg;
        ctx.fillRect(0, 0, W, H);
      } else {
        background.render(ctx, { width: W, height: H, progress: 0 });
      }

      if (overlayLabel) {
        drawModeOverlay(ctx, W, H, overlayLabel);
        if (debugModules) drawModulesOverlay(ctx, W, H);
        raf = requestAnimationFrame(frame);
        return;
      }

      offset += speed * dt;

      const tickerSrc = isWelcomeColaborador
        ? colaboradorTickerLayer
        : isWelcomeCliente
          ? welcomeClienteLayer
          : isTextoLivre
            ? textTickerLayer
            : isLive
              ? liveTickerLayer
              : isLastDance
                ? lastDanceLayer
                : goalsTicker;

      ctx.font = CONFIG.TICKER.FONT;
      let items = [];
      let total = 1;
      try {
        const r = tickerSrc.getItems(ctx, H);
        items = r?.items ?? [];
        total = r?.total ?? 1;
      } catch (err) {
        console.error("ticker getItems failed:", err);
      }
      if (total > 0) offset = ((offset % total) + total) % total;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      drawTickerTiled(ctx, items, total, offset, W);
      ctx.restore();

      // Borda pontilhada FIXA (overlay) — desenhada após o ticker, sem offset.
      // Não faz parte da camada que rola.
      if (theme?.border?.enabled) drawDottedBorder(ctx, W, H, theme.border);

      if (debugSeam) {
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#f0f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0.5, 0);
        ctx.lineTo(0.5, H);
        ctx.moveTo(W - 0.5, 0);
        ctx.lineTo(W - 0.5, H);
        ctx.stroke();
        ctx.fillStyle = "#f0f";
        ctx.font = "900 18px Montserrat, Arial, sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText(`PW=${W} off=${offset.toFixed(1)} cycle=${total}`, 8, 4);
        ctx.restore();
      }

      if (debugModules) drawModulesOverlay(ctx, W, H);

      raf = requestAnimationFrame(frame);
    }

    (async () => {
      if (document.fonts) await document.fonts.ready;
      await bgPromise;
      if (isWelcomeColaborador) await colabImgPromise;
      if (isLive) await liveImgPromise;
      if (cancelled) return;
      raf = requestAnimationFrame(frame);
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    isBars,
    debugModules,
    debugSeam,
    isPanteraVideo,
    isSinoVideo,
    isTogetherVideo,
    isMetasVideo,
    isWelcomeColaborador,
    isWelcomeCliente,
    isTextoLivre,
    isLive,
    isLastDance,
    overlayLabel,
  ]);

  const panteraPath = CONFIG.VIDEO_MODES.PANTERA?.path ?? "/assets/pantera.mp4";
  const sinoPath = CONFIG.VIDEO_MODES.SINO?.path ?? "/assets/SINOOO.mp4";
  const togetherPath = CONFIG.VIDEO_MODES.TOGETHER?.path ?? "/assets/together.mp4";
  const led12pPath = CONFIG.VIDEO_MODES.LED_12P?.path ?? "/assets/LED%2012P.mp4";

  if (isMetasVideo) {
    return (
      <div className="ledScreen">
        <video
          src={led12pPath}
          autoPlay
          loop
          muted
          playsInline
          className="ledVideo"
        />
      </div>
    );
  }

  if (isPanteraVideo) {
    return (
      <div className="ledScreen">
        <video
          src={panteraPath}
          autoPlay
          loop
          muted
          playsInline
          className="ledVideo"
        />
      </div>
    );
  }

  if (isSinoVideo) {
    return (
      <div className="ledScreen">
        <video
          src={sinoPath}
          autoPlay
          loop
          muted
          playsInline
          className="ledVideo"
        />
      </div>
    );
  }

  if (isTogetherVideo) {
    return (
      <div className="ledScreen">
        <video
          src={togetherPath}
          autoPlay
          loop
          muted
          playsInline
          className="ledVideo"
        />
      </div>
    );
  }

  return (
    <div className="ledScreen">
      <canvas
        ref={canvasRef}
        className="ledCanvas"
        width={PANEL_WIDTH}
        height={PANEL_HEIGHT}
      />
    </div>
  );
}

// config.js
// Configuração central do projeto. Resolução única: 2048x192.

export const CONFIG = {
  WIDTH: 2048,
  HEIGHT: 192,

  BACKGROUND: {
    TYPE: "image", // "solid" | "image"
    PATH: "/assets/background.png",
    FALLBACK_COLOR: "#D9D9D9",
    FIT: "stretch",
  },

  API: {
    WONS_URL: "https://dados-4ew4.onrender.com/api/wons",
    METAS_URL: "/api/metas",
    TIMEOUT_MS: 12000,
    REFRESH_MS: 30000,
  },

  // Fallback usado quando /api/metas falha e não há valor anterior.
  METAS_FALLBACK: {
    meta12p: 3000000,
    metaConsultoria: 1500000,
    metaLtda: 1500000,
  },

  // Pipeline da LTDA dentro de /api/wons.
  LTDA_PIPELINE: "DISNEYLEADS 🟡⚫️",

  // Pipelines de Consultoria (Geral.jsx). Comparados normalizados:
  // sem acento/emoji/pontuação, espaços colapsados, UPPERCASE.
  CONSULTORIA_PIPELINES: [
    "IMPORTAÇÃO CONJUNTA",
    "CONSULTORIA LANNISTER",
    "REPEDIDO",
    "GANHO PRODUTO",
    "FEE MENSAL",
    "BONUS PARCEIROS",
    "IMPORTAÇÃO CONJUNTA 12PXP",
  ],

  // Slot fixo de cada ícone (mantém todos do mesmo tamanho visual).
  ICON_SLOT: {
    WIDTH: 120,
    HEIGHT: 120,
    Y: 36,
  },

  // Cada ícone só ajusta arquivo + escala/offset dentro do slot.
  ICONS: {
    NETO: {
      PATH: "/assets/icons/neto.png",
      SCALE: 1.0,
      OFFSET_X: 0,
      OFFSET_Y: 0,
    },
    CAMONHA: {
      PATH: "/assets/icons/camonha.png",
      SCALE: 1.35,
      OFFSET_X: 0,
      OFFSET_Y: 8,
    },
    ARIANE: {
      PATH: "/assets/icons/ariane.png",
      SCALE: 1.0,
      OFFSET_X: 0,
      OFFSET_Y: 0,
      FLIP_X: true,
    },
  },

  TICKER: {
    SPEED_PX_PER_SECOND: 180,
    GAP: 0, // gap final do ciclo (espaçamento controlado por TICKER_SPACING)
    FONT: "800 86px Montserrat, Arial, sans-serif",
    TEXT_Y: 126,
    COLOR: "#FFFFFF",
    VALUE_COLOR: "#FFD200",
    META_COLOR: "#E5E5E5",
    SHADOW: true,
    SHADOW_COLOR: "#000000",
    SHADOW_BLUR: 3,
    STROKE: true,
    STROKE_COLOR: "#000000",
    STROKE_WIDTH: 4,
  },

  // Paleta monocromática por setor.
  // dark = bolinha separadora
  // mid  = nome do setor / valor meta
  // light= rótulos "Alcançado"/"Meta"
  // strong = valor alcançado / accent glow
  SECTOR_COLORS: {
    GLOBAL_12P: {
      dark: "#1B8F3A",
      mid: "#2ECC71",
      light: "#A5D6A7",
      strong: "#2ECC71",
    },
    CONSULTORIA: {
      dark: "#FF6B00",
      mid: "#FF8C1A",
      light: "#FFB347",
      strong: "#FF6B00",
    },
    NOVOS_NEGOCIOS: {
      dark: "#D4A000",
      mid: "#FFC107",
      light: "#FFE082",
      strong: "#FFC107",
    },
  },

  // Escala única de espaçamento. Tokens semânticos, simétricos em torno da bolinha.
  TICKER_SPACING: {
    ICON_TO_LABEL: 12, // boneco ↔ nome do setor (próximo)
    LABEL_TO_ALCANCADO: 40, // nome setor ↔ "Alcançado:"
    LABEL_VALUE_GAP: 18, // "Alcançado:" ↔ valor / "Meta:" ↔ valor
    ALCANCADO_TO_META: 52, // valor alcançado ↔ "Meta:"
    BULLET_PAD: 80, // gap igual antes e depois da bolinha
  },

  DISPLAY_ROTATION: {
    ENABLED: true,
    DASH_DURATION_MS: 120000,
    VIDEO_DURATION_MS: 1,
  },

  VIDEO_MODES: {
    NORMAL: { label: "Normal", path: "/assets/video.mp4" },
    LAST_DANCE: { label: "Last Dance", path: "/assets/last-dance.mp4" },
    NUT_DAY: { label: "Nut Day", path: "/assets/nut-day.mp4" },
    BLACK_FRIDAY: { label: "Black Friday", path: "/assets/black-friday.mp4" },
  },

  SINO_ENABLED_DEFAULT: false,

  MODES: {
    NORMAL: "normal",
    SINO: "sino",
    LAST_DANCE: "lastDance",
    BLACK_FRIDAY: "blackFriday",
    TOGETHER: "together",
    BEM_VINDO_CLIENTE: "bemVindoCliente",
    BEM_VINDO_COLABORADOR: "bemVindoColaborador",
    NUT_DAY: "nutDay",
  },

  MODE_LABELS: {
    normal: "Normal",
    sino: "Sino",
    lastDance: "Last Dance",
    blackFriday: "Black Friday",
    together: "Together",
    bemVindoCliente: "Bem-vindo Cliente",
    bemVindoColaborador: "Bem vindo Colaborador",
    nutDay: "Nut Day",
  },

  MODE_TO_VIDEO_KEY: {
    normal: "NORMAL",
    sino: "NORMAL",
    lastDance: "LAST_DANCE",
    blackFriday: "BLACK_FRIDAY",
    together: "NORMAL",
    bemVindoCliente: "NORMAL",
    bemVindoColaborador: "NORMAL",
    nutDay: "NUT_DAY",
  },

  MODE_PLACEHOLDERS: {
    sino: "MODO SINO",
    lastDance: "LAST DANCE",
    blackFriday: "BLACK FRIDAY",
    together: "TOGETHER",
    bemVindoCliente: "BEM-VINDO CLIENTE",
    bemVindoColaborador: "BEM VINDO COLABORADOR",
    nutDay: "NUT DAY",
  },

  ACTIVE_MODE_DEFAULT: "normal",

  MODE_BACKEND_URL: "http://localhost:3000/mode",

  FRAME_COUNT: 120,
  SHOW_CONTROLS: true,
  SHOW_DEBUG: false,

  EXPORT: {
    SPRITESHEET_COLUMNS: 10,
  },
};

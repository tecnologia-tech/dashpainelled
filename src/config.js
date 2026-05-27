// config.js
// Configuração central do projeto. Resolução única: 2048x192.

export const CONFIG = {
  WIDTH: 2048,
  HEIGHT: 192,

  // Sinal real do Windows entregue à controladora no modo /?panel.
  // Se a viewport reportar 2112×1048, ticker precisa cobrir 2112 (não 2048),
  // senão últimos módulos ficam pretos.
  PANEL_SIGNAL: {
    WIDTH: 2112,
    HEIGHT: 1048,
    STRIP_HEIGHT: 192,
  },

  // Painel LED físico (rota /led). 16 módulos × 128px = 2048.
  PANEL: {
    WIDTH: 2048,
    HEIGHT: 192,
    MODULE_COUNT: 16,
    MODULE_WIDTH: 128,
    // Overlay de debug com linhas verticais a cada MODULE_WIDTH.
    // Pode ser ativado via querystring ?modules em /led.
    DEBUG_MODULES: false,
    // Deslocamento horizontal aplicado a todo o conteúdo da rota /led.
    // Wrap circular: o que sai pela direita entra pela esquerda.
    // Override em runtime via querystring ?offset=N (N múltiplo de 128 p/ módulo).
    OFFSET_X: 0,
  },

  BACKGROUND: {
    TYPE: "image", // "solid" | "image"
    PATH: "/assets/background.png",
    FALLBACK_COLOR: "#D9D9D9",
    FIT: "stretch",
  },

  API: {
    // WONS: prod via /api/wons proxy (CORS — onrender só libera localhost). Dev hit direto.
    WONS_URL: import.meta.env.PROD
      ? "/api/wons"
      : "https://dados-4ew4.onrender.com/api/wons",
    // METAS: URL absoluta Render. Sem proxy local. Confirmar CORS upstream em prod.
    METAS_URL: "https://dados-4ew4.onrender.com/api/metas",
    TIMEOUT_MS: 30000,
    REFRESH_MS: 30000,
  },

  // Bootstrap antes da primeira resposta da API. Zero — sem hardcode.
  // Após primeiro fetch ok, lastMetas guarda último valor real (memória).
  METAS_FALLBACK: {
    meta12p: 0,
    metaConsultoria: 0,
    metaLtda: 0,
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
    LOGO_12P: {
      PATH: "/assets/12P.png",
      SCALE: 1.6,
      OFFSET_X: 0,
      OFFSET_Y: 0,
    },
    // Separador do modo Last Dance (logo amarelo "Last Dance" sobre rosa).
    // _trim = PNG recortado ao bounding box do conteúdo (margem transparente
    // removida). O original tinha tinta deslocada à esquerda (margem R=103,
    // L=0), o que jogava o logo fora do centro do slot mesmo com gaps simétricos.
    LAST_DANCE: {
      PATH: "/assets/Last_Dance_trim.png",
      SCALE: 1.0,
      OFFSET_X: 0,
      OFFSET_Y: 0,
    },
  },

  // Variantes "LD" dos ícones de setor (personagens temáticos Last Dance).
  // Usadas só quando o theme define iconSet: "LD". Sizing herda de CONFIG.ICONS.
  ICONS_LD: {
    NETO:    "/assets/icons/netoLD.png",
    CAMONHA: "/assets/icons/camonhaLD.png",
    ARIANE:  "/assets/icons/arianeLD.png",
  },

  // Temas por modo. goalsTickerLayer aceita um theme opcional e troca
  // fonte/paleta/ícone separador SEM duplicar a lógica de blocos/loop.
  // Mesma fonte de dados e mesmo cálculo do modo Metas — só muda o visual.
  MODE_THEMES: {
    lastDance: {
      bg: "#E6005C",     // fundo rosa/magenta
      fg: "#FFD60A",     // amarelo vivo (nomes de setor + valores) — mais luminoso no LED
      accent: "#FFFFFF", // rótulos "Alcançado:" / "Meta:" em branco puro
      // Fonte oficial Last Dance (local). Mesma família do resto do projeto.
      font: 'normal 92px "Last Dance", Impact, sans-serif',
      numberFont: 'normal 92px "Last Dance", Impact, sans-serif',
      fontStyle: "normal",
      noStroke: true,        // texto amarelo sólido — sem contorno e sem sombra
      iconSet: "LD",         // ícones de setor usam as variantes *LD.png
      sectorIconScale: 1.4,  // bonecos LD ~88% da altura da strip (base = ICON_SLOT.HEIGHT)
      sectorIconPadding: 6,  // margem topo/baixo; também limita o clamp (capH=H-2*pad=180)
      // Os 3 bonecos LD agora são PNG 500x500 com conteúdo centralizado e
      // ~0.98 de preenchimento de altura → mesma escala base, sem override por ícone.
      // Sombra suave (tira o "chapado"). Não aplica ao separador (logo).
      textShadow: { enabled: true, color: "rgba(0,0,0,0.45)", blur: 8, offsetX: 2, offsetY: 3 },
      iconShadow: { enabled: true, color: "rgba(0,0,0,0.45)", blur: 6, offsetX: 2, offsetY: 3 },
      separatorShadow: false,
      blockGap: 220,         // respiro entre blocos (padrão metas ~120-140)
      separatorGap: 80,      // padding de cada lado do logo separador
      separatorIconKey: "LAST_DANCE", // logo Last Dance no lugar da bolinha "•"
      separatorImageScale: 1.6, // logo maior/proporcional (testar 1.4–1.8)
      separatorPadding: 40,     // respiro extra ao redor do logo separador
      // Moldura pontilhada fixa (overlay, não rola com o ticker).
      // Só topo e base; opacidade suave.
      border: {
        enabled: true,
        color: "#F5D90A",
        width: 4,
        dash: [10, 12],
        margin: 6,
        sides: ["top", "bottom"],
        opacity: 0.5,
      },
    },
  },

  TICKER: {
    SPEED_PX_PER_SECOND: 180,
    GAP: 0, // gap final do ciclo (espaçamento controlado por TICKER_SPACING)
    // Fonte padrão (Metas e demais modos). Last Dance só via MODE_THEMES.lastDance.
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
    LOGO_INNER_PAD: 360, // gap interno bola↔logo 12P (cada lado)
    LOGO_OUTER_PAD: 320, // gap externo texto↔bola e bola↔próximo bloco no separador 12P
    // Live mode — pulseDot + texto + pulseDot + logo 12P.
    LIVE_DOT_TO_TEXT: 24, // pulseDot ↔ texto "ESTAMOS EM LIVE!!!"
    LIVE_TEXT_TO_DOT: 24, // texto ↔ segundo pulseDot
    LIVE_DOT_TO_LOGO: 360, // pulseDot ↔ logo 12P (logo como pausa visual)
    LIVE_LOGO_TO_DOT: 360, // logo 12P ↔ pulseDot do próximo ciclo
  },

  DISPLAY_ROTATION: {
    ENABLED: true,
    DASH_DURATION_MS: 120000,
    VIDEO_DURATION_MS: 1,
  },

  VIDEO_MODES: {
    NORMAL: { label: "Normal", path: "/assets/video.mp4" },
    // LAST_DANCE: ticker temático intercalado com este vídeo (1 min cada).
    LAST_DANCE: { label: "Last Dance", path: "/assets/last%20dance.mp4" },
    NUT_DAY: { label: "Nut Day", path: "/assets/nut-day.mp4" },
    BLACK_FRIDAY: { label: "Black Friday", path: "/assets/black-friday.mp4" },
    PANTERA: { label: "Pantera", path: "/assets/pantera.mp4" },
    SINO: { label: "Sino", path: "/assets/SINOOO.mp4" },
    TOGETHER: { label: "Together", path: "/assets/together.mp4" },
    LED_12P: { label: "LED 12P", path: "/assets/LED%2012P.mp4" },
  },

  METAS_ROTATION: {
    DASH_DURATION_MS: 60_000,
    VIDEO_DURATION_MS: 60_000,
  },

  // Last Dance: intercala dash temático e vídeo last dance.mp4, 1 min cada.
  LAST_DANCE_ROTATION: {
    DASH_DURATION_MS: 60_000,
    VIDEO_DURATION_MS: 60_000,
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
    PANTERA_VIDEO: "panteraVideo",
    RA: "ra",
    TEXTO_LIVRE: "textoLivre",
    LIVE: "live",
  },

  MODE_LABELS: {
    normal: "Metas",
    sino: "Sino",
    lastDance: "Last Dance",
    blackFriday: "Black Friday",
    together: "Together",
    bemVindoCliente: "Bem-vindo Cliente",
    bemVindoColaborador: "Bem vindo Colaborador",
    nutDay: "Nut Day",
    panteraVideo: "Toca Pantera",
    ra: "RA",
    textoLivre: "Texto",
    live: "Live",
  },

  MODE_TO_VIDEO_KEY: {
    normal: "NORMAL",
    sino: "SINO",
    // lastDance removido: não é mais vídeo, é ticker temático.
    blackFriday: "BLACK_FRIDAY",
    together: "TOGETHER",
    bemVindoCliente: "NORMAL",
    bemVindoColaborador: "NORMAL",
    nutDay: "NUT_DAY",
    panteraVideo: "PANTERA",
    textoLivre: "NORMAL",
    live: "NORMAL",
  },

  MODE_PLACEHOLDERS: {
    sino: "MODO SINO",
    lastDance: "LAST DANCE",
    blackFriday: "BLACK FRIDAY",
    together: "TOGETHER",
    bemVindoCliente: "BEM-VINDO CLIENTE",
    bemVindoColaborador: "BEM VINDO COLABORADOR",
    nutDay: "NUT DAY",
    ra: "RA",
    textoLivre: "TEXTO",
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

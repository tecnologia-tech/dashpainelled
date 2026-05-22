# ANÁLISE DO DASHBOARD — Painel LED 2112×192

Documento gerado por inspeção estática. Nenhum código foi alterado.

---

## 1. Estrutura do projeto

### Árvore (ignorando `node_modules`, `dist`)

```
dash painelled/
├── .env                       (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
├── .gitignore
├── index.html                 (entry HTML do Vite)
├── package.json               (name: led-circular-dash, v2.0.0)
├── package-lock.json
├── README.md
├── vercel.json                (rewrites: /api/* + SPA fallback)
├── vite.config.js             (proxy /api → :3001)
├── api/                       (Vercel serverless functions)
│   ├── metas.js               (proxy → dados-4ew4.onrender.com/api/metas)
│   └── wons.js                (proxy → dados-4ew4.onrender.com/api/wons)
├── public/
│   └── assets/
│       ├── 12P.png            (logo)
│       ├── background.png
│       ├── icons/             (neto.png, camonha.png, ariane.png)
│       ├── LED 12P.mp4   (26 MB)
│       ├── pantera.mp4   (22 MB)
│       ├── SINOOO.mp4    (10 MB)
│       ├── together.mp4  (57 MB)
│       └── video.mp4     (26 MB)
├── server/
│   ├── server.js              (Express, porta 3001 — dev local)
│   └── settings.json          (persistência de modo/velocidade)
└── src/
    ├── main.jsx               (router por window.location.pathname)
    ├── App.jsx                (shell + ControlPanel + modais)
    ├── config.js              (CONFIG central)
    ├── exporter.js            (PNG frames / spritesheet / JSON)
    ├── styles.css
    ├── components/
    │   ├── ControlPanel.jsx   (botões de modo)
    │   ├── DebugHud.jsx       (HUD overlay)
    │   ├── LedCanvas.jsx      (legacy — usado por /led)
    │   ├── LedPage.jsx        (rota /led — full screen)
    │   ├── PanelPage.jsx      (componente principal — render de canvas e vídeo)
    │   └── VideoPlayer.jsx    (não está sendo importado)
    ├── layers/                (camadas Canvas 2D)
    │   ├── backgroundLayer.js
    │   ├── barsTestLayer.js   (modo diagnóstico)
    │   ├── colaboradorTickerLayer.js
    │   ├── goalsTickerLayer.js (ticker principal de metas)
    │   ├── liveTickerLayer.js  (ESTAMOS EM LIVE!!!)
    │   ├── textTickerLayer.js  (texto livre)
    │   └── welcomeClienteLayer.js
    ├── pages/
    │   └── ClienteNaCasaPage.jsx (rota /clientenacasa — CRUD localStorage)
    ├── services/
    │   ├── clienteNaCasaService.js (localStorage helpers)
    │   ├── goalsService.js         (fetch wons+metas, soma do mês)
    │   └── settingsService.js      (GET/PUT /api/settings)
    └── utils/
        ├── canvasUtils.js
        └── dataHelpers.js     (parseDataBR, toNumber, formatAtingido…)
```

### Stack
- **Build tool:** Vite 5.4.10
- **Framework:** React 18.3.1 + ReactDOM 18.3.1
- **Linguagem:** JavaScript puro (`.jsx`/`.js`, sem TypeScript, sem `tsconfig`)
- **Backend dev:** Express 4.19.2 (porta 3001) + `concurrently`
- **Backend prod:** Vercel serverless (`api/metas.js`, `api/wons.js`) — apenas proxies
- **Plugin:** `@vitejs/plugin-react` 4.3.4
- **Exportação:** `jszip` 3.10.1 + `file-saver` 2.0.5
- **Supabase:** `@supabase/supabase-js` 2.105.3 instalado, **nunca importado no código** (dependência morta)
- **Sem testes, sem ESLint, sem Prettier, sem TS, sem React Router** (routing manual em `main.jsx`)

---

## 2. Arquitetura e componentes

### Hierarquia

```
main.jsx (escolhe root por pathname)
│
├── pathname == "/"           → <App>
│                                ├── <PanelPage embedded activeMode … />
│                                └── <ControlPanel> (footer)
│                                +   modais (welcomeCliente, textoLivre)
│
├── pathname == "/led"        → <LedPage>
│                                └── <LedCanvas …> (legacy)
│
├── pathname == "/clientenacasa" → <ClienteNaCasaPage>
│
├── pathname == "/metas"      → <PanelPage activeMode=NORMAL forceMetas>
│
├── pathname == "/live"       → <PanelPage activeMode=LIVE>
│
└── ?panel=…                  → <PanelPage> (sem controles)
```

### Ponto de entrada
- HTML: `index.html` (root `#root`)
- JS: `src/main.jsx` (sem React Router — roteamento por `window.location.pathname`)

### Estado
- **`useState` local** em todos os componentes (sem Context, Redux ou Zustand).
- **Singletons em módulo** (estado global de facto) em `goalsService.js`, `liveTickerLayer.js`, `colaboradorTickerLayer.js`, `welcomeClienteLayer.js`, `textTickerLayer.js`, `backgroundLayer.js` e `goalsTickerLayer.js` — guardam `current`, `lastMetas`, `currentText`, `img`, `iconStatus` no escopo do módulo.
- **`localStorage`** em `clienteNaCasaService.js` (chaves `cliente-na-casa:list`, `cliente-na-casa:pointer`).
- **Refs** (`useRef`) para `activeMode`, `playing`, `speed`, `offset`, `canvasRef` (animação em rAF sem rerender).
- Persistência server-side: `server/settings.json` via GET/PUT `/api/settings` + POST `/mode`.

### Hooks customizados
**Nenhum.** Toda a lógica está direto em `useEffect`/`useState` nos componentes.

---

## 3. Fontes de dados

| Recurso | URL (dev) | URL (prod) | Função |
|---------|-----------|------------|--------|
| `WONS` (vendas) | `https://dados-4ew4.onrender.com/api/wons` (fetch direto, CORS local) | `/api/wons` → proxy Vercel → onrender | Lista de vendas para somar "Alcançado" do mês |
| `METAS` | `https://dados-4ew4.onrender.com/api/metas` | mesmo | Metas por setor (12P, Consultoria, LTDA) |
| `SETTINGS` | `http://localhost:3001/api/settings` (proxy Vite) | `${VITE_API_BASE}/api/settings` | Lê/grava modo ativo, velocidade, fases |
| `MODE` | `http://localhost:3000/mode` (hardcoded em `CONFIG.MODE_BACKEND_URL`) | mesmo | Notifica backend externo da mudança de modo |

### Polling / refresh
- `goalsService.refresh()` é chamado em `setInterval` a cada **30 s** (`CONFIG.API.REFRESH_MS`).
- `PanelPage` faz polling de `/api/settings` a cada **2 s** quando não-controlado e sem `forceMetas`.
- `ClienteNaCasaPage` faz tick interno a cada **1 s** (apenas para atualizar o contador).
- No modo NORMAL, alterna dash↔vídeo a cada **60 s** (`METAS_ROTATION.DASH_DURATION_MS` = 60 000, `VIDEO_DURATION_MS` = 60 000). O `DISPLAY_ROTATION` legado (120 000 / 1) está definido mas não é usado.

### Variáveis de ambiente (`.env`)
```
VITE_SUPABASE_URL=https://edqjalpjnzjcftvprsuw.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
```
**Nota:** `.env` está versionado no `.gitignore` mas existe no working tree. Nenhuma das duas vars é consumida pelo código atual (Supabase nunca importado). `VITE_API_BASE` é referenciada em `settingsService.js` mas não está no `.env`.

Variáveis backend: `PORT` (3001), `METAS_UPSTREAM_URL`, `WONS_UPSTREAM_URL`.

---

## 4. Estilização e layout

### Abordagem CSS
- **CSS puro** em um único arquivo `src/styles.css` (574 linhas). Sem Tailwind, sem styled-components, sem CSS Modules, sem SCSS.
- Custom properties em `:root` (`--panel`, `--fg`, `--accent`, etc.).

### Resolução 2112×192
- Canvas interno em `PanelPage.jsx` é criado com `width=2112 height=192` **fixos** (constantes locais `PANEL_WIDTH`/`PANEL_HEIGHT`).
- `.ledScreen` em CSS tem `position: fixed; left:0; top:0; width:2112px; height:192px; min/max-width/height: 2112/192px` — sem DPR, sem scale, sem zoom (intencional para casar 1:1 com a controladora LED).
- `index.html` usa `<meta name="viewport" content="width=device-width, initial-scale=1">` (padrão; não há viewport especial para o painel).
- `CONFIG.WIDTH = 2048` / `CONFIG.HEIGHT = 192` continuam no config (usados por `LedCanvas` legado, `exporter.js`, fallbacks). `CONFIG.PANEL_SIGNAL.WIDTH = 2112` documenta a largura real entregue pela controladora — `PanelPage` cobre os 2112 px para não deixar módulos pretos à direita.
- 16 módulos × 128 px = 2048 (segundo `CONFIG.PANEL`). Há overlay de debug numerando módulos (`?modules`).

### Tipografia
- Fonte única: **Montserrat** (700/800/900), via `<link>` Google Fonts no `index.html`.
- Tamanhos relevantes:
  - Ticker principal: `800 86px` (`CONFIG.TICKER.FONT`, `TEXT_Y: 126`).
  - Overlay de modo (`Modo Last Dance`, etc.): `Math.max(40, H * 0.42)` ≈ 80 px.
  - Overlay de módulos: ~110 px.
  - UI auxiliar (controles, modais, página CNC): 10–18 px.

### Esquema de cores
- Fundo painel: `/assets/background.png` (TYPE=image, FIT=stretch).
- Texto base ticker: branco `#FFFFFF` com sombra `#000`, contorno `#000` 4 px.
- Paleta por setor (`CONFIG.SECTOR_COLORS`):
  - **GLOBAL_12P** verde (`#1B8F3A`/`#2ECC71`/`#A5D6A7`)
  - **CONSULTORIA** laranja (`#FF6B00`/`#FF8C1A`/`#FFB347`)
  - **NOVOS_NEGOCIOS** amarelo (`#D4A000`/`#FFC107`/`#FFE082`)
- UI controle: dourado `#FFD200` sobre fundo preto.
- Modo LIVE: branco `#ffffff` + vermelho `#ff1a1a`.

### Animações
- **Apenas Canvas 2D + `requestAnimationFrame`**. Sem Framer Motion, GSAP, CSS transitions relevantes (algumas em `:hover` dos botões).
- Loop perfeito do ticker: `offset = -(progress % 1) * cycle`, conteúdo redesenhado em tiles `for (baseX = -cycle; baseX < W+cycle; baseX += cycle)`.
- Pulse dot do modo LIVE: `alpha = 0.3 + 0.7 * |sin(t·π)|` em 1 Hz.

---

## 5. Layout atual do dashboard

### O que aparece (rota `/` ou `?panel`)

**Uma faixa única ultra-widescreen de 2112×192 px**. Não há divisão horizontal/vertical em colunas ou linhas de widgets — tudo é renderizado como uma **única superfície** (canvas ou vídeo full-bleed).

### Modos (selecionáveis via teclas F13–F22 ou botões)

| Modo | Render | Conteúdo |
|------|--------|----------|
| `normal` | Canvas → alterna a cada 60 s com vídeo `LED 12P.mp4` | Ticker de metas: ícone + label + "Alcançado: X" + "Meta: Y" + bolinha • por setor (12P, Consultoria, Novos Negócios), com logo 12P separando o ciclo |
| `sino` | Vídeo `SINOOO.mp4` em loop | — |
| `lastDance` | Canvas (background + overlay "Modo Last Dance") | Overlay estático |
| `blackFriday` | Canvas (overlay "Modo Black Friday") | Overlay estático |
| `together` | Vídeo `together.mp4` (57 MB) | — |
| `bemVindoCliente` | Canvas ticker | "NOME, BEM-VINDO AO 12P, SUA IMPORTAÇÃO COMEÇOU!!!" |
| `bemVindoColaborador` | Canvas ticker | "SEJAM BEM VINDOS A TOCA DA PANTERA" + logo 12P |
| `nutDay` | Canvas (overlay "Modo NutDay") | Overlay estático |
| `panteraVideo` | Vídeo `pantera.mp4` | — |
| `textoLivre` | Canvas ticker | Texto digitado em modal |
| `live` | Canvas ticker | pulseDot · "ESTAMOS EM LIVE!!!" (bicolor) · pulseDot · logo 12P |

### Ocupação espacial (px)

| Elemento | Largura | Altura | Posição |
|----------|---------|--------|---------|
| Faixa LED total | **2112** | **192** | (0,0) — única região |
| `ICON_SLOT` (boneco) | 120 (sem `MARGIN_X` no config atual) | 120 | Y = 36 (centralizado vertical sobra 36 px topo/baixo) |
| Texto do ticker | variável | ~86 px de altura de glifo | baseline Y = 126 |
| Logo 12P separador | ~120 × `SCALE 1.6` ≈ 192 px | até 192 | inline no ciclo |
| Dot LIVE | ~52 px (192 × 0.275) | mesmo | inline |
| Logo 12P LIVE | proporcional a 96 px de altura | 96 | inline |

### Rotação de conteúdo
- **Modo NORMAL** alterna dash↔vídeo a cada 60 s automaticamente.
- **Demais modos:** estáticos enquanto o modo estiver ativo. Trocar de modo é manual (F13–F22, botões `ControlPanel`, ou POST `/mode` externo).
- **Não há carrossel paginado de widgets** — toda variação acontece via troca de modo ou rolagem horizontal do ticker.

---

## 6. Scripts e execução

### `package.json` scripts

| Script | Comando | O que faz |
|--------|---------|-----------|
| `dev` | `vite --host 0.0.0.0` | Vite em :5173, exposto na LAN |
| `server` | `node server/server.js` | Express em :3001 |
| `dev:all` | `concurrently "npm run server" "npm run dev"` | Sobe ambos |
| `build` | `vite build` | Build de produção → `dist/` |
| `preview` | `vite preview` | Serve `dist/` localmente |

### Deploy
- **`vercel.json`** com rewrites: `/api/*` → serverless functions em `api/*`, qualquer outro path → `index.html` (SPA fallback). Compatível com o roteamento manual em `main.jsx`.
- **Sem CI/CD** versionado, sem Dockerfile, sem `nginx.conf`.
- **Sem build específico** para a controladora LED — o painel consome a página renderizada (Chromium/Edge a 2112×1048, faixa de 192 px no topo).

---

## 7. Pontos de atenção

### Duplicação / refatoração
- **`App.jsx` e `PanelPage.jsx` repetem** `LEGACY_MODE_ALIAS`, `KEY_TO_MODE`, `normalizeMode`, `isValidMode`, handler de keydown e POST para `MODE_BACKEND_URL`. Centralizar em um hook (`useModeManager`) eliminaria ~80 linhas duplicadas.
- **`drawText` / `drawAt` / pattern de `draw(ctx, drawX)`** com `if SHADOW { … }` + `if STROKE { … }` aparece em 5 layers (`goalsTickerLayer`, `colaboradorTickerLayer`, `liveTickerLayer`, `textTickerLayer`, `welcomeClienteLayer`). Extrair helper `drawStyledText(ctx, text, x, y, fillColor, strokeColor?)` removeria ~150 linhas.
- **`scaledImgSize` / loaders de imagem** (Promise + `Image` + status) duplicados em `colaboradorTickerLayer` e `liveTickerLayer`.
- **`getItems` vs `render`** em cada layer fazem essencialmente o mesmo cálculo de larguras — `render` poderia simplesmente iterar `getItems().items` em vez de re-construir. `goalsTickerLayer` tem `drawBlocks` (legacy) + `makeTextItem/makeIconItem` (novo) coexistindo.
- **`LedCanvas.jsx`** parece ser a versão antiga; `PanelPage.jsx` é o caminho usado por `/`, `/metas`, `/live` e `?panel`. `LedCanvas` só é usado em `/led`. Considerar consolidar.
- **`VideoPlayer.jsx`** existe mas **não é importado** em lugar nenhum (dead code).
- Dependência `@supabase/supabase-js` instalada e não usada.

### Riscos para novas features
- **Roteamento manual** em `main.jsx` — adicionar rota é fácil (basta checar pathname), mas não há proteção contra colisão.
- **Singletons em módulo** (`goalsService.current`, `liveTickerLayer.img`) são compartilhados entre instâncias. Múltiplas instâncias do mesmo layer **vão se atropelar**.
- **`PanelPage` é gigante (432 linhas)** e mistura: routing por modo, polling de settings, listener de teclado, ciclo dash/vídeo, animação rAF, condicional de vídeo HTML. Adicionar um novo modo exige editar em ~6 lugares: `CONFIG.MODES`, `MODE_LABELS`, `MODE_TO_VIDEO_KEY`, `KEY_TO_MODE` (App e PanelPage), seleção de `tickerSrc` no `frame()`, e provavelmente um novo layer ou `MODE_OVERLAY_LABELS`.
- **`CONFIG.MODE_BACKEND_URL = "http://localhost:3000/mode"`** está hardcoded e aponta para um host externo (não o Express interno na 3001) — em produção sempre falha silenciosamente (`.catch(() => {})`).
- **`.env` está no `.gitignore` mas presente no working tree** — risco de vazar a chave Supabase em commits futuros se alguém der `git add -f`.
- **Sem TypeScript, sem testes, sem ESLint** — refactors em `goalsTickerLayer.js` (374 linhas, 3 fluxos coexistindo) são frágeis.
- **Vídeos enormes em `public/assets`** (`together.mp4` = 57 MB, `LED 12P.mp4` = 26 MB). Cada `vite build` os copia para `dist/`. Considerar mover para CDN.
- **`PanelPage` cria canvas com dimensão fixa `2112×192`** mas `CONFIG.WIDTH/HEIGHT` (2048/192) ainda existe e é usado por `exporter.js`. Exportar frames vai gerar **2048 px**, e a controladora consome **2112 px** → exportações desatualizadas.

### TODOs / comentários relevantes
- Nenhum `TODO`/`FIXME` foi encontrado.
- Comentário no `server/server.js`: "Plugar banco real aqui" para `getGoalsFromDatabase()` — atualmente retorna mock hardcoded.
- Comentário em `liveTickerLayer.js` linha 47: `setText` é noop intencional para manter contrato.

---

## RESUMO EXECUTIVO

### Diagrama do fluxo

```
┌──────────────────────────────────────────────────────────────────────┐
│  Controladora LED (Windows) → Chromium → http://host/?panel ou /     │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ main.jsx (router por pathname)                                       │
│   /        → App → PanelPage embedded                                │
│   /metas   → PanelPage forceMetas                                    │
│   /live    → PanelPage LIVE                                          │
│   /led     → LedPage → LedCanvas (legacy)                            │
│   /clientenacasa → ClienteNaCasaPage (CRUD localStorage)             │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PanelPage  ── activeMode  ──┐                                        │
│   ├ canvas 2112×192 (rAF) ──┼─► layer ativa (por mode):              │
│   │                         │     • goalsTicker  (normal)            │
│   │                         │     • liveTicker   (live)              │
│   │                         │     • textTicker   (textoLivre)        │
│   │                         │     • colaboradorTicker (b.v.colab.)   │
│   │                         │     • welcomeCliente    (b.v.cliente)  │
│   │                         │     • barsTest          (?test=bars)   │
│   │                         │     + drawModeOverlay (lastDance/BF/Nut)│
│   │                         │     + backgroundLayer (sempre)         │
│   └ <video>  (sino/together/pantera/normal-fase-vídeo)               │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ goalsService (polling 30s)                                           │
│   fetch /api/wons   → soma valores do mês corrente, por pipeline     │
│   fetch /api/metas  → metas {12P, Consultoria, LTDA}                 │
│       ↓                                                              │
│   { meta12p, metaConsultoria, metaLtda } = { atingido, meta }        │
│       ↓                                                              │
│   goalsTickerLayer.buildBlocks() ⇒ ícone + label + valores + bullet  │
└──────────────────────────────────────────────────────────────────────┘
```

### Stack tecnológica
- React 18 + Vite 5, JS puro (sem TS).
- Render via **Canvas 2D + requestAnimationFrame** (sem libs de animação).
- CSS puro num único `styles.css`.
- Backend dev: Express. Backend prod: Vercel serverless apenas proxiando upstream Render.
- Estado: `useState` local + singletons em módulo + `localStorage` (CNC).
- Routing: parsing manual de `window.location` (sem React Router).

### Como funciona hoje (fluxo dados → render)
1. Browser carrega `/` (ou `?panel`) → React monta `<App>` → renderiza `<PanelPage embedded>`.
2. `PanelPage` lê settings via polling 2 s e/ou ouve F13–F22 para definir `activeMode`.
3. `goalsService.ensureLoaded()` faz fetch inicial + setInterval 30 s para `/api/wons` e `/api/metas`. Normaliza datas/valores, filtra mês corrente, agrega por pipeline.
4. `requestAnimationFrame` chama `frame()` ~60 fps: limpa canvas 2112×192 → desenha background → escolhe `tickerSrc` pelo mode → chama `getItems(ctx, H)` → desenha cópias tiled com `offset += speed * dt`.
5. Modos `panteraVideo`/`sino`/`together`/`normal (fase vídeo)` substituem o canvas por `<video autoPlay loop muted>` ocupando os mesmos 2112×192.
6. `App` também expõe `<ControlPanel>` (footer) com botões 1-a-1 dos modos, escondidos via `.app-panel-mode` quando renderizado na controladora.

### Espaço disponível no layout atual
- **Vertical: 0 px livres.** A faixa é toda 192 px de altura, ocupada por glifos de 86 px + ícones de até 192 px com centralização.
- **Horizontal:** o ciclo do ticker tem largura natural variável (~3 000–6 000 px dependendo do modo). A área de tela (2112 px) é **sempre menor que o ciclo** → o ticker rola continuamente; não há janela "vazia". Para inserir um widget novo, ou:
  - **(a)** adicionar como um novo bloco dentro do ciclo de uma layer existente (ele rolará junto com o resto), ou
  - **(b)** criar uma layer dedicada com mode próprio (ocupa a faixa inteira, mutuamente exclusiva), ou
  - **(c)** sobrepor como overlay fixo (clip por `ctx.save/clip` numa faixa lateral, ex.: reserva 200 px à esquerda para um relógio e roda o ticker nos 1912 restantes — exige clip + transform).
- **Slot fixo recomendado para widget pontual:** 256–384 px de largura (cabem em 3 módulos de 128 px), mantendo glifos legíveis a 86 px e ícones de 120 px.

### Recomendações para adicionar coisas novas respeitando 2112×192

1. **Novo conteúdo rolante** (ex.: alertas, frases motivacionais): criar `src/layers/novoLayer.js` seguindo o contrato `{ id, ensureLoaded, getItems(ctx, H), measureCycle(ctx), render(ctx, state), getIconStatus }`. Adicionar entrada em `CONFIG.MODES` + `MODE_LABELS` + `KEY_TO_MODE` (em **App.jsx e PanelPage.jsx** — duplicado hoje) + selecionar `tickerSrc` dentro de `frame()`.
2. **Novo widget estático** (ex.: relógio, clima, contador): criar layer com `getItems` retornando 1 item de largura fixa. Para mostrar **simultaneamente** com metas, adicionar ao `buildBlocks` em `goalsTickerLayer.js` (rola junto) — ou criar overlay com `ctx.save(); ctx.rect(0,0,Wfixo,192); ctx.clip();` antes do tiling do ticker e empurrar `drawTickerTiled` para começar em `Wfixo`.
3. **Novo vídeo de modo**: salvar `.mp4` em `public/assets/`, adicionar em `CONFIG.VIDEO_MODES` + `MODE_TO_VIDEO_KEY`, replicar bloco condicional no `PanelPage` (`isMeuModoVideo ? <video> : …`). Cuidado com tamanho — `together.mp4` já tem 57 MB.
4. **Antes de qualquer feature nova, refatorar dívidas baratas:**
   - extrair `useModeManager` (deduplicar App/PanelPage),
   - extrair `drawStyledText` helper (5 layers o reimplementam),
   - sincronizar `CONFIG.WIDTH` com o canvas real 2112 (ou parametrizar `PanelPage` por `CONFIG.PANEL_SIGNAL.WIDTH`),
   - corrigir `CONFIG.MODE_BACKEND_URL` (hoje aponta para porta 3000 inexistente).
5. **Restrições de design no painel LED físico:**
   - Glifos abaixo de ~60 px ficam ilegíveis a distância (pitch dos LEDs).
   - Manter ícones dentro do `ICON_SLOT` (120 × 120) ou logos com `SCALE` documentado para não estourar 192 px.
   - Não usar `text-shadow`/blur sutil — perde-se na grade física. As shadows atuais (`SHADOW_BLUR: 3` + `STROKE_WIDTH: 4` preto) já estão calibradas.
   - Cores muito saturadas (`#FF1A1A`, `#FFD200`) renderizam melhor que tons médios.
   - Animação a 60 fps real é necessária: qualquer layer que adicione layout pesado em `getItems` precisa cachear (`buildBlocks` é chamado a cada frame em `goalsTickerLayer.render`).

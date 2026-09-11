# DOCUMENTATION.md

Documentação técnica gerada a partir do código real. Não substitui o `README.md`.

## 1. Visão geral

Painel LED de 2048×192 (sinal real 2112×192) que roda em loop contínuo num display físico de 16 módulos. Renderiza um ticker horizontal de metas comerciais (Global 12P, Consultoria, Novos Negócios) desenhado em `<canvas>`, com dados calculados a partir de vendas ("wons") e metas vindas de uma API externa. Suporta múltiplos "modos" (Last Dance, Sino, Live, Bem-vindo Cliente/Colaborador, Texto Livre, vídeos temáticos etc.) trocados por teclas de função (F13–F24) ou por botões. Stack: React 18 + Vite (front) e Express (back de settings/proxy), com deploy em Vercel via funções serverless em `api/`.

## 2. Setup

### Instalação
```
npm install
```

### Variáveis de ambiente
`.env` (não versionado, está no `.gitignore`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
> **Verificar:** `@supabase/supabase-js` está em `package.json` e as vars `VITE_SUPABASE_*` existem no `.env`, mas **nenhum código em `src/` importa ou usa Supabase**. Dependência/env aparentemente mortos.

Backend/serverless (opcionais, têm default hardcoded):
- `METAS_UPSTREAM_URL` — default `https://dados-4ew4.onrender.com/api/metas` (usado em `server/server.js` e `api/metas.js`)
- `WONS_UPSTREAM_URL` — default `https://dados-4ew4.onrender.com/api/wons` (usado em `api/wons.js`)
- `PORT` — porta do Express, default `3001`
- `VITE_API_BASE` — prefixo base para chamadas do `settingsService`, default `""`

### Comandos (package.json)
```
npm run dev       # Vite dev server em 0.0.0.0:5173
npm run server    # Express (settings + proxies) em :3001
npm run dev:all   # sobe server + dev juntos (concurrently)
npm run build     # build de produção (Vite → dist/)
npm run preview   # preview do build
```
Em dev, Vite faz proxy de `/api/*` → `http://localhost:3001` (`vite.config.js`).

> **Verificar:** `package.json` declara `led-circular-dash` mas a controladora/painel físico e o processo que dispara as teclas F13–F24 não estão descritos no repositório.

## 3. Arquitetura

### Pastas principais
```
api/            Funções serverless Vercel (proxies CORS p/ upstream)
server/         Backend Express local (settings + proxies) + settings.json persistido
public/assets/  Vídeos .mp4, ícones, fontes, background
src/
  main.jsx          Roteamento por pathname (sem router lib)
  App.jsx           App principal (preview + ControlPanel + modais)
  config.js         Configuração central (resolução, modos, cores, temas, spacing)
  components/       PanelPage, LedCanvas, LedPage, ControlPanel, VideoPlayer, DebugHud
  layers/           Camadas de desenho no canvas (uma por tipo de ticker)
  services/         goals, clienteNaCasa, settings, modeKeymap
  utils/            dataHelpers, canvasUtils
  pages/            ClienteNaCasaPage
  exporter.js       Export de frames/spritesheet/JSON
scripts/            Só PNGs (screenshots de checagem) — sem scripts executáveis
dist/              Build gerado
```

### Roteamento (`src/main.jsx`)
Sem biblioteca de router. Decide o root pelo `window.location.pathname` (e querystring):
- `/led` → `<LedPage>` (canvas 2048×192, rota do painel físico)
- `/clientenacasa` → `<ClienteNaCasaPage>` (cadastro de clientes, localStorage)
- `/metas` → `<PanelPage forceMetas>` (só metas, sem rotação de vídeo)
- `/live` → `<PanelPage activeMode=LIVE>`
- `?panel` na query → `<PanelPage>` (sinal 2112×192 p/ controladora)
- default `/` → `<App>` (preview + painel de controle)

### Fluxo de dados
1. `goalsService.ensureLoaded()` (auto-invocado no import) faz `fetch` de `WONS_URL` e `METAS_URL`, com refresh a cada `REFRESH_MS` (30s).
2. `computeAtingidos()` filtra vendas do mês corrente, normaliza nome de pipeline (sem acento/emoji, uppercase) e soma valores por setor: total (12P), Consultoria (pipelines de `CONFIG.CONSULTORIA_PIPELINES`), LTDA (pipeline contendo `DISNEYLEADS`).
3. Metas vêm de `/api/metas`; em erro, mantém `lastMetas` (último valor bom em memória). Sem hardcode de fallback (zeros).
4. `goalsTickerLayer` lê `getGoals()`, monta blocos de texto/ícone e desenha em loop perfeito no canvas.
5. Troca de modo: tecla F13–F24 (`modeKeymap`) ou botão → `saveSettings` (PUT `/api/settings`) + POST `/mode`. `PanelPage` faz *polling* de `/api/settings` a cada 2s p/ sincronizar modo entre abas/telas.

### Padrões usados
- **Layer contract:** cada `src/layers/*.js` exporta `ensureLoaded / getItems / render / measureCycle / getIconStatus`. `PanelPage` seleciona a layer conforme o modo ativo.
- **Loop matemático perfeito:** ciclo = soma das larguras dos blocos; conteúdo tileado (`drawTickerTiled`) com wrap circular; `progress=1 == progress=0` (frame final omitido).
- **Módulo singleton por serviço:** estado (goals, ícones) vive em variáveis de módulo, não em React state.
- **Theme por modo:** `CONFIG.MODE_THEMES.lastDance` troca fonte/paleta/ícone separador sem duplicar a lógica de ticker (`lastDanceLayer` delega 100% ao `goalsTickerLayer` + injeta theme).

## 4. Módulos/componentes principais

| Nome | Responsabilidade | Arquivo |
|------|------------------|---------|
| `main` | Roteamento por pathname/query, monta o root React | `src/main.jsx` |
| `App` | Preview + ControlPanel + modais (nome cliente / texto livre), atalhos de teclado | `src/App.jsx` |
| `CONFIG` | Config central: resolução, modos, cores, temas, spacing, vídeos, API URLs | `src/config.js` |
| `PanelPage` | Render principal do painel: escolhe layer por modo, loop rAF, ou renderiza `<video>` nos modos de vídeo. Polling de settings 2s | `src/components/PanelPage.jsx` |
| `LedCanvas` | Canvas dedicado à rota `/led` (2048×192), com offset circular e debug de módulos | `src/components/LedCanvas.jsx` |
| `LedPage` | Wrapper da rota `/led`, lê query `?modules`/`?full`/`?offset` | `src/components/LedPage.jsx` |
| `ControlPanel` | Botões de troca de modo (lista `CONFIG.MODES`) | `src/components/ControlPanel.jsx` |
| `goalsTickerLayer` | Coração do render: monta blocos (ícone+labels+valores+separador), mede ciclo, desenha | `src/layers/goalsTickerLayer.js` |
| `lastDanceLayer` | Modo Last Dance = goalsTicker + theme (delegação pura) | `src/layers/lastDanceLayer.js` |
| `liveTickerLayer` | Ticker do modo Live (pulseDot + "ESTAMOS EM LIVE!!!" + logo) | `src/layers/liveTickerLayer.js` |
| `colaboradorTickerLayer` | Ticker "SEJAM BEM VINDOS..." (modo Bem-vindo Colaborador) | `src/layers/colaboradorTickerLayer.js` |
| `welcomeClienteLayer` | Ticker com nome do cliente | `src/layers/welcomeClienteLayer.js` |
| `textTickerLayer` | Ticker de texto livre | `src/layers/textTickerLayer.js` |
| `backgroundLayer` | Pinta fundo (imagem/sólido) do canvas | `src/layers/backgroundLayer.js` |
| `barsTestLayer` | Diagnóstico de canvas (`?test=bars`) | `src/layers/barsTestLayer.js` |
| `goalsService` | Fetch wons/metas, cálculo de atingidos do mês, refresh 30s, status | `src/services/goalsService.js` |
| `clienteNaCasaService` | CRUD de clientes em localStorage, expiração 24h, ponteiro round-robin | `src/services/clienteNaCasaService.js` |
| `settingsService` | GET/PUT `/api/settings` | `src/services/settingsService.js` |
| `modeKeymap` | Mapa F13–F24 → modo | `src/services/modeKeymap.js` |
| `dataHelpers` | Parse de data BR/ISO, `toNumber`, `normalizeRows`, formatadores de moeda | `src/utils/dataHelpers.js` |
| `ClienteNaCasaPage` | Tela de cadastro/listagem de clientes na casa (rota `/clientenacasa`) | `src/pages/ClienteNaCasaPage.jsx` |
| `exporter` | Export de frames PNG (.zip), spritesheet e metadata JSON | `src/exporter.js` |

## 5. Integrações externas

- **API upstream `dados-4ew4.onrender.com`** (Render):
  - `GET /api/wons` — lista de vendas ("wons"). Front: em prod usa proxy `/api/wons` (CORS — upstream só libera localhost); em dev bate direto (`config.js`).
  - `GET /api/metas` — metas por setor. Aceita `{ metas: {...} }` ou shape plano; chaves `12P`/`Consultoria`/`LTDA` ou `meta12p`/`metaConsultoria`/`metaLtda`.
- **Proxies próprios:**
  - `api/wons.js`, `api/metas.js` — funções serverless Vercel (fetch server-side, contornam CORS).
  - `server/server.js` — Express local espelha os proxies + expõe settings.
- **Express local (`server/server.js`):**
  - `GET/PUT /api/settings` — persiste em `server/settings.json`.
  - `POST /mode` — valida modo contra `allowedModes` (só loga, `console.log`).
  - `GET /api/goals` — retorna metas mock hardcoded (`getGoalsFromDatabase` = stub, "plugar banco real aqui"). **Verificar:** o front não consome `/api/goals`; usa `/api/wons` + `/api/metas`. Endpoint parece legado.
- **Supabase:** dependência e env presentes, **sem uso no código** (ver seção 2).
- **localStorage:** `clienteNaCasaService` (chaves `cliente-na-casa:list` / `:pointer`), sincronizado entre abas via evento `storage`.
- **Vercel:** `vercel.json` reescreve `/api/*` → funções serverless e todo o resto → `index.html` (SPA).
- **Google Fonts:** Montserrat via `<link>` em `index.html`. Fonte "Last Dance" é `@font-face` local (`public/assets/fonts/LastDance.woff2`).

## 6. Como rodar testes

Não há testes no repositório. Sem framework de teste em `package.json` (nenhum jest/vitest/playwright), sem pasta `test/` ou arquivos `*.test.*`/`*.spec.*`.

Ferramentas de diagnóstico manuais existentes:
- `?test=bars` — barras coloridas p/ validar captura do canvas.
- `?debug=modules` / `?modules` — overlay dos 16 módulos.
- `?debug=seam` — marca as bordas e mostra offset/cycle.
- `DebugHud` — HUD de FPS/progress/ícones (**verificar:** componente existe mas não está importado em lugar nenhum).

## 7. Pontos de atenção

- **Supabase morto:** dependência + env vars sem nenhum uso em `src/`. Remover ou implementar.
- **Código possivelmente legado/órfão:**
  - `src/components/DebugHud.jsx` — não importado.
  - `src/components/VideoPlayer.jsx` — não importado (`PanelPage` renderiza `<video>` inline).
  - `src/exporter.js` — não importado por nenhum componente/rota. **Verificar** se ainda há UI de export.
  - `server/server.js` `GET /api/goals` + `getGoalsFromDatabase()` stub — front não usa.
- **URLs upstream hardcoded** (`dados-4ew4.onrender.com`) espalhadas em `config.js`, `api/*.js`, `server/server.js`. Só as versões server têm override por env; o front (`config.js METAS_URL`) é fixo.
- **CORS frágil:** comentário em `config.js` diz que `METAS_URL` é chamado direto do browser em prod ("Confirmar CORS upstream em prod") — WONS já usa proxy, METAS não. Risco de quebra em produção.
- **`POST /mode` é no-op:** valida e loga, mas não persiste nem propaga estado; a sincronização real de modo é via `PUT /api/settings` + polling de 2s.
- **Polling agressivo:** `PanelPage` faz GET `/api/settings` a cada 2s por instância; `goalsService` refaz fetch de wons+metas a cada 30s.
- **`settings.json` versionado** com estado mutável (`activeMode`, `sinoEnabled`) — cada mudança de modo grava o arquivo; pode gerar diffs/ruído no git. Estado atual: `activeMode: "lastDance"`.
- **Last Dance:** rotação dash/vídeo desativada — modo renderiza **só o vídeo em loop** (`PanelPage.jsx` `isLastDanceVideo = isLastDance`). Toda a lógica de theme/ticker Last Dance (`lastDanceLayer`, `MODE_THEMES.lastDance`) fica inativa nesse caminho. **Verificar** se é intencional (o commit recente `feat: last dance mode mostra so o video em loop` indica que sim).
- **Nut Day:** renderiza **só o vídeo `nut-day.mp4` em loop** (`PanelPage.jsx` `isNutDayVideo`), mesmo padrão de Pantera/Together.
- **Modos declarados sem render dedicado:** `blackFriday`, `ra` caem em `MODE_OVERLAY_LABELS` (só um texto sobreposto), não em vídeo/ticker próprios.
- **Dois motores de canvas paralelos:** `LedCanvas` (rota `/led`, 2048px, offset circular) e `PanelPage` (rota principal/`?panel`, 2112px, tiling). Lógica de loop duplicada em dois lugares — manter os dois em sincronia é frágil.
- **`ANALISE_DASHBOARD.md`** (24KB) na raiz é doc/análise antiga — pode divergir do estado atual.

# LED Circular Dash — React + Vite

Painel LED **2048x192** com ticker animado de metas. Renderização única na
resolução nativa. Sem master/final, sem downscale.

```
12P: [neto] 3,2M / 4M   >   Consultoria: [camonha] 1,1M / 1,5M   >   LTDA: [ariane] 900K / 1,5M
```

Cada bloco mostra `atingido / meta`. Atingidos vêm de `/api/wons`
(WONS_URL) e são somados por pipeline dentro do mês corrente. Metas vêm
de `/api/metas`.

- **React 18 + Vite** no front, **Express** no back, **Canvas 2D** para render.
- Ícones isolados em `ICON_SLOT` — todos os personagens com mesmo bounding box.
- Loop perfeito por duplicação de blocos.
- Toda configuração centralizada em **`src/config.js`**.

---

## Estrutura

```
led-circular-dash/
  index.html
  vite.config.js
  package.json
  README.md
  .gitignore
  public/
    assets/
      background.png
      icons/
        neto.png
        camonha.png
        ariane.png
  server/
    server.js                 <- Express + /api/goals
  src/
    config.js                 <- *** edite valores principais aqui ***
    main.jsx
    App.jsx
    styles.css
    exporter.js               <- frames PNG / spritesheet / JSON
    components/
      LedCanvas.jsx           <- canvas 2048x192 + loop
      ControlPanel.jsx        <- play/pause, velocidade, exports
      DebugHud.jsx            <- HUD de debug
    layers/
      backgroundLayer.js
      goalsTickerLayer.js
    services/
      goalsService.js         <- consome /api/wons + /api/metas
    utils/
      canvasUtils.js
      dataHelpers.js          <- parseDataBR / toNumber / formatMoneyShort / normalizeRows
```

---

## Instalar

```bash
cd led-circular-dash
npm install
```

Instala: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `express`,
`concurrently`, `jszip`, `file-saver`.

## Rodar (dev)

```bash
npm run dev:all
```

Sobe Vite (`http://localhost:5173`) e Express (`http://localhost:3001`)
em paralelo. Vite proxia `/api/*` para o backend, então o front usa
`/api/goals` direto.

Comandos individuais:

| Script           | Ação                                    |
|------------------|-----------------------------------------|
| `npm run dev`    | Apenas Vite (front)                     |
| `npm run server` | Apenas Express (back)                   |
| `npm run dev:all`| Front + back juntos via concurrently    |
| `npm run build`  | Build de produção do front              |
| `npm run preview`| Serve o build de produção localmente    |

---

## Onde colocar os ícones e o background

```
public/assets/icons/neto.png
public/assets/icons/camonha.png
public/assets/icons/ariane.png
public/assets/background.png        (opcional, só se BACKGROUND.TYPE = "image")
```

Vite serve `public/` na raiz, então `CONFIG.ICONS.NETO.PATH = "/assets/icons/neto.png"`
funciona durante dev e build.

---

## Onde alterar a resolução

`src/config.js`:

```js
WIDTH: 2048,
HEIGHT: 192,
```

Tudo (canvas, exportação, métricas) deriva desses dois valores.

## Onde alterar os textos

`src/layers/goalsTickerLayer.js` → array `METAS`:

```js
const METAS = [
  { iconKey: "NETO",    label: "12P",         field: "meta12p" },
  { iconKey: "CAMONHA", label: "Consultoria", field: "metaConsultoria" },
  { iconKey: "ARIANE",  label: "LTDA",        field: "metaLtda" },
];
```

`buildBlocks` monta a sequência por meta:

```
text "Label: "  →  icon  →  text "{atingido} / {meta}"
```

## API e fonte de dados

`src/config.js` → bloco `API`:

```js
API: {
  WONS_URL:  "https://dados-4ew4.onrender.com/api/wons",
  METAS_URL: "/api/metas",
  TIMEOUT_MS: 12000,
  REFRESH_MS: 30000,
}
```

- `WONS_URL` — endpoint de fechamentos. Para dev local use
  `http://localhost:3001/api/wons` (precisa expor essa rota no servidor).
- `METAS_URL` — endpoint das metas (proxiado pelo Vite em dev).

### Cálculo do atingido

`src/services/goalsService.js`:

1. Busca `/api/wons` e normaliza com `normalizeRows` (aceita array ou
   `{ rows }`/`{ data }`/`{ items }`).
2. Filtra apenas itens cujo `data` cai no mês corrente
   (`parseDataBR` aceita ISO, BR `DD/MM/YYYY [HH:MM[:SS]]` e `Date`).
3. Soma `valor` (via `toNumber`, aceita `"R$ 1.234,56"`,
   `"1234.56"`, número, etc.).
4. Predicates por empresa:
   - **12P** — todos os itens do mês.
   - **Consultoria** — `pipeline ∈ CONFIG.CONSULTORIA_PIPELINES`.
   - **LTDA** — `pipeline === CONFIG.LTDA_PIPELINE`
     (default: `"DISNEYLEADS 🟡⚫️"`).
5. Estornos: valores negativos entram normalmente na soma e reduzem o
   atingido.

### Pipelines da Consultoria

`src/config.js` → `CONSULTORIA_PIPELINES`. Edite a lista (Set de 7 nomes
exatos, do mesmo Geral.jsx que alimenta o painel principal).

### Metas — banco real

`server/server.js` → `getMetasFromDatabase()`:

```js
async function getMetasFromDatabase() {
  // Exemplo Postgres com pg:
  // const { rows } = await pool.query(`SELECT meta12p, "metaConsultoria", "metaLtda" FROM metas_view LIMIT 1`);
  // return rows[0];
  return { meta12p: 3000000, metaConsultoria: 1500000, metaLtda: 1500000 };
}
```

Formato: `{ meta12p, metaConsultoria, metaLtda }` em **número** (reais).

### Fallback

Se `/api/metas` falha e não há valor anterior em memória, o serviço usa
`CONFIG.METAS_FALLBACK`. Se `/api/wons` falha, mantém o último atingido
calculado.

---

## Exportação para o painel

ControlPanel → três botões:

| Botão                       | Saída                                                                |
|-----------------------------|----------------------------------------------------------------------|
| Exportar Frames PNG (.zip)  | `frame_0000.png` … `frame_<N-1>.png` — cada um exatamente `2048x192` |
| Exportar Spritesheet PNG    | grid `cols × rows` (`EXPORT.SPRITESHEET_COLUMNS`, default 10)        |
| Exportar JSON Metadata      | `width`, `height`, `frameCount`, `fps`, `durationSec`, `cyclePx`, `goalsSnapshot` |

O frame em `progress = 1` é idêntico a `progress = 0`. Por isso o exporter
gera apenas `i = 0..frameCount-1` (frame final NÃO incluso). O player do
painel pode reproduzir os frames em loop sem stutter.

### Padronizar personagens (ICON_SLOT)

Cada PNG pode ter espaços transparentes diferentes. Para garantir mesmo
tamanho visual:

```js
ICON_SLOT: { WIDTH: 120, HEIGHT: 120, MARGIN_X: 18, Y: 36 }
ICONS: {
  NETO:    { PATH: "...", SCALE: 1.0, OFFSET_X: 0, OFFSET_Y: 0 },
  CAMONHA: { PATH: "...", SCALE: 1.1, OFFSET_X: -4, OFFSET_Y: 2 },
  ARIANE:  { PATH: "...", SCALE: 0.95, OFFSET_X: 0, OFFSET_Y: 0 },
}
```

Largura do bloco do ícone é sempre `SLOT.WIDTH + SLOT.MARGIN_X` —
independente do `SCALE` por ícone. Loop perfeito mantido.

---

## Loop perfeito

```
cycle = soma(blocos) + GAP
offsetX = -(progress % 1) * cycle
draw(blocks, offsetX)
draw(blocks, offsetX + cycle)
```

Em `progress = 1` a segunda cópia ocupa exatamente o lugar da primeira →
frame matematicamente idêntico ao inicial.

---

## Onde mexer

| O que mudar                       | Arquivo                                     |
|-----------------------------------|---------------------------------------------|
| Resolução, paleta, slot, fonte    | **`src/config.js`**                         |
| Texto/render do ticker            | `src/layers/goalsTickerLayer.js`            |
| Background                        | `src/layers/backgroundLayer.js`             |
| Consumo da API                    | `src/services/goalsService.js`              |
| Backend / banco                   | `server/server.js`                          |
| Loop principal e canvas           | `src/components/LedCanvas.jsx`              |
| Controles UI                      | `src/components/ControlPanel.jsx`           |
| Debug HUD                         | `src/components/DebugHud.jsx`               |
| Formato de exportação             | `src/exporter.js`                           |
| Estilos da UI                     | `src/styles.css`                            |

---

## Licença

MIT.

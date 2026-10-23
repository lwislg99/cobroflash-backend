# SCRUM-1583 · el enlace «factura F-…» de la lista de Cobros, a 44 px de toque

**Medido contra:** `origin/main` = `0b8af73d34d95a762b18fad1cd6232ce7f621b1f` · 2026-10-23T11:03:57Z (hora de GitHub al escribir: 2026-10-23T11:06:28Z)
A9: comprobación → `tests/scrum1583-enlace-documento-cobros-44.test.mjs`

Puesto J2 (`jv-j2ad`) · rama `scrum-1583a-enlace-factura-44`. Encargo del orquestador del equipo de Javier
(`cobroflash-backend-62`). Sale de SCRUM-1159 (hallazgo 1 de c.20459, abierto por `jv-j2z`). El hook de arranque dijo
«SIN IDENTIDAD» (SCRUM-1498); el puesto lo da el encargo, y se dice aquí.

## PASO 0

Sin commits en `origin/main` con «SCRUM-1583» (el único que casa es el PR #1583, de SCRUM-995), sin rama
`scrum-1583*` en el remoto y sin `docs/master/SCRUM-1583.md`. Jira: descripción leída entera, **0 comentarios**;
etiquetas `ab6`, `area-j2`, `equipo-javier`. Por contenido: en `styles.css` no había ninguna regla sobre `td.cell-id > a`.

## Carril

`node scripts/carriles.mjs de public/dashboard/js/cobrosView.js` → **J2** (`dos-equipos.md:144`) ·
`… de public/dashboard/css/styles.css` → **S2 (contenedor)** (`dos-equipos.md:150`): «el otro equipo añade SU bloque
marcado». El cambio es un bloque nuevo marcado `── J2 · SCRUM-1583 ──`, 10 líneas añadidas y **0 quitadas** (`git diff`).
`cobrosView.js` **no se toca**. La rama de Luis #2692 (`scrum-962f-editor-cuatro-44`) toca `styles.css` en los trozos
1922–2180; el bloque va en ~4776: `git merge-tree` de esta rama contra la suya sale **sin conflicto** (salida 0).

## El arreglo

```css
td.cell-id > a[href="#invoice-detail"] { position: relative; }
td.cell-id > a[href="#invoice-detail"]::before { content: ""; position: absolute; inset: -14px 0; }
```

- **Ancla sin clase nueva:** el `href="#invoice-detail"` sólo lo pinta Cobros (`git grep` en `public/dashboard/js`: 1 sitio,
  `cobrosView.js:619`). Ni marcado nuevo ni estilo en línea nuevo (regla 4).
- **Por qué `::before` y no `min-height`:** a 1280 la fila mide 45,4 px y el enlace 18; un `min-height: 44px` en el enlace
  la sube (44 + el relleno de la celda). El `::before` es el mecanismo de `.casilla-tactil-44` (SCRUM-786): crece el área
  que recibe el toque y no mueve nada. Sólo en vertical (`inset: -14px 0`): de ancho ya mide 107-120.
- Sin texto nuevo, sin cambio de aspecto medido por alto de fila y ancho del enlace (abajo). **No comparé capturas.**

## Medición en Edge (`docs/master/evidencias/SCRUM-1583/medir.mjs`)

Página entera pintada por el producto (`scripts/_banco-lista.mjs`), datos del contrato del censo. **Población declarada:**
las filas de `/admin/cobros` del contrato con `invoiceId` → **1 por anchura, 3 mediciones.**

| anchura | antes: caja · toque | después: caja · toque | alto de fila antes → después | semilla |
|---|---|---|---|---|
| 320 | 16 · **17** | 16 · **45** | 109,5 → 109,5 | 17 (corta) |
| 390 | 16 · **17** | 16 · **45** | 109,5 → 109,5 | 17 (corta) |
| 1280 | 18 · **19** | 18 · **46,9** | 45,4 → 45,4 | 19 (corta) |

Controles, corridos con el código de salida del propio proceso (sin tubería):

- **Semilla sembrada** (un `<a href="#semilla">` en la misma celda, que la regla no alcanza): sale corta en las tres.
- **`--sin-semilla`:** CIEGO en las tres, salida **2**.
- **`--mutar`** (anula el `::before` con una hoja inyectada): vuelven 17 / 17 / 19, salida **1**.
- **`--con-aviso`** (la fila trae `correoNoSalio`, y en la MISMA celda, debajo del enlace, sale «Enviar de nuevo»): un
  `::before` posicionado se pinta encima del contenido en flujo y podía robarle toque al botón. Medido antes y después:
  **30,7 / 30,7 / 30,9 px en los dos**; no baja. (Que ese botón esté a 30,7 es otro corto, de `.btn-sm`: abajo.)

## Censo y guards de navegador

- `npm run censo:tactil-panel`, antes → después (diff entero de la salida): sólo cambia Cobros — 1 → 0 cortos a 929 y a
  390; elementos distintos bajo 44: **72 → 71**; mediciones 93 → 91; sondas no cazadas 0 en los dos.
- `guard:objetivo-tactil`: 0 hallazgos · 0 ciegos. `guard:lista-trabajos`: verde (Clientes idéntico por hash).
  **Cobros no está en ninguno de los dos guards:** sólo lo cuenta el censo, que no bloquea.

## El test (corre en cada PR)

`tests/scrum1583-enlace-documento-cobros-44.test.mjs`, 2 casos: que la regla exista con `position: relative` y su
`::before` con `inset: -Npx 0` tal que 16 + 2N ≥ 44 (16 = la caja medida a 320/390, escrita como literal medido), y que
Cobros siga pintando el enlace con ese `href` como hijo directo de `td.cell-id`. **Cinco mutaciones, las cinco lo tumban**
(1 de 2 cae en cada una): sin `::before` · `inset: -13px` · sin `position` · `href` cambiado · enlace envuelto en `<span>`.

## Lo que encontré y no arreglo

- El botón «Enviar de nuevo» del aviso de correo fallido en la misma celda mide **30,7 px** de toque (`.btn-sm`). Es J2
  por fichero, pero el ticket es sólo el enlace y no lo he tocado: se lo digo al orquestador.

## Sin medir

- yaqu.app tras el despliegue (no está mergeado). Capturas antes/después. Más de una fila con factura (el contrato trae
  una): con dos seguidas a 1280 el `::before` de cada una invade ~0,3 px la de al lado — calculado, no medido.

## Fallo propio

La primera `--mutar` anulaba `display`/`min-height`, que no es la pieza que trabaja: salió **MUDA** (todo en verde con la
mutación puesta). Lo vi al leer su salida y la cambié para que anule el `::before`. El test cubre esa mitad
(`sin ::before` lo tumba), y por eso la `A9:` apunta al test.

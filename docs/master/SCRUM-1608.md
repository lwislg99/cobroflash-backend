# SCRUM-1608 · el tipo de IVA se redondeaba a ENTERO en cuatro sitios del panel

**Medido contra:** `origin/main` = `540c62bc257c0c9ad0a42c4649e3dea0da7e442f` · 2026-10-27T15:48:38Z

## SCRUM-1608 · un 7,5 % se pinta «7,5 %», y con descuento global la pantalla da lo que se guarda (27-oct-2026)

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar ningún fichero de `public/` en este ticket. Sin tokens, estilos ni textos nuevos: cambia cómo se escribe un número dentro de unos rótulos que ya existían («IVA: …%», la columna «IVA»).

A9: aviso → cicatriz S2 «un SHA inventado tiene la misma forma que uno copiado» — no se pudo comprobar: ningún guard sabe si un SHA escrito en un registro existe

El fallo de esa A9: escribí este registro con un SHA de 40 caracteres completado de memoria a partir de los 9 de un `git log`, y lo cambié por el de `git rev-parse` antes de comitar. Lo demás salió medido: el defecto se reprodujo por ejecución antes de tocar nada, y la única pasada mía que no midió (línea de órdenes demasiado larga, 289 ficheros con ruta absoluta) salió con error y se repitió; no se leyó como verde.

Medido el 27-oct-2026 sobre `origin/main` ce1111a68d00d2063bc6bb369ce71d2124c3547f (rama `scrum-1608-tipo-de-iva-con-decimal`, worktree `s2-27oct-1608`); de ahí al ancla de arriba, main sólo trae `docs/` (#2933), y la rama lo lleva mergeado. Puesto S2. Los cuatro ficheros son S2 (`node scripts/carriles.mjs de …`: `dos-equipos.md:152`).

### El defecto, por ejecución

| sitio | antes | qué hacía |
|---|---|---|
| `aiQuoteAssistant.js:147` | `(line.tax * 100).toFixed(0)` | pinta «IVA: 8%» |
| `productsView.js:821` | `(Number(it.vat) * 100).toFixed(0)` | pinta «8 %» |
| `quotesDetailView.js:759` | `(tax * 100).toFixed(0)` | pinta «8 %» |
| `quoteDescuentos.js:169` | `Math.round(tax * 100)` | agrupa el 7,5 % como 8 y **quita el global con `1 + 8/100`** |

El cuarto **movía importes en pantalla**. Pantalla (`totalesConDescuento`) contra lo que se guarda (`calcTotal` de `dist/`):

| caso | pantalla antes | se guarda |
|---|---|---|
| CONTROL 21 % sin global | 1210,00 | 1210,00 |
| CONTROL 21 % global 100 | 1089,00 | 1089,00 |
| 7,5 % sin global | 1075,00 | 1075,00 |
| 7,5 % global 100 € | **967,00** | 967,50 |
| 3 × 99,99 al 7,5 % dto 10 % global 37,33 | **249,90** | 250,09 |
| 2 × 450 al 5,5 % global 200 | **737,50** | 738,50 |

Sólo con DESCUENTO GLOBAL y tipo NO entero. Lo guardado y el PDF ya estaban bien: el editor no manda total, lo calcula el servidor (`quotesView.js`, payload: «`calcTotal` lo aplica en el servidor… la pantalla sólo lo previsualiza»). Lo que mentía era el total (y la cuota, que sale de total − base) del editor (`quotesView.js:2911`) y de la ficha (`quotesDetailView.js:799`).

Me paré antes de tocar `quoteDescuentos.js`, como pedía el encargo. **GO del orquestador** (cobroflash-backend-52, SendMessage del 27-oct-2026): no es STOP de AA1.4 porque no cambia lo que se cobra ni lo que se guarda, con una condición, el caso ③ de abajo. La aceptación, que el ticket no tenía escrita, la aprobó en ese mismo mensaje.

### Qué cambia

- `public/dashboard/js/api.js`: `fmtTipoIvaEs(taxFrac)` = `fmtNumeroEs(Math.round(x * 10000) / 100)`, gemela de `rotuloDeTipo(tipoEnPorcentaje(x))`, que es la convención del PDF desde SCRUM-1447. 0.075 → «7,5», 0.21 → «21».
- Los tres sitios que pintan la llaman. La etiqueta de alrededor no cambia.
- `quoteDescuentos.js:169`: `rate = Math.round(tax * 10000) / 100`, la misma fórmula que `tipoEnPorcentaje`, que es la clave de `descuentoGlobalEnCentimos` en el backend.

### Medido

`tests/scrum1608-tipo-de-iva-con-decimal.test.mjs`, **5 de 5**:

| aceptación | dónde se ve |
|---|---|
| ① con un 7,5 % las tres pantallas pintan «7,5 %», y un 21 % sigue «21 %», por efecto en el banco | casos ① · asistente / Productos / ficha (el asistente pulsa «Generar» con la red doblada; Productos y la ficha montan la vista y leen la celda) |
| ② con 7,5 % y descuento global, el total de pantalla = `calcTotal` | caso ②, los seis casos de la tabla |
| ③ lo guardado es idéntico antes y después, en los seis casos | caso ③: `calcTotal` da las cifras de la columna «se guarda», medidas IGUAL sobre main y sobre la rama (este ticket no toca `src/`) |

- **Rojo primero** (`docs/master/evidencias/scrum1608/mutar-1608.mjs . origin/main`): con los 5 ficheros de main caen ① ×3 y ②, y ③ aguanta, que es lo que tiene que hacer.
- **Mutaciones:** las 5 del catálogo tumban su caso. Restauración comprobada por bytes.
- Los 289 ficheros de `tests/` que nombran un fichero tocado o el banco de vistas: 2431 pruebas · 2425 pasan · 5 saltadas (con su motivo) · 1 cae: scrum811c, porque faltaba este registro.
- yaqu.app: pendiente de que entre (ver la entrega en Jira).

### Lo que NO hace

- `presentacionIva.ts:181` y `quoteDecisionLanding.routes.ts:497` (S1) imprimen «7.5%», con punto. El ticket lo deja a título informativo: es otra decisión, y de S1.

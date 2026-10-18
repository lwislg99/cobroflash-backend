# SCRUM-1562 · filas del panel que sólo se abren con ratón

## 18-oct-2026 · S3 · la medida (sólo medir; no se ha tocado ninguna vista)

**Medido contra:** `origin/main` = `08a54862e5da60d723c7c5f6121c670d1e17c240` · 2026-10-18T00:13:55Z

Ancla de `node scripts/equipo/ancla.mjs` · rama `scrum-1562-sonda-filas-sin-teclado`.

A9: comprobación → `docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs`

(Es una sonda, no un test: mide, no vigila.)

**Origen.** Al cerrar SCRUM-1560e, Partes de oficina quedó en «NO MEDIDAS» con 12 nodos de verdad:
una fila `div` clicable. El orquestador preguntó si esas filas se pueden usar sin ratón.
(Son 12 NODOS, no 12 filas: con los datos del censo es una sola fila.)

**Cómo.** `node docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs`. Usa el banco de vistas,
sin navegador. Monta las 29 vistas con los datos del censo táctil y saca cada nodo que recibe clic
sin ser un control nativo. De cada uno da `tabindex`, `role`, teclado y los nativos que lleva dentro.
El dueño sale de `node scripts/carriles.mjs de <fichero>` sobre el fichero que DEFINE el handler.
**Control:** la actividad de Inicio sale con `tabindex=0`, `role=button` y `keydown`: la sonda
distingue el caso bueno. Repetida desde el repo: el mismo resultado que en el temporal, 0 diferencias.

**Resultado: 13 elementos en 8 vistas.**

| grupo | vista | elemento | abre | teclado | alternativa nativa | fichero · dueño |
|---|---|---|---|---|---|---|
| bien | Inicio | `DIV.activity-item` | el presupuesto | tabindex 0 · role button · keydown | — | homeView.js · S2 |
| no es acción (delegación) | editor de presupuesto · documento suelto | `DIV.card.quotes-left-card` ×2 | (refresca los pasos) | — | — | quotesView.js · S2 |
| no es acción (delegación) | Ajustes | `DIV` del bloque de condiciones | (el clic va a botones de dentro) | — | — | settingsView.js · J3 |
| fila | Clientes | `TR` ×3 | la ficha 360 | ninguno | **sí**: «📊 Historial» (`openCustomer360`, la misma) | customersView.js · J2 |
| fila | Presupuestos (lista) | `TR` ×1 | el detalle | ninguno | **sí**: «Ver detalle» (`openDetail`, la misma) | quotesListView.js · S2 |
| 🔴 fila | Facturas | `TR` ×2 | el detalle de la factura | ninguno | **no** (dentro sólo la casilla) | invoicesView.js · J1 |
| 🔴 fila | Trabajos | `TR.jobs-fila` ×2 | la ficha del Trabajo | ninguno | **no** («+ Nuevo albarán», «Agendar», «⋯» hacen otra cosa) | jobsView.js · S4 |
| 🔴 fila | Partes de oficina | `DIV.customers-card` ×1 | el parte, para valorarlo | ninguno | **no** (ningún nativo dentro) | parteOficinaView.js · S2 |

Con teclado, desde esas tres listas no se abre ni una factura, ni un Trabajo, ni un parte.

**Lo que esto NO sabe.**
- Sólo el estado montado: sin modales ni pestañas abiertas.
- Los oyentes puestos en `document`: el banco no los guarda.
- Cuántas filas hay en producción: los datos del censo traen 1–3 por lista y el defecto es POR FILA.
- El ancho: es el mismo DOM a cualquier ancho, y el CSS no da teclado.
- Si otra pantalla, como el buscador global, abre esos detalles con teclado: si lo hace, el impacto
  baja, pero el defecto de la lista sigue.

## 18-oct-2026 · S2 · 1562c — Partes por valorar se abre con teclado

**Medido contra:** `origin/main` = `ad9ec5634d49a41b1b8fef01d81235e1fbe5feaf` · 2026-10-18T00:26:37Z
A9: comprobación → `tests/scrum1562c-partes-oficina-con-teclado.test.mjs`
**Skill UI:** cargada · `yaqu-premium-ui`: el mismo aspecto (la fila mide 69 px antes y después), el anillo `--ring` del sistema, cero tokens, cero texto, cero componentes.

S2 · rama `scrum-1562c-partes-oficina-con-teclado`, apilada sobre `scrum-1562-sonda-filas-sin-teclado` (#2557, de
S3, abierto: la sonda y este registro todavía no están en `main`). Encargo del orquestador (18-oct): la peor de las
filas de S2, `DIV.customers-card` de `parteOficinaView.js`, sin teclado y sin ningún nativo dentro.

**Arreglo: la opción (b), en su forma más corta.** La fila pasa a ser un `<button type="button">`: el control
nativo ES la tarjeta. El foco, Enter y Espacio los da el navegador, y el ratón sigue pulsando la tarjeta entera
(no hay un botón pequeño dentro que obligue a apuntar). Por qué no la (a) `tabindex` + `role` + Enter: habría que
escribir a mano lo que el botón ya trae, y la sonda la seguiría contando. Sin texto nuevo: la fila dice lo mismo.
Dentro de un botón sólo cabe contenido en línea, así que los `div` de dentro pasan a `span` en bloque.
`styles.css`: `.parte-oficina-fila` (ancho, alineación, letra y color que el botón no hereda) y su propio
`:focus-visible` con `--ring`.

**Lo que salió al medirlo, y no estaba en el encargo:** el anillo de foco NO se veía. El `:focus-visible` global
pesa lo mismo que `.customers-card`, que va después en la hoja y pone su sombra encima. Y mi primera sonda dijo
«anillo: sí»: miraba que hubiera ALGUNA sombra, y la de la tarjeta contaba. Corregida para comparar contra
`--ring` (y esperar a la transición de 0,18 s de la tarjeta, que daba un falso «no»).

### Verificado, ejecutando
- **Sonda de S3** (`sonda-div-clicables.mjs`): 13 → **12** elementos no nativos con clic; Partes de oficina sale de
  la lista. Con Trabajos (S4, 2) queda en 10.
- **Test**, rojo primero: sobre la base cae el caso (la fila es `DIV`) y pasa el control del ratón; con el arreglo,
  3 de 3. Mutaciones, cada una tumba 1: la fila otra vez `div`, sin `type="button"`, sin la regla del anillo, y sin
  el oyente de clic (el ratón).
- **yaqu.app, cuenta QA** (sonda de sólo lectura `sondas-s2/teclado-1562c.mjs`, fuera del repo; sirve
  `parteOficinaView.js` y `styles.css` de la rama; 0 escrituras, 0 errores; capturas en `sondas-s2/cap1562c/`), con
  el parte PT-2026-002 de la cuenta, a 390 y a 1280:

| | teclado: ¿llega el foco? | ¿se ve el anillo? | Enter abre el parte | ratón abre el parte | alto de la fila |
|---|---|---|---|---|---|
| antes (prod) | **no** (80 Tab sin llegar) | — | **no** | sí | 69 |
| después | sí | sí (`--ring`, medido) | **sí** | sí | 69 |

- **No tocado:** la fila de la lista de Presupuestos (`TR`, `quotesListView.js`). Ya tiene alternativa nativa
  («Ver detalle», la misma `openDetail`), y el orquestador la puso detrás.

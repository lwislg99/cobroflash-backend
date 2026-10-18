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
## 18-oct-2026 · S4 · Trabajos: «Ver detalle» en cada fila (la mitad de `jobsView.js`)

**Skill UI:** cargada (`yaqu-premium-ui`), pero DESPUÉS de escribir el cambio y antes del commit: lo
recordó el guard de SCRUM-1340. El cambio se repasó contra su checklist AB6 (abajo). Sin CSS nuevo.

**Medido contra:** `origin/main` = `226e870856827873f9e8822af361221ea4ecf20b` · 2026-10-18T00:36:43Z

Ancla de `node scripts/equipo/ancla.mjs` · rama `scrum-1562d-trabajos-con-teclado`. Al empezar, la
sonda y este registro vivían sólo en la rama de S3 (PR #2557), y no en `main` como decía el encargo:
la fusioné en esta rama. #2557 entró en `main` mientras yo trabajaba (226e8708).
**El sufijo:** empecé con `1562c`; el control de antes del push lo encontró cogido por S2 (#2560,
Partes de oficina), así que rama y test pasan a `1562d`.

A9: comprobación → `tests/scrum1562d-trabajos-con-teclado.test.mjs`

**Qué se ha elegido y por qué: la (b).** Un `<button>` «Ver detalle» dentro de cada `TR.jobs-fila`,
en `.jobs-acciones`, entre la acción de la escalera y el «⋯». Es lo que ya hacen Presupuestos
(`quotesListView.js:342`, «Ver detalle») y Clientes («📊 Historial»). La (a) no se ha cogido porque
`role=button` sobre un `<tr>` le quita a la fila su papel de fila de tabla para un lector de pantalla.
- **Sin texto nuevo:** «Ver detalle» es el rótulo literal de la lista hermana de Presupuestos.
- **Clase `btn-ghost btn-sm`:** la jerarquía de SCRUM-917c no cambia (la primaria sigue siendo la del
  dinero; la acción de la escalera es secundaria y pesa más que mirar).
- **`stopPropagation`, como Presupuestos:** no navega dos veces aunque la guarda de la fila dejara de
  reconocer este botón (ver «El banco» más abajo).
- **El clic en la fila se queda:** con ratón, todo sigue igual.

**Mi premisa corregida.** El encargo decía que los botones de la fila «hacen otras cosas». Medido en
el banco, pulsando cada control sin que el clic suba a la fila:

| fila (censo) | control | ¿abre la ficha? |
|---|---|---|
| 0 · `jobId` 1 | «+ Nuevo albarán» | **sí**: navega a `jobs-detail` `{ jobId: 1 }` (rama `else` de `jobRow`) |
| 1 · `jobId` 2 | «Agendar» | no: abre la modal de agendar |
| las dos | «⋯» | no |

Así que hoy la ficha SÍ se abre con teclado en las filas cuya escalera es un documento («+ Nuevo
albarán», emitir, firmar, recordar), pero con un rótulo que promete otra cosa. Y NO se abre en las de
«Agendar», «▶ Empezar», «💰 Cobrar el resto», ni en la de un técnico sin escalera. El defecto existe;
es más estrecho de lo que decía el encargo.

**El test: rojo primero.** `tests/scrum1562d-trabajos-con-teclado.test.mjs`, 6 casos.
- Contra el `jobsView.js` de `main` (guardado con `git stash`): **2 pass, 4 fail**. El que importa
  falla por el motivo bueno: `fila 1 (… Cambio …): ningún botón ni enlace lleva a la ficha`.
- Con el cambio: **6/6**.
- **Control del ratón:** el SUELO pulsa la celda del cliente de cada fila y exige UNA navegación a
  `jobs-detail` con su `jobId`. Pasa antes y después.
- **Mutación:** quitando el `e.stopPropagation()`, cae «Ver detalle navega UNA vez» (1 fail): el
  test caza el doble viaje.

**El banco** (`tests/_banco-vistas.mjs`, **no es mío y no se ha tocado**). Su `closest` parte el
selector por espacios, así que una lista con comas (`'button, a, input, …'`, la guarda de la fila de
`jobRow`) no casa nunca: `casaSimple` devuelve `null` y `closest` lo lee como «no». En el banco, la
guarda de la fila NO actúa: pulsar «Agendar» con `click()` «abre la ficha» por la subida, y «+ Nuevo
albarán» la abre DOS veces. En el navegador no pasa. Es «no pude mirar» con forma de «no hay nada»: un
test que pulse un botón de una fila y cuente navegaciones mide el banco, no el producto. Por eso mi
test pulsa SIN SUBIR (sólo los oyentes del control) donde pregunta qué hace un control. Queda para
quien lleve el banco.

**La sonda de S3, antes y después.** Antes: 13 elementos. Después: **13**, no 11. Era lo esperable:
la sonda saca TODO elemento no nativo con clic, también los que tienen alternativa (Clientes y
Presupuestos siguen saliendo). Lo que cambia son las dos filas de Trabajos, en `nativosDentro`:
- antes: `… / BUTTON«+ Nuevo albarán» / BUTTON«⋯»` y `… / BUTTON«Agendar» / BUTTON«⋯»`
- después: `… / BUTTON«+ Nuevo albarán» / BUTTON«Ver detalle» / BUTTON«⋯»` y
  `… / BUTTON«Agendar» / BUTTON«Ver detalle» / BUTTON«⋯»`

Diferencias entre las dos salidas: esas 2 líneas y ninguna más. Con el criterio de la tabla de S3, la
fila de Trabajos pasa de «🔴 alternativa nativa: no» a «sí: «Ver detalle»».

**AB6, lo que sé y lo que no.**
- Foco visible: el `:focus-visible` global (`styles.css:143`, `var(--ring)`) vale para un `<button>`.
- 44 px: a ≤640 px la tabla es de tarjetas y `.table--cards-mobile td.cell-actions button` pone 44.
  **Entre 641 px y escritorio, `btn-sm` mide lo mismo que «Agendar» de la misma fila (~30 px).** No
  lo cambio: `styles.css` es de S2, y es igual que el botón que ya está al lado. Lo mismo le pasaba a
  «Ver detalle» de Presupuestos hasta SCRUM-1148.
- Capturas antes/después y el recorrido con tabulador en yaqu.app: **no hechos todavía**; dependen
  del merge.

**Tanda entera** (`node --test` sobre `tests/*.test.mjs`, sin `prisma generate`): 11798 tests, 12
rojos. Nueve son del cliente de Prisma desfasado (`Merchant.activityKind`, 515 columnas frente a 514:
222, 235 ×3, 252, 461 ×2, 733 ×2) y uno de entorno (1321: el temporal está en otra unidad). Los dos de SCRUM-1340 / 976 eran
esta entrada sin `**Skill UI:**`, y por eso se ha escrito.

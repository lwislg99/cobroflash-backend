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
`styles.css`: `#po-lista > button.customers-card` (ancho, alineación, letra y color que el botón no hereda) y su
propio `:focus-visible` con `--ring`. *(Al empujar iba por una clase propia, `.parte-oficina-fila`: tumbó el check;
ver el tramo siguiente.)*

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

## 18-oct-2026 · S2 · 1562c — el PR #2560 en rojo: era la CLASE, no el comportamiento en vuelo

**Medido contra:** `origin/main` = `57b0bc82215bf0a6ae9295ba758dff65f6940016` · 2026-10-18T16:54:23Z
A9: comprobación → `tests/scrum1562c-partes-oficina-con-teclado.test.mjs`

**Error mío.** El check obligatorio de #2560 cayó en los cuatro casos `SCRUM-1285 · oficina` de
`tests/scrum1285-guardado-en-vuelo.test.mjs`. La lectura del orquestador era que el `<button>` había cambiado el
comportamiento en vuelo; medido, no: el banco de 1285 localiza la fila con `n.className === 'customers-card'`
(igualdad EXACTA), y yo le había añadido `parte-oficina-fila`. Sin fila, los cuatro casos se quedaban en su
«CIEGO: no sale el parte en la lista» antes de llegar al guardado. No corrí 1285 antes de empujar: sólo el mío.

**Arreglo en mi código, no en el guard** (regla 41): la fila vuelve a llevar exactamente `customers-card`, y su CSS
de botón cuelga de `#po-lista > button.customers-card` (el patrón `#qq-lines-container > div` ya estaba en la hoja).
Teclado y 1285 a la vez: no son incompatibles.

- **Test propio**: ahora exige además `className === 'customers-card'`, con el motivo en el mensaje. Así el mismo
  error cae en MI fichero, que es el que corro, y no sólo en el de 1285.
- **Ejecutando**: `scrum1285-guardado-en-vuelo` + `scrum1562c` → 12 de 12. **Mutación** (fila con
  `'customers-card x'`): caen exactamente los cuatro de 1285 que cayeron en CI, más el mío → 7 de 12.
- **Rojos informativos de «guards de navegador»** en #2560 (`cls-barra-anuncio`, `objetivo-tactil`,
  `escalera-por-estado`, `marcadores-en-pantalla` CIEGO): los mismos cuatro, con las mismas cifras, en #2561
  (run 39083518926), que ya está en `main`. No son de este cambio.
- **yaqu.app otra vez** (build `57b0bc822`, misma sonda de sólo lectura, rama servida con el selector nuevo): a 390
  y 1280, el foco llega a la fila, el anillo es `--ring`, Enter y ratón abren PT-2026-002, alto 69. 0 escrituras.
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

## 18-oct-2026 · S4 · 1562d VISTO en yaqu.app (Trabajos con teclado)

**Medido contra:** `origin/main` = `57b0bc82215bf0a6ae9295ba758dff65f6940016` · 2026-10-18T17:01:52Z

Ancla de `node scripts/equipo/ancla.mjs`. `https://yaqu.app/version` = `57b0bc82…` (el merge de #2561):
producción sirve `main`. Sólo registro y evidencias; no se toca código.

A9: aviso → cicatriz S4 «leí el anillo de foco con getComputedStyle justo después del Tab y salió «sin anillo»: medía el arranque de la transición de box-shadow, no el estado final» — no se pudo comprobar: las sondas de navegador viven fuera del repositorio y ningún test las corre

**Cómo.** `playwright-core` contra `yaqu.app/dashboard/#jobs`, cuenta QA, `serviceWorkers:'block'`, sólo
GET: lo demás se aborta y se cuenta (en cada pasada, un único `POST /admin/entorno`, abortado). 390×844
(móvil, táctil) y 1280×800. Tabulador REAL desde la página recién cargada (foco en `BODY`), Enter real,
clic real. Un espía envuelve `renderAppView` sin cambiar lo que hace, para contar navegaciones. Datos de
QA: 2 Trabajos, los dos en «Sin agendar»; la 1ª fila es «Cliente de pruebas QA» (`jobId` 77), con
«Agendar · Ver detalle · ⋯». Script y salidas en `docs/master/evidencias/SCRUM-1562/1562d-visto/`.

**El «antes», con el mismo instrumento:** la misma pasada, pero el GET de `jobsView.js` se contesta con
el de `57b0bc82^1` (`r4-antes.txt`). Control: en esa pasada, 0 filas con «Ver detalle»; en la de
producción, 2 de 2.

| | antes de #2561 | producción (390 y 1280, igual) |
|---|---|---|
| ① paradas de Tab en la 1ª fila | 27 «Agendar» · 28 «⋯» · la 29 ya es la 2ª fila | 27 «Agendar» · **28 «Ver detalle»** |
| ¿alguna lleva a la ficha? | **ninguna** («⋯» trae Técnicos/Agendar; no la ficha) | **sí, la 28** |
| ¿el `<tr>` recibe foco? | no | no (a propósito: sin `role` en la fila) |
| ② anillo con el foco puesto por Tab | — | `:focus-visible` sí · `box-shadow: rgba(34,197,94,.3) 0 0 0 3px` (`--ring`) · **se ve** en la captura |
| ③ Enter sobre «Ver detalle» | — | `#jobs-detail/77`, **1** navegación, título «Trabajo» |
| ④ ratón: clic en el nombre del cliente | 1 navegación a `jobs-detail` 77 | **1** navegación a `jobs-detail` 77 (igual) |
| ④ ratón: clic en «Ver detalle» | — | **1** navegación (el `stopPropagation` aguanta: no navega dos veces) |

Las 26 paradas de antes de la tabla son el menú lateral (19), «Menú» o el buscador, «Nuevo trabajo»,
«Partes por valorar» y los 4 filtros de cobro: iguales antes y después.

**② El anillo, y por qué la 1ª medida dijo lo contrario.** La primera pasada (`r1-sin-espera-transicion.txt`)
leyó `box-shadow: rgba(0,0,0,0) 0 0 0 0` y la captura salía sin anillo: medía en el ARRANQUE de la
transición (`.btn-ghost` lleva `transition: … box-shadow .15s`, FRONT-1 de `styles.css`). Con 600 ms
de espera, el anillo está. Lo que le pasó a Partes (otra regla le pisaba la sombra) **no le pasa a
Trabajos**: `.btn-ghost` no declara `box-shadow`, y el valor final es el `--ring` global. Ningún
ancestro lo recorta: los que tienen `overflow` distinto de `visible` (`.table-scroll`, `.jobs-card`)
quedan a ≥ 81 px del botón. Control del instrumento: un `outline` rojo forzado SÍ cambia el recorte.
Capturas: `trabajos-390-ver-detalle-con-foco.png` (y `-sin-foco`), `trabajos-1280-ver-detalle-con-foco.png`,
y la pantalla entera a 390 y 1280.

🔵 **Visto y no tocado:** el anillo es `rgba(34,197,94,.30)` sobre `--neutral-100`: verde muy claro,
contraste del orden de 1,3:1 con el fondo (cálculo mío sobre blanco, no medido con herramienta). Se ve
en la captura, pero es tenue. Es el `--ring` GLOBAL de todo el panel (`styles.css:143`), no de esta fila:
no es de este ticket ni de mi carril.

**Corrijo mi entrada de arriba (AB6, 44 px).** Escribí «entre 641 px y escritorio, `btn-sm` mide ~30 px».
**Falso para esta pantalla:** a 1280 «Ver detalle» mide **89×44**, igual que a 390. Lo pone
`.jobs-pantalla .btn-ghost { min-height: 44px; }` (`styles.css:4292`), que no miré.

**La sonda de S3** (`sonda-div-clicables.mjs`), corrida sobre tres árboles sacados con `git archive`:

| árbol | elementos NO nativos con clic |
|---|---|
| `226e8708` (la sonda recién entrada, antes de #2561) | 13 |
| `origin/main` `57b0bc82` (con #2561) | **13** |
| `origin/scrum-1562c-partes-oficina-con-teclado` `0a103940` (#2560 de S2, ABIERTO; lleva dentro #2561) | **12** |

**No baja de 13 a 11 con lo mío, ni a 10 con lo de S2:** baja a 12, y sólo por S2. La premisa del
encargo no casa con lo que la sonda cuenta: saca TODO elemento no nativo con clic, también si lleva
alternativa nativa dentro (Clientes y Presupuestos siguen saliendo, con su «📊 Historial» y su «Ver
detalle»). Mis dos `TR.jobs-fila` siguen teniendo su clic de ratón, a propósito, y por eso siguen
contando. Lo que cambia con #2561 es su `nativosDentro`, que gana `BUTTON«Ver detalle»`; entre
`antes` y `main`, esas 2 líneas y ninguna más (`sonda-antes.txt`, `sonda-main.txt`). Lo de S2 sí quita
una fila de la cuenta: `DIV.customers-card` de `renderPartesOficinaView` desaparece (`sonda-s2.txt`).
Lo que sí se puede contar como «arreglado»: filas con clic y SIN alternativa nativa de la tabla de S3.

**Lo que no se ha medido:** las otras escaleras de la fila («▶ Empezar», «💰 Cobrar el resto», un
técnico sin escalera): QA sólo tiene Trabajos «Sin agendar», y crear otros para verlo exige escribir.
En el código, `jobRow` añade el botón sin condición de estado; el test lo ve en las 2 filas del censo
(«+ Nuevo albarán» y «Agendar»), no en cada estado; en producción, sólo visto en «Agendar». Tampoco lector de pantalla.

## 18-oct-2026 · S3 · las dos cifras, re-medidas con #2560 y #2561 dentro (sólo medir)

**Medido contra:** `origin/main` = `06c6289d46d5998493ec014fa26ff3353946b58b` · 2026-10-18T17:40:44Z

A9: comprobación → `docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs`

La sonda saca dos cifras, y sólo una mide el defecto. **La cifra que manda es «sin teclado y sin
alternativa nativa»**; la cruda («elementos no nativos con clic») es un indicador. Aceptado así por el
orquestador (18-oct): la cifra que BAJA cuando aparece la alternativa demuestra que la sonda depende de
lo que dice medir.

| árbol | no nativos con clic (cruda) | sin teclado y **sin alternativa** |
|---|---|---|
| `e59be9fa` (antes de 1562c y 1562d) | 13 | **5**: Facturas ×2 · Trabajos ×2 · Partes ×1 |
| `57b0bc82` (#2561 dentro, #2560 todavía no) | 13 | **3**: Facturas ×2 · Partes ×1 |
| `06c6289d` (los dos dentro) | **12** | **2**: Facturas ×2 (`invoicesView.js`, J1) |

- Trabajos (#2561) no baja la cruda, y es correcto: la `TR.jobs-fila` mantiene su clic de ratón y gana
  `BUTTON«Ver detalle»` dentro. Es el mismo patrón que la `TR` de Presupuestos, que se decidió no tocar.
  Bajar la cruda quitándole el clic a una fila sería romper el ratón para mejorar el indicador.
- Partes (#2560) sí la baja: `DIV.customers-card` deja de recibir clic sin ser nativo.
- Queda una sola lista que con teclado no se puede abrir: Facturas, de J1 (`para-javier.md` §23).
- El censo táctil sigue declarando Partes de oficina en «NO MEDIDAS», con 12 nodos. Es el umbral de
  20 nodos del censo (`if (nodos < 20)` en `scripts/censo-objetivo-tactil-panel.mjs`), no la vista:
  dicho, no tocado.

## 22-oct-2026 · S4 · 1562f — «Ver detalle» sale de `.jobs-acciones` (el guard de la escalera, en verde)

**Skill UI:** cargada (`yaqu-premium-ui`) antes de tocar `jobsView.js` y `styles.css`. Cero texto, cero
tokens, cero componentes: el mismo `<button>` con la misma clase, y una caja flex con las reglas de
`.jobs-acciones`.

**Medido contra:** `origin/main` = `595884b20b8baa3fad91151879214554b9f6e2e2` · 2026-10-22T09:37:09Z

Ancla de `node scripts/equipo/ancla.mjs`. Las medidas se hicieron sobre `9839aa6c2baee741f6a38de4e99c7fc29a3fe807`;
los dos commits de `main` que entraron entre medias sólo tocan `docs/master/SCRUM-1536.md`.

A9: comprobación → `tests/scrum1562f-ver-detalle-fuera-de-acciones.test.mjs`

**El defecto, y es de este puesto.** 1562d (#2561) metió «Ver detalle» DENTRO de `.jobs-acciones`.
`guard:escalera-por-estado` lee esa caja (`.jobs-acciones > button`) como «la acción de la fila» y la
compara con la del detalle. En un Trabajo CERRADO, «Ver detalle» era el único botón de la caja: la lista
«proponía» «Ver detalle» y el detalle nada → **2 hallazgos** en el job de navegador de `main`, durante
días (SCRUM-1570 c.20159). Se rompió la población que medía otro guard sin censar quién la medía (A12).
El test nuevo lleva esa pregunta DENTRO de la tanda obligatoria: el guard corre en un job informativo y
su rojo no lo miraba nadie.

**Lo que se decidió (no yo):** opción (a) del fundador, SCRUM-1570 c.20161 («Ok seguimos tu
recomedación»): «Ver detalle» sale de `.jobs-acciones` y **el guard no se toca**.
`git diff origin/main -- scripts/guard-escalera-por-estado.mjs` → vacío.

**Lo que se ha hecho.** La celda `td.cell-actions` lleva ahora `div.jobs-celda-acciones` con DOS
hermanos: «Ver detalle» (mirar) y `.jobs-acciones` (actuar: la escalera y el «⋯»). Es el mismo
`<button>` nativo, con `btn-ghost btn-sm` y su `stopPropagation`, en la misma celda. Va DELANTE, como
en Presupuestos (`quotesListView.js:342`), para que el «⋯» siga cerrando la fila. **No** se ha quitado
el botón ni se le ha dado `tabindex`/`role` a la fila: un `<tr role=button>` deja de ser una fila para
un lector de pantalla (1562d), y quitarlo deja la fila sin teclado (ver M2).
`styles.css` (contenedor de S2): un bloque de una regla, marcado `S4 · SCRUM-1562f`.

**El guard, rojo primero y SIN TOCAR** (Edge, Windows, banco `scripts/_banco-lista.mjs`):

| árbol | `cerrado`: lista / detalle | ③ lista cerrada | veredicto |
|---|---|---|---|
| base `9839aa6c` | «Ver detalle» / (ninguna) 🔴 | propone «Ver detalle» 🔴 | **2 hallazgos · 0 ciegos → salida 1** (los mismos 2 que en el CI) |
| con el arreglo | (ninguna) / (ninguna) | sin acción principal (72 nodos) | **salida 0** · suelo: 4 rótulos distintos en 5 estados |

**El teclado, medido** con `docs/master/evidencias/SCRUM-1562/sonda-1562f-teclado.mjs`: Edge real, los
5 estados × 1280 y 390, ANTES (el `public/` del punto de partida) y DESPUÉS. Tab REAL desde la página
cargada hasta «Ver detalle», Intro real, Espacio real (página nueva) y clic real sobre el nombre del
cliente. Control positivo: en el ANTES el botón TIENE que estar dentro de `.jobs-acciones`.

| | en `.jobs-acciones` | misma línea que la acción | alto de fila (1280 / 390) | Tab hasta él | anillo | Intro | Espacio | ratón |
|---|---|---|---|---|---|---|---|---|
| ANTES (10 casos) | sí ×10 | sí ×10 | 91 / 148-167 | 11 (cerrado 10) | ✅ ×10 | ✅ ×10 | ✅ ×10 | ✅ ×10 |
| DESPUÉS (10 casos) | **no ×10** | sí ×10 | **91 / 148-167, igual** | 10 | ✅ ×10 | ✅ ×10 | ✅ ×10 | ✅ ×10 |

Intro, Espacio y ratón = exactamente UNA navegación a `jobs-detail {jobId: 1}`. La parada de Tab baja
en uno porque ahora «Ver detalle» va antes que la acción de la escalera. Salida de la sonda: **0**.

**Mutaciones** (sobre el commit `c63229da5efa6b1826ae99e588a7c5ef0951eea7`, árbol limpio después de cada una):

| mutante | guard escalera | `scrum1562f` (3) | `scrum1562d` (6) | sonda |
|---|---|---|---|---|
| M1 · «Ver detalle» otra vez dentro de `.jobs-acciones` (el defecto) | **1** (2 hallazgos) | **2 fail** | 6 pass | **1** |
| M2 · quitar el botón (el arreglo que la condición prohíbe) | **0 — VERDE** | 3 fail | **4 fail** | **1** |

M2 es la razón de la condición del encargo: **el guard se pone verde quitando el botón y la fila se
queda sin teclado.** Sólo lo cazan los tests y la sonda.

**Otros instrumentos sobre la misma fila (A12), con el arreglo:** `guard:lista-trabajos` salida 0 (16
filas) · `guard:lista-trabajos-917` salida 0 (50 comprobaciones, 1280 y 390) · `guard:objetivo-tactil`
0 hallazgos · 0 ciegos. Los 102 ficheros de test que nombran `jobsView`, `renderJobsView` o
`styles.css`: **951 tests · 951 pass · 0 fail · 0 skip**.

**Lo que NO está medido, con su motivo:**
- **yaqu.app: no.** Producción está congelada en `fe65a8b7` (orquestador, 22-oct 09:12Z): nada de esto
  se puede ver ahí hasta que despliegue. Todo lo de arriba es «medido con la rama servida» en local.
- **La tanda entera: no.** Memoria libre 2.127 MB (umbral 2.200) y sin turno pedido: la corre el
  obligatorio del PR.
- **`npm run build` en este worktree sale 2** por `Merchant.activityKind`, que falta en el cliente de
  Prisma COMPARTIDO (lo dice el guard del cliente). No es de este cambio, que no toca TypeScript. No se
  ha regenerado (A1). `tsc` emitió `dist/` igual, y los tests de arriba corren contra él.
- Lector de pantalla: no.

**Errores míos, cazados por los controles de la sonda:**
1. La primera versión pulsaba el centro de `td.cell-client`, caía en el desplegable de técnicos
   (`[data-fila-no-navega]`) y daba «ratón 🔴» en el ANTES y en el DESPUÉS por igual. Delató a la sonda
   que fallaran los dos lados. Ahora pulsa `.jobs-fila-cliente`.
2. Con M2, la sonda decía «NO SUPE MIRAR» (salida 2): en el DESPUÉS, una fila sin «Ver detalle» no es
   ceguera, es el defecto. Corregida (`2d75bccf1468e6add9aae8df53bb403d7f7d9f7a`) y re-medida con M2 → salida 1.

## 27-oct-2026 · J1 · 1562g — Facturas, sin teclado: MEDIDO y PARADO (el rótulo no está firmado)

**Medido contra:** `origin/main` = `32f9ded17429e020a0cabd7ef84e46fcf2040a79` · 2026-10-27T16:19:07Z

Sesión `jv-j1dc` (puesto J1, equipo de Javier) · rama `scrum-1562g-facturas-con-teclado`. Carril:
`node scripts/carriles.mjs de public/dashboard/js/invoicesView.js` → J1 (`dos-equipos.md:143`).
**Sólo docs: no se ha tocado `public/`.** Ni un texto, ni una línea de código.

A9: aviso → A10 «Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.» — no se pudo comprobar: la sonda es de S3 (evidencias) y no lleva suelo de arranque; ver «Error mío»

### El defecto existe HOY (A2), corriendo la sonda de 1562

`node docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs`, con `dist/` emitido por `tsc --noCheck`:
salida 0, **29 vistas · 29 montadas · 12 elementos no nativos con clic**. Control positivo: Inicio,
`DIV.activity-item`, sale con `tabindex=0`, `role=button` y `keydown`.

| vista | elemento | tabindex | role | teclas (propias o arriba) | nativos dentro |
|---|---|---|---|---|---|
| Facturas | `TR` (F-2026-0022, pendiente) | — | — | — | `INPUT` (la casilla del lote) |
| Facturas | `TR` (F-2026-0021) | — | — | — | ninguno |

El clic es `invoicesView.js:702` (`tr.addEventListener('click', …)`, con la guarda `e.target === cb`
para la casilla). Con teclado, la lista de Facturas no abre ninguna factura.

### Por qué paro: el patrón de Trabajos pide un rótulo que nadie ha firmado

- **Trabajos (1562d/1562f)** resolvió con un `<button class="btn-ghost btn-sm">` «Ver detalle» en cada
  fila, con `stopPropagation`, el clic de la fila intacto, y desde 1562f fuera de `.jobs-acciones`.
  **Partes (1562c)** convirtió la fila en un `<button>`: no aplica a un `<tr>`. **No hay helper ni
  componente compartido**: son dos soluciones escritas en línea en cada vista.
- **«Ver detalle» no está firmado.** `grep -i "ver detalle"` en `docs/microcopy/` y `docs/YAQU_MASTER.md`:
  **0**. Control positivo de la misma búsqueda: `docs/microcopy/` sí tiene registros con «Aprobado por».
  El rótulo existe en Presupuestos (`quotesListView.js`) desde el 26-nov-2025, antes de la regla 39;
  1562d lo reutilizó por estar «en la lista hermana». SCRUM-1570 c.20161 decide DÓNDE va en Trabajos
  (opción (a)), no el texto. A7: «Que un texto exista en otra pantalla NO acredita que nadie lo firmara».
- La descripción de 1562 dice: «⛔ Sin texto nuevo: donde haga falta un rótulo, se reutiliza el que ya
  existe en esa fila». En la fila de Facturas no hay ninguno.

### Lo que se lleva al fundador (✅/❌), en SCRUM-1562 c.21124

1. **(A) «Ver detalle» en Facturas**, el mismo `<button class="btn-ghost btn-sm">` de Trabajos y
   Presupuestos, en una celda propia al final de la fila; el clic de la fila y la casilla no cambian.
   Literal: `Ver detalle`. ✅/❌ — **recomendación: ✅**, por coherencia con las dos listas hermanas.
2. **(B) si ❌: sin texto nuevo.** El número de factura (`F-2026-0022`) pasa a ser un `<button>` nativo
   que abre el detalle. El rótulo es el dato que ya se ve. Es una forma distinta de la de Trabajos.

### Error mío

La primera pasada de la sonda salió con **1** y 1.188 B: `MODULE_NOT_FOUND` de `dist/` (el árbol anidado
no lo trae). Era un instrumento que no arrancó, no un hallazgo; lo cacé leyendo la salida antes de
contarla, no por un suelo de la sonda. Con `dist/` emitido: salida 0 y 8.930 B.

### NO medido

- Ningún test ni mutación: no hay arreglo que fijar hasta la decisión.
- yaqu.app: no mirado (no hay nada nuevo que ver).
- La tanda entera: no corrida (sólo cambia este registro).

## 27-oct-2026 · J1 · 1562g — Facturas con teclado: «Ver detalle» en cada fila (firma c.21125)

**Medido contra:** `origin/main` = `8f115f4ab0d876c8a182fb82f9a604d213ce4cca` · 2026-10-27T16:42:21Z

A9: comprobación → `tests/scrum1562g-facturas-con-teclado.test.mjs`

Arreglo: en `public/dashboard/js/invoicesView.js` cada fila lleva una celda `td.cell-actions` con un
`<button class="btn-ghost btn-sm">` «Ver detalle» (rótulo firmado en SCRUM-1562 c.21125) que abre
`invoice-detail` con `stopPropagation`; la cabecera gana un `<th></th>` vacío. El clic en la fila y
la casilla del lote no cambian, y la fila no lleva `role`. Sonda de navegador real:
`docs/master/evidencias/SCRUM-1562/sonda-1562g-teclado.mjs` (antes 4/4 sin teclado; después 4/4
con Tab, Intro y Espacio; ratón 8/8; la casilla marca y no navega).

- **Test de banco** (6 casos): rojo primero sobre `2f7adc4d5^` en una copia fuera del árbol: 3 caen
  (los de «Ver detalle») y 3 pasan (suelo, casilla, cabeceras); con el arreglo, 6/6.
- **Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN`, 5) por `correr` + `aplicarUna` de
  `scripts/meta-guard-mutaciones.mjs`: 5 vivas de 5, árbol restaurado (`git status` limpio).
- **Error mío:** el rojo primero salió dos veces CIEGO (a la copia le faltaban `typescript` y
  `dist/`): 6 de 6 caídos en ~1 ms, el SUELO incluido. Lo cazó que cayera el suelo, que con el
  código viejo tenía que pasar. Y probé `guards-visuales.mjs --help` para leer su uso: calentó
  Edge y salió con 0 sin correr ningún guard. Al principio lo di por la tanda de navegador; lo
  vi al leer la salida (838 B, ni un veredicto).
- **NO medido:** yaqu.app (no está desplegado); la tanda entera (dirigida de 81 ficheros, abajo).

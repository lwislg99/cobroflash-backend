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

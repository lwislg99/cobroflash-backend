# SCRUM-1206 — La ficha no enseña los textos de cabecera y Observaciones guardados

**Medido contra:** `origin/main` = `1716a0f5451c37c35250fb90b07bda2f2bbdc574` · 2026-10-16T12:36:42Z

El ticket es del presupuesto (`quotesDetailView.js`, S2). Este registro empieza con la mitad del ALBARÁN,
que S4 encontró de paso en c.19790: `albaranDetailView.js` tampoco pintaba su cabecera ni sus notas.
A9: sin fallo que generalice — cabecera del registro; lo construido va en el tramo de abajo

## 1206b — la ficha del albarán pinta su cabecera y sus observaciones (S4, s4-16oct)

**Medido contra:** `origin/main` = `1716a0f5451c37c35250fb90b07bda2f2bbdc574` · 2026-10-16T12:36:42Z

Producción servía `0dbc92f240a91fbe9e35fd2d3830c53bb12cddc4` (/version) a esa hora.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y ANTES de editar). Sin token, clase ni estilo nuevo:
reutiliza `.detail-rail-linea--nota` (SCRUM-982, la nota del cliente en el rail del Trabajo). Carril:
`albaranDetailView.js` → S4 (`node scripts/carriles.mjs de …`, `dos-equipos.md:149`).

**La firma** (orquestador, 16-oct-2026, con delegación del fundador, por `SendMessage` a S4):

- `notas` lleva **«Observaciones»**. No es texto nuevo: el PDF imprime `notas` bajo ese título
  (`albaranPdf.service.ts:332-338`, `TITULO_OBSERVACIONES` de `pdf.service.ts:60`), y `schema.prisma`, junto a
  `docHeaderText`, dice que el pie del albarán es `notas`. La pantalla no copia el literal: lo lee de
  `textoDelDocumento.js` (`TD_TITULO_OBSERVACIONES`), donde ya vive firmado.
- `docHeaderText` va **SIN RÓTULO**, como en el papel (SCRUM-593.md: «en el pdf final que no salga, solo aparece
  el texto sin rótulo»). «Añadir texto en el documento» es el rótulo del FORMULARIO.
- **La pregunta que lo decidía:** ¿lo que enseña la ficha ES el campo Observaciones? Para `notas`, sí. El aviso de
  `jobDetailView.js:3000` («derivarlo de "Observaciones" sería inventar microcopy») habla de la CABECERA, que es
  otro campo, y por eso no lo contradice.

**Lo construido:** en el rail, después de la fila del presupuesto, una fila por texto y en el orden del papel:
la cabecera y después las observaciones. Entran por `textContent` y sin estilo en línea. Sin dato no hay fila:
vacío, sólo espacios o `null` no pintan nada, ni el rótulo.

**No usa `textoDelDocumentoPintado`, a propósito:** pinta un `div` con `pre-line` en línea y sin
`overflow-wrap`. Una URL larga ensancharía el rail en 360 px. La clase del rail ya resuelve las dos cosas y no
tocar `styles.css` (S2, contenedor). La entrada de `_sin-consumir-declarados.json` sigue como está: la conecta
el presupuesto, que es de S2.

**Tests:** `tests/scrum1206b-la-ficha-del-albaran-pinta-sus-textos.test.mjs` (6), con la ficha REAL en el banco
de vistas (`_banco-vistas.mjs`).

| comprobación | resultado |
|---|---|
| con el cambio | 6 de 6 |
| con el `albaranDetailView.js` de `main` | caen 4: los que ven texto. Pasan el SUELO (el literal llega de la pieza) y «sin dato, sin fila» |
| M1 · la cabecera con el rótulo del formulario | caen 2 de 6 |
| M2 · el orden invertido | cae 1 de 6 |
| M3 · sin el «sin dato, sin fila» (sólo `null`) | cae 1 de 6 |

**Tanda entera** (`node --test "tests/*.test.mjs"`, primer plano): 11.690 tests, 14 caídos, clasificados:

- **2 eran míos y los arregla este registro:** `scrum1340` y `scrum854` (una rama que toca `public/` declara su
  registro y su skill).
- **11 son de entorno:** el cliente de Prisma del `node_modules` compartido está por detrás del esquema (le
  falta `activityKind`, de SCRUM-1072). `tsc` cae por lo mismo en `merchantAdmin.ts:147`. Son los de
  SCRUM-235, 237, 461, 733 y 976, y «el SQL del censo de producción». No lo arreglo porque `prisma generate`
  está vetado; el juez es el CI.
- **1 de entorno conocido:** `scrum1321` (el temporal en otra unidad, ya declarado en SCRUM-1150 c.19657).

**🔴 Error mío, cazado por el CI (run 38902849765, 16-oct 12:57Z):** de los 11 «de entorno», UNO no lo era.
`scrum237` (toda negación lleva respaldo) caía por MI test: `!todo.includes('Añadir texto en el documento')` no
tenía un positivo hermano, así que podía estar buscando un texto que no existe en ninguna parte y dar verde
para siempre. Lo metí en la cuenta del cliente de Prisma sin leer su mensaje. Arreglo: el hermano comprueba
que ese texto ES el rótulo que expone la pieza (`TD_TITULO_CABECERA`). Con él, `scrum237` y `scrum976` (que lo
ejecuta dentro de `guards:entrada`) pasan en local: 14/14 y 11/11.
- **Rojo informativo, no mío:** `guard:cls-barra-anuncio` (guards de navegador) mide CLS 0,127 a 360 px en la
  barra de oferta de la LANDING. No toca esta rama (J3).

**No visto en yaqu.app todavía:** se mira cuando entre, sobre el albarán #46 de la cuenta QA (su GET trae la
nota «Albarán de pruebas QA (SCRUM-1268).»), con el #47 de control.
A9: sin fallo que generalice — la firma separó dos campos que el contradato mezclaba, y eso ya queda escrito arriba con su localizador

## 1206b — VISTO en yaqu.app (S4, s4-16oct)

**Medido contra:** `origin/main` = `8e5c7801e7520c012256103aa9c122f807f3ad55` · 2026-10-16T13:29:47Z

#2529 se mergeó a las 13:26:29Z (`8e5c7801`), y producción servía ese mismo SHA (/version) al medir. El
`albaranDetailView.js` servido trae `filaDeTexto(` 2 veces.

**Banco:** `docs/master/evidencias/SCRUM-1206/ver1206b.mjs`. Cuenta QA, sólo GET (cualquier otra petición se
aborta y se apunta), `serviceWorkers: 'block'`, a 390 y 1280 px. Cada caso compara la ficha con lo que trae
SU GET. Salidas: `ver1206b-antes-16oct.txt` (antes del merge) y `ver1206b-despues-16oct.txt`.

**El dato para la cabecera:** ningún albarán de QA tenía `docHeaderText`. Se creó UNO, con el sí del
orquestador (opción c): el **#48 (AB260003), en BORRADOR**, en el Trabajo #76, a las 12:41:22Z, con
`crear-borrador-qa.mjs`. El script se cierra si la sesión no es del negocio 46. Antes de escribir había #47
(firmado) y #46 (emitido). Los dos textos van marcados «[QA S4 16-oct] … No es un cliente real.». **No se
emite, no se firma, no se envía.** De paso: `POST /admin/jobs/:id/albaranes` no lleva `requireActivePlan`, así
que el plan vencido de la cuenta QA no impide crear albaranes.

| albarán | qué trae su GET | ANTES (0dbc92f2 / 1716a0f5) | DESPUÉS (8e5c7801) |
|---|---|---|---|
| #46 emitido | `notas`, sin cabecera | 0 filas | 1 fila: «Observaciones» + su nota, a 390 y 1280 |
| #47 firmado | `notas`, sin cabecera | 0 filas | 1 fila: «Observaciones» + su nota, a 390 y 1280 |
| #48 borrador | cabecera (2 líneas) + `notas` | 0 filas | 2 filas en el orden del papel: la cabecera SIN rótulo, con su salto de línea, y después «Observaciones» |

En los 6 casos: el número del albarán se pinta (control de que la ficha se montó), no hay desborde
horizontal, se hicieron 110 GET y el único abortado fue `POST /admin/entorno`. El texto de cada fila es
IDÉNTICO al de su GET. «Añadir texto en el documento» no aparece.

**Visto en la captura a 390 px, y NO arreglado (no es de este ticket):** «Observaciones» se pinta con
`.detail-rail-etiqueta` (gris, mayúscula sólo la inicial), y las filas de encima (TRABAJO, CLIENTE…) con
`detail-total-label` (versalitas). Son dos estilos de rótulo en el mismo rail. La clase de la nota es la de
SCRUM-982, la única que existía para texto de varias líneas. Igualarlas es una decisión de diseño del rail
del albarán, y queda para quien la reparta.

**Lo que NO cierra:** SCRUM-1206 es del PRESUPUESTO (`quotesDetailView.js`, S2). Esto es la mitad del albarán.
A9: aviso → cicatriz S4 «metí un rojo mío de la tanda local entre los de entorno sin leer su mensaje, porque sus diez vecinos sí eran del cliente de Prisma; lo cazó el CI» — no se pudo comprobar: clasificar los rojos lo hace quien lee la tanda, y ningún test lo ve

## 1206d — un solo estilo de rótulo en el rail del albarán (S4, s4-15oct)

**Medido contra:** `origin/main` = `e244ff61b1b81dd57d3747298ca207502a5a1c59` · 2026-10-17T19:59:19Z

Producción servía `e244ff61b1b81dd57d3747298ca207502a5a1c59` (/version) a esa hora.

**Sufijo:** el orquestador dio `1206c` por libre; al ir a empujar ya era de S2
(`scrum-1206c-la-ficha-del-presupuesto-pinta-sus-textos`, la mitad del presupuesto). Éste es `1206d`.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y ANTES de editar). Sin token, clase ni estilo nuevo, y
sin tocar `styles.css` (contenedor de S2): sólo `albaranDetailView.js` (S4, `dos-equipos.md:149`). Las PALABRAS
no cambian, sólo cómo se pintan: es estilo, no microcopy.

**Lo medido (yaqu.app, cuenta QA, sólo GET, 390 y 1280 px; `ver1206d-rotulos-en-prod.mjs`):**

| ficha | rótulos | ¿mezcla? |
|---|---|---|
| albarán #46 y #48 | TRABAJO, CLIENTE, DIRECCIÓN, FACTURACIÓN con `detail-total-label` (11,5 px / 700 / mayúsculas); «Observaciones» con `.detail-rail-etiqueta` (13 px / 400 / sin mayúsculas), cada uno en su propia caja del rail. Presupuesto y Fotos, por código, con la clase de «Observaciones» | **sí**: dos estilos para filas del mismo nivel |
| Trabajo #76 | CLIENTE, PRESUPUESTO, RESPONSABLE con `detail-section-title` (título de BLOQUE); «Nota del cliente» con `.detail-rail-etiqueta` DENTRO del bloque | no: son dos niveles |
| parte (`parteDetailView.js`) | no tiene rail | no aplica |

Sólo el albarán: es un retoque, no un patrón. La ficha del Trabajo es de S2 (`jobDetailView.js`), no de S4.

**La causa:** `DESIGN.md` no cubre el formato de los rótulos de un rail. No dice «versalitas» ni
`text-transform` (cero apariciones); sí dice MAYÚSCULAS para el «Label» de KPI, cabeceras de tabla y secciones
del sidebar (`DESIGN.md:147`), y un rótulo de campo «estilo Label (12px, 600)» encima del campo (`DESIGN.md:201`),
pero no cuál de los dos vale en un rail. Con esa laguna, cada fila nueva copió la clase que tenía más a mano: las
de SCRUM-302 y la de 1206b (mía) copiaron la del rótulo de línea del Trabajo (.detail-rail-etiqueta, SCRUM-318). **Mientras `DESIGN.md` no lo diga, volverá a
pasar en la siguiente pantalla.** Tocar `DESIGN.md` lo decide el orquestador aparte; aquí sólo queda nombrado.

**La decisión NO sale de una norma: es del orquestador, 17-oct-2026** (por `SendMessage` a S4): los tres rótulos de
la minoría (Presupuesto, Observaciones, Fotos) se alinean a versalitas con la mayoría (TRABAJO, CLIENTE…), porque
el cambio menor es llevar la minoría a la mayoría.

**Lo construido:** una constante `CLASE_ROTULO_RAIL` (`detail-total-label`) para TODOS los rótulos del rail. Las
filas de Presupuesto y Fotos pasan a `--nota` (rótulo ENCIMA del valor, como las de arriba; al lado, en
versalitas, se leía como otra cosa). El enlace del presupuesto va dentro de su caja: suelto, `--nota` lo estiraba
a 320 px (390 de pantalla) y se pulsaba tocando el hueco vacío; medido de nuevo, 44×44.

**Antes de empujar** (`ver1206d-antes-de-empujar.mjs`: yaqu.app con el `albaranDetailView.js` del disco servido
en el navegador y el GET del #48 completado EN EL NAVEGADOR con presupuesto y una foto, para que salgan las 8
filas; control: `jsLocalServido` es `false` en el ANTES y `true` en el DESPUÉS; único abortado `POST /admin/entorno`):

| | ANTES (main) | DESPUÉS |
|---|---|---|
| clases de rótulo en el rail | 2 (5 `detail-total-label` + 3 `.detail-rail-etiqueta`) | 1 (8 `detail-total-label`) |
| rótulo encima de su valor | 6 de 8 (Presupuesto y Fotos, al lado) | 8 de 8 |
| enlace del presupuesto | 44×44 | 44×44 |
| desborde horizontal | no | no |

Diferencia que queda: entre rótulo y valor hay 6 px en las tres filas `--nota` y 3 px en las de arriba (el
`margin-bottom` de la clase sólo cuenta cuando el rótulo es elemento flex). Igualarlo pide CSS de S2: no se toca.

**Guard:** `tests/scrum1206d-un-solo-rotulo-en-el-rail.test.mjs` pinta la ficha con las 8 filas (suelo: las cuenta
por su TEXTO) y exige UNA sola clase de rótulo. Visto en ROJO contra el `albaranDetailView.js` de main («conviven
varios estilos… Presupuesto → detail-rail-etiqueta · Observaciones → … · Fotos → …»), y verde con el arreglo.
`scrum1206b` localizaba el rótulo por `.detail-rail-etiqueta`: su localizador pasa a la clase nueva; lo que exige
(rótulo «Observaciones», texto intacto, orden del papel, sin dato sin fila) no cambia. Tanda local de los 4
ficheros del rail (1206d, 1206b, 1375, 302): 26 de 26.
A9: comprobación → `tests/scrum1206d-un-solo-rotulo-en-el-rail.test.mjs`
## 1206c — la ficha del PRESUPUESTO pinta su cabecera y sus Observaciones (S2, s2-1206)

**Medido contra:** `origin/main` = `e244ff61b1b81dd57d3747298ca207502a5a1c59` · 2026-10-17T19:57:04Z

A9: comprobación → `tests/scrum1206c-la-ficha-del-presupuesto-pinta-sus-textos.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y ANTES de editar). Una clase nueva en `styles.css`
(`.quote-doc-texto`, sólo `overflow-wrap` y tokens existentes); el resto, el armazón de la ficha
(`.detail-section`, `.detail-section-title`). Carril: `quotesDetailView.js` y `textoDelDocumento.js` → S2.

**La firma** es la del tramo 1206b (orquestador, 16-oct-2026, delegación del fundador; repetida a la S2 en el
encargo del 16-oct): la cabecera **SIN RÓTULO**, como en el papel; el bloque final con **«Observaciones»**,
LEÍDO de `TD_TITULO_OBSERVACIONES` y no copiado. ⚠️ En el presupuesto ese bloque NO es `notas`: es
`docFooterText`. Lo dice el papel —`pdf.service.ts` imprime `TITULO_OBSERVACIONES` sobre `docFooterText`— y lo
dice la pieza (`TD_CAMPOS`: `docFooterText` → «Observaciones», firmado por el fundador el 2-sep). El criterio de
la firma («el campo que el papel imprime bajo Observaciones lleva Observaciones») da aquí `docFooterText`. Sin
palabra nueva.

**Lo construido (las 4 líneas de la aceptación):**

1. `quotesDetailView.js`: dos secciones, en el ORDEN DEL PAPEL: la cabecera (`data-seccion="texto-cabecera"`,
   sin título) justo encima de «Conceptos», y las Observaciones (`data-seccion="observaciones"`) justo debajo
   de los totales. Las pinta `textoDelDocumentoPintado`, la pieza que existía para esto (saltos con
   `pre-line`, por `textContent`); su contenedor `.quote-doc-texto` le añade `overflow-wrap: anywhere`, que era
   la objeción de S4 en 1206b (una URL larga ensanchaba la ficha a 360 px). Sin dato no hay sección: vacío,
   sólo espacios o `null` no pintan nada, ni el rótulo. Sin el rótulo de la pieza, las Observaciones no se
   pintan (sin título se leerían como la cabecera).
2. `scripts/_sin-consumir-declarados.json`: `textoDelDocumentoPintado` pasa de `declaradas` a `retiradas` con su
   motivo.
3. `tests/scrum1206c-la-ficha-del-presupuesto-pinta-sus-textos.test.mjs` (6), con la ficha REAL en el banco.
4. Rótulos: los de la pieza; nada nuevo.

| comprobación | resultado |
|---|---|
| con el cambio | 6 de 6 |
| con el `quotesDetailView.js` de `main` | caen 4: los que ven texto. Pasan el SUELO (el rótulo y la pieza llegan) y «sin dato, sin sección» |
| M1 · la cabecera con el rótulo del formulario | cae 1 de 6 |
| M2 · sin la sección de la cabecera | caen 2 de 6 |
| M3 · sin el «sin dato, sin sección» (sólo `null`) | cae 1 de 6 |

**Vecinos:** 38 ficheros (las 18 que montan `renderQuoteDetailView`, `scrum593*`, `scrum1185*`, `1174`,
`1187`, `514`, `237`, `976`…): 388 tests · 381 pass · 4 skip · 3 fail, los tres del registro que se escribe
aquí (`scrum1340`, `scrum854 ②` y `scrum976 ④`, que ejecuta los mismos guards de entrada).

**No visto en yaqu.app todavía:** se mira cuando entre, sobre el #202 de la cuenta QA (su GET trae
«[QA-1268] Cabecera de pruebas QA…» y «[QA-1268] Pie de pruebas QA…», c.19790), con otro presupuesto sin
textos de control.

## 1206d — VISTO en yaqu.app (S4, s4-15oct)

**Medido contra:** `origin/main` = `1900f25f0386e08a69cfab766b92395874209050` · 2026-10-17T20:38:58Z

#2540 se mergeó a las 20:33:16Z (`1900f25f`), y producción servía ese mismo SHA (/version) al medir. El JS
servido trae `CLASE_ROTULO_RAIL` (control de que no se mide una versión vieja). Cuenta QA, sólo GET, 390 y 1280 px,
`serviceWorkers: 'block'`; el único abortado en todos los casos, `POST /admin/entorno`.

| caso | ANTES (17-oct, `e244ff61`) | DESPUÉS (`1900f25f`) |
|---|---|---|
| #46 y #48, tal cual | 4 versalitas + «Observaciones» con `.detail-rail-etiqueta` | 5 rótulos, todos `detail-total-label` |
| #48 con presupuesto y una foto añadidos EN EL NAVEGADOR (8 filas) | 5 + 3 (Presupuesto y Fotos, al lado de su valor) | 8, todos `detail-total-label`, todos encima de su valor; enlace 44×44 |
| Trabajo #76 (control: no se tocó) | CLIENTE/PRESUPUESTO/RESPONSABLE `detail-section-title` + «Nota del cliente» `.detail-rail-etiqueta` | igual |

Salidas: `ver1206d-visto-real-17oct.txt` y `ver1206d-visto-inyectado-17oct.txt` (bancos `ver1206d-rotulos-en-prod.mjs`
y `ver1206d-antes-de-empujar.mjs main`, éste con `jsLocalServido: false`: el JS es el de producción).

**Check informativo «guards de navegador» de #2540 en rojo, leído:** `guard:cls-barra-anuncio` (CLS 0,127 a 360 px
en la landing) y `guard:objetivo-tactil` («⬇ Clientes CSV» 31 px). Ninguno toca el albarán;
`guard:albaranes-con-acciones` en verde.

**Lo que queda abierto, y no es de S4:** `DESIGN.md` sigue sin decir qué rótulo lleva un rail (tramo de arriba).
Lo decide el orquestador aparte.
A9: sin fallo que generalice — tramo de verificación; el fallo del sufijo (`1206c` ya cogido al empujar) lo paró el control antes del push, que es la comprobación que ya existe

# SCRUM-1215 — 77 textos del panel sin revisar (censo 1157), en 5 lotes

## Lote 4 · revisiones del presupuesto (`quoteRevisiones.js`) — S2 (`s2-28c`)

**Medido contra:** `origin/main` = `4583f537880241f948a78c9ee274d1b1a59c59a0` · 2026-09-28T15:28:46Z

Revisión hoja a hoja en Jira, SCRUM-1215 c.17371; GO del orquestador a las dos cosas, en un PR.

- **Las 6 hojas ya estaban firmadas** (4 el 3-sep-2026, addendum «Revisiones del presupuesto» de
  `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`; `crearRevision` y `errorCrear` el 16-sep-2026 en
  SCRUM-688). El censo 1157 las daba `SIN_COMENTARIO` porque toma como cuenta de lo aprobado el
  número más pequeño delante de «textos/rótulos» en la cabecera, y la nota de `ciego` decía
  «dos textos y no uno» → solo aprobaba `titulo` y `vigente`. Se reescribe la nota sin cifra, **no se
  refirma**. Medido con `censarFuente`: 2 → 8 `APROBADO`. Las 6 pasan de `acusadas` a `retiradas` en
  `scripts/_censo-convenio-microcopy-declarados.json`, con su firma citada.
- **`errorCrear` no se pintaba nunca.** `cablearCrearRevision` solo lo usaba con `e.message` vacío, y
  `apiRequest` siempre lanza con mensaje: el profesional leía «API 500: internal_error» o «Failed to
  fetch». Ahora se enseña el mensaje del servidor **solo** si viene en `data.message` (el que escribe
  `RevisionNoCreable` para una persona); todo lo demás cae en `errorCrear`. Sin texto nuevo.
- Test del viaje `tests/scrum1215-revisiones-error-crear.test.mjs`: ficha montada en el banco, clic en
  «Crear revisión», la respuesta pasa por el `apiRequest` REAL (el banco solo pone el `fetch`).
  **Rojo antes** (medido): 500 → `API 500: internal_error`; sin red → `Failed to fetch`. Verde después;
  el 409 con `message` sigue enseñando el del servidor.
- Vecinos en verde: 655c, 688, 988, 1157, 1185 (50/50).
- **NO VERIFICADO en yaqu.app**: la lectura de producción está denegada para S2.
- Pendiente de decidir (orquestador): el botón «Crear revisión» sale también en un presupuesto sin
  `quoteNumber`, que el servidor rechaza con su motivo.
# SCRUM-1215 · lote 1 (parte) — `yaFirmado` retirada: no la leía nadie

**Medido contra:** `origin/main` = `d2c8903c5e75c9defc732bf8f7a7eebf20e79561` · 2026-09-28T15:10:58Z
**Medido en:** sesión `s4` · rama `scrum-1215-retirar-yafirmado`

La revisión hoja a hoja del lote 1 (28 textos de `parteDetailView.js`) está en Jira, SCRUM-1215
comentarios 17360 y 17361: 24 pasan · 2 no pasan (`pistaFirma`, `sinBloque`) · 1 muerta
(`yaFirmado`) · 1 dudosa (`sinLineas`). Este incremento hace **solo** la retirada, decidida por el
orquestador (`cobroflash-backend-57`) el 28-sep.

## Qué se ha retirado y por qué

`TEXTOS.yaFirmado` («Firmado. El contenido ya no se puede cambiar.») tenía **cero consumidores**: ni
`TEXTOS.yaFirmado` ni un índice dinámico `TEXTOS[...]` en todo `public/`. El censo de SCRUM-1157 lo
daba como posible dinámico; medido a mano, no se pinta nunca.

- La clave sale del objeto, y en su sitio queda un comentario con el motivo.
- En `scripts/_censo-convenio-microcopy-declarados.json` pasa de `acusadas` a `retiradas`, con su
  motivo. **No se firmó: se borró**, y así queda escrito.

## Verificación

- Censo 1157: **233 hojas · APROBADO 150 · PENDIENTE 7 · SIN_COMENTARIO 76**, trinquete
  **0 nuevas · 0 que sobran**.
- `scrum1157`, `scrum720`, `scrum1175b`, `scrum652c`, `scrum653`: **47 tests · 47 pass · 0 fail ·
  0 skip**, tras el build.

## Incremento 2 · las firmadas del lote 1, marcadas para que el censo las cuente

Firma: **SCRUM-1215 comentario 17367** (orquestador por delegación del fundador), leída en Jira antes
de tocar nada. **22 aprobadas**: los 16 rótulos + `firmar`, `anadirLinea`, `dictado`,
`pistaDictado`, `ordenarDictado`, `noSePudoCargar`. Cada una lleva **encima** su
`// APROBADO · SCRUM-1215 comentario 17367`. `firmaRechazada` no se volvió a firmar: su comentario
decía «PENDIENTE DE FIRMA» y ahora cita la firma real (SCRUM-890 c.15665).

**No se marcan, a propósito:** `confirmarPropuesta` (NO aprobada: «añadir estas» es falso mientras
SCRUM-1230 no haga entrar las «Sin colocar»; se aprueba sola cuando lo haga) · `pistaFirma`
(SCRUM-1229) · `sinBloque` (SCRUM-1230) · `sinLineas` (ver abajo).

Censo: **APROBADO 173 · PENDIENTE 7 · SIN_COMENTARIO 53**, trinquete **0 nuevas · 0 que sobran**; las
23 pasan de `acusadas` a `retiradas` con su motivo. Tanda de la zona: **69 · 69 pass · 0 fail · 0 skip**.

⚠️ **Punto ciego del censo, medido**: la regla 1 de `_censo-convenio-microcopy.mjs`
(`k: 'x', // APROBADO`, en la misma línea) **no funciona con coma**. `getTrailingCommentRanges` se
llama en el fin de la propiedad, ANTES de la coma, y `getLeadingCommentRanges` no recoge un
comentario de la misma línea. Las 22 marcas puestas así salieron `SIN_COMENTARIO`; puestas encima
(regla 2), `APROBADO`. Falla hacia acusar de más (la dirección segura), pero la regla documentada no
se puede usar. Avisado a S3.

**`sinLineas` NO pintada**: la firma aprueba «No se apuntó nada en este apartado.» para el bloque
vacío y no editable, pero la edición la **denegó el clasificador de permisos** ([Instruction
Poisoning]). No se rodea; queda para cuando lo decida el fundador. Vocabulario comprobado: «bloque»
solo existe en atributos del código, nunca a la vista, así que «apartado» cumple la condición.

## Lo que NO entra aquí

- `sinLineas`: medido que **sí se pinta** en un parte firmado (firmar exige una línea en total, no una
  por bloque). Ocultarla deja el bloque con título y cabecera y sin filas: está parado y la decisión es
  del orquestador.

## Apéndice (s4-28e) · `sinLineas` PINTADA

Al volver a intentarlo el clasificador ha dejado la edición. Firma: c.17367.

- `TEXTOS.sinLineasCerrado` = «No se apuntó nada en este apartado.», con su `APROBADO` encima. Se pinta
  **sólo** en un bloque vacío que no es editable; editable, sigue `sinLineas` («Todavía no has apuntado
  nada.»), como dice la firma.
- **Lo que afirma, comprobado:** `editable` = `puedeEditarContenido(estado).ok`, y eso sólo es cierto en
  `borrador` (`parteTrabajo.ts:319`). No depende de quién abra la pantalla: no editable = parte firmado.
- `tests/scrum1215b-sin-lineas-cerrado.test.mjs` monta la vista en el banco: firmado → el texto nuevo;
  borrador → el de siempre. **Rojo comprobado:** sin la ternaria cae el caso firmado (1 pass · 1 fail).
- Censo 1157: trinquete **0 nuevas · 0 que sobran** (la clave nueva nace `APROBADO`; `sinLineas` sigue
  `SIN_COMENTARIO`, sin tocar el JSON). Tanda de la zona (1215b, 1157, 1175c, 890, 402, 720): **40 · 40
  pass · 0 fail**.

**«Añadir al parte» (c.17375) NO va en esta rama:** está pintado en local (`scrum-1230b-anadir-al-parte-LOCAL`)
y **parado**. Mover `confirmarPropuesta` a `retiradas` en el JSON del censo lo **denegó el clasificador**
([Logging/Audit Tampering]); sin eso, `scrum1157` se pone rojo en el check obligatorio. Avisado al orquestador.

**Medido contra:** `origin/main` = `29eea3f9baba711eb65a3b6119727ef4777f0159` · 2026-09-28T15:39:19Z

## Apéndice (s4-29a) · lote 3 (albarán): «📷 Añadir foto» ya no se ofrece en `firmado`

Revisión: c.17493 (corregida la fila 3 en c.17495). Firma y decisión: c.17494, 6 de 8 aprobados; el 3
(«Facturar lo entregado») sigue pendiente y el 8 se decide así, sin texto nuevo.

- **Lo que se ha medido:** `POST /admin/albaranes/:id/fotos` responde **siempre** 409 `albaran_locked` en
  `firmado` («Un albarán firmado está congelado: no admite fotos nuevas.»), y el registro ofrecía
  `btnFoto` en el «⋮» de ese mismo estado. Era un botón cuya única respuesta posible es un error.
- **El arreglo, en la tabla** y no en la vista: `albaranActionsRegistry.js`, `btnFoto.firmado` pasa de
  `overflow` a `oculta`. En borrador y emitido se queda, porque ahí funciona.
- `tests/scrum707-estado-no-contemplado.test.mjs`: el control positivo enumera lo que se ofrece en cada
  estado, y de `albarán|firmado` se quita `btnFoto`. Es la consecuencia del cambio, no una relajación.
- `tests/scrum1215c-foto-oculta-en-firmado.test.mjs` ata las dos mitades: el servidor sigue rechazando en
  `firmado` (si algún día lo admite, la ocultación pierde su motivo y el test lo dice) y la tabla no la
  ofrece ahí. **Rojo comprobado:** con `firmado: 'overflow'` → 1 pass · 1 fail.
- Tanda de todo lo que lee el registro (8 ficheros): **65 · 65 pass · 0 fail**.
- **No se ha visto en pantalla:** en producción no hay ningún albarán (`GET /admin/albaranes` da total 0
  en la cuenta QA y en la demo), y crear uno es escribir.

**Medido contra:** `origin/main` = `ba1b096661db77f93aaaf52acdcfd7c9d99db9aa` · 2026-09-29T09:02:53Z


## Lote 5 (sueltos) — S2 (`s2-29a`), 29-sep-2026

**Medido contra:** `origin/main` = `51dcfe156990dfb36b6dfb225e6d75bda7e5a08e` · 2026-09-29T09:45:31Z

Revisión hoja a hoja en Jira, SCRUM-1215 c.17505: 13 hojas, 9 pasan (3 con matiz), 2 no pasan y 2 sin
consumidor. Decisiones del orquestador en el mismo ticket.

- **Firmada y pintada:** `productsView.js · MSG.no_catalog_for_trade`, sin «aún» (c.17507). Pasa a
  `retiradas` del censo 1157.
- **Declarada, SE CONSERVA:** `paidViaEtiquetas.js · ETIQUETAS_HEREDADAS.manual`. Sigue como
  `SIN_COMENTARIO`, pero con su motivo real en el JSON del censo: traduce un valor de dato antiguo y sin
  base no se puede saber si alguna fila lo trae. `paidViaEtiquetas.js` es de J y no se toca.
- **NO se retira:** `quoteActionsRegistry.js · QUOTE_ACTION_ROTULOS.btnBorrar`. No es un rótulo huérfano:
  es una FILA aprobada de la tabla del patrón (13 filas, fijada por scrum421 y scrum984) que describe una
  acción que no existe (ni ruta `DELETE` de presupuesto ni botón). Va a **SCRUM-1273**, sin construir
  hasta decidir el alcance. Queda anotado aquí que **tampoco consta** en `_sin-consumir-declarados.json`
  (SCRUM-1185): el censo 1185 no la ve, porque mira rutas y exports con productor y esta acción no tiene
  ninguno.
- **Carril J, no tocadas:** las tres de `cobrosView.js · COBROS_COPY` (ya firmadas por el asesor,
  `SCRUM-285.md:249/:271`; el censo las lee mal). El orquestador se las pasa a J.
- **Los dos que no pasan son de dinero** y van en tickets propios: **SCRUM-1271** («entregados sin
  facturar» tras una parcial; proyección aditiva de S1) y **SCRUM-1272** («facturados sin cobrar» con
  anulada o con R1; solo pantalla, S2).


## Lote 3 (albarán), marcado de las firmas — S4, 29-sep-2026 (rama `scrum-1215-lote3-albaran-firmados`)

Revisión en Jira c.17493 (corregida en c.17495, fila 3). Firmas del orquestador por delegación del
fundador: c.17494 (6 de 8) y c.17496 (el 3, «Facturar lo entregado»).

- **Marcadas con su firma, en su misma línea** (regla 1 del censo 1157: el comentario de la línea
  gobierna sólo a esa clave), y pasadas a `retiradas` del censo: `btnEmitir`, `btnEnviarFirmar`,
  `btnFirmarAqui`, `btnVerTrabajo`, `btnWhatsApp`, `btnEditarLineas` (c.17494) y `btnFacturar` (c.17496).
  Ni una letra de texto cambia.
- **`btnFoto` («📷 Añadir foto») se QUEDA en `acusadas`.** Se oculta en `firmado` (PR #1947, en `main`), pero
  el texto en borrador y emitido **no tiene firma escrita**: c.17494 dice que ahí «funciona y se queda»,
  que es una decisión de conducta, no un APROBADO del literal. Pedida la firma aparte.
- Pendiente de c.17496, sin construir: proponer un título para la hoja «Facturar parte de ‹número›» que
  no use «parte» en su sentido común.
- Tanda de los ficheros que tocan la vista del albarán o el censo (26 ficheros): 230 · 230 pass.

**Medido contra:** `origin/main` = `8eaee4ac18dc8096cedc8a603aa99b372d0861bb` · 2026-09-29T10:42:39Z

# SCRUM-1215 · lote 1 (parte) — `pistaFirma`: el técnico lee una pista cierta, y la del pad por defecto deja de nombrar al cliente

**Medido contra:** `origin/main` = `d73c5ad9102dc0c5aba8a7ec4ea37ac383db06b0` · 2026-10-02T17:23:44Z
A9: comprobación → `tests/scrum1215c-pista-del-tecnico.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de texto en `public/dashboard/js/parteDetailView.js`, `public/dashboard/js/signaturePad.js` y `public/dashboard/js/albaranDetailView.js`: sin marcado, sin estilos y sin clases nuevas.

2-oct-2026 · **S4** (`s4-2octd`) · rama `scrum-1215-pista-del-tecnico`. Firma: SCRUM-1215 c.18205. Ficha: `docs/microcopy/2026-10-02-SCRUM-1215-pista-del-tecnico.md`.

## Qué había, medido antes de tocar

El defecto que relata la firma (al técnico se le decía «Pide al cliente que firme…») **ya no existía**: lo quitó SCRUM-1229, que le pasa `hint: null` al pad. Visto en yaqu.app el 2-oct-2026 (build `eca8566d130fc35e455b27508b1f3c199dc6263b`, parte 9 de la cuenta QA): el pad del técnico salía **sin pista**. Lo que este cambio aporta es que lea una pista cierta en vez de ninguna.

## Qué cambia

- `TEXTOS.pistaFirmaTecnico` = «Firma con el dedo dentro del recuadro.», y `firmarParte` la pasa cuando firma el técnico.
- `signaturePad.js`: la pista por defecto pasa a ser esa misma frase, que no nombra a nadie. Se toca esa línea y el comentario de encima, que habría quedado diciendo lo contrario. El fichero es de S2 por la fila general de carriles; el cambio lo autorizó el orquestador.
- `albaranDetailView.js`: el albarán **no pasaba pista** y vivía de la del pad por defecto. Cambiar el defecto sin más le habría quitado «Pide al cliente que firme…» sin que nadie lo decidiera. Ahora la pasa él (`PISTA_FIRMA_DEL_CLIENTE`, el mismo literal ya firmado en SCRUM-720).
- `hint: null` sigue siendo «sin pista».

## Verificado, ejecutando

`tests/scrum1215c-pista-del-tecnico.test.mjs`, 5 tests, con el pad de verdad abierto desde las pantallas de verdad.

- **Antes: 2 rojos** (técnico sin pista; la pista por defecto habla del cliente) **y 3 verdes**, los controles.
- **A mitad del cambio**, con el pad y el parte ya cambiados y el albarán sin tocar: el test del albarán cae en rojo. Es el defecto nuevo que el arreglo habría creado.
- **Después: 5 de 5.**

## Lo que NO entra aquí

- `sinLineas` en un parte firmado: **ya estaba** en `main` desde el 28-sep («No se apuntó nada en este apartado.», c.17367, apéndice de más arriba). La firma del c.18205 decía «…en este parte.»; se retiró en el c.18207 porque el texto se pinta por bloque y bajo «Materiales» habría sido falso en un parte con horas.
- `confirmarPropuesta`: sigue esperando al fundador (lo bloquea el clasificador de permisos). No se reintenta.

# SCRUM-1215 · lote 3 (albarán) — la hoja que abre «Facturar lo entregado» se titula como su botón

**Medido contra:** `origin/main` = `39af736efc8ccf7d2966063561421855b3e4c4e9` · 2026-10-06T11:20:13Z
A9: comprobación → `tests/scrum1215d-hoja-facturar-lo-entregado.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Dos literales en `public/dashboard/js/jobDetailView.js` y una regla en `public/dashboard/css/styles.css` (`.modal-close`): sin marcado nuevo, sin clases nuevas, sin tokens nuevos.

6-oct-2026 · **S2** (`s2-6octb`) · rama `scrum-1215-hoja-facturar-lo-entregado`. Firma: SCRUM-1215 c.18283, que aplica a la hoja el literal ya firmado para el botón en c.17496. Ficha: `docs/microcopy/2026-10-06-SCRUM-1215-hoja-facturar-lo-entregado.md`. Cierra lo que el apartado del lote 3 de este registro dejó escrito como «Pendiente de c.17496, sin construir».

## Qué había, medido antes de tocar

`ya-esta 1215` da «YA ESTÁ desde el 2026-09-28», y es cierto para otros lotes: **estos dos literales no estaban hechos.** En `origin/main` la hoja decía «Facturar parte de ‹número›» (título) y «Facturar parte del albarán ‹número›» (`aria-label`).

## Qué cambia

- `openFacturarParcialSheet`: título «Facturar lo entregado · ‹número›» y `aria-label` «Facturar lo entregado del albarán ‹número›». El cuerpo de la hoja y la línea del `apiRequest` no se tocan (SCRUM-386).
- Dos comentarios del mismo fichero que seguían llamando «Facturar parte» a la hoja y a su botón.
- `.modal-close` no encoge (`flex-shrink: 0`) y guarda 8 px con el título. Es la cabecera compartida de todos los modales: ver «Lo que salió al medir».

## El gemelo, buscado

`git grep -i "facturar parte"` sobre `public/` y `src/`, en `origin/main`: 5 líneas. Dos son los literales de arriba. Dos son comentarios de `jobDetailView.js`, corregidos aquí. La quinta es un comentario de `public/dashboard/js/albaranDetailView.js:609`, que es de S4: **no se toca y queda diciendo «Facturar parte»**; no se pinta en ninguna pantalla. No hay ningún otro texto pintado con «Facturar parte». La hoja tiene un solo sitio que la abre (`jobDetailView.js`, la fila del albarán en la ficha del Trabajo).

## Verificado, ejecutando

`tests/scrum1215d-hoja-facturar-lo-entregado.test.mjs`, 4 tests: abre la hoja en el banco y lee lo que queda en `document.body`.

- **Antes: 1 verde** (el suelo: la hoja se abre, se le leen título y `aria-label`, y el botón dice «Facturar lo entregado») **y 3 rojos**.
- **Después: 4 de 4.**
- Vecinos: 28 ficheros (386, 128, 302, 304, 905, 1164, 514, 1157, 1415, 644, 601, 402, los guards del patrón gemelo de 1452) 218 de 218; y los 69 ficheros que nombran la cabecera del modal o `styles.css`, 666 de 666. La dirigida completa son 471 ficheros: no se lanza en local, la juzga el CI.

## Lo que salió al medir

Banco local en Chromium (sin red), con `tokens.css` + `styles.css` y la cabecera de verdad (`modalHeader.js`), a 320, 390 y 1280 px; mide el texto pintado (`Range`), no la caja. Control positivo: un título sin espacios **se sale** del modal en los tres anchos, y la sonda lo dice.

| ancho | título | líneas | ✕ antes del arreglo | ✕ después |
| --- | --- | --- | --- | --- |
| 320 | Facturar parte de AB260011 (el viejo) | 1 | 30 px | 30 px |
| 320 | Facturar lo entregado · AB260011 | 2 | **26 px** | 30 px |
| 320 | Facturar lo entregado · ALB-2026-000123 | 2 | **22 px** | 30 px |
| 390 | Facturar lo entregado · AB260011 | 1 | 30 px | 30 px |
| 390 | Facturar lo entregado · ALB-2026-000123 | 2 | **28 px** | 30 px |
| 1280 | los tres | 1 | 29 px | 29 px |

El título nuevo no se sale ni pisa la ✕ en ningún ancho. A 320 px parte en dos líneas, y al partir **encogía el botón de cerrar**: el defecto es de la cabecera compartida y ya estaba ahí para cualquier título largo; el texto nuevo lo destapa en esta hoja, así que se arregla con él.

## Lo que NO se ha podido mirar

- **No visto en yaqu.app.** La cuenta QA está caducada desde el 3-oct y además no tiene ningún albarán valorado, firmado y con algo pendiente, que es lo que hace salir el botón.
- El arreglo de `.modal-close` se ha medido en esta cabecera con cuatro títulos. **No se han recorrido los demás modales del panel uno a uno**; la regla `.modal-ayuda + .modal-close` (SCRUM-416) sigue ganando donde hay «?».
- El botón de cerrar mide 30 px, por debajo de los 44 de DESIGN.md. Ya era así y no se toca aquí.

## Lo que NO entra aquí

`confirmarPropuesta` y el lote 2 (libro registro): el ticket sigue abierto por ellos (c.18283).

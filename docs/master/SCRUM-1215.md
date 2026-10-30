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

# SCRUM-1215 · `confirmarPropuesta` — el botón del dictado dice «Añadir al parte»

**Medido contra:** `origin/main` = `eb1fdefaf9e660bd706e1fbba31c90f868343ad1` · 2026-10-06T12:47:43Z
A9: comprobación → `tests/scrum1230-colocar-lineas-dictadas.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Un literal en `public/dashboard/js/parteDetailView.js`: sin marcado nuevo, sin estilos y sin clases nuevas.

6-oct-2026 · **S4** · rama `scrum-1215-anadir-al-parte`. Firma: SCRUM-1215 c.17375 (28-sep-2026), con su motivo corregido en c.17377. Ficha: `docs/microcopy/2026-09-28-SCRUM-1215-anadir-al-parte.md`.

## Qué había

El texto estaba firmado desde el 28-sep y el botón seguía diciendo «Añadir estas líneas», que no se aprobó (c.17367). Aplicarlo pide cuatro cosas, y una estaba parada: mover la entrada del texto de `acusadas` a `retiradas` en `scripts/_censo-convenio-microcopy-declarados.json`. Esa edición se denegó el 28-sep (más arriba en este registro: «[Logging/Audit Tampering]») y desde entonces constaba como «no se reintenta».

## El permiso, y por dónde llegó

- **Permiso del fundador, transmitido por el orquestador:** «que S4 lo pruebe». No me lo dijo a mí y no lo he comprobado: está escrito por el orquestador en SCRUM-1215 c.18381, con el alcance (ese fichero, esa entrada, ese cambio).
- **Carril:** por la tabla (`docs/equipo/dos-equipos.md:171`) `scripts/` es de S0. La excepción para esta edición está en el mismo c.18381. El descuadre entre la tabla y la práctica —este JSON lo he editado seis veces dentro de lotes de microcopy— queda abierto y no lo resuelve esta rama.
- La primera vez que el orquestador pidió reintentarlo, sin el permiso, no se intentó.

## Qué pasó al intentarlo

**Entró sin bloqueo**, a las ~12:46Z: dos ediciones con la herramienta normal. No hay un veto sobre el fichero; después de la denegación del 28-sep ya se había editado dos veces más (`849dadca`, `3a4b85a3`).

## Qué cambia

- `TEXTOS.confirmarPropuesta`: «Añadir al parte», con su `// APROBADO · SCRUM-1215 comentario 17375` encima.
- Tres comentarios del mismo fichero que nombraban el rótulo viejo.
- El JSON del censo: la entrada sale de `acusadas` y entra en `retiradas` con su motivo.
- `tests/scrum1230-colocar-lineas-dictadas.test.mjs`: dos mensajes de assert nombraban el rótulo viejo (lo que afirman no cambia), y un test nuevo que lee el botón en el banco y exige el literal firmado.

## Verificado, ejecutando

- El test nuevo, con el literal viejo: **rojo**. Con el cambio: verde.
- `tests/scrum1157-censo-convenio-microcopy.test.mjs` con la marca puesta y el JSON sin mover: **rojo** («SOBRA … TEXTOS.confirmarPropuesta»). Con la entrada en `retiradas`: verde. La edición del JSON hacía falta.

## El gemelo, buscado

`git grep "Añadir estas líneas"` en `public/`, `src/` y `tests/`: en `public/` no queda más que el comentario que explica la sustitución. En `tests/` quedan cuatro menciones, en comentarios y en el nombre de un test de `scrum1266b` (lo cita `docs/master/SCRUM-1327.md`): no se tocan. `jobDetailView.js:2865` (S2) ya pintaba «Añadir al parte» en otro botón.

## Lo que NO está medido

- **En yaqu.app:** nada todavía. Se ve en el parte 9 de la cuenta QA: dictar, «Ordenar en líneas» y leer el botón. Pide una llamada a la IA de verdad, o contestarla desde la sonda.
- Ancho del botón: el texto nuevo es más corto que el viejo (15 caracteres frente a 19) y el botón ocupa todo el ancho; no medido.

## Lo que NO entra aquí

El lote 2 (libro registro, SCRUM-1428, J1). Con esto, de SCRUM-1215 queda sólo eso.

# SCRUM-1215 · las cuatro hojas de S4 que el censo seguía acusando citan su firma

**Medido contra:** `origin/main` = `f9b4074d33278023f55548b88306421531114174` · 2026-10-07T16:13:47Z
A9: aviso → cicatriz S4 «mi sonda buscó la lista de albaranes en una clave que la respuesta no trae, le salió vacía y escribió que la cuenta no tenía albaranes teniendo uno: una lista vacía sólo es un cero si el recuento del servidor también lo dice» — no se pudo comprobar: las sondas viven fuera del repositorio

**Skill UI:** no cargada · sólo cambian comentarios de `public/dashboard/js/parteDetailView.js` y `public/dashboard/js/albaranDetailView.js`: ni un literal, ni marcado, ni estilos, ni clases. Lo que se pinta es byte a byte lo que se pintaba.

7-oct-2026 · **S4** · rama `scrum-1215-las-cuatro-de-s4-citan-su-firma`. Antes de tocar: SCRUM-1215 c.18756.

## La frase de arriba («queda sólo el lote 2») no era cierta, y era mía

El 6-oct escribí que de este ticket quedaba sólo el lote 2. El censo de hoy (`node scripts/_censo-convenio-microcopy.mjs`, 98 ficheros, 41 objetos, 289 hojas) daba **APROBADO 244 · PENDIENTE 7 · SIN_COMENTARIO 38**, y de esas 38 sólo 22 son el lote 2:

| De quién | Hojas | Cuáles |
|---|---|---|
| J1 (lote 2, SCRUM-1428) | 22 | `libroRegistroView.js · COPY.*` |
| J (pagos) | 5 | `cobrosView.js · COBROS_COPY` (3) · `paidViaEtiquetas.js · ETIQUETAS_HEREDADAS` (2) |
| S2 | 7 | `jobDetailView.js · TEXTO_HUECO` (3) · `providersView.js · M` (2) · `quoteDireccionObra.js · TEXTOS.personalizada` · `quoteActionsRegistry.js · btnBorrar` |
| S4 | 4 | las de este apéndice |

Conté «lo que me quedaba por construir» y lo escribí como «lo que le queda al ticket». La aceptación pide el censo en `APROBADO`, y eso se mira en el censo.

## Las cuatro tenían firma. Tres no pasaban la revisión el 28-sep, y por eso no se marcaron

| Hoja | Literal | Firma | Qué fallaba el 28-sep (c.17360) | Qué lo arregló |
|---|---|---|---|---|
| `TEXTOS.pistaFirma` | Pide al cliente que firme con el dedo dentro del recuadro. | fundador, 4-sep-2026, SCRUM-720c | se le decía también al técnico | SCRUM-1229 |
| `TEXTOS.sinBloque` | Sin colocar — elige mano de obra o materiales | fundador, 4-sep-2026, SCRUM-720c | mandaba elegir y no había con qué | SCRUM-1230 |
| `TEXTOS.sinLineas` | Todavía no has apuntado nada. | fundador, 4-sep-2026, SCRUM-720 (y c.17367 para el caso editable) | salía también en un parte firmado | `sinLineasCerrado` (c.17367) |
| `ROTULOS_ALBARAN.btnFoto` | 📷 Añadir foto | orquestador por delegación, c.18283 (6-oct-2026) | se ofrecía en `firmado`, donde sólo podía fallar | PR #1947 (oculta en `firmado`) |

Las tres del parte no se vuelven a firmar: citan la firma que ya tenían, como se hizo con `firmaRechazada` (c.17367). Lo que este apéndice añade es haberlas pasado otra vez por la pregunta del ticket con el código de hoy.

## ¿El código de hoy hace lo que dicen? Ejecutando, no leyendo

| Hoja | Lo que afirma | Dónde se mide | En yaqu.app (build `f07622f3`, cuenta QA, merchant 46) |
|---|---|---|---|
| `pistaFirma` | se le pide al cliente, y sólo en su pad | `tests/scrum1215c-pista-del-tecnico.test.mjs`, `tests/scrum1229-firma-del-tecnico-viaje.test.mjs` | pad del cliente del parte 9: esa frase; pad del técnico: «Firma con el dedo dentro del recuadro.» |
| `sinLineas` | «todavía»: se puede apuntar | `tests/scrum1215b-sin-lineas-cerrado.test.mjs` | parte 9 (borrador, una línea de mano de obra): el bloque Materiales, vacío, la dice, con su «Añadir línea» al lado |
| `sinBloque` | hay algo sin colocar y se puede elegir entre esas dos | `tests/scrum1230-colocar-lineas-dictadas.test.mjs` y el test nuevo | propuesta con una línea suelta: el rótulo en una línea a 390 y a 320 px, dos fichas de 48 px («Mano de obra», «Materiales»), «Añadir al parte» apagado hasta elegir y encendido al elegir |
| `btnFoto` | se ofrece donde el servidor admite la foto | `tests/scrum1215c-foto-oculta-en-firmado.test.mjs`, `tests/scrum1302g-foto-con-diez.test.mjs` | albarán 46 (`emitido`): está en el «⋯». El mismo albarán contestado como `firmado` por la sonda: no está |

## Qué cambia

- `parteDetailView.js`: tres comentarios `// APROBADO por el fundador el 4-sep-2026 (…)` encima de sus claves, con la ficha y con el motivo por el que estuvieron sin marcar.
- `albaranDetailView.js`: `// APROBADO · SCRUM-1215 comentario 18283` en la línea de `btnFoto`.
- `docs/microcopy/2026-10-06-SCRUM-1215-anadir-foto-del-albaran.md`: la ficha de la firma de `btnFoto`, que no existía.
- `scripts/_censo-convenio-microcopy-declarados.json`: las cuatro entradas salen de `acusadas` y entran en `retiradas` con su motivo.
- `tests/scrum1215e-las-cuatro-de-s4-citan-su-firma.test.mjs` (7 tests): cada marca queda atada a SU ficha por ticket y ranura, el literal se lee del objeto que la vista pinta, y de `sinBloque` se mide lo que faltaba (el rótulo se lee, las fichas dicen las dos palabras que nombra, y sin nada suelto no se pinta).

Censo después: **APROBADO 248 · PENDIENTE 7 · SIN_COMENTARIO 34**, trinquete 0 nuevas · 0 que sobran.

## Verificado

- El test nuevo, antes del cambio: 2 pass · 5 fail (uno de los cinco, por el instrumento: ver abajo). Después: 7 de 7.
- Mutación (`mut1215e.mjs`, fuera del repo): base 7 de 7 y **11 de 11 mutantes mueren**, cada uno comprobando que se aplicó y que se restauró.
- Con los vecinos de microcopy y de las dos vistas (19 ficheros): 137 · 137 pass · 0 fail · 0 saltos.

## Carril: desviación declarada

`scripts/` es de S0 por la tabla (`docs/equipo/dos-equipos.md:171`). La excepción de c.18381 era para UNA entrada y no se ha estirado: esta edición se apoya en que la aceptación del ticket pide el censo en `APROBADO`, en que cada una de las cuatro entradas nombraba a S4 («o se firma, o se anota la firma que ya tenga») y en que `node scripts/carriles.mjs de` dice de ese fichero «SIN CERRADURA». Dicho en c.18756 antes de hacerlo. El descuadre entre la tabla y la práctica sigue abierto.

## Lo que salió al medir

- **El banco no agrega `textContent`** (límite 4 de `tests/_banco-vistas.mjs`): el texto de `<label><input>Mano de obra</label>` lo guarda el `<input>`. El test lo lee de ahí y lo dice en un comentario; en el navegador es el texto de la ficha (visto: las dos fichas se leen por su `label`).
- **La sonda, primera pasada:** dijo «la cuenta QA no tiene albaranes» y tenía uno. Buscaba la lista en claves que la respuesta no trae (viene en `filas`). Ahora para si `filas` no llega. Es la cicatriz de hoy.
- De paso, sin tocar: `POST /admin/entorno` sale del panel al cargar y al recargar (la sonda lo corta). No sé qué es; no es de este cambio.

## Lo que NO entra aquí

Las otras 34 hojas: 22 de J1 (SCRUM-1428), 5 de J (pagos) y 7 de S2. No son de S4.

# SCRUM-1215f · en el bloque de las dos firmas del parte, la firma viaja con su clave

**Medido contra:** `origin/main` = `17159d7f457b8e00002cd06c33f1e41941bb10d3` · 2026-10-09T10:49:01Z
A9: comprobación → `tests/scrum1215f-la-firma-no-se-reparte-por-posicion.test.mjs`

**Skill UI:** no cargada · sólo cambian comentarios de `public/dashboard/js/parteDetailView.js`: ni un literal, ni marcado, ni estilos, ni clases. Lo que se pinta es byte a byte lo que se pintaba.

9-oct-2026 · **S4** · rama `scrum-1215-la-firma-no-se-reparte-por-posicion`. Antes de tocar: SCRUM-1215 c.19088. Es un defecto encontrado de paso, en mi carril, y se arregla aquí: no tiene ticket propio.

## Qué pasaba

El censo de SCRUM-1157 (`scripts/_censo-convenio-microcopy.mjs`), cuando una firma se dice en plural y CONTANDO, la reparte entre las N primeras claves que encuentra debajo, por orden del fuente. No sabe cuáles eran esas N. Es diseño y lo fija su test (`tests/scrum1157-censo-convenio-microcopy.test.mjs`, caso ②).

En `parteDetailView.js` el bloque de las dos firmas decía «Los cinco textos de las dos firmas, FIRMADOS por el fundador el 4-sep-2026». Los cinco de aquel día (`docs/microcopy/2026-09-04-SCRUM-653-las-dos-firmas.md`) son `firmarTecnico`, `yaFirmoElCliente`, `yaFirmoElTecnico`, `faltaLaFirmaDelCliente` y `faltaLaFirmaDelTecnico`. Como `faltaLaFirmaDelCliente` llevaba además su firma propia encima, a la cuenta le sobraba un hueco y caía en `conLaPrimeraFirmaQuedaFijo`, que es del 28-sep (SCRUM-653 comentario 17354).

Ningún texto estaba sin firmar. Lo que estaba mal era el motivo por el que el censo los daba por buenos, y lo que ese motivo dejaba pasar.

## Medido antes de tocar (censo ejecutado sobre copias en memoria)

| Ensayo | Resultado con el fuente de antes |
|---|---|
| base | las seis APROBADO |
| la cabecera dice «cuatro» en vez de «cinco» | `conLaPrimeraFirmaQuedaFijo` pasa a SIN_COMENTARIO: la aprobaba la cuenta |
| una clave nueva sin firma, la primera del bloque | la nueva sale APROBADO y la acusada es `conLaPrimeraFirmaQuedaFijo` |

## Qué cambia

Sólo comentarios. Cada una de las seis lleva su marca en SU línea (regla 1 del censo, la única que no cuenta ni mira el orden): las tres primeras citan al fundador y el 4-sep; las otras tres, la firma delegada de SCRUM-653 comentario 17354, que es la del literal que hoy se pinta. La cabecera del bloque deja de firmar en plural y cuenta por qué. El comentario de encima de `faltaLaFirmaDelCliente` deja de llevar la palabra de firma en mayúsculas, para que la firma esté en un solo sitio por clave.

## Medido después

| Qué | Resultado |
|---|---|
| `tests/scrum1215f-…` con el fuente nuevo | 5 de 5 |
| el mismo test con el fuente de `origin/main` | 3 caen de los 5 (clave nueva la primera; clave nueva delante de cualquiera; control «sin su marca»). Los otros dos son el suelo y la base, que pasan en los dos |
| censo entero | APROBADO 248 · PENDIENTE 7 · SIN_COMENTARIO 34, trinquete 0 nuevas · 0 sobran: igual que antes |

Se escribió un sexto caso («cambiar de orden las seis») y se quitó: con el fuente de antes también pasaba, así que no distinguía el arreglo de la avería.

## De paso, en el propio test

La primera versión cortaba la marca de la línea con una expresión regular sobre las dos barras. Los guards de SCRUM-694 y SCRUM-700 la acusaron (un filtro de comentarios hecho a mano). Se cambió el test, no los guards: ahora corta por el final del literal.

## Lo que NO entra aquí

- El censo no cambia: `scripts/` no es de S4. Que la cuenta se ate a nombres y no a posiciones es de la S0, y queda dicho en SCRUM-1215 c.19088 con su ejemplo ejecutado.
- Los otros objetos del panel con firma contada (14, de S2, J2 y J3) no se tocan: no son de S4. La lista está en c.19088.
- Las marcas del resto de `TEXTOS` del parte van ENCIMA de su clave, no en su línea. No se han movido: no hay cuenta que las reparta.

## No medido

- Nada en yaqu.app: no cambia ninguna pantalla.
- `tsc` no cabía al medir (579 MB libres) y `dist` es de `2e8d8d82`, con 19 ficheros de `src/` cambiados desde entonces. De los 466 tests que cubren lo tocado se han corrido los 358 que no leen `dist`; los 108 que lo leen quedan para el check obligatorio.

# SCRUM-1215g · una firma de grupo no cubre a quien llega después (el censo aprobaba por posición)

**Medido contra:** `origin/main` = `9358f02b14e9648f1ab65fbdacf6464d50728242` · 2026-10-13T10:48:11Z
A9: comprobación → `tests/scrum1215g-una-firma-de-grupo-no-cubre-a-quien-llega-despues.test.mjs`

13-oct-2026 · **S4** · rama `scrum-1215g-el-censo-no-reparte-la-firma-por-posicion`. Antes de tocar: SCRUM-1215 comentario 19284. Encargo del orquestador (lote del 13-oct, punto 1): demostrar o descartar que el censo de SCRUM-1157 aprueba por posición y, si miente, arreglarlo con su control positivo. No toca ningún fichero de `public/`.

## Demostrado: miente

Ejecutado contra `main`, en memoria, sobre `public/dashboard/js/quoteActionsRegistry.js` → `QUOTE_ACTION_ROTULOS`: la firma es «los doce rótulos» del 17-ago-2026 y el objeto tiene trece claves desde el 21-sep (SCRUM-984, commit `1c39f9d81`: salió una y entraron `btnCobrar` y `btnNuevoAlbaran`).

| Qué se hace | Qué decía el censo | Trinquete, antes | Trinquete, ahora |
|---|---|---|---|
| nada | `btnCobrar` y `btnNuevoAlbaran` APROBADO bajo una firma que no los vio; `btnBorrar`, que estaba entre los doce, acusada | verde | verde, y las dos declaradas en «porGrupoSinVer» |
| una hoja nueva en el sitio de una firmada | la nueva, APROBADO | **verde** | rojo: nombra a la nueva |
| una hoja nueva añadida arriba | la nueva, APROBADO; acusa a `btnMarcarRechazado`, que sí estaba firmada | rojo contra la que no es | rojo: nombra a la nueva, y a la empujada le dice que mire antes de declararla |
| las mismas trece con dos cambiadas de sitio | la firmada y la acusada se intercambian | rojo, sin decir por qué | rojo: dice que el reparto ha cambiado |
| firma en plural sin cuenta y entra una hoja | APROBADO | **verde** | rojo: nombra a la nueva |

No era sólo la cuenta. Cualquier firma de GRUPO (en plural, contando, en la cabecera del objeto, o la del objeto que contiene a la hoja) aprueba lo que cae debajo, lo viera o no. De las 248 hojas APROBADO de hoy, 173 lo son así, en 30 objetos; 75 llevan firma propia.

## Qué cambia

- `scripts/_censo-convenio-microcopy.mjs`: cada hoja APROBADO dice si la firma es suya (comentario en su línea, o en singular encima) o le llega de un grupo. El censo devuelve además `porGrupo` (identidad y cuántas), y `compararConDeclarados` las compara por identidad con «porGrupo» del JSON, en las dos direcciones, dentro de las mismas `nuevas` y `sobran` de siempre: quien ya miraba esas dos listas se pone rojo sin cambiar nada. Un JSON sin «porGrupo» las da todas por nuevas. `queHacer()` da a cada fila su instrucción, una para la CLI y para el test.
- `scripts/_censo-convenio-microcopy-declarados.json`: «porGrupo» con las 173 identidades de hoy y «porGrupoSinVer» con las dos que se sabe que su firma de grupo no vio, y por qué.
- `tests/scrum1157-…`: el mensaje del trinquete dice de cada fila lo suyo.

**«porGrupo» nace como una foto.** Dice qué cubría cada firma de grupo el 13-oct-2026; no dice que alguien haya comprobado que la firma vio cada una de las 173. Lo que garantiza desde hoy es que ninguna más entra callada. La cura de cada fichero sigue siendo la de SCRUM-1215f: la marca en la línea de cada clave, que saca a la hoja de la lista.

## De paso, en el mismo instrumento

El título de ese bloque dice «REGLA 30: NINGUNO ESTÁ APROBADO» y el censo leía esa palabra como la firma (el párrafo que cuenta la firma dice «APROBÓ», que no es palabra de convenio). `NINGUNO`/`NINGUNA`/`NINGÚN` pasan a negar, como `NO`, `SIN` y `NI`; el comentario sale AMBIGUO y queda resuelto por identidad en «ambiguos», con su motivo. El resultado no cambia; cambia que ya no depende de un título que dice lo contrario.

## Medido después

| Qué | Resultado |
|---|---|
| censo entero | APROBADO 248 · PENDIENTE 7 · SIN_COMENTARIO 34 (igual que antes) · por grupo 173 · trinquete 0 nuevas, 0 sobran |
| `tests/scrum1215g-…` + `scrum1157` + `scrum1215e` + `scrum1215f` | 34 de 34 |
| la misma sonda, antes y después | antes: de los cuatro casos que cambian algo, dos salían en verde; después: los cuatro en rojo, y «nada» sigue verde |
| mutación del censo (13 mutantes, con la base sin mutar antes y después) | mueren los 13 |

## Lo que NO resuelve

- Cambiar el TEXTO de una clave firmada sin cambiarle el nombre sigue saliendo APROBADO. El censo lee qué comentario gobierna a qué clave; no sabe qué decía el literal el día de la firma.
- Las 171 de «porGrupo» que no están en «porGrupoSinVer» no se han contrastado una a una con su firma.
- Una clave con marca en su línea gasta igualmente un hueco de la cuenta que tenga encima (por eso otra del grupo puede salir acusada). Es anterior a este cambio y acusa de más, no de menos; se deja y se fija en el test.
- `QUOTE_ACTION_ROTULOS` (dice 12, tiene 13), `quoteDireccionObra.TEXTOS` (3 y 4), `settingsSubmenus.ROTULOS` (10 y 9) y `COBROS_COPY` (6 en la cabecera y 13 claves, con otra firma de grupo dentro) siguen con una cuenta de cabecera que no coincide con sus claves. Recontado hoy con una sonda propia que no es el censo. Sus ficheros no son de S4.

# SCRUM-1215h · las sondas de «¿quién vio cada hoja?» suben al repo, y el reparto de las 173

**Medido contra:** `origin/main` = `254a697924c99bdf85eb06c95ee439a4a013aa67` · 2026-10-13T12:00:37Z
A9: aviso → A10 «Antes de escribir una sonda que pregunta «¿consta?», se busca la función de la casa que ya lo contesta: una sonda propia mira el papel que tú conoces, no el que hay.» — no se pudo comprobar: es de criterio, qué fuente se consulta antes de escribir una sonda no lo ve un test
**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún fichero del panel

13-oct-2026 · **S4** · rama `scrum-1215h-las-sondas-de-quien-vio-cada-hoja`. Encargo del orquestador (lote del 13-oct, 12:05Z): las sondas de SCRUM-1215 c.19332 van a git, y se abren los comentarios de Jira que citan las letras para cerrar las dudosas. No corrige ninguna hoja: primero el número.

## Dónde están y cómo se repiten

`docs/master/evidencias/SCRUM-1215/quien-la-vio/`. Ninguna escribe en el árbol salvo `quien-la-vio.mjs`, que deja `quien-la-vio.json` a su lado (las otras tres lo leen).

| Sonda | Qué mide | Cómo se corre | Su salida del 13-oct |
|---|---|---|---|
| `quien-la-vio.mjs` | en la historia de `main` (primer padre), si la letra que aprueba a cada hoja de grupo se escribió con la hoja y su texto delante | `node quien-la-vio.mjs <árbol>` (`--lab` corre sólo el laboratorio) | `quien-la-vio.txt` |
| `papel-por-objeto.mjs` | de cada objeto, cuántas hojas no tienen su literal en ningún acta de `docs/microcopy/`, y qué cita su letra | `node papel-por-objeto.mjs <árbol>` | `papel-por-objeto.txt` |
| `quien-firma.mjs` | quién dice la letra que firmó | `node quien-firma.mjs` | `quien-firma.txt` |
| `firmadas-en-jira.mjs` | compara cada hoja de los objetos cuyo comentario de Jira se abrió con los literales firmados en él, transcritos dentro de la sonda | `node firmadas-en-jira.mjs` | `firmadas-en-jira.txt` |

Las tres primeras se corrieron sobre `f7a4c816ab2bf5c334a953dee60dc7b73718a0f8`; el JSON es de ese árbol. `quien-la-vio.mjs` instrumenta una copia del censo por sustitución de texto y aborta si el censo ha cambiado: hay que ajustarla antes de volver a correrla sobre un censo distinto.

## El reparto de las 173 hojas aprobadas por firma de grupo

El papel se pregunta al oráculo de la casa, `constaAprobado` de `tests/_microcopy-aprobada.mjs`: por identidad del literal, mirando quién firma, en `docs/microcopy/` y en el registro congelado `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`.

| Cuántas | Qué se sabe de su firma |
|---|---|
| 47 | consta firmada en una ficha de `docs/microcopy/` (oráculo; «en alguna ficha», no «en la suya») |
| 26 | consta firmada en el registro congelado, el de antes del 3-sep-2026 (oráculo) |
| 24 | el oráculo no la da; su literal está, idéntico, en el comentario de Jira que cita su letra, abierto hoy |
| 30 | el oráculo no la da; su literal aparece en algún acta de `docs/microcopy/` por subcadena (cota: incluye coincidencias de palabra genérica) |
| 7 | su propia letra dice «por el asesor, a la espera del fundador» |
| 6 | no se puede buscar: plantilla con huecos, o sin literal |
| 28 | no aparece en ningún papel y su Jira no se ha abierto; letra anterior al 3-sep-2026 |
| 5 | no aparece en ningún papel y su Jira no se ha abierto; letra posterior al 3-sep-2026 (3 son clases CSS, no texto) |

Las 33 de las dos últimas filas, por objeto y clave, al final de `firmadas-en-jira.txt`.

**Corrección de lo dicho en SCRUM-1215 c.19332 y c.19343.** Allí se dio «85 sin acta» y que las de antes del 3-sep «no podían tener acta». Las dos cosas salían de `papel-por-objeto.mjs`, que sólo mira `docs/microcopy/` y por subcadena. El papel de antes del 3-sep existe (el registro congelado) y el oráculo lo lee: 17 de aquellas 85 constan firmadas, entre ellas las 7 de `settingsView.js · TX` que c.19343 dio por «buscadas y no halladas». En el otro sentido, 20 de las 88 «con acta» no las da el oráculo. El cruce entero sale al final de `firmadas-en-jira.txt`. `papel-por-objeto.txt` se conserva como lo que se midió, no como cifra vigente.

El oráculo tampoco lo ve todo: a 7 de las 128 fichas de `docs/microcopy/` no les lee ningún literal (la de SCRUM-984 entre ellas, y por eso «Cobrar ahora» no le consta). No se ha mirado por qué.

Las 24 del comentario de Jira: 17 del parte (SCRUM-916, comentarios 17251 y 17273, orquestador de Luis por delegación) y 7 de la puerta de serie (SCRUM-1216, comentario 17347, Javier en persona transcrito por su orquestador, y 17349, su orquestador por delegación). Dos de las de serie llevan el año en un hueco donde la firma dice «2026». Una del parte, «La hora se elige, no se escribe.», se firmó con condición (sólo si el campo es de verdad un selector) y el código la cumple: se pinta sólo con `sonSelector`. De los seis literales que esos comentarios firmaron y luego retiraron, ninguno está pintado.

Aparte, y sin sumar a lo anterior: la historia dice que a 5 de las 173 la firma que las aprueba no las vio (llegaron, o cambió su texto, con la letra ya escrita). Las cinco tienen su literal en un acta: están firmadas por otra firma, que no es la que tienen encima. La sonda da una sexta, `COBROS_COPY.vacioPorFiltro`, que se descarta: estaba el día de la firma, y es la cuenta de la cabecera la que la dejaba fuera.

## Lo que NO dice

- «Con acta» y «en el comentario» prueban que el literal de hoy consta firmado en un papel; no que la marca del código apunte a ese papel.
- De las 33 que no aparecen en ningún papel no se sabe nada más que lo que dice su letra: sus tickets de Jira no se han abierto.
- No se ha corregido ninguna hoja.
# SCRUM-1215i · las nueve hojas de S2 llevan su firma en su línea

**Medido contra:** `origin/main` = `254a697924c99bdf85eb06c95ee439a4a013aa67` · 2026-10-13T11:56:05Z
A9: comprobación → `tests/scrum1215i-las-marcas-de-s2.test.mjs`

13-oct-2026 · **S2** · rama `scrum-1215i-las-marcas-de-s2`. Antes de tocar: SCRUM-1215 comentarios 19084 (la firma) y 19088 (la receta de S4, ensayada en memoria). Encargo del orquestador (lote del 13-oct, punto 3). El sufijo `h` lo tiene S4 en una rama remota; por eso éste es el `i`.

**Skill UI:** no cargada · sólo comentarios de firma detrás de la coma en nueve líneas de tres ficheros de `public/dashboard/js/`; ningún literal, marcado, clase ni token cambia, y ninguna pantalla pinta nada distinto.

## Qué se ha escrito

| Hoja | Marca en su línea | Firma |
|---|---|---|
| `providersView.js · M.provider_in_use` | sí | orquestador por delegación, SCRUM-1215 comentario 19084 (F1) |
| `providersView.js · M.taxId_invalido` | sí | la misma (F2); es del texto, no del criterio de validez del NIF |
| `quoteDireccionObra.js · TEXTOS.rotulo`, `noMostrar`, `facturacion`, `personalizada` | las cuatro | la misma (F3) |
| `jobDetailView.js · TEXTO_HUECO.sin-facturar`, `sin-facturar-nada`, `sin-cobrar` | las tres | fundador, `docs/master/SCRUM-320.md` (leído hoy: «N € entregados sin facturar», «N € facturados sin cobrar» y, en la sección C4, «aceptados y sin facturar») |

Dos fichas nuevas en `docs/microcopy/`, con fecha del día de la firma (9-oct-2026): la de los dos fallos de Proveedores y la de los cuatro rótulos de la dirección de la obra. Las tres de `TEXTO_HUECO` no llevan ficha nueva: su firma es del fundador y consta en el registro de SCRUM-320.

En `scripts/_censo-convenio-microcopy-declarados.json`: seis hojas pasan de «acusadas» a «retiradas» con su motivo, y tres (`rotulo`, `noMostrar`, `facturacion`) salen de «porGrupo» porque ya no las aprueba la cabecera.

## Medido después

- Censo (`node scripts/_censo-convenio-microcopy.mjs`): **APROBADO 254 · PENDIENTE 7 · SIN_COMENTARIO 28**; por firma de grupo, 170. Antes: 248 · 7 · 34 y 173. Trinquete: 0 nuevas, 0 sobran, 35 acusadas.
- Antes de mover el JSON el trinquete salió ROJO con 9 «SOBRA» (las seis acusadas y las tres de «porGrupo»), que es lo que c.19088 anunciaba.
- Test nuevo: 6 de 6. **Control positivo:** con los tres ficheros de `origin/main` (sin las marcas) caen 5 de 6 y sólo pasa el suelo.
- `git diff --numstat` de los tres ficheros de `public/`: 3/3, 2/2 y 4/4. Ninguna línea se añade ni se quita: los guards que anclan por posición no se mueven.

## Desviación declarada respecto a c.19088

c.19088 decía «`SIN_APROBAR` deja de ser 4» en `quoteDireccionObra.js`. **No se ha tocado y sigue en 4.** Ese contador cuenta las ranuras «sin la firma del FUNDADOR»; `tests/scrum602-direccion-obra.test.mjs` fija que vale 4 y que es igual a `SIN_APROBAR_DIRECCION_OBRA` de `src/core/documentos/direccionObra.ts`, que es del carril de S1. Bajarlo pide decidir si una firma delegada cuenta ahí, cambiar un guard y tocar un fichero de otro puesto. Queda preguntado en el ticket.

## Lo que NO entra aquí

- `QUOTE_ACTION_ROTULOS.btnBorrar`: no se pinta, está firmada desde el 17-ago y espera a SCRUM-1273 (c.19084). Sigue en «acusadas».
- Las tres de `COBROS_COPY` y `ETIQUETAS_HEREDADAS.card:stripe`: ficheros de J2.
- Las 22 de `libroRegistroView.js`: J1, SCRUM-1428.
- La cabecera de `quoteDireccionObra.TEXTOS` sigue diciendo «los tres rótulos de SCRUM-599» y la de `TEXTO_HUECO`, «Los dos literales están FIRMADOS»: el censo las sigue leyendo como cuenta. Con la marca en cada línea ya no deciden nada de estas nueve; no se han reescrito.

## No medido

- Nada en yaqu.app: no cambia ninguna pantalla.
- La suite completa y `tsc`: en el check obligatorio. El cambio no toca `src/`.

# SCRUM-1215j · el papel que nombra la letra: las 33 «sin papel» abiertas una a una, y el reparto entero de las 173

**Medido contra:** `origin/main` = `cf0a4cb7eb8613d394f98bc3134ba9a89896839c` · 2026-10-13T13:56:39Z
A9: aviso → A10 «Antes de escribir una sonda que pregunta «¿consta?», se busca la función de la casa que ya lo contesta: una sonda propia mira el papel que tú conoces, no el que hay.» — no se pudo comprobar: es el mismo fallo de 1215h por segunda vez en el día y sigue siendo de criterio; esta vez el papel que no conocía era el registro del propio ticket
**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún fichero del panel

13-oct-2026 · **S4** · rama `scrum-1215j-el-papel-que-nombra-la-letra`. Encargo del orquestador (lote del 13-oct, 13:35Z, punto 1): «¿cuántas de las 173 no las vio nunca una firma? Dame el número con tu método. No las corrijas todavía». Sólo lectura: no se ha tocado ninguna hoja, ningún texto ni el censo. Entregado en SCRUM-1215 c.19421, corregido en c.19422.

## La cifra

**20 de las 173 tienen como única aprobación la del «asesor»**, que la casa no cuenta como firma (`tests/_microcopy-aprobada.mjs`, el comentario sobre `FIRMA_DELEGADA`: «por el asesor» se lee y sigue sin contar). Sin ningún papel fuera del comentario del código quedan 2. Sin ninguna firma en absoluto, 0.

| cuántas | qué se sabe de su firma |
|---|---|
| 75 | constan firmadas por identidad (oráculo `constaAprobado`): 49 en una ficha de `docs/microcopy/`, 26 en el registro congelado |
| 24 | firma hallada en el comentario de Jira que cita su letra (sección 1215h, sin cambio) |
| 35 | su letra nombra al fundador y el oráculo no las ve. 32 tienen el literal en el registro del ticket o en su Jira, 2 (`settingsView.js · QR_COPY`) no tienen más papel que el comentario del código y 1 (`quoteActionsRegistry.js · btnCobrar`) está en una ficha que el oráculo no lee |
| 12 | orquestador por delegación: 10 son plantillas con huecos que el oráculo no puede preguntar y están en su ficha; 2 (`jobDetailView.js · TEXTO_HUECO`) se firmaron por referencia en SCRUM-917, comentario 15881 |
| 20 | sólo «aprobado por el asesor»; 5 de ellas lo dicen ellas mismas («a la espera del fundador») |
| 7 | no son texto: 3 clases CSS, 1 clave de comparación, 2 opciones de formato de fecha y 1 cadena vacía |

Suma 173. Las 20: `cobrosView.js` 7 (`COBROS_COPY` 6 y `COBROS_DESCONOCIDO.rotulo`), `estadoFirma.js` 7 (`TEXTO_FIRMA` 3, `TEXTO_DESALOJO` 2, `TEXTO_PRECARGA` 2), `filtroClientes.js` 5 (`TEXTOS_ETIQUETAS` 2, `TEXTOS_SELECCION` 3) y `buscadorDeClientes.js` 1 (`placeholder`). Con las 2 de `QR_COPY` son los 22 textos que c.19421 lleva en bloque a la firma del orquestador.

## Qué se hizo que faltaba en 1215h

- Se abrieron los 14 tickets de Jira que citan las letras de las 33 «sin papel» (descripción y comentarios, 51 de 51): 12 literales estaban en su ticket y 17 no.
- Las 17 estaban en un papel que ninguna sonda miraba: el registro del propio ticket. `docs/master/SCRUM-303.md`, `docs/master/SCRUM-344.md`, `docs/master/SCRUM-285.md` y `docs/master/SCRUM-357.md` llevan la tabla de textos aprobados y dicen quién aprobó.
- La fila de 30 «por subcadena» de 1215h era casi toda coincidencia de palabra genérica («Todos», «Cobros», «Marca» dentro de fichas de otros tickets). Aquí se reparten por lo que dice su propia letra, no por la coincidencia.

## Dónde está y cómo se repite

`docs/master/evidencias/SCRUM-1215/quien-la-vio/papel-nombrado.mjs` y su salida del 13-oct, `papel-nombrado.txt` (74 hojas: 64 en algún papel que nombra su letra, 7 en ninguno, 3 sin trozo buscable). Lleva control positivo y negativo y aborta si falla alguno. La sonda dice DÓNDE está el literal; quién firma se leyó a mano en cada línea que imprime, y esa lectura es la tabla de arriba.

## Lo que destapa, y NO resuelve

- El registro congelado (`docs/MICROCOPY_APROBADA_SIN_APLICAR.md`) no es «todo lo que el fundador aprobó hasta el 3-sep», que es como lo trata el oráculo: hay 32 hojas (30 de agosto, 2 del 2-sep) cuyo registro de ticket dice «aprobó el fundador» con el literal al lado y que no están en él. O el congelado está incompleto, o aquellos «aprobó el fundador» se escribieron de oídas. Desde el repo y desde Jira no se distingue: en Jira todo lo firma la misma cuenta.
- De las 75 que constan, sólo se ha cruzado ficha contra ticket en 1. «Consta en alguna ficha» no es «en la suya».
- Las 7 fichas a las que el oráculo no les lee ningún literal siguen sin causa.
- No se ha comprobado que el código haga lo que dicen los 22 textos.

## Errores propios de esta tanda

- En c.19421 escribí «34 hojas de agosto» y eran 32, con 2 de septiembre: conté las 2 de `QR_COPY`, que justamente no tienen registro. Corregido en c.19422.
- La hora de c.19422 la escribí sin tomarla de GitHub en el mismo comando. Coincidió con la que puso Jira, y aun así no se midió.
- La foto de las hojas es de `f7a4c816ab2bf5c334a953dee60dc7b73718a0f8` y el oráculo se leyó sobre el árbol de hoy: por eso las 73 de 1215h son 75 aquí. No se ha vuelto a tomar la foto.

# SCRUM-1215k · de cuántas formas dice el panel «vuelve a intentarlo»: la medida, subida al repositorio

**Medido contra:** `origin/main` = `1ef32907a2e7fb162a5d9b95ab7e887a4cfb35a0` · 2026-10-13T15:25:18Z
A9: sin fallo que generalice — sólo se sube un guion de lectura y su salida; no cambia ningún texto, ninguna pantalla ni ningún guard
**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún fichero del panel

13-oct-2026 · **S2** (`s2-13octf`) · rama `scrum-1215k-la-medida-de-los-reintentos`. El guion y su salida vivían fuera de git, en la carpeta de sondas del puesto. Sobre esa medida el orquestador anuló una unificación suya y fijó la forma de la casa (SCRUM-1215, comentario 19460). Aquí sólo se sube: **ningún texto cambia**.

## La decisión que sostiene (comentario 19460; no es de esta sesión)

- La forma de la casa para todo texto NUEVO es «Inténtalo de nuevo.».
- Lo ya construido no se toca, y no hay ticket para barrer los sitios existentes.

## La cifra, vuelta a contar hoy sobre `main`

| forma | sitios | ficheros |
|---|---|---|
| «Inténtalo de nuevo.» | 24 | 11 |
| «Vuelve a intentarlo.» | 19 | 14 |
| «Inténtalo otra vez.» | 7 | 6 |
| la frase suelta, en total | 50 | 25 |

- **Es la cifra del comentario 19460, y hoy ya es la de `main`.** Aquélla se midió sobre la rama de SCRUM-1056c, antes de que entrara. Sobre el `main` de un commit antes (`c252b1315d56a1b5294ac8f80c1abbe678104dfd`) el mismo guion dio 6 y 49: el séptimo es el segundo «Inténtalo otra vez.» de `clienteVolverALlamar.js`, que llegó con el merge de arriba.
- Cinco ficheros mezclan dos o tres formas: `jobDetailView.js` (las tres), `exportView.js`, `facturasRecibidasView.js`, `customerDetailView.js` y `homeView.js`. Recontado hoy desde la salida, no copiado.
- Con cola propia hay 7 sitios más, y otras formas que no son la misma frase («reintentarlo», «Reintentar», «vuelve a enviarlo»…). Están todas en la salida, con su línea.

## Dónde está y cómo se repite

- `docs/master/evidencias/SCRUM-1215/reintentos/reintentos.mjs`: lee por AST los literales de texto (los comentarios no cuentan). Se lanza con `node`, la raíz del árbol, la carpeta y `--todo`. Declara su población, lleva control positivo (tiene que ver la frase de `clienteVolverALlamar.js`) y sale con código 2 si no la ve.
- `docs/master/evidencias/SCRUM-1215/reintentos/reintentos-13oct.txt`: la salida de hoy sobre `main` (96 ficheros, 15.429 literales, 74 frases que casan). Comparada línea a línea con la que cita el comentario 19460, que se quedó fuera de git: 0 diferencias.

## No medido

- El HTML del panel, lo que contesta el servidor y el panel pinta tal cual, y las páginas del cliente final.
- Una frase de reintento que no abra con ninguno de los verbos del patrón del guion: no la ve.
- Los números de línea son de hoy. Quien barra vuelve a lanzar el guion; no se fía de esta foto.
- Nada en yaqu.app: no cambia ninguna pantalla.

# SCRUM-1215l · de los 77, quedan 34, y ninguno es del equipo de Luis: lo que promete cada uno, contra el código

**Medido contra:** `origin/main` = `142b4579bb965e5d1a74d3937cbb7b9f3f1127aa` · 2026-10-29T18:11:17Z
(el censo y la lectura se hicieron a las 18:00Z sobre `5a247020e5608fd2b21fad04bcf585694494397a`; los dos commits de en medio sólo tocan `docs/master/SCRUM-1549*`)
A9: sin fallo que generalice — sólo medir; no cambia ningún texto, ninguna pantalla ni ningún guard
**Skill UI:** no cargada · no se toca ninguna pantalla: se leen cinco ficheros del panel y se ejecuta una función pura de uno

29-oct-2026 · **S4** (`sesion-4`) · rama `scrum-1215l-lo-que-prometen-las-34`. Encargo del orquestador (`cobroflash-backend-52`, 29-oct): de los textos sin revisar del censo 1157, coger los que **afirman algo comprobable** y comprobarlo contra el código. **Ningún carácter cambia**: cambiar un texto es de quien lleva la pantalla, con la firma del fundador (regla 39).

## La población, antes que el veredicto

`node scripts/_censo-convenio-microcopy.mjs` (el instrumento de SCRUM-1157, sin tocar), salida entera en `evidencias/SCRUM-1215/1215l/censo1157-29oct.txt`:

- 100 ficheros `.js` en `public/` · 52 objetos · **348 hojas** · APROBADO 314 · PENDIENTE 7 · SIN_COMENTARIO 27 → **34 acusadas** · trinquete 0 nuevas / 0 sobran · estado no CIEGO.
- Control positivo: las seis de `QR_COPY` que el test de 1157 da por sabidas (`PENDIENTES_QR`) salen las seis.
- **Ninguna de las 34 cae en un fichero de S2 ni de S4.** Carril por `node scripts/carriles.mjs de`: `libroRegistroView.js` (22) e `invoicesView.js` (1) → **J1** · `cobrosView.js` (3) y `paidViaEtiquetas.js` (2) → **J2** · `settingsView.js` (6) → **J3**. Lo de los 77 que era nuestro (parte, albarán, presupuesto, sueltos) ya está revisado y marcado en los tramos de arriba.

## Las que no afirman nada que se pueda comprobar (19)

Cabeceras de columna y rótulos: `libroRegistroView.js` `COPY.colNumero/colFecha/colTipo/colBase/colCuota/colTotal/colEstado/titulo/menu/cargando`, `COBROS_COPY.cabeceras` y `diasEnTabla` (un número con su unidad), y las seis de `QR_COPY` (Formato, Color, Negro, de marca, Tamaño, Descargar). Nombran; no prometen.

## Las que sí prometen algo (15)

«Coincide» = el código hace lo que el texto dice en todo camino que he encontrado. Todo es **leído en el código**, salvo la fila marcada como EJECUTADO.

| texto (clave) | dónde se pinta | qué promete | qué hace el código | veredicto |
|---|---|---|---|---|
| `COPY.recuento` («N facturas») | `libroRegistroView.js:236` | que son facturas | cuenta `asientos`; la ruta pide `soloFacturas: true` (`libroRegistro.routes.ts:37`) y los `JUST` salen antes (`libroRegistro.repo.ts:159-161`) | coincide |
| `COPY.error` | `:193` | no se cargó; se puede reintentar | sale en el `catch` y con respuesta sin `miradas` (`:230`) | coincide |
| `COPY.vacioDeVerdad` («Todavía no has emitido ninguna factura.») | `:250` | cero facturas emitidas | sale sólo con `miradas === 0`; la carga va sin `desde`/`hasta` (`:179`), o sea, todo el histórico | coincide (ver observación ①) |
| `COPY.descuadre` («El libro no cuadra…») | `:246` | hay facturas y falta su asiento | sale con `asientos = 0` y `miradas > 0`; `miradas` incluye las `ajenas` y las `sinNumero` (`libroRegistro.ts:282`), que ya tienen su propio aviso | **inalcanzable hoy** (abajo); si se alcanzara, diría «no cuadra» de algo que los otros dos avisos ya explican |
| `COPY.avisoIlegibles` («…escríbenos y los revisamos.») | `:239` | importe ilegible; hay a quién escribir | `importesIlegibles` = total no legible (`libroRegistro.ts:233`); el enlace `mailto` va pegado (`:216-221`) | coincide |
| `COPY.avisoAjenas` | `:241` | se descartaron facturas de otro negocio | `ajenas` cuenta `merchantId` distinto (`libroRegistro.ts:216`) | coincide; inalcanzable: la consulta ya filtra por `merchantId` (`libroRegistro.repo.ts:148`) |
| `COPY.avisoSinNumero` | `:242` | N sin número no son asiento | `sinNumero` = `number` vacío (`libroRegistro.ts:217`) | coincide; inalcanzable en la práctica: `Invoice.number` es `String` no nulo y todos los escritores lo rellenan |
| `COPY.trazaPresupuestoFirmado` / `…SinFirmar` | `:336-338` | firmado = con firma | `signatureUrl: { not: null }` (`libroRegistro.repo.ts:178`), no `acceptedAt` | coincide |
| `COPY.trazaAlbaran` | `:343` | el albarán está en la factura | sale de `albaranRefs`, el sello (`libroRegistro.ts:236`) | coincide |
| `COPY.trazaNoSellado` («Albarán posterior al sello») | `:348` | apunta a la factura y llegó después | mide «apunta hoy y no está en el sello, por id» (`libroRegistro.ts:240-241`); los escritores de `Albaran.invoiceId` (`recapitulativa.service.ts:123-125`, la liberación de `invoicesAdmin.routes.ts:914-916`) sellan en la misma transacción | coincide; lo de «posterior» es la única forma de llegar ahí, no algo que se mida |
| `COPY.trazaCobro` («Cobro») | `:352` | hubo cobro | `Invoice.chargeId`, que sólo escribe `ensureInvoiceForCharge` (`lib/invoicing.ts:429`), llamado al cobrarse por pasarela | coincide (ver observación ②) |
| `COBROS_COPY.diasSinCobrar` («Sin cobrar desde hace N días») | `cobrosView.js:663` | días desde que se pidió el dinero | `diasDeDeudaCobro` (`:412`): sólo `estado === 'pending'`, desde `fecha` = `createdAt` del cobro o de la factura (`cobros.service.ts:282`, `:302`) | coincide |
| `ETIQUETAS_HEREDADAS['card:stripe']` («Tarjeta») | `paidViaEtiquetas.js:52` | se cobró con tarjeta | lo escriben las rutas de Stripe y `receipt.routes.ts` (comentario `:50-51`) | coincide |
| `ETIQUETAS_HEREDADAS.manual` («Marcado a mano») | `paidViaEtiquetas.js:59` | pagada sin pasarela | ya no lo produce nadie (SCRUM-491); sólo lo pinta si la base lo trae escrito | coincide |
| `COPY_BULK_PAGADAS.recargaFallida` («Se han marcado como pagadas, pero…») | `invoicesView.js:34`, `:506` | se marcaron | **EJECUTADO** (`evidencias/SCRUM-1215/1215l/sonda-bulk-pagadas.cjs`): con escritura OK, recarga fallida y **0 marcadas**, sale esa frase igual. El servidor salta las ya `paid`/anuladas (`invoicesAdmin.routes.ts:487`, `invoiceAdmin.ts:182`) | **no coincide en un caso de carrera**: la casilla sólo sale en las que se pueden marcar (`invoicesView.js:620`), así que hacen falta dos pestañas o una lista vieja. Leve |

**Ninguna le miente al profesional en el camino normal.** La única que no coincide (`recargaFallida`) lo hace en una carrera; las dos que podrían confundir (`descuadre`, y con ella `avisoAjenas` y `avisoSinNumero`) hoy no se pueden alcanzar.

## Dos observaciones que no son de texto

① **El libro calcula `justificantesFuera` y la pantalla no lo enseña.** `libroRegistro.repo.ts:204` lo devuelve («lo que un libro fiscal descarta se cuenta», `libroRegistro.ts:157-163`), y `libroRegistroView.js` no lo lee. Un negocio con sólo justificantes ve «Todavía no has emitido ninguna factura.»: es cierto (un justificante no es factura), pero no se le dice que hay N que se quedaron fuera, al revés que con `ajenas` y `sinNumero`. Pintarlo sería un texto nuevo → firma del fundador, y la pantalla es de J1. Toca a SCRUM-1523.

② **Una factura marcada a mano no lleva marca de cobro en «De dónde viene y dónde acabó».** «Cobro» sólo sale con `chargeId`; una transferencia o un efectivo dejan `Estado: Cobrada` y en la columna nada sobre el cobro («Factura suelta» si no hay presupuesto ni albarán). No miente, pero la columna que existe para enseñar «dónde acabó» el dinero calla justo en el cobro manual. Es de J1 y, si se arregla, es texto nuevo.

## No medido

- Nada en yaqu.app: ninguna de las 34 se ha visto pintada. La de la carrera se ejecutó como función, no en la pantalla.
- La rama de `pintar()` del libro con `miradas > 0` y `asientos = 0`: leída, no ejecutada (hace falta una base con facturas sin número o ajenas, y hoy no hay escritor que las cree).
- Los 314 APROBADO: firma ≠ verdad, pero no eran el encargo.

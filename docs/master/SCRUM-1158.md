# SCRUM-1158 · El mini-DOM del banco refleja `hidden`

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:50Z

A9: sin fallo que generalice — el primer empuje salió rojo por faltar esta misma línea (SCRUM-1294), y eso ya lo caza su guard; lo demás de la tanda (la junction del worktree a un cliente de Prisma viejo) es del entorno y está en «Lo que no se ha hecho».

S3 · rama `scrum-1158-el-banco-ve-hidden` · worktree `wt-s3-1288b` (hora del `Date:` de GitHub).

## SCRUM-1158c · los objetivos cortos que destapó el banco arreglado: Inicio e Informes a 44 px (S2)

**Medido contra:** `origin/main` = `7e53b1474096bde7aa23898d9f30caf2097b5d70` · 2026-10-16T11:28:09Z (`Date:` de GitHub)
**Skill UI:** cargada · `yaqu-premium-ui`: sólo tamaño (`min-height`/`min-width` 44 px), cero tokens, cero texto, cero componentes.
A9: aviso → cicatriz S2 «el banco de `main` daba 0 cortos en Inicio e Informes y producción tenía 20: un censo sobre un banco que pierde estilos es un verde hueco, y sólo lo destapa medir la pantalla de verdad» — no se pudo comprobar: lo que lo impide es el censo en navegador sobre el banco de #2500, que no corre en cada PR

*(Va aquí, y no al final, porque #2500 —1158b, de S3, abierto— añade 146 líneas al final de este fichero: dos anexos
al final chocan. Este tramo acaba en «Fin de 1158c»; lo de debajo es el registro original de 1158.)*

S2 · rama `scrum-1158c-inicio-informes-44px` · worktree `s2-1158c`. Forma firmada: decisión del fundador de SCRUM-786 (c.16266, opción ③: reglas de
44 px ACOTADAS, nunca `.btn-sm` global); el encargo, del orquestador (lote del 16-oct, punto 3).

**Recuento, no cifra heredada.** `censo:tactil-panel` sobre `main` (`48fc00f6a`): Inicio **0**, Informes **0**,
Exportar 1 → el banco de `main` todavía pierde los estilos. Sobre la punta de #2500 (`3d1570004`, el banco
arreglado): Inicio **10/10** y Informes **8/8** a 929 y a 390, Exportar 3 sólo a 929 → **18**, los que dijo el
orquestador. Exportar NO se toca (decidido: SCRUM-384/352, y a 929 juzga contra 36 px).

| dónde | qué | antes | después |
|---|---|---|---|
| Inicio | «⚙ Personalizar» (`#btn-home-prefs`) | 30 | 44 |
| Inicio | «Ir →» de «Completa tu configuración» | 39×30 | 44×44 |
| Informes | «1T-4T» de «IVA repercutido» y de «Resumen del trimestre» | 38-41×30 | 44×44 |
| Informes, **de paso** | fila de descargas: «⬇ Facturas / Gastos / Presupuestos / Trabajos / Clientes CSV» | 30 | 44 |

**De paso — un agujero del instrumento, NO de S2:** el censo nunca vio la fila de descargas. En el banco los 5
enlaces están en el DOM (5 de 5), pero el HTML que serializa `_pagina-panel.mjs` no los lleva (0 de 5, y tampoco
«⬇ VeriFactu XML»); Informes salía con 8 medidos y eran los 13 de producción. Reportado al orquestador.

### Qué cambia
- `public/dashboard/css/styles.css`: tres reglas acotadas (`#btn-home-prefs` y `.informes-exportar > .btn-sm`:
  alto; `.home-checklist .btn-sm`, `#vat-quarter-row > .btn-sm`, `#resumen-quarter-row > .btn-sm`: alto y ancho).
- `homeView.js` / `reportsView.js`: una clase de enganche cada uno (`home-checklist`, `informes-exportar`). En
  `homeView.js` va en la MISMA línea que crea el `div` (`Object.assign`): `tests/scrum601` ancla su control en la
  línea 885 de ese fichero, y una línea de más lo tumbaba (medido: cayó). No se toca el guard; no se mueve la línea.
- `tests/scrum1158c-inicio-informes-44px.test.mjs`: las reglas con 44 px, `.btn-sm` global intacto, y que el
  producto siga pintando los botones DENTRO de lo que cada regla nombra.

### Verificado, ejecutando
- **Censo en navegador sobre el banco arreglado** (los ficheros de esta rama aplicados en la punta de #2500):
  Inicio y Informes **0 cortos** a 929 y a 390; las otras 32 filas pantalla×anchura, **idénticas** (comparadas fila
  a fila); mediciones cortas 106 → 70 (−36 = 18 × 2).
- **yaqu.app, cuenta QA** (sonda de sólo lectura `sondas-s2/tactil-1158c.mjs`, fuera del repo; sirve los ficheros
  de la rama en lugar de los de producción, con control de que se sirvieron; 0 escrituras, 0 errores; capturas en
  `sondas-s2/cap1158c/`): **20 de 20 a 44 px** a 390 y a 929 (antes, 20 de 20 por debajo). **NO medido:** «⬇ VeriFactu
  XML», que sólo se pinta en modo de emisión fiscal y la cuenta QA no lo tiene.
- **Rojo primero, por inyección** (commit antes de cada una; `git diff --numstat` al lado; `git restore --source=HEAD`
  y `status --porcelain` vacío después): sin `home-checklist` cae el caso de Inicio; sin la regla de un trimestre,
  o con `.btn-sm` global a 44, cae el de CSS; con otro id en la fila del IVA, o sin `informes-exportar`, cae el de
  Informes. Base: 3 de 3.

*Fin de 1158c.*

## Qué mentía

`tests/_banco-vistas.mjs` no tenía `hidden`. `el.hidden = true` dejaba un campo suelto en el nodo que
`scripts/_pagina-panel.mjs` (`serializar`) no emite, y un `<span hidden>` del marcado daba
`.hidden === undefined`. La página que miden los guards de navegador pintaba **visible** lo que el
producto oculta. Y existía la dirección contraria, la que da verdes huecos: algo que nace `hidden` en el
marcado y el producto enseña con `.hidden = false` **seguía oculto** en la página servida.

## Cuánto (antes del arreglo, sobre 73e41ab0)

| medida | antes | después |
|---|---|---|
| sonda de 10 casos contra el navegador (las dos direcciones, con un control visible) | **9 MAL** de 10 | 0 de 10 |
| `censo-hidden-desacorde.mjs`: elementos con la visibilidad equivocada | **23** en **5** de 18 vistas montadas (15 en `renderQuotesView`) · 17 interactivos dentro · 0 en la dirección «oculto de más» con estos datos | 0 · mismas 18 vistas montadas, mismas 10 sin montar |
| tests que importan el banco (198 ficheros) | 1.756 tests · 1.756 pass · 0 fail · 0 skip | 1.756 · 1.756 · 0 · 0 — **conjuntos de nombres idénticos** |
| `censo:tactil-panel` (`renderQuotesView` / `renderDocumentoSueltoView`, medidos · sinPintar) | 11 · 33 / 10 · 12 | 7 · 37 / 7 · 15 (los ocultos dejan de medirse; los cortos no cambian) |
| `guard:objetivo-tactil` | 0 hallazgos · 0 ciegos (con la excepción del banco) | sin tocar el guard: 1 **excepción sobrante** + 1 ciego (suelo 2, encontró 1). Con el guard ajustado: 0 · 0 |

**A cuántos instrumentos afecta:** los dos que serializan el banco para un navegador
(`guard:objetivo-tactil` y `censo:tactil-panel`). `scripts/_banco-lista.mjs` sólo lo nombra en un
comentario. **Los guards de la LANDING no usan el mini-DOM** (sirven el HTML real a un navegador real),
así que este arreglo no cambia nada de lo que miden; si algún guard de texto de la landing lee el HTML
sin navegador y cuenta secciones `hidden` como visibles, es otro instrumento y **no lo he medido**.

## El arreglo

- `tests/_banco-vistas.mjs`: getter/setter `hidden` ↔ `_attrs.hidden`, como el navegador.
- `scripts/guard-objetivo-tactil.mjs`: **se retira** la excepción `BUTTON.btn-ghost.btn-sm`
  «+ Añadir descuento» de `EXCEPCIONES_791.renderQuotesView` (la nombró el detector de sobrantes: cumple
  a 929 y a 390). Y el suelo de `renderQuotesView` **baja 2 → 1**; el que sale, nombrado: «+ Añadir
  descuento», `BUTTON.btn-ghost.btn-sm`, 43,6 → cumple. No cambió el botón: cambió el banco. Sigue: las
  casillas de 17 px. El origen del suelo pasa a SCRUM-1158 (decir «SCRUM-1148 midió 1» sería falso).
- `tests/scrum1158-el-banco-ve-hidden.test.mjs`: los casos de la sonda, en el check obligatorio.
- `docs/master/evidencias/scrum1158/censo-hidden-desacorde.mjs`: el instrumento, con control positivo
  y suelo (sale 2 si monta < 10 vistas o no monta `renderQuotesView`). Comiteado antes de tocar el banco
  (`8c651ecf9d8dcaf7e8c95949b94261adc53173a8`).

## Control positivo / rojo por mutación

Commit del árbol entero antes de mutar: `582997109ee6dd666dedc37382b362f237272e6e`. Mutación: el banco
de `origin/main` (`git diff --numstat` → `0 9 tests/_banco-vistas.mjs`).

- `tests/scrum1158-el-banco-ve-hidden.test.mjs`: **6 de 6 caen**.
- `guard:objetivo-tactil`: **1 hallazgo** — `✖ 43.6px < 44 · BUTTON.btn-ghost.btn-sm «+ Añadir descuento»`,
  salida 1. O sea: si alguien devuelve el banco a como estaba, el guard lo grita por el botón concreto.

Restaurado y comprobado (`git diff HEAD` vacío). ⚠️ El hook `guard-dangerous` bloqueó `git restore`
(busca su fichero de permiso en el checkout compartido): la mutación se deshizo re-escribiendo con Edit
las 9 líneas del arreglo, que es lo que había en HEAD.

## Lo que no se ha hecho

- `npm run build`: el primero salió 2 sólo por tipos (cliente de Prisma viejo en la junction de este
  worktree, que apuntaba a `wt-s3-1179c2`). `tsc` emite igual, así que `dist/` es de este fuente. Re-apunté
  la junction al `node_modules` compartido (ya regenerado: el guard de Prisma da ✔) y el segundo build lo
  denegó el clasificador; no lo he reintentado. El cambio no toca `src/`.
- La suite completa: no la he corrido (memoria libre 1.314 MB, umbral 2.200). La red es el CI.
- La segunda cara del ticket (c.17197: `serializar` sólo emite `cssText` y `display`, y pierde
  `el.style.minHeight = '44px'` y similares). No la he tocado: es otro defecto en otro fichero
  (`_pagina-panel.mjs`, fila general) y sigue vivo. → **Hecha abajo, en «Segunda cara».**

## Segunda cara (c.17197) · `serializar` pierde los estilos en línea

**Medido contra:** `origin/main` = `f4910603f44de8d16eab3abc938d853d255d8295` · 2026-10-15T17:37Z

A9: sin fallo que generalice — el primer control positivo del censo dependía del `serializar` medido y salió CIEGO tras el arreglo; se cazó en la misma tanda y se rehízo independiente (emisor mudo). Y el primer empuje salió sin esta línea: ya lo caza `scrum1294`.

S3 · rama `scrum-1158b-serializar-y-hidden` · worktree `wt-s3-1288b` (hora del `Date:` de GitHub).

**Qué mentía, y era más ancho de lo que decía el ticket.** No sólo lo puesto por JS: el banco NO
mantiene `cssText`, así que un `style="…"` del **marcado** (que `setAttribute` reparte en propiedades
sueltas desde SCRUM-1038) tampoco llegaba a la página. Sólo salía `display`.

**Cuánto, antes de tocar** (`docs/master/evidencias/scrum1158/censo-estilos-perdidos.mjs`, con control
positivo del detector independiente del `serializar` medido):

| medida | antes | después |
|---|---|---|
| declaraciones en línea que no llegan a la página | **876** en **16 de 18** vistas montadas · **824 del marcado**, 52 por JS · 335 nodos · 101 interactivos las llevan o están dentro | 0 · mismas 18 montadas, mismas 10 sin montar |
| propiedades más perdidas | color 153 · font-size 147 · font-weight 57 · width 44 · margin 41 · … · **min-height 23** | — |
| `censo:tactil-panel`, elementos DISTINTOS < 44 px | **62** (42 con `.btn-sm`) | **51** (29 con `.btn-sm`) |
| `guard:objetivo-tactil` | 0 hallazgos · 0 ciegos | 0 hallazgos · 0 ciegos (sus cuatro superficies no cambian de fila) |

**«Infla el censo» era verdad sólo a medias, y la otra mitad es la peligrosa.** Por clase:
- **Sobraban 19 falsos cortos:** `BUTTON.btn-sm.btn-ghost` 15 → 0 (las pestañas de Cobros «Bizum /
  tarjeta / transferencia»: `cobrosView.js:514` les pone `minHeight = '44px'` por JS) y
  `BUTTON.btn-sm.btn-secondary` 4 → 0 («Todos / Historial / Empresa»).
- **Faltaban 8 cortos de verdad** (verdes huecos): `BUTTON.btn-ghost.btn-sm` 3 → 8, `btn-primary` 4 → 5,
  `btn-primary.btn-sm` 3 → 4, `btn-secondary` 3 → 4. Por pantalla: Inicio pasa de 0 a 10 cortos (a 390
  tenía 6 «no tocables» que dejan de serlo), Informes de 0 a 8, Exportar de 1 a 3.
- Neto 62 − 19 + 8 = 51.

**El arreglo:** `serializar` emite cada propiedad con valor de `.style` (más `cssText` si lo hay).
Test `tests/scrum1158b-serializar-no-pierde-estilos.test.mjs`, 5 casos con un control.

**Rojo por mutación:** con el `serializar` de `origin/main` (stash del arreglo) el test da **4 de 5 rojos**;
el que pasa es el control, como debe. Con el arreglo 5/5, y `scrum1158-el-banco-ve-hidden` sigue 6/6.
Vecinos (`scrum522`, `694c`, `848b`, `1294`, `1415`, `824`, `824b` ×2): 67/67.

**Lo que no se ha hecho:** la suite entera (la red es el CI). No he medido las 10 vistas que el banco no
monta con estos datos: sobre ellas este arreglo no dice nada.

## La pregunta abierta · ¿algún guard de TEXTO de la landing cuenta lo `hidden` como visible?

**Medido contra:** `origin/main` = `95bb7e71de1b7989716d7a713d2792ae560702e0` = `/version` de yaqu.app (leído) · 2026-10-15T17:41Z

A9: comprobación → `docs/master/evidencias/scrum1158/sonda-landing-visible.mjs`

Por qué importa: SCRUM-1236 pide al fundador firmar textos de la landing, y tres de sus cuatro falsos
originales están en secciones `hidden`.

**Respuesta: SÍ hay dos que lo cuentan como visible, y NO afecta a lo que se le pide firmar.**

| instrumento | ¿distingue `hidden`? | dato |
|---|---|---|
| `_guard-conformidad-landing.mjs` (SCRUM-400) | **no** | con una afirmación de conformidad visible: 1; **dentro de `<section hidden>`: 1**; control sin afirmación: 0. Sobre el árbol: 0 hallazgos |
| `_guard-afirmacion-fiscal.mjs` (SCRUM-537) | **no** | visible 1 · dentro de `hidden` 1 · control 0. Sobre el árbol: 0 en las 4 páginas |
| `_censo-microcopy-sin-marcar.mjs` (SCRUM-549) | sí | censa justo los elementos `hidden` y les exige motivo |
| `censo-anclas-bloque-f.mjs` | sí | declara `#heroe-f4`, `#gremios` y `#comparativa` como `hidden` |

(Sonda de los dos primeros: `docs/master/evidencias/scrum1158/sonda-guards-texto-hidden.mjs`.)

Por qué no afecta:
1. **Contar lo oculto es la dirección SEGURA en un guard que bloquea:** la sección se destapa quitando un
   atributo, sin pasar por el guard. Si distinguieran `hidden`, ése sería el verde hueco.
2. **La lista de SCRUM-1236 no sale de ningún guard:** S4 la midió a mano sobre el HTML servido
   (c.19745) y anotó «¿Se ve?» texto a texto.
3. **Y esa columna es CORRECTA en un navegador real** (Edge, yaqu.app servida, a 1280 y a 360): se ven
   el subtítulo #1 (su copia en `#heroe-f4` no), la tarjeta #4, el `aria-label` #6 y la llamada #7. No se
   ven los cinco de `#gremios` ni los dos de `#comparativa`. Control: el `h1` se ve y `#gremios` no.

**Mi propio falso, dicho:** la primera pasada de la sonda dio la tarjeta #4 por invisible. Era la
animación `.reveal`, que tiene opacidad 0 hasta que la tarjeta entra en pantalla (`.prod.reveal`, o=0;
tras el scroll, `.reveal.in`, o=1). Ahora la sonda recorre la página antes de mirar y cuenta los
`.reveal` sin disparar fuera de `hidden` (0). **Quien mida la visibilidad de la landing con
`checkVisibility({checkOpacity})` sin recorrerla dará por invisible todo lo que esté bajo el pliegue.**

## El rojo de #2500 era mío (16-oct-2026, S3)

`d64ed0ac` cayó en `build + tests` (15-oct 18:15Z) por **un solo** test: `scrum710b` · «los anclajes
por NÚMERO DE LÍNEA no crecen» — `tests/scrum1158b-serializar-no-pierde-estilos.test.mjs cobrosView.js
(declarados 0, hay 1)`. Mi test citaba las pestañas de Cobros por su línea. El meta-guard cayó por lo
mismo (lo da «CIEGO» porque `scrum710b` ya falla en la limpia). No era `scrum1405c ④`.
Arreglo: la cita nombra lo que la cosa ES (los botones `data-filtro-cobro` de `cobrosView.js`). Con
`origin/main` mezclado, `scrum710b` + `scrum1158b`: 17/17. El rojo es el de CI sobre `d64ed0ac`.
## Los cortos que destapa 1158b, uno a uno, y el guard (16-oct-2026, S3)

**Medido contra:** `origin/main` = `574e538065dd51f45cfdca078b3787d7f32fbb5a` · 2026-10-16T11:21:36Z

Medido sobre dos copias extraídas con `git archive` (nunca un worktree): `origin/main` `48fc00f6`
y la rama `3d157000`. El censo es `censo:tactil-panel` con el mismo árbitro; sólo se le añade el
volcado (`docs/master/evidencias/scrum1158/sonda-cortos-1158b/`). Se comparan CONJUNTOS.

⚠️ **Medido sobre la RAMA, no sobre `main`.** En `main` hoy son **62 distintos, con 19 falsos
dentro y estos 13 escondidos**; en la rama, 51.

**Los «21» del 15-oct son 21 MEDICIONES a 929 px y 13 BOTONES** (el censo cuenta como uno la tupla
pantalla|selector|texto: los 9 «Ir →» le cuentan como 1).

| vista | elemento | toque 929 / 390 px |
|---|---|---|
| Inicio | `#btn-home-prefs` «⚙ Personalizar» (`btn-ghost btn-sm`, sólo admin) | 30,5 / 30,5 |
| Inicio | 9 × «Ir →» de la lista de pasos (`btn-ghost btn-sm` con padding en línea; los distingue su `renderAppView('<acción>')`) | 31 / 30,8 |
| Informes | `#vat-quarter-row` 1T 2T 3T 4T (`btn-ghost btn-sm`, el activo `btn-primary btn-sm`) | 31 / 30,6 |
| Informes | `#resumen-quarter-row` 1T 2T 3T 4T | 30,7 / 30,7 |
| Exportar | `#btn-export-zip`, `#btn-libro-emitidas` | 36,7–36,8 / ≥ 44 |
| Exportar | `#btn-portabilidad` — ya corto en `main`, no lo destapa 1158b | 36,6 / 44,6 |

**Decisión del orquestador (16-oct, por mensaje a S3):** los de Inicio e Informes (18) son defecto a
los dos anchos y van a S2 con esta lista. **Los tres de Exportar se quedan:** un comentario de
SCRUM-384 en `exportView.js` dice que el `min-height` en línea se quitó A PROPÓSITO porque la base da
44 px en móvil (SCRUM-352), y a 390 px los tres llegan. Extender AB6 a 929 px sería cambiar el
criterio de AB6, y eso no se decide dentro de otro ticket. Dato a favor: `guard:objetivo-tactil`
juzga el escritorio contra **36 px** (DESIGN.md) y el censo contra 44 a los dos anchos.

**Por qué `main` no los ve (los 8 distintos que faltaban).** El serializador viejo conservaba
`display` y tiraba el `align-items` que el MARCADO pone en línea al padre flex, así que el botón se
estiraba a la altura de la fila: «Ir →» medía 181 px (padre `display:flex;align-items:center`),
1T–4T de 51 a 148 px (padre `…;align-items:flex-start`), ZIP y CSV 59–62 px (aquí el padre no lo he
leído). En `main`, además, 1 «Ir →» a 929 y 6 a 390 salen «no tocable».

**Los 19 falsos que quita: UNA causa, tres fuentes.** `el.style.minHeight = '44px'` puesto por JS,
que el serializador viejo perdía: botones `data-filtro-cobro` de `cobrosView.js` (6), pestañas
`data-submenu` de `settingsView.js` (9) y pestañas `data-pestana` de `quotesTabs.js`, montadas en
Presupuestos y en Plantillas (2 + 2). **El patrón que puede volver: toda pestaña o segmentado `btn-sm`
que llegue a 44 px por `style.minHeight` en JS.** Con 1158b dentro lo cubre
`tests/scrum1158b-serializar-no-pierde-estilos.test.mjs`.

**`guard:objetivo-tactil` con 1158b: su 0·0 SIGUE siendo cierto, y no es sordera.** Sin sembrar,
salida 0 en las dos copias. No se queda quieto: 18 líneas de su salida cambian (px de las
excepciones, cajas de los «no tocables»), todas en casos ya excusados. Sus superficies del panel
(Clientes, editor, Trabajo, 360) no son las de los 13 ni las de los 19. **Siembra:** un `btn-sm` de
30 px dentro de un padre flex con `align-items:center` en el MARCADO, en la cabecera de Clientes:
`main` → salida 0 (lo estira y pasa: ciego) · rama → salida 1, `31px < 36` y `31px < 44`. **Primera
siembra descartada, dicha:** la puse por `style.cssText` y la cazaban LAS DOS. El serializador viejo
sí conservaba `cssText`; lo que perdía era el estilo del marcado y las propiedades sueltas.

**De paso, del instrumento (no tocado, decisión del orquestador):** el censo subcuenta por la tupla.
Se arregla en rama aparte cuando 1158b esté en `main`, declarando que el total SUBE y por qué.

**El rojo de `3d157000`** (16-oct 11:19Z): tanda completa, 11.639 tests, 1 fallo, `scrum1405c ④`,
ajeno; `scrum710b` ya pasa.

A9: comprobación → `tests/scrum710b-anclaje-por-identidad.test.mjs`
A9: aviso → cicatriz S3 «Aparté mi arreglo con `git stash` para mezclar main, y `stash pop` saca el último del almacén de TODOS los worktrees, no el mío.» — no se pudo comprobar: es un comando de git en mi shell y ningún guard lee lo que una sesión teclea

## Recuento de los 21 con el censo arreglado (18-oct-2026, S3, sólo medir)

**Medido contra:** `origin/main` = `06c6289d46d5998493ec014fa26ff3353946b58b` · 2026-10-18T17:40:44Z

A9: comprobación → `tests/scrum1158b-serializar-no-pierde-estilos.test.mjs`

Los «21» (Inicio 10, Informes 8, Exportar 3) se midieron sobre la rama de 1158b, antes de que entrara.
Ahora se recuentan con `censo:tactil-panel` sobre `main`, que lleva 1158b, 1158c, 1559b y 1560 dentro.
El censo da 80 distintos y 111 mediciones, 0 sondas sin cazar de 56. Cada control sale MEDIDO, no
ausente: el volcado elemento a elemento sale de una copia del censo fuera del repo, que reproduce
80/111.

**Quedan 3, y son los tres de Exportar que se decidió no tocar.** Los 18 de Inicio e Informes llegan a 44.

| vista | selector | control | px 929 / 390 | estado |
|---|---|---|---|---|
| Inicio | `#btn-home-prefs` (`BUTTON.btn-ghost.btn-sm`) | «⚙ Personalizar» | 44,5 / 44,5 | cumple |
| Inicio | `.home-checklist .btn-sm` (`BUTTON.btn-ghost.btn-sm`) ×6 | «Ir →» | 44,6–45,0 / 44,6–44,9 | cumple |
| Inicio | ídem ×3 | «Ir →» | — | **no pintados con estos datos** (ver abajo) |
| Informes | `#vat-quarter-row > .btn-sm` ×4 | «1T» «2T» «3T» «4T» | 44,8 / 44,8 | cumple |
| Informes | `#resumen-quarter-row > .btn-sm` ×4 | «1T» «2T» «3T» «4T» | 44,6 / 44,7 | cumple |
| Exportar | `#btn-export-zip` (`BUTTON.btn-primary`) | «Descargar ZIP» | **36,9** / 44,8 | corto sólo contra 44; cumple 36 en escritorio |
| Exportar | `#btn-libro-emitidas` (`BUTTON.btn-secondary`) | «Descargar CSV» | **37,0** / 44,7 | ídem |
| Exportar | `#btn-portabilidad` (`BUTTON.btn-secondary`) | «Descargar todo» | **36,7** / 44,7 | ídem |

- **Los «Ir →» son 6 y no 9.** `renderSetupChecklist` (`homeView.js`) sólo pinta «Ir →» en los pasos
  sin hacer (`pasos.filter(s => !s.done)`). Los datos de 1560 traen un merchant con 3 pasos hechos.
  Los 6 pintados salen de la misma plantilla y caen bajo la misma regla, y dan 44,6–45. Los otros 3 NO
  están medidos con estos datos: se dice, no se cuenta como cero.
- **Exportar** sigue la decisión del 16-oct (SCRUM-384/352): a 390 llega, a 929 juzga el 36 de `DESIGN.md`.

**Los 19 falsos: los 19 de la misma causa, re-medidos hoy.** La causa es `el.style.minHeight = '44px'`
puesto por JS, que el serializador viejo perdía. Hoy, con el serializador arreglado, cada uno sale medido:

| fuente | elementos | px 929 / 390 |
|---|---|---|
| `cobrosView.js`, filtros `data-filtro-cobro` | 6 | 44,9 / 44,9 |
| `settingsView.js`, pestañas `data-submenu` | 9 | 45,0 / 44,8 |
| `quotesTabs.js` en Presupuestos («Historial», «Plantillas») | 2 | 44,5 / 44,5 |
| `quotesTabs.js` en Plantillas | 2 | 44,5 / 44,5 |

El patrón que puede volver es una pestaña o segmentado `btn-sm` que llega a 44 sólo por
`style.minHeight` en JS y un serializador que vuelve a tirar esa propiedad. Lo vigila
`tests/scrum1158b-serializar-no-pierde-estilos.test.mjs`: 5 de 5 hoy.

**`guard:objetivo-tactil`: el «0·0» del 16-oct ya NO es verdad, y es porque el guard SÍ se movió.**
Hoy sale 1, con 2 hallazgos y 0 ciegos. Los dos son el mismo control: «⬇ Clientes CSV»
(`A.btn-secondary.btn-sm`, `customersView.js`, J2), con 31 < 36 a 929 y 31 < 44 a 390. Es el rojo que
anunció 1559b, cuando el banco dejó de perder el botón con texto más icono. Está en `para-javier.md`
§17 y no se arregla por el lado del guard (regla 41). Las demás superficies dan 0 cortos sin excusar,
y todas las sondas de umbral caen donde deben (sonda-30 cae y sonda-37 pasa a 36 px; sonda-40 cae a 44).
Que el guard sólo se moviera con 1559b y no con 1158b casa con lo medido el 16: sus superficies (Clientes,
editor, Trabajo, 360, Proveedores) no eran las de los 13 ni las de los 19.
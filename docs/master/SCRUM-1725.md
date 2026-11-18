# SCRUM-1725 — Trabajos del operario: la lista sin el estado de cobro (D1, mitad de la lista)

**Puesto:** S4 · **Rama:** `scrum-1725-lista-operario-sin-cobro` · 12-nov-2026
**Skill UI:** no cargada · sólo quita elementos por rol; ni un estilo, token, clase ni texto nuevo
**Medido contra:** `origin/main` = `8f235725590f2c984b1709a5331ff26a53f25792` · 2026-11-12T15:30:00Z
A9: comprobación → `tests/scrum1725-lista-operario-sin-cobro.test.mjs`

**Encargo:** GO del orquestador a la propuesta de S4 (D1): recorte por rol en `jobsView.js` — sin «Por cobrar», sin filtros de cobro y sin «X € de Y €» para quien no ve el cobro; cero textos; desde main, sin esperar al paquete 1662+1707. La ficha (`jobDetailView.js`) y «Qué hay que hacer» son de S2.

## Por qué (medido en yaqu.app, propuesta de 1725 §⓪)
Firmado en SCRUM-1707 c.21547 (Q1): el operario ve el importe de sus trabajos, «pero SIN la tarjeta "Por cobrar" ni los filtros de cobro del negocio». El 1707 de servidor vacía `totalCobrado` y `estadoCobro`, pero esta lista calcula «lo que falta» en el navegador: simulado el paquete sobre yaqu.app a 390, con rol técnico y sólo sus trabajos, seguían «POR COBRAR 1,21 €», «Pendiente · 0 / Parcial · 0 / Pagado · 0» y «1,21 € de 1,21 €». Con lo cobrado vacío (→ 0), en un trabajo cobrado a medias la lista diría que falta todo. Una cifra falsa.

## Qué cambia (sólo `public/dashboard/js/jobsView.js`)
- `veEstadoDeCobro(rol)`: lista blanca (`admin`), fail-closed como `puedeVerEconomia` (SCRUM-597). Va en `window` para que la ficha haga la MISMA pregunta (canon de SCRUM-831).
- Para quien no la pasa: sin la tarjeta «Por cobrar»; sin los filtros Pendiente/Parcial/Pagado (y el filtro vuelve a «todos»); sin «· X por cobrar» en la cabecera de Terminados ni su salvedad; la celda de importe, una línea con el importe (`importeReferencia`), sin «de» ni lo que falta. «Sin importe / no hay presupuesto aceptado» se queda como está.
- Para el admin no cambia nada.
- Textos: ninguno nuevo. La cabecera «✅ Terminados — cobra el resto» se queda para todos: cambiarla al operario es M1 de la propuesta, y pide firma.

## Comprobación
- Test nuevo, con la vista REAL en el banco (sin navegador): técnico y un rol desconocido (`contable`) no ven nada del cobro y sí el importe; el admin, de control positivo, lo ve todo. 3/3.
- Mutación: `veEstadoDeCobro` → `true` (el comportamiento de main) tumba los dos casos sin permiso (2 ✖); el positivo sigue verde.
- Vecinos: los 33 ficheros `tests/*.test.mjs` que nombran `jobsView`/`renderJobsView`, más el nuevo: **334/334, 0 fallos, 0 saltos**.
- En yaqu.app, tras el merge (regla 42): la sonda de la propuesta (`sonda-trabajos.mjs`, FIEL=1) sin nada local, a 390 y 1280.

## Apéndice · 12-nov-2026 (noche): el rojo del CI y su arreglo
El obligatorio «build + tests» de #3127 cayó a las 15:34Z con UN fallo: `tests/scrum1415-nombres-construidos.test.mjs` (el árbol). Los dos casos sin permiso salían de un bucle con el nombre construido (`rol «${rol}»`), y un test nuevo se escribe con nombre literal: la lista de SCRUM-1415 sólo baja.
- Arreglo en el TEST, no en el guard (regla 41): el cuerpo pasa a `sinCobroParaElRol(rol)` y los dos `test(…)` llevan su nombre escrito. Los nombres que registra la tanda son los mismos de antes.
- Por qué no se vio antes de empujar: se corrieron el test nuevo, la mutación y los 33 vecinos de `jobsView`; `scrum1415` no nombra `jobsView` y no entró en esa selección.
- Medido tras el arreglo: `scrum1415` 6/6 y `scrum1725` 3/3 (9/9, 0 fallos, 0 saltos).

## Lista (S4 · 18-nov)

**Puesto:** S4 · **Rama:** `scrum-1725e-lista-visual` · 18-nov-2026
**Skill UI:** cargadas (`yaqu-premium-ui` + `impeccable`; DESIGN.md única fuente de tokens; Parte AB: una pantalla)
**Medido contra:** `origin/main` = `bcff9d8b1ea465938ef797c17548cb5217de02bc` · 2026-11-18T15:29:14Z
A9: comprobación → `docs/master/evidencias/SCRUM-1725/c1725e-lista.mjs`

**Orden (fundador, 18-nov, literal):** lavado de cara del panel, «clean nuevo elegante facil de usar intuitivo bien ordenadas las cosas». Se empieza por Trabajos. Esta sección es la LISTA (`jobsView.js` + un bloque propio en `styles.css`); la ficha es de S2, en otra rama.

### Qué se midió antes (yaqu.app, cuenta QA, 390) y qué se hizo
| # | Medido | Arreglo (solo ropa) |
|---|---|---|
| ① | El título «Trabajos» gastaba una tarjeta de 70 px para repetir la barra de arriba (hallazgo (c) de c.21809) | Deja de ser tarjeta. A 390 no se pinta (el `h2` sigue para quien lo oye); desde 641, título Headline en el mismo renglón que «Nuevo trabajo» |
| ② | La lista era una tarjeta con tarjetas dentro, y cada rótulo de grupo era OTRA tarjeta de 65 px con una etiqueta de 12 px en mayúsculas | La lista no es tarjeta: las tarjetas son los trabajos (borde 1 px + Reposo, radio lg, 16 px). El rótulo de grupo es un título (1,0625 rem/700 Tinta a 390; 0,9375 rem en la tabla), de 22 px de alto |
| ③ | «🔒 Cerrados» gastaba dos tarjetas: su rótulo y «Ver 2 cerrados» (65 + 88 px) | Un renglón de 44 px: el rótulo a la izquierda y el botón a su derecha |
| ④ | «Sin importe / no hay presupuesto aceptado» ocupaba media tarjeta y dejaba al cliente en 19 letras por línea | Con «Sin importe», las dos frases bajan a un renglón propio bajo los datos; el cliente y la tarea recuperan el ancho entero. Con importe, la cifra sigue arriba a la derecha |
| ⑤ | En la tarjeta EN CURSO, cuatro botones en dos filas sin orden; los cuatro filtros de cobro, en dos renglones | La rellena (el paso de hoy) a todo el ancho; debajo las demás, con el «⋯» cerrando a la derecha. Filtros de cobro en un renglón |

Nada cambia de sitio en el DOM ni de significado: mismo orden de botones (el del teclado), sin ningún `order`. No se estrena token, color, sombra ni icono. El único cambio de `jobsView.js` es M1.

### M1 (texto firmado)
Para quien no pasa `veEstadoDeCobro`, la cabecera del grupo dice «✅ Terminados», a secas; el admin conserva «✅ Terminados — cobra el resto». Firmado por el orquestador por delegación (SCRUM-1656 c.21978), registrado en SCRUM-1725 c.22052 y en `docs/microcopy/2026-11-18-SCRUM-1725-terminados-sin-cobra-el-resto.md`.

### Medidas (banco H6 sobre yaqu.app, solo lectura; «después» = JS y CSS de esta rama servidos encima)
Población: 8 pasadas (antes/después × admin/operario × 390/1280); admin 9 tarjetas en 5 grupos, operario (rol `tecnico` vestido) 3 en 2.

| | antes | después |
|---|---|---|
| Desborde horizontal de la página | 0 en las 4 | 0 en las 4 |
| Contenido de las tarjetas (cliente, tipo, tarea, dirección, importe, fecha, botones y cuál va rellena), comparado como CONJUNTO | — | idéntico: 0 líneas distintas de 9, 9, 3 y 3 |
| Tarjetas con dos rellenas · rellena que no va primera (SCRUM-1739) | 0 · 0 | 0 · 0 |
| Con tipo · con tarea · con dirección (admin; SCRUM-1670c/1679) | 5 · 3 · 6 | 5 · 3 · 6 |
| Botones de tarjeta por debajo de 44 px | 0 | 0 |
| Dónde empieza la lista a 390 (admin · operario) | 645 px · 393 px | 522 px · 317 px |
| Alto de la página a 390 (admin · operario) | 3.692 · 1.370 px | 3.546 · 1.305 px |
| Rótulo de grupo a 390 | 340×65, tarjeta | 354×22, título |
| «Cerrados» a 390 | 65 + 88 px, dos tarjetas | un renglón de 44 px |

Capturas y medidas: `docs/master/evidencias/SCRUM-1725/{antes,despues}-lista-{admin,tecnico}-{390,1280}.{png,txt}`.

### Tests
- `tests/scrum1725-lista-operario-sin-cobro.test.mjs`: 3/3, con M1 dentro (técnico y rol desconocido «✅ Terminados · N» a secas; admin, de control, su cabecera entera).
- El test distingue por construcción: exige una cabecera a cada rol y la otra al admin, así que ni «todos con — cobra el resto» ni «todos a secas» lo pasan. No se declara ninguna mutación como evidencia: el guion de un solo uso que la corría no nombraba el catálogo (guard SCRUM-1387, cazado en `guards:entrada` antes del push) y se retiró; llevarla al catálogo queda como resto.
- Vecinos: los 215 ficheros `tests/*.test.mjs` que nombran `jobsView`, `styles.css`, `docs/microcopy` o las clases de la lista → 1.824 casos · 1.815 pass · 2 fail · 7 skip. Los 2 rojos son de SCRUM-1199 y son de entorno: `express` no está en el `node_modules` de este árbol (comprobado: no existe la carpeta).

### Lo que NO se ve en las capturas, y lo que queda fuera
- **M1 no sale en las capturas del operario:** en la cuenta QA el operario no tiene ningún trabajo terminado. Lo prueba el test; en pantalla se verá cuando tenga uno.
- Hallazgos (a) y (b) de c.21809 (acciones que el técnico no debería ver; filtro «Técnico» pintado al operario) NO entran: cambian flujo. Confirmados hoy en la captura del operario: el filtro «Técnico» sigue pintado, y en sus tarjetas salen «+ Nuevo albarán», «Emitir albarán» y «Agendar».
- Escritorio: la tabla se queda tabla; solo cambian la cabecera y el rótulo de grupo.
- Pendiente: el «me gusta» del fundador sobre las capturas, y la regla 42 tras el merge (las mismas pasadas, sin `LOCAL_DIR`).

## Lista plana (S4 · 18-nov · SCRUM-1725g)

A9: comprobación → `docs/master/evidencias/SCRUM-1725/c1725g-lista.mjs`
Mutaciones: catálogo → `tests/scrum1725-lista-operario-sin-cobro.test.mjs`
Mutaciones: una vez → `docs/master/evidencias/SCRUM-1725/plana-una-pildora-mutacion.mjs`

**Por qué.** El fundador vio la lista de 1725e y dio veredicto (SCRUM-1725 c.22073): «no me acabna de gustar es muy lioso la lsita […] me molaria un listado normal como los que tenemos en otros sitios». La vuelta anterior era de ropa; ésta es de estructura.

**PASO 1, medido en yaqu.app** (cuenta QA, 1280 y 390; `g1-patron-listas.mjs`, salida en `plana-paso1-patron-listas.txt`):

| lista | `tbody` | filas de cabecera en el cuerpo | filas con píldora de estado |
|---|---|---|---|
| Presupuestos | 1 | 0 | 10 de 10 |
| Albaranes | 1 | 0 | 12 de 12 |
| Trabajos (antes) | 5 | 7 | 0 de 9 |

**Qué cambia** (`jobsView.js`, bloque `S4 · SCRUM-1725g` de `styles.css`):
- Un `tbody`, una fila por trabajo, ninguna cabecera de grupo. Columna «Estado» con la píldora de `jobStatusMeta` (la de la ficha).
- El ORDEN es el de siempre sin sus rótulos: en curso → hoy → esta semana → sin agendar → más adelante → terminados. `grupoDeTrabajo` sigue siendo la única regla (ordena, cuenta «Para hoy», decide el «▶ Empezar» relleno).
- Los cerrados siguen plegados: «Ver N cerrados» es la última fila.
- Móvil: la tarjeta gana el área `status` (a la derecha del renglón de la fecha, como en Presupuestos y Albaranes). Escritorio ≥1200 px: la celda de acciones se asegura 296 px, porque con la columna nueva el trío «Ver detalle · Enviar para firmar · ⋯» partía en dos renglones.

**Firmas y autorizaciones** (orquestador, por la delegación de SCRUM-1656 c.21978):
- c.22076 · P1 `<th>` «Estado» (registrado en `docs/microcopy/2026-11-18-SCRUM-1725-estado-en-la-lista-de-trabajos.md`) · P2 el orden · P3 los cerrados · P4 el cobro.
- c.22077 · autoriza cambiar lo que exigen `tests/scrum428-terminado-sin-cobrar.test.mjs` L71 y L178 y `tests/scrum1725-lista-operario-sin-cobro.test.mjs` L74, L89 y L92, «porque el REQUISITO cambió […] no para esquivar un rojo».
- c.22078 · amplía a 428 L130-157 y a `scripts/guard-lista-trabajos-917.mjs` B.1, C.4 y C.5.
- c.22081 · autoriza `tests/scrum816-la-lista-no-miente.test.mjs` L136-140 (pasa a exigir que la columna «Estado» existe y que su celda lleva UNA sola píldora de `jobStatusMeta`; el resto del caso no se toca) y guard-917 B.3 (pasa a «exactamente UNA píldora por fila, nunca dos apiladas», o se retira si C.4 ya lo exige idéntico).

**Lo que se PIERDE, declarado (P4):** el subtotal «por cobrar» de SOLO los terminados y la salvedad larga («N sin importe de referencia: no se sabe cuánto falta y no entran en el total.»). Queda la tarjeta «Por cobrar» (importe + «N sin importe de referencia, no entra(n)») y, fila a fila, «💰 Cobrar el resto (importe)» y «X de Y». **M1 (c.22052) queda superado**: no hay cabecera para ningún rol; su doc de microcopy se conserva, anotado.

**`resumenTerminadoSinCobrar` pierde su llamador en la lista.** El motor (`terminadoSinCobrar.js`) y sus tests unitarios (428 L109-128 y siguientes) no se tocan; su retirada, si procede, es ticket aparte del orquestador.

**Rojo primero** (código nuevo, tests sin tocar): `plana-rojo-primero.tap.txt`, 12 casos, 6 caídos (1725 ×3 por L74/L89; 428 ×3 por L71, L140 y L178). `plana-guard917-rojo.txt`: 49 comprobaciones, 5 rojas (B.1, C.4 ×2, C.5 ×2). Después: los dos tests, 13 de 13; el guard, 51 de 51 (`plana-guard917-verde.txt`).

**Mutaciones** (declaradas en el test, vistas en rojo en local con base verde y restauración byte a byte): vuelve un rótulo de grupo → caen 4 casos; `SECUENCIA` con `terminado` delante → cae el caso de 1725g; píldora vacía → cae el caso de 1725g.

**Antes/después en yaqu.app** (`c1725g-lista.mjs`; el después sirve `jobsView.js` y `styles.css` del árbol sobre producción). Capturas `antes-plana-*` y `despues-plana-*`:

| pasada | filas antes → después | tarjetas solo-antes / solo-después | orden | cifras y filtros | cabeceras | con píldora | desborde | <44 px |
|---|---|---|---|---|---|---|---|---|
| admin 1280 | 9 → 9 | 0 / 0 | idéntico | idénticos | 6 → 0 | 0 → 9 | 0 | 0 |
| admin 390 | 9 → 9 | 0 / 0 | idéntico | idénticos | 6 → 0 | 0 → 9 | 0 | 0 |
| operario 1280 | 3 → 3 | 0 / 0 | idéntico | idénticos | 2 → 0 | 0 → 3 | 0 | 0 |
| operario 390 | 3 → 3 | 0 / 0 | idéntico | idénticos | 2 → 0 | 0 → 3 | 0 | 0 |

Las tarjetas se comparan como CONJUNTOS de líneas (cliente, tipo, tarea, técnicos, dirección, importe, fecha y botones con su relleno). «Ver 2 cerrados» sigue al pie en las dos del admin. El operario no tiene filtros de cobro: ahí «filtros idénticos» compara dos vacíos y no prueba nada.

**816 y guard-917 B.3: una sola píldora por fila (c.22081).** La columna «Estado» de la P1 tumbaba el caso 5 de `tests/scrum816-la-lista-no-miente.test.mjs`, que exigía que NO existiera. Rojo primero, con el test SIN tocar: `plana-816-rojo-primero.tap.txt` (12 casos, 1 caído: «sigue la columna ESTADO»). Después de la edición autorizada, 12 de 12.
- 816 L136-140 exige ahora: el `<th>` «Estado» existe; la celda sale de `jobStatusMeta(j.status)`; y a `tdEstado` se le cuelga UNA sola cosa. FECHA, el cobro en IMPORTE y la ausencia de `cobroPillClass` siguen como estaban. El TÍTULO del caso («ESTADO y FECHA son una sola columna…») no se ha tocado: queda fuera de la autorización y hoy dice otra cosa que lo que el caso comprueba.
- guard-917 B.3: **se REESCRIBE, no se retira.** C.4 no lo exige idéntico: lee solo la PRIMERA píldora de la celda de estado (`querySelector`), así que dos apiladas le pasarían. B.3 cuenta todas las píldoras de la fila (`.status-pill` y la antigua `.jobs-estado-pill`) y exige exactamente una, con suelo («no pinta ninguna fila» es NO SUPE MIRAR). Sus otras dos comprobaciones (la fecha o nada) no cambian. El guard sigue en 51 comprobaciones.
- Visto en rojo con una mutación real (dos píldoras apiladas en la celda), base verde antes y restauración byte a byte: `plana-una-pildora-mutacion.txt`. Cae 816 caso 5 («se le cuelga 2 vez/veces») y cae B.3 («11 de 11 filas no llevan exactamente UNA píldora»). Commit previo a la inyección: `e0d5402528dc9fcdff6b3720974df3733c31488e`.

**Lo que NO queda probado, y lo que queda fuera:**
- `guard:escalera-por-estado` sale ROJO (4 hallazgos, 2 ciegos: «el detalle (ninguna)») **también con la lista y la hoja de `origin/main` 34939a6ad**: es del detalle del Trabajo, no de esta rama. Reportado al orquestador.
- En la cuenta QA ningún terminado tiene saldo: «💰 Cobrar el resto» en su fila lo prueba el guard-917 (C.5, banco local), no la captura.
- Pendiente: el «me gusta» del fundador sobre las capturas, y la regla 42 tras el merge (las mismas pasadas, sin `LOCAL_DIR`).
- Dos mensajes míos al orquestador llevaban una hora ESTIMADA («~16:40Z», «~17:05Z») y era falsa por exceso: la de GitHub a esa altura era 16:17Z. La hora se lee de `gh api -i zen`.


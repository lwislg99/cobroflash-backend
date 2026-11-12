# SCRUM-1652 · las 39 marcas del verano dicen quién aprobó de verdad

Hijo de SCRUM-1645 (que es del censo, `area-s3`). Abierto por el orquestador el 3-nov-2026 y
repartido a S4 en tres tramos (descripción del ticket). **Este tramo 1 es SÓLO la tabla de
procedencia**: no toca ningún fichero de código ni ningún texto que vea el profesional.

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-03T07:53:47Z (cabecera `Date:` de GitHub) · árbol `wt-s4-3nov-1645`
A9: aviso → cicatriz S4 «crucé los 200k sin verlo porque no medí el contexto entre llamadas: lo medí al ir a entregar y ya iba por 231k» — no se pudo comprobar: el contexto vive en el jsonl de la sesión y ningún test lo lee
**Skill UI:** no cargada · este tramo no toca ninguna pantalla: sólo nombra ficheros de `public/` en la tabla

## La población, y que el 39 es reproducido, no copiado

- Entrada: `grupos.json` y `clase.json` de SCRUM-1649 (rama `scrum-1649-censo-marcas-del-fundador`,
  punta `4887a06197199b18dad94eaa90afdcfdf0b26cc5`, PR #3028 ABIERTO). Esos dos ficheros salen de
  `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs` (su `MARCA`, sobre `src`, `public`,
  `tests` y `scripts`) sobre este mismo `main`.
- «Verano» = la fecha que la marca RECLAMA es de julio o agosto. «Sin palabra del fundador» = su
  grupo no empieza por `1` (1a literal en Jira · 1b cuestionario transcrito · 1c ficha de microcopy
  con id).
- Recuento: `node docs/master/evidencias/scrum1652/los39.mjs <grupos.json> <clase.json> <salida>` →
  **258 marcas · 57 del verano · 39 sin palabra del fundador**. Es el mismo 39 que dio el 2-nov,
  por el mismo camino, en otro árbol y otra sesión: **39, reproducido, no copiado.**
- Por grupo: 15 «verano, ticket sin leer» · 10 «asesor/sesión en el ticket» · 9 «el ticket citado
  no dice nada» · 3 «asesor nombrado en la marca» · 1 «asesor + fundador» · 1 «sesión dice
  fundador, sin sus palabras».
- Autoría: `node docs/master/evidencias/scrum1652/blame39.mjs <árbol> <los39.json> <salida>` (git
  blame de la línea que lleva la marca). Para `jobDetailView.js` y `productsView.js` el blame cae en
  `ca9839569` (sólo renormaliza fin de línea): se repitió con `-w --ignore-rev ca9839569`.

## 🔴 Lo que NO hay, y por qué pesa

- **Las transcripciones de las sesiones del verano ya no existen en esta máquina**: la más antigua
  es del 6-oct-2026 (medido sobre `~/.claude/projects/*`). Así que la prueba más fuerte —el turno
  que escribió el fundador en el chat— **no se puede mirar** para ninguna de las 39. Eso es «no
  pude mirar», no «no la hay».
- **Las 39 líneas las escribió una sesión de Claude**: todos los commits llevan `Co-Authored-By:
  Claude` salvo cuatro (`b330922b6`, `df4bc5d57`, `80b60238e`, `5db4a5185`), y ninguno de esos cuatro
  cita palabras del fundador. Un commit que dice «aprobado por el fundador» es lo que dijo la
  sesión, no lo que dijo él.
- 🔴 **«El fundador» no dice cuál de los dos.** 20 de las 39 líneas las escribió una sesión con la
  identidad de git de Javier, y el equipo de Javier llama «el fundador» a Javier
  (`docs/equipo/limites-del-fundador.md:313-316`). Una marca así puede referirse a cualquiera de los
  dos jefes. Ninguna de las 39 lo dice.

## La tabla

Clases: **COMPROBABLE** = hay palabras del fundador con localizador · **ASESOR** = consta que lo
aprobó el rol «asesor» o una sesión, y dónde · **NO CONSTA** = nadie dice con nombre quién lo
aprobó en ningún sitio leído · **POR VERIFICAR** = hay una pista que no se ha leído.
Quién leyó: **S4** = a mano hoy · **ag** = agente de sólo lectura hoy (19 tickets, dato no cotejado
salvo SCRUM-151) · **2-nov** = lecturas de SCRUM-1649 (`lecturas.json`, dato de agente).

| # | marca (`main` 70eefc40c) | dueño | commit de la línea (autor git) | lo que dice Jira | clase |
|---|---|---|---|---|---|
| 1 | `src/core/http/adminRouteDeclarations.ts:213` | S1 | `3c34b8afc` 24-ago (Javier) | 614 c.13977: la sesión dice «decisión del fundador» sin sus palabras (ag) | NO CONSTA |
| 2 | `src/core/http/publicNotFound.ts:70` | S1 | `58d6d136d` 30-jul (Luis) | 206: nada (2-nov) | NO CONSTA |
| 3 | `src/modules/invoicing/domain/lineasFacturables.ts:42` | **J1** | `acc28cc9a` 3-ago (Luis) | 264: lo dice el asesor (2-nov) | ASESOR |
| 4 | `src/modules/invoicing/domain/lineasFacturables.ts:58` | **J1** | `acc28cc9a` | ídem | ASESOR |
| 5 | `src/modules/invoicing/domain/portonDocumento.ts:46` | **J1** | `58d6d136d` 30-jul (Luis) | sin ticket | NO CONSTA |
| 6 | `src/modules/jobs/domain/albaranFirmante.ts:1` | S1 | `2b6c4ab62` 6-ago (Javier) | 300: lo dice el asesor (2-nov) · 289 c.12296 «decisión del asesor» (ag) | ASESOR |
| 7 | `src/modules/jobs/domain/albaranFirmante.ts:87` | S1 | `3897b13a0` 6-ago (Javier) | 300, ídem; el commit dice «aprobadas por el asesor y validadas por el fundador» sin su palabra | ASESOR |
| 8 | `src/modules/jobs/domain/albaranFirmante.ts:126` | S1 | `642be0e3c` 5-ago (Javier) | 300, ídem | ASESOR |
| 9 | `src/modules/jobs/domain/albaranWhatsApp.service.ts:142` | S1 | `1ee4b2757` 27-jul (Luis) | 62: lo dice el asesor (2-nov) | ASESOR |
| 10 | `src/modules/maintenance/domain/maintenance.service.ts:26` | S1 | `64ed1394b` 7-ago (Javier) | 394: lo aprueba el asesor (2-nov) | ASESOR |
| 11 | `src/modules/products/app/routes/products.routes.ts:282` | S1 | `3c34b8afc` 24-ago (Javier) | 614 c.13977, como la 1 (ag) | NO CONSTA |
| 12 | `src/modules/reports/domain/desgloseEmpleado.ts:48` | S1 | `ed96e9357` 29-jul (Luis) | 236: lo dice el asesor (2-nov) · 228 c.11596 cita el propio comentario del código (circular, ag) | ASESOR |
| 13 | `src/modules/system/merchantAdmin.ts:98` | **J3** | `0c231f099` 5-ago (Luis) | 338: lo aprueba el asesor (2-nov) | ASESOR |
| 14 | `src/modules/whatsappBot/domain/botFlow.service.ts:129` | **J2** | `46962e692` 5-jul (Luis) | sin ticket; el commit dice «cambio de master K1 aprobado» (el máster no se ha mirado) | NO CONSTA |
| 15 | `public/dashboard/js/albaranDetailView.js:215` | **S4** | `f5bfcd3c7` 5-ago (Javier) | 302: 2 comentarios (c.12450, c.12451), ninguno aprueba el rótulo (S4) | NO CONSTA |
| 16 | `public/dashboard/js/albaranDetailView.js:221` | **S4** | `2ab294f88` 6-ago (Luis) | 302, ídem (S4) | NO CONSTA |
| 17 | `public/dashboard/js/albaranDetailView.js:234` | **S4** | `34a494fc8` 5-ago (Javier) | 302, ídem (S4) | NO CONSTA |
| 18 | `public/dashboard/js/albaranDetailView.js:332` (marca en :335) | **S4** | `1efdd32c3` 6-ago (Javier) | 379 c.12499 (6-ago): «Microcopy firmada», sin decir quién (S4). El 2-nov lo leyó como «lo aprueba el asesor»; yo leo que no nombra a nadie | NO CONSTA |
| 19 | `public/dashboard/js/exportView.js:363` | S2 | `b949b9a53` 4-sep (Javier) | 714: nada (2-nov); pero `docs/master/SCRUM-714.md:105` dice «firmó el 17-ago… consta APLICADO en…», sin leer | POR VERIFICAR |
| 20 | `public/dashboard/js/jobDetailView.js:401` (marca en :405) | S2 | `d77939aba` 5-ago (Javier), SCRUM-304 | SCRUM-304 sin leer | POR VERIFICAR |
| 21 | `public/dashboard/js/jobDetailView.js:484` | S2 | `988fd8d71` 5-ago (Javier), SCRUM-303 | SCRUM-303 sin leer | POR VERIFICAR |
| 22 | `public/dashboard/js/jobsCierreTrabajo.js:37` | S2 | `ef29ad051` 5-ago (Javier) | 299 c.12188 y 344 c.12313: la sesión dice «aprobada» sin palabra del fundador (ag) | NO CONSTA |
| 23 | `public/dashboard/js/onboardingView.js:48` | **J3** | `b330922b6` 10-ago (Luis, sin Claude) | 338: lo aprueba el asesor (2-nov) | ASESOR |
| 24 | `public/dashboard/js/productsView.js:1178` | S2 | `0c231f099` 5-ago (Luis) | sin ticket | NO CONSTA |
| 25 | `public/dashboard/js/productsView.js:1214` | S2 | `9d08356aa` 5-ago (Luis) | sin ticket | NO CONSTA |
| 26 | `public/dashboard/js/quotesView.js:405` (marca en :426) | S2 | `df4bc5d57` 19-ago (Luis, sin Claude): «copiados LITERALES del fichero aprobado» | 284: nada (2-nov); el «fichero aprobado» no se ha buscado | POR VERIFICAR |
| 27 | `public/dashboard/js/settingsView.js:3` | **J3** | `683c68987` 12-ago (Luis) | 298: nada (2-nov) | NO CONSTA |
| 28 | `tests/scrum1041-facturas-emitidas-sin-marcador.test.mjs:1` | ? | `80b60238e` 22-sep (Luis, sin Claude) | 1041: el agente no vio aprobación; pero `docs/microcopy/2026-09-22-SCRUM-1041-facturas-emitidas.md` dice «Aprobado por el orquestador por delegación… SCRUM-1041 comentario 16306» (22-sep), sin leer | POR VERIFICAR |
| 29 | `tests/scrum151-motivo-sin-tramo.test.mjs:1` (marca en :20) | ? | `36e4ac16f` 27-jul (Luis) | **151 c.11124 (27-jul): la sesión transcribe al fundador entre comillas y en primera persona: «El texto actual es FALSO tras mi decisión de hoy…»** (S4) | **COMPROBABLE** |
| 30 | `tests/scrum1609-fecha-de-cobro-de-una-en-una.test.mjs:1` | ? | `74fea4319` 26-oct (Javier) | 397: lo aprueba el asesor (2-nov) | ASESOR |
| 31 | `tests/scrum284-configuracion-submenus.test.mjs:131` | ? | `33289c5ee` 12-ago (Luis) | 277 c.13270 «APROBADOS 33 de 35… por delegación del fundador» (asesor) · 483 c.13367 «Aprobados por Javier» (ag; de qué textos, sin cotejar) | ASESOR |
| 32 | `tests/scrum300-firmante-ids-y-microcopy.test.mjs:1` | ? | `17f9fe8a9` 6-ago (Javier) | 300: lo dice el asesor (2-nov) | ASESOR |
| 33 | `tests/scrum404-trazo-no-se-pierde.test.mjs:106` | ? | `f75f8a075` 7-ago (Javier) | 404: el texto sigue `[PENDIENTE…]` en Jira (ag) | NO CONSTA |
| 34 | `tests/scrum411-exports-inalcanzables.test.mjs:68` | ? | `dd0862f5a` 12-ago (Luis) | 294 c.12862 «el fundador delegó, se adopta la propuesta de la sesión» (ag) | ASESOR |
| 35 | `tests/scrum557-alcance-por-identidad.test.mjs:1` | ? | `5db4a5185` 20-ago (Javier, sin Claude) | 557: nada (2-nov) · 551 c.13857 arbitraje del asesor, de otra frase (ag) | NO CONSTA |
| 36 | `tests/scrum574-mismo-cliente-tras-migracion.test.mjs:1` | ? | `b47e8341e` 24-ago (Javier) | 574 c.13973 «DECISIÓN DEL FUNDADOR» sin sus palabras (ag) | NO CONSTA |
| 37 | `tests/scrum627b-censo-declara-reimplementaciones.test.mjs:1` | ? | `a0857c6e5` 1-sep (Javier) | 627 c.14045 y 604 c.14003: decisiones del asesor; 389: nada (ag) | ASESOR |
| 38 | `scripts/censo-anclas-bloque-f.mjs:67` | sin cerradura | `5db4a5185` 20-ago (Javier, sin Claude) | 557: nada (2-nov) | NO CONSTA |
| 39 | `scripts/voice-eval.mjs:1` | sin cerradura | `d77778f0f` 5-jul (Luis) | sin ticket | NO CONSTA |

«?» en tests = `scripts/carriles.mjs de` responde NO-PUDE-MIRAR: el dueño es el puesto del ticket,
que vive en su etiqueta de Jira y no se ha mirado.

## Las cifras

| clase | marcas | cuáles |
|---|---|---|
| **COMPROBABLE** (palabra del fundador con localizador) | **1** | 29 |
| **ASESOR** (consta quién: el asesor o una sesión, y dónde) | **15** | 3, 4, 6, 7, 8, 9, 10, 12, 13, 23, 30, 31, 32, 34, 37 |
| **NO CONSTA** | **18** | 1, 2, 5, 11, 14, 15, 16, 17, 18, 22, 24, 25, 27, 33, 35, 36, 38, 39 |
| **POR VERIFICAR** | **5** | 19, 20, 21, 26, 28 |
| total | 39 | |

🔴 **Así que no son «39 marcas falsas»: son 39 marcas POR VERIFICAR, y una ya sale buena.** La 29
la aprobó el fundador de verdad y la fecha cuadra (27-jul): **no se cambia a «no consta», se le
pone el localizador** (`SCRUM-151 c.11124`). Las 15 de ASESOR no son falsas en lo que pasó, sólo en
a quién se lo atribuyen. Y de las 5 POR VERIFICAR, dos (19 y 28) tienen pistas de que sí hubo
aprobación: la 28 por delegación, el 22-sep, no el 19-ago que dice la marca.

## El alcance de esta medida (para poder seguirla)

- **Leído:** el blame y el mensaje de commit de las 39 · SCRUM-302, 379 y 151 a mano · 19 tickets
  por agente (614, 55, 365, 289, 375, 299, 1041, 151, 483, 277, 344, 294, 551, 574, 627, 389, 604,
  228, 404) · los registros `docs/master/SCRUM-<n>.md` de los tickets citados, sólo por búsqueda de
  la frase de aprobación (ninguno trae palabras del fundador; repiten lo que dijo la sesión) ·
  `docs/microcopy/` (sólo hay una ficha de esas fechas, la de 1041).
- **No leído:** SCRUM-303 y 304 · el máster (cambio K1 de la 14) · `docs/master/SCRUM-714.md:105`
  en entero · el «fichero aprobado» de `df4bc5d57` · las transcripciones del verano (no existen ya).

## Las 4 de S4: el texto propuesto (sin aplicar; tramo 1 sólo mide)

Sólo cambia el COMENTARIO. Los literales `'Duplicar'`, `'Descargar PDF'`, `COPY_DUPLICADO_CREADO` y
`COPY_ALBARAN_SIN_REFRESCO` no se tocan. El resto de cada bloque (el porqué) se queda igual.

| línea | hoy | propuesto |
|---|---|---|
| :215 | `// SCRUM-302 · APROBADO por el fundador el 5-ago-2026: es la palabra del ticket…` | `// SCRUM-302 · PROCEDENCIA NO CONSTA: lo dio por aprobado la sesión que lo escribió (commit f5bfcd3c7, 5-ago-2026) y nadie lo firma en SCRUM-302 (SCRUM-1652). Es la palabra del ticket…` |
| :221 | `// SCRUM-302 · APROBADO por el fundador el 6-ago-2026: VERBO, como sus dos vecinos de la barra.` | `// SCRUM-302 · PROCEDENCIA NO CONSTA: lo dio por aprobado la sesión que lo escribió (commit 2ab294f88, 6-ago-2026) y nadie lo firma en SCRUM-302 (SCRUM-1652). VERBO, como sus dos vecinos de la barra.` |
| :234 | `// SCRUM-302 · APROBADO por el fundador el 5-ago-2026. Dice lo que SÍ trae ANTES…` | `// SCRUM-302 · PROCEDENCIA NO CONSTA: lo dio por aprobado la sesión que lo escribió (commit 34a494fc8, 5-ago-2026) y nadie lo firma en SCRUM-302 (SCRUM-1652). Dice lo que SÍ trae ANTES…` |
| :335 | `// FIRMADO por el fundador el 6-ago-2026. Dice las dos cosas…` | `// PROCEDENCIA NO CONSTA: el cierre de SCRUM-379 (c.12499, 6-ago-2026) dice «Microcopy firmada» sin decir quién firmó (SCRUM-1652). Dice las dos cosas…` |

⚠️ **Antes de aplicarlo, correr la tanda de los censos de microcopy** (`scrum921c`, `scrum387`,
`scrum1157`, `_microcopy-aprobada`): una marca que deja de decir «aprobado» puede SALIR del censo de
firmas y ENTRAR en el de textos sin firma. Si un trinquete sube, eso es la verdad que el trinquete
tiene que ver, y se dice con su cifra: no se reescribe la marca para esquivarlo (regla 41).

## Lo que queda para el fundador

Sólo esto: **«¿quieres cambiar alguno de estos textos?»** — y ya NO bloquea nada. El texto que ve
el profesional no cambia ni un carácter con este ticket; cambia la etiqueta de procedencia que
llevamos nosotros.

## Lo que sigue

- **Tramo 1 (S4, sesión nueva):** aplicar las 4 de arriba, con la tanda de censos delante.
- **Tramo 2 (cuando entren las 16 ramas paradas):** las 28 de otros puestos de nuestro equipo, en
  UN commit, con la excepción de carril declarada en el propio commit. La 29 se ancla (no se
  cambia), y las 5 POR VERIFICAR se leen antes.
- **Las 7 de Javier** (3, 4, 5, 13, 14, 23, 27) no se tocan: las pasa el orquestador a su equipo.
- **Tramo 3:** el trinquete, con su rojo visto primero.

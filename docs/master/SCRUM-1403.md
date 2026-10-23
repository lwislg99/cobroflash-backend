# SCRUM-1403 · Las otras dos puertas: fichas de presupuesto y ficha de cliente — y lo que este PR NO cierra

**CRUCE DE CARRIL:** el ticket es `area-j2` y lo trabaja J4 por encargo del orquestador, porque J2 estaba con SCRUM-1400 (declarado en Jira, c.18037).

**Medido contra:** `origin/main` = `35e1060e365a4cc11f16e4ccee393581679e73d9` · 2026-10-02T05:47:22Z

2-oct-2026 · **J4b** (puesto J4, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J4b. Las frases del fundador las cito de Jira, leídas allí: SCRUM-1346 c.17932 y c.17952,
SCRUM-1390 c.17962. Las respuestas del orquestador que cito me llegaron por mensaje el 2-oct.]

A9: aviso → cicatriz J4 «imprimí como control de una sonda que la garantía retenida viajaba en 0 fichas de 6 sin haber sembrado ninguna garantía: un cero que no podía fallar, puesto al lado de siete cifras que sí medían» — no se pudo comprobar: la sonda era mía y de un solo uso, y un control que no puede fallar no lo distingue nadie desde fuera sin saber qué se sembró.

## 🔴 Lo primero: este PR NO cierra el ticket

Las dos frases, enfrentadas, como en el registro de SCRUM-1397:

- ⛔ **FALSO:** «el Técnico ya no reconstruye el total del negocio».
- ✅ **VERDADERO:** «el Técnico ya no lo reconstruye **por las rutas de factura, ni por las fichas de
  presupuesto, ni por la pestaña de documentos de la ficha de cliente**».

**`stats.totalPaid` de la ficha de cliente SIGUE dando 1.050 de 1.050.** Qué recibe un Técnico de las
cifras de esa ficha es decisión del fundador; está pedida (2-oct-2026) y sin contestar. El control ④
del ticket («repetir la sonda completa de J2a y que ninguna de las tres cifras salga») **hoy no se
cumple**: salen dos de tres. El test lo sujeta con un aserto que dice esto mismo y que pasará a
`notEqual` cuando haya decisión.

## Ⓐ La medición que pedía el ticket: la ficha de cliente

Cómo: `dist/` de `35e1060e`, la app real por HTTP, sesión de Técnica, Prisma de verdad sobre un banco
desechable. El negocio es el FABRICADO de J2i (4 clientes, 4 presupuestos, 4 facturas; el panel dice
1.050 y 900 de Blas), y encima un gasto de 30, tres eventos «Pago recibido» sembrados a mano con la
forma que escribe `psp.routes.ts` (ese camino se leyó, no se ejecutó), un cliente C5 que da de alta la
propia Técnica por HTTP y un C6 con un Trabajo suyo. Seis clientes.

**Los dos límites:** el negocio es fabricado, así que esto no dice nada de los datos de ninguna cuenta;
y el banco es PGlite (Postgres 18.3), no el Postgres 16 del check obligatorio.

**Reproducido** con la sonda de J2a sin tocar: 100 de 1.050 por la lista de facturas, 1.050 de 1.050
por las fichas de cliente, 900 de 900 por las de presupuesto (`sonda-de-j2a.ANTES.salida.txt`).

**Y no es una cifra: son siete.** Sumando las seis fichas, la Técnica saca del negocio entero, exactas:

| de dónde | cifra | cómo se llama en pantalla |
|---|---|---|
| `stats.totalPaid` | 1.050 de 1.050 | «Cobrado» |
| `stats.totalBilled` | 1.450 de 1.450 | «Facturado» |
| `stats.totalPending` | 400 de 400 | «Pendiente de cobro» |
| `stats.profit` | 1.020 de 1.020 | «Beneficio» |
| `stats.totalExpenses` | 30 de 30 | viaja y no se pinta |
| las facturas de la pestaña (20 por ficha) | 1.050 de 1.050 | lista |
| los eventos «Pago recibido» (50 por ficha) | 1.050 de 1.050 | historial: el importe va dentro del TEXTO |

«Cobrado» y «Beneficio» por cliente son lo que la tabla firmada de la Parte S1 le niega en Inicio. En
la LISTA de clientes no viaja dinero (0 claves): eso ya lo cerró SCRUM-1043.

**Las tres salidas**, calculadas con la puerta real de SCRUM-1397 contra la misma base (ninguna está
construida: es una cuenta hecha con el criterio de verdad, no un comportamiento visto):

| salida | suma por `totalPaid` | fichas que abre | lo que cuesta |
|---|---|---|---|
| 1 · no recibe los agregados | 0 de 1.050 | 6 de 6 | Servidor: no mandarle las cinco cifras. Pantalla: quitarle cuatro tarjetas, sin texto nuevo. Mismo criterio que ya aplica este fichero al saldo de la lista (SCRUM-1043) y a la garantía retenida (SCRUM-1108). |
| 2 · los recibe sólo sobre lo suyo | 100 de 1.050 | 6 de 6 | En 2 de 6 fichas «Cobrado» diría una cifra que no es lo que el cliente ha pagado, bajo el mismo rótulo: o el rótulo miente o hace falta texto firmado. «Beneficio sobre lo suyo» no tiene criterio: nadie ha decidido qué gasto es suyo. |
| 3 · la ficha ajena no se abre | 100 de 1.050 | 2 de 6 | Deja de abrir C2, C3, C4 y **C5, el cliente que ella acaba de dar de alta**: `Customer` no guarda quién lo creó, y contarlo pide columna nueva (regla 40). Contradice «el técnico ve la cartera entera» (SCRUM-979) y el motivo con que la ruta está abierta, «la ficha del cliente que va a visitar». |

**Los eventos van aparte de las tres**, porque con cualquiera la ficha seguiría dando 1.050: seis
sitios de `src/` escriben el importe dentro del texto del evento (pago recibido en dos, factura
emitida, presupuesto enviado en dos, disputa) y sólo un tipo guarda a qué documento se refiere. No se
pueden recortar por «suyo», sólo por tipo. Tampoco lo decido yo: va al fundador con sus tres salidas
(no mandarle los tipos con importe, mandárselos sin el detalle, o dejarlo y decirlo).

Sonda y salida: `docs/evidencias/scrum1403/sonda-ficha-de-cliente.*`.

## Ⓑ Qué se ha construido

- **Presupuestos, lista y ficha** (rutas 2 y 3 del censo de SCRUM-1390). Una puerta hermana de la de
  las facturas, `src/core/documentos/accesoAlPresupuesto.ts`: el Técnico ve un presupuesto si es su
  autor, si lo tiene asignado como documento o si el Trabajo es suyo (el que lo abrió, o un adicional).
  La lista recibe el recorte en `AND`, así que ni buscar ni filtrar por autor abren la puerta: pedir
  los de un compañero devuelve, de esos, los que además son suyos. La ficha ajena contesta 404, igual
  que la que no existe.
- **Ficha de cliente, pestaña de documentos:** sus 20 presupuestos y sus 20 facturas pasan por esas dos
  puertas. La ficha se le sigue abriendo entera. Aprobado por el orquestador: es la regla ya firmada, y
  el máster nombra «la ficha del cliente» entre los diez sitios.
- **Cómo comparte criterio con la puerta de SCRUM-1397** (el ticket pedía no escribir una segunda): quién
  ve todo lo dice `seesAllJobs` en las dos, y «los Trabajos de la persona» se leen en un solo sitio,
  `trabajosDeLaPersona`, que he sacado de `whereFacturasVisibles` sin cambiar lo que hace. No va todo
  en el mismo fichero porque el banco de mutaciones de 1397 exige que cada ancla aparezca UNA vez en él.

**Dos cosas que no estaban pedidas, y son del lado laxo (c.17932):**

1. **Las revisiones.** Al revisar un presupuesto se copian el autor y el Trabajo, pero no los asignados
   al documento: quien lo lleva por asignación perdía justo la versión vigente. Es suyo todo el grupo
   {merchant, número} de uno suyo. Aceptado por el orquestador.
2. **Las facturas dentro de la ficha de un presupuesto suyo** se le enseñan todas, aunque la puerta de
   facturas no le dejaría abrir alguna por su ruta (el caso: presupuesto suyo sólo por asignación al
   documento). No he tocado el criterio de 1397; si esa puerta tiene que ganar ese eje, es otro ticket.

**Tocado fuera de lo mío, y dicho:**

- `tests/scrum1397-el-tecnico-ve-sus-facturas.test.mjs`: tenía un suelo puesto por J2a para este día
  («la lista de presupuestos por autor ya no contesta; re-mide qué prueba este caso») y saltó. Re-medido:
  los ids del compañero se le dan al cálculo desde lo sembrado (el peor caso) y el suelo exige ahora que
  la lista siga vacía. El caso sigue cayendo con «1050 = 1050» si la lista de facturas se abre.
- `tests/scrum1108-aviso-garantia-retenida.test.mjs`: su doble de Prisma no tenía `job.findMany`, que
  la ficha 360 de un Técnico ahora llama; contestaba 500. Añadido al doble, sin tocar ningún aserto.

**Sin tocar:** `stats` y los eventos de la ficha de cliente; `prisma/schema.prisma`; `requireRole`; el
camino de emisión (en `quotesAdmin.routes.ts` sólo cambian los dos `GET` de lectura y un import); ningún
texto de usuario; ningún workflow. Y fuera de este ticket: el PDF, las notas, aceptar, rechazar y
enviar de un presupuesto ajeno (ruta 4 y las cinco de acción del censo de SCRUM-1390) siguen abiertas.

## Ⓒ Lo corrido

Todo en local contra PGlite 18.3, un banco nuevo por pasada. **El veredicto que cuenta es el del check
obligatorio, contra `postgres:16` y sobre el merge.**

- **Rojo primero** (commit `0cea365b`, el test solo contra el `src` de `main`): 6 caen de 6
  (`rojo-contra-src-de-main.salida.txt`). ⚠️ Dos de los seis —los dos últimos sin base— caen sólo porque
  el fichero de la puerta no existe: es un rojo por ausencia, más débil que los otros cuatro.
- **Verde:** `tests/scrum1403-el-tecnico-y-las-otras-puertas.test.mjs`, 6 de 6, 0 saltos. El de
  SCRUM-1397, 5 de 5.
- **La sonda de J2a, completa y sin tocar, después** (`sonda-de-j2a.DESPUES.salida.txt`): facturas 100
  de 1.050 · fichas de presupuesto 0 de 900 · facturas de la pestaña del cliente 100 de 1.050 ·
  🔴 `totalPaid` 1.050 de 1.050.
- **El banco de mutaciones de SCRUM-1397** (`tests/banco-scrum1397/mutar.mjs`), para saber si mi
  extracción lo dejaba ciego: 18 caen de 18 · 0 mudas · 0 vivas · 0 ciegas · sus dos controles como
  deben · árbol intacto (`banco-de-1397-tras-la-extracción`: el fichero es
  `banco-de-1397-tras-la-extraccion.salida.txt`). Con el turno del orquestador.
- **Mi sonda, después** (`sonda-ficha-de-cliente.DESPUES.salida.txt`): las cinco cifras de `stats` y los
  eventos siguen EXACTOS; las facturas de la pestaña bajan a 100 de 1.050 y los documentos ajenos, a 0
  de 3 y 0 de 3. ⚠️ La salida de ANTES conserva la línea del control de la garantía que no valía (está
  tal como se midió); el guion subido ya no la imprime. Y la última frase que imprime el guion («la
  pestaña… sigue trayendo lo ajeno») describe el ANTES: en la salida de DESPUÉS ya no es verdad para la
  pestaña, sí para los eventos.
- **Los que nombran mis ficheros**, de uno en uno y sin base: 37 ficheros, 276 casos, 1 caía (el doble
  de scrum1108, arriba) y 2 saltan por `QA_DB_TEST`; con el doble arreglado, scrum1108 8 de 8. Otros 11
  elegidos por tocar rutas de presupuesto o cliente como Técnico, más scrum237, scrum409 y scrum836: 97
  casos, 0 caen, 2 saltos.

- **Tras mezclar `main` (`5d7aaebc`, sin conflictos; entró SCRUM-1400 en `quotesAdmin.routes.ts`):**
  build, mi test 6 de 6, el de 1397 5 de 5, la sonda de J2a igual que arriba, `npm run guards:entrada`
  12 guards y 152 casos en verde, y 18 ficheros más de uno en uno (los censos de tenencia y de origen,
  scrum267, scrum1294, scrum419, scrum55, scrum411, scrum525d, scrum854, scrum836, scrum237, scrum409 y
  los cuatro que piden la ficha de cliente con dobles): 165 casos, 0 caen.
- **Un rojo MÍO que la lista «los que nombran mis ficheros» no veía**, y lo cazó elegir a mano los
  censos: `scrum289` («todo sitio que ata una factura a su origen está CENSADO») cayó porque metí el
  recorte en la ficha de cliente con un `...spread`, y el censo lee el `where` del texto: el fichero lo
  avisaba dos líneas más abajo. Arreglado en el código (el recorte va como `AND:` dentro del `where`
  literal, `undefined` para quien ve todo), no en el censo. Es justo la clase de rojo que la dirigida
  habría enseñado y que hoy queda para el obligatorio: puede haber otro igual que yo no haya elegido.

**NO corrido, y por qué:**

- **La dirigida** (`node scripts/tests-que-cubren.mjs`: 304 ficheros de 1.202). Decisión del
  orquestador: en local diría que pasan; el obligatorio prueba el merge y corre los 1.202.
- **Los gateados por `QA_DB_TEST`** (staging). Leídos: `tenancy-permisos` y `scrum148` piden las rutas
  de presupuesto con sesión de ADMIN, a la que la puerta no recorta. No ejecutados.
- **Un banco de mutaciones propio** para la puerta de presupuestos. No está escrito. Lo que hay es el
  rojo de arriba y los casos con nombre por camino; qué mutaciones de `accesoAlPresupuesto.ts` quedarían
  vivas está sin medir.
- **Nada visto en navegador ni en yaqu.app.** Qué pinta la pantalla de Presupuestos de un Técnico sin
  ninguno suyo, y qué enseña la ficha de un presupuesto ajeno abierta por enlace (ahora 404), sin mirar.

## Ⓓ Mis errores

- El control de la garantía retenida que no podía fallar (línea `A9:`). El orquestador lo dijo mejor
  que yo: un control que no puede fallar es un comentario, no un control.
- Mi primer control positivo del «¿hay ya rama de este ticket?» usó la rama de SCRUM-1388, que ya
  estaba mergeada y borrada: salió vacío y no probaba nada. Lo repetí con una rama viva (la de 1334).
- Medí mi contexto por primera vez a 361.789; el encargo pedía avisar a 200.000.

## J2 · SCRUM-1403b · la decisión del fundador: el Técnico no recibe las cifras, y los eventos con importe le llegan sin el detalle

**Medido contra:** `origin/main` = `3f889f9e7d9c39c3d7875c7ab297549a076f4a3c` · 2026-10-23T09:48:35Z (hora de GitHub; sesión J2 `jv-j2w`, por encargo del orquestador `cobroflash-backend-62`)

**Skill UI:** cargada (`yaqu-premium-ui`, antes de dar por buena la vista)

A9: aviso → cicatriz J2 «un banco PGlite por socket se quedó colgado sin decir por qué: Prisma abre la conexión pidiendo SSL y pglite-socket no contesta; jv-j2u perdió 5 h y yo lo vi al tercer intento, con `sslmode=disable` en la URL arranca en 3 s» — no se pudo comprobar: el banco vive en un temporal de la sesión y no en el repositorio, así que no hay fichero que un guard pueda leer; lo cerraría un banco de la casa que se niegue a arrancar sin `sslmode=disable`, y eso es de J6.

Error del empujón (relevo `jv-j2aa`): el caso nuevo con base (eventos y cifras) se empujó sin declararlo en el
inventario de gateados (3 → 4) y el obligatorio de #2715 cayó en 2 casos de ese guard; la pasada local de 66
vecinos no lo llevaba. Declarado con su motivo; el guard que lo cazó:

A9: comprobación → `tests/scrum419-ci-declara-lo-que-no-corre.test.mjs`

Carril: J2. La decisión es del fundador en SCRUM-1403 **c.20375** (23-oct-2026), leída en Jira: a la pregunta 1
de c.18040, **salida 1**, «no recibe los agregados»; a la pregunta 2, «mandárselos sin el texto del detalle».
Lo de #2130 (presupuestos y pestaña de documentos por rol) no se toca.

### ① Lo construido

- **Servidor** · `GET /admin/customers/:id/detail` (`customersAdmin.routes.ts`): con `seesOnlyOwnJobs(req.userRole)`
  —la misma pregunta que el saldo (SCRUM-1043) y la garantía (SCRUM-1108)— `stats` no lleva `totalBilled`,
  `totalPaid`, `totalPending`, `totalExpenses` ni `profit`. `pendingCount`, `totalQuotes` y `acceptedQuotes` siguen
  (son recuentos, no dinero, y c.20375 nombra cinco cifras). Los eventos pasan por `eventosSinImporte`.
- **Eventos** · `customerEvents.service.ts`: `TIPOS_CON_IMPORTE_EN_EL_DETALLE` = `payment_received`,
  `invoice_issued`, `quote_sent`, `dispute_created`, `payment_anomaly`. **Son 7 sitios, no 6**: a los seis de
  c.18040 se suma `payment_anomaly` (`invoicesAdmin.routes.ts`, «Recibidos X de Y (faltan Z)»). Se quita sólo
  el `detail`; el título se queda y ninguno de esos títulos lleva importe (lo comprueba el test). Ninguno de los
  siete escribe `meta`. **Ningún evento queda vacío y no hace falta ningún rótulo nuevo**: la condición de c.20375
  no salta.
- **Vista** · `customerDetailView.js`: una tarjeta con cifra de dinero («Pendiente de cobro», «Facturado»,
  «Cobrado», «Beneficio») se pinta sólo si su cifra viene. Sin texto nuevo, sin tokens nuevos (skill
  `yaqu-premium-ui` leída: se quitan tarjetas, la rejilla `auto-fill` se recoloca). «Pendiente de cobro» también
  se quita: la vista tenía un respaldo que la sumaba sobre las facturas de la pestaña, que al Técnico sólo trae
  las suyas — misma cifra bajo el mismo rótulo diciendo otra cosa.
- **Dueño y administrador, sin cambios**: lo demuestra el test por la ruta real (abajo).

### ② El test cambia con la decisión — no es relajarlo

`tests/scrum1403-el-tecnico-y-las-otras-puertas.test.mjs`: el caso ④ sujetaba `equal(porCifras, TOTAL)` como
SUELO de «sigue abierto, espera al fundador». Con c.20375 pasa a `notEqual` y a `0`: el control ④ del ticket es
exigible. Añade el historial (los «Pago recibido» con importe en el texto) y, como positivo por el MISMO sumador,
que la administradora y la dueña (sesión sin miembro) siguen sacando 1.050 por pestaña, cifras e historial.
Casos nuevos: los 7 sitios uno a uno (Técnico sin detalle y con título; dos eventos sin dinero, enteros;
administradora y dueña, enteros) con la ficha **pintada en el banco de vistas con la respuesta real de la ruta**;
un censo AST de los sitios que escriben un evento (con positivo sembrado: si no ve el importe de un
`detail,` a secas, dice CIEGO) que exige que todo detalle con dinero sea de un tipo de la lista; y que la ruta
pregunte a `seesOnlyOwnJobs`.

### ③ Lo corrido

Banco: PGlite por socket en loopback, base `yaqu_libro_test`, DDL de `prisma migrate diff --from-empty`
(`evidencias/SCRUM-1403/banco-1403b.mjs.txt`, derivado del de SCRUM-1218c). ⚠️ PGlite es Postgres 18; el
obligatorio corre 16.

| pasada | resultado | población |
| --- | --- | --- |
| línea base, código de `main` | 6 ok | declarado 6, 0 saltados |
| rojo, test nuevo contra código de `main` | 4 not ok · «🔴 las cifras de la ficha de cliente dan el total del negocio (1050 = 1050)» | declarado 9 |
| verde | 9 ok | declarado 9, 0 saltados |
| mutaciones (7) | 7 de 7 cazadas, árbol idéntico byte a byte (`evidencias/SCRUM-1403/mutar-1403b.salida.txt`) | 9 por pasada |
| 64 ficheros vecinos, antes del registro | 543 ok · 1 not ok (`scrum976`: faltaba este registro) · 2 saltados | declarado 546 |
| 66 ficheros vecinos (+ `scrum1387`, `scrum811c`), al final | 579 ok · 0 not ok · 2 saltados | declarado 581 |
| `npm run guards:entrada` | salida 0 · 170 casos ✔ | — |

Los 2 saltados piden `QA_DB_TEST` (staging): **no corridos**. Dos de las mutaciones (C1, C2) son
`MUTACIONES_QUE_ME_TUMBAN` del test, para el meta-guard (SCRUM-1387): sólo las que caza un caso sin base y sin
`dist/`, porque su job no tiene Postgres; las que piden base (M1-M5) las corre el guion de evidencias. C2 salió
CIEGA la primera vez (su texto aparecía también en la lista de clientes): renombré la variable de la ficha a
`sinDinero` para que el texto sea único. Por el camino, `guards:entrada` cazó tres cosas mías: el registro sin
`**Skill UI:**`, el mutador fuera del catálogo y la frase `A9:` recortada (exige la frase ENTERA de la cicatriz).

**No corrido:** la tanda completa; los gateados de staging; **un navegador de verdad** — la ficha se ha pintado
en el banco de vistas (`tests/_banco-vistas.mjs`) con la respuesta real de la ruta, no en Chromium; y yaqu.app,
que pide estar mergeado y una sesión de Técnico.

### ④ Mis errores

- Mi mutador salió CIEGO dos veces en las cinco: la ruta al banco llevaba el `%20` de «Javier Pereira». La
  primera corrección la pasé por `node -e` en bash y no casó (la cicatriz de J2 del 1-oct, otra vez); la tercera,
  con la herramienta de edición. El instrumento dijo CIEGO y no verde, que es lo que lo salvó.
- No medí el contexto al acabar el arranque por separado: la primera cifra (101,6k) es ya la de después de Jira.

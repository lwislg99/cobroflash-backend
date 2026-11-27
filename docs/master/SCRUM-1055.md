# SCRUM-1055 · El criterio de caja usa `paidAt`: medido, y PARADO — Q-C6 sigue sin respuesta

**Fecha:** 23-sep-2026 · **Carril:** facturación (excepción del día: J5 en carril fiscal, ver
`docs/equipo/orquestador.md` §11bis — el área normal de J5 sigue siendo Competencia y producto)
**Gate:** ninguno — este ticket NO construye código (STOP, ver abajo); es medición y registro de
un hallazgo colateral
**Medido contra:** `origin/main` = `65a8396864ad08625ba99eec1739edb1eedc17fd` · 2026-09-23T11:04:58Z

## PASO 0 — la pregunta de la que depende sigue sin cita

El ticket (Jira SCRUM-1055 / 16615) trae la etiqueta `esperando-asesor` y depende explícitamente,
en su propia descripción, de **Q-C6** (`docs/legal/PREGUNTAS_ASESOR.md:876-880`): *"¿Es una
aproximación aceptable para un RECC, o hace falta la fecha real del apunte bancario?"*.

El encargo pedía comprobar si esa pregunta es una de las **17 de 35** que `docs/master/SCRUM-1023.md`
(apéndice de hoy, parte 2, cerrado tras SCRUM-1039) ya da por resueltas con cita verificable. No lo
es. El propio mapa la nombra dos veces, con el mismo veredicto las dos:

- **F5** (`SCRUM-1023.md:106`): *"🟡 PARCIAL — 'no se da en servicios' respondido; **el total
  sellado (punto 2) y el criterio de caja/RECC (punto 4) siguen sin respuesta**"* → *"El punto 4,
  SÍ [necesita asesor] — duplica QC4 (parcial) y **QC6 (idéntica)**"*.
- **QC6** (`SCRUM-1023.md:132`): *"🔴 ABIERTA — pregunta IDÉNTICA a F5 punto 4, en otro sitio del
  expediente, ninguna de las dos contestada"* → *"SÍ [necesita asesor] — duplicada exacta de F5"*.

Confirmado también en la lista explícita de las 17 (`SCRUM-1023.md:153-157`): **QC6 no aparece**.
Y en "Por gravedad" (`SCRUM-1023.md:147-148`) queda clasificada sin urgencia mientras
`INVOICING_ES_ENABLED` siga OFF — coherente con lo medido más abajo (sin llamadores).

**Conclusión del PASO 0: la pregunta que falta es Q-C6/QC6/F5-punto-4 (criterio de caja / RECC).
No está entre las 17. PARO — no construyo el cambio de qué fecha decide el periodo.**

## Medido, no supuesto: qué valor acaba en `paidAt` en la práctica

El encargo pedía fabricar los casos reales antes de creerse "no siempre es la fecha correcta" y
comprobar contra el código qué llega a `paidAt`. Trazados los cuatro caminos de escritura que
importan (censo completo de los 5+1 sitios en `criterioCaja.ts` y `invoiceAdmin.ts`):

| Caso | Camino | Qué llega a `paidAt` | ¿Correcto? |
| --- | --- | --- | --- |
| Pago automático (Stripe, MercadoPago) | `psp.routes.ts`, `mpWebhook.routes.ts` | `new Date()` al recibir el webhook | ✅ — el aviso llega en el momento del cobro |
| Transferencia/Bizum marcada a mano **en lote** | `POST /admin/invoices/bulk-paid` → `resolverFechaDeCobro(body.paidAt)` | la fecha que declara la persona; `new Date()` sólo si no declara ninguna | ✅ — arreglado en SCRUM-397 (10-ago-2026, firma del fundador) |
| Transferencia/Bizum marcada a mano de **una factura**, botón del BO | `PUT /admin/invoices/:id/status` → `updateInvoiceStatusAdmin()` | `new Date()` **siempre** — la función no tiene parámetro de fecha | 🔴 **NO** — mismo defecto que SCRUM-397 cerró en el lote, vivo en su hermano de una sola factura |
| R1 (rectificativa) | `invoicesAdmin.routes.ts:1059-1060` | `new Date()` al emitirse | ✅ — una R1 no tiene un cobro aparte que registrar |

**Verdad medida: NO, `paidAt` no siempre es la fecha real del cobro.** El único hueco real está en
el marcado manual de UNA factura desde el botón individual del back-office
(`PUT /admin/invoices/:id/status`), que no heredó el mecanismo que SCRUM-397 ya construyó y el
fundador ya firmó para el marcado en lote.

## Por qué esto NO es parte de la STOP de arriba, y qué se hizo con ello

Este hallazgo no decide **qué fecha manda el periodo bajo RECC** (eso sigue bloqueado por Q-C6): es
sobre si el operador **puede declarar** la fecha real, algo ya resuelto en el mismo patrón para el
marcado en lote. No toca el sellado, la huella ni la numeración (frontera fiscal medida, no
supuesta: `updateInvoiceStatusAdmin` no llama a `emitInvoice`/`allocateInvoiceNumber`/
`applyVeriFactu`/`sellarTrasEmision` — verificado por AST en `tests/scrum397-fecha-real-de-cobro.test.mjs`,
test "REGLA 38", sobre el fichero hermano `invoicesAdmin.routes.ts`; `invoiceAdmin.ts` comparte la
misma familia y el mismo patrón sin llamadas de emisión).

Impacto real hoy: **cero fiscal** (`criterioCaja.ts`/`devengoPorCaja.ts` siguen sin llamadores; el
303 declara por `createdAt`/emisión, no por `paidAt`) — **sí afecta** `metrics.service.ts`,
`reports.routes.ts` y `weeklyDigest.service.ts`, que agrupan ingresos por `paidAt`: una
transferencia conciliada días después y marcada por ese botón puede mostrarse en el resumen/informe
del periodo equivocado.

Por regla 6 (bugs → `docs/BUGS.md`, nada de arreglos "de paso" sin registrar) se registra como
**P3-PAIDAT-BO** en `docs/BUGS.md`, hallazgo colateral de este ticket. No se ha tocado ningún
fichero de código: es un registro, no un arreglo — el arreglo (reutilizar `resolverFechaDeCobro` en
`updateInvoiceStatusAdmin`) es del carril de J1 (fiscal/facturación), donde vive también SCRUM-1055.

## Suelo

El PASO 0 se midió contra el mapa vivo de `SCRUM-1023.md` (hoy, tras cerrar SCRUM-1039), no contra
una suposición ni contra un estado antiguo del ticket. La tabla de `paidAt` cubre los 5+1 sitios de
escritura que `criterioCaja.ts` y su propio test AST (`tests/scrum397-fecha-real-de-cobro.test.mjs`)
declaran como población conocida — no hay un sexto sitio sin censar: `invoiceAdmin.ts:265` es el
mismo `:373`/lote de siempre visto por su hermano de una factura, y `invoicesAdmin.routes.ts:1059`
es el `:907` (R1) que el propio comentario de `criterioCaja.ts` ya señalaba como "otro asunto". No
se ha podido ejecutar contra una base de datos real (esta máquina no tiene Postgres): la medición es
por lectura de código determinista (la función no tiene ninguna rama que lea una fecha declarada),
no por suposición de comportamiento.

## J1 · SCRUM-1055b · tests de caja (31-mar, borde del trimestre, devolución) y propuesta de la señal «cobro sin fecha»

**Medido contra:** `origin/main` = `e1ebdcf627097b2a2efaae7b967f55b62b4b3987` · 2026-11-13T18:32:34Z (hora de GitHub; sesión J1 `jv-j1ev`, por encargo del orquestador `cobroflash-backend-63`)

A9: aviso → cicatriz J1 «Crucé los 200k (200.654) sin medirme entre el arranque (136.056) y la sonda del libro; avisó el hook del orquestador, y además leí Jira antes del arranque de normas» — no se pudo comprobar: lo impediría un hook que mire el contexto en cada turno, y los hooks no son de este puesto

Lo que faltaba tras SCRUM-1735 según la verificación de jv-j4bg (Jira c.21850). Medición y propuesta en
Jira **c.21863**. No toca `src/`, ni el esquema, ni ninguna base. El test,
`tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs`, ejecuta piezas reales de `dist/`
(`resolverInstanteDeCobro`, `rangoTrimestre`, `leerLibroRegistro` con caja, `updateInvoiceStatusAdmin`)
contra una base en memoria: 9 casos.

| lo pedido | resultado | dónde se ve |
| --- | --- | --- |
| cobro del 31-mar confirmado en abril → T1 | **funciona**: declarado `2026-03-31`, confirmado el 2-abr, devenga en el T1 y sólo en el T1, con el proceso en UTC, Madrid y Canarias | caso ① |
| borde del trimestre con zona horaria | 🔴 **DEFECTO, declarado**: `rangoTrimestre` corta en la zona del PROCESO. Con `TZ=UTC`, un cobro del 1-abr 00:30 de Madrid cae en el T1 (con `Europe/Madrid`, en el T2). La zona real de Railway **NO está medida** (`fechaDeCobro.ts` dice UTC) | caso ②, `DEFECTO_CONOCIDO.bordeEnZonaDelProceso` |
| devolución | lo que hace hoy: una F1 cobrada no se des-paga (`UnpayNotAllowedError` → «emite una R1»); la R1 nace `paid` con `paidAt: new Date()` (leído, camino de emisión) y en el libro de caja **resta en el trimestre de su emisión**, no en el de la devolución. No lo llamo defecto: pregunta candidata al asesor en c.21863 | casos ③ |
| cobro parcial | ya fijado en `tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs`, hueco (c); no se duplica | — |
| señal «cobro sin fecha declarada» | **propuesta, no construida** (regla 39): dónde se vería, dato (vía a sin esquema / vía b columna con ALTER) y tres textos literales para firmar | c.21863 §⑤ |

**Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN`, 3 de 3 vivas, aplicadas una a una con compilación, árbol
restaurado con `git restore --source=HEAD` y `git status` vacío): retirar la declaración de ②; que
`resolverFechaDeCobro` ignore la fecha declarada; que una F1 cobrada se deje des-pagar. La primera salió
**CIEGA** en mi primera pasada: su ancla aparecía dos veces (la propia declaración la contenía); se
rehízo con el salto de línea, como `scrum1732`.

**Quien arregle ②** (bordes en la zona del merchant) retira `bordeEnZonaDelProceso` de `DEFECTO_CONOCIDO`
en el mismo PR; si no, el test sale en rojo como «cambió con el defecto declarado».

**Sin medir:** la zona horaria del proceso en producción (decide si ② tiene víctimas); el libro por
emisión con el caso de ② (sólo leído: usa el mismo `rangoTrimestre`); Q-C6 sigue sin respuesta.

**Error mío:** leí Jira antes del arranque de normas (la cicatriz de 1730b, otra vez) y crucé los 200k
sin medirme entre el arranque y la sonda; avisó el hook del orquestador, no yo.

# SCRUM-1055d · la pregunta de la R1 por devolución, al asesor
**Medido contra:** `origin/main` = `4fba03364e8b7c072ad669f1d43cebda4573e022` · 2026-11-26T17:18:18Z (hora de GitHub; sesión J4 `jv-j4co`, encargo del orquestador `cobroflash-backend-2d`; la rama nace de `f336e00c2`, y los 3 commits de main entre los dos tocan 5 ficheros, ninguno de esta entrega)

A9: aviso → cicatriz J4 «busqué con git grep la línea que hace nacer pagada a la R1 en una ruta mal escrita, de un fichero que no existe, y salió 0 sin error: un cero que no podía fallar, al lado de tres búsquedas que sí medían» — no se pudo comprobar: la búsqueda era de un solo uso, fuera del repo, y git grep no avisa de una ruta que no existe

**Qué se añadió.** `docs/legal/PREGUNTAS_ASESOR.md:1041`, **Q-C10**, detrás de Q-C9 en el bloque C (criterio
de caja), con el número siguiente: con RECC, ¿la R1 emitida por la devolución de un cobro minora el IVA en
el periodo en que se EMITE o en el que se DEVUELVE el dinero? Marcada **SIN RESPUESTA**. El enunciado es el
del encargo, fiel a la pregunta candidata de c.21863 ③; el contexto, el de c.21863 ③ y la regla 29; la
decisión, del fundador en c.22857 ④ (respuesta literal «2-Ok tus recomendaciones»; c.22874 corrige el punto
2 y deja el 4 como estaba). La pregunta no se contesta aquí: es para el asesor.

**Recuentos que cambiaron.** Solo el título del bloque: «Q-C1…Q-C9» → «Q-C1…Q-C10» (línea 839). El fichero
no lleva índice de las Q-C ni recuento de abiertas: `grep "Q-C6"` da 3 líneas (la pregunta y dos menciones
junto a la 49), ninguna es fila de tabla; «sin respuesta» sale 27 veces y «RESPONDIDA» 4, y ninguna es un
contador. El índice de SCRUM-1264 (Jira) dejó fuera Q-C1…Q-C9 a propósito (`PREGUNTAS_ASESOR.md:1579`, «No
se añaden»), así que tampoco lleva fila para Q-C10. Ningún test cuenta preguntas: de los 12 tests que nombran
el fichero, el único que lee entradas Q-C es `tests/scrum1106-respuestas-ia-no-son-del-asesor.test.mjs`, y
su patrón (`Q-C` + una cifra + punto) no ve dos cifras: Q-C10 queda fuera de su población, y no es del lote
de IA que vigila.

**Lo que movió la inserción.** +14 líneas desde la 1041. Las únicas coordenadas vivas que apuntaban más
abajo y acertaban hoy eran dos de `docs/producto/DECISIONES-DEL-FUNDADOR.md` (líneas 108 y 261, la P20):
corregidas de 1118-1121 a 1132-1135 y de 1121 a 1135, y comprobado con grep que ahí están «# P20.» y su
«Nota de estado (SCRUM-665c». Los registros de `docs/master/` que citan líneas a partir de la 1041
(SCRUM-1023, 524, 1316, 1563 y evidencias de 1496b, c y f) no se tocan: cada uno se midió contra su sha.
El toque a `docs/producto/DECISIONES-DEL-FUNDADOR.md` va **fuera del encargo, consecuencia mecánica de la
inserción, fichero sin fila en §3**; avisado al orquestador antes de empujar, que lo dio por bueno.
La suite entera NO se corrió en local (1,06 y 2,04 GB libres, mínimo 2,7): la corre el CI sobre el merge,
por decisión del orquestador; en local, los dirigidos, `guards:entrada` y los 5 de árbol entero.

**Re-comprobado en el código** (solo lectura, `git grep` sobre `f336e00c2`) lo que la pregunta da por
hecho: la R1 nace pagada (`src/modules/system/app/routes/invoicesAdmin.routes.ts:1293`, `paidAt: new
Date()`; c.21863 la situaba en 1175-1176); la F1 emitida no se des-paga (`src/modules/system/invoiceAdmin.ts:395`);
el devengo por caja lee `paidAt` (`src/modules/invoicing/domain/devengoPorCaja.ts:34`); no hay `model Refund`
en el esquema, y ni `devengoPorCaja.ts` ni `criterioCaja.ts` nombran «refund» ni «devoluci». Antes de
escribir busqué por contenido: la 47 (qué régimen lleva una R1) y la 51 (la R1 de una factura aún SIN
cobrar) son vecinas y no preguntan esto; van en la pregunta como «relacionadas, que no la contestan».

**Sin medir:** el libro de caja EJECUTADO con una R1 por devolución (aquí solo se leyó código; la medición
es la de J1 del 13-nov); los literales de Jira se leyeron en el Markdown que devuelve Jira, por un agente
lector, no en el ADF; si el asesor ya tiene esta duda por otra vía.

**Error mío:** el primer `git grep` de la R1 lo lancé sobre una carpeta de rutas que no existe
(la puse bajo invoicing, y vive bajo system) y dio 0 sin error; lo vi porque era la única de las cuatro búsquedas sin
salida, y repetí con la ruta del `import`. Va a las cicatrices de J4.
# SCRUM-1055c · la señal «cobro sin fecha declarada»
**Medido contra:** `origin/main` = `f336e00c20b23a7fa11ae491c8cf8bfaa931fd6d` · 2026-11-26T17:20:35Z (hora de GitHub; sesión J1 `jv-j1kz`, encargo del orquestador `cobroflash-backend-2d`)

A9: comprobación → `tests/scrum1055c-senal-cobro-sin-fecha.test.mjs`

Mutaciones: catálogo → `tests/scrum1055c-senal-cobro-sin-fecha.test.mjs`

Alcance: SCRUM-1055 c.22857 ③ (los tres textos, firmados) y c.22874 (sin columna ni ALTER: la señal sale de
`invoice_payments.fecha_origen = 'marcado'`, SCRUM-1732 c.21928 ③). Partido con el GO del orquestador: **aquí
sólo el servidor**; la pantalla pasa al tramo **1055e** (la letra d es la pregunta al asesor, jv-j4co).

**① Lo medido antes de escribir (base del encargo de 1055e):**
- (a) La ruta del panel, `src/modules/invoicing/app/routes/libroRegistro.routes.ts:32`, NO preguntaba el criterio
  de caja: `preguntado` salía falso (`libroRegistro.repo.ts:330`), el campo era emisión y `cobrosPorFactura` no
  existía, así que en pantalla `cobros` era siempre `[]` y el origen no llegaba nunca. Sí lo preguntan el 303
  (`src/modules/fiscal/modelo303/modelo303.repo.ts:27`, con `devengo: true`) y las evidencias
  (`src/modules/fiscal/evidencias/paquete.repo.ts:50`).
- (b) El constructor ya copiaba el origen de cada cobro vivo: `cobros[].origen = fechaOrigen`
  (`src/modules/invoicing/domain/libroRegistro.ts:285` en la base). `FiabilidadDelCobro`
  (`src/modules/invoicing/domain/criterioCaja.ts:46`) no la usa nadie en `src/`.
- (c) La vista (`public/dashboard/js/libroRegistroView.js`) no pinta ninguna fecha de cobro ni `ADVERTENCIA_CAJA`:
  no hay patrón que copiar. El sitio natural es la columna de trazas, junto a la marca «Cobro»
  (`libroRegistroView.js:362`, `badge-green`), con `badge-amber`; los avisos de resumen van por `avisar()` (:216).

**② Qué cambia (servidor, carril J1):**
- La ruta pide el criterio del comercio con `criterioDelMerchantParaElLibro`, como el 303 y las evidencias. Sin
  criterio declarado es `{}` y el libro es el de siempre (por emisión, sin cobros): lo fija el caso CONTROL.
- Cada asiento de caja lleva `cobroSinFechaDeclarada: boolean` = algún cobro VIVO con `fecha_origen = 'marcado'`.
  `aviso` y `declarada` no la llevan; una anulación (nace `marcado`, `cobrosDeFactura.ts:113`) tampoco.
- El libro de caja lleva `cobrosSinFechaDeclarada` (asientos con la señal) y `cobrosSinFilas`.
- **Regla de «sin filas»:** una factura de caja `paid` SIN ninguna fila en `invoice_payments` (anteriores a 1732,
  que se leen como hoy) NO lleva la señal —no se afirma lo que no se sabe— y se cuenta en `cobrosSinFilas`.
  Para poder contarla, `filasPorFactura` da entrada `[]` a cada factura pedida (`libroRegistro.repo.ts`).
- **Cuántas hay:** en el banco del test, 1 de 6 (`F-SIN-FILAS`; la pendiente sin filas no cuenta). En staging,
  **no lo he medido**: el árbol no tiene `.env` ni `DATABASE_URL_STAGING` (no corrí `comprobar-claves-bd.mjs`).
  Queda para el fundador cuando decida qué hacer con ellas.

**③ El 303 y las evidencias:** los dos leen el libro con criterio, así que el recuento ya viaja en el objeto que
leen. Ninguno lo saca a su salida: el 303 construye sus casillas y las evidencias sus CSV y avisos
(`paquete.ts:259-267`). Sacarlo ahí toca otras salidas: **declarado para 1055e**, no hecho.

**Verdes, con población:** `tests/scrum1055c-senal-cobro-sin-fecha.test.mjs` 3 tests · 3 pass · 0 fail · 0 skip.
Mutaciones con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`: base 3 pasados, y **4 de 4**
tumban el test (la ruta sin criterio, la señal con `declarada`, el recuento a 0, el lector sin la entrada vacía).
Build con tipos (`npm run build`, sin `--noCheck`): salida 0. La suite entera la corre el CI y el orquestador
(orden suya); `censo:mudez` no lo he corrido.

**NO hecho → 1055e:** la pantalla (texto 1 en la columna de trazas, texto 2 al pasar o pulsar, texto 3 en el
resumen), su test de vista y la línea en el 303 y las evidencias.

**Errores míos:** escribí el código antes que el test. El rojo lo da la primera mutación del catálogo, que deja
la ruta como estaba (sin `...criterio`) y tumba el test. Y crucé los 200k otra vez (201.723, avisó el hook).

# SCRUM-1055e · la señal, en la pantalla del libro
**Medido contra:** `origin/main` = `81a6dda49cda4adb87e49529257568e4fc5e72c0` · 2026-11-26T17:33:17Z (hora de GitHub; sesión J1 `jv-j1la`, encargo del orquestador `cobroflash-backend-2d`; rama nacida de `scrum-1055c-senal-cobro-sin-fecha` en `39d92e280`)

Versión: 1.2 (SCRUM-1836)

**Skill UI:** cargada

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

Mutaciones: catálogo → `tests/scrum1055e-senal-en-el-libro.test.mjs`

Alcance: SCRUM-1055 c.22857 ③ (los tres textos, firmados) sobre el servidor de 1055c (c.22882). Sólo la
pantalla; el servidor no se toca.

**Qué hay y dónde se pinta** (`public/dashboard/js/libroRegistroView.js`):
- Las cuatro ranuras de `COPY` (:100-106): `etiquetaSinFechaCobro`, `explicacionSinFechaCobro`,
  `resumenSinFechaCobroUna` y `resumenSinFechaCobroVarias` (el plural es `{n}` + espacio + la cola, como
  `trazaAlbaran` + número). Ficha: `docs/microcopy/2026-11-26-SCRUM-1055-cobro-sin-fecha.md`.
- Texto 1: en la columna de trazas, detrás de «Cobro», con `marca(…, 'badge-amber')` (:380-389), sólo si el
  asiento trae `cobroSinFechaDeclarada === true`. Pastilla de Aviso de la casa: ni color ni clase nuevos.
- Texto 2: el `title` de esa pastilla. La vista no tiene otro mecanismo de ayuda.
- Texto 3: un `avisar(…, 'warning')` más en el resumen (:260-266), si `cobrosSinFechaDeclarada > 0`;
  singular con 1. `cobrosSinFilas` NO se pinta: lo decide el fundador.
- `tests/scrum296-pantalla-libro.test.mjs`: las cuatro ranuras entran en `APROBADAS` con la cita de c.22857 ③,
  y la cuenta pasa de 20 a 24, como hizo 1051h con las suyas. No se relaja nada: una ranura más sin
  clasificar seguiría tumbándolo.

**Verdes, con población:** `tests/scrum1055e-senal-en-el-libro.test.mjs` 5 tests · 5 pass (banco de vistas +
doble de `fetch`: la etiqueta sólo en el asiento con señal, el `title`, la línea con 2, 1 y 0, y los literales
cotejados con c.22857). Dirigida con 1055c, 296, 514, 402, 1051h, 628, 1233, 755, 1041 y 1232: 131 tests ·
131 pass · 0 fail · 0 skip. Mutaciones con `correr` + `aplicarUna`: base 5 pasados, y **3 de 3** tumban su
test (la condición quitada, el plural fijo, la línea con 0). Build con tipos (`npm run build`): salida 0.
Guards 1294, 267, 854, 237, 976, 700, 824 (y los dos 824b), 419, 1866 y 1850: 82 tests · 81 pass · 1 fail (976 ④:
faltaba `**Skill UI:**` en este tramo; puesta, y vuelta a correr). Después: los 5 de árbol entero que propone
`guards:entrada`, más 976, 1294, 267 y 1055e: 72 tests · 72 pass · 0 fail · 0 skip. `guards:entrada`: 17
guards, salida 0. `censo:mudez -- --escribir`: no cambia el fichero (149 fichas, 0 medidas ahora).

**NO hecho:**
- El recuento en la salida del 303 y de las evidencias (punto 4 del encargo): DECLARADO para otro tramo,
  por contexto (decisión del orquestador). Los dos leen el libro con criterio y el recuento ya viaja en el
  objeto; sacarlo a su salida está sin hacer.
- En una pantalla táctil el `title` no se ve: el texto 2 sólo llega pasando el ratón. Hacer la pastilla
  pulsable pide un objetivo de 44 px (1850), y queda para otro tramo.
- La suite entera en local: no me cabía en contexto. Corridos los guards con población y `guards:entrada`.
- Staging y yaqu.app: no lo he intentado.
- Choque previsto: 1055d (jv-j4co, todavía sin entrar) también añade su tramo al final de este fichero. El
  segundo PR en entrar tendrá conflicto aquí, y se resuelve conservando los dos tramos.

**Errores míos:** mi primer guion de mutaciones le pasó a `correr` la ruta `tests/…`, y `correr` ya antepone
`tests/`. La base salió con 0 pasados y `aplicarUna` se negó a mutar: dijo CIEGO, no «muda». Lo cazó el
instrumento de la casa, no yo. Cargué la skill de UI pero no lo escribí en el tramo: lo cazó 976 ④. Y no
llegué al push antes de 175k: lo avisé al orquestador a 166k.

**Relevo jv-j1lb: marcas del censo de microcopy** · 2026-11-27T06:41:07Z (hora de GitHub) · `origin/main` =
`5ed6e94f6a61547eb4589ec913e93be9a4ce4b55` · encargo del orquestador `cobroflash-backend-2d`. El PR #3479 cayó en
el obligatorio (run `45869328257`: 14.630 casos = 14.614 pass + 4 fail + 12 skip) por cuatro casos del censo de
microcopy: `tests/scrum1157-censo-convenio-microcopy.test.mjs` ① y ③,
`tests/scrum1215g-una-firma-de-grupo-no-cubre-a-quien-llega-despues.test.mjs` y
`tests/scrum1215i-las-marcas-de-s2.test.mjs`. Reproducido en local antes de tocar nada: 28 casos · 24 pass ·
4 fail. El censo acusó cuatro claves NUEVA de `public/dashboard/js/libroRegistroView.js`:
- `COPY.etiquetaSinFechaCobro`, `COPY.explicacionSinFechaCobro` y `COPY.resumenSinFechaCobroUna`: «APROBADO
  POR GRUPO, sin nombrar» (la firma de la cabecera del grupo no cubre a cada clave);
- `COPY.resumenSinFechaCobroVarias`: SIN_COMENTARIO (la cabecera dice «tres textos» y las ranuras son cuatro).

Las cuatro están en SCRUM-1055 c.22857 ③ (textos 1, 2, 3 singular y la cola del 3 plural, «{n}» + espacio +
cola). A cada una le puse en SU línea, detrás de la coma, `// APROBADO por el fundador el 26-nov-2026
(SCRUM-1055 comentario 22857)`. Ni una letra de los textos cambia: quitar la marca devuelve el fichero de
`5cb821719` byte a byte (22.678 B; 4 marcas). Ningún guard tocado.

**Verdes, con población:** los tres guards de arriba más `tests/scrum1055e-senal-en-el-libro.test.mjs`: 33
casos · 33 pass · 0 fail · 0 skip. Los demás verdes de este relevo van en el comentario de entrega de Jira y
en el mensaje al orquestador, con su población.

**Error, del encargo y de 1055e:** el encargo de 1055e no pedía correr 1157 ni 1215, y la sesión que lo hizo
corrió `scrum296` (APROBADAS) pero no el censo. La comprobación ya existe y actuó: el obligatorio tumbó el PR
antes de entrar en `main`, así que no hace falta otra.
# SCRUM-1055f · el recuento, en el 303 y en las evidencias
**Medido contra:** `origin/main` = `5ed6e94f6a61547eb4589ec913e93be9a4ce4b55` · 2026-11-27T06:40:08Z (hora de GitHub; sesión J1 `jv-j1lc`, encargo del orquestador `cobroflash-backend-2d`)
Versión: 1.2 (SCRUM-1836)

A9: comprobación → `tests/scrum1055f-senal-en-303-y-evidencias.test.mjs`

**① Medido antes de escribir** (también en Jira, c.22902): el libro trae `cobrosSinFechaDeclarada` y `cobrosSinFilas`
con caja (`src/modules/invoicing/domain/libroRegistro.ts:370`) en los dos caminos: el 303 lo pide con `devengo: true`
(`src/modules/fiscal/modelo303/modelo303.repo.ts:27`) y las evidencias con `soloFacturas: true`
(`src/modules/fiscal/evidencias/paquete.repo.ts:50`). Los dos lo PERDÍAN: `construirModelo303` enumera su salida
(interfaz en `modelo303.ts:161`, `return` hasta `:547`; la ruta devuelve `{ ...modelo, rotulos }`,
`modelo303.routes.ts:43`) y el paquete enumera `resumen` (`paquete.ts:351`), que es lo que va a `manifiesto.json`
(`paquete.ts:378`). **`ADVERTENCIA_CAJA` no es un patrón que copiar:** solo la devuelve `clasificarPorCobro`
(`criterioCaja.ts:76`), y en `src/` y `public/` no la llama nadie; no llega a ninguna salida.

**② Qué cambia (servidor, J1):** `Modelo303` y `resumen` del paquete llevan los dos números, y sólo cuando el libro
los trae (caja); sin criterio declarado no salen. Ningún texto nuevo: ni `motivosParaNoFiarse` ni `avisos` (frases),
ni `modelo-303.csv`. No toca emisión, esquema ni vistas.

**③ `cobrosSinFilas` en staging:** **NO medido.** `node scripts/comprobar-claves-bd.mjs` en este árbol: 
`DATABASE_URL_STAGING` → STAGING ✅ (sale 1 por `DATABASE_URL_TESTS`, sin destino declarado para este worktree). La
SELECT no la corrí: me quedé sin contexto (orden del orquestador: «no medido» y seguir).

**Verdes, con población:** rojo primero: el test nuevo, con `src/` sin tocar, 2 de 3 caen por el 303 (el control
pasa); el rojo del manifiesto no lo vi aparte, porque el 303 cae antes. Tras el cambio,
`tests/scrum1055f-senal-en-303-y-evidencias.test.mjs` + `tests/scrum1055c-senal-cobro-sin-fecha.test.mjs`: 6 tests,
6 pass, 0 fail, 0 skip. Build con tipos (`npm run build`): salida 0.

**NO corrido:** las mutaciones del catálogo (declaradas en el test, sin correr: no van como evidencia), la suite
entera, `censo:mudez`, staging y yaqu.app. Los guards de la lista los corre el orquestador sobre la rama, salvo 1294,
267, 854 y `guards:entrada`.

**Errores míos:** crucé el umbral de 175k del primer push sin medirme entre Jira (137.186) y la lectura del 303
(184.892), y después los 200k (205.394, avisó el hook).

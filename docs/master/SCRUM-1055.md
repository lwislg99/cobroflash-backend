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

A9: aviso → cicatriz J1 «Crucé los 200k (200.654) sin medirme entre el arranque (136.056) y la sonda del libro» — no se pudo comprobar: lo impediría un hook que mire el contexto en cada turno, y los hooks no son de este puesto

Lo que faltaba tras SCRUM-1735 según la verificación de jv-j4bg (Jira c.21850). Medición y propuesta en
Jira **c.21863**. No toca `src/`, ni el esquema, ni ninguna base. El test,
`tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs`, ejecuta piezas reales de `dist/`
(`resolverInstanteDeCobro`, `rangoTrimestre`, `leerLibroRegistro` con caja, `updateInvoiceStatusAdmin`)
contra una base en memoria: 8 casos.

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

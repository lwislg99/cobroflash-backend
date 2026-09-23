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

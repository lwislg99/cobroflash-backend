# SCRUM-911 · MANT-1: encender los mantenimientos — PASO 0 en STAGING

**Fecha:** 17-sep-2026 · **Carril:** A · **Gate:** STOP con GO (producción bloqueada por SCRUM-929)
**Medido contra:** `origin/main` = `ef332b90728399ab0ee75c9166af63890fda2bfa` · 2026-09-17T18:26:00Z
**Tanda:** 7410 tests, 7299 pass, 0 fail, 111 skipped (este ticket no cambia `src/`: es medición en staging más el expediente y el banco)

El recorrido se midió entre las **18:26Z y las 18:45Z** (hora de la cabecera `Date` de GitHub).
`ef332b90…` es exactamente lo que servía staging durante el recorrido (`/version` = `ef332b90…`),
así que lo medido y lo desplegado eran el mismo código. Sesión 1 (backend · dinero · fiscal).
Turno de staging tomado a las 18:27:35Z y soltado a las 18:41Z.

> El PASO 0 pedía tres cosas: **qué hace el flag, de dónde se lee y qué rompe**; un recorrido
> completo en staging (crear plan → el cron genera → se ve en pantalla); y un veredicto **por
> acción**: funciona · falla · no pude mirar. Esto es eso, con lo que NO se pudo mirar declarado
> como tal y no dado por bueno.

**Resultado: 25 acciones medidas — 24 funcionan, 1 FALLA — y 3 cosas no se pudieron mirar.** La que falla es dinero
y tiene ticket propio: **SCRUM-929**. **Encender MANT-1 en producción queda bloqueado por 929.**

---

## 1 · Qué hace el flag y de dónde se lee

`MAINTENANCE_ENABLED`, `src/core/flags.ts:37`, por defecto `false`. Es un flag **de merchant,
opt-in** (máster Parte P).

La precedencia la decide `isFlagEnabled` (`flags.ts:68`) y es **merchant > país > env > default de
la tabla**:

| origen | cómo | efecto |
|---|---|---|
| merchant | columna `merchants.flags` (JSONB), `{"MAINTENANCE_ENABLED": true}` | enciende **solo a ese merchant** |
| país | solo para los flags ES-only (`INVOICING_ES_ENABLED`, `SIF_ENABLED`) | **no aplica** a éste |
| env | variable de entorno homónima (`'true'`/`'1'`) | enciende a **todos** los merchants |
| default | tabla P | `false` |

🔴 **Encenderlo por ENV en Railway es GLOBAL, y un flag global es stop condition del fundador
(AA1.4).** La vía correcta es el override por merchant. Medido: con el flag apagado, los cuatro
puntos de entrada de MANT-1 responden como si no existieran.

**Qué toca el flag** — tres sitios, y ninguno más:

| sitio | con el flag OFF | con el flag ON |
|---|---|---|
| `POST /admin/maintenance`, `DELETE /admin/maintenance/:id` (`maintenance.routes.ts:29,76`) | **404 `not_found`** | alta / cancelación del plan |
| `GET /admin/quotes/:id` (`quotesAdmin.routes.ts:878`) | la respuesta **no lleva la clave `maintenance`** | lleva `{enabled, plan, suggestion}` |
| el bucle del cron (`maintenance.service.ts:266`) | cada plan se salta con `flag_off` | propone |
| los botones del pro (`maintenance.service.ts:431`) | `handleMaintenanceButton` devuelve `false` | actúa |

**No hay pantalla de planes.** El único sitio donde un plan se ve es el detalle del presupuesto del
que nació, y la ficha 360 del cliente (por sus eventos). Eso es superficie que MANT-1 no trae.

---

## 2 · Qué rompe al encenderlo

**Una cosa, y es dinero.** Ver §4. Aparte de eso, tres consecuencias que no son defectos pero hay
que saberlas antes de encender:

1. **El ciclo del cron es GLOBAL.** `cron.ts:84` programa `0 10 * * *` y llama a
   `runMaintenanceProposals()` **sin merchant**: recorre los planes vencidos de TODOS los
   merchants y filtra por flag dentro del bucle. Encenderlo para uno no aísla el recorrido, solo
   el efecto.
2. **El aviso al pro es un mensaje de SESIÓN.** `sendWhatsAppButtons` solo entrega si el
   profesional tiene la ventana de 24 h de WhatsApp abierta. La plantilla `maintenance_proposal_es`
   (WHATSAPP_TEMPLATES §6) **no está dada de alta en Meta**, así que fuera de esa ventana el pro
   **no se entera por WhatsApp**: el borrador se crea igual y queda en Presupuestos, y el único
   rastro es un `CustomerEvent` en la ficha del cliente, que hay que ir a buscar. Medido: el ciclo
   crea el borrador ANTES de intentar el aviso y lo deja aunque el aviso falle.
3. **Cada propuesta consume un número de presupuesto**, se avise o no. Medido: los borradores
   #14, #15 y #16 salieron del contador normal del merchant.

---

## 3 · Veredicto POR ACCIÓN

Cada línea se midió una vez y por separado. El banco está en
[`tests/banco-scrum911/`](../../tests/banco-scrum911/) y los veredictos crudos en sus `paso*.json`.

### Leer el flag
| # | acción | veredicto |
|---|---|---|
| 1 | flag OFF → `POST /admin/maintenance` responde `404 not_found` | ✅ funciona |
| 2 | flag OFF → `GET /admin/quotes/:id` no trae la clave `maintenance` | ✅ funciona |
| 3 | override en `merchants.flags` enciende SOLO a ese merchant | ✅ funciona |

### Alta del plan
| # | acción | veredicto |
|---|---|---|
| 4 | presupuesto en BORRADOR → bloque `maintenance` presente, **sin** sugerencia | ✅ funciona |
| 5 | presupuesto ACEPTADO, línea «Sustitución de termo eléctrico 80 L», gremio `fontanero` → sugerencia «Revisión de termo/calentador», 12 meses | ✅ funciona |
| 6 | `POST /admin/maintenance` → **201** con el plan | ✅ funciona |
| 7 | repetido sobre el mismo `quoteId` → **200** con el MISMO id (idempotencia suave) | ✅ funciona |
| 8 | tras el alta, el detalle enseña el plan y la sugerencia desaparece | ✅ funciona |
| 9 | cliente de OTRO merchant → `404 customer_not_found` | ✅ funciona |

### El ciclo del cron
Medido llamando a `runMaintenanceProposals(now)` con un `now` **simulado** (`nextDueAt` + 1 día, a
las 12:00 de Madrid para salir de las horas tranquilas). **No se tocó ninguna fecha en la base**: el
`now` va por parámetro. Antes de cada llamada, el banco **aborta si hay algún plan activo vencido a
ese `now` que no sea el suyo** — el ciclo es global y un `now` a un año vista barrería planes
ajenos. La puerta saltó de verdad dos veces, con restos de mis propios tramos.

| # | acción | veredicto |
|---|---|---|
| 10 | plan vencido → 1 propuesta; borrador `origin='maintenance'`, `createdVia='maintenance'`, estado `draft` | ✅ funciona |
| 11 | el borrador hereda la línea mantenible del presupuesto origen (320 € al 21 %) | ✅ funciona |
| 12 | …y su `total` | 🔴 **FALLA** — §4 |
| 13 | el plan se reprograma: `lastProposedAt = now`, `nextDueAt = now + 90 d` | ✅ funciona |
| 14 | queda `CustomerEvent` `maintenance_proposed` en la ficha del cliente, diciendo que el WA falló | ✅ funciona |
| 15 | sin credenciales de WhatsApp el aviso da `not_configured`, no se toca la red, y el borrador queda en Presupuestos | ✅ funciona |

### Los botones que contesta el pro
| # | acción | veredicto |
|---|---|---|
| 16 | «Posponer 30d» → `rejectedStreak` 1, plan activo, `nextDueAt` +30 d, borrador borrado | ✅ funciona |
| 17 | segundo «Posponer» → `rejectedStreak` 2 y el plan **se pausa solo**; un plan pausado ya no entra en el ciclo | ✅ funciona |
| 18 | «Aprobar y enviar» → `rejectedStreak` 0 y próxima revisión a 12 meses | ✅ funciona |
| 19 | «Aprobar» sin canal: el envío al cliente falla y el borrador **sigue** en el panel para reintentarlo | ✅ funciona |
| 20 | «Cancelar plan» → `active=false` y borrador borrado | ✅ funciona |
| 21 | botón desde un teléfono que **no** es el del pro → `false`, no toca nada | ✅ funciona |
| 22 | botón con el flag APAGADO → `false`, el plan sigue intacto | ✅ funciona |

### Pantalla (Edge headless contra staging, no solo la API)
Se comprueba en el navegador a propósito: `buildMaintenanceBlock`
(`quotesDetailView.js:1292`) puede devolver `null` y dejar la pantalla muda con el servidor en
verde.

| # | acción | veredicto |
|---|---|---|
| 23 | detalle del aceptado: «🔧 Mantenimiento programado: Revisión de termo/calentador · cada 12 meses · próxima propuesta el 30 de junio de 2028» + botón **Cancelar** | ✅ funciona |
| 24 | el borrador del ciclo sale en la lista de Presupuestos y se abre, editable, con «Enviar por WhatsApp» | ✅ funciona |
| 25 | ficha 360 del cliente: «🔧 Propuesta de mantenimiento… Borrador #16 creado (320,00 €)» en Actividad reciente | ✅ funciona |

---

## 4 · 🔴 EL DEFECTO: el borrador del ciclo nace con el total SIN IVA

**Ticket propio: SCRUM-929.** Aquí queda la medición, que es lo que el expediente tiene que
conservar.

`maintenance.service.ts:344` calcula el importe del borrador así:

```ts
const price = Number(line.price ?? 0) * Number(line.qty ?? 1);
```

y eso es lo que guarda en `Quote.total`. La **misma línea** entrando por `POST /quote/create` pasa
por `calcTotal` (`utils.ts:224-228`), que multiplica por `(1 + tax)`. **Dos aritméticas para la
misma línea, y la del ciclo se deja el IVA fuera.**

No es una diferencia interna: el documento **se contradice a sí mismo en pantalla**. Medido en el
navegador sobre el borrador #16, que lo creó el ciclo de verdad
([`pantalla-borrador.png`](../../tests/banco-scrum911/pantalla-borrador.png)):

```
CONCEPTOS
CONCEPTO                        CANT.   PRECIO      IVA     TOTAL
Revisión de termo/calentador      1     320,00 €   21 %    387,20 €
Base imponible: 320,00 €   ·   IVA: 67,20 €   ·   Total: 320,00 €
```

La columna TOTAL de la línea dice 387,20 €, el IVA dice 67,20 €, y el **Total del documento dice
320,00 €**. En la lista de presupuestos el borrador aparece como «320,00 €», mientras el
presupuesto ACEPTADO del que nació —las mismas líneas por la ruta normal— aparece como «417,45 €».
Y el WhatsApp al pro pregunta literalmente **«¿Enviar presupuesto de 320,00 €?»**.

**Por qué importa:** si el pro pulsa [Aprobar y enviar], al cliente le va un presupuesto que pide
320 € por algo que son 387,20 € con IVA. Es un **21 % menos en cada propuesta que alguien acepte**,
y no hay ninguna pantalla que lo avise: el número es coherente consigo mismo en la lista, en el
detalle y en el WhatsApp. Los tres salen de la misma columna mal calculada.

🔴 **Mientras esto esté dentro, MANT-1 no se enciende en producción.** Encenderlo es meter esa
pérdida en la primera propuesta que un profesional apruebe.

---

## 5 · Lo que NO se pudo mirar

Se dice, no se da por bueno: un verde que no ha mirado ocupa el sitio de uno que sí miraría.

1. **El cron REAL de staging.** No hay disparador y el `node-cron` vive dentro del proceso de
   Railway. Todo lo del §«ciclo» está medido llamando a `runMaintenanceProposals(now)` desde el
   `dist` del worktree — verificado **idéntico** a `origin/main` en `src/modules/maintenance`,
   `src/core/flags.ts`, `src/integrations/whatsapp.ts` y `src/core/db` (`git diff --stat` vacío),
   así que lo medido es el mismo código. **Lo que no se ha visto es que `cron.schedule('0 10 * * *')`
   (`cron.ts:84`) se dispare de verdad en staging.** Se verá cuando 929 esté dentro; dejar un plan
   vencido armado para mañana a las 10:00 UTC se descartó: deja staging en un estado que nadie
   vigila.
2. **La entrega real del WhatsApp al pro.** Es mensaje de sesión y depende de la ventana de 24 h; la
   plantilla no está de alta. El recorrido se corrió **a propósito sin credenciales**, comprobando
   en runtime que `config.WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TOKEN` están vacíos y abortando si
   no lo estuvieran. **Nada salió a Meta.** Lo que se midió es que el fallo se registra y que el
   borrador sobrevive — no que un mensaje llegue.
3. **El valor del flag en el entorno de Railway.** El CLI de `railway` está instalado pero **no
   enlazado**, así que no se pudo leer el env de staging. Lo que sí se midió es el efecto: con
   `merchants.flags` a `null`, `POST /admin/maintenance` da 404, o sea que por env tampoco está
   encendido.

---

## 6 · Hallazgo suelto: el KPI «De mantenimientos» no lo calcula nadie

`maintenanceEurInMonth` (`maintenance.service.ts:491`) — el € cobrado con `origin='maintenance'` del
mes, que el máster lista como KPI de MANT-1 — **no tiene llamador**.

Confirmado **por AST** (compilador de TypeScript, no grep: un nombre citado en un comentario o en un
documento sale en el grep y no es un llamador), recorriendo `src/`, `scripts/`, `tests/` y
`public/`: **1 declaración, 0 importaciones, 0 llamadas.** Con **control positivo** para probar que
el censo sabe ver un llamador cuando lo hay: el mismo censo sobre `runMaintenanceProposals`
encuentra la importación (`cron.ts:6`) y la llamada (`cron.ts:87`).

Censo: [`tests/banco-scrum911/censo-kpi-mantenimientos.mjs`](../../tests/banco-scrum911/censo-kpi-mantenimientos.mjs).
Sin ticket por ahora, por decisión del orquestador: un KPI que no calcula nadie no cuesta dinero
hoy, y no se mete ruido en la cola mientras 929 esté abierto.

---

## 7 · Qué se tocó en staging y cómo quedó

El merchant **QA 2 es un fixture COMPARTIDO**. Se avisó por el canal antes de tocarlo y se pidió
turno (`scrum-911-mant-staging`, 18:27:35Z → 18:41Z).

- **Estado previo guardado** en `merchant2-antes.json` (`{"flags":null,"trade":null}`) **antes** de
  tocar nada, y el script **no lo sobreescribe** en una segunda pasada: si lo hiciera, el «antes»
  pasaría a ser el encendido y el original se perdería para siempre.
- Durante el recorrido: `flags.MAINTENANCE_ENABLED = true` y `trade = 'fontanero'` (temporal, para
  que la sugerencia pudiera salir: sin gremio, `suggestMaintenance` devuelve `null` siempre).
- **Devuelto al acabar**, verificado: `flags = null`, `trade = null`, idéntico al original. El flag
  vuelve a **OFF** por decisión del orquestador y el motivo es bueno: el ciclo es global y diario, y
  un flag olvidado encendido propone solo mañana sin nadie mirando.
- **Queda escrito, dicho entero:** 6 `MaintenancePlan` del merchant 2, **todos inactivos**, con su
  historia (dos aplazamientos → pausa, un cancelar); y **1 borrador**, el #16 (quote 1889), que lo
  creó el ciclo de verdad y se deja como evidencia. Se borró el #9001, que se había fabricado a mano
  para poder pulsar «Aprobar».
- **La numeración de presupuestos del merchant 2 NO se desvió.** Se comprobó porque el banco creó a
  mano un presupuesto con `quoteNumber` 9001: el ciclo siguiente asignó **#16**, o sea que el
  contador no sale de `MAX(quoteNumber)`.

---

## 8 · J6 y textos

**Ningún envío automático nuevo.** El ciclo ya existía en `main`; este ticket no añade ninguno y no
se tocó `sendWhatsAppButtons` ni sus topes. El máster J6 ya cubre este camino: «mantenimientos solo
con aprobación del pro y máx 1 propuesta/cliente/90 d», y las dos cosas están medidas (#18 y el
`customer_cooldown_90d` del servicio).

**Textos nuevos: ninguno.** Los que manda el ciclo son los que ya están en
`maintenance.service.ts`. Queda **propuesto y parado** —no escrito— el alta de la plantilla
`maintenance_proposal_es`, que es lo único que haría que el pro se entere cuando su ventana de 24 h
está cerrada.

---

## 9 · Producción

**NO se ha tocado, y no se toca.** Ni el flag en prod ni por ENV (global = stop condition).

Cuando SCRUM-929 esté dentro, la vía es el **override por merchant** en `merchants.flags`, nunca la
variable de entorno. Y el GO tiene que escribirlo el fundador **en el chat de la sesión que lo
haga**: no se hereda de otra sesión ni vale reenviado por el canal (A19).

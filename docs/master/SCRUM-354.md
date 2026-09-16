# SCRUM-354 · A9: facturas recurrentes sobre `maintenancePlan` — **CERRADO POR MEDICIÓN, no construido**

**Fecha:** 9-ago-2026 · **Carril:** A · **Resultado:** REDUNDANTE · **Código escrito:** ninguno

**Medido contra:** `origin/main` = `111e7d2f6e10ab807d6f54e4e1a8a7201dd2a69e` · 2026-08-09T17:39:19+02:00

## Por qué esta entrada existe aunque no se haya construido nada

Deja constancia de **por qué no se construyó**. Sin ella, dentro de tres semanas alguien lee el
título del ticket, le parece razonable y lo reabre por inercia — y la medición que lo cerró se
habría perdido.

**Un ticket cerrado por medición vale más que uno construido por inercia, pero solo si la medición
sobrevive al cierre.**

## El ticket describía un mecanismo que YA EXISTE, completo y en producción

No es «una mención»: es el ciclo de mantenimiento entero, con su cron, su anti-spam y su decisión
humana. Es la **cuarta vez** que el barrido del bloque A confunde un mecanismo con una mención.

| pieza | qué hace |
|---|---|
| `MaintenancePlan` | `intervalMonths`, `nextDueAt`, `active`, y el anti-spam de la spec (`lastProposedAt`, `rejectedStreak`) |
| `runMaintenanceProposals` | **cron diario a las 10:00**; respeta horas de silencio y `waOptOut` |
| la propuesta | crea un `Quote` con `origin: 'maintenance'` y `status: 'draft'`, con su línea y su importe |
| **quién decide** | WhatsApp con botones **al PRO**, jamás al cliente |
| `handleMaintenanceButton` | acepta → el presupuesto sale al cliente y `nextDueAt += intervalMonths`; rechaza → racha, aplaza, y a los **dos seguidos pausa el plan** |

## La cadena, extremo a extremo: no se corta en ningún punto

| paso | mecanismo | ¿filtra por `origin`? |
|---|---|---|
| El cliente acepta el presupuesto | `quotes.routes.ts` → **`ensureJobForQuote(quote.id)`** | **NO** |
| Hay Trabajo | albaranes, firma, y los caminos de facturación de **A0.4** y **A0.5** | **NO** |
| Bandeja de pendientes | albarán **`estado: 'firmado'`** + `VALORADO` + `invoiceId: null` | **NO** |

**Ni un solo punto de la cadena mira `origin`.** Un presupuesto de mantenimiento aceptado es, a
partir de ahí, un presupuesto como cualquier otro.

## Y factura por TRABAJO HECHO, no por calendario

La bandeja solo recoge albaranes **firmados** — el mismo criterio que sostiene G5. El ciclo
recurrente empuja **la propuesta**; el dinero sigue dependiendo de que alguien entregue y el cliente
firme.

Esa era la decisión del fundador antes de conocer la medición, y **el producto ya está construido
así**. La única variante que A9 habría añadido —emitir por el paso del tiempo— rompería ese criterio
en la única pantalla donde estaba limpio, y en la dirección peligrosa: un documento fiscal por algo
que quizá no se ha hecho, con la regla 29 delante (emitida no se borra).

## El suelo de la medición — por qué esto no es una conclusión por ausencia

«No filtra por `origin`» y «no supe buscar el filtro» se leen igual. Los tres controles que los
separan:

1. **`origin: 'maintenance'` se ESCRIBE y se LEE.** Lo escribe `maintenance.service.ts` al crear el
   borrador; lo lee `handleMaintenanceButton` para encontrarlo. El campo existe y se usa.
2. **`createdVia: 'maintenance'` tiene consumidores reales** — aparece en 4 ficheros, incluido
   `metrics.service.ts`, que agrupa por él.
3. **El `select` de `ensureJobForQuote` no incluye `origin`.** La ausencia de filtro es
   **estructural**: la función ni siquiera lee el campo. No es un `grep` que no encontró nada.

## Lo que NO se tocó

Nada. No hay código, ni commits de mecanismo: solo esta entrada.

## Hallazgo reportado (regla 9)

El cron comprueba **`customer.waOptOut`** para decidir si propone — pero la propuesta va **al
profesional**, que no es quien se dio de baja. Puede ser deliberado (sin canal con el cliente la
propuesta no lleva a nada), pero hoy no está escrito, y **un plan que no se propone y sigue marcado
`active` está mintiendo sobre sí mismo**.

Tiene ticket propio: **SCRUM-394**. No se toca desde aquí.

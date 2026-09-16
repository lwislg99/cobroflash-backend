# SCRUM-398 · El conjunto cerrado de formas de cobro, cerrado de verdad

**Fecha:** 7-ago-2026 · **Carril:** S3 · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `75b0267b8abef7ff7da242b46f8fb3d243335e4e` · 2026-08-07T20:38:35+01:00
**Tanda:** 2280 tests · 2207 pass · **0 fail** · 73 gateados

> `reportsView.js` resolvía la etiqueta con `METHOD_LABELS[m.method] || m.method`. Un método fuera
> del mapa **se le enseñaba al profesional sin traducir**: le aparecía `mp` en su informe de cobros.
> «No sé traducir esto» convertido en «esto se llama así».

## PASO 0 · lo que se midió, y una precisión sobre el enunciado

`paid_via` **no es un campo del schema: ES `charge.method`.** Lo dicen tres sitios —
`exportData.ts:229` («`paid_via` = charge.method, regla 22. Es lo que el asesor cruza con el
banco»), `exports.routes.ts:618` y `reports.routes.ts:159`. El enunciado era correcto; queda escrito
porque los dos nombres conviven y confunden.

**Y los vocabularios eran CUATRO, no tres.** El censo de lo que se escribe de verdad:

| Valor | Quién lo escribe | ¿En `PAID_VIA`? |
|---|---|---|
| `bizum_manual` | `chargesAdmin.routes.ts:37` | ✅ sí |
| `card:stripe` | `stripe.routes.ts` (×3) · `receipt.routes.ts:55` | 🔴 **no** — cuarto vocabulario, no estaba en el ticket |
| `mp` | `mpWebhook.routes.ts:103` | 🔴 no |
| `manual` | **nadie**: lo fabrica `reports.routes.ts:164` al LEER (`inv.charge?.method \|\| 'manual'`) | 🔴 no |
| `card` · `bizum_auto` · `transfer` · `cash` | **nadie** escribe estos cuatro hoy | ✅ sí |

Y la UI etiquetaba `bizum`, `bank` y `mercadopago` — **tres valores que nadie escribe** — mientras
le faltaban los que sí llegan.

## Lo que se construye

`public/dashboard/js/paidViaEtiquetas.js`, fuente única, con **tres poblaciones declaradas**:

1. **El conjunto cerrado** (`PAID_VIA`, regla 22). Es la INTENCIÓN. El guard lo deriva del **AST**
   de `paidVia.ts` y exige que estén todos etiquetados: la lista se escribe a mano en un solo
   sitio, las etiquetas se atan a ella.
2. **Los heredados**, con su procedencia escrita: `card:stripe` y `manual`. **No traducirlos sería
   una regresión** — son cobros reales que hoy sí se ven.
3. **Lo desconocido**: `⚠️ Método no reconocido (mp)`. No se pinta crudo y **no se pierde**: el
   valor va entre paréntesis para poder investigarlo, pero marcado como no reconocido. Pintar `mp`
   a secas hacía las dos cosas mal a la vez.

Fuera el `|| m.method`, y el guard lo fija con hermano positivo.

## 🔴 LAS DOS PREGUNTAS QUE SE PEDÍAN MEDIR, NO DECIDIR

### `cash` — está en el conjunto y **nadie lo escribe**

Cero escrituras en `src/`. **NO se retira**, y no por inercia: retirar un valor del conjunto cerrado
es cambio de máster (regla 22) y, sobre todo, `cash` es la única forma de cobro del conjunto que
**un oficio cobra a diario en la realidad**. Que no exista su camino de escritura parece un hueco de
producto, no un residuo. **Decisión del fundador.**

### `mp` / `mercadopago` — residuo estructural, medido

* `payInvoice.routes.ts` —la página donde el cliente elige cómo pagar— tiene **cero** menciones a
  Mercado Pago. No se ofrece.
* Existen `/pay/mp/:token` (declarada como superficie pública) y el webhook, que escribe `method:
  'mp'`, **sin comprobación de país ni flag**.
* La UI etiquetaba `mercadopago` y el código escribe `mp`: **nunca casaban**, así que el valor
  aparecía crudo. Ése era exactamente el síntoma del ticket.

**No se retira nada en este ticket**, y se declara por qué: quitar el webhook o la ruta toca la
pasarela, que está fuera de alcance. Lo que sí cambia es que `mp` deja de enseñarse como si fuera un
nombre. Si el fundador confirma que Mercado Pago no entra en España-first, la retirada es su propio
ticket.

## El hueco del `Charge` sin vía (visto en SCRUM-402) — NO entra en este alcance

Medido: `POST /admin/invoices/:id/pay` → `markInvoicePaidAdmin` → `updateInvoiceStatusAdmin(id,
'paid')`. **No crea `Charge`.** La factura queda pagada sin método, y `reports.routes.ts:164` lo
tapa al leer con el `'manual'` sintético.

**Es de esta familia pero es otro ticket**, y el motivo es de alcance real: arreglarlo significa
**escribir** un `Charge` donde hoy no se escribe ninguno — o sea, tocar el mecanismo de cobro, que
este ticket tiene prohibido. Aquí solo se ha hecho que ese `manual` **se nombre como lo que es** (la
ausencia de método) en vez de pasar por un método más.

## Verificado en rojo — 7 mutaciones, inyección comprobada en disco

| Qué se rompe | Qué cae |
|---|---|
| **R1** · se añade un valor a `PAID_VIA` sin etiqueta | 🔴 «HAY VALORES DEL CONJUNTO CERRADO SIN ETIQUETA: ["cripto"]» |
| **R1 (reverso)** · se etiqueta algo fuera del conjunto | 🔴 «hay etiquetas para valores que NO están en el conjunto: ["mercadopago"]» |
| **R2** · vuelve el `\|\| m.method` a la vista | 🔴 «la vista vuelve a resolver la etiqueta con `\|\| m.method`» |
| **R2** · el desconocido se devuelve crudo | 🔴 ««mp» se le está enseñando al profesional TAL CUAL» |
| **R3** · `bizum_auto` y `bizum_manual` colapsan | 🔴 «se etiqueta como «📲 Bizum» y debería ser «📲 Bizum (confirmado a mano)»» |
| **R4** · el derivador se queda ciego | 🔴 «ESCÁNER CIEGO: no se pudo derivar `PAID_VIA` del AST» |
| **heredados** · se retira `card:stripe` | 🔴 «sale como «⚠️ Método no reconocido»… es un cobro con tarjeta REAL» |

⚠️ Dos de las siete caían **sin decir por qué** (`assert.equal` sin mensaje). Se les puso el suyo:
un rojo que no nombra su causa obliga al siguiente a reconstruir el razonamiento entero, y es medio
rojo.

✅ **La técnica del CRLF ya es obligatoria y se aplicó**: el script de mutación **detecta el salto
de línea por fichero** en vez de escribirlo. Se vio funcionando — CRLF en los ficheros del repo, LF
en el fichero nuevo — y ninguna de las siete anclas falló, que es la primera vez hoy.

## Lo que queda vivo y no se toca

* **`bizum_auto` no lo escribe nadie todavía**: es correcto, entra cuando se active la capability
  `bizum_payments` (SCRUM-191). No es residuo.
* **`card:stripe` frente a `card`**: el conjunto declara `card` y el código escribe `card:stripe`.
  Alinearlos toca los webhooks de la pasarela — fuera de alcance. Queda traducido y declarado.

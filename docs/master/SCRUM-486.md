# SCRUM-486 · PASO 0 · La puerta abierta son TRES, y la peor no es la del ticket

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T08:57:33Z` · HEAD
`3d8c1d7d91d151d87d960aa9b1927dedc9cddab4`

**Medido contra:** `origin/main` = `3d8c1d7d91d151d87d960aa9b1927dedc9cddab4` · 2026-08-12T08:54:32Z

> **Cero código.** Esto es medición: el punto 2 cambia el arreglo, y una de las tres puertas está
> en el flujo de cobro. `PAID_VIA` no se amplía (regla 22) y el guard de 473 se consumiría, no se
> copiaría.

## 1 · Qué es `'mp'` EXACTAMENTE — y no es lo mismo en los dos sitios

**`mercadopago.ts` ya está arreglado.** Su `'mp'` vive **solo en el comentario** que cuenta lo que
hacía antes de SCRUM-474; la línea 89 hoy es `method: metodoDesdeMercadoPago(data.payment_type_id)`.

**`charges.routes.ts:39` es otra cosa**, y el nombre no era el hecho:

```ts
const methodPref = body.method_preference;
const method = methodPref === 'card' ? 'card' : methodPref === 'mp' ? 'mp' : 'transfer';
```

* Sale de **`body.method_preference`**, que `schemas.ts:112` declara como
  `z.enum(['bank','card','mp']).default('bank')` — **un vocabulario de ENTRADA distinto de `PAID_VIA`**.
* Se escribe con **`status: 'pending'`**: el cobro **aún no está pagado**. Aquí `method` es una
  **preferencia**, no un `paid_via`.

🔴 **Así que esa línea no es un literal suelto: es un TRADUCTOR entre dos vocabularios, y le falta
una traducción.** Traduce `bank → transfer` y `card → card`, y deja `mp → mp` sin traducir. Por eso
el arreglo de `bank` de la misma línea no lo cazó: no había un valor que corregir, faltaba una regla.

## 2 · 🔴 LA PUERTA PEOR, Y NO ES LA DEL TICKET

```
src/modules/billing/app/routes/mpWebhook.routes.ts:103  [update]  method = 'mp'   🔴 FUERA DE PAID_VIA
```

Eso **no** es una preferencia: es un `update` **en el momento del pago**, sobre un cobro que pasa a
`paid`. Es `paid_via` falsificado, la familia exacta de SCRUM-191.

**Y el traductor correcto ya está ahí, llamado, y su resultado se tira:** la línea 76 hace
`payment = await getMpPayment(...)`, que devuelve `method: metodoDesdeMercadoPago(payment_type_id)`
(`mercadopago.ts:89`). La línea 103 **lo ignora** y escribe `'mp'` a fuego.

> SCRUM-474 arregló el traductor y no a su consumidor. Es la misma forma que el acuse de Resend que
> se devolvía y nadie recogía.

⚠️ **Esto está en el flujo de cobro en producción (AA1.4).** Lo reporto; no lo toco.

## 3 · Censo de escrituras de `Charge` — derivado, y con su corrección

**11 escrituras** · 6 escriben `method` · 5 no · **suma 11 = 11 ✓** · control positivo del
detector: ve las dos formas en un fuente sintético **2/2 ✓**

| Dónde | Forma | `method` |
| --- | --- | --- |
| `charges.routes.ts:41` | abreviada | variable (puede ser `'mp'`) |
| **`mpWebhook.routes.ts:103`** | explícita | **`'mp'` 🔴 fuera de PAID_VIA** |
| `psp.routes.ts:100` | explícita | `esMetodoValido(body.method) ? … : charge.method` ✅ valida |
| `seed-demo.mjs:283` | abreviada | variable |
| `seed-demo.mjs:352` | explícita | `'card'` ✅ |
| **`seed-video.mjs:483`** | abreviada | **`'bizum'` 🔴 fuera de PAID_VIA** |

> 🔴 **Mi primera versión del censo clasificó mal y sumaba bien.** Solo miraba `method: <expr>` y
> se dejaba la forma **abreviada** (`method,`) — que es justamente la línea que abre este ticket.
> Daba `11 = 11 ✓` con tres escrituras mal clasificadas. **La suma cuadra y la lista miente**: por
> eso la lista se lee.

## 4 · ¿Está vivo MercadoPago? — **alcanzable, sí; usado, no consta**

| Señal | Medido |
| --- | --- |
| Rutas montadas | **sí**: `app.use('/pay', payMpRouter)` y `app.use('/webhooks/mp', mpWebhookRouter)` (`app.ts:295-296`) |
| Contrato de entrada | **sí**: `method_preference: z.enum(['bank','card','mp'])` (`schemas.ts:112`) |
| Quién manda `'mp'` desde el producto | **nadie**: el único llamador interno manda `'card'` (`invoiceWhatsApp.service.ts:67`) |
| `MP_ACCESS_TOKEN` configurado en producción | **NO SE PUEDE SABER DESDE AQUÍ** — es un secreto y no se mira (regla 9) |

**Conclusión honesta:** el camino existe y es alcanzable por API, pero **ningún camino del propio
producto lo elige**. Que `'mp'` no salga entre los cinco valores de producción es coherente con eso
— y **no está medido cuál de las dos cosas es**. Lo decide una consulta tuya (§6) y el panel.

## 5 · La pista del seed — **no lo afirmo, y digo qué sí consta**

`scripts/seed-video.mjs:480`: `const method = (i % 2 === 0) ? 'bizum' : 'transfer';`, escrito con
`status: paid ? 'paid' : 'pending'`. **`'bizum'` a secas NO está en `PAID_VIA`** —el conjunto tiene
`bizum_auto` y `bizum_manual`— así que ese script fabrica cobros PAGADOS con un método inválido.

**Lo que SÍ consta sobre si ha corrido contra una base real:** SCRUM-472 midió que el merchant **22
de producción es el que crea este mismo script** (`email: OWNER_EMAIL`, `acquisitionSource:
'video-demo'`), y por eso su albarán `id=5` está ahí. **El script ha corrido contra producción.**

**Lo que NO consta, y no lo afirmo:** si los 6 cobros bizum que se atribuyeron a `psp.routes.ts`
incluyen los de este seed. Eso lo dice una consulta, no yo.

## 6 · La consulta que lo resuelve — SOLO LECTURA, **no ejecutada**

```sql
-- ¿Qué métodos hay de verdad, de quién, y cuántos están FUERA del conjunto cerrado?
SELECT c."method",
       c."merchant_id",
       count(*)                                             AS cobros,
       count(*) FILTER (WHERE c."status" = 'paid')          AS pagados,
       min(c."created_at")::date                            AS desde,
       max(c."created_at")::date                            AS hasta,
       (c."method" NOT IN ('card','bizum_auto','bizum_manual','transfer','cash')) AS fuera_de_paid_via
FROM "charges" c
GROUP BY c."method", c."merchant_id"
ORDER BY fuera_de_paid_via DESC, cobros DESC;
```

Con eso se responde de una vez: si hay `'mp'`, si hay `'bizum'`, y **de qué merchant** — el 22 es
el del seed. Nombres verificados contra el schema: tabla `charges`; `method` y `status` sin `@map`;
`merchant_id` y `created_at` mapeados.

## 7 · Lo que propongo, y qué decides tú

1. **`charges.routes.ts:39`** — le falta la traducción de `'mp'`. **Pero no sé a qué traducirlo**:
   al crear el cobro nadie sabe todavía con qué pagará el cliente, y MercadoPago es una **pasarela**,
   no un método. Ésa es la decisión de la regla 22, y no la tomo yo.
2. 🛑 **`mpWebhook.routes.ts:103`** — el arreglo es *usar lo que ya se calcula*
   (`payment.method`). Es **flujo de cobro en producción**: lo reporto y espero GO.
3. **`seed-video.mjs:480`** — `'bizum'` → un valor del conjunto. Es un script, no toca producción
   al cambiarlo… **pero las filas que ya sembró se quedan como están**: ningún backfill, las
   históricas se documentan.

**Y el control negativo que protege el dinero, cuando se construya:** los cinco valores legítimos
tienen que seguir escribiéndose **sin fricción**. `psp.routes.ts:100` ya valida y no se toca.

## 8 · Lo que NO se ha hecho

Ni una línea de código · `PAID_VIA` sin ampliar · ningún backfill · ninguna consulta ejecutada ·
`mpWebhook` y `psp.routes` sin tocar · el guard de 473 sin copiar.

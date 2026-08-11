# SCRUM-445 · Cobros dejaba de contar dos veces… y nunca lo hizo

**Fecha:** 10-ago-2026 · **Carril:** B (dominio) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `c47d03655aacd7fe78044f89e7c55a7d467cbb5b` · 2026-08-10T18:59:45+01:00
**Tanda:** 2734 tests · 2660 pass · **0 fail** · 74 gateados · `npm test` exit **0**

## El defecto, sin suavizar

`listarCobros` (SCRUM-285) decía esto: *«el `chargeId: null` es lo que impide contar dos veces: si
la factura tiene charge, el charge ya la representa»*.

**Era falso, y no a medias: el filtro no excluía nada.** `Invoice.chargeId` **no lo escribe nadie
en todo el árbol** — `ensureInvoiceForCharge` crea la factura del cobro con `merchantId,
customerId, quoteId, number, type, total, currency, lines, pdfUrl, qrData`, sin ese campo. Así que
cada cobro por pasarela salía **dos veces**: su `Charge` y su justificante. En la pantalla del
dinero, ver el doble es peor que no ver.

> **La fusión se diseñó contra una propiedad que nadie comprobó que existiera.** El campo está en
> el esquema, es nullable, y **parecía escrito**. Es el mismo defecto que `Job.direccion` en otra
> tabla: una columna declarada que nadie rellena, con un mecanismo apoyado encima como si
> estuviera llena. Lo escribí yo, y lo encontré midiendo otra cosa (SCRUM-442) — no lo cazó
> ningún test, porque el mío probaba la pantalla con filas ya fabricadas, nunca la consulta.

## PASO 0

**ENTRADA.** `Cobros` en la barra → `app.js` `case 'cobros'` → `renderCobrosView` →
`GET /admin/cobros` → `listarCobros`. Un solo camino, el que construyó SCRUM-285.

**MECANISMO.** La fusión existe entera; lo que falla es su criterio. No se rehace: se cambia el
criterio.

### ① ¿Cómo se sabe HOY que un justificante corresponde a un `Charge`? — hay camino, y es un evento

| camino | ¿se escribe? |
|---|---|
| `Invoice.chargeId` | **NO.** Cero escrituras en el árbol |
| `Event{ chargeId, type:'invoiced', payload.invoice_id }` | **SÍ** — `lib/invoicing.ts:270`, dentro de `ensurePdfAndEvent`, por donde pasa todo `ensureInvoiceForCharge`. **Único sitio del árbol** con ese tipo |
| `Invoice.quoteId → Quote.chargeId` | parcial: `quoteId` se guarda como `quote?.id ?? null`, así que un cobro sin presupuesto no tiene ese puente |

### ② ¿Escribir `chargeId` o cambiar el criterio? — el criterio, y el motivo es de alcance

Escribir el campo **arreglaría el futuro y dejaría duplicados todos los justificantes que ya
existen**: nadie va a rellenar hacia atrás una columna que nunca se escribió, y hacerlo sería un
backfill sobre documentos emitidos.

Cruzar por el **evento** arregla las dos cosas a la vez, **incluidos los históricos**, porque ese
evento se lleva escribiendo desde siempre. Y no toca `prisma/schema.prisma` ni el camino de
emisión: solo lo **lee**.

### ③ Cuántas filas hay afectadas hoy — NO MEDIDO, y digo por qué

No lo he contado. En este worktree solo hay un `.env` que apunta a producción; **no cuento filas
contra producción, y no invento ni escribo ninguna cadena de conexión**. La consulta que lo mide, si
el fundador la quiere lanzar contra dev o staging:

```sql
SELECT count(*) FROM invoices i
JOIN events e ON e.type = 'invoiced' AND (e.payload->>'invoice_id')::int = i.id
WHERE i.merchant_id = $1;
```

Es el número de justificantes que hoy salen duplicados. **El arreglo no depende de ese número**
—cruzar por evento cubre históricos y futuros por igual—, así que no bloquea; lo que decidiría es
si hacía falta además un backfill, y con esta vía no hace falta ninguno.

## Lo que se construye

`fundirCobros({ charges, candidatas, invoiced })`, **función pura y exportada**, y `listarCobros`
pasa a consultar y llamarla. Quita de la mitad `Invoice` las que ya trae su `Charge`, cruzando por
`payload.invoice_id`.

**Se separa la consulta de la decisión a propósito.** Lo que hay que poder probar es **quién sale,
quién se queda y quién se cae por duplicado**, y probarlo exige fabricar las tres poblaciones a
mano. Con la consulta dentro haría falta una base de datos — y el defecto que se cierra aquí es
justo de decisión, no de consulta.

**El `chargeId: null` se conserva**, con un comentario que dice la verdad de hoy: **no excluye
nada**. Se deja porque el día que alguien escriba el campo será correcto, no porque filtre. Hay
test de que ese comentario no vuelve a presentarlo como si filtrara — la afirmación no comprobada
es lo que creó el defecto.

## Verificado

**El test que decide lleva su control positivo DENTRO**, porque una lista vacía hace verdad
cualquier «no hay duplicados» — el verde hueco que ya apareció hoy en SCRUM-442.

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | se quita la desduplicación | 🔴 «el cobro por pasarela **sale 2 veces**… ver el doble es peor que no ver: `invoice #501 · J-20260801-AAAA` / `charge #11 · (sin número)`» — dice **qué** y **por qué camino entró cada una** |
| **R2** | la desduplicación se pasa de frenada (quita todo `JUST`) | 🔴 «el cobro marcado A MANO **ha desaparecido**… no puede volver a esconder el dinero que la fase 1 sacó a la luz» |
| **R3** | la fusión pierde una población entera | 🔴 «con solo la mitad de `Charge` no devuelve esa mitad: **la fusión está leyendo mal una población**, y entonces «sin duplicados» no significaría nada» |

Las tres inyecciones llevan **post-condición**: comprueban que cambió el fichero que digo y que la
cadena ya no está; si no, abortan.

**El control que impide pasarse de frenada** es el (b) del test principal: un cobro **a mano**
—sin `Charge` ni evento— **sigue apareciendo, con su número**. Y hay tres controles negativos más:
un justificante **sin evento** no se quita (el criterio es «lo trae su charge», no «es un
justificante») · un evento que apunta a **otra** factura no se lleva la que no toca · un `payload`
roto (`null`, sin `invoice_id`, con basura) no tumba la lista **ni quita de más**.

**Y el que ata la consulta a la decisión**, porque *mencionar no es hacer*: que `fundirCobros`
desduplique bien no prueba que alguien le pase los eventos. Se comprueba que `listarCobros` lee
`event.findMany`, filtra por `type: 'invoiced'`, **filtra por merchant a través de la relación**
(regla 2) y devuelve el resultado de `fundirCobros`.

## Lo que NO cubre

* **No se ha contado cuántas filas hay afectadas** — ver ③. La consulta queda escrita.
* **No hay test contra base de datos.** La decisión se prueba entera; que Prisma devuelva lo que se
  espera no se mide aquí. En concreto **no se comprueba que el `payload->>'invoice_id'` real venga
  como número** y no como cadena: el test cubre las dos formas, pero cuál llega de verdad depende
  de cómo Prisma deserialice el JSON, y eso no se ha medido.
* **`Invoice.chargeId` sigue sin escribirse.** No se toca: el campo es del esquema y escribirlo no
  hace falta con esta vía.
* **La pantalla no cambia**: el arreglo es de dominio. Sin capturas, sin AB6.

## Ficheros

* `src/modules/billing/domain/cobros.service.ts` — `fundirCobros` (nueva, pura) y el cruce por evento.
* `tests/scrum445-cobros-sin-duplicar.test.mjs` (nuevo, 7).


---

# SCRUM-445 · segunda entrega: las dos consultas (sin ejecutar) y el vínculo escrito

## 1 · LAS CONSULTAS — SOLO LECTURA, **NO EJECUTADAS**

Nombres leídos del schema real. Ojo al detalle que se presta a error: **`invoices` NO mapea
`merchantId` ni `createdAt`** (columnas en camelCase) **y sí mapea `charge_id`**; `charges` y
`events` sí usan snake_case. Escribirlo de memoria habría dado un error de columna inexistente —
o peor, un cero que se lee igual de bien que la verdad.

> ## 🔴 CORRECCIÓN, 11-ago-2026 (desde SCRUM-472)
>
> **La ① falló en producción con `column c.customerId does not exist`.** El aviso de aquí arriba
> era correcto **y no se aplicó a sí mismo**: avisaba sobre `invoices` y el error estaba en
> `charges`. Dos columnas mal, las dos del mismo lado:
>
> | Escrito | Real (`charges`) |
> | --- | --- |
> | `c."customerId"` | **`c."customer_id"`** |
> | `c."amount"` | **`c."importe"`** |
>
> La segunda no había dado la cara porque la ① revienta antes de llegar a ella. **Un aviso sobre
> una tabla no protege de la de al lado**, y el fallo estaba justo donde la nota decía que no
> había problema. El bloque de abajo va corregido y **sigue sin ejecutarse**.
>
> Columnas usadas, verificadas una a una contra `prisma/schema.prisma`:
>
> | Tabla | tal cual (sin `@map`) | mapeadas (`@map`) |
> | --- | --- | --- |
> | `charges` | `id`, `method`, `status` | `merchant_id`, `customer_id`, `created_at`, `importe` |
> | `invoices` | `id`, `merchantId`, `customerId`, `createdAt` | `charge_id` |
> | `events` | `id`, `type`, `payload` | `charge_id` |
>
> ⚠️ `payload ->> 'invoice_id'` **no es una columna** y no se ha vuelto a derivar: viene de la
> medición ① de este mismo ticket. Si la ② y la ③ dan cero, eso es lo primero que hay que mirar.

```sql
-- ① ¿ESTÁ PASANDO? — Charges con factura que NO tienen su Event{invoiced}.
-- Cada fila es un cobro que hoy se pinta DOS VECES: una por su Charge y otra por su Invoice.
--   0  → el defecto es real pero NO está ocurriendo; el arreglo pasa a ser preventivo.
--  >0  → está ocurriendo, y ese número son los cobros duplicados en pantalla.
SELECT COUNT(*) AS charges_con_factura_sin_evento
FROM "charges" c
WHERE EXISTS (
        SELECT 1 FROM "invoices" i
        WHERE i."merchantId" = c."merchant_id"
          AND i."customerId" = c."customer_id"   -- SCRUM-472: era c."customerId" y no existe
          AND i."createdAt" >= c."created_at"
      )
  AND NOT EXISTS (
        SELECT 1 FROM "events" e
        WHERE e."charge_id" = c."id" AND e."type" = 'invoiced'
      );

-- El detalle, para poder mirar tres a mano antes de decidir nada:
-- SCRUM-472: `c."amount"` no existe — la columna se llama `importe` (el campo Prisma es `amount`).
SELECT c."id" AS charge_id, c."merchant_id", c."created_at",
       c."importe" AS amount, c."method", c."status"
FROM "charges" c
WHERE NOT EXISTS (
        SELECT 1 FROM "events" e
        WHERE e."charge_id" = c."id" AND e."type" = 'invoiced'
      )
ORDER BY c."created_at" DESC
LIMIT 20;

-- ② EL TAMAÑO DEL BACKFILL — Invoices con charge_id NULL que SÍ tienen Charge por el evento.
-- El vínculo ya existe en el Event; lo que falta es la columna. Se rellenaría SIN inventar nada.
--   0  → nada que rellenar: basta con cubrir lo nuevo.
--  >0  → hay histórico vinculable, y con ese número se decide el backfill.
SELECT COUNT(*) AS invoices_vinculables_por_evento
FROM "invoices" i
WHERE i."charge_id" IS NULL
  AND EXISTS (
        SELECT 1 FROM "events" e
        WHERE e."type" = 'invoiced'
          AND (e."payload" ->> 'invoice_id') = i."id"::text
      );

-- ⚠️ Y el que NO se puede rellenar: sin charge_id y SIN evento. Aquí el vínculo no existe en
-- ningún sitio, así que rellenarlo sería DEDUCIRLO. Se mide para declararlo, no para arreglarlo.
SELECT COUNT(*) AS invoices_sin_vinculo_ninguno
FROM "invoices" i
WHERE i."charge_id" IS NULL
  AND NOT EXISTS (
        SELECT 1 FROM "events" e
        WHERE e."type" = 'invoiced'
          AND (e."payload" ->> 'invoice_id') = i."id"::text
      );
```

⚠️ **Al leer la última**: incluye **todas** las facturas legítimas sin cobro por pasarela
—transferencia, efectivo, Bizum manual—. Un número alto ahí **no es un defecto**: es el dinero
marcado a mano, que no crea `Charge` (SCRUM-441) y que **no debe vincularse a ninguno**.

# SCRUM-797 · el cliente que se iba al demo

**Fecha:** 7-sep-2026 · **Carril:** producto · datos · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `64b5d80ae3b11dcc34d736de21670eb6b5ce6dda` · 2026-09-07T07:27:22+01:00

> ⚠️ Esa hora es la del árbol contra el que se midió, no una lectura de reloj — criterio R14.
> Las cifras de base de datos llevan **su propia hora**: `yaqu_dev_javier` es compartida y se mueve.

---

## El defecto  **[EXISTE]**

`Customer.merchantId` tenía `@default(1)` en el schema. **El merchant 1 es la cuenta demo.** Un
`create` que se olvidara de decir el dueño no fallaba: la base archivaba la fila bajo el demo, la
petición devolvía **HTTP 201**, y el profesional que había creado el cliente **no lo veía en su
lista**.

## 🔴 El rojo, por el camino real contra dev  **[EXISTE]**

`POST /charges` levantando la app de verdad (`dist/app.js`, secreto interno del mismo proceso —
que es exactamente como lo llama `invoiceWhatsApp`). Merchant efímero por `withMerchant`, así que
la limpieza no depende de que nadie se acuerde.

| | **antes** (`@ 06:30:10Z`) | **después** (`@ 06:33:53Z`) |
|---|---|---|
| `POST /charges` | HTTP 201 | HTTP 201 |
| merchant que pide | 1044 | 1053 |
| cliente creado | `id=932` · **`merchantId = 1`** 🔴 | `id=933` · **`merchantId = 1053`** ✅ |
| listando como merchant **1 (demo)** | **1 coincidencia** 🔴 | 0 |
| listando como **su dueño** | **0 coincidencias** 🔴 | 1 ✅ |

**Los dos sentidos, el mismo POST.** Sembrado y limpiado: `0` clientes con la marca al terminar, y
el demo con los **mismos 7** clientes antes y después de cada pasada.

## El censo, repetido sobre el árbol de HOY  **[EXISTE]**

«Un solo sitio» era una medida de ayer. Repetida con `scripts/_censo-alta-de-cliente.mjs`
(SCRUM-795) — **por AST**, con la población **derivada del schema** y los directorios derivados del
repo. Ninguna lista de ficheros escrita a mano.

| ámbito | modelos c/ `merchantId @default(1)` | altas de `Customer` | **OMITEN** |
|---|---|---|---|
| `src/` | **1** — `Customer`, el único de 23 | 3 | **1** |
| árbol entero (`scripts` + `src` + `tests`) | **1** | 87 | **1** — la misma |

**Sigue siendo uno:** `src/modules/billing/app/routes/charges.routes.ts:24`.
✅ **Control positivo:** el instrumento **lo encuentra**, y encuentra el alta real
(`customerAdmin.ts:147`, que escribe dueño y `portalToken`) sin denunciarla.

De 27 modelos, 23 llevan `merchantId`: **21 obligatorio** (una omisión ahí no dona — Prisma se
niega, y es ruidoso), 1 nullable, y **exactamente uno con `@default(1)`**.

## El arreglo, en el orden que importa  **[EXISTE]**

**Primero el llamador, después el schema.** Al revés se rompe el camino en vez de protegerlo.

1. `charges.routes.ts` escribe `merchantId: body.merchant_id` — el id **ya estaba validado tres
   líneas más arriba** (404 si el merchant no existe). El `Charge` de justo debajo ya lo escribía:
   el olvido era sólo del `Customer`.
2. `prisma/schema.prisma`: fuera el `@default(1)`. 🟢 Firmado por el fundador — *«la más segura y
   más sólida de cara a en un futuro tener muchos clientes»*.

## 🔴 Que el olvido deje de compilar — medido, no prometido  **[EXISTE]**

Regenerado el cliente con el **CLI local** (`node node_modules/prisma/build/index.js generate`;
`npx` prohibido, regla 3) y quitada a mano la línea del arreglo:

```
src/modules/billing/app/routes/charges.routes.ts(25,9): error TS2322:
  Property 'merchant' is missing in type '{ name; phone; email }' but required in type 'CustomerCreateInput'.
```

**El defecto exacto que originó el ticket ya no compila**, y **con la base todavía sin migrar**.

## La migración: una sentencia, cero filas  **[EXISTE]**

```sql
ALTER TABLE "customers" ALTER COLUMN "merchant_id" DROP DEFAULT;
```

⛔ **No aplicada en ninguna base.** La aplica el fundador. Detalle completo, con la medida de las
filas del demo y el control positivo, en **`docs/MIGRATIONS_PENDING.md`**.

Lo que hay que saber aquí: `preview-migracion.mjs` la marca **🔴 destructiva**, y **eso no
significa lo que parece** — la regla que casa en `_clasificador-sql.mjs` es `PALABRA('DROP')`, la
que existe para `DROP COLUMN`. Es una lista blanca: dice *«no reconozco esta forma»*, no *«borra
datos»*. Se midió aplicando la sentencia **de verdad** dentro de una transacción revertida
(`@ 06:42:21Z`): huella SHA-256 de `(id, merchant_id)` **idéntica** antes, dentro y después —
**14 filas, 7 del demo, cero tocadas** —, con `column_default = null` dentro como control positivo
de que la DDL corrió. Dev quedó exactamente como estaba.

**✅ Y el control que no se podía perder:** los **7 clientes que hoy pertenecen al demo
legítimamente siguen perteneciéndole**. Ninguna fila cambia de dueño; no se ha encendido ningún
backfill.

## El guard  **[EXISTE]**

`tests/scrum797-el-dueno-se-escribe.test.mjs`, 5 tests, sin BD y sin gate.

**No vigila «que no vuelva el `@default(1)`» y ya**, porque ésa es la mitad barata: vigila que
**el alta DIGA el dueño**, lleve la columna el defecto o no. Con la columna obligatoria el olvido
es ruidoso, pero eso sólo se descubre **ejecutando** ese camino — y `POST /charges` no tiene test
de integración con BD en la tanda normal.

- 🔴 **SUELO:** menos de 20 altas vistas, o menos de 20 modelos leídos → **CIEGO**. Un «0 omiten»
  sacado de un barrido que no llega al código es la lectura más cómoda y la más cara.
- 🔴 **El que decide:** ninguna alta de `Customer` omite `merchantId`, en todo el árbol derivado.
- 🔴 En `src/` tampoco ninguna **ilegible**: `null` es «no se sabe», y absolver un camino sin
  mirarlo cuesta lo mismo que la omisión.
- 🔴 La columna **no vuelve a ser donante**.
- ✅ **Positivo:** el alta real (`createCustomer`) se ve y escribe dueño y `portalToken`.

**Tres mutaciones declaradas** (`MUTACIONES_QUE_ME_TUMBAN`), cada una imitando el defecto que su
test promete cazar: quitar el dueño de `charges.routes.ts`, volver a clasificar la columna como
donante, y dejar ciego el barrido. **Ninguna muta `prisma/schema.prisma`**: es fichero del
fundador, no hay precedente en el árbol de mutarlo, y una pasada que muera a mitad lo dejaría
escrito (SCRUM-808).

## Lo que queda fuera, dicho

- ⛔ **No se ha tocado** `ensurePortalToken`, `botFlow` ni el sembrador. Ningún backfill. Ninguna
  fila ha cambiado de merchant.
- ⚠️ **Efecto lateral en el instrumento de SCRUM-795, dicho para que no sorprenda:**
  `motivosParaNoFiarse()` de `_censo-alta-de-cliente.mjs` declara **CIEGO** cuando ningún modelo
  tiene `@default(1)` — y desde hoy ninguno lo tiene. Es su comportamiento correcto (su pregunta
  deja de existir), y por eso el guard de este ticket **no usa ese suelo**: lleva el suyo, que
  mide altas vistas y no depende de que exista un donante.
- El `@default(1)` desaparece del schema, pero **la sentencia sigue pendiente en las tres bases**:
  hasta que se aplique, quien escriba SQL en crudo sigue teniendo el defecto debajo.

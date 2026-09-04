# SCRUM-587 · CONT-14 · El descuento pactado con el cliente, PROPUESTO

**Medido contra:** `origin/main` = `6f8221c66ea6215a22b02247b172969e67ab47ea` · 2026-09-04T17:15:02+01:00
**Rama:** `scrum-587-descuento-por-defecto`

> El ancla se remidió tras mezclar `main` dentro de la rama (AA2): `main` se movió **tres veces**
> durante este carril (`d502c3f4` → `4c590f64` → `da5af22e` → `6f8221c6`). La mezcla fue limpia.

---

## 1 · PASO 0 (regla 39)

### a) ENTRADA — dónde vive hoy, con fichero y línea

| | dónde | qué hay hoy |
|---|---|---|
| la ficha del cliente | [customersView.js:908](../../public/dashboard/js/customersView.js#L908) (`internalRef`), [:999](../../public/dashboard/js/customersView.js#L999) (`recargoEquivalencia`) | el formulario y su `createField`; el campo nuevo va en este bloque |
| el guardado | [customersView.js:1234-1242](../../public/dashboard/js/customersView.js#L1234-L1242) | el payload, con el criterio `|| null` de sus vecinos |
| la validación | [schemas.ts:542](../../src/core/validation/schemas.ts#L542) | el `customerCreateSchema`, que acaba en la 543 |
| el `select` de lectura | [customerAdmin.ts:25](../../src/modules/system/customerAdmin.ts#L25) | qué campos del cliente viajan |
| **dónde se leería al crear el presupuesto** | [quotesView.js:1638-1640](../../public/dashboard/js/quotesView.js#L1638-L1640) | 🔴 **el editor YA resuelve el objeto del cliente elegido** (`customersList.find(...)`) para pintar la vista previa. El dato ya está en la mano; no hay que ir a buscarlo |

### b) MECANISMO — ¿por línea o una vez al abrir? **Se PROPONE, y aterriza en las líneas**

Medido, no elegido: **el único porcentaje que existe en el documento es el `dto` de la LÍNEA**
([schemas.ts:129](../../src/core/validation/schemas.ts#L129)). El descuento global de SCRUM-594 es
un **importe en €** (`discount_global_amount DECIMAL(12,2)`), y esa asimetría está escrita a
propósito por los dos fundadores para que nadie la armonice. Censo: **cero** campos de descuento
global en % en `src/`, `public/` y `prisma/`.

Así que un % pactado sólo puede aterrizar en las líneas. **Propuesta, no aplicación:**

- `propuestaPara(cliente)` **devuelve un dato** y no toca nada.
- `aplicarA(lineas, pct)` es **otra función**, que alguien tiene que llamar.

Son dos y no una a propósito. Si algún día se fusionan en una llamada cómoda, el ticket está roto:
un descuento aplicado en silencio es dinero que sale del bolsillo del profesional sin que lo haya
decidido ESTA vez, y el día que quiera cobrar el precio entero no sabrá por qué le sale otro número.

**Y no pisa lo tecleado a mano:** una línea que ya trae su propio `dto` se queda como está. Un 15 %
escrito hace diez segundos es más reciente y más específico que un acuerdo general.

### c) 🔴 Un presupuesto YA CREADO no se mueve — y es ESTRUCTURAL, no una promesa

`Quote.lines` es una columna **`Json`** ([schema.prisma](../../prisma/schema.prisma), modelo
`Quote`): una **instantánea congelada al crear**. El documento no vuelve a preguntarle nada al
cliente, así que el acuerdo puede cambiar mañana sin reescribir el pasado.

No se deja como argumento: se **ejecuta**. Se guardan las líneas con un 10 %, se lleva el descuento
del cliente a 25, 0, `null` y 100, y se recalcula desde las líneas guardadas. Los céntimos no se
mueven. Además `aplicarA` devuelve **copias** y no muta el array que recibe — con la mutación
puesta a mano, ese test cae.

### d) LA FORMA DE LOS VECINOS — y una corrección al encargo

`nullable().optional()` y **nunca** `.default(0)`: `NULL` = «no hay descuento pactado» y `0` = «se
pactó expresamente un 0 %» son cosas distintas y las dos son legítimas.

📌 **El encargo cita `billingPeriodicity` como ejemplo de esa forma, y medido NO lo es:** es
`String @default("NINGUNA")` ([schema.prisma:102](../../prisma/schema.prisma#L102)) con un
`z.enum(...).optional()` **sin `.nullable()`**. Los que sí llevan la forma buena son
`recargoEquivalencia`, `tipoDestinatario`, `contactKind`, `tags` e `internalRef`. Se ha copiado a
**esos**. El `0` se distingue del `null` en el código y en la base, y hay test de las dos cosas.

### e) `ls-remote` completo (paso 2 de `cerebro-yaqu`)

Sin rama `scrum-587-*` en el remoto: **el carril estaba libre.**

---

## 2 · FASE A — el ALTER, con su antes y su después

**El tipo NO se escribió a mano.** Lo generó `prisma migrate diff` con el **CLI local** (nunca
`npx`, que se baja otro de la red en silencio y devuelve un vacío que se lee como «sin cambios» —
incidente del 5-ago-2026), entre **dos datamodels** en el scratchpad, **sin tocar ninguna base ni
`prisma/schema.prisma`**:

```
ALTER TABLE "customers" ADD COLUMN "dto_por_defecto" DECIMAL(5,2);
```

**Veredicto aditivo** — ni DROP, ni RENAME, ni TRUNCATE, ni SET NOT NULL. **Control positivo:** la
herramienta respondió y el recuento de columnas de `Customer` pasó de **29 a 30**.

🔴 **`DECIMAL(5,2)` y no otra cosa:** tres enteros para el 100 y **dos decimales, los mismos que
`DECIMALES_PORCENTAJE` le exige al `dto` de la línea**. Con más decimales, un `33,333 %` guardado
en el cliente sería un presupuesto que no se puede guardar y el profesional no sabría por qué.
Importa porque `schemaDrift` comprueba que la columna **exista, no su tipo**: creada INTEGER
arrancaría en verde y se pudriría al primer 12,50 %.

**Aplicado SÓLO a la base de desarrollo**, con la herramienta acotada de la casa
(`scripts/aplicar-sql-dev.mjs`, que sólo acepta `DATABASE_URL_DEV`). Destinos acreditados antes con
`scripts/comprobar-claves-bd.mjs` (`DATABASE_URL`: **ausente**, correcto en un árbol de trabajo).

| base física | ANTES | DESPUÉS |
|---|---|---|
| **`yaqu_dev_javier`** (`DATABASE_URL_DEV`) | `dto_por_defecto` **ausente** · 11 filas | `numeric(5,2)` · nullable · **sin default** · 11 filas |
| `railway` (staging/tests) | — | ⛔ **no tocada**: el encargo dice «sólo tu base de desarrollo» |
| producción | — | ⛔ **PENDIENTE, la aplica el fundador** |

**Control positivo en las dos lecturas:** `customers.recargo_equivalencia` (`boolean`) y
`quotes.discount_global_amount` (`numeric(12,2)`). Sin ellos, «no está la columna» no se distingue
de «no se vio nada» — y el segundo es además el control de cómo se ve un DECIMAL bien creado en
esa misma base.

SQL en [`docs/sql/scrum-587-descuento-por-defecto.sql`](../sql/scrum-587-descuento-por-defecto.sql),
verificación con su control positivo en
[`docs/sql/scrum-587-verificar.sql`](../sql/scrum-587-verificar.sql).

### ⛔ Por qué `prisma/schema.prisma` sigue sin tocarse

`schemaDrift` compara **esperado ⊆ real** al arrancar: una columna de MÁS en la base es inocua, una
de MENOS **impide arrancar producción** y Railway deja vivo el despliegue anterior. El esquema, el
cableado y los tests entran juntos y sin partir **cuando las tres bases tengan la columna**. El
guard `constancia-del-alter` (SCRUM-687) ya tumbó un PR hoy por exactamente esto.

---

## 3 · El rojo, probado por el mecanismo

Seis mutaciones sobre `descuentoPorDefecto.js`, cada una rompiendo **una** cosa. Las seis caen, y
**cada una por el test que le toca**, que la nombra. Módulo restaurado y verde al cerrar.

| se rompe | cae |
|---|---|
| 🔴 la **lectura del valor por defecto** (siempre `null`) | «un 0 % PACTADO consta» (6 fallos) |
| `null` y `0` se colapsan (el `\|\| 0` que la columna nullable existe para impedir) | «un cliente SIN descuento pactado» (3) |
| la propuesta **pisa** el `dto` tecleado a mano | «NO pisa el descuento» (1) |
| `aplicarA` **muta** el array recibido | «NO mueve un presupuesto YA CREADO» (3) |
| se **reimplementa** la aritmética en vez de leer la del 594 | «NO reimplementa la aritmética» (1) |
| 🔴 **SUELO**: el censo de clientes con descuento se queda vacío | «SUELO» (2) |

**Control negativo:** renombrar rótulos del cliente (`name`, `legalName`, `internalRef`) **no**
mueve un céntimo. El cálculo está atado al dato, no al texto — que además todavía no está firmado.

**Suelo:** el censo de clientes con propuesta tiene que traer **5 de 6** (sólo el 0 % se queda
fuera). Si sale vacío, el test falla: sin eso, todas las afirmaciones de arriba serían ciertas
sobre un conjunto vacío.

---

## 4 · Lo que NO se ha construido, y por qué

🔴 **La superficie de la propuesta vive en `quotesView.js`, que es el carril de S2 (SCRUM-602).**
El encargo dice que si el trabajo lleva allí hay que decirlo **antes** de tocar. Se dice: no se ha
tocado ni una línea de ese fichero. El enganche es pequeño y está medido —
[quotesView.js:1638-1640](../../public/dashboard/js/quotesView.js#L1638-L1640) ya resuelve el
objeto del cliente— pero lo decide el asesor.

**El campo en la ficha** (`customersView.js`, zod, `customerAdmin.ts`) no entra todavía: sin la
columna en las tres bases no puede ir y venir, y el precedente de SCRUM-580 dice que el cableado va
en el PR ③ junto al esquema, **sin partir**.

**El rótulo del campo no está firmado** y no se ha inventado ninguno. El asesor pidió la caja a
929 px y 390 px para firmarlo: **no se ha podido medir, el servidor de Playwright lleva caído toda
la sesión** (`CONNECT_TIMEOUT`). Queda pendiente, y con él la medida de la caja del contador de
SCRUM-582.

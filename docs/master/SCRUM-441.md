# SCRUM-441 · `Invoice` no guarda cómo entró el dinero — PASO 0 y preview, SIN APLICAR

> **Esto NO aplica nada.** Ni a staging, ni a `yaqu_dev_javier`, ni a producción, ni a
> `prisma/schema.prisma`. Es la medición previa y el diff escrito, para que el fundador decida.

**Medido contra:** `origin/main` = `3d8c1d7d91d151d87d960aa9b1927dedc9cddab4` · 2026-08-12T10:54:13+02:00
**Rama:** `scrum-441-metodo-en-invoice`
**Host de la sesión:** `DESKTOP-T5MONF5` · node v24.8.0 · `npm ci` → rc=0
**Bases tocadas en esta sesión: NINGUNA**, ni en lectura. El único comando de Prisma que se ejecutó
fue `migrate diff --from-empty`, que no se conecta a nada, y el script le inyecta a propósito una URL
que no lleva a ninguna parte.

---

## 0. Las tres puertas

| puerta | resultado |
|---|---|
| ¿rama en `origin`? | **No.** `git ls-remote --heads origin` (236 refs, listado completo) no trae ninguna `scrum-441-*`. |
| ¿entrada en `main`? | **No.** `git show origin/main:docs/master/SCRUM-441.md` → rc=128. |
| ¿mecanismo en el código? | **No.** El modelo `Invoice` tiene 36 campos y **ninguno es `method` ni `paidVia`**. |

⚠️ **Dos trampas que casi cuelan un falso positivo, y quedan escritas:**

1. `git ls-remote | grep 441` devuelve **tres líneas**… y las tres son el número **dentro del sha**
   (`…441f5c…`, `…f441b1…`, `…9441d6…`). Ninguna es un nombre de rama. Grepear la línea entera de
   `ls-remote` mezcla sha y nombre: **hay que mirar el nombre, no la línea.**
2. Existía una rama **local** `scrum-441-metodo-en-invoice` que no está en `origin`. Medida antes de
   tocarla: `git log origin/main..scrum-441-metodo-en-invoice` → **0 commits propios** y diff vacío.
   Es una etiqueta de un PASO 0 anterior, sin trabajo dentro. Se avanzó por *fast-forward*, **no** se
   reseteó: nada que perder, pero se comprobó antes en vez de suponerlo.

**Conclusión: no hay nada construido. La tarea está entera.**

---

## 1. Qué distingue hoy una transferencia marcada a mano de un cobro del que no se sabe nada

**Nada. Los dos caen en el mismo cubo.** Confirmado con dos instrumentos independientes:

**Instrumento A — el esquema.** `model Invoice` no tiene campo de método. El dato **no existe**, así
que no hay nada que distinguir. Control positivo del instrumento: la misma lectura **sí** encuentra
`method` en `model Charge`, o sea que sabe mirar.

**Instrumento B — el lector.** `cobros.service.ts:233` construye la población de facturas sueltas con
`metodo: null` y `...camposDeMetodo(null)`, que devuelve `metodoCubo: 'sin-metodo'`. En la pantalla
las dos salen como **«Método no registrado»**.

Y hay una tercera confirmación que no busqué: **el código ya lo declaraba**. El comentario de esa
misma línea nombra este ticket — *«mientras `Invoice` no tenga método, el filtro no puede separar una
transferencia marcada a mano de un cobro del que de verdad no se sabe nada»*. El límite estaba
escrito antes de medirlo.

> Lo que el profesional ve hoy: cobra una obra por transferencia, la marca a mano, y la pantalla del
> dinero le dice que **no consta cómo entró**. Es verdad para el sistema y mentira para él, que lo
> sabe perfectamente. Con `Charge` la casa distingue cinco métodos; con lo marcado a mano, cero.

---

## 2. Quién escribiría la columna, y CUÁNDO

Censo por AST (`prisma.invoice.<update|updateMany|upsert|create|createMany>`), con control positivo
vivo — el mismo instrumento ve 8 escrituras de `Charge`, así que no está ciego. De **26** escrituras
de `Invoice`, **8 tocan `paidAt` o `status`**:

| sitio | qué es | ¿escribiría el método? |
|---|---|---|
| `mpWebhook.routes.ts:138` | webhook MercadoPago | **No** — ya crea `Charge` con su método |
| `psp.routes.ts:143` y `:186` | pasarela | **No** — ídem |
| `invoice.routes.ts:108` | cobro por pasarela | **No** — ídem |
| `invoicesAdmin.routes.ts:382` | `updateMany` | a revisar |
| `invoicesAdmin.routes.ts:788` | toca `status`, **no** `paidAt` | **No** |
| `invoicesAdmin.routes.ts:912` | `create` con `paidAt` | a revisar |
| **`invoiceAdmin.ts:167`** | **el marcado A MANO** | **SÍ — es el único que lo necesita** |

**Sí: el único momento sensato es al marcar la factura como cobrada, y eso es
`updateInvoiceStatusAdmin`.** Lo dices antes de que se construya, así que aquí va medido:

- **Lo que ese punto escribe hoy:** `data: { status, paidAt }`. Nada más.
- **¿Toca el camino de emisión?** **No.** Ni `grossOfLines`, ni `desglose`, ni XML, ni `vfHash`
  aparecen en el fichero (el único acierto de «sellado» es un comentario sobre la anulación). El
  instrumento está probado: encuentra `grossOfLines` en otros 7 ficheros.
- **Pero está pegado a la regla 29:** justo encima vive el guard *«Una factura emitida no se
  des-paga: emite una rectificativa (R1)»*. Escribir aquí es escribir en una fila que **puede estar
  sellada**.
- **Y esto es lo que lo desbloquea:** `computeVeriFactuHash` (`verifactu.service.ts:91`) hashea una
  concatenación **explícita de ocho campos** — `IDEmisorFactura`, `NumSerieFactura`,
  `FechaExpedicionFactura`, `TipoFactura`, `CuotaTotal`, `ImporteTotal`, `Huella`,
  `FechaHoraHusoGenRegistro`. **Una columna nueva no entra en el hash.** Añadirla no altera ninguna
  huella ya calculada, ni la cadena, ni el QR.

### 🛑 El aviso que pediste, respondido

**El cable NO toca `grossOfLines` ni el desglose del XML.** Ninguno de los cuatro ficheros que marcan
una factura como cobrada los nombra. Los ficheros que sí tocan `grossOfLines` son otros siete
(`finalInvoice.service.ts`, `invoiceLines.service.ts`, `recargoEquivalencia.ts`, `retencionIrpf.ts`,
`jobs.routes.ts`, `quotes.routes.ts`, `quotesAdmin.routes.ts`) y **ninguno está en este camino**.

---

## 3. 🔴 LA COLUMNA ENTRA VACÍA

Condición del fundador, y la razón está medida en SCRUM-473: `Charge.method` guardó **a la vez** la
intención (`card`, la preferencia del profesional) y el hecho (`card:stripe`, lo que escribió la
pasarela). Copiar ese campo a `Invoice` importaría la ambigüedad entera en vez de moverla, y encima
la volvería irreversible — nadie podría ya distinguir qué filas se copiaron.

**Nada de backfill. Ni un `UPDATE … FROM Charge`. Ni un `DEFAULT`.** `NULL` significa exactamente lo
que hoy significa —«no consta»— y el lector ya lo trata bien: cae en «Método no registrado» sin
inventarse nada. La columna solo se rellena hacia adelante, cuando alguien lo declare.

---

## 4. EL PREVIEW · escrito y NO aplicado

**Control positivo, ejecutado** (`scripts/preview-migracion.mjs`, CLI **local** por ruta — nunca
`npx prisma`, que se baja otro CLI de la red y su vacío miente, SCRUM-385):

```
migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
→ ok: true · CREATE TABLE: 24
```

**24**, el número esperado: la herramienta ve el esquema entero y contesta. Por lo tanto, si el diff
de abajo es corto, es **porque el cambio es corto**, no porque la herramienta esté muda.

```sql
-- SCRUM-441 · Invoice: cómo entró el dinero. NO APLICADO.
-- Aditivo, nullable, sin DEFAULT y SIN BACKFILL: la columna entra VACÍA (§3).
ALTER TABLE "Invoice" ADD COLUMN "method" TEXT;
```

Una sola sentencia, aditiva, sin reescritura de tabla y sin bloqueo largo en Postgres (una columna
nullable sin default no reescribe las filas).

### Decisión que NO tomo yo: el NOMBRE de la columna

`prisma/schema.prisma` es dominio exclusivo del fundador, y el nombre importa más de lo que parece:

- **`method`** — igual que `Charge.method`. Ventaja: un solo vocabulario. **Riesgo: hereda el nombre
  del campo que hacía dos trabajos**, y el nombre es justo lo que invita a repetirlo.
- **`paidVia`** — el vocabulario que la casa ya usa para *cómo se pagó* (`PAID_VIA`, `paidVia.ts`).
  Dice **hecho**, no intención, y por construcción no invita a meter ahí una preferencia.

**Recomiendo `paidVia`**, precisamente porque este ticket existe para no repetir la ambigüedad. Pero
la elección es tuya, y el SQL de arriba cambia una palabra según lo que decidas.

---

## 5. El orden de aplicación, cuando des el GO

1. **staging** → aplicar → **verificar** (columna presente, nullable, sin filas rellenas)
2. **producción** → aplicar → **verificar** lo mismo
3. **`prisma/schema.prisma` AL FINAL**, nunca antes.
4. Registrar el `db push` en `docs/MIGRATIONS_PENDING.md`.

`yaqu_dev_javier` **no la aplica esta sesión**: es del carril B y se le pide a Javier.

---

## 6. Huecos declarados

1. **Ningún recuento de filas de producción.** No se ha mirado cuántas facturas hay marcadas a mano:
   no se toca ninguna base en esta sesión. Si esa cifra hace falta para decidir, es otra medición.
2. **`invoicesAdmin.routes.ts:382` y `:912` quedan «a revisar».** El AST dice que tocan `paidAt`,
   pero **no** se ha leído qué caso de negocio son. No se afirma que escriban o no el método.
3. **El censo es de escrituras por Prisma.** Un `$executeRaw` que tocara `Invoice` no lo ve el
   instrumento A. No se ha barrido eso: si el GO llega, es lo primero que hay que añadir.
4. **No hay guard todavía.** Este documento es una medición, no un mecanismo. El guard que impida
   que la columna se rellene por copia desde `Charge` **no existe** y habría que escribirlo con el
   ticket, no después.

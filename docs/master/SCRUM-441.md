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

### El NOMBRE, decidido — y el ESTILO, medido

**El campo se llama `paidVia`, no `method`** (decisión del fundador, 12-ago-2026). El motivo es el
ticket entero: `method` hereda el nombre del campo que hacía dos trabajos, y **el nombre es lo que
invita a repetirlo**. `paidVia` es además el vocabulario que la casa ya usa para *cómo se pagó*
(`PAID_VIA`, `paidVia.ts`): dice **hecho**, no intención.

Y el estilo del nombre de columna **no se decidió a ojo ni por analogía con otra tabla: se contó.**
La tabla real es `invoices` (`@@map`), y mezcla los dos estilos de verdad. Contadas las columnas
resolviendo `@map` —que es lo que acaba en Postgres—, y separando las relaciones (no son columnas) y
las de una sola palabra (`id`, `total`, `status`… no distinguen estilo):

| estilo | nº | cuáles |
|---|---|---|
| **`snake_case`** | **16** | `charge_id`, `paid_at`, `client_comment`, `stage_label`, `albaran_refs`, `deducts_refs`, `rectifies_id`, `vf_estado`, `vf_hash`, `vf_prev_hash`, `vf_timestamp`, `vf_anul_hash`, `vf_anul_timestamp`, `vf_anul_prev_hash`, `reminder_7_sent_at`, `reminder_14_sent_at` |
| `camelCase` | 7 | `merchantId`, `customerId`, `quoteId`, `pdfUrl`, `qrData`, `registerId`, `createdAt` |

**De las 23 que distinguen estilo, la mayoría es `snake_case`, 16 a 7.** Así que la columna se llama
**`paid_via`**, y el campo de Prisma la mapea. Nota de contexto: las 7 `camelCase` son las columnas
más antiguas (claves foráneas y `createdAt`); las `vf_*` y las `reminder_*`, todas posteriores, son
`snake_case`. La tabla ya se estaba moviendo hacia ahí.

```sql
-- SCRUM-441 · invoices: cómo entró el dinero. NO APLICADO.
-- Aditivo, nullable, sin DEFAULT y SIN BACKFILL: la columna entra VACÍA (§3).
ALTER TABLE "invoices" ADD COLUMN "paid_via" TEXT;
```

Una sola sentencia, aditiva, sin reescritura de tabla y sin bloqueo largo en Postgres (una columna
nullable sin default no reescribe las filas).

Y la línea que irá en `prisma/schema.prisma` **AL FINAL**, cuando las dos bases estén aplicadas y
verificadas:

```prisma
paidVia  String?  @map("paid_via")
```

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
4. **El guard NO cubre una base ya escrita.** Vigila el árbol —`src/`, `docs/sql/`, `scripts/`—, que
   es por donde entraría un backfill. Un `UPDATE` tecleado a mano en una consola contra producción
   no lo ve nadie, y eso no lo arregla un test.

---

## 7. EL GUARD, que va con el ticket y no después

`tests/scrum441-paidvia-sin-copia.test.mjs` + `tests/_censo-backfill-paidvia.mjs`. Corre en
`npm test`: **4 tests, rc=0.**

Impide lo que §3 prohíbe: que `invoices.paid_via` se rellene copiándolo de `Charge.method`. Detecta
las cuatro formas en que entraría —`UPDATE … FROM charges` en un `.sql`, `data: { paidVia:
charge.method }` en TypeScript, SQL crudo dentro de un `$executeRaw`, y la asignación indirecta a
través de un objeto intermedio—.

**No es un `grep`.** El código se mira por **AST**, que no ve comentarios; el SQL, quitándoselos
antes. Es la trampa que ha mordido cuatro veces a esta casa: un guard de texto se caza a sí mismo en
el comentario que explica la prohibición.

**Tiene SUELO, y aquí es imprescindible:** hoy la columna todavía no existe, así que el barrido sobre
el árbol da **cero por construcción** — un cero que no distingue «no hay backfill» de «no sé mirar».
Por eso el detector se prueba primero contra fixtures que SÍ lo tienen, en las cuatro formas, y el
test falla si no las ve. Hay además un **control negativo** (escribir el método declarado por el
profesional, leer la columna, o nombrar `charges` en otra sentencia **no** saltan: un guard que grita
por lo legítimo acaba desactivado) y la **ALLOWLIST vacía y visible**.

### Probado en rojo DOS VECES, por inyección

No basta con que esté verde. Se inyectaron dos backfills **reales**, no fixtures, y en los dos casos
el guard cayó nombrando fichero, línea y de dónde copiaba:

**① En TypeScript**, en el sitio exacto donde de verdad se escribiría (`invoiceAdmin.ts`, el marcado
a mano), con la forma más plausible: `paidVia: cargo?.method ?? null`.

```
rc=1
🔴 HAY UN BACKFILL DE `paid_via` DESDE `Charge`:
    src/modules/system/invoiceAdmin.ts:173 · asignación · paidVia: cargo?.method ?? null
```

**② En SQL, con un fichero de verdad en `docs/sql/`** — y esta segunda inyección se hizo por un
motivo concreto: la fixture del suelo prueba que el detector *entiende* ese SQL, pero **no** que el
barrido lo *recoja del disco*. Si `recoger()` no llegara a esa carpeta, el detector estaría bien y el
guard sería ciego igual.

```
rc=1
🔴 HAY UN BACKFILL DE `paid_via` DESDE `Charge`:
    docs/sql/_rojo-temporal-441.sql:1 · SQL · UPDATE invoices i SET paid_via = c.method
    FROM charges c WHERE c.id = i.charge_id
```

Revertidas las dos → rc=0, y el árbol limpio (`git status --porcelain` → 0 líneas).

### Verificación

- `npm test` → **3301 tests, 0 fallos, 77 saltados**, rc leído del propio comando.
- El guard, solo: **4 tests, rc=0**.
- **La línea base NO se pudo medir quitando el fichero**, y eso es un hallazgo, no un fallo: al
  apartarlo, `tests/scrum391-guards-declarados-presentes.test.mjs` se puso rojo con
  *«SCRUM-441.md declara tests/scrum441-paidvia-sin-copia.test.mjs, que NO está en el árbol»*. La
  casa ya tiene atada la entrada de máster a su guard. Así que la aportación no se resta de cabeza:
  se mide corriendo el fichero solo, y son **4**.

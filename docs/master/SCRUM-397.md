# SCRUM-397 · A · `Charge.paidAt` — diff de schema, SIN APLICAR

**Medido contra:** `origin/main` = `1e762862fcf70642fb533101ea0a0dddbe3119f1` · 2026-08-10T20:05:53+02:00
**Rama:** `scrum-397-fecha-real-de-cobro` · `prisma/schema.prisma` **no se toca**: esto es el bloque
para el lote que ya prepara otra sesión.

> 🔴 **PRIMERO ESCRIBÍ ESTO EN `SCRUM-397-A-schema.md`, y el guard de SCRUM-273 me cazó** — por
> tercera vez en esta sesión con el mismo error. Mi motivo era evitar chocar con la entrega de
> Javier (microcopy + guard, en `scrum-397-fecha-de-cobro-rebasada`, sin mergear), y era un motivo
> razonable **que no anula la regla**: el registro es UN fichero por ticket. La colisión al mergear
> se resuelve conservando AMBAS entradas dentro de este fichero, que es la norma de la casa — no
> inventando un nombre.

## 🔴 Antes del diff: el censo del encargo se queda corto — hay CINCO, no tres

El encargo daba tres sitios (`mpWebhook:142`, `psp:121`, `psp:167`). Derivado sobre `src/`:

| # | sitio | qué es | ¿`new Date()` es correcto? |
|---|---|---|---|
| 1 | `mpWebhook.routes.ts:142` | webhook MercadoPago | ✅ sí — el aviso llega al cobrar |
| 2 | `psp.routes.ts:121` | webhook PSP | ✅ sí |
| 3 | `psp.routes.ts:167` | webhook PSP | ✅ sí |
| 4 | **`invoicesAdmin.routes.ts:373`** | **marcado MANUAL EN LOTE** (`id: { in: ids }`, `status: { not: 'paid' }`) | 🔴 **no** — es la víctima |
| 5 | `invoicesAdmin.routes.ts:907` | crea la **rectificativa R1** con `status:'paid'` | ⚠️ discutible, y **regla 29/38** |

Y `invoice.routes.ts:112` (`paidAt: invoice.paidAt ?? now`), que el encargo sí traía.

**El 4 no estaba en el censo, y es marcado manual de varias facturas a la vez** — el mismo defecto
del encargo, multiplicado por el número de facturas del lote. `criterioCaja.ts:12` arrastra el mismo
recuento corto («medido en TRES sitios»), así que el error venía de antes y se propagó.

## El diff, para el lote

```diff
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ model Charge {
   status     String
+  /**
+   * SCRUM-397 · CUÁNDO ENTRÓ EL DINERO, como dato propio.
+   *
+   * Hasta hoy el cobro NO guarda la fecha: la exportación usa `updatedAt` (`exportData.ts:248`),
+   * que cambia con CUALQUIER edición posterior. Un pago del 31 de marzo que alguien edita el 2 de
+   * abril se exporta como de abril — y con criterio de caja eso es el euro declarado en el
+   * trimestre que no toca.
+   *
+   * NULLABLE y SIN `@default`, y no es prudencia: inventarle una fecha de cobro a un cobro
+   * histórico es exactamente el error que este ticket persigue. `null` = «no consta cuándo»,
+   * que es la verdad de todo lo anterior a esta columna. NO HAY BACKFILL.
+   */
+  paidAt     DateTime? @map("paid_at")
   expiresAt  DateTime? @map("vencimiento")
```

### El nombre físico se LEE, no se deriva

`Charge` es uno de los modelos que **no siguen la convención**: convive `@map("concepto")`,
`@map("importe")`, `@map("moneda")`, `@map("vencimiento")`, `@map("referencia")` —castellano— con
`@map("created_at")` y `@map("updated_at")` —snake inglés—. Y `@@map("charges")`.

**`paid_at`** se elige por sus hermanos de la MISMA fila: las otras dos marcas de tiempo del modelo
son `created_at` y `updated_at`. No por la convención general del schema, que aquí no aplica.

### El SQL

```sql
-- AlterTable
ALTER TABLE "charges" ADD COLUMN     "paid_at" TIMESTAMP(3);
```

| | n |
|---|---|
| `ADD COLUMN` | **1** |
| `DROP` · `ALTER COLUMN` · `NOT NULL` · `DEFAULT` · `UNIQUE`/`INDEX` | **0** |

100 % aditivo. `db push` **no debe** pedir `--accept-data-loss`; si lo pide, el diff no es éste.

### Filas existentes

**Ninguna se toca.** `paid_at` nace `NULL` en todos los cobros ya registrados, y **no se
backfillea desde `updatedAt`**: `updatedAt` es «la última vez que alguien tocó la fila», no «cuándo
entró el dinero». Rellenarlo con eso sería fabricar el dato que el ticket denuncia como inventado.

Consecuencia que conviene ver antes de aplicar: con la columna puesta, la exportación tendrá **dos
poblaciones** —cobros con fecha y cobros sin ella— y mezclarlas en una cifra volvería a producir un
número que no significa nada. Igual que en SCRUM-403 con `Expense`.

---

# SCRUM-397 · B · el código — ALCANCE MEDIDO, **no construido**. Y por qué paro.

**Paro antes de escribir código**, con el terreno medido para que la siguiente sesión no re-derive
nada. El motivo es el que tú mismo fijaste en SCRUM-368: *«el documento enmendado con la atadura sin
hacer es el defecto de este ticket con apariencia de resuelto»*. Aquí sería lo mismo — un formulario
de fecha a medias, en el camino del dinero, es peor que no empezarlo.

## 🔴 Dos correcciones al encargo, medidas por FICHERO y por LADO

**① `invoice.routes.ts:112` NO es el marcado manual.** Vive dentro de
`router.post('/:id/paid-webhook')` (línea 60) — **es un webhook**. Y ahí `paidAt: invoice.paidAt ?? now`
es correcto: el aviso llega al cobrar. Cero llamadas de emisión en su cuerpo.

**② El marcado manual de FACTURAS es `POST /bulk-paid`** (`invoicesAdmin.routes.ts:361`,
`requireRole('admin')`), que el censo del encargo no traía. Marca **varias facturas a la vez** con
`paidAt: new Date()` — el defecto multiplicado por el tamaño del lote.

### Regla 38, medida y no supuesta

| handler | ¿llama a `emitInvoice` / `allocateInvoiceNumber` / `applyVeriFactu` / `sellar*`? |
|---|---|
| `POST /bulk-paid` (`invoicesAdmin.routes.ts:361`) | **no** — cero |
| `POST /:id/paid-webhook` (`invoice.routes.ts:60`) | **no** — cero |

**Marcar un cobro no es emitir: confirmado por medición, no por intuición.** B no toca el camino de
emisión y **no necesita GO por regla 38**.

⚠️ **La excepción, y hay que verla antes de tocarla:** `invoicesAdmin.routes.ts:907` sí está en el
camino de emisión — crea la **rectificativa R1** con `status:'paid'` + `paidAt: new Date()`. Eso es
un documento que nace, no un cobro que se concilia. **Fuera del alcance de B** (regla 29/38): si
algún día se toca, va con diff y GO.

## Las tres superficies manuales, localizadas

| # | superficie | qué marca | hoy |
|---|---|---|---|
| 1 | `POST /admin/invoices/bulk-paid` | N facturas a la vez | `paidAt: new Date()` |
| 2 | `POST /admin/charges/:id/confirm-bizum` (`chargesAdmin.routes.ts:15`) | un cobro por Bizum | `Charge` **no tiene** `paidAt` → depende de A |
| 3 | el front que llama a las dos | — | no pregunta la fecha |

**La 2 depende de A**: sin `Charge.paidAt` no hay dónde guardarla, así que B para cobros entra
**con la migración**, igual que el `deductsRefs` de SCRUM-16.

## Microcopy PROPUESTA (regla 30 — no aprobada)

> **Rótulo del campo:** «¿Qué día entró el dinero?»
> **Ayuda:** «Por defecto, hoy. Si lo conciliaste más tarde, pon la fecha real del ingreso.»
> **Error de fecha fuera de rango:** «Esa fecha no puede ser posterior a hoy.»

⚠️ **NO re-propongo la frase de Javier** («Los cobros con tarjeta los confirma la pasarela: la fecha
y la hora las pone…»), que está en `scrum-397-fecha-de-cobro-rebasada` con su guard de «no nombrar
lo apagado». Es otra frase, para otro sitio, y duplicarla crearía dos verdades.

## El criterio de fecha — PROPUESTO, pendiente de confirmación

**Propuesta:** no se admite fecha **futura**; hacia atrás, **sin límite**.

**El motivo:** una fecha futura no puede ser un hecho —el dinero no ha entrado— así que rechazarla no
pierde nada. Un límite hacia atrás sí perdería: el caso real es conciliar una transferencia vieja, y
poner un tope convertiría «no me deja» en «pongo la de hoy», que es exactamente el defecto que este
ticket persigue, solo que con el usuario forzado a cometerlo.

⚠️ **Declarado como PENDIENTE**: roza criterio de caja (A3), bloqueado esperando al asesor. No lo doy
por bueno.

## Lo que le queda a la siguiente sesión, sin re-medir nada

1. `POST /bulk-paid`: aceptar `paidAt` del cuerpo, validarla, y guardarla **por factura**.
2. `confirm-bizum`: lo mismo, **cuando exista `Charge.paidAt`** (bloque A).
3. El front: el campo con la microcopy, **por defecto hoy y editable**.
4. Los cuatro tests que pediste, y el rojo tiene que **nombrar que se perdió la fecha real**, no dar
   un error de fecha genérico.
5. `exportData.ts:248` deja de usar `updatedAt` para el cobro **cuando A esté aplicado** — y hasta
   entonces su comentario sigue siendo verdad y no se toca.

**Lo que NO he tocado:** `src/`, `prisma/schema.prisma`, y ninguna factura emitida.

---

# SCRUM-397 · B · el código — ENTREGADO

## El criterio del LOTE, escrito antes del código

`POST /bulk-paid` marca N facturas de golpe. **UNA fecha para toda la selección**, y es decisión, no
simplificación: la acción que la persona ejecuta **es una sola afirmación** —«estas se cobraron el
día X»—. Si se cobraron en días distintos son **dos hechos** y van en dos operaciones.

Lo que no puede pasar es que el producto ponga la misma fecha a documentos de días distintos **sin
que nadie lo haya dicho** — que es exactamente lo que hacía `new Date()`. Por eso la pantalla lo
avisa y **la auditoría registra la fecha y si se eligió o se heredó del valor por defecto**
(`fechaOrigen`): queda escrito que la afirmó una persona.

## Microcopy — APROBADA por el fundador (10-ago-2026)

```
Rótulo:   ¿Qué día entró el dinero?
Ayuda:    Por defecto, hoy. Si lo conciliaste más tarde, pon la fecha real del ingreso.
Error:    Esa fecha no puede ser posterior a hoy.
Lote:     Se aplicará esta fecha a todas las facturas seleccionadas. Si se cobraron en días
          distintos, márcalas por separado.
```

**No se re-propone la frase de Javier** (`scrum-397-fecha-de-cobro-rebasada`): la suya ya está
aprobada y su guard la vigila.

## Criterio de fecha — APROBADO

No futura · hacia atrás **sin límite**. Un tope convertiría «no me deja» en «pongo la de hoy», que
es el defecto del ticket con el usuario forzado a cometerlo. **Declarado: roza A3** y se revisa
cuando el asesor conteste.

## Regla 38, otra vez declarada

`POST /bulk-paid` y `POST /:id/paid-webhook` **no llaman** a `emitInvoice`, `allocateInvoiceNumber`,
`applyVeriFactu` ni `sellar*`. **Marcar un cobro no es emitir.** Y hay un test que lo fija: si el
handler del lote empezara a llamar a cualquiera de esos, cae y el ticket pasa a ser STOP.

`invoicesAdmin.routes.ts:907` **sí** está en el camino de emisión (nace una R1) y **queda fuera**.

## 🔴 El rojo NO salió a la primera, y el motivo es el de siempre

Al inyectar `new Date()` en el lote, **el guard siguió verde**. Casaba con `/fecha\.fecha/` sobre
*cualquier* propiedad `paidAt` del fichero — y encontraba **la metadata de auditoría**
(`paidAt: fecha.fecha.toISOString()`), tres líneas más abajo, que **no escribe en la base**.

La herramienta funcionaba perfectamente sobre el objeto equivocado. Arreglado: ahora localiza el
`invoice.updateMany` del handler **por su marca** (`id: { in: ids }`, no por su línea) y mira **su
`data.paidAt`**. Con eso el rojo sale y **nombra la pérdida de la fecha real**, no un error de fecha
genérico.

## Lo que queda pendiente, y de qué depende

`POST /admin/charges/:id/confirm-bizum` **no se ha tocado**: `Charge` no tiene `paidAt`, así que hoy
**no hay dónde guardar la fecha**. Entra con el bloque A, igual que el `deductsRefs` de SCRUM-16
esperó a su columna. Y `exportData.ts:248` deja de usar `updatedAt` cuando A esté aplicado — hasta
entonces su comentario sigue siendo verdad y no se toca.

**No se ha tocado:** `prisma/schema.prisma` · el camino de emisión · ninguna factura emitida.

---

# SCRUM-397 · PASO 0 · ¿fuente de verdad o copia? — **ni una cosa ni la otra**

**Medido contra:** `origin/main` = `fbcea8428bd5c5ea62babce22465a90bc9cb5683` · 2026-08-11T18:55:41+02:00
**Rama:** `scrum-397-paid-at-fuente-o-copia` · No se ha tocado código: esto es la respuesta a la
pregunta de diseño.

## Respuesta corta, sin rodeos

**NO es una copia de `Invoice.paidAt`.** La pediste bien.

**Pero la pregunta se hizo un modelo demasiado pronto: el hecho YA tiene casa**, y no es ninguna de
las dos. Es `Event{type:'paid'}.ts` — y ahí está el defecto de verdad, que es peor que una columna
vacía: **tres consumidores leen la fecha de cobro de tres sitios distintos y dos se equivocan.**

## 1 · Por qué NO es una copia: ninguno de los dos conjuntos contiene al otro

| | |
|---|---|
| **Charge SIN Invoice** | `charges.routes.ts:39` crea el cobro **sin factura**. Al pagarse, solo nace una si `AUTO_INVOICE_ON_PAID` está en ON (`env.ts:46`, y exige literalmente `'true'`/`'1'`: **apagada salvo que se ponga**) o si ya había una ligada. Si no: **cobro pagado, factura ninguna, y ningún sitio guarda cuándo entró el euro.** |
| **Invoice SIN Charge** | el dinero marcado a mano no crea `Charge` (SCRUM-441). Ahí `Invoice.paidAt` es la única fuente. |

Así que no hay «dos sitios donde vive el mismo hecho»: **hay dos hechos distintos que a veces
coinciden.** Cuando coinciden, `chargeId` los vincula (SCRUM-445, ya en `main`).

🔴 **Lo que decide el tamaño de esto no está en el código, sino en Railway:** el valor de
`AUTO_INVOICE_ON_PAID` en producción. Si está **OFF**, *todos* los cobros por enlace pagados están
sin factura y la columna es la **única** fuente posible. Es un dato que tú puedes leer y yo no.

## 2 · El hallazgo, que cambia el trabajo: el hecho ya está escrito

Censo COMPLETO de escrituras a `Charge` en `src/` — **ocho**, derivado, no de memoria:

| sitio | qué escribe |
|---|---|
| `charges.routes.ts:39` | crea (`status: 'pending'`) |
| `mpWebhook:99` · `psp:83` | **`status: 'paid'`** ← los dos únicos |
| `mpWebhook:216` · `psp:274` · `psp:285` | `failed` / `expired` |
| `payMp:62` | `intentId` |
| `invoicing.ts:150` | `receiptToken` |

**Ninguno escribe `paidAt`: el ticket tiene razón, son cero.** Pero los dos que marcan `paid` crean
**en la misma operación** un `Event{type:'paid'}` cuyo `ts` es `@default(now())`. El instante del
cobro **sí se guarda**, en una tabla que además **nunca se edita**.

### Y tres consumidores no se ponen de acuerdo

| quién | de dónde saca «cuándo se pagó» | |
|---|---|---|
| `receipt.routes.ts:208` | el evento `paid` **más reciente** | 🔴 **y el duplicado es más reciente**: `psp.routes.ts:32-38` crea otro `paid` (con `duplicate: true`) si el webhook se repite. El recibo del cliente enseñaría la fecha del reintento. |
| `exports.routes.ts:489` | el **primer** evento `paid`, con `updatedAt` de reserva | ✅ el más correcto de los tres |
| `exportData.ts:248` | **`updatedAt`** | 🔴 el defecto original del ticket, con su comentario reconociéndolo |

**Eso es el ticket de verdad.** La columna vacía es el síntoma; el desacuerdo es la enfermedad.

## 3 · El camino manual, que es donde la fecha importa

`POST /admin/charges/:id/confirm-bizum` (`chargesAdmin.routes.ts:15`) no escribe el cobro: reenvía a
`/webhooks/psp` **y ya manda un `ts`** (línea 41). `PSPWebhookSchema` **no lo lee**: acaba dentro del
`payload` del evento, sin que nadie lo mire, y el `ts` del evento vuelve a ser la hora de proceso.

O sea: un Bizum recibido el **31 de marzo** y confirmado por el PRO el **2 de abril** queda fechado
en abril **también por el lado del cobro**. Es la víctima exacta del ticket — la misma que
`fechaDeCobro.ts` ya resuelve para las facturas, y que aquí no se aplica.

## 4 · Recomendación

**Sí a la columna, pero no como «la fuente»: como el ÚNICO sitio donde los tres consumidores miran.**

- Se escribe en las **dos** transiciones a `paid`, con **el mismo instante** que el evento (no con un
  `new Date()` aparte, que ya serían dos relojes).
- **Sin backfill.** `null` = «no consta cuándo», que es la verdad de todo lo anterior. `updated_at`
  es «la última vez que alguien tocó la fila», no «cuándo entró el dinero».
- El camino manual (`confirm-bizum`) pasa a llevar **fecha declarada** por `resolverFechaDeCobro`,
  que ya existe, ya está aprobada y hoy no cubre este lado.
- Y un guard que impida que `paid_at` y el evento discrepen: **la columna no puede convertirse en la
  cuarta respuesta distinta.**

**Por qué columna y no derivarlo del evento:** `Event` solo tiene `@@index([chargeId, type])`. Filtrar
«los cobros de este trimestre» por el evento es un barrido de toda la tabla — que es justo el motivo
por el que `exportData.ts` acabó usando `updatedAt`.

## 5 · La consulta que NO he ejecutado

Tu número (cuántos `Charge` sin `Invoice`) necesita una base real, y en esta tanda no toco ninguna.
Queda escrita para que la corras tú:

```sql
-- Cobros PAGADOS que no tienen ninguna factura: ahi paid_at seria la unica fuente.
SELECT COUNT(*) FROM "charges" c
WHERE c."status" = 'paid'
  AND NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."charge_id" = c."id");

-- Y de esos, cuantos tienen su evento (= el instante SI esta guardado, solo que no en la columna).
SELECT COUNT(*) FROM "charges" c
WHERE c."status" = 'paid'
  AND NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."charge_id" = c."id")
  AND EXISTS (SELECT 1 FROM "events" e WHERE e."charge_id" = c."id" AND e."type" = 'paid');
```

⚠️ **Al leer la primera:** `invoices.charge_id` solo se escribe desde SCRUM-445 (mergeado hoy), así
que las facturas ANTERIORES creadas desde un cobro tienen `charge_id` NULL y **inflarán ese
recuento**. La segunda acota lo que de verdad importa: si sale ~igual que la primera, el instante ya
está guardado en todos y la columna es un índice, no un dato nuevo.

**No se ha tocado:** `prisma/schema.prisma` · `invoicesAdmin.routes.ts:924` · el camino de emisión ·
los cinco sitios de `Invoice.paidAt`.

---

# SCRUM-397 · CONSTRUIDO · un solo instante para un solo hecho

**Medido contra:** `origin/main` = `68ea282b32031c36547ab668ac4138db584636e4` · 2026-08-11T19:23:10+02:00
**Rama:** `scrum-397-paid-at-fuente-o-copia`

## Lo que se ha hecho, y por qué el guard es la pieza que decide

**No hay dos sitios donde escribir el instante.** `datosDeCobroPagado(fecha, payload)` devuelve el
estado, la columna **y** el evento con **el mismo objeto `Date`**. La columna no puede discrepar del
evento porque no hay dónde hacerlo — no es un test que compare dos literales «que se parecen».

| | |
|---|---|
| **NUEVO** `src/modules/billing/domain/instanteDeCobro.ts` | puro: el generador + el lector |
| **MOD** `psp.routes.ts` · `mpWebhook.routes.ts` | los dos únicos sitios que marcan `paid`, por el generador |
| **MOD** `chargesAdmin.routes.ts` (`confirm-bizum`) | fecha **declarada**, validada con el criterio ya aprobado |
| **MOD** `receipt.routes.ts` · `exportData.ts` · `exports.routes.ts` | los tres consumidores, un solo lector |
| **NUEVO** `tests/_censo-marcado-de-cobro.mjs` + `tests/scrum397-instante-de-cobro.test.mjs` | el guard, por AST |

**Sin backfill.** Los cobros anteriores nacen con `paid_at` NULL, y el lector recupera su instante
del evento `paid` **más antiguo** — que no es inventarlo, es leerlo donde sí estaba. Si no hay
evento, `null`: nunca `updatedAt`.

## Los tres consumidores, y lo que cambia para quien los mira

| | antes | ahora |
|---|---|---|
| **el recibo del CLIENTE** | el evento `paid` **más reciente** → en un cobro con reintento de webhook, **enseñaba la fecha del reintento** | la columna, o el evento más antiguo |
| `cobros.csv` («Cobrado en») | `updatedAt` — un cobro del 31-mar editado el 2-abr salía como de abril | la fecha real, o **vacío** si no consta |
| export de fees | el primer evento `paid` (ya era lo correcto) | el mismo lector que los otros dos |

⚠️ **Cambia lo que sale en `cobros.csv` para cobros antiguos**, y es a mejor: los que tienen evento
pasan a la fecha real; los que no, a vacío. **Vacío es la respuesta honesta** — mezclar «no consta»
con una fecha cualquiera es lo que producía la cifra que no significa nada.

⚠️ Y quité la reserva a `updatedAt` que el export de fees tenía: si la regla es que esa fecha no es
la del cobro, no puede tener una excepción. En la práctica no se ve vacío (toda fila de ese CSV pasó
por Connect y tiene su evento).

## El cruce de trimestre: la mitad construida y la que falta

`confirm-bizum` ya validaba nada y mandaba la hora de proceso. Ahora acepta `paid_at` en el cuerpo,
lo valida con `resolverFechaDeCobro` —futura no, hacia atrás sin límite— y lo manda en el `ts` que
**ya estaba en `PSPWebhookSchema` y no leía nadie**. El webhook lo lee y lo escribe en la columna y
en el evento.

🔴 **Lo que NO he construido, y sin esto el PRO todavía no puede declarar la fecha:** el campo en la
pantalla. Es microcopy y va con tu OK (regla 30). **Propuesta, no puesta:**

> etiqueta del campo: **«¿Qué día lo recibiste?»** · texto de ayuda: **«Si no lo pones, se guarda
> con la fecha de hoy.»**

Los dos textos de error ya están aprobados y se reutilizan tal cual (`COPY_FECHA_FUTURA`,
`COPY_FECHA_ILEGIBLE`). Hasta que la pantalla mande el campo, el camino manual sigue guardando
«ahora» — que es el comportamiento de antes, no una regresión.

## `AUTO_INVOICE_ON_PAID`: construido para los dos casos

No hace falta el dato. `paid_at` se escribe **en la transición del cobro**, exista factura o no: si
la flag está en ON el cobro tiene su factura y ambos guardan su fecha; si está en OFF, el cobro es
la **única** fuente y ahora sí la tiene. El arreglo no depende del valor.

## Verificado EN ROJO, seis defectos uno a uno

| defecto inyectado | |
|---|---|
| un webhook vuelve a marcar el cobro por su cuenta (dos relojes) | 🔴 |
| el generador fecha el evento aparte | 🔴 |
| el lector vuelve al evento más reciente (el del reintento) | 🔴 |
| `cobros.csv` vuelve a `updatedAt` | 🔴 |
| el camino manual vuelve a mandar la hora de proceso | 🔴 |
| el webhook vuelve a ignorar la fecha declarada | 🔴 |

⚠️ **Y el primer intento de este rojo salió VERDE seis veces**: mi arnés leía `# fail`, que
`node --test` no imprime. El instrumento estaba ciego, no el guard. Corregido y repetido — un rojo
que no se comprueba se lee igual que un guard que no vigila nada.

## Regla 38 · medido, no supuesto

El módulo del instante es **puro**: sin `prisma`, sin `emitInvoice`, sin `allocateInvoiceNumber`,
sin `applyVeriFactu`, sin `sellar*`. Hay test que lo fija: el día que importe cualquiera de esos,
cae y el ticket pasa a ser STOP. **Marcar un cobro no es emitir.**

**No se ha tocado:** `prisma/schema.prisma` (la columna ya estaba) · `invoicesAdmin.routes.ts:924` ·
los cinco sitios de `Invoice.paidAt` · las tres ramas con «397» en el nombre.

**Suite:** 3119 tests, **0 fail**.

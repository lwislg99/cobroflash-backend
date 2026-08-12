# SCRUM-500 (A2-c) · La columna de suplidos, preparada y NO aplicada

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T12:45:13Z` · tabla `invoices`

**Medido contra:** `origin/main` = `bf54914117fb99e596aa7d638c9ebac8ac809564` · 2026-08-12T12:45:13Z

> 🛑 **NADA APLICADO.** Ni `prisma/schema.prisma`, ni ninguna base. `git status` de `prisma/` limpio.
> Jira: **En curso**, asignado.

## 0 · Qué es un suplido, para que se apruebe sabiendo qué se aprueba

**Un suplido es lo que el profesional paga POR CUENTA del cliente y le repercute tal cual: sin IVA
y sin margen** — una tasa municipal, el visado de un colegio profesional, una licencia de obra.

**Poner ahí un material propio es un error fiscal, no un despiste de clasificación:** el material se
compra para uno y se revende con su IVA y su margen; el suplido es dinero ajeno que solo pasa por la
cuenta del profesional.

## 1 · ¿`snake_case` o `camelCase`? — **snake_case, 18 a 13**

Contado sobre el modelo `Invoice`, columna a columna, suma comprobada (18 + 13 = 31 ✓):

| | |
| --- | --- |
| **`snake_case` (con `@map`) · 18** | `chargeId` `status` `paidAt` **`paidVia`** `clientComment` `stageLabel` `albaranRefs` `deductsRefs` `rectifiesId` `vfEstado` `vfHash` `vfPrevHash` `vfTimestamp` `vfAnulHash` `vfAnulTimestamp` `vfAnulPrevHash` `reminder7SentAt` `reminder14SentAt` |
| `camelCase` (sin `@map`) · 13 | `id` `merchantId` `customerId` `quoteId` `number` `total` `currency` `pdfUrl` `qrData` `registerId` `lines` `type` `createdAt` |

El recuento que recordabas era **16 a 7**; hoy es **18 a 13**. Y hay un corte más decisivo que el
total: **los 13 en camelCase son las columnas ORIGINALES de la tabla** (id, número, total, moneda,
líneas, tipo, fechas) y **las 18 en snake son las que se han ido añadiendo** — toda la familia
`vf*`, los recordatorios, y las tres hermanas de este mismo bloque: `paid_via`,
`retencion_irpf_*`, `recargo_equivalencia`.

**Para una columna NUEVA la convención no está 18-13: está 18-0.**

## 2 · ¿Admite «no consta»? — **sí, y encaja el patrón del RECARGO**

| Patrón | Por qué se eligió allí | ¿Encaja aquí? |
| --- | --- | --- |
| **Recargo** · `Boolean?` sin `@default` | el dato es booleano y `NULL` / `false` / `true` dan los tres estados nativos | **SÍ** |
| Retención · **dos** columnas | el dato era un TIPO (`Int?`) y «declaro que no retengo» **no tenía representación**: colapsaba con «no consta» en el mismo `NULL` | no hace falta |

**El dato de un suplido es un IMPORTE, y un importe tiene un cero legítimo.** Por eso basta una
columna nullable:

| Valor | Significa |
| --- | --- |
| `NULL` | **no consta** — la factura es anterior a la casilla, o nadie la miró |
| `0.00` | **declarado: esta factura no lleva suplidos** |
| `> 0` | el importe repercutido por cuenta del cliente |

Sin `@default`: un `0.00` por defecto convertiría **todas las facturas históricas** en «declarado que
no hay suplidos», que no lo ha dicho nadie. Es la misma decisión que en el recargo y por el mismo
motivo.

## 3 · 🔴 ¿POR FACTURA o POR LÍNEA? — **por LÍNEA, y esto cambia el ticket**

El ticket asume `Invoice` sin haberlo medido. Medido:

1. **Un suplido tiene concepto propio.** «Tasa municipal de licencia», «Visado del colegio». Un
   importe suelto en la factura **no dice qué se está repercutiendo**, y el cliente tiene derecho a
   verlo — es dinero suyo.
2. **Pueden ser varios en la misma factura** (una tasa *y* un visado). Un único `Decimal` los
   colapsa en un número.
3. **Y el sitio ya existe:** `InvoiceLine = VatLine & { [key: string]: unknown }`
   (`invoiceLines.service.ts:38`) — el tipo de línea **ya admite claves extra**, y `Invoice.lines`
   es `Json`. Marcar una línea como suplido **no necesita ninguna columna**.

**Así que la respuesta honesta es: el dato es por línea, y por línea no hace falta schema.**

### Pero la decisión de no hacerlo así ya está tomada, y sigue siendo buena

`docs/master/SCRUM-293.md` lo midió y lo decidió, con su tabla:

| | línea marcada (`suplido: true`) | campo propio |
| --- | --- | --- |
| Toca `calcVatBreakdown` | **SÍ** | no |
| Toca el sellado (vía la base del XML) | **SÍ** | no |
| Consumidores que deben aprender a ignorarla | **16** | 0 |
| Necesita campo de schema | no | **SÍ** |

**Marcar la línea es más fiel al dato y más caro en riesgo**: obliga a que dieciséis sitios aprendan
a saltarse una línea, y uno de ellos es el que sella.

**Lo que sí propongo, y no decido:** la columna **no sustituye** al detalle, lo **resume**. El
concepto de cada suplido puede vivir en su línea (Json, sin schema) y la columna llevar el **total
repercutido**, que es lo que el cálculo necesita para restarlo de la base sin recorrer líneas. Las
dos cosas no compiten.

⚠️ **Con la columna sola, el PDF no puede decir POR QUÉ se repercuten esos euros.** Es la
consecuencia de elegir el camino barato, y conviene que se elija sabiéndola.

## 4 · EL `ALTER TABLE`, listo para pegar

```sql
ALTER TABLE "invoices" ADD COLUMN "suplidos" DECIMAL(12,2);
```

**Verificación, detrás y en la misma sesión:**

```sql
-- Tiene que devolver EXACTAMENTE una fila: numeric · 12 · 2 · YES (nullable) · sin default.
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices' AND column_name = 'suplidos';

-- Y el suelo: cero filas significa que el ALTER no se aplicó, no que esté bien.
SELECT count(*) AS columnas_suplidos
FROM information_schema.columns
WHERE table_name = 'invoices' AND column_name = 'suplidos';
```

Si `column_default` viene con algo, **el ALTER no es éste**: la columna nace sin default a propósito.

**Generado con el CLI local y con su control positivo delante** (`--from-empty` devuelve **25
`CREATE TABLE`**, luego la herramienta ve el schema y el diff es de una línea porque el cambio lo
es). **100 % aditivo**: sin `DROP`, sin `ALTER` de columna existente, sin `NOT NULL`, **0 filas
afectadas** — todas quedan en `NULL`, que es «no consta».

## 5 · El campo Prisma, ESCRITO Y NO APLICADO

```prisma
model Invoice {
  …
  deductsRefs Json? @map("deducts_refs")
  // SCRUM-500 (A2-c) · SUPLIDOS: lo pagado POR CUENTA del cliente, repercutido sin IVA y sin margen.
  // NULL = no consta (facturas anteriores a la casilla) · 0.00 = declarado que no hay · >0 = importe.
  suplidos Decimal? @map("suplidos") @db.Decimal(12, 2)
  …
}
```

`Decimal(12,2)` — el mismo tipo y precisión que `Invoice.total` y que `approvalThreshold`: un
importe de factura, no un float.

## 6 · El orden, el mismo de las tres anteriores

**staging → verificar → producción → verificar → `schema.prisma` AL FINAL.**
`assertSchemaSinDeriva()` (`src/index.ts:23`) falla ante columnas **ausentes**; columnas de más no
son deriva. Al revés, producción arranca en deriva.

⚠️ **Y esta migración va SOLA**, como las otras tres.

## 7 · Lo que NO se ha hecho

`prisma/schema.prisma` intacto · ninguna base tocada · ninguna cadena de conexión escrita en ningún
sitio · el cálculo de la factura sin tocar · A2 retención · A3 · el sellado · la casilla y su
microcopy, que son el ticket siguiente y llevan marcador (regla 30).

---

# SCRUM-500 (A2-c, fase 2) · La casilla de suplidos, construida

**Fecha:** 12-ago-2026 · **Carril:** B (fiscal) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `81be77352de2e4ce7f35bab9ddd6bd9247d75e74` · 2026-08-12T13:38:10+02:00

> **La columna YA ESTÁ APLICADA en producción.** Comprobado por `information_schema` ANTES de
> tocar `prisma/schema.prisma`, que es lo que pedía el encargo: `numeric` · 12 · 2 · nullable ·
> `column_default` NULL. Con su control positivo delante —32 columnas de `invoices` visibles—,
> porque cero filas también sería el resultado de no estar viendo la tabla.

## 0 · Lo primero, porque de ahí sale el orden de todo lo demás

| | |
| --- | --- |
| Columna en **producción** | ✅ verificada: `numeric(12,2)`, nullable, sin default |
| Columna en **staging** | ⚠️ **NO verificada**: no tengo su URL, y no se piden por chat (regla 9) |

**Se dice en vez de suponerse.** El orden de la casa es staging → producción, así que lo esperable
es que esté; pero «lo esperable» y «lo medido» no son lo mismo, y `assertSchemaSinDeriva()` falla
ante columnas AUSENTES: si a staging le faltara, arrancaría en deriva en cuanto entre este PR.
**Comprobación de 10 segundos antes de mergear**, con la consulta del §4 de la entrada anterior.

## 1 · Qué es un suplido, y por qué la microcopy no es cosmética

Es lo que el profesional paga **por cuenta del cliente** y le repercute tal cual: **sin IVA y sin
margen** — una tasa municipal, el visado de un colegio, una licencia de obra.

Poner ahí un material propio es un **error fiscal**, no un despiste de clasificación: el material se
compra para uno y se revende con su IVA y su margen; el suplido es dinero ajeno que solo pasa por la
cuenta. Esa frontera es invisible desde el editor de líneas y **equivocarse no da ningún síntoma**:
la factura sale igual de bonita. Por eso el aviso va pegado a la casilla y no en una ayuda.

## 2 · 🔴 LA MEDICIÓN QUE CAMBIÓ LO QUE HABÍA QUE ENTREGAR ANTES

Escribí primero, de cabeza, que un suplido metido en la base cuesta **10,50 € de IVA + 7,50 € de
retención**. El test lo tumbó. **Depende del tipo al que esté la línea, y son dos casos distintos:**

| El suplido está… | IVA de más | Retención de más |
| --- | --- | --- |
| ① como línea normal **al 21 %** (lo que se hace HOY) | **+10,50 €** | +7,50 € |
| ② **al 0 %** (lo que produce la casilla desde hoy) | **0 €** | **+7,50 €** |

**De ahí sale el orden del ticket, y no al revés:**

- La casilla se entrega **YA** porque ① es dinero cobrado de más, y se corta con `tax: 0` **sin
  tocar un solo número sellado**.
- El cable sigue haciendo falta porque ② **no se cura con la casilla**: poner el IVA a 0 quita el
  impuesto, pero **no saca el importe de la base**. La base sigue siendo 850,00 € y la retención se
  practica sobre ella.

> **El 0 % quita el IVA. No saca de la base.** Quien calcule la retención tiene que tomarla de
> `desgloseConSuplidos().base`, nunca de `calcVatBreakdown().base`. Está escrito en el test.

## 3 · 🔴 EL CASO CRUZADO, con la aritmética A MANO

Factura `F-2026-0041`: mano de obra 10 × 80,00 € al 21 % + tasa municipal 1 × 50,00 € (suplido),
merchant que retiene al 15 %.

```
base imponible      800,00   = 10 × 80,00        ← la tasa NO entra        (regla ①)
cuota IVA 21 %      168,00   = 800,00 × 0,21     ← la tasa NO lleva IVA    (regla ②)
suplidos             50,00   =  1 × 50,00
────────────────────────────────────────────────────────────────────────────────────
TOTAL FACTURA     1.018,00   = 800,00 + 168,00 + 50,00  ← el cliente SÍ lo paga (regla ③)
retención 15 %      120,00   = 800,00 × 0,15     ← sobre la base SIN suplidos
líquido a percibir  898,00   = 1.018,00 − 120,00
```

**Ninguno de los seis sale de llamar a la función que se está probando.** Y los tres errores
clásicos van escritos al lado, cada uno con lo que cuesta, porque un vector que no distingue no
prueba nada:

| El error | Da | De más |
| --- | --- | --- |
| suplido dentro de la base (al 21 %) | cuota 178,50 | **+10,50 €** de IVA sobre un impuesto |
| retención sobre la base con suplido | 127,50 | **+7,50 €** |
| retención sobre el TOTAL | 152,70 | **+32,70 €** |

**La regla ③ es la que se salta todo el mundo**, y por eso tiene su propio rojo: sacar el suplido de
la base **no** es sacarlo de la factura. Una factura que se lo deja fuera pide 50,00 € menos de los
que el profesional ya ha adelantado.

## 4 · Lo construido

| Pieza | Qué hace |
| --- | --- |
| `invoicing/domain/suplidos.ts` | el cálculo entero: partición, total de la columna, desglose |
| `prisma/schema.prisma` | `suplidos Decimal? @map("suplidos") @db.Decimal(12, 2)` |
| `public/dashboard/js/quoteSuplido.js` | la pieza pura del front: fuerza `tax: 0` y el rótulo |
| `quotesView.js` | la casilla y su aviso en la hoja de ajustes; payload y borrador |
| `core/validation/schemas.ts` | la marca sobrevive al validador, y un suplido con IVA se rechaza |

**Dos detalles que no son decoración:**

**① La marca hay que declararla en zod o `z.object` LA BORRA.** Sin `suplido: z.boolean()`, la
pantalla diría «suplido» y la base guardaría una línea normal, sin que nadie se entere. Ese es el
tipo de fallo que este repo lleva semanas persiguiendo: silencioso y con dinero dentro.

**② El `tax: 0` se fuerza en `lineaParaPayload`, no en el `change` de la casilla.** Deshabilitar el
input es la interfaz; hay **tres caminos** que rellenan una línea sin pasar por él —borrador
restaurado, plantilla, IA—. Si el IVA se quitara solo al hacer clic, bastaría con no hacer clic. Y
además se exige **en la puerta del servidor**: el front no es el único que llama a esa ruta.

## 5 · El suelo, en el peor sitio posible para degradar

«No es suplido» es el valor de la **inmensa mayoría** de las líneas. Por eso es el peor sitio del
producto para caer en silencio: un fallo de lectura produce exactamente el resultado que se ve
normal, y nadie lo nota nunca.

```
marca AUSENTE             → { ok: true, suplido: false }   ← contrato: la línea de siempre
marca true / false        → { ok: true, suplido }          ← declarado
marca PRESENTE E ILEGIBLE → { ok: false, motivo }          ← «no lo sé», y se dice
```

`'sí'`, `'true'`, `1`, `0`, `null`, `{}`, `[]` → **ilegible**, y la ilegibilidad **llega arriba**:
`totalSuplidos` y `desgloseConSuplidos` devuelven `ok:false` con **el número de línea dentro**. Sin
eso, un presupuesto de 12 líneas no se puede arreglar.

## 6 · La columna: aplicada, y NO la escribe nadie todavía

El campo Prisma entra; **el cable no**. Rellenarla exige tocar los **SIETE** `invoice.create` del
árbol, y eso es camino de emisión (regla 38), que este ticket tiene excluido por escrito.

**No se pierde nada por esperar:** la marca vive en `Invoice.lines` (Json), que es dato durable, y
`totalSuplidos(lines)` reconstruye el valor de la columna cuando se quiera. `NULL` mientras tanto es
literalmente lo que significa: **no consta**.

> **Una sola fuente.** Quien escriba la columna llama a `totalSuplidos` y no suma por su cuenta. Dos
> sitios que sepan cuánto suman los suplidos acaban diciendo cosas distintas — la lección de
> SCRUM-504, cinco copias de la misma línea divergiendo.

## 7 · Cinco guards ajenos se pusieron en rojo, y ninguno se apagó

Esto es lo que más dice del estado del repo: **el trabajo lo vieron cinco mecanismos que no son
míos**, y cuatro de ellos por su SUELO, no por su aserción.

| Guard | Qué cazó | Qué se hizo |
| --- | --- | --- |
| SCRUM-461 / 222 | la columna nueva no estaba en el censo de deriva de prod | regenerado (367 columnas) |
| **SCRUM-286** | **«0 campos por línea»**: al envolver el literal en `lineaParaPayload(...)`, el censo dejó de ver la sub-población entera | el censo desenvuelve una capa de llamada |
| SCRUM-389 | llamador nuevo de `calcVatBreakdown` sin veredicto | censado: DOCUMENTO, y delega el IVA |
| SCRUM-402 | marcador de microcopy nuevo y pintable | subido a `CENSO` a conciencia, con motivo |
| **SCRUM-413** | **escáner CIEGO**: su ventana de 3.000 caracteres la desbordó mi comentario | recorta el MODELO, no un tamaño fijo |
| SCRUM-139 F4 | el rótulo del disparador dejó de componerse en la vista | el guard sigue al código, y ahora se exige el COMPORTAMIENTO |

Los dos en negrita son los que valen: **ninguno de los dos falló por su aserción**. El de SCRUM-286
gritó porque su suelo dice «≥4 campos» y salieron 0 — sin ese suelo, la sub-población se habría
quedado sin vigilar en verde. Y el de SCRUM-413 se declaró ciego en vez de pasar: una ventana de
tamaño fijo caduca sola, y ahora recorta el modelo.

**SCRUM-411 sube de 7 a 8**, y es la única subida. `suplidos.ts` se une a `retencionIrpf.ts` (A2) y
`recargoEquivalencia.ts` (A3): tres piezas construidas, probadas y sin llamador **por el mismo
gate**. Cablear cualquiera cambia la base o el total que se sellan. Subir el trinquete dice la
verdad —el bloque fiscal tiene tres piezas esperando el mismo permiso—; cablearlo a la fuerza para
que el contador quedara bonito habría sido saltarse un STOP.

## 8 · Lo que NO se ha tocado

`calcVatBreakdown` y `grossOfLines` · el sellado · la cadena de huellas · el XML · la numeración ·
A2 retención (sesión 3) · A3 · A5 · los siete `invoice.create` · ninguna base escrita · ninguna
cadena de conexión en ningún sitio, ni real ni de ejemplo.

**Y hay un guard que lo sostiene**: `vat.service.ts` no puede mencionar los suplidos en su código —
con el suelo que exige que, al quitarle los comentarios, siga quedando código que mirar.

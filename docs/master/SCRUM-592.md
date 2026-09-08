# SCRUM-592 · DOC-02 · Numeración correlativa con serie anual — presupuestos y albaranes

**Fecha:** 4-sep-2026 · **Carril:** documentos · **Gate:** el de concurrencia con `QA_DB_TEST=1`; el resto en `npm test`

**Medido contra:** `origin/main` = `c9cf435b20287ad7a0dc02a3a17d3fe182dfa372` · 2026-09-04T15:15:57Z

**Tanda:** 5159 tests, 5071 pass, 0 fail, 88 skipped — medida DESPUES del ultimo cambio, entrada incluida.

---

## La víctima

Los presupuestos de un profesional salían `#26`, `#28`, `#32`: con saltos y sin serie. Cuando su
cliente le preguntaba por «el presupuesto 32», él no podía decir de cuántos era ni de qué año.

**Y no era una impresión.** Medido en `yaqu_dev_javier`: el merchant 1 tenía `[1, 13, 14, 15, 16]`
— **faltaban del 2 al 12**.

---

## PASO 0

**ENTRADA.** El número lo ve el profesional en el panel y el cliente en tres sitios: impreso en el
PDF (`Nº {number}`), en la plantilla de WhatsApp y en los avisos internos.

**MECANISMO — 🔴 ya existía entero, y eso redefinió el trabajo.**

| pieza | qué garantizaba ya |
|---|---|
| `quoteNumber.service.ts` | `{ increment: 1 }` atómico dentro de la transacción |
| `albaranNumber.service.ts` | `pg_advisory_xact_lock` (SCRUM-234) **y serie anual funcionando** |
| `invoiceNumber.service.ts` | serie anual + `nextRectInvoiceNumber` — **rectificativas ya previstas** |

Lo que faltaba no era el contador: era **la serie anual del presupuesto y el formato**. `Merchant`
ya tenía `albaranSeriesYear`; no tenía `quoteSeriesYear`. Ésa es la única columna nueva.

---

## 🔴 Lo que de verdad cambia: el `increment` deja de bastar

Ese increment es atómico y bastaba mientras el contador **sólo subía**. Con reinicio anual hay que
**leer** el año y **decidir** si el siguiente es `nextQuoteNumber` o `1` — un read-then-write que
en READ COMMITTED **no serializa**: dos creaciones simultáneas del primer presupuesto del año
leerían las dos «serie vacía» y escribirían las dos el 1.

No es una hipótesis mía: es lo que `allocateAlbaranNumber` dejó escrito al cerrar SCRUM-234,
*«también tiene reinicio anual, así que también va con cerrojo y no con `{ increment: 1 }`»*. Se
sigue esa decisión en vez de inventar otra: mismo `pg_advisory_xact_lock`, mismo `SERIE_LOCK_NS`.

**Probado con diez reservas simultáneas contra Postgres: `[1..10]`, ni un duplicado ni un salto.**

---

## P-DOC-7 · Los existentes se renumeran

Decidido por el fundador el 4-sep-2026. Ni el presupuesto ni el albarán son documentos fiscales,
así que hay libertad, y la elección es **una sola numeración, no dos formatos conviviendo**.

**Lo que hizo posible decidirlo es la medición del censo 2:**

- el número está **impreso** dentro del PDF y en el **nombre del fichero** generado;
- **viaja al cliente** como variable de la plantilla de WhatsApp;
- 🔴 **pero los enlaces van por `id`, no por número — 4 de 4 medidos.**

> **Ningún PDF deja de abrirse.** El daño posible es de **BÚSQUEDA** —el cliente dice «el #16» y el
> profesional no lo encuentra—, y eso es reversible. Romper un enlace no lo sería. Ésa es la
> diferencia sobre la que se apoya toda esta decisión.

**El orden es por FECHA DE CREACIÓN, no por id**, y no es lo mismo: medido en dev, los dos órdenes
**difieren**. El id es un contador global de la plataforma y puede no seguir el orden en que ese
profesional creó sus documentos.

**Aplicado en desarrollo:** `[1, 13, 14, 15, 16]` → `[1, 2, 3, 4, 5]`. Y **ejecutado dos veces**:
la segunda pasada cambia **0**. Staging y producción esperan a que producción vuelva a desplegar.

**Producción no se ha tocado ni nombrado.** Su medición queda escrita en
`docs/sql/scrum-592-medicion-produccion.sql`, sólo lectura, para que la corra el fundador — y
**verificada ejecutándola contra desarrollo**, porque escribí mal los nombres de columna a la
primera (`quotes` usa `merchantId` y `albaranes` usa `merchant_id`) y un fichero que falla en
producción no es una entrega.

---

## El `@@unique` que falta, y por qué NO va aquí

`Invoice` y `Albaran` llevan `@@unique` sobre su número; **`Quote` no lleva ninguna**. La
correlatividad del presupuesto vive **sólo en el código**: un `INSERT` a mano o un segundo camino
duplicaría sin que nada lo impida.

Va como ticket propio de los dos fundadores, y **el orden importa**: primero se renumera, después
se añade la restricción. Al revés, puede fallar sobre datos que hoy duplican — y «ningún duplicado
en dev» no es producción.

🔴 **Este código no depende de que esa restricción exista.** El cerrojo es la garantía; el
`unique` sería la red. Cuando llegue, aquí no hay que tocar nada. Y mientras, un guard vigila que
**sólo un fichero escriba el contador**.

---

## La factura: medida, no tocada

Formato actual `2026-CF-001`, con **prefijo por merchant** (`invoiceSeriesPrefix`), que es un campo
real y configurable: migrarla a `F260001` **lo perdería**. Su numeración es camino de emisión, y
mientras exista el justificante —definido «sin numeración de factura»— no puede llevar un número
con formato de factura. **No se toca hasta que se resuelva ese expediente.**

---

## Evidencia

- **Concurrencia:** 2 y 10 reservas simultáneas → correlativas, sin duplicados ni saltos.
- **Reinicio anual:** con la fecha **fijada**, en la pieza pura y **contra la base** — `P260001`
  el 31-dic y `P270001` el 1-ene, con el contador quedando en la serie de 2027.
- **Idempotencia:** probada en la pieza pura **y ejecutada dos veces contra la base**.
- **Control negativo:** crear un cliente no mueve ningún contador (probado contra la base), y un
  censo por árbol exige que **sólo `quoteNumber.service.ts`** escriba el contador.
- **Suelo:** en el censo de documentos, en el de ficheros y en el formateador.

---

## 🔴 Hallazgo: el cerrojo serializa, y eso tiene un coste medible

El test de diez simultáneas falló la primera vez, y **no por una carrera**: el cerrojo hace que las
diez esperen en fila, así que la décima acumula diez veces la latencia. Contra la base remota de
desarrollo eso son **~5.200 ms**, y Prisma cierra la transacción a los 5.000 por defecto.

No es un defecto de este ticket —**albaranes y facturas tienen el mismo patrón desde SCRUM-234**—
pero está medido y se dice: con una base lejana, una ráfaga de creaciones del mismo merchant puede
agotar el timeout por defecto. En el test se subió el margen **para que midiera la carrera y no la
latencia**; dejarlo en 5.000 habría dado un rojo que dice «duplicado» cuando lo que hay es «lento».

---

## Lo que NO se hizo

- **No se tocó la numeración de facturas** ni ningún camino de emisión.
- **No se aplicó el ALTER** en staging ni en producción.
- **No se renumeró** staging ni producción.
- **No se añadió el `@@unique`**, por el orden explicado.

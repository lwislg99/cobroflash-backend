# SCRUM-296 (A6) · El Libro de Registro, con la trazabilidad completa del euro

**Fecha:** 6-ago-2026 · **Carril:** A (núcleo fiscal) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `4b4f30a6bcfb4ffd75694f781704865510336580` · 2026-08-06T13:09:12+02:00
**Tanda:** 1959 tests, 1892 pass, 0 fail, 67 skipped · `npm test` **`$? = 0`**

> El sha se ancló con `git ls-remote`, no con la ref local: con cuatro sesiones fetcheando a la vez
> la ref local miente. Main se movió **dos veces** durante esta tarea (`51221c0` → `e714d23` →
> `4b4f30a`), así que la medición se re-ancló antes de concluir.

## Qué es, y por qué no es una tabla más

El libro de facturas emitidas es **lo primero que pide un asesor**, y cualquier facturador lo
tiene. Lo que ninguno puede hacer es enlazar **cada asiento con su presupuesto, su albarán y su
cobro**, porque no tiene los tres objetos atados. Eso es la trazabilidad completa de un euro:
de dónde vino, qué se entregó a cambio y dónde acabó.

## Solo lectura, y comprobado

No compone números, no reserva nada, no escribe. Un guard lee el módulo y **prohíbe**
`allocateInvoiceNumber`, `formatInvoiceNumber`, `prisma.`, `.update(` y `.create(`: la regla 38
permite **leer** el camino de emisión, no modificarlo, y este módulo no tiene ningún motivo para
hacerlo.

Lo que sí hace es **reutilizar `calcVatBreakdown`**, el mismo cálculo que usa la emisión.
Recomputar la base con otra fórmula haría que el libro **cuadrase consigo mismo** en vez de con las
facturas — y ése es justo el error que nadie detecta, porque los dos números salen del mismo sitio
equivocado.

## El suelo, y aquí no es una formalidad

**Un libro vacío no se lee como «no encontré nada»: se lee como «no facturaste nada», y ante
Hacienda eso es una afirmación, no un hueco.**

Por eso el resultado lleva **siempre** `miradas`. Cero asientos con `miradas: 0` significa «no
había»; cero asientos con `miradas: 40` significa **que algo está roto** — y quien lo consuma puede
distinguirlo. Sin ese número las dos cosas se leen igual de tranquilizadoras.

## Control negativo: dos merchants, montado aquí

**No se apoya en el guard de tenencia de SCRUM-243**, que tiene un agujero conocido (SCRUM-348): el
aislamiento de un documento fiscal no puede colgar de algo que ya se sabe incompleto. El libro
filtra por merchant **también él**, y lo ajeno **se cuenta** (`ajenas`).

Un descarte silencioso en un documento fiscal es indistinguible de un dato que nunca existió, y
aquí hay que poder demostrar **por qué el libro tiene las filas que tiene**.

Mismo criterio con las filas sin número: no son asiento —el número **es** la identidad fiscal del
documento— pero se declaran en `sinNumero` en vez de desaparecer.

## Los importes: familia SCRUM-271

`Number('')` es `0` y `Number([])` es `0`. **Un total ilegible convertido en `0,00 €` es un asiento
que AFIRMA que esa factura no cobró nada**, y eso es peor que no tener la fila.

Un importe que no se puede leer sale como `null`, se marca (`importeIlegible`) y se reporta **con
su número de factura delante**, para que quien lea el libro sepa cuál mirar. Se probó con `''`,
`[]`, `null`, `undefined`, `'doce euros'`, `NaN` y `{}`.

**Y la otra cara, sin la cual la primera no vale:** un total de **cero legítimo** no se confunde con
uno ilegible. Sin ese test, «todo lo raro es null» y «todo es null» se verían igual en verde.

## Verificado en rojo — los tres por `$?`

* **Se quita una columna del asiento** → cae nombrándola: *«le faltan columnas: moneda»*.
* **El libro deja de filtrar por merchant** → cae: *«se ha colado una factura de OTRO merchant»*.
  En un libro de registro eso no es una fuga cualquiera: es **declarar como propia la facturación
  de un tercero**.
* **El importe ilegible se coerciona** → cae: *«se ha convertido en un número»*.

Las tres inyecciones revertidas; árbol limpio, `npm test $? = 0`.

## Lo que NO cubre

* **No hay pantalla todavía.** Es el mecanismo puro y probado; dónde se enseña, con qué copy y con
  qué filtros (rango de fechas, tipo F1/R1) es decisión de producto y necesita microcopy (regla 30).
* **No hay lector contra la base.** El constructor recibe las facturas ya leídas. La consulta —con
  su `where: { merchantId }`— es el paso siguiente, y es donde habrá que decidir la paginación: un
  libro de un ejercicio entero puede ser grande.
* **No se ha probado contra Postgres.** El control negativo se monta con dos merchants en memoria,
  que es lo que permite probarlo sin base; lo que no se verifica aquí es que la consulta real
  filtre — eso llegará con el lector.
* **`albaranRefs` se lee tal cual viene.** Si un día su forma cambia, el libro enseñaría enlaces
  vacíos en vez de romperse — se prefiere así, pero queda dicho.

## Ficheros

* `src/modules/invoicing/domain/libroRegistro.ts` (nuevo) — el constructor puro.
* `tests/scrum296-libro-registro.test.mjs` (11, sin gate).

# SCRUM-293 · A2 — Retención de IRPF y suplidos: la medición que paró el ticket, y el cálculo aislado

**Fecha:** 7-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `12adc4a08fc65022ac705b898e259a1fcbc0f596` · 2026-08-07T10:26:29+02:00
**Tanda:** tests 2101 pass 2030 fail 0 skipped 71

> ⚠️ **ENTREGA PARCIAL, Y DECLARADA.** A2 pide que la retención se configure UNA VEZ en el perfil
> y se aplique sola. **Eso no se puede terminar hoy**: necesita campos de schema y las migraciones
> están paradas (SCRUM-383). Aquí se entrega **el cálculo, aislado y probado, sin llamadores** —
> un hueco estructurado con su mecanismo dentro, esperando al campo. Y la **pregunta al asesor**
> que bloquea la otra mitad.

## Paso 0 · el ticket estaba virgen, medido por entrada Y por mecanismo

Sin rama (`refs/heads/*293*` vacío), sin `docs/master/SCRUM-293.md` y —lo que de verdad decide—
**sin mecanismo**: cero apariciones de `irpf`, `retencion` o `suplido` en `src/` y en `prisma/`.
Las dos cosas se comprobaron por separado a propósito: una entrada puede llegar a `main` por una
rama distinta de la del mecanismo, que es exactamente lo que pasó con C5.

## 🔴 LA MEDICIÓN QUE PARÓ EL TICKET

**Pregunta:** ¿tiene el cálculo actual sitio para algo que **no** suma a la base imponible?
**Respuesta: NO.**

```ts
// vat.service.ts · calcVatBreakdown
for (const l of lines) {
  const base = qty * price;
  e.base  += base;            // ← TODA línea entra en la base
  e.cuota += base * taxFrac;
}
```

`VatLine = { qty, price, tax }`. **No existe ninguna marca que saque una línea de la base.** Un
suplido puesto como línea al 0 % entraría en la base imponible: la cuota saldría 0 —correcta— pero
**la base declarada sería falsa**, y de la base salen el 303 y el Libro.

El total tampoco tiene sitio: `Invoice.total = grossOfLines() = base + cuota`, derivado **entero**
de las líneas. Y el schema lo confirma: **0 campos** de retención o suplido en `Invoice`, **0** en
`Merchant`. `Invoice` solo tiene `total` y `lines`.

### El radio de impacto, que es lo que lo convierte en parada de la regla 38

`calcVatBreakdown` lo consumen **16 ficheros**. Entre ellos:

| Consumidor | Por qué importa |
| --- | --- |
| `src/modules/fiscal/verifactu/registro.builder.ts` | **El SELLADO.** Su `baseImponible` sale de ahí — línea **315**, `entrada.base.toFixed(2)` — y va literal al XML como `<sum1:BaseImponibleOimporteNoSujeto>` |
| `src/modules/fiscal/modelo303/{modelo303,casillas}.ts` | El 303 (A5) |
| `src/modules/invoicing/domain/libroRegistro.ts` | El Libro (A6) |

Darle al camino de emisión un dato **ya calculado** es una cosa. Que un suplido no sume a la base
exige **modificar la función de la que el sellado saca su base imponible**: eso es el camino de
emisión, por fichero y por lado.

### Las dos formas de modelar el suplido, con su coste

| | Como **línea marcada** (`suplido: true`) | Como **campo propio** de la factura |
| --- | --- | --- |
| Toca `calcVatBreakdown` | **SÍ** | no |
| Toca el sellado | **SÍ** (vía la base del XML) | no |
| Consumidores que deben aprender a ignorarla | **16** | 0 |
| Necesita campo de schema | no | **sí** (congelado por SCRUM-383) |

**Decisión del fundador: campo propio.** Un suplido no es una línea de venta, y modelarlo como
línea obliga a que dieciséis sitios aprendan a saltárselo — uno de ellos sellado.

## Lo que el fundador resolvió, y quita el riesgo grande

**`Invoice.total` NO cambia de significado con la retención.** La retención de IRPF no se resta
del total: es un **pago a cuenta del PAGADOR**. El documento conserva su forma:

```
Base imponible      1.000,00
IVA 21 %              210,00
Total factura       1.210,00   ← esto es lo que se sella, y NO se mueve
Retención IRPF 15 %  −150,00
Líquido a percibir   1.060,00  ← DERIVADO al pintar, jamás almacenado
```

**El número sellado no cambia para nadie.** Y el líquido se deriva: dos totales guardados acaban
divergiendo.

## Lo entregado: `retencionIrpf.ts`, aislado y sin llamadores

* `calcularRetencion(base, tipo)` — **sobre la BASE, nunca sobre el total**. El error clásico
  (1.210 × 15 % = 181,50 en vez de 150,00) son 31,50 € en una factura de mil, y tiene su test.
* **Los redondeos, decididos y probados**: a dos decimales, medio arriba, **una sola vez y al
  final**. La base entra ya redondeada por `calcVatBreakdown` (es su contrato) y no se vuelve a
  tocar — redondear dos veces mueve céntimos, y un céntimo en una retención hay que explicárselo
  a alguien. Casos probados: `333,33 × 15 % = 49,9995 → 50,00`, `100,10 × 7 % → 7,01`,
  `0,05 × 15 % → 0,01`, `0,03 × 15 % → 0,00`.
* `TIPOS_RETENCION` **cerrado** (15, 7, 2, 1) con el motivo de cada uno. Un tipo libre deja meter
  un 7,5 que no existe.
* `leerTipoRetencion` — **el suelo fiscal**: «no se pudo leer» y «no retiene» son valores
  DISTINTOS. Emitir sin la retención de quien retiene es un defecto **mudo**: la factura sale, se
  paga, y el descuadre aparece en el 111 meses después.

**Un guard vigila que siga aislado**: el módulo no puede importar nada (`^import` prohibido) ni
mencionar `calcVatBreakdown`, `grossOfLines`, `registro.builder` ni `prisma`. Con respaldo de la
negación (SCRUM-237): esos nombres existen en la casa, así que su ausencia significa algo.

## El cuadre, hoy, como línea base

**El test de cuadre YA EXISTE** (`tests/scrum295-modelo-303.test.mjs:147`, «el 303 y el LIBRO
cuadran al céntimo, mismo periodo») y **no se ha escrito un segundo**: dos tests del mismo hecho
es el defecto de las dos listas. Se ha ejecutado como línea base:

| | Resultado |
| --- | --- |
| 303 en memoria | ✔ 15 pass, 0 fail — incluido el cuadre al céntimo |
| Libro en memoria | ✔ 11 pass, 0 fail |
| 303 / Libro en **Postgres** | ⚠️ **NO EJECUTADO** — gateado tras `LIBRO_PG_URL` |

> ⚠️ **HUECO DECLARADO.** El banco Postgres portátil de otra sesión tiene los binarios pero **no
> una base inicializada**, y levantarla implica crear un esquema. Con las migraciones congeladas
> no se ha hecho. **El cuadre está verificado en memoria, no en Postgres.** El día que el campo
> exista, ese lado hay que correrlo antes de dar nada por bueno.

## Lo que NO se ha tocado, y es la mitad del trabajo

`calcVatBreakdown`, `grossOfLines`, el camino de emisión, el schema. El módulo **no lo llama
nadie** todavía, y eso es correcto: es el hueco esperando al campo.

**Bloqueado por:** P12 en `docs/legal/PREGUNTAS_ASESOR.md` (¿el suplido entra en el ImporteTotal
sellado?) y por SCRUM-383 (migraciones).

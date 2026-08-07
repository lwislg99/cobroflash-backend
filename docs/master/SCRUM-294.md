# SCRUM-294 (A3) · Recargo de equivalencia y criterio de caja

**Fecha:** 7-ago-2026 · **Carril:** A (núcleo fiscal) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `343ab7b6e5580f951689a060ccf355c476ff5468` · 2026-08-07T11:53:18+02:00
(anclado con `git ls-remote`)
**Tanda:** 2137 tests · 2064 pass · **0 fail** · 73 skipped · `npm test` **`$? = 0`**

> ⚠️ **ENTREGA PARCIAL Y DECLARADA**, igual que A2: se entrega **el cálculo, aislado, probado y sin
> llamadores**. Enchufarlo toca el `Invoice.total` que se sella y el XML del desglose —las dos
> cosas STOP— y necesita campos de schema que no se ponen por iniciativa propia.

## PASO 0 · virgen, medido por entrada Y por mecanismo

Sin rama (`ls-remote` sin `*294*`), sin `docs/master/SCRUM-294.md`, y **sin mecanismo**: cero
apariciones de `recargo`, `equivalencia` o `criterio de caja` en `src/` y `prisma/` salvo **el
XSD de la AEAT** (que es el esquema oficial, no mecanismo nuestro) y un comentario mío en el 303.

**Y una trampa evitada por medirla:** `recc` daba 31 ficheros. Los 31 son **«corrección»**
(`recc`ión). El barrido del bloque A ya ha fallado tres veces; ésta habría sido la cuarta.

## 🔴 LA MEDICIÓN QUE DECIDE EL TICKET

**Pregunta:** ¿el recargo de equivalencia cambia la base, o es un impuesto MÁS sobre ella?
**Respuesta: es un impuesto más.** Y no sale de la memoria — sale del **XSD de la AEAT que está en
este repo** (`SuministroInformacion.xsd`, `DetalleDesglose`):

```xml
<element name="TipoImpositivo"               minOccurs="0"/>
<element name="BaseImponibleOimporteNoSujeto"/>
<element name="CuotaRepercutida"             minOccurs="0"/>
<element name="TipoRecargoEquivalencia"      minOccurs="0"/>   ← hermanos
<element name="CuotaRecargoEquivalencia"     minOccurs="0"/>   ← de los de arriba
```

**No existe ninguna `BaseRecargo`**: el recargo cuelga de la MISMA base imponible. Igual en las
rectificativas (`CuotaRecargoRectificado` junto a `BaseRectificada`/`CuotaRectificada`).

**Consecuencia, y es la que permite entregar esto hoy:** el recargo **no obliga a tocar
`calcVatBreakdown`**. La base y la cuota salen idénticas con recargo y sin él, así que los 16
consumidores de esa función —uno de ellos `registro.builder.ts`, que manda `entrada.base.toFixed(2)`
literal al XML sellado (medido en SCRUM-293)— **no tienen nada que aprender**. Regla 38 respetada
sin necesidad de pedir GO.

## Dónde SÍ toca el camino de emisión, y por eso no hay llamadores

1. **El total.** `Invoice.total = grossOfLines() = base + cuota`. Con recargo, lo que el cliente
   paga es `base + cuota + recargo`: cambiarlo cambia **el número que se sella**.
2. **El XML.** El desglose tendría que llevar `TipoRecargoEquivalencia` y `CuotaRecargoEquivalencia`
   — eso es `registro.builder.ts`.

Las dos son STOP. Y el recargo es **condición de quién compra** (`docs/diseno/bloque-a.md` § A3:
«que el recargo esté en el cliente y no en la factura es correcto»), así que vive en la ficha del
cliente: campo de schema que **no se pone por iniciativa propia**.

**Un test comprueba que nadie los llama** y explica qué hacer el día que haya GO.

## El criterio de caja: clasifica y avisa; NO liquida

El RECC devenga el IVA **cuando se cobra**. Tenemos el cobro dentro… pero **no la fecha en que
entró el euro**: `paidAt: new Date()` en **tres sitios** de `src` (`psp.routes` ×2,
`mpWebhook.routes`), y tres de las cinco formas de cobro se marcan a mano. Eso es el instante en
que **alguien lo marcó**.

Así que `clasificarPorCobro` reparte los asientos entre cobrados y no cobrados **y nada más**, con
la **advertencia viajando dentro del resultado** —no en la pantalla— para que un export o un PDF no
puedan publicar la clasificación sin ella. Decir «esta factura se devengó el 14 de mayo» sería
afirmar una fecha que no tenemos: **eso es E5 y no está construido.**

⚠️ **Contradicción medida que hay que resolver en el documento, no aquí:**
`docs/diseno/bloque-a.md` § A3 dice *«nosotros sabemos exactamente cuándo entró cada euro»*. Con lo
medido hoy **eso no es cierto todavía**. El código no se comporta como si lo fuera; el documento
sigue diciéndolo.

## Los controles

* **Control positivo, con lápiz:** base 1.000,00 al 21 % → IVA 210,00 y **recargo 52,00** (5,2 %),
  total que paga el cliente 1.262,00. Y los otros dos tramos: 500,00 al 10 % → 7,00; 200,00 al 4 %
  → 1,00.
* **Control negativo:** `calcVatBreakdown` sigue dando exactamente lo de antes —base 850,00, cuota
  151,00 y sus dos tramos— y **calcular el recargo no lo altera**. Un merchant sin recargo emite
  como hoy porque **nada llama a esto**.
* **Suelo (las dos mitades):** «no se pudo leer» **no** es «no lleva recargo» ni «no está acogido
  al RECC». Emitir sin el recargo de quien lo lleva es un defecto **mudo**: la factura sale, se
  cobra, y el proveedor se come el recargo que tenía que haber repercutido.
* **Un tipo de IVA sin recargo conocido no se aproxima con el vecino** (misma regla que el 303 con
  las casillas), y **lo que no se puede calcular no suma cero**: se declara en `sinCalcular`.
* **Base ilegible ≠ recargo de 0,00 €** (familia SCRUM-271), con su cara positiva: un cero
  legítimo sí calcula.

## El cuadre del Libro y el 303 — ejecutado, no supuesto

No es opcional y son míos:

| | resultado |
|---|---|
| 303 + Libro en memoria | **26 pass, 0 fail** |
| 303, Libro, 389 y 297 **en Postgres** | **6 pass, 0 fail** (`$? = 0`) |

Y esto cierra el hueco que A2 dejó declarado: allí el cuadre solo se pudo correr en memoria porque
el banco no tenía base inicializada. **El banco está levantado y el lado de Postgres está
ejecutado.**

## Verificado en rojo — cuatro, por `$?`, comiteado antes de cada inyección

| inyección | lo que dijo |
|---|---|
| el recargo se aplica sobre el TOTAL en vez de la base | *«el recargo del 21 % sobre 1.000,00 no es 52,00»* |
| un tipo desconocido se aproxima al vecino | *«el tipo 5 ha producido un recargo»* |
| el suelo se cae a «sin recargo» al no poder leer | *««null» se ha leído como una respuesta válida»* |
| el aviso del RECC deja de viajar con el dato | cae la comparación con `ADVERTENCIA_CAJA` |

## Lo que NO cubre — declarado

* **Los porcentajes (5,2 / 1,4 / 0,5) NO están confirmados.** No salen de ningún documento del
  repo: el XSD da la FORMA, no los valores. Están en una **tabla cerrada y congelada**, en un solo
  sitio, y la pregunta va al asesor (**P13.1**). El mecanismo es correcto aunque los números
  cambien; cambiarlos es una línea.
* **Nadie llama a estos módulos**, a propósito. No hay pantalla, no hay campo de cliente, no hay
  casilla de RECC en Configuración.
* **El RECC no altera ninguna liquidación.** El 303 sigue devengando por emisión.
* **No se ha tocado** `calcVatBreakdown`, `grossOfLines`, el sellado ni el schema.
* **Sin caso de rectificativas con recargo** (`CuotaRecargoRectificado`).

**Bloqueado por:** P13 en `docs/legal/PREGUNTAS_ASESOR.md` (tipos, total sellado, a quién se aplica
y qué exige el RECC de la fecha de cobro) y por los campos de schema, que se deciden aparte.

## Ficheros

* `src/modules/invoicing/domain/recargoEquivalencia.ts` (nuevo) — aislado, sin imports.
* `src/modules/invoicing/domain/criterioCaja.ts` (nuevo) — aislado, sin imports.
* `docs/legal/PREGUNTAS_ASESOR.md` — **P13**, con lo ya medido separado de lo que se pregunta.
* `tests/scrum294-recargo-caja.test.mjs` (15, sin gate).

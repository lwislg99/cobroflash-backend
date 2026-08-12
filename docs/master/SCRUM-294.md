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

---

# SCRUM-294 (parte 2) · PASO 0 al día: el mapa del cable y el campo en `Customer`

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T08:33:46Z` · HEAD
`72294230f9c1fecd9ac0316f2d131eb9b76e76f6` · CLI de Prisma **local**, nunca `npx` (SCRUM-385)

**Medido contra:** `origin/main` = `72294230f9c1fecd9ac0316f2d131eb9b76e76f6` · 2026-08-12T08:33:46Z

> **Esto es el MAPA, no el cable.** Cero código. `prisma/schema.prisma` intacto y nada aplicado a
> ninguna base. El PASO 0 de la parte 1 (7-ago) no se repite: se verifica y se le añade lo que
> faltaba —el campo con su preview—.

## 1 · Qué hay hoy, verificado

| | |
| --- | --- |
| `recargo` en `prisma/schema.prisma` | **0 apariciones** |
| `recargoEquivalencia.ts` | existe desde el 7-ago, probado |
| llamadores | **cero**, comprobado hoy en todo `src/` |

Sigue siendo lo que la parte 1 declaró: **un motor sin cable**, a propósito.

## 2 · 🔴 Dónde toca el camino de emisión — y aquí A3 y A2 se separan

La diferencia con A2 está medida y no se vuelve a medir:

| | A2 · retención IRPF | A3 · recargo |
| --- | --- | --- |
| ¿Cambia lo que paga el cliente? | **no** — es pago a cuenta del pagador | **sí**: `base + cuota + recargo` |
| ¿Se mueve `Invoice.total`? | **no** | **SÍ** → cambia **el número que se sella** |
| ¿Toca `calcVatBreakdown`? | no | **no** *(el XSD de la AEAT: el recargo cuelga de la MISMA base, no hay `BaseRecargo`)* |
| ¿Toca el XML? | no | **SÍ**: `TipoRecargoEquivalencia` y `CuotaRecargoEquivalencia` |

**Los dos sitios de A3 son STOP** (`grossOfLines` y `registro.builder.ts`) y **no se tocan sin GO
explícito**. Este documento no los toca.

## 3 · Por dónde entraría el cable — ESCRITO, NO PUESTO

En orden de riesgo, y los dos últimos con su bandera:

1. **La ficha del cliente** — una casilla y su `PATCH`. Riesgo nulo: no entra en ningún cálculo.
   Necesita **microcopy** (marcador `[PENDIENTE microcopy oficial]` y guard).
2. **La lectura, al emitir** — `leerRecargoDelCliente(customer.recargoEquivalencia)`. El `{ok:false}`
   es **impedimento para emitir**, no un cero: quien no pueda leerlo se para.
3. 🛑 **El total** — `grossOfLines()` pasaría a `base + cuota + recargo`. **STOP, regla 38.**
4. 🛑 **El desglose del XML** — los dos elementos del XSD en `registro.builder.ts`. **STOP.**

**El adaptador no existe y no hace falta**: `leerRecargoDelCliente` ya espera exactamente
`null | true | false`, que es lo que da la columna. El módulo **no se toca**.

## 4 · 🔴 UNA sola columna, y aquí sí — la diferencia con A2, explicada

En A2 hicieron falta **dos** columnas porque el dato era un *tipo* (`Int?`) y «declaro que no
retengo» se quedaba sin representación: colapsaba con «no consta» en el mismo `NULL`.

**Aquí el dato es booleano, y `Boolean?` expresa los tres estados de forma nativa:**

| Columna | `leerRecargoDelCliente` | Significado |
| --- | --- | --- |
| `NULL` | `{ ok:false, motivo }` | **no consta → no se puede emitir** |
| `false` | `{ ok:true, aplica:false }` | declarado que NO lo lleva |
| `true` | `{ ok:true, aplica:true }` | lo lleva |

**Sin `@default`, y es deliberado.** Un `@default(false)` convertiría a los clientes existentes en
«declarado que NO lo lleva» — una afirmación que nadie ha hecho. `NULL` dice la verdad: no consta.
Es la misma decisión que en A2 y por el mismo motivo, con la diferencia de que allí el default
`false` iba en la columna de *declaración*, no en la del dato.

```prisma
model Customer {
  …
  tipoDestinatario String? @map("tipo_destinatario")
  // SCRUM-294 (A3) · recargo de equivalencia: condición de QUIÉN COMPRA, no de la factura.
  // NULL = no consta (impide emitir) · false = declarado que NO · true = lo lleva.
  recargoEquivalencia Boolean? @map("recargo_equivalencia")
  …
}
```

Va en `Customer` y no en `Invoice` porque **es condición del comprador**, como fija
`docs/diseno/bloque-a.md` § A3.

## 5 · EL PREVIEW — salida real, con su control positivo delante

```
node ./node_modules/prisma/build/index.js migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datamodel   <scratchpad>/schema-con-recargo.prisma \
  --script
```

```sql
-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "recargo_equivalencia" BOOLEAN;
```

**Control positivo antes de creerme un diff de una línea** (canon desde hoy): `--from-empty` contra
el schema real devuelve **24 `CREATE TABLE`**. La herramienta ve el schema; el diff es de una línea
porque el cambio es de una línea. Sin ese control, «diff corto» y «herramienta ciega» se leen igual.

### Aditividad, criterio a criterio

| | |
| --- | --- |
| `DROP` de tabla o columna | ninguno |
| `ALTER` sobre columna existente | ninguno |
| `NOT NULL` sobre datos existentes | **ninguno** — la columna es nullable y sin default |
| Índices o constraints | ninguno |
| Filas afectadas | **0** — todas quedan en `NULL`, que es «no consta» |

**100 % aditivo.** No debería pedir `--accept-data-loss`; si lo pide, el diff no es éste y hay que
parar.

## 6 · El orden de ejecución

El mismo que A2, y por el mismo motivo: **staging → verificar → producción → verificar →
`schema.prisma` AL FINAL**. `assertSchemaSinDeriva()` (`src/index.ts:23`) falla ante columnas
**ausentes**; columnas de más no son deriva. Al revés, producción arranca en deriva.

⚠️ **Y esta migración va SOLA.** A2 y A3 son dos lotes distintos aunque se decidan el mismo día:
dos cosas en una migración es lo que ha ido mal esta semana.

## 7 · Reportado y no arreglado (regla 9) — el censo de correo tiene ENVOLTORIOS

No es de este ticket y no lo toco, pero el otro carril que persigue «los ocho» tiene que saberlo:

> **Entre los 17 emisores derivados del censo de correo hay ENVOLTORIOS** —`startCronJobs`,
> `registerMerchant`, `requestMagicLink`—, **y por eso `ignora-resultado: 8` mezcla dos cosas.**
> Ignorar el resultado de *arrancar los crons* (`src/index.ts:30`) no es perder el fallo de un
> correo. **Los ocho que importan son los del trinquete de `tests/scrum477-avisos-con-constancia.test.mjs`,
> no éstos.**

## 8 · Lo que NO se ha hecho

`prisma/schema.prisma` intacto · ninguna migración aplicada a ninguna base · ni una línea de
cableado · `recargoEquivalencia.ts` sigue sin llamadores · `grossOfLines` y `registro.builder.ts`
sin tocar (los dos son STOP) · cero microcopy · los porcentajes (5,2 / 1,4 / 0,5) **siguen sin
confirmar** — P13.1 del asesor, y el mecanismo es correcto aunque los números cambien.

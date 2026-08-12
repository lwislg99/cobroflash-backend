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

---

# SCRUM-294 (fase B) · El criterio de caja mueve el dato, no pinta una casilla

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T11:28:34Z`

**Medido contra:** `origin/main` = `bf54914117fb99e596aa7d638c9ebac8ac809564` · 2026-08-12T11:28:34Z

**PASO 0:** `main` mergeada DENTRO de la rama y **fase A confirmada dentro** —
`7446da308e6242bb8821333c1b555216d69f795a` es ancestro (`merge-base --is-ancestor`). El recargo de
equivalencia **no se ha tocado**: ni campo, ni guard, ni UI, ni tests.

## 1 · Lo que decide el ticket, y pasa

> «Una factura de un merchant con criterio de caja, EMITIDA en un trimestre y COBRADA en otro, queda
> asociada al TRIMESTRE DEL COBRO.»

`F-2026-001`, emitida el **15-feb (Q1)** y cobrada el **20-may (Q2)**: con RECC sale en el libro del
**Q2** y **no** en el del Q1. El rojo nombra la factura y las dos fechas, no «falta un campo».

**Dónde estaba el enganche, medido:** el periodo lo decidía `Invoice.createdAt` —
`libroRegistro.repo.ts` filtra por esa columna— y de ese libro sale el 303. Cambiar la fecha que
manda **es** cambiar en qué declaración cae el euro. Ahora la columna por la que se filtra la elige
`campoDeDevengo()`.

## 2 · Por qué esto no es una casilla

El competidor solo puede ofrecer el RECC como casilla informativa: no sabe cuándo cobras, así que su
usuario acaba llevando en una libreta qué facturas ha cobrado para poder liquidar. **Aquí el cobro
está dentro**, así que el criterio mueve el dato — y A5 podrá calcular el 303 contra cobros reales.

⚠️ Y lo que sigue sin poder afirmarse, que ya midió la fase 1: `paidAt` es el instante en que
**alguien marcó** el cobro. Los webhooks lo ponen al recibir el aviso y el marcado manual guarda
desde SCRUM-397 la fecha que declara la persona. **Es la mejor fecha que hay y es la que se usa; lo
que no se hace es fingir que es otra cosa.**

## 3 · 🔴 El suelo: no se degrada a «sin criterio de caja»

Una lectura fallida **LANZA**. Es el peor sitio del mundo para degradar: «sin RECC» es un valor
legítimo —la mayoría de los merchants— así que un fallo convertido en «no tiene» produce un 303 que
**se parece al de todos los demás** y no lo nota nadie. Un 303 que no se puede calcular es un
problema visible; uno calculado con el criterio equivocado se descubre en una inspección.

Probado con `null`, `undefined`, `'sí'`, `1`, `0` y `{}` — y con los dos legítimos, que **no**
lanzan: si lanzara con todo, el guard no probaría nada.

## 4 · Control negativo, que va primero en el fichero

| | |
| --- | --- |
| merchant sin RECC | devenga por **emisión**, exactamente como hoy |
| libro **sin preguntar** por el criterio | filtra por `createdAt`, byte a byte como siempre |
| factura con RECC **sin cobrar** | **no cae en ningún trimestre** — no devenga, y meterla por su fecha de emisión sería declarar un IVA no cobrado |

Ese último tiene su control positivo dentro: sin RECC esa misma factura **sí** sale en Q1, así que
el «no aparece» de arriba no es que la fixture esté vacía.

## 5 · 🔴 LO QUE QUEDÓ BLOQUEADO, y no paré por ello

**La casilla en Configuración › Empresa necesita una columna en `Merchant`, y `prisma/schema.prisma`
no se toca.** Así que esa mitad no entra. Lo escribo, lo salto y sigo — que es lo que da valor a la
otra mitad: el enganche está construido y probado, y el día que exista la columna solo hay que
pasársela al libro.

**Preview, ESCRITO Y NO APLICADO** (CLI local, con su control positivo delante: `--from-empty`
devuelve **24 `CREATE TABLE`**):

```sql
-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "criterio_caja" BOOLEAN;
```

**Una sola columna**, y por el mismo motivo que el recargo: `leerCriterioCaja` es booleano de tres
estados y `Boolean?` los expresa nativos — `NULL` no consta · `false` no acogido · `true` acogido.
**Sin `@default`**: un `false` por defecto convertiría a todos los merchants en «declarado que no»,
que no lo ha dicho nadie. 100 % aditivo, 0 filas afectadas.

> ⚠️ **El preview salió VACÍO a la primera y era mentira de mi script**, no del árbol: mi ancla
> tenía dos espacios y la línea real tiene uno, así que la sustitución no se aplicó y el diff
> comparó el schema consigo mismo. **Lo destapó el control positivo** — la herramienta veía 24
> tablas, luego el vacío no era suyo. Es la lección de SCRUM-385 aplicada a mi propia mano.

## 6 · Hallazgo derivado y NO arreglado (SCRUM-271, regla 9)

`Number("")` es `0`, y `0 || 1` da `1` en silencio. **Derivado por AST, no enumerado**: 235 ficheros,
1.051 expresiones `||` vistas, control positivo del detector ✓, y **45 `||` sobre una lectura
numérica**. Entre ellos:

```
src/modules/invoicing/domain/vat.service.ts:24   Number(l?.qty) || 1
src/modules/invoicing/domain/vat.service.ts:25   Number(l?.price) || 0
src/modules/invoicing/domain/finalInvoice.service.ts:119-121
src/modules/invoicing/domain/invoiceLines.service.ts:79,80,83,114,115
```

🛑 **`vat.service.ts` es el camino de emisión** —de ahí sale la base que el sellado manda al XML— así
que **se reporta y no se toca** (regla 38). Y no es teórico: una línea con cantidad `0` o vacía se
factura como **1**.

## 7 · Los guards de la casa me corrigieron tres veces, y las tres tenían razón

1. **SCRUM-411** — al cablear `criterioCaja` dejó de ser inalcanzable: el trinquete **BAJA de 8 a
   7**, en el mismo commit. *El trinquete solo baja.*
2. **SCRUM-411, segunda vuelta** — con el módulo ya alcanzable, sus OTROS exports quedaron al
   descubierto. Son el motor de A5 (`clasificarPorCobro`, `ADVERTENCIA_CAJA`): **declarados** en
   `_huerfanos-declarados.mjs` con su motivo, no escondidos.
3. **SCRUM-294 fase 1** — su test exigía que nadie llamara a estos módulos, y decía qué hacer con
   GO: se **estrecha** para que siga vigilando `recargoEquivalencia` —que sí es STOP— y suelte
   `criterioCaja`, con el motivo escrito: el criterio **no toca el total sellado ni el XML**, solo
   decide por qué fecha se agrupa una factura ya emitida.

## 8 · Lo que NO se ha tocado

`prisma/schema.prisma` · el recargo de equivalencia (fase A) · A2 retención · el 303 (A5, que
consumirá esto) · el mecanismo de cobro · el camino de emisión · ninguna microcopy.

## 9 · Estado

Suite completa con `main` dentro: **3.442 tests · 3.365 pasan · 0 fallos · 77 saltados**.

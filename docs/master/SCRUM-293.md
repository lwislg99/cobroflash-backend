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

---

# SCRUM-293 (parte 2) · El diff de schema, ESCRITO Y NO APLICADO — y por dónde entra el cable

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T08:06:06Z` · HEAD
`75b2b01820f71bdb1bf2b3244b19f801d69e24f6` · CLI de Prisma **local** (`node_modules/prisma`), nunca
`npx` (SCRUM-385)

**Medido contra:** `origin/main` = `75b2b01820f71bdb1bf2b3244b19f801d69e24f6` · 2026-08-12T08:06:06Z

> **NO SE HA APLICADO NADA.** Ni a producción, ni a staging, ni a dev. `prisma/schema.prisma` no se
> ha tocado: el schema modificado vive en el scratchpad, solo para poder generar el preview.
> `git status` limpio salvo esta entrada.

## 1 · Lo que desbloquea esta parte

La parte 1 (7-ago) paró por dos motivos y **los dos han caído**:

| Bloqueo de entonces | Hoy |
| --- | --- |
| P12 del asesor | **no bloquea** — decisión del fundador: retención y suplidos son ley conocida, no dictamen |
| SCRUM-383, migraciones congeladas | **descongeladas**: en esta sesión se preparó y aplicó un lote a staging y producción con su preview |

Y el PASO 0 de hoy añade lo que faltaba: **la retención no toca el camino de emisión**.
`Invoice.total` no se mueve y el sellado saca su base de `calcVatBreakdown`
(`registro.builder.ts:315`), que la retención no toca. La variante que **sí** sería STOP —el
suplido como línea marcada— es justamente la que no se construye.

## 2 · 🔴 SON DOS COLUMNAS, NO UNA — y el motivo está en el módulo

El encargo pedía «el campo, nullable». **Una sola columna nullable no vale**, y no es una
preferencia: `leerTipoRetencion()` distingue **tres** estados a propósito, y su cabecera explica por
qué —«emitir sin la retención de quien retiene es un defecto fiscal MUDO: la factura sale, el
cliente la paga, y el descuadre aparece meses después en el 111»—.

| Estado | Qué significa | Con UNA columna `Int?` |
| --- | --- | --- |
| **no consta** | nadie ha configurado nada → **no se puede emitir** | `NULL` |
| **declara que NO retiene** | decisión tomada, tipo ninguno | 🔴 **también `NULL`** |
| retiene al 15/7/2/1 % | el tipo | el número |

Los dos primeros colapsarían en `NULL`, que es **exactamente el colapso que ese módulo existe para
impedir**. Con dos columnas cada estado tiene su representación y el módulo no se toca:

```prisma
model Merchant {
  …
  approvalThreshold  Decimal?  @map("approval_threshold") @db.Decimal(12, 2) // null = sin aprobación

  // SCRUM-293 (A2) · retención de IRPF, configurada UNA VEZ en el perfil.
  retencionIrpfDeclarada Boolean @default(false) @map("retencion_irpf_declarada")
  retencionIrpfTipo      Int?     @map("retencion_irpf_tipo")
  …
}
```

* `retencionIrpfDeclarada` — ¿el profesional ha declarado su situación? `false` por defecto para
  **todos los merchants existentes**: nadie pasa a «declarado» por una migración.
* `retencionIrpfTipo` — `15 | 7 | 2 | 1`, o `NULL`. Nullable, como pedías.

⚠️ **El tipo NO se valida en la base a propósito.** La unión cerrada vive en `TIPOS_RETENCION`
(`retencionIrpf.ts:54`) y `esTipoRetencionValido` la aplica. Un `CHECK` en Postgres sería una
segunda lista que se desincroniza — el defecto de las dos listas.

⚠️ **El suplido NO entra aquí.** Es un dato **por factura**, no del perfil: sería columna en
`Invoice`, y eso es otra decisión tuya. Esta entrega es solo la retención.

## 3 · EL PREVIEW — salida real de la herramienta

```
node ./node_modules/prisma/build/index.js migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datamodel   <scratchpad>/schema-con-retencion.prisma \
  --script
```

```sql
-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "retencion_irpf_declarada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retencion_irpf_tipo" INTEGER;
```

**Control positivo antes de creerme el diff** (SCRUM-385: un vacío con exit 0 es lo mismo que dice
un diff legítimo sin cambios): `--from-empty` contra el schema real devuelve **24 `CREATE TABLE`**.
La herramienta ve el schema; el diff de arriba es corto porque el cambio es corto.

### Aditividad, comprobada línea a línea

| Criterio | |
| --- | --- |
| `DROP` de tabla o columna | **ninguno** |
| `ALTER` sobre columna existente | **ninguno** |
| `NOT NULL` sin `DEFAULT` sobre datos existentes | **ninguno** — el único `NOT NULL` lleva `DEFAULT false` |
| Índices o constraints nuevos | ninguno |
| Filas afectadas | **0**: las dos columnas nacen con valor para todas las filas |

**100 % aditivo.** No debería pedir `--accept-data-loss`; si lo pide, **el diff no es éste** y hay
que parar.

## 4 · El orden de ejecución — y por qué al revés arranca roto

1. **staging** → aplicar
2. **verificar en staging**: las dos columnas existen y la app arranca
3. **producción** → aplicar
4. **verificar en producción**: ídem
5. **`prisma/schema.prisma` AL FINAL**, en su PR

🔴 **Nunca al revés.** `assertSchemaSinDeriva()` corre en el arranque (`src/index.ts:23`) y compara
lo que el schema DECLARA con lo que la base TIENE: falla ante **columnas ausentes**. Si el schema
entra primero, declara dos columnas que la base no tiene todavía y **producción arranca en deriva**
— y ese guard existe justo para impedir arrancar mintiendo (`schemaDrift.ts`, SCRUM-222).

Al hacerlo en este orden, entre el paso 3 y el 5 la base tiene **columnas de más** que el schema no
declara, y eso el guard **no** lo considera deriva. La ventana es segura por construcción.

## 5 · Por dónde entraría el cable de `retencionIrpf.ts` — ESCRITO, NO CONSTRUIDO

El módulo lleva desde el 7-ago probado y **sin un solo llamador** (verificado hoy: cero llamadas a
`calcularRetencion` en `src/`). Esto es el plano, no el cable.

**El adaptador es de una línea, y por eso el módulo no se toca.** `leerTipoRetencion` espera
`null` / `false` / número, y las dos columnas mapean exacto:

```ts
// El valor que se le pasa al módulo, derivado de las dos columnas:
const config = merchant.retencionIrpfDeclarada ? (merchant.retencionIrpfTipo ?? false) : null;
const r = leerTipoRetencion(config);
```

| Columnas | `config` | Módulo |
| --- | --- | --- |
| `declarada=false` | `null` | `{ ok:false }` → **impedimento para emitir** |
| `declarada=true, tipo=null` | `false` | `{ ok:true, tipo:null }` → no retiene |
| `declarada=true, tipo=15` | `15` | `{ ok:true, tipo:15 }` |

**Los tres puntos donde entra el cable, en orden de riesgo creciente:**

1. **El perfil** (`Configuración › Empresa`) — dos controles y el `PATCH` que los guarda. Riesgo
   nulo: no toca ningún cálculo. Necesita **microcopy** (marcador `[PENDIENTE microcopy oficial]`
   y guard, sin inventar una palabra que hable de Hacienda).
2. **El PDF y la pantalla de la factura** — pintar el bloque con `bloqueRetencion()`, que ya existe.
   **`Invoice.total` NO se toca**: el líquido a percibir se **deriva al pintar** y jamás se guarda.
3. **La emisión** — solo para tratar el `{ ok:false }` como impedimento. ⚠️ Aquí conviene mirar dos
   veces: es lectura de configuración, no cálculo, pero vive en el camino que la regla 38 protege.

**El control negativo, que es el que manda:** un merchant con `declarada=false` —o sea, **todos los
de hoy**— tiene que producir una factura **byte a byte idéntica**. Y eso es sostenible por
construcción, porque `grossOfLines()` no se modifica en absoluto: la retención se calcula
**después** y se pinta **aparte**.

## 6 · Lo que NO se ha hecho

`prisma/schema.prisma` **intacto** · ninguna migración aplicada a ninguna base · ni una línea de
cableado · `retencionIrpf.ts` sigue sin llamadores · `calcVatBreakdown`, `grossOfLines` y el camino
de emisión, sin tocar · cero microcopy nueva.

---

# SCRUM-293 (293-a, parte 1) · el control negativo, puesto ANTES del cable

**Fecha:** 12-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `01025aafdb065b682f0da1b70141aa7baebf3a4f` · 2026-08-12T09:30:00+02:00

## Por qué éste va primero

`retencionIrpf.ts` lleva desde el 7-ago construido, probado y **sin un solo llamador**. Este fichero
**congela cómo sale la factura hoy** para un merchant con `retencionIrpfDeclarada = false` —o sea,
**todos los que existen ahora mismo**— para que el día que llegue el cable, cualquier céntimo que se
mueva en esa población caiga aquí.

Escribirlo después del cable habría congelado el resultado del cable. **La red se pone bajo el
trapecio antes de subir.**

## Los vectores, medidos contra el árbol

```
base  302,25 = 136,50 + 120,00 + 45,75
cuota  58,44 =  53,86 (21 % s/256,50) + 4,58 (10 % s/45,75)
BRUTO 360,69 = base + cuota   ← lo que acaba en `Invoice.total`
```

**Rojo demostrado con UN CÉNTIMO**, y con la mutación **verificada como aplicada antes de creerse el
rojo** (lección del rojo falso de esta mañana: un `1 → 1` no es una inyección). Cae diciendo que *se
ha alterado el importe de la factura de un merchant que no ha declarado nada*.

Restaurado **recompilando**, no copiando — el canon vale igual para deshacer.

## Tres cosas que el SUELO cazó, y no la aserción

1. **La forma de línea no era la mía.** `grossOfLines` devolvía **0** con `{quantity, unitPrice,
   vatRate}`; la real es `{qty, price, tax}`. Con el bruto en 0, la igualdad habría comparado nada
   con nada **y habría pasado**.
2. **`tax` va en FRACCIÓN**, no en porcentaje. Con `tax: 21` salía un IVA del **2100 %** — 5.386,50 €
   de cuota sobre 256,50 € de base. No chirría hasta que lo miras.
3. **El vector no puede recalcularse en el propio test.** El primer borrador hacía
   `const CONGELADO = JSON.stringify(calcVatBreakdown(LINEAS))` y comparaba el árbol consigo mismo:
   **un vector que se regenera no es un vector.**

## 🔴 Hallazgo: un caso VIVO del defecto de SCRUM-271

`src/modules/invoicing/domain/vat.service.ts:24`

```ts
const qty = Number(l?.qty) || 1;
```

Una línea con `qty: 0` —o con la cadena vacía que devuelve un `<input type="number">` cuando el
navegador rechaza la entrada— **se factura como cantidad 1**. `Number("")` es `0`, y `0 || 1` da `1`
en silencio. Está en el cálculo de la factura, que este ticket **no toca**: se reporta (regla 9).

**El censo derivado completo de ese patrón queda pendiente**, y este caso demuestra que no es
teórico.

## Lo que queda de SCRUM-293, en orden

1. **`TIPOS_RETENCION` → CUBO** con rótulo por tipo, mismo mecanismo que `CUBO_DE` en
   `metodoDeCobro.ts`. El selector se pinta **recorriendo el cubo**: cero literales de porcentaje en
   el front. Control positivo obligatorio: **inyectar un tipo sin rótulo y enseñar el `tsc` en rojo**
   nombrando el valor que falta y su `fichero:línea`.
2. **Los tres estados**, sin cruzar la semántica: `declarada=false` → `null` → **NO CONSTA** ·
   `declarada=true, tipo NULL` → `false` → **DECLARA QUE NO RETIENE** · `declarada=true, tipo=N` →
   **RETIENE**. `retencionIrpfDeclarada` es «HA declarado», no «declara que retiene».
3. **Suelo ruidoso**: si falla la lectura del defecto del perfil, **no** se degrada a «sin retención»
   en silencio. Es un valor legítimo, y por eso es el peor sitio del producto para degradar: nadie
   notaría el fallo.
4. **El cable**: una línea. `retencionIrpf.ts` se consume, no se toca.
5. **El censo derivado de SCRUM-271** — cualquier `||` sobre lectura de input numérico. Derivado, no
   enumerado. Ya hay un caso confirmado (arriba).

**Descartado y por qué:** el `19 %` no existe —`TIPOS_RETENCION = [15, 7, 2, 1]`— y los suplidos
salen a **SCRUM-500**, porque necesitan columna en `Invoice` y el schema no se toca aquí.

---

# SCRUM-293 (293-a, parte 2) · el cubo, los tres estados y el suelo que grita

**Fecha:** 13-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `01025aafdb065b682f0da1b70141aa7baebf3a4f` · 2026-08-13T00:15:00+02:00

## El cubo · añadir un tipo sin rótulo NO COMPILA

`TIPOS_RETENCION` deja de ser una lista de números y pasa a `CUBO_DE_RETENCION`, un
`Readonly<Record<TipoRetencion, CuboDeRetencion>>` con `tipo · rotulo · orden`. Mismo mecanismo que
`CUBO_DE` en `metodoDeCobro.ts`: **el `Record` exige una entrada por miembro del tipo**.

**Por qué el rótulo vive en el dominio y no en la pantalla:** un `<option>` escrito a mano es un
número suelto que nadie relaciona con esta lista. El día que se añada o se quite un tipo, la
pantalla sigue diciendo lo de antes y **nada avisa**. Recorriendo el cubo, una lista que cambia se
ve sola.

**Control positivo, con el `tsc` en rojo** — se inyectó el `19`, que es justo el que el fundador
retiró, para que el rojo demuestre el mecanismo con el caso real que lo motivó:

```
src/modules/invoicing/domain/retencionIrpf.ts(80,14): error TS2741:
  Property '19' is missing in type 'Readonly<{ 15: …; 7: …; 2: …; 1: … }>'
  but required in type 'Readonly<Record<1 | 2 | 7 | 15 | 19, CuboDeRetencion>>'.
```

Nombra **el valor que falta y su fichero:línea**.

## ④ Los tres estados, y por qué son tres

| Merchant | Adaptador | Lectura | Significado |
| --- | --- | --- | --- |
| `declarada=false` | `null` | `{ok:false}` | **NO CONSTA** — los 13 de hoy |
| `declarada=true`, `tipo NULL` | `false` | `{ok:true, tipo:null}` | **DECLARA QUE NO RETIENE** |
| `declarada=true`, `tipo=N` | `N` | `{ok:true, tipo:N}` | **RETIENE** |

`retencionIrpfDeclarada` es **«HA declarado»**, no «declara que retiene». Cruzarlo haría que «nadie
lo ha dicho todavía» significara «todos declaran que no retienen» — y como el campo es
`@default(false)`, eso serían **todos los merchants existentes**.

Un test por estado, para que el rojo diga **cuál** se rompió, más el que es el corazón del ticket:
**① y ② no colapsan**. Son lo contrario —una pregunta sin contestar y una respuesta—, y con los dos
iguales el producto no puede saber a quién preguntarle, y emite igual.

## ⑤ El suelo ruidoso — ya estaba construido, aquí queda vigilado

`leerTipoRetencion` devuelve `{ok:false, motivo}` ante `null`, `undefined`, cadena vacía, `NaN`,
objetos y tipos desconocidos. **No degrada a «sin retención»** — y el test exige además que el fallo
traiga **motivo**: un fallo mudo no es ruidoso.

> «Sin retención» es un valor **legítimo**, y por eso es el peor sitio del producto para degradar:
> una factura sin retención no chirría, así que **nadie notaría nunca el fallo**.

## 🔴 El rojo 1, y por qué el primer intento NO contaba

**Primer intento:** quité la guarda de `null`/`undefined`. La mutación **se aplicó** y **ningún test
cayó**. No se apuntó como rojo: el módulo tiene **defensa en profundidad** —sin esa guarda, `null`
cae igual en `esTipoRetencionValido(null)`— así que la inyección **no cambiaba el comportamiento**.

**Rehecho devolviendo el estado CONTRARIO**, que es lo que prueba el colapso:

```
leerTipoRetencion(null) = {"ok":true,"tipo":null}   ← antes {ok:false, …}
```

Y caen **TRES** tests: el estado ①, la comparación ①-vs-② y el suelo. **Que caigan tres y no uno es
el dato**: un colapso que solo se viera desde un sitio estaría mal vigilado.

> **Canon:** verificar que el fichero cambió NO basta. Hay que verificar que **el comportamiento**
> cambió. Un guard que no cae ante una mutación significa dos cosas opuestas —que vigila mal, o que
> hay otra defensa detrás— y solo se distinguen mirando el comportamiento.

## Lo que queda de SCRUM-293

* **③** la pantalla recorriendo el cubo, **entera**, con su guard de «cero literales de porcentaje
  en el front». O entra entera o no entra: a medias deja el selector con la mitad de las opciones de
  cada fuente.
* **⑥** el cable —una línea, `retencionIrpf.ts` se consume, no se toca— y el **censo derivado de
  SCRUM-271** (cualquier `||` sobre lectura de input numérico; hay un caso confirmado en
  `vat.service.ts:24`, que es SCRUM-504 y **no se toca**).

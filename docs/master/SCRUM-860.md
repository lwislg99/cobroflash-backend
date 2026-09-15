# SCRUM-860 · Clasificadas las 146: el número que decide es 81, no 146

**Fecha:** 15-sep-2026 · **Carril:** seguridad · datos · **Gate:** sin gate
**Medido contra:** `origin/main` = `8b9b0d9b0dce14b635327e5b74a14c0bafcd5be7` · 2026-09-15T14:22:43Z
**Rama:** `scrum-860-clasificar-las-146`

⛔ **ESTA TANDA CLASIFICA. No arregla ninguna de las 146 y no escribe el guard** (§3 del ticket):
el criterio del guard tiene que DERIVARSE de esta clasificación, y con la clasificación recién
hecha lo honesto es entregarla y que el arreglo lo decida quien venga (regla 9). `src/` intacto.

---

## 1 · El número que decide

| | |
|---|---|
| lecturas de Prisma en `src/` | 430 |
| · con `select` de primer nivel | 284 |
| · **sin** `select` | **146** ← el censo |
| | |
| 🔴 **HACIA FUERA** — se serializan a una respuesta | **81** ← **el número que decide** |
| INTERNA — no salen por la API | **36** |
| ⚠️ **NO CLASIFICADO** — no lo sé | **29** |
| **suma** | **146** ✅ cuadra con el censo |

**146 era el tamaño del censo; el del problema es 81.** Y dentro de los 81 la prioridad tampoco es
plana:

| modelo | hacia fuera |
|---|---|
| `invoice` | 18 |
| `quote` | 18 |
| `charge` | 10 |
| `job` | 9 |
| `albaran` | 5 |
| resto (13 modelos) | 21 |

Los cuatro de cabeza son exactamente los que llevan datos de cliente y dinero, que es lo que el
ticket temía: **46 de las 81 están en `invoice`, `quote` y `charge`.**

---

## 2 · El método, declarado — y sus límites con él

Por cada lectura sin `select`: se ensucia lo que liga, se propaga dentro de su función
(asignaciones, destructuring, `for…of` y derivadas), y entonces:

1. si algo sucio entra en `res.json(x)` / `res.send(x)` de esa función → **HACIA FUERA (directo)**;
2. si no, y la función **devuelve** algo sucio → se buscan sus llamadores en `src/`; si alguno
   serializa el resultado → **HACIA FUERA (por su llamador)**;
3. si devuelve algo sucio y no se puede seguir → **NO CLASIFICADO**;
4. si lo sucio no se devuelve ni se serializa → **INTERNA**.

### 🔴 Los límites, antes que el número

* **El seguimiento de llamadores es de UN salto.** Una cadena servicio→servicio→handler sale NO
  CLASIFICADO, no INTERNA.
* No se resuelven llamadas dinámicas ni re-exportaciones.
* 🔒 **NO CLASIFICADO NO ES SANO.** Es «no lo sé». Se cuenta aparte a propósito: esta mañana, de 29
  candidatos clasificados estáticamente, **26 cambiaron de veredicto al ejecutarlos** (SCRUM-844).
  Una clasificación estática es una hipótesis hasta que alguien sigue el camino.

### Los 29 no clasificados, por qué

| nº | motivo |
|---|---|
| 20 | devuelve el dato y su llamador (1 salto) no serializa: **la cadena sigue** y no la he seguido |
| 9 | devuelve el dato y **no se le encuentran llamadores** en `src/` |

Los 9 sin llamadores son los más sospechosos: o son código muerto, o los llama algo que este
análisis no ve. **Ninguno de los 29 debe contarse como sano.**

---

## 3 · 🔴 EL CONTROL QUE DECIDE, ejecutado

Se añade `margenObjetivoInterno` al modelo **en memoria** —una columna que nadie nombra en ninguna
parte del código— y se comprueba si sale sola por una lectura clasificada HACIA FUERA:

```
🔴 SUELO · la mutación entró: la fila doblada lleva `margenObjetivoInterno`

🔴 EL QUE DECIDE · `listProducts` (clasificada HACIA FUERA, sin `select`)
   claves servidas: 14
   ¿sale `margenObjetivoInterno` sin que nadie la nombre?  🔴 SÍ

✅ CONTRASTE · `exportProductsCsv` (CON `select`, mismo doble, misma columna nueva)
   ¿saca la columna nueva?  ✅ no

✅ NEGATIVO · `listProducts` SIGUE sirviendo `cost` (decisión del fundador, SCRUM-609)
   cost = 12.00  ✅
```

### Por qué el doble respeta `select`, y sin eso esto no probaría nada

Un doble que devolviera siempre la fila entera sacaría la columna nueva por **todas** las lecturas,
con `select` o sin él, y el control sería **circular**: demostraría lo que hace el doble, no lo que
decide el código. Por eso imita la semántica real de Prisma —con `select`, sólo las claves pedidas;
sin él, la fila entera—. **El contraste con `exportProductsCsv` es lo que prueba que el doble no
miente**, y por eso va dentro del control y no aparte.

### Y se comprobó que la mutación ENTRÓ

🔒 Una mutación que no entra y una cobertura que no existe dan la misma salida. Medido hoy mismo en
SCRUM-844, donde un `split/join` que casó cero veces dejó el fichero intacto, el test pasó en verde
y por poco declaro NO CUBIERTO el punto más grave de aquel ticket. Aquí se afirma **antes** de leer
el veredicto que la fila doblada lleva la columna nueva.

### ✅ El control negativo, y la distinción que evita el desastre

> 🔒 **«HACIA FUERA» ES UNA CLASIFICACIÓN, NO UN VEREDICTO DE DEFECTO.**

`listProducts` está clasificada HACIA FUERA **y eso no la convierte en un defecto**. Que sirva
`cost` está DECIDIDO (SCRUM-609, `adminRouteDeclarations.ts:205`) y es correcto. Lo que esta tanda
mide es otra cosa: **que la columna de mañana sale sola, sin pasar por ninguna decisión.** Un guard
que confundiera las dos cosas marcaría `listProducts` y sería el guard que acaban relajando.

### Comprobación a mano, contra la clasificación automática

`auth.service.ts:250` (`verifyMagicLink`) sale **INTERNA**. Leído: lee `authSession` sin `select`,
la usa sólo para comprobaciones y para un `update`, y devuelve `string | null` — **la fila nunca
sale**. La clasificación acierta en el caso comprobado. Es UNA muestra, no una validación del
conjunto, y se dice así.

---

## 4 · Lo que esto deja preparado para el arreglo (y NO se hace aquí)

El ticket §3 pide un guard cuyo criterio **se derive** de esta clasificación, no una lista a mano.
La clasificación ya da el criterio derivable: **una lectura sin `select` de primer nivel cuyo
resultado se serializa a una respuesta**. Sobre `main` de hoy eso son **81**, y el guard tendría que
partir de esa cifra y no dejarla crecer.

⚠️ Y una advertencia para quien lo escriba: **los 29 no clasificados no pueden entrar como sanos**.
Si el guard se deriva sólo de los 81, los 29 quedan fuera de la red sin que nadie lo haya decidido
— que es exactamente el mecanismo que este ticket denuncia, una capa más arriba.

## 5 · Lo NO tocado

`src/` entero · `listProducts` · el `select` de `exportProductsCsv` (es la cabecera del CSV, medido
en SCRUM-752; **no se recuenta como caso**) · `prisma/schema.prisma` · el camino de emisión fiscal
(leído, regla 38) · ningún estado ni flag (27) · ninguna dependencia (36). Ninguna base, ninguna
clave. **Nada ejecutado contra producción ni contra staging.**

---

# SCRUM-860 · FASE b · 15-sep-2026 · El trinquete, con suelo 102 y los 9 resueltos

**Medido contra:** `origin/main` = `f5720e41e44a8445f51773b9879df277cc7ef946` · 2026-09-15T15:32:18+01:00
**Rama:** `scrum-860b-trinquete-del-select` (sobre la fase a, que sigue sin mergear)

⛔ **No se arregla ninguna de las 146.** El trinquete entra **con el suelo puesto**; cerrarlas es
trabajo posterior y puede ser de otro (regla 9). `src/` y `prisma/` intactos: **0 líneas de diff**.

---

## 1 · Los 9 sin llamadores: 8 resueltos, 1 sigue sin resolver

Eran el suelo honesto de la fase a, y los llamé «los más sospechosos». No eran nueve incógnitas:

| caso | veredicto |
|---|---|
| `payCard.routes.ts:19` · `payMp.routes.ts:20` | **INTERNA** (handler terminal) |
| `receipt.routes.ts:430 · :433 · :435 · :439` | **INTERNA** (handler terminal) |
| `quoteDecisionLanding.routes.ts:829` · `quotesAdmin.routes.ts:621` | **INTERNA** (handler terminal) |
| `jobs.routes.ts:1205` | ⚠️ **sigue NO CLASIFICADO**, con motivo nuevo |

### 🔒 La vía que se me escapaba, y vale más que los nueve

**Un handler terminal no tiene llamadores, y eso no es «no lo sé».** A un
`router.get('/x', async (req, res) => ...)` lo llama Express, no `src/`. Mi clasificador buscaba
llamadores **por nombre**, y una función anónima no tiene ninguno — así que los ocho caían en «no se
le encuentran llamadores», que suena a incógnita y era una **certeza**: no los tiene por diseño.

> 🔒 El instrumento confundía **«no hay a quién preguntar»** con **«no sé»**. En un handler terminal
> se decide en el sitio: o serializa lo sucio, o no sale por ahí. Ninguno de los ocho lo serializa —
> `payCard`, por ejemplo, usa la fila campo a campo para armar la sesión de Stripe y nunca la
> devuelve al cliente.

### Y el noveno destapó una SEGUNDA frontera

`jobs.routes.ts:1205` no es código muerto ni tiene un llamador invisible: es un
**callback de `$transaction`**. `const x = await prisma.$transaction(async (tx) => { ... return fila; })`
devuelve la fila a la función de fuera, pero el callback es anónimo **y no es un handler terminal**:
no hay nombre al que buscarle llamadores y su valor sí viaja.

Se queda en **NO CLASIFICADO con motivo propio**, no redondeado a INTERNA. Las dos fronteras quedan
escritas en el criterio para que el siguiente censo no las herede a ciegas.

---

## 2 · El suelo, recalculado

| | fase a | **fase b** |
|---|---|---|
| 🔴 HACIA FUERA | 81 | **81** |
| INTERNA | 36 | **44** |
| ⚠️ NO CLASIFICADO | 29 | **21** |
| **suma** | 146 | **146** ✅ |

**El suelo del trinquete = 81 + 21 = 102.**

> 🔴 **NO CLASIFICADO cae del lado MALO.** Si el suelo se derivara sólo de las 81, las 21 que nadie
> ha sabido seguir quedarían fuera de la red sin que nadie lo hubiera decidido — que es el defecto
> de este ticket una capa más arriba. Es el aviso que dejé en la fase a, aplicado a mí misma.

Y de las 44 INTERNAS, **22 son handlers terminales** y 22 no devuelven ni serializan.

---

## 3 · El trinquete: `tests/scrum860-trinquete-del-select.test.mjs`

* **derivado, no una lista congelada.** Se recalcula en cada tanda con el criterio de
  `scripts/_lecturas-sin-select.mjs`. Una lista de 81 rutas congelada dejaría fuera a las 21 y a
  todo lo que venga.
* **el suelo sólo baja.** Pasar por debajo **no es rojo**: el mensaje pide bajar el número en el
  mismo commit que cierra la lectura. Sólo crecer es rojo.
* **`NO CLASIFICADO` cuenta como expuesta.**

### 🔓 La salida barata, escrita dentro del propio rojo

Un rojo sin salida es un rojo que se relaja, así que el mensaje lleva las dos formas de cerrarlo:

```
🔓 DOS FORMAS DE CERRARLO, y la primera no obliga a seguir ninguna cadena:
   (a) PON EL `select` y nombra las columnas que esa respuesta debe llevar. Siempre es
       segura: si nombras de menos, lo ves en la respuesta; si el dato no sale por la API,
       tampoco molesta.
   (b) O PRUEBA QUE ES INTERNA: que el dato no llega a ningún `res.json`/`res.send`. Si lo
       es y este guard no lo ve, el que falla es el criterio de
       `scripts/_lecturas-sin-select.mjs` — arréglalo ahí, no aquí.

⛔ Lo que NO vale es subir `SUELO`: sólo baja. Subirlo es declarar que el defecto crece.
```

### Y el criterio vive en UN sitio

El análisis se ha movido a `scripts/_lecturas-sin-select.mjs`; el fichero de `docs/` pasa a ser el
informe legible que lo importa. **Dos copias del mismo criterio es cómo nacen dos censos del mismo
árbol que un día dejan de coincidir** — y el que diverge en silencio es el que miente.

---

## 4 · Los cuatro controles, ejecutados

**🔴 EL QUE DECIDE — el guard cae de verdad.** Se creó `src/__control-860/nueva.ts` con una lectura
sin `select` que se sirve por `res.json`, y el trinquete cayó:

```
not ok 2 - SCRUM-860 · 🔴 EL TRINQUETE: no entra ninguna lectura nueva sin `select` que se sirva
  🔴 HAN ENTRADO 1 LECTURA(S) SIN `select` QUE ACABAN EN UNA RESPUESTA.
     suelo declarado: 102 · ahora: 103
  ...
   · src/__control-860/nueva.ts:4  invoice.findFirst  [lado malo]
```

Nombra **fichero y línea**. Fichero borrado después; `src/` intacto.

**✅ POSITIVO Y OBLIGATORIO — `listProducts` NO cae.** Está **dentro del suelo**, contada, y el
trinquete está verde hoy con ella dentro.

> 🔒 «HACIA FUERA» es una **clasificación**, no un veredicto de defecto. Que `listProducts` sirva
> `cost` está DECIDIDO (SCRUM-609, `adminRouteDeclarations.ts:205`). Un guard que la marcara estaría
> confundiendo las dos cosas — que es justo lo que avisé en la fase a que no había que hacer.

**✅ POSITIVO — una lectura nueva CON `select` no hace subir el suelo.** Si lo hiciera, el guard
castigaría a quien lo pone, y ése es el guard que acaban relajando.

**🔴 MUTACIÓN — y entró.** Con `SUELO` a `99999` (ancla comprobada: aparecía exactamente una vez), la
lectura nueva **vuelve al verde**: `ok 2`. Eso prueba que lo que la caza es el trinquete y no otra
cosa. Fichero restaurado byte a byte — sha256 `56b7cfce6ec67279` antes y después.

**✅ El suelo BAJA sin romper.** Con una lectura cerrada, la condición sigue siendo cierta: el rojo
es sólo hacia arriba. Un suelo que cuenta instancias del defecto y castiga el arreglo es un suelo
que alguien borra.

**SUELO del propio guard:** si el clasificador no ve lecturas, o ninguna CON `select`, o cero del
lado malo → **CIEGO**.

---

## 5 · Lo NO tocado

Ninguna de las 146 · `listProducts` · el `select` de `exportProductsCsv` · `src/` · `prisma/schema.prisma` ·
el camino de emisión fiscal (leído, regla 38) · ningún estado ni flag (27) · ninguna dependencia (36).
Ningún fichero de criterio con bytes de control: **0 NUL** (comprobado; la fase a dejó 5 y se
corrigieron). Ninguna base, ninguna clave. **Nada ejecutado contra producción ni contra staging.**

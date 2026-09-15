# SCRUM-855 · El doble compartido devolvía `undefined` sin llamar al callback de `$transaction`

**Fecha:** 15-sep-2026 · **Carril:** instrumentos · infraestructura de pruebas · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `3e2ecda1dd77da0bf1287f6d5c3f2b343188ed91` · 2026-09-15T14:35:35+01:00
**Y main siguió moviéndose mientras:** a `51fb635c`. No se re-ancla porque **no se ha medido
contra él**; comprobado que su diff no toca el doble ni sus dos importadores. El ancla dice el
árbol que se midió, no el último que pasó por delante.
**Rama:** `scrum-855-el-doble-que-no-llama`

> ⛔ **`src/` no se toca.** El defecto está en `tests/_envio-doblado.mjs`, que es instrumento.

---

## 0 · El defecto, ejecutado antes de tocar nada

`tests/_envio-doblado.mjs:66` (en `main`):

```js
if (nombre.startsWith('$')) return async () => undefined;   // $disconnect, $transaction…
```

Ese `startsWith('$')` atrapaba `$transaction`. **El control que decide**, corrido contra el doble
de `main`:

```
await db.$transaction(async (tx) => { assert.fail('ASERCIÓN IMPOSIBLE'); })
  ¿entró en el callback?    false
  ¿qué devolvió?            undefined
  ¿reventó el assert.fail?  NO — el proceso sigue vivo
```

Una aserción imposible dentro de la transacción **no tumbaba nada**. Verde sobre nada.

## 1 · 🔴 EL CENSO, Y LOS TRES NÚMEROS

Derivado por **AST**, no por `grep`, y el motivo no es estilo: hay ficheros que **nombran**
`_envio-doblado.mjs` en su cabecera para explicar por qué **no** lo usan. Contarlos como usuarios
inflaría el censo justo donde uno querría creérselo.

| | |
|---|---|
| ficheros de `tests/` barridos | **916** |
| **IMPORTAN** el doble (AST) | **2** — `scrum590b-el-campo-en-la-pantalla`, `scrum815-disputa-una-sola-vez` |
| lo **NOMBRAN** sin importarlo | **2** — `scrum815-referido-una-sola-vez`, `scrum856-canje-una-sola-vez` |
| de los 2 importadores, ¿cuántos **ejecutan** un `$transaction`? | **0** |

El tercer número **no se dedujo del fuente: se ejecutó.** El AST decía que `scrum590b` carga
`customerAdmin.js`, que tiene un `$transaction` en la línea 385 — pero ése es el del **borrado**, y
lo que ese test ejercita es el **alta**. «El módulo tiene» y «el test pasa por ahí» son preguntas
distintas, y la segunda sólo se contesta corriendo. Se instrumentó el doble para anotar cada
llamada real en un fichero: **ninguna**.

> 🔒 Y el cero se probó antes de creérselo: con un control positivo que SÍ llama a `$transaction`,
> la sonda lo registra. Un cero sin control positivo y una sonda ciega se leen igual.

### Entonces, ¿cuántos verdes falsos había? **Cero hoy — y ése es el dato, no la ausencia de él**

Ningún test de la casa estaba, hoy, en verde sobre una transacción vacía. **Pero el defecto ya
había cobrado su precio, y es la parte que no se ve en un recuento:**

**Dos sesiones toparon con él y lo rodearon escribiendo SU PROPIA copia del doble** —
`scrum815-referido-una-sola-vez` y `scrum856-canje-una-sola-vez`—, dejándolo escrito en sus
cabeceras con número de línea:

> «`_envio-doblado.mjs:66` corta todo lo que empieza por `$`… con ese doble, este fichero pasaría
> en verde sin ejecutar una sola línea del arreglo. Por eso hay doble propio.»

O sea que el defecto ya produjo **exactamente lo que este módulo compartido existe para evitar**:
dos copias de un doble, que son dos sitios donde divergir. El coste no estaba en los verdes: estaba
en que el instrumento compartido dejó de usarse para lo que más importa.

## 2 · El arreglo

* `$transaction(cb)` **llama al callback** y devuelve su resultado.
* `$transaction([...])` espera el lote y devuelve los resultados. **Son dos contratos, no dos
  variantes**, y el árbol usa los dos.
* Una **tercera forma** (opciones, `{ isolationLevel }`) **se denuncia**: el doble no la sabe
  imitar y decirlo es mejor que contestar.

### 🔴 El `tx` NO lleva `$transaction`, y es fidelidad

El `tx` de Prisma es `Omit<PrismaClient, ITXClientDenyList>` y `$transaction` está en esa lista.
Hay código de producción que se apoya **exactamente** en eso: `applyVeriFactu` lanza
`verifactu_seal_inside_transaction` cuando `typeof prismaClient.$transaction !== 'function'`. Un
`tx` que lo llevara haría pasar en verde justo el caso que esa guarda existe para impedir — o sea,
habríamos arreglado un falso verde **creando otro**.

## 3 · ④ El suelo que faltaba

Cualquier `$…` que el doble no sepa imitar **lanza nombrándolo**, en vez de devolver `undefined`.
Devolver `undefined` en silencio es lo que convierte un doble incompleto en un falso verde: quien
llamara a `$queryRaw` recibía `undefined` y seguía como si la consulta hubiera ido bien.

La puerta queda abierta: un test que sepa qué debe devolver su consulta puede **declararlo** en el
banco (`{'$queryRaw': () => […]}`). Sin esa puerta, el suelo obligaría a duplicar el doble otra
vez, que es el defecto de partida.

**Control negativo, como pide el ticket:** `$connect` y `$disconnect` **no cambian de semántica**.
No mueven datos —son ciclo de vida— así que un no-op sigue siendo la imitación fiel.

## 4 · Las cinco mutaciones, y una que midió mi propio instrumento

| mutación | qué cae |
|---|---|
| 🔴 **vuelve el defecto original entero** | **8** de los 12 |
| el callback se llama pero no se devuelve su resultado | 1 |
| el `tx` sí lleva `$transaction` | 1 |
| la forma de array deja de atenderse | 1 |
| el suelo desaparece: los `$` desconocidos vuelven a callar | 1 |

Fuente restaurado y verificado byte a byte tras cada una (`Buffer.compare === 0`, mismo sha256 al
principio y al final).

### ⚠️ Y la primera vez, la mutación obligatoria midió un fichero roto

El primer intento de reponer el defecto lo inyectó con un `node -e` desde el shell, y el `$` se lo
comió el escapado: el resultado fue un **`SyntaxError`**, no el defecto. La pasada dijo «caen los
tres ficheros» —incluidos los dos que no tocan `$transaction`— y ese resultado era **del
instrumento, no del árbol**. Rehecha sin pasar por el shell, el veredicto real es el de la tabla:
caen 8 míos y **los dos importadores siguen pasando**, que es justo lo que el censo predijo.

> 🔒 Una mutación que no compila no dice nada del árbol: dice que la mutación estaba mal escrita.
> Si el resultado te sorprende, sospecha del instrumento antes que del código.

## 5 · La cosecha: qué se puso rojo al arreglar el doble

**Ninguno.** Tanda completa con el doble arreglado: **6677 tests · 6566 pass · 1 fail · 110
skipped**, y el único fallo es `SCRUM-854 · esta rama, si toca código, trae su entrada de registro`
— que pedía **este documento** y se cierra con él. Ni un verde falso destapado, coherente con el
censo: los dos importadores no ejecutan ninguna transacción.

La lista de rojos que el ticket esperaba **está vacía, y la ausencia está medida**: no es que no se
haya mirado, es que no había.

## ⛔ Lo no tocado

**`src/`**: ni una línea · **los dos dobles propios** de `scrum815-referido` y `scrum856`: intactos
— cablearlos de vuelta al compartido es trabajo aparte, y se decide con esto ya mergeado ·
**ningún `skip`** (SCRUM-754: un test saltado cuenta como pasado) · **ningún estado ni flag nuevo**
(27) · **ninguna dependencia** (36) · el camino de emisión fiscal ni se abre.

# SCRUM-855 · APENDICE · 15-sep-2026 · fase b — las dos copias SE QUEDAN, y sus cabeceras dejan de mentir

**Medido contra:** `origin/main` = `b63ed4247d30c60314aa58ec1dd261e127953f05` · 2026-09-15T15:28:08+01:00
**Y main siguió moviéndose mientras:** a `42dff021`. No se re-ancla porque **no se ha medido
contra él**; comprobado que su diff no toca ninguno de los tres ficheros de este trabajo.
**Rama:** `scrum-855b-las-dos-copias-de-vuelta`

> ⛔ **No se cablea nada y no se sube el estado al compartido.** Este apéndice cambia
> **COMENTARIOS**: 78 líneas añadidas y 14 quitadas, **cero** que no sean comentario o línea en
> blanco — comprobado sobre el diff, no a ojo.

---

## 1 · La premisa con la que se abrió el encargo era falsa, y se midió antes de construir

El encargo de esta fase decía que las dos copias del doble existían **sólo** para rodear
`_envio-doblado.mjs:66`, y que con la fase a dentro se podían cablear de vuelta. Medidas punto por
punto, **una de siete diferencias era el rodeo**:

| | qué hace la copia propia | ¿era el rodeo de la 66? |
|---|---|---|
| 1 | tabla con **estado** — lo escrito se lee de vuelta | NO |
| 2 | **`{increment}` / `{decrement}`** interpretados | NO |
| 3 | el **`where`** evaluado: `null`, `not`, y `gte`/`gt` en el de 856 | NO |
| 4 | **`updateMany` como UPDATE CONDICIONAL atómico**, con `{count}` real | NO |
| 5 | **`cede()`**: dos llamadas concurrentes se intercalan de forma DETERMINISTA | NO |
| 6 | `$transaction` con sus dos firmas | **SÍ** |
| 7 | *(sólo 856)* **cerrojo de fila**: dos transacciones sobre la misma fila se serializan | NO |

## 2 · Y no es una opinión: el compartido no puede sostenerlos, ejecutado

Contra el doble compartido **ya arreglado por la fase a**:

```
① tras un update, findUnique devuelve : null          → no hay estado
② updateMany con un where que casaría : {"count":0}   → el count no mira el where
③ ¿interpreta {decrement}?            : {"freeMonths":{"decrement":1}} → lo pasa tal cual
④ orden de dos transacciones          : A-entra B-entra A-sale B-sale → se intercalan
```

Esas cuatro respuestas son **exactamente lo que los dos tests miden**. Cablearlos no los migraría:
los dejaría midiendo otra cosa — un test de carrera sobre un banco donde la carrera no se puede ni
plantear. Sería cambiar el falso verde de la línea 66 por uno nuevo.

**Decisión del fundador (15-sep-2026): las dos copias se quedan.** Lo que se arregla es lo único
que era falso: sus cabeceras, que decían existir por un defecto que ya no existe.

> 🔒 Una cabecera que afirma algo falso es peor que no tener cabecera: la siguiente sesión la lee,
> se la cree, y «arregla» lo que no estaba roto.

## 3 · La condición de fusión, escrita — el criterio, no sólo la decisión

**Si un TERCER test necesita banco de concurrencia, se extrae uno común.** Con tres instrumentos
vivos la duplicación cuesta más que la abstracción; con dos, extraer un común obligaría a darle
estado al doble de envío —que no lo necesita— y a que los dos tests que hoy lo usan bien cargaran
con él. **No antes de tres.**

## 4 · El compartido declara lo que NO sabe hacer

`_envio-doblado.mjs` gana en su cabecera el límite que no tenía: **no tiene estado**, lo escrito no
se lee de vuelta, el `count` no mira el `where` y los `{increment}`/`{decrement}` pasan tal cual.

Se dice porque **el silencio de un instrumento se lee como capacidad**. Dos sesiones necesitaron
justo eso y se encontraron el muro sin que nada se lo dijera. Ahora la cabecera las nombra y manda
al tercero a extraer el común.

## 5 · Que no se ha roto nada: las cifras, antes y después

| | ANTES | DESPUÉS |
|---|---|---|
| `npm test` | 6699 tests · 6589 pass · **0 fail** · 110 skipped | 6699 · 6588 · **1 fail** · 110 skipped |
| `guards:entrada` | 22 · 22 pass · 0 fail · 0 skipped | 22 · 22 pass · 0 fail · 0 skipped |
| `scrum815-referido` verde | 6 pass · 0 fail | 6 pass · 0 fail |
| `scrum856-canje` verde | 9 pass · 0 fail | 9 pass · 0 fail |
| 🔴 rotura C1 (carrera del referido) | caen **2** | caen **2**, los mismos |
| 🔴 rotura C2 (canje doble) | caen **4** | caen **4**, los mismos |

**Los 110 saltados van aparte a propósito: un test saltado no midió** (SCRUM-754). No se ha añadido
ni quitado ninguno — siguen siendo los mismos 110 de antes.

### 🔴 La cifra que SÍ se movió, y qué era

`fail` pasó de 0 a 1: **`SCRUM-854 · esta rama, si toca código, trae su entrada de registro`**. No
es un guard contando menciones —el riesgo que este encargo temía—: mira **qué ficheros toca la
rama**, y la mía tocaba tres de `tests/` sin aportar su entrada. `docs/master/SCRUM-855.md` ya
existía en main, pero el guard exige que la rama traiga la suya. Se cierra con **este apéndice**,
no relajando el guard (norma A7).

### ⚠️ Y un defecto de MI instrumento, que estuvo a punto de colarse

El lector de cifras buscaba `tests (\d+)` sobre el fichero entero y cogía **la primera
coincidencia**. En la tanda DESPUÉS el recuento no es lo último —detrás van los `failing tests`—,
así que devolvió `fail: 0` **mientras listaba un fallo debajo**. Las dos afirmaciones se
contradecían en la misma pantalla. Las cifras de la tabla salen del bloque de recuento localizado
por su posición (línea 9708 de 9742), no de la primera coincidencia.

> 🔒 Si el instrumento se contradice a sí mismo, la respuesta no es elegir la mitad que encaja.

## ⛔ No tocado

**Ningún cableado**: las dos copias siguen con su banco propio · **el compartido no cambia de
comportamiento**: 0 líneas de código, sólo comentario · **ni un assert nuevo ni uno menos** en los
dos tests · **`src/` intacto** — las dos roturas de los controles se restauraron byte a byte
(`Buffer.compare === 0`, sha256 `1ed37322690dcede` antes y después) · ningún `skip`, ningún estado
ni flag (27), ninguna dependencia (36).

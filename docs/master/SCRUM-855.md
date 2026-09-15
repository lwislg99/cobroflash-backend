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

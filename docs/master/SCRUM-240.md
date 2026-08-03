# SCRUM-240 · SOBRE-ÚNICO: un solo generador del sobre `RegFactuSistemaFacturacion`

**Fecha:** 2-ago-2026 · **Carril:** A (fiscal) · **Gate:** GO del fundador con diff antes de cerrar (regla 29) · sin gate en tests

**Medido contra:** `origin/main` = `474ab20c3dfaa478f891aa4a90b96010eded55af` · 2026-08-02T18:20:43+02:00

> ⚠️ **Misma advertencia que en [SCRUM-252](SCRUM-252.md):** la hora es el `committer date` del
> primer commit del trabajo (`195200f`), **no** una lectura de reloj del instante de la medición.
> La sha se creó a las `2026-08-02T17:49:21+02:00`, así que la medición cae en esa ventana.
>
> **La sha no sale de memoria:** `git reflog` de la rama original dice
> `474ab20 … branch: Created from origin/main`.
>
> Esta rama se rebasó **cuatro veces** antes de mergear, así que la sha de sus commits actuales
> NO es contra la que se midió — decir aquella diría cuándo se rebasó, no contra qué se midió.
> Y el ticket citaba `0d45715`, que es la sha contra la que se midió **el hallazgo original de
> SCRUM-198**; al re-medir sobre `474ab20` el código se había movido y las líneas del ticket ya
> no valían.

## El defecto

Había **DOS constructores** del sobre `<sum:RegFactuSistemaFacturacion>` y solo uno estaba
demostrado conforme contra los XSD oficiales:

* `verifactu.service.ts` — el que **exporta el producto** (`exports.routes.ts:245` y `:543`),
  validado por `tests/scrum209-desglose-conforme.test.mjs`.
* `registro.builder.ts` — `buildRegFactuEnvelope`, «cuerpo del SOAP de S1-D». **Nadie validaba su
  salida.**

Es la forma exacta del defecto de [SCRUM-209](SCRUM-209.md) una capa más arriba: allí había dos
constructores del REGISTRO, el conforme no lo llamaba nadie, y la única validación XSD del repo
llevaba desde S1-C dando verde sobre el constructor equivocado.

## Lo que se midió ANTES de decidir, y cambió el arreglo

**Censo de llamadores** (dato del fundador, verificado contra `origin/main`, no contra el ticket
—el código se había movido y las líneas del ticket ya no valían—):

| Constructor | Llamadores en `src/` |
|---|---|
| `buildRegFactuEnvelope` | **CERO** (solo su test y `scripts/gen-registros-sample.mjs`) |
| el del servicio | **2** (`exports.routes.ts:245` y `:543`) |

El hit de `metrics.service.ts` era un comentario, no una llamada.

**Comparación byte a byte sobre las mismas entradas.** No idénticos —6426 vs 6464 bytes— pero las
diferencias eran **enteramente de formato**:

1. el del servicio lleva `<?xml version="1.0" encoding="UTF-8"?>`, el otro no;
2. sangra el registro con 4 espacios y mete una línea en blanco antes de cada
   `<sum:RegistroFactura>`; el otro sangra con 6 y no la mete;
3. termina en `\n`; el otro en `>`.

**Línea a línea, quitando sangría y líneas en blanco: `A === B` es TRUE.** Mismo contenido, mismo
orden, mismo namespace — `NS_SF` y `NS_INFO` resultaron ser **el mismo URI** con dos nombres en
dos ficheros.

**Y los dos validaban contra los XSD oficiales**, incluido el del SOAP de punta a punta con su
propio `buildRegistroAlta`.

> **El suelo se ganó el sueldo en esta misma medición.** La primera lectura del validador usaba
> `r.valid` cuando el contrato es `{valido, errores}`: `undefined` nunca es `false`, así que dio
> dos «VALIDA» que no significaban nada. Lo cazó el control negativo puesto ANTES —el validador
> rechaza tres inyecciones distintas—, no la suerte.

## La decisión: unificar, no retirar ni conservar dos

Si el contenido es idéntico y lo único que cambia es presentación, **no hay dos constructores: hay
uno con dos presentaciones, escrito dos veces**. No era un fallo latente, era una **divergencia
futura** — exactamente lo que ya ocurrió con el desglose entre S1-C y SCRUM-209.

* `construirSobreRegFactu` — único generador del contenido. Declaración XML, salto final y
  comentario son **parámetros de presentación**.
* `construirCuerpoSoapRegFactu` (antes `buildRegFactuEnvelope`) — la presentación sin declaración,
  **nombrada como lo que es**, con el motivo al lado: un cuerpo SOAP no admite declaración XML
  dentro, así que esa ausencia no es un descuido.
* El servicio pierde `NS_LR`/`NS_INFO`, que solo vivían para su sobre, y `MAX_REGISTROS` se unifica
  en `MAX_REGISTROS_POR_ENVIO`: era el mismo número del XSD escrito en dos ficheros.
* **`scripts/gen-registros-sample.mjs` concatenaba la declaración XML a mano** — el TERCER sitio
  del repo decidiendo cómo presentar el mismo sobre. No estaba en el ticket; salió al medir.

## Los casos límite: gana el camino de producción

Decisión del fundador. El cuerpo SOAP lanzaba `registros_fuera_de_rango` con 0 y con >1000, que era
una **tercera política para el mismo hecho**:

* **0 registros → `''`**, como la exportación desde [SCRUM-216](SCRUM-216.md). Un sobre con la
  cabecera sola es XML **inválido** (el XSD exige al menos un `RegistroFactura`), y entregar un
  fichero inválido es peor que no entregarlo.
* **>1000 → `verifactu_demasiados_registros:N`**, el mismo error y el mismo texto que la
  exportación, para que el día que S1-D trocee en varios envíos el motivo se lea igual en los dos
  caminos.

## La salida de producción no cambia ni un byte

Demostrado **ejecutando, no afirmando**: sha256 de la salida ANTES y DESPUÉS sobre **7 casos** —una
factura, dos, con anulación, con exclusión, todo excluido, rectificativa, sin destinatario—,
**idénticos los 7**. Con el control de que la comparación **sí ve** un cambio deliberado: al quitar
el salto final cambian 5 de 7 (los 2 que devuelven `xml: ''` no llegan al sobre).

⚠️ Esa comprobación fue **del PR** y está declarado en el código que **no** es un test permanente.
Un comentario que promete una red que no existe es peor que no ponerlo.

## Verificado en rojo

Tres inyecciones, cada una revertida:

1. un tercer constructor en `src/` → cae el guard, nombrando `fichero:línea`;
2. el sobre deja de emitir el NIF del obligado → caen **los dos** tests de XSD;
3. las presentaciones divergen en contenido → cae el de unificación.

## DoD cumplido

* Las **dos** presentaciones se validan contra los XSD oficiales **dentro de `npm test`**, no en una
  sonda de una vez.
* **Guard AST contra un TERCER constructor**, sobre todo `src/` y **sin lista de ficheros** —una
  lista se satisface dejando de enumerar (criterio de SCRUM-227)—, por NODOS y no por texto porque
  el fichero está lleno de la palabra que vigila (autorreferencia de SCRUM-233), con autoprueba que
  distingue un literal de una mención en comentario.
* El motivo de que haya una presentación o dos, escrito aquí y en el código.

## Ficheros

* `src/modules/fiscal/verifactu/registro.builder.ts`
* `src/modules/invoicing/domain/verifactu.service.ts`
* `scripts/gen-registros-sample.mjs`
* `tests/registroBuilder.test.mjs` (actualizado)
* `tests/scrum240-sobre-unico.test.mjs` (7)

Suite **1055, 0 fallos**.

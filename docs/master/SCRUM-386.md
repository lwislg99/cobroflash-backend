# SCRUM-386 · las hojas del albarán salen de `renderJobDetailView` — la última deuda de C2

**Fecha:** 6-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `4b4f30a6bcfb4ffd75694f781704865510336580` · 2026-08-06T12:57:30+02:00
**Tanda:** 1957 tests, 1890 pass, 0 fail, 67 skipped

> ✅ **COMPLETA.** Se paró con el diff delante antes de mover `openFacturarParcialSheet`, y el
> fundador dio el GO **corrigiendo la regla al darlo**: la 38 se mide **por FICHERO y por LADO**,
> no por nombre de función. El camino de emisión vive en el SERVIDOR (la ruta, `emitInvoice`,
> `applyVeriFactu`, el sellado); un fichero de `public/dashboard/js/` que hace un `apiRequest` es
> un **CLIENTE** del camino, no el camino. Las dos condiciones del GO —cuerpo byte-idéntico y la
> línea del `apiRequest` intacta— están **medidas, no leídas**.

## El defecto

Las dos hojas vivían ANIDADAS dentro de `renderJobDetailView`. Por eso la página del albarán
(SCRUM-302) no podía hacerlas: solo **navegar** hasta la fila del Trabajo, y la fila tenía que
conservar sus botones para no dejar callejones sin salida. C2 lo dejó escrito como deuda.

## La medición, ANTES de mover (AST, no grep)

Aquí es donde una mudanza se convierte en reescritura sin avisar: una función que capturaba cinco
cosas del ámbito y ahora recibe tres **no es la misma función**, aunque el diff parezca inocente.

| Función | Líneas | Captura del ámbito de la vista |
| --- | --- | --- |
| `openFacturarParcialSheet` | 121 | 2 — `setStatus`, `refresh` |
| `openAlbEditorSheet` | 45 | 1 — `buildAlbEditor` |
| `buildAlbEditor` | 339 | 4 — `cur`, `albTotalesJS`, `refresh`, `setStatus` |
| `albTotalesJS` | 10 | **0** — viaja sola |

**Hallazgo de alcance:** el ticket nombra dos funciones, pero `openAlbEditorSheet` no se puede
mover sin arrastrar `buildAlbEditor`, y **`buildAlbEditor` tiene DOS llamadores** — el segundo,
`openAlbCrearSheet`, no está en el ticket. Se queda anidado y solo pasa el contexto: adaptar una
llamada no es cambiar comportamiento.

## Cómo se garantiza que es mudanza y no reescritura

El contexto se recibe **desestructurado con los mismos nombres** (`const { cur, refresh, setStatus }
= ctx;`). Así el cuerpo no cambia ni un carácter, y eso se puede **comprobar comparando textos**
en vez de leyendo: las tres funciones movidas salieron IDÉNTICAS al original con la sangría
normalizada (10, 339 y 45 líneas).

## El guard mira el ÁMBITO, no el texto

Anidada y a nivel de módulo se escriben **igual salvo la sangría**, así que un guard de texto pasa
en verde en los dos casos. `tests/scrum386-hojas-fuera.test.mjs` usa un parser y comprueba **dos
cosas distintas que hacen falta las dos**:

1. que estén declaradas a nivel de módulo;
2. que **no capturen nada** del ámbito de la vista — se puede sacar una función y dejarla usando
   un nombre de fuera: entonces está «fuera» pero sigue **atada**, y llamarla desde otra pantalla
   revienta con un `ReferenceError`.

Más un SUELO: si el parser no ve al menos 8 funciones de módulo, falla — un guard que no encuentra
nada se lee igual que uno que pasa.

## Rojo por el mecanismo (por `$?`, uno a uno)

| Inyección | Resultado |
| --- | --- |
| `openAlbEditorSheet` vuelve DENTRO | exit 1 · «ha vuelto DENTRO de renderJobDetailView» |
| `buildAlbEditor` deja de recibir `cur` | exit 1 · «está fuera pero atada… ReferenceError» |
| «Editar líneas» deja de pasar el contexto | exit 1 · «esperaba DOS pasos de contexto y hay 1» |
| `openFacturarParcialSheet` vuelve DENTRO | exit 1 · «ha vuelto DENTRO de renderJobDetailView» |
| cambia la ruta `facturar-parcial` | exit 1 · «la llamada ha cambiado: esto ya no es una mudanza» |
| su llamador deja de pasar contexto | exit 1 · «no recibe su contexto del único llamador que tiene» |

**Y un guard mío nació malo:** el test de los llamadores buscaba la llamada entera con un regex
multilínea (`buildAlbEditor\(bodyEl,[^;]*?…`) y salía **roja con el código correcto**, porque
`[^;]*?` no puede cruzar los `;` del objeto de opciones. El fallo estaba en el instrumento, no en
lo medido — la misma clase de error que un `grep` apuntado a un fichero que no existe. Ahora se
cuentan los pasos de contexto, que es el hecho, y no la forma de escribirlos.

## Lo que NO hace, y no es olvido

No cablea la página del albarán para que las llame. **Qué botones quedan en la fila es decisión de
producto** y va en su ticket; aquí solo se garantiza que **ya se puede**. El guard lo declara en su
cabecera para que nadie lo dé por cubierto.

## Dos errores míos durante la verificación, porque son la lección

**① El `while` que se colgó.** La primera inyección buscaba la llave de cierre con
`while (l[j] !== '}') j++`, que corre hasta el infinito si nunca casa. La maté a los diez minutos.
**Un rojo que no llega a ejecutarse no demuestra nada** — es literalmente el defecto que llevamos
la semana cazando. Reescrito con rangos del AST, que son exactos y no dependen de encontrar un
carácter.

**② Inyecté rojos sobre trabajo SIN COMMITEAR, y `git checkout --` se lo llevó.** El movimiento de
`openFacturarParcialSheet` estaba hecho y verde, pero no commiteado; el `checkout` de restaurar la
inyección restauró desde el ÍNDICE y deshizo la mudanza entera. Se rehízo desde el original
guardado. **Es exactamente la regla que ya existía —comitear la corrección ANTES de inyectar el
siguiente rojo— y no la apliqué.** Queda escrito aquí porque el coste no fue el trabajo perdido
(era determinista y se rehízo), sino que los dos rojos siguientes corrieron contra un árbol que no
era el que yo creía: el de `ruta` dio el mensaje de `anidar`, y eso es un rojo que MIENTE.

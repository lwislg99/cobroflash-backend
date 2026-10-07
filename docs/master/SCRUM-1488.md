# SCRUM-1488 · El rango de Desplazamiento y Kilómetros del parte se decide una vez, en el servidor

**Medido contra:** `origin/main` = `85fad1ee5ef1f5ff0b9753783c300438d8c248dc` · 2026-10-07T06:50:31Z
A9: comprobación → `tests/scrum1488-rango-del-parte.test.mjs`

Carril S1 · sesión `s1-7oct` · rama `scrum-1488-rango-del-parte`. Toca `src/modules/jobs/domain/parteRango.ts` (nuevo), `partes.routes.ts` (sólo los dos campos del `PATCH /:id`), un censo en `scripts/` y su test. Sin esquema, sin pantalla.

## El defecto

`PATCH /admin/partes/:id` guardaba `-1` desplazamientos y `-5` kilómetros con un 200. El parte es un documento que el cliente firma.

## Lo decidido, y dónde está escrito

- **Rango:** los dos `>= 0`; Desplazamiento, entero. Orquestador, transcrito en el comentario 18531 del ticket.
- **Un código por causa** («y tres si el rango nuevo añade una») y **los `message` no necesitan firma** porque el panel no los pinta: SCRUM-1490, comentario 18536, punto 3.

## Lo construido

`parteRango.ts` tiene los dos lectores. La ruta ya no decide nada: llama al lector y, si no vale, contesta 400 con el código que el lector da.

| Campo | Causa | Código | ¿Nuevo? |
|---|---|---|---|
| `desplazamientos` | no es un número entero (`1.5`, `"dos"`) | `desplazamientos_invalido` | no |
| | negativo | `desplazamientos_negativo` | sí |
| | no cabe en la columna (`> 2147483647`) | `desplazamientos_no_cabe` | sí: antes salía como `_invalido` |
| `kilometros` | no es un número | `kilometros_invalido` | no |
| | negativo | `kilometros_negativo` | sí |
| | no cabe en `Decimal(10,2)` (`> 99999999.99`) | `kilometros_no_cabe` | sí: antes pasaba la ruta |

`desplazamientos_invalido` se queda con una sola causa. Es el código por el que la pantalla decide su texto (SCRUM-1491): con los negativos o los enormes dentro, ese texto habría dicho algo falso sin que nadie tocara su fichero.

Los dos `message` que existían no cambian. Los cuatro nuevos siguen su forma.

## El censo de escritores (aceptación 4)

`node scripts/_censo-rango-del-parte.mjs`, por AST sobre `src/`:

> población: 318 ficheros de src/ · 5 escrituras de parteTrabajo · 1 escriben desplazamientos o kilometros

| Escritura | Qué es | ¿Escribe los dos campos? |
|---|---|---|
| `partes.routes.ts` · `create` | alta del parte | no |
| `partes.routes.ts` · `update` (el `PATCH`) | editar la cabecera y las líneas | **sí, los dos, desde el lector** |
| `partes.routes.ts` · `update` (firma del técnico) | sello y firma | no |
| `partes.routes.ts` · `update` (firma del cliente) | sello y firma | no |
| `fusionClientes.ts` · `updateMany` | cambia el cliente | no |

Las 5 coinciden con las que da `git grep` de `parteTrabajo.(create|update|…)`. `parteTrabajo.ts:267` y `:313`, que el ticket dejaba sin abrir, no escriben en la base: construyen el contenido que se sella.

El test cae si una escritura de `ParteTrabajo` toca uno de los dos campos sin sacarlo de `leerDesplazamientos(…).valor` o `leerKilometros(…).valor`, y también si no puede saber qué campos escribe (spread, datos fabricados fuera, delegado en una variable, SQL en crudo que nombre la tabla). Si no encuentra ninguna escritura, lanza `CensoCiego`: no devuelve un cero.

## Medido

| | casos | pasan |
|---|---|---|
| El test contra el `dist` de antes (árbol `s1-1285e`, misma ruta que `main`) | 8 | **4** — caen los cuatro que miran la ruta y el lector; el control y los tres del censo pasan en los dos, porque el censo lee `src/` |
| El test contra este árbol | 8 | 8 |
| Mutantes del censo (12 formas de escribir los campos sin el lector) | 12 | caen los 12 |
| La ruta real con el lector quitado, campo a campo | 2 | caen los 2 |

Tanda dirigida (los ficheros de `tests/` que nombran el parte o enumeran `src/`, `scripts/` o `tests/`): ver el comentario de entrega del ticket, con su cifra.

Cuatro guards cayeron sobre la primera versión y se arregló el código: el arnés del test declara el rol con `reqDeSesion` (SCRUM-1344); el tope de kilómetros dejó de exportarse, porque sólo lo usaba el test (SCRUM-411); el censo lanza en vez de devolver `medido: false`, que el censo de suelos no sabía leer (SCRUM-775).

## Lo que NO está medido o queda nombrado

- **En yaqu.app:** nada todavía; no está desplegado al escribir esto.
- **Qué hace Postgres con unos kilómetros que no caben.** El tope sale de leer el tipo de la columna, no de ejecutarlo contra una base.
- **Kilómetros con más de dos decimales** (`12.345`): la ruta los deja pasar y la columna redondea. No se ha tocado.
- **La coerción** sigue siendo `Number(…)`, como antes: `""` entra como `0` y `true` como `1`. La pantalla manda número o `null`.
- **Partes que ya tengan un negativo guardado:** no se consulta la base de producción. Por pantalla, la cuenta QA sólo ve los suyos.
- **Mitad de S4, nombrada (`parteDetailView.js`, no la toco):** el `min="0"` de las dos casillas, con este mismo rango; y qué texto pinta ante los cuatro códigos nuevos. Hoy caen en el general («No se ha podido guardar el cambio — vuelve a intentarlo»), que manda a repetir algo que no va a entrar. Un texto por causa es texto que ve el profesional: pide firma.

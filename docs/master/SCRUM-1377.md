# SCRUM-1377 · El censo de fecha sin zona medía la casa de `typescript`, no el árbol

**Medido contra:** `origin/main` = `8995084a0b7be02ec89c0aaa1d7eb3958ec89283` · 2026-10-01T13:32:21Z

A9: comprobación → `tests/scrum1093h-censo-fecha-sin-zona.test.mjs`

Carril S3 (instrumentos). Por encargo del orquestador (punto 2 del relevo del 1-oct).

## El defecto

PASO 0, corrido en un worktree nuevo cuyo `node_modules` es una junction al de otro worktree:

    ARBOL  = D:\MILLONARIO\cobroFlash\wt-s3-censo-raiz
    RAIZ   = D:\MILLONARIO\cobroFlash\wt-s3-1179c2
    POBLACION ficheros = 312 · filas = 0
    EXIT=0

Dos causas en `scripts/_censo-fecha-sin-zona.mjs`, las dos necesarias:

1. `RAIZ` salía de `require.resolve('typescript/package.json')` subiendo dos carpetas. Node resuelve
   la junction a su destino, así que la raíz era el árbol dueño del `node_modules`, no el medido.
2. `programaDe` y `censarPrograma` usaban esa `RAIZ` global aunque `censar(raiz)` recibiera otra. Los
   312 ficheros se nombraban como `../wt-…/src/…`, ninguno empezaba por `src/` y se descartaban todos.

En CI no ocurre (el `node_modules` es del propio árbol). En local son siete worktrees de S3 los que
cuelgan por junction, y la tanda dirigida de SCRUM-1363 ya había dado 3 rojos de `scrum1093h` que no
eran de la rama.

## El arreglo

| Pieza | Qué cambia |
|---|---|
| `RAIZ` | Sale de la ruta del propio fichero (`scripts/..`): el árbol donde vive el censo. |
| `raizMedible(raiz)` | Nueva. Exige `tsconfig.json` y alguna de las `CARPETAS`; si no, LANZA. |
| `programaDe(ficheros, overrides, raiz)` | Tercer parámetro. Lee el `tsconfig.json` de ESA raíz y lanza si no se puede leer (antes seguía con las opciones por defecto del compilador, sin decirlo). |
| `censarPrograma(program, solo, raiz)` | Tercer parámetro. Si algún fichero pedido cae fuera de la raíz, LANZA. |
| `censar(raiz)` | Pasa su raíz a las dos anteriores, lanza con población 0 y devuelve también `raiz`. |

`USO` y `RETIRADAS` no se tocan: el censo sobre el árbol real da las mismas filas que antes.

## Probado en ROJO

Commit del arreglo antes de mutar: `371507754dbcb28b11c7d9fbe43dd7096f6935a9`. Cada mutante con su
`git diff --numstat` (3 líneas cambiadas en los dos) y restaurado con `git restore --source=HEAD`.

| Mutante | Qué deshace | Caen |
|---|---|---|
| M1 | `censar()` no pasa su raíz y el fichero fuera de raíz no lanza (el comportamiento de antes) | 3 de 21: los tests 18, 20 y 21 |
| M2 | las tres comprobaciones de «no pude determinar la raíz» dejan de lanzar | 1 de 21: el test 20 |

Sin mutar, en el worktree con junction: 21 tests, 21 pasan, 0 fallan, 0 saltados.

## Lo que NO está visto

- El test «la raíz por defecto es el árbol donde vive el censo» sólo puede caer donde `typescript`
  viva en otro árbol. En CI no distingue el arreglo del defecto. Lo que lo sostiene allí es el árbol
  fabricado de los tests 18 y 21, que es la misma situación vista desde el otro lado.
- No se ha corrido la tanda completa en local (la memoria no da: 2.151 MB libres). El juez es el CI.

## Error propio

La primera versión llamaba a `ts.readConfigFile` con la ruta en `\`. Con un `tsconfig.json` roto,
TypeScript revienta en un «Debug Failure» al adjuntar el error, y ese mensaje tapaba el motivo real.
Lo cazó el caso del `tsconfig.json` roto del test 20, que esperaba «no pude leer». Corregido pasando
la ruta con `/`; el caso se queda en el test.

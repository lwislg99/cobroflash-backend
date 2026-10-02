# SCRUM-1412 · `tanda:dirigida` nombra lo que cuenta, aparta lo que no es tuyo y se corre por tramos

**Medido contra:** `origin/main` = `2ca4053d` (rama salida de ahí) · 2026-10-02T12:10Z

A9: comprobación → `tests/scrum1412-tanda-por-tramos.test.mjs`

Carril S3 (instrumentos). Por encargo del orquestador (punto 4 del relevo del 2-oct).

## Lo que se vio usándola

| Defecto | Causa, medida | Arreglo |
|---|---|---|
| Dijo «2 fail» y nombró uno. | `# fail` cuenta también los caídos ANIDADOS (un subtest que cae tumba a su padre: son dos) y sólo se recogían los `not ok` de primer nivel. Reproducido con un test de dos niveles: `# fail 2`, un `not ok` sin sangrar. | Se nombran a cualquier profundidad. Si aun así el TAP cuenta más de los que se nombran, sale «NO SUPE NOMBRAR k de los n» y es rojo. |
| `scrum1321 · PUERTA 1b` cae siempre en esta máquina. | El test crea su fichero en el temporal (`C:`) y lo alcanza con una ruta relativa a la raíz (`D:`): no se alcanza, y el propio test se declara CIEGO con un assert. Cuatro puestos lo pagaron el 1-oct; S3, otra vez, el 2-oct en SCRUM-1367. | `scripts/_ciegos-por-entorno-declarados.json`: nombre exacto + condición. La condición se MIDE en la máquina (`temporal-en-otra-unidad`). Si se cumple, sale aparte como «ciego por entorno, no es tu cambio» y no decide la salida. Si no se cumple (el CI, o una máquina con todo en la misma unidad), es un rojo normal. |
| Pasa de diez minutos y se va sola al fondo; viva y muerta se ven igual. | Sin progreso y sin forma de trocearla. | Una línea al TERMINAR cada lote. `--tramo i/n`, cada tramo en su comando. Con más de 150 ficheros y sin `--tramo`, propone en cuántos trocear. |

## Cómo se usa por tramos

    node scripts/tests-que-cubren.mjs --lanzar --tramo 1/4      (y 2/4, 3/4, 4/4: cada uno en SU comando)
    node scripts/tests-que-cubren.mjs --resumen-de 4            (sólo lee: qué tramos se han visto)

Cada tramo apunta su resultado FUERA del árbol (`<temporal>/yaqu-dirigida-tramos/<huella>/`). La
huella es la selección, el número de tramos y el árbol (commit, lo cambiado y lo sin seguir, con su
contenido). El veredicto de la pasada exige los n tramos de la MISMA huella:

- falta uno → `CIEGO` (salida 2), aunque lo visto esté en verde;
- se toca un fichero entre dos tramos → otra huella: a la pasada nueva le faltan los anteriores;
- con los n vistos, el último tramo da el veredicto de la pasada entera y borra el registro.

## Lo que NO se ha construido, dicho

- **La estimación de tiempo.** Sólo valía si salía de `duration_ms` medidos por fichero, y el TAP de
  una tanda no dice de qué fichero es cada test: no hay de dónde sacarla. Se imprime lo que TARDÓ
  cada lote y la suma de lo ya corrido, con la palabra «medidos». Un test lo fija.
- Los tramos son trozos iguales en número de ficheros, no en tiempo: «cada tramo por debajo de diez
  minutos» no lo garantiza la herramienta, lo decide quien elige n. Medido el 2-oct en esta máquina,
  con concurrencia 2: cuatro tramos de 57 ficheros tardaron 107, 162, 136 y 115 s.
- Si un proceso muere a mitad de una pasada por tramos, su registro se queda en el temporal hasta
  que alguien complete esa misma pasada. No se limpia solo.

## Un borde, declarado

Nombrar a cualquier profundidad casa también una línea `not ok N - …` que venga DENTRO del mensaje
de un fallo (un test que lanza otra tanda y pega su TAP en el assert). Sólo puede añadir un nombre
de más a una pasada que ya tiene un rojo: nunca esconde uno.

## Verificación

- `node --test tests/scrum1412-tanda-por-tramos.test.mjs`: 14 tests, 14 pass, 0 fail, 0 skip.
- Mutación (base sin mutar verde antes y después): 5 de 5 mutaciones tumban el test que nombran.
- Usada sobre sí misma: ver el comentario de entrega del ticket.

## Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| 1. Si el TAP dice N caídos y sólo se nombran K, la salida lo dice | `tests/scrum1412-tanda-por-tramos.test.mjs` (los dos «①») |
| 2. Un ciego por entorno con la condición medida sale aparte y no decide; sin la condición, rojo normal | mismo test (los cuatro «②») |
| 3. Una línea por lote al terminar | mismo test («③») |
| 4. `--tramo i/n`; el resumen exige los n del mismo árbol, o CIEGO | mismo test (los seis «④») |
| 5. Ninguna estimación que no salga de una medida | mismo test («⑤») |

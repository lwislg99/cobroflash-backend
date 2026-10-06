# SCRUM-1415 · El punto ciego de la señal por nombres: censado, reducido y sin poder crecer

**Medido contra:** `origin/main` = `a096c7faf486e7ca4332c16f95344dc06220bbab` · 2026-10-02T12:13Z

A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`

Carril S3 (tests · bancos · instrumentación). Por encargo del orquestador (punto 1 del relevo del 2-oct).

## El hueco

La señal por nombres de SCRUM-1339d (`scripts/_senal-de-nombres.mjs`, equipo de Javier) compara los
nombres LITERALES que el árbol declara contra los del TAP. Una llamada `test(…)` de nombre construido
no tiene literal: si la tanda la pierde, no lo ve nadie. En `exp-1384`, de 55 casos perdidos la señal
nombró 39; los otros 16 eran de éstos (SCRUM-1339, comentario 18125).

No se construye otro detector ni se toca `ci.yml`, el suelo ni `--test-force-exit` (decisión del
orquestador del 2-oct). Esto reduce lo que 1339d no puede ver, y le pone tamaño.

## Población

Con `llamadasDeclaradas` del propio módulo de 1339d, sobre `tests/*.test.mjs`:

| | ficheros | llamadas `test()`/`it()` | literales | de nombre construido | en ficheros |
|---|---|---|---|---|---|
| `origin/main` a096c7fa (antes) | 1.207 | 9.705 | 9.588 | **117** | 66 |
| esta rama (después) | 1.208 | 9.783 | 9.688 | **95** | 56 |

- 117 y 95 son SITIOS de llamada, no casos: una llamada en un bucle registra un caso por fila.
- De los 22 sitios convertidos salían **94 casos** (82 de bucle + 12 sueltos): son los que pasan a
  ser visibles para la señal. Las llamadas suben 72 porque 10 sitios de bucle pasan a ser 82 líneas.
- El fichero de más es este guard, con sus 6 casos.

## Lo que entra

1. `tests/_casos-escritos.mjs` — `casosEscritos(tabla, nombreDe, cuerpo)`: un `test('<literal>', caso(i))`
   por fila. Cada caso compara su nombre escrito con el que sale de su fila; `caso.todos()` LANZA al
   cargar si una fila se queda sin caso (no registra un caso nuevo). `nombreEscrito(t, construido)`
   para un caso suelto cuyo nombre lleva un dato dentro.
2. **11 ficheros convertidos.** Los tres que perdieron casos de nombre construido en `exp-1384`
   (`scrum524b`, `scrum888g`, `scrum1262`: 10 bucles, 82 casos) y las 12 llamadas sueltas de
   `scrum716c`, `scrum774`, `scrum942` (concatenación o `String.raw`: mismo nombre, ahora literal) y
   `scrum1270`, `scrum1350`, `scrum1380`, `scrum564`, `scrum600` (una constante dentro del nombre).
   Sólo cambia la FORMA de declarar los casos, no lo que comprueban.
3. `tests/scrum1415-nombres-construidos.test.mjs` — el censo, con su población impresa, y el
   trinquete de dos mitades contra `DECLARADAS` (56 ficheros, 95 llamadas, una entrada por línea).

## Antes y después, corriendo cada fichero tocado

`node --test` de cada fichero por separado, nombres registrados leídos con `leerTap` de 1339d y
comparados como CONJUNTO (con multiplicidad), no como recuento:

| fichero | casos antes | casos después | conjunto de nombres |
|---|---|---|---|
| `scrum524b-trinquete-de-la-tabla` | 41 | 41 | idéntico |
| `scrum888g-senal-en-la-firma` | 28 | 28 | idéntico |
| `scrum1262-la-baja-corta-todas-las-vias` | 35 | 35 | idéntico |
| `scrum716c-la-memoria-del-vigia` | 9 | 9 | idéntico |
| `scrum774-arbol-de-otra-sesion` | 11 | 11 | idéntico |
| `scrum942-bytes-de-control-en-el-arbol` | 12 | 12 | idéntico |
| `scrum1270-pr-mudo-avisado-en-el-pr` | 7 | 7 | idéntico |
| `scrum1350-latido` | 35 | 35 | idéntico |
| `scrum1380-suelo-corrio-y-no-reporto` | 6 | 6 | idéntico |
| `scrum564-afirmaciones-publicadas` | 12 | 12 | idéntico |
| `scrum600-un-solo-front-documento` | 14 | 14 | idéntico |

11 comparados, 0 distintos; los 11 con `fail 0` antes y después. Los literales no se teclearon: los
generó un script a partir del TAP de ANTES (`ok N - <nombre>`, en orden), así que un nombre mal
copiado no era posible; lo que sí podía fallar —el orden de las filas— lo comprueba cada caso.

## El guard, visto en ROJO

Árbol comiteado entero antes de inyectar (`8b362610485abdd8ac4cf2d1e01d163dc80c50eb`); base sin
inyectar: `tests 5 · pass 5 · fail 0`.

| mitad | inyección real | `git diff --numstat` | resultado |
|---|---|---|---|
| ① una construida nueva | un bucle con `test(\`… ${n}\`)` al final de `scrum1380-…` | `4 0` | exit 1 · `pass 4 · fail 1` · «tests/scrum1380-suelo-corrio-y-no-reporto.test.mjs: 1 de nombre construido (líneas 88) y la lista declara 0» |
| ② la lista por encima del árbol | la llamada de `scrum1166-…` pasada a literal sin tocar la lista | `1 1` | exit 1 · `pass 4 · fail 1` · «tests/scrum1166-detalle-quote-tiene-numero.test.mjs: la lista declara 1 y el árbol tiene 0» |

Restaurado con `git restore --source=HEAD --staged --worktree`; `git status --porcelain` vacío y
`pass 5 · fail 0` otra vez. Las dos mitades quedan además como casos PERMANENTES del guard con un
fuente fabricado, y `casosEscritos` tiene el suyo (nombre que se separa de la fila; fila sin caso).

## Lo que queda, y dónde

Las 95 restantes se clasificaron por AST (de qué itera el bucle que envuelve a cada llamada): 92 un
array escrito en el propio fichero, 2 un `Object.entries(…)` de un objeto del fichero, 1 una tabla
que llega por desestructuración. **Ninguna depende de un dato que sólo exista al ejecutar: «no
convertibles» = 0**, a falta de mirar a mano esas 3. Casos en ejecución que salen de ellas: al menos
355 (suma de longitudes de las tablas, sin correrlos).

Convertirlas no cabía en un día ni en un PR (56 ficheros de varios carriles; bucles con varios
`test()` dentro, anidados, o con `{ skip }`): **SCRUM-1416**, con su aceptación.

## Errores propios

- El ticket nació diciendo que habría una clase «no convertible» (nombres que dependen de un dato de
  ejecución). Era una suposición a ojo sobre la lista; medido, son 0. Por eso la lista no tiene
  ninguna entrada con ese motivo, y el guard no finge que las hay.
- Dos horas escritas en Jira sin leerlas de GitHub (comentario 18129 de SCRUM-1415 y la cabecera de
  SCRUM-1416 dicen ~12:15Z y ~13:00Z; por la cabecera `Date:` eran ~12:06Z y ~12:12Z). Corregido en
  un comentario de cada ticket.

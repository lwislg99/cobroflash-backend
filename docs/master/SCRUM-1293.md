# SCRUM-1293 · Opción B: las listas de los censos de marcadores, a un JSON declarado

**Rama:** `scrum-1293-listas-de-marcadores-a-json` · **Carril:** S3 · instrumentos (s3-29e la empezó, s3-1oct la cierra)
**Medido contra:** `origin/main` = `fe5b3c18f038eb5c1200b8c067ed69d0bfda0898` · 2026-10-01T10:44:58Z

A9: aviso → cicatriz S3 «Maté `meta:mutaciones` a medias y dejó una mutación suya sin restaurar en el árbol.» — no se pudo comprobar: el diario que lo impide está diseñado en SCRUM-1349 y todavía no está construido

## Para qué

Retirar un marcador `[PENDIENTE` cuyo texto ya está firmado obligaba a editar un test (`scrum402`,
`scrum667` o `scrum650d`), y ese cambio se parece a borrar una prueba: el clasificador de permisos lo
bloqueaba y 14 textos firmados el 25-sep llevaban una semana sin llegar a pantalla. Ahora las LISTAS
viven en un fichero de datos y las ASERCIONES siguen en los tests, sin tocar. Retirar un marcador
firmado es quitar una línea de `scripts/_marcadores-pendientes-declarados.json`.

## Qué cambia

| fichero | qué |
|---|---|
| `scripts/_marcadores-pendientes-declarados.json` | las tres listas: `panel` (10 ficheros), `servidor` (9), `papel` (1 constante) |
| `tests/_marcadores-declarados.mjs` | el cargador. Sale en ROJO si no puede leer, si falta una sección, si viene vacía, si un número no es un entero mayor que 0, o si una clave está repetida |
| `tests/scrum402-marcador-no-se-pinta.test.mjs` | `CENSO` sale de `.panel`. R4 y R4b sin tocar. La historia de cada entrada se queda escrita en el test |
| `tests/scrum667-marcador-visible.test.mjs` | `CENSO_SERVIDOR` sale de `.servidor` y `EN_EL_PAPEL` de `.papel`. Aserciones sin tocar |
| `tests/scrum650d-pantalla-asignar.test.mjs` | el `1` de la igualdad sale de `.panel['jobAsignados.js'] ?? 0`. Misma igualdad exacta |
| `tests/scrum1293-cargador-de-marcadores.test.mjs` | nuevo: 2 controles positivos y 16 formas de «no supe leer», cada una con el motivo que tiene que nombrar |

**Medido antes de conectar:** el JSON coincide con las listas vivas de `main` (10 / 9 / 1, cero
diferencias, cero claves repetidas). Ninguno de los 326 commits que entraron desde el 29-sep tocó los
tres tests ni el JSON.

## Lo que los cinco pasos del 29-sep no preveían: cuatro guards leían la lista como TEXTO

Al conectar los tres tests cayeron otros dos, y un tercero se quedó mudo. Los cuatro leían la lista
mirando el fuente de `scrum402` o `scrum667`, no la lista:

| guard | qué hacía | qué pasó al mover la lista | arreglo |
|---|---|---|---|
| `scrum591` · `declaradosEn402()` | buscaba por AST el literal `CENSO` en el fuente de scrum402 | ROJO («GUARD CIEGO») | lee del cargador |
| `scrum755` · «ninguno está DESNUDO» | troceaba `const CENSO = Object.freeze({` del texto | ROJO («sólo leo 0 entradas») | lee las claves del cargador; su suelo no cambia |
| `scrum903` · registro del papel | `/MARCADOR_MICROCOPY_DESGLOSE/.test(<texto de scrum667>)` | **VERDE y MUDO**: casaba con el comentario de historia, así que quitar la entrada de la lista no lo tumbaba | mira la lista (`Object.hasOwn(.papel, …)`) |
| `scrum751` · sus dos mutaciones declaradas | anclaban en `'jobAsignados.js': 1,` y `'settingsView.js': 1,` dentro de scrum402 | `meta:mutaciones` las dio CIEGAS (medido) | realojadas en `CENSO_HEREDADO` de SCRUM-644, la misma forma del incidente; la del JSON real la declara ahora `scrum1293` |

En los cuatro cambia SOLO de dónde sale el dato. Los dos primeros cayeron bien cerrados. El tercero es
el que importa: pasaba por la razón equivocada y nadie lo habría mirado.

`scrum714:73` (`/const CENSO = /`) sigue casando y sigue valiendo: comprueba que el fichero publica
una cifra, no cuál.

## Probado en ROJO

23 mutaciones, cada una aplicada, corrida, exigida en rojo y restaurada byte a byte. Con su BASE sin
mutar en verde antes (8 bases).

- **Los tres censos siguen cazando lo mismo** (14): marcador sin declarar en `public/dashboard/js/`
  → R4 y R4b; uno de más en un fichero declarado → R4; marcador sin declarar en `src/` → trinquete de
  667; entrada quitada del JSON → cae; entrada subida sin marcador → cae («el trinquete no aprieta»);
  constante de más en `papel` → cae; `MARCA_ASIGNADOS` retirada, o un literal de más, o
  `jobAsignados.js` fuera del JSON → 650d; clave repetida o JSON ausente → los tres caen en la carga.
- **Los cuatro guards hermanos** (9): 591 con una entrada inventada y con el JSON ausente; 755 al
  salir una entrada conocida y con el JSON ausente; **903, control positivo: la entrada del papel
  cambia de nombre en el JSON y cae** (antes de este arreglo no caía); las dos mutaciones de 751
  sobre SCRUM-644; la clave repetida en el JSON real contra `scrum1293`.
- **El cargador** (16 casos del test nuevo) y sus dos mutaciones declaradas, ejecutadas por
  `meta:mutaciones` (las dos caen).

## «R4c» no era un test: era un nombre

`scrum402` dice «Que no vuelva a colarse lo vigila **R4c**» (claves repetidas en `CENSO`), y no hay
ningún R4c en el repo. No es un resto de algo retirado ni un caso sin construir: el MISMO commit que
escribió la frase (`83d993bf`, SCRUM-751, 5-sep-2026) construyó el guard con otro nombre,
`tests/scrum751-clave-duplicada-en-silencio.test.mjs` + `tests/_claves-duplicadas.mjs`, y sigue vivo.
La frase no se ha borrado: lleva la explicación al lado. Desde hoy las claves repetidas de ESTE censo
las caza el cargador.

## Lo que se corrió

14 ficheros —los de `tests/` que nombran a los tres tests, al JSON o al cargador, más `scrum644`,
`scrum273` y `scrum854`—, con la rama ya fusionada con `main`: **127 tests, 127 pass, 0 fallos, 0
saltos**. `meta:mutaciones` se corrió hasta `scrum754` y
se paró a mano (tarda más de 40 min); al pararlo dejó una mutación suya sin restaurar en
`public/dashboard/js/homeView.js`, vista en `git status` y devuelta con `git checkout`. NO se corrió
`npm test` entero (SCRUM-1244: en esta máquina revienta por memoria): el veredicto completo es el del CI.

## Lo que queda fuera

Construir los 14 textos firmados: es de S4, y ya puede hacerlo quitando líneas del JSON.

# SCRUM-1544 · El censo de anclajes por línea sólo veía la cita escrita ENTERA en un literal: ahora ve también la troceada, y lo que sigue sin ver está declarado y sembrado

**Medido contra:** `origin/main` = `f3090b1c30afc9352ff80326e047ec73747d1bf7` · 2026-10-13T13:24:18Z

A9: comprobación → `tests/scrum710b-anclaje-por-identidad.test.mjs`

Sesión `jv-j6l`, puesto J6. Carril: SCRUM-1544 no lleva etiqueta de equipo ni de área, y
`node scripts/carriles.mjs de` dice «sin fila en §3: nadie lo reclama» para los dos ficheros que se
tocan (`tests/_censo-por-posicion.mjs` y `tests/scrum710b-anclaje-por-identidad.test.mjs`); el
control, `src/app.ts`, sí sale con dueño (S1). No se toca ningún workflow, ni `src/`, ni el esquema.

## En corto

- **Troceadas a propósito, como la del 13-oct, HOY hay 0.** El hueco existía y nadie lo había
  pisado hasta esa mañana.
- **El límite existe, visto corriendo.** Con el censo de antes, sobre el commit del esquive
  (`5b46be141`), el censo halla 0; sobre el anterior (`1b827185f`), 3.
- **Se ENSANCHA lo que sale gratis y se DECLARA el resto.** Decide el falso positivo medido: 0 con
  todas las piezas escritas, 33 de 33 en cuanto una pieza es un nombre.
- **Había 3 citas que nadie troceó y el censo no veía**: enteras, dentro de un trozo de plantilla
  con huecos.

## ① El límite, confirmado con siembra

`docs/master/evidencias/SCRUM-1544/medir.mjs`. Raíz fabricada en el temporal, una cita por
fichero, 8 formas. Antes de preguntar al censo se importa cada fichero y se comprueba que su valor,
ya en ejecución, es la cita: entró en 8 de 8.

| forma | censo de ANTES | censo de DESPUÉS |
|---|---|---|
| entera entre comillas | VE | VE |
| entera en plantilla sin huecos | VE | VE |
| `[…].join(':')` | no | VE |
| sumada (`'f' + ':' + 12`) | no | VE |
| plantilla con el número en un hueco | no | VE |
| entera en plantilla con un hueco al lado | no | VE |
| la línea en una constante | no | no |
| los dos puntos por código de carácter | no | no |

El caso real, sacado de git a una raíz fabricada (`tests/scrum1537-los-dos-cotejos.test.mjs`):

| commit | censo de ANTES | censo de DESPUÉS |
|---|---|---|
| `1b827185f` (tres citas enteras) | 3 | 3 |
| `5b46be141` (las mismas, troceadas por `claude[bot]`) | **0** | **1** |

Sale 1 y no 3 porque el esquive escribe la cita una vez, en una función que se llama tres veces.
Con el censo de después el trinquete habría caído igual («declarados 0, hay 1»).

Salidas: `medicion-ANTES.txt` (con `censo-ANTES.mjs`, copia del censo de `origin/main`) y
`medicion-DESPUES.txt`.

## ② Cuántas hay hoy

Población: **1.795 ficheros** de `tests/` y `scripts/` (`.mjs`, `.js`, `.ts`: los que lee el
censo), **25.167 expresiones que arman texto** (plantilla con huecos, suma, `join` de una lista
escrita). Otros 36 ficheros de esas dos carpetas no los lee el censo por su extensión (23 `.json`,
2 `.cjs` y otros).

| clase | cuántas | qué son, leídas una a una |
|---|---|---|
| A · fichero y línea ESCRITOS, repartidos en piezas | 3 en 3 ficheros | las 3 son citas enteras dentro de un trozo de plantilla; ninguna está troceada a propósito |
| B · fichero escrito, línea en un hueco | 7 en 6 ficheros | las 7 son mensajes con la línea MEDIDA (`l.linea`, `i + 1`): lo que el censo recomienda |
| C · fichero en un hueco, número escrito | 26 en 14 ficheros | ninguna es una cita: puertos, razones de contraste, horas |
| D · fichero y línea en huecos | 406 en 237 ficheros | sin leer una a una |
| expresión regular con `fichero:número` escrito | 7 en 7 sitios | sin clasificar; varias comparan contra un mensaje fabricado por el propio test |
| cita entera a una extensión que el censo no reconoce | 0 | — |

Cruce con una segunda sonda: el censo de antes halla 44 y el de después 47 sobre los mismos 1.795
ficheros. La diferencia, 3, es la clase A.

## ③ Qué se hizo: ensanchar lo gratis, declarar el resto

**Ensanchado** (`tests/_censo-por-posicion.mjs`): una expresión que arma texto se lee entera, con
las piezas escritas en su sitio y un hueco donde hay un nombre o una llamada. Así salen la cita
troceada con todas sus piezas escritas y la que va entera en un trozo de plantilla. Coste medido: 0
falsos positivos sobre 25.167 expresiones; 3 hallazgos nuevos, que ya estaban y se declaran en
`CONOCIDOS_A` con su motivo (`scripts/_banco-lista.mjs`, `tests/scrum398-…`, `tests/scrum403-…`).
No se ha tocado ninguno de esos tres ficheros.

**Declarado** (`LIMITE_DE_LA_CITA_ARMADA`, en el mismo censo): las dos listas, `ve` (6 formas) y
`noVe` (4: línea en una constante, fichero en una constante, dos puntos por código, expresión
regular), con motivo, quién la retira y su prueba. No se ensancha ahí porque las clases B y C dan
33 de 33 falsos positivos: contarlas llenaría la lista de ruido hasta que alguien la apagara.

**La prueba** vive en `tests/scrum710b-anclaje-por-identidad.test.mjs`, que es el único fichero que
el censo no se cuenta a sí mismo, con 10 siembras fabricadas y tres casos nuevos:

1. cada siembra ES la cita en ejecución, y lo declarado y lo sembrado son la misma lista;
2. las 6 formas de `ve` se ven;
3. las 4 de `noVe` no se ven, con la entera al lado como positivo. Si un día se ven, cae con el
   aviso de pasarlas de lista: es quien retira la declaración.

Y el rojo del trinquete dice ahora que trocear la cita no la arregla.

## Visto en ROJO

- Antes de escribir el arreglo: 11 de 12, cae el caso 2 con las 4 formas que el censo no veía.
- Con el censo ensanchado y la lista sin tocar: 11 de 12, cae «no crecen» con los 3 que ya estaban.
- Cinco mutaciones declaradas con el código quieto, tras un commit de todo el árbol
  (`mutaciones.mjs`, salida en `mutaciones-salida.txt`): base 12 de 12, y las 5 mueren en el caso
  que se dijo antes de correr. El árbol queda igual por sha256.

## ④ Qué impide que la próxima ejecución de `@claude` haga lo mismo con otro censo

**Nada que se haya encontrado.** Lo que hay: la regla 41 escrita (la ejecución del 13-oct la tenía
delante), y este censo, que ahora ve esa forma concreta. Lo que no hay: ningún mecanismo que mire
si un commit que pone verde a un instrumento ha cambiado lo vigilado o sólo la forma de escribirlo.
Lo cazó una sesión leyendo el commit, con el auto-merge armado. **No medido:** qué disparó a
`claude[bot]`, y qué hace `scripts/puerta-claude.mjs` (no se ha abierto). No se construye nada
contra el bot: es decisión del fundador.

## Lo que NO se ha medido

- La tanda completa y `guards:entrada`: sólo `scrum710b`, `scrum237`, `scrum976`, `scrum1294`,
  `scrum267` y `scrum812`.
- Las 406 de la clase D y las 7 expresiones regulares, una a una.
- Si los OTROS censos de la casa (los `tests/_censo-*`) tienen el mismo hueco.
- Ramas sin mergear: una cita troceada o en plantilla en un PR abierto caerá al mergear con esto.
- Los 2 `.cjs` de `tests/` y `scripts/`, que el censo no lee.

## De paso

`tests/_censo-por-posicion.mjs` y `docs/master/evidencias/scrum1500/cotejo.cjs` son dos
instrumentos del check obligatorio que no tienen fila en §3 de `docs/equipo/dos-equipos.md`.

## Error propio

El primer barrido dio 2 en la clase A y eran 3: descartaba la expresión entera en cuanto una pieza
llevaba ya una cita, y `scrum403` lleva una entera y otra en la plantilla de al lado. Lo destapó la
segunda sonda (el censo ensanchado dio 3 en el trinquete). Lo sujeta desde ahora la entrada de
`scrum403` en `CONOCIDOS_A`: si el censo vuelve a descartar así, cae «la lista no se pudre». Ese
positivo es del árbol, no sembrado.

---

## SCRUM-1544b · El obligatorio de la rama anterior cayó por UNA cifra con la fecha en la línea de arriba: se le pone la fecha en su línea

**Medido contra:** `origin/main` = `1d338a5ae8afa6166282c28e7a8c818c5375a856` · 2026-10-14T01:51:15Z (hora de GitHub)

A9: comprobación → `tests/scrum737-cifra-con-arbol-y-hora.test.mjs`

Sesión `jv-j6b`, puesto J6. Rama `scrum-1544b-el-rojo-de-737`, que lleva dentro, por merge, la
rama `scrum-1544-el-censo-ast-declarado` @ `a11e382cf42f8399d654960c3db229c0dab97f3a` entera
(PR #2387) y la sustituye. Carril: el ticket sigue sin etiquetas y los ficheros que se tocan
(`tests/scrum710b-anclaje-por-identidad.test.mjs` y este registro) salen «sin fila en §3» y «quien
trabaja el ticket» en `node scripts/carriles.mjs de`.

### Qué caía

El obligatorio de #2387 (job `115322791197`, sobre `a11e382cf`), leído entero: 1.856.680 bytes y
15.382 líneas. La tanda declara **11.275 tests = 11.185 en verde + 1 caído + 89 saltados**, y la
suma cuadra. El caído es uno: «SCRUM-737 · el censo de cifras SIN ancla no crece, y si baja hay
que anotarlo», con 82 donde el censo congelado dice 81.

Reproducido en local antes de tocar: sobre `origin/main`, `scrum737` da 5 de 5; con la rama
anterior mergeada, 4 de 5 y el mismo mensaje. La cifra nueva es una y está en
`tests/scrum710b-anclaje-por-identidad.test.mjs`, en el comentario que explica las tres entradas
nuevas de `CONOCIDOS_A`: el número de ficheros del cruce entre el censo de antes y el de después.

### Por qué caía, y por qué el guard tenía razón

La cifra SÍ tenía fecha, pero en la línea de encima: el paréntesis abría con la fecha al final de
una línea y el número caía en la siguiente. `tests/_cifras-sin-ancla.mjs` juzga línea a línea, así
que vio un recuento del árbol sin su hora. Y acierta en el fondo: esa cifra ya no es la de hoy.
Vuelto a correr `docs/master/evidencias/SCRUM-1544/medir.mjs` sobre este árbol, con `main`
mergeado, el barrido lee 1.811 ficheros y no los 1.795 del 13-oct-2026. Un número que cambia en
un día es justo el que necesita la fecha pegada.

### El arreglo, y por qué no es un esquive

Tres líneas de comentario redistribuidas, en el mismo sitio y sin mover ninguna otra línea del
fichero: la fecha y la cifra quedan en la MISMA línea. Es el escalón ④ de la jerarquía que el
propio guard imprime (anclar con fecha). No se ha tocado `tests/scrum737-…`, ni
`tests/_cifras-sin-ancla.mjs`, ni `CENSO_CONGELADO`, que sigue en 81.

No es la versión equivalente del esquive del 13-oct porque allí lo vigilado seguía igual y sólo
cambiaba la forma de escribirlo para que el censo no lo viera. Aquí el censo sigue viendo la
cifra (el número y su unidad están enteros, en un comentario, en un fichero de su población) y lo
que ha cambiado es lo vigilado: ahora la cifra lleva su hora donde se lee. Los otros dos caminos
que ponían el verde se descartaron: partir el número o cambiarle la unidad lo esconde, y subir el
congelado a 82 es editar el guard.

### Lo de la rama anterior sigue haciendo lo suyo

- `tests/scrum710b-anclaje-por-identidad.test.mjs`: 12 de 12, con los tres casos «SCRUM-1544».
- El control que no puede morir, visto corriendo y no deducido: `medir.mjs` sobre el commit del
  esquive (`5b46be141`) sacado de git a una raíz fabricada. El censo halla 1, y 3 sobre el
  anterior (`1b827185f`). La siembra, 6 de 8 vistas y el veneno dentro en 8 de 8. La salida es
  idéntica a `medicion-DESPUES.txt` salvo en las cifras del barrido del árbol, que se han movido
  con `main`.

### De paso

- `tests/_cifras-sin-ancla.mjs` lee un número con punto de millar por su cola: de «1.795» ve
  «795». No cambia ningún veredicto (la cifra se caza igual), pero el detalle que imprime el rojo
  enseña un número que no está escrito así. No se ha tocado: es el guard.
- La pregunta del orquestador sobre los otros dos PR en rojo (#2382 y #2377): **no son los tres
  la misma cosa.** `scrum737` sólo lee `tests/*.mjs` y `scripts/*.mjs`, sin bajar a carpetas: los
  guiones de `docs/master/evidencias/` quedan fuera de su población, y lo que cayó aquí fue el
  comentario de un guard. Los otros dos censos sí recorren el árbol entero, evidencias incluidas
  (leído en `tests/scrum622-…` y `scripts/_censo-mkdtemp.mjs`, no corrido), y #2377 sólo añade
  guiones de evidencia aparte de su registro. Que a ésos dos los tumbe un guion de evidencia es
  una lectura, no una medición: no se han abierto sus logs.

### Lo que NO se ha medido

- La tanda completa y `guards:entrada` en local: este árbol no tiene `dist`. Lo corrido es lo de
  arriba y los guards de suite que se nombran en la entrega.
- El obligatorio de esta rama, al escribir esto.
- Los logs de #2382 y #2377.

### Errores propios

- Medí el contexto al final y no en los dos puntos que pedía el encargo (tras el arranque y tras
  leer el ticket). Las cifras de esos dos puntos salen del registro de la sesión, leídas después.
- El primer intento de bajar el log salió vacío y con código 1: llamé sin la opción que el
  encargo avisaba que hacía falta. Lo vi por el tamaño (0 bytes) antes de leer nada.
- Mi primer recuento de casos en verde por símbolo dio 26 de más sobre lo declarado. Eran 4
  líneas de otros pasos del job y 22 que escriben los propios tests; contando sólo las que acaban
  en su duración, dentro del tramo de la tanda, salen las 11.185 declaradas.

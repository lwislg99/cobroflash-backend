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

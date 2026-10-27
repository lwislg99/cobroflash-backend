# SCRUM-1537 · Los dos cotejos de la Parte L: el límite de la flecha existía y se quitó; el del literal se declara

**Medido contra:** `origin/main` = `254a697924c99bdf85eb06c95ee439a4a013aa67` · 2026-10-13T12:06:04Z (hora de GitHub)

A9: comprobación → `tests/scrum1537-los-dos-cotejos.test.mjs`

Sesión `jv-j6h`, puesto J6. La entrega entera, con sus tablas y lo que NO se midió, está en Jira:
SCRUM-1537, comentario 19364. Aquí va lo que hace falta sin abrir Jira.

## En corto

- **④ No hay tercer cotejo.** `grep -i cotejo` en `scripts/`, `tests/` y `src/` da 8 ficheros; en los 47
  `tests/_censo-*`, 0. Sólo `cotejo.cjs` y `cotejo-once.cjs` leen la Parte L.
- **① El límite de la flecha de `cotejo-once.cjs` EXISTÍA**, medido con valores sembrados en memoria sobre
  los 7 campos que lee en modo flechas: sin flecha, visto en 0 de 7; con flecha, en 7 de 7.
- **③ `cotejo-once.cjs` está al día y no se retira:** su población son los 11 estados que `cotejo.cjs`
  nombra y no coteja. Ahora lee los valores sin flecha, sus positivos son sembrados y coteja
  `Merchant.status` y `EmailMessage.status`. Sobre `main` pasó de EXIT=2 («INSTRUMENTO NO FIABLE» desde
  el merge de SCRUM-1529c, porque su positivo era un defecto del árbol que ese día se arregló) a EXIT=0.
- **② El límite del literal de `cotejo.cjs` se DECLARA** (`LIMITE_DEL_LITERAL`, con motivo, quién lo
  retira y prueba). De 8 formas de escribir sembradas ve 3, avisa de 2 y calla ante 3. Las 2 de las que
  avisa pasan a ser hallazgo (`ESCRITURA_SIN_LEER`) en los campos sin cierre, que son 3 de 19.

## Lo que queda nombrado y no se tocó

Son decisiones de estado o del esquema, no de este ticket: `Merchant.subscriptionStatus` (el máster manda
`trial` y `expired` sin fuente en el código), `Charge.status` (`cancelled`, decisión ⑥b), el comentario de
`WhatsAppMessage.status` en el esquema (no nombra `received`) y `VfSubmission.status` (sin máquina).

## Lo que no se midió

La tanda completa; si alguna de las 4 escrituras opacas sobre los delegados de los 3 campos sin cierre
escribe de verdad el campo; las transiciones; y un valor del máster sin flecha escrito con más de una
palabra entre las comillas, que `cotejo-once.cjs` cuenta como «sin leer» y no coteja.

## Errores propios

- Crucé los 200k de contexto sin avisar en el punto: medí a 131k y la medida siguiente fue 232k.
- Declaré dos veces `sinLeer` dentro de `juzgar`: el instrumento no cargaba y cayeron los 20 casos. Lo
  cazó la primera pasada del test, antes de cualquier commit con ese cambio.
- Un parche de `siembra-literal.cjs` lanzado por consola falló a medias y la medición corrió con la
  versión anterior; rehecho con la herramienta de edición y vuelto a correr.

## Cómo se repite

    node docs/master/evidencias/SCRUM-1537/siembra-once.cjs
    node docs/master/evidencias/SCRUM-1537/siembra-literal.cjs
    node docs/master/evidencias/SCRUM-1537/escrituras-opacas.cjs
    node docs/master/evidencias/scrum1500c/cotejo-once.cjs
    node --test tests/scrum1537-los-dos-cotejos.test.mjs

Las salidas `*-ANTES.txt` de esa carpeta son del instrumento sin tocar, sobre `254a69792`.

## SCRUM-1537b · El obligatorio de la rama estaba en ROJO, y el aviso ya dice que no es tu código

**Medido contra:** `origin/main` = `9308125e7c7885fb9568fcd633ad8dc1fa021eba` · 2026-10-13T12:59:02Z (hora de GitHub)

A9: comprobación → `tests/scrum710b-anclaje-por-identidad.test.mjs`

Sesión `jv-j6k`, puesto J6. Rama `scrum-1537b-el-aviso-se-explica`, que lleva DENTRO (por merge) la
rama `scrum-1537-los-dos-cotejos` @ `1b827185fc2724e682498d92f4cd87ece46225d9` entera. **Esta rama
SUPERA al PR #2380: aquél no se mergea.** Cerrarlo es del orquestador.

### ① Qué decía el obligatorio de #2380

ROJO, y del cambio. Job «build + tests (con banco desechable)» `115295643243`: log de 1.823.594 B,
sin «TANDA SIN VEREDICTO»; `tests 11240` = `pass 11150` + `fail 1` + `skipped 89`. El único que cae:
`tests/scrum710b-anclaje-por-identidad.test.mjs` («los anclajes por NÚMERO DE LÍNEA no crecen»), que
nombra a `tests/scrum1537-los-dos-cotejos.test.mjs` con tres citas de fichero y línea a un
`src/sembrado.ts` escrito a mano («declarados 0, hay 3»). No es la carrera de SCRUM-1539. Los demás
jobs de ese commit: zona roja, navegador, trinquete y meta-guard, en verde (el meta-guard acabó a las
12:59Z; a las 12:52Z seguía corriendo).

### ② El arreglo: se cita por identidad, y el guard no se toca

Las tres escrituras ya no se escriben a mano. Salen del propio instrumento, que las lee de la raíz
sembrada (`siembra-literal.cjs`, forma «funcion»): el test comprueba que es la llamada `calcula()` de
`src/escribe.ts` y no mira en qué línea cae. `siembra-literal.cjs` devuelve ahora también
`noLiterales` de cada forma; su salida impresa no cambia. Después: scrum710b 9 de 9.

Y el test sigue cayendo donde debía. Base sin mutar 6 de 6; cuatro mutaciones de UNA línea en
`cotejo.cjs`, cada una con su `git diff --numstat` «1 1» y restaurada (árbol limpio después):

| mutación | caen |
|---|---|
| el juicio deja de nombrar la escritura sin leer | 2 de 6 |
| un `null` cuenta como escritura que esconde un valor | 1 de 6 |
| el cierre deja de eximir al campo | 1 de 6 |
| el aviso pierde la frase nueva | 1 de 6 |

### ③ La frase del aviso `ESCRITURA_SIN_LEER`

Visto en rojo antes de escribirla (5 de 6). El aviso dice ahora que el rojo **no es un defecto del
código de quien lo recibe**, sino un límite declarado del instrumento (`LIMITE_DEL_LITERAL`, con la
ruta del fichero), que no busque el fallo en su línea, y qué hacer: poner en `cierre` de ESE campo,
en la tabla `CAMPOS`, la constante o el validador que enumera sus valores. No cambia qué se detecta:
sobre el árbol sigue dando 0 hallazgos de esa clase. De paso se rehízo la última frase («Dale un
cierre…») para que nombre el campo y el fichero: es más que la frase pedida, y se dice.

### Lo que no se midió

La tanda completa y `guards:entrada` en esta máquina: sólo 7 ficheros (el del ticket, scrum1500,
scrum710b, scrum237, scrum976, scrum1294 y scrum267), 66 de 66. El obligatorio de ESTA rama. Si un campo sin
cierre tiene de verdad una constante o un validador que declarar: el aviso dice dónde se pone, no que
exista. Las salidas `*-DESPUES.txt` de la carpeta de evidencias no se regeneraron: su primera línea
lleva el sha256 de `cotejo.cjs` de antes de la frase, y es lo único que cambiaría (comparado).

### De paso

`node scripts/carriles.mjs de docs/master/evidencias/scrum1500/cotejo.cjs` responde «sin fila en §3:
nadie lo reclama». Es un instrumento que corre en la tanda obligatoria y no tiene dueño.

### Errores propios

- El primer parche del test, lanzado por consola, perdió todas las barras invertidas de tres
  expresiones regulares y el fichero no cargaba. Lo cazó la primera pasada del test, sin commit por
  medio; rehecho con la herramienta de edición. La causa exacta no la comprobé.
- La primera pasada de mutaciones dio el código de salida pero los recuentos vacíos (mi lector no
  casaba con la salida); no la di por buena y la repetí hasta tener base y población.

### Lo que pasó en #2380 mientras tanto

A las 12:54:39Z `claude[bot]` empujó a la rama de #2380 el commit
`5b46be141fb56fbd4f133eff3e98cdee432383ce`, que arma la misma cita de fichero y línea en ejecución
para que el censo de scrum710b no la vea. Eso deja el guard en verde sin dejar de citar por posición.
Ese commit está mergeado dentro de esta rama (para que no choque si #2380 llegara a entrar) y en el
test se queda la versión de ②: la escritura que saca el instrumento, comprobada por lo que es.

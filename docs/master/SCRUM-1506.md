# SCRUM-1506 · la cerradura de carril y los nombres `jv-jN`: medido, NO construido (Sesión 5)

**Medido contra:** `origin/main` = `310721d211be7cdd081003dc02ed987e582d7426` · 2026-10-15T16:25:54Z (`Date:` de GitHub; la sonda corrió ~10 min después)

A9: sin fallo que generalice — sólo medición; el defecto de la tanda (registros sin línea A9) va dicho en el de SCRUM-1494, con su comprobación.

**Sólo medición.** El ticket lleva `decision-jefe`, y el orquestador de Luis lo encargó así: «mide qué falta y PARA».

Sonda: `docs/master/evidencias/SCRUM-1506/sonda-nombre-y-mesa.mjs <árbol>`. EJECUTA `puestoDeNombre` de
`scripts/_carriles.mjs` e `identidad()` de `.claude/hooks/carril.mjs` (importarlo no corre su `principal`: va bajo
la guarda `process.argv[1]`). Las mesas, en temporales fuera del árbol. `POBLACION=16 nombres · EXIT=0`.

## ① Por qué `jv-jN` no resuelve

| nombre | `puestoDeNombre` |
|---|---|
| `jv-j1` … `jv-j6` | **`null` los seis** |
| `j6-x`, `puesto-j6` (control) | `J6` |
| `cobroflash-backend-90`, `""` | `null` |

Las expresiones aceptan `j<N>-…` y `puesto-j<N>`. En `jv-j6` el `j` del puesto va DESPUÉS del prefijo `jv-`, así que
no casa ninguna. El defecto está en la forma del nombre, como dijo J6.

## ② A quién afecta

| nombre | `puestoDeNombre` |
|---|---|
| `sesion-0`, `sesion-1`, `sesion-5`, `s5-15oct` | `S0`, `S1`, `S5`, `S5` |
| `orquestador` | `ORQ` |

Los nombres del equipo de Luis resuelven todos. **Pero el nombre no es la única sonda.** `identidad()` lee antes la
MESA (`.yaqu-puesto.json` de la carpeta de arranque):

| nombre | mesa | `puesto` que usa la cerradura |
|---|---|---|
| `jv-j6` | ninguna | **`null` → el hook sale sin mirar** |
| `jv-j6` | `{puesto: J6, nombre: jv-j6}` | `J6` |
| `jv-j6` | `{puesto: J6}` (sin nombre) | `J6` |
| `sesion-5` | ninguna | `S5` |

**Con mesa, la cerradura SÍ reconoce a una sesión `jv-jN`.** `sesion.mjs` escribe esa mesa al lanzar
(`carriles.mjs mesa <PUESTO> <mesa> --nombre <nombre>`, `sesion.mjs:829`), pero sólo si la instalación tiene
`config.mesas` (`sesion.mjs:701`: «sin `config.mesas` todo sigue como antes»). **El hueco medido es: una sesión `jv-jN`
lanzada SIN mesa.**

**No lo he podido mirar:** si la instalación de Javier tiene `mesas`. Vive en su `config.json`, en su máquina. Es la
pregunta que decide si hoy le afecta a alguna sesión de verdad o sólo a las lanzadas a mano.

## ④ Desde cuándo

Las dos expresiones de `puestoDeNombre` y el hook nacieron juntos en `ed27499f6` (29-sep-2026, SCRUM-1295) y no han
cambiado (`git log -S"puesto-j([1-6])" -- scripts/_carriles.mjs`). Es un límite que nació así, no una avería con fecha.

## ③ Lo que falta, y de quién es (no se construye aquí)

| pieza | fichero | dueño |
|---|---|---|
| que `puestoDeNombre` resuelva `<prefijo>jN` | `scripts/_carriles.mjs` | **S0** (fila de SCRUM-1295 en `dos-equipos.md`) |
| que un puesto que no resuelve sea ERROR y no permiso | `.claude/hooks/carril.mjs` (`if (!fichero \|\| !id.puesto …) return;`) | **fundador** (`.claude/*`, regla 36) |
| que toda sesión del equipo arranque con mesa | `config.mesas` de cada instalación (lo pide `sesion.mjs`) | quien instala; el interruptor es de cada jefe |

La primera arregla el caso de hoy. La segunda arregla la familia, y para a quien hoy no tiene identidad (el hook ya
tiene ese modo: `--exigir-identidad`). La tercera es la que no cambia código. Elegir es `decision-jefe`.

Y lo que dijo J4 en el comentario 18864 sigue en pie y es de la misma familia: la cerradura también sale sin mirar
cuando el FICHERO no tiene fila (5.118 de 5.795 aquel día). No lo he vuelto a medir.

## SCRUM-1506b · re-medida del 2-nov: la cerradura tampoco para al equipo de Luis (S5)

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T20:08:53Z (hora de GitHub; las sondas corrieron ~15 min después)

A9: sin fallo que generalice — sólo medición, no se construye nada (`decision-jefe`)

Lo de arriba (15-oct) medía la LÓGICA del hook. Esta vez se mide si el hook CORRE en las sesiones de verdad.

### ① La lógica, ejecutando el hook como proceso

Sonda: `docs/master/evidencias/SCRUM-1506/sonda-hook-como-proceso.mjs <árbol>`. Lanza `.claude/hooks/carril.mjs` del
árbol con un stdin de PreToolUse (`Edit`), un transcript sembrado con el nombre y la carpeta de arranque (con o sin
mesa), todo en temporales fuera del árbol. Los dueños salen del mapa (`.claude/carriles.json`), no supuestos.
Salida entera en `salida-2026-11-02.txt`. **POBLACION=26 casos.**

| nombre | sin mesa, fichero AJENO | sin mesa, fichero PROPIO |
|---|---|---|
| `sesion-5`, `s5-2nov`, `sesion-1`, `sesion-2` | **PARA** (exit 2) | deja (exit 0) |
| `j6-x` (control de J6) | **PARA** | — |
| `jv-j1`, `jv-j6` | **deja** (exit 0) los tres ficheros | — |
| sin nombre | **deja** | — |
| `jv-j6` con mesa J6 · `sesion-5` con mesa S5 | **PARA** | — |

O sea: igual que el 15-oct. **La lógica para a los nombres del equipo de Luis y a `jv-jN` con mesa; deja pasar a
`jv-jN` sin mesa.**

### ② 🔴 El control de verdad: una sesión real de Luis, editando un fichero de otro puesto, NO fue parada

Esta sesión se llama `sesion-5` (transcript: `{"type":"agent-name","agentName":"sesion-5"}`). Edité con la
herramienta `Edit` `src/core/cron/cron.ts` (dueño **S1** según el mapa), en mi árbol desechable `wt-s5-2nov-1621`,
añadiendo una línea de comentario. **La edición entró: ningún hook la paró.** La deshice con otro `Edit` y comprobé
el árbol limpio (`git status --short` vacío); no se commiteó ni se empujó.

**Por qué:** el hook se carga de la carpeta de ARRANQUE de la sesión, y esta sesión arrancó en el checkout
compartido `D:\MILLONARIO\cobroFlash\cobroflash-backend`. Ese checkout está en `e4ea95e5a` (22-sep-2026, 4.998
commits por detrás de `main`):

- su `.claude/settings.json` sólo cablea `guard-dangerous.sh` (no nombra `carril`);
- `.claude/hooks/carril.mjs` **no existe** allí;
- el hook nació el 29-sep (`ed27499f6`), y `merge-base --is-ancestor ed27499f6 HEAD` del compartido da 1: **no ha
  estado nunca** en ese checkout.

### ③ A cuántas sesiones afecta

Carpetas de proyecto de Claude Code con transcripts de los últimos 14 días (el nombre de la carpeta sale del cwd de
arranque):

| carpeta de arranque | transcripts | nombres |
|---|---|---|
| el checkout compartido | 67 | `sesion-0` 14 · `sesion-4` 13 · `sesion-5` 12 · `sesion-3` 9 · `sesion-1` 8 · `sesion-2` 7 · 4 ajenos |
| worktrees `.claude/worktrees/s*-…` | 1 cada uno | — |

**63 sesiones de los seis puestos de Luis arrancaron en 14 días donde la cerradura no está cableada.** El
lanzador sin `config.mesas` arranca en `config.repo` (`scripts/equipo/sesion.mjs:862-866`, veredicto `SIN-MESA`),
que en esta máquina es el compartido. **No he podido mirar** la `config.json` instalada del lanzador (no la
encontré buscando la copia de 81.772 B bajo el perfil); la deducción sale de los transcripts, no de la config.
Tampoco he podido mirar la máquina de Javier.

### ④ Lo que cambia respecto al 15-oct

La pregunta del ticket era si la cerradura protegía a un equipo y no al otro. **Medido hoy: en esta máquina no
protege a ninguno.** La lógica distingue nombres, pero el hook no corre donde arrancan las sesiones. Las tres
salidas del tramo de arriba (③) siguen siendo las que hay, y se añade una cuarta, previa a las tres: **que el hook
esté cableado en la carpeta donde arranca cada sesión** (mesa con árbol al día, o el compartido al día). Sin eso,
cualquiera de las otras tres arregla un hook que no se ejecuta. Elegir sigue siendo `decision-jefe`: no se
construye aquí.

## SCRUM-1506c · pieza ②: `puestoDeNombre` lee `jv-jN` por su forma (S5, 17-nov)

**Medido contra:** `origin/main` = `340b084d485421188a546a6f0323a52fb456b1a6` · 2026-11-17T16:01Z (cabecera `Date` de GitHub)

A9: sin fallo que generalice — encargo literal de S0 (SCRUM-1506 c.21966), test con rojo primero y mutaciones en el catálogo.

**Decisión:** S0, SCRUM-1506 c.21966 («SÍ, y SIN esperar a ①»). `scripts/_carriles.mjs` es carril S0; el cambio lo hace
S5 por ese encargo. **No toca** `.claude/hooks/carril.mjs` ni `.claude/settings.json` (la pieza ③, fail-closed, sigue
siendo del fundador; la ①, cablear el hook, sigue siendo de los jefes, c.21944).

**Qué cambia:** `puestoDeNombre` acepta `^jv-j([1-6])(?:[a-z]{1,3}|-[a-z0-9-]+)?$` → `J<N>`. Va detrás de las dos
expresiones que ya había y delante de `orquestador`; el nombre de la mesa sigue ganando, porque esa comprobación va
antes que todas.

**Test:** `tests/scrum1506c-jv-jn-por-su-forma.test.mjs`, 5 casos. Sobre main: **4 rojos y 1 verde** (el ② de
negativos, que ya era verde porque antes todo `jv-j…` daba null). Con el cambio: 5/5 verdes, y `scrum1295-carriles` 8/8.
- ① positivos: `jv-j1`…`jv-j6`, `jv-j4g`, `jv-j6ar`, `jv-j2ay`, `jv-j1bb`, `JV-J3CF ` (mayúsculas y espacio), `jv-j5-prueba-1`.
- ② negativos → null: `jv-j9z` (el caso de SCRUM-1549), `jv-j0`, `jv-j7`, `jv-j12`, `jv-j4abcd`, `jv-j`, `jv-orquestador`, `xjv-j1`, `jv-j1_`.
- ③ lo de antes, igual: `j6-x`→J6, `puesto-j3`→J3, `sesion-5`→S5, `s1-14oct`→S1, `orquestador`→ORQ, `cobroflash-backend-57`→null; y con mesa, el nombre de la mesa gana.
- ④ POR EFECTO, con el hook ejecutado como proceso y SIN mesa: `jv-j1` pasa en un fichero de J1 y se para en uno de S2 («es de S2 … tú eres J1»).
- ⑤ `carriles.mjs mesa J1|J4|J6 --nombre jv-j1|jv-j4g|jv-j6ar` → salida 0, la mesa lleva puesto y nombre. **Control:** `mesa J4 --nombre jv-j3` → salida 2, «dice J3 por su forma y la mesa es de J4».

**Mutaciones** (en `MUTACIONES_QUE_ME_TUMBAN` del test, el catálogo del meta-guard). Ejecutadas a mano, una a una, con
restauración verificada byte a byte: quitar la expresión tumba ①; ensancharla a `^jv-j(\d)` tumba ②. **2 de 2 vivas.**

### La tabla de SCRUM-1549, re-pasada

`docs/master/evidencias/SCRUM-1549/controles.mjs` ejecutado contra este árbol con el `_carriles.mjs` de main y con el
nuevo. Salida de los dos en `docs/master/evidencias/SCRUM-1506/controles-1549-antes-y-despues-2026-11-17.txt`.
**Cambian 3 líneas de 38, y las tres son `jv-j4g` sin mesa.**

| tabla de `SCRUM-1549.md` | fila | antes | ahora |
|---|---|---|---|
| §1 «Por forma de nombre» | `jv-jN…` (329) | caen todos | **pasan** los que tienen N de 1 a 6 y hasta 3 letras de cola. No lo he podido recontar: la población es de la máquina de Javier |
| §1 «Vivas» | `jv-j3g` sin mesa | CAE | **pasa como J3** (deducido de la función, no re-medido en vivo) |
| §2 «Luis» | todas | — | sin cambio (`controles.mjs`: los 10 nombres de Luis, iguales) |
| §3 «Una mesa sella cualquier nombre» | — / `jv-j4g` | null · cae | **J4 · pasa como J4** (medido) |
| §3 | J4/`jv-j4g` con nombre `jv-j9z` | null · pasa como J4 | sin cambio (`jv-j9z` sigue sin ser un puesto) |
| §3 | resto de filas | — | sin cambio (medido) |
| §3, texto | «`puestoDeNombre('jv-j1')` → null también» | null | **J1**: los nombres que la puerta permite ya pasan por su forma |

🔴 **Lo que se vuelve más estricto, y es para el equipo J:** una sesión `jv-jM` sentada en una mesa de **otro** J
(`.yaqu-puesto.json` de J4 con la sesión `jv-j3x`) antes pasaba como J4, porque su nombre no decía nada. **Ahora
su nombre dice J3, y la cerradura para por DISCREPANCIA**, que no tiene interruptor por variable. Hoy no afecta a
nadie, porque el hook no está cableado donde arrancan las sesiones (c.21944, pieza ①). Cuando lo esté, una mesa
reutilizada por otro puesto J dejará de funcionar en silencio. Es lo que la cabecera de `textoMesa` llama «la
discrepancia ES el dato». No lo he podido mirar: si en la máquina de Javier se reutilizan mesas entre puestos.

**Sin medir:** la población real de nombres del equipo J (vive en su máquina) y si su lanzador acepta los relevos
`jv-jN<letras>` (SCRUM-1549 §3 midió que la puerta solo acepta `jv-j1`…`jv-j6`).

## SCRUM-1506d · pieza ③: la cerradura FALLA CERRADA (S5, 24-nov)

**Medido contra:** `origin/main` = `2db8e1c8be5c289fb2643de9e211d29b2ab6f949` · 2026-11-24T16:01:02Z

A9: aviso → A10 «Un SHA que no has leído de un comando no es un SHA: es una cadena con forma de SHA, y el que lo recibe no puede distinguirla.» — no se pudo comprobar: no hay guard que pueda ver un SHA tecleado en un SendMessage. En la entrega de esta pieza mandé al orquestador una punta «2ee6d2c0…» que no había leído de ningún comando, y la corregí con la real cinco minutos después.

**Decisión:** SCRUM-1506 c.22577, citada en el encargo del orquestador (`cobroflash-backend-41`, 24-nov). Yo no la he
leído en Jira. El sufijo `c` ya lo tenía #3191 (mergeado), así que esto va como **`d`**.

**PASO 0, hoy:** la premisa del encargo («`puestoDeNombre('jv-j6')` da null») **ya no se cumple**: da `J6` desde
1506c. Medido: `jv-j6`→J6, `jv-j1-foo`→J1, `sesion-5`→S5, `cobroflash-backend-41`→null, null/''→null. Lo que sí
seguía vivo es el hueco de la pieza ③: `carril.mjs` hacía `if (!fichero || !id.puesto || …) return;`, de modo que
**cualquier identidad desconocida** (como `cobroflash-backend-41`, `jv-j9z` o una sesión sin nombre) editaba sin
que nadie mirara. Además, un error dentro del hook salía con **1**, y Claude Code sólo bloquea con 2.

**Qué cambia en `.claude/hooks/carril.mjs`.** Afecta sólo a las EDICIONES de un fichero **dentro del repo**:
- sin identidad → salida 2, `⛔ SIN IDENTIDAD`, y el mensaje dice cómo identificarse por el nombre (`/rename`,
  con las formas válidas) o por la mesa (`.yaqu-puesto.json`, `carriles.mjs mesa`);
- mesa rota (`.yaqu-puesto.json` ilegible o inválido) → salida 2, aunque el nombre sea válido. Antes se usaba el
  nombre y se pasaba;
- un error de `principal()` → salida 2 con `NO-PUDE-MIRAR`, no 1.

**Lo que sigue igual:** leer (el matcher sólo cubre Edit, Write, NotebookEdit y MultiEdit), editar fuera del repo
(la memoria, los temporales), `orquestador`, y `--exigir-identidad`, que sigue sin estar armado.

**Test:** `tests/scrum1506d-cerradura-falla-cerrada.test.mjs`, 5 casos, con el hook ejecutado como proceso. Sobre
main: **3 rojos (①②③) y 2 verdes (④⑤, los controles)**. Con el cambio: 5/5.
- ④ **controles positivos, la red:** cada puesto con fila edita un fichero SUYO, sacado del mapa y no supuesto, y
  pasa. **Población: 11 puestos** (J1 J2 J3 J5 J6 S0 S1 S2 S3 S4 S5; J4 no tiene ninguna fila en
  `carriles.json`). Pasan también la mesa S3 con su nombre, la mesa S2 sin `nombre` con `sesion-2`, el
  `orquestador`, y, sin identidad, leer y editar fuera del repo.
- `tests/scrum1295-carriles.test.mjs`: el caso que AFIRMABA lo contrario («sin --exigir-identidad no se para a
  nadie») pasa a pedir 2, y además pide que leer siga dando 0. Esa línea era la decisión de antes, y la de
  c.22577 la sustituye. Con eso 1295 sale 8/8, 1506c 5/5 y 1298b 8/8.

Mutaciones: catálogo → tests/scrum1506d-cerradura-falla-cerrada.test.mjs

Las corrí a mano una a una: primero la base sin mutar (5 ok) y restaurando cada vez. **3 de 3 vivas**: quitar el
bloqueo sin identidad tumba ①, quitar el de la mesa rota tumba ② y relanzar el error tumba ③.

🔴 **A quién puede parar, medido en `ListAgents` el 24-nov a las ~16:00Z:** `sesion-1`…`sesion-5` resuelven por su
nombre, y `mesa-s3` y `mesa-s5` tienen una mesa válida. **`cobroflash-backend-41` (el orquestador) da null:
cuando su carpeta de arranque tenga este hook al día, NO podrá editar el repo** hasta que haga `/rename
orquestador` o arranque desde una mesa ORQ. Como el hook se lee del disco en cada llamada, el cambio llega a una
sesión viva en cuanto su carpeta de arranque se actualiza, sin relanzarla. El checkout compartido (`e4ea95e5a`)
no cablea el hook (1506b ②), así que a quien arranca ahí no le cambia nada. Tampoco he podido mirar la máquina
de Javier.

**Fuera de alcance (no se toca aquí):** los ficheros SIN fila (`tests/**`, por ejemplo) siguen libres para
cualquier identidad conocida; es lo que dijo J4 en c.18864. Y el cableado del hook donde arrancan las sesiones
sigue siendo la pieza ① (c.21944).

### Apéndice del 24-nov (S5, relevo): ratificación del cambio de aserción en `scrum1295`

**Medido contra:** `origin/main` = `db0a6c04541c258eda6499e1088cf16db9f1836b` · 2026-11-24T17:55:57Z

A9: sin fallo que generalice — sólo registro: copia literal de una autorización, sin código.

El cambio de 1506d en `tests/scrum1295-carriles.test.mjs` (el caso que afirmaba «sin --exigir-identidad no se para
a nadie» pasa a pedir 2) es un cambio de una exigencia existente en un fichero de S0. Lo autoriza el orquestador
(`cobroflash-backend-41`) a posteriori, de forma nominal. **Localizador:** SendMessage del orquestador a
`sesion-5`, 24-nov-2026 ~18:05 hora local, msg_id `b86be85c-f21e-4b2c-b615-fdd351b71afe`, que repitió literal al
relevo de S5 el mismo día. Copia literal:

> «scrum1295: tu cambio de aserción queda RATIFICADO POST-HOC como autorización nominal mía — la exigencia vieja
> («sin --exigir-identidad no se para a nadie») AFIRMABA el defecto, y la decisión firmada c.22577 la vuelca; copia
> esta ratificación literal a docs/master/SCRUM-1506.md citándome.»

**Lo que NO entra aquí:** la excepción del orquestador en `puestoDeNombre` (`cobroflash-backend-<número>` → ORQ).
Hoy se encargó como 1506e y el mismo orquestador la descartó antes de que se empujara: si el orquestador queda
exento de la cerradura, y cómo, lo decide el fundador (y el acuerdo entre los dos jefes que pide 1506), no él. MI
LECTURA, que le pasé antes del descarte: con ese patrón, cualquier sesión que arranque sin `/rename` se llama
`cobroflash-backend-N` y saldría de la cerradura, no sólo el orquestador.

**Cómo se cerró:** el fundador renombró al orquestador con `/rename orquestador`, que es el camino que la cerradura
ya prevé (`puestoDeNombre('orquestador')` → ORQ desde SCRUM-1295). Lo comunicó el orquestador a S5 el 24-nov por
SendMessage («elige el fundador, opción 1»). No cambia nada en el código: `cobroflash-backend-<n>` sigue dando
null. El trabajo de 1506e queda en un commit local de S5 que no se ha empujado (`ecf4d7ec2`, rama local
`scrum-1506e-excepcion-orquestador`).

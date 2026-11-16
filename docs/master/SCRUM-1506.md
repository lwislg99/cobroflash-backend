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

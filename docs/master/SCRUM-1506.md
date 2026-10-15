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

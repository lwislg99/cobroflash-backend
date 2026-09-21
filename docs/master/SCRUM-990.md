# SCRUM-990 · el lanzador del equipo no pasaba modelo: toda sesión de fondo sale con `--model sonnet`

**Fecha:** 21-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `5820ad9259054032ef0966c8101288b9f76e8248` · 2026-09-21T11:02:10Z (cabecera `Date` de GitHub; la hora de la máquina va ~5,5 min por delante)
**Rama:** `scrum-990-modelo-sonnet` · **Worktree:** `s5-modelo-sonnet`

> ⛔ `src/` y `public/` intactos · sin estado ni flag nuevos · sin dependencias · no se toca la configuración
> de Claude Code · no se toca `C:\Users\Admin\AppData\Local\yaqu-equipo` ni `schtasks`: sólo se LEYERON.

## ① El defecto (medido, no leído)

**Decisión del fundador (21-sep-2026):** TODOS los puestos van con `--model sonnet`, sin excepción.

`argsLanzar({modo:'nueva'})` devolvía `['--bg','-n',nombre,'--permission-mode','auto',prompt]`. `grep` de
`model|sonnet|opus` en `origin/main:scripts/equipo/sesion.mjs` y en la copia instalada (9:11 de hoy): sólo un
comentario sobre «el modelo» como concepto, ninguna línea de código. Todas las rutas que lanzan pasan por ahí:
`arranque.cmd` → `orquestador-arranque.mjs` → `sesion.mjs lanzar`, y `relevar`. Es decir: la tanda de las 13:05,
la de las 18:10 y cada relevo arrancaban con el modelo por defecto de la CLI.

## ② Por qué el arreglo es un PR y no un retoque en AppData

`arranque.cmd` **reescribe** `sesion.mjs`, `orquestador-arranque.mjs` y `uso.mjs` desde `origin/main` en cada
tanda, y `puertaDeIntegridad` se niega (`ALTERADO`) si su copia no es idéntica a `origin/main`. Una edición en
`AppData` se pisaría a la tanda siguiente, y antes de eso dejaría el lanzador parado. La única vía es main.
Consecuencia dicha desde el principio: la tanda de las 13:05 ya no podía llevar el flag; las siguientes, sí.

## ③ El arreglo (`scripts/equipo/sesion.mjs`)

`export const MODELO_DEL_EQUIPO = 'sonnet'` y `argsLanzar({modo:'nueva'})` añade `'--model', MODELO_DEL_EQUIPO`
**después** de `--permission-mode auto` y antes del prompt: el orden exacto de los `respawnFlags` de una sesión de
fondo lanzada con éxito hoy (`docs/master/evidencias/scrum990/respawnflags-s5-21b.json`).
`reanudar` NO cambia: con flags, `--resume` arranca una COPIA (SCRUM-899, control 3b) y la reanudada conserva
sus opciones; además ninguna acción de la CLI reanuda ya (SCRUM-954).

## ④ Lo medido

**El flag funciona con `--bg` en CLI 2.1.278** (sonda por efecto, no lectura de documentación): el
`state.json` del job de la sesión que trabaja este ticket guarda
`respawnFlags: [-n, s5-21b, --permission-mode, auto, --model, sonnet]`, y las 111 respuestas de su `jsonl`
llevan `"model":"claude-sonnet-5"`. La misma sonda sirve para verificar una tanda real (ver ⑥).

**Tests** (`tests/scrum899*`, `951a`, `954`, `959b`; sin `dist`, sólo cargan scripts): 72 pass · 0 fail · 0 skipped
en las seis suites. Tres `deepEqual` exactos que fijaban el vector viejo se actualizaron (`899b`; `951a` ×2, el
equipo de prefijo `jv-` incluido, porque `sesion.mjs` es común a los dos equipos). Nuevos: uno por puesto
(`orquestador` y `sesion-0…5`) y uno de que `reanudar` no lleva `--model`.

**Rojo**, sobre el commit `f7c8a9b245fd85863c7f2e9cacde744c12a3d2d0` (hecho ANTES de inyectar; base sin mutar
49/49 sobre las cuatro suites que tocan `argsLanzar`; cada inyección con `git diff --numstat` = `1 1`, revertida
con `git restore --source=HEAD --staged --worktree`, `status --porcelain` vacío tras cada una):

| inyección | cae |
|---|---|
| A · quitar `'--model', MODELO_DEL_EQUIPO` | 4 (el nuevo, la tanda del orquestador y las dos de `jv-`) |
| B · `MODELO_DEL_EQUIPO = 'opus'` | los mismos 4 |
| C · `reanudar` con `--model` | 2 (el nuevo y «reanudar va SIN flags») |
| D · el flag antes de `--permission-mode` | 6 (los cuatro de arriba, el del modo `auto` y el de `relevar`) |

A y B están declaradas en `MUTACIONES_QUE_ME_TUMBAN` (las corre `meta:mutaciones`; el `cae` de cada una es
subcadena del título del test nuevo, que es lo que exige `paso()/cayo()`). C y D se midieron a mano. La
declaración vieja de `bypassPermissions` se re-ancló a la línea nueva. `meta:mutaciones --solo-censo`: 94
declarantes · 314 declaraciones, exit 0 (ese modo NO inyecta: las inyecciones son las de la tabla).

## ⑤ Lo que este PR NO resuelve, dicho

- **Alcanza también al equipo de Javier** (`prefijo` `jv-`): `sesion.mjs` es un fichero común y el modelo va
  en el código, no en el `config.json` de cada equipo. La decisión fue del fundador para el equipo de Luis; si
  Javier quisiera otro modelo, lo natural es un campo `modelo` opcional en `config.json`. No se ha hecho para
  no dejar «sin excepción» con una excepción escrita dentro.
- Las **sesiones ya vivas** (las `s<n>-21` de hoy) no cambian de modelo: el flag sólo actúa al lanzar.
- Un orquestador lanzado a mano (`claude --bg …` sin pasar por `sesion.mjs`) sigue sin llevarlo: este PR sólo
  cubre lo que lanza el equipo. La regla sigue siendo lanzar por `sesion.mjs`.

## ⑥ Pendiente: la prueba por EFECTO de la primera tanda con el flag (18:10)

`arranque.cmd` copia de `origin/main` al arrancar, así que actúa desde la primera tanda posterior al merge.
Medir: `state.json` del job recién lanzado (`respawnFlags` con `--model sonnet`) y `message.model` de su `jsonl`
(`claude-sonnet-5`). Si la tanda sale `YA-VIVA` (equipo vivo) no lanza nada y no hay nada que medir: entonces se
mide en el primer `lanzar`/`relevar` real.

## ⑦ De propina — SCRUM-959 ⑤: la tanda de las 13:05, medida por efecto

`schtasks /query /tn yaqu-equipo-1305`: última ejecución 21/09/2026 13:05:00 (hora de la máquina), resultado 0.
`arranque.log` (`C:\Users\Admin\AppData\Local\yaqu-equipo`): `tanda.veredicto = YA-VIVA`, «hay 6 sesión(es)
vivas en el repo (s0-21c, s1-21b, s2-21c, s2b-21b, s4-21b, s5-21b)», todas «tiene proceso (pid …)». **No
lanzó un orquestador nuevo**: el criterio de 959b (por lo vivo en el repo, no por el nombre) funcionó sobre la
máquina real. Antes de las 13:05, la misma decisión importada de `origin/main` y alimentada con el
`claude agents --json` real dio `YA-VIVA` con 7 vivos; control sin sesiones → `NUEVA`; sólo chats interactivos
parados → `NUEVA` (el hueco que 959b ya declara).

# SCRUM-959 · el equipo arranca solo — y a las 13:05 habría duplicado al orquestador (fase b: arreglo)

**Fecha:** 21-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `3ac838a5e055bb9e70a484560ee5b23187c6f491` · 2026-09-21T07:48:58Z (GitHub)
**Rama:** `scrum-959b-arranque-no-duplica-equipo` · **Worktree:** `wt-959b`

> ⛔ `src/` y `public/` intactos · sin estado ni flag nuevos · sin dependencias · no se toca
> `C:\Users\Admin\AppData\Local\yaqu-equipo` ni `schtasks` (son del fundador): sólo se LEYERON.

## ① Lo que se leyó (no se ejecutó) el 21-sep, ~09:4x hora de España

- Las tres tareas (`yaqu-equipo-0800/1305/1810`) existen, «Listo», `Último resultado: 267011` (=
  todavía no ha corrido nunca), «Solo interactivo» (necesita a Admin con sesión abierta), sin batería
  (sobremesa), `node` y `git` en el PATH. Próxima: 13:05 de hoy.
- `arranque.cmd` copia desde `origin/main` `sesion.mjs`, `orquestador-arranque.mjs`, `uso.mjs` y el
  prompt de la tanda, y lanza `orquestador-arranque.mjs`. Sus tres puertas (no correr desde un árbol
  de git, copias idénticas a `origin/main`, prompt no vacío) salen bien.
- 🔴 **EL DEFECTO.** `orquestador-arranque.mjs` delega en `sesion.mjs lanzar orquestador`, y
  `decidirLanzar` daba una sesión por «viva» sólo si una entrada de `claude agents --json` se llamaba
  EXACTAMENTE `orquestador`. Esa mañana el equipo estaba levantado a mano: seis sesiones de fondo
  `s<n>-21`, el orquestador interactivo `cobroflash-backend-90`, y un resto muerto `sesion-5`. Ninguna se
  llama `orquestador` → `NUEVA` → a las 13:05 arrancaba OTRO orquestador encima. Y ése, con su
  paso 3 («si falta una sesión y el lanzador está instalado y autorizado, ábrela»), podía abrir
  `sesion-0..4` duplicando a los vivos. Sólo el nombre decidía; nada miraba si había trabajo en marcha.

## ② El arreglo (`scripts/equipo/sesion.mjs`)

`equipoVivo({agentes, repo, job})` + una comprobación en `decidirLanzar` **sólo para el orquestador**
(los puestos sí se lanzan cuando faltan). Cuenta una sesión si (a) se ARRANCÓ en el repo o bajo él
(`cwd`; los worktrees de `.claude/worktrees/` cuelgan de él), (b) no es un resto muerto (el `pid`, con
el `state.json` sólo para vetar; ante la duda vive), y (c) si es un chat INTERACTIVO, está trabajando
(`status: busy` o `state: working`). Una de FONDO con proceso vivo cuenta trabaje o espere.

Decisiones del orquestador (21-sep): (1) NUNCA duplicar un equipo vivo; (2) un chat viejo y parado no
puede bloquear el arranque para siempre; (3) **no se inventa el patrón `s<n>-dd`**: el criterio no mira
el nombre; (4) sin nadie vivo el veredicto sigue siendo `NUEVA`. Sin la ruta del repo, el orquestador
devuelve `NO-PUDE-MIRAR` y no se lanza a ciegas. La CLI pasa `repo: config.repo`.

## ③ Lo medido (`tests/scrum959b-el-arranque-no-duplica-el-equipo.test.mjs`, 11 tests)

Con la salida LITERAL de `claude agents --json` de esa mañana
(`docs/master/evidencias/scrum959/agents-21sep.json`):

    criterio viejo (sólo el nombre) → 0 sesiones «vivas» llamadas orquestador → NUEVA   ← el defecto
    criterio nuevo                  → YA-VIVA, y el equipo que ve incluye a cobroflash-backend-90
                                      y a las de fondo, y NO al resto muerto `sesion-5`

Además: sigue siendo YA-VIVA con nombres cualesquiera y con sesiones sin nombre; un interactivo parado
→ `NUEVA` y el mismo trabajando → `YA-VIVA` (lo único que cambia es `status`); una de fondo esperando
cuenta; controles positivos (repo vacío, sólo un resto, sesiones de otro proyecto → `NUEVA`); `cobroflash-backend-otro` NO es una subcarpeta
de `cobroflash-backend`; los puestos siguen lanzándose; y **por efecto sobre la CLI** con un `claude`
de mentira: con el equipo vivo, `lanzar orquestador` sale 0 con `YA-VIVA` y no llama a `claude --bg`; con
el repo vacío, sí llama a `claude --bg -n orquestador`.

**Rojo**, sobre el commit `c594b4b3a55362d75dcac4d7d452352c95775c8d` (hecho ANTES de inyectar; cada
inyección con `git diff --numstat` = `1 1` y revertida con `git restore --source=HEAD --staged
--worktree`, `status --porcelain` = 0):

| inyección | cae |
|---|---|
| M1 · `if (nombre === …orquestador) {` → `if (false) {` | 7 de 11 (el ROJO, los nombres, el parado, el de fondo, el worktree, sin-repo y la CLI) |
| M2 · quitar la línea que ignora al interactivo parado | 1 (el del `-73`) — y sólo ése |
| M3 · la CLI deja de pasar `repo: config.repo` | 2 (la de YA-VIVA y el control positivo, que ya no lanza) |

M1 y M2 están declaradas en `MUTACIONES_QUE_ME_TUMBAN` (las corre `meta:mutaciones`); M3 se midió a mano.
Se re-anclaron las dos mutaciones de `scrum951a` cuya línea ganó `repo: config.repo` (`git diff
--numstat` = `2 2`); las siete suites de `tests/scrum899*`, `951*`, `954*`, `959b` dan 78/78.

**Un dato de SCRUM-976, de propina:** `npm run guards:entrada` —que desde el #1559 lleva el censo de
723— salió ROJO en esta misma rama antes de empujar: el banco nuevo hace `git show origin/main:…`
(igual que el de 954) y 723 exige declarar toda referencia móvil. Se declaró en
`tests/scrum723-guard-contra-su-base.test.mjs`, con su motivo. Es exactamente el rojo de CI que aquel
ticket quería adelantar; hoy se vio ANTES de empujar (10,7 s).

## ④ 🔴 Lo que NO separa, dicho

- **Un orquestador interactivo PARADO y sin ninguna sesión de fondo viva no cuenta**, así que en ese caso
  se lanzaría otro. `agents --json` no da la última actividad, y `statusUpdatedAt` del fichero de sesión
  (`~/.claude/sessions/<pid>.json`) tampoco (sólo cambia cuando cambia el estado: el de esta sesión,
  `busy` durante ~40 min, seguía en el instante de arrancar). No se inventa un umbral.
- **No hay muestra real de un interactivo parado**: cuando se midió no quedaba ninguno (`-73` había
  salido de la lista). Los casos «parado» lo construyen con `status: 'idle'`, valor observado en sesiones
  de FONDO (SCRUM-954) y no en interactivas. Si en una interactiva el valor fuera otro, el criterio
  (`!== 'busy'`) sigue tratándola como parada; el riesgo es el contrario: que una parada saliera `busy`.
- Una sesión de fondo VIVA pero olvidada (proceso vivo, sin nada que hacer) cuenta como equipo y
  bloquearía la tanda. Es el fallo que se elige (visible: el veredicto lista los nombres y los ids)
  frente a duplicar un equipo (silencioso).
- Las sesiones lanzadas desde un `cwd` fuera del repo (los `wt-*` de `D:\MILLONARIO\cobroFlash\`, si se
  abrieran desde ahí) no cuentan: se mira dónde se ARRANCÓ. Las del equipo de hoy salen todas del repo.

## ⑤ Pendiente: la prueba por EFECTO de las 13:05 (no se cierra 959 sin ella)

`arranque.cmd` copia de `origin/main` al arrancar, así que este arreglo sólo actúa si está mergeado antes de
las 13:05 (plazo del orquestador: 12:30 hora de España). Medir después: `schtasks /query /tn
yaqu-equipo-1305 /v /fo list` («Hora de la última ejecución» y «Último resultado»), `arranque.log` en
`C:\Users\Admin\AppData\Local\yaqu-equipo`, y que `claude agents --json` no muestre un orquestador nuevo
si el equipo seguía vivo.

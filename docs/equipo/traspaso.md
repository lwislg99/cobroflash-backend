25-sep-2026 16:10Z (hora GitHub) · medido sobre `origin/main = 0bbc68056ca176d657a83d3c69f54e6e60aa16b3` · sesión de fondo `orquestador` (tanda autónoma SCRUM-899)

> Este documento es el ESTADO. `docs/equipo/orquestador.md` es el MÉTODO (empieza por su §0:
> arranque y lista de cada turno). `docs/equipo/limites-del-fundador.md` son los LÍMITES y el
> OBJETIVO VIGENTE. `docs/equipo/dos-equipos.md` reparte áreas entre los dos equipos. Si algo
> de aquí contradice a una medición de hoy, gana la medición.

# TRASPASO DEL ORQUESTADOR (equipo de Luis) — estado al 25-sep-2026 16:10Z

## 0 · 🔴🔴 EL HALLAZGO DE ESTA TANDA: PRODUCCIÓN LLEVA CONGELADA ~194 HORAS (~8 días)

Medido con el propio vigía del repositorio (`vigía del despliegue`, corrida del PR #1766,
15:39:30Z) y confirmado a mano:

    curl https://yaqu.app/version   → b77a3cb3cbd4583302edecaddc17c255fe02e74e
    git rev-parse origin/main       → 0bbc68056ca176d657a83d3c69f54e6e60aa16b3 (commit de hace ~2 h)

**Producción sigue sirviendo el commit de la TARDE DEL 24-SEP. Desde entonces han entrado 45+
commits a `main` (incluidos varios cierres de hoy) y NINGUNO ha llegado.** El propio vigía lo
dice con estas palabras exactas: *«LA WEB PUEDE ESTAR FUNCIONANDO PERFECTAMENTE Y AUN ASÍ SER
ESTO. Cuando un despliegue falla el healthcheck, Railway mantiene vivo el anterior: no hay
caída, no hay alerta, y el síntoma es "no cambia nada". Así se perdieron nueve días.»** — es
literalmente el escenario que hizo nacer ese vigía, repitiéndose ahora mismo.

`https://yaqu.app/` sigue respondiendo 200 (comprobado 16:0xZ): no hay caída visible, así que
nadie lo va a notar mirando la web.

**Sospecha razonable, no confirmada:** `main` incluye desde las 12:42Z de hoy el modelo
`CustomerSite` (PR #1753, SCRUM-1014) sin que su tabla exista todavía en NINGUNA base (§1). Si
Railway ha intentado desplegar algo posterior a esa hora, `schemaDrift.ts` bloquea el arranque
en producción exactamente así. Pero el hueco medido es de ~194h, no de ~3h, así que puede haber
una causa MÁS VIEJA (de hace ~8 días) que ya bloqueaba antes de que CustomerSite existiera —no
lo he mirado, hace falta el log de arranque de Railway, que yo no puedo abrir.

**Esto es infraestructura de producción: no lo toco (límite del fundador, `limites-del-fundador.md`).**
Va entero a «Para ti».

## 1 · Lo segundo más urgente: SCRUM-1014 (CustomerSite) mergeado sin su ALTER

PR #1753 (SCRUM-1014) está MERGEADO en `main` desde las 12:42Z. `docs/MIGRATIONS_PENDING.md`
sigue con las tres casillas SIN MARCAR (producción, staging, dev). Causa, dejada por la propia
S1: el único check OBLIGATORIO del ruleset (`build+tests`) se prueba contra un banco desechable
creado DESDE el schema, así que pasa aunque ninguna base real tenga la tabla — el auto-merge
disparó igual. El SQL aditivo ya existe, escrito y probado: `docs/sql/scrum-1014-customer-site.sql`
(`CREATE TABLE IF NOT EXISTS` + 2 índices + 2 FK). **Aplicarlo es lo único que hace falta**, y es
schema — lo aplica Javier para los dos equipos (A5) o un jefe. SCRUM-1014 sigue **En curso**,
asignado a Luis: no se cierra hasta que el efecto (la tabla existe y el despliegue está verde).

## 2 · QUIÉN ESTÁ EN QUÉ

`ListAgents` (mi registro real de mensajería) solo ve dos chats interactivos idle
(`cobroflash-backend-06`, `cobroflash-backend-fc`) — **ningún puesto S0-S5 vivo que yo pueda
usar.** `claude agents --json` (registro del sistema, más completo) muestra ADEMÁS:

- `sesion-5` (id `df2fa38f`) y `s1-21` (id `829b5f76`) — **zombis conocidos**, "working" desde el
  18-sep y 21-sep respectivamente, ya documentados en traspasos anteriores, imposibles de parar
  (el clasificador de permisos deniega `TaskStop`/`claude stop`). Sin cola según su propio
  traspaso: se ignoran, no se pierde nada.
- `s1-25c` (id `ad2902e9`) y `s0-25c` (id `f66b7538`) — **NUEVO hallazgo de hoy**: arrancadas
  esta tarde (marca de tiempo de hoy) y en estado **`blocked`**, casi con certeza esperando un
  permiso que nadie puede contestarles (patrón ya visto: una sesión de fondo con `EnterWorktree`
  se queda pidiendo un permiso que no hay quien conteste). **No aparecen en `ListAgents`**, así
  que no puedo enviarles ni un mensaje ni pararlas desde aquí — es el mismo síntoma que
  `feedback_registro_sesiones_roto_tras_reinicio`: si el panel del fundador ve más sesiones vivas
  que yo, mi mensajería está rota, no ellas paradas.

**Resultado: 0 puestos operables por mí esta tanda**, y sin autorización vigente en ESTE chat
para lanzar sesiones nuevas con nombre `sesion-N` (A19: no se hereda; `.claude/settings.local.json`
solo permite `claude --bg -n control-899-*`).

## 3 · Lo que SÍ entró hoy (medido en `main`, con la salvedad del §0: no está en producción)

Mergeado hoy en `main`: PR **#1752** (SCRUM-1082/906, recorrido de Billin) · PR **#1756**
(SCRUM-1038, botón «leer el ticket» en Gastos) · PR **#1753** (SCRUM-1014, CustomerSite — ver
§1) · y otros commits de tickets fiscales/RFACT que son del equipo de Javier (ver §5).

## 4 · Jira: qué se puede cerrar por efecto, y qué NO (hoy con matiz)

**Hasta hoy** este equipo cerraba por «merge en `main` + traspaso corroborado». **Con producción
congelada 8 días (§0), ese criterio deja de bastar**: un ticket «cerrado» hoy puede seguir sin
existir para ningún usuario real. Por eso, esta tanda **NO cierro ningún ticket nuevo** — ni
SCRUM-1038 ni SCRUM-1014 — hasta que se sepa que el despliegue se ha movido. Quedan:

- **SCRUM-1038** — En curso, PR #1756 MERGEADO en `main`. Pendiente de que despliegue.
- **SCRUM-1014** — En curso, ver §1 (bloqueado además por el ALTER, no solo por el despliegue).
- **SCRUM-1082** — ya estaba Finalizada (el trabajo de consultoría no depende de despliegue).
- Resto de `equipo-luis` + En curso, sin cambios desde el turno anterior: SCRUM-1041 (esperando
  asesor, bloque B), SCRUM-967 (portal del cliente sin enlace automático), SCRUM-1090 (guard de
  negación fiscal, bloquea al equipo de Javier), SCRUM-996 (candidato medido, pelota en el
  fundador), SCRUM-963/868/774 (bloqueados por causas ya conocidas y ajenas a este turno).

**No puse nada En curso nuevo** (A13): no hay sesión viva a la que asignarle nada.

## 5 · Lo que NO se toca: 4 PR abiertos, los cuatro del equipo de Javier

`gh pr list` da solo 4 PR abiertos en todo el repo, y los cuatro llevan `equipo-javier` en Jira
(comprobado por ticket): #1766 (SCRUM-1120, fixture de 804b) · #1763 (SCRUM-1063b, modelo 303) ·
#1762 (SCRUM-1105, seeds --dev/--staging) · #1761 (SCRUM-1118, RFACT). Los tres primeros con
`build+tests` en FAILURE; el cuarto, DIRTY (conflicto). Ninguno es mío: no se tocan.

## 6 · Censo de huérfanos (25-sep, con `scripts/equipo/huerfanos.mjs` de `origin/main`)

184 worktrees · 0 con commits sin empujar · 6 sucios recientes (<72h) · 43 sucios antiguos (no
listados) · 692 ramas locales sin worktree (2 con commits sin empujar, ajenas: `scrum-804b-...`
del 24-sep y `scrum-418-...` de agosto, residuo viejo).

⚠️ **El propio checkout compartido `cobroflash-backend` es uno de los "sucios recientes"**: en la
rama `scrum-1082-flujo-crear-factura-competencia` hay 1 modificado + 38 sin seguir (capturas de
ServiceM8 + notas de sprint), tocado ayer 24-sep. Es trabajo de otra sesión (S0), no mío — el
worktree del orquestador es de solo lectura (§7) y no lo he tocado. Escribí este traspaso en un
worktree NUEVO (`wt-orq-899b`) para no interferir con él.

⚠️ **Nota de proceso propia:** mi primer intento de worktree (`wt-orq-traspaso-899`, en
`D:\MILLONARIO\cobroFlash\`) se quedó a medias — `git worktree add` reportó éxito pero el
directorio quedó sin `.git` ni ficheros del repo. Lo abandoné sin forzar su borrado (un
`--force` fue bloqueado por el guard local, y no he insistido) y usé un nombre nuevo
(`wt-orq-899b`). Ese directorio roto queda para que alguien lo limpie a mano
(`git worktree prune` no lo vacía porque el directorio sigue existiendo).

## 7 · LA REGLA DEL WORKTREE DEL JEFE

> El worktree del orquestador es de **SOLO LECTURA**. Lee, mide, corre guards, abre
> runs de CI, consulta Jira. **NUNCA hace commit de código de producto.** Lo único
> que escribe es `docs/equipo/`. Si necesita un cambio en el producto, lo **ENCARGA**.

## 8 · Las normas que no estaban en `orquestador.md`

- **A12** · Antes de cambiar una población, se censa qué guards miden sobre ella.
- **A13** · Nada más coger un ticket: EN CURSO + ASIGNADO A LUIS en Jira, antes de la primera
  línea de código.
- **A14** · Todo informe empieza con fecha, hora y SHA de `origin/main`.

## 9 · Errores de esta tanda

El del §6 (worktree a medias, ya descrito). Aparte, ninguno más que registrar: turno de solo
medición (0 puestos operables, no se ha escrito ni un carácter de producto). El hallazgo del §0
no es un error mío: es un hueco de 8 días que ninguno de los traspasos anteriores (S0/S1/S2/S4/S5,
21 al 25-sep) midió — todos comprobaban `main`/Jira/PR, ninguno comparaba `main` contra lo que
`/version` dice tener producción.

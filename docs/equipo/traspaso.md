26-sep-2026 06:20Z (hora GitHub) · medido sobre `origin/main = 032afc9ccd2fca0e160af40fcbf1acc0bcf43e0d` · sesión de fondo `orquestador` (tanda autónoma SCRUM-899)

> Este documento es el ESTADO. `docs/equipo/orquestador.md` es el MÉTODO (empieza por su §0:
> arranque y lista de cada turno). `docs/equipo/limites-del-fundador.md` son los LÍMITES y el
> OBJETIVO VIGENTE. `docs/equipo/dos-equipos.md` reparte áreas entre los dos equipos. Si algo
> de aquí contradice a una medición de hoy, gana la medición.

# TRASPASO DEL ORQUESTADOR (equipo de Luis) — estado al 26-sep-2026 06:20Z

## 0 · 🟢 SUPERADO: la congelación de producción de ayer está RESUELTA

El traspaso anterior (16:10Z del 25-sep) declaró producción congelada ~194h. **Ya no es cierto,
no re-diagnosticar:**

    curl https://yaqu.app/version   → 032afc9ccd2fca0e160af40fcbf1acc0bcf43e0d
    git rev-parse origin/main       → 032afc9ccd2fca0e160af40fcbf1acc0bcf43e0d   (IDÉNTICO)

Según el orquestador saliente de anoche (`cobroflash-backend-06`, cierre ~21:15 CEST del 25-sep):
el fundador aplicó a mano el SQL de los dos ALTER que faltaban (SCRUM-1014 CustomerSite y
SCRUM-1008 columnas de `products`) y Railway volvió a desplegar solo. `docs/MIGRATIONS_PENDING.md`
sigue con las casillas de producción SIN MARCAR para los dos — es un hueco de REGISTRO, no de
estado: la tabla evidentemente existe ya en producción (el despliegue no cae), falta que alguien
marque las casillas. No es mío tocarlo (schema, Javier/A5); lo dejo anotado.

## 1 · Los 6 PR abiertos, y qué hice con ellos esta mañana

Los 5 primeros llevaban desde ayer BLOCKED por el mismo rojo (`build+tests`: SCRUM-267 y SCRUM-976
fallando), que ya estaba arreglado en `main` desde las 20:06Z de ayer (confirmado: el run de CI
sobre el propio `032afc9c` está en verde). Sus ramas simplemente no habían recogido ese arreglo.
Les hice `gh pr update-branch` a los 5 esta mañana (06:1xZ): tras eso ninguno muestra ya un check
en FAILURE — quedan a que termine el run y el bot los mergee solo.

| PR | ticket | rama | estado tras `update-branch` |
|---|---|---|---|
| #1795 | SCRUM-1138 | scrum-1138-patch-customers-id | sin FAILURE, esperando CI |
| #1794 | SCRUM-1134 | scrum-1134-beneficio-sobre-la-base | sin FAILURE, esperando CI |
| #1793 | SCRUM-1048 | scrum-1048-resumen-trimestre-calculo | sin FAILURE, esperando CI |
| #1789 | SCRUM-1124 | scrum-1124-marcador-huerfano-jobasignados-parte | sin FAILURE, esperando CI |
| #1787 | SCRUM-1128 | scrum-1128-envio-construido-criterio | sin FAILURE, esperando CI |
| #1783 | SCRUM-917 (apéndice) | scrum-917-excepcion-caduca-objetivo-tactil | **DIRTY, conflicto real** — encargado a S2 (Tarea 1, abajo) |

## 2 · Puestos: hoy SÍ se pudo lanzar (ayer no había autorización vigente en el chat)

`ListAgents`/`claude agents --json` seguían sin ver ningún S0-S5 vivo con cola al arrancar esta
tanda (solo dos chats interactivos idle, `cobroflash-backend-06` y `cobroflash-backend-fc`, y los
zombis conocidos `sesion-5`/`s1-21`, sin proceso real). Como esta tanda es la PROGRAMADA de
SCRUM-899 (arranque automático, no una tanda ad-hoc), lancé con `sesion.mjs lanzar` dos puestos con
encargo completo dentro del prompt:

- **sesion-1** (id `b621656b`) — SCRUM-960 (NIF de proveedor) y SCRUM-1001 (línea firmada por
  Javier en la página de decisión del cliente), con SCRUM-1024 como lectura de fondo. Puestas
  **En curso**, asignadas a Luis, en Jira.
- **sesion-2** (id `cf70445f`) — Tarea 1: desatascar el PR #1783 (DIRTY) con `merge` (nunca
  `rebase`). Tarea 2: reintentar el push de SCRUM-1132 (commit local en
  `.claude/worktrees/s2-1132`, bloqueado ayer por el clasificador de permisos) — **una sola vez**;
  si vuelve a bloquear, se para y se deja escrito, no se rodea (ver «Para ti», está pendiente de
  autorización del fundador, no es un fallo transitorio). Tarea 3 si queda tiempo: SCRUM-1133/1135/
  1136/1137 (mismo lote «servidor listo, pantalla no», carril prestado de J2 con excepción D1 ya
  puesta por el orquestador anterior).

⚠️ `sesion.mjs lanzar` devolvió `NO-PUDE-MIRAR` para los dos (el defecto ya conocido de SCRUM-1095:
informa mal aunque la sesión sí arrancó) — confirmado con `claude agents --json` que las dos están
`working` con PID real. No es un fallo de esta tanda, es el bug ya ticketado.

## 3 · Jira

- **SCRUM-960** y **SCRUM-1001** → En curso, asignadas a Luis (antes «Tareas por hacer»).
- Nada se cierra por efecto esta tanda todavía: los 5 PR de arriba están en vuelo, no confirmados
  en `main` ni desplegados. Se cierran cuando su sesión lo reporte con el PR ya mergeado.
- Sin cambios en el resto de `equipo-luis`: sigue igual que ayer (SCRUM-1041, 967, 1090, 996,
  963/868/774, 863 y demás «Acción del fundador» o bloqueados por causas ajenas a este turno).

## 4 · Lo que NO se toca

Los PR abiertos que quedaban del equipo de Javier a la última medición de anoche (según
`cobroflash-backend-06`, no re-medido por mí): no aparecen ya en `gh pr list --state open` de esta
mañana (o mergearon o los cerraron ellos) — el repo solo tiene los 6 de la tabla de arriba, todos
`equipo-luis`. Si el equipo de Javier abre alguno nuevo, sigue sin ser mío.

## 5 · Censo de huérfanos (26-sep, `scripts/equipo/huerfanos.mjs`)

196 worktrees · 1 con commits SIN EMPUJAR (`s2-1132`, ya encargado a sesion-2) · 7 sucios
recientes (<72h, incluido el checkout compartido — trabajo de S0, no tocado) · 43 sucios antiguos ·
705 ramas locales sin worktree, 3 con commits sin empujar (`scrum-1127-cliente-envio-aeat` y
`scrum-804b-...`/`scrum-418-...`, ajenas, ya conocidas de censos anteriores).

## 6 · LA REGLA DEL WORKTREE DEL JEFE (sigue vigente)

> El worktree del orquestador es de **SOLO LECTURA**. Lee, mide, corre guards, abre runs de CI,
> consulta Jira. **NUNCA hace commit de código de producto.** Lo único que escribe es
> `docs/equipo/`. Si necesita un cambio en el producto, lo **ENCARGA**.

Este traspaso se escribió en un worktree nuevo (`orq-traspaso-26sep`) para no tocar el checkout
compartido, que sigue sucio con trabajo de S0 sin relación con esto.

## 7 · Errores/matices de esta tanda

- Un primer intento de renombrar la rama de este mismo traspaso a convención `scrum-N-slug`
  chocó con el guard `guard-dangerous` (árbol con `.claude/settings.local.json` modificado por el
  propio arranque del worktree) y, al intentar el único-uso `.claude/allow-destructivo` que el
  guard sugiere, el clasificador de permisos lo denegó como *Self-Modification* — igual que
  seguir inspeccionando el estado de la rama para el mismo fin. Se abandonó esa vía sin insistir
  (no se rodea un bloqueo de permisos) y se empujó tal cual en la rama que creó `EnterWorktree`.
- El resto, sin errores propios que registrar: recibí traspaso fresco de `cobroflash-backend-06`
  por el canal directo (no estaba en ningún fichero, solo en su chat) y lo he volcado aquí para que
  no se pierda cuando cierre esa sesión.

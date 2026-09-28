# SCRUM-1245 — el comando de la tanda que enseña `CLAUDE.md` puede salir 0 sin ejecutar nada

**Medido contra:** `origin/main` = `0afa87cd95645317226f59bc379edae59a7bea44` · 2026-09-28T18:39:45Z (J6, worktree `cobroflash-jv6`, Git Bash, Windows 11)

## El defecto

`CLAUDE.md:128` y `docs/RUNBOOKS.md:688` enseñaban el bloque «cómo ver lo que saltó» con el patrón
**sin comillas**: `… --test-reporter-destination="${TMPDIR:-/tmp}/yaqu-tanda.tap" tests/*.test.mjs`.
Lo expande bash, y con 1.063 ficheros la lista mide 47.393 caracteres: más que el límite de la línea
de órdenes de Windows (32.767).

No es deriva del máster: el máster no contiene este comando. Es deriva de dos documentos derivados
(regla 35) respecto a un arreglo **ya medido y escrito** en `docs/equipo/trampas-del-entorno.md` §7
(«pasarle a node el patrón entre comillas simples») y en `docs/master/SCRUM-1107.md` («la invocación
que documenta `CLAUDE.md` desborda la línea de órdenes»).

## El rojo, medido antes de tocar nada

Con un test que falla sembrado en `tests/` (control: solo, sale `exit=1`), el bloque EXACTO de
`origin/main:CLAUDE.md` líneas 127-129, corrido con `bash`:

| caso | lo que pasa | código del bloque |
|---|---|---|
| sin TAP de antes | `node: Argument list too long` (126) · `grep: No such file` | 2 |
| con el TAP de una tanda anterior en `$TMPDIR` | `node: Argument list too long` · el `grep` imprime `ok 1 - tanda anterior # SKIP` | **0** |

Node no llega a arrancar, hay un test en rojo en el árbol, y el bloque sale **0** enseñando los saltos
de OTRA tanda como si fueran los de ésta. El TAP no se tocó (mismo `mtime` antes y después).

Sonda previa, sin correr tests: `node -e … tests/*.test.mjs` → `Argument list too long`, `exit=126`.

## El arreglo

En las dos copias: el patrón entre comillas simples (`'tests/*.test.mjs'`, lo expande node) y un
`rm -f` del TAP antes de lanzar, para que un node que no arranca no deje a la vista el TAP viejo.

## El verde

No se corrió la suite real (pide el TURNO y memoria; la de esta tarde la mató el reaper, SCRUM-1244).
Se corrió en una **réplica fuera del árbol**: `tests/` con los mismos 1.063 nombres de fichero, cada uno
con un test trivial, más el rojo sembrado.

| bloque | resultado en la réplica |
|---|---|
| viejo (control: la réplica reproduce el rojo) | `Argument list too long` · el grep enseña el TAP anterior · **exit 0** |
| nuevo, línea de node | **exit 1** · TAP: `# tests 1064` · `# pass 1063` · `# fail 1` · `not ok 1064 - scrum1245 rojo sembrado` · 0 líneas del TAP anterior |
| nuevo, línea de grep | `exit 1` (no hay saltos: correcto) |

Guards que leen `CLAUDE.md`/`RUNBOOKS.md` (scrum850, 850b, 711, 189, 233, 242, 273, 454, 534b, 569, 637,
705, 744, 942, 225): **134 tests · 134 pass · 0 fail · 0 skipped**.

## Copias buscadas

`git grep` de `tests/*.test.mjs` sin comilla delante en todo `origin/main`: **dos** pegables (las
arregladas). El resto no son invocaciones que alguien pegue en bash:

- `package.json` `test`: corre por `npm`, que en Windows usa cmd, y cmd no expande el patrón (le llega a node).
- `docs/BUGS.md:837/841/984`, `docs/YAQU_MASTER.md:998`, 34 ficheros de `docs/master/`: registros históricos.
- `tests/` y `scripts/`: literales de fixtures y comentarios.

Control positivo de la búsqueda: la misma expresión SÍ encuentra las dos líneas del defecto.

## Lo que NO hace

No añade un guard. Que esto vuelva lo cazaría un veredicto nuevo en `scripts/_invocaciones-de-la-tanda.mjs`
(patrón de la tanda sin comillas en un documento que la prescribe): queda como propuesta al orquestador.

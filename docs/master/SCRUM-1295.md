# SCRUM-1295 · El fichero dice de quién es; la sesión sabe quién es (piezas 3, 4 y 5) — EN CURSO

**Medido contra:** `origin/main` = `45181d233c74ee36a39db4913d9593e7e9a284df` · 2026-09-29T17:51:27Z
**Sesión:** s0-29a (S0). Encargo del orquestador, autorizado expresamente por el fundador. `.claude/**`
es de un jefe (dos-equipos §3.3): la S0 lo prepara con esa autorización. **PR en BORRADOR** (cierre de jornada).

## 🔴 El hallazgo que condiciona todo: la carpeta de ARRANQUE

CLAUDE.md, `.claude/settings.json` (los hooks) y `.claude/rules` se cargan desde la carpeta donde ARRANCA
la sesión. `claude agents --json` (campo `cwd`): las 17 sesiones vivas arrancan en el checkout compartido
`D:\MILLONARIO\cobroFlash\cobroflash-backend`, porque el orquestador las lanza a mano desde ahí y heredan
su cwd. Ese checkout va **1.026 commits** por detrás de main, en la rama `scrum-1082-…` desde el
**22-sep** (`e4ea95e5`), y su `guard-dangerous.mjs` es más viejo que el de main.
**Nada de lo mergeado en normas, hooks o CLAUDE.md desde el 22-sep ha llegado a ninguna sesión.** Esto
incluye SCRUM-1294 y esta pieza. Cura: lanzar cada sesión desde su mesa fija, al día con origin/main
(SCRUM-1298, S5, `sesion.mjs`). El checkout compartido tiene cambios sin commitear del orquestador y los
permisos del fundador (`settings.local.json`): no se toca.

## Mediciones (claude 2.1.284, `claude -p`, laboratorio con canarios y repo git con worktrees)

| qué | resultado |
|---|---|
| hook PreToolUse: ¿recibe el nombre de la sesión (`-n`)? | NO, ni por stdin ni por entorno. Recibe `transcript_path`, y el transcript lleva `{"type":"agent-name",…}` desde la PRIMERA llamada |
| subagente (herramienta Agent) | mismo `transcript_path` y `session_id` que su padre, más `agent_id`: hereda el nombre |
| sesión sin `-n` | ninguna línea de nombre: se distingue «sin nombre» de «no pude leer» |
| hook SessionStart | recibe `session_title` = el `-n` (sin `-n`, el campo no viene); el transcript aún NO existe (ENOENT) |
| `additionalContext` de SessionStart | **LLEGA al modelo** (canario citado), y el hook se repite al reanudar y al compactar. **Un hook puede ENSEÑAR, no solo bloquear** — se daba por no posible |
| `.claude/rules/x.md` con `paths:` | se carga SOLA al leer (Read) un fichero que casa; NO al leer otro (control negativo). Sin `paths:`, siempre |
| `CLAUDE.local.md` | se carga ADEMÁS del CLAUDE.md (no en su lugar), en la raíz y en un worktree hermano; 30 KB enteros |
| `CLAUDE.local.md` de un worktree HIJO (`.claude/worktrees/x`) | se carga en cuanto la sesión LEE un fichero de ahí: el orquestador leyendo la mesa de S1 heredaría «soy S1» |

Consecuencias de diseño:
- `CLAUDE.local.md` en la carpeta compartida NO puede dar identidad: es una para las 17.
- **Mesas HERMANAS, nunca hijas** (`D:\MILLONARIO\cobroFlash\mesa-sN`, fuera del repo).
- **La discrepancia ES el dato** (A3): la identidad sale de la CARPETA (`.yaqu-puesto.json` de la mesa)
  y se contrasta con el NOMBRE. Si dicen puestos distintos, se para; no se elige uno.

## Qué hay construido (en esta rama)

- `scripts/_carriles.mjs` (puro) y `scripts/carriles.mjs` (`generar | comprobar | de <ruta> | mesa <P> <dir>`).
  Hoy: 55 filas de §3 → 131 reglas (112 con dueño), 1 excepción, 11 reglas `.claude/rules/carril-*.md`,
  4.346 ficheros en el repo. Salida 2 si la tabla es ambigua o nombra algo que no existe (medido: salía
  con `puesto-jN.md` y `SCRUM-N.md`, que eran plantillas; corregidas a `puesto-j*.md` y `SCRUM-*.md`).
- `.claude/carriles.json` y `.claude/rules/carril-*.md`, GENERADOS.
- `.claude/hooks/carril.mjs` (cerradura). Humo sobre los casos de hoy:
  - s2-29d → `invoicesView.js`: **salida 2**, «es de J1 — Facturación y VeriFactu, y tú eres S2…».
  - s2 → `homeView.js`: 0. s2 → `app.js` (contenedor): 0. Sin nombre: 0.
  - sesion-1 → `00-normas-siempre.md`: 0, por la excepción de §3.4.
  - `cobroflash-backend-57` (no dice puesto): 0.
  - Con `--exigir-identidad` y sin nombre: **salida 2**, «SIN IDENTIDAD».
- `.claude/hooks/identidad.mjs` (SessionStart): puesto, área, ficha y cicatrices del puesto, por
  `additionalContext`.
- `dos-equipos.md`: rutas reales en vez de plantillas, fila de cicatrices, `scripts/_suelo-*` → S3 (lo
  decía la nota y no había fila), `00-normas-siempre.md` → S0, y **§3.4 excepciones declaradas**.

Lo que dice `de` sobre los tres tropiezos de hoy:
- `invoicesView.js` → J1 (fila 132).
- `parteOficinaView.js` → S2, pero SOLO por «todo lo demás de public/».
- `fusionClientes.ts` → S1, SOLO por «todo lo demás de src/». La tabla NO lo da a J2.
Los dos últimos son el cabo 2 del orquestador: huecos que cubre la fila general.

## PENDIENTE, con dueño

1. **S0 (sesión siguiente):** `tests/scrum1295-carriles.test.mjs` con cuatro partes:
   - regenera en memoria y exige que coincida con lo commiteado;
   - control positivo: muta una fila y comprueba que difiere;
   - la cerradura por spawn: los casos del humo, más la discrepancia carpeta≠nombre y un mapa roto;
   - identidad.mjs.
   Después, registrar en `.claude/settings.json`: SessionStart → `node .claude/hooks/identidad.mjs` y
   PreToolUse `Edit|Write|NotebookEdit|MultiEdit` → `node .claude/hooks/carril.mjs`. Y `.gitignore`:
   `CLAUDE.local.md` y `.yaqu-puesto.json`. Sin eso, el PR NO sale de borrador.
2. **S0:** censo de huecos (cabo 2): `carriles.mjs huecos` con los ficheros que solo cubre la fila
   general de src/ o public/, más población. Decidir con el orquestador si un fichero nuevo sin fila
   propia sale rojo o solo se lista.
3. **S0:** auditoría rutinaria de cierres contra su aceptación (cabo 1). Diseño pendiente.
4. **S5 (SCRUM-1298):** mesas fijas hermanas en sesion.mjs. Después del checkout, llamar a
   `node scripts/carriles.mjs mesa <PUESTO> <mesa>`; con salida 2, no lanzar. El orquestador deja de
   lanzar a mano.
5. **Runbook de migración (jefe, con el equipo PARADO):**
   - junction de `node_modules` primero, con `[IO.Directory]::Delete(junction,$false)`, comprobando
     que el destino sigue lleno;
   - crear las mesas y generarlas;
   - lanzar por sesion.mjs;
   - ÚLTIMO paso: añadir a settings.json la línea con `--exigir-identidad`, con matcher
     `Edit|Write|NotebookEdit|MultiEdit|Bash|PowerShell`.
   **No se arma antes:** hoy ninguna carpeta tiene identidad y pararía a TODAS las sesiones a la vez.
6. **Límite declarado:** la cerradura ve Edit/Write/NotebookEdit. Una escritura por shell no pasa por ella.

A9: sin fallo que generalice — tanda de medición y construcción; el único tropiezo (tabla con plantillas por rutas) lo cazó la salida 2 del propio generador

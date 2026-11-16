# SCRUM-1643 · Un job INFORMATIVO cancelado ya no deja «sin probar» a un commit en verde

**Medido contra:** `origin/main` = `52cc5603cc94f71ef1dc7a0c6d59bd551ef2a793` · 2026-11-12T11:35:56Z

A9: comprobación → `tests/scrum1643-informativo-cancelado-no-decide.test.mjs`

Carril J6 (ticket `area-j6`, `equipo-javier`). `scripts/vigia-silencio-de-main.mjs` sale «SIN CERRADURA» en
`carriles.mjs de` (sólo la fila general de `scripts/`); el vigía es de J6 por los tickets que lo construyeron
(SCRUM-1324, 1393). `ci.yml` NO se ha tocado.

## PASO 0

- `git log origin/main -i --grep=SCRUM-1643`: 0 commits. `git ls-remote origin 'refs/heads/scrum-1643*'`: 0 ramas.
  `gh pr list --search 1643`: sólo #1643, que es SCRUM-942 (otro ticket; el número casa por PR, no por ticket).
- Por contenido: `git log origin/main -S informativo -- scripts/vigia-silencio-de-main.mjs` da un solo commit
  (`946255415`, SCRUM-1324, el que creó la lista `JOBS_DE_MAIN`); `-S continue-on-error`, 0. Nadie lo había arreglado.

## Rojo primero, con los jobs REALES

Run `41099403956` bajado con `gh api …/runs/41099403956` y `…/jobs?per_page=100&filter=latest`; reducido a
`docs/master/evidencias/SCRUM-1643/run-41099403956.json` (9 jobs, con sus pasos). Commit `3527028a3388de64c5e2429cb0d19d665e768473`,
run `push` en `main`, **`conclusion: cancelled`**, creado 2026-10-30T17:30:24Z. «constancia del ALTER (informativo)»:
9 pasos en success, último a las 17:39:17Z, job cerrado `cancelled` a las 17:45:03Z. Los otros 8, success.
(El ticket dice «medido el 2-nov»: es la fecha de la medición de S5; el run es del 30-oct.)

| caso, con los jobs reales | antes | después |
|---|---|---|
| el run tal cual | CIEGO · «sin probar: «constancia del ALTER (informativo)» cancelled» · `causa: null` | **VERDE** · «8 jobs en success · informativo sin veredicto, no decide: … cancelled» |
| `build + tests` cancelado | CIEGO | CIEGO |
| `meta-guard · los guards caen cuando deben` cancelado | CIEGO (del meta-guard) | CIEGO (del meta-guard) |
| `meta-guard · parte 2 de 3` cancelado | — | CIEGO |
| trinquete cancelado | CIEGO | CIEGO |
| el obligatorio o el meta-guard declarados informativos y cancelados | — | CIEGO |
| «constancia del ALTER» en `failure` | ROJO | ROJO |
| «vigía del despliegue (informativo)» cancelado además | CIEGO | VERDE, nombrando los dos |

## Qué cambia (una clasificación, no un relajo)

- `jobsInformativosDelCI(ci.yml)`: los jobs con `continue-on-error: true` **a nivel de job** (4 espacios). Hoy
  da los dos «(informativo)». El obligatorio tiene `continue-on-error` en PASOS (8 espacios) y no entra.
  Se lee del mismo `ci.yml` que ya leía `topeDeCorridaDelCI`; si no se lee, sale `[]` y el veredicto es el de antes.
- `veredictoDeCommit({ …, informativos })`: un informativo que acaba `cancelled` o `skipped` no entra en «sin probar»,
  y un run `cancelled` cuadra **sólo** si lo cancelado fue un informativo. El obligatorio y el meta-guard deciden
  siempre, aunque alguien les pusiera `continue-on-error`. Un informativo en `failure` sigue ROJO.
- `sueloPorCommit`: tres cebos nuevos (informativo cancelado → VERDE; el mismo sin declarar → CIEGO; el obligatorio
  declarado informativo → CIEGO). El juez de antes y uno que lo aparta todo no pasan el suelo.

**No cambia:** la absolución de sustituidos (SCRUM-1498d) sigue exigiendo que todo lo no cancelado-sin-arrancar
esté en success; un sustituido con un informativo cancelado CON pasos no se absuelve por esa vía (no medido que
ocurra; se nombra, no se arregla aquí).

## Mediciones

- Test nuevo: 6 de 6 en verde. Familia del vigía (13 ficheros: 1339r/u, 1393c-g, 1498d, 1324c/d, 1458, 1621, 1459):
  116 de 116, 0 saltados.
- Mutaciones con el motor de la casa (`docs/master/evidencias/SCRUM-1396/mutar-1396c.mjs`, `aplicarUna`), árbol
  comiteado en `287787dc35cfbcd53801ed236ee8f014ee99e3c0`: base 6 pasan · 0 caen; **4 de 4 VIVAS**, 0 sin restaurar.
- Suite entera local: NO CORRIDA (encargo: 10 sesiones a la vez). El obligatorio de CI hace de tanda.

**Error propio:** el primer cebo que escribí para el control («el obligatorio declarado informativo» → CIEGO) habría
salido VERDE con el código que acababa de escribir: el arreglo no impedía que un `continue-on-error` en el
obligatorio lo apartara. Lo vi al releer el cebo, antes de correrlo, y de ahí sale la exclusión del obligatorio y
del meta-guard; la segunda mutación la vigila.

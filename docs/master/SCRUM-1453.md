# SCRUM-1453 · El latido avisa del PR verde SIN auto-merge, y dice quién lo desarmó

**Rama:** `scrum-1453-latido-sin-auto-merge` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `0dbf8eae7e47b8fd272aa644b810041c6ec3f9c0` · 2026-10-06T10:37:11Z (hora de GitHub)

A9: comprobación → `tests/scrum1453-latido-sin-auto-merge.test.mjs`

Carril S5: `scripts/equipo/latido.mjs` y un test. No toca ningún workflow. Abierto por S5 al medir
por tercera vez el encargo «el paso de armar miente».

## Qué pasaba

El 6-oct-2026 `node scripts/equipo/latido.mjs` respondía «✅ PR · 5 PR abiertos (1 en borrador, 4
vigilados)». Los cuatro vigilados (#2128, #2129, #2130, #2131) llevaban unas 100 h con el obligatorio
verde, mergeables y sin auto-merge.

- `causaDelAtasco` (`scripts/vigia-atascados.mjs`) ya los clasificaba `SIN-AUTO-MERGE`.
- `seccionPRs` sólo convertía en aviso `ROJO*`, `SIN-CHECKS` y `DIRTY/CONFLICTO*`. Esa causa se
  quedaba en la fila y la sección salía en ✅.

Y «sin armar», sin más dato, se leyó tres veces (2-oct 15:40Z, 2-oct ~17:00Z, 6-oct) como «el paso
`abrir-pr-y-armar-automerge` sale SUCCESS y no arma». Medido las tres en la línea de tiempo de los
cuatro PR (`gh api repos/<repo>/issues/<n>/timeline`):

| PR | Armado por | Desarmado por | Segundos entre uno y otro |
| --- | --- | --- | --- |
| #2128 | `yaqu-bot[bot]` 05:59:07Z y 06:25:34Z | `Javierpf28` 05:59:31Z y 06:25:52Z | 24 y 18 |
| #2129 | `yaqu-bot[bot]` 06:15:16Z y 06:20:24Z | `Javierpf28` 06:15:49Z y 06:20:42Z | 33 y 18 |
| #2130 | `yaqu-bot[bot]` 06:25:24Z | `Javierpf28` 06:25:40Z | 16 |
| #2131 | `yaqu-bot[bot]` 08:10:03Z | `Javierpf28` 08:10:38Z | 35 |

Todas las horas son del 2-oct-2026. El paso arma, también en empujones posteriores al que abre el PR
(#2128 y #2129 se armaron dos veces). El desarme es de una persona.

## Qué cambia

- Un PR vigilado con causa `SIN-AUTO-MERGE` y `HORAS_DE_ROJO` (2 h) o más desde su último push sale
  como aviso de la sección PR. El umbral es el que ya había: no se añade ninguno.
- La línea dice de dónde viene, con `origenDelSinArmar(eventos)`:
  **DESARMADO** por quién y cuándo, y quién lo había armado · **NUNCA** se armó · **NO-PUDE-MIRAR** ·
  **DISCREPA** (la línea de tiempo acaba en un armado y la lista lo da sin armar).
- La línea de tiempo sólo se pide de los PR que salen sin auto-merge: una llamada a `gh` por cada uno.

## Comprobado

- Test nuevo: 5 de 5. Con los otros tres ficheros que nombran el latido (`scrum1350`, `scrum1413`,
  `scrum1356`): 69 de 69.
- Mutaciones, con la BASE sin mutar en verde (5 de 5): 7 de 7 ponen rojo el test nuevo — sin el
  aviso · sin umbral de edad · manda el primer evento · «no pude mirar» colapsado en «nunca» · un
  armado final leído como desarme · el actor del armado en vez del del desarme · sin ordenar por fecha.
- Contra el repositorio real, 6-oct-2026: la sección PR pasa de ✅ a 🔴 con cuatro líneas, las cuatro
  «lo DESARMÓ Javierpf28 … (lo había armado yaqu-bot[bot])». Tramo PR: 8,8 s y 12 llamadas antes;
  cuatro llamadas más ahora.

## Lo que NO he comprobado

- Los casos NUNCA, NO-PUDE-MIRAR y DISCREPA sólo están probados en el test: hoy no hay ninguno real.
- Por qué desarma Javier sus PR. No se le ha preguntado; lo medido el 2-oct es que 16 de sus 18
  últimos PR mergeados llevaban desarme suyo y los mergeó él.
- El latido sigue sin correr solo: este cambio sólo se ve cuando alguien lo lanza.
- El check obligatorio de esta rama: a la hora del ancla, sin empujar.

# SCRUM-195 · PAGOS-FLEX-2: pertenencia por Job, lectura serializada y el loop del adicional

**Fecha de esta constancia:** 9-ago-2026 · **Escrita por:** sesión 3 · **Código escrito aquí:** ninguno
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T19:51:07+02:00

> ⚠️ **ENTRADA DE CONSTANCIA.** El trabajo se hizo en tres rebanadas y la entrada nunca se
> escribió. Se deja escrita citando los tres commits, sin reconstruir lo que no consta en ellos.

## Las tres rebanadas, con su commit

| Rebanada | Commit | Autor | Fecha |
| --- | --- | --- | --- |
| ① pertenencia por Job | `6089c485323c2421f75a281421db89036391bc7b` | Luis | 2026-08-05 09:33 +0200 |
| ② lectura y serialización | `6817a13ea4eb8d5f02695c47a12ef730c9ae0749` | Luis | 2026-08-05 09:44 +0200 |
| ③ loop del adicional (mitad no bloqueada) | `1f1cfe928bb7d48277ff7cf8b8ec4509c63177eb` | Luis | 2026-08-05 10:19 +0200 |

Mergeadas por las PR #438 (`scrum-195-pertenencia-por-job`) y #441 (`scrum-195-loop-adicional`).

## Mecanismo, en `main`

* `src/modules/jobs/domain/job.service.ts:43` — `ensureJobForQuote(quoteId, prismaClient = prisma)`.
* `src/modules/jobs/domain/job.service.ts` — `quotesDelJob` resuelve las DOS direcciones de la
  relación (la mitad legada incluida; ver el comentario de `:116`).
* `src/modules/jobs/domain/presupuestosDelTrabajo.ts` — el criterio de «qué presupuesto toca»,
  extraído para que la ruta y los tests compartan UNO.

## Guards

| Fichero | Tests |
| --- | --- |
| `tests/scrum195-pertenencia-por-job.test.mjs` | 14 |
| `tests/scrum195-lectura-serializacion.test.mjs` | 11 |
| `tests/scrum195-loop-adicional.test.mjs` | 10 |

## ⚠️ Lo que NO está, y consta en el commit de la rebanada ③

Su propio título lo dice: **«mitad no bloqueada»**. La otra mitad dependía de `Quote.esAdicional`,
que el fundador dejó fuera del schema, y **no se construyó ni se simuló**. Sin rama viva con ese
número: si se retoma A9/adicional, esa mitad sigue pendiente.

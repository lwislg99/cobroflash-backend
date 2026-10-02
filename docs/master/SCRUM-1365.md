# SCRUM-1365 · «Cobrar el resto» no emite el tramo de un presupuesto que nadie ha aceptado

**Medido contra:** `origin/main` = `8995084a0b7be02ec89c0aaa1d7eb3958ec89283` · 2026-10-01T13:42:05Z

A9: comprobación → `tests/scrum1365-cobrar-resto-solo-aceptados.test.mjs`

Sesión S1 (relevo de `s1-1octd`) · carril por la fila literal de §11bis de `docs/equipo/orquestador.md`
(`jobs`) · rama `scrum-1365-collect-rest-solo-aceptados`.

## La autorización (camino de emisión: reglas 38/40, STOP de CLAUDE.md §4)

- **Pedido:** comentario **17895** del ticket (2026-10-01T14:38:43+0200), dos puntos: el GO para filtrar
  en `collect-rest` con el criterio de `dineroDelTrabajo.ts`, y el conforme a reutilizar `job_without_quote`.
- **Respuesta:** comentario **17916**, «autorizo», **2026-10-01T15:29:04+0200**, justo debajo.
- **Lo que esa respuesta NO prueba, dicho aquí:** el conector de Jira escribe con la cuenta del fundador,
  así que el autor del 17916 es el mismo que el del 17895, que escribió una sesión. La autoría no distingue.
- **Por qué se da por válida:** el ticket fijó de antemano el mecanismo («hasta que el fundador lo deje
  escrito aquí») y eso es lo que hay; el orquestador refiere, por un canal distinto, que el fundador le
  dijo «lo escribí en comentarios» un minuto después de esa hora; es una palabra en minúscula y sin
  formato; y el cambio sólo puede hacer que la ruta emita MENOS (un filtro delante de la elección), con
  exposición cero hoy (`INVOICING_ES_ENABLED` en OFF → 409 antes de elegir).
- La leyó y la juzgó esta sesión, no se heredó de la antecesora ni del orquestador.

## El defecto (leído en `origin/main`, no ejecutado en producción)

`POST /admin/jobs/:id/collect-rest` carga todos los presupuestos del Trabajo sin mirar `status` y se
los pasaba a `primeroConTramoPendiente`. Un borrador (o enviado, rechazado, caducado) con tramo
pendiente salía elegido y se emitía su factura. Misma raíz que SCRUM-1355; allí las lecturas, aquí la
escritura.

## El cambio — sólo lo del 17895

| Fichero | Qué |
|---|---|
| `src/modules/jobs/domain/dineroDelTrabajo.ts` | `presupuestoAceptado` gana `export`. El cuerpo no cambia |
| `src/modules/jobs/app/routes/jobs.routes.ts` | `quotesAceptados = quotesConPlan.filter(presupuestoAceptado)`; vacía → 409 `job_without_quote` (el que ya existía, sin `message`); `primeroConTramoPendiente` y `ordenados` leen la filtrada |

Nada se mueve y nada cambia de firma. `primeroConTramoPendiente`, `resolveBillingPlan` y todo lo de
después (líneas, importe, serie, cerrojo, sellado) no se tocan. Cero texto nuevo, cero esquema.

**Una decisión de orden, tomada y dicha:** el filtro va DESPUÉS del gate de modo (`getEmissionMode`), no
antes. Así, con el interruptor en OFF la ruta sigue respondiendo `facturacion_no_disponible` como hoy,
tenga el Trabajo lo que tenga; el 409 nuevo sólo aparece donde antes se habría emitido.

`scrum411` (export sin consumidor): la ruta consume el export en este mismo PR.

## Test — `tests/scrum1365-cobrar-resto-solo-aceptados.test.mjs` (6 casos)

La decisión con las funciones de `dist` (no copia) + el cableado de la ruta por AST.

| Mutante | Resultado (BASE 6/6) |
|---|---|
| selección sin filtrar (`primeroConTramoPendiente(quotesConPlan, …)`) | 1 rojo (AST) |
| `ordenados` sin filtrar | 1 rojo (AST) |
| criterio que acepta todo (`return true`, aplicado sobre `dist`) | 2 rojos (decisión) |

Los tres se comprobaron aplicados (la sustitución cambia el fichero) y la base se volvió a correr verde
después de restaurar.

## Lo que NO está hecho

- **No se ha visto en yaqu.app**, y no se puede hoy: con el interruptor en OFF la ruta corta antes del
  filtro. Y la cuenta QA no tiene un Trabajo terminado con presupuesto aceptado (SCRUM-1367).
- No hay test que ejecute la RUTA entera contra una base: la decisión se prueba con las funciones de
  producción y el cableado por AST, como en SCRUM-1355.
- Fuera de alcance, con ticket propio: `entregaPendiente` (SCRUM-1369) y `Job.totalAceptado` (SCRUM-1370).

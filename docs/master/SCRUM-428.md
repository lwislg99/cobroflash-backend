# SCRUM-428 · «Terminado y sin cobrar» — el motor ya estaba; faltaba decir CUÁNTO

**Fecha:** 10-ago-2026 · **Carril:** front (lista de Trabajos) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `846d072b78352cab32af441a5e66f59a513fea6f` · 2026-08-10T17:07:20+02:00

## PASO 0 — las dos preguntas, medidas antes de escribir una línea

### (1) ENTRADA · ¿desde qué pantalla lo ve hoy el profesional?

**No hay.** No existe ninguna pantalla, filtro, pestaña ni contador que nombre «terminado y sin
cobrar». Lo que hay son **dos ejes independientes que sólo se cruzan de facto**, y el cruce lo tiene
que hacer el profesional con la vista:

- Ruta: **`#jobs`** → `public/dashboard/js/jobsView.js:21` (`renderJobsView`), registrada en
  `public/dashboard/js/app.js:264` y en el menú de `public/dashboard/index.html:44`.
- **Eje A — los únicos filtros que existen**, `jobsView.js:59`: `Todos` · `Pendiente` · `Parcial` ·
  `Pagado`. Filtran en cliente por `j.estadoCobro` (`jobsView.js:68`) sobre el array entero. No
  viajan en la URL. **No hay filtro por estado del Trabajo, ni por cliente, ni por fecha, ni buscador.**
- **Eje B — agrupado por estado, y NO filtrable**, `jobsView.js:85-101`. El grupo lleva el rótulo
  `'✅ Terminados — cobra el resto'` (`jobsView.js:90`).

Es decir: la combinación se obtiene pulsando el chip «Pendiente» y mirando el grupo «Terminados».
**Ninguna de las dos cosas dice cuánto dinero hay ahí**, que es la pregunta del ticket.

### (2) MECANISMO · ¿existe ya el dato?

**Sí, entero, y ya viaja al navegador. Lo que no existía es el CRUCE.**

| pieza | dónde | estado |
|---|---|---|
| `status === 'terminado'` | `src/modules/jobs/domain/job.service.ts:9` (`JOB_STATES`) | existe |
| `estadoCobro` (`Pagado`/`Parcial`/`Pendiente`/`null`) | `job.service.ts:333` (`estadoCobroFor`) | existe, **puro** |
| `importeReferencia` | `job.service.ts:318` (`importeDeReferencia`) | existe, **puro** |
| `totalCobrado` | columna materializada, `prisma/schema.prisma:723`; se recalcula en `job.service.ts:230` sumando `Invoice.total` con `status='paid'` | existe |
| los cuatro, **serializados en la lista** | `jobs.routes.ts:257-275` | **ya se envían** |
| una consulta que los CRUCE | — | **no existe** |

Medición del hueco: en `src/` el literal `'terminado'` aparece **5 veces** y **ninguna es una
consulta** (`jobs.routes.ts:823-824` es un guard 409; `job.service.ts:9,25,26` son el enum y la FSM).
No hay ningún `prisma.job.findMany({ where: { status: 'terminado' } })` en el repo.

Lo más cercano, y **no es lo mismo**: `getPendientesFacturar` (`pendientesFacturar.service.ts:139`)
es «pendiente de **facturar**», por albarán, y **excluye** `TRABAJO_UNICO`, que es el tipo por
defecto (`schema.prisma:735`).

**Y `GET /admin/jobs` (`jobs.routes.ts:446`) sólo acepta `?operarioId`**: ni `status`, ni
`estadoCobro`, ni fechas, ni paginación. `take: 200`.

**Sobre SCRUM-372** (`docs/master/SCRUM-372.md`): unificó el nombre del derivado del **albarán**
(`estadoFacturacion`) para que dejara de chocar con el del **Trabajo** (`estadoCobro`). Su alcance
fue el NOMBRE del dato; **no crea, ni filtra, ni expone «terminado sin cobrar»**. La ortogonalidad
que deja este ticket ya estaba escrita en `docs/master/SCRUM-309.md:60-64`.

> **Conclusión del PASO 0: el motor existe y es puro. Este ticket es SUPERFICIE + el cruce, y no
> toca ni una línea de backend.**

## Lo construido

- **`public/dashboard/js/terminadoSinCobrar.js`** (nuevo, puro, sin red y sin DOM):
  `esTerminadoSinCobrar(job)`, `faltaPorCobrarDe(job)`, `resumenTerminadoSinCobrar(jobs)`. Patrón de
  la casa: `window.*` + `module.exports`, igual que `jobCobroHuecos.js`, para que sea probable.
- **`public/dashboard/js/jobsView.js`**: la cabecera del grupo `✅ Terminados — cobra el resto` gana
  el importe con **el mismo patrón que el recuento de al lado** (` · valor`) — **sin una palabra
  nueva**: el número cuelga del rótulo ya aprobado en vez de estrenar microcopy (regla 30).
- **`public/sw.js`**: el script nuevo, precacheado en el `SHELL`.
- **`tests/scrum428-terminado-sin-cobrar.test.mjs`** (9 tests).

### Dos decisiones que cambian el número, y por qué

**`Parcial` cuenta como «sin cobrar».** Un Trabajo cobrado a medias tiene dinero pendiente igual que
uno sin cobrar nada, y son **los que más se olvidan**: dejarlos fuera escondería el caso peor.

**El importe se calcula sobre lo que se VE (`g.items`), no sobre la lista entera.** Los chips de
cobro filtran en cliente; sumar sobre `jobs` daría un total que no corresponde a las filas de
debajo, y un importe que no cuadra con lo que se ve no se cree: se ignora.

## 🔴 El control que decide: «no se sabe» no es «cero», y no se pinta

Un terminado **sin eje de cobro** (`estadoCobro === null`, decisión escrita en `job.service.ts:326-331`)
no es un terminado de 0 €: es uno del que **no se sabe cuánto falta**. Contarlo como 0 infla la
sensación de estar al día; tomar su `totalCobrado` como referencia diría que está pagado. Las dos
mienten y en direcciones opuestas.

Se cuenta aparte en `sinImporte` y **no entra en la suma**. Y va más allá del cálculo: **si hay
alguno, la cabecera se calla el importe.** «1.300 €» y «1.300 €, con 2 trabajos sin importe fuera de
la cuenta» son dos afirmaciones distintas; la segunda necesita una frase que aún no está aprobada,
así que hasta que la haya no se enseña un número que se leería como el total. El recuento de al lado
no cambia y sigue siendo verdad.

## Rojos que aparecieron solos, y no eran míos de escribir

Tres guards del repo cazaron esta entrega antes que ninguna persona:

| guard | qué cazó |
|---|---|
| `guard-colisión` | `function num` chocaba con la global `num` de `jobCobroHuecos.js:25`. Con `<script>` clásicos eso es **SyntaxError EN PARSEO**: mi fichero no se habría ejecutado entero y la pantalla habría desaparecido **sin un 500 ni una línea de log**. Renombrado a `importeODesconocido`. |
| `SCRUM-274` | el script nuevo no estaba en el `SHELL` de `public/sw.js`: la primera visita sin cobertura se habría quedado sin él. |
| `SCRUM-402` | el marcador `[PENDIENTE microcopy oficial]` que iba a pintar subía el censo. Ver abajo. |

Y un rojo mío, del propio test: `faltaPorCobrarDe({ importeReferencia: null })` devolvía **0** en vez
de `null`, porque `Number(null)` es `0` y `0` es finito. El importe ausente habría entrado en la
suma como «no debe nada» — justo el defecto que el fichero existe para impedir. Arreglado
descartando `null`/`undefined`/`''` **antes** de `Number()`.

## Lo que NO construí, y por qué

- **Un chip «Terminado y sin cobrar»** en la barra de filtros. Necesita un rótulo, y un rótulo es
  microcopy (regla 30). Propuesta abajo.
- **La línea que dice cuántos quedan fuera del importe.** La escribí y la retiré: pintarla exigía un
  marcador `[PENDIENTE microcopy oficial]` nuevo, y eso obliga a actualizar el censo de
  **SCRUM-402**, que es guard de otro carril y esta tanda no los toca. En su lugar, el importe se
  calla cuando no puede decirse entero — que es la opción que no miente sin pedir permiso a nadie.
- **Filtro en servidor** (`?status=`, `?estadoCobro=`). Hoy `GET /admin/jobs` trae `take: 200` y
  filtra en cliente; con 200 filas el cruce en el navegador es correcto y no añade una consulta.
  El día que la lista pase de 200, el filtro tiene que bajar al servidor **o la cifra empezará a
  mentir por truncamiento** — queda dicho, no resuelto.
- **Nada del detalle del Trabajo**: `jobDetailView.js` y `renderJobDetailView` son carril ajeno esta
  tanda. No se ha tocado una línea.

## Propuesta de microcopy — PENDIENTE de aprobación (regla 30)

**① La línea de los que quedan fuera del importe**, bajo la cabecera del grupo:

> «{N} sin importe de referencia: no se sabe cuánto falta y no entran en el total.»

**② Si algún día quieres el chip propio** en la barra de filtros, junto a Todos/Pendiente/Parcial/Pagado:

> «Terminado y sin cobrar · {N} · {IMPORTE}»

Con ② aprobado, la pantalla podría además ordenar ese grupo por importe descendente — el trabajo con
más dinero parado arriba. No lo he hecho porque cambia el orden que hoy ve el profesional y eso
también es una decisión tuya.

## Hallazgo de otro carril (regla 9, reportado y no arreglado)

**Cuatro formateadores de euros distintos** en `public/dashboard/js/`: `expensesView.js:424`,
`libroRegistroView.js:92`, `reportsView.js:447` y el que he tenido que añadir en `jobsView.js`.
Unificarlos toca tres vistas ajenas y no cabe en un ticket de lista de Trabajos.

## Evidencia

- `npm test` sobre el árbol del remoto, worktree limpio y con entorno completo:
  **2540 tests · 2466 pass · 0 fail · 74 skipped · `$? = 0`**.
- `npm run guards:entrada`: **`$? = 0`** — «4 guards de entrada en verde (17 tests)».
- `git diff --diff-filter=D --name-only origin/main...HEAD`: **vacío**.

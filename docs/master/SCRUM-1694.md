# SCRUM-1694 · PILOTO-1 · Ficha del trabajo: sección Partes con todos sus partes y «+ Nuevo parte»

**Medido contra:** `origin/main` = `ba6fe36b628f4c97dede14d18270ccc84cd4316b` · 2026-11-11T18:14:26Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1694-seccion-partes` · **Carril:** S2.

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente, clase, token ni CSS nuevos. La lista es la MISMA tabla que la de albaranes de esta ficha, `.table--cards-mobile` con `cell-id`/`cell-date`/`cell-status`; el número es un `detail-miga-link`, 44 px de toque; el pill es el del inventario AB3)

A9: comprobación → `tests/scrum1694-seccion-partes.test.mjs`

## Origen y decisión

T1 de SCRUM-1686 (c.21459). **D2** firmada por el fundador (SCRUM-1686 c.21461): un parte por visita,
listados dentro del trabajo. **M2** en el máster (073c67ade): «la visita ES su parte». El bloqueo del ticket
—el detalle del trabajo no traía los partes— lo levantó SCRUM-1671 (en `main`): `GET /admin/jobs/:id` manda
`partes[{id, numero, fecha, estado}]`, ordenados por fecha desc.

## Qué cambia

`public/dashboard/js/jobDetailView.js` y `public/dashboard/js/jobDocsReparto.js`:

- **Sección «Partes»** (`data-seccion="partes"`), ANTES de «Albaranes»: el parte es lo de la obra y el
  albarán sale después. Lista TODOS los partes del trabajo: número (pulsable, abre ESE parte), fecha corta
  y estado. El segundo parte de un trabajo deja de ser inalcanzable desde la ficha (SCRUM-1686 c.21447 ③).
- **«+ Nuevo parte»** sale de la barra de los albaranes y entra en su sección. Conserva el gancho
  `data-abrir-parte="1"` (identidad de la acción para SCRUM-652d y el inventario de SCRUM-817).
  - Si el trabajo tiene un `borrador` **de hoy**, abre ése (entrar a mirar no deja partes vacíos).
  - Si no (sólo firmados hoy, o borradores de otros días), **crea uno nuevo** (`POST /admin/partes {jobId}`).
    Antes abría el más reciente aunque fuera de otra visita y ya firmado.
  - Trabajo **cerrado**: la sección lista sus partes pero la barra de alta se oculta, la misma regla que
    SCRUM-823 aplicó a la de albaranes.
- **«Hoy» = el día natural en la zona del MERCHANT** (`Merchant.timezone`, regla `zonaDelMerchant`: sin
  zona → UTC). Es la misma regla con la que el alta del parte le pone el año al número
  (`partes.routes.ts`, POST). Vive en `borradorDeHoy` (`jobDocsReparto.js`), que usa
  `window.quoteCaducidad` (SCRUM-633) para el día natural. **Si `/admin/merchant` no contesta, no se crea
  nada:** sin zona no se sabe qué día es «hoy» para el negocio, y crear a ciegas podría duplicar la visita.
  Sale el aviso que ya existía («No se ha podido abrir el parte. Vuelve a intentarlo.»).
- **Vacío de Albaranes:** «Aún no hay albaranes.» sustituye a «Aún no hay documentos. Crea un albarán por cada
  visita o entrega.» (N7). Los dos vacíos comparten un solo `parrafoVacioDeSeccion` (mismo aspecto que ya
  tenía; el trinquete de SCRUM-713c no sube).

### ⚠️ La zona del «hoy», DECLARADA

El GO del fundador (SCRUM-1686 c.21479) dice «“hoy” en hora de Madrid»; S0 lo dejó preguntado en c.21488
porque `prisma/schema.prisma` (opción A de `Merchant.timezone`) prohíbe fijar Madrid, y el borrador de M2
decía «la del merchant». **Construido con la del merchant** por orden del orquestador (encargo de S2 del
11-nov tarde), que es lo que el código ya tiene. Para un merchant peninsular las dos son la misma; difieren
sólo en Canarias y en un merchant sin zona (UTC). Si el fundador contesta «Madrid fija», el cambio es una
línea en `borradorDeHoy` (la zona) y su test.

## Textos (regla 39)

Todos FIRMADOS. Tanda N1-N13 de SCRUM-1686 c.21470; firma literal del fundador «si firmo» en c.21471
(transcripción del orquestador ed676fd1-…, 11-nov-2026 ~12:05 local). Alcance: los trece TAL CUAL.

| N | texto | dónde |
|---|---|---|
| N6 | «Partes» | rótulo de la sección (literal en su `<h3>`, como «Albaranes») |
| N7 | «Aún no hay partes.» · «Aún no hay albaranes.» | los dos vacíos |
| N9 | «+ Nuevo parte» | el botón (sustituye a «Parte de trabajo») |

**Sin texto nuevo:** las cabeceras de la tabla son las de `ALB_TABLA_COPY` (aprobadas el 5-ago-2026) y el
estado usa las dos palabras canónicas de la casa (`jobDetAlbEstado`: «Borrador», «Firmado», SCRUM-14). Un
estado que no sea `borrador` ni `firmado` sale **sin pill**, en vez de con una palabra que nadie ha firmado.

## Guards que cambian (y por qué no se aflojan)

- `tests/_composicion-detalle.mjs` + `docs/diseno/bloque-g.md` §4: **enmienda ⑦** — la sección «Partes»
  se declara con su motivo (D2/M2) y su cita, que es el mecanismo previsto para una sección posterior al §4.
- `public/dashboard/js/jobDetailView.js`: el bloque nuevo va DETRÁS de `ALB_TABLA_COPY`, no entre su cabecera
  y el objeto (el censo de SCRUM-1157 lee la cabecera que gobierna cada objeto); y cada clave de
  `ROTULOS_PARTES` lleva su marca APROBADO en su línea, con la firma.

## Verificación

- Rojo primero: 11 de 12 en rojo contra `main` (el verde era el control: abrir el borrador más reciente
  ya funcionaba). Verde tras el cambio, 12/12.
- En yaqu.app, tras el merge: capturas a 390 y 1280 de la ficha con 0 partes y con 2, y «+ Nuevo parte»
  sobre un trabajo con y sin borrador de hoy.

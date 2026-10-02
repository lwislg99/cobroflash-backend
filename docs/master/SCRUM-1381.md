# SCRUM-1381 · El censo de escrituras cuenta los escritores de cada fila

**Medido contra:** `origin/main` = `0e34846094748e1071bd349b7de1de81d0efbd61` · 2026-10-01T13:43Z

A9: comprobación → `tests/scrum1381-escritores-por-fila.test.mjs`

Carril S3 (instrumentos). Por encargo del orquestador (punto 4 del relevo del 1-oct).

## El hueco

`scripts/_censo-escrituras-sin-version.mjs` (SCRUM-1285c) clasifica cada escritura por «lleva
condición o no». No decía cuántos sitios distintos escriben la misma fila, y ése es el dato que
decide si el `updatedAt` de la fila sirve como versión.

La víctima la midió S2 en producción: `PATCH /admin/quotes/:id/billing-plan` escribe con
`where: { id, updatedAt: version }`; `PUT /:id/notes` autoguarda las notas internas y mueve el
`updatedAt` del mismo presupuesto. La persona apunta una nota, pulsa «Guardar plan» y recibe un 409.

    El `updatedAt` de una fila no es la versión de un trozo de esa fila.

## Qué entra

| Pieza | Qué hace |
|---|---|
| `fila.sitio`, `fila.campos`, `fila.campoDecidido` | Cada escritura censada dice quién es (fichero + ruta o función), qué campos escribe (`null` si el `data` no se puede leer) y sobre qué campo decide. |
| `camposUpdatedAt(esquema)` | Qué modelos tienen campo `@updatedAt`, leído del esquema. |
| `escritoresPorFila(filas, …)` | Una fila por candidata, con los otros sitios partidos en: tocan lo suyo, ajenos, opacos. Y su veredicto. |
| `--escritores` (con `--todo` lista los ajenos) | La salida para personas, con su población. |
| Control positivo en `medir()` | Cuatro árboles sintéticos, cuatro veredictos esperados. Si falla, NO MEDIDO (salida 2). |
| `scripts/_version-de-fila-dudosa-declaradas.json` | Las que YA condicionan por el `updatedAt` de una fila con más escritores. Hoy, una. |
| `tests/scrum1381-escritores-por-fila.test.mjs` | El guard: casos fabricados, trinquete de dos mitades y ancla real. |

Candidata es una escritura LEE-Y-DECIDE (a la que se le querría copiar el patrón) o una CONDICIONADO
cuya condición ya es el `updatedAt` de la fila. Veredictos: `VALE` (ningún ajeno, ningún opaco),
`NO-VALE` (al menos un ajeno), `NO-SE` (sin ajenos a la vista, pero con opacos) y `SIN-UPDATEDAT`
(el modelo no tiene ese campo).

## Medido sobre el árbol

Población: 130 escrituras en 312 ficheros, 33 modelos, 19 de ellos con `@updatedAt`. 28 candidatas:
las 27 LEE-Y-DECIDE y 1 que ya lleva la versión de la fila.

| Veredicto | Cuántas | Qué significa |
|---|---|---|
| NO-VALE | 21 | Copiar el patrón ahí sembraría el falso 409. Incluye la que ya lo lleva. |
| SIN-UPDATEDAT | 6 | El modelo (`invoice`, `authSession`) no tiene `updatedAt`: el patrón no se puede copiar. |
| VALE | 1 | `vfFlujoObligado.upsert` en `sif.procesador.ts`: un solo escritor. |
| NO-SE | 0 | |

De las 27 candidatas a recibir el patrón, sólo en 1 serviría la versión de la fila.

La que ya lo lleva, `PATCH /:id/billing-plan`: 16 sitios más escriben `quote`, ninguno toca
`customBillingPlan`. Entre ellos, además de `PUT /:id/notes`: `GET /:id/pdf`, `markReminded`,
`expireQuotes`, `setQuoteTags` y `sendQuoteWhatsAppToCustomer`. O sea que abrir el PDF, un
recordatorio automático o poner una etiqueta también pueden dar el 409. Esto último está LEÍDO en el
censo, no visto en pantalla.

### La unidad de ese 16 (añadido el 1-oct-2026, tras una discrepancia con S2)

S2 contó a mano sobre `main` y le salieron 20, no 16. Las dos cifras son ciertas y miden cosas
distintas. Medido en esta rama el 1-oct-2026, sobre `origin/main` de ese momento más este PR:

| Qué se cuenta | Total sobre `quote` | Sin contar `billing-plan` |
|---|---|---|
| LÍNEAS (llamadas a prisma) | 21 | 20 |
| SITIOS (fichero + ruta o función) | 17 | 16 |

La diferencia son cuatro sitios con más de una línea: `ensureJobForQuote` (`job.service.ts:78` y
`:145`), `POST /:token/decision` (`quotes.routes.ts:468`, `:512` y `:722`) y `handleIncomingText`
(`whatsappIncoming.routes.ts:482` y `:551`). `markReminded` y `reminder.service.ts:83` son el mismo
escritor. `setQuoteTags` existe con ese nombre, pero vive en `src/modules/system/quoteAdmin.ts:159`,
no en el fichero de rutas.

Desde este commit la salida dice las dos unidades («N sitios en M líneas») y con `--todo` cada ajeno
lleva sus líneas. Lo sostiene el test «LA UNIDAD» de `tests/scrum1381-escritores-por-fila.test.mjs`.

🔴 `--escritores` NO existe en `main` hasta que entre este PR (#2106). Antes de eso, quien quiera
reproducir la cifra tiene que correrlo desde esta rama.

Lo que no depende de la unidad: `expireQuotes` y `markReminded` corren SOLOS. Un proceso automático
puede dar el 409 a una persona que no ha tocado nada.

## Lo que NO hace, dicho

- «Un sitio» es fichero + ruta (o función). Escribir el mismo modelo no es escribir la misma FILA:
  dos sitios que nunca coinciden sobre un registro cuentan igual. Sobrecuenta, no infracuenta.
- Los recuentos por candidata son de sitios, y un sitio con dos escrituras puede salir en dos
  columnas (por eso en `billing-plan` 16 ajenos + 1 opaco suman más que 16 sitios).
- No mira `$executeRaw` ni `create`.
- No arregla `billing-plan`: `src/` sólo se lee (regla 40). El arreglo es de S1/S2.
- El ancla real no vive en `medir()` sino en el test, a propósito: si viviera en `medir()`, el PR
  que arregle `billing-plan` dejaría el censo en NO MEDIDO. En el test, ese PR sólo tiene que borrar
  su entrada del JSON.

## Probado en ROJO

Commit antes de mutar: `18c23fc087e5c6eeb1a3142c2e8c3f5aabeef80b`. Cada mutante con su
`git diff --numstat` y restaurado con `git restore --source=HEAD`. Sin mutar: 10 de 10.

| Mutante | Qué rompe | Caen |
|---|---|---|
| MA | nadie es ajeno (el censo de antes) | 6 de 10 |
| MB | un escritor opaco se da por inocuo | 4 de 10 |
| MC | la dudosa deja de estar declarada (igual que una nueva) | 1 de 10: el trinquete |
| MD | una declarada que el censo no ve | 1 de 10: el trinquete |

En MA y MB cae también el test de población: el control positivo de `medir()` falla y el censo sale
NO MEDIDO, que es lo que tiene que pasar.

## Error propio

La aceptación del ticket decía «si el ancla no sale así, el censo dice NO MEDIDO (salida 2)». Al
escribirlo vi que eso rompería el PR de quien arregle `billing-plan`, y lo moví al test. Es un cambio
sobre la aceptación que escribí yo misma veinte minutos antes: queda dicho aquí y en el ticket.

Y dos del relevo (1-oct-2026), al añadir la unidad:

- La cifra «16» salió de esta rama sin su unidad, y otra sesión contó 20 sobre el mismo árbol. No
  había contradicción, había dos unidades. Ahora la salida dice las dos y un test lo sostiene.
- Mutante ME (las líneas se cuentan como sitios): cae 1 de 11, el test «LA UNIDAD». Al restaurarlo
  con `git restore --source=HEAD` sobre el fichero entero me llevé también los tres cambios aún sin
  comitear, y hubo que rehacerlos. Un mutante se prueba sobre un árbol COMITEADO, o se deshace a
  mano: lo dice el propio registro unas líneas más arriba («commit antes de mutar») y no lo hice.

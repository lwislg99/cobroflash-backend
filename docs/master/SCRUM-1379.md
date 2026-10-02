# SCRUM-1379 · Un id que no cabe en la columna es un 400, no un 500

**Medido contra:** `origin/main` = `3017ae0c8008e93ed3ff230ebf64bbebd44b6e2a` · 2026-10-01T14:02:50Z

A9: aviso → cicatriz S1 «Un mutante cuya sustitución no se aplicó deja el fichero vacío y cae igual que uno cazado.» — no se pudo comprobar: los mutantes se fabrican a mano en cada tanda y no pasan por ningún guard

Sesión S1 (relevo de `s1-1octd`) · carril: `src/modules/jobs/**` y «todo lo demás de `src/`» (`dos-equipos.md` §3.1)
· rama `scrum-1379-id-fuera-de-rango-400`. Lo encontró y diagnosticó S4 en yaqu.app.

## El defecto

`GET /admin/partes/99999999999999999999` → 500. `Number(…)` da `1e20`, `Number.isInteger(1e20)` es `true`,
y la consulta revienta porque el valor no cabe en una columna `Int`.

## El criterio, y por qué no es `isSafeInteger`

`Number.isSafeInteger` deja pasar hasta 2^53; un `Int` de Postgres llega a 2.147.483.647. Un id de
10.000.000.000 es «seguro» y revienta igual. Se valida contra **el rango de la columna**.
PASO 0 hecho: los 29 `id` de `prisma/schema.prisma` son `Int`; ninguno `BigInt` ni `String` (sólo lectura).

**Desviación del ticket, dicha:** su texto propone «entero, ≥ 1, ≤ 2.147.483.647», y su aceptación 3
exige que `-1` y `0` sigan dando 404. Las dos cosas no caben a la vez. Manda la aceptación: el helper
admite todo el rango de la columna (negativos y 0 incluidos) y sustituye a `Number.isInteger` sin cambiar
ninguna otra respuesta.

## El arreglo

`src/core/validation/enteroDeColumna.ts` (nuevo): `cabeEnColumnaInt(n)`. Es un helper, no 18 parches.

## El censo, ABIERTO (no contado)

91 líneas de `Number.isInteger(` en 40 ficheros de `src/` (recontado: coincide). Leídas las 91:

| Grupo | Líneas | Qué se hace |
|---|---|---|
| Id que llega de fuera y va a la base · S1 · NO emisión | 18 | **usan el helper en este PR** (lista abajo) |
| Id que llega de fuera · S1 · handler que EMITE | 8 | **no se tocan** (reglas 38/40): se reportan |
| Id que llega de fuera · otros carriles (J1, J2, J3) | 31 | NO HECHO → ticket propio |
| No son un id de fuera (índices de línea, cantidades, años, secuencias, tipos de IVA, estrellas, ids internos ya leídos de la base) | 34 | no aplica |

**Hechas (18):** `partes.routes.ts` `findParte` y `POST /` (`jobId`) · `jobs.routes.ts` `GET /` (`operarioId`),
`GET /:id`, `GET /:id/gastos`, `PATCH /:id`, `GET /:id/ics`, `POST /:id/albaranes` · `albaranes.routes.ts`
`GET /consolidables`, `GET /:id` · `maintenance.routes.ts` `DELETE /:id` · `search.routes.ts` `GET /` ·
`ai.routes.ts` `/suggest-albaran-lines`, `/quote-message` · `quotesAdmin.routes.ts` `GET /` (`teamMemberId`),
`/:id/revisiones`, `/:id/billing-plan`, `/:id/asignados`.

**S1, en handler que emite — reportadas, sin tocar (8):** `jobs.routes.ts` `collect-rest` (1) y
`consolidar-albaranes` (2) · `albaranes.routes.ts` `POST /consolidar` (2) y `findAlbaran` (1: lo usan
`facturar-parcial` y `convertir-en-factura`, y con él TODAS las rutas `/:id` del albarán salvo el `GET`) ·
`quotesAdmin.routes.ts` `/:id/invoice` y `/:id/invoice-manual` (2). Necesitan el GO del fundador.
También fuera: `dev.routes.ts` (3; una de sus rutas es `issue-invoice`).

**Otros carriles (31):** J2 `customersAdmin.routes.ts` (14, ya exigen `> 0` pero no tienen techo),
`chargesAdmin.routes.ts` (3), `stripe.routes.ts` (6, metadatos del webhook), `psp.routes.ts` (1),
`connectWebhook.routes.ts` (2) · J1 `invoicesAdmin.routes.ts` (3), `invoice.routes.ts` (1),
`librosAeat.routes.ts` (1) · J3 `supresion.routes.ts` (1).

## 🔴 Lo que el censo NO ve

Se censó por `Number.isInteger`. Pero en `src/` hay **82** `Number(req.params…)` y **43** `Number.isNaN(`:
hay rutas que validan el id con `isNaN` (p. ej. `POST /admin/quotes/:id/accept`), que tienen el mismo
agujero **y además dejan pasar un decimal**. Esas no están en la tabla de arriba. Contadas, no abiertas.

## Test — `tests/scrum1379-id-fuera-de-rango-400.test.mjs` (5 casos)

La ruta real (`dist/…/partes.routes.js`) con la base doblada (`_envio-doblado.mjs`). El doble modela una
cosa de la base y lo dice: lanza si el id no cabe en un int4.

| Mutante (sobre `dist`) | Resultado (BASE 5/5) |
|---|---|
| `Number.isInteger` a secas (lo de antes) | 4 rojos |
| `Number.isSafeInteger` (lo que propuso el orquestador) | 3 rojos, entre ellos el de 10.000.000.000 |

**Error propio (A9):** la primera pasada de mutantes dio «0 pasan, 1 falla» en los dos. No eran mutantes
cazados: la sustitución había fallado y el fichero quedó VACÍO. Es el mismo tropiezo que la sesión anterior
dejó escrito el mismo día (SCRUM-1231) y lo repetí: apuntarlo no lo impidió. Lo delató el recuento (0 casos
en verde), y se repitieron comprobando que la mutación cambia el fichero.

## Lo que NO está hecho

- **No visto en yaqu.app**: hay que esperar al despliegue y pedir el `GET` con la cuenta QA.
- Sólo se ha ejecutado por la ruta **una** de las 18 (la de partes). Las otras 17 llevan el mismo helper
  y compilan; no tienen test propio.
- `npm run tanda:dirigida` no se corrió entera (pasa de 10 minutos y el sistema la manda a segundo
  plano). Corridos los 84 ficheros que nombran lo tocado: 737 tests, 732 pasan, 3 fallan — los tres son
  `scrum1093h`, rojo local conocido por la junction de `node_modules`, ajeno a la rama. El resto, el CI.

**Segundo error propio (2-oct):** el test armaba el `req` con `userRole` a mano; SCRUM-1344 (en `main` desde después de escribirlo) exige `reqDeSesion`. Lo delató el rojo de la rama hermana (SCRUM-1369, misma forma). Corregido el test, no el guard.

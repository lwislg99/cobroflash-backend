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

---

## Segunda tanda (2-oct) · las rutas que el censo por `Number.isInteger` no veía

**Medido contra:** `origin/main` = `a2fe215e5fdd5f86b6b13fe009198daed27b3a5a` · 2026-10-02T12:35:47Z

A9: aviso → cicatriz S1 «Un doble de `res` que contesta a cualquier propiedad también contesta a `then`, y el `async` que lo devuelve no termina nunca.» — no se pudo comprobar: el doble de `res` se escribe a mano en cada test y ningún guard lo mira

Sesión S1 (relevo de `s1-2octa`) · rama `scrum-1379b-id-fuera-de-rango-resto`.

El primer tramo dejó escrito que había rutas que validan el id con `Number.isNaN` y que no las había
abierto. Abiertas ahora las de `src/` por `Number(req.params…)`, `isNaN`, `isFinite` y `parseInt`, no sólo
por `isInteger`:

| Grupo | Líneas | Qué se hace |
|---|---|---|
| Id de la URL · S1 · NO emisión · validado con `isNaN` o `isFinite` | 24 | **usan el helper en este PR** |
| `desplazamientos` del parte (valor de fuera a una columna `Int?`) | 1 | **usa el helper en este PR** |
| S1 · handler que EMITE (las 8 del primer tramo) y `dev.routes.ts` (3) | 11 | **siguen sin tocar**: falta el GO del fundador |
| Otros carriles: `customersAdmin` (J2: 5 con `isNaN`, además de las 14) e `invoicesAdmin` (J1: 12 con `isNaN`, además de las 3) | 17 | NO HECHO: son de J2 y J1 |

**Hechas (24):** `expenses.routes.ts` `GET /margin/:quoteId`, `GET /:id/foto`, `PUT /:id`, `DELETE /:id` ·
`products.routes.ts` `GET /:id`, `PUT /:id` · `providers.routes.ts` `PUT /:id`, `DELETE /:id` ·
`attachments.routes.ts` `GET /:id` · `quoteRequests.routes.ts` `PATCH /:id` · `team.routes.ts` `PUT /:id`,
`POST /:id/resend`, `DELETE /:id` · `templates.routes.ts` `PUT /:id`, `DELETE /:id` · `quotesAdmin.routes.ts`
`/:id/accept`, `/:id/reject`, `/:id/send-whatsapp`, `/:id/pdf`, `/:id/send-email`, `/:id/approve`, `/:id/notes`,
`/:id/tags`, `GET /:id`.

**Cambio de respuesta, dicho:** estas rutas dejaban pasar un decimal (`/admin/quotes/1.5`) hasta la base;
ahora dan el mismo 400 que ya daban a `abc`. Ningún texto nuevo. `-1` y `0` siguen llegando a la base.

### Test — `tests/scrum1379b-id-fuera-de-rango-resto.test.mjs` (49 casos: 1 de censo y 2 por cada una de las 24 rutas)

Cada ruta por su handler de `dist/`, con la base doblada: cualquier consulta lanza si lleva un número que
no cabe en un int4. Por ruta: SUELO (`-1`, `0` y `2147483647` consultan la base y no dan 400 ni 500) y el
caso (`99999999999999999999`, `10000000000`, `2147483648`, `1.5` y `abc` → 400 sin consulta).

| Mutante (sobre `dist`, comprobado que cambia el fichero) | Resultado (BASE 49/49) |
|---|---|
| el helper vuelve a `!Number.isNaN` (lo de antes) | 24 rojos |
| el helper pasa a `Number.isSafeInteger` | 24 rojos |

**Error propio (A9):** la primera corrida se colgó y el sistema la mandó a segundo plano; la paré. El `res`
de prueba era un `Proxy` que devolvía una función para CUALQUIER propiedad, también `then`: el handler
hace `return res.json(…)` dentro de un `async`, el motor lo toma por una promesa y espera para siempre.

### Lo que NO está hecho

- **No visto en yaqu.app.**
- `desplazamientos` lleva el helper y compila, **sin test por la ruta**.
- Los ids que llegan en el CUERPO de estas rutas (`quoteId` o `providerId` de un gasto, p. ej.) **no están abiertos**.
- `npm run tanda:dirigida` no se corrió: corridos este fichero, `scrum1379`, `scrum1344` y `scrum1294`. El juez es el CI.

---

## Tercera tanda (2-oct) · los ids que llegan en el CUERPO y en la query

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:26:18Z

A9: sin fallo que generalice — el tropiezo fue un suelo de test que exigía «no 400» donde la base vacía ya contesta 400 por otro motivo; se corrigió el suelo en esta rama

Sesión S1 (`s1-2octc`) · rama `scrum-1379c-id-en-el-cuerpo`.

La segunda tanda dejó escrito que los ids del cuerpo no estaban abiertos. Abiertos los de las rutas de
S1 que no emiten:

| Dónde entra | Antes | Ahora |
|---|---|---|
| `POST /admin/expenses` · `quoteId`, `providerId` del cuerpo | sin mirar: a la base | 400 `invalid_id` |
| `PUT /admin/expenses/:id` · `quoteId`, `providerId` del cuerpo | sin mirar | 400 `invalid_id` |
| `GET /admin/expenses?quoteId=` (query) | sin mirar | 400 `invalid_id` |
| `POST /admin/products` · `providerId` | sin mirar | 400 `invalid_id` |
| `PUT /admin/products/:id` · `providerId` | sin mirar | 400 `invalid_id` |
| `POST /admin/maintenance` · `customerId`, `quoteId` (zod) | entero positivo sin techo | con techo: `validation_error`, el que ya daba |
| Trabajo directo · `customerId` (`trabajoDirecto.ts`) | `isInteger` y `> 0` | con techo: `customer_required`, el que ya daba |
| Asignados de un Trabajo o presupuesto (`normalizarAsignados`) | `isInteger` y `> 0` | con techo: se descarta, como ya se descartaba lo que no es un id |

Ningún texto nuevo: los códigos de error son los que cada ruta ya usaba. Un decimal o `abc` en
`quoteId`/`providerId` de gastos y productos pasa de 500 a 400.

**Ya estaban bien y no se tocan:** `ai.routes.ts` (`albaranId`, `quoteId`) y `partes.routes.ts`
(`jobId`), cerrados en la primera tanda.

**Vistos y NO tocados:**
- `CreateQuoteSchema` (`core/validation/schemas.ts`: `customer_id`, `job_id`, enteros positivos sin
  techo). Lo consume `quotes.routes.ts`, que también tiene la aceptación pública que emite. Se reporta.
- `albaranes.routes.ts` `POST /consolidar` (`customerId`, `albaranIds`) y `jobs.routes.ts`
  `consolidar-albaranes` (`albaranIds`): emiten. Son de las 11 líneas que esperan al fundador.

### Test — `tests/scrum1379c-id-en-el-cuerpo.test.mjs` (15 casos)

Gastos y productos por su handler de `dist/` con la base doblada (la de `scrum1379b`); Trabajo directo
y asignados por su función. Cada ruta lleva su suelo: con un id que cabe, consulta la base.

| Mutante (sobre `dist`, comprobado que cambia el fichero) | Resultado (BASE 15/15) |
|---|---|
| el helper deja pasar todo | 9 rojos |
| el helper es `Number.isInteger` a secas | 9 rojos |
| el helper es `Number.isSafeInteger` | 9 rojos |

### Lo que NO está hecho

- **No visto en yaqu.app** (la cookie de la cuenta QA caducó el 2-oct a las 13:18Z).
- **`POST /admin/maintenance` no tiene test por la ruta:** va tras un flag de merchant y el esquema no
  se exporta. Lleva el techo y compila.
- Los ids dentro de las LÍNEAS de un documento (`productId` de una línea, p. ej.) no se han abierto.

---

## Cuarta tanda (2-oct) · las líneas de los handlers que emiten — 8 de las 11

**Medido contra:** `origin/main` = `eca8566d130fc35e455b27508b1f3c199dc6263b` · 2026-10-02T16:57:37Z

A9: sin fallo que generalice — el tropiezo fue de mi sonda de pantalla (dos avisos repetidos que el observador no vio); se repitió aislado y está contado abajo

Sesión S1 (`s1-2octe`) · rama `scrum-1379d-id-en-rutas-que-emiten`.

**La autorización, y quién la relata:** autorizado por el fundador el 2-oct-2026 («decide tú», respondiendo
a la lista literal de las 11 líneas y las cuatro rutas), con el alcance congelado. **La relata el
orquestador en su encargo a esta sesión; el fundador no la escribió en el ticket.** El alcance:
sólo `Number.isInteger(x)` → `cabeEnColumnaInt(x)` en la misma línea; nada se mueve, nada se exporta,
ninguna firma cambia, ningún helper se extrae.

**Hechas (8), y el diff son 8 líneas quitadas y 8 puestas:** `jobs.routes.ts` `collect-rest` (id) y
`consolidar-albaranes` (id y `albaranIds`) · `albaranes.routes.ts` `POST /consolidar` (`customerId` y
`albaranIds`) y `findAlbaran` (id) · `quotesAdmin.routes.ts` `/:id/invoice` y `/:id/invoice-manual` (id).
Los tres ficheros ya importaban el helper desde la primera tanda.

**🔴 NO hechas (3): `dev.routes.ts`.** Ese fichero no importa el helper: cambiar sus tres líneas exige
AÑADIR una línea de `import`, y eso ya no es «la misma línea». Se paró y se dice. Siguen con
`Number.isInteger`; además `sim/fail/:id` y `sim/expire/:id` de ese fichero no validan el id de ninguna forma.

**Cambio de conducta, dicho:** en las dos consolidaciones `albaranIds` pasa por un FILTRO, no por un
rechazo: lo que no es un id se descarta y la selección sigue con el resto (ya era así con `abc`). Un id
que no cabe corría antes a la base (500); ahora corre la suerte de `abc`. Mezclado con un id bueno, la
selección sigue con el bueno. Ningún texto nuevo: los códigos son los que cada ruta ya daba.

### Test — `tests/scrum1379d-id-en-rutas-que-emiten.test.mjs` (19 casos)

Sólo LEE el camino: los handlers de `dist/` con la base doblada (la de `scrum1379b`). **Ningún caso emite:**
la base contesta «no existe» y cada ruta se corta en su 404. Siete rutas por la URL (las cuatro de arriba
y tres de las que pasan por `findAlbaran`: `facturar-parcial`, `convertir-en-factura`, `PATCH /:id`), cada
una con su suelo (`-1`, `0`, `2147483647` consultan y dan 404), y los ids del cuerpo de las dos consolidaciones.

| Mutante (sobre `dist`, UNA línea cada vez vuelve a `Number.isInteger`; comprobado que cambia el fichero) | Resultado (BASE 19/19) |
|---|---|
| `collect-rest` (id) | 1 rojo, el suyo |
| `consolidar-albaranes` (id) | 1 rojo, el suyo |
| `consolidar-albaranes` (`albaranIds`) | 2 rojos, los suyos |
| `/consolidar` (`customerId`) | 1 rojo, el suyo |
| `/consolidar` (`albaranIds`) | 1 rojo, el suyo |
| `findAlbaran` (id) | 3 rojos: las tres rutas que pasan por él |
| `/:id/invoice` (id) | 1 rojo, el suyo |
| `/:id/invoice-manual` (id) | 1 rojo, el suyo |

Restaurado: 19/19.

### Visto en yaqu.app (2-oct, cuenta QA, merchant 46, `/version` = `eca8566d`) — las tandas 1.ª y 2.ª

Navegador real (Playwright), con todo lo que no es `GET` abortado y su control positivo antes de medir
(un `POST` de prueba salió «abortada»). Se abre la ficha por su dirección (`#vista/id`):

| Dirección | Respuesta del servidor | Lo que se ve |
|---|---|---|
| `#quotes-detail/204` (control: existe) | 200 | la ficha |
| `#quotes-detail/2147483647` (control: cabe, no existe) | 404 | lista + «Ese presupuesto ya no existe.» |
| `#quotes-detail/99999999999999999999`, `/10000000000`, `/1.5` | 400 | lista + «Ese presupuesto ya no existe.» |
| `#jobs-detail/99999999999999999999` | 400 | lista + «Ese trabajo ya no existe.» |
| `#parte-detail/99999999999999999999` | 400 | lista + «Ese parte ya no existe.» |
| `#albaran-detail/99999999999999999999` | 400 | lista + «Ese albarán ya no existe.» |
| `#invoice-detail/99999999999999999999` (J1, sólo observado) | **500** | lista + «Esa factura ya no existe.» |
| `#customer-360/99999999999999999999` (J2, sólo observado) | **500** | lista + «Ese cliente ya no existe.» |

**🔴 Lo que esta medición NO distingue, y se dice:** la pantalla enseña el mismo aviso con un 400 y con un
500 (`abrirFichaDesdeHash` no mira el código, a propósito: «no existe» y «no es tuyo» responden igual).
Quien abría una dirección con un id enorme YA veía «no existe» antes del arreglo. Lo que cambió está en
el servidor (500 → 400), no en lo que se ve. Y las fichas de factura y de cliente siguen dando 500.

**Error propio:** en la primera pasada dos casos salieron «sin aviso». No era la pantalla: el aviso era
el mismo texto que el del caso anterior, 2,5 s antes, y mi observador sólo apunta nodos nuevos.
Repetidos aislados y con 7 s entre ellos, el aviso sale en los dos. Nada escrito en producción.

### Lo que NO está hecho

- `dev.routes.ts` (3 líneas): arriba.
- Esta cuarta tanda **no está vista en yaqu.app**: sus rutas son `POST` que emiten, y no se pulsan en producción.
- Las otras cuatro rutas que pasan por `findAlbaran` (`emitir`, `duplicar`, `firmar`, `fotos`, envíos) no tienen caso propio: comparten la línea.
- Siguen abiertos: `CreateQuoteSchema`, los ids de las LÍNEAS de un documento, y los 500 de J1 y J2.

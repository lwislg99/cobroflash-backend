# SCRUM-1346 · El Técnico ve documentos que no son suyos — el rojo, por la ruta

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T07:47:56Z (la sonda corrió sobre `6c5b3ad61`; entre los dos, 6 ficheros y 0 de `src/`, `prisma/` o `public/`)

A9: comprobación → `tests/scrum1346-el-tecnico-ve-documentos-ajenos.test.mjs`

14-oct-2026 · **J4** (equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).

**Lo que entra:** un test y este registro. Ni `src/`, ni `public/`, ni `prisma/`, ni el máster.
**Lo que NO entra, y por qué:** el filtro. Todo `src/**` es de **S1** (`docs/equipo/dos-equipos.md:134-136`;
`node scripts/carriles.mjs de` lo confirma para cada fichero que habría que tocar). Se entrega el ① del
encargo —el rojo— y el arreglo se pide al dueño.

## Ⓐ La premisa, re-medida

El encargo citaba `YAQU_MASTER.md:687` («HOY NO ESTÁ CONSTRUIDA») y el censo de 15 sitios de
`docs/master/SCRUM-1390.md` (1-oct). Desde entonces, SCRUM-1397, 1403 y 1489 cerraron siete de esos sitios.
Medido **por efecto**, con la app real (`dist/app.js`), sesiones reales y banco desechable. En el banco, Ana
(Técnico) pide los documentos de Blas (Técnico): primero las lecturas, luego las acciones.

| sitio | hoy | quién lo cerró |
|---|---|---|
| `GET /admin/quotes`, `GET /admin/quotes/:id` | NO-VE | SCRUM-1403 |
| `GET /admin/invoices`, `GET /admin/invoices/:id` (y el PDF, que mide `scrum1397`) | NO-VE | SCRUM-1397 |
| ficha de cliente, buscador general | NO-VE según sus tests (no se re-sondean aquí) | SCRUM-1403, 1489 |
| `GET /admin/quotes/:id/pdf` | **VE** (200, el PDF) | — |
| `GET /admin/metrics/inicio` | **VE** («Actividad reciente» lo trae) | — |
| `GET /admin/albaranes/presupuestos` | **VE** (lo lista) | — |
| `PUT /admin/quotes/:id/notes` | **VE** (reescribe la nota) | — |
| `POST /admin/quotes/:id/accept` · `…/reject` | **VE** (200) | — |
| `POST /admin/quotes/:id/send-whatsapp` · `…/send-email` | **VE** (400 «falta teléfono / correo»: encontró el documento) | — |

**Facturas: cerrado. Presupuestos: 8 fugas abiertas.**

El máster se equivoca en dos líneas, y en direcciones distintas (medido en `e2be1c9f`; no se tocan,
son de un jefe):
- `YAQU_MASTER.md:671` («Facturas … verá sólo las suyas, sin construir») dice **sin construir** de algo
  **CONSTRUIDO**: lista, ficha y PDF de factura recortan desde SCRUM-1397.
- `YAQU_MASTER.md:687` («HOY NO ESTÁ CONSTRUIDA») dice que no está construido algo que está **A
  MEDIAS**: 7 de los 15 sitios cerrados, 8 abiertos.
- `YAQU_MASTER.md:681` (Inicio, «sin construir») es **cierta**: Inicio sigue abierto.

## Ⓑ El test, y por qué es un trinquete

`tests/scrum1346-el-tecnico-ve-documentos-ajenos.test.mjs`, por HTTP contra la app real (no saca ningún
manejador de su ruta: SCRUM-1344). Cada sonda contesta VE, NO-VE o CIEGO, y **CIEGO cae siempre**: un 500
no es una ruta cerrada.

- ① cada ruta con el documento del COMPAÑERO. Lo que no está en `FUGAS_CONOCIDAS` tiene que cumplir la
  decisión ya. Lo que está se afirma como TESTIGO: verde mientras fuga, y cae («🟢 quita su clave») el día
  que alguien lo cierra sin tocar la lista. La lista sólo encoge.
- ② el Técnico sigue alcanzando LO SUYO por las mismas rutas.
- ③ la ADMINISTRADORA sigue alcanzando lo de TODOS por las mismas rutas.
- ④ el Técnico sigue aceptando y rechazando lo suyo.

**El trinquete es la forma elegida, no un apaño.** Un testigo verde que sólo puede encoger documenta la
fuga igual que un rojo, sin tumbar a nadie. Y como también caza el cierre DE MÁS (M3, abajo), no es una
lista de deseos. **Por qué no es un `todo` ni un rojo de verdad:** un rojo tumba el check obligatorio de todos, y un `todo`
que cae sale `not ok … # TODO`, que `scripts/_tanda-por-tramos.mjs:31` cuenta como rojo a cualquier
profundidad.

**Envíos:** el cliente del banco no tiene teléfono ni correo, y el test lo AFIRMA antes de llamar a las
rutas de envío. La ruta enseña si encontró el documento sin que pueda salir nada, haya o no credenciales
(cicatriz J4 del 1-oct, SCRUM-1390).

## Ⓒ Lo corrido (banco: PGlite en el tmp del puesto, esquema de `migrate diff` de este árbol, 33 tablas)

| corrida | resultado |
|---|---|
| tal cual | 5 casos, 5 pasan, 0 saltos · 0 merchants al terminar |
| **el rojo:** `SCRUM1346_SIN_TRINQUETE=1` | ① cae con las **8 fugas**, cada una con su ruta; ②③④ verdes |
| mutante M1: sin la puerta de `GET /admin/quotes/:id` (`dist/`) | ① «🔴 FUGA GET /admin/quotes/2» |
| mutante M2: `seesAllJobs` → `false` | ③ «la administradora ha perdido» facturas y presupuestos |
| mutante M3: Inicio no devuelve nada | ① «🟢 la fuga «inicio» ya NO está — quita su clave»; ② y ③ rojos (cerrar de más también se caza) |

**Tanda entera** (`'tests/*.test.mjs'`, TAP a fichero fuera del árbol, sin banco): 11.437 casos, 11.274
pasan, 156 saltos, **7 caen**. Cinco eran míos: los cuatro de SCRUM-419/456 (saltos sin declarar) y uno de
SCRUM-737 (una cifra sin ancla), corregidos y vueltos a correr: 36 casos, 0 caen, 4 saltos (los míos sin
banco). Los otros **dos**, `scrum1298b` (dos casos), comparan `JAVIER~1` con `Javier Pereira` en la ruta del
TEMP de esta máquina. Mi diff no toca ni el latido ni sus scripts: no son míos, y no se tocan.
`guards:entrada`: 14 guards, 166 casos, 0 caen. scrum237 + scrum976 + scrum267 + scrum1294: 37 de 37.

Mutantes impresos línea a línea antes de leer el resultado; `dist/` reconstruido después y las tres
líneas comprobadas de vuelta. `git status` después: sólo el test.

## Ⓓ Para quien construya (S1) — lo que mide este test, no una orden

Las dos puertas ya existen, en `src/core/documentos/accesoAlPresupuesto.ts`:
`puedeVerElPresupuesto(quien, id)` (para un id) y `wherePresupuestosVisibles(quien)` (para una lista;
`null` = admin, sin recorte). `quien` sale de `quienPideDe(req)`. El patrón ya montado está en la ficha
(`quotesAdmin.routes.ts:960`) y en la lista (`:122`). Líneas medidas en `e2be1c9f`:

| clave del test | ruta | dónde falta la llamada | puerta |
|---|---|---|---|
| `pdf-presupuesto` | `GET /admin/quotes/:id/pdf` | `src/modules/system/app/routes/quotesAdmin.routes.ts:759` (el `findFirst` por id y negocio) | `puedeVerElPresupuesto` → 404 `not_found` |
| `aceptar` | `POST /admin/quotes/:id/accept` | `quotesAdmin.routes.ts:143` (antes de `acceptQuoteAdmin`) | `puedeVerElPresupuesto` → 404 |
| `rechazar` | `POST /admin/quotes/:id/reject` | `quotesAdmin.routes.ts:182` (antes de `rejectQuoteAdmin`) | `puedeVerElPresupuesto` → 404 |
| `enviar-whatsapp` | `POST /admin/quotes/:id/send-whatsapp` | `quotesAdmin.routes.ts:698` (antes de `sendQuoteWhatsAppToCustomer`) | `puedeVerElPresupuesto` → 404 |
| `enviar-correo` | `POST /admin/quotes/:id/send-email` | `quotesAdmin.routes.ts:796` (el `findFirst` por id y negocio) | `puedeVerElPresupuesto` → 404 |
| `notas` | `PUT /admin/quotes/:id/notes` | `quotesAdmin.routes.ts:901` (el `updateMany`) | `puedeVerElPresupuesto` → 404 |
| `inicio` | `GET /admin/metrics/inicio` | `src/modules/metrics/app/routes/metrics.routes.ts:25` llama a `getInicioOperario(req.merchantId)` sin quién pregunta; el `findMany` está en `src/modules/metrics/domain/metrics.service.ts:216` | `wherePresupuestosVisibles` en el `where` |
| `albaran-buscador` | `GET /admin/albaranes/presupuestos` | `src/modules/jobs/app/routes/albaranes.routes.ts:271` (`listQuotesAdmin(req.merchantId!, q)`; el 7.º parámetro, `recorte`, ya existe) | `wherePresupuestosVisibles` |

Sin esquema y sin tocar la emisión. Cada clave que se cierre sale de `FUGAS_CONOCIDAS` en el mismo PR.
Si no sale, el test cae y lo dice.

- **Sin texto nuevo en la API.** El rótulo «Tus presupuestos recientes» y el vacío del Técnico (firmados,
  SCRUM-1390 c.17962/17963) son de pantalla (`homeView.js`, S2).
- **Sin decidir:** si los recuentos de los globos de Inicio (`quotesAwaiting`, `pendingCount`) se recortan
  también. No son documentos y la decisión no los nombra.

## Ⓔ Hallazgo de paso, sin arreglar (no es de este carril)

`.claude/settings.json:33` lanza `node .claude/hooks/carril.mjs` **sin** `--exigir-identidad`. Sin
identidad, la cerradura deja editar: el hook de arranque me dijo «SIN IDENTIDAD, no construyas» y nada me
lo habría impedido. El orquestador lo lleva. `jv-j6k` lo está censando, así que aquí sólo se nombra.

## Ⓕ Mis errores de esta tanda

1. **Escribí un `assert.ok(… || true)`** en el caso sin base: una afirmación que no puede fallar, al lado de
   otras que sí. Es la familia de mi cicatriz del 2-oct (SCRUM-1403). La quité al releer, antes de correr.
2. **Copié el lanzador de SCRUM-1515 fuera del repo sin mirar que calcula la raíz desde donde vive.** Lo
   cacé leyendo la línea antes de lanzarlo; habría corrido sin encontrar el test.
3. **Puse cinco rojos míos en la tanda:** guardé el motivo del salto en una constante (`SIN_BASE`).
   `scrum419` sólo reconoce un literal en línea, así que lo leyó como salto mudo, y además no declaré los
   cuatro en `GATEADOS_DECLARADOS`. Y escribí «15 sitios» en un comentario sin su fecha (`scrum737`). Los
   cazó la tanda entera, no la muestra de guards: por eso se corre entera.
4. **Empecé por leer el censo del 1-oct y no el código de hoy.** Fue `grep` de las puertas lo que dijo
   que siete de quince ya estaban cerradas, antes de escribir nada.

## SCRUM-1346b · lo que queda de «reconstruye lo cobrado», re-medido el 24-oct

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:22:09Z (`Date:` de GitHub)

A9: aviso → A10 «Una salida recortada para leerla cómoda es media salida: el corte cae donde no estabas mirando.» — no se pudo comprobar: el `| head` se teclea en la consola y ningún guard lo ve

[Anexado por J2 (sesión jv-j2bb), equipo de Javier, por encargo del orquestador (`cobroflash-backend-95`):
SOLO MEDIR Y PREGUNTAR. Sólo este tramo; ni `src/`, ni `public/`, ni `prisma/`, ni tests, ni el máster.
Entrega en Jira: SCRUM-1346 c.20735.]

**Cómo se ha medido:** leyendo el código (un subagente censó las rutas y yo releí las dos rojas). No se ha
ejecutado ninguna ruta ni se ha corrido el trinquete hoy. Tampoco se ha visto en yaqu.app: no hay sesión de
Técnico en producción (SCRUM-1555 c.19743).

### Lo que pedía el ticket: cerrado en `main`

El Técnico ya no reconstruye lo COBRADO de un compañero ni el total cobrado del negocio. Facturas: SCRUM-1397
(`invoicesAdmin.routes.ts:89`, `whereFacturasVisibles`). Ficha de cliente y presupuestos: SCRUM-1403
(`customersAdmin.routes.ts:618`, `sinDinero`). Las 8 rutas de presupuesto de Ⓐ: SCRUM-1555 (#2456,
`becfaf830`), que dejó `FUGAS_CONOCIDAS` vacía (`tests/scrum1346-el-tecnico-ve-documentos-ajenos.test.mjs:64`).
`/admin/cobros`, `metrics/home`, `/team`, `/operarios`, `expenses`, `exports`, `reports` y `/admin/team`
siguen con `requireRole`.

### Lo que queda abierto (todo es carril S1)

| ruta | dónde | qué le da al Técnico |
|---|---|---|
| `GET /admin/albaranes/pendientes-facturar` | `albaranes.routes.ts:216` → `getPendientesFacturar(req.merchantId!, prisma)`; Trabajos de todo el negocio en `pendientesFacturar.service.ts:291` | `importePotencial` (base, cuota, total; `:353`) de todo lo valorado sin facturar del negocio, por cliente y mes |
| `GET /admin/albaranes/consolidables?customerId=` | `albaranes.routes.ts:325`; Trabajos de cualquier cliente en `:365`, totales en `:398-410` | base, cuota y total por mes de los albaranes de cualquier cliente |
| recuentos sin euros | `metrics.service.ts:218` · `customersAdmin.routes.ts:592` y `:627` | cuántos presupuestos o facturas pendientes tiene el negocio o el cliente (sin decidir desde 1555 c.19622) |

Las dos primeras están en `TECNICO_ALLOWED` (`adminRouteDeclarations.ts:197` y `:211`) con el motivo «mismo
criterio S1 que GET /admin/invoices ("facturas: ver sí")». La decisión B de este ticket (c.17828, c.17932)
sustituyó ese criterio. El control de que el eje existe y no se usa: el mismo fichero llama a
`seesOnlyOwnJobs` en `:199` (la lista de albaranes) y en `:603`, y no en esas dos rutas. No dan lo COBRADO
(dan lo trabajado sin facturar) y agrupan por cliente, no por compañero.

**Nombres:** el Técnico los consigue con `GET /admin/metrics/actividad-equipo` (firmado en SCRUM-1341, «1-B»,
sin importes). Con lo cobrado cerrado, no le dan «Fulano cobró 900» por ninguna ruta censada.

**Máster:** `YAQU_MASTER.md:671`, `:681` y `:687` siguen diciendo «sin construir», y está construido. Es de
SCRUM-1390 (J4), y no se toca aquí.

**Población:** 51 ficheros en `src/modules/*/app/routes`; 13 leídos a fondo, más `app.ts`. Unas 30 rutas
clasificadas. No se han mirado `bot/handoffs`, `quote-requests`, `partes`, `templates` ni `products`.

### Las preguntas, en Jira (c.20735)

P1, que el Técnico vea sólo las bandejas de SUS Trabajos (recomendado ✅). P2, los recuentos sin euros.
P3, el cambio de máster que marca construidas las tres filas. Cerrar o partir el ticket lo decide el
orquestador (A13).

### Mis errores de esta tanda

1. **Un `| head` me cortó la salida justo antes de las dos líneas que decidían.** Mi primer `grep` de
   «albaranes» en `adminRouteDeclarations.ts` salió cortado a 10 líneas, y `pendientes-facturar` no
   aparecía. Iba a escribir que la ruta no estaba en `TECNICO_ALLOWED`. Lo cacé con un segundo `grep` por
   el nombre exacto, que dio `:197` y `:211`.
2. **En c.20735 cité `pendientesFacturar.service.ts:290`; la línea es `:291`.** Lo vi al releerla para
   este registro. Aquí va la buena, y el comentario de Jira no lo he editado.

## SCRUM-1346c · P1 construido: las dos bandejas de albaranes, sólo lo de SUS Trabajos

**Medido contra:** `origin/main` = `927bda7ab44b604d81bca8c453663e7fc6f6cda9` · 2026-10-24T12:32:07Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum1346-el-tecnico-ve-documentos-ajenos.test.mjs`

[S1, equipo de Luis. La decisión: c.20745, P1 «Sí, solo los suyos», con el MISMO eje que `GET /admin/albaranes`.]

**La premisa, re-leída en este árbol antes de tocar nada.** Las dos rutas están en `TECNICO_ALLOWED`
(`adminRouteDeclarations.ts:197` y `:211`) y ninguna llamaba a `seesOnlyOwnJobs`:
`pendientes-facturar` pasaba sólo `req.merchantId` a `getPendientesFacturar`, que lee los Trabajos de todo
el negocio, y `consolidables` leía los Trabajos del cliente sin mirar de quién son. El eje de
`GET /admin/albaranes` es `jobIdsVisiblesPara` (mismo fichero): los TRES ejes de SCRUM-467/650
(`operarioId`, `assignedUserId` y la tabla `assignees`). Se reusa tal cual: no hay eje nuevo.

**El arreglo.** Las dos rutas piden `jobIdsVisiblesPara` cuando `seesOnlyOwnJobs(req.userRole)` y meten
esos ids en el `where` del `job.findMany`: en la ruta (`consolidables`) y por un tercer parámetro de
`getPendientesFacturar` (`null` = todos; el resumen semanal y el admin no cambian). El filtro va en la
query, no se oculta nada después. Las dos declaraciones de `TECNICO_ALLOWED` dicen ahora el criterio
nuevo; el de «facturas: ver sí» lo había sustituido la decisión B.

**El test, por efecto y con dos actores**, dentro del trinquete que ya existía (mismo arnés: HTTP contra
`dist/app.js`, sesiones en la base, Postgres desechable). Ana y Blas, técnicos, con un Trabajo cada uno
del MISMO cliente y un albarán firmado, valorado y sin facturar en cada Trabajo. Dos sondas nuevas:
`albaranes-pendientes` y `albaranes-consolidables` (la segunda cuenta como VE tanto `grupos` como
`descartados`, porque los dos llevan el id y el número). ① el de Blas NO le sale a Ana · ② el de Ana SÍ
le sale (control positivo) · ③ la administradora ve los dos.

**Lo corrido** (banco: Postgres 16 portable propio, puerto 55497, base `yaqu_1346_test`, esquema de
`migrate diff --from-empty` de este árbol: 33 `CREATE TABLE` = 33 `model`):

| qué | resultado |
|---|---|
| el test, con el arreglo | 5/5 pass, 0 skip |
| mutante: `getPendientesFacturar(…, null)` en el compilado | ① cae con `FUGA GET /admin/albaranes/pendientes-facturar`; ②③④ verdes |
| mutante: `id: undefined` en el `where` de `consolidables` | ① cae con `FUGA GET /admin/albaranes/consolidables?customerId=…`; ②③④ verdes |
| vecinos: los 71 ficheros de `tests/` que nombran estas rutas, el servicio o las declaraciones | 587 tests · 586 pass · 0 fail · 1 skip (SCRUM-127, por `QA_DB_TEST`) |

Cada mutante tumba SÓLO su sonda: las dos miden cosas distintas. El rojo de antes del arreglo es la
suma de los dos mutantes.

**¿Un tercer sitio?** Censo de los `albaran.findMany` y `job.findMany` que alcanza un Técnico: las rutas
por id de albarán pasan por `findAlbaran` (SCRUM-849, recorta); `GET /admin/partes` recorta con
`whereSuyoElTrabajo` (tres ejes); el historial del cliente recorta con `ejesDelTecnico` (tres ejes);
`POST /consolidar` es de admin. **No hay otra fuga.** Sí hay dos sitios que recortan DE MÁS (el Técnico
deja de ver lo suyo, no ve lo ajeno), y no se tocan aquí:

- `jobs.routes.ts:926` (y el mismo patrón en `:968`, `:993`, `:1158` y `:1205`): `GET /admin/jobs/:id`,
  `/gastos`, `PATCH`, `/ics` y el alta de albarán miran sólo `operarioId`. Un Técnico asignado por
  `assignedUserId` o por la tabla ve el Trabajo en la lista (`:820`, tres ejes) y recibe 404 al abrirlo.
  Leído en el código, no ejecutado.
- `precarga.service.ts:188` (`condicionDelTecnico`): dos ejes, sin la tabla `assignees`.

**No visto en yaqu.app:** no hay forma de abrir sesión de Técnico en producción (SCRUM-1555 c.19743).
Lo que se puede mirar allí tras el merge es el control negativo, con la administradora de la cuenta QA:
las dos bandejas siguen contestando igual.

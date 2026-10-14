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

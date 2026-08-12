# SCRUM-467 · PASO 0 medido y los tres puntos de cambio — **NO cerrado, y digo por qué**

**Medido contra:** `origin/main` = `db820c35fffa526187057330457593e8b5315aeb` · 2026-08-12T11:19:30+02:00
**Medido en:** host `DESKTOP-T5MONF5` · **Cero código escrito.**

## 🔴 La pregunta que decide: **no son dos campos para la misma idea**

Y no hace falta deducirlo: **lo declara el propio schema** (`prisma/schema.prisma:739-743`).

| campo | qué es |
|---|---|
| `Job.assignedUserId` | **quien lo EJECUTA** — el asignado (SCRUM-10) |
| `Job.operarioId` | **AUTORÍA**: el operario que creó el presupuesto, congelado al aceptar (`quote.teamMemberId`, SCRUM-52) |

El comentario del schema, literal: *«Distinto de `assignedUserId` (el asignado a ejecutar)»*.

**Son dos ejes distintos —quién lo vendió y quién lo hace—, así que no hay nada que unificar ni que
reportar como duplicado.** Y confirma el arreglo del encargo: **se filtra por LOS DOS**, porque un
técnico tiene que ver lo que creó **y** lo que le han asignado.

## Los tres puntos de cambio, localizados

| # | dónde | qué falta |
|---|---|---|
| 1 | `jobs.routes.ts:466-468` | `where.operarioId = req.teamMemberId` → tiene que ser `OR: [{operarioId}, {assignedUserId}]`. Ahí están los 6 jobs asignados que nadie mira |
| 2 | `albaranes.routes.ts:545` `GET /:id` | **no filtra nada**: carga el albarán por id + merchant y devuelve job (título, **dirección**) y cliente. Un técnico con el id abre cualquiera |
| 3 | `albaranes.routes.ts:129` `GET /` | `requireRole('admin')` → abrir a técnico filtrado a los suyos |

El mecanismo ya existe y no hay que inventarlo: `seesOnlyOwnJobs(req.userRole)`
(`core/http/roleCapabilities.ts:56`), que es **allowlist de admin** — un rol desconocido queda
restringido, no suelto.

## 🔴 El punto 3 arrastra una decisión declarada, y hay que verlo antes de tocarlo

`core/http/adminOnlyRoutes.ts` **declara `GET /admin/albaranes` como admin-only con su motivo
escrito** (SCRUM-301/C1):

> *«Un técnico solo ve SUS Trabajos y los albaranes cuelgan de Trabajos: enseñárselos todos le diría
> de qué obras ajenas hay partes, de qué clientes y con qué fechas. Aquí queda su **403 EXIGIDO**, no
> solo declarado.»*

Y ese 403 **lo exige un guard** (`tests/scrum158-montajes-admin-muestreados.test.mjs`, y lo citan
`scrum164` y `scrum365`). Así que el punto 3 no es quitar `requireRole('admin')`: es **cambiar una
decisión de permisos declarada y hacer que el guard exija la NUEVA regla** —403 para rol
desconocido, 200 filtrado para el técnico—, no borrar su entrada. Si se borra sin más, se pierde la
comprobación que impedía que esa ruta se abriera sola.

## Por qué NO lo he construido en esta tanda

**Un cambio de permisos a medias es peor que no hacerlo**, y lo que exige el propio encargo —control
negativo primero (un admin sigue viendo TODO), rojo por el mecanismo que diga *«un operario puede
leer el cliente y la dirección de un trabajo ajeno»*, y el positivo del técnico con trabajo
asignado— **no me cabe ya en este turno con la verificación entera**. Entregar los tres cambios sin
sus rojos probados sería exactamente lo que esta casa no acepta: verde que no significa nada.

**Lo dejo medido para que no se re-derive nada**: los tres puntos con fichero y línea, el mecanismo
que ya existe, la respuesta a la pregunta de los dos campos, y el acoplamiento del punto 3 con su
declaración y su guard.

**No se ha tocado:** ni una línea de código, `prisma/schema.prisma`, el filtro de precarga de
SCRUM-464, ni el camino de emisión.

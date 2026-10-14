# SCRUM-1273 · Archivar presupuestos

**Medido contra:** `origin/main` = `fcc889928bd077ecd81776fded32ca83658e7cbb` · 2026-09-29T10:09:43Z

## Paso ② de A5 · el ALTER, escrito y SIN APLICAR (S1, s1-29a)

La medición de S2 (s2-29a) mostró que archivar necesita columna nueva: `model Quote` no tiene
`archivedAt` ni nada parecido, y `status: 'archived'` no vale (estado nuevo en lista cerrada, Parte L;
y desarchivar exigiría recordar el estado anterior).

- Fichero: `docs/sql/scrum-1273-archivar-presupuestos.sql` —
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);` (nullable, sin default;
  ninguna fila cambia).
- **Sin `archived_by`:** el «quién» iba a ir a `recordAudit`, que ya guarda el autor. Dos sitios para el
  mismo hecho divergirían. ⚠️ **Desde c.19655 tampoco hay auditoría** (ver «Paso ③»): el quién no queda.
- DDL derivado OFFLINE con `previewMigracion` (control positivo: 31 tablas) contra `origin/main` =
  `223498dc`, con el candidato en el scratchpad. **`prisma/schema.prisma` no se ha tocado** (regla 40).
- Anotado en `docs/MIGRATIONS_PENDING.md` con las tres bases sin marcar. Lo aplica el equipo de Javier.

**El ticket sigue aparcado:** el PR ③ (esquema + código + pantalla) no se construye hasta que la
columna esté en las tres bases.

## Paso ③ · la parte de S1: esquema, las dos rutas y el filtro de la lista (S1, 14-oct-2026)

**Medido contra:** `origin/main` = `3c25452545a3b7092fb284df8a57b4f203f7a8a8` · 2026-10-14T08:27:28Z
A9: comprobación → `tests/scrum1273-archivar-presupuestos.test.mjs`

Carril S1 · árbol `s1-1273` · rama `scrum-1273-archivar-presupuestos`. Contrato del orquestador en SCRUM-1273 c.19605 (decisiones 1, 2 y 3 aprobadas; T10 firmado). La pantalla es de S2, en otro PR.

**El esquema.** `archivedAt DateTime? @map("archived_at")` en `model Quote`. `node scripts/preview-migracion.mjs --desde <schema de main>` (control positivo: 33 tablas) da exactamente el ALTER del paso ②: `ALTER TABLE "quotes" ADD COLUMN "archived_at" TIMESTAMP(3);`, aditivo. Que esté en las tres bases lo dice `docs/MIGRATIONS_PENDING.md`; **no lo he medido en ninguna** (ningún árbol tiene claves de BD, y no consulto producción). Lo mide el job «constancia del ALTER» del PR, que **es informativo y NO impide el merge**: por eso el PR se queda en borrador y sin auto-merge hasta que alguien lea ese job (decisión del orquestador, 14-oct).

**Lo construido:**

| pieza | dónde | conducta |
|---|---|---|
| `POST /admin/quotes/:id/archivar` | `quotesAdmin.routes.ts` | `requireRole('admin')` (el mismo criterio que `/tags`). Lee por `id` y `req.merchantId`; si no es archivable, 409 `no_archivable` con T10. Escribe SÓLO `archivedAt`, con el estado leído en el `where` (patrón 1276). Archivar dos veces no mueve la fecha. Sin auditoría (c.19655). |
| `POST /admin/quotes/:id/desarchivar` | ídem | vuelve a NULL; sobre uno no archivado no escribe. Sin auditoría (c.19655). |
| qué se puede archivar | `src/modules/quotes/domain/archivado.ts` | `draft`, `rejected`, `expired` (c.17511), **salvo un `draft` cuyo cobro está pagado o pendiente**: la lista lo pinta «pagado»/«pendiente», y archivarlo contradiría T10 y escondería dinero. Con el cobro caducado la lista dice «caducado» y se archiva. |
| la lista | `listQuotesAdmin` + `GET /admin/quotes` | sin el parámetro, fuera los archivados; `?archivados=1`, sólo ésos. El otro llamador (`GET /admin/albaranes/presupuestos`) NO filtra, por la decisión 2. La fila lleva `archivedAt`. |
| el detalle | `getQuoteDetailAdmin` | devuelve `archivedAt`. |
| decidir desarchiva (decisión 1) | `quotes.routes.ts` (aceptar y rechazar del cliente) y `quoteAdmin.ts` (`acceptQuoteAdmin`, `rejectQuoteAdmin`) | `archivedAt: null` en el mismo `update` que cambia el estado. Si la decisión no entra (409), no se toca. |

**Dos decisiones mías, declaradas para que se confirmen:**
- ~~**`AuditAction` gana dos acciones** (`presupuesto_archivado`, `presupuesto_desarchivado`).~~ **RETIRADO (c.19655):** el orquestador decidió NO ampliar `AuditAction` (unión cerrada, ampliarla es cambio de máster, SCRUM-651) y cambió su propio contrato de c.19605. Archivar y desarchivar **no escriben auditoría**: hoy **no queda registro de quién archivó**, y queda dicho aquí. No se usa una acción parecida de las que ya existen. Los tests lo fijan (`auditorias.length === 0`).
- **Sólo admin.** Abrírselo al técnico es quitar un gate. **Aprobado en c.19655** (un Técnico recibe 403).
- **Un borrador con el cobro pagado o pendiente no se archiva.** **Aprobado en c.19655.**

**Camino de emisión:** en `POST /quote/:token/decision` la línea va en el `update` de la decisión, que está ANTES de `crearFacturaEmitida` (línea 637 del fichero de `main`) y DESPUÉS de sellar la evidencia de la firma (que se arma con el presupuesto leído, sin esta columna). No se toca nada de la emisión.

**Verificado, ejecutando:** `tests/scrum1273-archivar-presupuestos.test.mjs` (11) y `tests/scrum1273-decidir-desarchiva.test.mjs` (3), por la ruta real con base doblada. Control positivo por mutación sobre `dist`: quitar el estado del `where` tumba sólo el test de la carrera; quitar el filtro, sólo el de la lista; quitar `archivedAt: null` de la decisión del cliente, sus dos; el de `quoteAdmin`, el suyo.

**NO hecho:** la decisión por el BOT de WhatsApp (`whatsappIncoming.routes.ts:485` y `:554`, aceptar y rechazar) NO desarchiva: es el canal de J2 y no lo toco. Un cliente que acepte un archivado por el botón de WhatsApp lo deja aceptado y fuera de la lista. Lo dice el ticket.
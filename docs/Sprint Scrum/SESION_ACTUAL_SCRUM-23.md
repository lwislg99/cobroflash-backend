# SESION_ACTUAL_SCRUM-23.md — Brief
**SCRUM-23 · OPERARIO-2 · El operario ve solo sus trabajos (visibilidad por rol)**
Carril Javier · label `dev2` · Fase F2 · Epic padre SCRUM-21 · Depende de SCRUM-22 (`operarioId`) + SCRUM-11 (lista de Trabajos).
Estado: **v1.0 — decisiones cerradas (asesor + carril B).** Único bloqueo vivo: **la dependencia de datos** — sin `Job.operarioId` en `main` (SCRUM-22 cerrado) no se puede filtrar. NO empezar hasta que el read-path de SCRUM-22 esté en `main`.

---

## 1. Cabecera — qué gobierna, flujo y zonas sensibles

**Gobierna:** `YAQU_MASTER.md` (S1 roles Admin/Técnico, **S3 seguridad = filtrar en backend**, reglas 2/27) + ticket **SCRUM-23** + `PLAN_EJECUCION §3.3` (zona roja).

**Flujo:** `git pull` main → rama `scrum-23-visibilidad-operario` → commit feature → PR (lo crea Luis) → Luis mergea. Ticket a "En revisión" al abrir PR; "Finalizada" (id 51) solo el asesor.

**🚨 ZONAS SENSIBLES (más caliente que SCRUM-22):**
- 🚨 Esto **modifica el comportamiento** de handlers existentes de `jobs.routes.ts` (lista y detalle) — no es aditivo al JSON como en 22. Zona roja "modificar = coordinar en el ticket": **anunciar en SCRUM-23 antes de tocar y coordinar el timing con Luis** para no pisar el mismo archivo. Luis lo revisa como revisor del PR (revisa todos los merges).
- 🚨 **Filtrado SIEMPRE en backend** (regla S3). Prohibido ocultar en front datos ya enviados.
- 🚨 NO se toca `schema.prisma` (el `operarioId` lo sirvió SCRUM-52). NO se tocan `jobDetailView.js`/`homeView.js`.
- Bloqueante: `Job.operarioId` existe y poblado en `main` (SCRUM-22 cerrado).

---

## 2. Decisiones (quién decide qué)

> Modelo de decisión: el alcance del carril lo cierran **el asesor + Javier** (dueño del carril). Exclusivo de Luis (máster): `schema.prisma`, confirmaciones de **dinero/fiscal**, y **todos los merges**. Nada del núcleo de SCRUM-23 cae en lo exclusivo de Luis (el tema de dinero se separó a SCRUM-54).

**Decisión 1 — filtrar por `operarioId` (autor), NO `assignedUserId`. ✅ CERRADA (asesor + carril B).**
El DONE dice literal "operarioId = él" y es coherente con el modelo inmutable de SCRUM-22. "Mis trabajos" = "los que originé". La visibilidad-por-asignación (`assignedUserId`) se captura como candidata a ticket futuro (Visión Norte) si la obra real lo pide.

**Decisión 2 — cross-access → 404, NO 403. ✅ CERRADA (asesor + carril B).**
El texto del DONE decía 403; se implementa **404** por coherencia con el patrón de tenancy de la casa (`jobs.routes.ts:174`) y porque no filtra la existencia del recurso (mejor seguridad). Desviación menor del texto original, **documentada en el comentario del ticket** para que quede trazado.

**Decisión 3 — lo ejecuta el carril B (Javier), coordinando. ✅ CERRADA (asesor + carril B).**
Es lógica row-level atada a `operarioId` (dominio operarios) y localizada en lista+detalle. Lo hace el carril B, **anunciando en el ticket + coordinando el timing** con Luis por ser cambio de comportamiento en `jobs.routes.ts` (zona roja), y con Luis revisando el diff de seguridad al mergear el PR. No es un gate de aprobación previa; es coordinación + review.

---

## 3. Contexto real del repo (del recon SCRUM-23 — confírmalo, no lo re-descubras)

- **Lista** — `GET /admin/jobs` (`jobs.routes.ts:151-165`): `findMany({ where: { merchantId }, orderBy:[{scheduledAt:'asc'},{id:'desc'}], take:200 })`. Filtra por merchant ✅. **NO ramifica por rol** → hoy un Técnico ve TODOS los Trabajos del merchant. Montada en `app.ts:222` sin `requireRole` (correcto: ambos roles la ven; la diferencia es por fila).
- **Detalle** — `GET /admin/jobs/:id` (`jobs.routes.ts:169-180`): `findFirst({ where:{ id, merchantId } })` → 404 si no es de tu merchant. **Un Técnico SÍ puede abrir por URL el Trabajo de otro técnico del mismo merchant (200)** — solo tenancy, sin filtro por operario. Ese es el agujero del DONE.
- **Identidad/rol** — `requireAuth` global en `/admin` (`app.ts:169` → `authMiddleware.ts:28-31`) inyecta `req.merchantId`, `req.teamMemberId` (null = owner) y `req.userRole`. Disponibles en lista y detalle, hoy sin consumir. El owner (teamMemberId null) cae en la rama admin ("ve todos").
- **Hermanos con mismo patrón (solo tenancy, sin rol):** `PATCH /admin/jobs/:id` (:183), `GET /:id/ics` (:227), `POST /:id/albaranes` (:267), `POST /:id/collect-rest` (:302). Fuera de V1 (ver §5).
- **Tests** — suite única `tests/tenancy-permisos.test.mjs` (gate `QA_DB_TEST=1 WHATSAPP_DRY_RUN=1`): A12.1 (cross-merchant) y A12.4 (rutas admin-only vía `src/core/http/adminOnlyRoutes.ts` → `ADMIN_ONLY_ROUTES`). **Ninguna cubre row-level mismo-merchant.** Las rutas `/admin/jobs` NO están en `ADMIN_ONLY_ROUTES` (correcto).

---

## 4. Qué hay que hacer — alcance EXACTO

**Precondición (STOP):** `Job.operarioId` existe y poblado en `main` (SCRUM-22 cerrado). Si no → PARA.

1. **Lista `GET /admin/jobs` (:151-165):** si `req.userRole === 'tecnico'` → añadir `operarioId: req.teamMemberId` al `where` (junto a `merchantId`). Si admin/owner → sin cambio (ve todos). Filtrado en la query (backend, S3), nunca en front.
2. **Detalle `GET /admin/jobs/:id` (:169-180):** tras el `findFirst({ id, merchantId })`, si es técnico y `job.operarioId !== req.teamMemberId` → **404** (Decisión 2). Admin/owner sin cambio.

---

## 5. Lo que NO incluye (fronteras del V1)

- NO aplica el gate por operario a `PATCH`, `/ics`, `/albaranes`, `/collect-rest` (solo lista + detalle en V1). Endurecer esos → ticket de endurecimiento aparte si se decide.
- NO la vista de supervisión de admin → SCRUM-24.
- NO toca schema ni las vistas de Luis.
- El hallazgo de `collect-rest`/rol → ya capturado en **SCRUM-54** (asignado a Luis, dominio dinero/fiscal). NO se toca en SCRUM-23.

---

## 6. STOP conditions (AA1.4)

- 🛑 `schema.prisma` no se toca. Si falta `operarioId` en `main` → PARA (precondición no cumplida).
- 🛑 **Cambio de comportamiento en `jobs.routes.ts` (zona roja "modificar"):** anunciar en el ticket + coordinar timing con Luis antes de commitear. Si Luis está tocando esos handlers en paralelo → coordinar orden de merge (el segundo rebasa).
- 🛑 Filtrado en backend (S3); si la implementación tentara ocultar en front → PARA.

---

## 7. E2E automatizado

Nueva dimensión **row-level, mismo merchant** (la que falta hoy). En `tests/tenancy-permisos.test.mjs`:
- Crear en merchant B: dos técnicos + dos Jobs con distinto `operarioId`.
- (a) La lista del técnico solo trae los suyos.
- (b) `GET /admin/jobs/:id` de un Job ajeno (mismo merchant) → **404**.
- (c) Admin/owner ve ambos.
- Sección **"§6 Operarios"** en `SUITE_REGRESION.md` (compartida con SCRUM-22; el que mergea segundo sube versión). Registrar el test nuevo en `package.json` (bug P3-7).

---

## 8. Definición de Hecho (Gate)

- `npm run build` + `npm test` verdes; suite en verde (con §6 y el caso row-level).
- PR con descripción pegada antes (lo crea Luis). Verificado en yaqu.app.
- Ticket a "En revisión" con enlace; "Finalizada" solo el asesor.
- Hallazgos → tickets aparte (regla 9).

---

## 9. Jira

- "En revisión" al abrir PR (comentario + evidencia + enlace). "Finalizada" (id 51) solo el asesor. Label `dev2`.

---

## Pendiente antes de disparar
1. **SCRUM-22 read-path cerrado en `main`** (desbloquea la precondición de datos). ← único bloqueo vivo.
2. Hallazgo `collect-rest`/rol → ✅ ya abierto (SCRUM-54, de Luis).
3. Decisiones 1/2/3 → ✅ cerradas (arriba).

# SESION_ACTUAL_SCRUM-22.md — Brief
**SCRUM-22 · OPERARIO-1 · Autoría del operario en el Trabajo (registro de nombre en todo el flujo)**
Carril Javier · label `dev2` · Fase F2 · Epic padre SCRUM-21 · Depende de SCRUM-10 (contenedor Trabajo, ya existe) y reutiliza Equipo S1.
Estado del brief: **v1.1 — FINAL.** Las dos decisiones abiertas las tomó el asesor por delegación expresa de Luis (14-jul); ver §2. Listo para ejecución tras: (1) merge del PR aditivo del carril A, (2) publicación del comentario de schema en el ticket.

---

## 1. Cabecera — qué gobierna, flujo y zonas sensibles

**Gobierna:** `YAQU_MASTER.md` (Parte S1 roles Admin/Técnico, S2 audit, reglas 2/3/27) + ticket **SCRUM-22** y su comentario de Luis (14-jul) + `PLAN_EJECUCION_Y_PARALELO.md §3.3` (zona roja). Si algo aquí contradijera al máster, gana el máster (regla 35).

**Flujo:** `git checkout main && git pull` → rama `scrum-22-operario-autoria` → commit de feature (uno) → **PR lo crea Luis** con descripción pegada antes → Luis mergea (merge commit si 2+ commits). Ticket a **"En revisión"** al abrir PR; **"Finalizada" (transición id 51) la pone SOLO el asesor** tras verificación.

**🚨 ZONAS SENSIBLES:**
- 🚨 **`prisma/schema.prisma` — NO se toca en este carril.** `Job.operarioId` lo sirve **Luis en el PR aditivo del carril A** (regla 3, AA1.4). Ver §4 y "Comentario carril A".
- 🚨 **`jobDetailView.js` / `homeView.js` — NO se tocan** (carril Luis, Fases 1-2). El render del nombre del operario en detalle + timeline lo **ejecuta el carril A sobre la spec de §7**.
- 🚨 **`jobs.routes.ts` (serializers) — zona roja compartida:** el carril B solo **añade** campos al JSON (aditivo); nunca modifica los existentes. Anunciar en el ticket antes de tocar. **Es el único archivo compartido que toca Javier en esta tarea.**
- Write-path (schema + `ensureJobForQuote` + audit) va en el PR del carril A → Javier NO edita `job.service.ts`, `quotesAdmin.routes.ts` ni `audit.service.ts`.
- Sin dinero, sin fiscal, sin webhooks, sin WhatsApp en esta tarea.

---

## 2. Decisiones del fundador (delegadas al asesor — tomadas, no reabrir)

Luis delegó ambas decisiones en el asesor (14-jul). Quedan tomadas así:

**Decisión 1 — `operarioId` (autor) vs `assignedUserId` (asignado): SEPARADOS. ✅**
- `operarioId` = **autoría inmutable**, poblada al crear el Job heredando `quote.teamMemberId` (el creador del presupuesto). No hay endpoint que la cambie en V1.
- `assignedUserId` = sigue siendo la **asignación editable** (PATCH ya existente).
- *Por qué:* el DONE pide "autoría" (quién lo originó), que es un hecho histórico distinto de "quién lo lleva ahora". Mezclarlos rompería la trazabilidad en cuanto se reasignara un trabajo. `assignedUserId` ya cubre la asignación; `operarioId` cubre el origen. Mínimo y sin ambigüedad.

**Decisión 2 — reparto del trabajo (write-path vs read-path): HÍBRIDO. ✅**
- **PR aditivo del carril A (Luis), previo:** schema + poblado + audit (todo el write-path, dominio jobs/schema/system).
- **PR del carril B (Javier, `dev2`):** exposición en el serializer + derivación a documentos + tests de lectura + spec de render (read-path, en archivo compartido aditivo).
- *Por qué:* `schema.prisma` es exclusivo de Luis y el poblado en `ensureJobForQuote` es dominio jobs (también de Luis) y hot en Fases 1-2. Servir el campo **ya poblado** en un solo PR aditivo es atómico (nada de "columna vacía a medias") y evita que dos manos toquen el servicio de jobs a la vez (lección 13-jul, la razón de ser del protocolo). A Javier le queda el read-path, que vive en zona compartida aditiva de bajo riesgo de colisión — el rodaje más seguro para su primera tarea. Respeta al pie de la letra "el carril de Luis entrega un PR aditivo previo → Javier construye encima".

---

## 3. Contexto real del repo (del recon — confírmalo, no lo re-descubras)

- **TeamMember** — `schema.prisma:460-477` (id, merchantId, name, email `@unique`, role `admin|tecnico`, status). **No hay tabla User.** El **owner NO es TeamMember**: es el propio `Merchant` (admin implícito, `teamMemberId = null`).
- **Sesión/rol** — `authMiddleware.ts:15-33` inyecta `req.merchantId`, `req.teamMemberId` (number|null; **null = owner**), `req.userRole`. Tipos en `express.d.ts:4-8`.
- **Quote ya tiene autoría** — `teamMemberId` (creador; null = owner) en `schema.prisma:263`; poblado con `getCreatorTeamMemberId(req)` en `quotes.routes.ts:25-33` → guardado en `quotes.routes.ts:133`. **Es la fuente de la herencia.**
- **Job** — `schema.prisma:549-573`. Tiene `assignedUserId Int?` (teamMember, **asignado editable**) vía `PATCH /admin/jobs/:id` con tenancy en `jobs.routes.ts:209-215`. **NO tiene campo de autor.** FSM (Parte L): `pendiente_agendar → agendado → en_curso → terminado → cerrado`. Auto-creación al `quote → accepted`.
- **ensureJobForQuote** — `job.service.ts:29-61` crea el Job en el accept **sin propagar** `quote.teamMemberId`. El accept lo dispara fire-and-forget en `quotesAdmin.routes.ts:64`.
- **Albarán** — `schema.prisma:637-656`, sin autor; se crea en `jobs.routes.ts:267-300`. **Cobro** (Invoice/Charge): sin autor de la acción manual.
- **Audit** — la tabla `audit_log` **ya existe** (lote EXT3, 5-jul). `recordAudit` (`audit.service.ts`) **ya acepta `teamMemberId`**; hoy cubre `marcar_pagado_manual`, `deshacer_pago`, `anular_factura`, `cambio_flag`, `albaran_editado`. **Ninguna acción de "crear/asignar trabajo".**

➡️ **El hueco exacto:** la autoría existe en el Quote pero se pierde al saltar a Job, y no llega a albarán/cobro.

---

## 4. Qué hay que hacer — alcance EXACTO (aditivo)

### 4.A — PR aditivo del carril A (Luis), PREVIO. Javier no arranca hasta su merge.
1. **Schema:** `Job.operarioId Int? @map("operario_id")` + `@@index([merchantId, operarioId])`.
2. **Poblado — `job.service.ts` (`ensureJobForQuote`, :29-61):** al crear el Job en el accept, `operarioId = quote.teamMemberId`. Fuente = **creador del presupuesto**, **NO** `req.teamMemberId` del que acepta (suele ser admin). `quote.teamMemberId === null` (owner) → `operarioId = null`.
3. **Audit — `audit.service.ts` (system):** añadir literal `operario_asignado` al union `AuditAction`; emitir `recordAudit({ merchantId, teamMemberId: operarioId, action: 'operario_asignado', entityType: 'job', entityId })` en la creación del Job (junto al poblado, mismo write-path).

> Todo 4.A es aditivo (regla 3), reutiliza `TeamMember` (regla 27), sin `--accept-data-loss`. Ver "Comentario carril A" para pegar en el ticket.

### 4.B — PR del carril B (Javier, `dev2`), sobre el campo ya poblado.
1. **Serializer — `jobs.routes.ts` (`serializeJob` / `serializeJobDetail`) — [zona roja, solo añadir]:** exponer `operarioId` y `operarioNombre`. `operarioNombre` = `TeamMember.name` si `operarioId` no es null; **fallback al nombre del merchant si es null** (mismo criterio que `GET /admin/team` para el owner).
2. **Propagación a documentos (mínimo, sin schema nuevo):** presupuesto ya lleva `teamMemberId` (nada que hacer); **albarán y cobro derivan la autoría de `Job.operarioId`** (cuelgan del Job) → exponer `operarioNombre` al serializar reutilizando la resolución del punto 1. **No** se añaden columnas a Albarán/Invoice en V1.
3. **Tests de lectura** (ver §7) y **spec de render** para el carril A (§7).

**Textos canónicos (regla 30):** esta tarea **no** introduce copy de cara al cliente. `operarioNombre` muestra el nombre real del TeamMember o del merchant; no hay literal nuevo que inventar.

---

## 5. Lo que NO incluye (fronteras del V1)

- **NO** filtra la lista de Trabajos por operario ni bloquea acceso cruzado (403) → **SCRUM-23**.
- **NO** añade la vista de supervisión de admin → **SCRUM-24**.
- **NO** añade `Albaran.operarioId` ni columnas de autor por-documento (se **deriva** del Job).
- **NO** pinta el nombre en `jobDetailView.js`/`homeView.js` → carril A sobre la spec de §7.
- **NO** toca `schema.prisma`, `job.service.ts`, `quotesAdmin.routes.ts` ni `audit.service.ts` desde el carril B (van en 4.A).
- **NO** reasignación de `operarioId` (es autoría inmutable; `assignedUserId` cubre la asignación).

> **Nota de diseño para SCRUM-23 (no se decide aquí):** SCRUM-23 filtra la visibilidad del técnico por `operarioId`. Como aquí `operarioId` = autor inmutable, "el técnico ve sus trabajos" = "los que originó", no necesariamente "los que tiene asignados ahora". Si en obra real el admin reasigna y se espera que el nuevo asignado los vea, habrá que decidir en SCRUM-23 si la visibilidad va por `operarioId` (autor) o por `assignedUserId` (asignado), o por ambos. Queda **anotado como decisión pendiente para el brief de SCRUM-23**, sin resolver en esta tarea.

---

## 6. STOP conditions (AA1.4)

- 🛑 **`schema.prisma` no se toca en el carril B.** Si Claude Code cree que necesita un campo no servido → **PARA y reporta** en el ticket.
- 🛑 Si `prisma db push` pidiera `--accept-data-loss` → **abortar y reportar** (regla 3). No debería: el campo lo sirve el carril A.
- 🛑 **`jobs.routes.ts` (zona roja compartida):** anunciar en el ticket antes de commitear (aditivo). Si hubiera que **modificar** un campo existente del serializer → **PARA + OK**.
- Sin dinero/webhooks/WhatsApp en la tarea; si la implementación derivara hacia cualquiera → **PARA**.

---

## 7. Spec de render para el carril A (`jobDetailView.js`) + E2E automatizado

**Spec de UI (la ejecuta Luis, no Javier):**
- **Detalle del Trabajo:** mostrar el responsable, `Operario: {operarioNombre}` (del JSON de `serializeJobDetail`).
- **Timeline:** atribuir el origen del Trabajo al operario (p. ej. "Creado por {operarioNombre}").
- Caso `null` → nombre del merchant (owner). Digno 390/1280 (skill `yaqu-premium-ui` + DESIGN.md).

**E2E AUTOMATIZADO (suite Playwright / `node --test`):**
- *(con 4.A, carril Luis)* **Unit:** `ensureJobForQuote` hereda `quote.teamMemberId` (creador) y **no** `req.teamMemberId` del aceptante. **Audit:** crear Job con operario deja registro `operario_asignado` con `teamMemberId`.
- *(con 4.B, carril Javier)* **Serializer:** `serializeJob`/`serializeJobDetail` incluyen `operarioId`+`operarioNombre` sin romper el contrato. **Owner:** `operarioId = null` → `operarioNombre` = nombre del merchant. **Tenancy (regla 2):** no se resuelve `operarioNombre` contra un `TeamMember` de otro merchant; acceso cruzado a un Job sigue devolviendo 404/403 (alineado con la tenancy suite A12.1).
- Añadir sección **"§6 Operarios"** a `SUITE_REGRESION.md` (subir versión del doc si se mergea segundo). Test nuevo → **añadirlo a la lista de `package.json` en el mismo PR** (bug P3-7).

---

## 8. Definición de Hecho (Gate)

- `npm run build` + `npm test` verdes; suite en verde (con la nueva §6).
- PR con descripción pegada **antes** de crear (lo crea Luis). Merge commit si 2+ commits.
- Sin commit de máster (esta tarea no lo cambia; si surgiera necesidad → commit de docs aparte, regla 27).
- Verificado en **yaqu.app** tras merge (el render lo verifica un humano con login).
- Ticket a **"En revisión"** con enlace del PR. **"Finalizada" solo el asesor** tras verificación.
- Hallazgos por el camino → **tickets aparte** (regla 9), con "NACE DE: SCRUM-22".

---

## 9. Jira

- A **"En revisión"** al abrir el PR (comentario + evidencia + enlace).
- **"Finalizada" (id 51) la pone SOLO el asesor** tras verificación (suite verde + verificación humana del render). Claude Code jamás transiciona a Finalizada. Label `dev2`.

---

## Comentario carril A — para pegar en SCRUM-22 (petición a Luis, PR aditivo previo)

> **PR aditivo del carril A para SCRUM-22 (previo al carril B).** Todo aditivo (regla 3, sin `--accept-data-loss`), reutiliza `TeamMember` (regla 27). Convención `Int?` con `null = propietario`, idéntica a `Quote.teamMemberId` / `AuditLog.teamMemberId`.
>
> **1) Schema:**
> ```prisma
> model Job {
>   // ...campos existentes...
>   operarioId Int? @map("operario_id")   // autor/operario del Trabajo; null = propietario (owner).
>   @@index([merchantId, operarioId])      // consumidor inmediato: filtro por operario en SCRUM-23
> }
> ```
> **2) Poblado:** en `ensureJobForQuote` (`job.service.ts:29-61`), `operarioId = quote.teamMemberId` al crear el Job en el accept (creador del presupuesto, NO el que acepta).
> **3) Audit:** literal `operario_asignado` en el union `AuditAction` (`src/modules/system/audit.service.ts`) + `recordAudit({...teamMemberId: operarioId...})` en la creación.
>
> **Diferido (solo si el brief exige autoría por-documento independiente):** `Albaran.operarioId Int?`. Con el alcance mínimo NO se pide: la autoría se deriva del Job (albarán/cobro cuelgan de `jobId`).
>
> Sobre este PR, el carril B (dev2) expone `operarioId`+`operarioNombre` en el serializer y deriva la autoría a los documentos.

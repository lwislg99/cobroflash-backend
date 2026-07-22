# SESION_ACTUAL_SCRUM-24.md — Brief
**SCRUM-24 · OPERARIO-3 · Vista de admin: supervisar trabajos y progreso por operario**
Carril B (Javier) · label `dev2`, `ui` · Fase F2 · Epic SCRUM-21 · Depende de SCRUM-22 ✅ + SCRUM-23 ✅ + SCRUM-11.
Estado: **v1.0 — DESBLOQUEADA.** Sus dos dependencias están en `main`. Decisiones cerradas (asesor + carril B).

---

## 1. Cabecera

**Gobierna:** `YAQU_MASTER.md` (S1 = equipo/supervisión solo Admin · S3 = filtrar en backend · reglas 4 vanilla, 27, 30) + ticket SCRUM-24 + `DESIGN.md` + skill `yaqu-premium-ui`.

**Flujo:** `git pull` main → rama `scrum-24-supervision-operarios` → commit → PR → lo revisa Luis (`required approvals = 1`) → **mergeas y cierras tú**.

**🚨 ZONAS SENSIBLES:**
- 🚨 **La UI va en ARCHIVO NUEVO** (`operariosView.js`). NO se toca `jobDetailView.js` ni `homeView.js`.
- 🚨 **`jobsView.js` NO se toca** (ver Decisión 1): es UI de Trabajos, dominio conceptual del carril A.
- 🚨 **Gate admin-only EN BACKEND**, no ocultando el nav (S3). Ver el precedente de §5.
- 🚨 Zona roja compartida: `app.ts` (montar ruta) y `adminOnlyRoutes.ts` → aditivo, avisar en el ticket.
- NO se toca `schema.prisma` (no hace falta nada nuevo).

---

## 2. Decisiones cerradas (asesor + carril B — no reabrir)

**D1 — Vista NUEVA `operariosView.js`, no un modo dentro de `jobsView.js`.** El ticket dice "variante de la lista de Trabajos", pero `jobsView.js` es UI de Trabajos (carril A conceptualmente) y la norma del carril B es "UI de operarios en archivos nuevos". Archivo aparte = cero colisión.

**D2 — Endpoint NUEVO de resumen, admin-only: `GET /admin/metrics/operarios`.** Con `groupBy` de Prisma. Descartada la opción de meter `?operarioId=` + agrupación en `GET /admin/jobs`: mezclaría responsabilidades en un handler de zona roja que acabamos de tocar en SCRUM-23.

**D3 — Agrupa por `operarioId` (autor), coherente con 22/23.** Consecuencia a decir explícita en el PR: si el admin reasigna un Trabajo, el resumen lo atribuye a **quien lo originó**, no a quien lo lleva hoy. Que no sorprenda al ver los números.

**D4 — El gate va en backend Y en front.** `requireRole('admin')` + entrada en `ADMIN_ONLY_ROUTES` (backend, lo que cuenta) + guard de rol en el router de vistas (UX). Nunca solo el front.

---

## 3. Contexto real del repo (del recon — confírmalo, no lo re-descubras)

**Reutilizar (NO reinventar):**
- **Semáforo de cobro:** `COBRO_PILL_CLASS` en `jobsView.js:16` (`Pagado`→`status-pill-accepted`, `Parcial`→`status-pill-pending`, `Pendiente`→`status-pill-draft`); el dato es `job.estadoCobro`.
- **% cobrado:** `pct = Math.min(100, Math.round((cobrado/aceptado)*100))` (`jobsView.js:139`) → componente `progressBar(pct, estado, {cobrado, aceptado, currency})` en `api.js:210`.
- **Filtro segmentado:** patrón `jobsCobroFilter` (`jobsView.js:54-70`) sirve de molde para el selector por operario.

**Datos financieros por Trabajo:** `serializeJob` (`jobs.routes.ts:51-82`) ya expone `totalAceptado`, `totalCobrado`, `estadoCobro` (vía `estadoCobroFor`, `job.service.ts:119-125`) y `remaining` (:74). `totalCobrado` se materializa en `recalcJobCobradoForQuote` (`job.service.ts:72-82`).

**Plantilla de código casi idéntica:** `getTeamMetrics(merchantId)` (`metrics.service.ts:380-434`) ya agrega por `teamMemberId` **del Quote** (con clave 0 = propietario), y lo pinta "Rendimiento del equipo" en `homeView.js:464-500`. **Clona su estructura** (map de agregados + fila del owner), pero **no es fuente directa**: agrega por autor del presupuesto, no por `Job.operarioId`.

**Admin-only, cómo se hace hoy:** `requireRole('admin')` al montar (`app.ts:229-231`, `:304`) + lista única `ADMIN_ONLY_ROUTES` (`src/core/http/adminOnlyRoutes.ts`) que la suite A12.4 recorre con sesión de técnico exigiendo 403. **Front:** `window.appUserRole` de `GET /admin/me` (`app.js:10`); nav oculto para técnico (`app.js:40-48`); router redirige a Home si un técnico teclea `team`/`settings` (`app.js:249-268`) ← **clonar este patrón**.

**Dónde encaja la vista:** `public/dashboard/js/*View.js`, registradas en el switch de `renderView` (`app.js:176-273`); estilos en `public/dashboard/css/styles.css`; tokens en `public/tokens.css`.

---

## 4. Alcance EXACTO V1

**Backend — `GET /admin/metrics/operarios`:**
- `requireRole('admin')` + añadir a `ADMIN_ONLY_ROUTES`.
- `prisma.job.groupBy({ by:['operarioId'], where:{merchantId}, _sum:{totalAceptado,totalCobrado}, _count:{id} })` (aprovecha el `@@index([merchantId, operarioId])` de SCRUM-52).
- Por operario devuelve: `operarioId`, `nombre` (TeamMember scopeado al merchant; **fila del owner con `operarioId: null` → nombre del merchant**), `abiertos` (count `status != 'cerrado'`), `totalAceptado`, `totalCobrado`, `pendiente` (= aceptado − cobrado), `progreso` (%).

**Frontend — `public/dashboard/js/operariosView.js` (NUEVO):**
- `renderOperariosView(container)` + `case 'operarios'` en `renderView` (aditivo) + guard de rol clonado de `team` (`app.js:249-257`) + nav-item oculto para técnico como `nav-team`.
- Tarjetas de resumen por operario reutilizando `progressBar` y las `status-pill` de cobro. Selector/filtro por operario con el patrón de `jobsCobroFilter`.
- Digno 390/1280 (`DESIGN.md` + skill `yaqu-premium-ui`, checklist AB6). **Sin copy inventado** (regla 30).

---

## 5. Fuera de V1

- Mini-resumen por operario en Home del admin (el ticket lo marca **opcional futuro**) → no se hace.
- Drill-down operario → lista filtrada de sus Trabajos.
- Ordenar por morosidad acumulada.
- **NO** se arregla el hallazgo de `/admin/metrics/team` (ver abajo).

**🚩 HALLAZGO ya detectado (regla 9 — reportar, no arreglar aquí):** `GET /admin/metrics/team` (`metrics.routes.ts:65-72`) **no lleva `requireRole('admin')`** ni está en `ADMIN_ONLY_ROUTES`; se oculta solo en front (`homeView.js:464`) → un Técnico puede llamarlo y ver el rendimiento de todo el equipo. **Es el precedente exacto de lo que NO hay que repetir aquí.** Si no tiene ticket todavía, ábrelo ("NACE DE: SCRUM-24", dominio equipo).

---

## 6. STOP conditions

- 🛑 Si el gate admin-only acabara solo en el front → PARA (S3).
- 🛑 `schema.prisma` no se toca (no hace falta).
- 🛑 `jobDetailView.js` / `homeView.js` / `jobsView.js` no se tocan.
- 🛑 Nada de React/Tailwind/bundler (regla 4, vanilla).

---

## 7. Tests

En `tests/tenancy-permisos.test.mjs` (ya protegido por SCRUM-60) o fichero nuevo (entonces **registrar en `package.json`**, bug P3-7):
- El endpoint devuelve **sumas correctas** por operario (2 técnicos con Jobs de importes distintos + fila del owner).
- **Técnico → 403** en `GET /admin/metrics/operarios` (añadir la ruta a `ADMIN_ONLY_ROUTES` hace que A12.4 lo cubra).
- **Tenancy (regla 2):** no aparecen operarios ni importes de otro merchant.
- **Datos efímeros propios + limpieza en `finally`. NUNCA depender del seed demo** (lección de SCRUM-63).
- Suite: pasos nuevos dentro de la **§7 Operarios** existente (no crear sección ni renumerar).

---

## 8. Definición de Hecho

- `npm run build` + `QA_DB_TEST=1 npm test` contra **staging** en verde (el fallo `A12.2c`/SCRUM-63 es preexistente y ajeno).
- PR con descripción; revisa Luis; **mergeas y cierras tú**.
- Verificado en yaqu.app con login admin y con login técnico (que NO vea la vista).
- Capturas 390/1280.
- Hallazgos → ticket aparte (regla 9).

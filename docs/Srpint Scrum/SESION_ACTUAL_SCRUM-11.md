# TAREA ACTIVA — SCRUM-11 · Lista "Trabajos": semáforo de cobro + barra % + filtro

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md`. NO dependas del chat.
> Regla base: UNA tarea → UN commit de feature (+ 1 commit aparte para el máster, PUSHEADO al cerrar).
> ✅ Es PURO FRONT. Cero backend, cero schema, cero dinero. El dato ya viaja. Lee DESIGN.md + skill yaqu-premium-ui antes de tocar UI.

---

## 0. CONTEXTO REAL (ya verificado — confírmalo)
- `jobsView.js`: lista agrupada CLIENT-SIDE por estado/fecha (6 grupos: En curso, Esta semana, Sin agendar, Más adelante, Terminados, Cerrados). Cada `jobCard` pinta: cliente (bold), "Presupuesto #nº · total", pill de ESTADO FSM (hand-styled vía `JOB_STATE_META`, NO usa `.status-pill`), acciones FSM, textarea de notas. HOY NO pinta semáforo de cobro ni % cobrado. Tiene skeleton/empty/error states.
- Endpoint `GET /admin/jobs` (`jobs.routes.ts`): `serializeJob` YA devuelve `estadoCobro` ('Pagado'|'Parcial'|'Pendiente'), `totalCobrado`, `totalAceptado`, `quote{number,total,...}`, `customer{name,...}`. **BACKEND LISTO — no lo toques.**
- **Pills canónicos** en `styles.css:474-485` (+ anillo foco 1448-1451). `invoicesView.js:296-297` YA mapea estado→pill: **ese es el patrón a copiar.**
- **Barra de progreso**: patrón inline en `reportsView.js:625-626` y `settingsView.js:546-547` (track `background:var(--neutral-100);border-radius:6px;height:14px;overflow:hidden` + fill `width:${pct}%;background:${color};transition:width .4s`, color verde/ámbar cerca del límite). **NO existe componente compartido.**
- **Toolbar de filtros** canónico: `quotesListView.js:46-85` (`.data-card-toolbar` con búsqueda + `<select>` estado + fechas). `jobsView.js` hoy NO tiene toolbar.

## 1. QUÉ HAY QUE HACER (3 cosas, con las decisiones ya tomadas)

### 1A. Semáforo de cobro (pill) junto al IMPORTE
- En cada `jobCard`, añadir un pill de estado de cobro **pegado al importe** (no junto al pill de estado FSM — cobro y dinero van juntos).
- **Reutiliza `.status-pill` canónico** (NO hand-styled). Mapeo (igual que `invoicesView.js`):
  - `Pagado` → `.status-pill-accepted` (verde)
  - `Parcial` → `.status-pill-pending` (ámbar)
  - `Pendiente` → `.status-pill-draft` (neutro)
- El dato es `job.estadoCobro` (ya viene del backend).

### 1B. Barra de % cobrado — COMO COMPONENTE COMPARTIDO
- **Crear un componente de barra reutilizable** en `styles.css` (ej. `.progress` / `.progress-track` / `.progress-fill`) con **tokens de DESIGN.md** (nada de colores inline sueltos).
- Usarlo en la `jobCard`: barra con `pct = totalCobrado/totalAceptado`, color verde normal / ámbar cerca del límite (mismo criterio que reports/settings).
- **AÑADIR el componente al inventario (Parte AB3) y a DESIGN.md** como componente oficial. [VALIDAR con DESIGN.md: si falta un token de color para la barra, derívalo de los existentes y proponlo, no lo inventes a lo loco].
- NOTA: NO refactorices ahora las barras inline de reports/settings a este componente (sería otra tarea). Solo créalo y úsalo aquí; deja anotado que reports/settings podrían migrar luego.

### 1C. Filtro "por cobrar"
- Añadir un filtro simple ENCIMA de la lista para ver/priorizar los trabajos **pendientes de cobro** (era petición del fundador).
- Patrón: `.data-card-toolbar` (como `quotesListView.js`), pero **adaptado al layout de tarjetas agrupadas** — NO conviertas la lista en tabla. Un `<select>` o unos chips "Todos / Pendiente / Parcial / Pagado" que filtren las tarjetas mostradas, respetando el agrupado existente.
- Mínimo viable: que se pueda filtrar por estado de cobro. Búsqueda/fechas NO hacen falta aquí (eso es más de SCRUM-12/listados grandes).

## 2. FUERA DE ALCANCE (NO tocar)
- Refactor de los pills de ESTADO FSM hand-styled (`JOB_STATE_META`) a `.status-pill` canónico → es otra tarea, déjalo como nota.
- El endpoint / backend / serializeJob (ya está listo).
- El detalle del Trabajo (eso es SCRUM-12).
- Migrar las barras inline de reports/settings (nota aparte).

## 3. STOP CONDITIONS (AA1.4)
- Esta tarea NO toca dinero, backend ni schema. Si te ves arrastrado a tocar el endpoint, serializeJob (más allá de leer lo que ya da), o cualquier cosa de pagos → PARA.
- Si al crear el componente de barra necesitas un token que no existe en DESIGN.md → derívalo de los existentes y PROPONLO (no lo uses en más de una pantalla sin validar). 

## 4. DEFINICIÓN DE HECHO (Gate)
- Cada tarjeta de Trabajo muestra el semáforo de cobro (pill canónico) junto al importe, con el mapeo correcto.
- Barra de % cobrado funcionando como componente compartido nuevo, añadido a AB3/DESIGN.md.
- Filtro "por cobrar" funcional sobre la lista, sin romper el agrupado.
- **Digno a 390px y 1280px.** Skeleton/empty/error states siguen intactos.
- **Sin regresión:** acciones FSM, .ics, notas, agrupado — todo sigue igual.
- Capturas antes/después a 390 y 1280 (matriz V0-5 / AB6).

## 5. AL TERMINAR — MÁSTER (commit SEPARADO, PUSHEADO)
- Commit de feature primero.
- Commit del máster aparte: (a) marcar el avance de la lista de Trabajos con semáforo/% en JOB-1/TRABAJO-2, y (b) **añadir el nuevo componente de barra al inventario de la Parte AB3 y a DESIGN.md**. Solo AÑADIR (regla 16). **PUSHEAR** y confirmar "máster pusheado ✅" con hash.

## 6. JIRA
- Mueve **SCRUM-11** a "En revisión" con comentario (qué se añadió, capturas, componente nuevo en DESIGN.md, máster pusheado).

## 7. FORMATO DE ENTREGA (repórtame)
- Archivos tocados.
- El componente de barra creado (CSS) + dónde quedó documentado (AB3/DESIGN.md).
- Capturas 390/1280 (semáforo + barra + filtro).
- Confirmación de no-regresión.
- Máster pusheado (hash).
- Dudas para el fundador.

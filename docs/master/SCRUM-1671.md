# SCRUM-1671 — PILOTO-1 · los partes del trabajo en GET /admin/jobs/:id

**Medido contra:** `origin/main` = `813cfd512622f382395f464503add8c94f59c921` · 2026-11-11T15:28:36Z (rama nacida de ese `main`; `origin/main` se movió a `573579309` mientras se medía) · **Rama:** `scrum-1671-partes-en-el-trabajo` · **Carril:** S1 · trabajos.

A9: comprobación → `tests/scrum1671-partes-en-el-detalle-del-trabajo.test.mjs`

> Puesto S1 (servidor). El ticket reparte el arreglo en dos: **S1** que el GET traiga los partes del
> trabajo (esto) y **S2** pintarlos en `jobDetailView.js`, sección de documentos. Este PR **no cierra**
> el ticket: la segunda línea de la aceptación («la ficha del trabajo #79 enseña "PT-2026-005 · firmado"»)
> es de S2.

## El arreglo (sin texto nuevo)

- `serializeJobDetail` (`src/modules/jobs/app/routes/jobs.routes.ts`) pide los partes del trabajo con
  `where: { merchantId, jobId }` y los devuelve como `partes: [{ id, numero, fecha, estado }]`, más
  reciente primero. Es la misma forma que ya pinta la ficha del cliente (`historialDelCliente.ts`):
  una sola idea de «el parte en una lista». El contenido del parte se sigue leyendo en su ruta.
- Viaja por las **dos** salidas del serializador (la temprana del trabajo sin presupuesto —el caso
  medido— y la normal). Sin partes: `partes: []`, no un campo ausente.
- Una consulta más por detalle (no por fila del listado: `serializeJob` no se toca).
- Fuera de alcance, y anotado en el ticket: «el parte firmado no mueve el estado del trabajo»
  (sigue en AGENDADO). Eso es una transición de la FSM (Parte L), no un dato que falte: se propone, no se pone.

## Medido

- **Rojo primero** (test nuevo contra el `jobs.routes.ts` de `813cfd512`): 5 de 5 caen; el primero por lo
  que tiene que caer: `el detalle del trabajo no trae \`partes\``.
- **Verde:** 5/5.
- **Mutación**, en `dist`, revertida después: quitar `merchantId` del `where` → cae el test 3 (regla 2).
- **Vecinos:** los 79 ficheros de test que nombran `jobs.routes`, `/admin/jobs/:id` o `serializeJobDetail`
  → 681 tests, 668 ok, 13 saltados, 0 fallos.
- **En yaqu.app:** pendiente del merge. Se mide `GET /admin/jobs/79` con la cuenta QA (el parte #13) y se
  apunta aquí en un apéndice.

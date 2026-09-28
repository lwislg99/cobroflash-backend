# SCRUM-1195 · Cinco rutas del carril J1 sin consumidor: censo con veredicto (no se retira nada)

**Medido contra:** `origin/main` = `7ddab7d83ed9cc6c7c4b18e9d780f641c56fe1a6` · 2026-09-28T20:14:29Z (hora de GitHub, `gh api -i zen`)

Sesión J1 (`jv-j1`), 28-sep-2026, por encargo del orquestador de Javier. **Es un censo con veredicto:
no toca `src/` ni `public/`.** Retirar o enchufar cada ruta es otra decisión y otro ticket.

## ① PASO 0 · el defecto sigue vivo, y son CINCO, no cuatro

Dos sondas independientes (A3):

1. **Por AST** — el censo de SCRUM-1185, `node scripts/_censo-sin-consumir.mjs --ref origin/main`,
   exit 0. Población: 304 ficheros de `src/`, 98 JS de `public/`, 9 HTML, 239 rutas (16 externas),
   713 consumidores. **Las cinco salen como `ruta ·` sin consumidor**, incluida `evidencias.zip`.
2. **Por texto, sobre `public/`**, buscando también las URLs montadas a trozos
   (`'/admin/invoices/' + id + …`, `` `/admin/invoices/${…}` ``) y los llamadores que la sonda AST
   declara ciegos (`api.js::_pedir`, `api.js::descargarBinario`, `invoicesView.js::fetchInvoices`):
   - `descargarBinario(` tiene 4 llamadores y ninguno pide estas rutas (`portabilidad.zip`,
     `datos.zip`, `libros/expedidas.csv`, `verifactu.xml`).
   - Toda URL de factura montada a trozos en `public/` es `/status`, `/send-email`,
     `/payment-anomaly`, `/send-reminder`, `/rectify`, `/regenerate-pdf`, `/annul`, `/asignados`,
     `/bulk-paid` o el detalle. Ninguna `pay`/`unpay`.
   - `recibidas`: solo se pide `recibidas.json` (`facturasRecibidasView.js:155`, `reportsView.js:527`).
   - `303`/`modelo`: todas las apariciones son comentarios o el SCRUM-303 de albaranes.

**Corrección al recuento del encargo:** los «5 consumidores» de `evidencias` eran **comentarios**.
Todas las apariciones de la palabra en `public/` —7 líneas en 7 ficheros (`styles.css:2834`,
`albaranDetailView.js:190`, `api.js:25`, `customersView.js:90`, `jobDetailView.js:795`,
`jobTrabajoPlegable.js:7`, `settingsSubmenus.js:327`)— son prosa, casi todas rutas de
`docs/master/evidencias/`. Ninguna es una llamada. Las dos sondas coinciden: **cinco sin consumidor.**

Control positivo: con el mismo barrido, `libros/expedidas.csv` SÍ aparece consumida
(`exportView.js:319`), y el censo AST no la lista.

## ② Veredicto por ruta

| Ruta | Veredicto | Motivo medido | Dueño / siguiente paso |
|---|---|---|---|
| `GET /admin/modelo-303` | **(b) pantalla pendiente** | El propio fuente lo declara: «no hay pantalla todavía» (`modelo303.routes.ts:4-5`). | **J1, SCRUM-1064** (ya existe; depende del ticket del cálculo). Y **detrás de SCRUM-1232**: hoy el 303 suma los justificantes `JUST` a la casilla 27. |
| `GET /admin/evidencias.zip` | **(b) pantalla pendiente, SIN ticket** | Construido en SCRUM-297 como paquete para el asesor; nadie le dio entrada. Ya lo midieron SCRUM-323 §3 y SCRUM-328 B, y no se abrió ticket. | **J1.** Propuesta: colgarlo de SCRUM-322 (el envío al asesor) o abrir uno. Hereda SCRUM-1232: el ZIP lleva `libro-registro.csv` y `modelo-303.csv`. |
| `GET /admin/libros/recibidas.csv` | **(a) defecto** | Las dos pantallas donde encaja **existen** y no la ofrecen: «Exportar» descarga el libro de **emitidas** (`exportView.js:319`, SCRUM-325) y no el de recibidas; «Facturas recibidas» (SCRUM-1040) pinta `recibidas.json` y no tiene descarga. Un despacho necesita los dos libros (SCRUM-323 §3). | **J1.** Un botón de descarga en una de las dos pantallas, con un literal nuevo → **firma** (regla 39). No depende de SCRUM-1232 (es el libro de gastos). |
| `POST /admin/invoices/:id/pay` | **(c) código muerto** | Un duplicado heredado de `PUT /admin/invoices/:id/status`, que es lo que usa la pantalla (`invoiceDetailView.js:490`). El fuente lo dice: «Endpoints legacy pay/unpay si quieres mantenerlos» (`invoicesAdmin.routes.ts:567`). Existen desde `5142388b` (26-nov-2025). | Propuesta de retirada, **ticket aparte y con el sí de un jefe** (dinero, regla 29). Ver ④. |
| `POST /admin/invoices/:id/unpay` | **(c) código muerto** | Igual que `pay`, frente a `PUT /status` con `status: 'pending'`. | La misma propuesta. |

### Dos textos que afirman una descarga que no existe

- `public/dashboard/js/facturasRecibidasView.js:3-4`: «el libro … solo salía como descarga CSV».
- `docs/master/SCRUM-1040.md:12-13`: «lo servía como descarga».

La ruta sirve el CSV, pero **ninguna pantalla lo pide**, así que el profesional nunca pudo descargarlo.
Son comentarios, no textos de pantalla. Se corrigen junto con el botón de (a), no aquí.

## ③ `pay` / `unpay` · medidas EJECUTÁNDOLAS, no leyéndolas

Una sonda que monta el router **real** de `dist/` (build de este árbol, exit 0) con un `prisma`
**falso** en memoria: sin base, sin red y con todas las `DATABASE_URL*` borradas del entorno del
proceso. 6 casos, `EXIT=fin`:

| caso | respuesta | escrituras |
|---|---|---|
| CONTROL · `pay` sobre `pending` | 200, `status: paid` | `invoice.update`, `auditLog.create` |
| `pay` sobre **anulada** | **500 `internal_error`** + traza en el log | ninguna |
| `PUT /status` `paid` sobre anulada (lo que usa la pantalla) | 409 `unpay_not_allowed` | ninguna |
| `unpay` sobre F1 pagada | 409 «…emite una rectificativa (R1).» | ninguna |
| `PUT /status` `pending` sobre F1 pagada | 409, el mismo texto | ninguna |
| `pay` con `paidVia: 'bizum'` en el cuerpo | 200, **sin `paidVia`** | `invoice.update`, `auditLog.create` |

**Lo que NO está roto:** las dos delegan en `updateInvoiceStatusAdmin` (`invoiceAdmin.ts:304-310`), así
que heredan las mismas guardas que la ruta viva: filtran por merchant, una anulada no vuelve, una F1 no
se des-paga y dejan auditoría. **No hay un camino para saltarse la regla 29.**

**Lo raro, y se dice sin arreglarlo (regla 29, A7):**

1. **`pay` sobre una anulada responde 500, no 409.** Su `catch` no reconoce `UnpayNotAllowedError`, al
   contrario que el de `unpay` y el de `PUT /status`. No escribe nada (cae antes del `update`), pero un
   rechazo correcto sale como error del servidor.
2. **`pay` ignora `paidVia` (SCRUM-441):** la factura queda cobrada sin método, aunque el cuerpo lo traiga.

Ninguna de las dos le afecta hoy a nadie, porque nada llama a estas rutas. Son razones para retirarlas,
no para arreglarlas.

## ④ Lo que tocaría retirar `pay`/`unpay` (propuesta, NO se hace aquí)

Se ha medido qué más las nombra, porque retirarlas cambia una población (A12):

- `src/modules/system/app/routes/invoicesAdmin.routes.ts:566-612`: las dos rutas.
- `src/modules/system/invoiceAdmin.ts:303-310`: `markInvoicePaidAdmin` y `markInvoicePendingAdmin`, que
  solo usan estas dos rutas.
- `src/core/http/adminOnlyRoutes.ts:12-13`: la lista de rutas solo de admin.
- `tests/scrum597-asignar-usuario-al-documento.test.mjs:252`: usa `POST …/900/pay` como **muestra** de
  «el operario no puede marcar pagada». Al retirarla hay que cambiar esa muestra por `PUT …/status`, y
  eso toca un guard. Se hace en su PR, se declara y se hace fallar antes (A23 nº 8).
- `scripts/_sin-consumir-declarados.json` (pasar de declaradas a `retiradas`) y
  `scripts/_anclas-sin-testigo.congelado.mjs`.

## ⑤ Lo que NO se ha hecho

- No se ha retirado ni enchufado nada, y no se ha tocado la sonda ni el trinquete de SCRUM-1185.
- No se ha corrido `npm test` entero (lo mata el reaper de memoria en esta máquina, SCRUM-1244). Este
  PR solo añade este fichero.
- Estado de Jira visto de paso, **para el orquestador**: SCRUM-1040 sigue «Por hacer» con su pantalla
  ya en `main` (A18).

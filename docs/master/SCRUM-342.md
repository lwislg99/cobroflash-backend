# SCRUM-342 · quitar el `as any` de `invoicesAdmin.routes.ts:143` (null-safety del quote)

**Fecha:** 5-ago-2026 · **Carril:** B (deuda técnica / null-safety) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `c0b41e64a520a001471294aae9ece9a3b1546b81` · 2026-08-05T00:30:32+01:00

## Por qué (y por qué AHORA, no después)
`GET /admin/invoices/:id/dispute-package` hacía `const quote = invoice.quote as any` (:143). Ese
`as any` **apaga la null-safety de tsc** justo en el camino por donde SCRUM-289 (A0.3, la factura
suelta) va a hacer circular facturas con `quote = null`. Lo encontró el informe de SCRUM-287 (Q2,
riesgo latente de tipos). **342 bloquea a 289**: hay que reenceder el chequeo ANTES de construir el
entrypoint que estrenará ese `null`, no después — con el `as any` puesto, un `quote.total` sin guardar
que alguien añada mañana en el flujo nuevo pasaría a producción sin que el compilador dijera nada.

## 🔴 PARADA obligatoria (regla 38) — resuelta MIDIENDO, no asumiendo
Antes de tocar: ¿está la línea 143 en el **camino de emisión**? Medido en el árbol:
- La línea vive en `GET /:id/dispute-package` (la ruta empieza en :127) — un handler **de solo
  lectura**: `invoice.findFirst` (lee) → `const quote = …` → `whatsAppMessage.findMany` (lee) →
  construye un HTML (paquete de evidencia para disputas de chargeback) → `res.status(200).send(html)`.
- Entre :132 y :219 **no hay una sola llamada de emisión**: ni `invoice.create`, ni
  `allocateInvoiceNumber`, ni `sellar`, ni `ensureInvoicePdf`, ni `.update`, ni `$transaction`.
  El único match textual, «Emitido» (:193), es una etiqueta HTML de fecha.
- **Conclusión: :143 NO está en el camino de emisión.** Es un `GET` que lee y renderiza. Por regla 38,
  leerlo no era STOP y modificarlo aquí tampoco toca el sellado. Adelante sin GO.

Segunda comprobación antes de escribir: los 8 campos que el handler lee de `quote` (`quoteNumber`,
`total`, `currency`, `acceptedAt`, `decisionChannel`, `decisionComment`, `signatureUrl`, `evidence`)
**todos existen** en el modelo `Quote`. El `as any` tapaba **solo el null**, no campos inexistentes →
quitarlo con las guardas `quote?.…` ya presentes es null-safety pura, **sin cambio de comportamiento**.
(Si hubiera tapado un campo inexistente, era una segunda parada: se avisó que se pararía y no hizo falta.)

## Qué se cambió (un solo one-liner de fuente)
`const quote = invoice.quote as any;` → `const quote = invoice.quote;` (queda tipado `Quote | null`).
Nada más de la fuente. Los accesos ya estaban guardados (`quote?.quoteNumber`, `quote ? … : '—'`,
`quote?.signatureUrl ? … : …`), así que compila sin tocar el render.

## Rojo por el mecanismo (NO «compila»)
Se inyectó una **sonda** —un acceso NO guardado `const _probeNull = quote.total;` justo tras :143— y
se construyó en las dos configuraciones:
- **CON `as any`** → `npm run build` **PASA**: tsc trata `quote` como `any` y no ve el acceso a null.
- **SIN `as any`** (tipado) → `npm run build` **FALLA**:
  `invoicesAdmin.routes.ts(144,33): error TS18047: 'quote' is possibly 'null'`.

Esa es la prueba del mecanismo: el `as any` cegaba exactamente la null-safety en este camino; quitarlo
la reenciende. Retirada la sonda, la fuente real (con las guardas) compila limpia. **Nota:** con el
tipo puesto, tsc ahora **impide escribir** la versión que reventaría — el propio compilador es el guard.

## Las dos caras (runtime, no solo tsc)
`tests/scrum342-dispute-package-quote-nulo.test.mjs` invoca el handler REAL (patrón SCRUM-263/308,
sin BD ni turno) en las dos caras:
- **CON presupuesto** → 200 y renderiza `#42`, `250.00 EUR`, la firma (`class="sig"`) y la evidencia (IP).
- **SIN presupuesto** (`quote = null`, la factura suelta de 289) → **200**, cae a `#—`, sin imagen de
  firma, y el resto del paquete sigue. **No revienta.**

**Dientes:** rota una guarda `quote?.evidence` **en el `dist`** (artefacto de build; la fuente ya no
deja escribir el acceso sin guardar), la cara nula cae a **500** (`esperaba 200 y fue 500`) mientras la
cara con presupuesto sigue verde — el test distingue los dos caminos, no es tautológico. Restaurado con
`npm run build`; 2/2 verde. Este test es el guard de regresión de la null-safety que SCRUM-289 estrenará.

## Fuera de alcance (declarado, NO tocado)
- **`invoice.routes.ts:119-137`** (el (b) de n8n del informe 287): NO se toca. Está declarado en
  **SCRUM-289** para que quien construya la factura suelta lo clasifique contra el flujo real de n8n.
  Taparlo ahora sin saber si es (a) o (b) sería tapar algo que no sé qué es.
- El camino de emisión (`/rectify`, `allocateInvoiceNumber`, sellado), el flag, el schema, producción.

## Ficheros
- `src/modules/system/app/routes/invoicesAdmin.routes.ts` — 1 línea (:143, quitar `as any`).
- `tests/scrum342-dispute-package-quote-nulo.test.mjs` — 2 tests de las dos caras, sin gate.

**Suite entera 1349 · 1282 pass · 0 fail · 67 skip** (baseline 1347/1280 → +2 tests, +2 pass).

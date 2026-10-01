# SCRUM-1309 · `?mail=sent` ya no pinta «enviado» en producción

**Medido contra:** `origin/main` = `46195e86903cdccc85a04327c0a68577773c4693` · 2026-10-01T00:18:19+01:00 (J4, equipo de Javier)

A9: comprobación → `tests/scrum1309-banner-mail-sent-gateado.test.mjs`

## Qué pasaba

`GET /recibo/:token?mail=sent` pintaba «📧 Email enviado correctamente.» sin mirar el entorno. La
página la ve el cliente final. El único productor de ese parámetro es el redirect de
`POST /dev/email-invoice/:chargeId` (`src/modules/system/app/routes/dev.routes.ts`), y `/dev` no se
monta en producción (`src/app.ts`). Re-verificado con grep sobre `src/` y `public/`: no hay un segundo
productor. SCRUM-807 gateó sólo el hermano `saved`.

## Qué cambia (`src/modules/billing/app/routes/receipt.routes.ts`)

- La rama `sent` de `mailBanner` lleva la MISMA condición que puso SCRUM-807 a `saved`:
  `config.NODE_ENV !== 'production'`. No hay helper nuevo ni segunda forma.
- **El texto no cambia** (regla 39): se decide cuándo se pinta, no qué dice.

## Cómo se comprobó

Test de comportamiento con la ruta real y dobles en `require.cache` (el harness de scrum910d), sin
BD ni red. El entorno se cambia en el mismo objeto `config` que lee la ruta.

- 🔴 **Rojo primero:** antes del arreglo, el caso «producción + `?mail=sent`» cayó con su mensaje
  (no por CIEGO); los otros dos, verdes.
- ✅ Positivo: fuera de producción, `?mail=sent` sí pinta el banner.
- ⛔ Control: `saved` sigue igual que en SCRUM-807 (no sale en producción; fuera sí, con
  `hrefSeguro` y `rel="noopener"`).
- Tanda dirigida: 1309, 807, 910, 910d, 74, 893, 237, 976, 391 → 43 tests, 42 pass, 0 fail,
  1 skip (scrum74, gateado por `QA_DB_TEST`).

## Visto al lado, y NO tocado (A7)

En la misma plantilla, `emailBlock` pinta al cliente final (recibo pagado, con PDF real y email del
cliente) un botón «Enviar … por email» cuyo formulario apunta a `/dev/email-invoice/…`, sin gate de
entorno. En producción `/dev` no existe: el botón lleva a un 404. Es texto y UI que ve el cliente:
decisión del fundador, no de este ticket.

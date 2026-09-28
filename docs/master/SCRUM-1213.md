# SCRUM-1213 — Tenencia fail-closed en quoteAdmin.ts + cuatro piezas sin consumir

**Medido contra:** `origin/main` = `29b492b0c2f246941e5c514d682887c18fd19494` · 2026-09-28T14:29:17Z

Carril S1 · sesión s1-28b · rama `scrum-1213-tenencia-quoteadmin-y-sin-consumir` · punto 4 de la cola del orquestador (28-sep).

## 1 · Tenencia fail-closed (regla 2)

`getQuoteDetailAdmin`, `acceptQuoteAdmin` y `rejectQuoteAdmin` (`src/modules/system/quoteAdmin.ts`) construían el `where` con `...(merchantId != null ? { merchantId } : {})`: sin `merchantId`, la consulta no filtraba por negocio y servía, aceptaba o rechazaba el presupuesto de OTRO. Sus tres llamadores (`quotesAdmin.routes.ts:105, :144, :891`) pasan `req.merchantId`, así que era un fallo latente. Ahora `exigirMerchant()` responde `quote_not_found` —lo mismo que un id ajeno— antes de tocar la base.

Test `tests/scrum1213-quoteadmin-tenencia-fail-closed.test.mjs`: **rojo medido contra el `dist` anterior (3 de 6 fallaban, justo los casos sin merchantId)** y verde después. Tiene un control positivo: con otro merchant, el `where` lleva el suyo.

## 2 · Piezas retiradas (censo SCRUM-1185 → `retiradas`)

| Pieza | Por qué |
|---|---|
| `parseNumericId` (utils.ts) | Sustituida por `parseToken` en SCRUM-95. Su test pasa a probar `parseToken`, que no tenía ninguno. |
| `__resetRateLimits` (rateLimit.ts) | «Solo para tests», y ningún test la usaba. |
| `esDocumentoAsignable` (asignacionDeDocumento.ts) | Nadie la llamaba. |
| `listQuoteRequestAttachments` (attachment.service.ts) | La galería la sirve el `findMany` de `quoteRequests.routes.ts`, que filtra por merchant. Sale también de `_huerfanos-declarados.mjs`, y en `scrum710b` baja un anclaje (`quoteRequests.routes.ts`, 1 → 0): es una bajada declarada. |

## No se tocan (se informa al orquestador)

- `NOMBRE_CSV`: la usa como referencia el guard `scrum152`, mientras `exportData.ts` repite los nombres a mano. Lo correcto es que `exportData.ts` la consuma, pero eso es tocar el export de datos de clientes (STOP de CLAUDE.md).
- `isAlbaranNumber`: la fijan `albaran.test` y `scrum592` como especificación de la serie, y el carril es S4. Borrarla obliga a quitar tests.

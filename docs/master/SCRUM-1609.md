# SCRUM-1609 · «marcar pagada» de una en una acepta la fecha de cobro declarada, como el lote

## J1 · SCRUM-1609 · `PUT /admin/invoices/:id/status` resuelve `paidAt` con `resolverFechaDeCobro` (BUGS.md P3-PAIDAT-BO)

**Medido contra:** `origin/main` = `e8305833fa5907343b6832e3766ba49094f8d5d6` · 2026-10-26T16:35:28Z (hora de GitHub; sesión J1 `jv-j1cj`, por encargo del orquestador `cobroflash-backend-8b`)

A9: comprobación → `tests/scrum1609-fecha-de-cobro-de-una-en-una.test.mjs`

[Escrito por J1, una sesión; no por el fundador.] La línea `A9:` apunta al test que cae si la puerta de UNA
factura vuelve a escribir `new Date()` con una fecha declarada en el cuerpo: es el hermano que SCRUM-397 dejó
sin el mecanismo que sí puso en el lote.

**Sin GO, y por qué no hace falta:** el registro de BUGS.md (23-sep) lo declara no fiscal y sin decisión
pendiente: no decide qué fecha manda el periodo, sólo si el operador puede DECLARARLA. El criterio (no
futura, sin límite hacia atrás) es el que el fundador firmó para SCRUM-397 el 10-ago-2026, y aquí se
reutiliza la misma función. Camino de emisión: `tocaCaminoFiscal` (`scripts/puerta-avisador-rojo.mjs`) da
`false` para los dos ficheros tocados (control positivo: `src/modules/invoicing/x.ts` → `true`). Carril:
`node scripts/carriles.mjs de` → J1 para los dos. Ningún texto nuevo: los dos errores salen con
`COPY_FECHA_FUTURA` y `COPY_FECHA_ILEGIBLE`, que ya contesta el lote.

### El cambio

- `src/modules/system/app/routes/invoicesAdmin.routes.ts` (`PUT /:id/status`): si `status === 'paid'` y el
  cuerpo trae `paidAt`, lee la zona del merchant de la SESIÓN y llama a `resolverFechaDeCobro`, como
  `bulk-paid`; un rechazo contesta `400 { error, message }` sin escribir nada. Sin `paidAt`, la llamada es
  literalmente la de antes —ni siquiera lee el merchant— (la ancla `scrum441` por su texto, y por eso la
  rama con fecha va aparte en vez de añadir un argumento a la de siempre). La auditoría del marcado manual
  guarda `paidAt` y `fechaOrigen`, como el lote.
- `src/modules/system/invoiceAdmin.ts` (`updateInvoiceStatusAdmin`): parámetro opcional `fechaDeCobro`,
  antes del interno `yaSeReleyo` (la relectura de SCRUM-1303 lo propaga). Sólo cuenta al pasar a `paid` y
  si la factura no tenía ya `paidAt`: el primer cobro escrito no se sobrescribe por esta puerta.

### Rojo → verde, por la ruta

`tests/scrum1609-fecha-de-cobro-de-una-en-una.test.mjs`, con el modelo de `scrum1598`: cada petición entra
por HTTP en un `express` montado en `/admin/invoices`, con el `requireRole('admin')` de la ruta y un `req`
de `reqDeSesion` (A10, SCRUM-1344). Sobre el código de `d2e468960`, con `dist/` emitido de ese `src/`:
① escribió `2026-10-26T16:29:15Z` en lugar del `2026-03-31` declarado; ② (futura) y ③ (ilegible)
contestaron 200; ④ (positivo) sólo cayó por `fechaOrigen`, que es nuevo; ⑤ y ⑥ pasaron. Con el arreglo:
6 de 6.

Mutaciones (`MUTACIONES_QUE_ME_TUMBAN`, aplicadas con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`):
2 de 2 VIVAS —quitar la fecha de la llamada de la ruta, o volver a `paidAt = new Date()` en el servicio,
tumban ①— y 0 colaterales; el árbol quedó con el mismo `diff --stat` antes y después.

### Lo que no hace este tramo

- **Ninguna pantalla manda `paidAt`:** ni este botón (`public/dashboard/js/invoiceDetailView.js`) ni el
  del lote (`invoicesView.js`, que manda sólo `{ ids }`). El backend de SCRUM-397 tampoco se alcanza desde
  el panel. Elegir la fecha en pantalla es UI con texto que ve el usuario (regla 39): otro ticket.
- No toca la R1, los webhooks ni la regla de `expired` (que sigue dejando `paidAt` como esté).

### Cómo se midió (y lo que no)

- Árbol sin `node_modules` propio: `dist/` con `tsc --noCheck` del checkout compartido, sin `prisma
  generate`. La comprobación de tipos local fue CIEGA (1.109 errores, el primero «no encuentro `express`»):
  la juzga el build del CI.
- Dirigida: los 48 ficheros que `tests:que-cubren` dice que NOMBRAN los dos fuentes, más los de suite,
  registro y cobro del encargo: 70 ficheros, 707 casos, 698 pasan, 7 saltan, 2 caen antes del arreglo de
  `scrum441`: el propio `scrum441` (ancla de texto, arreglado en el código) y `scrum976` ④, cuyos tres
  hijos caen al importar `typescript` porque `guards:entrada` les limpia el entorno; directos, 26 de 26.
  La tanda entera local: NO CORRIDA (diez sesiones a la vez); el juez es el obligatorio.
- Un error mío, contado: la primera dirigida dio 37 caídas y 21 eran CIEGAS (ESM no mira `NODE_PATH`);
  las separé por el texto del error antes de leer ninguna como rojo, pero la lancé sin haber comprobado
  antes que los hijos resolvían `typescript`.

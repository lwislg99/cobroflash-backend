# SCRUM-1576 · clasificación de las 134 lecturas del censo

Fuente: `censo-salida.txt` (salida de `censo.mjs` sobre `origin/main` 8ad16719). Cada lectura la leyó
un agente de solo lectura (cinco en paralelo, uno por grupo; reparto sin solapes: 33+19+26+26+30 = 134
líneas, 134 únicas). **Lo que dijo cada agente lo he cruzado yo sólo donde lo marca «medido»**; el resto
es su lectura del código, no una ejecución.

Clases: **(a)** arreglable leyendo lo ya guardado en el documento · **(b)** falta guardar el dato
(esquema, regla 40) · **(c)** no es defecto: el vivo es lo correcto ahí.

## (a) — arreglables leyendo lo guardado

| lector | dato | quién lo ve | carril | estado |
|---|---|---|---|---|
| `billing/domain/cobros.service.ts:225` (fila de factura en `GET /admin/cobros`) | nombre | panel, Cobros | **J2** | **ARREGLADO aquí** · medido por ruta (test scrum1576, rojo → verde) |
| `billing/app/routes/receipt.routes.ts:472` (pie «Cobro #N · Cliente: X» de `GET /recibo/:token`, cobro ya facturado) | nombre | página pública del cliente | **J2** | **ARREGLADO aquí** · medido por ruta |
| `exports/domain/exportData.ts:200` (`GET /admin/exports/invoices.csv`) | nombre y email | CSV (suelto y paquete del asesor) | S1 (exportación) | **medido**: LEE EL VIVO (`reproducir.mjs` caso 1) · STOP: exportación |
| `system/invoiceAdmin.ts:73` + `public/dashboard/js/invoicesView.js:652` (lista de facturas) | nombre | panel, Facturas | J1 | **medido**: la API manda `customerName` congelado y la pantalla pinta `customer.name` vivo (caso 2) |
| `system/invoiceAdmin.ts:119` + `invoiceDetailView.js:225` (detalle, fila «Cliente») | nombre | panel, ficha de la factura | J1 | leído (mismo patrón que la lista), no corrido |
| `system/app/routes/invoicesAdmin.routes.ts:351` (paquete de disputa) | nombre, teléfono, email | descarga del admin | J1 | leído, no corrido |
| `search/app/routes/search.routes.ts:86` (`GET /admin/search`, facturas) | nombre pintado (buscar por el vivo vale) | panel, buscador | S1 | **medido**: LEE EL VIVO (caso 3) |
| `fiscal/evidencias/paquete.repo.ts:85` (sobre del albarán re-hasheado) | razón social / nombre | paquete de evidencias | J1 | leído; ya conocido (SCRUM-431/438) · STOP: fiscal/sellado |
| `jobs/app/routes/albaranes.routes.ts:154` (lista de albaranes) | nombre | panel | S1 | leído, no corrido |
| `jobs/app/routes/albaranes.routes.ts:865` (ficha del albarán) | nombre (el teléfono es c) | panel | S1 | leído, no corrido |
| `jobs/app/routes/albaranPublic.routes.ts:244` (página pública de firma) | nombre: «Hola, X» y firmante precargado | cliente | S1 | leído, no corrido · toca firma |
| `jobs/domain/albaran.service.ts:800` (PDF del albarán emitido sin firmar; NIF siempre) | nombre, NIF | PDF | S1 | leído · toca firma (`contenidoSegunVersion`) |
| `jobs/domain/precarga.service.ts:335` (paquete offline de firma in situ) | nombre | móvil del técnico | S1 | leído, no corrido |
| `jobs/domain/albaran.service.ts:642` (`contenidoCongelado.cliente` del sobre) | razón social / nombre | nadie directo | S1 | leído · atado al barrido por SCRUM-577: mover es STOP |

**Hallazgo transversal (medido con grep, no con AST):** `Albaran` tiene las cinco columnas congeladas
(`schema.prisma:1445-1449`), se escriben al EMITIR (`albaranes.routes.ts:981` → `albaranEmision.ts:74-75`,
leído por el agente) y **ningún lector de `src/` las lee**: sólo las nombra `albaranDuplicado.ts:90-92`
para dejarlas vacías en el duplicado. Declarado y escrito, pero no leído (las tres preguntas de ⑨).

## (b) — falta guardar el dato (esquema: regla 40, STOP)

| lector | dato | quién lo ve | carril |
|---|---|---|---|
| `fiscal/librosAeat/librosAeat.repo.ts:105` (`/admin/libros/recibidas.csv` y `.json`) | NIF y nombre del proveedor | libro de recibidas (AEAT) | J1 · fiscal |
| `exports/domain/exportData.ts:333` (gastos.csv) | nombre del proveedor | CSV del asesor | S1 |
| `expenses/domain/expenses.service.ts:122,149` (lista y ficha del gasto) | nombre del proveedor | panel, Gastos | S1 |
| `expenses/app/routes/expenses.routes.ts:229` (deducibilidad al dar de alta) | NIF del proveedor | modal de alta | S1 · ⚠️ ver nota 1 |
| `system/app/routes/quoteDecisionLanding.routes.ts:1063` y `quotesAdmin.routes.ts:780` (PDF del presupuesto ACEPTADO, regenerado en cada apertura) | nombre, razón social, NIF, teléfono, email, dirección | cliente y panel | S1 · ⚠️ nota 2 |
| `exportData.ts:361` (presupuestos.csv, los aceptados) | nombre, email, teléfono | CSV | S1 |
| `exportData.ts:232` (cobros.csv) · `cobros.service.ts:220` (fila de cobro en Cobros) | nombre | CSV / panel | S1 / J2 |
| `exportData.ts:279` (trabajos.csv) | nombre | CSV | S1 |
| `jobs/app/routes/partes.routes.ts:116` (parte firmado: el papel pinta el nombre de hoy, el sello guarda el de entonces) | nombre | técnico, oficina | S1 · firma |

Nota 1: el agente la clasificó (b); en el instante del ALTA el vivo es lo único que hay. Es (b) sólo si
ese veredicto se recalcula después; **no lo he medido**.
Nota 2: el presupuesto aceptado sí guarda UN texto del cliente — `Quote.evidenciaFirma.contenidoCongelado.cliente`
(`quotes.routes.ts:470`, tipo en `presupuestoSello.ts:69-73`), sólo cuando hubo trazo de firma. El nombre
sería (a) parcial; NIF, email, teléfono y dirección, (b).

## (c) — no es defecto (resumen; el detalle por línea en los informes de los agentes, no comiteados)

- **Envíos al contacto ACTUAL** (WhatsApp/email/recordatorios/PSP): `invoiceReminder`, `invoiceWhatsApp`
  (J1), `invoicesAdmin:702,738`, `email.service:179`, `sendQuote:37`, `reminder:13`, `albaranWhatsApp`,
  `mpWebhook:108`, `psp:137`, `payBizum`, `payCard`, `payMp`, `disputes:137`. El destino de un envío es el
  de hoy. (`psp:79` reenvía el correo de una factura: el agente lo deja «c/a, criterio de producto».)
- **Emparejar entrantes por teléfono / bot**: `whatsappIncoming`, `botFlow`, `botAdmin`, `whatsappLog:219`, `whatsapp.ts:167`.
- **Ya resueltos con `clienteDelDocumento`**: `lib/invoicing.ts:40,264`, `verifactu.service.ts:673,1195`,
  `invoicesAdmin:1192`, `librosAeat.repo.ts:54` (1058c).
- **Escritores del congelado** (el momento de congelar): `invoicing.ts:182`, `clienteCongelado.ts:165`, `invoicesAdmin:150`.
- **Autorización / tenencia / filtro / búsqueda / la propia ficha**: el resto (fichas de cliente y
  proveedor, fusión, notas, sitios, portal, métricas, Trabajos, borradores de presupuesto).
- **Ni (a) ni (b)**: `jobs/domain/albaranBarrido.ts:181` — los albaranes v1/v2 se sellaron con el vivo; un
  cambio de nombre da un falso «no cuadra» en el barrido, y las columnas no lo arreglan (se escriben al
  emitir, no al firmar). Leído por el agente, no corrido.

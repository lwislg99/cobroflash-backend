# SCRUM-1779 · Regla 24: encender `INVOICING_ES_ENABLED` para el comercio del piloto antes de SIF-1

## SCRUM-1779a · 20-nov: qué emite hoy el producto con `INVOICING_ES_ENABLED=ON` y `SIF_ENABLED=OFF` (J1, solo lectura)

**Medido contra:** `origin/main` = `7f5ea0138d9c7ca683ec903114940cff37613a60` · 2026-11-20T17:56:01Z (cabecera `Date:` de GitHub; sesión J1 `jv-j1fy`, por encargo del orquestador `cobroflash-backend-c7`; regla 38, sin GO, nada en `src/`)

A9: aviso → cicatriz J1 «Lancé tres subagentes de medición a la vez sin mirar la memoria libre de la máquina (844 MB con tres sesiones); lo paró el orquestador y paré dos» — no se pudo comprobar: cuántos subagentes lanza una sesión no pasa por ningún guard del repositorio

**Cómo.** `dist/` de main (`tsc --noCheck`) sobre el banco en memoria `tests/_banco-emision-con-estado.mjs`, con un comercio ES fabricado que no es demo: flag ON, `SIF_ENABLED` sin override (OFF por defecto, `src/core/flags.ts:17`), con NIF y SII «No». **No es Postgres**: en la máquina no hay ninguno, así que no se miden el rollback ni la carrera. Nada contra staging ni producción. Los envíos se interceptan y no sale nada a la red. Lo midieron tres subagentes, de uno en uno; volví a ejecutar sus tres bancos (salida 0) y comprobé con `grep` sus controles y las líneas de `src/` que cito. Comentario de Jira: SCRUM-1779 c.22240. No valoro la legalidad (reglas 17/26).

Evidencias en `docs/master/evidencias/SCRUM-1779/`:
- `vias-banco.mjs` y `vias-salida.txt`: puntos ①, ③ y ⑤.
- `pdf-banco.mjs`, `pdf-F1-texto.txt`, `pdf-R1-texto.txt`, `pdf-demo-control-texto.txt` y `pdf-salida.txt`: punto ②. Los dos bancos que escriben ficheros se lanzan desde el temporal del sistema.
- `envios-banco.mjs` y `envios-salida.txt`: punto ④.
- `falta-para-verifactu.txt`: punto ⑥.

### ① Documentos por vía (SCRUM-1097)

| vía | documento | estado | cobro |
|---|---|---|---|
| C1 aceptar presupuesto | F1 F260001 | pending, sellado | `sendInvoicePaymentRequest`: Charge + WhatsApp de pago |
| C2 collect-rest | F1 F260002 | pending, sellado | ídem (`jobs.routes.ts:1694`) |
| C3 invoice | F1 F260003 | pending, sellado | no |
| C4 invoice-manual | F1 F260004 | pending, sellado | no |
| suelta (handler ejecutado, 201, `veriFactu:true`) | F1 F260005 | pending, sellado | no |
| R1 de F260003 | R1 2026-CF-R-001 | paid, sellado | no |

En C1-C4 y en la R1 se ejecuta el núcleo (`allocateInvoiceNumber`, creación y `sellarTrasEmision`), no el handler HTTP.

Controles:
- **Positivos:** con el flag en OFF sale `invoicing_es_disabled` (409, 0 filas); con SII «No consta», `sii_no_consta`.
- **Cero:** las tablas están vacías antes de llamar a nada.

### ② PDF (F1 al 21 % y al 10 %, y su R1)

Literal en los dos (`src/modules/invoicing/infra/pdf/pdf.service.ts`):
- «Factura verificable en la sede electrónica de la AEAT» (:857)
- «VERI*FACTU — escanea el QR para verificarla (RD 1007/2023).» (:859)
- «Huella: …» (:862)
- «Sistema de facturación verificable conforme al RD 1007/2023 (VeriFactu).» (:886)

El QR se dibuja: imagen de 200×200 idéntica, píxel a píxel, al QR de la URL `ValidarQR` de www2.agenciatributaria.gob.es (`verifactu.service.ts:197`). Esos textos dependen solo de que la factura tenga `vfHash`; el generador no lee ningún flag.

La marca DEMO no sale con un comercio que no es demo. Control: con `demo@yaqu.app` sí sale (`lib/invoicing.ts:142`).

Controles del barrido: el NIF sembrado se encuentra 1 vez; la cadena de control cero, 0 veces.

### ③ Huella, XML y cola

- **Quién lee `SIF_ENABLED`:** ni la emisión ni el sellado. Lo leen la auditoría (`invoiceNumber.service.ts:413`, `audit.service.ts:267`) y `sif.procesador.ts:77`, que tiene 0 llamadas.
- **Huella:** las 6 facturas salen con huella encadenada (`applyVeriFactu`).
- **Cola:** 6 filas `VfSubmission` de alta con el XML RegistroFactura, en `pending` (`encolarRemision.ts:61`). Nadie las vacía; `procesarObligado` contesta `pausada`.

### ④ Lo que sale hacia fuera

| momento | canal | qué | intentos |
|---|---|---|---|
| pedir el cobro | WhatsApp | `payment_request_es` con el botón de pago | 1, con un POST /charges |
| correo de la factura | Resend | «Tu factura F260001», con el adjunto F260001.pdf (el de ②) | 1 |
| pago confirmado | WhatsApp | `payment_confirmation_invoice_es` con el enlace a `/recibo/<token>` | 1 |
| `/pay/invoice/:token` y `/recibo/:token` | web | importe y «Descargar factura en PDF», que sirve el PDF de ② | 200 |

No hay menciones fiscales en los WhatsApp, ni en el asunto o el cuerpo del correo, ni en las páginas: solo en el PDF.

Controles: el buzón dry-run de `whatsapp.ts` coincide con la captura; con el cliente sin teléfono salen 0 envíos.

### ⑤ Regla 29: lo que permite hoy el código

- Lo que ya tiene huella no se vuelve a sellar ni se encola otra vez.
- Lo que no la tiene sí se sella después:
  - si está en `pendiente_de_sellado`, la sella el cron (`cron.ts:165` → `reintentarSelladosPendientes`);
  - si está en `no_aplica`, se sella al volver a pasarla con NIF, y su encolado falla porque el emisor congelado no tiene NIF.
- Las facturas de este escenario nacen ya selladas.

### ⑥ Lo que falta para un registro remitido (auditoría)

- E8: nadie vacía la cola.
- E9: no hay envío a la AEAT (`enviarSobre` tiene 0 llamadas).
- No hay carril de representación.
- No se lee la respuesta de la AEAT.
- Subsanación y rechazos: sin medir.
- No se le muestra el modo al profesional.
- Decisiones de la §6, puntos 1 a 3.

### Sin medir

- Postgres real.
- Los handlers HTTP de C1-C4 y de la R1.
- La ventana de WhatsApp abierta y los recordatorios.
- `AUTO_*_ON_PAID` en Railway.
- Las plantillas tal como están en Meta.
- Ninguna base real.

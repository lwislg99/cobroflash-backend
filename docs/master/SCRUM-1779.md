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

## SCRUM-1779d · 20-nov: con `SIF_ENABLED` en OFF la factura se emite sin VeriFactu (J1, código del camino de emisión con GO)

**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-20T18:58:22Z (cabecera `Date:` de `gh api -i zen`; construido por `jv-j1gb` y `jv-j1gc`, cerrado por `jv-j1gf`, por encargo del orquestador `cobroflash-backend-c7`)

A9: comprobación → `tests/scrum836-ancla-de-mutacion-viva.test.mjs`
Mutaciones: catálogo → tests/scrum1779d-factura-sin-verifactu.test.mjs
Mutaciones: catálogo → tests/scrum1330-una-sellada-no-se-resella.test.mjs

(El A9: el cambio de `src/lib/invoicing.ts:243` dejó caducada el ancla de la mutación MA de `scrum1330`, y nadie lo vio hasta que la cazó `scrum836` en la dirigida; ancla re-copiada y la MA vuelve a tumbar.)

**GO (regla 40):** SCRUM-1779 c.22239, literal de Javier: «Osea dejalo encendido, pero como lo que teniamos hecho de igual de presupuestos, no linkado a verifactu». Decisiones: c.22245 (① lo emitido sin sello se queda sin sello; ② el demo tampoco sella), c.22246 (caso G de 1404g, opción A), c.22253 (no se sube `VERIFACTU_VERSION`: se recongela y se autoriza el PDF, por SCRUM-1585 c.21290).

### Los cortes (fichero:línea)

- `src/modules/invoicing/domain/selladoEstado.ts:147-162` · `sellarTrasEmision` lee `SIF_ENABLED` del comercio EN LA BASE y, en OFF, deja la factura `no_aplica`: sin huella, sin QR y sin alta en `VfSubmission`. Si no puede leer el flag, `pendiente_de_sellado` (fail-closed). Con ON, como antes. `verifactu.service.ts`, `registro.builder.ts`, `productor.ts`, `sif.*` e `instalacion.ts` no se tocan (523d no los nombra).
- `src/modules/invoicing/domain/portonDocumento.ts:105` · el portón deja salir el PDF de una `no_aplica` sin huella; `:114-121` `qrDelDocumento` le quita el QR (ni el de la AEAT ni el casero).
- `src/lib/invoicing.ts:243` · ① la segunda entrega del cobro NO sella después una `no_aplica`; `:136` y `:299` pasan el QR por `qrDelDocumento`.
- `src/modules/invoicing/infra/pdf/pdf.service.ts:416` · `qrData` vacío → no se dibuja QR. No hay texto nuevo: las leyendas VeriFactu ya dependían sólo de la huella.

### Bancos que pasaron a `SIF_ENABLED` ON (afirman el sellado en sí)

| test | por qué |
|---|---|
| `tests/scrum1054-suplido-al-sellar-defecto-declarado.test.mjs` | mide el sellado |
| `tests/scrum1296-emitir-encola.test.mjs` | mide el encolado tras sellar |
| `tests/scrum1304-un-cobro-una-factura.test.mjs` | mide la huella de un cobro |
| `tests/scrum1330-una-sellada-no-se-resella.test.mjs` | mide el no-resellado |
| `tests/scrum1333-una-factura-se-encola-una-vez.test.mjs` | mide la cola |
| `tests/scrum1333-carrera-del-encolado-postgres.test.mjs` | ídem contra Postgres (SKIP sin `LIBRO_PG_URL`) |
| `tests/scrum1404g-el-409-del-pendiente-de-sellado.test.mjs` | mide el portón; caso G reanclado a c.22246 |
| `tests/scrum1510b-pendiente-que-el-porton-dejaria-pasar.test.mjs` | mide el pendiente de sellado |

### Recongelación y autorización (regla 41: por su mecanismo, sin relajar nada)

- `tests/scrum523d-version-del-sif.test.mjs` · el guard nombró SOLO `selladoEstado.ts` como cambiado; huella `ac1bda6897b46219` pegada de su mensaje, con la cita «SCRUM-1779 c.22239 por SCRUM-1585 c.21290». `VERIFACTU_VERSION` sigue en 1.0.0.
- `tests/_cambios-autorizados-de-la-factura.mjs` · par de huellas (cuerpo y ámbito de `generateInvoicePdf`) generado con `docs/master/evidencias/SCRUM-1446d/huellas.mjs` sobre `fea1c000`; firma `SCRUM-1779 c.22239`, cita «no linkado a verifactu».

### Lo que recibe el cliente con SIF OFF

PDF fabricado con el `dist/` de esta rama por `evidencias/SCRUM-1779/pdf-banco.mjs` (el banco de 1779a): `evidencias/SCRUM-1779/1779d-pdf-F1-texto.txt`, `1779d-pdf-R1-texto.txt` y `1779d-pdf-demo-control-texto.txt`. 0 líneas con «VeriFactu», «AEAT», «Huella» o «QR» en los tres (control: 4 en el `pdf-F1-texto.txt` de 1779a) y sin imagen de QR. El banco sale con 4 FALLO: son sus comprobaciones de «F1/R1 sellada» y «el QR dibujado», que es justo lo que este tramo quita (`1779d-pdf-banco-salida.txt`).

### Medido

- `tsc -p .` (con tipos): salida 0.
- Dirigida (31 ficheros: 523d, 603b, 1779d, los 8 bancos, 1771c, 624y/624e, 604, 623, 1763, 1051g, 1027, 289b, 346, 207, 836, 700, 710b, 1446d, 525d, 1344): ver la entrega en Jira con el recuento final.
- Mutaciones con `aplicarUna` (driver `evidencias/SCRUM-1779/mutaciones-1779d.mjs`): 1779d 5/5 tumban («sella aunque SIF esté OFF», «encola sin sello», «pinta el QR sin sello», el portón, ① «sella después»); 1330 5/5. Control sembrado (un `cae` que no existe) sale CIEGO en los dos.

### Sin medir

- La suite entera por tramos: no cupo en el contexto de la sesión; la corre el obligatorio de CI (orden del orquestador).
- Postgres (no hay ninguno en la máquina), los handlers HTTP de C1–C4 y de la R1.
- **Para Luis (S1, exportaciones):** qué hacen el XML y el ZIP de VeriFactu con una factura emitida sin huella.

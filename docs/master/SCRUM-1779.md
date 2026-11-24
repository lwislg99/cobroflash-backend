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
| `tests/scrum178-emision-manual.test.mjs` | emisión manual contra base: «FACTURA FISCAL SIN SELLAR» (relevo 3.º, `jv-j1gi`) |
| `tests/scrum290-adicional.test.mjs` | el albarán emite por el handler y, con OFF, `sellarTrasEmision` escribía en una base que el doble no tiene (500 ≠ 201) |
| `tests/scrum290-endpoint-convertir.test.mjs` | ídem, y el caso de SCRUM-887 «al precio firmado DESPUÉS del dto de línea» |

Relevo 3.º (`jv-j1gi`, 21-nov): el obligatorio de #3282 (run 44798134056, sobre `3784cc57d`) cayó en estos tres con 9 casos, de 14.011 casos y 9 skip. Población de la clase medida antes de empujar: 161 tests nombran el sellado (`SIN SELLAR`, `vfQrUrl`, `vfHash`, `huella`, `VfSubmission`, `vfEstado`, `sellarTrasEmision`, `SELLADO_`); 146 sin `SIF_ENABLED`; 82 de ellos cargan `dist/`. Corridos en local: 672 casos, 0 fail, 31 skip (17 ficheros gateados por base, que en ese run de CI SÍ corrieron y no cayeron). Los tres arreglados + 1779d + 523d + 603b: 40 casos, 38 pass, 0 fail, 2 skip (178 sin base: su verde es el de CI).
A9: aviso → A10 «Un test gateado que se salta en local es un test que no corriste: su verde no habla de él.» — no se pudo comprobar: la lista de bancos que afirman el sellado la eligió a mano el relevo 2.º, y elegir una población no pasa por ningún guard; la cerró el obligatorio de CI

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

## SCRUM-1779e · 21-nov: prueba en STAGING con la cuenta QA y Playwright — la factura con SIF apagado sale sin VeriFactu (J1, solo docs)

**Medido contra:** `origin/main` = `beb63b0dde9597565244c26c66e0e78b7240a765` · 2026-11-21T04:25:33Z (cabecera `Date:` de `gh api -i zen`; sesión J1 `jv-j1go`, por encargo del orquestador `cobroflash-backend-87`; orden del fundador SCRUM-1779 c.22279)

A9: aviso → A10 «Una captura bonita no prueba que el botón funcione.» — no se pudo comprobar: mi primera captura de la ficha era la LISTA (sha-256 idéntico, `a76fd53a…`): cambiar solo el `#hash` con `goto` no re-pintó, y mi comprobación («F260003» y «12,10» en el DOM) la cumplía también la fila de la lista; el conductor de Playwright vive fuera del repositorio y ningún guard lo ve. Rehecha entrando por «Ver detalle» y exigiendo «Anular factura…», la URL `#invoice-detail/1978` y 0 apariciones de `F260002`.

**PASO 0.** `https://yaqu-staging-production.up.railway.app/health` → `version` `beb63b0dd…` (= `origin/main`; contiene `6bb74a248`, comprobado con `merge-base --is-ancestor`). Turno de staging (`turno-staging.mjs --base staging`): TOMADO a las 04:18:06Z, SOLTADO a las 04:25Z y comprobado LIBRE.

**Flags del comercio QA (#2, `qa@staging.yaqu`, staging), leídos ANTES de tocar nada:** `merchants.flags` = `{"BIZUM_MANUAL_ENABLED":true,"INVOICING_ES_ENABLED":true}` — `INVOICING_ES_ENABLED` ya estaba en ON por override; `SIF_ENABLED` sin override (el valor de la variable en Railway: sin medir). Para no depender de esa variable, `SIF_ENABLED` → override **OFF** con `scripts/cambiar-flag-fiscal.mjs --merchant 2 --flag SIF_ENABLED --valor off --email qa@staging.yaqu` y `FLAG_CONFIRM=DATABASE_URL_STAGING` (auditoría `cambio_flag` id=1659, 04:19:59Z). **Se queda en OFF:** el script no sabe quitar un override, OFF es el valor por defecto de `flags.ts` y es lo que pide c.22279. `INVOICING_ES_ENABLED` no se tocó. Nada global, nada en producción.

**Lo que se hizo (Playwright 1.x sobre Edge, contexto nuevo con `serviceWorkers:'block'`; sesión por `/auth/test-login`, el secreto leído del `.env` y nunca impreso):** Nueva factura → cliente «Cliente QA sin avisos» (#3936: `phone` y `email` NULL en la base, así que no hay a quién enviar nada) → un concepto «Prueba SCRUM-1779e · factura sin VeriFactu», 1 × 10,00 € + IVA 21 % → Emitir. Tras cada clic se exigió el bloque siguiente en el DOM (el total «12,10 €» antes de seguir; «Emitir factura» en la revisión). Respuesta: `POST /admin/invoices` 201, `factura.id` 1978, `number` **F260003**, `veriFactu:false`. Ningún envío: ni WhatsApp ni correo.

**Base (staging, solo lectura, después de bajar el PDF):** F260003 `vfEstado` = `no_aplica`, `vfHash`/`vfPrevHash`/`vfTimestamp` = null; **0 filas en `VfSubmission`** para la factura 1978 y 0 para el comercio. Bajar el PDF no la selló (decisión ① de c.22245).

**PDF, texto extraído con el lector de la casa** (`tests/_texto-del-pdf.mjs`, vía `docs/master/evidencias/SCRUM-1779/1779e-pdf-staging.mjs`; salida en `1779e-pdf-staging-salida.txt`): 15 líneas, con su número y su total (positivo sembrado); 0 de «VERI*FACTU», «VeriFactu», «verificable», «AEAT», «agenciatributaria», «Huella», «QR», «RD 1007/2023»; 0 imágenes y 0 operadores `Do`. **Control positivo:** el mismo lector sobre el PDF de **F260002** (id 1977, del mismo comercio en staging, sellada el 20-nov ANTES de 1779d) ve «VERI*FACTU» 1, «AEAT» 1, «Huella» 1 y 2 imágenes. Sin control el instrumento sale 2 (CIEGO); con la sellada en el lugar de la nueva sale 1 (ROJO). ⚠️ Error mío: el concepto que tecleé lleva la palabra «VeriFactu», y el lector la contó (1). Se excluye SOLO esa línea, por su prefijo, y el recuento bruto se imprime al lado.

**Capturas** (`docs/master/evidencias/SCRUM-1779/`):

| fichero | qué enseña |
|---|---|
| `1779e-01-lista-facturas.png` | la lista de Facturas con F260003 · Cliente QA sin avisos · 12,10 € · PENDIENTE |
| `1779e-02-ficha-F260003.png` | la ficha de F260003 (escritorio): datos, «Descargar PDF», «Anular factura…»; sin VeriFactu, AEAT ni QR |
| `1779e-03-pdf-F260003-sif-off.png` | el PDF de F260003 pintado con pdf.js: sin leyenda, sin huella, sin QR |
| `1779e-04-pdf-F260002-control-sellada.png` | el control: el PDF de F260002, sellada, con la leyenda VERI*FACTU, la huella y el QR |
| `1779e-05-ficha-F260003-movil.png` | la ficha en móvil (390 px) |
| `1779e-06-pdf-F260003-movil.png` | el PDF de F260003 a 390 px |
| `1779e-F260003-sif-off.pdf` · `1779e-F260002-control-sellada.pdf` | los dos PDF tal como los sirvió staging (datos del comercio QA, inventados) |

**Hallazgo (no lo arreglo: es texto que ve el usuario y ruta de emisión, reglas 39 y 40):** con SIF en OFF, `POST /admin/invoices` contesta `message: «Se emitió la factura, pero falló su registro VeriFactu. Revísalo antes de entregarla.»` (`src/modules/system/app/routes/invoicesAdmin.routes.ts:240`; la misma frase en `src/modules/jobs/app/routes/albaranes.routes.ts:1466`), porque decide por `sellada` y no distingue «no falló: no se sella». La pantalla de la factura suelta no lo pinta (no se vio en la prueba); la ficha del Trabajo SÍ pinta un aviso por `veriFactu === false`: «⚠️ Factura emitida, revisa su registro» (`public/dashboard/js/jobDetailView.js:3986`) — leído en el código, no visto en pantalla. Para el piloto, cada factura emitida desde un Trabajo saldría con ese aviso falso.

**Sin medir:** el valor de `SIF_ENABLED` en las variables de Railway de staging; las vías C1–C4 y la R1 en staging (solo la suelta); el correo y el WhatsApp (el cliente no tiene contacto, a propósito); producción.

## SCRUM-1779g · 21-nov: la nota A8 de la regla 24 — `INVOICING_ES_ENABLED` en ON para TODOS los comercios ES antes de SIF-1 (J5, solo docs)

**Medido contra:** `origin/main` = `e24f2828ed68d0159d53e546fe6fb25903f79972` · 2026-11-21T04:50:25Z (cabecera `Date:` de `gh api -i zen`; sesión J5 `jv-j5bo`, por encargo del orquestador `cobroflash-backend-87`; firma del fundador SCRUM-1779 c.22289, literal de c.22288)

A9: sin fallo que generalice — iba a añadir líneas nuevas al máster para las notas y lo medí antes: 77 ficheros de `tests/`, `scripts/` y `docs/master/` lo citan como `YAQU_MASTER.md:<línea>`, así que todo va APENDADO al final de líneas que ya existían (1.951 líneas antes y después); no llegó a escribirse ninguna línea de más

**Qué entra** (solo `docs/YAQU_MASTER.md`; el diff solo AÑADE texto, `git diff --word-diff` sin una sola palabra borrada):

| dónde | qué |
|---|---|
| regla 24 (Parte I, línea 246), al final, antes de «25)» | el literal FIRMADO de c.22289, copiado del comentario de Jira por programa (y cotejado con el de c.22288: idénticos, 507 B), con sus corchetes. La frase vieja de la regla 24 sigue entera |
| Parte P, fila `INVOICING_ES_ENABLED`, columna «Activa» (línea 470) | una nota fechada que apunta a la de la regla 24 y a c.22289. El «Default» de la fila sigue en **OFF**: es el del código (`FLAG_DEFAULTS`, `tests/flags.test.mjs:30`), que no cambia; lo que cambia es la variable de Railway de producción, que pone el fundador |
| V0-0 (Parte U, línea 1020), al final | una nota fechada que apunta a la de la regla 24 y a c.22289 |
| THE PIONEER, «La regla general NO cambia» (línea 498), al final | una nota fechada: la regla general ya tiene una excepción para todos. ⚠️ Esta no la pedía el encargo (nombraba V0-0 y la Parte P); la añado porque el párrafo dice «sigue estando off para merchants reales» y, sin la nota, contradice la de la regla 24 |

La nota del piloto de c.22229 no estaba en el máster (c.22289: «no llegó a entrar»): no hay nada que sustituir.

**Desfasado y NO tocado (derivados, regla 35, o fuera de este encargo):**

- `CLAUDE.md`: la cabecera («Antes de SIF-1, en España, ni documento ni cobro por YaQu») y la regla dura 7 («`INVOICING_ES_ENABLED=OFF` para merchants ES reales») ya no dicen lo que dice el máster. Es derivado: lo corrige quien lleve `CLAUDE.md`, citando esta nota.
- En el propio máster, sin nota: líneas 39, 101, 198, 422, 1108 y 1166 (cobro y emisión «solo con el interruptor en ON» / «post SIF-1»), el resumen de V0-0 en la línea 998 y «El hueco conocido» de la línea 552 (la llave de SCRUM-218 no gobierna el interruptor global, que es justo el que se enciende ahora). Leídas, no editadas: el encargo pedía la nota y, como mucho, un apunte en V0-0 y la Parte P.
- La acreditación de SCRUM-1097 (c.22288 ③: su guard pasará a dar «todos») y el aviso falso de los albaranes (c.22287, S1/S2): fuera de este tramo.

**Sin medir:** producción (ni la variable de Railway ni `SIF_ENABLED`: los pone y comprueba el fundador); el comportamiento del producto con la variable en ON (lo midió J1 en 1779a y 1779e).

**Tests en local, con su población:** `npm run guards:entrada` 170/170 (15 guards, EXIT 0). Los del máster y de árbol entero (`scrum267`, `scrum273`, `scrum525d`, `scrum854`, `scrum921c`, `scrum1294`, `scrum1500`, `scrum195-url-bd-sin-fuga`, `scrum414`, `scrum694`, `scrum710b`, `scrum737`), lanzados por prefijo: 109 casos, 106 ok y 3 not ok; los 3 son `scrum195-lectura-serializacion`, `scrum195-loop-adicional` y `scrum195-pertenencia-por-job`, que el prefijo `scrum195-` arrastró de más y caen por `ERR_MODULE_NOT_FOUND` de `dist/` (este árbol no tiene `dist/`), no por este cambio. **La suite entera NO corrió en local:** no cabía en el contexto (145k medidos); se lo dije al orquestador antes de empujar y la corre el obligatorio de CI.
## SCRUM-1779f · 21-nov: con `SIF_ENABLED` en OFF la emisión suelta no avisa de un fallo de VeriFactu que no ha ocurrido (J1, GO c.22285)

**Medido contra:** `origin/main` = `e24f2828ed68d0159d53e546fe6fb25903f79972` · 2026-11-21T04:44:20Z (cabecera `Date:` de `gh api -i zen`; sesión J1 `jv-j1gr`, por encargo del orquestador `cobroflash-backend-87`)

A9: comprobación → `tests/scrum1779f-sin-aviso-falso-con-sif-off.test.mjs`
Mutaciones: catálogo → tests/scrum1779f-sin-aviso-falso-con-sif-off.test.mjs

### Qué cambia

- `src/modules/system/app/routes/invoicesAdmin.routes.ts` (POST `/admin/invoices`, J1): el `message` de fallo sale SOLO con `pendiente_de_sellado`, el criterio de `quotesAdmin.routes.ts` («`no_aplica` NO es un fallo»). `veriFactu` sigue siendo «tiene sello»: `false` sin sello, nunca `true` sin él (decisión del orquestador ③, sobre la medición de Jira c.22286). Sin texto nuevo.
- El ORIGEN (`sellarTrasEmision`) no se toca: que dejara de avisar sin tocar las rutas exigía devolver `sellado` sin sello (mentira, rompe `reintentoSellado.ts` e `invoicing.ts`, y `veriFactu:true` sería un claim fiscal). Medición de las rutas y de los lectores de `veriFactu`: Jira c.22286.
- De paso, el mismo arreglo quita el aviso falso que ya salía antes de 1779d con un comercio no-ES o sin NIF (`no_aplica`): leído en el código, no ejecutado.

### Medido

- Rojo primero contra el `dist/` sin el cambio: 3 casos, 1 fail (el de SIF OFF), 2 pass (los controles). Con el cambio: 3/3.
- `tsc -p .` con tipos: salida 0.
- Dirigida (18 ficheros: 1779f, 1779d, 178, 290 ×3, 887, 523d, 291, 347, 1185, 222, 525d, 419, 1344, 836, 603b, 723): 191 casos, 187 pass, 0 fail, 4 skip (178 y 222 sin base). `scrum456`: no existe ningún fichero con ese prefijo.
- Mutación con `aplicarUna` (driver `docs/master/evidencias/SCRUM-1779/mutaciones-1779d.mjs`): «con SIF OFF vuelve a decir que falló» TUMBA, 0 colaterales; control sembrado (un `cae` que no existe) sale CIEGO. `git status` limpio después.
- Error mío: medí las rutas antes de cargar la skill `yaqu-verifactu-sif`, que es obligatoria; la cargué antes de escribir código.

### Para Luis (S1 y S2) · diff literal, sin texto nuevo

Sin esto, la ficha del Trabajo sigue pintando «⚠️ Factura emitida, revisa su registro» con SIF OFF (medido por `jv-j1go`, c.22283).

S1 · `src/modules/jobs/app/routes/albaranes.routes.ts` (facturar-parcial, hoy `:1451` y `:1466`):

```
-    const sellada = (await sellarTrasEmision(invoice, merchant, prisma)).estado === SELLADO_HECHO;
+    const estadoSellado = (await sellarTrasEmision(invoice, merchant, prisma)).estado;
+    const sellada = estadoSellado === SELLADO_HECHO;
...
-      ...(sellada ? {} : { message: 'Se emitió la factura, pero falló su registro VeriFactu. Revísalo antes de entregarla.' }),
+      ...(estadoSellado === SELLADO_PENDIENTE ? { message: 'Se emitió la factura, pero falló su registro VeriFactu. Revísalo antes de entregarla.' } : {}),
```

Y en convertir-en-factura (`:1731`, `:1784`) el mismo criterio si `MICROCOPY_PENDIENTE_290` también dice «falló» (sin leer).

S2 · `public/dashboard/js/jobDetailView.js:3986` (hace falta aunque S1 esté arreglado, porque `veriFactu` sigue siendo `false` sin sello):

```
-      showToast(d && d.veriFactu === false ? '⚠️ Factura emitida, revisa su registro' : '✓ Factura emitida.');
+      showToast(d && d.message ? '⚠️ Factura emitida, revisa su registro' : '✓ Factura emitida.');
```

### Sin medir

- La suite entera por tramos: no cabe en el contexto de esta sesión (182k al empezar el registro); la corre el obligatorio de CI.
- SCRUM-1780 (`facturaDesdeParte.ts`, de `jv-j1gp`): el fichero no está ni en `origin/main` ni en `scrum-1780b-ddl-y-diseno-factura-desde-parte` @ `df75c91fbe4b4ffb124ce45ea078170959760186`; no sé si devuelve el mismo `message`. No se toca desde aquí.
- Postgres, staging y producción: nada.

## SCRUM-1779i · 23-nov: prueba en STAGING — la factura emitida hoy desde el panel lleva «Formas de pago» en la ficha y en el PDF (J1, solo docs)

**Medido contra:** `origin/main` = `27656eae71e62369a5e87f27ae40e82e5764211d` · 2026-11-23T21:30:30Z (cabecera `Date:` de `gh api -i zen`; sesión J1 `jv-j1im`, por encargo del orquestador `cobroflash-backend-2d`)

A9: aviso → A10 «Una operación que no se ejecutó se lee exactamente igual que un éxito.» — no se pudo comprobar: mi guion de la emisión buscaba el id en `respuesta.invoice.id` y la respuesta lo trae en `factura.id`; imprimió `id undefined` y terminó sin error, sin capturas ni PDF. Lo vi al leer la salida y saqué las evidencias en una segunda pasada SIN emitir. Un guion de un solo uso contra staging no pasa por ningún guard del repositorio.

**Qué se probó.** Staging (`yaqu-staging-production`) sirve `/health` = `27656eae…` = `origin/main`, que contiene `d05a4522` (1787s) y 1787t (#3327); 1787x no está en `main`. Cuenta QA (comercio 2) con el login de test por `page.request`, el secreto leído de `process.env` dentro de un guion de `node` (no pasó por el MCP de Playwright ni por ningún fichero que una herramienta devolviera). Chrome con contexto nuevo (`serviceWorkers:'block'`). Turno de staging (`turno-staging.mjs --base staging`, base `railway`) tomado a las 21:31:38Z y soltado a las 21:34:23Z; `estado` después: LIBRE. Flags del comercio leídos en la base, solo lectura, antes y después, idénticos y sin tocar: `INVOICING_ES_ENABLED=true`, `SIF_ENABLED=false`, `BIZUM_MANUAL_ENABLED=true`; IBAN sí, móvil Bizum sí, `connectStatus=none`.

Desde el panel (Nueva factura → «Cliente QA sin avisos» → una línea de 100 € + 21 % → «Emitir factura») se emitió **F260005** (id 1980): `POST /admin/invoices` 201, `veriFactu:false`. El cuerpo de la petición NO traía `payMethods` (`{customerId, lines}`): las formas las congeló el servidor. Peticiones de escritura en las tres pasadas cuyo registro leí (la última exploración, la emisión y la de capturas): ese `POST` y el `POST /admin/entorno` que hace el panel al cargar. Las dos primeras exploraciones (sin pulsar «Emitir») no las leí: su registro se sobrescribió. **Ningún envío por WhatsApp ni correo.**

| qué | esperado | visto |
|---|---|---|
| `payMethods` de F260005 (API y base) | las activas del comercio QA, sin `card` | `["bizum","transfer"]` |
| Ficha · «Formas de pago» (1280 y 390) | sale, con Bizum y transferencia | «Formas de pago · Bizum, Transferencia» |
| Ficha · «Vence el» | sale | «23 dic 2026»; `dueDate` 2026-12-23T21:33:37Z = `createdAt` + 30 días |
| PDF · texto (`tests/_texto-del-pdf.mjs`, 17 líneas) | «Formas de pago» y «Vence el 23 de diciembre de 2026» | «Formas de pago: Bizum, Transferencia» y «Vence el 23 de diciembre de 2026» (fecha larga de 1787t; sin 1787x, así que no se pudo ver el día sin cero) |
| Control: F260004 (de esta mañana, 1787r) | sigue SIN formas de pago (regla 29) | `payMethods = null`; ficha sin la fila; PDF de 16 líneas sin «Formas de pago» |
| Página pública de pago | — | NO vista: exige Enviar (encargo) |

**Evidencias** (`docs/master/evidencias/SCRUM-1779/1779i/`), miradas una a una: `01-ficha-F260005-1280.png` y `02-ficha-F260005-390.png` (COBRO con «Vence el» y «Formas de pago»), el texto del PDF de F260005 `03-F260005-texto.txt` (el `.pdf` no se versiona: su cuerpo comprimido trae `\r` sin ningún NUL y `tests/scrum480-fin-de-linea.test.mjs` lo cuenta como blob de texto con CR; se arregla el fichero, no el guard), `04-control-F260004-1280.png` (COBRO solo con «Vence el») y `05-control-F260004-pdf-texto.txt`.

**Visto de paso, no es de este encargo:** la barra de estado de las dos facturas marca «Enviada» como paso actual aunque ninguna se ha enviado. No lo he investigado ni tocado; se lo paso al orquestador.

**NO medido:** yaqu.app (el login de test solo existe en staging); la página de pago; una imagen del PDF renderizado (va solo su texto; el `.pdf` se retiró del PR por el guard SCRUM-480); los otros caminos de 1787s (factura tras cobrar, presupuesto con lista, los cinco de S1); la suite de tests: cambio solo de docs, corrí los guards de docs y `guards:entrada`.

## SCRUM-1779l · 24-nov: prueba en STAGING — el PDF de una factura que vence un día de una cifra dice «5 de diciembre», sin cero (J1, solo docs)

**Medido contra:** `origin/main` = `f8dc0244675d00709b896101b97c89bd22468923` · 2026-11-24T02:27:53Z (cabecera `Date:` de `gh api -i zen`; sesión J1 `jv-j1ix`, relevo de `jv-j1iw`, por encargo del orquestador `cobroflash-backend-2d`)

A9: aviso → A10 «Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.» — no se pudo comprobar: lancé el guion de Playwright desde la carpeta temporal y salió «FALTA el secreto» (salida 2); el secreto no faltaba: el cargador de entorno lo busca a partir del directorio de trabajo, y fuera del árbol no lo encontró. Lo relancé desde el árbol y entró. No se emitió nada en la pasada fallida (corta antes del navegador). Un guion de un solo uso contra staging no pasa por ningún guard del repositorio.

**Qué se probó.** Staging sirve `/health` = `f8dc0244…` = `origin/main`, que contiene 1787x y `42cae6109` (1779i). Cuenta QA (comercio 2), login de test por `page.request` con el secreto leído de `process.env` dentro de un guion de `node` (no pasó por el MCP de Playwright ni se imprimió). Chrome con contexto nuevo (`serviceWorkers:'block'`). Turno de staging (`turno-staging.mjs --base staging`, base `railway`): a las 02:24:20Z lo tomó `scrum-1779m-staging-cancelar-cobro` y no se rompió; lo tomé a las 02:27:26Z y lo solté tras la emisión y las capturas (`soltar` salida 0, «marcador limpio»). Flags del comercio leídos en la base, solo lectura, antes y después, idénticos y sin tocar: `INVOICING_ES_ENABLED=true`, `SIF_ENABLED=false`, `BIZUM_MANUAL_ENABLED=true`.

Se emitió por API, sin pasar por el formulario, `POST /admin/invoices` con `{ customerId: 3936 («Cliente QA sin avisos»), lines: [100 € + 21 %], dueDate: '2026-12-05' }` → 201, **F260006** (id 1981), `veriFactu:false`. **El servidor respetó el `dueDate`** del cuerpo (no aplicó +30 días). **Ningún envío por WhatsApp ni correo**: no se pulsó «Enviar».

| qué | esperado | visto |
|---|---|---|
| `dueDate` de F260006 (API) | 2026-12-05, no `createdAt` + 30 | `2026-12-05T00:00:00.000Z` (`createdAt` 2026-11-24T02:27:44Z) |
| PDF de F260006 · texto (`tests/_texto-del-pdf.mjs`, 17 líneas) | «Vence el 5 de diciembre de 2026», sin «05» | «Vence el 5 de diciembre de 2026»; «05 de» aparece 0 veces en el texto de los dos PDF |
| Ficha de F260006 · fila «Vence el» (1280 y 390) | sale | «05 dic 2026» (formato corto de la ficha, con cero; ver abajo) |
| Control: PDF de F260005 (id 1980, de 1779i) | sigue «Vence el 23 de diciembre de 2026» | «Vence el 23 de diciembre de 2026»; ficha «23 dic 2026» |
| Enlace público de pago sin enviar | — | NO buscado ni usado (exige Enviar; encargo) |

**Evidencias** (`docs/master/evidencias/SCRUM-1779/1779l/`), miradas: `ficha-1981-1280.png` y `ficha-1981-390.png` (COBRO: «Vence el 05 dic 2026», «Formas de pago · Bizum, Transferencia»), `control-ficha-1980-1280.png`, el texto de los dos PDF (`F-1981-texto.txt`, `control-F-1980-texto.txt`; los `.pdf` no se versionan: `tests/scrum480-fin-de-linea.test.mjs`), `emision-respuesta.txt` y `salida-de-la-prueba.txt`.

**Visto, no juzgado:** la ficha escribe la fecha en formato corto con cero («05 dic 2026»), distinto del largo del PDF. Si 1787x debía cubrir también la ficha, no lo sé: no he leído su enunciado (el encargo pedía el PDF). Se lo paso al orquestador.

**NO medido:** yaqu.app; la página pública de pago; una imagen del PDF renderizado (va solo su texto); la fila de F260006 en la base (mi lector de solo lectura falló en esa consulta por un nombre de columna; el `dueDate` sale de la API); la suite de tests: cambio solo de docs, corrí los guards de docs y `guards:entrada`.
## SCRUM-1779m · 24-nov: prueba en STAGING — cancelar un cobro por la ruta de SCRUM-1532b y ver el recibo público (J1, solo docs)

**Medido contra:** `origin/main` = `f8dc0244675d00709b896101b97c89bd22468923` · 2026-11-24T02:24:04Z (cabecera `Date:` de `gh api -i zen`; sesión J1 `jv-j1iy`, relevo de `jv-j1iw`, por encargo del orquestador `cobroflash-backend-2d`)

A9: aviso → cicatriz J1 «Cancelé en staging el cobro 889 mirando solo el estado del cobro; su justificante ya constaba pagado y lo vi DESPUÉS, en la ficha» — no se pudo comprobar: el guion de un solo uso que elige la fila vive fuera del repositorio y ningún guard ve qué cobro elige ni qué dice su documento

**Qué se probó.** Staging (`yaqu-staging-production`) sirve `/health` = `f8dc0244…` = `origin/main`, que contiene `5de5441c` (#3332, SCRUM-1532b). Cuenta QA (comercio 2) con el login de test por `page.request`; el secreto, leído de `process.env` dentro de un guion de `node`, no pasó por el MCP de Playwright ni por ningún fichero que una herramienta devolviera. Chrome con contexto nuevo (`serviceWorkers:'block'`). Turno de staging (`turno-staging.mjs --base staging`, base `railway`) tomado a las 02:24:20Z y soltado a las 02:26:24Z; `estado` después: LIBRE. Flags del comercio leídos en la base (solo lectura), sin tocar: `INVOICING_ES_ENABLED=true`, `SIF_ENABLED=false`, `BIZUM_MANUAL_ENABLED=true`. De los 9 cobros `pending` del comercio 2 (889–897) se usó el más antiguo, **889** (590,00 €, justificante J-20260916-93ZW, documento id 1966); no se creó ninguno. Única escritura de la prueba: los dos `POST /admin/charges/889/cancel` (más el `POST /admin/entorno` que hace el panel al cargar). **Ningún envío por WhatsApp ni correo**; no se pulsó «Enviar» ni «Reenviar». El token del recibo no está en ninguna evidencia (recuento por bytes sobre los 8 ficheros: 0; control positivo, el fichero temporal que lo guarda: 1).

| qué | esperado | visto |
|---|---|---|
| Recibo ANTES (1280 y 390) | ofrece pagar | «Pago pendiente», botón «Pagar por transferencia» (1 acción visible) |
| `POST /admin/charges/889/cancel` | `{ ok: true, status: 'cancelled' }` | 200 `{"ok":true,"status":"cancelled"}`; en la base `status=cancelled`, `updated_at` 02:25:35 |
| Recibo DESPUÉS (1280 y 390) | «Este cobro se ha cancelado.» y sin pago | «✕ Este cobro se ha cancelado.», 0 botones ni enlaces visibles |
| Ficha del documento del cobro | etiqueta «Cobro cancelado» (SCRUM-1532d) | NO está: #3340 (`scrum-1532d-boton-cancelar-cobro-y-reenvio`) sigue ABIERTO y staging sirve `f8dc0244`; la ficha no dice nada del cobro cancelado (0 apariciones de «cancel») |
| Repetir el `POST` | `yaEstaba: true` | 200 `{"ok":true,"status":"cancelled","yaEstaba":true}` |

**Evidencias** (`docs/master/evidencias/SCRUM-1779/1779m/`), miradas una a una: `01-recibo-antes-1280.png`, `02-recibo-antes-390.png`, `03-recibo-despues-1280.png`, `04-recibo-despues-390.png`, `05-ficha-justificante-J-20260916-93ZW-1280.png`, el texto y las acciones visibles del recibo antes y después (`06-…`, `07-…`, con el token tapado) y `08-resultado.json`.

**Lo que encontré y no esperaba — el documento del cobro ya constaba pagado.** La ficha de J-20260916-93ZW dice «PAGADA · 📲 Bizum (confirmado a mano) · 16/9/2026», y en la base el documento 1966 es `type=JUST`, `status=paid`, `paid_via=bizum_manual`, mientras el cobro 889 estaba `pending`. La ruta lo canceló igual: solo mira `charges.status`. Cruce de los 9 (solo lectura): los 9 documentos son justificantes (`JUST`), no facturas, y **4 de 9** constan `paid` con su cobro `pending` (889, 890, 891, 893; solo 889 con `paid_via`). La «decisión 2» que cita la ruta («la factura se queda pendiente de cobro») da por hecho un documento pendiente; con uno pagado el resultado es un recibo «cancelado» y un justificante «pagado» del mismo cobro. No sé de dónde salen esos datos de staging ni si se pueden dar en producción: no lo he investigado. Se lo paso al orquestador; no lo he tocado.

**Visto de paso, no es de este encargo:** el recibo ANTES dice «Puedes completarlo usando el botón de pago por banco que aparece más arriba», y el botón está DEBAJO del texto (las dos capturas). Texto que ve el usuario: no lo toco; se lo paso al orquestador.

**NO medido:** yaqu.app (el login de test solo existe en staging); la etiqueta de 1532d (no está en `main`); la página `/pay/bank/` después de cancelar (no la abrí); un cobro con un documento `pending` (elegí el 889 por la orden, y lo vi pagado DESPUÉS de cancelarlo); la suite de tests: cambio solo de docs, corrí los guards de docs y `guards:entrada`.

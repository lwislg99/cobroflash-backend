# J1 — «¿esta factura puede ir a Hacienda tal como sale?»

18-sep-2026 · SCRUM-951c · escrita por la Sesión 0 del equipo de Luis. **El canon de abajo lo añade el
puesto**, como en las `sesion-N.md`; lo de arriba es el puesto tal como lo aprobó el fundador.

**FACTURACIÓN Y VERIFACTU. Construye servidor y pantallas de su área.** Es la **prioridad nº 1 del
máster** (SIF-1, Parte U): mientras SIF-1 no esté 8/8, YaQu no puede decir nada fiscal (reglas 17, 24 y 26).

Tu sesión se llama `jv-j1` y tu traspaso, en la memoria de tu máquina, `project_j1_traspaso.md` (A19).
Lees antes de nada, desde `origin/main`: `CLAUDE.md`, `00-normas-comunes.md`, `dos-equipos.md`,
`trampas-del-entorno.md` y esta ficha.

## Tu área

Facturas (emisión, PDF, envío por WhatsApp y por correo), VeriFactu (huella, QR, registros locales;
la remisión a la AEAT es **S1-D, aún sin construir** — sin tabla, sin envío, cero llamadas de red,
máster Parte L; **corregido 23-sep-2026, SCRUM-1094**, antes decía que ya existía como cola
`VfSubmission`), rectificativas (R1) y anulación, el libro de registro, y la entrega a la
gestoría (SCRUM-280, 322 y 323: J1 con revisión de J4, **pendiente de un jefe**, `dos-equipos.md` §7).

Y **revisas todo lo que borre o anonimice datos**, sea de quien sea el fichero: una factura emitida no se
borra NUNCA (regla 29).

## Tus ficheros

Los manda `dos-equipos.md` §3; si esta lista y aquella tabla discrepan, **manda la tabla**.

- Servidor: `src/modules/invoicing/**`, `src/modules/fiscal/**`, `src/lib/invoicing.ts`,
  `system/invoiceAdmin.ts`, `system/app/routes/invoicesAdmin.routes.ts`, `system/domain/flagFiscal.service.ts`,
  y el ENVÍO de la factura: `billing/domain/invoiceWhatsApp.service.ts`, `correoDeFacturaEnviado.ts`,
  `envioDelDocumento.ts`.
- Pantallas: `invoicesView.js`, `invoiceDetailView.js`, `invoiceAccion.js`, `invoiceActionsRegistry.js`,
  `libroRegistroView.js`, `facturaPreEmision.js`, `semaforoFiscal.js`, `puertaSerie.js`.
- **Tus bloques en contenedores ajenos**, marcados `// J1: …` y en un PR tuyo: `/verifactu.xml` en
  `exports.routes.ts` (S1), la serie fiscal en `system/merchantAdmin.ts` (J3) y la pestaña de datos fiscales
  en `settingsView.js` (J3). Nunca reescribes lo que no es tuyo.

## Lo que NO tocas

- **Presupuestos** (S1) y la página donde el cliente acepta y firma (S1).
- **Medios de pago** y **el canal de WhatsApp** (J2): la factura USA `whatsapp.ts`, no lo cambia.
- `prisma/schema.prisma` (A5: decisión → ALTER aditivo en las tres bases, que aplica Javier → un PR).
- `src/core/flags.ts`: un flag nuevo es cambio de máster (Parte P) y lo decide un jefe.
- **SCRUM-789 y SCRUM-863** (el RTT y la región de producción): son infraestructura y van a la S5, aunque
  hablen del límite de emisiones (decisión del orquestador de Luis, 18-sep 12:20Z).

## Tus STOP — paras y pides el sí de un jefe

- **MODIFICAR el camino de emisión fiscal.** Leerlo, o escribir un test que solo lo LEE, no es STOP (regla
  38). Sí lo es extraer un helper, exportar algo, cambiar una firma o mover código, aunque sea para el test:
  en el diff no se distingue de tocar el sellado. Antes de asumir el STOP, observa sin modificar: por AST, no
  con `grep` (SCRUM-203).
- **Cualquier afirmación fiscal o de VeriFactu** en pantalla, landing o textos. La pregunta «¿es VeriFactu?»
  se contesta SOLO con el guion H2, y el guion está en revisión porque dice cosas falsas (SCRUM-534, de J4).
- **Editar o borrar una factura emitida:** nunca. Solo R1 o anulación con registro (regla 29).
- **Exportar o borrar datos de clientes.**
- **Desplegar algo que toque el cobro:** el GO lo escribe un jefe **en tu chat**; uno reenviado no vale.

**Antes de tocar nada de VeriFactu**, la skill `yaqu-verifactu-sif` y `docs/SIF_SPEC_NOTES.md`. Lo que el
asesor ya contestó o tiene pendiente: `docs/legal/PREGUNTAS_ASESOR.md`; sus errores medidos:
`docs/ERRORES_ASESOR.md`.

## Tus primeros tickets

Medidos en Jira el 18-sep-2026 ~12:40Z (hora de GitHub). **Es una foto:** al arrancar, mide su estado y si su
rama ya está en `main` (A18) antes de creerte esta lista.

**El primero: SCRUM-612** — retirar el justificante. Es una DECISIÓN de jefe (ya lleva `equipo-javier`,
`area-j1` y `decision-jefe`): la enmienda se aprobó el 16-sep y siguen abiertas las preguntas E-1 a E-6. Tu
trabajo es dejarle a Javier cada pregunta con lo medido y las opciones, **no decidirla**. Se solapa con
**SCRUM-825** (la ejecución, fases 0 a 3, `docs/master/SCRUM-825.md`), que está bloqueado por E-1 y por el NIF
de la SL.

Tuyos, para construir o medir:

| ticket | qué es | nota |
|---|---|---|
| SCRUM-825 | el justificante deja de existir (fases 0-3) | detrás de 612 |
| SCRUM-523 | declaración responsable del productor (art. 13.2 RRSIF) | nada construido; necesita el NIF de la SL |
| SCRUM-658 | bloque B de Tecnosel: factura desde el parte, recurrentes y 303 | desbloqueado para diseñar el 17-sep; la emisión sigue detrás de SIF-1 |
| SCRUM-657 | facturas a administraciones públicas (FACe, DIR3) | bajó de categoría el 2-sep |
| SCRUM-322 | E1 · el envío al asesor | parado por el RGPD del envío (revisión de J4) |
| SCRUM-323 | E2 · el fichero para el programa contable | camino «libro» ya decidido |
| SCRUM-18 | certificaciones de obra con retención del 5 % | post-SIF |
| SCRUM-20 | VeriFactu de anticipo y recapitulativa | post-SIF y post FISCAL-1 |
| SCRUM-276 · 280 | épicas: núcleo fiscal y gestoría | se trabajan por sus hijos |

Esperan a un jefe (no se construyen: se le prepara la decisión):

| ticket | qué decide el jefe |
|---|---|
| SCRUM-612 | E-1 a E-6 del justificante (el primero, arriba) |
| SCRUM-665 | el PDF de una factura emitida se regenera: elegir A/B/C/D |
| SCRUM-524 | catálogo de validaciones VERI*FACTU: elegir entre las opciones de §⑤ de `docs/master/SCRUM-524.md` |
| SCRUM-735 | la fecha de la huella sale del reloj del proceso: arreglarlo MODIFICA el camino de emisión (STOP) |
| SCRUM-142 | factura de anticipo: espera el dictamen P1 del asesor |
| SCRUM-870 | el nombre del productor en el XML: espera el NIF y la razón social de la SL |

Y la parte de FACTURA de la épica SCRUM-572 (19 mejoras de documentos, de la S4) es tuya cuando se parta.

## La trampa que te espera

Casi todo el canon de `sesion-1.md` nació en tu área (SCRUM-729 y SCRUM-844): siete `invoice.create` donde
se buscaba «la línea»; un backfill que habría fabricado declaraciones fiscales; lo sellado que se volvía a
calcular al exportar; un test en verde que había probado otra puerta. **Léelo antes de tu primer ticket.**

    🔒 Un documento firmado cuyo contenido se recalcula al exportarlo no está firmado: está sellado sobre
       algo que ya no existe.

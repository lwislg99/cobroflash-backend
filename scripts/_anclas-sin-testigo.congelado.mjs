// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-525d · QUÉ DOCUMENTO DE `docs/legal/` PUEDE CITAR QUÉ FICHERO SIN TESTIGO.
//
// 🔴 AQUÍ NO HAY NI UN NÚMERO DE LÍNEA, Y ES DELIBERADO. La primera versión de este
// congelado guardaba `documento#ruta:LÍNEA`, y el guard de SCRUM-710b la tumbó con su
// propia lección: una identidad que lleva la posición dentro CADUCA en cuanto alguien
// edita el fichero por encima, y entonces lo que se toca para volver al verde es el guard.
// Lo que se congela es el PAR documento↔fichero citado. Mover una cita de la 100 a la 105
// no dice nada nuevo; que un documento empiece a citar un fichero que no citaba, sí.
//
// 🔴 ESTE CONJUNTO SÓLO PUEDE ENCOGER. Mientras un par esté aquí, se le perdona no llevar
// testigo. Un par NUEVO sin testigo tumba el guard. Añadir una línea es declarar por
// escrito que la deuda crece — y la salida barata que eso evita es borrar el testigo para
// apagar un rojo, que es la regla 41 del máster leída al revés.
//
// 🔴 Y DESDE SCRUM-927b, ENCOGER TAMBIÉN LO TUMBA SI NO SE RECOGE. Cuando un par de aquí deja
// de citar sin testigo, hay que quitarlo de esta lista EN EL MISMO COMMIT. Hasta entonces eso
// se avisaba por `console.log` y la tanda seguía verde, así que el aviso se perdía entre miles
// de líneas: contar no es avisar. Una entrada que ya no excluye a nadie no es inofensiva — deja
// una puerta abierta con la etiqueta de otro, y el trinquete de arriba la tomaría por deuda
// vieja el día que alguien vuelva a citar ese par sin testigo.
//
// ⚠️ LO QUE ESTE TRINQUETE **NO** CAZA, y hay que saberlo: una coordenada nueva sin testigo
// en un par que YA está aquí. Es el precio de no anclar por posición, y se paga a sabiendas.
//
// Medido el 16-sep-2026 sobre `origin/main` = `5135683049a0d002f9aea5efdf13fd9ba837b280`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const PARES_SIN_TESTIGO_CONGELADOS = new Set([
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # RGPD_TRATAMIENTO_DATOS.md',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # YAQU_MASTER.md',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # albaranes.routes.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # audit.service.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # borradoMerchant.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # clean-staging-tests.mjs',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # docs/RUNBOOKS.md',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # e2e-critico.mjs',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # exportData.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # exports.routes.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # invoiceNumber.service.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # invoicesAdmin.routes.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # job.service.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # jobDetailView.js',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # jobs.routes.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # legalPages.routes.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # lib/invoicing.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # merchant-fixture.test.mjs',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # prisma/schema.prisma',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # quotes.routes.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # receipt.routes.ts',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # schema.prisma',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # scripts/backup-dump.mjs',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # scrum25-export-zip.test.mjs',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # scrum25-exports.test.mjs',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # sw.js',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # verifactu.service.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # docs/legal/SEMAFORO_CALIBRACION.md',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # docs/legal/SEMAFORO_MAPA_EMISION.md',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # prisma/schema.prisma',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # public/dashboard/js/semaforoFiscal.js',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/core/flags.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/integrations/enviarCorreo.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/integrations/gemini.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/integrations/mercadopago.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/lib/invoicing.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/exports/app/routes/exports.routes.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/fiscal/verifactu/registro.builder.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/app/routes/invoice.routes.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/invoiceNumber.service.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/modoVisible.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/selladoEstado.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/verifactu.service.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/infra/pdf/pdf.service.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/jobs/domain/albaran.service.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/jobs/domain/albaranFirmante.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/jobs/infra/albaranPdf.service.ts',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/system/app/routes/invoicesAdmin.routes.ts',
  'docs/legal/EXPEDIENTE_FISCAL_ANTICIPOS_RECAPITULATIVA.md # invoicesAdmin.routes.ts',
  'docs/legal/EXPEDIENTE_FISCAL_ANTICIPOS_RECAPITULATIVA.md # registro.builder.ts',
  'docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md # .claude/skills/yaqu-release-check/SKILL.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md # .claude/skills/yaqu-verifactu-sif/SKILL.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md # PREGUNTAS_ASESOR.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md # YAQU_MASTER.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md # modoVisible.ts',
  'docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md # verifactu.service.ts',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # AUDITLOG_FISCAL_CONTRATO.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # DECLARACION_RESPONSABLE.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # PACK_GESTORIA.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # PREGUNTAS_ASESOR.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # SEMAFORO_CALIBRACION.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # SEMAFORO_MAPA_EMISION.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # SIF_SPEC_NOTES.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # docs/SIF_SPEC_NOTES.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # docs/YAQU_MASTER.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # docs/legal/ALCANCE_BETA.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # docs/legal/EMAIL_ASESOR.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # docs/legal/SEMAFORO_MAPA_EMISION.md',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # invoiceNumber.service.ts',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # public/dashboard/js/invoiceDetailView.js',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # public/dashboard/js/jobDetailView.js',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # public/dashboard/js/semaforoFiscal.js',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # public/dashboard/js/settingsView.js',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # registro.builder.ts',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # src/modules/invoicing/domain/modoVisible.ts',
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md # verifactu.service.ts',
  'docs/legal/MEDICION_GUION_H2_EN_PUBLIC.md # YAQU_MASTER.md',
  'docs/legal/MEDICION_GUION_H2_EN_PUBLIC.md # docs/SPRINT_DEMO_READY_EXT.md',
  'docs/legal/MEDICION_GUION_H2_EN_PUBLIC.md # docs/YAQU_MASTER.md',
  'docs/legal/MEDICION_GUION_H2_EN_PUBLIC.md # invoiceDetailView.js',
  'docs/legal/PREGUNTAS_ASESOR.md # libroRegistro.ts',
  'docs/legal/PREGUNTAS_ASESOR.md # libroRegistroView.js',
  'docs/legal/PREGUNTAS_ASESOR.md # registro.builder.ts',
  'docs/legal/PREGUNTAS_ASESOR.md # src/core/flags.ts',
  'docs/legal/PREGUNTAS_ASESOR.md # src/modules/invoicing/domain/emission.service.ts',
  'docs/legal/PREGUNTAS_ASESOR.md # src/modules/invoicing/domain/modoVisible.ts',
  'docs/legal/PREGUNTAS_ASESOR.md # src/modules/invoicing/domain/portonDocumento.ts',
]);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL OTRO LADO DEL TRINQUETE · LOS TESTIGOS QUE YA ESTÁN PUESTOS, Y NO SE PUEDEN QUITAR.
//
// 🔴 ESTE CONJUNTO SÓLO PUEDE CRECER. El de arriba impide que la deuda suba; éste impide que
// la cobertura BAJE, que es la otra mitad y faltaba. Sin él, la forma barata de apagar un
// rojo de «esta ancla no apunta a lo que dice» es BORRAR EL TESTIGO: el ancla deja de ser
// comprobable, el guard calla, y el documento queda peor que antes con mejor cara.
//
// Lo detectó el fundador leyendo la entrega: yo había declarado «cero umbrales a mano» —que
// es cierto— como si eso cubriera esta mitad, y no la cubre. Medido al comprobarlo: el par
// de `selladoEstado.ts` YA estaba congelado arriba (la auditoría lo cita dos veces, una con
// testigo y otra sin), así que quitarle el testigo no ponía nada rojo.
//
// 🔴 LA IDENTIDAD ES EL TESTIGO, no su línea (SCRUM-710b). Mover la coordenada no toca esta
// lista; quitar el símbolo, sí. Por eso es un trinquete de COBERTURA y no de proporción: una
// proporción se mantiene quitando un testigo aquí y poniendo otro allá, y eso no es lo mismo.
//
// Medido el 16-sep-2026 sobre `origin/main` = `5135683049a0d002f9aea5efdf13fd9ba837b280`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const TESTIGOS_PUESTOS = new Set([
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # invoicesAdmin.routes.ts # /pay',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # invoicesAdmin.routes.ts # /unpay',
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md # invoicesAdmin.routes.ts # meta.ids',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # prisma/schema.prisma # vf_hash',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # prisma/schema.prisma # vf_prev_hash',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/lib/invoicing.ts # exigirDocumentoEmitible',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/fiscal/verifactu/registro.builder.ts # construirSobreRegFactu',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/facturaSuelta.ts # modoDocumentoSuelto',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/invoiceNumber.service.ts # allocateInvoiceNumber',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/selladoEstado.ts # sellarTrasEmision',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/verifactu.service.ts # buildVeriFactuQrUrl',
  'docs/legal/AUDITORIA_CAMINO_EMISION.md # src/modules/invoicing/domain/verifactu.service.ts # buildVerifactuRegistrosXml',
]);

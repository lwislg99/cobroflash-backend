// src/modules/jobs/domain/albaranWhatsApp.service.ts — SCRUM-47 / SCRUM-49
// Envío de la copia FIRMADA del albarán por WhatsApp (plantilla albaran_firmado_es con el PDF
// en la cabecera de documento). Extraído del endpoint POST /:id/enviar-whatsapp (SCRUM-47) para
// reutilizarlo también en el AUTO-ENVÍO tras la firma REMOTA (SCRUM-49).
//
// NO decide tenancy: el caller ya autorizó (endpoint manual = sesión+merchant vía findAlbaran;
// firma remota = token opaco del albarán). El merchantId sale del propio albarán. Guards completos
// vía sendWhatsAppTemplate (merchantId + log{customerId, relatedType:'albaran', relatedId}): V0-2,
// J3, A3.2, J6 (tope 3/cliente/día), J7, dry-run, WA-0b. Sin ventana 24h (SCRUM-50).
import crypto from 'crypto';
import fs from 'fs';
import { prisma } from '../../../core/db/prisma';
import { normalizePhone } from '../../../core/utils/utils';
import { sendWhatsAppTemplate, sendWhatsAppWindowFirst, uploadWhatsAppMedia } from '../../../integrations/whatsapp';
import { BASE_URL } from '../../../core/config/env'; // SCRUM-62
import { buildAlbaranFirmado, buildAlbaranParaFirmar } from '../../../integrations/whatsappTemplates';
import { ensureAlbaranPdf } from './albaran.service';
import { SEND_FAILURE_MESSAGES, type SendFailureReason } from '../../../lib/sendOutcome';

// SCRUM-126: `status` distingue PRECONDICIÓN (nunca se intentó el envío — 404/409, el
// caller no debe leer `sent`) de ENVÍO INTENTADO que no salió (siempre 200 — el caller
// traduce esto a `sent:false`). El caller (albaranes.routes.ts) hace esa traducción.
export type AlbaranFirmadoSendResult =
  | { ok: true }
  | { ok: false; reason: string; message: string; status: number };

/**
 * Envía la copia firmada del albarán `albaranId` al WhatsApp de su cliente. Idempotente en el
 * sentido de que no muta estado: solo lee el albarán, sube el PDF y manda la plantilla.
 * Devuelve `{ ok:true }` o `{ ok:false, reason, message, status }` (status = el HTTP que debe
 * devolver el endpoint manual; el auto-envío de la firma remota ignora el status y NO falla la
 * firma pase lo que pase — SCRUM-49, la firma nunca falla por el envío).
 */
export async function sendAlbaranFirmadoWhatsApp(albaranId: number): Promise<AlbaranFirmadoSendResult> {
  const albaran = await prisma.albaran.findUnique({
    where: { id: albaranId },
    select: { id: true, estado: true, jobId: true, merchantId: true },
  });
  if (!albaran) return { ok: false, reason: 'not_found', message: 'Albarán no encontrado.', status: 404 };
  if (albaran.estado !== 'firmado') {
    return { ok: false, reason: 'albaran_no_firmado', message: 'Solo se puede enviar un albarán firmado.', status: 409 };
  }
  if (!albaran.jobId) return { ok: false, reason: 'albaran_sin_trabajo', message: 'El albarán no tiene trabajo asociado.', status: 409 };

  // Cliente vía el Trabajo, scopeado al merchant del albarán (regla 2, tenancy).
  const job = await prisma.job.findFirst({
    where: { id: albaran.jobId, merchantId: albaran.merchantId },
    select: { id: true, customerId: true, titulo: true },
  });
  if (!job) return { ok: false, reason: 'job_not_found', message: 'El trabajo del albarán no existe.', status: 404 };
  const customer = await prisma.customer.findFirst({
    where: { id: job.customerId, merchantId: albaran.merchantId },
    select: { id: true, name: true, phone: true },
  });
  const to = normalizePhone(customer?.phone || '');
  // SCRUM-126: "customer_missing_phone" (no "sin_telefono") — mismo código que usan
  // invoiceWhatsApp.service.ts y sendQuote.service.ts para la misma condición.
  if (!to) return { ok: false, reason: 'customer_missing_phone', message: 'Este cliente no tiene WhatsApp guardado.', status: 409 };

  // PDF firmado → bytes → media_id. Con la 48 el PDF es auth-only, por eso media_id y no link.
  const { diskPath, numero } = await ensureAlbaranPdf(albaran.id);
  const buffer = await fs.promises.readFile(diskPath);
  const mediaId = await uploadWhatsAppMedia({ buffer, filename: `${numero}.pdf`, mime: 'application/pdf' });
  if (!mediaId) {
    // SCRUM-126: 200, no 502 — no se pudo preparar el adjunto, pero es "el envío no
    // salió" desde la perspectiva del merchant, igual que un opt-out o un tope.
    return { ok: false, reason: 'media_upload_failed', message: SEND_FAILURE_MESSAGES.media_upload_failed, status: 200 };
  }

  const obra = (job.titulo || '').trim() || 'tu trabajo'; // {{3}} = Job.titulo (fallback no vacío: J7 rechaza var vacía)
  const msg = buildAlbaranFirmado({
    customerName: (customer?.name || '').trim() || 'cliente',
    albaranNumber: numero,
    obra,
    mediaId,
    filename: `${numero}.pdf`,
  });
  const result: any = await sendWhatsAppTemplate({
    to,
    merchantId: albaran.merchantId,
    templateName: msg.templateName,
    languageCode: msg.languageCode,
    components: msg.components,
    log: { customerId: customer?.id ?? null, relatedType: 'albaran', relatedId: albaran.id },
  });

  if (!result?.ok) {
    // SCRUM-126: reason conocido (opt-out/tope/etc.) → su mensaje canónico. Cualquier otra
    // cosa (Meta rechazó con texto libre, excepción) → whatsapp_send_failed genérico.
    // Guard/Meta rechazó: el endpoint manual devuelve 200 (sent:false) con mensaje legible
    // (mismo vocabulario que el resto de los 9 endpoints de envío). El auto-envío (SCRUM-49)
    // lo trata como best-effort.
    const reason: SendFailureReason =
      result?.reason && result.reason in SEND_FAILURE_MESSAGES ? result.reason : 'whatsapp_send_failed';
    return { ok: false, reason, message: SEND_FAILURE_MESSAGES[reason], status: 200 };
  }
  return { ok: true };
}

/**
 * SCRUM-49 — envío MANUAL del link "para firmar" a distancia (plantilla albaran_para_firmar_es
 * con botón URL → /albaran/{{token}}). Solo desde 'emitido'. Genera el token opaco perezosamente
 * (patrón ensurePortalToken) y marca `enviadoParaFirmaAt`. Guards completos vía sendWhatsAppTemplate
 * (V0-2/J3/A3.2/J6/J7/dry-run/WA-0b). Tenancy la decide el caller (endpoint admin = findAlbaran).
 */
export async function sendAlbaranParaFirmarWhatsApp(albaranId: number): Promise<AlbaranFirmadoSendResult> {
  const albaran = await prisma.albaran.findUnique({
    where: { id: albaranId },
    select: { id: true, estado: true, jobId: true, merchantId: true, numero: true, firmaToken: true },
  });
  if (!albaran) return { ok: false, reason: 'not_found', message: 'Albarán no encontrado.', status: 404 };
  if (albaran.estado !== 'emitido') {
    return { ok: false, reason: 'albaran_no_emitido', message: 'Solo se puede enviar para firmar un albarán emitido.', status: 409 };
  }
  if (!albaran.jobId) return { ok: false, reason: 'albaran_sin_trabajo', message: 'El albarán no tiene trabajo asociado.', status: 409 };

  const [job, merchant] = await Promise.all([
    prisma.job.findFirst({ where: { id: albaran.jobId, merchantId: albaran.merchantId }, select: { customerId: true } }),
    prisma.merchant.findUnique({ where: { id: albaran.merchantId }, select: { name: true, legalName: true } }),
  ]);
  if (!job) return { ok: false, reason: 'job_not_found', message: 'El trabajo del albarán no existe.', status: 404 };
  const customer = await prisma.customer.findFirst({
    where: { id: job.customerId, merchantId: albaran.merchantId },
    select: { id: true, name: true, phone: true },
  });
  const to = normalizePhone(customer?.phone || '');
  // SCRUM-126: "customer_missing_phone" (no "sin_telefono") — mismo código que usan
  // invoiceWhatsApp.service.ts y sendQuote.service.ts para la misma condición.
  if (!to) return { ok: false, reason: 'customer_missing_phone', message: 'Este cliente no tiene WhatsApp guardado.', status: 409 };

  // Token OPACO (128 bits) perezoso: si ya existe se reutiliza (link estable). Marca de envío.
  const token = albaran.firmaToken || crypto.randomBytes(16).toString('hex');
  await prisma.albaran.update({ where: { id: albaran.id }, data: { firmaToken: token, enviadoParaFirmaAt: new Date() } });

  const businessName = (merchant?.legalName || merchant?.name || '').trim() || 'Tu proveedor';
  const msg = buildAlbaranParaFirmar({
    customerName: (customer?.name || '').trim() || 'cliente',
    businessName,
    albaranNumber: albaran.numero,
    token,
  });
  /**
   * SCRUM-62 · VENTANA PRIMERO. Esto mandaba SIEMPRE plantilla (~0,023 EUR cada envío) aunque la
   * ventana de servicio de 24 h estuviera abierta, donde el mismo mensaje es GRATIS. La
   * detección de ventana ya existía y se puebla sola (`recordInboundWaMessage` con cada
   * entrante, incluido el toque de "Recibido"): no hace falta tracking nuevo.
   *
   * Se reutiliza `sendWhatsAppWindowFirst` ENTERA en vez de re-implementar el criterio: dentro
   * viven el respeto al opt-out (J3), `isServiceWindowOpen`, el fallback a plantilla si el texto
   * falla y el registro en WA-0b con `costEstimate: 0`. Es el mismo camino que ya usan
   * presupuesto, factura y recordatorio — así esta vía y `a55-window-quote` NO PUEDEN discrepar,
   * porque no hay dos criterios: hay uno.
   *
   * El texto de ventana es K1 OFICIAL, aprobado por el fundador el 27-jul-2026 (regla 30):
   * calcado en estructura al del presupuesto y con las MISMAS tres variables que la plantilla ya
   * aprobada en Meta (cliente, empresa, número), sin añadir información que la plantilla no diga.
   */
  const enlaceFirma = `${BASE_URL}/albaran/${token}`;
  const nombreCliente = (customer?.name || '').trim() || 'cliente';
  const cuerpoVentana =
    `Hola ${nombreCliente} 👋
` +
    `*${businessName}* te ha preparado el parte de trabajo:
` +
    `📄 *Albarán ${albaran.numero}*`;

  const result: any = await sendWhatsAppWindowFirst({
    to,
    merchantId: albaran.merchantId,
    customerId: customer?.id ?? null,
    // Sin botón (camino de reserva de la propia función): el enlace va dentro del texto.
    windowText: `${cuerpoVentana}
${enlaceFirma}`,
    // Con botón-enlace, que es la vía normal: nada de URL cruda en el cuerpo (A23).
    windowCta: { bodyText: cuerpoVentana, buttonText: 'Ver y firmar', url: enlaceFirma },
    template: { templateName: msg.templateName, languageCode: msg.languageCode, components: msg.components },
    log: { customerId: customer?.id ?? null, relatedType: 'albaran', relatedId: albaran.id },
  });
  if (!result?.ok) {
    const reason: SendFailureReason =
      result?.reason && result.reason in SEND_FAILURE_MESSAGES ? result.reason : 'whatsapp_send_failed';
    return { ok: false, reason, message: SEND_FAILURE_MESSAGES[reason], status: 200 };
  }
  return { ok: true };
}

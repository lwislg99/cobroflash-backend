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
import { sendWhatsAppTemplate, uploadWhatsAppMedia } from '../../../integrations/whatsapp';
import { buildAlbaranFirmado, buildAlbaranParaFirmar } from '../../../integrations/whatsappTemplates';
import { ensureAlbaranPdf } from './albaran.service';

export type AlbaranFirmadoSendResult =
  | { ok: true }
  | { ok: false; reason: string; message: string; status: number };

// Mensajes legibles por motivo (mismos que devolvía el endpoint de la 47).
const LEGIBLE: Record<string, string> = {
  wa_opt_out: 'El cliente se dio de baja de WhatsApp.',
  demo_safe_numbers: 'En modo demo solo se envía a números autorizados.',
  daily_cap: 'Se alcanzó el tope diario de mensajes de WhatsApp.',
  customer_daily_cap: 'Este cliente ya recibió el máximo de mensajes por hoy.',
  not_configured: 'WhatsApp no está configurado.',
};

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
  if (!to) return { ok: false, reason: 'sin_telefono', message: 'Este cliente no tiene WhatsApp guardado.', status: 409 };

  // PDF firmado → bytes → media_id. Con la 48 el PDF es auth-only, por eso media_id y no link.
  const { diskPath, numero } = await ensureAlbaranPdf(albaran.id);
  const buffer = await fs.promises.readFile(diskPath);
  const mediaId = await uploadWhatsAppMedia({ buffer, filename: `${numero}.pdf`, mime: 'application/pdf' });
  if (!mediaId) {
    return { ok: false, reason: 'media_upload_failed', message: 'No se pudo preparar el PDF para WhatsApp. Inténtalo de nuevo.', status: 502 };
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
    const reason = result?.reason || 'send_failed';
    // Guard/Meta rechazó: el endpoint manual devuelve 200 + ok:false con mensaje legible
    // (patrón del resend de invoices). El auto-envío (SCRUM-49) lo trata como best-effort.
    return { ok: false, reason, message: LEGIBLE[reason] || 'No se pudo enviar por WhatsApp.', status: 200 };
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
  if (!to) return { ok: false, reason: 'sin_telefono', message: 'Este cliente no tiene WhatsApp guardado.', status: 409 };

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
  const result: any = await sendWhatsAppTemplate({
    to,
    merchantId: albaran.merchantId,
    templateName: msg.templateName,
    languageCode: msg.languageCode,
    components: msg.components,
    log: { customerId: customer?.id ?? null, relatedType: 'albaran', relatedId: albaran.id },
  });
  if (!result?.ok) {
    const reason = result?.reason || 'send_failed';
    return { ok: false, reason, message: LEGIBLE[reason] || 'No se pudo enviar por WhatsApp.', status: 200 };
  }
  return { ok: true };
}

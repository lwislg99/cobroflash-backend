// src/modules/jobs/app/routes/albaranes.routes.ts — SCRUM-14 (ALBARAN-1)
// Acciones sobre un albarán existente (el create vive en POST /admin/jobs/:id/albaranes).
// Documento NO FISCAL (regla 24): nada de facturación/VeriFactu aquí. Tenancy SIEMPRE
// findFirst { id, merchantId } → 404 (regla 2). Editable hasta 'firmado' (409 albaran_locked).
import { Router } from 'express';
import fs from 'fs';
import { prisma } from '../../../../core/db/prisma';
import { recordAudit, requestIp } from '../../../system/audit.service';
import { requireActivePlan } from '../../../../core/http/authMiddleware'; // SCRUM-47 (S1: enviar WA ✅ técnico, sin requireRole)
import { normalizePhone } from '../../../../core/utils/utils';
import { sendWhatsAppTemplate, uploadWhatsAppMedia } from '../../../../integrations/whatsapp';
import { buildAlbaranFirmado } from '../../../../integrations/whatsappTemplates';
import {
  canTransitionAlbaran,
  ensureAlbaranPdf,
  serializeAlbaran,
  validarLineas,
} from '../../domain/albaran.service';

const router = Router();

// Condición 1 del OK (fotos): límites duros con 4xx claros.
const FOTO_MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp'];
const FOTO_MAX_BYTES = 5 * 1024 * 1024; // ~5 MB por foto (decodificada)
const FOTOS_MAX_POR_ALBARAN = 10;
// Condición 2 del OK (firma): tope del data-URI base64 — el canvas del patrón del
// quote genera ~10-50 KB; 500 KB da margen de sobra sin permitir payloads absurdos.
const FIRMA_MAX_CHARS = 500_000;

type FindAlbaranResult =
  | { ok: false; status: 400 | 404 }
  | { ok: true; albaran: NonNullable<Awaited<ReturnType<typeof prisma.albaran.findFirst>>> };

async function findAlbaran(req: any): Promise<FindAlbaranResult> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return { ok: false, status: 400 };
  const albaran = await prisma.albaran.findFirst({ where: { id, merchantId: req.merchantId } });
  return albaran ? { ok: true, albaran } : { ok: false, status: 404 };
}

// PATCH /admin/albaranes/:id — editar lineas/notas/fecha SOLO si no está firmado.
// Cada edición: version++ + traza en AuditLog (decisión fundador: sin historial de filas).
router.patch('/:id', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado === 'firmado') {
      return res.status(409).json({ error: 'albaran_locked', message: 'Un albarán firmado está congelado: no se puede editar.' });
    }

    const data: any = {};
    const cambios: string[] = [];
    if (req.body?.lineas !== undefined) {
      const v = validarLineas(req.body.lineas);
      if (!v.ok) return res.status(400).json({ error: 'lineas_invalidas', message: v.error });
      data.lineas = v.lineas;
      cambios.push('lineas');
    }
    if (req.body?.notas !== undefined) {
      data.notas = String(req.body.notas || '').slice(0, 2000) || null;
      cambios.push('notas');
    }
    if (req.body?.fecha !== undefined) {
      const d = new Date(String(req.body.fecha));
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'invalid_date' });
      data.fecha = d;
      cambios.push('fecha');
    }
    if (cambios.length === 0) return res.status(400).json({ error: 'nothing_to_update' });

    const updated = await prisma.albaran.update({
      where: { id: albaran.id },
      data: { ...data, version: { increment: 1 } },
    });
    recordAudit({
      merchantId: req.merchantId,
      teamMemberId: (req as any).teamMemberId ?? null,
      action: 'albaran_editado',
      entityType: 'albaran',
      entityId: albaran.id,
      meta: { cambios, deVersion: albaran.version, aVersion: updated.version },
      ip: requestIp(req),
    });
    return res.json(serializeAlbaran(updated));
  } catch (err: any) {
    console.error('[PATCH /admin/albaranes/:id]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/emitir — borrador→emitido (idempotente si ya emitido).
router.post('/:id/emitir', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado === 'emitido') return res.json(serializeAlbaran(albaran)); // idempotente
    if (!canTransitionAlbaran(albaran.estado, 'emitido')) {
      return res.status(409).json({ error: 'invalid_transition', from: albaran.estado, to: 'emitido' });
    }
    const updated = await prisma.albaran.update({ where: { id: albaran.id }, data: { estado: 'emitido' } });
    return res.json(serializeAlbaran(updated));
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/emitir]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/firmar — firma del cliente EN EL MÓVIL DEL PRO (canvas).
// Solo desde 'emitido'. Firmado = terminal y congelado; el PDF se regenera con la firma.
router.post('/:id/firmar', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado === 'firmado') {
      return res.status(409).json({ error: 'albaran_locked', message: 'Este albarán ya está firmado.' });
    }
    if (!canTransitionAlbaran(albaran.estado, 'firmado')) {
      return res.status(409).json({ error: 'invalid_transition', from: albaran.estado, to: 'firmado', message: 'Emite el albarán antes de firmarlo.' });
    }

    const signatureData = String(req.body?.signatureData || '');
    if (!/^data:image\/(png|jpeg);base64,/.test(signatureData)) {
      return res.status(400).json({ error: 'firma_invalida', message: 'La firma debe ser una imagen PNG o JPEG (data-URI base64).' });
    }
    if (signatureData.length > FIRMA_MAX_CHARS) {
      return res.status(413).json({ error: 'firma_demasiado_grande', message: 'La firma supera el tamaño máximo permitido.' });
    }

    const firmadoAt = new Date();
    const updated = await prisma.albaran.update({
      where: { id: albaran.id },
      data: { estado: 'firmado', signatureUrl: signatureData, firmadoAt },
    });
    // Regenerar el PDF YA con el bloque de firma (force). Si el PDF falla, la firma
    // queda registrada igualmente (el GET /pdf lo regenerará bajo demanda).
    await ensureAlbaranPdf(albaran.id, true).catch((e) =>
      console.error('[albaranes] PDF tras firmar:', e?.message || e),
    );
    return res.json(serializeAlbaran({ ...updated, pdfUrl: `/admin/albaranes/${updated.id}/pdf` }));
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/firmar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/albaranes/:id/pdf — regenera si falta (disco Railway efímero) y sirve.
router.get('/:id/pdf', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    const { diskPath, numero } = await ensureAlbaranPdf(albaran.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${numero}.pdf"`);
    return res.sendFile(diskPath);
  } catch (err: any) {
    console.error('[GET /admin/albaranes/:id/pdf]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/fotos — adjunta foto vía Attachment (entityType:'albaran').
// Límites (condición 1 del OK): mime allowlist, ~5 MB/foto, máx. 10 fotos, 4xx claros.
// Un albarán firmado está congelado: tampoco admite fotos nuevas.
router.post('/:id/fotos', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado === 'firmado') {
      return res.status(409).json({ error: 'albaran_locked', message: 'Un albarán firmado está congelado: no admite fotos nuevas.' });
    }

    const mime = String(req.body?.mime || '');
    if (!FOTO_MIME_ALLOWLIST.includes(mime)) {
      return res.status(415).json({ error: 'mime_no_permitido', message: 'Formatos permitidos: JPEG, PNG o WebP.' });
    }
    // data: base64 puro o data-URI (se tolera el prefijo y se recorta)
    const rawB64 = String(req.body?.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!rawB64) return res.status(400).json({ error: 'foto_vacia', message: 'Falta el contenido de la foto (base64).' });
    let buffer: Buffer;
    try {
      buffer = Buffer.from(rawB64, 'base64');
    } catch {
      return res.status(400).json({ error: 'base64_invalido' });
    }
    if (buffer.length === 0) return res.status(400).json({ error: 'foto_vacia' });
    if (buffer.length > FOTO_MAX_BYTES) {
      return res.status(413).json({ error: 'foto_demasiado_grande', message: 'Cada foto puede ocupar como máximo 5 MB.' });
    }

    const count = await prisma.attachment.count({
      where: { merchantId: req.merchantId, entityType: 'albaran', entityId: albaran.id },
    });
    if (count >= FOTOS_MAX_POR_ALBARAN) {
      return res.status(409).json({ error: 'max_fotos', message: `Máximo ${FOTOS_MAX_POR_ALBARAN} fotos por albarán.` });
    }

    // Patrón MEDIA-1 (attachment.service): create + url al endpoint tenancy-safe
    const att = await prisma.attachment.create({
      data: {
        merchantId: req.merchantId,
        entityType: 'albaran',
        entityId: albaran.id,
        kind: 'photo',
        url: '',
        data: new Uint8Array(buffer),
        mime,
      },
      select: { id: true },
    });
    await prisma.attachment.update({ where: { id: att.id }, data: { url: `/admin/attachments/${att.id}` } });
    return res.status(201).json({ ok: true, attachmentId: att.id, url: `/admin/attachments/${att.id}` });
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/fotos]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/albaranes/:id/fotos — lista para la galería de la sección Albaranes.
router.get('/:id/fotos', async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const fotos = await prisma.attachment.findMany({
      where: { merchantId: req.merchantId, entityType: 'albaran', entityId: found.albaran.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, url: true, mime: true, createdAt: true },
    });
    return res.json(fotos);
  } catch (err: any) {
    console.error('[GET /admin/albaranes/:id/fotos]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/enviar-whatsapp — SCRUM-47: envía la copia FIRMADA al WhatsApp
// del cliente (plantilla `albaran_firmado_es` con el PDF en la cabecera de documento).
// MANUAL (decisión del fundador). S1: "enviar WA" es capacidad de técnico → requireActivePlan,
// SIN requireRole (coherente con /admin/quotes/:id/send-whatsapp). Solo desde 'firmado'.
// Guards completos (V0-2/J3/A3.2/J6/J7/dry-run/WA-0b): los aplica sendWhatsAppTemplate al
// recibir merchantId + log{customerId, relatedType:'albaran', relatedId}. Sin ventana 24h (SCRUM-50).
router.post('/:id/enviar-whatsapp', requireActivePlan, async (req, res) => {
  try {
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const { albaran } = found;
    if (albaran.estado !== 'firmado') {
      return res.status(409).json({ error: 'albaran_no_firmado', message: 'Solo se puede enviar un albarán firmado.' });
    }
    if (!albaran.jobId) return res.status(409).json({ error: 'albaran_sin_trabajo' });

    // Cliente vía el Trabajo (tenancy en ambos findFirst, regla 2)
    const job = await prisma.job.findFirst({
      where: { id: albaran.jobId, merchantId: req.merchantId },
      select: { id: true, customerId: true, titulo: true },
    });
    if (!job) return res.status(404).json({ error: 'not_found' });
    const customer = await prisma.customer.findFirst({
      where: { id: job.customerId, merchantId: req.merchantId },
      select: { id: true, name: true, phone: true },
    });
    const to = normalizePhone(customer?.phone || '');
    if (!to) {
      return res.status(409).json({ error: 'sin_telefono', message: 'Este cliente no tiene WhatsApp guardado.' });
    }

    // PDF firmado → bytes → media_id. Con la 48 el PDF es auth-only, por eso media_id y no link.
    const { diskPath, numero } = await ensureAlbaranPdf(albaran.id);
    const buffer = await fs.promises.readFile(diskPath);
    const mediaId = await uploadWhatsAppMedia({ buffer, filename: `${numero}.pdf`, mime: 'application/pdf' });
    if (!mediaId) {
      return res.status(502).json({ ok: false, error: 'media_upload_failed', message: 'No se pudo preparar el PDF para WhatsApp. Inténtalo de nuevo.' });
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
      merchantId: req.merchantId,
      templateName: msg.templateName,
      languageCode: msg.languageCode,
      components: msg.components,
      log: { customerId: customer?.id ?? null, relatedType: 'albaran', relatedId: albaran.id },
    });

    if (!result?.ok) {
      // Guard/Meta rechazó: 200 + ok:false con mensaje legible (patrón del resend de invoices).
      const legible: Record<string, string> = {
        wa_opt_out: 'El cliente se dio de baja de WhatsApp.',
        demo_safe_numbers: 'En modo demo solo se envía a números autorizados.',
        daily_cap: 'Se alcanzó el tope diario de mensajes de WhatsApp.',
        customer_daily_cap: 'Este cliente ya recibió el máximo de mensajes por hoy.',
        not_configured: 'WhatsApp no está configurado.',
      };
      return res.status(200).json({
        ok: false,
        error: result?.reason || 'send_failed',
        message: legible[result?.reason] || 'No se pudo enviar por WhatsApp.',
      });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/enviar-whatsapp]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

// src/modules/jobs/app/routes/albaranes.routes.ts — SCRUM-14 (ALBARAN-1)
// Acciones sobre un albarán existente (el create vive en POST /admin/jobs/:id/albaranes).
// Documento NO FISCAL (regla 24): nada de facturación/VeriFactu aquí. Tenancy SIEMPRE
// findFirst { id, merchantId } → 404 (regla 2). Editable hasta 'firmado' (409 albaran_locked).
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { recordAudit, requestIp } from '../../../system/audit.service';
import { requireActivePlan } from '../../../../core/http/authMiddleware'; // SCRUM-47 (S1: enviar WA ✅ técnico, sin requireRole)
import { sendAlbaranFirmadoWhatsApp, sendAlbaranParaFirmarWhatsApp, type AlbaranFirmadoSendResult } from '../../domain/albaranWhatsApp.service'; // SCRUM-47/49
import { sendSuccessBody, sendFailureBody, type SendFailureReason } from '../../../../lib/sendOutcome'; // SCRUM-126
import {
  ALBARAN_MODOS_VALORACION,
  buildFirmaEvidencia,
  canTransitionAlbaran,
  ensureAlbaranPdf,
  serializeAlbaran,
  validarLineas,
  type AlbaranModoValoracion,
} from '../../domain/albaran.service';
import { getPendientesFacturar } from '../../domain/pendientesFacturar.service'; // SCRUM-69

const router = Router();

// GET /admin/albaranes/pendientes-facturar — SCRUM-69 (FACT-1): bandeja "pendientes de
// facturar" agrupada por cliente y mes natural, con semáforo de plazo legal (art. 13 RD
// 1619/2012). Solo lectura, mismo nivel de acceso que ver facturas (TECNICO_ALLOWED).
// Colección (no :id) — registrada antes de las rutas de un albarán suelto a propósito,
// aunque hoy no colisiona con ninguna (no hay GET '/:id' de un solo segmento en este router).
router.get('/pendientes-facturar', async (req, res) => {
  try {
    const clientes = await getPendientesFacturar(req.merchantId!, prisma);
    res.json({ clientes });
  } catch (err: any) {
    console.error('[GET /admin/albaranes/pendientes-facturar]', err?.message || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

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

    // SCRUM-65: el modo de valoración se puede cambiar SOLO en 'borrador' (congelado
    // desde 'emitido', mismo espíritu que el resto del documento).
    let modoEfectivo: AlbaranModoValoracion =
      albaran.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR';
    if (req.body?.modoValoracion !== undefined) {
      if (albaran.estado !== 'borrador') {
        return res.status(409).json({
          error: 'albaran_locked',
          message: 'El modo de valoración solo se puede cambiar mientras el albarán está en borrador.',
        });
      }
      const m = String(req.body.modoValoracion);
      if (!ALBARAN_MODOS_VALORACION.includes(m as AlbaranModoValoracion)) {
        return res.status(400).json({ error: 'modo_valoracion_invalido' });
      }
      modoEfectivo = m as AlbaranModoValoracion;
      data.modoValoracion = modoEfectivo;
      cambios.push('modoValoracion');
    }

    if (req.body?.lineas !== undefined) {
      const v = validarLineas(req.body.lineas, modoEfectivo);
      if (!v.ok) return res.status(400).json({ error: 'lineas_invalidas', message: v.error });
      data.lineas = v.lineas;
      cambios.push('lineas');
    } else if (data.modoValoracion !== undefined) {
      // Cambia el modo sin mandar líneas nuevas: revalidar las EXISTENTES contra el
      // modo nuevo (evita dejar un VALORADO con líneas sin precio, o viceversa).
      const v = validarLineas(albaran.lineas, modoEfectivo);
      if (!v.ok) {
        return res.status(400).json({
          error: 'lineas_invalidas',
          message: `Las líneas actuales no encajan con el nuevo modo: ${v.error}`,
        });
      }
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
    // SCRUM-68: sella evidencias (canal in situ, sin token). ip/ua se guardan pero NUNCA
    // se exponen (serializeAlbaran no los saca; el PDF solo pinta hash/firmante/canal).
    const evidencia = await buildFirmaEvidencia({
      albaran,
      canal: 'in_situ',
      ip: requestIp(req),
      ua: (req.headers['user-agent'] as string) || null,
      tokenId: null,
      firmadoAt,
    });
    const updated = await prisma.albaran.update({
      where: { id: albaran.id },
      data: { estado: 'firmado', signatureUrl: signatureData, firmadoAt, evidenciaFirma: evidencia as any },
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

// SCRUM-126: traduce el resultado interno del servicio (ok/status) al contrato de cable
// (ok/sent) — ver src/lib/sendOutcome.ts para los 4 niveles. `status` distingue
// PRECONDICIÓN (404/409, nunca se intentó, sin `sent`) de ENVÍO INTENTADO (siempre 200).
function sendResultJson(res: import('express').Response, r: AlbaranFirmadoSendResult) {
  if (r.ok) return res.json(sendSuccessBody());
  if (r.status === 200) {
    return res.status(200).json(sendFailureBody(r.reason as SendFailureReason, { message: r.message }));
  }
  return res.status(r.status).json({ ok: false, error: r.reason, message: r.message });
}

// POST /admin/albaranes/:id/enviar-whatsapp — SCRUM-47: envía la copia FIRMADA al WhatsApp
// del cliente (plantilla `albaran_firmado_es` con el PDF en la cabecera de documento).
// MANUAL (decisión del fundador). S1: "enviar WA" es capacidad de técnico → requireActivePlan,
// SIN requireRole (coherente con /admin/quotes/:id/send-whatsapp). Solo desde 'firmado'.
// Guards completos (V0-2/J3/A3.2/J6/J7/dry-run/WA-0b): los aplica sendWhatsAppTemplate al
// recibir merchantId + log{customerId, relatedType:'albaran', relatedId}. Sin ventana 24h (SCRUM-50).
router.post('/:id/enviar-whatsapp', requireActivePlan, async (req, res) => {
  try {
    // Tenancy (regla 2): findAlbaran garantiza que el albarán es del merchant de la sesión.
    const found = await findAlbaran(req);
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    // La lógica de envío vive en el servicio (reutilizada por el auto-envío de la firma remota, SCRUM-49).
    const r = await sendAlbaranFirmadoWhatsApp(found.albaran.id);
    return sendResultJson(res, r);
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/enviar-whatsapp]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/albaranes/:id/enviar-para-firmar — SCRUM-49: manda al cliente el link para FIRMAR
// a distancia (plantilla albaran_para_firmar_es, botón URL → /albaran/:token). Solo desde 'emitido'.
// MANUAL. S1: "enviar WA" ✅ técnico → requireActivePlan, sin requireRole (como el de la 47).
router.post('/:id/enviar-para-firmar', requireActivePlan, async (req, res) => {
  try {
    const found = await findAlbaran(req); // tenancy (regla 2)
    if (!found.ok) return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    const r = await sendAlbaranParaFirmarWhatsApp(found.albaran.id);
    return sendResultJson(res, r);
  } catch (err: any) {
    console.error('[POST /admin/albaranes/:id/enviar-para-firmar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

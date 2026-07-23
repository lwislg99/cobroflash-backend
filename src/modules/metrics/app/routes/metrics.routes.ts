import { Router } from 'express';
import { getHomeMetrics, getFunnelMetrics, getServiceMetrics, getTeamMetrics, getPlatformFunnel, getOperariosMetrics } from '../../domain/metrics.service';
import { requireRole } from '../../../../core/http/authMiddleware';
import { getWhatsAppMetrics } from '../../../messaging/domain/whatsappLog.service';
import { prisma } from '../../../../core/db/prisma';
import { isVerifiedPlatformOwner } from '../../../../core/config/env';

const router = Router();

router.get('/home', async (req, res) => {
  try {
    const metrics = await getHomeMetrics(req.merchantId);
    return res.json(metrics);
  } catch (err) {
    console.error('[GET /admin/metrics/home]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/funnel', async (req, res) => {
  try {
    const metrics = await getFunnelMetrics(req.merchantId);
    return res.json(metrics);
  } catch (err) {
    console.error('[GET /admin/metrics/funnel]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/services', async (req, res) => {
  try {
    const metrics = await getServiceMetrics(req.merchantId);
    return res.json(metrics);
  } catch (err) {
    console.error('[GET /admin/metrics/services]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// V0-3: funnel de plataforma — SOLO cuentas owner; el resto recibe 403.
// SCRUM-102: dos factores (email en OWNER_EMAILS + Merchant.isPlatformOwner en BD).
router.get('/platform-funnel', async (req, res) => {
  try {
    const m = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { email: true, isPlatformOwner: true },
    });
    if (!isVerifiedPlatformOwner(m)) return res.status(403).json({ error: 'forbidden' });

    return res.json(await getPlatformFunnel());
  } catch (err) {
    console.error('[GET /admin/metrics/platform-funnel]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// J8: métricas de coste y entrega de WhatsApp del merchant (mes en curso)
router.get('/whatsapp', async (req, res) => {
  try {
    return res.json(await getWhatsAppMetrics(req.merchantId));
  } catch (err) {
    console.error('[GET /admin/metrics/whatsapp]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/team', async (req, res) => {
  try {
    const metrics = await getTeamMetrics(req.merchantId);
    return res.json(metrics);
  } catch (err) {
    console.error('[GET /admin/metrics/team]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// SCRUM-24 (OPERARIO-3): resumen de supervisión por operario. SOLO Admin — el gate va
// aquí, en el BACKEND (regla S3), además de estar en ADMIN_ONLY_ROUTES para que la suite
// A12.4 exija 403 al técnico. Ocultar el nav en el front es UX, no seguridad.
router.get('/operarios', requireRole('admin'), async (req, res) => {
  try {
    return res.json(await getOperariosMetrics(req.merchantId));
  } catch (err) {
    console.error('[GET /admin/metrics/operarios]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

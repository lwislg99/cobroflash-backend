import { Router } from 'express';
import { getHomeMetrics, getFunnelMetrics, getServiceMetrics, getTeamMetrics, getPlatformFunnel } from '../../domain/metrics.service';
import { prisma } from '../../../../core/db/prisma';
import { isOwnerEmail } from '../../../../core/config/env';

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

// V0-3: funnel de plataforma — SOLO cuentas owner (OWNER_EMAILS); el resto recibe 403.
router.get('/platform-funnel', async (req, res) => {
  try {
    const m = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { email: true },
    });
    if (!m || !isOwnerEmail(m.email)) return res.status(403).json({ error: 'forbidden' });

    return res.json(await getPlatformFunnel());
  } catch (err) {
    console.error('[GET /admin/metrics/platform-funnel]', err);
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

export default router;

import { Router } from 'express';
import { getHomeMetrics, getFunnelMetrics, getServiceMetrics } from '../../domain/metrics.service';

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

export default router;

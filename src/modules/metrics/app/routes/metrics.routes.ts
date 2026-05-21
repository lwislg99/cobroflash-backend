import { Router } from 'express';
import { getHomeMetrics } from '../../domain/metrics.service';

const router = Router();

router.get('/home', async (_req, res) => {
  try {
    const metrics = await getHomeMetrics();
    return res.json(metrics);
  } catch (err) {
    console.error('[GET /admin/metrics/home]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

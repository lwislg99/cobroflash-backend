// srcNew/modules/system/app/routes/health.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { config } from '../../../../core/config/env';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: 'yaqu-backend',
      // SCRUM-45: mismo BUILD_ID que GET /version (antes: '0.1.0' hardcodeada y desincronizada)
      version: config.BUILD_ID,
      db: 'up',
    });
  } catch {
    res
      .status(500)
      .json({ ok: false, service: 'yaqu-backend', db: 'down' });
  }
});

export default router;

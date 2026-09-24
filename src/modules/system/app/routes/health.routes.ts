// srcNew/modules/system/app/routes/health.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { config } from '../../../../core/config/env';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    // SCRUM-789 · el tiempo de SU PROPIO `SELECT 1`: la latencia app→base de producción (RTT), el
    // número que decide si el límite de emisiones simultáneas es urgente o teórico. Se mide aquí en
    // vez de pedirle al fundador que ejecute nada contra producción. Solo un número: cero PII.
    const desde = process.hrtime.bigint();
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Math.round(Number(process.hrtime.bigint() - desde) / 1e5) / 10;
    res.json({
      ok: true,
      service: 'yaqu-backend',
      // SCRUM-45: mismo BUILD_ID que GET /version (antes: '0.1.0' hardcodeada y desincronizada)
      version: config.BUILD_ID,
      db: 'up',
      dbMs,
    });
  } catch {
    res
      .status(500)
      .json({ ok: false, service: 'yaqu-backend', db: 'down' });
  }
});

export default router;

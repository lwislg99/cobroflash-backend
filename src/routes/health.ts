import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'cobroflash-backend', version: '0.1.0', db: 'up' });
  } catch {
    res.status(500).json({ ok: false, service: 'cobroflash-backend', db: 'down' });
  }
});

export default router;

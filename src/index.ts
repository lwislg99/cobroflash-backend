import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 3000);

// Healthcheck con ping a DB
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'cobroflash-backend', version: '0.1.0', db: 'up' });
  } catch (e) {
    res.status(500).json({ ok: false, service: 'cobroflash-backend', db: 'down' });
  }
});

app.listen(PORT, () => {
  console.log(`CobroFlash API listening on http://localhost:${PORT}`);
});

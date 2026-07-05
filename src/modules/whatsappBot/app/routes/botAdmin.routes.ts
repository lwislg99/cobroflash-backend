// src/modules/whatsappBot/app/routes/botAdmin.routes.ts — A8.3 (BOT-1/K1)
// Handoffs PENDIENTES del bot para el BO: sesiones en state='handoff' vivas
// (el bot está mudo 24 h y el cliente espera que el pro le escriba).
// Solo lectura, merchant-scoped (regla 2: filtra por req.merchantId).
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { normalizePhone } from '../../../../core/utils/utils';

const router = Router();

// GET /admin/bot/handoffs → [{ phone, name, customerId, since, context }]
router.get('/handoffs', async (req, res) => {
  try {
    const sessions = await prisma.botSession.findMany({
      where: { merchantId: req.merchantId, state: 'handoff', expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    if (!sessions.length) return res.json([]);

    // Nombre del cliente por teléfono (las fichas guardan con o sin '+')
    const phones = sessions.flatMap((s) => [s.phone, `+${s.phone}`]);
    const customers = await prisma.customer.findMany({
      where: { merchantId: req.merchantId, phone: { in: phones } },
      select: { id: true, name: true, phone: true },
    });
    const byPhone = new Map(customers.map((c) => [normalizePhone(c.phone || ''), c]));

    return res.json(sessions.map((s) => {
      const cust = byPhone.get(s.phone);
      return {
        phone: s.phone,
        name: cust?.name || null,
        customerId: cust?.id || null,
        since: s.updatedAt,
        // Qué estaba haciendo al pedir humano (data.lastAction, A8.1)
        context: (s.data as any)?.lastAction || null,
      };
    }));
  } catch (err: any) {
    console.error('[GET /admin/bot/handoffs]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

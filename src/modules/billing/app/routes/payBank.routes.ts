// srcNew/modules/billing/app/routes/payBank.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';

const router = Router();

router.get('/bank/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  const charge = await prisma.charge.findUnique({ where: { id } });
  if (!charge) return res.status(404).send('Cobro no encontrado');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Pagar — Cobro ${id}</title>
<style>body{font-family:system-ui;margin:0;background:#f6f7f9;padding:2rem;color:#111}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.25rem;max-width:720px;margin:0 auto}
.btn{background:#111;color:#fff;padding:.6rem 1rem;border-radius:.6rem;border:none;cursor:pointer;text-decoration:none;display:inline-block}
a{color:#2563eb}
</style>
</head>
<body>
  <div class="card">
    <h2>Pago por banco</h2>
    <p>Vas a pagar <b>${esc(charge.amount.toString())} ${esc(charge.currency)}</b> (Cobro #${id}).</p>
    <p style="opacity:.8">* En producción: Pay-by-Bank / SEPA Inst o botón del PSP.</p>

    <form method="post" action="${BASE_URL}/dev/sim/pay/${id}" style="margin:.75rem 0">
      <button class="btn">🔧 Simular pago SCTinst (dev)</button>
    </form>

    <p><a href="${BASE_URL}/recibo/${id}">Volver al recibo</a></p>
  </div>
</body></html>`);
});

export default router;

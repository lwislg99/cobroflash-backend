import { Router } from 'express';
import { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, ensurePortalToken } from '../../customerAdmin';
import { config } from '../../../../core/config/env';
import { customerCreateSchema, customerUpdateSchema } from '../../../../core/validation/schemas';
import { prisma } from '../../../../core/db/prisma';
import { listCustomerEvents } from '../../customerEvents.service';
import { requireRole } from '../../../../core/http/authMiddleware'; // SCRUM-55 (D2: borrado = admin)

const router = Router();

router.get('/', async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const customers = await listCustomers(req.merchantId, search);
    res.json(customers);
  } catch (err) {
    console.error('[GET /admin/customers]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    const customer = await getCustomer(req.merchantId, id);
    if (!customer) return res.status(404).json({ error: 'not_found' });
    res.json(customer);
  } catch (err) {
    console.error('[GET /admin/customers/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = customerCreateSchema.parse(req.body);
    const customer = await createCustomer(req.merchantId, parsed);
    res.status(201).json(customer);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('[POST /admin/customers]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    const parsed = customerUpdateSchema.parse(req.body);
    await updateCustomer(req.merchantId, id, parsed);
    const updated = await getCustomer(req.merchantId, id);
    res.json(updated);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('[PUT /admin/customers/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/customers/:id/portal-url — genera token si no existe, devuelve URL del portal
router.get('/:id/portal-url', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    const token = await ensurePortalToken(req.merchantId, id);
    const portalUrl = `${config.PUBLIC_BASE_URL}/cliente/${token}`;
    return res.json({ portalUrl, token });
  } catch (err: any) {
    if (err.message === 'customer_not_found') return res.status(404).json({ error: 'not_found' });
    console.error('[GET /admin/customers/:id/portal-url]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/customers/import — importación masiva desde CSV (parseo en cliente, batch en servidor)
router.post('/import', async (req, res) => {
  try {
    const rows: Array<{ name?: string; phone?: string; email?: string; notes?: string }> =
      Array.isArray(req.body?.customers) ? req.body.customers : [];

    if (rows.length === 0) return res.status(400).json({ error: 'no_data' });
    if (rows.length > 500)  return res.status(400).json({ error: 'too_many_rows', max: 500 });

    const merchantId = req.merchantId;
    let created = 0, skipped = 0, errors = 0;
    const errorList: string[] = [];

    for (const row of rows) {
      const name = String(row.name || '').trim();
      if (!name) { errors++; continue; }

      const phone = row.phone ? String(row.phone).trim() : null;
      const email = row.email ? String(row.email).trim().toLowerCase() : null;
      const notes = row.notes ? String(row.notes).trim() : null;

      try {
        // Dedup: si ya existe un cliente con el mismo teléfono o email → skip
        if (phone || email) {
          const existing = await prisma.customer.findFirst({
            where: {
              merchantId,
              OR: [
                ...(phone ? [{ phone }] : []),
                ...(email ? [{ email }] : []),
              ],
            },
          });
          if (existing) { skipped++; continue; }
        }

        await prisma.customer.create({ data: { merchantId, name, phone, email, notes } });
        created++;
      } catch (e: any) {
        errors++;
        errorList.push(`${name}: ${e?.message?.slice(0, 80)}`);
      }
    }

    return res.json({ ok: true, created, skipped, errors, errorList: errorList.slice(0, 10) });
  } catch (err) {
    console.error('[POST /admin/customers/import]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/customers/:id/detail — vista 360: historial completo del cliente
router.get('/:id/detail', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const customer = await prisma.customer.findFirst({
      where: { id, merchantId: req.merchantId },
      select: { id: true, name: true, phone: true, email: true, notes: true, portalToken: true, createdAt: true, waOptOut: true },
    });
    if (!customer) return res.status(404).json({ error: 'not_found' });

    const [quotes, invoices, expenses, events] = await Promise.all([
      prisma.quote.findMany({
        where: { customerId: id, merchantId: req.merchantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, quoteNumber: true, status: true, total: true, currency: true, createdAt: true, acceptedAt: true },
      }),
      prisma.invoice.findMany({
        where: { customerId: id, merchantId: req.merchantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, number: true, status: true, total: true, currency: true, createdAt: true, paidAt: true, pdfUrl: true },
      }),
      prisma.expense.aggregate({
        where: { merchantId: req.merchantId, quote: { customerId: id } },
        _sum: { amount: true },
      }),
      listCustomerEvents(req.merchantId, id, 50),
    ]);

    const totalBilled = invoices.reduce((a, i) => a + Number(i.total), 0);
    const totalPaid   = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + Number(i.total), 0);
    const portalUrl   = customer.portalToken
      ? `${config.PUBLIC_BASE_URL}/cliente/${customer.portalToken}`
      : null;

    return res.json({
      customer: { ...customer, portalUrl },
      quotes,
      invoices,
      events,
      stats: {
        totalQuotes:   quotes.length,
        acceptedQuotes: quotes.filter(q => q.status === 'accepted').length,
        totalBilled,
        totalPaid,
        totalExpenses: Number(expenses._sum.amount ?? 0),
        profit: totalPaid - Number(expenses._sum.amount ?? 0),
      },
    });
  } catch (err) {
    console.error('[GET /admin/customers/:id/detail]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// SCRUM-55 (D2 del fundador): borrado DURO (`customer.deleteMany`) e irreversible,
// que además arrastra el historial del cliente → admin. AA1.4 lo lista como stop
// condition ("datos de clientes: export/borrado").
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    await deleteCustomer(req.merchantId, id);
    res.status(204).send();
  } catch (err) {
    console.error('[DELETE /admin/customers/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

import { Router } from 'express';
import { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, ensurePortalToken } from '../../customerAdmin';
import { config } from '../../../../core/config/env';
import { customerCreateSchema, customerUpdateSchema } from '../../../../core/validation/schemas';
import { prisma } from '../../../../core/db/prisma';

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

// GET /admin/customers/:id/detail — vista 360: historial completo del cliente
router.get('/:id/detail', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const customer = await prisma.customer.findFirst({
      where: { id, merchantId: req.merchantId },
      select: { id: true, name: true, phone: true, email: true, notes: true, portalToken: true, createdAt: true },
    });
    if (!customer) return res.status(404).json({ error: 'not_found' });

    const [quotes, invoices, expenses] = await Promise.all([
      prisma.quote.findMany({
        where: { customerId: id, merchantId: req.merchantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, status: true, total: true, currency: true, createdAt: true, acceptedAt: true },
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

router.delete('/:id', async (req, res) => {
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

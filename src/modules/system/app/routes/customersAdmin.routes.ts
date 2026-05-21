import { Router } from 'express';
import { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } from '../../customerAdmin';
import { customerCreateSchema, customerUpdateSchema } from '../../../../core/validation/schemas';

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

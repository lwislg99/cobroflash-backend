// src/modules/system/app/routes/customersAdmin.routes.ts
import { Router } from 'express';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../../customerAdmin';
import {
  customerCreateSchema,
  customerUpdateSchema,
} from '../../../../core/validation/schemas';




const router = Router();

/**
 * GET /admin/customers?search=texto
 * Lista clientes, opcionalmente filtrando por texto libre.
 */
router.get('/', async (req, res) => {
  try {
    const search = req.query.search
      ? String(req.query.search)
      : undefined;

    const customers = await listCustomers(search);
    res.json(customers);
  } catch (err) {
    console.error('[GET /admin/customers]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/customers/:id
 * Obtiene un cliente concreto.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const customer = await getCustomer(id);
    if (!customer) {
      return res.status(404).json({ error: 'not_found' });
    }

    res.json(customer);
  } catch (err) {
    console.error('[GET /admin/customers/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/customers
 * Crea un cliente nuevo.
 */

router.post('/', async (req, res) => {
    try {
      const parsed = customerCreateSchema.parse(req.body);
      const customer = await createCustomer(parsed);
      res.status(201).json(customer);
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return res
          .status(400)
          .json({ error: 'validation_error', details: err.errors });
      }
      console.error('[POST /admin/customers]', err);
      res.status(500).json({ error: 'internal_error' });
    }
  });

/**
 * PUT /admin/customers/:id
 * Actualiza un cliente existente.
 */
router.put('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'invalid_id' });
      }
  
      const parsed = customerUpdateSchema.parse(req.body);
      const customer = await updateCustomer(id, parsed);
      res.json(customer);
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return res
          .status(400)
          .json({ error: 'validation_error', details: err.errors });
      }
      console.error('[PUT /admin/customers/:id]', err);
      res.status(500).json({ error: 'internal_error' });
    }
  });

/**
 * DELETE /admin/customers/:id
 * Borra un cliente.
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    await deleteCustomer(id);
    res.status(204).send(); // sin cuerpo
  } catch (err) {
    console.error('[DELETE /admin/customers/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

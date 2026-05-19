// src/modules/products/app/routes/products.routes.ts
import { Router } from 'express';

import {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  searchProducts,
  exportProductsCsv,
  importProductsCsv,
} from '../../domain/products.service';



const router = Router();

// (MVP) stub para verificar wiring
router.get('/ping', (_req, res) => {
  return res.json({ ok: true, module: 'products' });
});


// AUTOCOMPLETE: /admin/products/autocomplete?merchantId=1&q=cam
router.get('/autocomplete', async (req, res) => {
  try {
    const merchantId = Number(req.query.merchantId);
    if (!merchantId) {
      return res.status(400).json({ ok: false, error: 'merchantId_required' });
    }

    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ ok: true, items: [] });
    }

    const items = await searchProducts(merchantId, q);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('[GET /admin/products/autocomplete]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});


router.get('/', async (req, res) => {
  try {
    const merchantId = Number(req.query.merchantId);
    if (!merchantId) {
      return res.status(400).json({ ok: false, error: 'merchantId_required' });
    }

    const items = await listProducts(merchantId);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('[GET /admin/products]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// EXPORT: /admin/products/export?merchantId=1
router.get('/export', async (req, res) => {
  try {
    const merchantId = Number(req.query.merchantId);
    if (!merchantId) {
      return res.status(400).json({ ok: false, error: 'merchantId_required' });
    }

    const csv = await exportProductsCsv(merchantId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[GET /admin/products/export]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// IMPORT (stub): /admin/products/import?merchantId=1
// Body: { csv: "name;description;price;vat;isActive\n..." }
router.post('/import', async (req, res) => {
  try {
    const merchantId = Number(req.query.merchantId ?? req.body?.merchantId);
    if (!merchantId) {
      return res.status(400).json({ ok: false, error: 'merchantId_required' });
    }

    const csv = String(req.body?.csv || '').trim();
    if (!csv) {
      return res.status(400).json({ ok: false, error: 'csv_required' });
    }

    // Stub: todavía NO parseamos ni importamos
    const result = await importProductsCsv(merchantId, csv);

    return res.status(200).json({
      ok: true,
      merchantId,
      inserted: result.inserted,
      skippedDuplicates: result.skippedDuplicates ?? 0,
    });
  } catch (err) {
    console.error('[POST /admin/products/import]', err);
    const msg = err instanceof Error ? err.message : String(err || '');
    if (msg === 'invalid_header') {
      return res.status(400).json({ ok: false, error: 'invalid_header' });
    }
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const merchantId = Number(req.query.merchantId);
    if (!merchantId) {
      return res.status(400).json({ ok: false, error: 'merchantId_required' });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    const item = await getProductById(merchantId, id);
    if (!item) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    return res.json({ ok: true, item });
  } catch (err) {
    console.error('[GET /admin/products/:id]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});



router.put('/:id', async (req, res) => {
  try {
    const merchantId = Number(req.query.merchantId);
    if (!merchantId) {
      return res.status(400).json({ ok: false, error: 'merchantId_required' });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    const body = req.body || {};
    const patch: any = {};

    if (typeof body.name !== 'undefined') {
      if (!body.name || typeof body.name !== 'string') {
        return res.status(400).json({ ok: false, error: 'name_invalid' });
      }
      patch.name = body.name;
    }

    if (typeof body.description !== 'undefined') {
      patch.description = body.description === null ? null : String(body.description);
    }

    if (typeof body.price !== 'undefined') {
      const n = Number(body.price);
      if (Number.isNaN(n)) return res.status(400).json({ ok: false, error: 'price_invalid' });
      if (n <= 0) return res.status(400).json({ ok: false, error: 'price_invalid' });
      patch.price = n;
    }

    if (typeof body.cost !== 'undefined') {
      patch.cost = body.cost === null ? null : Number(body.cost);
    
      if (patch.cost !== null && Number.isNaN(patch.cost)) {
        return res.status(400).json({ ok: false, error: 'cost_invalid' });
      }
    
      if (patch.cost !== null && patch.cost < 0) {
        return res.status(400).json({ ok: false, error: 'cost_invalid' });
      }
    }
    

    if (typeof body.vat !== 'undefined') {
      patch.vat = body.vat === null ? null : Number(body.vat);
    
      if (patch.vat !== null && Number.isNaN(patch.vat)) {
        return res.status(400).json({ ok: false, error: 'vat_invalid' });
      }
    
      if (patch.vat !== null && (patch.vat < 0 || patch.vat > 1)) {
        return res.status(400).json({ ok: false, error: 'vat_invalid' });
      }
    }
    
    

    if (typeof body.isActive !== 'undefined') {
      patch.isActive = Boolean(body.isActive);
    }

    if (typeof body.providerId !== 'undefined') {
      patch.providerId = body.providerId === null ? null : Number(body.providerId);

      if (patch.providerId !== null && !Number.isFinite(patch.providerId)) {
        return res.status(400).json({ ok: false, error: 'providerId_invalid' });
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ ok: false, error: 'empty_update' });
    }

    const updated = await updateProduct(merchantId, id, patch);
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[PUT /admin/products/:id]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});



router.delete('/:id', async (req, res) => {
  try {
    const merchantId = Number(req.query.merchantId);
    if (!merchantId) {
      return res.status(400).json({ ok: false, error: 'merchantId_required' });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    const deleted = await deleteProduct(merchantId, id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    return res.json({ ok: true, deleted });
  } catch (err) {
    console.error('[DELETE /admin/products/:id]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});



router.post('/', async (req, res) => {
  try {
    const merchantId = Number(req.query.merchantId ?? req.body?.merchantId);

    if (!merchantId) {
      return res.status(400).json({ ok: false, error: 'merchantId_required' });
    }

    const { name, description, price, cost, vat, providerId, isActive } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, error: 'name_required' });
    }
    if (price === undefined || price === null || Number.isNaN(Number(price))) {
      return res.status(400).json({ ok: false, error: 'price_required' });
    }

    const priceNum = Number(price);
if (priceNum <= 0) {
  return res.status(400).json({ ok: false, error: 'price_invalid' });
}

if (vat !== undefined && vat !== null) {
  const v = Number(vat);
  if (Number.isNaN(v) || v < 0 || v > 1) {
    return res.status(400).json({ ok: false, error: 'vat_invalid' });
  }
}

if (cost !== undefined && cost !== null) {
  const c = Number(cost);
  if (Number.isNaN(c) || c < 0) {
    return res.status(400).json({ ok: false, error: 'cost_invalid' });
  }
}

if (providerId !== undefined && providerId !== null) {
  const p = Number(providerId);
  if (!Number.isFinite(p)) {
    return res.status(400).json({ ok: false, error: 'providerId_invalid' });
  }
}


const created = await createProduct(merchantId, {
  name,
  description,
  price: Number(price),
  cost: cost === undefined || cost === null ? null : Number(cost),
  vat: vat === undefined || vat === null ? null : Number(vat),
  providerId: providerId === undefined || providerId === null ? null : Number(providerId),
  isActive: isActive === undefined ? true : Boolean(isActive),
});

    return res.status(201).json({ ok: true, item: created });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'name_duplicate' });
    }
  
    console.error('[POST /admin/products]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});


export default router;

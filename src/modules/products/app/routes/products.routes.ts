import { Router } from 'express';
import {
  createProduct, listProducts, getProductById, updateProduct,
  deleteProduct, searchProducts, exportProductsCsv, importProductsCsv,
} from '../../domain/products.service';

const router = Router();

router.get('/ping', (_req, res) => res.json({ ok: true, module: 'products' }));

router.get('/autocomplete', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ ok: true, items: [] });
    const items = await searchProducts(req.merchantId, q);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('[GET /admin/products/autocomplete]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const csv = await exportProductsCsv(req.merchantId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[GET /admin/products/export]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/import', async (req, res) => {
  try {
    const csv = String(req.body?.csv || '').trim();
    if (!csv) return res.status(400).json({ ok: false, error: 'csv_required' });
    const result = await importProductsCsv(req.merchantId, csv);
    return res.status(200).json({ ok: true, inserted: result.inserted, skippedDuplicates: result.skippedDuplicates ?? 0 });
  } catch (err) {
    console.error('[POST /admin/products/import]', err);
    const msg = err instanceof Error ? err.message : String(err || '');
    if (msg === 'invalid_header') return res.status(400).json({ ok: false, error: 'invalid_header' });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const items = await listProducts(req.merchantId);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('[GET /admin/products]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });
    const item = await getProductById(req.merchantId, id);
    if (!item) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, item });
  } catch (err) {
    console.error('[GET /admin/products/:id]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, price, cost, vat, providerId, isActive } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ ok: false, error: 'name_required' });
    if (price == null || Number.isNaN(Number(price))) return res.status(400).json({ ok: false, error: 'price_required' });
    const priceNum = Number(price);
    if (priceNum <= 0) return res.status(400).json({ ok: false, error: 'price_invalid' });
    const created = await createProduct(req.merchantId, {
      name, description,
      price: priceNum,
      cost: cost == null ? null : Number(cost),
      vat: vat == null ? null : Number(vat),
      providerId: providerId == null ? null : Number(providerId),
      isActive: isActive === undefined ? true : Boolean(isActive),
    });
    return res.status(201).json({ ok: true, item: created });
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ ok: false, error: 'name_duplicate' });
    console.error('[POST /admin/products]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });
    const body = req.body || {};
    const patch: any = {};
    if (body.name !== undefined)       patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.price !== undefined)      patch.price = Number(body.price);
    if (body.cost !== undefined)       patch.cost = body.cost == null ? null : Number(body.cost);
    if (body.vat !== undefined)        patch.vat  = body.vat  == null ? null : Number(body.vat);
    if (body.isActive !== undefined)   patch.isActive = Boolean(body.isActive);
    if (body.providerId !== undefined) patch.providerId = body.providerId == null ? null : Number(body.providerId);
    if (Object.keys(patch).length === 0) return res.status(400).json({ ok: false, error: 'empty_update' });
    const updated = await updateProduct(req.merchantId, id, patch);
    if (!updated) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[PUT /admin/products/:id]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });
    const deleted = await deleteProduct(req.merchantId, id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, deleted });
  } catch (err) {
    console.error('[DELETE /admin/products/:id]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;

import { Router } from 'express';
import { createProvider, listProviders, updateProvider, deleteProvider, findProviderByName } from '../../domain/providers.service';

const router = Router();

router.get('/ping', (_req, res) => res.json({ ok: true, module: 'providers' }));

router.get('/', async (req, res) => {
  try {
    const items = await listProviders(req.merchantId);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('[GET /admin/providers]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, notes, isActive } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ ok: false, error: 'name_required' });
    const safeName = String(name).trim();
    const existing = await findProviderByName(req.merchantId, safeName);
    if (existing) return res.status(409).json({ ok: false, error: 'name_duplicate' });
    const created = await createProvider(req.merchantId, {
      name: safeName,
      phone: phone == null ? null : String(phone),
      email: email == null ? null : String(email),
      notes: notes == null ? null : String(notes),
      isActive: isActive === undefined ? true : Boolean(isActive),
    });
    return res.status(201).json({ ok: true, item: created });
  } catch (err) {
    console.error('[POST /admin/providers]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });
    const body = req.body || {};
    const patch: any = {};
    if (body.name !== undefined) {
      const safeName = String(body.name).trim();
      const existing = await findProviderByName(req.merchantId, safeName);
      if (existing && existing.id !== id) return res.status(409).json({ ok: false, error: 'name_duplicate' });
      patch.name = safeName;
    }
    if (body.phone !== undefined)    patch.phone    = body.phone    == null ? null : String(body.phone);
    if (body.email !== undefined)    patch.email    = body.email    == null ? null : String(body.email);
    if (body.notes !== undefined)    patch.notes    = body.notes    == null ? null : String(body.notes);
    if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
    if (Object.keys(patch).length === 0) return res.status(400).json({ ok: false, error: 'empty_update' });
    const updated = await updateProvider(req.merchantId, id, patch);
    if (!updated) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[PUT /admin/providers/:id]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });
    const deleted = await deleteProvider(req.merchantId, id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, deleted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (msg === 'provider_in_use') return res.status(409).json({ ok: false, error: 'provider_in_use' });
    console.error('[DELETE /admin/providers/:id]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;

import { Router } from 'express';
import { createProvider, listProviders, updateProvider, deleteProvider, findProviderByName } from '../../domain/providers.service';
import { validarNifEspanol } from '../../../../core/validation/nifEspanol';

const router = Router();

/**
 * SCRUM-960 · El NIF del proveedor, con la validación QUE YA EXISTE.
 *
 * `validarNifEspanol` es la misma de `schemas.ts:583` (la ficha de cliente) y la misma con la que
 * la lectura de tickets descarta un NIF mal leído (`lecturaTicket.ts:243`). No se estrena aquí una
 * segunda regla: dos validaciones del mismo dato divergen, y entonces el mismo NIF es válido en una
 * pantalla e inválido en otra.
 *
 * 🔴 VACÍO SIGUE SIENDO VÁLIDO, por la misma razón que en la ficha de cliente: validar no es
 * obligar. Un proveedor sin NIF es un estado legítimo —los que ya están dados de alta no lo
 * tienen— y `null` es cómo se dice «no consta». Solo se rechaza un NIF ESCRITO que no cuadra.
 *
 * El código de error es el MISMO literal que ya usa el esquema del cliente, `taxId_invalido`: es
 * un código estable, no prosa. Lo que lee el profesional lo pone la pantalla y lo firma el
 * fundador (regla 30); aquí solo viaja el motivo.
 *
 * @returns `{ ok: true, valor }` con el valor listo para la base, o `{ ok: false }` si no cuadra.
 */
function nifParaGuardar(bruto: unknown): { ok: true; valor: string | null } | { ok: false } {
  if (bruto === null) return { ok: true, valor: null };
  const texto = String(bruto).trim();
  if (texto === '') return { ok: true, valor: null };
  if (!validarNifEspanol(texto).valido) return { ok: false };
  return { ok: true, valor: texto };
}

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
    const { name, phone, email, notes, taxId, isActive } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ ok: false, error: 'name_required' });
    const safeName = String(name).trim();
    // SCRUM-960 · se comprueba ANTES de mirar el duplicado y antes de crear nada: un alta que
    // devolviera 201 con el NIF tirado es justo el defecto que este ticket viene a cerrar.
    const nif = taxId === undefined ? { ok: true as const, valor: null } : nifParaGuardar(taxId);
    if (!nif.ok) return res.status(400).json({ ok: false, error: 'taxId_invalido' });
    const existing = await findProviderByName(req.merchantId, safeName);
    if (existing) return res.status(409).json({ ok: false, error: 'name_duplicate' });
    const created = await createProvider(req.merchantId, {
      name: safeName,
      phone: phone == null ? null : String(phone),
      email: email == null ? null : String(email),
      notes: notes == null ? null : String(notes),
      taxId: nif.valor,
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
    // SCRUM-960 · corregir un NIF mal tecleado es el caso que hoy no tiene puerta. `taxId: null` o
    // `""` lo dejan sin constar: borrar un dato que se puso por error también es corregirlo.
    if (body.taxId !== undefined) {
      const nif = nifParaGuardar(body.taxId);
      if (!nif.ok) return res.status(400).json({ ok: false, error: 'taxId_invalido' });
      patch.taxId = nif.valor;
    }
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

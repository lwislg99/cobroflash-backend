import { Router } from 'express';
import {
  createProduct, listProducts, getProductById, updateProduct,
  deleteProduct, searchProducts, exportProductsCsv, importProductsCsv,
} from '../../domain/products.service';
import { prisma } from '../../../../core/db/prisma';
import { getTradeCatalog } from '../../../../core/data/tradeCatalogs';
import { getCatalogFile, midPrice, orientativoLabel } from '../../../../core/data/catalogLoader';
import { getLocale } from '../../../../core/i18n/locales';
import { requireRole } from '../../../../core/http/authMiddleware';
import { conceptosFrecuentes, VENTANA_DIAS } from '../../domain/frequentConcepts'; // SCRUM-162

const router = Router();

router.get('/ping', (_req, res) => res.json({ ok: true, module: 'products' }));

// Precargar catálogo de servicios típicos por oficio (onboarding).
// Idempotente: solo carga si el merchant tiene menos de 2 productos.
// A17.1 (ONBOARD-2): para España manda data/catalogs/{gremio}.json (schema del
// master, precios ORIENTATIVOS etiquetados, borrador hasta validación) y además
// siembra las plantillas frecuentes del gremio; LATAM sigue con el catálogo TS.
router.post('/load-catalog', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { country: true, trade: true },
    });
    if (!merchant) return res.status(404).json({ ok: false, error: 'merchant_not_found' });

    const trade = String(req.body?.trade || merchant.trade || '').toLowerCase();
    if (!trade) return res.status(400).json({ ok: false, error: 'trade_required' });

    const existingCount = await prisma.product.count({ where: { merchantId: req.merchantId } });
    if (existingCount >= 2) {
      return res.json({ ok: true, inserted: 0, skipped: 'already_has_products' });
    }

    const vat = getLocale(merchant.country).defaultVat;
    const country = (merchant.country || 'ES').toUpperCase();
    const file = country === 'ES' ? getCatalogFile(trade) : null;
    let inserted = 0;
    let templates = 0;

    if (file) {
      const priceOf = new Map<string, number>();
      for (const item of file.items) {
        const price = midPrice(item);
        priceOf.set(item.nombre, price);
        try {
          await createProduct(req.merchantId, {
            name: item.nombre,
            description: orientativoLabel(item), // etiqueta VISIBLE (spec)
            price,
            vat,
          });
          inserted++;
        } catch (e: any) {
          if (e?.code !== 'P2002') throw e; // duplicado → idempotente
        }
      }

      // Plantillas frecuentes del gremio (3-5) sobre el sistema existente —
      // solo si el merchant aún no tiene ninguna (mismo espíritu idempotente).
      const existingTpl = await prisma.quoteTemplate.count({ where: { merchantId: req.merchantId } });
      if (existingTpl === 0 && Array.isArray(file.plantillas)) {
        for (const tpl of file.plantillas) {
          const lines = tpl.lines
            .map((l) => ({
              concept: l.concept,
              qty: l.qty,
              price: priceOf.get(l.priceFrom) ?? 0,
              tax: vat,
            }))
            .filter((l) => l.price > 0);
          if (!lines.length) continue;
          await prisma.quoteTemplate.create({
            data: {
              merchantId: req.merchantId,
              name: tpl.nombre,
              currency: 'EUR',
              lines: lines as any,
              paymentTerms: tpl.paymentTerms ?? null,
            },
          });
          templates++;
        }
      }

      return res.json({
        ok: true, inserted, templates,
        source: 'data/catalogs', status: file.status, // borrador visible aguas arriba
      });
    }

    // Fallback (LATAM o gremio sin fichero): catálogo TS clásico
    const items = getTradeCatalog(trade, merchant.country);
    if (!items.length) {
      return res.json({ ok: true, inserted: 0, skipped: 'no_catalog_for_trade' });
    }
    for (const item of items) {
      try {
        await createProduct(req.merchantId, {
          name: item.name,
          description: item.description ?? null,
          price: item.price,
          vat,
        });
        inserted++;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }

    return res.json({ ok: true, inserted, source: 'legacy' });
  } catch (err) {
    console.error('[POST /admin/products/load-catalog]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

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

// SCRUM-162 — los conceptos que ESTE merchant repite de verdad, sacados de sus presupuestos.
// Vive junto al autocompletado porque alimenta el mismo campo, aunque el dato no salga del
// catálogo sino de `Quote.lines`: no hay contador en el esquema y, medido, no hace falta.
// La lista viene VACÍA mientras no haya señal suficiente (umbral en `conceptosFrecuentes`),
// y vacío significa que el front no enseña nada — nunca «enseña lo que haya».
router.get('/frequent-concepts', async (req, res) => {
  try {
    const desde = new Date(Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000);
    // Regla 2: SIEMPRE acotado al tenant. Y acotado también en el tiempo: la ventana se
    // aplica en la consulta además de en la función pura, para no traerse a memoria un
    // histórico entero el día que lo haya.
    const presupuestos = await prisma.quote.findMany({
      where: { merchantId: req.merchantId, createdAt: { gte: desde } },
      select: { lines: true, createdAt: true },
      orderBy: { id: 'desc' },
      take: 500,
    });
    return res.json({ ok: true, items: conceptosFrecuentes(presupuestos) });
  } catch (err) {
    console.error('[GET /admin/products/frequent-concepts]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// SCRUM-103: EXPORT del tarifario completo. S1 marca los exports como ❌ para Técnico
// y el resto ya estaban cerrados (/admin/exports/*.csv); esta se quedó fuera y siguió
// aparcada en PENDIENTE_CLASIFICAR con una "duda" que decía, ella misma, que S1 ya lo
// había decidido. La cazó el assert 2 de SCRUM-103 sobre datos reales — segundo caso
// del patrón de metrics/team, no un sabotaje de prueba.
router.get('/export', requireRole('admin'), async (req, res) => {
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

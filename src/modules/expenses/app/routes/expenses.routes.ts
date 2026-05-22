import { Router } from 'express';
import {
  listExpenses, createExpense, updateExpense, deleteExpense,
  getExpenseSummary, getQuoteMargin, EXPENSE_CATEGORIES,
} from '../../domain/expenses.service';

const router = Router();

// GET /admin/expenses?month=2026-05&category=materiales&quoteId=5
router.get('/', async (req, res) => {
  try {
    const { month, category, quoteId } = req.query;
    const items = await listExpenses(req.merchantId, {
      month:    month    ? String(month)    : undefined,
      category: category ? String(category) : undefined,
      quoteId:  quoteId  ? Number(quoteId)  : undefined,
    });
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('[GET /admin/expenses]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/expenses/summary?month=2026-05
router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month ? String(req.query.month) : undefined;
    const summary = await getExpenseSummary(req.merchantId, month);
    return res.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[GET /admin/expenses/summary]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/expenses/categories
router.get('/categories', (_req, res) => {
  return res.json({ ok: true, categories: EXPENSE_CATEGORIES });
});

// GET /admin/expenses/margin/:quoteId
router.get('/margin/:quoteId', async (req, res) => {
  try {
    const quoteId = Number(req.params.quoteId);
    if (!Number.isFinite(quoteId)) return res.status(400).json({ error: 'invalid_id' });
    const margin = await getQuoteMargin(req.merchantId, quoteId);
    if (!margin) return res.status(404).json({ error: 'quote_not_found' });
    return res.json({ ok: true, ...margin });
  } catch (err) {
    console.error('[GET /admin/expenses/margin/:quoteId]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/expenses
router.post('/', async (req, res) => {
  try {
    const { quoteId, providerId, concept, amount, currency, category, date, notes, receiptData } = req.body || {};
    if (!concept || typeof concept !== 'string') return res.status(400).json({ error: 'concept_required' });
    if (amount == null || Number.isNaN(Number(amount))) return res.status(400).json({ error: 'amount_required' });
    if (Number(amount) <= 0) return res.status(400).json({ error: 'amount_invalid' });

    const expense = await createExpense(req.merchantId, {
      quoteId:    quoteId    ? Number(quoteId)    : null,
      providerId: providerId ? Number(providerId) : null,
      concept:    String(concept).trim(),
      amount:     Number(amount),
      currency:   currency ? String(currency).toUpperCase() : undefined,
      category:   category ? String(category) as any : undefined,
      date:       date     ? new Date(date) : undefined,
      notes:      notes    ? String(notes) : null,
      receiptData: receiptData ? String(receiptData) : null,
    });
    return res.status(201).json({ ok: true, item: expense });
  } catch (err) {
    console.error('[POST /admin/expenses]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /admin/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
    const { concept, amount, currency, category, date, notes, quoteId, providerId, receiptData } = req.body || {};
    const patch: any = {};
    if (concept     !== undefined) patch.concept     = String(concept).trim();
    if (amount      !== undefined) patch.amount      = Number(amount);
    if (currency    !== undefined) patch.currency    = String(currency).toUpperCase();
    if (category    !== undefined) patch.category    = String(category);
    if (date        !== undefined) patch.date        = new Date(date);
    if (notes       !== undefined) patch.notes       = notes ? String(notes) : null;
    if (quoteId     !== undefined) patch.quoteId     = quoteId ? Number(quoteId) : null;
    if (providerId  !== undefined) patch.providerId  = providerId ? Number(providerId) : null;
    if (receiptData !== undefined) patch.receiptData = receiptData ? String(receiptData) : null;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'empty_update' });
    const updated = await updateExpense(req.merchantId, id, patch);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[PUT /admin/expenses/:id]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /admin/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
    const deleted = await deleteExpense(req.merchantId, id);
    if (!deleted) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /admin/expenses/:id]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

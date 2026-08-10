import { Router } from 'express';
import {
  listExpenses, createExpense, updateExpense, deleteExpense,
  getExpenseSummary, getQuoteMargin, EXPENSE_CATEGORIES, ExpenseRefError,
} from '../../domain/expenses.service';
import { requireRole } from '../../../../core/http/authMiddleware';
import { prisma } from '../../../../core/db/prisma';
// SCRUM-324 (E3) · la regla fiscal vive en el dominio, no en cada pantalla que da de alta un gasto.
import { clasificarJustificante } from '../../domain/justificante';

const router = Router();

// SCRUM-107 (D del fundador): este router se PARTE POR VERBO, no se cierra en bloque.
// Crear un gasto es trabajo de campo (compra un codo de 12 € en el almacén y lo registra
// desde la furgoneta; cerrarlo le obliga a llamar al jefe). Leer el conjunto NO lo es:
// la lista completa, los totales del mes y el margen por presupuesto son economía del
// negocio. De ahí que POST y /categories queden abiertos y las cinco de lectura/escritura
// sobre gasto ajeno vayan a admin.
//
// PUT y DELETE son admin en V1 por una limitación de datos, no por criterio: Expense NO
// tiene campo de autoría (ni teamMemberId ni operarioId), así que no hay forma de
// distinguir "su gasto" del de un compañero. Abrirlos dejaría a cualquier técnico editar
// o borrar el gasto de otro. INCOHERENCIA ASUMIDA Y REPORTADA: puede crear el gasto pero
// no corregir el importe que tecleó mal — la fricción se traslada del alta a la
// corrección. Se levanta cuando exista el campo (ver el ticket de Expense.teamMemberId,
// bloqueante de la V2 con patrón row-level tipo SCRUM-23).

// SCRUM-135: referencia a una cotización/proveedor que no es de este merchant → 400, no 500.
// Es entrada inválida, no un fallo del servidor. El mensaje NO distingue "no existe" de "no
// es tuya" (ver assertRefsOwned): con el selector de Trabajos esto ya no debería verse nunca
// desde la UI — queda como red para llamadas directas al endpoint.
function refErrorBody(err: ExpenseRefError) {
  return {
    ok: false,
    error: err.code,
    message: err.code === 'quote_not_found'
      ? 'Ese trabajo no existe en tu cuenta.'
      : 'Ese proveedor no existe en tu cuenta.',
  };
}

// GET /admin/expenses?month=2026-05&category=materiales&quoteId=5
router.get('/', requireRole('admin'), async (req, res) => {
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
router.get('/summary', requireRole('admin'), async (req, res) => {
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
router.get('/margin/:quoteId', requireRole('admin'), async (req, res) => {
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
    const { quoteId, providerId, concept, amount, currency, category, date, notes, receiptData, nifProveedor } = req.body || {};
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
      // SCRUM-109: autoría — quien registra el gasto AHORA, no heredada de nada (a
      // diferencia de Job.operarioId, que se congela desde el presupuesto en el accept).
      teamMemberId: req.teamMemberId ?? null,
      nifProveedor: nifProveedor ? String(nifProveedor) : null,
    });

    // SCRUM-324 (E3) · el veredicto viaja CON el gasto recién creado.
    //
    // Se calcula aquí y no en el navegador porque es una regla fiscal: si viviera en el front,
    // cada pantalla que diera de alta un gasto tendría su propia copia y se desincronizarían — y el
    // día que difieran, una le diría a un profesional que puede deducir algo que no puede.
    //
    // El NIF se lee del PROVEEDOR, que es donde vive, y no de lo que acaba de teclear el usuario:
    // si el proveedor ya tenía uno, ese es el bueno (ver `guardarNifDelProveedor`).
    const proveedor = expense.providerId
      ? await prisma.provider.findFirst({
          where: { id: expense.providerId, merchantId: req.merchantId },
          select: { taxId: true },
        })
      : null;
    const justificante = clasificarJustificante({
      amount: expense.amount,
      date: expense.date,
      nifProveedor: proveedor?.taxId ?? null,
      vatRate: expense.vatRate,
      vatAmount: expense.vatAmount,
      providerInvoiceNumber: expense.providerInvoiceNumber,
      vatDeducible: expense.vatDeducible,
    });
    return res.status(201).json({ ok: true, item: expense, justificante });
  } catch (err) {
    if (err instanceof ExpenseRefError) return res.status(400).json(refErrorBody(err));
    console.error('[POST /admin/expenses]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /admin/expenses/:id
router.put('/:id', requireRole('admin'), async (req, res) => {
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
    if (err instanceof ExpenseRefError) return res.status(400).json(refErrorBody(err));
    console.error('[PUT /admin/expenses/:id]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /admin/expenses/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
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

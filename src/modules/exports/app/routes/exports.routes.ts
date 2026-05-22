// src/modules/exports/app/routes/exports.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(',');
}

function parseDateFilter(q: Record<string, unknown>) {
  const from = q.from ? new Date(String(q.from)) : null;
  const to   = q.to   ? new Date(String(q.to))   : null;
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to };
}

function sendCsv(res: any, filename: string, header: string[], rows: string[]) {
  const bom  = '﻿'; // UTF-8 BOM para que Excel lo abra bien
  const body = [csvRow(header), ...rows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(bom + body);
}

// ── GET /admin/exports/invoices.csv ───────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|pending|paid|expired
router.get('/invoices.csv', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    const status = String(req.query.status || 'all');

    const where: any = { merchantId: req.merchantId };
    if (status !== 'all') where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to)   where.createdAt.lte = to;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, email: true } } },
    });

    const header = ['Número', 'Fecha', 'Cliente', 'Email cliente', 'Total', 'Moneda', 'Estado', 'Pagada en', 'VeriFactu'];
    const rows = invoices.map((inv) => csvRow([
      inv.number,
      inv.createdAt.toISOString().slice(0, 10),
      inv.customer?.name ?? '',
      inv.customer?.email ?? '',
      Number(inv.total).toFixed(2),
      inv.currency,
      inv.status,
      inv.paidAt ? inv.paidAt.toISOString().slice(0, 10) : '',
      inv.vfHash ? 'Sí' : 'No',
    ]));

    sendCsv(res, `facturas_${new Date().toISOString().slice(0,10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/invoices.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/expenses.csv ──────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=all|materiales|...
router.get('/expenses.csv', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    const category = String(req.query.category || 'all');

    const where: any = { merchantId: req.merchantId };
    if (category !== 'all') where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to)   where.date.lte = to;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        quote:    { select: { id: true } },
        provider: { select: { name: true } },
      },
    });

    const header = ['Fecha', 'Concepto', 'Categoría', 'Importe', 'Moneda', 'Proveedor', 'Presupuesto ID', 'Notas'];
    const rows = expenses.map((e) => csvRow([
      new Date(e.date).toISOString().slice(0, 10),
      e.concept,
      e.category,
      Number(e.amount).toFixed(2),
      e.currency,
      e.provider?.name ?? '',
      e.quote?.id ?? '',
      e.notes ?? '',
    ]));

    sendCsv(res, `gastos_${new Date().toISOString().slice(0,10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/expenses.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/quotes.csv ─────────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|draft|sent|accepted|rejected
router.get('/quotes.csv', async (req, res) => {
  try {
    const { from, to } = parseDateFilter(req.query as any);
    const status = String(req.query.status || 'all');

    const where: any = { merchantId: req.merchantId };
    if (status !== 'all') where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to)   where.createdAt.lte = to;
    }

    const quotes = await prisma.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, email: true, phone: true } } },
    });

    const header = ['ID', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Total', 'Moneda', 'Estado', 'Aceptada en', 'Condiciones de pago'];
    const rows = quotes.map((q) => csvRow([
      q.id,
      q.createdAt.toISOString().slice(0, 10),
      q.customer?.name ?? '',
      q.customer?.email ?? '',
      q.customer?.phone ?? '',
      Number(q.total).toFixed(2),
      q.currency,
      q.status,
      q.acceptedAt ? q.acceptedAt.toISOString().slice(0, 10) : '',
      (q as any).paymentTerms ?? '',
    ]));

    sendCsv(res, `presupuestos_${new Date().toISOString().slice(0,10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/quotes.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

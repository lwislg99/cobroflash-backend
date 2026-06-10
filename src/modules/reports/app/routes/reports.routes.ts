// src/modules/reports/app/routes/reports.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { calcVatBreakdown } from '../../../invoicing/domain/vat.service';

const router = Router();

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/**
 * GET /admin/reports/pl?year=2026
 * Devuelve los 12 meses del año con:
 *   ingresos (facturas pagadas), gastos, beneficio neto
 * Además totales anuales y variación respecto al año anterior.
 */
router.get('/pl', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const merchantId = req.merchantId;

    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31, 23, 59, 59, 999);
    const prevStart = new Date(year - 1, 0, 1);
    const prevEnd   = new Date(year - 1, 11, 31, 23, 59, 59, 999);

    // Facturas pagadas del año
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        merchantId,
        status: 'paid',
        paidAt: { gte: yearStart, lte: yearEnd },
      },
      select: { paidAt: true, total: true, currency: true },
    });

    // Gastos del año
    const expenses = await prisma.expense.findMany({
      where: {
        merchantId,
        date: { gte: yearStart, lte: yearEnd },
      },
      select: { date: true, amount: true },
    });

    // Facturas pagadas año anterior (para comparación)
    const prevInvoices = await prisma.invoice.aggregate({
      where: { merchantId, status: 'paid', paidAt: { gte: prevStart, lte: prevEnd } },
      _sum: { total: true },
    });
    const prevExpenses = await prisma.expense.aggregate({
      where: { merchantId, date: { gte: prevStart, lte: prevEnd } },
      _sum: { amount: true },
    });

    // Agrupar por mes (0-11)
    const monthlyRevenue = Array(12).fill(0);
    const monthlyExpenses = Array(12).fill(0);
    let currency = 'EUR';

    for (const inv of paidInvoices) {
      const m = new Date(inv.paidAt!).getMonth();
      monthlyRevenue[m] += Number(inv.total);
      if (inv.currency) currency = inv.currency;
    }
    for (const exp of expenses) {
      const m = new Date(exp.date).getMonth();
      monthlyExpenses[m] += Number(exp.amount);
    }

    const months = MONTHS_ES.map((label, i) => ({
      month: i + 1,
      label,
      revenue:  Math.round(monthlyRevenue[i]  * 100) / 100,
      expenses: Math.round(monthlyExpenses[i] * 100) / 100,
      profit:   Math.round((monthlyRevenue[i] - monthlyExpenses[i]) * 100) / 100,
    }));

    const totalRevenue  = monthlyRevenue.reduce((a, b) => a + b, 0);
    const totalExpenses = monthlyExpenses.reduce((a, b) => a + b, 0);
    const totalProfit   = totalRevenue - totalExpenses;

    const prevRev = Number(prevInvoices._sum.total ?? 0);
    const prevExp = Number(prevExpenses._sum.amount ?? 0);

    return res.json({
      year,
      currency,
      months,
      totals: {
        revenue:  Math.round(totalRevenue  * 100) / 100,
        expenses: Math.round(totalExpenses * 100) / 100,
        profit:   Math.round(totalProfit   * 100) / 100,
      },
      prevYear: {
        revenue:  Math.round(prevRev * 100) / 100,
        expenses: Math.round(prevExp * 100) / 100,
        profit:   Math.round((prevRev - prevExp) * 100) / 100,
      },
    });
  } catch (err) {
    console.error('[GET /admin/reports/pl]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/reports/vat?year=2026&quarter=2
 * Resumen de IVA REPERCUTIDO del trimestre (los datos que el profesional copia
 * en el modelo 303): base imponible y cuota por tipo de IVA, desde las líneas
 * de las facturas EMITIDAS en el trimestre (criterio de devengo = fecha de
 * emisión, independiente de si están cobradas). Las rectificativas (R1, líneas
 * en negativo) restan. Las facturas antiguas sin líneas no se pueden desglosar:
 * se excluyen del cuadro y se informan aparte (`excluded`).
 */
router.get('/vat', async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const qRaw = Number(req.query.quarter) || Math.floor(now.getMonth() / 3) + 1;
    const quarter = Math.min(4, Math.max(1, qRaw));

    const from = new Date(year, (quarter - 1) * 3, 1);
    const to   = new Date(year, quarter * 3, 0, 23, 59, 59, 999);

    const invoices = await prisma.invoice.findMany({
      where: {
        merchantId: req.merchantId,
        createdAt: { gte: from, lte: to },
      },
      select: { id: true, number: true, total: true, currency: true, lines: true, type: true },
    });

    const rateMap = new Map<number, { base: number; cuota: number }>();
    let currency = 'EUR';
    let excludedCount = 0;
    let excludedTotal = 0;

    for (const inv of invoices) {
      if (inv.currency) currency = inv.currency;
      const lines = Array.isArray(inv.lines) ? (inv.lines as any[]) : [];
      if (lines.length === 0) {
        excludedCount += 1;
        excludedTotal += Number(inv.total);
        continue;
      }
      for (const e of calcVatBreakdown(lines).entries) {
        const acc = rateMap.get(e.rate) ?? { base: 0, cuota: 0 };
        acc.base += e.base;
        acc.cuota += e.cuota;
        rateMap.set(e.rate, acc);
      }
    }

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const rates = [...rateMap.entries()]
      .map(([rate, v]) => ({ rate, base: r2(v.base), cuota: r2(v.cuota) }))
      .sort((a, b) => b.rate - a.rate);

    return res.json({
      year,
      quarter,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      currency,
      rates,
      totals: {
        base:  r2(rates.reduce((a, e) => a + e.base, 0)),
        cuota: r2(rates.reduce((a, e) => a + e.cuota, 0)),
      },
      invoiceCount: invoices.length,
      excluded: { count: excludedCount, total: r2(excludedTotal) },
    });
  } catch (err) {
    console.error('[GET /admin/reports/vat]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

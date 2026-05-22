// src/modules/reports/app/routes/reports.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';

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

export default router;

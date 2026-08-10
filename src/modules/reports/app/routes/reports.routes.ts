// src/modules/reports/app/routes/reports.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { desglosarPorEmpleado } from '../../domain/desgloseEmpleado'; // SCRUM-228
import { leerLibroRegistro } from '../../../invoicing/domain/libroRegistro.repo'; // SCRUM-389: un solo agregador
import { rangoTrimestre } from '../../../fiscal/modelo303/modelo303'; // SCRUM-389: un solo criterio de fechas

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
      select: { paidAt: true, total: true, currency: true,
        // SCRUM-228: `quoteId` distingue «no atribuible» (sin presupuesto) de «del propietario»
        // (presupuesto con `teamMemberId` null). Son cosas distintas y van a filas distintas.
        quoteId: true,
        // A15.3 (MANT-1): € cobrados que nacieron del ciclo de mantenimientos
        quote: { select: { origin: true, teamMemberId: true } } },
    });

    // Gastos del año
    const expenses = await prisma.expense.findMany({
      where: {
        merchantId,
        date: { gte: yearStart, lte: yearEnd },
      },
      // SCRUM-228: `teamMemberId` null = propietario (SCRUM-109), nunca «sin asignar».
      select: { date: true, amount: true, teamMemberId: true },
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
    const monthlyMaintenance = Array(12).fill(0); // A15.3
    let currency = 'EUR';

    for (const inv of paidInvoices) {
      const m = new Date(inv.paidAt!).getMonth();
      monthlyRevenue[m] += Number(inv.total);
      if (inv.quote?.origin === 'maintenance') monthlyMaintenance[m] += Number(inv.total);
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
      maintenance: Math.round(monthlyMaintenance[i] * 100) / 100, // A15.3
    }));

    const totalRevenue  = monthlyRevenue.reduce((a, b) => a + b, 0);
    const totalExpenses = monthlyExpenses.reduce((a, b) => a + b, 0);
    const totalProfit   = totalRevenue - totalExpenses;

    // ── SCRUM-228 · desglose por empleado ────────────────────────────────────────────────
    //
    // Se calcula sobre `paidInvoices` y `expenses`, que son EXACTAMENTE las listas de las que
    // salen los totales de arriba. No es una consulta paralela: si lo fuera, que las partes
    // sumen el total sería una coincidencia que se rompe el día que las dos consultas divergen.
    const [miembros, negocio] = await Promise.all([
      prisma.teamMember.findMany({ where: { merchantId }, select: { id: true, name: true } }),
      prisma.merchant.findUnique({ where: { id: merchantId }, select: { name: true } }),
    ]);
    const desglose = desglosarPorEmpleado({
      invoices: paidInvoices,
      expenses,
      miembros,
      // La fila del propietario lleva el nombre del NEGOCIO, igual que en Equipo.
      nombrePropietario: negocio?.name ?? 'Propietario',
    });

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
        maintenance: Math.round(monthlyMaintenance.reduce((a, b) => a + b, 0) * 100) / 100, // A15.3
      },
      byEmployee: desglose.filas,
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
 * GET /admin/reports/x2?year=YYYY — A16.1: las métricas X2 que FALTABAN
 * (tasa de aceptación, tiempo a decisión y top servicios ya viven en el funnel;
 * € de mantenimiento en /pl). Aquí: cobros por método · € generados por
 * recordatorios (pago ≤72h tras el recordatorio) · pendiente por antigüedad
 * (copy SIEMPRE neutro — prohibido "morosos", X2).
 */
router.get('/x2', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const merchantId = req.merchantId;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const paid = await prisma.invoice.findMany({
      where: { merchantId, status: 'paid', paidAt: { gte: yearStart, lte: yearEnd } },
      select: {
        total: true, paidAt: true,
        reminder7SentAt: true, reminder14SentAt: true,
        charge: { select: { method: true } },
      },
    });

    // Cobros por método (paid_via): charge.method; sin charge = marcado a mano
    const byMethodMap = new Map<string, { eur: number; count: number }>();
    let reminderEur = 0;
    const H72 = 72 * 3600 * 1000;
    for (const inv of paid) {
      const method = inv.charge?.method || 'manual';
      const cur = byMethodMap.get(method) ?? { eur: 0, count: 0 };
      cur.eur += Number(inv.total); cur.count += 1;
      byMethodMap.set(method, cur);
      // € por recordatorios: pagó ≤72h después de CUALQUIERA de los dos avisos.
      // ⚠️ SCRUM-117: `reminderXSentAt` solo significa «se envió» DESDE SCRUM-116 (deploy
      // 2026-07-23 15:22 UTC). Antes se marcaba aunque el WhatsApp fallara, así que una fecha
      // ANTERIOR a esa podría ser un recordatorio que nunca salió — y NO hay dato guardado para
      // distinguirlo (el fallo pre-116 no dejó rastro: ni WhatsAppMessage ni customerEvent). Se
      // evaluó un SUELO de fiabilidad en la lectura (contar solo `reminderXSentAt >= 2026-07-23`),
      // pero un COUNT read-only contra prod el 23-jul dio 0 filas pre-fix sumando aquí (0 €):
      // montar el suelo infra-reportaría PARA SIEMPRE una era vacía. Decisión (fundador):
      // documentar, sin suelo. Si algún día esta métrica abarca un periodo con volumen real
      // pre-116, reabrir SCRUM-117 (nulear el histórico NO es opción: es el candado del cron).
      const paidTs = inv.paidAt ? new Date(inv.paidAt).getTime() : 0;
      const after = (d: Date | null) => !!d && paidTs >= new Date(d).getTime() && paidTs - new Date(d).getTime() <= H72;
      if (after(inv.reminder7SentAt) || after(inv.reminder14SentAt)) reminderEur += Number(inv.total);
    }
    const byMethod = [...byMethodMap.entries()]
      .map(([method, v]) => ({ method, eur: Math.round(v.eur * 100) / 100, count: v.count }))
      .sort((a, b) => b.eur - a.eur);

    // Pendiente por antigüedad (foto de HOY, no del año)
    const pending = await prisma.invoice.findMany({
      where: { merchantId, status: 'pending' },
      select: { total: true, createdAt: true },
    });
    const buckets = [
      { bucket: '0-7', label: 'Menos de 7 días', maxDays: 7, count: 0, eur: 0 },
      { bucket: '8-30', label: '8-30 días', maxDays: 30, count: 0, eur: 0 },
      { bucket: '31-60', label: '31-60 días', maxDays: 60, count: 0, eur: 0 },
      { bucket: '60+', label: 'Más de 60 días', maxDays: Infinity, count: 0, eur: 0 },
    ];
    const now = Date.now();
    for (const inv of pending) {
      const days = (now - new Date(inv.createdAt).getTime()) / 86_400_000;
      const b = buckets.find((x) => days <= x.maxDays)!;
      b.count += 1; b.eur += Number(inv.total);
    }

    return res.json({
      year,
      byMethod,
      reminderEur: Math.round(reminderEur * 100) / 100,
      aging: buckets.map(({ bucket, label, count, eur }) => ({ bucket, label, count, eur: Math.round(eur * 100) / 100 })),
      pendingTotal: Math.round(pending.reduce((a, i) => a + Number(i.total), 0) * 100) / 100,
    });
  } catch (err) {
    console.error('[GET /admin/reports/x2]', err);
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

    // SCRUM-389 · el periodo lo fija `rangoTrimestre`, el MISMO que usa el 303. Antes se
    // construía aquí con las mismas dos líneas, y dos copias del mismo criterio de fechas es
    // exactamente cómo empiezan a discrepar dos cifras que deberían ser una.
    const { desde: from, hasta: to } = rangoTrimestre(year, quarter);

    // Y los euros salen del LIBRO (SCRUM-296), no de una lectura propia: es la única forma de
    // que Informes, el Libro y el 303 no puedan decir tres cifras distintas del mismo trimestre.
    const libro = await leerLibroRegistro(prisma, { merchantId: req.merchantId, desde: from, hasta: to });

    const rateMap = new Map<number, { base: number; cuota: number }>();
    let currency = 'EUR';
    let excludedCount = 0;
    let excludedTotal = 0;

    for (const a of libro.asientos) {
      if (a.moneda) currency = a.moneda;
      // Sin desglose no entra en el cuadro y se informa aparte — el mismo criterio de siempre.
      if (a.porTipo.length === 0) {
        excludedCount += 1;
        excludedTotal += a.total ?? 0;
        continue;
      }
      for (const e of a.porTipo) {
        const acc = rateMap.get(e.tipo) ?? { base: 0, cuota: 0 };
        acc.base += e.base;
        acc.cuota += e.cuota;
        rateMap.set(e.tipo, acc);
      }
    }

    // ⚠️ Las filas SIN NÚMERO cambian de sitio, y se dice: antes sus euros entraban en el cuadro
    // (el lector viejo no miraba el número); ahora el Libro las aparta, así que van al aviso de
    // «no incluidas», donde se pueden revisar a mano. Medido antes de tocar nada: con los datos
    // que el código puede producir hoy no existe ninguna —`formatInvoiceNumber` nunca devuelve
    // cadena vacía y los siete `invoice.create` del árbol sacan el número de
    // `allocateInvoiceNumber`—, así que ninguna cifra que el profesional haya visto cambia.
    excludedCount += libro.sinNumero;
    excludedTotal += libro.sinNumeroImporte;

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
      // `miradas` es lo que contaba `invoices.length`: TODAS las filas del periodo, entren o no
      // en el cuadro.
      invoiceCount: libro.miradas,
      excluded: { count: excludedCount, total: r2(excludedTotal) },
    });
  } catch (err) {
    console.error('[GET /admin/reports/vat]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

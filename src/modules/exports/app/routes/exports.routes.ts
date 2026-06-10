// src/modules/exports/app/routes/exports.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { calcVatBreakdown } from '../../../invoicing/domain/vat.service';

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

// ── GET /admin/exports/verifactu.xml ──────────────────────────────────────
// Registro de facturación RRSIF (VeriFactu, RD 1007/2023) del año pedido.
// Estructura inspirada en el XSD SuministroInformacion de la AEAT
// (RegistroFacturacionAlta: IDFactura, Desglose por tipo, CuotaTotal,
// Encadenamiento de huellas, Huella SHA-256). El ENVÍO telemático real al SIF
// requiere certificado digital del emisor — pendiente (tarea usuario).
router.get('/verifactu.xml', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchantId } });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });
    if (merchant.country !== 'ES' || !merchant.taxId) {
      return res.status(409).json({
        error: 'verifactu_not_applicable',
        message: 'VeriFactu solo aplica a negocios de España con NIF configurado (Ajustes → Datos fiscales).',
      });
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        merchantId: req.merchantId,
        createdAt: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59, 999),
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        customer:  { select: { name: true } },
        rectifies: { select: { number: true, createdAt: true } },
      },
    });

    const x = (v: unknown) =>
      String(v ?? '').replace(/[&<>"']/g, (s) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' } as any)[s]);
    const fechaES = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

    const nombreEmisor = merchant.legalName || merchant.name;
    const registros = invoices.map((inv) => {
      const lines = Array.isArray(inv.lines) ? (inv.lines as any[]) : [];
      const vat = calcVatBreakdown(lines);
      const desglose = vat.entries.map((e) => `
      <DetalleDesglose>
        <Impuesto>01</Impuesto>
        <TipoImpositivo>${e.rate}</TipoImpositivo>
        <BaseImponibleOimporteNoSujeto>${e.base.toFixed(2)}</BaseImponibleOimporteNoSujeto>
        <CuotaRepercutida>${e.cuota.toFixed(2)}</CuotaRepercutida>
      </DetalleDesglose>`).join('');

      const rectificadas = inv.type === 'R1' && inv.rectifies ? `
    <FacturasRectificadas>
      <IDFacturaRectificada>
        <IDEmisorFactura>${x(merchant.taxId)}</IDEmisorFactura>
        <NumSerieFactura>${x(inv.rectifies.number)}</NumSerieFactura>
        <FechaExpedicionFactura>${fechaES(inv.rectifies.createdAt)}</FechaExpedicionFactura>
      </IDFacturaRectificada>
    </FacturasRectificadas>` : '';

      const encadenamiento = inv.vfHash ? `
    <Encadenamiento>${inv.vfPrevHash && inv.vfPrevHash !== '0' ? `
      <RegistroAnterior><Huella>${x(inv.vfPrevHash)}</Huella></RegistroAnterior>` : `
      <PrimerRegistro>S</PrimerRegistro>`}
    </Encadenamiento>
    <TipoHuella>01</TipoHuella>
    <Huella>${x(inv.vfHash)}</Huella>` : '';

      return `
  <RegistroFacturacionAlta>
    <IDVersion>1.0</IDVersion>
    <IDFactura>
      <IDEmisorFactura>${x(merchant.taxId)}</IDEmisorFactura>
      <NumSerieFactura>${x(inv.number)}</NumSerieFactura>
      <FechaExpedicionFactura>${fechaES(inv.createdAt)}</FechaExpedicionFactura>
    </IDFactura>
    <NombreRazonEmisor>${x(nombreEmisor)}</NombreRazonEmisor>
    <TipoFactura>${inv.type === 'R1' ? 'R1' : 'F1'}</TipoFactura>${rectificadas}
    <DescripcionOperacion>${x(lines[0]?.concept || `Factura ${inv.number}`)}</DescripcionOperacion>
    <Destinatarios>
      <IDDestinatario><NombreRazon>${x(inv.customer?.name || 'Cliente')}</NombreRazon></IDDestinatario>
    </Destinatarios>
    <Desglose>${desglose || `
      <DetalleDesglose>
        <Impuesto>01</Impuesto>
        <TipoImpositivo>0</TipoImpositivo>
        <BaseImponibleOimporteNoSujeto>${Number(inv.total).toFixed(2)}</BaseImponibleOimporteNoSujeto>
        <CuotaRepercutida>0.00</CuotaRepercutida>
      </DetalleDesglose>`}
    </Desglose>
    <CuotaTotal>${vat.cuota.toFixed(2)}</CuotaTotal>
    <ImporteTotal>${Number(inv.total).toFixed(2)}</ImporteTotal>${encadenamiento}
    <SistemaInformatico><NombreSistemaInformatico>YaQu</NombreSistemaInformatico></SistemaInformatico>
    <FechaHoraHusoGenRegistro>${inv.createdAt.toISOString()}</FechaHoraHusoGenRegistro>
  </RegistroFacturacionAlta>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RegistrosFacturacion generadoPor="YaQu" ejercicio="${year}" fechaGeneracion="${new Date().toISOString()}">
  <Cabecera>
    <ObligadoEmision>
      <NombreRazon>${x(nombreEmisor)}</NombreRazon>
      <NIF>${x(merchant.taxId)}</NIF>
    </ObligadoEmision>
  </Cabecera>
${registros}
</RegistrosFacturacion>
`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="verifactu_${year}.xml"`);
    return res.send(xml);
  } catch (err) {
    console.error('[exports/verifactu.xml]', err);
    return res.status(500).json({ error: 'internal_error' });
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

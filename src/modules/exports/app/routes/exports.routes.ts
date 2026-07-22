// src/modules/exports/app/routes/exports.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { calcVatBreakdown } from '../../../invoicing/domain/vat.service';
import { config, isOwnerEmail } from '../../../../core/config/env';
import { isFlagEnabled } from '../../../../core/flags';
import { requireRole } from '../../../../core/http/authMiddleware';

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

// ── GET /admin/exports/customers.csv ──────────────────────────────────────
// A11.4 (RGPD/R11): "tus datos son tuyos" — clientes completos del merchant.
router.get('/customers.csv', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { merchantId: req.merchantId },
      orderBy: { createdAt: 'asc' },
    });
    const header = ['Nombre', 'Razón social', 'NIF/CIF', 'Teléfono', 'Email', 'Notas', 'Baja WhatsApp', 'Alta'];
    const rows = customers.map((c) => csvRow([
      c.name,
      (c as any).legalName ?? '',
      (c as any).taxId ?? '',
      c.phone ?? '',
      c.email ?? '',
      c.notes ?? '',
      c.waOptOut ? 'Sí' : 'No',
      c.createdAt.toISOString().slice(0, 10),
    ]));
    sendCsv(res, `clientes_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/customers.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

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

// ── GET /admin/exports/fees.csv ────────────────────────────────────────────
// C1-3 (CONNECT-1): contabilidad PROPIA de la plataforma — application fees
// (0,9 %, APPLICATION_FEE_BPS) de los cobros con tarjeta procesados vía
// Stripe Connect. SOLO cuentas owner (OWNER_EMAILS); el resto recibe 403.
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: mes en curso)
router.get('/fees.csv', async (req, res) => {
  try {
    const me = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { email: true },
    });
    if (!me || !isOwnerEmail(me.email)) return res.status(403).json({ error: 'forbidden' });

    let { from, to } = parseDateFilter(req.query as any);
    if (!from && !to) {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
    }

    // Cobros de TODA la plataforma pagados con tarjeta en la ventana; el marcador
    // de Connect es el evento card_session_created con payload.connect=true (C1-2).
    const charges = await prisma.charge.findMany({
      where: {
        status: 'paid',
        method: { contains: 'card' },
        updatedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
      },
      orderBy: { updatedAt: 'asc' },
      include: {
        merchant: { select: { name: true, legalName: true } },
        events: { where: { type: { in: ['card_session_created', 'paid'] } } },
      },
    });

    const feeOf = (amount: number) =>
      Math.round(Math.round(amount * 100) * config.APPLICATION_FEE_BPS / 10_000) / 100;

    const header = ['Fecha pago', 'Cobro #', 'Merchant', 'Concepto', 'Importe', 'Moneda', `Fee (${(config.APPLICATION_FEE_BPS / 100).toFixed(2).replace('.', ',')} %)`];
    let totalFees = 0;
    const rows: string[] = [];
    for (const ch of charges) {
      const viaConnect = (ch.events || []).some(
        (e) => e.type === 'card_session_created' && (e as any).payload?.connect === true,
      );
      if (!viaConnect) continue; // pagos en la cuenta de plataforma (demo/test): sin fee
      const paidEv = (ch.events || []).find((e) => e.type === 'paid');
      const amount = Number(ch.amount);
      const fee = feeOf(amount);
      totalFees += fee;
      rows.push(csvRow([
        (paidEv ? new Date((paidEv as any).ts ?? ch.updatedAt) : ch.updatedAt).toISOString().slice(0, 10),
        ch.id,
        ch.merchant?.legalName || ch.merchant?.name || ch.merchantId,
        ch.concept,
        amount.toFixed(2),
        ch.currency,
        fee.toFixed(2),
      ]));
    }
    rows.push(csvRow(['TOTAL', '', '', '', '', '', totalFees.toFixed(2)]));

    sendCsv(res, `fees_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  } catch (err) {
    console.error('[exports/fees.csv]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/exports/verifactu.xml ──────────────────────────────────────
// Registro de facturación RRSIF (VeriFactu, RD 1007/2023) del año pedido.
// Estructura inspirada en el XSD SuministroInformacion de la AEAT
// (RegistroFacturacionAlta: IDFactura, Desglose por tipo, CuotaTotal,
// Encadenamiento de huellas, Huella SHA-256). El ENVÍO telemático real al SIF
// requiere certificado digital del emisor — pendiente (tarea usuario).
// SCRUM-73: gateado a INVOICING_ES_ENABLED (regla 24/26) — con el flag OFF (hoy,
// pre-SIF-1) los merchants ES reales emiten justificantes (J-), no facturas
// fiscales; un XML VeriFactu construido sobre ese estado no representa registros
// válidos. 404 NEUTRO (no revela el motivo) y CERO registros generados — el
// gate va ANTES de tocar la BD de facturas. requireRole('admin'): exportar el
// registro fiscal no es acción de Técnico (S1, patrón SCRUM-54).
router.get('/verifactu.xml', requireRole('admin'), async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchantId } });
    if (!merchant) return res.status(404).json({ error: 'not_found' });
    if (!isFlagEnabled('INVOICING_ES_ENABLED', { merchant })) {
      return res.status(404).json({ error: 'not_found' });
    }
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

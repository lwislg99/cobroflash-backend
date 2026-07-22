// SCRUM-17 (FISCAL-2): factura recapitulativa con motor de rotura por mes natural.
//   Parte PURA (siempre): groupByRotura (rotura por mes), validarConsolidacion (cada código),
//   aritmética de totales en céntimos con IVA mixto.
//   Parte GATEADA (QA_DB_TEST=1): se añade con el endpoint (2 meses → 2 facturas, IVA mixto,
//   doble consolidación concurrente, TRABAJO_UNICO/SIN_VALORAR/receipt, tenancy).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  groupByRotura,
  validarConsolidacion,
  mesNaturalKey,
  mesNaturalLabel,
  calcAlbaranTotales,
} from '../dist/modules/jobs/domain/albaran.service.js';

// Fechas con el constructor LOCAL (año, mesIndex, día) para no depender de la zona horaria.
const mkAlb = (o = {}) => ({
  id: o.id ?? 1,
  numero: o.numero ?? 'ALB-2026-001',
  fecha: o.fecha ?? new Date(2026, 2, 10), // marzo
  estado: o.estado ?? 'firmado',
  modoValoracion: o.modoValoracion ?? 'VALORADO',
  invoiceId: o.invoiceId ?? null,
  customerId: o.customerId ?? 7,
});
const JOB = { tipoOperacion: 'OPERACIONES_SUELTAS', customerId: 7 };

// ── Rotura por mes natural ───────────────────────────────────────────────────
test('mesNaturalKey/Label: YYYY-MM y etiqueta legible', () => {
  assert.equal(mesNaturalKey(new Date(2026, 2, 1)), '2026-03');
  assert.equal(mesNaturalKey(new Date(2026, 11, 31)), '2026-12');
  assert.equal(mesNaturalLabel('2026-03'), 'marzo 2026');
  assert.equal(mesNaturalLabel('2026-12'), 'diciembre 2026');
});

test('groupByRotura: 2 meses distintos → 2 grupos ordenados por mes', () => {
  const g = groupByRotura([
    mkAlb({ id: 1, fecha: new Date(2026, 3, 5) }),  // abril
    mkAlb({ id: 2, fecha: new Date(2026, 2, 20) }), // marzo
    mkAlb({ id: 3, fecha: new Date(2026, 2, 1) }),  // marzo
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].mesKey, '2026-03');
  assert.equal(g[0].mesLabel, 'marzo 2026');
  assert.equal(g[0].albaranes.length, 2);
  assert.equal(g[1].mesKey, '2026-04');
  assert.equal(g[1].albaranes.length, 1);
});

test('groupByRotura: 1 mes → 1 grupo; vacío → []', () => {
  const g = groupByRotura([mkAlb({ id: 1 }), mkAlb({ id: 2, fecha: new Date(2026, 2, 28) })]);
  assert.equal(g.length, 1);
  assert.equal(g[0].albaranes.length, 2);
  assert.deepEqual(groupByRotura([]), []);
});

// ── Validación de consolidación (cada código de error) ───────────────────────
test('validarConsolidacion: caso feliz → ok', () => {
  assert.deepEqual(validarConsolidacion([mkAlb({ id: 1 }), mkAlb({ id: 2 })], JOB), { ok: true });
});

test('validarConsolidacion: selección vacía → seleccion_vacia', () => {
  const r = validarConsolidacion([], JOB);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'seleccion_vacia');
});

test('validarConsolidacion: TRABAJO_UNICO → consolidacion_no_aplica', () => {
  const r = validarConsolidacion([mkAlb()], { tipoOperacion: 'TRABAJO_UNICO', customerId: 7 });
  assert.equal(r.error, 'consolidacion_no_aplica');
});

test('validarConsolidacion: no firmado → albaran_no_firmado', () => {
  const r = validarConsolidacion([mkAlb({ estado: 'emitido' })], JOB);
  assert.equal(r.error, 'albaran_no_firmado');
  assert.match(r.message, /ALB-2026-001/);
});

test('validarConsolidacion: SIN_VALORAR → albaran_sin_precios', () => {
  const r = validarConsolidacion([mkAlb({ modoValoracion: 'SIN_VALORAR' })], JOB);
  assert.equal(r.error, 'albaran_sin_precios');
});

test('validarConsolidacion: ya facturado → albaran_ya_facturado', () => {
  const r = validarConsolidacion([mkAlb({ invoiceId: 99 })], JOB);
  assert.equal(r.error, 'albaran_ya_facturado');
});

test('validarConsolidacion: cliente distinto → cliente_mixto', () => {
  const r = validarConsolidacion([mkAlb({ customerId: 8 })], JOB);
  assert.equal(r.error, 'cliente_mixto');
});

// ── Totales en céntimos con IVA MIXTO (desglose, no rotura por IVA) ───────────
test('calcAlbaranTotales: líneas con IVA mixto suman en céntimos enteros', () => {
  // 2h mano de obra a 45€ (21%) + 1 material a 100€ (10%) → base 190, cuota 28.90, total 218.90
  const t = calcAlbaranTotales([
    { concepto: 'Mano de obra', cantidad: 2, unidad: 'h', precioUnitario: 45, tipoIva: 21 },
    { concepto: 'Material', cantidad: 1, unidad: 'ud', precioUnitario: 100, tipoIva: 10 },
  ]);
  assert.equal(t.base, 190);
  assert.equal(t.cuota, 28.9);
  assert.equal(t.total, 218.9);
  assert.equal(t.totalCents, 21890);
});

// ── Flujo HTTP real (gateado) ────────────────────────────────────────────────
const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-17: consolidar → rotura por mes (N facturas), IVA mixto, guards, tenancy', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  // Modo de emisión CONSISTENTE con allocateInvoiceNumber (que resuelve getEmissionMode sin ver
  // merchant.flags): país no-ES → 'fiscal'; país ES sin flag → 'receipt'. (El override por flag
  // NO llega a allocateInvoiceNumber — inconsistencia pre-existente reportada en el PR.)
  const mkMerchant = (tag, fiscal) =>
    prisma.merchant.create({
      data: {
        name: `QA S17 ${tag}`, country: fiscal ? 'PT' : 'ES', email: `qa-s17-${tag}-${stamp}@test.local`,
        onboardingCompleted: true, planExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
  const mA = await mkMerchant('A', true);   // fiscal (no-ES)
  const mR = await mkMerchant('R', false);  // receipt (ES sin flag)
  const mB = await mkMerchant('B', true);   // otro merchant (tenancy)

  const mkCtx = async (merchant, tipoOperacion = 'OPERACIONES_SUELTAS') => {
    const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: `Cli ${merchant.id}`, phone: `346${merchant.id}${stamp % 100000}` } });
    const job = await prisma.job.create({ data: { merchantId: merchant.id, customerId: customer.id, status: 'terminado', titulo: 'QA17', tipoOperacion } });
    return { customer, job };
  };
  const mkAlb = (merchant, job, numero, fecha, lineas, o = {}) =>
    prisma.albaran.create({ data: { merchantId: merchant.id, jobId: job.id, numero, fecha, lineas, estado: o.estado ?? 'firmado', modoValoracion: o.modo ?? 'VALORADO' } });
  const mkCookie = async (merchantId) => {
    const token = 'qa17-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({ data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    return (res.headers.get('set-cookie') || '').split(';')[0];
  };
  const post = (cookie, jobId, albaranIds) =>
    fetch(`${base}/admin/jobs/${jobId}/consolidar-albaranes`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ albaranIds }) });

  const merchantIds = [mA.id, mR.id, mB.id];
  try {
    const cookieA = await mkCookie(mA.id);

    // ── (1) HAPPY: 2 meses → 2 facturas; marzo con IVA MIXTO (21%+10%) ──────────
    const ctxA = await mkCtx(mA);
    const albMar = await mkAlb(mA, ctxA.job, `ALB-QA17M-${stamp}`, new Date(2026, 2, 10), [
      { concepto: 'Mano de obra', cantidad: 2, unidad: 'h', precioUnitario: 45, tipoIva: 21 },
      { concepto: 'Material', cantidad: 1, unidad: 'ud', precioUnitario: 100, tipoIva: 10 },
    ]);
    const albAbr = await mkAlb(mA, ctxA.job, `ALB-QA17A-${stamp}`, new Date(2026, 3, 5), [
      { concepto: 'Revisión', cantidad: 1, unidad: 'ud', precioUnitario: 200, tipoIva: 21 },
    ]);

    const r1 = await post(cookieA, ctxA.job.id, [albMar.id, albAbr.id]);
    assert.equal(r1.status, 201, `consolidar → 201 (fue ${r1.status})`);
    const body1 = await r1.json();
    assert.equal(body1.facturas.length, 2, 'rotura → 2 facturas (marzo + abril)');
    const fMar = body1.facturas.find((f) => f.mesLabel === 'marzo 2026');
    const fAbr = body1.facturas.find((f) => f.mesLabel === 'abril 2026');
    assert.ok(fMar && fAbr, 'una factura por mes');
    assert.equal(fMar.total, '218.90', 'marzo IVA mixto: 90*1.21 + 100*1.10 = 218.90');
    assert.equal(fAbr.total, '242.00', 'abril: 200*1.21 = 242.00');
    assert.match(fMar.number, /^\d{4}-/, 'número de serie FISCAL (no J-)');

    // albaranes marcados facturado + facturas con type F1 + albaranRefs
    const albMarDb = await prisma.albaran.findUnique({ where: { id: albMar.id }, select: { invoiceId: true } });
    assert.ok(albMarDb.invoiceId, 'albarán marzo quedó facturado (invoiceId)');
    const invMar = await prisma.invoice.findUnique({ where: { id: fMar.id }, select: { type: true, albaranRefs: true, number: true } });
    assert.equal(invMar.type, 'F1');
    assert.equal(invMar.albaranRefs.length, 1, 'albaranRefs referencia el albarán origen');
    assert.equal(invMar.albaranRefs[0].numero, albMar.numero);

    // ── (2) re-consolidar los mismos → 409 albaran_ya_facturado (anti doble) ────
    const rDup = await post(cookieA, ctxA.job.id, [albMar.id]);
    assert.equal(rDup.status, 409);
    assert.equal((await rDup.json()).error, 'albaran_ya_facturado');

    // ── (3) SIN_VALORAR → 400 albaran_sin_precios ─────────────────────────────
    const ctxSV = await mkCtx(mA);
    const albSV = await mkAlb(mA, ctxSV.job, `ALB-QA17SV-${stamp}`, new Date(2026, 2, 3), [{ concepto: 'X', cantidad: 1, unidad: 'ud' }], { modo: 'SIN_VALORAR' });
    const rSV = await post(cookieA, ctxSV.job.id, [albSV.id]);
    assert.equal(rSV.status, 400);
    assert.equal((await rSV.json()).error, 'albaran_sin_precios');

    // ── (4) TRABAJO_UNICO → 409 consolidacion_no_aplica ───────────────────────
    const ctxTU = await mkCtx(mA, 'TRABAJO_UNICO');
    const albTU = await mkAlb(mA, ctxTU.job, `ALB-QA17TU-${stamp}`, new Date(2026, 2, 4), [{ concepto: 'Y', cantidad: 1, unidad: 'ud', precioUnitario: 10, tipoIva: 21 }]);
    const rTU = await post(cookieA, ctxTU.job.id, [albTU.id]);
    assert.equal(rTU.status, 409);
    assert.equal((await rTU.json()).error, 'consolidacion_no_aplica');

    // ── (5) modo RECEIPT → 409 consolidacion_no_disponible ────────────────────
    const cookieR = await mkCookie(mR.id);
    const ctxR = await mkCtx(mR);
    const albR = await mkAlb(mR, ctxR.job, `ALB-QA17R-${stamp}`, new Date(2026, 2, 6), [{ concepto: 'Z', cantidad: 1, unidad: 'ud', precioUnitario: 10, tipoIva: 21 }]);
    const rR = await post(cookieR, ctxR.job.id, [albR.id]);
    assert.equal(rR.status, 409);
    assert.equal((await rR.json()).error, 'consolidacion_no_disponible');

    // ── (6) tenancy: merchant B no consolida el Job de A → 404 ────────────────
    const cookieB = await mkCookie(mB.id);
    const rTen = await post(cookieB, ctxA.job.id, [albMar.id]);
    assert.equal(rTen.status, 404, 'merchant B no accede al Job de A');

    console.log('✔ SCRUM-17: rotura 2 meses→2 facturas · IVA mixto 218.90 · refs · re-facturar 409 · SIN_VALORAR 400 · TRABAJO_UNICO 409 · receipt 409 · tenancy 404.');
  } finally {
    await prisma.invoice.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.albaran.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.job.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.customer.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.authSession.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    server.close();
    await prisma.$disconnect();
  }
});

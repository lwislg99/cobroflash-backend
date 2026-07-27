// scripts/e2e-critico.mjs — A12.3 (EXT3 Ola 12) · El botón "¿despliego tranquilo?"
//
// Recorre LA CADENA CRÍTICA de dinero de punta a punta con un merchant EFÍMERO
// (limpieza total al acabar; jamás ensucia el demo):
//   registro → onboarding (3 pasos UI) → catálogo/producto → presupuesto →
//   landing pública → firma del cliente → justificante (serie J) → pago (test)
//   → estados en BD → PDF regenerado on-demand.
//
//   npm run e2e:critico          (levanta la app in-process en puerto efímero)
//
// Notas honestas:
//  · WHATSAPP_DRY_RUN=1 forzado: cero mensajes reales (los guards se ejecutan).
//  · "Pago test": sin STRIPE de test disponible se simula el webhook
//    payment.confirmed de /webhooks/psp (la MISMA cadena post-pago que Stripe
//    dispara). Cuando el fundador ponga claves de test, este paso puede pasar
//    por Checkout real.
//  · Motor: puppeteer-core sobre el Edge instalado (mismo motor Chromium que
//    Playwright; sin dependencia nueva de navegador).
process.env.WHATSAPP_DRY_RUN = '1';
// Los self-calls internos (accept→/charges, Connect→/webhooks/psp) usan
// PUBLIC_BASE_URL: debe apuntar a ESTE server. Puerto fijo, antes de importar.
const E2E_PORT = Number(process.env.E2E_PORT || 3457);
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
globalThis.__waDryRunOutbox = [];

import puppeteer from 'puppeteer-core';
import { resumirErroresConsola } from './_console-guard.mjs'; // SCRUM-183
import crypto from 'node:crypto';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let step = 0;
const ok = (msg) => console.log(`  ✅ ${String(++step).padStart(2, '0')} ${msg}`);
const fail = (msg) => { console.error(`  ❌ ${msg}`); process.exitCode = 1; throw new Error(msg); };

const { prisma } = await import('../dist/core/db/prisma.js');
const { app } = await import('../dist/app.js');

const server = app.listen(E2E_PORT);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${E2E_PORT}`;
console.log(`e2e:critico contra ${base}\n`);

const stamp = Date.now();
let merchantId = null;
let browser = null;

try {
  // ── 1 · REGISTRO (la API real del formulario) ────────────────────────────
  const email = `e2e-${stamp}@test.local`;
  const reg = await fetch(`${base}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Fontanería', email, country: 'ES' }),
  });
  if (!reg.ok) fail(`registro devolvió ${reg.status}`);
  const merchant = await prisma.merchant.findUnique({ where: { email } });
  if (!merchant) fail('el registro no creó el merchant');
  merchantId = merchant.id;
  ok(`registro → merchant ${merchantId}`);

  // sesión (equivale al click del magic link del email)
  const token = 'e2e-' + crypto.randomBytes(12).toString('hex');
  await prisma.authSession.create({
    data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 900000) },
  });

  browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--disable-gpu', '--hide-scrollbars'] });
  const page = await browser.newPage();

  // SCRUM-183 · LA OREJA. Este recorrido ya abría las pantallas de verdad, pero NADIE escuchaba
  // la consola del navegador: un `ReferenceError` en la página aborta el render sin que ninguna
  // petición falle, así que el E2E pasaba por delante tan contento. Así llegó SCRUM-139 F6 a
  // producción con su TDZ (`plantillasRotulo` leída ~1.700 líneas antes de declararse): la fila
  // de plantillas no se pintaba y el listener de "Usar plantilla" no se enganchaba.
  const erroresConsola = [];
  page.on('pageerror', (err) => {
    erroresConsola.push({ tipo: 'error', texto: String(err?.message || err), donde: page.url() });
  });
  page.on('console', (m) => {
    if (m.type() === 'error') erroresConsola.push({ tipo: 'error', texto: m.text(), donde: page.url() });
  });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const waitFor = async (fn, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(400); }
    return false;
  };

  // ── 2 · ONBOARDING (3 pasos visuales) ────────────────────────────────────
  await page.goto(`${base}/auth/verify?token=${token}`, { waitUntil: 'networkidle2' });
  await page.goto(`${base}/dashboard/`, { waitUntil: 'networkidle2' });
  if (!(await waitFor(() => !!document.getElementById('ob-name')))) fail('onboarding no aparece');
  await page.type('#ob-name', 'E2E Fontanería');
  await page.select('#ob-trade', 'fontanero');
  await page.type('#ob-phone', '34611222333');
  await page.click('#ob-next');
  if (!(await waitFor(() => !!document.getElementById('ob-load-catalog')))) fail('paso catálogo no llegó');
  ok('onboarding paso 1 → negocio+WhatsApp guardados');
  await page.click('#ob-next'); // carga catálogo (checkbox marcado por defecto)
  if (!(await waitFor(() => !!document.getElementById('ob-wow'), 60000))) fail('paso WOW no llegó');
  await page.evaluate(() => document.getElementById('ob-explore')?.click());
  await sleep(1500);
  ok('onboarding completo (3 pasos)');

  // ── 3 · PRODUCTO (del catálogo del gremio) ───────────────────────────────
  const nProducts = await prisma.product.count({ where: { merchantId } });
  if (nProducts < 25) fail(`catálogo no cargó (${nProducts} productos)`);
  ok(`catálogo del gremio cargado (${nProducts} productos)`);

  // ── 4 · CLIENTE + PRESUPUESTO (API de creación real) ────────────────────
  const customer = await prisma.customer.create({
    data: { merchantId, name: 'Cliente E2E', phone: '34611000001' },
  });
  const cookie = (await (async () => {
    const t2 = 'e2e2-' + crypto.randomBytes(10).toString('hex');
    await prisma.authSession.create({ data: { merchantId, token: t2, type: 'magic_link', expiresAt: new Date(Date.now() + 900000) } });
    const v = await fetch(`${base}/auth/verify?token=${t2}`, { redirect: 'manual' });
    return (v.headers.get('set-cookie') || '').split(';')[0];
  })());
  const qRes = await fetch(`${base}/quote/create`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: merchantId, customer_id: customer.id, currency: 'EUR',
      lines: [{ concept: 'Cambio de termo eléctrico 50-80L', qty: 1, price: 300, tax: 0.21 }],
      paymentTerms: 'FULL_UPFRONT',
    }),
  });
  const qBody = await qRes.json().catch(() => ({}));
  const quoteId = qBody.id || qBody.quote_id || qBody.quoteId;
  if (!qRes.ok || !quoteId) fail(`crear presupuesto: ${qRes.status} ${JSON.stringify(qBody).slice(0, 120)}`);
  ok(`presupuesto #${qBody.number ?? quoteId} creado (FULL_UPFRONT)`);
  await prisma.quote.update({ where: { id: quoteId }, data: { status: 'sent' } }); // como tras el envío WA

  // ── 5 · LANDING PÚBLICA + FIRMA DEL CLIENTE ──────────────────────────────
  await page.goto(`${base}/pay/quote/${quoteId}`, { waitUntil: 'networkidle2' });
  if (!(await waitFor(() => !!document.getElementById('btn-accept')))) fail('landing sin botón de aceptar');
  ok('landing pública renderiza (firma + total + validez)');
  await page.click('#no-sig-check'); // "Acepto sin firmar" (evidencia igualmente)
  await page.click('#btn-accept');
  { // la verdad es la BD, no el texto de la página
    let accepted = false;
    for (let i = 0; i < 60 && !accepted; i++) {
      await sleep(500);
      const q = await prisma.quote.findUnique({ where: { id: quoteId }, select: { status: true } });
      accepted = q?.status === 'accepted';
    }
    if (!accepted) fail('la aceptación no llegó a accepted en BD');
  }
  ok('cliente acepta y firma (evidencia ts/IP/UA)');

  // ── 6 · ESTADOS BD + JUSTIFICANTE ────────────────────────────────────────
  const quoteAfter = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (quoteAfter.status !== 'accepted') fail(`quote.status=${quoteAfter.status}`);
  // la factura + charge post-accept son trabajo async del handler: se espera
  let invoice = null;
  for (let i = 0; i < 60 && !invoice; i++) {
    await sleep(500);
    invoice = await prisma.invoice.findFirst({ where: { merchantId, quoteId } });
  }
  if (!invoice) fail('no se generó el documento de cobro');
  if (!invoice.number.startsWith('J-')) fail(`esperaba justificante serie J, llegó ${invoice.number}`);
  if (invoice.type !== 'JUST') fail(`tipo ${invoice.type}, esperaba JUST (V0-0)`);
  let job = null;
  for (let i = 0; i < 30 && !job; i++) { await sleep(400); job = await prisma.job.findUnique({ where: { quoteId } }); }
  if (!job) fail('JOB-1: no se auto-creó el trabajo al aceptar');
  ok(`estados BD: accepted + justificante ${invoice.number} + job ${job.status}`);

  // ── 7 · PAGO (test) → cadena post-pago ───────────────────────────────────
  let charge = null;
  for (let i = 0; i < 60 && !charge; i++) {
    await sleep(500);
    charge = await prisma.charge.findFirst({ where: { merchantId, customerId: customer.id }, orderBy: { id: 'desc' } });
  }
  if (!charge) fail('no hay charge para cobrar');
  const pay = await fetch(`${base}/webhooks/psp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'payment.confirmed', charge_id: charge.id, method: 'card', bank_ref: 'pi_e2e_' + stamp, amount: Number(charge.amount), currency: 'EUR', ts: new Date().toISOString() }),
  });
  if (!pay.ok) fail(`pago test (psp) devolvió ${pay.status}`);
  const paidCharge = await prisma.charge.findUnique({ where: { id: charge.id } });
  const paidInvoice = await prisma.invoice.findFirst({ where: { id: invoice.id } });
  if (paidCharge.status !== 'paid') fail(`charge quedó ${paidCharge.status}`);
  if (paidInvoice.status !== 'paid' || !paidInvoice.paidAt) fail(`justificante quedó ${paidInvoice.status}`);
  ok('pago test confirmado → charge paid + justificante paid (misma cadena que Stripe)');

  // confirmaciones salientes (dry-run: registradas, no enviadas)
  ok(`confirmaciones en dry-run registradas (${globalThis.__waDryRunOutbox.length} mensajes simulados)`);

  // ── 8 · PDF on-demand (R8) ───────────────────────────────────────────────
  for (const [label, url] of [
    ['presupuesto firmado', `/admin/quotes/${quoteId}/pdf`],
    ['justificante', `/admin/invoices/${invoice.id}/pdf`],
  ]) {
    const res = await fetch(base + url, { headers: { cookie } });
    if (res.status !== 200) fail(`PDF ${label}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString() !== '%PDF-') fail(`PDF ${label}: contenido no-PDF`);
    ok(`PDF ${label} regenerado on-demand (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  // SCRUM-183: se comprueba AL FINAL, no al vuelo, para que el informe salga entero de una vez y
  // no aborte el recorrido a la primera — interesa saber TODO lo que se rompió, no lo primero.
  const consola = resumirErroresConsola(erroresConsola);
  if (!consola.ok) fail(consola.informe);


  console.log('\n🟢 e2e:critico COMPLETO — despliega tranquilo.');
} catch (e) {
  console.error('\n🔴 e2e:critico FALLÓ:', e?.message || e);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (merchantId) {
    await sleep(4000); // deja aterrizar el trabajo async post-accept antes de limpiar
    // limpieza TOTAL del merchant efímero (orden estricto por FKs; ruidosa si falla)
    const where = { merchantId };
    const steps = [
      ['event (por charge)', () => prisma.event.deleteMany({ where: { charge: { merchantId } } })],
      ['reconciliation', () => prisma.reconciliation.deleteMany({ where: { charge: { merchantId } } })],
      ['whatsAppMessage', () => prisma.whatsAppMessage.deleteMany({ where })],
      ['customerEvent', () => prisma.customerEvent.deleteMany({ where })],
      ['invoice', () => prisma.invoice.deleteMany({ where })],
      ['job', () => prisma.job.deleteMany({ where })],
      ['maintenancePlan', () => prisma.maintenancePlan.deleteMany({ where })],
      ['charge', () => prisma.charge.deleteMany({ where })],
      ['quote', () => prisma.quote.deleteMany({ where })],
      ['quoteTemplate', () => prisma.quoteTemplate.deleteMany({ where })],
      ['quoteRequest', () => prisma.quoteRequest.deleteMany({ where })],
      ['product', () => prisma.product.deleteMany({ where })],
      ['expense', () => prisma.expense.deleteMany({ where })],
      ['customer', () => prisma.customer.deleteMany({ where })],
      ['authSession', () => prisma.authSession.deleteMany({ where })],
      ['teamMember', () => prisma.teamMember.deleteMany({ where })],
      ['legalAcceptance', () => prisma.legalAcceptance.deleteMany({ where })],
      ['auditLog', () => prisma.auditLog.deleteMany({ where })],
    ];
    for (const [name, fn] of steps) {
      try { await fn(); } catch (e) { console.error(`cleanup ${name}:`, String(e?.message || e).split('\n')[0]); }
    }
    try {
      await prisma.merchant.delete({ where: { id: merchantId } });
      console.log('limpieza: merchant efímero borrado');
    } catch (e) { console.error('cleanup merchant FALLÓ (borrar a mano):', merchantId, String(e?.message || e).split('\n')[0]); process.exitCode = 1; }
  }
  server.close();
  await prisma.$disconnect();
}

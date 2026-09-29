// SCRUM-1301 · UN BIZUM CON FECHA DE «HOY» SE RECHAZABA DE MADRUGADA.
//
// `confirm-bizum` (chargesAdmin.routes.ts) valida la fecha con la zona del MERCHANT
// (`resolverFechaDeCobro(entrada, ahora, zonaDelMerchant(m))`, SCRUM-1093) y la reenvía al webhook
// como `ts`. El webhook (`psp.routes.ts`) la volvía a validar SIN zona, en UTC: entre las 00:00 y
// las 02:00 de Madrid (01:00 en invierno), el «hoy» de Madrid es «mañana» en UTC → `fecha_futura`
// 400 → axios lanza → el profesional recibe un 500 y el cobro no se marca.
//
// Se mide por el CAMINO REAL del webhook: la ruta compilada, con la base doblada y el reloj
// situado en el instante del caso. Las DOS mitades:
//   · el ① pasa de rojo a verde;
//   · ②③⑤ siguen limpios, y el ④ —merchant SIN zona, UTC— SIGUE saliendo 400, en confirm-bizum
//     Y en el webhook: para él todavía es 31. Un arreglo que aceptara cualquier fecha pasaría el ①.
//   · y Canarias en invierno (UTC+0): el mismo instante que rompía Madrid sigue siendo «ayer»
//     para él. Es el control que desmonta fijar `Europe/Madrid` (SCRUM-735).

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));
const { resolverFechaDeCobro } = requiere(path.join(RAIZ, 'dist/modules/billing/domain/fechaDeCobro.js'));
const { zonaDelMerchant } = requiere(path.join(RAIZ, 'dist/core/zonaDelMerchant.js'));

function doblarModulo(ruta, exports) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

/** Monta el webhook REAL con un merchant de zona `timezone` (null = sin zona). */
function bancoDelWebhook(timezone) {
  const cobro = {
    id: 1301, merchantId: 4301, customerId: null, status: 'pending', amount: '50.00', currency: 'EUR',
    method: 'bizum_manual', intentId: null, customer: null,
  };
  const consultasMerchant = [];
  const actualizaciones = [];
  const doble = dobleDeLaBase({
    'charge.findUnique': () => ({ ...cobro }),
    'charge.update': (args) => { actualizaciones.push(args); Object.assign(cobro, args?.data ?? {}); return { ...cobro }; },
    'merchant.findUnique': (args) => { consultasMerchant.push(args); return args?.where?.id === cobro.merchantId ? { id: cobro.merchantId, timezone } : null; },
  });
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
  doblarModulo('dist/lib/email.js', { sendInvoiceEmail: async () => {} });
  doblarModulo('dist/lib/invoicing.js', {
    ensureInvoiceForCharge: async () => null,
    ensureChargeReceiptToken: async () => 'tok_1301',
  });
  for (const m of [
    'dist/core/config/env.js', 'dist/modules/billing/domain/correoDeFacturaEnviado.js',
    'dist/modules/system/customerEvents.service.js', 'dist/integrations/whatsappNotifications.js',
    'dist/integrations/whatsapp.js', 'dist/modules/jobs/domain/job.service.js',
    'dist/modules/messaging/domain/merchantNotifications.js',
    'dist/modules/billing/app/routes/psp.routes.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe */ } }
  const mod = requiere(path.join(RAIZ, 'dist/modules/billing/app/routes/psp.routes.js'));
  const router = mod.default || mod;
  const capa = router.stack?.find((c) => c.route?.methods?.post);
  assert.ok(capa, '🔴 CIEGO: no se encuentra el POST de `psp.routes`');
  const handle = capa.route.stack[0].handle;

  const entregar = async (ts) => {
    const req = { body: { event: 'payment.confirmed', charge_id: cobro.id, method: 'bizum_manual', bank_ref: 'bizum-manual-1301', amount: 50, currency: 'EUR', ts } };
    let cuerpo = null;
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(x) { cuerpo = x; return this; } };
    await handle(req, res, (e) => { if (e) throw e; });
    return { statusCode: res.statusCode, cuerpo };
  };
  return { entregar, actualizaciones, consultasMerchant, cobro };
}

/**
 * El caso entero, en el orden del producto: `confirm-bizum` valida con la zona del merchant (lo
 * que ya hacía) y, si acepta, el webhook recibe su `ts`. Con el reloj en `ahora`.
 */
async function caso({ timezone, ahora, fecha }) {
  mock.timers.enable({ apis: ['Date'], now: new Date(ahora) });
  try {
    const paso1 = resolverFechaDeCobro(fecha, new Date(), zonaDelMerchant({ timezone }));
    if (!paso1.ok) return { paso1, webhook: null, banco: null };
    const banco = bancoDelWebhook(timezone);
    const webhook = await banco.entregar(paso1.fecha.toISOString());
    return { paso1, webhook, banco };
  } finally {
    mock.timers.reset();
  }
}

const MADRID = 'Europe/Madrid';

test('SCRUM-1301 · 🔴 ① Madrid, 31-mar 23:30Z (01:30 del 1-abr allí), fecha 1-abr → confirm-bizum Y el webhook aceptan, y el cobro se marca', async () => {
  const r = await caso({ timezone: MADRID, ahora: '2026-03-31T23:30:00Z', fecha: '2026-04-01' });
  assert.equal(r.paso1.ok, true, 'precondición: confirm-bizum ya aceptaba este caso');
  assert.equal(r.webhook.statusCode, 200,
    `🔴 EL WEBHOOK RECHAZA LA FECHA QUE CONFIRM-BIZUM ACABA DE ACEPTAR: ${JSON.stringify(r.webhook.cuerpo)}.\n`
    + '  Revalida sin la zona del merchant: el «hoy» de Madrid es «mañana» en UTC.');
  assert.equal(r.banco.actualizaciones.length, 1, '🔴 el cobro no se marcó');
  assert.equal(r.banco.actualizaciones[0].data.paidAt.toISOString(), r.paso1.fecha.toISOString(),
    'se guarda la fecha que dio la persona, no otra');
  assert.ok(r.banco.consultasMerchant.some((c) => c?.where?.id === 4301),
    'la zona sale del merchant DEL COBRO (charge.merchantId), no de otro');
});

for (const [n, desc, ahora, fecha] of [
  ['②', 'Madrid, 1-abr 10:00Z, fecha 1-abr', '2026-04-01T10:00:00Z', '2026-04-01'],
  ['③', 'Madrid, 31-mar 21:00Z (23:00 allí), fecha 31-mar', '2026-03-31T21:00:00Z', '2026-03-31'],
  ['⑤', 'Madrid, 31-mar 23:30Z, fecha 31-mar', '2026-03-31T23:30:00Z', '2026-03-31'],
]) {
  test(`SCRUM-1301 · ${n} ${desc} → limpio en los dos pasos`, async () => {
    const r = await caso({ timezone: MADRID, ahora, fecha });
    assert.equal(r.paso1.ok, true);
    assert.equal(r.webhook.statusCode, 200, JSON.stringify(r.webhook.cuerpo));
    assert.equal(r.banco.actualizaciones.length, 1);
  });
}

test('SCRUM-1301 · 🔴 ④ merchant SIN zona (UTC), 31-mar 23:30Z, fecha 1-abr → 400 en confirm-bizum: para él todavía es 31', async () => {
  const r = await caso({ timezone: null, ahora: '2026-03-31T23:30:00Z', fecha: '2026-04-01' });
  assert.equal(r.paso1.ok, false, '🔴 un merchant sin zona acepta una fecha que para él es MAÑANA');
  assert.equal(r.paso1.error, 'fecha_futura');
});

test('SCRUM-1301 · 🔴 ④b y el WEBHOOK, para ese mismo merchant sin zona, SIGUE rechazando el 1-abr (fail-closed intacto, misma respuesta)', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-03-31T23:30:00Z') });
  try {
    const banco = bancoDelWebhook(null);
    const r = await banco.entregar('2026-04-01T00:00:00.000Z');
    assert.equal(r.statusCode, 400, '🔴 el webhook acepta cualquier fecha: el arreglo abrió la puerta entera');
    assert.equal(r.cuerpo.error, 'fecha_futura', 'la respuesta al proveedor no cambia de forma');
    assert.equal(typeof r.cuerpo.message, 'string');
    assert.equal(banco.actualizaciones.length, 0, 'fail-closed: no se marca nada');
    // POSITIVO con el mismo token: la consulta del merchant SÍ se hizo (si no, el 400 sería el
    // del UTC de siempre por no haber mirado, y este caso no distinguiría nada).
    assert.ok(banco.consultasMerchant.length >= 1, 'CIEGO: el webhook no preguntó por el merchant');
  } finally {
    mock.timers.reset();
  }
});

test('SCRUM-1301 · 🔴 Canarias en invierno (UTC+0): 31-ene 23:30Z, fecha 1-feb → 400 en los dos pasos. Fijar Madrid lo aceptaría', async () => {
  const r = await caso({ timezone: 'Atlantic/Canary', ahora: '2026-01-31T23:30:00Z', fecha: '2026-02-01' });
  assert.equal(r.paso1.ok, false, '🔴 para Canarias todavía es 31 de enero');
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-31T23:30:00Z') });
  try {
    const banco = bancoDelWebhook('Atlantic/Canary');
    const w = await banco.entregar('2026-02-01T00:00:00.000Z');
    assert.equal(w.statusCode, 400, '🔴 el webhook usa una zona que no es la del merchant (¿Madrid fija?)');
    assert.equal(w.cuerpo.error, 'fecha_futura');
  } finally {
    mock.timers.reset();
  }
});

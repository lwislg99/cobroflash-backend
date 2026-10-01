// SCRUM-1093 · `POST /admin/invoices/bulk-paid` · MARCAR EN LOTE CON LA FECHA DE «HOY» SE
// RECHAZABA DE MADRUGADA.
//
// El tercer sitio del defecto de SCRUM-1301: `resolverFechaDeCobro(req.body?.paidAt)` SIN la zona
// del merchant. Entre las 00:00 y las 02:00 de Madrid (01:00 en invierno), el «hoy» de Madrid es
// «mañana» en UTC → 400 `fecha_futura`. Y aquí es PEOR de leer que en el webhook: allí salía un
// 500 genérico; aquí el profesional recibe el texto FIRMADO de «fecha futura», un mensaje seguro de
// sí mismo que contradice su calendario.
//
// GO del fundador nombrando la ruta: SCRUM-1093, comentario 17654 («1-Autorizo»).
//
// Se mide por el handler REAL compilado, con el reloj situado en el instante del caso y la base
// doblada haciendo cumplir el `where` (patrón SCRUM-1292): el merchant sólo se devuelve si se pide
// el de la SESIÓN, y el lote sólo marca facturas de ese merchant.
//
// Las dos mitades:
//   · ① pasa de rojo a verde;
//   · ② ③ ⑥ siguen igual: hoy en Madrid, merchant SIN zona (para él aún es 31) y mañana de verdad;
//   · ④ Canarias en INVIERNO REAL (31-ene): el 31-mar Canarias ya está en UTC+1 y ese control no
//     probaría nada. Es el que desmonta fijar `Europe/Madrid` (SCRUM-735);
//   · ⑤ positivo: el lote sigue marcando TODAS las facturas del merchant, y sólo las suyas.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import routerModulo from '../dist/modules/system/app/routes/invoicesAdmin.routes.js';

const router = routerModulo.default ?? routerModulo;
const M = 4093;
const OTRO_M = 4094;

/** Llama al handler real de `/bulk-paid` con el reloj en `ahoraIso` y un merchant de zona `timezone`. */
async function marcarEnLote({ ahoraIso, timezone, paidAt, ids = [1, 2, 3] }) {
  const facturas = [
    { id: 1, merchantId: M, status: 'pending', paidAt: null },
    { id: 2, merchantId: M, status: 'pending', paidAt: null },
    { id: 3, merchantId: M, status: 'pending', paidAt: null },
    { id: 9, merchantId: OTRO_M, status: 'pending', paidAt: null },
  ];
  const consultasMerchant = [];
  const dobles = {
    merchant: {
      findUnique: async (a) => { consultasMerchant.push(a); return a?.where?.id === M ? { id: M, timezone } : null; },
      findFirst: async (a) => { consultasMerchant.push(a); return a?.where?.id === M ? { id: M, timezone } : null; },
    },
    invoice: {
      updateMany: async ({ where, data }) => {
        const casan = facturas.filter((f) => where.id.in.includes(f.id) && f.merchantId === where.merchantId
          && !where.status.notIn.includes(f.status));
        for (const f of casan) Object.assign(f, data);
        return { count: casan.length };
      },
    },
    auditLog: { create: async () => ({}) },
  };
  const originales = {};
  for (const k of Object.keys(dobles)) { originales[k] = prisma[k]; prisma[k] = dobles[k]; }
  mock.timers.enable({ apis: ['Date'], now: new Date(ahoraIso).getTime() });
  let status = 200;
  let cuerpo = null;
  const res = { status(c) { status = c; return res; }, json(b) { cuerpo = b; return res; } };
  try {
    const capa = router.stack.find((l) => l.route?.path === '/bulk-paid' && l.route.methods.post);
    assert.ok(capa, 'CIEGO: no encuentro POST /bulk-paid');
    await capa.route.stack.at(-1).handle(
      { merchantId: M, userRole: 'admin', teamMemberId: null, body: { ids, paidAt }, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  } finally {
    mock.timers.reset();
    for (const k of Object.keys(originales)) prisma[k] = originales[k];
  }
  return { status, cuerpo, facturas, consultasMerchant };
}

const marcadas = (r) => r.facturas.filter((f) => f.status === 'paid').map((f) => f.id);

test('SCRUM-1093 · 🔴 ① Madrid, 31-mar 23:30Z (01:30 del 1-abr allí), paidAt 1-abr → el lote se marca', async () => {
  const r = await marcarEnLote({ ahoraIso: '2026-03-31T23:30:00Z', timezone: 'Europe/Madrid', paidAt: '2026-04-01' });
  assert.equal(r.status, 200, `🔴 marcar en lote con la fecha de HOY en Madrid responde ${r.status} ${JSON.stringify(r.cuerpo)}`);
  assert.deepEqual(marcadas(r), [1, 2, 3]);
  assert.equal(r.facturas[0].paidAt.toISOString(), '2026-04-01T00:00:00.000Z', 'la fecha escrita es la que dio la persona');
  assert.ok(r.consultasMerchant.every((c) => c.where.id === M), '🔴 la zona se leyó de un merchant que no es el de la sesión');
});

test('SCRUM-1093 · ② Madrid, paidAt 31-mar → sigue marcándose', async () => {
  const r = await marcarEnLote({ ahoraIso: '2026-03-31T23:30:00Z', timezone: 'Europe/Madrid', paidAt: '2026-03-31' });
  assert.equal(r.status, 200);
  assert.deepEqual(marcadas(r), [1, 2, 3]);
});

test('SCRUM-1093 · ③ merchant SIN zona (UTC), 31-mar 23:30Z, paidAt 1-abr → sigue en 400: para él todavía es 31', async () => {
  const r = await marcarEnLote({ ahoraIso: '2026-03-31T23:30:00Z', timezone: null, paidAt: '2026-04-01' });
  assert.equal(r.status, 400, '🔴 un merchant sin zona ha dejado de rechazar mañana');
  assert.equal(r.cuerpo.error, 'fecha_futura');
  assert.deepEqual(marcadas(r), [], '🔴 se marcó algo pese al rechazo');
});

test('SCRUM-1093 · ④ Canarias en INVIERNO (UTC+0), 31-ene 23:30Z, paidAt 1-feb → 400; Madrid en el mismo instante → 200. Fijar Madrid lo aceptaría', async () => {
  const canarias = await marcarEnLote({ ahoraIso: '2026-01-31T23:30:00Z', timezone: 'Atlantic/Canary', paidAt: '2026-02-01' });
  assert.equal(canarias.status, 400, '🔴 Canarias en invierno aceptó el 1-feb cuando allí aún es 31-ene: ¿se ha fijado Madrid?');
  assert.deepEqual(marcadas(canarias), []);
  // El mismo instante SÍ es 1-feb en Madrid: el caso discrimina por la zona, no por la fecha.
  const madrid = await marcarEnLote({ ahoraIso: '2026-01-31T23:30:00Z', timezone: 'Europe/Madrid', paidAt: '2026-02-01' });
  assert.equal(madrid.status, 200, 'CONTROL: en ese instante en Madrid ya es 1-feb');
});

test('SCRUM-1093 · ⑤ POSITIVO: sin fecha, el lote marca TODAS las facturas del merchant y ninguna de otro', async () => {
  const r = await marcarEnLote({ ahoraIso: '2026-03-31T23:30:00Z', timezone: 'Europe/Madrid', paidAt: undefined, ids: [1, 2, 3, 9] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.cuerpo, { ok: true, updated: 3 });
  assert.deepEqual(marcadas(r), [1, 2, 3], '🔴 el lote marcó una factura de OTRO merchant, o dejó alguna suya');
});

test('SCRUM-1093 · ⑥ Madrid, paidAt 2-abr (mañana también allí) → sigue en 400: el arreglo no acepta cualquier fecha', async () => {
  const r = await marcarEnLote({ ahoraIso: '2026-03-31T23:30:00Z', timezone: 'Europe/Madrid', paidAt: '2026-04-02' });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error, 'fecha_futura');
  assert.deepEqual(marcadas(r), []);
});

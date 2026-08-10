// tests/scrum308-bloqueo-rectify.test.mjs — SCRUM-308
//
// NO SE RECTIFICA UNA FACTURA ANULADA. Una rectificativa corrige una operación que existe; sobre
// algo ya declarado sin efecto es un documento que no debería existir.
//
// ── POR QUÉ EL CONTROL POSITIVO PESA TANTO COMO EL NEGATIVO ─────────────────────────────────
// Esto mete una PUERTA en un camino fiscal que hoy funciona. Un bloqueo que además impidiera
// rectificar una factura normal sería peor que el defecto que viene a cerrar: dejaría al
// profesional sin la única forma legal de corregir una factura ya emitida (regla 29 — no se
// borra, se rectifica).
//
// ── EL SUELO: LISTA BLANCA, NO LISTA NEGRA ──────────────────────────────────────────────────
// `if (status === 'annulled') bloquear` falla hacia el lado permisivo: un status nulo, ilegible o
// NUEVO pasaría y emitiría. Aquí solo pasa lo explícitamente permitido. Equivocarse hacia lo
// estricto cuesta un 409; hacia lo permisivo, un documento fiscal que no se deshace.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  puedeRectificarse, ESTADOS_RECTIFICABLES,
  ERROR_RECTIFICAR_ANULADA, ERROR_RECTIFICAR_ESTADO_DESCONOCIDO,
} from '../dist/modules/invoicing/domain/rectificabilidad.js';

const DIST = pathToFileURL(path.resolve(import.meta.dirname, '../dist/')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA DECISIÓN, PURA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-308 · CONTROL NEGATIVO: una factura ANULADA no se rectifica, con motivo NOMBRADO', () => {
  const v = puedeRectificarse('annulled');
  assert.equal(v.ok, false);
  assert.equal(v.error, ERROR_RECTIFICAR_ANULADA,
    '🔴 el rechazo tiene que ir NOMBRADO: un 409 sin nombre obliga a quien lo recibe a adivinar qué pasó');
});

test('SCRUM-308 · CONTROL POSITIVO: `pending` y `paid` SIGUEN rectificándose', () => {
  // Sin esto, un bloqueo demasiado ancho dejaría al profesional sin la única forma legal de
  // corregir una factura emitida.
  for (const estado of ['pending', 'paid']) {
    const v = puedeRectificarse(estado);
    assert.equal(v.ok, true, `🔴 se ha bloqueado «${estado}», que SÍ se puede rectificar`);
    assert.equal(v.estado, estado);
  }
  assert.deepEqual([...ESTADOS_RECTIFICABLES], ['pending', 'paid']);
});

test('SCRUM-308 · SUELO: lo que NO se sabe se BLOQUEA, y con su propio código', () => {
  // El caso que una lista negra dejaría pasar. Un estado nuevo que alguien añada al schema no
  // puede abrir una puerta fiscal sin que nadie lo decida.
  const desconocidos = [null, undefined, '', '  ', 'ANNULLED', 'draft', 'disputed', 42, {}, []];
  for (const s of desconocidos) {
    const v = puedeRectificarse(s);
    assert.equal(v.ok, false, `🔴 «${JSON.stringify(s)}» ha pasado la puerta: no saber el estado no es permiso para rectificar`);
    assert.equal(v.error, ERROR_RECTIFICAR_ESTADO_DESCONOCIDO,
      '🔴 un estado desconocido no puede confundirse con una anulada: son síntomas distintos y uno hay que investigarlo');
  }
});

test('SCRUM-308 · anulada y desconocido NO comparten código de error', () => {
  // Aplanarlos haría que un dato corrupto se leyera como «esta factura está anulada» y nadie
  // mirase por qué.
  assert.notEqual(ERROR_RECTIFICAR_ANULADA, ERROR_RECTIFICAR_ESTADO_DESCONOCIDO);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA RUTA, EJERCITADA DE VERDAD (patrón SCRUM-263 / 308-caracterización)
// ═══════════════════════════════════════════════════════════════════════════════════════════

async function invocar(req) {
  const router = routerDe(await import(DIST + 'modules/system/app/routes/invoicesAdmin.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id/rectify' && l.route?.methods?.post);
  assert.ok(capa, '🔴 no existe POST /:id/rectify: si la ruta se renombró, este test no comprueba NADA');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const h = capa.route.stack;
  await h[h.length - 1].handle(req, res, () => {});
  return salida;
}

// ⚠️ Merchant con `id` REAL: `isDemoMerchant` es `id === 1`, y con el demo todo corre en otro modo.
const MERCHANT = { id: 7, email: 'pro@fontaneria.es', country: 'ES', flags: { INVOICING_ES_ENABLED: true }, defaultCurrency: 'EUR' };

function montar(status, { yaRectificada = null } = {}) {
  const cap = { emitida: null };
  const p = moduloPrisma.prisma;
  const original = {
    id: 10, merchantId: 7, customerId: 5, quoteId: null, number: 'F-2026-0001',
    total: 100, currency: 'EUR', type: 'F1', status,
    lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
    merchant: MERCHANT,
  };
  p.invoice = {
    findFirst: async (args) => (args?.where?.rectifiesId ? yaRectificada : original),
    update: async ({ data }) => ({ id: 11, ...data }),
  };
  p.merchant = { findUnique: async () => MERCHANT };
  const tx = new Proxy({
    invoice: { create: async ({ data }) => { cap.emitida = data; return { ...data, id: 11, number: 'F-2026-R-001', total: { toString: () => data.total } }; } },
    merchant: {
      findUnique: async () => ({ ...MERCHANT, invoiceSeq: 0, rectSeq: 0 }),
      update: async () => ({ ...MERCHANT, invoiceSeq: 1 }),
    },
  }, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k === 'string' && k.startsWith('$')) return async () => [];
      return { findFirst: async () => null, findMany: async () => [], upsert: async () => ({}), create: async () => ({}), update: async () => ({}) };
    },
  });
  p.$transaction = async (cb) => cb(tx);
  return cap;
}

// `headers: {}` no es relleno: `requestIp(req)` los lee al auditar la emisión. Sin ellos el
// camino de ÉXITO reventaba con un 500 del arnés — y el caso anulado pasaba igualmente, porque
// devuelve 409 mucho antes de llegar ahí. O sea que sin este dato el control POSITIVO no podía
// distinguirse de un bloqueo demasiado ancho, que es justo lo que viene a vigilar.
const REQ = { params: { id: '10' }, body: {}, headers: {}, merchantId: 7, userRole: 'admin', user: { id: 1 } };

test('SCRUM-308 · LA RUTA: sobre una ANULADA responde 409 y NO emite nada', async () => {
  const cap = montar('annulled');
  const r = await invocar(REQ);
  assert.equal(r.code, 409, `esperaba 409 y salió ${r.code}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body.error, ERROR_RECTIFICAR_ANULADA);
  assert.equal(cap.emitida, null,
    '🔴 se ha emitido una rectificativa sobre una factura anulada — y una factura emitida no se borra (regla 29)');
});

test('SCRUM-308 · LA RUTA: sobre una factura NORMAL sigue funcionando exactamente igual', async () => {
  // El control que impide que el arreglo sea peor que el defecto.
  for (const estado of ['pending', 'paid']) {
    const cap = montar(estado);
    const r = await invocar(REQ);
    assert.equal(r.code, 201, `🔴 «${estado}» ha dejado de poder rectificarse (${r.code}: ${JSON.stringify(r.body)})`);
    assert.ok(cap.emitida, '🔴 no se emitió la rectificativa');
    assert.equal(cap.emitida.type, 'R1');
    assert.equal(cap.emitida.total, '-100.00', 'la R1 sigue naciendo en negativo');
  }
});

test('SCRUM-308 · LA RUTA: el estado ilegible tampoco emite', async () => {
  const cap = montar(null);
  const r = await invocar(REQ);
  assert.equal(r.code, 409);
  assert.equal(r.body.error, ERROR_RECTIFICAR_ESTADO_DESCONOCIDO);
  assert.equal(cap.emitida, null);
});

test('SCRUM-308 · el rechazo lleva microcopy con MARCADOR (regla 30) y sin explicar nada (regla 26)', async () => {
  montar('annulled');
  const r = await invocar(REQ);
  assert.equal(r.body.message, '[PENDIENTE microcopy oficial]',
    '🔴 hay texto escrito sin aprobar en un rechazo fiscal');
  // El CÓDIGO sí va en claro: es diagnóstico, no microcopy de pantalla.
  assert.equal(r.body.error, ERROR_RECTIFICAR_ANULADA);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO QUE YA ESTABA · medido, no supuesto
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-308 · rectificar una YA RECTIFICADA sigue bloqueado (ya lo estaba)', async () => {
  // La tercera pregunta del encargo. Medido: la ruta ya lo impedía con `already_rectified`, así
  // que este ticket NO lo construye — lo deja fijado para que no se pierda al tocar la puerta
  // nueva de al lado.
  const cap = montar('paid', { yaRectificada: { id: 99, number: 'F-2026-R-001' } });
  const r = await invocar(REQ);
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'already_rectified');
  assert.equal(cap.emitida, null);
});

test('SCRUM-308 · rectificar una R1 sigue bloqueado (ya lo estaba)', async () => {
  const p = moduloPrisma.prisma;
  const cap = montar('paid');
  const antes = p.invoice.findFirst;
  p.invoice = { ...p.invoice, findFirst: async (args) => (args?.where?.rectifiesId ? null : { ...(await antes({})), type: 'R1' }) };
  const r = await invocar(REQ);
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'cannot_rectify_rectification');
  assert.equal(cap.emitida, null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// REGLA 38 · la puerta se pregunta ANTES, y no cambia cómo se emite
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-308 · REGLA 38: el bloqueo va ANTES de pedir número', async () => {
  // Si se comprobara después, habría que deshacer una factura ya numerada — y deshacer es lo que
  // crea el hueco en la serie que hay que justificar ante Hacienda.
  const fs = await import('node:fs');
  const RAIZ = path.resolve(import.meta.dirname, '..');
  const ruta = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  const handler = ruta.slice(ruta.indexOf("router.post('/:id/rectify'"));
  const posGuard = handler.indexOf('puedeRectificarse(');
  const posNumero = handler.indexOf('allocateInvoiceNumber(');
  assert.ok(posGuard > 0, '🔴 la ruta ya no pregunta por el estado');
  assert.ok(posNumero > 0, '🔴 no se encuentra la asignación de número: este test no comprueba nada');
  assert.ok(posGuard < posNumero,
    '🔴 la comprobación de estado ocurre DESPUÉS de pedir número: abortar ahí dejaría un hueco en la serie');
});

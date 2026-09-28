// tests/scrum1202-sin-accept-publico.test.mjs — SCRUM-1202
//
// 🔴 SE CIERRA UNA PUERTA PÚBLICA SIN AUTENTICAR, no se limpia código muerto.
//
// `POST /quote/:token/accept` (y su gemela `/reject`) seguían vivas desde antes de SCRUM-95 sin que
// nadie las llamara: la landing decide por `/quote/:token/decision`. Y /accept hacía lo que /decision
// no hace nunca: reescribía `paymentTerms` (las condiciones de COBRO) y `evidence` con lo que trajera
// el cuerpo, no sellaba el contenido (SCRUM-805) y no miraba la caducidad. Cualquiera con el enlace
// del cliente podía aceptar y cambiarle el cobro.
//
// Las dos mitades que pide el ticket:
//   · las dos rutas NO están en el router (y tampoco en la declaración de acceso público);
//   · la vía VIVA sigue ahí y sigue rechazando una firma sin trazo sin escribir nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const modRutas = await import(DIST + 'modules/quotes/app/routes/quotes.routes.js');
const router = modRutas.default?.default ?? modRutas.default;
const { PUBLIC_ACCESS_DECLARED } = await import(DIST + 'core/http/publicAccessDeclarations.js');
const { ERROR_FIRMA_VACIA } = await import(DIST + 'modules/quotes/domain/firmaConTrazo.js');
const moduloPrisma = await import(DIST + 'core/db/prisma.js');

const rutasPost = () => router.stack
  .filter((l) => l.route?.methods?.post)
  .map((l) => l.route.path);

test('SCRUM-1202 · control positivo: el router se lee y /decision está (si no, lo de abajo no mide nada)', () => {
  assert.ok(Array.isArray(router?.stack), '🔴 no se pudo leer el router de quotes.routes');
  assert.ok(rutasPost().includes('/:token/decision'), '🔴 la vía VIVA de decisión del cliente ha desaparecido');
  assert.ok(rutasPost().includes('/create'), '🔴 el extractor está ciego: no ve ni /create');
});

test('SCRUM-1202 · 🔴 POST /quote/:token/accept y /reject ya no existen', () => {
  const vivas = rutasPost().filter((p) => p === '/:token/accept' || p === '/:token/reject');
  assert.deepEqual(vivas, [],
    `🔴 volvió ${vivas.join(', ')}: una aceptación pública que reescribe paymentTerms/evidence sin sello`);
});

test('SCRUM-1202 · la declaración de acceso público ya no las nombra (y sí nombra /decision)', () => {
  assert.ok(Array.isArray(PUBLIC_ACCESS_DECLARED) && PUBLIC_ACCESS_DECLARED.length > 0, '🔴 declaración ilegible');
  const rutas = PUBLIC_ACCESS_DECLARED.map((d) => `${d.method} ${d.path}`);
  assert.ok(rutas.includes('POST /quote/:token/decision'), '🔴 control positivo: /decision no está declarada');
  for (const r of ['POST /quote/:token/accept', 'POST /quote/:token/reject']) {
    assert.ok(!rutas.includes(r), `🔴 se declara como pública una ruta que ya no existe: ${r}`);
  }
});

test('SCRUM-1202 · la vía VIVA sigue rechazando una firma sin trazo (422) sin escribir nada', async () => {
  const quote = {
    id: 99912020, quoteNumber: 7, merchantId: 7, customerId: 2, status: 'sent', currency: 'EUR',
    total: 100, lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0 }], tiers: null,
    paymentTerms: 'MANUAL', decisionToken: 'b'.repeat(32), Invoice: [], validUntil: null,
    merchant: { id: 7, name: 'QA', country: 'ES' }, customer: { id: 2, name: 'Cliente QA' },
  };
  const escrituras = [];
  const original = moduloPrisma.prisma.quote;
  moduloPrisma.prisma.quote = {
    findUnique: async () => quote,
    findFirst: async () => quote,
    update: async (a) => { escrituras.push(a.data); return { ...quote, ...a.data }; },
  };
  try {
    const capa = router.stack.find((l) => l.route?.path === '/:token/decision' && l.route?.methods?.post);
    let salida = null;
    const res = {
      status(c) { this._c = c; return this; },
      json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
      send(b) { salida = { code: this._c ?? 200, body: b }; return this; },
      setHeader() { return this; },
      type() { return this; },
    };
    const handlers = capa.route.stack;
    await handlers[handlers.length - 1].handle({
      params: { token: 'b'.repeat(32) },
      body: { decision: 'accept', signatureData: 'data:,' },
      headers: { 'user-agent': 'scrum1202' }, ip: '127.0.0.1', socket: {},
    }, res, () => {});
    assert.ok(salida, '🔴 /decision no respondió');
    assert.equal(salida.code, 422, `🔴 /decision respondió ${salida.code} a una firma vacía`);
    assert.equal(salida.body?.error, ERROR_FIRMA_VACIA);
    assert.deepEqual(escrituras, [], '🔴 rechazó pero ESCRIBIÓ en el presupuesto');
  } finally {
    moduloPrisma.prisma.quote = original;
  }
});

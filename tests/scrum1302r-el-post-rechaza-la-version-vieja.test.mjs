// tests/scrum1302r-el-post-rechaza-la-version-vieja.test.mjs — SCRUM-1302, la mitad del SERVIDOR (S1).
//
// Medido por S4 el 13-oct-2026 (c.19451): con una .1 en el grupo, `POST /quote/:token/decision` con el
// token de la .0 ACEPTABA (200) y la .0 quedaba `accepted`. La página ya no pinta el formulario
// (`scrum1302p-la-pagina-de-una-revision-antigua`), pero un `POST` fabricado con el enlace viejo sí.
// Firmado (c.19454 punto 6, c.19636 punto 3): el `POST` rechaza, con `message` = T2 y T3 seguidos.
//
// Por la PUERTA: la ruta real de `dist`, base doblada por `_envio-doblado.mjs`, WhatsApp en dry-run.
// El doble de `quote.count` EVALÚA el `where` del grupo sobre una tabla en memoria, como en 1302p.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/quotes/app/routes/quotes.routes.js';
const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · la ruta no pregunta por el grupo: vuelve el 200 del 13-oct.
    fichero: 'src/modules/quotes/app/routes/quotes.routes.ts',
    de: 'if (await tieneVersionMasReciente(quote, quote.merchant)) {\n      return res.status(409).json({',
    a: 'if (false && await tieneVersionMasReciente(quote, quote.merchant)) {\n      return res.status(409).json({',
    cae: 'aceptar con el token de la .0 habiendo .1',
  },
];

const T2 = 'Este presupuesto tiene una versión más reciente.';
const T3 = 'La que estás viendo ya no se puede aceptar. Abre el enlace de la versión nueva que te haya enviado {negocio}, o pídesela.';

const copia = (x) => JSON.parse(JSON.stringify(x));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const TEL_PRO = '34000001302'; // rango imposible (SCRUM-262)

function fila(revision, extra = {}) {
  return {
    id: 1300 + revision, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: revision ? '242.00' : '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: revision ? 200 : 100, tax: 0.21 }], quoteNumber: 12, revision, seriesYear: 2026,
    decisionToken: String(revision + 1).repeat(32), validUntil: new Date(Date.now() + 10 * 86400000).toISOString(),
    paymentTerms: 'FULL_UPFRONT', tiers: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null,
    jobId: null, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', signatureUrl: null,
    // Modo `receipt` (ES sin facturación): el viaje no entra en la emisión, que no es de este ticket.
    merchant: { id: MERCHANT, name: 'Fontanería Ruiz', legalName: null, taxId: null, country: 'ES',
      whatsappPhone: TEL_PRO, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid' },
    customer: { id: CLIENTE, name: 'Cliente 1302', phone: '34000001303' },
    Invoice: [],
    ...extra,
  };
}

/** ¿Casa la fila con el `where` que construye `whereDelGrupo` + `revision: { gt }`? (el de 1302p) */
function casa(q, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') { if (!v.some((w) => casa(q, w))) return false; continue; }
    if (k === 'revision') { if (!(q.revision > v.gt)) return false; continue; }
    if (k === 'createdAt') { const t = new Date(q.createdAt).getTime(); if (!(t >= new Date(v.gte).getTime() && t < new Date(v.lt).getTime())) return false; continue; }
    if (q[k] !== v) return false;
  }
  return true;
}

let TABLA = [];
let countLanza = false;
const log = { updates: 0, count: 0, eventos: [] };
inyectarBase({
  'quote.findUnique': ({ where }) => {
    const q = TABLA.find((x) => (where.decisionToken ? x.decisionToken === where.decisionToken : x.id === where.id));
    return q ? copia(q) : null;
  },
  'quote.count': ({ where }) => {
    log.count += 1;
    if (countLanza) throw new Error('base caída (doble)');
    return TABLA.filter((q) => casa(q, where)).length;
  },
  'quote.update': ({ where, data }) => {
    const q = TABLA.find((x) => x.id === where.id);
    const permitidos = where?.status?.in;
    if (!q || (Array.isArray(permitidos) && !permitidos.includes(q.status))) {
      throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
    }
    log.updates += 1;
    Object.assign(q, copia(data));
    return copia(q);
  },
  'customerEvent.create': ({ data }) => { log.eventos.push(data.type); return {}; },
}, [RUTAS, LANDING, '../dist/modules/system/customerEvents.service.js']);

const router = moduloDeDist(RUTAS).default;
const capa = router.stack.find((l) => l.route && l.route.path === '/:token/decision');
const h = capa.route.stack.at(-1).handle;

async function decidir(token, body) {
  log.updates = 0; log.eventos = []; globalThis.__waDryRunOutbox = [];
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; }, setHeader() {} };
  await h({ params: { token }, body, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  await esperar(50); // historial y avisos son fire-and-forget
  return r;
}
const avisosAlPro = () => (globalThis.__waDryRunOutbox || []).filter((m) => m.to === TEL_PRO);

test('SCRUM-1302r · CONTROL POSITIVO: la VIGENTE (.1) se sigue aceptando, y el banco ve la escritura', async () => {
  TABLA = [fila(0), fila(1)];
  const antes = log.count;
  const r = await decidir(fila(1).decisionToken, { decision: 'accept' });
  assert.ok(log.count > antes, 'CIEGO: la ruta no ha preguntado por el grupo');
  assert.equal(r.status, 200, `🔴 la vigente no se deja aceptar: ${JSON.stringify(r.data)}`);
  assert.equal(TABLA[1].status, 'accepted');
  assert.equal(log.updates > 0, true, 'la sonda no ve escrituras: el «0» de abajo no probaría nada');
});

test('SCRUM-1302r · 🔴 aceptar con el token de la .0 habiendo .1: 409, T2+T3, y NADA escrito', async () => {
  TABLA = [fila(0), fila(1)];
  const r = await decidir(fila(0).decisionToken, { decision: 'accept' });
  assert.equal(r.status, 409, '🔴 el POST con el enlace viejo acepta: es el defecto medido el 13-oct (c.19451)');
  assert.equal(r.data.error, 'quote_has_newer_version');
  assert.equal(r.data.message, `${T2} ${T3.replace('{negocio}', 'Fontanería Ruiz')}`);
  assert.equal(TABLA[0].status, 'sent', '🔴 la .0 ha quedado aceptada');
  assert.equal(log.updates, 0);
  assert.deepEqual(log.eventos, [], 'historial apuntado');
  assert.deepEqual(avisosAlPro(), [], 'el profesional ha recibido un aviso');
});

test('SCRUM-1302r · 🔴 tampoco se RECHAZA la .0 por la API (punto 7: «Rechazar» de la antigua lleva al aviso)', async () => {
  TABLA = [fila(0), fila(1)];
  const r = await decidir(fila(0).decisionToken, { decision: 'reject', reason: 'caro' });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'quote_has_newer_version');
  assert.equal(TABLA[0].status, 'sent');
  assert.equal(log.updates, 0);
});

test('SCRUM-1302r · 🔴 también en BORRADOR, y va ANTES que el caducado (punto 5)', async () => {
  TABLA = [fila(0, { status: 'draft' }), fila(1, { status: 'draft' })];
  assert.equal((await decidir(fila(0).decisionToken, { decision: 'accept' })).status, 409);
  TABLA = [fila(0, { validUntil: '2026-01-01T00:00:00.000Z' }), fila(1)];
  const r = await decidir(fila(0).decisionToken, { decision: 'accept' });
  assert.equal(r.status, 409, '🔴 sale «Pide uno actualizado» (410) habiendo ya uno');
  assert.equal(r.data.error, 'quote_has_newer_version');
  // c.19636 punto 2 (#2451): la que ya barrió el cron a `expired` también cuenta.
  TABLA = [fila(0, { status: 'expired', validUntil: '2026-01-01T00:00:00.000Z' }), fila(1)];
  const x = await decidir(fila(0).decisionToken, { decision: 'accept' });
  assert.equal(x.status, 409, `🔴 una .0 en «expired» habiendo .1 contesta ${x.status}`);
  assert.equal(x.data.error, 'quote_has_newer_version');
});

test('SCRUM-1302r · una .0 ya ACEPTADA sigue idempotente (punto 6: historia cierta)', async () => {
  TABLA = [fila(0, { status: 'accepted', acceptedAt: '2026-10-02T10:00:00.000Z' }), fila(1)];
  const r = await decidir(fila(0).decisionToken, { decision: 'accept' });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'already_accepted');
});

test('SCRUM-1302r · el grupo es por AÑO de la serie: la .1 de otro año no bloquea la .0', async () => {
  TABLA = [fila(0), fila(1, { seriesYear: 2027 })];
  const r = await decidir(fila(0).decisionToken, { decision: 'accept' });
  assert.equal(r.status, 200, '🔴 la ruta ha preguntado por otro grupo (sin el año de la serie)');
});

test('SCRUM-1302r · {negocio}: el nombre fiscal si lo hay, SIN escapar (es JSON, no HTML)', async () => {
  TABLA = [fila(0, { merchant: { ...fila(0).merchant, legalName: 'Ruiz & Hijos SL' } }), fila(1)];
  const r = await decidir(fila(0).decisionToken, { decision: 'accept' });
  assert.equal(r.data.message, `${T2} ${T3.replace('{negocio}', 'Ruiz & Hijos SL')}`);
});

test('SCRUM-1302r · 🔴 si no se puede preguntar por el grupo, NO se acepta a ciegas', async () => {
  TABLA = [fila(0), fila(1)];
  countLanza = true;
  try {
    const r = await decidir(fila(0).decisionToken, { decision: 'accept' });
    assert.ok(r.status >= 500, `🔴 con la base caída la ruta ha contestado ${r.status}`);
    assert.equal(TABLA[0].status, 'sent');
    assert.equal(log.updates, 0);
  } finally { countLanza = false; }
});

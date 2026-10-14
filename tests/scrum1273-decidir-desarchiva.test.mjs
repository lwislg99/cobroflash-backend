// tests/scrum1273-decidir-desarchiva.test.mjs — SCRUM-1273 · decisión 1 de c.19605
//
// Si el cliente DECIDE sobre un presupuesto archivado, el servidor lo DESARCHIVA: un aceptado que no
// sale en la lista es un compromiso invisible. Arnés copiado de SCRUM-1276 (cabecera de abajo).
//
// --- cabecera original de SCRUM-1276 ---
// SCRUM-1276
//
// 🔴 UN PRESUPUESTO DECIDIDO NO SE REABRE CON EL MISMO ENLACE (Parte L:398, «jamás reabrir»).
//
// Medido por la ruta real: un presupuesto ACEPTADO y facturado se RECHAZABA después — 200,
// `acceptedAt` borrado, historial «rechazado» y un WhatsApp «❌ rechazó» al profesional de un
// trabajo ya cobrado—; y uno rechazado se ACEPTABA. La comprobación de «ya decidido» solo cerraba el
// mismo sentido, y el `update` no llevaba condición de estado.
//
// Por la PUERTA: `POST /quote/:token/decision` de verdad (`dist`), base doblada por
// `_envio-doblado.mjs` y WhatsApp en dry-run (`__waDryRunOutbox`: no sale ni un byte). El doble de
// `quote.update` hace lo que hace Prisma con un `where` que no casa: lanza P2025. ⛔ Sin red ni base.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/quotes/app/routes/quotes.routes.js';
const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));
const TOKEN = 'b'.repeat(32);
const TEL_PRO = '34000001276'; // rango imposible (SCRUM-262)

function presupuesto(extra = {}) {
  return {
    id: 1276, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }], quoteNumber: 1276, revision: 0,
    decisionToken: TOKEN, validUntil: new Date(Date.now() + 10 * 86400000), paymentTerms: 'FULL_UPFRONT',
    tiers: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null,
    createdAt: new Date(), updatedAt: new Date(),
    // Modo `receipt` (ES sin facturación): el viaje no entra en la emisión, que no es de este ticket.
    merchant: { id: MERCHANT, name: 'Fontanería 1276', legalName: null, taxId: null, country: 'ES',
      whatsappPhone: TEL_PRO, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid' },
    customer: { id: CLIENTE, name: 'Cliente 1276', phone: '34000001277' },
    Invoice: [],
    ...extra,
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** La ruta, con una fila que RECUERDA lo escrito y un `update` fiel a Prisma con `where` de estado. */
function banco(inicial, { lecturaLenta = 0 } = {}) {
  const fila = presupuesto(inicial);
  const log = { updates: 0, eventos: [], escriturasAjenas: [] };
  const ajena = (nombre) => () => { log.escriturasAjenas.push(nombre); return {}; };
  inyectarBase({
    'quote.findUnique': async ({ where }) => {
      if (where.decisionToken === TOKEN) { const foto = copia(fila); await esperar(lecturaLenta); return foto; }
      if (where.id === fila.id) return { status: fila.status };
      return null;
    },
    'quote.update': ({ where, data }) => {
      const permitidos = where?.status?.in;
      if (Array.isArray(permitidos) && !permitidos.includes(fila.status)) {
        throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
      }
      log.updates += 1;
      Object.assign(fila, copia(data));
      return copia(fila);
    },
    'customerEvent.create': ({ data }) => { log.eventos.push(data.type); return {}; },
    'invoice.update': ajena('invoice.update'), 'invoice.delete': ajena('invoice.delete'),
    'job.update': ajena('job.update'), 'job.delete': ajena('job.delete'),
  }, [RUTAS, LANDING, '../dist/modules/system/customerEvents.service.js']);
  globalThis.__waDryRunOutbox = [];
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:token/decision');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const decidir = async (body) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; }, setHeader() {} };
    await h({ params: { token: TOKEN }, body, headers: {}, ip: '127.0.0.1', socket: {} }, res);
    await esperar(50); // los avisos y el historial son fire-and-forget
    return r;
  };
  const avisosAlPro = () => (globalThis.__waDryRunOutbox || []).filter((m) => m.to === TEL_PRO);
  return { fila, log, decidir, avisosAlPro };
}

test('SCRUM-1273 · 🔴 el cliente ACEPTA un borrador archivado: vuelve a la lista', async () => {
  const b = banco({ status: 'draft', archivedAt: '2026-10-01T10:00:00.000Z' });
  const r = await b.decidir({ decision: 'accept' });
  assert.equal(r.status, 200, `🔴 CIEGO: la aceptación no ha entrado: ${JSON.stringify(r)}`);
  assert.equal(b.fila.status, 'accepted');
  assert.equal(b.fila.archivedAt, null, '🔴 aceptado y archivado: un compromiso que no sale en la lista');
});

test('SCRUM-1273 · el cliente RECHAZA un borrador archivado: también vuelve a la lista', async () => {
  const b = banco({ status: 'draft', archivedAt: '2026-10-01T10:00:00.000Z' });
  const r = await b.decidir({ decision: 'reject', reason: 'No me interesa' });
  assert.equal(r.status, 200, `🔴 CIEGO: el rechazo no ha entrado: ${JSON.stringify(r)}`);
  assert.equal(b.fila.status, 'rejected');
  assert.equal(b.fila.archivedAt, null);
});

test('SCRUM-1273 · control: si la decisión NO entra (ya decidido), no se toca el archivado', async () => {
  const b = banco({ status: 'rejected', rejectedAt: new Date('2026-09-20T10:00:00Z'), archivedAt: '2026-10-01T10:00:00.000Z' });
  const r = await b.decidir({ decision: 'accept' });
  assert.equal(r.status, 409);
  assert.equal(b.fila.archivedAt, '2026-10-01T10:00:00.000Z');
});
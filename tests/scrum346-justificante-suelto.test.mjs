// tests/scrum346-justificante-suelto.test.mjs — SCRUM-346 (A0.5)
//
// EL JUSTIFICANTE SUELTO: la reparación de 40 € del martes. Sin presupuesto, sin trabajo y sin
// albarán — el 80 % de la semana de un fontanero, que el producto trataba como excepción.
//
// ── LO QUE FALTABA NO ERA CAMINO, ERA PERMISO ───────────────────────────────────────────────
// A0.3 construyó la ruta entera (`POST /admin/invoices`) y cerró la puerta para el modo
// `receipt`, porque el botón prometía «factura» y a un merchant ES real no le sale una factura.
// El defecto estaba en aplanar dos cosas opuestas en un booleano:
//
//   `false` = «no puedes emitir nada»   ←→   `false` = «tú emites JUSTIFICANTES»
//
// Con tres valores, el segundo deja de leerse como una carencia.
//
// ⚠️ ESTO NO ENCIENDE NADA (regla 24). El mismo merchant sigue sin poder emitir facturas: lo que
// se hace explícito es el documento que YA le corresponde.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { modoDocumentoSuelto } from '../dist/modules/invoicing/domain/facturaSuelta.js';

const DIST = pathToFileURL(path.resolve(import.meta.dirname, '../dist/')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

async function invocar(req) {
  const router = routerDe(await import(DIST + 'modules/system/app/routes/invoicesAdmin.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/' && l.route?.methods?.post);
  assert.ok(capa, '🔴 no existe POST /admin/invoices: si la ruta se movió, este test no comprueba NADA');
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

/**
 * ⚠️ EL MERCHANT NUNCA LLEVA `id: 1`. `isDemoMerchant` es `id === 1` o `demo@yaqu.app`, así que
 * un fixture cómodo pone TODOS los casos en modo 'demo' y la puerta de la regla 24 no se ejercita
 * en ninguno. Ya mordió una vez en A0.4 y no vuelve a morder aquí.
 */
const ES_REAL = { id: 7, email: 'pro@fontaneria.es', country: 'ES', flags: null, defaultCurrency: 'EUR' };
const ES_CON_FLAG = { ...ES_REAL, flags: { INVOICING_ES_ENABLED: true } };

function montar(merchant, { customer = { id: 5 } } = {}) {
  const cap = { emitido: null, numeroPedido: false };
  const p = moduloPrisma.prisma;
  p.merchant = { findUnique: async () => merchant };
  p.customer = { findFirst: async () => customer };
  // `sellarTrasEmision` corre FUERA de la transacción (SCRUM-205) y escribe el estado de sellado
  // sobre el `prisma` de arriba, no sobre el `tx`. Sin esto el handler revienta con un 500 que no
  // dice nada del producto, solo del doble.
  p.invoice = { update: async ({ data }) => ({ id: 44, ...data }), findUnique: async () => null };
  const tx = new Proxy({
    invoice: {
      create: async ({ data }) => {
        cap.emitido = data;
        // El número lo pone `allocateInvoiceNumber`; aquí se simula según el modo real del
        // merchant, que es lo que decide si sale serie J-.
        const numero = modoDocumentoSuelto(merchant) === 'justificante' ? 'J-2026-0001' : 'F-2026-0001';
        return { ...data, id: 44, number: numero, total: { toString: () => data.total } };
      },
      // SCRUM-396: la referencia del justificante se comprueba contra el índice antes de
      // devolverse. `null` = libre. Va DENTRO de este objeto y no lo cubre el Proxy de abajo,
      // porque `invoice` sí está en el destino y el `get` de reserva no llega a mirarlo.
      findUnique: async () => null,
    },
    merchant: {
      findUnique: async () => ({ ...merchant, invoiceSeq: 0 }),
      update: async () => { cap.numeroPedido = true; return { ...merchant, invoiceSeq: 1 }; },
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

const CUERPO_OK = {
  customerId: 5,
  lines: [{ concept: 'Cambio de grifo monomando', qty: 1, price: 40, tax: 0.21 }],
};
const REQ = (body = CUERPO_OK) => ({ body, merchantId: 7, userRole: 'admin', user: { id: 1 } });

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · el caso que este ticket viene a abrir
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-346 · CONTROL POSITIVO: el profesional ES real SÍ emite su justificante', async () => {
  const cap = montar(ES_REAL);
  const r = await invocar(REQ());
  assert.equal(r.code, 201, `esperaba 201 y salió ${r.code}: ${JSON.stringify(r.body)}`);
  assert.ok(cap.emitido, '🔴 no se emitió nada: la avería de 40 € sigue sin puerta');
  assert.equal(cap.emitido.total, '48.40', '40 € + 21 %');
});

test('SCRUM-346 · el `J-` YA NO se rechaza en el camino de justificante', () => {
  // Es la ramificación del cinturón, y el motivo por el que este ticket no era «quitar una línea»:
  // A0.3 rechazaba cualquier J- porque el botón prometía FACTURA. Aquí el J- es lo correcto.
  montar(ES_REAL);
  return invocar(REQ()).then((r) => {
    assert.notEqual(r.body?.error, 'factura_suelta_no_disponible',
      '🔴 el documento correcto se está rechazando por su propio número de serie');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO DE NO-REGRESIÓN · el caso que YA funcionaba
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-346 · NO-REGRESIÓN: en modo factura se sigue emitiendo FACTURA, como antes', async () => {
  // El veredicto pasó de dos valores a tres, y ésa es justo la clase de cambio que rompe el caso
  // que ya funcionaba sin que nadie mire.
  const cap = montar(ES_CON_FLAG);
  const r = await invocar(REQ());
  assert.equal(r.code, 201);
  assert.equal(cap.emitido.type, 'F1', '🔴 el merchant con el flag ON tiene que seguir emitiendo FACTURA');
  assert.equal(modoDocumentoSuelto(ES_CON_FLAG), 'factura');
});

test('SCRUM-346 · REGLA 24: el ES real sigue SIN poder emitir factura', () => {
  // Hacer explícito el justificante no abre la facturación. Si alguien hiciera que `receipt`
  // devolviera 'factura', esto cae — y con él la regla 24.
  assert.equal(modoDocumentoSuelto(ES_REAL), 'justificante');
  assert.notEqual(modoDocumentoSuelto(ES_REAL), 'factura');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · sin cliente identificable no se emite
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-346 · CONTROL NEGATIVO: sin cliente NO se emite, y no se pide número', async () => {
  const cap = montar(ES_REAL);
  const r = await invocar(REQ({ lines: CUERPO_OK.lines })); // sin customerId
  assert.equal(r.code, 400);
  assert.equal(r.body.error, 'cliente_invalido');
  assert.equal(cap.emitido, null, '🔴 se ha emitido un documento sin cliente');
});

test('SCRUM-346 · CONTROL NEGATIVO: un cliente que NO es de este merchant no vale (regla 2)', async () => {
  // Sin esto, un id ajeno emitiría un documento a nombre del cliente de otro profesional — y un
  // documento emitido no se borra (regla 29).
  const cap = montar(ES_REAL, { customer: null });
  const r = await invocar(REQ());
  assert.equal(r.code, 404);
  assert.equal(r.body.error, 'cliente_invalido');
  assert.equal(cap.emitido, null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO · no se emite «lo que tenga»
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-346 · SUELO: sin líneas NO se emite «lo que tenga»', async () => {
  // Un documento fiscal emitido sin nada que cobrar no se puede borrar (regla 29): el error queda
  // para siempre y solo se corrige con una rectificativa.
  const cap = montar(ES_REAL);
  const r = await invocar(REQ({ customerId: 5, lines: [] }));
  assert.equal(r.code, 400);
  assert.equal(r.body.error, 'lineas_invalidas');
  assert.equal(cap.emitido, null);
});

test('SCRUM-346 · SUELO: una línea sin concepto tampoco pasa', async () => {
  const cap = montar(ES_REAL);
  const r = await invocar(REQ({ customerId: 5, lines: [{ concept: '  ', qty: 1, price: 40, tax: 0.21 }] }));
  assert.equal(r.code, 400);
  assert.equal(cap.emitido, null, '🔴 se emitiría un documento con una línea que no dice qué se hizo');
});

test('SCRUM-346 · SUELO: sin merchant se falla CERRADO', () => {
  assert.equal(modoDocumentoSuelto(null), 'no');
  assert.equal(modoDocumentoSuelto(undefined), 'no');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL VEREDICTO VIAJA ENTERO AL FRONT, Y EL FRONT NO LO REIMPLEMENTA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-346 · el navegador RECIBE el veredicto, no lo calcula', async () => {
  const fs = await import('node:fs');
  const RAIZ = path.resolve(import.meta.dirname, '..');
  const appJs = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/invoicesView.js'), 'utf8');

  assert.match(appJs, /me\.documentoSuelto/, '🔴 el front ya no lee el veredicto del servidor');
  // Y NO reimplementa la regla: si apareciera `getEmissionMode`, `INVOICING_ES_ENABLED` o el país
  // en el navegador, habría dos copias del criterio — que es cómo se llega a que el back acepte
  // lo que el front esconde.
  for (const codigo of [appJs, vista]) {
    const sinComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(sinComentarios, /INVOICING_ES_ENABLED|getEmissionMode/,
      '🔴 el navegador está reimplementando el modo de emisión en vez de recibir el veredicto');
  }
  // Hermano positivo (SCRUM-237), y con LOS DOS tokens de la alternancia: si solo se respalda uno,
  // el otro podría estar roto en la regex y la negación sería verde para siempre.
  assert.match('if (isFlagEnabled("INVOICING_ES_ENABLED"))', /INVOICING_ES_ENABLED|getEmissionMode/);
  assert.match('const modo = getEmissionMode(merchant);', /INVOICING_ES_ENABLED|getEmissionMode/);
});

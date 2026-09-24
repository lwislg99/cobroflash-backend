// tests/scrum346-justificante-suelto.test.mjs — SCRUM-346 (A0.5) · retirado por SCRUM-1027
//
// EL JUSTIFICANTE SUELTO: la reparación de 40 € del martes. Sin presupuesto, sin trabajo y sin
// albarán — el 80 % de la semana de un fontanero, que el producto trataba como excepción.
//
// ── LO QUE FALTABA NO ERA CAMINO, ERA PERMISO (A0.3 → A0.5, historia) ───────────────────────
// A0.3 construyó la ruta entera (`POST /admin/invoices`) y cerró la puerta para el modo
// `receipt`, porque el botón prometía «factura» y a un merchant ES real no le sale una factura.
// A0.5 (SCRUM-346, este fichero) abrió esa puerta: un merchant ES real SIN el flag podía emitir
// un documento suelto — el justificante `J-`. El defecto que A0.5 corrigió era aplanar dos cosas
// opuestas en un booleano: `false` = «no puedes emitir nada» ←→ `false` = «tú emites
// JUSTIFICANTES». Con tres valores, el segundo dejó de leerse como una carencia.
//
// ── 🔴 SCRUM-1027 (21-sep-2026) RETIRA EXACTAMENTE LO QUE A0.5 ABRIÓ ────────────────────────
// Regla 24 (enmienda SCRUM-612c): con el interruptor en OFF, en España, ya NO se emite NINGÚN
// documento — ni siquiera el justificante que A0.5 hizo explícito. No es deshacer A0.5 por
// descuido: es la misma decisión del fundador, tomada otra vez, en sentido contrario, con fecha
// y ticket propios (ver `docs/master/SCRUM-1027.md`). Los CONTROL POSITIVO de abajo, que probaban
// que el profesional SÍ podía emitir su justificante, pasan a probar lo contrario: que ya no
// puede. Los CONTROL NEGATIVO de entrada (sin cliente, sin líneas) se mueven al merchant con el
// flag ON, porque con el flag OFF el rechazo ahora llega ANTES de leer esa entrada — así siguen
// midiendo lo que medían (una entrada inválida se rechaza), no lo que ya no es cierto.
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
      findMany: async () => [],
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
// 🔴 SCRUM-1027 · CONTROL POSITIVO INVERTIDO: el caso que A0.5 abrió, y que la regla 24 cierra
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1027 · el profesional ES real YA NO emite ningún documento suelto (regla 24)', async () => {
  const cap = montar(ES_REAL);
  const r = await invocar(REQ());
  assert.equal(r.code, 409, `esperaba 409 y salió ${r.code}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body?.error, 'factura_suelta_no_disponible',
    '🔴 el gate no responde con el error NOMBRADO ya establecido para el veredicto "no".');
  assert.equal(cap.emitido, null,
    '🔴 se ha emitido un documento pese al interruptor en OFF — regla 24 (SCRUM-612c) rota.');
});

test('SCRUM-1027 · el mensaje del rechazo sigue siendo el YA APROBADO (regla 30: no se inventa uno nuevo)', async () => {
  // «En este modo no se emiten facturas» ya estaba aprobado para el caso "sin merchant" (A0.3) y
  // sigue siendo VERDAD para este caso nuevo: no hace falta —ni se permite— redactar uno propio.
  montar(ES_REAL);
  const r = await invocar(REQ());
  assert.equal(r.body?.message, 'En este modo no se emiten facturas.',
    '🔴 el 409 lleva un texto distinto del ya aprobado. Regla 30: la microcopy la aprueba el ' +
    'fundador — reusar la frase que YA es verdad no es lo mismo que inventar una nueva.');
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

test('SCRUM-1027 · REGLA 24: el ES real sin flag no emite NINGÚN documento suelto (ni factura ni justificante)', () => {
  // Hasta SCRUM-1027 este veredicto era 'justificante' (A0.5). La regla 24 enmendada retira ESE
  // documento: si alguien hiciera que `receipt` volviera a devolver 'justificante' o pasara a
  // 'factura', esto cae.
  assert.equal(modoDocumentoSuelto(ES_REAL), 'no');
  assert.notEqual(modoDocumentoSuelto(ES_REAL), 'factura');
  assert.notEqual(modoDocumentoSuelto(ES_REAL), 'justificante');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · sin cliente identificable no se emite
//
// SCRUM-1027: se mueven a ES_CON_FLAG (fiscal). Con ES_REAL el gate de la regla 24 rechaza ANTES
// de llegar a mirar el cuerpo, así que ya no sirven para medir la validación de ENTRADA — que es
// lo que estos dos casos existen para comprobar, y sigue siendo cierto para un merchant que SÍ
// emite.
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-346 · CONTROL NEGATIVO: sin cliente NO se emite, y no se pide número', async () => {
  const cap = montar(ES_CON_FLAG);
  const r = await invocar(REQ({ lines: CUERPO_OK.lines })); // sin customerId
  assert.equal(r.code, 400);
  assert.equal(r.body.error, 'cliente_invalido');
  assert.equal(cap.emitido, null, '🔴 se ha emitido un documento sin cliente');
});

test('SCRUM-346 · CONTROL NEGATIVO: un cliente que NO es de este merchant no vale (regla 2)', async () => {
  // Sin esto, un id ajeno emitiría un documento a nombre del cliente de otro profesional — y un
  // documento emitido no se borra (regla 29).
  const cap = montar(ES_CON_FLAG, { customer: null });
  const r = await invocar(REQ());
  assert.equal(r.code, 404);
  assert.equal(r.body.error, 'cliente_invalido');
  assert.equal(cap.emitido, null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO · no se emite «lo que tenga» (SCRUM-1027: sobre ES_CON_FLAG, mismo motivo que arriba)
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-346 · SUELO: sin líneas NO se emite «lo que tenga»', async () => {
  // Un documento fiscal emitido sin nada que cobrar no se puede borrar (regla 29): el error queda
  // para siempre y solo se corrige con una rectificativa.
  const cap = montar(ES_CON_FLAG);
  const r = await invocar(REQ({ customerId: 5, lines: [] }));
  assert.equal(r.code, 400);
  assert.equal(r.body.error, 'lineas_invalidas');
  assert.equal(cap.emitido, null);
});

test('SCRUM-346 · SUELO: una línea sin concepto tampoco pasa', async () => {
  const cap = montar(ES_CON_FLAG);
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

// SCRUM-1303 · ANULAR Y COBRAR SE PISABAN EN LAS DOS DIRECCIONES.
//
// Tres escrituras leían el estado de la factura, lo comprobaban, y escribían con `where: { id }` a
// secas. Entre la lectura y la escritura cabe otra petición, y entonces la guarda no sirve de nada:
//
//   ① `POST /:id/annul` lee `pending`, SELLA la anulación (la ventana ANCHA), y un cobro entra en
//     medio → se escribía `annulled` encima de una factura COBRADA.
//   ② `updateInvoiceStatusAdmin` (PUT /:id/status, /:id/pay) lee `pending`, una anulación entra en
//     medio → se escribía `paid` encima de una ANULADA.
//   ③ la puerta de pasarela de SCRUM-502 (`/webhooks/psp`, `payment.confirmed`) igual que ②, y ésta
//     se dispara sola: basta un aviso de Stripe mientras el profesional anula.
//
// Medido y reproducido por J6 el 30-sep; GO del fundador en el comentario 17640.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 CÓMO SE MIDE: LAS CARRERAS SE JUEGAN CON LAS RUTAS REALES, Y EL DOBLE HACE CUMPLIR EL `where`
//
// La otra petición no se simula escribiendo en la fila: se EJECUTA la ruta real de enfrente en el
// punto exacto del hueco (dentro del cerrojo del sellado, o justo antes de que la base evalúe la
// escritura). Y el doble de la base se comporta como Prisma: evalúa el `where` ENTERO —id, estado,
// `not`, `in`, `OR`— contra la fila, y si no casa lanza P2025. Un operador que no conozca lo DICE
// en vez de dar por buena la fila: un doble más laxo que la base convierte sus verdes en ruido
// (SCRUM-1292, donde el doble ignoraba el `id`).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 4303;
const FACTURA = 1303;
const COBRO = 2303;

/** ¿Casa la fila con este `where`? Como Prisma, o lanza si no sabe. */
function casa(fila, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === 'OR') return v.some((w) => casa(fila, w));
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      return Object.entries(v).every(([op, x]) => {
        if (op === 'not') return fila[k] !== x;
        if (op === 'in') return x.includes(fila[k]);
        if (op === 'notIn') return !x.includes(fila[k]);
        throw new Error(`🔴 EL DOBLE NO SABE EVALUAR \`${k}: { ${op} }\`. Enséñaselo; no lo des por bueno.`);
      });
    }
    return fila[k] === v;
  });
}

const estado = { fila: null, cobro: null, escrituras: [], liberaciones: 0, enElCerrojo: null, alEscribir: null };

function nuevaFila(status = 'pending') {
  estado.fila = {
    id: FACTURA, merchantId: M, number: 'F-2026-1303', status, type: 'F1', paidAt: null,
    createdAt: new Date('2026-09-30T10:00:00Z'), chargeId: COBRO, quoteId: null,
    vfHash: 'A'.repeat(64), vfTimestamp: new Date('2026-09-30T10:00:00Z'),
    vfAnulHash: null, vfAnulPrevHash: null, vfAnulTimestamp: null,
    merchant: { id: M, country: 'ES', flags: {} },
  };
  estado.cobro = {
    id: COBRO, merchantId: M, customerId: null, status: 'pending', amount: '121.00', currency: 'EUR',
    method: 'bizum_manual', intentId: null, customer: null,
  };
  estado.escrituras = [];
  estado.liberaciones = 0;
  estado.enElCerrojo = null;
  estado.alEscribir = null;
}

const doble = dobleDeLaBase({
  'invoice.findFirst': (a) => (casa(estado.fila, a?.where) ? { ...estado.fila } : null),
  'invoice.findUnique': (a) => (casa(estado.fila, a?.where) ? { ...estado.fila } : null),
  'invoice.update': async (a) => {
    const gancho = estado.alEscribir;
    if (gancho && a?.data?.status) { estado.alEscribir = null; await gancho(a); }
    if (!casa(estado.fila, a?.where)) {
      const e = new Error('Record to update not found.');
      e.code = 'P2025';
      throw e;
    }
    estado.escrituras.push({ where: a.where, data: a.data, alEscribir: estado.fila.status });
    Object.assign(estado.fila, a.data);
    return { ...estado.fila };
  },
  'albaran.updateMany': () => { estado.liberaciones++; return { count: 0 }; },
  'albaranLineaFacturada.deleteMany': () => ({ count: 0 }),
  'merchant.findUnique': () => ({ id: M, taxId: 'B12345678', country: 'ES', timezone: 'Europe/Madrid' }),
  'charge.findUnique': () => ({ ...estado.cobro }),
  'charge.update': (a) => { Object.assign(estado.cobro, a?.data ?? {}); return { ...estado.cobro }; },
  // El cerrojo del sellado de la anulación: aquí está el hueco ANCHO de ①.
  '$executeRaw': async () => { const g = estado.enElCerrojo; estado.enElCerrojo = null; if (g) await g(); return 1; },
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
for (const [r, exports] of [
  ['dist/lib/email.js', { sendInvoiceEmail: async () => {} }],
  ['dist/lib/invoicing.js', { ensureInvoiceForCharge: async () => null, ensureChargeReceiptToken: async () => 'tok_1303' }],
]) {
  const f = rutaDe(r);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

const { updateInvoiceStatusAdmin, UnpayNotAllowedError } = requiere(rutaDe('dist/modules/system/invoiceAdmin.js'));
const handlerDe = (modulo, metodo, ruta) => {
  const m = requiere(rutaDe(modulo));
  const router = m.default || m;
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en ${modulo}`);
  return capa.route.stack.at(-1).handle;
};
const annulH = handlerDe('dist/modules/system/app/routes/invoicesAdmin.routes.js', 'post', '/:id/annul');
const statusH = handlerDe('dist/modules/system/app/routes/invoicesAdmin.routes.js', 'put', '/:id/status');
const pspH = handlerDe('dist/modules/billing/app/routes/psp.routes.js', 'post', '/');

async function llamar(handle, req) {
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; } };
  await handle({ merchantId: M, userRole: 'admin', teamMemberId: null, headers: {}, ip: '127.0.0.1', socket: {}, ...req }, res, (e) => { if (e) throw e; });
  return r;
}
const anular = () => llamar(annulH, { params: { id: String(FACTURA) }, body: { motivo: 'duplicada' } });
const marcarCobrada = () => llamar(statusH, { params: { id: String(FACTURA) }, body: { status: 'paid' } });
const avisoDePago = () => llamar(pspH, { body: { event: 'payment.confirmed', charge_id: COBRO, method: 'bizum_manual', bank_ref: 'b-1303', amount: 121, currency: 'EUR' } });

// ── SUELO: EL DOBLE ES TAN ESTRICTO COMO LA BASE ─────────────────────────────────────────

test('SCRUM-1303 · SUELO: el doble evalúa el `where` entero, y lanza con lo que no sabe', () => {
  nuevaFila('pending');
  assert.equal(casa(estado.fila, { id: FACTURA, status: 'pending' }), true);
  assert.equal(casa(estado.fila, { id: FACTURA + 1 }), false, '🔴 el doble ignora el `id`');
  assert.equal(casa(estado.fila, { id: FACTURA, status: 'paid' }), false, '🔴 el doble ignora el estado');
  assert.equal(casa(estado.fila, { id: FACTURA, status: { not: 'pending' } }), false, '🔴 el doble ignora `not`');
  assert.throws(() => casa(estado.fila, { status: { contains: 'p' } }), /NO SABE EVALUAR/);
});

// ── ① ANULAR MIENTRAS SE COBRA ────────────────────────────────────────────────────────────

test('SCRUM-1303 · ✅ ① CONTROL POSITIVO: anular una `pending` sin nadie en medio sigue anulando', async () => {
  nuevaFila('pending');
  const r = await anular();
  assert.equal(r.statusCode, 200, `🔴 la anulación normal ha dejado de funcionar: ${JSON.stringify(r.cuerpo)}`);
  assert.equal(estado.fila.status, 'annulled');
  assert.ok(estado.fila.vfAnulHash, 'y lleva su eslabón de anulación');
  assert.equal(estado.liberaciones, 1, 'y libera los albaranes, como siempre');
});

test('SCRUM-1303 · 🔴 ① B′ el cobro entra DURANTE el sellado de la anulación → NO se anula una factura cobrada', async () => {
  nuevaFila('pending');
  let cobro = null;
  estado.enElCerrojo = async () => { cobro = await marcarCobrada(); };
  const r = await anular();
  assert.equal(cobro?.statusCode, 200, `precondición: el cobro de en medio entró (${JSON.stringify(cobro?.cuerpo)})`);
  assert.equal(estado.fila.status, 'paid',
    '🔴 SE HA ESCRITO «annulled» ENCIMA DE UNA FACTURA COBRADA. La guarda de `/annul` miró el estado '
    + 'antes del sellado, y el cobro entró mientras se sellaba. `pending` tiene que ir en el `where`.');
  assert.equal(r.statusCode, 409);
  assert.equal(r.cuerpo.error, 'invoice_not_pending', 'el mismo 409 que la guarda de entrada, ya firmado');
  assert.equal(estado.liberaciones, 0, '🔴 se liberaron albaranes de una factura que NO se anuló');
});

test('SCRUM-1303 · ⚠️ RESIDUAL CONOCIDO (docs/BUGS.md P1-1303): tras B′ la factura queda `paid` CON su eslabón de anulación', async () => {
  // Esto NO es el comportamiento deseado: es el que hay, y está declarado. El sellado corre antes y
  // en su propia transacción; cerrarlo exige tocarlo (STOP, reglas 5 y 40). Si este caso cae porque
  // alguien lo ha cambiado, que sea por una decisión del fundador y actualizando P1-1303.
  nuevaFila('pending');
  estado.enElCerrojo = async () => { await marcarCobrada(); };
  await anular();
  assert.equal(estado.fila.status, 'paid');
  assert.ok(estado.fila.vfAnulHash,
    '⚠️ el eslabón de anulación ya NO queda sellado tras perder la carrera. Si es a propósito, '
    + 'actualiza docs/BUGS.md P1-1303 y este caso en el mismo commit: el residual ha cambiado.');
});

// ── ② COBRAR A MANO MIENTRAS SE ANULA ─────────────────────────────────────────────────────

test('SCRUM-1303 · ✅ ② CONTROL POSITIVO: marcar cobrada una `pending` sin nadie en medio sigue cobrando', async () => {
  nuevaFila('pending');
  const r = await marcarCobrada();
  assert.equal(r.statusCode, 200, `🔴 marcar cobrada ha dejado de funcionar: ${JSON.stringify(r.cuerpo)}`);
  assert.equal(estado.fila.status, 'paid');
  assert.equal(estado.escrituras.length, 1, 'y escribe exactamente una vez');
});

test('SCRUM-1303 · 🔴 ② la anulación entra entre la lectura y la escritura → NO se cobra una anulada', async () => {
  nuevaFila('pending');
  let anulacion = null;
  estado.alEscribir = async (a) => { if (a.data.status === 'paid') anulacion = await anular(); };
  const r = await marcarCobrada();
  assert.equal(anulacion?.statusCode, 200, `precondición: la anulación de en medio entró (${JSON.stringify(anulacion?.cuerpo)})`);
  assert.equal(estado.fila.status, 'annulled',
    '🔴 SE HA ESCRITO «paid» ENCIMA DE UNA FACTURA ANULADA. La guarda de SCRUM-153 miró la fila leída '
    + 'al entrar; entre esa lectura y la escritura entró la anulación. El estado tiene que ir en el `where`.');
  assert.equal(r.statusCode, 409);
  assert.equal(r.cuerpo.error, 'unpay_not_allowed');
  assert.match(r.cuerpo.message, /ANULADA/, 'contesta el texto ya firmado de SCRUM-153, no uno nuevo');
});

test('SCRUM-1303 · ② dos cambios seguidos en medio → error, no un bucle ni una escritura', async () => {
  nuevaFila('pending');
  let intentos = 0;
  const cambiar = async () => {
    intentos++;
    estado.fila.status = estado.fila.status === 'pending' ? 'expired' : 'pending';
    estado.alEscribir = intentos < 5 ? cambiar : null;
  };
  estado.alEscribir = cambiar;
  await assert.rejects(updateInvoiceStatusAdmin(FACTURA, 'paid', M), (e) => e?.code === 'P2025' && !(e instanceof UnpayNotAllowedError));
  assert.equal(intentos, 2, '🔴 relee más de UNA vez: una carrera sostenida no puede dejarlo reintentando');
  assert.equal(estado.escrituras.length, 0);
});

// ── ③ LA PUERTA DE PASARELA (SCRUM-502) MIENTRAS SE ANULA ─────────────────────────────────

test('SCRUM-1303 · ✅ ③ CONTROL POSITIVO: un pago por pasarela sobre una `pending` sigue marcándola cobrada', async () => {
  nuevaFila('pending');
  const r = await avisoDePago();
  assert.equal(r.statusCode, 200, JSON.stringify(r.cuerpo));
  assert.equal(estado.fila.status, 'paid', '🔴 la vía por la que entra el dinero ha dejado de marcar la factura');
});

test('SCRUM-1303 · 🔴 ③ el profesional anula mientras llega el aviso de pago → NO se cobra una anulada', async () => {
  nuevaFila('pending');
  let anulacion = null;
  estado.alEscribir = async (a) => { if (a.data.status === 'paid') anulacion = await anular(); };
  const r = await avisoDePago();
  assert.equal(anulacion?.statusCode, 200, `precondición: la anulación de en medio entró (${JSON.stringify(anulacion?.cuerpo)})`);
  assert.equal(estado.fila.status, 'annulled',
    '🔴 UN AVISO DE PAGO HA MARCADO COBRADA UNA FACTURA ANULADA. La guarda de SCRUM-502 miró el '
    + 'estado del `findFirst`; la anulación entró antes de la escritura. Y aquí no pulsa nadie: llega por la red.');
  assert.equal(r.statusCode, 200, 'al proveedor se le contesta como siempre');
  assert.equal(r.cuerpo.status, 'paid', 'la respuesta al proveedor no cambia (GO c.17640)');
});

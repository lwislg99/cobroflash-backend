// SCRUM-1315 · LOS DOS GEMELOS QUE SCRUM-1303 DEJÓ FUERA.
//
// La misma carrera —el estado de la factura se comprueba sobre un dato ya leído y se escribe con
// `where: { id }` a secas— en las otras dos escrituras de pasarela:
//
//   ① `/webhooks/psp`, `payment.confirmed`: la escritura que sigue a `ensureInvoiceForCharge`.
//   ② `/webhooks/mp`, pago `approved`: la misma forma, y además con un `.catch` que se lo tragaba todo.
//
// Si el profesional anula entre que `ensureInvoiceForCharge` devuelve la factura y la escritura, se
// marcaba `paid` encima de una ANULADA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LAS DOS ESTÁN DETRÁS DE UN FLAG APAGADO, Y ESTE FICHERO NO PUEDE SALIR MUDO POR ESO
//
// `invoiceId` sólo se rellena dentro de `if (config.AUTO_INVOICE_ON_PAID)`, y ese flag vale `false`
// en producción y en CI. Un test que dependiera del entorno saldría en verde sin haber pasado por
// ninguna de las dos escrituras. Por eso:
//
//   · el flag se enciende AQUÍ, en el objeto `config` de este proceso, caso por caso, y se devuelve
//     a como estaba. No se lee de `process.env` ni se toca ninguna base;
//   · cada caso con el flag encendido EXIGE haber pasado por `ensureInvoiceForCharge` (el contador
//     `estado.asegurar`): es el suelo que distingue «no escribió» de «no llegó»;
//   · y hay un caso con el flag APAGADO que fija lo que hay hoy: no se llega.
//
// 🔴 CÓMO SE MIDE, igual que en SCRUM-1303: la otra petición no se simula escribiendo en la fila; se
// EJECUTA la ruta real de anulación justo antes de que la base evalúe la escritura. Y el doble
// evalúa el `where` ENTERO y lanza con un operador que no conozca (`_where-como-prisma.mjs`).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { casa, filaNoEncontrada } from './_where-como-prisma.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 4315;
const FACTURA = 1315;
const COBRO = 2315;
const PAGO_MP = 'mp-1315';

const estado = { fila: null, cobro: null, escrituras: [], asegurar: 0, alEscribir: null };

function nuevaFila(status = 'pending') {
  estado.fila = {
    // 🔴 `chargeId: null` A PROPÓSITO. `/webhooks/psp` tiene OTRA escritura antes —la de SCRUM-502,
    // que arregló SCRUM-1303— y localiza la factura por `chargeId`. Sin enlace no la encuentra, así
    // que la única escritura de estado que puede ocurrir aquí es la del gemelo. La factura le llega
    // por `ensureInvoiceForCharge`, que en producción la busca por el evento `invoiced`.
    id: FACTURA, merchantId: M, number: 'F-2026-1315', status, type: 'F1', paidAt: null,
    createdAt: new Date('2026-09-30T10:00:00Z'), chargeId: null, quoteId: null, pdfUrl: 'PENDING_PDF',
    vfHash: 'A'.repeat(64), vfTimestamp: new Date('2026-09-30T10:00:00Z'),
    vfAnulHash: null, vfAnulPrevHash: null, vfAnulTimestamp: null,
    merchant: { id: M, country: 'ES', flags: {} },
  };
  estado.cobro = {
    id: COBRO, merchantId: M, customerId: null, status: 'pending', amount: '121.00', currency: 'EUR',
    method: 'bizum_manual', intentId: null, customer: null,
  };
  estado.escrituras = [];
  estado.asegurar = 0;
  estado.alEscribir = null;
}

const doble = dobleDeLaBase({
  'invoice.findFirst': (a) => (casa(estado.fila, a?.where) ? { ...estado.fila } : null),
  'invoice.findUnique': (a) => (casa(estado.fila, a?.where) ? { ...estado.fila } : null),
  'invoice.update': async (a) => {
    const gancho = estado.alEscribir;
    if (gancho && a?.data?.status) { estado.alEscribir = null; await gancho(a); }
    if (!casa(estado.fila, a?.where)) throw filaNoEncontrada();
    estado.escrituras.push({ where: a.where, data: a.data });
    Object.assign(estado.fila, a.data);
    return { ...estado.fila };
  },
  'albaran.updateMany': () => ({ count: 0 }),
  'albaranLineaFacturada.deleteMany': () => ({ count: 0 }),
  'merchant.findUnique': () => ({ id: M, taxId: 'B12345678', country: 'ES', timezone: 'Europe/Madrid' }),
  'charge.findUnique': () => ({ ...estado.cobro }),
  'charge.update': (a) => { Object.assign(estado.cobro, a?.data ?? {}); return { ...estado.cobro }; },
  '$executeRaw': async () => 1,
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
for (const [r, exports] of [
  ['dist/lib/email.js', { sendInvoiceEmail: async () => {} }],
  ['dist/lib/invoicing.js', {
    // Lo que hace la de verdad, en lo que aquí importa: LEE la factura y la devuelve. Lo que
    // devuelve es una foto del estado en ese instante — y ése es el hueco.
    ensureInvoiceForCharge: async () => {
      estado.asegurar++;
      const { id, number, status, pdfUrl } = estado.fila;
      return { id, number, status, pdfUrl };
    },
    ensureChargeReceiptToken: async () => 'tok_1315',
  }],
  // MercadoPago: ni firma real ni llamada a su API. Lo que se mide es lo que la ruta hace DESPUÉS.
  ['dist/integrations/mercadopago.js', {
    verifyMpWebhookSignature: () => true,
    getMpPayment: async () => ({
      status: 'approved', externalReference: `charge_${COBRO}`, amount: 121, currency: 'EUR', method: 'card',
    }),
  }],
]) {
  const f = rutaDe(r);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const handlerDe = (modulo, metodo, ruta) => {
  const m = requiere(rutaDe(modulo));
  const router = m.default || m;
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en ${modulo}`);
  return capa.route.stack.at(-1).handle;
};
const annulH = handlerDe('dist/modules/system/app/routes/invoicesAdmin.routes.js', 'post', '/:id/annul');
const pspH = handlerDe('dist/modules/billing/app/routes/psp.routes.js', 'post', '/');
const mpH = handlerDe('dist/modules/billing/app/routes/mpWebhook.routes.js', 'post', '/');

async function llamar(handle, req) {
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; } };
  await handle({ merchantId: M, userRole: 'admin', teamMemberId: null, headers: {}, ip: '127.0.0.1', socket: {}, ...req }, res, (e) => { if (e) throw e; });
  return r;
}
const anular = () => llamar(annulH, { params: { id: String(FACTURA) }, body: { motivo: 'duplicada' } });

/**
 * Ejecuta una puerta de pasarela con el flag como se pida, y devuelve lo que contestó y lo que DIJO.
 *
 * El flag se cambia en el objeto `config` de ESTE proceso y se restaura siempre. Los dos valores de
 * MercadoPago son cadenas de relleno: la firma y la consulta del pago están dobladas arriba.
 */
async function conElFlag(encendido, puerta) {
  const antes = {
    AUTO_INVOICE_ON_PAID: config.AUTO_INVOICE_ON_PAID,
    AUTO_EMAIL_INVOICE_ON_PAID: config.AUTO_EMAIL_INVOICE_ON_PAID,
    MP_WEBHOOK_SECRET: config.MP_WEBHOOK_SECRET,
    MP_ACCESS_TOKEN: config.MP_ACCESS_TOKEN,
  };
  const dicho = { errores: [], avisos: [] };
  const consola = { error: console.error, log: console.log };
  const enTexto = (a) => a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ');
  Object.assign(config, {
    AUTO_INVOICE_ON_PAID: encendido, AUTO_EMAIL_INVOICE_ON_PAID: false,
    MP_WEBHOOK_SECRET: 'relleno-de-test', MP_ACCESS_TOKEN: 'relleno-de-test',
  });
  console.error = (...a) => { dicho.errores.push(enTexto(a)); };
  console.log = (...a) => { dicho.avisos.push(enTexto(a)); };
  try {
    const r = await puerta();
    return { ...r, dicho };
  } finally {
    console.error = consola.error;
    console.log = consola.log;
    Object.assign(config, antes);
  }
}

const PUERTAS = [
  {
    nombre: '① /webhooks/psp',
    avisoDePago: () => llamar(pspH, { body: { event: 'payment.confirmed', charge_id: COBRO, method: 'bizum_manual', bank_ref: 'b-1315', amount: 121, currency: 'EUR' } }),
    // Al proveedor se le contesta lo de siempre: el arreglo sólo decide si se escribe.
    contestoComoSiempre: (r) => r.statusCode === 200 && r.cuerpo?.status === 'paid',
    // La ruta llegó hasta el final (no salió por su `catch` de fuera).
    llegoAlFinal: (r) => r.statusCode === 200 && r.cuerpo?.status === 'paid',
  },
  {
    nombre: '② /webhooks/mp',
    avisoDePago: () => llamar(mpH, { body: { type: 'payment', data: { id: PAGO_MP } }, headers: { 'x-signature': 'ts=1;v1=relleno', 'x-request-id': 'req-1315' } }),
    // MercadoPago recibe su 200 ANTES de que se procese nada.
    contestoComoSiempre: (r) => r.statusCode === 200 && r.cuerpo?.ok === true,
    llegoAlFinal: (r) => r.dicho.avisos.some((l) => l.includes(`Charge ${COBRO} marcado como pagado`))
      && !r.dicho.errores.some((l) => l.includes('Error inesperado')),
  },
];

// ── SUELO: EL DOBLE ES TAN ESTRICTO COMO LA BASE ─────────────────────────────────────────

test('SCRUM-1315 · SUELO: el doble evalúa el `where` entero, y lanza con lo que no sabe', () => {
  nuevaFila('pending');
  const f = estado.fila;
  assert.equal(casa(f, { id: FACTURA, status: 'pending' }), true);
  assert.equal(casa(f, { id: FACTURA + 1 }), false, '🔴 el doble ignora el `id`');
  assert.equal(casa(f, { id: FACTURA, status: 'paid' }), false, '🔴 el doble ignora el estado');
  assert.equal(casa(f, { id: FACTURA, status: { not: 'pending' } }), false, '🔴 el doble ignora `not`');
  assert.equal(casa(f, { id: FACTURA, status: { not: 'annulled' } }), true);
  assert.equal(casa(f, { id: FACTURA, status: { in: ['paid', 'annulled'] } }), false, '🔴 el doble ignora `in`');
  assert.equal(casa(f, { id: FACTURA, status: { notIn: ['pending'] } }), false, '🔴 el doble ignora `notIn`');
  assert.equal(casa(f, { OR: [{ id: FACTURA + 1 }, { status: 'paid' }] }), false, '🔴 el doble ignora `OR`');
  assert.equal(casa(f, { OR: [{ id: FACTURA + 1 }, { status: 'pending' }] }), true);
  assert.throws(() => casa(f, { status: { contains: 'p' } }), /NO SABE EVALUAR/);
  assert.throws(() => casa(f, { status: { not: { in: ['paid'] } } }), /NO SABE EVALUAR/);
  assert.throws(() => casa(f, { AND: [{ id: FACTURA }] }), /NO SABE EVALUAR/);
});

test('SCRUM-1315 · SUELO: sin enlace por `chargeId`, la otra escritura de `/webhooks/psp` no entra en la medición', () => {
  nuevaFila('pending');
  assert.equal(casa(estado.fila, { OR: [{ chargeId: COBRO }] }), false,
    '🔴 la factura del banco está enlazada al cobro: la escritura de SCRUM-502/1303 la marcaría antes '
    + 'que el gemelo, y los casos de abajo medirían ESA escritura, no la de este ticket.');
});

// ── LO QUE HAY HOY: CON EL FLAG APAGADO NO SE LLEGA ────────────────────────────────────
const caso1a = casosEscritos(PUERTAS, (puerta) => `SCRUM-1315 · ${puerta.nombre} · con el flag APAGADO (lo que hay hoy) no se llega a la escritura`, async (puerta) => {
  nuevaFila('pending');
  const r = await conElFlag(false, puerta.avisoDePago);
  assert.ok(puerta.llegoAlFinal(r), `precondición: el aviso se procesó entero (${JSON.stringify(r.cuerpo)} · ${r.dicho.errores.join(' | ')})`);
  assert.equal(estado.asegurar, 0, '🔴 se ha llamado a `ensureInvoiceForCharge` con el flag apagado');
  assert.equal(estado.escrituras.length, 0);
  assert.equal(estado.fila.status, 'pending');
});
// ── CONTROL POSITIVO: EL DINERO SIGUE ENTRANDO ─────────────────────────────────────────
const caso1b = casosEscritos(PUERTAS, (puerta) => `SCRUM-1315 · ✅ ${puerta.nombre} · CONTROL POSITIVO: factura pendiente y cobro confirmado → sigue marcando \`paid\``, async (puerta) => {
  nuevaFila('pending');
  const r = await conElFlag(true, puerta.avisoDePago);
  assert.equal(estado.asegurar, 1, '🔴 MUDO: no se ha pasado por `ensureInvoiceForCharge`, así que no se llegó a la escritura que se mide');
  assert.ok(puerta.contestoComoSiempre(r), JSON.stringify(r.cuerpo));
  assert.equal(estado.fila.status, 'paid', '🔴 la vía por la que entra el dinero ha dejado de marcar la factura');
  assert.ok(estado.fila.paidAt instanceof Date);
  assert.equal(estado.escrituras.length, 1, 'y escribe exactamente una vez');
  assert.ok(puerta.llegoAlFinal(r), r.dicho.errores.join(' | '));
});
const caso1c = casosEscritos(PUERTAS, (puerta) => `SCRUM-1315 · ✅ ${puerta.nombre} · un reintento sobre una ya \`paid\` sigue escribiendo (idempotente, SCRUM-502)`, async (puerta) => {
  nuevaFila('paid');
  const r = await conElFlag(true, puerta.avisoDePago);
  assert.equal(estado.asegurar, 1, '🔴 MUDO: no se llegó a la escritura');
  assert.equal(estado.escrituras.length, 1,
    '🔴 el `where` excluye más que la anulada: un reintento del proveedor ya no escribe. El GO era la guarda de anulada.');
  assert.equal(estado.fila.status, 'paid');
  assert.ok(puerta.llegoAlFinal(r), r.dicho.errores.join(' | '));
});
// ── LA PRIMERA BARRERA (SCRUM-502) SIGUE AHÍ ───────────────────────────────────────────
const caso1d = casosEscritos(PUERTAS, (puerta) => `SCRUM-1315 · ${puerta.nombre} · una factura que YA llega anulada no se intenta escribir (SCRUM-502)`, async (puerta) => {
  nuevaFila('annulled');
  const r = await conElFlag(true, puerta.avisoDePago);
  assert.equal(estado.asegurar, 1, '🔴 MUDO: no se llegó a la escritura');
  assert.equal(estado.fila.status, 'annulled');
  assert.equal(estado.escrituras.length, 0);
  assert.ok(puerta.llegoAlFinal(r), r.dicho.errores.join(' | '));
});
// ── LA CARRERA ─────────────────────────────────────────────────────────────────────────
const caso1e = casosEscritos(PUERTAS, (puerta) => `SCRUM-1315 · 🔴 ${puerta.nombre} · el profesional anula entre \`ensureInvoiceForCharge\` y la escritura → NO se cobra una anulada, y se DICE`, async (puerta) => {
  nuevaFila('pending');
  let anulacion = null;
  estado.alEscribir = async (a) => { if (a.data.status === 'paid') anulacion = await anular(); };
  const r = await conElFlag(true, puerta.avisoDePago);

  assert.equal(estado.asegurar, 1, '🔴 MUDO: no se llegó a la escritura');
  assert.equal(anulacion?.statusCode, 200, `precondición: la anulación de en medio entró (${JSON.stringify(anulacion?.cuerpo)})`);
  assert.equal(estado.fila.status, 'annulled',
    '🔴 UN AVISO DE PAGO HA MARCADO COBRADA UNA FACTURA ANULADA. La guarda de SCRUM-502 miró el estado '
    + 'que devolvió `ensureInvoiceForCharge`; la anulación entró antes de la escritura. El estado tiene '
    + 'que ir en el `where`.');
  assert.equal(estado.fila.paidAt, null, '🔴 la anulada lleva fecha de cobro');
  // Sólo las escrituras DE ESTADO: el sellado de la anulación escribe además su eslabón en la fila,
  // sin `status`, y eso no es lo que se mide.
  assert.deepEqual(estado.escrituras.map((e) => e.data.status).filter(Boolean), ['annulled'],
    'la única escritura de estado es la de la anulación');

  // Y SE DICE. Sin esto el arreglo queda escrito y no se entera nadie: en MercadoPago la negativa
  // caía en un `.catch(() => {})`.
  const negativas = r.dicho.errores.filter((l) => l.includes('SCRUM-1315'));
  assert.equal(negativas.length, 1,
    `🔴 la negativa NO SE HA DICHO (o se ha dicho ${negativas.length} veces). Lo que salió por console.error: `
    + `${JSON.stringify(r.dicho.errores)}`);
  assert.ok(negativas[0].includes(String(FACTURA)), 'y nombra la factura');

  // Lo demás no cambia: al proveedor se le contesta igual y el cobro se procesa entero.
  assert.ok(puerta.contestoComoSiempre(r), JSON.stringify(r.cuerpo));
  assert.ok(puerta.llegoAlFinal(r), `🔴 la negativa ha cortado el resto del aviso: ${r.dicho.errores.join(' | ')}`);
  assert.equal(estado.cobro.status, 'paid', 'el COBRO sí queda pagado: el dinero entró');
});
test('SCRUM-1315 · ① /webhooks/psp · con el flag APAGADO (lo que hay hoy) no se llega a la escritura', caso1a(0));
test('SCRUM-1315 · ✅ ① /webhooks/psp · CONTROL POSITIVO: factura pendiente y cobro confirmado → sigue marcando `paid`', caso1b(0));
test('SCRUM-1315 · ✅ ① /webhooks/psp · un reintento sobre una ya `paid` sigue escribiendo (idempotente, SCRUM-502)', caso1c(0));
test('SCRUM-1315 · ① /webhooks/psp · una factura que YA llega anulada no se intenta escribir (SCRUM-502)', caso1d(0));
test('SCRUM-1315 · 🔴 ① /webhooks/psp · el profesional anula entre `ensureInvoiceForCharge` y la escritura → NO se cobra una anulada, y se DICE', caso1e(0));
test('SCRUM-1315 · ② /webhooks/mp · con el flag APAGADO (lo que hay hoy) no se llega a la escritura', caso1a(1));
test('SCRUM-1315 · ✅ ② /webhooks/mp · CONTROL POSITIVO: factura pendiente y cobro confirmado → sigue marcando `paid`', caso1b(1));
test('SCRUM-1315 · ✅ ② /webhooks/mp · un reintento sobre una ya `paid` sigue escribiendo (idempotente, SCRUM-502)', caso1c(1));
test('SCRUM-1315 · ② /webhooks/mp · una factura que YA llega anulada no se intenta escribir (SCRUM-502)', caso1d(1));
test('SCRUM-1315 · 🔴 ② /webhooks/mp · el profesional anula entre `ensureInvoiceForCharge` y la escritura → NO se cobra una anulada, y se DICE', caso1e(1));
caso1a.todos();
caso1b.todos();
caso1c.todos();
caso1d.todos();
caso1e.todos();

// ── LOS OTROS FALLOS DE ESCRITURA: NO SE CONFUNDEN CON LA NEGATIVA ──────────────────────

const baseCaida = () => { const e = new Error('la base no contesta'); e.code = 'P1001'; return e; };

test('SCRUM-1315 · ① /webhooks/psp · un fallo de escritura que NO es la negativa se sigue diciendo como antes', async () => {
  nuevaFila('pending');
  estado.alEscribir = async () => { throw baseCaida(); };
  const r = await conElFlag(true, PUERTAS[0].avisoDePago);
  assert.equal(estado.asegurar, 1, '🔴 MUDO: no se llegó a la escritura');
  assert.equal(estado.fila.status, 'pending');
  assert.ok(r.dicho.errores.some((l) => l.includes('auto-mark invoice paid error')),
    `🔴 un fallo de la base ha dejado de salir por su mensaje de siempre: ${JSON.stringify(r.dicho.errores)}`);
  assert.equal(r.dicho.errores.some((l) => l.includes('SCRUM-1315')), false,
    '🔴 un fallo de la base se ha contado como «se anuló en medio»: eso es mentir sobre la causa');
  assert.ok(PUERTAS[0].llegoAlFinal(r));
});

test('SCRUM-1315 · ⚠️ ② /webhooks/mp · DEFECTO REPORTADO EN SCRUM-502, NO TOCADO: un fallo de escritura que no es la negativa se sigue tragando', async () => {
  // Esto NO es el comportamiento deseado: es el que hay, y está declarado (`docs/master/SCRUM-502.md`,
  // §5). Este ticket sólo le quita al `.catch` la negativa de la carrera; el resto de fallos de esa
  // escritura sigue sin decirse. Si este caso cae porque alguien lo ha arreglado, bien: que actualice
  // este caso y el de SCRUM-502 en el mismo commit.
  nuevaFila('pending');
  estado.alEscribir = async () => { throw baseCaida(); };
  const r = await conElFlag(true, PUERTAS[1].avisoDePago);
  assert.equal(estado.asegurar, 1, '🔴 MUDO: no se llegó a la escritura');
  assert.equal(estado.fila.status, 'pending', 'la factura se queda sin marcar');
  assert.deepEqual(r.dicho.errores, [],
    '⚠️ el fallo de escritura de MercadoPago ya NO se traga en silencio. Si es a propósito, actualiza '
    + 'este caso y el de `scrum502` en el mismo commit: el defecto reportado ha cambiado.');
  assert.ok(PUERTAS[1].llegoAlFinal(r), 'y el aviso se sigue procesando entero');
});

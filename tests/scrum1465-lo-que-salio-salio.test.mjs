// tests/scrum1465-lo-que-salio-salio.test.mjs — SCRUM-1465
//
// 🔴 SI EL MENSAJE SALIÓ, LA RUTA DICE QUE SALIÓ — AUNQUE FALLE LO QUE VA DESPUÉS.
//
// Enviar un presupuesto son dos pasos: mandar el mensaje al cliente y apuntar en la base que se
// mandó (borrador → enviado, y la línea del historial). Si el segundo fallaba, la ruta contestaba
// que el envío no había salido:
//
//     correo   → 200 `sent:false`, «No se pudo enviar el email. … puedes reintentarlo.»
//     WhatsApp → 500 `internal_error`
//
// El profesional lo lee, reintenta, y el cliente recibe el presupuesto DOS veces. `sent` es la
// única verdad sobre si la notificación salió (`src/lib/sendOutcome.ts`): lo decide el envío, no
// el apunte.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Los handlers REALES de `dist/`, con la base doblada (`_envio-doblado.mjs`). El WhatsApp va por
// el dry-run de la casa: pasa todos los guards y deja el mensaje en un buzón en vez de ir a Meta.
// El correo se dobla en su módulo, que es lo que la ruta importa. No sale nada a la red.
// ⚠️ Que la base falle JUSTO después de enviar lo fabrica cada caso. Lo que se mide es la ruta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTA = '../dist/modules/system/app/routes/quotesAdmin.routes.js';
const CORREO = '../dist/modules/messaging/domain/email.service.js';
const requiere = createRequire(import.meta.url);

const laBaseNoContesta = () => { throw new Error('la base no contesta'); };

/** Llama al handler de la ruta con la consola callada: los casos de fallo escriben en ella a propósito. */
async function llamar(camino) {
  const router = moduloDeDist(RUTA).default;
  assert.ok(router && Array.isArray(router.stack), '🔴 CIEGO: no encuentro el router de presupuestos');
  const capa = router.stack.find((l) => l.route && l.route.path === camino && l.route.methods.post);
  assert.ok(capa, `🔴 CIEGO: no encuentro POST ${camino}`);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: '7' }, body: {}, headers: {} }), res);
  } finally {
    console.error = error;
    console.warn = aviso;
  }
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CORREO
// ═════════════════════════════════════════════════════════════════════════════════════════

async function enviarPorCorreo({ elCorreo = async () => ({}), buscar, marcar = () => ({}) } = {}) {
  const salieron = [];
  const marcados = [];
  const fila = { id: 7, quoteNumber: 12, status: 'draft', total: '150.00', currency: 'EUR', merchantId: MERCHANT, customerId: CLIENTE, customer: { email: 'cliente@example.invalid' } };
  inyectarBase({
    'quote.findFirst': buscar ?? (() => fila),
    'quote.update': (a) => { const r = marcar(a); marcados.push(a.data); return r; },
  }, [RUTA]);
  const fCorreo = requiere.resolve(CORREO);
  requiere.cache[fCorreo] = {
    id: fCorreo, filename: fCorreo, loaded: true,
    exports: { sendQuoteEmail: async (a) => { const r = await elCorreo(a); salieron.push(a.quoteId); return r; } },
  };
  try {
    return { ...(await llamar('/:id/send-email')), salieron, marcados };
  } finally {
    delete requiere.cache[fCorreo];
  }
}

test('SCRUM-1465 · correo · SUELO: sale, se apunta y la ruta dice que salió', async () => {
  const r = await enviarPorCorreo();
  assert.equal(r.salieron.length, 1, '🔴 CIEGO: el doble del correo no ha recibido el envío');
  assert.deepEqual(r.marcados, [{ status: 'sent' }], '🔴 CIEGO: el borrador no se ha marcado como enviado');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, true);
});

test('SCRUM-1465 · correo · 🔴 el correo SALE y falla el apunte: la ruta dice que SALIÓ', async () => {
  const r = await enviarPorCorreo({ marcar: laBaseNoContesta });
  assert.equal(r.salieron.length, 1, '🔴 CIEGO: en este caso el correo tiene que haber salido');
  assert.equal(r.cuerpo.sent, true,
    `🔴 salió 1 correo y la ruta contesta sent:${r.cuerpo.sent} («${r.cuerpo.message ?? r.cuerpo.error}»): `
    + 'el profesional reintenta y el cliente lo recibe dos veces');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.error, undefined, '🔴 un envío que salió no lleva motivo de fallo');
});

test('SCRUM-1465 · correo · CONTROL: si el correo NO sale, la ruta sigue diciendo que no salió', async () => {
  const r = await enviarPorCorreo({ elCorreo: async () => { throw new Error('el proveedor de correo no contesta'); } });
  assert.equal(r.salieron.length, 0);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, 'email_send_failed');
  // La frase firmada (c.18371, forma «si no se puede distinguir»): el envío de correo contesta lo
  // mismo si el proveedor dice que no que si no contesta a tiempo, y ahí puede haber salido. Por
  // eso no afirma que no salió ni manda reenviar.
  assert.equal(r.cuerpo.message, 'No sabemos si el email ha salido. Pregúntale a tu cliente antes de volver a enviarlo.');
  assert.deepEqual(r.marcados, [], '🔴 se ha marcado como enviado un presupuesto cuyo correo no salió');
});

test('SCRUM-1465 · correo · CONTROL: si la base falla ANTES de enviar, no sale nada y no se dice que salió', async () => {
  const r = await enviarPorCorreo({ buscar: laBaseNoContesta });
  assert.equal(r.salieron.length, 0, '🔴 ha salido un correo sin haber podido leer el presupuesto');
  assert.notEqual(r.cuerpo.sent, true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL WHATSAPP — el gemelo: mismo documento, otro canal, mismo defecto
// ═════════════════════════════════════════════════════════════════════════════════════════

async function enviarPorWhatsApp({ marcar = () => ({}), dadosDeBaja = [] } = {}) {
  const marcados = [];
  const quote = {
    id: 7, merchantId: MERCHANT, customerId: CLIENTE, status: 'draft', quoteNumber: 12, total: '150.00', currency: 'EUR',
    decisionToken: 'tok-1465-de-laboratorio',
    merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null, country: 'ES' },
    customer: { id: CLIENTE, name: 'Cliente de prueba', phone: '34000000001', mobile: null },
  };
  inyectarBase({
    'quote.findUnique': () => quote,
    'customer.findMany': () => dadosDeBaja,
    'quote.update': (a) => { const r = marcar(a); marcados.push(a.data); return r; },
  }, [RUTA]);
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    return { ...(await llamar('/:id/send-whatsapp')), buzon, marcados };
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
}

test('SCRUM-1465 · WhatsApp · SUELO: sale, se apunta y la ruta dice que salió', async () => {
  const r = await enviarPorWhatsApp();
  assert.equal(r.buzon.length, 1, '🔴 CIEGO: el mensaje no ha llegado al buzón de pruebas');
  assert.deepEqual(r.marcados, [{ status: 'sent' }], '🔴 CIEGO: el borrador no se ha marcado como enviado');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, true);
});

test('SCRUM-1465 · WhatsApp · 🔴 el WhatsApp SALE y falla el apunte: la ruta dice que SALIÓ', async () => {
  const r = await enviarPorWhatsApp({ marcar: laBaseNoContesta });
  assert.equal(r.buzon.length, 1, '🔴 CIEGO: en este caso el WhatsApp tiene que haber salido');
  assert.equal(r.status, 200,
    `🔴 salió 1 WhatsApp y la ruta contesta HTTP ${r.status} (${r.cuerpo?.error}): el profesional lee un `
    + 'error, reintenta, y el cliente lo recibe dos veces');
  assert.equal(r.cuerpo.sent, true);
  assert.equal(r.cuerpo.to, '34000000001', 'y sigue diciendo a qué número salió');
});

test('SCRUM-1465 · WhatsApp · CONTROL: si NO sale (cliente dado de baja), no se apunta ni se dice que salió', async () => {
  const r = await enviarPorWhatsApp({ dadosDeBaja: [{ phone: '34000000001', mobile: null }] });
  assert.equal(r.buzon.length, 0);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, 'wa_opt_out');
  assert.deepEqual(r.marcados, [], '🔴 se ha marcado como enviado un presupuesto cuyo WhatsApp no salió');
});

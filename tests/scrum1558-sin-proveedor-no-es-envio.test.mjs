// SCRUM-1558 (a) · EN PRODUCCIÓN, SIN PROVEEDOR DE CORREO, UN `.eml` EN DISCO NO ES UN ENVÍO.
//
// `sendQuoteEmail` tiene un respaldo debajo de Resend: SMTP si hay `SMTP_URL` y, si no, un `.eml`
// en el outbox. El outbox devolvía `ok` y la ruta contestaba `sent:true`: en producción, con la
// variable de Resend vacía, la pantalla decía «enviado» de un presupuesto que no había salido.
// (El gemelo del enlace de acceso, `logMagicLink`, va en su propia rama: depende de cómo corre
// staging, y eso no está medido. Ver `docs/master/SCRUM-1558.md`.)
//
// Se mide por el camino real, con las dos mitades:
//   · NEGATIVO: producción sin Resend ni SMTP → `sendQuoteEmail` LANZA, no monta el outbox y deja
//     UNA fila de fallo.
//   · POSITIVOS: con SMTP o con Resend en producción, todo igual; fuera de producción el outbox
//     sigue exactamente como estaba.
//
// Y de punta a punta: el handler REAL de la ruta, con el `sendQuoteEmail` REAL debajo, contesta
// `sent:false` + `email_send_failed`, que es lo que las dos pantallas pintan como fallo
// (`quotesView.js` y `quotesDetailView.js` miran `waSendFailed`).
//
// Se dobla la base, el token y `nodemailer.createTransport`. NO se dobla lo que se mide:
// `sendQuoteEmail`, `registrarEnvio` y la ruta son dist/ tal cual.
// ⛔ Ni una clave real. Ni un byte de red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

// ANTES de cargar dist/: `config` lee el entorno al importarse. Los casos lo cambian sobre el
// MISMO objeto `config`, como en `scrum1299`.
process.env.RESEND_API_KEY = '';
process.env.SMTP_URL = '';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));
const axios = requiere('axios');
const nodemailer = requiere('nodemailer');

const MERCHANT = 4558;
const filas = [];
const estado = { transportes: [], envios: 0, posts: 0 };

const presupuesto = {
  id: 8558, merchantId: MERCHANT, customerId: null, quoteNumber: 15, total: '121.00', currency: 'EUR',
  merchant: { name: 'Taller', legalName: null, country: 'ES' },
  customer: { name: 'Cliente', email: 'cliente@ejemplo.invalid' },
};

const marcados = [];
const doble = dobleDeLaBase({
  'quote.findUnique': () => ({ ...presupuesto }),
  // Lo que lee la RUTA (`POST /:id/send-email`) antes de llamar a `sendQuoteEmail`.
  'quote.findFirst': () => ({
    id: presupuesto.id, quoteNumber: 15, status: 'draft', total: '121.00', currency: 'EUR',
    merchantId: MERCHANT, customerId: null, customer: { email: 'cliente@ejemplo.invalid' },
  }),
  'quote.update': (a) => { marcados.push(a.data); return {}; },
  'emailMessage.create': (a) => { const f = { id: filas.length + 1, ...a.data }; filas.push(f); return f; },
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
const fTok = rutaDe('dist/modules/quotes/domain/quoteToken.service.js');
requiere.cache[fTok] = { id: fTok, filename: fTok, loaded: true, exports: { ensureQuoteDecisionToken: async () => 'tok_1558' } };

const crearDeVerdad = nodemailer.createTransport;
nodemailer.createTransport = (opts) => {
  if (typeof opts !== 'string') { estado.transportes.push('outbox'); return crearDeVerdad(opts); }
  estado.transportes.push('smtp');
  return { sendMail: async () => { estado.envios += 1; return { messageId: '<1558@laboratorio>' }; } };
};
axios.post = async (url) => {
  estado.posts += 1;
  if (!String(url).includes('api.resend.com')) throw new Error(`🔴 el banco no esperaba un POST a ${url}`);
  return { data: { id: 're_1558' } };
};

const { config } = requiere(path.join(RAIZ, 'dist/core/config/env.js'));
const { sendQuoteEmail } = requiere(path.join(RAIZ, 'dist/modules/messaging/domain/email.service.js'));
const { outboxDir } = requiere(path.join(RAIZ, 'dist/core/storage/dirs.js'));

function reiniciar({ entorno, resendKey = '', smtpUrl = '' }) {
  filas.length = 0;
  Object.assign(estado, { transportes: [], envios: 0, posts: 0 });
  config.NODE_ENV = entorno;
  config.RESEND_API_KEY = resendKey;
  config.SMTP_URL = smtpUrl;
}
const enviar = () => sendQuoteEmail({ quoteId: presupuesto.id, prisma: doble });
const EML = path.join(outboxDir, `quote-${presupuesto.id}.eml`);

test('SCRUM-1558 · SUELO: fuera de producción y sin proveedor, el outbox sigue como estaba', async () => {
  reiniciar({ entorno: 'development' });
  const r = await enviar();
  assert.deepEqual(estado.transportes, ['outbox'], '🔴 CIEGO: el banco no llega al outbox, el negativo mediría otro camino.');
  assert.equal(r.smtp, false, `🔴 el outbox de dev ha cambiado su respuesta: ${JSON.stringify(r)}`);
  assert.match(String(r.eml), /^\/outbox\/quote-8558\.eml$/);
  fs.rmSync(EML, { force: true });
});

test('SCRUM-1558 · 🔴 producción sin Resend ni SMTP: el presupuesto NO cuenta como enviado', async () => {
  reiniciar({ entorno: 'production' });
  await assert.rejects(enviar(), /sin_transporte/,
    '🔴 en producción, sin proveedor, sendQuoteEmail no lanza: la ruta contestará «enviado» de un correo que no salió.');
  assert.deepEqual(estado.transportes, [], '🔴 se ha montado el outbox en producción.');
  assert.equal(fs.existsSync(EML), false, '🔴 se ha escrito un .eml en el outbox de producción.');
  assert.equal(filas.length, 1, `🔴 el «no había por dónde» deja ${filas.length} filas: el aviso de Cobros no lo verá.`);
  assert.equal(filas[0].status, 'fallo_envio');
  assert.equal(filas[0].relatedType, 'quote');
  assert.equal(filas[0].relatedId, presupuesto.id);
});

/** El handler REAL de `POST /admin/quotes/:id/send-email`, con el `sendQuoteEmail` REAL debajo. */
async function laRutaContesta() {
  const router = requiere(path.join(RAIZ, 'dist/modules/system/app/routes/quotesAdmin.routes.js')).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/send-email' && l.route.methods.post);
  assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/send-email');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
  const error = console.error;
  console.error = () => {};
  try {
    await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: String(presupuesto.id) }, body: {}, headers: {} }), res);
  } finally {
    console.error = error;
  }
  return r;
}

test('SCRUM-1558 · 🔴 la ruta, de punta a punta: producción sin proveedor → la pantalla recibe «no salió»', async () => {
  reiniciar({ entorno: 'production' });
  marcados.length = 0;
  const r = await laRutaContesta();
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, false,
    `🔴 la ruta contesta sent:${r.cuerpo.sent} de un correo que no salió: la pantalla pintará «enviado».`);
  assert.equal(r.cuerpo.error, 'email_send_failed');
  assert.deepEqual(marcados, [], '🔴 el borrador se ha marcado como enviado sin haber salido.');
});

test('SCRUM-1558 · CONTROL: la misma ruta CON Resend en producción contesta que salió', async () => {
  reiniciar({ entorno: 'production', resendKey: 're_test_1558_no_sale' });
  marcados.length = 0;
  const r = await laRutaContesta();
  assert.equal(r.cuerpo.sent, true, `🔴 CIEGO: con proveedor la ruta no dice que salió: ${JSON.stringify(r.cuerpo)}`);
  assert.deepEqual(marcados, [{ status: 'sent' }]);
});

test('SCRUM-1558 · CONTROL: en producción CON SMTP, el respaldo SMTP sale como antes', async () => {
  reiniciar({ entorno: 'production', smtpUrl: 'smtp://yaqu-1558.invalid:2525' });
  const r = await enviar();
  assert.deepEqual(estado.transportes, ['smtp']);
  assert.equal(estado.envios, 1);
  assert.equal(r.smtp, true, `🔴 el SMTP en producción ha cambiado su respuesta: ${JSON.stringify(r)}`);
});

test('SCRUM-1558 · CONTROL: en producción CON Resend, sale por Resend y no toca el respaldo', async () => {
  reiniciar({ entorno: 'production', resendKey: 're_test_1558_no_sale' });
  const r = await enviar();
  assert.equal(estado.posts, 1);
  assert.deepEqual(estado.transportes, []);
  assert.equal(r.resend, true, `🔴 con Resend en producción la respuesta ya no es la de Resend: ${JSON.stringify(r)}`);
});


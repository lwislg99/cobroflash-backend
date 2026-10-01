// SCRUM-1299 · EL RESPALDO SMTP DE LOS DOS CORREOS CON DOCUMENTO TAMBIÉN DEJA FILA.
//
// `sendInvoiceEmail` y `sendQuoteEmail` (`email.service.ts`) tienen un respaldo propio debajo de
// Resend: SMTP si hay `SMTP_URL` y, si no, un `.eml` en el outbox de dev. Hasta este ticket ese
// respaldo mandaba con `transporter.sendMail` a pelo y NO escribía en `email_messages` ni cuando
// salía ni cuando fallaba — mientras que `enviarCorreo`, por el mismo SMTP, sí lo hace. El aviso de
// Cobros (SCRUM-1235) lee esas filas: sin ellas, un fallo por SMTP no avisa nunca.
//
// Y hasta hoy el guard de SCRUM-508 estaba VERDE con el hueco dentro: su censo mira las llamadas a
// `enviarCorreo`/`enviarPorResend`, y los dos `sendMail` directos no le eran visibles. El censo C
// (`censarSendMailDirectos`, en `_censo-emisores-con-fila.mjs`) los cuenta ahora; aquí se mide el
// COMPORTAMIENTO por el camino real, con las dos mitades:
//
//   · el SMTP deja UNA fila al salir (`aceptado_sin_identificador`, como `enviarCorreo`) y UNA al
//     fallar (`fallo_envio`), y el fallo sube igual que antes;
//   · el fallo del PDF sin Resend pero con SMTP también deja fila (la guarda de 1243 era «sólo con
//     Resend» porque el respaldo no escribía el «salió»; ahora lo escribe);
//   · CONTROLES: con Resend, un fallo de Resend deja UNA fila y no dos, y no toca el SMTP (el mismo
//     control que cerró 1243); y el outbox `.eml` sigue exactamente como estaba (fuera de alcance:
//     cambiar su retorno afecta a psp, mercadopago, admin y dev.routes, y es otra decisión).
//
// Se dobla la base (con estado), el PDF y `nodemailer.createTransport`. NO se dobla lo que se mide:
// `sendInvoiceEmail`, `sendQuoteEmail`, `enviarPorResend` y `registrarEnvio` son dist/ tal cual.
// ⛔ Ni una clave real. Ni un byte de red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { temporal } from './_temporal.mjs';

// ANTES de cargar dist/: `config` lee el entorno al importarse. Se arranca en el caso del
// respaldo —sin Resend, con SMTP— y los controles lo cambian sobre el MISMO objeto `config`.
process.env.RESEND_API_KEY = '';
process.env.SMTP_URL = 'smtp://yaqu-1299.invalid:2525';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));
const axios = requiere('axios');
const nodemailer = requiere('nodemailer');

const MERCHANT = 4299;
const DIR = temporal('yaqu-1299-');
const PDF = path.join(DIR, 'f.pdf');
fs.writeFileSync(PDF, '%PDF-1.4\n%laboratorio 1299\n');

const filas = [];
const estado = { smtp: 'acepta', pdf: 'ok', resend: 'falla', envios: 0, posts: 0, transportes: [] };

const factura = { id: 7299, merchantId: MERCHANT, customerId: 55, number: 'F269901', status: 'issued' };
const presupuesto = {
  id: 8299, merchantId: MERCHANT, customerId: null, quoteNumber: 12, total: '121.00', currency: 'EUR',
  merchant: { name: 'Taller', legalName: null, country: 'ES' },
  customer: { name: 'Cliente', email: 'cliente@ejemplo.invalid' },
};

const doble = dobleDeLaBase({
  'invoice.findUnique': () => ({ ...factura }),
  'quote.findUnique': () => ({ ...presupuesto }),
  'emailMessage.create': (a) => { const f = { id: filas.length + 1, ...a.data }; filas.push(f); return f; },
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

const fInv = rutaDe('dist/lib/invoicing.js');
requiere.cache[fInv] = {
  id: fInv, filename: fInv, loaded: true,
  exports: {
    ensureInvoicePdf: async () => {
      if (estado.pdf === 'revienta') throw new Error('EACCES: el disco no deja leer');
      return { diskPath: estado.pdf === 'falta' ? path.join(DIR, 'no-existe.pdf') : PDF, pdfUrl: '/x.pdf' };
    },
  },
};
const fTok = rutaDe('dist/modules/quotes/domain/quoteToken.service.js');
requiere.cache[fTok] = { id: fTok, filename: fTok, loaded: true, exports: { ensureQuoteDecisionToken: async () => 'tok_1299' } };

// El transporte: con `SMTP_URL` (string) es el SMTP real, que aquí acepta o falla; con el objeto
// de `streamTransport` es el outbox, y se le deja el comportamiento de nodemailer de verdad.
const crearDeVerdad = nodemailer.createTransport;
nodemailer.createTransport = (opts) => {
  if (typeof opts !== 'string') { estado.transportes.push('outbox'); return crearDeVerdad(opts); }
  estado.transportes.push('smtp');
  return {
    sendMail: async () => {
      estado.envios += 1;
      if (estado.smtp === 'falla') { const e = new Error('connect ECONNREFUSED 1.2.3.4:2525'); e.code = 'ECONNREFUSED'; throw e; }
      return { messageId: '<1299@laboratorio>', accepted: ['cliente@ejemplo.invalid'] };
    },
  };
};
axios.post = async (url) => {
  estado.posts += 1;
  if (!String(url).includes('api.resend.com')) throw new Error(`🔴 el banco no esperaba un POST a ${url}`);
  if (estado.resend === 'falla') { const e = new Error('Request failed with status code 503'); e.code = 'ERR_BAD_RESPONSE'; throw e; }
  return { data: { id: 're_1299' } };
};

const { config } = requiere(path.join(RAIZ, 'dist/core/config/env.js'));
const { sendInvoiceEmail, sendQuoteEmail } = requiere(path.join(RAIZ, 'dist/modules/messaging/domain/email.service.js'));
const { outboxDir } = requiere(path.join(RAIZ, 'dist/core/storage/dirs.js'));
const { CLASES_DE_CORREO } = requiere(path.join(RAIZ, 'dist/modules/messaging/domain/registroDeEnvios.js'));

function reiniciar({ smtp = 'acepta', pdf = 'ok', resend = 'falla', resendKey = '', smtpUrl = 'smtp://yaqu-1299.invalid:2525' } = {}) {
  filas.length = 0;
  Object.assign(estado, { smtp, pdf, resend, envios: 0, posts: 0, transportes: [] });
  config.RESEND_API_KEY = resendKey;
  config.SMTP_URL = smtpUrl;
}
const factura1299 = () => sendInvoiceEmail({ invoiceId: factura.id, toEmail: 'cliente@ejemplo.invalid', prisma: doble });

test('SCRUM-1299 · 🔴 SUELO: el banco llega al respaldo SMTP, no al outbox ni a Resend', async () => {
  reiniciar();
  const r = await factura1299();
  assert.deepEqual(estado.transportes, ['smtp'], '🔴 el banco no ejercita el SMTP: el resto de casos medirían otro camino.');
  assert.equal(estado.envios, 1, '🔴 el SMTP doblado no recibió el envío.');
  assert.equal(estado.posts, 0, '🔴 sin RESEND_API_KEY no debería salir nada hacia Resend.');
  assert.equal(r.smtp, true, `🔴 la respuesta ya no es la del SMTP: ${JSON.stringify(r)}`);
});

test('SCRUM-1299 · 🔴 factura por SMTP que SALE: UNA fila, aceptada sin identificador', async () => {
  reiniciar();
  await factura1299();
  assert.equal(filas.length, 1,
    `🔴 el SMTP de sendInvoiceEmail deja ${filas.length} filas al salir. El respaldo manda la factura y `
    + 'nadie puede decir después que salió; y un fallo previo suyo no se apagaría nunca.');
  assert.equal(filas[0].status, 'aceptado_sin_identificador', `🔴 estado ${filas[0].status}: SMTP no da acuse, y se dice.`);
  assert.equal(filas[0].kind, CLASES_DE_CORREO.factura);
  assert.equal(filas[0].relatedType, 'invoice');
  assert.equal(filas[0].relatedId, factura.id);
  assert.equal(filas[0].merchantId, MERCHANT);
});

test('SCRUM-1299 · 🔴 factura por SMTP que FALLA: UNA fila de fallo, y la excepción sube igual', async () => {
  reiniciar({ smtp: 'falla' });
  await assert.rejects(factura1299(), /ECONNREFUSED/,
    '🔴 el fallo del SMTP ya no sube: sus llamadores (psp, mp, admin) lo detectan por la excepción.');
  assert.equal(filas.length, 1, `🔴 un fallo del SMTP deja ${filas.length} filas: el aviso de Cobros no lo verá.`);
  assert.equal(filas[0].status, 'fallo_envio');
  assert.equal(filas[0].kind, CLASES_DE_CORREO.factura);
});

test('SCRUM-1299 · 🔴 sin Resend pero con SMTP, el PDF que falta TAMBIÉN deja fila', async () => {
  for (const pdf of ['falta', 'revienta']) {
    reiniciar({ pdf });
    await assert.rejects(factura1299(), `🔴 con el PDF «${pdf}» sendInvoiceEmail ya no lanza.`);
    assert.equal(filas.length, 1, `🔴 PDF «${pdf}» sin Resend: ${filas.length} filas. La guarda de 1243 seguía `
      + 'exigiendo Resend, y con SMTP ya hay un «salió» que apaga el aviso.');
    assert.equal(filas[0].status, 'fallo_envio');
    assert.equal(estado.envios, 0, '🔴 con el PDF roto no debería intentarse el envío.');
  }
});

test('SCRUM-1299 · 🔴 presupuesto por SMTP: UNA fila al salir y UNA al fallar', async () => {
  reiniciar();
  await sendQuoteEmail({ quoteId: presupuesto.id, prisma: doble });
  assert.equal(filas.length, 1, `🔴 el SMTP de sendQuoteEmail deja ${filas.length} filas al salir (mismo hueco que la factura).`);
  assert.equal(filas[0].status, 'aceptado_sin_identificador');
  assert.equal(filas[0].kind, CLASES_DE_CORREO.presupuesto);
  assert.equal(filas[0].relatedType, 'quote');
  assert.equal(filas[0].relatedId, presupuesto.id);

  reiniciar({ smtp: 'falla' });
  await assert.rejects(sendQuoteEmail({ quoteId: presupuesto.id, prisma: doble }), /ECONNREFUSED/);
  assert.equal(filas.length, 1, `🔴 un fallo del SMTP de sendQuoteEmail deja ${filas.length} filas.`);
  assert.equal(filas[0].status, 'fallo_envio');
});

test('SCRUM-1299 · CONTROL: con Resend, un fallo de Resend deja UNA fila y no dos, y no toca el SMTP', async () => {
  reiniciar({ resendKey: 're_test_1299_no_sale', resend: 'falla' });
  await assert.rejects(factura1299());
  assert.equal(estado.posts, 1, '🔴 el control no pasó por Resend.');
  assert.deepEqual(estado.transportes, [], '🔴 con Resend configurado se ha montado un transporte SMTP.');
  assert.equal(filas.length, 1, `🔴 un fallo de Resend deja ${filas.length} filas: la escribe enviarPorResend y nadie más.`);
  assert.equal(filas[0].status, 'fallo_envio');

  reiniciar({ resendKey: 're_test_1299_no_sale', resend: 'acepta' });
  await factura1299();
  assert.equal(filas.length, 1, `🔴 un envío bueno por Resend deja ${filas.length} filas.`);
  assert.equal(filas[0].status, 'aceptado_sin_confirmacion');
});

test('SCRUM-1299 · CONTROL: el outbox .eml (sin Resend ni SMTP) sigue como estaba — fuera de alcance', async () => {
  reiniciar({ smtpUrl: '' });
  const r = await factura1299();
  assert.deepEqual(estado.transportes, ['outbox']);
  assert.equal(r.smtp, false, `🔴 el outbox ha cambiado su respuesta: ${JSON.stringify(r)}. Cambiar su retorno es otra `
    + 'decisión (afecta a psp, mercadopago, admin y dev.routes) y no es de este ticket.');
  assert.match(String(r.eml), /^\/outbox\/invoice-F269901\.eml$/);
  fs.rmSync(path.join(outboxDir, 'invoice-F269901.eml'), { force: true });
});

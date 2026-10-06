// tests/scrum1444-el-numero-de-la-pagina-es-el-del-papel.test.mjs — SCRUM-1444
//
// 🔴 LA REVISIÓN DE UN PRESUPUESTO SE LLAMABA COMO SU ORIGINAL EN TODO LO QUE NO ES EL PAPEL.
//
// SCRUM-688 hizo que el PDF de una revisión diga `#12.1` («el cliente recibía dos documentos que
// se llaman igual, que es exactamente lo que las revisiones existen para evitar»). La página donde
// el cliente firma —desde la que se abre ese PDF— y el correo que se lo lleva se quedaron atrás:
// pintaban `quoteNumber ?? id` a pelo, o sea `#12` para la original y para su revisión. Lo mismo
// los tres mensajes de WhatsApp que la página le deja escritos al cliente para su profesional, que
// en el panel tiene las dos y no sabe de cuál le hablan.
//
// ── LO QUE ESTE TEST NO DICE ──────────────────────────────────────────────────────────────
// No compara contra el PDF: afirma la regla que `pdf.service.ts` (J1) tiene escrita, y si aquélla
// cambia este test sigue verde. El papel se mide en `tests/scrum688-crear-revision.test.mjs`.
// Tampoco toca el respaldo al `id` de un presupuesto sin número: lo fija tal como está el papel.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Las rutas REALES de `dist/` con `prisma.quote.findUnique` doblado (el arnés de `scrum1431`), y
// `sendQuoteEmail` con el cliente de Prisma que recibe POR PARÁMETRO. El rechazo llama por HTTP a
// `PUBLIC_BASE_URL`: se le pone un servidor local ANTES de cargar `dist/` (se lee al importar).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

// Sin clave ni SMTP, el correo va al `.eml` del outbox, que es lo que se lee aquí (y no sale).
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_URL;

/** La API a la que la página reenvía el rechazo: contesta que sí y apunta lo que le llegó. */
const llamadasALaApi = [];
const api = http.createServer((req, res) => {
  llamadasALaApi.push(`${req.method} ${req.url}`);
  req.resume();
  res.setHeader('Content-Type', 'application/json');
  res.end('{"ok":true}');
});
await new Promise((r) => api.listen(0, '127.0.0.1', r));
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${api.address().port}`;
test.after(() => new Promise((r) => api.close(r)));

const { prisma } = await import('../dist/core/db/prisma.js');
const { quoteDecisionLandingRouter } = await import('../dist/modules/system/app/routes/quoteDecisionLanding.routes.js');
const { sendQuoteEmail } = await import('../dist/modules/messaging/domain/email.service.js');
const { outboxDir } = await import('../dist/core/storage/dirs.js');
const { numeroQueImprimeElPapel } = await import('../dist/modules/quotes/domain/revision.js');

const TOKEN = 'abcdef0123456789abcdef0123456789';
const merchant = {
  id: 77, email: 'obra@ejemplo.es', flags: null, name: 'Electricidad', legalName: null, logoUrl: null,
  address: null, country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: '34000000001', // el rango imposible de SCRUM-262
  timezone: 'Europe/Madrid', clausulasPresupuesto: null,
};
const lines = [{ concept: 'Cuadro', qty: 1, price: 100, tax: 0.21 }];
/** Un presupuesto ENVIADO y vigente; cada caso cambia sólo lo suyo. */
const presupuesto = (cambios = {}) => ({
  id: 987654, quoteNumber: 12, revision: 0, currency: 'EUR', total: 121, status: 'sent', decisionToken: TOKEN,
  createdAt: new Date('2026-09-20T10:00:00Z'), validUntil: new Date('2099-01-01T00:00:00Z'),
  paymentTerms: 'FULL', customBillingPlan: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null,
  merchantId: 77, customerId: null, merchant, customer: { name: 'Cliente', email: 'cliente@ejemplo.es' },
  lines, tiers: null, ...cambios,
});

/** Lo que contesta una ruta de la página con ESE presupuesto en la base. */
async function pagina(metodo, ruta, quote, body) {
  // La portada se declara con una LISTA de rutas (`/quote/:token` y su `/accept`): se casa por pertenencia.
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route?.methods?.[metodo] && [l.route.path].flat().includes(ruta));
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta}`);
  const original = prisma.quote.findUnique;
  prisma.quote.findUnique = async () => quote;
  let html = '';
  const res = { setHeader() { return res; }, status() { return res; }, send(b) { html = String(b); return res; }, redirect() { return res; } };
  const manejador = capa.route.stack[capa.route.stack.length - 1].handle; // el último: delante va el parser del formulario
  try { await manejador({ params: { token: TOKEN }, query: {}, headers: {}, body }, res); }
  finally { prisma.quote.findUnique = original; }
  assert.ok(html.length > 0, '🔴 CIEGO: la ruta no ha contestado nada');
  return html;
}
const ver = (quote) => pagina('get', '/quote/:token', quote);

/** El texto que un enlace de WhatsApp de la página le deja escrito al cliente. */
function mensajesDeWhatsApp(html) {
  const textos = [...html.matchAll(/https:\/\/wa\.me\/34000000001\?text=([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
  assert.ok(textos.length > 0, '🔴 CIEGO: la página no trae ningún enlace de WhatsApp al profesional');
  return textos;
}

test('SCRUM-1444 · CONTROL: el original se llama «#12», sin «.0» y sin sufijo', async () => {
  const html = await ver(presupuesto());
  assert.match(html, /class="quote-meta"[^>]*>Presupuesto #12</);
});

test('SCRUM-1444 · 🔴 la página de una revisión dice «#12.1», como su papel', async () => {
  const html = await ver(presupuesto({ revision: 1 }));
  assert.match(html, /class="quote-meta"[^>]*>Presupuesto #12\.1</,
    '🔴 la página llama a la revisión igual que al original, y el PDF que se abre desde ella dice #12.1');
});

test('SCRUM-1444 · 🔴 «Tengo una duda» nombra la revisión por la que se pregunta', async () => {
  const [duda] = mensajesDeWhatsApp(await ver(presupuesto({ revision: 2 })));
  assert.equal(duda, 'Hola, tengo una duda sobre el presupuesto #12.2');
});

test('SCRUM-1444 · 🔴 el mensaje de un presupuesto CADUCADO nombra su revisión', async () => {
  const html = await ver(presupuesto({ revision: 1, validUntil: new Date('2026-01-01T00:00:00Z') }));
  assert.ok(html.includes('caducó'), '🔴 CIEGO: no ha salido la página de caducado');
  assert.deepEqual(mensajesDeWhatsApp(html), ['Hola, el presupuesto #12.1 caducó, ¿me pasas uno actualizado?']);
});

test('SCRUM-1444 · 🔴 el mensaje de un presupuesto RECHAZADO nombra su revisión', async () => {
  const html = await ver(presupuesto({ revision: 1, status: 'rejected', rejectedAt: new Date('2026-09-21T10:00:00Z') }));
  assert.ok(html.includes('Rechazaste'), '🔴 CIEGO: no ha salido la página de rechazado');
  assert.deepEqual(mensajesDeWhatsApp(html), ['Hola, sobre el presupuesto #12.1: he cambiado de opinión, ¿me lo reenvías?']);
});

test('SCRUM-1444 · 🔴 «Hemos registrado el rechazo» nombra la revisión rechazada', async () => {
  const antes = llamadasALaApi.length;
  const html = await pagina('post', '/quote/:token/reject', presupuesto({ revision: 1 }), { reason: 'price' });
  assert.equal(llamadasALaApi.length, antes + 1, '🔴 CIEGO: el rechazo no ha llegado a la API de prueba');
  assert.match(html, /Hemos registrado el rechazo del presupuesto <strong[^>]*>#12\.1</);
});

test('SCRUM-1444 · un presupuesto SIN número sigue como en el papel: el id, y sin revisión pegada', async () => {
  const html = await ver(presupuesto({ quoteNumber: null, revision: 1 }));
  assert.match(html, /class="quote-meta"[^>]*>Presupuesto #987654</);
});

/** El `.eml` guarda el HTML en quoted-printable: sin decodificar, un salto blando parte el número. */
function decodificarQP(eml) {
  const sinSaltos = eml.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < sinSaltos.length; i++) {
    const m = sinSaltos[i] === '=' && /^[0-9A-F]{2}$/.test(sinSaltos.slice(i + 1, i + 3));
    if (m) { bytes.push(parseInt(sinSaltos.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(...Buffer.from(sinSaltos[i], 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
}

/** El correo del presupuesto, leído del outbox. El cliente de Prisma es un doble: no hay base. */
async function correo(quote) {
  const doble = { quote: { findUnique: async () => quote, update: async () => { throw new Error('el doble no escribe'); } } };
  const fichero = path.join(outboxDir, `quote-${quote.id}.eml`);
  try {
    const r = await sendQuoteEmail({ quoteId: quote.id, prisma: doble });
    assert.equal(r.smtp, false, '🔴 CIEGO: el correo no ha ido al outbox');
    return decodificarQP(fs.readFileSync(fichero, 'utf8'));
  } finally { fs.rmSync(fichero, { force: true }); }
}

test('SCRUM-1444 · CONTROL: el correo del original dice «#12»', async () => {
  const eml = await correo(presupuesto());
  assert.match(eml, /^Subject: Tu presupuesto #12 de Electricidad$/m);
  assert.match(eml, /te ha preparado el presupuesto <strong[^>]*>#12</);
});

test('SCRUM-1444 · 🔴 el correo de una revisión dice «#12.1» en el asunto y en el cuerpo', async () => {
  const eml = await correo(presupuesto({ revision: 1 }));
  assert.match(eml, /^Subject: Tu presupuesto #12\.1 de Electricidad$/m,
    '🔴 el asunto llama a la revisión igual que al original');
  assert.match(eml, /te ha preparado el presupuesto <strong[^>]*>#12\.1</,
    '🔴 el cuerpo llama a la revisión igual que al original');
});

test('SCRUM-1444 · la regla, caso a caso: revisión 0 sin sufijo, sin número el id pelado', () => {
  assert.equal(numeroQueImprimeElPapel({ id: 5, quoteNumber: 12, revision: 0 }), '12');
  assert.equal(numeroQueImprimeElPapel({ id: 5, quoteNumber: 12 }), '12');
  assert.equal(numeroQueImprimeElPapel({ id: 5, quoteNumber: 12, revision: 3 }), '12.3');
  assert.equal(numeroQueImprimeElPapel({ id: 5, quoteNumber: null, revision: 3 }), '5');
});

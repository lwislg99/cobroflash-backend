// tests/scrum1476-titulos-de-la-pagina-del-locale.test.mjs — SCRUM-1476
//
// 🔴 «PRESUPUESTO YA ACEPTADA»: EL TÍTULO DE LA PESTAÑA SE COMPONÍA CON PALABRA + PARTICIPIO.
//
// La página pública de un presupuesto que ya no se puede firmar (caducado, aceptado o rechazado)
// titulaba la pestaña con `${locale.quote} caducada`, `… ya aceptada` y `… rechazada`. El
// participio iba fijo en femenino, que concuerda con «Cotización» y no con «Presupuesto»: en
// España los tres se leían mal, y lo lee el cliente final.
//
// No se arregla pegando otra terminación. La palabra del documento cambia de género por país, así
// que una frase hecha de palabra + participio se rompe en la mitad de ellos (regla de SCRUM-1443).
// La frase ENTERA viene del locale: cada país escribe la suya.
//
// ── LO QUE ESTE TEST NO DICE ──────────────────────────────────────────────────────────────
// Sólo mira los tres títulos. Las demás frases de la página que concuerdan con el documento
// («este presupuesto», «pide uno actualizado»…) se leen bien en España y están nombradas en el
// ticket, sin tocar.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La ruta REAL de `dist/` con `prisma.quote.findUnique` doblado (el arnés de `scrum1444`).
import test from 'node:test';
import assert from 'node:assert/strict';

const { prisma } = await import('../dist/core/db/prisma.js');
const { quoteDecisionLandingRouter } = await import('../dist/modules/system/app/routes/quoteDecisionLanding.routes.js');
const { getLocale } = await import('../dist/core/i18n/locales.js');

const TOKEN = 'abcdef0123456789abcdef0123456789';
const negocio = (country) => ({
  id: 77, email: 'obra@ejemplo.es', flags: null, name: 'Electricidad', legalName: null, logoUrl: null,
  address: null, country, brandColor: null, brandAccentColor: null, whatsappPhone: '34000000001', // el rango imposible de SCRUM-262
  timezone: 'Europe/Madrid', clausulasPresupuesto: null,
});
/** Un presupuesto ENVIADO y vigente; cada caso cambia sólo lo suyo. */
const presupuesto = (country, cambios = {}) => ({
  id: 987654, quoteNumber: 12, revision: 0, currency: 'EUR', total: 121, status: 'sent', decisionToken: TOKEN,
  createdAt: new Date('2026-09-20T10:00:00Z'), validUntil: new Date('2099-01-01T00:00:00Z'),
  paymentTerms: 'FULL', customBillingPlan: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null,
  merchantId: 77, customerId: null, merchant: negocio(country), customer: { name: 'Cliente', email: 'cliente@ejemplo.es' },
  lines: [{ concept: 'Cuadro', qty: 1, price: 100, tax: 0.21 }], tiers: null, ...cambios,
});
const caducado = (country) => presupuesto(country, { validUntil: new Date('2026-01-01T00:00:00Z') });
const aceptado = (country) => presupuesto(country, { status: 'accepted', acceptedAt: new Date('2026-09-21T10:00:00Z') });
const rechazado = (country) => presupuesto(country, { status: 'rejected', rejectedAt: new Date('2026-09-21T10:00:00Z') });

/** El título de la pestaña y el cuerpo que contesta la portada con ESE presupuesto en la base. */
async function pestana(quote) {
  // La portada se declara con una LISTA de rutas (`/quote/:token` y su `/accept`): se casa por pertenencia.
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route?.methods?.get && [l.route.path].flat().includes('/quote/:token'));
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /quote/:token');
  const original = prisma.quote.findUnique;
  prisma.quote.findUnique = async () => quote;
  let html = '';
  const res = { setHeader() { return res; }, status() { return res; }, send(b) { html = String(b); return res; }, redirect() { return res; } };
  const manejador = capa.route.stack[capa.route.stack.length - 1].handle;
  try { await manejador({ params: { token: TOKEN }, query: {}, headers: {} }, res); }
  finally { prisma.quote.findUnique = original; }
  const titulo = html.match(/<title[^>]*>([^<]*)<\/title>/);
  assert.ok(titulo, '🔴 CIEGO: la página no trae <title>');
  return { titulo: titulo[1], html };
}

test('SCRUM-1476 · SUELO: cada caso llega a SU página (caducado, aceptado y rechazado), no a la de firmar', async () => {
  // Si un caso cayera en el formulario de firma, su título sería «Aceptar presupuesto» y los
  // asertos de abajo compararían otra página.
  assert.match((await pestana(caducado('ES'))).html, /Este presupuesto caducó/);
  assert.match((await pestana(aceptado('ES'))).html, /Ya aceptaste este presupuesto/);
  assert.match((await pestana(rechazado('ES'))).html, /Rechazaste este presupuesto/);
  assert.equal((await pestana(presupuesto('ES'))).titulo, 'Aceptar presupuesto', 'control: el vigente sí va al formulario');
});

test('SCRUM-1476 · 🔴 España: la pestaña de un presupuesto ya aceptado dice «Presupuesto ya aceptado»', async () => {
  assert.equal((await pestana(aceptado('ES'))).titulo, 'Presupuesto ya aceptado',
    '🔴 el participio no concuerda con «Presupuesto»: lo lee el cliente final en la pestaña');
});

test('SCRUM-1476 · 🔴 España: la pestaña de un presupuesto caducado dice «Presupuesto caducado»', async () => {
  assert.equal((await pestana(caducado('ES'))).titulo, 'Presupuesto caducado');
});

test('SCRUM-1476 · 🔴 España: la pestaña de un presupuesto rechazado dice «Presupuesto rechazado»', async () => {
  assert.equal((await pestana(rechazado('ES'))).titulo, 'Presupuesto rechazado');
});

test('SCRUM-1476 · México: las tres pestañas dicen lo mismo que antes, con «Cotización» en femenino', async () => {
  assert.deepEqual(
    [(await pestana(caducado('MX'))).titulo, (await pestana(aceptado('MX'))).titulo, (await pestana(rechazado('MX'))).titulo],
    ['Cotización caducada', 'Cotización ya aceptada', 'Cotización rechazada'],
  );
});

test('SCRUM-1476 · 🔴 la frase ENTERA sale del locale: el título de cada país es su campo, sin componer', async () => {
  for (const pais of ['ES', 'MX']) {
    const l = getLocale(pais);
    assert.deepEqual(
      [(await pestana(caducado(pais))).titulo, (await pestana(aceptado(pais))).titulo, (await pestana(rechazado(pais))).titulo],
      [l.quoteExpiredTitle, l.quoteAcceptedTitle, l.quoteRejectedTitle],
      `🔴 ${pais}: la ruta no lee el título del locale`,
    );
  }
});

test('SCRUM-1476 · los seis países llevan sus tres frases firmadas, completas', () => {
  const frases = (pais) => {
    const l = getLocale(pais);
    return [l.quoteExpiredTitle, l.quoteAcceptedTitle, l.quoteRejectedTitle];
  };
  const masculino = ['Presupuesto caducado', 'Presupuesto ya aceptado', 'Presupuesto rechazado'];
  const femenino = ['Cotización caducada', 'Cotización ya aceptada', 'Cotización rechazada'];
  assert.deepEqual(
    { ES: frases('ES'), AR: frases('AR'), MX: frases('MX'), CO: frases('CO'), PE: frases('PE'), CL: frases('CL') },
    { ES: masculino, AR: masculino, MX: femenino, CO: femenino, PE: femenino, CL: femenino },
  );
});

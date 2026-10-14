// tests/scrum1302p-la-pagina-de-una-revision-antigua.test.mjs — SCRUM-1302, la mitad de la PÁGINA.
//
// Medido el 13-oct-2026 (guion `docs/master/evidencias/SCRUM-1302/revision-vieja/`): con una .1 en el
// grupo, el enlace de la .0 pintaba el formulario de firma con el total VIEJO, y nadie preguntaba por
// el grupo. Desde aquí, el enlace de una versión con otra más reciente pinta SÓLO el aviso.
//
// Literales y conducta firmados por el orquestador por delegación del fundador (SCRUM-1302, c.19454;
// aplicable desde c.19475, con el aviso del panel: `scrum1302p-el-aviso-antes-de-crear-la-revision`).
// ⛔ Aquí sólo el GET: rechazar el POST de una no vigente es de S1.
//
// Rutas reales de `dist`, base doblada. El doble de `quote.count` EVALÚA el `where` que le llega
// (negocio, número, año de la serie y `revision > n`) sobre una tabla en memoria: si la página
// preguntara por otro grupo, contaría otra cosa y el caso del año lo cazaría.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.WHATSAPP_DRY_RUN = '1';
const { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } = await import('./_envio-doblado.mjs');
const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';

// Las mutaciones que este fichero tiene que cazar; las corre `npm run meta:mutaciones` en cada PR.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · la página pregunta pero no hace caso: vuelve el formulario en el enlace viejo.
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: "return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(paginaDeVersionAntigua(quote, locale, brandColor));",
    a: 'void paginaDeVersionAntigua;',
    cae: 'el enlace de la .0 habiendo .1: SÓLO el aviso',
  },
  {
    // M2 · el grupo pierde el año de la serie (SCRUM-1490): la .1 de otro año haría antigua a la .0.
    fichero: 'src/modules/quotes/domain/versionMasReciente.ts',
    de: '...whereDelGrupo({ merchantId: q.merchantId, quoteNumber: q.quoteNumber, anio: anioDeLaSerie(q, merchant) }, merchant),',
    a: "merchantId: q.merchantId, quoteNumber: q.quoteNumber, ...(String(merchant) === 'x' ? whereDelGrupo({ merchantId: 0, quoteNumber: 0, anio: anioDeLaSerie(q) }) : {}),",
    cae: 'el grupo es por AÑO de la serie',
  },
  {
    // M3 · se deja fuera `expired` (c.19636): la vieja ya barrida por el cron vuelve a «Pide uno actualizado».
    fichero: 'src/modules/quotes/domain/versionMasReciente.ts',
    de: "const ESTADOS_CON_ENLACE_VIVO: readonly string[] = ['draft', 'sent', 'expired'];",
    a: "const ESTADOS_CON_ENLACE_VIVO: readonly string[] = ['draft', 'sent'];",
    cae: 'también con la .0 ya CADUCADA por el cron',
  },
];

const T1 = 'Presupuesto actualizado';
const T2 = 'Este presupuesto tiene una versión más reciente.';
const T3 = 'La que estás viendo ya no se puede aceptar. Abre el enlace de la versión nueva que te haya enviado {negocio}, o pídesela.';

const copia = (x) => JSON.parse(JSON.stringify(x));
const merchantDe = (pais = 'ES', legalName = null) => ({
  id: MERCHANT, email: 'qa@example.test', flags: null, name: 'Fontanería Ruiz', legalName, logoUrl: null, address: null,
  country: pais, brandColor: null, brandAccentColor: null, whatsappPhone: null, timezone: 'Europe/Madrid', clausulasPresupuesto: null,
});
function fila(revision, extra = {}) {
  return {
    id: 100 + revision, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: revision ? '242.00' : '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: revision ? 200 : 100, tax: 0.21 }], quoteNumber: 12, revision, seriesYear: 2026,
    decisionToken: String(revision).repeat(32), validUntil: new Date(Date.now() + 10 * 86400000).toISOString(), paymentTerms: 'FULL_UPFRONT', tiers: null,
    discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null,
    createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', signatureUrl: null,
    merchant: merchantDe(), customer: { name: 'Cliente' }, ...extra,
  };
}

/** ¿Casa la fila con el `where` de Prisma que construye `whereDelGrupo` + `revision: { gt }`? */
function casa(q, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') { if (!v.some((w) => casa(q, w))) return false; continue; }
    if (k === 'revision') { if (!(q.revision > v.gt)) return false; continue; }
    if (k === 'createdAt') { const t = new Date(q.createdAt).getTime(); if (!(t >= new Date(v.gte).getTime() && t < new Date(v.lt).getTime())) return false; continue; }
    if (q[k] !== v) return false;
  }
  return true;
}

let TABLA = [];
const llamadas = { count: 0 };
let countLanza = false;
inyectarBase({
  'quote.findUnique': ({ where }) => { const q = TABLA.find((x) => x.decisionToken === where.decisionToken); return q ? copia(q) : null; },
  'quote.count': ({ where }) => {
    llamadas.count += 1;
    if (countLanza) throw new Error('base caída (doble)');
    return TABLA.filter((q) => casa(q, where)).length;
  },
}, [LANDING]);

const { quoteDecisionLandingRouter } = moduloDeDist(LANDING);
const capa = (ruta) => quoteDecisionLandingRouter.stack.find((l) => l.route && [].concat(l.route.path).includes(ruta) && l.route.methods.get);

async function pedir(ruta, token) {
  const r = { status: 200, html: '', redirect: null };
  const res = {
    status(s) { r.status = s; return res; }, setHeader() { return res; },
    redirect(u) { r.redirect = u; return res; }, send(b) { r.html = String(b); return res; },
  };
  await capa(ruta).route.stack.at(-1).handle({ params: { token }, query: {}, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  return r;
}
const pinta = (html) => ({
  formulario: html.includes('id="btn-accept"'),
  aviso: html.includes('data-version-antigua="1"'),
});

test('SCRUM-1302p · CONTROL POSITIVO: el enlace de la VIGENTE (.1) sigue pintando el formulario, y la sonda lo ve', async () => {
  TABLA = [fila(0), fila(1)];
  const r = await pedir('/quote/:token', fila(1).decisionToken);
  assert.equal(pinta(r.html).formulario, true, '🔴 la sonda no ve el formulario: «sin formulario» de abajo no probaría nada');
  assert.equal(pinta(r.html).aviso, false, '🔴 la versión vigente sale como antigua');
});

test('SCRUM-1302p · 🔴 el enlace de la .0 habiendo .1: SÓLO el aviso, con T1, T2 y T3 tal cual', async () => {
  TABLA = [fila(0), fila(1)];
  const antes = llamadas.count;
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.ok(llamadas.count > antes, 'CIEGO: la página no ha preguntado por el grupo');
  assert.equal(pinta(r.html).aviso, true, '🔴 el enlace de una versión antigua no avisa: es el defecto medido el 13-oct');
  assert.equal(pinta(r.html).formulario, false, '🔴 el enlace de una versión antigua deja firmar');
  assert.match(r.html, new RegExp(`<title[^>]*>${T1}`), 'T1 no es el título de la página');
  assert.match(r.html, new RegExp(`<strong[^>]*>${T2.replace('.', '\\.')}</strong>`), 'T2 no se lee tal cual');
  assert.ok(r.html.includes(T3.replace('{negocio}', 'Fontanería Ruiz')), 'T3 no se lee tal cual');
  // Punto 2 y 3: ni importes, ni rechazar, ni PDF, ni botón, ni emoji que señale.
  assert.equal(/121,00|242,00/.test(r.html), false, 'enseña un importe');
  assert.equal(/\/reject|\/pdf|Rechazar/.test(r.html), false, 'ofrece rechazar o el PDF');
  assert.equal(/<a\s|<button/.test(r.html.split('<body')[1] || ''), false, 'trae un enlace o un botón');
  assert.equal(r.html.includes('👇'), false, 'trae un emoji que señala a nada');
});

test('SCRUM-1302p · 🔴 también con la .0 en BORRADOR (punto 1: draft, sent o expired)', async () => {
  TABLA = [fila(0, { status: 'draft' }), fila(1, { status: 'draft' })];
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.equal(pinta(r.html).aviso, true);
});

test('SCRUM-1302p · 🔴 va ANTES que el caducado (punto 5): una .0 enviada y vencida habiendo .1', async () => {
  TABLA = [fila(0, { validUntil: '2026-01-01T00:00:00.000Z' }), fila(1)];
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.equal(pinta(r.html).aviso, true, '🔴 sale «Pide uno actualizado» habiendo ya uno');
  assert.equal(r.html.includes('caducó'), false);
});

// SCRUM-1302 c.19636 · el punto 1 se amplía a `expired`: sin eso el punto 5 sólo valía para las
// vencidas que el cron aún no había barrido. El caso de arriba es el `sent` vencido; éste, el barrido.
test('SCRUM-1302p · 🔴 también con la .0 ya CADUCADA por el cron (`status = expired`, c.19636)', async () => {
  TABLA = [fila(0, { status: 'expired', validUntil: '2026-01-01T00:00:00.000Z' }), fila(1)];
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.equal(pinta(r.html).aviso, true, '🔴 sale «Pide uno actualizado» habiendo ya uno');
  assert.equal(r.html.includes('caducó'), false);
  // Control: la misma .0 caducada SIN .1 sigue con su página de caducado.
  TABLA = [fila(0, { status: 'expired', validUntil: '2026-01-01T00:00:00.000Z' })];
  const sola = await pedir('/quote/:token', fila(0).decisionToken);
  assert.equal(pinta(sola.html).aviso, false);
  assert.ok(sola.html.includes('caducó'), '🔴 la sonda no ve el caducado: «sin caducó» de arriba no probaría nada');
});

test('SCRUM-1302p · una .0 ya ACEPTADA no cambia: es historia cierta (punto 6)', async () => {
  TABLA = [fila(0, { status: 'accepted', acceptedAt: '2026-10-02T10:00:00.000Z' }), fila(1)];
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.equal(pinta(r.html).aviso, false);
  assert.ok(r.html.includes('Ya aceptaste este presupuesto'));
});

test('SCRUM-1302p · el grupo es por AÑO de la serie: la .1 de otro año no hace antigua a la .0', async () => {
  TABLA = [fila(0), fila(1, { seriesYear: 2027 })];
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.equal(pinta(r.html).formulario, true, '🔴 la página ha preguntado por otro grupo (sin el año de la serie)');
});

test('SCRUM-1302p · el grupo es por NEGOCIO: el mismo número de otro negocio no cuenta', async () => {
  TABLA = [fila(0), fila(1, { merchantId: MERCHANT + 1 })];
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.equal(pinta(r.html).formulario, true);
});

test('SCRUM-1302p · 🔴 si no se puede preguntar por el grupo, NO se pinta el formulario a ciegas', async () => {
  TABLA = [fila(0), fila(1)];
  countLanza = true;
  try {
    await assert.rejects(() => pedir('/quote/:token', fila(0).decisionToken), /base caída/);
  } finally { countLanza = false; }
});

test('SCRUM-1302p · 🔴 «Rechazar» de la .0 habiendo .1 lleva a la página del aviso (punto 7)', async () => {
  TABLA = [fila(0), fila(1)];
  const r = await pedir('/quote/:token/reject', fila(0).decisionToken);
  assert.equal(r.redirect, `/pay/quote/${fila(0).decisionToken}`);
  // Control: el de la vigente sigue pintando su formulario de rechazo.
  const v = await pedir('/quote/:token/reject', fila(1).decisionToken);
  assert.equal(v.redirect, null);
  assert.ok(v.html.includes('¿Por qué lo rechazas?'));
});

test('SCRUM-1302p · {negocio}: el nombre fiscal si lo hay, y escapado', async () => {
  TABLA = [fila(0, { merchant: merchantDe('ES', 'Ruiz & Hijos SL') }), fila(1)];
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.ok(r.html.includes(T3.replace('{negocio}', 'Ruiz &amp; Hijos SL')));
});

test('SCRUM-1302p · en un país de «cotización», T1 y T2 concuerdan en femenino', async () => {
  TABLA = [fila(0, { merchant: merchantDe('MX') }), fila(1)];
  const r = await pedir('/quote/:token', fila(0).decisionToken);
  assert.match(r.html, /<title[^>]*>Cotización actualizada/);
  assert.match(r.html, /<strong[^>]*>Esta cotización tiene una versión más reciente\.<\/strong>/);
});

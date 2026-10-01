// tests/scrum1279-la-firma-ve-las-clausulas.test.mjs — SCRUM-1279
//
// 🔴 LA FIRMA VE LO QUE FIRMA (misma familia que SCRUM-468). La landing donde el cliente acepta y
// firma no pintaba ni las cláusulas de cierre, ni el texto de cabecera, ni las «Observaciones»; el
// PDF archivado sí, así que el papel afirmaba que el cliente aceptó lo que la pantalla nunca enseñó.
//
// Lo que se comprueba NO es «hay una sección»: es que **la landing y el PDF dicen lo mismo**,
// cláusula por cláusula. Las dos cosas se producen de verdad, de la MISMA fila:
//   · la landing, por su ruta `GET /pay/quote/:token` (`dist`), con la base doblada;
//   · el PDF, con `generateQuotePdf(paramsDePresupuestoParaPdf(fila))` — la cadena de la ruta
//     `GET /pay/quote/:token/pdf` — y leído con `_texto-del-pdf.mjs`.
// Ninguna lista de lo esperado se escribe a mano: cada cláusula configurada se busca en los DOS
// sitios y se exige que estén en los dos o en ninguno. ⛔ Sin red ni base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');

const TOKEN = 'd'.repeat(32);
const copia = (x) => JSON.parse(JSON.stringify(x));

// Cinco de configuración: una excluida en ESTE presupuesto y una sin texto (no pintable).
const CLAUSULAS = [
  { id: 'c-garantia', titulo: 'Garantía', texto: 'Seis meses sobre la mano de obra desde la fecha de fin del trabajo.' },
  { id: 'c-plazos', titulo: 'Plazos', texto: 'El trabajo empieza en los cinco días hábiles siguientes a la aceptación.' },
  { id: 'c-materiales', titulo: 'Materiales', texto: 'Los materiales sobrantes quedan en la obra salvo acuerdo contrario.' },
  { id: 'c-desplazamiento', titulo: 'Desplazamiento', texto: 'Incluido dentro del término municipal.' },
  { id: 'c-vacia', titulo: 'Sin texto', texto: '   ' },
];

function fila(extra = {}, merchantExtra = {}) {
  return {
    id: 1279, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }], quoteNumber: 1279, revision: 0,
    decisionToken: TOKEN, validUntil: new Date(Date.now() + 10 * 86400000), paymentTerms: 'FULL_UPFRONT',
    tiers: null, discountGlobalAmount: null, docFields: null, docHeaderText: null, docFooterText: null,
    clausulasExcluidas: null, acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date(), updatedAt: new Date(),
    merchant: { id: MERCHANT, email: 'm1279@t.test', flags: null, name: 'Fontanería 1279', legalName: null,
      logoUrl: null, address: null, country: 'ES', brandColor: null, brandAccentColor: null,
      whatsappPhone: null, timezone: 'Europe/Madrid', clausulasPresupuesto: CLAUSULAS, ...merchantExtra },
    customer: { name: 'Cliente 1279' },
    ...extra,
  };
}

/** La landing de verdad, por su ruta. */
async function landing(q) {
  inyectarBase({ 'quote.findUnique': ({ where }) => (where.decisionToken === TOKEN ? copia(q) : null) }, [LANDING]);
  const { quoteDecisionLandingRouter } = moduloDeDist(LANDING);
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route && Array.isArray(l.route.path) && l.route.path.includes('/quote/:token') && l.route.methods.get);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, body: '' };
  const res = { status(s) { r.status = s; return res; }, setHeader() { return res; }, redirect() { return res; }, send(b) { r.body = String(b); return res; } };
  await h({ params: { token: TOKEN }, query: {} }, res);
  assert.equal(r.status, 200);
  assert.match(r.body, /id="btn-accept"/, 'control del banco: es la página de firma, no otra');
  return r.body;
}

/** El PDF de verdad, de la MISMA fila, por la cadena de `GET /pay/quote/:token/pdf`. */
async function textoDelPdf(q) {
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
    return r.texto;
  } finally { fs.rmSync(outPath, { force: true }); }
}

const desescapar = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// El PDF parte líneas y justifica; la página respeta saltos. Se compara sin espacios.
const plano = (s) => String(s).replace(/\s+/g, '');
const firmaAntes = (html, marca) => html.indexOf(marca) >= 0 && html.indexOf(marca) < html.indexOf('id="btn-accept-wrapper"');

/** Las cláusulas que pinta la landing, en orden, leídas del HTML servido. */
function clausulasDeLaLanding(html) {
  // Con hueco para atributos en cada etiqueta (SCRUM-553): se leen los textos, no la forma exacta.
  return [...html.matchAll(/data-clausula="([^"]+)"[^>]*><div class="doc-titulo"[^>]*>([^<]*)<\/div><div class="doc-texto"[^>]*>([^<]*)<\/div>/g)]
    .map((m) => ({ id: desescapar(m[1]), titulo: desescapar(m[2]), texto: desescapar(m[3]) }));
}

/** 🔴 LA COMPROBACIÓN QUE IMPORTA: cada cláusula configurada, en los dos sitios o en ninguno. */
function exigirQueDicenLoMismo(html, pdf, q) {
  const enLanding = clausulasDeLaLanding(html);
  const configuradas = q.merchant.clausulasPresupuesto;
  const pdfPlano = plano(pdf);
  const enPdf = configuradas.filter((c) => plano(c.texto) !== '' && pdfPlano.includes(plano(c.titulo.toUpperCase())) && pdfPlano.includes(plano(c.texto)));
  assert.deepEqual(enLanding.map((c) => c.id), enPdf.map((c) => c.id),
    '🔴 la landing y el PDF no llevan las mismas cláusulas: el cliente firmaría algo distinto de lo que se archiva');
  for (const c of enLanding) {
    const conf = configuradas.find((x) => x.id === c.id);
    assert.equal(c.titulo, conf.titulo, `🔴 el título de «${c.id}» no es el del profesional`);
    assert.equal(c.texto, conf.texto, `🔴 el texto de «${c.id}» no es el del profesional`);
  }
  // Y en el MISMO orden que el papel.
  const ordenPdf = [...enPdf].sort((a, b) => pdfPlano.indexOf(plano(a.texto)) - pdfPlano.indexOf(plano(b.texto)));
  assert.deepEqual(enLanding.map((c) => c.id), ordenPdf.map((c) => c.id), '🔴 las cláusulas salen en otro orden que en el PDF');
  return enLanding;
}

test('🔴 SCRUM-1279 · 1-2 · con cláusulas: la landing las pinta ANTES de la firma y dicen lo mismo que el PDF', async () => {
  const q = fila({ docHeaderText: 'Visita del 3 de octubre.\nAcceso por el patio.', docFooterText: 'Precio válido con el acceso libre.' });
  const [html, pdf] = [await landing(q), await textoDelPdf(q)];
  const pintadas = exigirQueDicenLoMismo(html, pdf, q);
  assert.equal(pintadas.length, 4, 'control: las cuatro pintables salen (la vacía no, en ninguno de los dos)');
  assert.ok(firmaAntes(html, 'data-doc="clausulas"'), '🔴 las cláusulas no están ANTES del bloque de firma');
  assert.ok(!/<details/i.test(html), 'nada plegado: lo que se firma se ve sin desplegar');

  // Cabecera y Observaciones: el texto del PDF y el de la página, el mismo; y antes de la firma.
  const cab = /data-doc="cabecera"[^>]*>([^<]*)</.exec(html);
  const obs = /data-doc="observaciones"[^>]*><div class="doc-titulo"[^>]*>([^<]*)<\/div><div class="doc-texto"[^>]*>([^<]*)</.exec(html);
  assert.ok(cab && obs, '🔴 la landing no pinta la cabecera o las observaciones que el PDF sí lleva');
  assert.ok(plano(pdf).includes(plano(desescapar(cab[1]))), '🔴 la cabecera de la landing no es la del PDF');
  assert.ok(plano(pdf).includes(plano(desescapar(obs[1]) + desescapar(obs[2]))), '🔴 «Observaciones» y su texto no son los del PDF');
  assert.ok(firmaAntes(html, 'data-doc="cabecera"') && firmaAntes(html, 'data-doc="observaciones"'));
});

test('🔴 SCRUM-1279 · 3 · una cláusula EXCLUIDA en este presupuesto no sale en ninguno de los dos', async () => {
  const q = fila({ clausulasExcluidas: ['c-plazos'] });
  const [html, pdf] = [await landing(q), await textoDelPdf(q)];
  const pintadas = exigirQueDicenLoMismo(html, pdf, q);
  assert.deepEqual(pintadas.map((c) => c.id), ['c-garantia', 'c-materiales', 'c-desplazamiento']);
});

// Control positivo: sin esto, 1-3 pasarían igual si la sección se pintara siempre con lo que hubiera.
test('SCRUM-1279 · 4 · control: SIN cláusulas ni textos no se abre ninguna sección ni un hueco', async () => {
  const q = fila({}, { clausulasPresupuesto: null });
  const html = await landing(q);
  assert.equal(clausulasDeLaLanding(html).length, 0);
  assert.ok(!/data-doc="/.test(html), '🔴 se pinta un bloque del documento sin nada dentro');
  assert.match(html, /id="btn-accept"/, 'y la página de firma sigue ahí');
});

test('SCRUM-1279 · el texto del profesional se escapa, no se interpreta', async () => {
  const q = fila({}, { clausulasPresupuesto: [{ id: 'c-x', titulo: 'Pago <b>', texto: 'A & B <i>' }] });
  const html = await landing(q);
  assert.ok(html.includes('Pago &lt;b&gt;') && html.includes('A &amp; B &lt;i&gt;'));
  assert.deepEqual(clausulasDeLaLanding(html).map((c) => c.texto), ['A & B <i>']);
});

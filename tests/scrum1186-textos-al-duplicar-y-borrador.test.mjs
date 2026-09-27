// SCRUM-1186 · REGRESIÓN DE SCRUM-1174: LOS DOS TEXTOS DEL DOCUMENTO SE PERDÍAN EN SILENCIO.
//
// Desde SCRUM-1174 el editor del presupuesto tiene dónde escribir la cabecera (`docHeaderText`) y
// las Observaciones (`docFooterText`). Había dos caminos por los que se perdían sin avisar:
//   1. «Duplicar» (`quotesDetailView.js`, `duplicateQuote`) no los copiaba a la plantilla, y el
//      editor no los precargaba de ella — el mismo defecto que SCRUM-926 corrigió para el descuento.
//   2. El borrador automático (`saveDraft`/`loadDraft`) no los guardaba: un F5 los borraba.
//
// Se mide en el BANCO montando la vista de verdad, no leyendo el fuente: lo que importa es el valor
// que acaba en el `<textarea>` y lo que acaba en `localStorage`.
//
// ⚠️ La mitad de SERVIDOR (que `GET /admin/quotes/:id` mande los dos campos) es SCRUM-1187. Aquí el
// detalle se sirve CON ellos para medir lo que hace el front cuando llegan.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MID = 7;
const CLAVE_BORRADOR = `pf_quote_draft_${MID}`;
const CABECERA = 'Obra: reforma del baño\nSegunda línea';
const PIE = 'Precio válido con acceso libre a la obra.';

const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function banco(extra = {}) {
  return cargarDashboard(RAIZ, {
    datos: (url) => {
      if (/\/admin\/merchant$/.test(url)) return { id: MID, name: 'Fontanería Pepe', country: 'ES' };
      if (extra.detalle && /\/admin\/quotes\/\d+$/.test(url)) return extra.detalle;
      return [];
    },
    localStorage: extra.localStorage,
  });
}

function campos(contenedor) {
  const n = todos(contenedor);
  const cab = n.find((x) => x.tagName === 'TEXTAREA' && x.name === 'docHeaderText');
  const pie = n.find((x) => x.tagName === 'TEXTAREA' && x.name === 'docFooterText');
  assert.ok(cab && pie, '🔴 SUELO: la vista no monta los dos textos del documento (SCRUM-1174)');
  return { cab, pie };
}

const PLANTILLA = {
  name: 'Copia de #12',
  currency: 'EUR',
  lines: [{ concept: 'Cambio de grifo', qty: 1, price: 80 }],
  paymentTerms: null,
  discountGlobalAmount: null,
  docHeaderText: CABECERA,
  docFooterText: PIE,
};

test('SCRUM-1186 · 🔴 la plantilla de «Duplicar» precarga los dos textos en el editor', async () => {
  const b = banco();
  const r = await pintarVista(b, 'renderQuotesView', PLANTILLA);
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta: ${r.error && r.error.message}`);
  await respirar();
  const { cab, pie } = campos(r.contenedor);
  assert.equal(cab.value, CABECERA, '🔴 la copia sale SIN la cabecera del original');
  assert.equal(pie.value, PIE, '🔴 la copia sale SIN las Observaciones del original');
});

test('SCRUM-1186 · CONTROL: una plantilla que no trae los textos (catálogo) no inventa nada', async () => {
  const b = banco();
  const { docHeaderText, docFooterText, ...sinTextos } = PLANTILLA;
  const r = await pintarVista(b, 'renderQuotesView', sinTextos);
  assert.equal(r.error, null);
  await respirar();
  const { cab, pie } = campos(r.contenedor);
  assert.equal(cab.value, '');
  assert.equal(pie.value, '');
});

test('SCRUM-1186 · 🔴 teclear en un texto lo guarda en el borrador', async () => {
  const b = banco();
  const r = await pintarVista(b, 'renderQuotesView', { ...PLANTILLA, docHeaderText: null, docFooterText: null });
  assert.equal(r.error, null);
  await respirar();
  const { cab } = campos(r.contenedor);
  cab.value = CABECERA;
  cab.disparar('input');
  // `scheduleDraftSave` espera 700 ms antes de escribir.
  await respirar(800);
  const crudo = b.ctx.localStorage._contenido()[CLAVE_BORRADOR];
  assert.ok(crudo, `🔴 SUELO: no se ha escrito ningún borrador en ${CLAVE_BORRADOR}`);
  const guardado = JSON.parse(crudo);
  assert.deepEqual(guardado.textosDelDocumento, { docHeaderText: CABECERA, docFooterText: null },
    '🔴 el borrador se guarda SIN los textos del documento: un F5 los borraría');
});

test('SCRUM-1186 · 🔴 el borrador devuelve los dos textos al recargar', async () => {
  const borrador = {
    customerId: '',
    paymentTerms: '',
    vatDefault: '21',
    lines: [{ concept: 'Cambio de grifo', qty: '1', price: '80', vat: '21' }],
    descuentoGlobal: '',
    textosDelDocumento: { docHeaderText: CABECERA, docFooterText: PIE },
  };
  const b = banco({ localStorage: { [CLAVE_BORRADOR]: JSON.stringify(borrador) } });
  const r = await pintarVista(b, 'renderQuotesView');
  assert.equal(r.error, null);
  await respirar();
  const n = todos(r.contenedor);
  const concepto = n.find((x) => x.tagName === 'INPUT' && x.value === 'Cambio de grifo');
  assert.ok(concepto, '🔴 SUELO: el borrador no se ha restaurado (sin la línea no se mide nada)');
  const { cab, pie } = campos(r.contenedor);
  assert.equal(cab.value, CABECERA, '🔴 el borrador vuelve SIN la cabecera');
  assert.equal(pie.value, PIE, '🔴 el borrador vuelve SIN las Observaciones');
});

test('SCRUM-1186 · CONTROL: un borrador VIEJO (sin los textos) se restaura igual y deja los campos vacíos', async () => {
  const viejo = {
    customerId: '', paymentTerms: '', vatDefault: '21',
    lines: [{ concept: 'Cambio de grifo', qty: '1', price: '80', vat: '21' }],
  };
  const b = banco({ localStorage: { [CLAVE_BORRADOR]: JSON.stringify(viejo) } });
  const r = await pintarVista(b, 'renderQuotesView');
  assert.equal(r.error, null);
  await respirar();
  assert.ok(todos(r.contenedor).find((x) => x.tagName === 'INPUT' && x.value === 'Cambio de grifo'),
    '🔴 SUELO: el borrador viejo no se ha restaurado');
  const { cab, pie } = campos(r.contenedor);
  assert.equal(cab.value, '');
  assert.equal(pie.value, '');
});

test('SCRUM-1186 · 🔴 «Duplicar» copia los dos textos del detalle a la plantilla', async () => {
  const detalle = {
    id: 12, number: 12, currency: 'EUR', lines: PLANTILLA.lines, tiers: null, paymentTerms: 'FULL_UPFRONT',
    discountGlobalAmount: null, docHeaderText: CABECERA, docFooterText: PIE,
  };
  const b = banco({ detalle });
  const navegaciones = [];
  b.ctx.renderAppView = (vista, opciones) => { navegaciones.push({ vista, opciones }); };
  assert.equal(typeof b.ctx.duplicateQuote, 'function', '🔴 SUELO: el banco no ve `duplicateQuote`');
  await b.ctx.duplicateQuote(12);
  assert.equal(navegaciones.length, 1, '🔴 SUELO: «Duplicar» no ha abierto el editor');
  const tpl = navegaciones[0].opciones.template;
  assert.equal(tpl.docHeaderText, CABECERA, '🔴 la copia no lleva la cabecera');
  assert.equal(tpl.docFooterText, PIE, '🔴 la copia no lleva las Observaciones');
});

test('SCRUM-1186 · CONTROL: si el detalle no manda los textos (servidor sin SCRUM-1187), la copia lleva `null`, no `undefined`', async () => {
  const detalle = { id: 12, number: 12, currency: 'EUR', lines: PLANTILLA.lines };
  const b = banco({ detalle });
  const navegaciones = [];
  b.ctx.renderAppView = (vista, opciones) => { navegaciones.push({ vista, opciones }); };
  await b.ctx.duplicateQuote(12);
  const tpl = navegaciones[0].opciones.template;
  assert.equal(tpl.docHeaderText, null);
  assert.equal(tpl.docFooterText, null);
});

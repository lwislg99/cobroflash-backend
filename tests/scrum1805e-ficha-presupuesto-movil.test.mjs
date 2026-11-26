// tests/scrum1805e-ficha-presupuesto-movil.test.mjs — SCRUM-1805e
//
// EN MÓVIL, LA TABLA DE CONCEPTOS DE LA FICHA DEL PRESUPUESTO ESCONDÍA PRECIO, IVA Y TOTAL.
//
// El mismo defecto que SCRUM-1787e midió en la ficha de factura, y que su registro dejó para S2
// («Para Luis (S2): el presupuesto tiene el mismo defecto», `docs/master/SCRUM-1787.md`): a 390 px,
// `quotesDetailView.js` enseñaba 2 de 5 columnas y el resto tras el scroll PROPIO de la tabla.
//
// EL ARREGLO, la misma receta: a ≤640 px cada línea es un bloque, el concepto a todo el ancho y
// Cant./Precio/IVA/Total debajo, cada uno con su rótulo leído de la PROPIA cabecera (`data-label`).
// Y de paso, el `style="text-align:right"` del «Total» (cabecera y celda) pasa a una clase (CSP).
//
// QUÉ MIRA: la ficha montada en el banco de vistas (los píxeles los miden las capturas) y `styles.css`
// sin comentarios, con las reglas de dentro de cada `@media`. Control de escritorio: el apilado vive
// SOLO dentro del `@media (max-width: 640px)`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = leerFuente(path.join(RAIZ, 'public/dashboard/css/styles.css'), { ancla: '.j1-prog-paso' });
const CLASE = 'quote-conceptos-tabla';
const TOTAL = 'quote-conceptos-col-total';
const ROTULOS = ['Cant.', 'Precio', 'IVA', 'Total'];

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/quotesDetailView.js',
    de: "table.className = 'table quote-conceptos-tabla';",
    a: "table.className = 'table';",
    cae: 'SCRUM-1805e · ① la tabla de conceptos lleva su clase y cada celda numérica su rótulo de la cabecera',
  },
  {
    fichero: 'public/dashboard/js/quotesDetailView.js',
    de: '[...tr.children].forEach((td, k) => { if (k > 0) td.dataset.label = rotulos[k]; });',
    a: '',
    cae: 'SCRUM-1805e · ① la tabla de conceptos lleva su clase y cada celda numérica su rótulo de la cabecera',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.quote-conceptos-tabla thead { display:none; }',
    a: '.quote-conceptos-tabla thead { display:table-header-group; }',
    cae: 'SCRUM-1805e · ② a ≤640 px la tabla se apila: cabecera fuera, cuatro columnas, concepto a todo el ancho y rótulo por celda',
  },
  {
    fichero: 'public/dashboard/js/quotesDetailView.js',
    de: '`<td class="amount quote-conceptos-col-total">${fmtQuoteMoney(total, cur)}</td>`;',
    a: '`<td style="text-align:right" class="amount">${fmtQuoteMoney(total, cur)}</td>`;',
    cae: 'SCRUM-1805e · ④ el «Total» se alinea con una clase, no con `style=` (CSP)',
  },
];

const NAV = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
const resp = (status, data) => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => 'application/json' },
  json: async () => data, text: async () => JSON.stringify(data), blob: async () => ({}),
});

const FICHA = {
  id: 1805, number: 1805, quoteNumber: 1805, revision: 0, numeroConRevision: 'P1805', revisiones: [], vigenteId: 1805,
  status: 'draft', archivedAt: null, total: 133.1, currency: 'EUR', payToken: 'tok1805',
  lines: [
    { apartado: true, concept: 'Baño' },
    { concept: 'ZZCONCEPTO alicatado', qty: 1, price: 100, tax: 0.21 },
    { concept: 'ZZCONCEPTO grifería', qty: 2, price: 5, tax: 0.21 },
  ],
  discountGlobalAmount: null,
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
  customer: { id: 3, name: 'Cliente Ejemplo', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1805e', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
  docHeaderText: null, docFooterText: null,
};

async function montar() {
  const fetch = async (url) => (new URL(String(url), 'https://yaqu.app').pathname === `/admin/quotes/${FICHA.id}`
    ? resp(200, FICHA) : resp(200, []));
  const b = cargarDashboard(RAIZ, { red: { navigator: NAV, fetch } });
  b.ctx.appUserRole = 'admin';
  const v = await pintarVista(b, 'renderQuoteDetailView', FICHA.id);
  assert.equal(v.error, null, `🔴 la ficha del presupuesto revienta al abrirse: ${v.error && v.error.message}`);
  return todos(v.contenedor);
}

/** Todas las reglas, con el `@media` que las envuelve (o `null`). Recibe el CSS ya sin comentarios. */
function reglas(css) {
  const out = [];
  const recorrer = (t, medio) => {
    let i = 0;
    while (i < t.length) {
      const abre = t.indexOf('{', i);
      if (abre < 0) break;
      const preludio = t.slice(i, abre).trim();
      let prof = 1, j = abre + 1;
      while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
      const cuerpo = t.slice(abre + 1, j - 1);
      if (preludio.startsWith('@media') || preludio.startsWith('@supports')) recorrer(cuerpo, preludio.replace(/\s+/g, ' '));
      else if (!preludio.startsWith('@')) out.push({ selectores: preludio.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo: cuerpo.replace(/\s+/g, ''), medio });
      i = j;
    }
  };
  recorrer(css, null);
  return out;
}

test('SCRUM-1805e · ① la tabla de conceptos lleva su clase y cada celda numérica su rótulo de la cabecera', async () => {
  const nodos = await montar();
  const tablas = nodos.filter((n) => n.tagName === 'TABLE' && String(n.className).split(/\s+/).includes(CLASE));
  assert.equal(tablas.length, 1, `🔴 se esperaba UNA tabla .${CLASE} en la ficha y hay ${tablas.length}`);
  const filas = todos(tablas[0]).filter((n) => n.tagName === 'TR' && (n.hijos || []).length === 5);
  assert.ok(filas.length >= 3, `CIEGO: el banco ve ${filas.length} filas de 5 celdas (cabecera + 2 líneas esperadas)`);
  const lineas = filas.filter((tr) => tr.hijos[0].tagName === 'TD');
  assert.equal(lineas.length, 2, `🔴 se esperaban las 2 líneas con importe y hay ${lineas.length}`);
  for (const tr of lineas) {
    assert.equal(tr.hijos[0].dataset.label, undefined, '🔴 la celda del concepto no lleva rótulo: va a todo el ancho');
    assert.deepEqual(tr.hijos.slice(1).map((td) => td.dataset.label), ROTULOS,
      '🔴 cada celda numérica lleva como rótulo el texto de SU columna en la cabecera');
  }
  // La cabecera de apartado sigue siendo UNA celda a todo lo ancho, sin rótulo.
  const apartado = todos(tablas[0]).find((n) => n.tagName === 'TR' && String(n.className).includes('quote-apartado'));
  assert.ok(apartado, 'CIEGO: no veo la fila del apartado');
  assert.equal((apartado.hijos || []).length, 1, '🔴 la cabecera de apartado ya no es una sola celda');
});

test('SCRUM-1805e · ② a ≤640 px la tabla se apila: cabecera fuera, cuatro columnas, concepto a todo el ancho y rótulo por celda', () => {
  const todas = reglas(CSS);
  assert.ok(todas.some((r) => r.selectores.includes(`.${CLASE} .${TOTAL}`)), `CIEGO: el parser no ve \`.${CLASE} .${TOTAL}\` en styles.css`);
  const movil = todas.filter((r) => r.medio === '@media (max-width: 640px)');
  const cuerpoDe = (sel) => movil.filter((r) => r.selectores.includes(sel)).map((r) => r.cuerpo).join(';');
  assert.match(cuerpoDe(`.${CLASE} thead`), /display:none/, '🔴 en móvil la cabecera se oculta: cada celda lleva su rótulo');
  assert.match(cuerpoDe(`.${CLASE} tbody tr`), /display:grid/, '🔴 cada línea es una rejilla, no una fila que scrollea');
  // Cuatro columnas; Precio y Total no bajan de su contenido (AB6: «12.099,99 €» partía el «€» con 4 × 1fr).
  assert.match(cuerpoDe(`.${CLASE} tbody tr`), /grid-template-columns:minmax\(0,\.6fr\)minmax\(min-content,1fr\)minmax\(0,\.6fr\)minmax\(min-content,1\.2fr\)/, '🔴 Cant., Precio, IVA y Total, en cuatro columnas, con los importes a su ancho');
  assert.match(cuerpoDe(`.${CLASE} tbody td:nth-child(3)`), /white-space:nowrap/, '🔴 el precio se parte en dos renglones');
  assert.match(cuerpoDe(`.${CLASE} tbody td:nth-child(5)`), /white-space:nowrap/, '🔴 el total se parte en dos renglones');
  assert.match(cuerpoDe(`.${CLASE} tbody td`), /white-space:normal/, '🔴 sin el `nowrap` global de móvil, que ensancha la tabla');
  assert.match(cuerpoDe(`.${CLASE} tbody td:first-child`), /grid-column:1\/-1/, '🔴 el concepto ocupa todo el ancho');
  assert.match(cuerpoDe(`.${CLASE} tbody td[data-label]::before`), /content:attr\(data-label\)/, '🔴 el rótulo sale del data-label, no de un texto escrito en el CSS');
});

test('SCRUM-1805e · ③ control de escritorio: el apilado vive SOLO dentro del @media de móvil', () => {
  const propias = reglas(CSS).filter((r) => r.selectores.some((s) => s.includes(CLASE)));
  assert.ok(propias.length >= 7, `CIEGO: sólo veo ${propias.length} reglas de .${CLASE}`);
  const fuera = propias.filter((r) => r.medio !== '@media (max-width: 640px)');
  // Fuera del @media sólo puede estar la alineación del «Total», que sustituye al `style=` de siempre.
  assert.deepEqual(fuera.map((r) => `${r.selectores.join(',')}{${r.cuerpo}}`), [`.${CLASE} .${TOTAL}{text-align:right;}`],
    '🔴 una regla de la tabla vive fuera del @media de móvil: a 1280 px la tabla ya no sería la de siempre');
});

test('SCRUM-1805e · ④ el «Total» se alinea con una clase, no con `style=` (CSP)', async () => {
  const nodos = await montar();
  const tabla = nodos.find((n) => n.tagName === 'TABLE' && String(n.className).split(/\s+/).includes(CLASE));
  assert.ok(tabla, 'CIEGO: no veo la tabla');
  const conStyle = todos(tabla).filter((n) => (n.tagName === 'TH' || n.tagName === 'TD') && n._attrs && n._attrs.style);
  assert.deepEqual(conStyle.map((n) => n.tagName), [], '🔴 vuelve a haber `style=` en la tabla de conceptos');
  const totales = todos(tabla).filter((n) => String(n.className).split(/\s+/).includes(TOTAL));
  assert.equal(totales.length, 3, `🔴 la cabecera y las 2 líneas llevan la clase del «Total»; hay ${totales.length}`);
});

// tests/scrum1206c-la-ficha-del-presupuesto-pinta-sus-textos.test.mjs — SCRUM-1206 (la mitad del presupuesto)
//
// El PDF del presupuesto imprime sus dos textos libres —la cabecera (`docHeaderText`) encima de los
// conceptos y las Observaciones (`docFooterText`) debajo de los totales— y la ficha no enseñaba
// ninguno. Medido en yaqu.app el 15-oct-2026 (SCRUM-1206 c.19790): el #202 de la cuenta QA los trae en
// su GET y la ficha no los pinta, ni ocultos.
//
// FIRMADO por el orquestador (SCRUM-1206, 16-oct-2026, delegación del fundador), lo mismo que en el
// albarán (1206b): la cabecera SIN rótulo, como en el papel; el bloque del pie con «Observaciones»,
// LEÍDO de `textoDelDocumento.js` (`TD_TITULO_OBSERVACIONES`). Y con la pieza que existía para
// pintarlos, `textoDelDocumentoPintado` (aceptación 1). Sin dato, sin sección.
//
// Se pinta la pantalla de verdad (`renderQuoteDetailView`, con los scripts de `index.html`).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const CABECERA = 'Obra de la calle Mayor, 3.º B\nAcceso por el patio';
const PIE = 'Validez de 30 días.\nNo incluye la retirada de escombros';

/** La ficha que devuelve el detalle (la forma de `scrum1273`). Teléfono de rango imposible. */
const FICHA = Object.freeze({
  id: 202, number: 5, quoteNumber: 5, revision: 0, numeroConRevision: 'P5', revisiones: [], vigenteId: 202,
  status: 'draft', archivedAt: null, total: '100.00', currency: 'EUR', payToken: 'tok202',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1206', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
  docHeaderText: null, docFooterText: null,
});

function red(ficha) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (/\/admin\/quotes\/202(\?|$)/.test(new URL(String(url), 'https://yaqu.app').pathname + '')
      ? resp(200, ficha) : resp(200, [])),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

const clases = (n) => (typeof n.className === 'string' ? n.className.split(' ') : []);

/** Pinta la ficha con esos textos. Devuelve sus secciones de texto, en orden, y el texto entero. */
async function ficha(textos) {
  const q = { ...FICHA, ...textos };
  const banco = cargarDashboard(RAIZ, { red: red(q) });
  banco.ctx.appUserRole = 'admin';
  const v = await pintarVista(banco, 'renderQuoteDetailView', q.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  const nodos = todos(v.contenedor);
  // CONTROL POSITIVO: la ficha se montó de verdad. Sin esto, «no hay secciones» probaría nada.
  assert.ok(nodos.some((n) => n.textContent === 'Punto de luz'), '🔴 SUELO: no veo los conceptos en la ficha');
  const secciones = nodos.filter((n) => n.dataset && (n.dataset.seccion === 'texto-cabecera' || n.dataset.seccion === 'observaciones'));
  const orden = nodos.map((n) => (n.dataset && n.dataset.seccion) || (n.tagName === 'H3' ? n.textContent : null)).filter(Boolean);
  const leer = (s) => {
    const h = todos(s).find((n) => n.tagName === 'H3');
    const caja = todos(s).find((n) => clases(n).includes('quote-doc-texto'));
    const pintado = caja && caja.hijos && caja.hijos[0];
    return {
      seccion: s.dataset.seccion,
      rotulo: h ? h.textContent : null,
      texto: pintado ? pintado.textContent : null,
      preLine: pintado ? pintado.style.whiteSpace : null,
    };
  };
  return { textos: secciones.map(leer), orden, banco, todo: nodos.map((n) => n.textContent || '').join(' | ') };
}

test('SCRUM-1206c · 🔴 SUELO: el rótulo llega de la pieza firmada y la pieza de pintar existe', async () => {
  const { banco } = await ficha({});
  assert.equal(banco.ctx.TD_TITULO_OBSERVACIONES, 'Observaciones', '🔴 la pieza no expone el literal firmado');
  assert.equal(typeof banco.ctx.textoDelDocumentoPintado, 'function', '🔴 la pieza de pintar no está cargada');
});

test('SCRUM-1206c · las Observaciones (`docFooterText`) salen con su rótulo, por la pieza, con sus saltos', async () => {
  const { textos } = await ficha({ docFooterText: PIE });
  assert.deepEqual(textos, [{ seccion: 'observaciones', rotulo: 'Observaciones', texto: PIE, preLine: 'pre-line' }],
    '🔴 la ficha no enseña las Observaciones que el PDF sí imprime (SCRUM-1206 c.19790)');
});

test('SCRUM-1206c · la cabecera (`docHeaderText`) sale SIN rótulo, como en el papel', async () => {
  const { textos, todo, banco } = await ficha({ docHeaderText: CABECERA });
  assert.deepEqual(textos, [{ seccion: 'texto-cabecera', rotulo: null, texto: CABECERA, preLine: 'pre-line' }]);
  // HERMANO (SCRUM-237): el token de abajo es el rótulo REAL del formulario, el que vive en la pieza.
  assert.ok(String(banco.ctx.TD_TITULO_CABECERA).includes('Añadir texto en el documento'),
    '🔴 SUELO: la pieza ya no expone ese rótulo; la negación de abajo no probaría nada');
  assert.ok(!todo.includes('Añadir texto en el documento'),
    '🔴 el rótulo del FORMULARIO encima de un texto guardado se lee como un botón que no hace nada');
});

test('SCRUM-1206c · en el orden del papel: cabecera ANTES de los conceptos, Observaciones DESPUÉS', async () => {
  const { orden } = await ficha({ docHeaderText: CABECERA, docFooterText: PIE });
  const iCab = orden.indexOf('texto-cabecera');
  const iConc = orden.indexOf('Conceptos');
  const iObs = orden.indexOf('observaciones');
  assert.ok(iConc >= 0, `🔴 SUELO: no encuentro la sección Conceptos: ${JSON.stringify(orden)}`);
  assert.ok(iCab >= 0 && iCab < iConc, `🔴 la cabecera no va encima de los conceptos: ${JSON.stringify(orden)}`);
  assert.ok(iObs > iConc, `🔴 las Observaciones no van debajo de los conceptos: ${JSON.stringify(orden)}`);
});

test('SCRUM-1206c · sin dato, sin sección: vacío, sólo espacios, `null` o ausente no pintan nada', async () => {
  for (const textos of [{}, { docHeaderText: '', docFooterText: '' }, { docHeaderText: ' ', docFooterText: '   \n ' }, { docHeaderText: null, docFooterText: null }]) {
    const { textos: t, todo } = await ficha(textos);
    assert.deepEqual(t, [], `🔴 con ${JSON.stringify(textos)} sale una sección vacía`);
    assert.ok(!todo.includes('Observaciones'), `🔴 con ${JSON.stringify(textos)} sale el rótulo sobre un hueco`);
  }
});

test('SCRUM-1206c · el texto del profesional entra como TEXTO, no como marcado', async () => {
  const raro = 'medidas: 3 < 4 & <b>hecho</b>';
  const { textos } = await ficha({ docFooterText: raro });
  assert.equal(textos.length, 1);
  assert.equal(textos[0].texto, raro, '🔴 el texto se altera al pintarlo: entra como marcado');
});

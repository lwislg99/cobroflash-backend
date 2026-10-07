// tests/scrum1495-el-titulo-es-de-la-ficha-montada.test.mjs — SCRUM-1495
//
// LA VÍCTIMA: el profesional que abre la ficha de un presupuesto y, antes de que llegue, la de
// otro. Cuando la respuesta del primero llega tarde, el título de arriba pasa a decir el número
// del PRIMERO encima de la ficha del segundo. El número es bueno; es el de otro documento.
//
// QUÉ SE EJECUTA AQUÍ: `quotesDetailView.js`, el de verdad, en el banco de vistas, con la red de
// mentira y las dos respuestas sueltas a mano, en el orden que cada caso pide. Las dos fichas se
// montan en EL MISMO hueco, como hace el panel (`app.js` pinta toda vista en `#view-container`).
//
// 🔴 QUÉ NO MIDE, y se dice:
//   · El router: el banco no lo ejecuta. El título provisional se SIEMBRA con lo que el router
//     escribe hoy al abrir cada ficha («Presupuesto #» + el id de la ruta). El recorrido entero
//     se mide en navegador (sonda `id-ficha.mjs`, filas E3, E4 y E5).
//   · QUÉ dice el título mientras carga o si la carga falla (el id de la tabla): es SCRUM-1482,
//     y aquí sólo se comprueba que no lleva nada del OTRO presupuesto.
//   · Las otras fichas (Trabajo, factura, albarán, cliente, parte): no se miran.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Ids y números DISTINTOS entre sí los cuatro: confundir cualquiera con cualquiera se ve.
const A = { id: 206, numero: 5 };
const B = { id: 205, numero: 4 };
const CUANDO = '2026-10-07T07:00:00.000Z';

const respuesta = (status, cuerpo) => ({
  ok: status < 400, status,
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
});
const vueltas = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const LOCALE_ES = { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteVerb: 'presupuesto', currency: 'EUR' };

const presupuesto = ({ id, numero }) => ({
  id, number: numero, quoteNumber: numero, revision: 0, numeroConRevision: 'P' + numero, revisiones: [], vigenteId: id,
  status: 'draft', total: '1.00', currency: 'EUR', payToken: 'tok1495-' + id,
  lines: [{ concept: 'Punto de luz', qty: 1, price: 1, tax: 0 }],
  createdAt: CUANDO, updatedAt: CUANDO,
  customer: { id: 3, name: 'Ana Ruiz', phone: null, email: null, notes: null },
  merchant: { id: 7, name: 'QA 1495', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: null, evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
});

/**
 * El panel con su hueco y su título, y las cargas de A y de B EN VUELO: cada una se suelta a mano.
 * `abrir(x)` hace lo que hace el router al abrir la ficha de x: escribe el título provisional y
 * pinta la ficha en el hueco de siempre. No espera a la carga.
 */
function panel() {
  const enVuelo = new Map();
  const pedidas = [];
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    const m = metodo === 'GET' && /\/admin\/quotes\/(\d+)$/.exec(String(url));
    if (!m) return respuesta(200, []);
    const id = Number(m[1]);
    pedidas.push(id);
    let soltar;
    const promesa = new Promise((res) => { soltar = res; });
    enVuelo.set(id, soltar);
    return promesa;
  };
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  banco.ctx.appLocale = LOCALE_ES;
  const cuerpo = banco.ctx.document.body;
  const titulo = banco.mk('span');
  titulo.id = 'view-title';
  cuerpo.appendChild(titulo);
  const hueco = banco.mk('div');
  hueco.id = 'view-container';
  cuerpo.appendChild(hueco);

  const pintadas = [];
  const abrir = async (x) => {
    titulo.textContent = 'Presupuesto #' + x.id;
    pintadas.push(banco.ctx.renderQuoteDetailView(hueco, x.id));
    await vueltas();
    assert.ok(enVuelo.has(x.id), `🔴 CIEGO: la ficha del ${x.id} no ha pedido su presupuesto, así que no está «cargando».`);
  };
  const llega = async (x, status = 200) => {
    const soltar = enVuelo.get(x.id);
    assert.ok(soltar, `🔴 CIEGO: no hay ninguna carga del ${x.id} en vuelo que soltar.`);
    soltar(status === 200 ? respuesta(200, presupuesto(x)) : respuesta(status, { error: 'internal_error' }));
    await vueltas();
  };
  /** Ninguna de las fichas pintadas ha reventado (la que llegó tarde tampoco). */
  const sinReventar = async () => {
    const fin = await Promise.allSettled(pintadas);
    return fin.filter((f) => f.status === 'rejected').map((f) => String((f.reason && f.reason.message) || f.reason));
  };
  const h2 = () => todos(hueco).filter((n) => n.tagName === 'H2').map((n) => n.textContent);
  const avisos = () => todos(hueco).map((n) => String(n.textContent || '')).filter(Boolean);
  return { banco, titulo, hueco, abrir, llega, h2, avisos, pedidas, sinReventar };
}

test('SCRUM-1495 · abre A y luego B, B carga y A llega TARDE: el título de la vista dice el número de B', async () => {
  const p = panel();
  await p.abrir(A);
  await p.abrir(B);
  await p.llega(B);
  assert.equal(p.titulo.textContent, 'Presupuesto #' + B.numero,
    '🔴 CIEGO: con B cargada el título no dice su número, así que el cruce de abajo no mide nada.');
  await p.llega(A);
  assert.deepEqual(p.pedidas, [A.id, B.id], '🔴 CIEGO: no se han pedido las dos fichas, una vez cada una.');
  assert.equal(p.titulo.textContent, 'Presupuesto #' + B.numero,
    `🔴 la respuesta de A (nº ${A.numero}), que llegó tarde, ha escrito su número en el título de la vista `
    + `encima de la ficha de B (nº ${B.numero}). La ficha corrige el título porque PARECE de un presupuesto, `
    + 'sin mirar si la que está en pantalla sigue siendo ella.');
  assert.deepEqual(p.h2(), ['Presupuesto #' + B.numero],
    '🔴 la cabecera que queda en pantalla no es la de B, sola: o se ha colado la de A o falta la de B.');
  assert.deepEqual(await p.sinReventar(), [], '🔴 una de las dos fichas ha reventado al pintarse.');
});

test('SCRUM-1495 · abre A y luego B, y A llega tarde ANTES que B: el título no enseña el número de A ni un momento', async () => {
  const p = panel();
  await p.abrir(A);
  await p.abrir(B);
  await p.llega(A);
  assert.equal(p.titulo.textContent, 'Presupuesto #' + B.id,
    `🔴 con B todavía cargando, la respuesta de A ha cambiado el título de la vista a «${p.titulo.textContent}». `
    + 'Tiene que quedarse como lo dejó el router al abrir B: A ya no está en pantalla.');
  await p.llega(B);
  assert.equal(p.titulo.textContent, 'Presupuesto #' + B.numero,
    '🔴 cuando B llega, el título de la vista no se corrige a su número.');
  assert.deepEqual(await p.sinReventar(), [], '🔴 una de las dos fichas ha reventado al pintarse.');
});

test('SCRUM-1495 · abre A y luego B, la carga de B FALLA y A llega tarde: el título no lleva nada de A', async () => {
  const p = panel();
  await p.abrir(A);
  await p.abrir(B);
  await p.llega(B, 500);
  assert.ok(p.avisos().includes('Error cargando presupuesto.'),
    '🔴 CIEGO: no sale «Error cargando presupuesto.», así que la carga de B no ha fallado.');
  await p.llega(A);
  assert.equal(p.titulo.textContent, 'Presupuesto #' + B.id,
    `🔴 con la carga de B fallida, la respuesta tardía de A ha cambiado el título de la vista a «${p.titulo.textContent}». `
    + 'Qué dice ese título cuando la carga falla es de SCRUM-1482; aquí sólo se exige que A no lo toque.');
  assert.deepEqual(p.h2(), ['Presupuesto'],
    '🔴 la cabecera de la ficha fallida de B no se queda en la palabra sola.');
  assert.deepEqual(await p.sinReventar(), [], '🔴 una de las dos fichas ha reventado al pintarse.');
});

test('SCRUM-1495 · CONTROL: sin cruce, la ficha cargada sigue corrigiendo el título y la cabecera a su número', async () => {
  const p = panel();
  await p.abrir(A);
  await p.llega(A);
  assert.equal(p.titulo.textContent, 'Presupuesto #' + A.numero,
    '🔴 la ficha que SÍ está en pantalla ya no corrige el título de la vista a su número: la condición '
    + 'que impide el cruce se ha llevado también el caso normal.');
  assert.deepEqual(p.h2(), ['Presupuesto #' + A.numero], '🔴 cargada, la cabecera no lleva su número.');
  assert.deepEqual(await p.sinReventar(), [], '🔴 la ficha ha reventado al pintarse.');
});

test('SCRUM-1495 · CONTROL: volver a abrir LA MISMA ficha mientras carga no la deja sin número', async () => {
  // Dos pintadas de A en el mismo hueco (un doble clic, o «Actualizar»): la primera queda fuera
  // de pantalla y la segunda es la que manda. Llegue la que llegue, el título acaba en su número.
  const p = panel();
  await p.abrir(A);
  const primera = p.pedidas.length;
  await p.abrir(A);
  assert.equal(p.pedidas.length, primera + 1, '🔴 CIEGO: la segunda pintada de A no ha pedido el presupuesto.');
  await p.llega(A);
  assert.equal(p.titulo.textContent, 'Presupuesto #' + A.numero,
    '🔴 reabrir la misma ficha mientras carga deja el título sin corregir.');
  assert.deepEqual(p.h2(), ['Presupuesto #' + A.numero], '🔴 reabierta, la cabecera no lleva su número.');
});

test('SCRUM-1495 · CONTROL: si el usuario se va a otra vista mientras A carga, el título de esa vista queda intacto', async () => {
  const p = panel();
  await p.abrir(A);
  // Lo que hace el router al ir a Inicio: su título, y el hueco con otra cosa dentro.
  p.titulo.textContent = 'Inicio';
  p.hueco.innerHTML = '';
  await p.llega(A);
  assert.equal(p.titulo.textContent, 'Inicio', '🔴 la respuesta tardía de A ha tocado el título de otra vista.');
  assert.deepEqual(p.h2(), [], '🔴 la ficha de A se ha pintado en el hueco después de que el usuario se fuera.');
  assert.deepEqual(await p.sinReventar(), [], '🔴 la ficha ha reventado al pintarse fuera de pantalla.');
});

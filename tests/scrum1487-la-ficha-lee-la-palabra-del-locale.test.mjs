// SCRUM-1487 · LA FICHA DE UN PRESUPUESTO, YA CARGADA, SE TITULABA «Presupuesto #N» EN TODOS LOS PAÍSES.
//
// El panel tiene la palabra del documento en `window.appLocale.quote` (la rellena el servidor por
// país: «Presupuesto» en ES y AR, «Cotización» en MX, CO, PE y CL). El menú y la lista ya la usan.
// La ficha de UNO la escribía a mano en dos sitios al cargar: su cabecera y el título de la vista.
// En un país de «cotización» el menú decía «Cotizaciones» y la ficha de una, «Presupuesto #4».
//
// Se EJECUTA la ficha en el banco con el locale de cada caso; no se lee el fuente.
//
// LO QUE NO ENTRA: el título PROVISIONAL de la vista mientras carga lo escribe el router (`app.js`),
// con la palabra a mano y el id de la ruta. Es de SCRUM-1482 y lo fija el caso 7 de `scrum832`.
// Aquí se parte de ese título tal como el router lo deja hoy.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 205;
const NUMERO = 4;
const CUANDO = '2026-10-07T07:00:00.000Z';

const respuesta = (status, cuerpo) => ({
  ok: status < 400, status,
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
});
const vueltas = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const LOCALE_ES = { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteVerb: 'presupuesto', currency: 'EUR' };
const LOCALE_MX = { quote: 'Cotización', quotePlural: 'Cotizaciones', quoteVerb: 'cotización', currency: 'MXN' };

const presupuesto = () => ({
  id: ID, number: NUMERO, quoteNumber: NUMERO, revision: 0, numeroConRevision: 'P4', revisiones: [], vigenteId: ID,
  status: 'draft', total: '1.00', currency: 'EUR', payToken: 'tok1487',
  lines: [{ concept: 'Punto de luz', qty: 1, price: 1, tax: 0 }],
  createdAt: CUANDO, updatedAt: CUANDO,
  customer: { id: 3, name: 'Ana Ruiz', phone: null, email: null, notes: null },
  merchant: { id: 7, name: 'QA 1487', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: null, evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
});

// La ficha del 205 CARGADA, con el título de la vista que había al abrirla.
async function fichaCargada(locale, tituloAlAbrir) {
  let pedidas = 0;
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'GET' && new RegExp(`/admin/quotes/${ID}$`).test(String(url))) { pedidas++; return respuesta(200, presupuesto()); }
    return respuesta(200, []);
  };
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  banco.ctx.appLocale = locale;
  const titulo = banco.mk('span');
  titulo.id = 'view-title';
  titulo.textContent = tituloAlAbrir;
  banco.ctx.document.body.appendChild(titulo);
  const v = await pintarVista(banco, 'renderQuoteDetailView', ID);
  assert.equal(v.error, null, `🔴 la ficha revienta: ${v.error && v.error.message}`);
  await vueltas();
  assert.equal(pedidas, 1, '🔴 CIEGO: la ficha no ha pedido el presupuesto.');
  return { h2: todos(v.contenedor).filter((n) => n.tagName === 'H2').map((n) => n.textContent), titulo: titulo.textContent };
}

// Lo que el router escribe hoy al abrir la ficha, en cualquier país (`app.js`, `case 'quotes-detail'`).
const PROVISIONAL = 'Presupuesto #' + ID;

test('SCRUM-1487 · 🔴 en un país de «cotización», la ficha cargada dice «Cotización #N» en la cabecera y en el título de la vista', async () => {
  const f = await fichaCargada(LOCALE_MX, PROVISIONAL);
  assert.deepEqual(f.h2, ['Cotización #' + NUMERO],
    '🔴 con un locale que dice «Cotización», la cabecera de la ficha cargada dice otra cosa: la palabra está escrita a mano.');
  assert.equal(f.titulo, 'Cotización #' + NUMERO,
    '🔴 con un locale que dice «Cotización», el título de la vista de la ficha cargada dice otra cosa: la palabra está escrita a mano, '
    + 'o la ficha ha dejado de reconocer el título provisional del router y no lo corrige.');
});

test('SCRUM-1487 · CONTROL: en España la ficha cargada sigue diciendo «Presupuesto #N», igual que antes', async () => {
  const f = await fichaCargada(LOCALE_ES, PROVISIONAL);
  assert.deepEqual(f.h2, ['Presupuesto #' + NUMERO]);
  assert.equal(f.titulo, 'Presupuesto #' + NUMERO);
});

test('SCRUM-1487 · CONTROL: si el título que hay no es el de una ficha, la ficha no lo toca (en ningún país)', async () => {
  const mx = await fichaCargada(LOCALE_MX, 'Inicio');
  assert.equal(mx.titulo, 'Inicio', '🔴 la ficha ha pisado el título de otra vista');
  assert.deepEqual(mx.h2, ['Cotización #' + NUMERO], 'SUELO: la ficha sí ha cargado');
  const es = await fichaCargada(LOCALE_ES, 'Inicio');
  assert.equal(es.titulo, 'Inicio', '🔴 la ficha ha pisado el título de otra vista');
});

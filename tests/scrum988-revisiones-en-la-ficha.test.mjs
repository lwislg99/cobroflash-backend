// tests/scrum988-revisiones-en-la-ficha.test.mjs — SCRUM-988
//
// La pantalla de revisiones (`quoteRevisiones.js`, SCRUM-655c/688) estaba hecha, firmada y con su
// servidor vivo, y NO LA LLAMABA NADIE: cero llamadores en `public/`. Decidido por el orquestador
// el 26-sep-2026: sección al pie de la ficha del presupuesto, solo con rótulos ya firmados; la ve
// quien ve el presupuesto, en todos los estados; «Crear revisión» solo el admin (lo mismo que
// exige `requireRole('admin')` en el POST).
//
// Se mide la FICHA MONTADA en el banco, no el fuente. Y un defecto que destapó el enchufe: el
// enlace «Ver» apuntaba a `#/presupuestos/<id>`, que el router no atiende.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DOS = [
  { id: 1, revision: 0, numero: 'P7', status: 'accepted', firmado: true, total: '100.00', createdAt: '2026-09-20T10:00:00.000Z', vigente: false },
  { id: 9, revision: 1, numero: 'P7.1', status: 'draft', firmado: false, total: '120.00', createdAt: '2026-09-21T10:00:00.000Z', vigente: true },
];
const UNA = [
  { id: 1, revision: 0, numero: 'P7', status: 'sent', firmado: false, total: '100.00', createdAt: '2026-09-20T10:00:00.000Z', vigente: true },
];

const presupuesto = (revisiones, extra = {}) => ({
  id: 1, number: 7, quoteNumber: 7, revision: 0, numeroConRevision: 'P7', revisiones, vigenteId: 9,
  status: 'accepted', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 988', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: '2026-09-20T10:00:00.000Z', rejectedAt: null, decisionChannel: 'backoffice', decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  ...extra,
});

async function montar(quote, rol) {
  const posts = [];
  const navegaciones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      const u = String(url);
      const metodo = String((opts && opts.method) || 'GET').toUpperCase();
      if (metodo === 'POST' && /\/admin\/quotes\/\d+\/revisiones$/.test(u)) {
        posts.push(u);
        return { ok: true, id: 10, origenId: 9 };
      }
      if (/\/admin\/quotes\/1$/.test(u)) return quote;
      return [];
    },
  });
  banco.ctx.appUserRole = rol;
  banco.ctx.renderAppView = (vista, args) => { navegaciones.push({ vista, args }); };
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
  const seccion = nodos.filter((n) => attr(n, 'data-seccion-revisiones') === '1');
  const dentro = seccion.length ? todos(seccion[0]) : [];
  return { banco, r, nodos, seccion, dentro, attr, posts, navegaciones };
}

const espera = () => new Promise((ok) => setTimeout(ok, 30));

test('SCRUM-988 · 🔴 la ficha del presupuesto PINTA la sección de revisiones, con UN solo título firmado', async () => {
  const m = await montar(presupuesto(DOS), 'admin');
  assert.ok(m.nodos.length > 60, `CIEGO: la ficha montó ${m.nodos.length} nodos; no es la pantalla entera`);
  assert.equal(m.seccion.length, 1, '🔴 la ficha no tiene sección de revisiones: la pantalla sigue sin puerta');
  const titulos = m.dentro.filter((n) => /^H[1-6]$/.test(n.tagName) && (n.textContent || '') === 'Revisiones');
  assert.equal(titulos.length, 1, `🔴 debe haber UN título «Revisiones» en la sección; hay ${titulos.length}`);
  const filas = m.dentro.filter((n) => m.attr(n, 'data-revision-fila') != null);
  assert.deepEqual(filas.map((f) => m.attr(f, 'data-revision-fila')), ['1', '9'], 'las filas son las que manda el servidor, en su orden');
  const vigente = filas.filter((f) => m.attr(f, 'data-revision-vigente') === '1');
  assert.deepEqual(vigente.map((f) => m.attr(f, 'data-revision-fila')), ['9'], 'la vigente la dice el servidor');
});

test('SCRUM-988 · 🔴 «Ver» lleva a un hash que el router ATIENDE (`#quotes-detail/<id>`)', async () => {
  const m = await montar(presupuesto(DOS), 'admin');
  const ver = m.dentro.filter((n) => m.attr(n, 'data-revision-ver') != null);
  assert.equal(ver.length, 1, 'CIEGO: la abierta (id 1) no lleva «Ver»; la otra sí');
  assert.equal(m.attr(ver[0], 'href'), '#quotes-detail/9');
});

test('SCRUM-988 · 🔴 admin: «Crear revisión» hace el POST sobre la VIGENTE y navega a la NUEVA', async () => {
  const m = await montar(presupuesto(DOS), 'admin');
  const btn = m.dentro.filter((n) => m.attr(n, 'data-revision-crear') != null);
  assert.equal(btn.length, 1, '🔴 el admin no ve «Crear revisión»');
  assert.equal(btn[0].textContent, 'Crear revisión');
  btn[0].click();
  await espera();
  assert.deepEqual(m.posts.map((u) => u.replace(/^.*(\/admin\/)/, '$1')), ['/admin/quotes/9/revisiones'],
    '🔴 el POST debe ir sobre la vigente (9), no sobre la abierta (1)');
  // Por JSON: el objeto nace dentro del contexto del banco y su prototipo no es el de este realm.
  assert.equal(JSON.stringify(m.navegaciones), JSON.stringify([{ vista: 'quotes-detail', args: { quoteId: 10 } }]),
    '🔴 tras crearla se abre la revisión NUEVA; la anterior no se toca');
});

test('SCRUM-988 · 🔴 técnico: ve la sección pero NO «Crear revisión» (el servidor le daría 403)', async () => {
  const m = await montar(presupuesto(DOS), 'tecnico');
  assert.equal(m.seccion.length, 1, 'CIEGO: sin sección no se puede afirmar nada del botón');
  assert.ok(m.dentro.some((n) => m.attr(n, 'data-revision-fila') != null), 'CIEGO: la lista no se pintó');
  assert.equal(m.dentro.filter((n) => m.attr(n, 'data-revision-crear') != null).length, 0);
});

test('SCRUM-988 · una sola versión: lo dice con su texto firmado, y el admin puede revisarla', async () => {
  const m = await montar(presupuesto(UNA, { status: 'sent', decision: {} }), 'admin');
  assert.ok(m.dentro.some((n) => m.attr(n, 'data-revisiones-unica') === '1' && n.textContent === 'Esta es la única versión.'));
  assert.equal(m.dentro.filter((n) => m.attr(n, 'data-revision-crear') === '1').length, 1);
});

// tests/scrum1302p-el-aviso-antes-de-crear-la-revision.test.mjs — SCRUM-1302, la mitad del PANEL.
//
// Al crear una revisión, el enlace que el cliente tiene de la versión anterior deja de valer (la otra
// mitad: `scrum1302p-la-pagina-de-una-revision-antigua`). Medido el 13-oct-2026 (guion
// `docs/master/evidencias/SCRUM-1302/crear-revision-no-avisa/`): el panel no decía nada — un clic
// hacía el POST sin preguntar y saltaba a la ficha nueva. Las dos mitades entran juntas o ninguna.
//
// Firmado por el orquestador por delegación del fundador (SCRUM-1302, c.19475, sobre c.19456): W1, W2,
// «Cancelar» y la conducta, SIN estrechar a `sent` (copiar el enlace ya es entregarlo: SCRUM-1297).
//
// Se monta la ficha REAL (`quotesDetailView.js` + `quoteRevisiones.js`) en el banco de vistas y se
// pulsa como lo haría el profesional. El CONTROL POSITIVO va dentro: con la vigente ya aceptada no
// hay enlace que romper, y la MISMA sonda tiene que ver el POST salir al primer clic. Sin eso, «cero
// POST tras el primer clic» podría ser un botón muerto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las mutaciones que este fichero tiene que cazar; las corre `npm run meta:mutaciones` en cada PR.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · el botón no avisa nunca: vuelve el POST de un clic, el defecto medido el 13-oct.
    fichero: 'public/dashboard/js/quoteRevisiones.js',
    de: 'var avisa = ESTADOS_CON_ENLACE_VIVO.indexOf(vigente.status) !== -1;',
    a: 'var avisa = false;',
    cae: 'vigente ENVIADA: el primer clic NO crea nada',
  },
  {
    // M2 · se estrecha a `sent`, que es justo lo que c.19475 decidió no hacer.
    fichero: 'public/dashboard/js/quoteRevisiones.js',
    de: "var ESTADOS_CON_ENLACE_VIVO = ['draft', 'sent', 'expired'];",
    a: "var ESTADOS_CON_ENLACE_VIVO = ['sent', 'expired'];",
    cae: 'vigente en BORRADOR también avisa',
  },
  {
    // M3 · se deja fuera `expired` (c.19636): la página avisaría y el panel no.
    fichero: 'public/dashboard/js/quoteRevisiones.js',
    de: "var ESTADOS_CON_ENLACE_VIVO = ['draft', 'sent', 'expired'];",
    a: "var ESTADOS_CON_ENLACE_VIVO = ['draft', 'sent'];",
    cae: 'vigente CADUCADA también avisa',
  },
];
const W1_P7 = 'Al crear la revisión, el enlace de P7 dejará de valer.';
const W1_P71 = 'Al crear la revisión, el enlace de P7.1 dejará de valer.';
const W2 = 'Quien lo abra verá que hay una versión más reciente y ya no podrá aceptar. Envíale la nueva a tu cliente cuando esté lista.';

const fila = (id, revision, numero, status, vigente) => ({
  id, revision, numero, status, firmado: status === 'accepted', total: '100.00', createdAt: '2026-09-20T10:00:00.000Z', vigente,
});
const presupuesto = (revisiones) => ({
  id: 1, number: 7, quoteNumber: 7, revision: 0, numeroConRevision: 'P7', revisiones, vigenteId: revisiones.find((r) => r.vigente).id,
  status: revisiones[0].status, total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1302', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
});
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status >= 400 ? 'Conflict' : 'Created',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const pausa = () => new Promise((ok) => setTimeout(ok, 60));

async function ficha(datos, alPost = () => respuesta(201, { ok: true, id: 2, revision: 1, numero: 'P7' })) {
  const posts = [];
  const viajes = [];
  const preguntas = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? datos : []),
    red: {
      fetch: async (url, opts) => {
        const u = String(url);
        const metodo = String((opts && opts.method) || 'GET').toUpperCase();
        if (metodo === 'POST' && /\/admin\/quotes\/\d+\/revisiones$/.test(u)) { posts.push(u); return alPost(); }
        return respuesta(200, /\/admin\/quotes\/1$/.test(u) ? datos : []);
      },
    },
  });
  banco.ctx.appUserRole = 'admin';
  banco.ctx.renderAppView = (vista, args) => { viajes.push(`${vista} ${JSON.stringify(args)}`); };
  for (const n of ['confirm', 'alert', 'prompt']) banco.ctx[n] = (t) => { preguntas.push(t); return true; };
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const seccion = todos(r.contenedor).filter((n) => attr(n, 'data-seccion-revisiones') === '1');
  assert.equal(seccion.length, 1, 'CIEGO: la ficha no tiene sección de revisiones');
  const btn = todos(seccion[0]).filter((n) => attr(n, 'data-revision-crear') != null);
  assert.equal(btn.length, 1, 'CIEGO: el admin no ve «Crear revisión»; no hay viaje que medir');
  const de = (a) => todos(seccion[0]).filter((n) => attr(n, a) != null);
  return {
    posts, viajes, preguntas, btn: btn[0],
    aviso: () => de('data-revision-aviso'),
    // El banco NO agrega `textContent`: el texto de un bloque es el de TODOS sus nodos.
    textoDelAviso: () => de('data-revision-aviso').flatMap((n) => todos(n)).map((x) => String(x.textContent || '')).filter(Boolean),
    confirmar: async () => { const b = de('data-revision-confirmar'); assert.equal(b.length, 1, 'CIEGO: el aviso no trae «Crear revisión»'); b[0].click(); await pausa(); },
    cancelar: async () => { const b = de('data-revision-cancelar'); assert.equal(b.length, 1, 'CIEGO: el aviso no trae «Cancelar»'); b[0].click(); await pausa(); },
    botonesDelAviso: () => de('data-revision-aviso').flatMap((n) => todos(n)).filter((x) => x.tagName === 'BUTTON' || x.tag === 'button').map((x) => x.textContent),
  };
}

test('SCRUM-1302p · CONTROL POSITIVO: con la vigente ACEPTADA no hay enlace que romper y el POST sale al primer clic, sin aviso', async () => {
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'accepted', true)]));
  f.btn.click(); await pausa();
  assert.equal(f.posts.length, 1, '🔴 la sonda no ve un POST de un clic: «cero POST» de abajo no probaría nada');
  assert.equal(f.aviso().length, 0, '🔴 avisa de un enlace que no va a morir (punto 2: sólo draft, sent o expired)');
  assert.deepEqual(f.viajes, ['quotes-detail {"quoteId":2}']);
});

test('SCRUM-1302p · CONTROL POSITIVO: con la vigente RECHAZADA, tampoco hay aviso', async () => {
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'rejected', true)]));
  f.btn.click(); await pausa();
  assert.equal(f.posts.length, 1);
  assert.equal(f.aviso().length, 0);
});

test('SCRUM-1302p · 🔴 vigente ENVIADA: el primer clic NO crea nada, avisa con W1 (su número) y W2, y dos botones', async () => {
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'sent', true)]));
  f.btn.click(); await pausa();
  assert.equal(f.posts.length, 0, '🔴 el primer clic ha creado la revisión sin avisar: es el defecto medido el 13-oct');
  assert.equal(f.aviso().length, 1, '🔴 no hay aviso tras el primer clic');
  const textos = f.textoDelAviso();
  assert.ok(textos.includes(W1_P7), `🔴 W1 no se lee tal cual: ${JSON.stringify(textos)}`);
  assert.ok(textos.includes(W2), `🔴 W2 no se lee tal cual: ${JSON.stringify(textos)}`);
  assert.deepEqual(f.botonesDelAviso(), ['Crear revisión', 'Cancelar']);
  assert.equal(f.btn.hidden, true, 'el botón original sigue visible: habría dos «Crear revisión» a la vez');
  assert.equal(f.preguntas.length, 0, 'el aviso va en la página, no en un confirm() del navegador');
  // Un segundo clic en el botón (si quedara a mano) no pinta un segundo aviso.
  f.btn.click(); await pausa();
  assert.equal(f.aviso().length, 1);
  assert.equal(f.posts.length, 0);
});

test('SCRUM-1302p · 🔴 «Cancelar» lo deja como estaba: sin POST, sin aviso, el botón a la vista', async () => {
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'sent', true)]));
  f.btn.click(); await pausa();
  await f.cancelar();
  assert.equal(f.posts.length, 0, '🔴 cancelar ha creado la revisión');
  assert.equal(f.aviso().length, 0);
  assert.equal(f.btn.hidden, false);
  assert.deepEqual(f.viajes, []);
});

test('SCRUM-1302p · 🔴 crea el SEGUNDO clic: un POST, y a la ficha de la nueva', async () => {
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'sent', true)]));
  f.btn.click(); await pausa();
  await f.confirmar();
  assert.equal(f.posts.length, 1);
  assert.equal(f.aviso().length, 0, 'el aviso se queda pintado después de crear');
  assert.deepEqual(f.viajes, ['quotes-detail {"quoteId":2}']);
});

test('SCRUM-1302p · 🔴 vigente en BORRADOR también avisa: NO se estrecha a `sent` (SCRUM-1297: copiar el enlace ya es entregarlo)', async () => {
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'draft', true)]));
  f.btn.click(); await pausa();
  assert.equal(f.posts.length, 0);
  assert.ok(f.textoDelAviso().includes(W1_P7));
});

test('SCRUM-1302p · 🔴 vigente CADUCADA también avisa: su enlace pasa de «caducó» a «hay una más reciente» (c.19636)', async () => {
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'expired', true)]));
  f.btn.click(); await pausa();
  assert.equal(f.posts.length, 0, '🔴 el primer clic ha creado la revisión sin avisar');
  assert.ok(f.textoDelAviso().includes(W1_P7));
});

test('SCRUM-1302p · {número} es el de la VIGENTE, no el de la versión abierta', async () => {
  // Abierta la .0 (aceptada), vigente la .1 enviada: el enlace que muere es el de P7.1.
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'accepted', false), fila(9, 1, 'P7.1', 'sent', true)]));
  f.btn.click(); await pausa();
  assert.equal(f.posts.length, 0);
  assert.ok(f.textoDelAviso().includes(W1_P71), `🔴 el aviso no nombra la vigente: ${JSON.stringify(f.textoDelAviso())}`);
});

test('SCRUM-1302p · si el POST falla tras el aviso, se lee el aviso de error de siempre y el botón vuelve', async () => {
  const f = await ficha(presupuesto([fila(1, 0, 'P7', 'sent', true)]), () => respuesta(500, { error: 'internal_error' }));
  f.btn.click(); await pausa();
  await f.confirmar();
  assert.equal(f.posts.length, 1);
  assert.equal(f.btn.hidden, false);
  assert.equal(f.btn.disabled, false);
  assert.equal(f.aviso().length, 0);
});

// ── LAS DOS MITADES COMPARTEN CONDICIÓN ────────────────────────────────────────────────────────
// Se lee el literal del array en el CÓDIGO (la línea de la declaración, no los comentarios que lo
// nombran) de los dos ficheros. Si una mitad cambia de estados y la otra no, rojo.
function estadosDe(rel, patron) {
  const sinComentarios = fs.readFileSync(path.join(RAIZ, rel), 'utf8').split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  const m = sinComentarios.match(patron);
  assert.ok(m, `CIEGO: no encuentro la declaración de ESTADOS_CON_ENLACE_VIVO en ${rel}`);
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
}
test('SCRUM-1302p · 🔴 el panel y la página deciden con los MISMOS estados', () => {
  const panel = estadosDe('public/dashboard/js/quoteRevisiones.js', /var ESTADOS_CON_ENLACE_VIVO = \[([^\]]*)\]/);
  const pagina = estadosDe('src/modules/quotes/domain/versionMasReciente.ts', /const ESTADOS_CON_ENLACE_VIVO[^=]*= \[([^\]]*)\]/);
  assert.deepEqual(panel, ['draft', 'sent', 'expired']);
  assert.deepEqual(pagina, panel);
});

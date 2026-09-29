// tests/scrum1180-editor-clausulas-excluidas.test.mjs — SCRUM-1180 (mitad de pantalla, S2)
//
// El servidor guarda `clausulasExcluidas`, el PDF y el sello la aplican (SCRUM-656) y el detalle la
// devuelve (mitad de S1). El editor nunca la mandaba: quitar una cláusula en UN presupuesto no se
// podía. Aquí se mide el VIAJE, no el gesto:
//
//   detalle con una cláusula quitada → «Duplicar» → editor montado → la casilla sale DESMARCADA →
//   el profesional quita otra → «Generar» → el cuerpo REAL del POST /quote/create lleva las dos →
//   y ese cuerpo pasa por el `CreateQuoteSchema` real del servidor (dist) conservándolas.
//
// Un test que solo mirara el `click` de la casilla habría pasado con el payload sin la clave.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { CreateQuoteSchema } = require(path.join(RAIZ, 'dist/core/validation/schemas.js'));

const CLIENTE = '5';
const CLAUSULAS = [
  { id: 'c-garantia', titulo: 'Garantía', texto: 'Seis meses de garantía en mano de obra.' },
  { id: 'c-acceso', titulo: 'Acceso a la obra', texto: 'El cliente facilita el acceso.' },
  { id: 'c-validez', titulo: 'Validez', texto: 'Precio válido con acceso libre.' },
];
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '');

function banco({ clausulas = CLAUSULAS, detalle = null } = {}) {
  const posts = [];
  const cliente = { id: Number(CLIENTE), name: 'Cliente de prueba', email: 'c@x.es', phone: '34000111222', mobile: '34000111222' };
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url, opts) => {
      const u = String(url);
      const metodo = (opts && opts.method) || 'GET';
      let cuerpo = {};
      if (/\/admin\/customers/.test(u)) cuerpo = [cliente];
      else if (/\/admin\/merchant$/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', clausulasPresupuesto: clausulas };
      else if (/\/quote\/create/.test(u) && metodo === 'POST') {
        posts.push(JSON.parse(String(opts.body)));
        cuerpo = { id: 99, number: 'P-2026-0003', status: 'draft' };
      } else if (detalle && /\/admin\/quotes\/\d+$/.test(u)) cuerpo = detalle;
      else if (/\/admin\/quotes\/\d+$/.test(u)) cuerpo = { id: 99, pdfUrl: '/pdf/99.pdf' };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appMerchantId = 1;
  const navegaciones = [];
  b.ctx.renderAppView = (vista, opciones) => { navegaciones.push({ vista, opciones }); };
  return { b, posts, navegaciones };
}

const casillasDeClausula = (contenedor) => todos(contenedor)
  .filter((x) => x.tagName === 'INPUT' && x.type === 'checkbox' && CLAUSULAS.some((c) => c.id === x.value));

async function generar(b, contenedor) {
  const n = todos(contenedor);
  const sel = n.find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(sel, 'SUELO: no se encuentra el selector de cliente');
  sel.value = CLIENTE;
  sel.disparar('change');
  const primaria = n.find((x) => x.tagName === 'BUTTON' && /^Generar/.test(texto(x)));
  assert.ok(primaria, 'SUELO: la pantalla no tiene «Generar»');
  primaria.disparar('click');
  await respirar(20);
}

test('SCRUM-1180 · 🔴 el viaje: Duplicar → casilla desmarcada → quitar otra → Generar → el servidor las recibe', async () => {
  const detalle = {
    id: 12, number: 12, currency: 'EUR', paymentTerms: 'FULL_UPFRONT', discountGlobalAmount: null,
    lines: [{ concept: 'Cambio de grifo', qty: 1, price: 80, tax: 0.21 }],
    docHeaderText: null, docFooterText: null, clausulasExcluidas: ['c-acceso'],
  };
  const dup = banco({ detalle });
  await dup.b.ctx.duplicateQuote(12);
  assert.equal(dup.navegaciones.length, 1, 'SUELO: «Duplicar» no ha abierto el editor');
  const plantilla = JSON.parse(JSON.stringify(dup.navegaciones[0].opciones.template));
  assert.deepEqual(plantilla.clausulasExcluidas, ['c-acceso'], '🔴 «Duplicar» no copia las cláusulas quitadas');

  const { b, posts } = banco();
  const r = await pintarVista(b, 'renderQuotesView', plantilla);
  assert.equal(r.error, null, `SUELO: la vista no monta: ${r.error && r.error.message}`);
  await respirar();
  const casillas = casillasDeClausula(r.contenedor);
  assert.deepEqual(casillas.map((c) => c.value), CLAUSULAS.map((c) => c.id), '🔴 no hay una casilla por cláusula del negocio');
  assert.deepEqual(casillas.map((c) => c.checked), [true, false, true], '🔴 la copia no sale con la cláusula del original quitada');
  assert.ok(todos(r.contenedor).some((x) => texto(x) === 'Condiciones que lleva este presupuesto'),
    '🔴 el bloque sale sin el rótulo firmado (SCRUM-1180 c.17380)');

  casillas[2].checked = false;
  casillas[2].disparar('change');
  await generar(b, r.contenedor);

  assert.equal(posts.length, 1, 'SUELO: «Generar» no ha llegado al POST /quote/create');
  assert.deepEqual(posts[0].clausulasExcluidas, ['c-acceso', 'c-validez'], '🔴 el presupuesto se crea SIN las cláusulas quitadas');
  const leido = CreateQuoteSchema.safeParse(posts[0]);
  assert.ok(leido.success, `🔴 el servidor rechaza el cuerpo que manda el editor: ${leido.error && leido.error.message}`);
  assert.deepEqual(leido.data.clausulasExcluidas, ['c-acceso', 'c-validez'], '🔴 el esquema del servidor pierde la clave');
});

test('SCRUM-1180 · todas marcadas (lo de siempre) viaja como lista VACÍA: las lleva todas', async () => {
  const { b, posts } = banco();
  const r = await pintarVista(b, 'renderQuotesView', { name: 'x', currency: 'EUR', lines: [{ concept: 'Cambio de grifo', qty: 1, price: 80 }] });
  assert.equal(r.error, null);
  await respirar();
  assert.equal(casillasDeClausula(r.contenedor).length, 3);
  await generar(b, r.contenedor);
  assert.equal(posts.length, 1, 'SUELO: no hubo POST');
  assert.deepEqual(posts[0].clausulasExcluidas, []);
});

test('SCRUM-1180 · CONTROL: un negocio SIN cláusulas no pinta casillas y la clave NO viaja', async () => {
  const { b, posts } = banco({ clausulas: [] });
  const r = await pintarVista(b, 'renderQuotesView', { name: 'x', currency: 'EUR', lines: [{ concept: 'Cambio de grifo', qty: 1, price: 80 }] });
  assert.equal(r.error, null);
  await respirar();
  assert.equal(casillasDeClausula(r.contenedor).length, 0);
  const bloque = todos(r.contenedor).find((x) => String(x.className || '').includes('quote-clausulas'));
  assert.ok(bloque, 'SUELO: el bloque de cláusulas no está montado');
  assert.equal(bloque.hidden, true, '🔴 un bloque sin cláusulas se pinta vacío');
  assert.equal(todos(r.contenedor).some((x) => texto(x) === 'Condiciones que lleva este presupuesto'), false,
    '🔴 sin cláusulas, el rótulo promete una función que el profesional no tiene montada (c.17380, condición 2)');
  await generar(b, r.contenedor);
  assert.equal(posts.length, 1, 'SUELO: no hubo POST');
  assert.equal('clausulasExcluidas' in posts[0], false, '🔴 sin saber qué cláusulas hay, se manda una lista como si las llevara todas');
});

// La cláusula QUITADA tiene que verse de un vistazo (c.17380, lo que no se firmó y se aprobó aparte):
// atenuada y tachada. Y SOLO en el bloque de cláusulas: `.pay-methods-row` la comparten los métodos
// de pago, y un tachado ahí diría «este método no va» en la pantalla de cobro.
test('SCRUM-1180 · la cláusula quitada se tacha, y la regla no se sale del bloque de cláusulas', () => {
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), cuerpo: m[2] }));
  const tachado = reglas.filter((r) => /line-through/.test(r.cuerpo) && /pay-methods-row/.test(r.sel));
  assert.equal(tachado.length, 1, `SUELO: se esperaba UNA regla de tachado sobre la fila, hay ${tachado.length}`);
  const sel = tachado[0].sel;
  assert.match(sel, /^\.quote-clausulas\s/, `🔴 el tachado no está acotado a las cláusulas: «${sel}»`);
  assert.match(sel, /:has\(input:not\(:checked\)\)/, `🔴 el tachado no depende de la casilla desmarcada: «${sel}»`);
  assert.match(tachado[0].cuerpo, /color:\s*var\(--muted\)/, '🔴 la cláusula quitada no se atenúa');
});

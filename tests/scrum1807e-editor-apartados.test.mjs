// SCRUM-1807e · EL APARTADO EN EL EDITOR DEL PRESUPUESTO (carril S2).
//
// Decisión del fundador: SCRUM-1786 c.22269 (P2: el «Salón» es el apartado que ya existe; P3: el
// modo se elige POR APARTADO; literales «Total del apartado», «Mostrar al cliente:», «Desglosado»,
// «Agrupado», «Varios»). Encargo y texto del botón: SCRUM-1656 c.22787 («+ Añadir apartado»,
// opción A: crear, describir, ver su total, elegir el modo y CONSERVARLO al duplicar y en el
// borrador). Lo que había antes (medido, `docs/master/SCRUM-1807.md` §1807e): ninguna pantalla
// creaba una cabecera, y el editor convertía la que le llegaba en una línea más (BUGS.md).
//
// Se mide POR EFECTO en el banco de vistas: se monta el editor de verdad (`renderQuotesView`), se
// lee lo que pinta y se captura el CUERPO del POST /quote/create que manda «Generar».
//
// ⚠️ La clave `agrupado` la conserva la puerta del servidor desde el tramo d de S1 (SCRUM-1807d,
// rama `scrum-1807-apartados-s1`). Aquí se mide la mitad del FRONT: que el cuerpo la lleve.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// La pieza se cuelga de `window` en el navegador y de `globalThis` aquí (no exporta nada).
require(path.join(RAIZ, 'public/dashboard/js/quoteApartados.js'));
const piezas = {
  resumenDeApartados: globalThis.resumenDeApartados,
  ivaDelApartado: globalThis.ivaDelApartado,
  cabeceraParaPayload: globalThis.cabeceraParaPayload,
};

/** Las mutaciones que tumban este test (contrato de `scripts/meta-guard-mutaciones.mjs`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: '    if (initial && initial.apartado === true) return addApartado(initial);\n',
    a: '',
    cae: '«Duplicar» un presupuesto con apartados los conserva',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: '      // SCRUM-1807e · la cabecera viaja COMO cabecera, en su sitio (el orden decide sus líneas).\n      if (line.esApartado) {\n',
    a: '      // SCRUM-1807e · la cabecera viaja COMO cabecera, en su sitio (el orden decide sus líneas).\n      if (line.esApartado && false) {\n',
    cae: '«Generar» manda las cabeceras, en su sitio, con su modo y su descripción',
  },
  {
    fichero: 'public/dashboard/js/quoteApartados.js',
    de: "    if (lista.length > 1) return 'Varios';\n",
    a: "    if (lista.length > 1) return lista.join(' / ') + ' %';\n",
    cae: 'la columna de IVA del apartado agrupado dice «Varios» o su único tipo',
  },
  {
    fichero: 'public/dashboard/js/quoteApartados.js',
    de: '      if (Number.isFinite(t)) abierto.total = Math.round((abierto.total + t) * 100) / 100;\n',
    a: '',
    cae: '«Total del apartado» suma lo que enseñan sus filas',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: '        agrupado: l.agrupadoSelect.value === "agrupado",\n      } : ({\n',
    a: '        agrupado: false,\n      } : ({\n',
    cae: '«+ Añadir apartado» crea la cabecera y el borrador la guarda y la devuelve',
  },
  {
    fichero: 'public/dashboard/js/quoteApartados.js',
    de: '    if (agrupado === true) out.agrupado = true;\n',
    a: '',
    cae: '«Generar» manda las cabeceras, en su sitio, con su modo y su descripción',
  },
  {
    // La otra mitad del viaje: la puerta del servidor (tramo d de S1) deja de conservar la clave.
    fichero: 'src/core/validation/schemas.ts',
    de: '  agrupado: z.boolean().optional(),',
    a: '',
    cae: '«Generar» manda las cabeceras, en su sitio, con su modo y su descripción',
  },
];

const MID = 7;
const CLAVE_BORRADOR = `pf_quote_draft_${MID}`;
const CLIENTE = { id: 5, name: 'QA1807E', phone: '34000180700', mobile: '34000180700', email: 'qa1807e@correo.es' };

/** Lo que trae «Duplicar» de un presupuesto con dos apartados (datos de EJEMPLO). */
const PLANTILLA = {
  name: 'Copia de #18',
  currency: 'EUR',
  paymentTerms: 'FULL_UPFRONT',
  lines: [
    { concept: 'Baño', apartado: true, agrupado: true, description: 'Reforma completa del baño' },
    { concept: 'Plato de ducha', qty: 1, price: 100, tax: 0.21 },
    { concept: 'Mano de obra', qty: 2, price: 50, tax: 0.10 },
    { concept: 'Cocina', apartado: true },
    { concept: 'Grifo', qty: 1, price: 80, tax: 0.21 },
  ],
};

const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '');
const tieneClase = (n, c) => String(n.className || '').split(/\s+/).includes(c);

function banco(extra = {}) {
  const posts = [];
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url, opts) => {
      const u = String(url);
      const metodo = (opts && opts.method) || 'GET';
      let cuerpo = [];
      if (/\/admin\/customers/.test(u)) cuerpo = [CLIENTE];
      else if (/\/admin\/merchant$/.test(u)) cuerpo = { id: MID, name: 'Taller', defaultCurrency: 'EUR', country: 'ES', clausulasPresupuesto: [] };
      else if (/\/quote\/create/.test(u) && metodo === 'POST') {
        posts.push(JSON.parse(String(opts.body)));
        cuerpo = { id: 99, number: 'P-2026-0018', status: 'draft' };
      } else if (/\/admin\/quotes\/\d+$/.test(u)) cuerpo = { id: 99, pdfUrl: '/pdf/99.pdf' };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  const b = cargarDashboard(RAIZ, { red, localStorage: extra.localStorage });
  b.ctx.appMerchantId = MID;
  b.ctx.renderAppView = () => {};
  return { b, posts };
}

/** Las cabeceras que pinta el editor, leídas como las ve la persona. */
function cabeceras(contenedor) {
  return todos(contenedor).filter((n) => tieneClase(n, 'quote-line--apartado')).map((fila) => {
    const n = todos(fila);
    const uno = (c) => n.find((x) => tieneClase(x, c));
    const rotulos = n.filter((x) => tieneClase(x, 'quote-line__label')).map((x) => texto(x).trim());
    const concepto = n.find((x) => x.tagName === 'INPUT');
    const selector = n.find((x) => x.tagName === 'SELECT');
    const desc = n.find((x) => x.tagName === 'TEXTAREA');
    return {
      fila,
      rotulos,
      concepto,
      selector,
      opciones: selector ? todos(selector).filter((o) => o.tagName === 'OPTION').map((o) => texto(o).trim()) : [],
      desc,
      iva: texto(uno('quote-apartado__iva') || {}).trim(),
      total: texto(uno('quote-line__total') || {}).trim(),
    };
  });
}

async function montar(plantilla, extra) {
  const { b, posts } = banco(extra);
  const r = await pintarVista(b, 'renderQuotesView', plantilla);
  assert.equal(r.error, null, `SUELO: la vista no monta: ${r.error && r.error.message}`);
  await respirar();
  return { b, posts, r };
}

async function generar(r, posts) {
  const sel = todos(r.contenedor).find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(sel, 'SUELO: no se encuentra el selector de cliente');
  sel.value = String(CLIENTE.id);
  sel.disparar('change');
  const primaria = todos(r.contenedor).find((x) => x.tagName === 'BUTTON' && /^Generar/.test(texto(x)));
  assert.ok(primaria, 'SUELO: la pantalla no tiene «Generar»');
  primaria.disparar('click');
  await respirar(20);
  assert.equal(posts.length, 1, 'SUELO: «Generar» no ha llegado al POST /quote/create');
  return posts[0];
}

test('SCRUM-1807e · 🔴 «Duplicar» un presupuesto con apartados los conserva: dos cabeceras con su modo y su descripción', async () => {
  const { r } = await montar(PLANTILLA);
  const cs = cabeceras(r.contenedor);
  assert.equal(cs.length, 2, '🔴 el editor no pinta las cabeceras que trae la copia (las convierte en líneas)');
  assert.deepEqual(cs.map((c) => c.concepto && c.concepto.value), ['Baño', 'Cocina']);
  assert.deepEqual(cs.map((c) => c.selector && c.selector.value), ['agrupado', 'desglosado'],
    '🔴 el modo de cada apartado no se conserva (sin la clave = desglosado)');
  assert.equal(cs[0].desc && cs[0].desc.value, 'Reforma completa del baño');
  // Ni la cabecera se cuela como una línea que cobra: «Baño» no sale en un concepto de línea.
  const conceptosDeLinea = todos(r.contenedor)
    .filter((n) => tieneClase(n, 'quote-line') && !tieneClase(n, 'quote-line--apartado'))
    .map((f) => (todos(f).find((x) => x.tagName === 'INPUT') || {}).value);
  assert.deepEqual(conceptosDeLinea, ['Plato de ducha', 'Mano de obra', 'Grifo']);
});

test('SCRUM-1807e · los rótulos de la cabecera son los FIRMADOS, ni una coma más', async () => {
  const { r } = await montar(PLANTILLA);
  const [c] = cabeceras(r.contenedor);
  assert.deepEqual(c.rotulos, ['Concepto', 'Mostrar al cliente:', 'Total del apartado', 'Descripción']);
  assert.deepEqual(c.opciones, ['Desglosado', 'Agrupado']);
  const boton = todos(r.contenedor).find((x) => x.tagName === 'BUTTON' && texto(x).trim() === '+ Añadir apartado');
  assert.ok(boton, '🔴 no está el botón firmado «+ Añadir apartado»');
});

test('SCRUM-1807e · 🔴 «Total del apartado» suma lo que enseñan sus filas (con IVA, como cada fila del editor)', async () => {
  const { r } = await montar(PLANTILLA);
  const [bano, cocina] = cabeceras(r.contenedor);
  // Baño: 1 × 100 al 21 % = 121,00 · 2 × 50 al 10 % = 110,00 → 231,00. Cocina: 1 × 80 al 21 % = 96,80.
  assert.match(bano.total, /^231,00\s?€$/, `🔴 total de «Baño»: ${bano.total}`);
  assert.match(cocina.total, /^96,80\s?€$/, `🔴 total de «Cocina»: ${cocina.total}`);
});

test('SCRUM-1807e · 🔴 la columna de IVA del apartado agrupado dice «Varios» o su único tipo; en desglosado, nada', async () => {
  const { r } = await montar(PLANTILLA);
  let [bano, cocina] = cabeceras(r.contenedor);
  assert.equal(bano.iva, 'Varios', '🔴 agrupado con 21 % y 10 %: la columna de IVA no dice «Varios»');
  assert.equal(cocina.iva, '', 'desglosado: la cabecera no estrena nada en la columna de IVA');
  // Cocina pasa a agrupado: un solo tipo → ese tipo.
  cocina.selector.value = 'agrupado';
  cocina.selector.disparar('change');
  [bano, cocina] = cabeceras(r.contenedor);
  assert.equal(cocina.iva, '21 %', '🔴 agrupado con un solo tipo: la columna no dice ese tipo');
});

test('SCRUM-1807e · 🔴 «Generar» manda las cabeceras, en su sitio, con su modo y su descripción', async () => {
  const { r, posts } = await montar(PLANTILLA);
  const post = await generar(r, posts);
  const forma = post.lines.map((l) => (l.apartado === true
    ? { cab: l.concept.split('\n')[0], agrupado: l.agrupado === true, description: l.description || null }
    : { linea: l.concept.split('\n')[0] }));
  assert.deepEqual(forma, [
    { cab: 'Baño', agrupado: true, description: 'Reforma completa del baño' },
    { linea: 'Plato de ducha' },
    { linea: 'Mano de obra' },
    { cab: 'Cocina', agrupado: false, description: null },
    { linea: 'Grifo' },
  ], '🔴 el cuerpo del POST pierde las cabeceras, su sitio o su modo');
  // Y la PUERTA del servidor lo conserva (tramo d de S1, SCRUM-1807d): sin eso, el modo elegido aquí
  // se borraría en silencio al guardar.
  const { CreateQuoteSchema } = require(path.join(RAIZ, 'dist/core/validation/schemas.js'));
  const leido = CreateQuoteSchema.safeParse(post);
  assert.ok(leido.success, `🔴 el servidor rechaza el cuerpo del editor: ${leido.error && leido.error.message}`);
  assert.deepEqual(leido.data.lines.filter((l) => l.apartado === true).map((l) => l.agrupado === true), [true, false],
    '🔴 la puerta del servidor pierde `agrupado`: el modo elegido no se guardaría');
  // La cabecera no lleva importes: la puerta del servidor rechaza una con `qty`/`price` (SCRUM-655).
  for (const l of post.lines.filter((x) => x.apartado === true)) {
    assert.equal(l.qty, undefined);
    assert.equal(l.price, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(l, 'agrupado') && l.agrupado !== true, false,
      '`agrupado: false` no viaja: sin la clave, desglosado');
  }
});

test('SCRUM-1807e · CONTROL: sin apartados el cuerpo del POST es el de siempre (ninguna clave nueva)', async () => {
  const sin = { ...PLANTILLA, lines: PLANTILLA.lines.filter((l) => l.apartado !== true) };
  const { r, posts } = await montar(sin);
  assert.equal(cabeceras(r.contenedor).length, 0);
  const post = await generar(r, posts);
  assert.deepEqual(post.lines.map((l) => Object.keys(l).sort()),
    [['concept', 'price', 'qty', 'tax'], ['concept', 'price', 'qty', 'tax'], ['concept', 'price', 'qty', 'tax']]);
});

test('SCRUM-1807e · 🔴 «+ Añadir apartado» crea la cabecera y el borrador la guarda y la devuelve', async () => {
  const { b, r } = await montar(undefined);
  const boton = todos(r.contenedor).find((x) => x.tagName === 'BUTTON' && texto(x).trim() === '+ Añadir apartado');
  assert.ok(boton, 'SUELO: sin el botón no hay nada que medir');
  boton.disparar('click');
  let [c] = cabeceras(r.contenedor);
  assert.ok(c, '🔴 el botón no crea ninguna cabecera');
  c.concepto.value = 'Salón';
  c.concepto.disparar('input');
  c.selector.value = 'agrupado';
  c.selector.disparar('change');
  await respirar(800); // `scheduleDraftSave` espera 700 ms
  const crudo = b.ctx.localStorage._contenido()[CLAVE_BORRADOR];
  assert.ok(crudo, `SUELO: no se ha escrito ningún borrador en ${CLAVE_BORRADOR}`);
  const guardada = JSON.parse(crudo).lines.find((l) => l.apartado === true);
  assert.ok(guardada, '🔴 el borrador guarda la cabecera como una línea más');
  assert.equal(guardada.concept, 'Salón');
  assert.equal(guardada.agrupado, true, '🔴 el borrador pierde el modo');

  // Y vuelve COMO cabecera al recargar.
  const segunda = await montar(undefined, { localStorage: { [CLAVE_BORRADOR]: crudo } });
  [c] = cabeceras(segunda.r.contenedor);
  assert.ok(c, '🔴 el borrador devuelve la cabecera convertida en línea');
  assert.equal(c.concepto.value, 'Salón');
  assert.equal(c.selector.value, 'agrupado');
});

test('SCRUM-1807e · las piezas puras: total, IVA y cabecera para el cuerpo', () => {
  const r = piezas.resumenDeApartados([
    { total: 5, vatPerc: 21 },                       // antes de la primera cabecera: de ninguno
    { apartado: true },
    { total: 121, vatPerc: 21 },
    { total: 110, vatPerc: 10 },
    { total: 0, vatPerc: 4, enBlanco: true },        // renglón libre: no aporta su tipo
    { apartado: true },                              // apartado vacío
  ]);
  assert.deepEqual(r, [null, { total: 231, tipos: [21, 10] }, null, null, null, { total: 0, tipos: [] }]);
  const fmt = (n) => String(n).replace('.', ',');
  assert.equal(piezas.ivaDelApartado([21, 10], fmt), 'Varios');
  assert.equal(piezas.ivaDelApartado([10.5], fmt), '10,5 %');
  assert.equal(piezas.ivaDelApartado([], fmt), '');
  assert.equal(piezas.cabeceraParaPayload('  ', 'x', true, true), null);
  assert.deepEqual(piezas.cabeceraParaPayload('Baño', '', true, false), { concept: 'Baño', apartado: true });
  assert.deepEqual(piezas.cabeceraParaPayload('Baño', 'Reforma', true, true),
    { concept: 'Baño\nReforma', apartado: true, description: 'Reforma', agrupado: true });
  assert.deepEqual(piezas.cabeceraParaPayload('Baño', 'Reforma', false, true),
    { concept: 'Baño', apartado: true, description: 'Reforma', agrupado: true });
});

// tests/scrum1450-lista-albaranes-facturacion-con-palabras.test.mjs — SCRUM-1450
//
// EL GEMELO DE SCRUM-1375. Desde el 2-oct-2026 la FICHA del albarán dice «Sin facturar» /
// «Facturado en parte» / «Facturado» y la LISTA seguía con el dato: «parcial» en la marca de la
// fila y «sin facturar · parcial · facturado» en el filtro. Dos vocabularios para un hecho.
//
// Los literales son los de SCRUM-1375 comentario 18203, aplicados a un tercer sitio, y salen de
// UN mapa: el de la ficha (`textoDeFacturacion`, `albaranDetailView.js`). La lista no tiene el suyo.
//
// Se pinta la lista de verdad (`renderAlbaranesView`, con los scripts de `index.html`) y se lee lo
// que queda en el DOM del banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_LISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'albaranesView.js');
const F_INDEX = path.join(RAIZ, 'public', 'dashboard', 'index.html');

const FIRMADOS = ['Sin facturar', 'Facturado en parte', 'Facturado']; // SCRUM-1375 c.18203

const fila = (id, estadoFacturacion) => ({
  id, numero: 'AB26000' + id, emisionAt: '2026-10-01T10:00:00Z', fecha: '2026-10-02T10:00:00Z',
  cliente: 'Ana Ruiz', trabajo: 'Reforma', jobId: 1, estado: 'firmado', modoValoracion: 'VALORADO',
  quote: null, estadoFacturacion,
});

function listado(valoresDeFila, ejeCobro) {
  const filas = valoresDeFila.map((v, i) => fila(i + 1, v));
  const porCobro = {};
  for (const f of filas) porCobro[f.estadoFacturacion] = (porCobro[f.estadoFacturacion] || 0) + 1;
  return {
    filas,
    ejes: { estado: ['borrador', 'emitido', 'firmado'], cobro: ejeCobro },
    contadores: { total: filas.length, porEstado: { firmado: filas.length }, porCobro },
  };
}

function red(datos) {
  const resp = (data) => ({
    ok: true, status: 200, statusText: '200', headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (/\/admin\/albaranes(\?|$)/.test(String(url)) ? resp(datos) : resp({})),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

const conClase = (n, c) => typeof n.className === 'string' && n.className.split(' ').includes(c);

/** Pinta la lista y devuelve las marcas de facturación de las filas, las opciones del filtro y todo el texto. */
async function lista(valoresDeFila, ejeCobro = ['sin_facturar', 'parcial', 'facturado'], alCargar) {
  const banco = cargarDashboard(RAIZ, { red: red(listado(valoresDeFila, ejeCobro)) });
  banco.ctx.appModoEmision = 'fiscal';
  if (alCargar) alCargar(banco);
  const v = await pintarVista(banco, 'renderAlbaranesView');
  assert.ok(!v.error, `🔴 SUELO: la lista no se pinta: ${v.error && v.error.message}`);
  await new Promise((r) => setTimeout(r, 40));
  const nodos = todos(v.contenedor);
  const filas = nodos.filter((n) => n.tagName === 'TR' && n.hijos.some((h) => conClase(h, 'cell-status')));
  assert.equal(filas.length, valoresDeFila.length, '🔴 SUELO: no veo una fila por albarán; lo de abajo no probaría nada');
  const opciones = nodos.filter((n) => n.tagName === 'OPTION').map((n) => String(n.textContent || ''));
  assert.equal(opciones[0], `Facturación: todos (${valoresDeFila.length})`, '🔴 SUELO: no encuentro el filtro de facturación');
  return {
    marcas: nodos.filter((n) => conClase(n, 'alb-chip-cobro')).map((n) => String(n.textContent || '')),
    opciones,
    textos: nodos.filter((n) => !n.hijos.length).map((n) => String(n.textContent || '')),
  };
}

test('SCRUM-1450 · la marca de la fila dice lo mismo que la ficha: «Facturado en parte» y «Facturado»', async () => {
  const l = await lista(['sin_facturar', 'parcial', 'facturado']);
  assert.deepEqual(l.marcas, ['Facturado en parte', 'Facturado'],
    '🔴 la marca de la fila no usa los literales firmados (un albarán sin facturar sigue sin marca)');
  assert.ok(!l.textos.includes('parcial') && !l.textos.includes('facturado'),
    '🔴 el valor crudo del dato sigue a la vista en la lista');
});

test('SCRUM-1450 · el filtro de facturación usa los tres literales firmados, con su recuento', async () => {
  const l = await lista(['sin_facturar', 'sin_facturar', 'parcial', 'facturado']);
  assert.deepEqual(l.opciones, [
    'Facturación: todos (4)',
    'Sin facturar (2)',
    'Facturado en parte (1)',
    'Facturado (1)',
  ]);
});

test('SCRUM-1450 · un valor que el código NO conoce no se pinta crudo: ni marca ni opción', async () => {
  const l = await lista(['parcial', 'en_revision_fiscal'], ['sin_facturar', 'parcial', 'facturado', 'en_revision_fiscal']);
  assert.deepEqual(l.marcas, ['Facturado en parte']);
  assert.deepEqual(l.opciones, ['Facturación: todos (2)', 'Sin facturar (0)', 'Facturado en parte (1)', 'Facturado (0)']);
  assert.ok(!l.textos.some((t) => /en.revision.fiscal/.test(t)), '🔴 un valor desconocido se enseña tal cual');
});

test('SCRUM-1450 · si la ficha no ha cargado (sin su mapa), la lista se pinta y calla: nada crudo', async () => {
  const l = await lista(['parcial', 'facturado'], undefined, (banco) => { banco.ctx.textoDeFacturacion = undefined; });
  assert.deepEqual(l.marcas, []);
  assert.deepEqual(l.opciones, ['Facturación: todos (2)']);
  assert.ok(!l.textos.includes('parcial') && !l.textos.includes('facturado'));
});

test('SCRUM-1450 · UN solo mapa: la lista no escribe los literales, los pide a la ficha, que carga antes', () => {
  const sf = ts.createSourceFile('x.js', fs.readFileSync(F_LISTA, 'utf8'), ts.ScriptTarget.Latest, true);
  const literales = [];
  let llamadas = 0;
  const visita = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) literales.push(n.text);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'textoDeFacturacion') llamadas += 1;
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(literales.length > 20, '🔴 SUELO: no he leído los literales de la vista');
  for (const t of FIRMADOS) {
    assert.ok(!literales.includes(t), `🔴 la lista escribe «${t}» por su cuenta: son dos mapas para un vocabulario`);
  }
  assert.ok(llamadas >= 1, '🔴 la lista ya no pide el texto a `textoDeFacturacion`, el mapa de la ficha');

  const index = fs.readFileSync(F_INDEX, 'utf8');
  const ficha = index.indexOf('js/albaranDetailView.js');
  const laLista = index.indexOf('js/albaranesView.js');
  assert.ok(ficha > 0 && laLista > 0, '🔴 SUELO: no encuentro los dos scripts en index.html');
  assert.ok(ficha < laLista, '🔴 `albaranesView.js` carga antes que `albaranDetailView.js`: la lista saldría sin sus textos');
});

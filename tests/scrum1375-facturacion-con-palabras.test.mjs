// tests/scrum1375-facturacion-con-palabras.test.mjs — SCRUM-1375
//
// La ficha del albarán escribía el valor interno tal cual: «Facturación: sin_facturar», con su
// guion bajo, y una píldora «parcial» / «facturado» en minúscula. Visto en yaqu.app el 1-oct-2026.
//
// FIRMADO (SCRUM-1375 comentario 18203), y con las MISMAS palabras en la fila y en la píldora:
//   sin_facturar → «Sin facturar» · parcial → «Facturado en parte» · facturado → «Facturado»
// Un valor que el código no conozca NO se pinta crudo: la fila pinta la raya «—» y no hay píldora.
//
// Se pinta la pantalla de verdad (`renderAlbaranDetailView`, con los scripts de `index.html`) y se
// lee lo que queda en el DOM del banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALBARAN = Object.freeze({
  id: 11, numero: 'AB260011', estado: 'firmado', modoValoracion: 'VALORADO',
  quote: null, invoiceId: null, job: { id: 1, titulo: 'Reforma baño' }, customer: { name: 'Ana Ruiz' },
  lineas: [{ concepto: 'Tubería', cantidad: 2, precio: 10 }],
});

function red(alb) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (String(url).includes('/admin/albaranes/11') ? resp(200, alb) : resp(200, {})),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

const texto = (n) => todos(n).filter((x) => x.tagName === '#text' || !x.hijos?.length)
  .map((x) => x.textContent || '').join(' ').replace(/\s+/g, ' ').trim();

/** Pinta la ficha con ese `estadoFacturacion` y devuelve la fila «Facturación», las píldoras y todo el texto. */
async function ficha(estadoFacturacion) {
  const alb = { ...ALBARAN, estadoFacturacion };
  const banco = cargarDashboard(RAIZ, { red: red(alb) });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', alb.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  const nodos = todos(v.contenedor);
  const etiqueta = nodos.find((n) => n.className === 'detail-total-label' && texto(n) === 'Facturación');
  assert.ok(etiqueta, '🔴 SUELO: no encuentro la fila «Facturación» en la ficha');
  const celda = etiqueta._padre.hijos.filter((h) => h.tagName === 'DIV');
  assert.equal(celda.length, 1, '🔴 SUELO: la fila «Facturación» ya no tiene UNA celda de valor');
  const pildoras = nodos.filter((n) => typeof n.className === 'string' && n.className.split(' ').includes('status-pill')).map(texto);
  assert.ok(pildoras.includes('firmado'), '🔴 SUELO: no veo la píldora del estado; el «no hay píldora» de abajo no probaría nada');
  // «firmado» es el estado y «A salvo» dice dónde está la firma (SCRUM-356): no son de facturación.
  const ajenas = ['firmado', 'A salvo'];
  return { fila: texto(celda[0]), pildoras: pildoras.filter((p) => !ajenas.includes(p)), todo: texto(v.contenedor) };
}

test('SCRUM-1375 · `sin_facturar`: la fila dice «Sin facturar» y no hay píldora de facturación', async () => {
  const f = await ficha('sin_facturar');
  assert.equal(f.fila, 'Sin facturar');
  assert.deepEqual(f.pildoras, [], '🔴 un albarán sin facturar no lleva píldora de facturación');
  assert.ok(!f.todo.includes('sin_facturar'), '🔴 el identificador interno `sin_facturar` sigue a la vista');
});

test('SCRUM-1375 · `parcial`: fila y píldora dicen «Facturado en parte», las dos igual', async () => {
  const f = await ficha('parcial');
  assert.equal(f.fila, 'Facturado en parte');
  assert.deepEqual(f.pildoras, ['Facturado en parte'], '🔴 la píldora no usa las mismas palabras que la fila');
  assert.ok(!/(^| )parcial( |$)/.test(f.todo), '🔴 «parcial» suelto sigue a la vista');
});

test('SCRUM-1375 · `facturado`: fila y píldora dicen «Facturado», las dos igual', async () => {
  const f = await ficha('facturado');
  assert.equal(f.fila, 'Facturado');
  assert.deepEqual(f.pildoras, ['Facturado']);
  assert.ok(!/(^| )facturado( |$)/.test(f.todo), '🔴 «facturado» en minúscula (el valor crudo) sigue a la vista');
});

test('SCRUM-1375 · un valor que el código NO conoce no se pinta crudo: raya en la fila y sin píldora', async () => {
  const f = await ficha('en_revision_fiscal');
  assert.equal(f.fila, '—');
  assert.deepEqual(f.pildoras, []);
});

test('SCRUM-1375 · un nombre heredado de Object (`constructor`) tampoco pasa por valor conocido', async () => {
  const f = await ficha('constructor');
  assert.equal(f.fila, '—');
  assert.deepEqual(f.pildoras, []);
});

test('SCRUM-1375 · sin dato (no viaja, como en la precarga sin red): raya, igual que antes', async () => {
  const f = await ficha(undefined);
  assert.equal(f.fila, '—');
  assert.deepEqual(f.pildoras, []);
});

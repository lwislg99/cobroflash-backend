// tests/scrum1206b-la-ficha-del-albaran-pinta-sus-textos.test.mjs — SCRUM-1206 (la mitad del albarán)
//
// El PDF del albarán imprime sus dos textos libres —la cabecera (`docHeaderText`) y las
// observaciones (`notas`)— y la ficha no enseñaba ninguno. Medido en yaqu.app el 15-oct-2026
// (SCRUM-1206 c.19790): `#albaran-detail/46` lleva una nota según su GET y la nota no aparecía.
//
// FIRMADO por el orquestador (SCRUM-1206, 16-oct-2026, delegación del fundador):
//   · `notas` → rótulo «Observaciones», el MISMO que imprime el papel sobre ese campo;
//   · `docHeaderText` → SIN rótulo, como en el papel. «Añadir texto en el documento» es el del
//     formulario y no se pinta sobre un texto guardado.
// Y en el orden del papel: la cabecera antes que las observaciones. Sin dato, sin fila.
//
// Se pinta la pantalla de verdad (`renderAlbaranDetailView`, con los scripts de `index.html`) y se
// lee lo que queda en el DOM del banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const CABECERA = 'Obra de la calle Mayor, 3.º B\nAcceso por el patio';
const NOTAS = 'Se deja la llave de paso cerrada.\nVolver el lunes';

const ALBARAN = Object.freeze({
  id: 12, numero: 'AB260012', estado: 'emitido', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'sin_facturar',
  quote: null, invoiceId: null, job: { id: 1, titulo: 'Reforma baño' }, customer: { name: 'Ana Ruiz' },
  lineas: [{ concepto: 'Tubería', cantidad: 2 }],
});

function red(alb) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (/\/admin\/albaranes\/12$/.test(String(url)) ? resp(200, alb) : resp(200, [])),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

const clases = (n) => (typeof n.className === 'string' ? n.className.split(' ') : []);

/** Pinta la ficha con esos dos textos y devuelve sus filas de texto libre, en orden, y el banco. */
async function ficha(textos) {
  const alb = { ...ALBARAN, ...textos };
  const banco = cargarDashboard(RAIZ, { red: red(alb) });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', alb.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  const nodos = todos(v.contenedor);
  // CONTROL POSITIVO: la ficha se montó de verdad. Sin esto, «no hay filas» probaría nada.
  assert.ok(nodos.some((n) => n.textContent === 'AB260012'), '🔴 SUELO: no veo el número del albarán en la ficha');
  // El rótulo se reconoce por la clase de rótulo del rail: desde SCRUM-1206d (17-oct-2026, decisión
  // del orquestador) es la versalita del resto del rail, ya no `.detail-rail-etiqueta`. Que sea UNA
  // sola para todo el rail lo vigila `scrum1206d-un-solo-rotulo-en-el-rail.test.mjs`.
  const filas = nodos.filter((n) => clases(n).includes('detail-rail-linea--nota')).map((f) => {
    const hijos = f.hijos.filter((h) => h.tagName === 'SPAN');
    const et = hijos.find((h) => clases(h).includes('detail-total-label'));
    const valor = hijos.find((h) => !clases(h).includes('detail-total-label'));
    return { etiqueta: et ? et.textContent : null, valor: valor ? valor.textContent : null, enElRail: clases(f._padre).includes('detail-rail') };
  });
  return { filas, banco, todo: nodos.map((n) => n.textContent || '').join(' ') };
}

test('SCRUM-1206b · 🔴 SUELO: el rótulo «Observaciones» llega de la pieza firmada (`textoDelDocumento.js`)', async () => {
  const { banco } = await ficha({});
  assert.equal(banco.ctx.TD_TITULO_OBSERVACIONES, 'Observaciones',
    '🔴 la pieza no expone el literal firmado: lo de abajo compararía contra nada');
});

test('SCRUM-1206b · las observaciones (`notas`) salen con su rótulo «Observaciones» y sus saltos intactos', async () => {
  const { filas } = await ficha({ notas: NOTAS });
  assert.deepEqual(filas, [{ etiqueta: 'Observaciones', valor: NOTAS, enElRail: true }],
    '🔴 la ficha no enseña las observaciones que el PDF sí imprime (SCRUM-1206 c.19790)');
});

test('SCRUM-1206b · la cabecera (`docHeaderText`) sale SIN rótulo, como en el papel', async () => {
  const { filas, todo, banco } = await ficha({ docHeaderText: CABECERA });
  assert.deepEqual(filas, [{ etiqueta: null, valor: CABECERA, enElRail: true }]);
  // HERMANO (SCRUM-237): el token de abajo es el rótulo REAL del formulario, el que vive en la pieza.
  // Sin esto, la negación podría estar buscando un texto que no existe en ninguna parte y dar verde siempre.
  assert.ok(String(banco.ctx.TD_TITULO_CABECERA).includes('Añadir texto en el documento'),
    '🔴 SUELO: la pieza ya no expone ese rótulo; la negación de abajo no probaría nada');
  assert.ok(!todo.includes('Añadir texto en el documento'),
    '🔴 el rótulo del FORMULARIO encima de un texto guardado se lee como un botón que no hace nada');
});

test('SCRUM-1206b · las dos, en el orden del papel: la cabecera antes que las observaciones', async () => {
  const { filas } = await ficha({ docHeaderText: CABECERA, notas: NOTAS });
  assert.deepEqual(filas.map((f) => f.valor), [CABECERA, NOTAS]);
  assert.deepEqual(filas.map((f) => f.etiqueta), [null, 'Observaciones']);
});

test('SCRUM-1206b · sin dato, sin fila: vacío, sólo espacios, `null` o ausente no pintan nada', async () => {
  for (const textos of [{}, { notas: '', docHeaderText: '' }, { notas: '   \n ', docHeaderText: ' ' }, { notas: null, docHeaderText: null }]) {
    const { filas, todo } = await ficha(textos);
    assert.deepEqual(filas, [], `🔴 con ${JSON.stringify(textos)} sale una fila vacía`);
    assert.ok(!todo.includes('Observaciones'), `🔴 con ${JSON.stringify(textos)} sale el rótulo sobre un hueco`);
  }
});

test('SCRUM-1206b · el texto del profesional entra como TEXTO, no como marcado', async () => {
  const raro = 'medidas: 3 < 4 & <b>hecho</b>';
  const { filas } = await ficha({ notas: raro });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].valor, raro, '🔴 el texto se altera al pintarlo: entra como marcado');
});

// tests/scrum1221-banco-fallo-visible.test.mjs — SCRUM-1221
//
// El banco de vistas (`_banco-vistas.mjs`) convertía un fallo REAL en «la máquina no da»:
//   ① un `assert.equal(nodo, null)` ROJO sobre un nodo de una vista pintada no daba `AssertionError`
//     sino `RangeError: Array buffer allocation failed` a los ~94 s. `assert` inspecciona el valor con
//     `getters: true` y `depth: 1000`, y los accesores del nodo devuelven objetos nuevos en cada
//     lectura. Un OOM así se archivaba como «cosa de la máquina» (dos el 28-sep).
//   ② `removeChild` desregistraba el id del nodo quitado y no los de su subárbol (medido por S4 en
//     SCRUM-993: el «continuar» de una hoja ya cerrada seguía encontrándose por id).
//
// El caso ① corre en un SUBPROCESO con memoria y tiempo acotados: si el defecto vuelve, este test
// cae ROJO diciendo por qué, en vez de agotar la memoria de la tanda entera — que es justo el
// síntoma que no queremos volver a confundir con la máquina.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENTES = [{ id: 1, name: 'Ana', phone: '34000000002', mobile: '34000000001', email: 'a@b.com', notes: '', tags: null, createdAt: '2026-01-05T10:00:00Z' }];

// Lo que corre el subproceso: pinta la lista de clientes, toma una celda y falla un assert sobre ella.
const HIJO = `
import assert from 'node:assert/strict';
const { cargarDashboard, pintarVista, todos } = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'tests', '_banco-vistas.mjs')).href)});
const CLIENTES = ${JSON.stringify(CLIENTES)};
const banco = cargarDashboard(${JSON.stringify(RAIZ)}, { datos: (r) => (String(r).startsWith('/admin/customers') ? CLIENTES : {}) });
const r = await pintarVista(banco, 'renderCustomersView');
const celdas = todos(r.contenedor).filter((n) => n.tagName === 'TD');
const t0 = Date.now();
let out;
try { assert.equal(celdas[0], null); out = { lanzo: false }; }
catch (e) { out = { lanzo: true, clase: e.constructor.name, ms: Date.now() - t0, largo: String(e.message).length, inicio: String(e.message).slice(0, 120) }; }
console.log(JSON.stringify({ nodos: todos(r.contenedor).length, celdas: celdas.length, ...out }));
`;

test('SCRUM-1221 ① un assert ROJO sobre un nodo de una vista pintada sale como AssertionError, rápido y legible', () => {
  const r = spawnSync(process.execPath, ['--max-old-space-size=512', '--input-type=module', '-e', HIJO],
    { encoding: 'utf8', timeout: 60_000, cwd: RAIZ });
  const salida = (r.stdout || '').trim().split('\n').pop();
  assert.ok(r.status === 0 && salida,
    `🔴 el subproceso no terminó limpio (status=${r.status}, señal=${r.signal}). Si el stderr dice ` +
    '«Array buffer allocation failed» o «heap out of memory», ES EL DEFECTO DE SCRUM-1221: un nodo del ' +
    'banco vuelve a arrastrar el documento entero al inspeccionarse (¿un accesor nuevo ENUMERABLE en ' +
    `\`nodo()\`?).\nstderr: ${(r.stderr || '').slice(-600)}`);
  const m = JSON.parse(salida);
  // SUELO: el caso mira lo que dice mirar (una vista pintada de verdad, con celdas).
  assert.ok(m.nodos > 20 && m.celdas > 0, `el banco no pintó la lista: ${salida}`);
  assert.equal(m.lanzo, true, 'el assert sobre un nodo contra null tenía que FALLAR');
  assert.equal(m.clase, 'AssertionError', `el fallo salió como ${m.clase}: ${m.inicio}`);
  assert.ok(m.ms < 5_000, `el mensaje del assert tardó ${m.ms} ms en construirse`);
  assert.ok(m.largo < 200_000, `el mensaje del assert mide ${m.largo} caracteres: no se puede leer`);
});

test('SCRUM-1221 ① ocultar los accesores a la inspección NO cambia lo que devuelven', async () => {
  const banco = cargarDashboard(RAIZ, { datos: (r) => (String(r).startsWith('/admin/customers') ? CLIENTES : {}) });
  const r = await pintarVista(banco, 'renderCustomersView');
  const celda = todos(r.contenedor).find((n) => n.tagName === 'TD');
  assert.ok(celda, 'no hay celda que mirar');
  assert.ok(celda.parentNode && celda.parentNode.tagName === 'TR', 'parentNode ya no devuelve la fila');
  assert.ok(Array.isArray(celda.parentNode.children), 'children dejó de ser una lista');
  assert.equal(Object.keys(celda).includes('parentNode'), false, 'parentNode sigue siendo enumerable');
  assert.equal(Object.keys(celda).includes('_padre'), false, '_padre sigue siendo enumerable');
  celda.id = 'celda1221';
  assert.equal(banco.ctx.document.getElementById('celda1221'), celda, 'el setter de id dejó de registrar');
});

test('SCRUM-1221 ② quitar un nodo DESREGISTRA los id de todo su subárbol (removeChild y remove)', () => {
  const banco = cargarDashboard(RAIZ);
  const doc = banco.ctx.document;
  for (const via of ['removeChild', 'remove']) {
    const hoja = doc.createElement('div'); hoja.id = `hoja-${via}`;
    const dentro = doc.createElement('button'); dentro.id = `continuar-${via}`;
    hoja.appendChild(dentro);
    doc.body.appendChild(hoja);
    // Control positivo: ANTES de quitarla, los dos se encuentran.
    assert.equal(doc.getElementById(`hoja-${via}`), hoja, `${via}: la hoja no se registró`);
    assert.equal(doc.getElementById(`continuar-${via}`), dentro, `${via}: el botón no se registró`);
    if (via === 'remove') hoja.remove(); else doc.body.removeChild(hoja);
    assert.equal(doc.getElementById(`hoja-${via}`), null, `${via}: la hoja quitada se sigue encontrando`);
    assert.equal(doc.getElementById(`continuar-${via}`), null,
      `${via}: un DESCENDIENTE de la hoja quitada se sigue encontrando por id — el banco da por vivo lo que ya no se pinta`);
  }
});

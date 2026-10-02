// SCRUM-1420 · EL PAD DE FIRMA DICE CUÁNDO SE HA CERRADO (`opts.onClose`).
//
// Quien abre el pad sabe de su `onConfirm`, pero no de «Cancelar», Escape ni el clic en el fondo:
// esos se cierran dentro de `signaturePad.js` y no avisaban. La ficha del albarán, que no repinta
// con el pad abierto (SCRUM-1374), no tenía cuándo ponerse al día.
//
// Contrato (docs/master/SCRUM-1420.md): `onClose({ confirmada })`, UNA vez por pad, DESPUÉS de
// quitarlo del DOM, por los cinco caminos de cierre; un `onClose` que lance no impide el cierre; y
// sin `onClose` el componente hace lo de siempre.
//
// Ejecuta el `openSignaturePad` REAL sobre el mini-DOM del banco. El banco no dibuja (el canvas
// recibe un contexto que no hace nada) y su `document` no guarda oyentes: aquí se le pone uno que sí,
// para poder pulsar Escape. Lo que NO mide: un navegador de verdad, ni las vistas que lo abren (S4).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen } from './_banco-almacen-local.mjs';
import { todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG = 'data:image/png;base64,' + 'A'.repeat(400);

function montar() {
  const red = { fetch: async () => ({ ok: true, status: 200, statusText: '200', headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '{}', blob: async () => ({}) }) };
  red.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  const b = montarAlmacen(RAIZ, { dashboard: { red } });
  const doc = b.ctx.document;
  const crear = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const n = crear(tag);
    if (String(tag).toLowerCase() === 'canvas') {
      const nada = () => {};
      n.getContext = () => new Proxy({}, { get: () => nada, set: () => true });
      n.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 150 });
      n.setPointerCapture = nada;
      n.toDataURL = () => PNG;
    }
    return n;
  };
  // Oyentes de `document` de verdad: el pad registra Escape ahí, y lo tiene que SOLTAR al cerrarse.
  const teclas = [];
  doc.addEventListener = (tipo, fn) => { if (tipo === 'keydown') teclas.push(fn); };
  doc.removeEventListener = (tipo, fn) => { if (tipo === 'keydown') { const i = teclas.indexOf(fn); if (i !== -1) teclas.splice(i, 1); } };
  return { b, doc, teclas };
}

/** Abre el pad real y devuelve con qué pulsarlo. `cierres` recoge cada aviso y si el pad seguía en el DOM. */
function abrir(m, opts = {}) {
  const antes = new Set(m.doc.body.hijos);
  const cierres = [];
  const estaEnElDom = () => m.doc.body.hijos.includes(overlay);
  const conOnClose = opts.sinOnClose ? {} : { onClose: (info) => { cierres.push({ info: info && { ...info }, padEnElDom: estaEnElDom() }); if (opts.onCloseLanza) throw new Error('la pantalla ya no existe'); } };
  const pad = m.b.ctx.openSignaturePad({ onConfirm: opts.onConfirm || (async () => {}), ...conOnClose });
  const overlay = m.doc.body.hijos.find((h) => !antes.has(h));
  assert.ok(overlay, '🔴 SUELO: el pad no se ha montado en el body');
  const nodos = todos(overlay);
  const boton = (texto) => { const n = nodos.find((x) => (x._texto || x.textContent) === texto); assert.ok(n, `🔴 SUELO: no encuentro el botón «${texto}»`); return n; };
  const canvas = nodos.find((x) => typeof x.toDataURL === 'function');
  assert.ok(canvas, '🔴 SUELO: no encuentro el canvas del pad');
  const pulsar = async (n, ev = {}) => { for (const fn of (n._oyentes.click || []).slice()) await fn({ target: n, ...ev }); };
  return {
    pad, overlay, cierres, estaEnElDom,
    cancelar: () => pulsar(boton('Cancelar')),
    fondo: () => pulsar(overlay, { target: overlay }),
    escape: () => { for (const fn of m.teclas.slice()) fn({ key: 'Escape' }); },
    firmar: async () => {
      const ev = { preventDefault() {}, pointerId: 1, clientX: 10, clientY: 10 };
      for (const fn of canvas._oyentes.pointerdown) fn(ev);
      for (const fn of canvas._oyentes.pointermove) fn({ ...ev, clientX: 60, clientY: 40 });
      await pulsar(boton('Confirmar firma'));
    },
  };
}

test('SCRUM-1420 · suelo: el pad real se monta, y sin `onClose` se cierra como siempre', async () => {
  const m = montar();
  assert.equal(typeof m.b.ctx.openSignaturePad, 'function', '🔴 SUELO: no hay pad real');
  const p = abrir(m, { sinOnClose: true });
  assert.equal(p.estaEnElDom(), true);
  assert.equal(m.teclas.length, 1, '🔴 SUELO: el banco no ve el oyente de Escape del pad');
  await p.cancelar();
  assert.equal(p.estaEnElDom(), false, '🔴 sin `onClose` el pad ya no se cierra');
  assert.equal(m.teclas.length, 0, 'al cerrarse suelta su oyente de teclado');
});

const FILAS = [
  ['«Cancelar»', (p) => p.cancelar()],
  ['Escape', (p) => p.escape()],
  ['el clic en el fondo', (p) => p.fondo()],
  ['el `close` que se devuelve al llamador', (p) => p.pad.close()],
];
const caso = casosEscritos(FILAS, ([nombre, cerrar]) => `SCRUM-1420 · 🔴 al cerrar con ${nombre} avisa UNA vez, sin firma, y con el pad ya fuera del DOM`, async ([nombre, cerrar]) => {
  const m = montar();
  const p = abrir(m);
  assert.deepEqual(p.cierres, [], 'abrir no avisa de ningún cierre');
  await cerrar(p);
  assert.equal(p.estaEnElDom(), false, '🔴 SUELO: el pad no se ha cerrado');
  assert.deepEqual(p.cierres, [{ info: { confirmada: false }, padEnElDom: false }]);
});
test('SCRUM-1420 · 🔴 al cerrar con «Cancelar» avisa UNA vez, sin firma, y con el pad ya fuera del DOM', caso(0));
test('SCRUM-1420 · 🔴 al cerrar con Escape avisa UNA vez, sin firma, y con el pad ya fuera del DOM', caso(1));
test('SCRUM-1420 · 🔴 al cerrar con el clic en el fondo avisa UNA vez, sin firma, y con el pad ya fuera del DOM', caso(2));
test('SCRUM-1420 · 🔴 al cerrar con el `close` que se devuelve al llamador avisa UNA vez, sin firma, y con el pad ya fuera del DOM', caso(3));
caso.todos();

test('SCRUM-1420 · 🔴 al confirmar: avisa UNA vez con `confirmada: true`, y DESPUÉS de que `onConfirm` haya terminado', async () => {
  const m = montar();
  const orden = [];
  const p = abrir(m, { onConfirm: async () => { orden.push('onConfirm'); } });
  await p.firmar();
  assert.deepEqual(orden, ['onConfirm'], '🔴 SUELO: no se ha llegado a confirmar (el botón seguía bloqueado)');
  assert.equal(p.estaEnElDom(), false);
  assert.deepEqual(p.cierres, [{ info: { confirmada: true }, padEnElDom: false }]);
});

test('SCRUM-1420 · si el envío FALLA el pad no se cierra y NO avisa; al cancelar después avisa sin firma', async () => {
  const m = montar();
  const p = abrir(m, { onConfirm: async () => { throw new Error('sin cobertura'); } });
  await p.firmar();
  assert.equal(p.estaEnElDom(), true, '⛔ SCRUM-404: con el envío fallido el pad se queda abierto');
  assert.deepEqual(p.cierres, [], '🔴 avisó de un cierre que no ha ocurrido');
  await p.cancelar();
  assert.deepEqual(p.cierres, [{ info: { confirmada: false }, padEnElDom: false }]);
});

test('SCRUM-1420 · 🔴 dos cierres seguidos (el llamador y Escape, y otra vez): UN solo aviso', async () => {
  const m = montar();
  const p = abrir(m);
  p.pad.close();
  p.pad.close();
  await p.cancelar();
  await p.fondo();
  assert.equal(p.cierres.length, 1, '🔴 la vista recargaría más de una vez');
});

test('SCRUM-1420 · 🔴 un `onClose` que LANZA no deja el pad abierto ni rompe a quien lo cierra', async () => {
  const m = montar();
  const p = abrir(m, { onCloseLanza: true });
  await assert.doesNotReject(async () => { await p.cancelar(); }, '🔴 el error del oyente sale por el botón «Cancelar»');
  assert.equal(p.estaEnElDom(), false, '🔴 la persona se queda atrapada en el pad');
  assert.equal(m.teclas.length, 0, 'y suelta su oyente de teclado');
  assert.equal(p.cierres.length, 1);
  assert.doesNotThrow(() => p.pad.close(), 'un segundo cierre tampoco lanza');
  assert.equal(p.cierres.length, 1);
});

test('SCRUM-1420 · cada pad avisa de lo suyo: cerrar uno no avisa al otro', async () => {
  const m = montar();
  const uno = abrir(m);
  const dos = abrir(m);
  await uno.cancelar();
  assert.equal(uno.cierres.length, 1);
  assert.deepEqual(dos.cierres, []);
  assert.equal(dos.estaEnElDom(), true);
});

test('SCRUM-1420 · un `onClose` que no es función se ignora: el pad se cierra igual', async () => {
  const m = montar();
  const antes = new Set(m.doc.body.hijos);
  const pad = m.b.ctx.openSignaturePad({ onConfirm: async () => {}, onClose: 'no soy una función' });
  const overlay = m.doc.body.hijos.find((h) => !antes.has(h));
  assert.doesNotThrow(() => pad.close());
  assert.equal(m.doc.body.hijos.includes(overlay), false);
});

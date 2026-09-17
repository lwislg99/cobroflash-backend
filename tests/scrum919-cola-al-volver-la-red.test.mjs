// tests/scrum919-cola-al-volver-la-red.test.mjs — SCRUM-919 · punto 1
//
// LA COLA DE FIRMAS SÓLO SE VACIABA AL RECARGAR.
//
// Medido por la Sesión 0 con corte real (17-sep-2026, staging 2be8fe16, 390 px, albaranes 1635 y 1636):
// ni en 60 s con el evento `online`, ni con `visibilitychange`, ni navegando dentro de la app. Al
// recargar: 200 en /firmar y cola vacía. La causa está en `app.js`: `drenarAlAbrir()` se llama UNA vez
// al arrancar y nada más lo dispara.
//
// DECIDIDO (ticket): la cola se vacía al volver la red (`online`) y al volver a primer plano
// (`visibilitychange` → visible), con la misma idempotencia de hoy.
//
// Se ejercita con el dashboard entero (`_banco-almacen-local.mjs`: IndexedDB que cumple el estándar,
// `api.js` de verdad sobre un `fetch` controlado). El banco no registra oyentes en `document`, así que
// el enganche se prueba con la función que recibe `window` y `document`, y el cable de `app.js` se mira
// por AST.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function red() {
  const estado = { conRed: false, posts: [] };
  const responder = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  estado.fetch = async (url, opts) => {
    const metodo = (opts && opts.method) || 'GET';
    if (metodo === 'GET') return responder(200, {});
    if (!estado.conRed) throw new TypeError('Failed to fetch');
    estado.posts.push(String(url));
    await new Promise((r) => setTimeout(r, 20)); // la subida tarda: da tiempo a que llegue un segundo aviso
    return responder(200, { id: 7, estado: 'firmado' });
  };
  estado.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  return estado;
}

/** Un `window` y un `document` de mentira que guardan sus oyentes y los disparan a demanda. */
function emisores() {
  const hacer = () => {
    const oy = {};
    return {
      oy,
      addEventListener(tipo, fn) { (oy[tipo] = oy[tipo] || []).push(fn); },
      disparar(tipo) { (oy[tipo] || []).forEach((fn) => fn({ type: tipo })); },
    };
  };
  const win = hacer(); const doc = hacer(); doc.visibilityState = 'hidden';
  return { win, doc };
}

/** Deja UNA firma de albarán en la cola, como la deja firmar sin red. */
async function firmaEnCola(b, laRed) {
  laRed.conRed = false;
  const r = await b.ctx.firmarConRedDeSeguridad(1635, { signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'Ana Ruiz' },
    () => b.ctx.apiRequest('/admin/albaranes/1635/firmar', { method: 'POST', body: '{}' }), 'albaran');
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 1, '🔴 SUELO: la firma no se quedó en la cola: ' + JSON.stringify(r));
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function colaTrasAviso(b) { await esperar(150); return (await b.ctx.leerFirmasPendientes()).firmas.length; }

function montar() {
  const laRed = red();
  const b = montarAlmacen(RAIZ, { dashboard: { red: laRed } });
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null, `🔴 BANCO CIEGO: ${ciego}`);
  assert.equal(typeof b.ctx.drenarAlAbrir, 'function', '🔴 BANCO CIEGO: no hay drenarAlAbrir');
  return { b, laRed };
}

test('SCRUM-919 · 🔴 volver la red (`online`) vacía la cola sin recargar', async () => {
  const { b, laRed } = montar();
  await firmaEnCola(b, laRed);
  assert.equal(typeof b.ctx.activarDrenadoAlVolver, 'function',
    '🔴 no hay enganche: la cola sólo se vacía al recargar la app (medido por la S0 con corte real).');
  const { win, doc } = emisores();
  b.ctx.activarDrenadoAlVolver(win, doc);
  laRed.conRed = true;
  win.disparar('online');
  assert.equal(await colaTrasAviso(b), 0, '🔴 volvió la red y la firma sigue en el móvil');
  assert.deepEqual(laRed.posts, ['/admin/albaranes/1635/firmar'], '🔴 SUELO: no subió por su ruta');
});

test('SCRUM-919 · 🔴 volver a primer plano vacía la cola; irse a segundo plano NO', async () => {
  const { b, laRed } = montar();
  await firmaEnCola(b, laRed);
  assert.equal(typeof b.ctx.activarDrenadoAlVolver, 'function', '🔴 no hay enganche');
  const { win, doc } = emisores();
  b.ctx.activarDrenadoAlVolver(win, doc);
  laRed.conRed = true;

  doc.visibilityState = 'hidden';
  doc.disparar('visibilitychange');
  assert.equal(await colaTrasAviso(b), 1, '🔴 se ha drenado al IRSE a segundo plano: no es el gesto decidido');
  assert.equal(laRed.posts.length, 0);

  doc.visibilityState = 'visible';
  doc.disparar('visibilitychange');
  assert.equal(await colaTrasAviso(b), 0, '🔴 sacó el móvil del bolsillo con red y la firma sigue en el móvil');
});

test('SCRUM-919 · ⛔ dos avisos seguidos no suben la misma firma dos veces', async () => {
  const { b, laRed } = montar();
  await firmaEnCola(b, laRed);
  assert.equal(typeof b.ctx.activarDrenadoAlVolver, 'function', '🔴 no hay enganche');
  const { win, doc } = emisores();
  b.ctx.activarDrenadoAlVolver(win, doc);
  laRed.conRed = true;
  doc.visibilityState = 'visible';
  win.disparar('online');
  doc.disparar('visibilitychange'); // llega mientras la primera subida está en vuelo
  assert.equal(await colaTrasAviso(b), 0);
  assert.equal(laRed.posts.length, 1, '🔴 la misma firma se ha subido ' + laRed.posts.length + ' veces');
});

test('SCRUM-919 · ⛔ sin red el aviso no pierde la firma', async () => {
  const { b, laRed } = montar();
  await firmaEnCola(b, laRed);
  assert.equal(typeof b.ctx.activarDrenadoAlVolver, 'function', '🔴 no hay enganche');
  const { win, doc } = emisores();
  b.ctx.activarDrenadoAlVolver(win, doc);
  win.disparar('online'); // el navegador dice «online» pero la red aún no llega
  assert.equal(await colaTrasAviso(b), 1, '🔴 un aviso sin red real ha sacado la firma de la cola');
});

test('SCRUM-919 · 🔴 EL CABLE: app.js engancha el drenado al arrancar', () => {
  const rel = 'public/dashboard/js/app.js';
  const sf = ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const llamadas = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nombre = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : '');
      if (nombre === 'activarDrenadoAlVolver' || nombre === 'drenarAlAbrir') llamadas.push(nombre);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(llamadas.includes('drenarAlAbrir'), '🔴 SUELO: el lector no ve ni el drenado al abrir, que existe');
  assert.ok(llamadas.includes('activarDrenadoAlVolver'), '🔴 app.js no llama a activarDrenadoAlVolver: el enganche existiría y nadie lo pondría');
});

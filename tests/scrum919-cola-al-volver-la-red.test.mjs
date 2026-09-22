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

// ═══ PUNTO 2 · el pad NOMBRA el estado ① (textos firmados: SCRUM-919 comentario 15799) ═══════════
//
// Sin red la firma YA está guardada en el móvil (IndexedDB) y el pad decía «La firma sigue en pantalla:
// inténtalo otra vez cuando tengas señal», que invita a firmar otra vez. El pad sigue sin cerrarse sin
// ③ (SCRUM-404): sólo cambia lo que dice. Si NO se pudo guardar en el móvil, se queda el texto de hoy.

const GUARDADA_EN_EL_MOVIL = 'Sin conexión. La firma está guardada en este móvil y se enviará cuando vuelva la señal con YaQu abierto. No hace falta volver a firmar.';
const SIGUE_EN_PANTALLA = 'No se ha podido conectar. La firma sigue en pantalla: inténtalo otra vez cuando tengas señal.';

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos', fecha: '2026-09-16T08:00:00.000Z', obra: 'C/ Mayor 3',
  referencia: null, entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [], tipo: 'reparacion_asistencia',
  notas: null, estado: 'borrador', lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión de caldera' }],
  firmoElCliente: false, firmoElTecnico: false, puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
};

async function firmarParteSinRed(opciones = {}) {
  const laRed = red();
  const b = montarAlmacen(RAIZ, { ...opciones, dashboard: { red: laRed } });
  let onConfirm = null;
  const abierto = b.ctx.firmarParte(PARTE, { abrirPad: (o) => { onConfirm = o.onConfirm; }, alFirmar: async () => {}, avisar: () => {} }, 'cliente');
  assert.ok(abierto && onConfirm, '🔴 SUELO: el pad del parte no se abrió');
  let aviso = null; let cerrado = false;
  try { await onConfirm('data:image/png;base64,' + 'A'.repeat(300), { firmadoPorNombre: 'Ana Ruiz' }); cerrado = true; } catch (e) { aviso = e.message; }
  const cola = await b.ctx.leerFirmasPendientes();
  return { aviso, cerrado, cola };
}

test('SCRUM-919 · 🔴 PUNTO 2: sin red y con la firma GUARDADA en el móvil, el pad lo dice y no pide firmar otra vez', async () => {
  const r = await firmarParteSinRed();
  assert.equal(r.cola.firmas.length, 1, '🔴 SUELO: la firma no quedó guardada en el móvil');
  assert.equal(r.cerrado, false, '🔴 el pad se ha cerrado sin ③ (SCRUM-404)');
  assert.equal(r.aviso, GUARDADA_EN_EL_MOVIL, '🔴 el pad dice ' + JSON.stringify(r.aviso));
});

test('SCRUM-919 · ⛔ PUNTO 2: si NO se pudo guardar en el móvil, se queda el texto de hoy', async () => {
  const r = await firmarParteSinRed({ sinIndexedDB: true });
  assert.notEqual(r.cola.estado, 'GUARDADO', '🔴 SUELO: el almacén sí estaba disponible');
  assert.equal(r.aviso, SIGUE_EN_PANTALLA, '🔴 sin almacén el pad promete que la firma está guardada: ' + JSON.stringify(r.aviso));
});

test('SCRUM-919 · 🔴 PUNTO 2: el pad del ALBARÁN le pasa al mensaje si la firma quedó guardada', () => {
  const rel = 'public/dashboard/js/albaranDetailView.js';
  const sf = ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const llamadas = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'mensajeDeFalloAlFirmar') llamadas.push(n.arguments.map((a) => a.getText(sf)));
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(llamadas.length >= 2, '🔴 SUELO: no veo las llamadas del pad del albarán');
  assert.ok(llamadas.some((args) => args.length === 2 && /encolada/.test(args[1])),
    '🔴 el albarán llama a mensajeDeFalloAlFirmar sin decirle si la firma quedó guardada: ' + JSON.stringify(llamadas));
});

// ═══ PUNTO 3 · el pad del PARTE habla del parte (firmado: comentario 15799) ═══════════════════════
//
// La ayuda bajo el nombre del firmante venía de `ALBARAN_AYUDAS` para los dos documentos: en el parte
// decía «el albarán vale como prueba de entrega». No se amplía el valor probatorio al parte (pendiente
// del asesor): se firma un texto que sólo pide el nombre.

const AYUDA_PARTE = 'Una firma sin nombre no identifica a nadie. Escribe el nombre de quien firma el parte.';

test('SCRUM-919 · 🔴 PUNTO 3: el pad del parte enseña SU ayuda, no la del albarán', async () => {
  const require = (await import('node:module')).createRequire(import.meta.url);
  const dom = require('../dist/modules/jobs/domain/albaranFirmante.js');
  const laRed = red();
  const b = montarAlmacen(RAIZ, { dashboard: { red: laRed } });
  b.ctx.appAlbaranRotulos = dom.ALBARAN_ROTULOS;
  b.ctx.appAlbaranAyudas = dom.ALBARAN_AYUDAS;
  b.ctx.appAlbaranFirmanteOpciones = dom.firmanteCalidadOpciones();
  b.ctx.appParteAyudas = dom.PARTE_AYUDAS; // lo que sirve /admin/me
  assert.equal(typeof b.ctx.openSignaturePad, 'function', '🔴 SUELO: no hay pad real');
  // El mini-DOM no dibuja: el canvas del pad recibe un contexto que no hace nada (aquí se mira el TEXTO).
  const crear = b.ctx.document.createElement.bind(b.ctx.document);
  b.ctx.document.createElement = (tag) => { const n = crear(tag); if (String(tag).toLowerCase() === 'canvas') { const nada = () => {}; n.getContext = () => new Proxy({}, { get: () => nada, set: () => true }); n.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 150 }); } return n; };
  b.ctx.firmarParte(PARTE, { alFirmar: async () => {}, avisar: () => {} }, 'cliente');
  const { todos } = await import('./_banco-vistas.mjs');
  const textos = todos(b.ctx.document.body).map((n) => n._texto || '').filter(Boolean);
  assert.ok(textos.includes(dom.ALBARAN_ROTULOS.firmadoPorNombre), '🔴 SUELO: el pad no pinta el bloque del firmante');
  assert.ok(!textos.some((t) => /albarán vale como prueba/.test(t)), '🔴 el pad del PARTE habla del albarán');
  assert.ok(textos.includes(AYUDA_PARTE), '🔴 el pad del parte no enseña la ayuda firmada del parte');
});

test('SCRUM-919 · PUNTO 3: la ayuda del parte viaja por /admin/me y la del albarán no cambia', async () => {
  const require = (await import('node:module')).createRequire(import.meta.url);
  const dom = require('../dist/modules/jobs/domain/albaranFirmante.js');
  assert.equal(dom.PARTE_AYUDAS && dom.PARTE_AYUDAS.firmadoPorNombre, AYUDA_PARTE, '🔴 la ayuda del parte no está en su fuente única');
  assert.match(dom.ALBARAN_AYUDAS.firmadoPorNombre, /albarán vale como prueba de entrega/, '⛔ se ha tocado el texto del albarán');
  const app = fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8');
  assert.match(app, /parteAyudas:\s*PARTE_AYUDAS/, '🔴 /admin/me no sirve la ayuda del parte');
});

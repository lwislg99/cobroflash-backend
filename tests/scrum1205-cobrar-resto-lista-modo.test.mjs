// tests/scrum1205-cobrar-resto-lista-modo.test.mjs — SCRUM-1205 (resto de SCRUM-1160)
//
// «💰 COBRAR EL RESTO» DE LA LISTA DE TRABAJOS FALLABA SIEMPRE EN MODO JUSTIFICANTE, Y EN ROJO CON UN MARCADOR.
//
// SCRUM-1160 arregló la ficha (la escalera `jobNextAction` salta el cobro sin `facturaFiscalDisponible()`),
// pero la LISTA calculaba su propio `cobraAqui` sin mirar el modo. `collect-rest` emite una factura y
// en `receipt` responde 409 `facturacion_no_disponible` con el `message` sin firmar, y `avisoDeFallo`
// lo pintaba: toast rojo «No se pudo generar el cobro: [PENDIENTE…]». `receipt` es el modo de todo
// merchant español real hoy.
//
// Se mide EL VIAJE: merchant → veredicto del SERVIDOR (`modoEmisionVisible`, de `dist`) → la sentencia
// REAL de `app.js` que asigna `window.appModoEmision` → `renderJobsView` montada con un Trabajo
// terminado con saldo → ¿está el botón? Y el cinturón: con el botón puesto, un 409 así pinta el
// texto firmado de SCRUM-1160, no el `message` del servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { modoEmisionVisible } from '../dist/modules/invoicing/domain/modoVisible.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respirar = () => new Promise((r) => setTimeout(r, 80));
// Pulsa como el navegador: el oyente usa `ev.currentTarget`, que el `disparar` del banco no pone.
async function pulsar(n) {
  for (const f of (n._oyentes && n._oyentes.click) || []) await f.call(n, { type: 'click', target: n, currentTarget: n, preventDefault() {}, stopPropagation() {} });
  await respirar();
}
const texto = (n) => String((n && n.textContent) || (n && n._html && !/</.test(n._html) ? n._html : '') || '');

// ⚠️ `id` REAL: `isDemoMerchant` es `id === 1` o `demo@yaqu.app` (ver scrum298).
const ES_REAL = { id: 7, email: 'pro@fontaneria.es', country: 'ES', flags: null };
const ES_CON_FLAG = { ...ES_REAL, flags: { INVOICING_ES_ENABLED: true } };
// El marcador se arma por trozos: aquí sólo sirve para reproducir lo que manda el servidor.
const MARCADOR = '[PENDIENTE' + ' microcopy oficial]';
const FIRMADO_1160 = 'Desde tu cuenta todavía no se pueden generar facturas.';

const TRABAJO = {
  id: 41, title: 'Cambio de calentador', status: 'terminado', scheduledAt: null,
  customer: { id: 3, name: 'Marta Gil', phone: '+34600111222' },
  remaining: { amount: 250, currency: 'EUR' }, total: { amount: 500, currency: 'EUR' },
  invoices: [], albaranes: [], tecnicos: [],
};

function derivacionDeApp() {
  const app = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const m = app.match(/window\.appModoEmision\s*=[^;]+;/);
  assert.ok(m, '🔴 CIEGO: `app.js` ya no asigna `window.appModoEmision`');
  return m[0];
}

function red(respuestaCobro) {
  const posts = [];
  const fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    if (metodo === 'POST' && /\/collect-rest$/.test(u)) {
      posts.push(u);
      const { status, data } = respuestaCobro;
      return { ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' }, json: async () => data, text: async () => JSON.stringify(data) };
    }
    const cuerpo = /\/admin\/jobs$/.test(u) ? [JSON.parse(JSON.stringify(TRABAJO))] : /\/admin\/team/.test(u) ? [] : {};
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
  };
  return { posts, fetch, navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } } };
}

async function listaDe(me, respuestaCobro = { status: 409, data: { error: 'facturacion_no_disponible', message: MARCADOR } }) {
  const laRed = red(respuestaCobro);
  const b = cargarDashboard(RAIZ, { red: laRed });
  b.ctx.appUserRole = 'admin';
  vm.runInContext(`(function (me) { ${derivacionDeApp()} })`, b.ctx)(me);
  const toasts = [];
  b.ctx.showToast = (msg, tipo) => { toasts.push({ msg: String(msg), tipo }); };
  const r = await pintarVista(b, 'renderJobsView');
  assert.equal(r.error, null, `🔴 SUELO: la lista no monta: ${r.error && r.error.message}`);
  await respirar();
  const n = todos(r.contenedor);
  // Control de ceguera: la fila del Trabajo tiene que estar, o «no hay botón» no dice nada.
  assert.ok(n.some((x) => /Marta Gil/.test(texto(x))), '🔴 CIEGO: la fila del Trabajo (su cliente) no se ha pintado');
  const cobrar = n.find((x) => x.tagName === 'BUTTON' && /Cobrar el resto/.test(texto(x)));
  return { b, modo: b.ctx.appModoEmision, cobrar, toasts, laRed };
}

test('SCRUM-1205 · 🔴 merchant español real (receipt): la lista NO ofrece «💰 Cobrar el resto»', async () => {
  const { modo, cobrar } = await listaDe({ modoEmision: modoEmisionVisible(ES_REAL) });
  assert.equal(modo, 'receipt', 'SUELO: el viaje no llegó en modo receipt');
  assert.equal(Boolean(cobrar), false, '🔴 la primaria de la fila es un botón que en receipt SIEMPRE falla (409)');
});

test('SCRUM-1205 · 🔴 falla cerrado: sin modo (`/admin/me` sin el campo) tampoco se ofrece', async () => {
  const { modo, cobrar } = await listaDe({});
  assert.equal(modo, null);
  assert.equal(Boolean(cobrar), false);
});

test('SCRUM-1205 · CONTROL POSITIVO: con el interruptor encendido (fiscal) el botón SÍ está, con su importe', async () => {
  const { modo, cobrar } = await listaDe({ modoEmision: modoEmisionVisible(ES_CON_FLAG) });
  assert.equal(modo, 'fiscal');
  assert.ok(cobrar, '🔴 en modo fiscal ha desaparecido el cobro: ocultar no era borrar');
  assert.match(texto(cobrar), /250/);
});

test('SCRUM-1205 · 🔴 CINTURÓN: si llega el 409 `facturacion_no_disponible`, sale el texto firmado de 1160 y NUNCA el marcador', async () => {
  const { cobrar, toasts, laRed } = await listaDe({ modoEmision: 'fiscal' });
  assert.ok(cobrar, 'SUELO: sin botón no hay cinturón que probar');
  await pulsar(cobrar);
  assert.equal(laRed.posts.length, 1, 'SUELO: el clic no llegó a `collect-rest`');
  assert.equal(toasts.length, 1, 'SUELO: el fallo no avisó');
  assert.doesNotMatch(toasts[0].msg, /\[PENDIENTE/, '🔴 el toast enseña el marcador del servidor');
  assert.equal(toasts[0].msg, FIRMADO_1160);
});

test('SCRUM-1205 · CONTROL: otro error con texto firmado del servidor sale como antes («No se pudo generar el cobro: …»)', async () => {
  const { cobrar, toasts } = await listaDe({ modoEmision: 'fiscal' }, { status: 409, data: { error: 'sin_saldo', message: 'Este trabajo ya está cobrado.' } });
  await pulsar(cobrar);
  assert.equal(toasts[0].msg, 'No se pudo generar el cobro: Este trabajo ya está cobrado.');
});

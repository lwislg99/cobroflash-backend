// tests/scrum1371-reintentar-no-vuelve-a-crear.test.mjs — SCRUM-1371
//
// EN EL PRESUPUESTO RÁPIDO, REINTENTAR EL ENVÍO NO VUELVE A CREAR LO YA CREADO.
//
// «Enviar por WhatsApp» hace tres cosas seguidas: alta del cliente (si es nuevo), alta del
// presupuesto y envío. Si el envío falla con error, el botón vuelve a encenderse, y cada clic
// repetía las tres: un presupuesto por clic, y con cliente nuevo también un cliente por clic.
//
// ⚠️ No es un doble clic con la petición en vuelo —el botón ya se apaga mientras envía—: es el
// reintento DESPUÉS del fallo. Por eso aquí cada clic se espera entero antes del siguiente.
//
// Vista real en el banco, red de mentira. Lo que NO mide: un navegador ni el servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respuesta = (status, cuerpo) => ({
  ok: status < 400, status,
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
});
const vueltas = async (n = 60) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

/** El modal abierto sobre una red que cuenta lo que se crea. `envio` decide qué contesta el envío. */
function montar({ envio }) {
  const hecho = { clientes: [], presupuestos: [], envios: [] };
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    const u = String(url);
    if (metodo === 'GET') return respuesta(200, []);
    const cuerpo = opts.body ? JSON.parse(opts.body) : null;
    if (/\/admin\/customers$/.test(u)) { hecho.clientes.push(cuerpo); return respuesta(200, { id: 900 + hecho.clientes.length, name: cuerpo.name }); }
    if (/\/quote\/create$/.test(u)) { hecho.presupuestos.push(cuerpo); return respuesta(200, { id: 500 + hecho.presupuestos.length, status: 'draft' }); }
    const m = u.match(/\/admin\/quotes\/(\d+)\/send-whatsapp$/);
    if (m) { hecho.envios.push(Number(m[1])); return envio(hecho.envios.length); }
    return respuesta(200, {});
  };
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  const ctx = banco.ctx;
  ctx.appMerchantId = 46;
  ctx.renderAppView = () => {};
  ctx.showToast = () => {};
  const $ = (id) => ctx.document.getElementById(id);
  const estado = () => vm.runInContext('qqState', ctx);
  const abrir = () => {
    ctx.openQuickQuoteModal();
    assert.ok($('qq-send'), '🔴 CIEGO: el modal del presupuesto rápido no se pintó');
  };
  const rellenar = ({ existente = false, telefono = '', precio = 50 } = {}) => {
    const e = estado();
    e.customerName = 'Cliente de pruebas';
    if (existente) { e.customerId = 83; e.customerPhone = telefono; } else if ($('qq-customer-phone')) $('qq-customer-phone').value = telefono;
    e.products = [{ concept: 'Punto de luz', qty: 1, price: precio }];
  };
  const pulsar = async () => { await ctx.submitQuickQuote(); await vueltas(); };
  const cerrar = () => ctx.closeQuickQuote();
  return { hecho, abrir, cerrar, rellenar, pulsar, estado, $ };
}

const sinTelefono = () => respuesta(400, { ok: false, error: 'customer_missing_phone' });
const enviado = () => respuesta(200, { ok: true, sent: true });

test('SCRUM-1371 · ✅ CONTROL POSITIVO: un clic con todo bien crea UN presupuesto y lo envía', async () => {
  const m = montar({ envio: enviado });
  m.abrir(); m.rellenar({ existente: true, telefono: '34000000001' });
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 1, '🔴 CIEGO: un clic normal no crea el presupuesto');
  assert.deepEqual(m.hecho.envios, [501], '🔴 CIEGO: el presupuesto creado no se envía');
  assert.equal(m.hecho.clientes.length, 0);
});

test('SCRUM-1371 · 🔴 cliente EXISTENTE y el envío falla: dos clics, UN presupuesto', async () => {
  const m = montar({ envio: sinTelefono });
  m.abrir(); m.rellenar({ existente: true });
  await m.pulsar();
  assert.equal(m.$('qq-send').disabled, false, '🔴 CIEGO: tras el fallo el botón no se rehabilita; no hay reintento que medir');
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 1,
    `🔴 SE HAN CREADO ${m.hecho.presupuestos.length} PRESUPUESTOS con dos clics: uno por reintento.`);
  assert.deepEqual(m.hecho.envios, [501, 501], '🔴 el reintento no vuelve a intentar el envío del MISMO presupuesto');
});

test('SCRUM-1371 · 🔴 cliente NUEVO y el envío falla: dos clics, UN cliente y UN presupuesto', async () => {
  const m = montar({ envio: sinTelefono });
  m.abrir(); m.rellenar({ telefono: '34000000001' });
  await m.pulsar();
  await m.pulsar();
  assert.equal(m.hecho.clientes.length, 1, `🔴 SE HAN CREADO ${m.hecho.clientes.length} CLIENTES con dos clics.`);
  assert.equal(m.hecho.presupuestos.length, 1, `🔴 se han creado ${m.hecho.presupuestos.length} presupuestos con dos clics.`);
  assert.equal(m.hecho.presupuestos[0].customer_id, 901, '🔴 el presupuesto no es del cliente recién creado');
  assert.deepEqual(m.hecho.envios, [501, 501]);
});

test('SCRUM-1371 · ✅ el envío falla y a la segunda sale: sigue habiendo UNO, y se envía ése', async () => {
  const m = montar({ envio: (n) => (n === 1 ? sinTelefono() : enviado()) });
  m.abrir(); m.rellenar({ existente: true });
  await m.pulsar();
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 1);
  assert.deepEqual(m.hecho.envios, [501, 501]);
});

test('SCRUM-1371 · ✅ si se CAMBIAN las líneas antes de reintentar, es otro presupuesto: no se reenvía el viejo', async () => {
  const m = montar({ envio: sinTelefono });
  m.abrir(); m.rellenar({ existente: true, precio: 50 });
  await m.pulsar();
  m.estado().products = [{ concept: 'Punto de luz', qty: 1, price: 80 }];
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 2, '🔴 se reenvió el presupuesto VIEJO con un precio que la persona ya había cambiado.');
  assert.equal(m.hecho.presupuestos[1].lines[0].price, 80);
  assert.deepEqual(m.hecho.envios, [501, 502]);
});

test('SCRUM-1371 · ✅ cerrar y abrir el modal empieza de cero: lo recordado no pasa a otro presupuesto', async () => {
  const m = montar({ envio: sinTelefono });
  m.abrir(); m.rellenar({ existente: true });
  await m.pulsar();
  // Se CIERRA antes: `openQuickQuoteModal` no hace nada si el modal sigue en pantalla, y sin
  // cerrar este test mediría un tercer clic sobre el mismo modal (medido: salía «1»).
  m.cerrar();
  assert.equal(m.$('qq-send'), null, '🔴 CIEGO: el modal no se cerró; lo de abajo no sería un modal nuevo');
  m.abrir(); m.rellenar({ existente: true });
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 2, '🔴 un modal recién abierto reutiliza el presupuesto de la vez anterior.');
});

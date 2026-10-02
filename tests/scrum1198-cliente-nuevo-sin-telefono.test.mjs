// SCRUM-1198 (a) · PRESUPUESTO RÁPIDO, CLIENTE NUEVO SIN TELÉFONO: lo tecleado no se pierde.
//
// Medido en yaqu.app el 2-oct-2026: el panel mandaba `POST /admin/customers` con `phone: null`, y
// el alta contesta 400 `validation_error` («expected string, received null»). El esquema admite que
// el teléfono NO VENGA, no que venga `null`. No se creaba ni el cliente ni el presupuesto.
//
// Aquí la red de mentira lleva ESE contrato: rechaza `phone: null` con el cuerpo que devolvió
// producción y acepta el alta sin `phone`. El envío sin teléfono contesta el 400
// `customer_missing_phone` de producción.
//
// Lo que este fichero NO arregla ni mide: qué se le dice a la persona. Tras este cambio se sigue
// leyendo un código interno (el del envío); eso es la parte (b) del ticket y espera texto firmado.
// Tampoco mide el servidor de verdad: eso está en el registro, medido contra yaqu.app.
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

function montar() {
  const hecho = { altasDeCliente: [], clientes: [], presupuestos: [], envios: [] };
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    const u = String(url);
    if (metodo === 'GET') return respuesta(200, []);
    const cuerpo = opts.body ? JSON.parse(opts.body) : null;
    if (/\/admin\/customers$/.test(u)) {
      hecho.altasDeCliente.push(cuerpo);
      // El contrato de producción: `phone` puede faltar; si viene, tiene que ser un texto.
      if ('phone' in cuerpo && typeof cuerpo.phone !== 'string') {
        return respuesta(400, { error: 'validation_error', details: [{ expected: 'string', code: 'invalid_type', path: ['phone'], message: 'Invalid input: expected string, received null' }] });
      }
      const cliente = { id: 900 + hecho.clientes.length + 1, name: cuerpo.name, phone: cuerpo.phone || null };
      hecho.clientes.push(cliente);
      return respuesta(201, cliente);
    }
    if (/\/quote\/create$/.test(u)) { hecho.presupuestos.push(cuerpo); return respuesta(201, { id: 500 + hecho.presupuestos.length, status: 'draft' }); }
    const m = u.match(/\/admin\/quotes\/(\d+)\/send-whatsapp$/);
    if (m) {
      hecho.envios.push(Number(m[1]));
      const presupuesto = hecho.presupuestos[Number(m[1]) - 501];
      const cliente = hecho.clientes.find((c) => c.id === presupuesto.customer_id || c.id === presupuesto.customerId);
      if (cliente && !cliente.phone) return respuesta(400, { ok: false, error: 'customer_missing_phone' });
      return respuesta(200, { ok: true, sent: true });
    }
    return respuesta(200, {});
  };
  const { ctx } = cargarDashboard(RAIZ, { red: { fetch } });
  ctx.appMerchantId = 46;
  ctx.renderAppView = () => {};
  ctx.showToast = () => {};
  const $ = (id) => ctx.document.getElementById(id);
  ctx.openQuickQuoteModal();
  assert.ok($('qq-send'), '🔴 CIEGO: el modal del presupuesto rápido no se pintó');
  const rellenar = (telefono) => {
    const e = vm.runInContext('qqState', ctx);
    e.customerName = 'Cliente nuevo de pruebas';
    e.customerId = null;
    assert.ok($('qq-customer-phone'), '🔴 CIEGO: no hay campo de teléfono para el cliente nuevo');
    $('qq-customer-phone').value = telefono;
    e.products = [{ concept: 'Punto de luz', qty: 1, price: 50 }];
  };
  const pulsar = async () => { await ctx.submitQuickQuote(); await vueltas(); };
  return { hecho, rellenar, pulsar, $ };
}

test('SCRUM-1198 · suelo: la red de mentira rechaza `phone: null` como producción, y acepta que no venga', async () => {
  const m = montar();
  m.rellenar('');
  await m.pulsar();
  assert.equal(m.hecho.altasDeCliente.length, 1, '🔴 CIEGO: el clic no llegó a dar de alta al cliente');
});

test('SCRUM-1198 · 🔴 cliente nuevo SIN teléfono: `phone` no viaja, y se crean el cliente y el presupuesto', async () => {
  const m = montar();
  m.rellenar('');
  await m.pulsar();
  assert.deepEqual(m.hecho.altasDeCliente, [{ name: 'Cliente nuevo de pruebas' }], '🔴 el alta lleva un `phone` que el servidor no admite');
  assert.equal(m.hecho.clientes.length, 1, '🔴 el cliente no se ha creado: lo tecleado se pierde');
  assert.equal(m.hecho.presupuestos.length, 1, '🔴 el presupuesto no se ha creado: lo tecleado se pierde');
  assert.deepEqual(m.hecho.envios, [501], 'el envío se intenta sobre ese presupuesto (y falla: no hay teléfono)');
});

test('SCRUM-1198 · un teléfono de sólo espacios es «sin teléfono»', async () => {
  const m = montar();
  m.rellenar('   ');
  await m.pulsar();
  assert.deepEqual(m.hecho.altasDeCliente, [{ name: 'Cliente nuevo de pruebas' }]);
  assert.equal(m.hecho.presupuestos.length, 1);
});

test('SCRUM-1198 · CONTROL: con teléfono, el alta lo lleva tal cual y el envío sale', async () => {
  const m = montar();
  // Rango imposible de SCRUM-262 (`340…`): un teléfono de prueba no puede ser el de nadie.
  m.rellenar('34000001198');
  await m.pulsar();
  assert.deepEqual(m.hecho.altasDeCliente, [{ name: 'Cliente nuevo de pruebas', phone: '34000001198' }]);
  assert.equal(m.hecho.presupuestos.length, 1);
  assert.deepEqual(m.hecho.envios, [501]);
});

test('SCRUM-1198 · 🔴 reintentar tras el fallo del envío NO vuelve a crear ni cliente ni presupuesto (SCRUM-1371 sigue valiendo)', async () => {
  const m = montar();
  m.rellenar('');
  await m.pulsar();
  assert.equal(m.$('qq-send') && m.$('qq-send').disabled, false, '🔴 CIEGO: tras el fallo el botón no se rehabilita; no hay reintento que medir');
  await m.pulsar();
  await m.pulsar();
  assert.equal(m.hecho.altasDeCliente.length, 1, '🔴 cada reintento da de alta al cliente otra vez');
  assert.equal(m.hecho.presupuestos.length, 1, '🔴 cada reintento crea otro presupuesto');
  assert.deepEqual(m.hecho.envios, [501, 501, 501], 'los reintentos vuelven a intentar el envío del MISMO presupuesto');
});

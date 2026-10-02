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
// (b)(c)(d) · QUÉ SE LE DICE: cuando el envío contesta que no hay teléfono, el modal se cierra y el
// aviso se da fuera, con su texto aprobado. Antes se quedaba abierto con el botón encendido y
// «API 400: customer_missing_phone» a la vista. Vale igual con cliente nuevo y con existente.
// Lo que NO mide: el servidor de verdad (está en el registro, medido contra yaqu.app).
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
  const hecho = { altasDeCliente: [], clientes: [], presupuestos: [], envios: [], avisos: [], vistas: [], elEnvioContesta: null };
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
      if (hecho.elEnvioContesta) return hecho.elEnvioContesta();
      const presupuesto = hecho.presupuestos[Number(m[1]) - 501];
      const cliente = hecho.clientes.find((c) => c.id === presupuesto.customer_id || c.id === presupuesto.customerId);
      if (cliente && !cliente.phone) return respuesta(400, { ok: false, error: 'customer_missing_phone' });
      return respuesta(200, { ok: true, sent: true });
    }
    return respuesta(200, {});
  };
  const { ctx } = cargarDashboard(RAIZ, { red: { fetch } });
  ctx.appMerchantId = 46;
  ctx.renderAppView = (vista, datos) => { hecho.vistas.push([vista, datos && datos.quoteId]); };
  ctx.showToast = (texto) => { hecho.avisos.push(String(texto)); };
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
  // Cliente que YA existe y no tiene teléfono: se elige, no se da de alta.
  const elegirExistente = () => {
    hecho.clientes.push({ id: 84, name: 'Cliente que ya existe', phone: null });
    const e = vm.runInContext('qqState', ctx);
    e.customerName = 'Cliente que ya existe';
    e.customerId = 84;
    e.products = [{ concept: 'Punto de luz', qty: 1, price: 50 }];
  };
  const pulsar = async () => { await ctx.submitQuickQuote(); await vueltas(); };
  // Todo lo que la persona puede leer: el modal (si sigue) y los avisos de fuera.
  const loQueSeLee = () => [($('qq-alert') && $('qq-alert').textContent) || '', ...hecho.avisos].join(' | ');
  return { hecho, rellenar, elegirExistente, pulsar, loQueSeLee, $ };
}

const AVISO = 'No hemos podido enviarlo porque este cliente no tiene teléfono. El presupuesto se ha guardado.';

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

// ── (b)(c)(d) · lo que se le dice, y dónde ─────────────────────────────────────────────────────
for (const camino of ['nuevo', 'existente']) {
  test(`SCRUM-1198 · 🔴 cliente ${camino} sin teléfono: el modal se CIERRA y el aviso aprobado se da fuera`, async () => {
    const m = montar();
    if (camino === 'nuevo') m.rellenar(''); else m.elegirExistente();
    await m.pulsar();
    assert.deepEqual(m.hecho.envios, [501], '🔴 CIEGO: el envío no se intentó; no hay rechazo que medir');
    assert.equal(m.hecho.presupuestos.length, 1, '🔴 el aviso dice «se ha guardado» y no hay presupuesto');
    assert.equal(m.$('qq-send'), null, '🔴 el modal sigue abierto: la persona vuelve a pulsar «Enviar» y vuelve a fallar');
    assert.deepEqual(m.hecho.avisos, [AVISO], '🔴 el aviso de fuera no es el literal aprobado, o no es uno solo');
    assert.doesNotMatch(m.loQueSeLee(), /customer_missing_phone|API \d{3}/, '🔴 se lee un código interno');
    await new Promise((r) => setTimeout(r, 500));
    assert.deepEqual(m.hecho.vistas, [['quotes-detail', 501]], '🔴 no se abre el presupuesto que se ha guardado');
  });
}

test('SCRUM-1198 · CONTROL NEGATIVO: otro fallo del envío NO se disfraza de «sin teléfono», y deja reintentar', async () => {
  const m = montar();
  m.hecho.elEnvioContesta = () => respuesta(500, { ok: false, error: 'server_error' });
  m.rellenar('');
  await m.pulsar();
  assert.ok(m.$('qq-send'), '🔴 el modal se cerró con un fallo que no es el de teléfono');
  assert.equal(m.$('qq-send').disabled, false, 'el botón se rehabilita: este fallo sí se reintenta');
  assert.deepEqual(m.hecho.avisos, [], '🔴 se dijo «no tiene teléfono» de un fallo que no lo es');
  // Y el reintento sigue sin duplicar (SCRUM-1371).
  await m.pulsar();
  assert.equal(m.hecho.altasDeCliente.length, 1);
  assert.equal(m.hecho.presupuestos.length, 1);
  assert.deepEqual(m.hecho.envios, [501, 501]);
});

test('SCRUM-1198 · CONTROL: cuando el envío sale, no aparece el aviso de «sin teléfono»', async () => {
  const m = montar();
  m.rellenar('34000001198');
  await m.pulsar();
  assert.equal(m.$('qq-send'), null);
  assert.equal(m.hecho.avisos.includes(AVISO), false);
});

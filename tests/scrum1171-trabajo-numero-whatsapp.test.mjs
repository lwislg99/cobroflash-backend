// tests/scrum1171-trabajo-numero-whatsapp.test.mjs — SCRUM-1171 · mitad de servidor
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA FICHA DEL TRABAJO RECIBE EL NÚMERO DE WHATSAPP YA RESUELTO
//
// El bloque Cliente del Trabajo (`jobRailBlocks.js`) pintaba «💬 WhatsApp» sólo desde
// `customer.phone`: un cliente con sólo MÓVIL se quedaba sin botón. Aquí el front PINTA el número
// (`wa.me/<n>`), así que un booleano como el de SCRUM-1166 no le sirve: necesita el valor.
//
// 🔴 Y el valor sale de `canalDeWhatsApp`, la MISMA función que usa el envío real, y no se le
// mandan los dos números para que elija: el botón tiene que escribir al número al que YaQu envía,
// y dos copias del criterio divergen (SCRUM-1147). Por eso este test compara contra LITERALES y
// además contra `canalDeWhatsApp` del propio `dist/`: si alguien reescribe el criterio aquí a mano,
// el día que el de envío cambie, esto se pone rojo.
//
// Lo de LLAMAR (📞) no va aquí, a propósito (decisión del orquestador, SCRUM-1171 com. 17269 y
// siguientes): ya existe en el front `contactoDelCliente` (api.js, SCRUM-1032) con dos enlaces
// `tel:`; la ficha del Trabajo la reutiliza (S2).
//
// Banco: el manejador REAL de `GET /admin/jobs/:id` con la base doblada (`_envio-doblado.mjs`).
// El doble de `job.findFirst` sólo contesta si la consulta pide el Trabajo para SU merchant (regla 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: el rango imposible

const RUTAS_JOBS = '../dist/modules/jobs/app/routes/jobs.routes.js';
const OTRO_MERCHANT = MERCHANT + 1;
const MOVIL = telefonoDePrueba(1171);
const FIJO = telefonoDePrueba(11712);

const CLIENTES = {
  soloMovil: { id: 71, name: 'Solo móvil', phone: null, mobile: MOVIL },
  soloFijo: { id: 72, name: 'Solo fijo', phone: FIJO, mobile: null },
  ninguno: { id: 73, name: 'Sin número', phone: null, mobile: null },
  ambos: { id: 74, name: 'Fijo y móvil', phone: FIJO, mobile: MOVIL },
};

const trabajoDe = (cliente) => ({
  id: 900 + cliente.id, merchantId: MERCHANT, customerId: cliente.id, quoteId: null,
  status: 'pending', operarioId: null, assignedUserId: null, titulo: 'Revisión caldera',
  createdAt: new Date('2026-09-27T10:00:00Z'), updatedAt: new Date('2026-09-27T10:00:00Z'),
});

/** Lo que hace una base: devolver EXACTAMENTE las claves que el `select` pide. */
function aplicarSelect(fila, select) {
  if (!select) return { ...fila };
  const salida = {};
  for (const [k, v] of Object.entries(select)) if (v) salida[k] = fila[k] ?? null;
  return salida;
}

let manejador = null;
let canalDeWhatsApp = null;
const consultasJob = [];
let clienteActual = null;

function banco() {
  if (manejador) return;
  inyectarBase({
    'job.findFirst': (args) => {
      consultasJob.push(args);
      const t = clienteActual && trabajoDe(clienteActual);
      const w = args?.where ?? {};
      return t && w.id === t.id && w.merchantId === t.merchantId ? t : null;
    },
    'customer.findUnique': (args) => {
      if (!clienteActual || args?.where?.id !== clienteActual.id) return null;
      return aplicarSelect({ ...clienteActual, email: null, taxId: null, notes: null }, args?.select);
    },
  }, [RUTAS_JOBS]);
  const router = moduloDeDist(RUTAS_JOBS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro `GET /admin/jobs/:id` en el router. Si se movió, se reapunta el test.');
  manejador = capa.route.stack[capa.route.stack.length - 1].handle;
  canalDeWhatsApp = moduloDeDist('../dist/core/contacto/canalDeWhatsApp.js').canalDeWhatsApp;
}

async function detalle(cliente, merchantId = MERCHANT) {
  banco();
  clienteActual = cliente;
  let estado = 200, objeto = null;
  const res = {
    status(c) { estado = c; return res; },
    json(j) { objeto = JSON.parse(JSON.stringify(j)); return res; },
  };
  await manejador({ params: { id: String(900 + cliente.id) }, merchantId, userRole: 'admin' }, res);
  return { estado, objeto };
}

test('SCRUM-1171 · 🔴 el detalle del Trabajo trae `customer.numeroWhatsApp` resuelto (solo móvil · solo fijo · ninguno)', async () => {
  const casos = [
    ['soloMovil', MOVIL],
    ['soloFijo', FIJO],
    ['ninguno', null],
    ['ambos', MOVIL], // el móvil manda: es el número al que sale el envío
  ];
  for (const [nombre, esperado] of casos) {
    const cliente = CLIENTES[nombre];
    const { estado, objeto } = await detalle(cliente);
    // SUELO: es el Trabajo pedido y trae su cliente. Sin esto, un 500 o un objeto vacío pasarían.
    assert.equal(estado, 200, `🔴 CIEGO (${nombre}): el detalle no respondió 200 (${JSON.stringify(objeto)})`);
    assert.equal(objeto?.customer?.id, cliente.id, `🔴 CIEGO (${nombre}): el detalle no trae el cliente del Trabajo`);
    assert.equal(Object.prototype.hasOwnProperty.call(objeto.customer, 'numeroWhatsApp'), true,
      `🔴 (${nombre}) el detalle no trae \`customer.numeroWhatsApp\`: la ficha no tiene a qué número escribir`);
    assert.equal(objeto.customer.numeroWhatsApp, esperado, `🔴 (${nombre}) número de WhatsApp equivocado`);
    // Y es EL MISMO que resuelve el envío: la regla vive en un sitio.
    assert.equal(objeto.customer.numeroWhatsApp, canalDeWhatsApp(cliente) || null,
      `🔴 (${nombre}) el número del detalle no es el de canalDeWhatsApp: el botón y el envío divergen`);
    // Aditivo: lo que ya viajaba sigue igual.
    assert.equal(objeto.customer.phone, cliente.phone, `🔴 (${nombre}) \`phone\` ha cambiado`);
    assert.equal(objeto.customer.mobile, cliente.mobile, `🔴 (${nombre}) \`mobile\` ha cambiado`);
  }
});

test('SCRUM-1171 · regla 2: otro merchant no recibe el Trabajo (ni el número de su cliente)', async () => {
  const { estado, objeto } = await detalle(CLIENTES.soloMovil, OTRO_MERCHANT);
  assert.equal(estado, 404, `🔴 otro merchant ha abierto un Trabajo ajeno (${JSON.stringify(objeto)})`);
  assert.equal(JSON.stringify(objeto).includes(MOVIL), false, '🔴 el móvil del cliente ajeno ha salido en la respuesta');
  assert.equal(consultasJob.at(-1)?.where?.merchantId, OTRO_MERCHANT, '🔴 la consulta del Trabajo ya no filtra por merchantId');
});

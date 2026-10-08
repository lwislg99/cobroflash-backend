// SCRUM-1513d · La reserva del tope de plantillas: qué pide a la base, y en qué orden.
//
// Lo que este test NO puede probar es que el cerrojo cierre la carrera: eso sólo se ve con varias
// conexiones contra un PostgreSQL de verdad, y está medido a mano en
// `docs/master/evidencias/SCRUM-1513d/` (sin la línea del cerrojo, 120 mensajes sacan 108 a 110
// plantillas con el tope en 100). Aquí se fija lo que sí se puede fijar en la tanda: que la reserva
// PIDE el cerrojo antes de preguntar, que apunta la fila antes de salir de la transacción, y qué
// lleva y qué no lleva esa fila en cada desenlace.
//
// La base es un doble propio y mínimo: `reservarPlantilla` recibe el cliente por parámetro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const requiere = createRequire(import.meta.url);
const log = requiere('../dist/modules/messaging/domain/whatsappLog.service.js');

const COMERCIO = 7;
const CLIENTE = 50;
const TOPES = { topeComercio: 100, topeCliente: 3 };

/** Una base que apunta lo que se le pide. `cuenta` contesta a cada `count`. */
function base({ cuenta = () => 0, rota = false, comercio = null } = {}) {
  const pedido = [];
  const tx = {
    merchant: { findUnique: async (a) => { pedido.push({ op: 'comercio', where: a.where, select: a.select }); return comercio; } },
    $executeRaw: async (trozos, ...valores) => { pedido.push({ op: 'sentencia', texto: trozos.join('?'), valores }); return 0; },
    whatsAppMessage: {
      count: async (a) => { pedido.push({ op: 'count', where: a.where }); return cuenta(a.where); },
      create: async (a) => { pedido.push({ op: 'create', data: a.data }); return { id: 41 }; },
    },
  };
  const db = {
    $transaction: async (cb) => { if (rota) throw new Error('la base no contesta'); pedido.push({ op: 'abre' }); const r = await cb(tx); pedido.push({ op: 'cierra' }); return r; },
    whatsAppMessage: { update: async (a) => { pedido.push({ op: 'update', where: a.where, data: a.data }); return {}; } },
  };
  return { db, pedido, orden: () => pedido.map((p) => p.op) };
}

test('SCRUM-1513d · SUELO: el módulo de dist exporta la reserva y su resolución', () => {
  assert.equal(typeof log.reservarPlantilla, 'function');
  assert.equal(typeof log.resolverReservaDePlantilla, 'function');
});

test('SCRUM-1513d · 🔴 si cabe: cerrojo, pregunta y fila, por ese orden y dentro de la misma transacción', async () => {
  const b = base();
  const r = await log.reservarPlantilla(b.db, { merchantId: COMERCIO, templateName: 'una', ...TOPES });
  assert.deepEqual(r, { ok: true, id: 41 });
  assert.deepEqual(b.orden(), ['abre', 'comercio', 'sentencia', 'count', 'create', 'cierra']);
  const cerrojo = b.pedido[2];
  assert.match(cerrojo.texto, /^SELECT pg_advisory_xact_lock\(/);
  assert.equal(cerrojo.valores.length, 2);
  assert.equal(cerrojo.valores[1], COMERCIO, 'el cerrojo es de ESTE comercio, no global');
  // 1748, 1749 y 1750 son de la emisión: compartir espacio haría esperar un envío por una factura.
  assert.equal(Number.isInteger(cerrojo.valores[0]), true);
  assert.equal([1748, 1749, 1750].includes(cerrojo.valores[0]), false);
});

test('SCRUM-1513d · 🔴 la pregunta cuenta lo que tiene identificador del proveedor O sigue en cola, y sólo de hoy', async () => {
  const b = base();
  await log.reservarPlantilla(b.db, { merchantId: COMERCIO, ...TOPES });
  const where = b.pedido.find((p) => p.op === 'count').where;
  assert.equal(where.merchantId, COMERCIO);
  assert.equal(where.type, 'template');
  assert.deepEqual(where.OR, [{ waMessageId: { not: null } }, { status: 'queued' }]);
  assert.equal(where.createdAt.gte instanceof Date, true);
});

test('SCRUM-1513d · 🔴 la fila nace en cola y SIN documento: el paquete de disputa lee por documento', async () => {
  const b = base();
  await log.reservarPlantilla(b.db, { merchantId: COMERCIO, customerId: CLIENTE, templateName: 'una', ...TOPES });
  const data = b.pedido.find((p) => p.op === 'create').data;
  assert.equal(data.status, 'queued');
  assert.equal(data.merchantId, COMERCIO);
  assert.equal(data.customerId, CLIENTE, 'el cliente SÍ va: el tope por cliente cuenta por él');
  assert.equal(data.templateName, 'una');
  assert.equal('relatedType' in data, false);
  assert.equal('relatedId' in data, false);
  assert.equal('waMessageId' in data, false);
});

test('SCRUM-1513d · con el tope del comercio alcanzado no se apunta nada (y con uno menos, sí)', async () => {
  const lleno = base({ cuenta: () => 100 });
  assert.deepEqual(await log.reservarPlantilla(lleno.db, { merchantId: COMERCIO, ...TOPES }), { ok: false, reason: 'daily_cap', cuenta: 100 });
  assert.equal(lleno.orden().includes('create'), false);
  const borde = base({ cuenta: () => 99 });
  assert.equal((await log.reservarPlantilla(borde.db, { merchantId: COMERCIO, ...TOPES })).ok, true);
  assert.equal(borde.orden().includes('create'), true);
});

test('SCRUM-1513d · el tope por cliente se pregunta bajo el MISMO cerrojo, y sólo si hay cliente', async () => {
  const b = base({ cuenta: (w) => (w.customerId ? 3 : 0) });
  const r = await log.reservarPlantilla(b.db, { merchantId: COMERCIO, customerId: CLIENTE, ...TOPES });
  assert.deepEqual(r, { ok: false, reason: 'customer_daily_cap', cuenta: 3 });
  assert.deepEqual(b.orden(), ['abre', 'comercio', 'sentencia', 'count', 'count', 'cierra']);
  assert.equal(b.pedido.filter((p) => p.op === 'count')[1].where.customerId, CLIENTE);
  const sinCliente = base({ cuenta: (w) => (w.customerId ? 3 : 0) });
  assert.equal((await log.reservarPlantilla(sinCliente.db, { merchantId: COMERCIO, ...TOPES })).ok, true);
  assert.equal(sinCliente.orden().filter((o) => o === 'count').length, 1);
});

test('SCRUM-1513d · si la base no contesta, la reserva LANZA: qué se hace entonces lo decide quien llama', async () => {
  const b = base({ rota: true });
  await assert.rejects(() => log.reservarPlantilla(b.db, { merchantId: COMERCIO, ...TOPES }), /la base no contesta/);
});

test('SCRUM-1513d · 🔴 P2: sin respuesta del proveedor la fila se queda en cola y sin documento — sólo se anota el motivo', async () => {
  const b = base();
  await log.resolverReservaDePlantilla(b.db, 41, { como: 'sin_respuesta', error: 'timeout of 10000ms exceeded' });
  assert.deepEqual(b.pedido, [{ op: 'update', where: { id: 41 }, data: { error: 'timeout of 10000ms exceeded' } }]);
});

test('SCRUM-1513d · P1: el rechazo pasa la fila a fallida (devuelve el hueco) y entonces sí lleva su documento', async () => {
  const b = base();
  await log.resolverReservaDePlantilla(b.db, 41, { como: 'rechazada', error: 'no', relatedType: 'quote', relatedId: 5 });
  assert.deepEqual(b.pedido[0].data, { status: 'failed', error: 'no', relatedType: 'quote', relatedId: 5 });
});

test('SCRUM-1513d · el envío que salió pasa a enviado, con el identificador del proveedor y su documento', async () => {
  const b = base();
  await log.resolverReservaDePlantilla(b.db, 41, { como: 'enviada', waMessageId: 'wamid.x', relatedType: 'invoice', relatedId: 9 });
  assert.deepEqual(b.pedido[0], { op: 'update', where: { id: 41 }, data: { status: 'sent', waMessageId: 'wamid.x', relatedType: 'invoice', relatedId: 9 } });
});

test('SCRUM-1513d · resolver nunca lanza: una base caída al anotar no rompe el envío', async () => {
  const db = { whatsAppMessage: { update: async () => { throw new Error('caída'); } } };
  const original = console.error; const trazas = [];
  console.error = (...a) => trazas.push(a.join(' '));
  try { await log.resolverReservaDePlantilla(db, 41, { como: 'enviada', waMessageId: 'wamid.x' }); } finally { console.error = original; }
  assert.equal(trazas.length, 1);
  assert.match(trazas[0], /resolverReservaDePlantilla omitido/);
});

// ── SCRUM-1513f · el «hoy» del tope es el día del COMERCIO (decisión de c.19001) ──────────────
// Antes salía de `setHours`, o sea del reloj del proceso. Lo esperado se calcula AQUÍ, con aritmética
// sobre zonas de desfase fijo y sin horario de verano, y no con el módulo que se está probando.
const DIA_MS = 86_400_000;
const inicioConDesfase = (ahora, horas) => Math.floor((ahora + horas * 3_600_000) / DIA_MS) * DIA_MS - horas * 3_600_000;

/** El inicio del día que usó la reserva para ese comercio, y los dos esperados (antes y después de llamar). */
async function inicioQueUsa(comercio, horas) {
  const b = base({ comercio });
  const antes = inicioConDesfase(Date.now(), horas);
  await log.reservarPlantilla(b.db, { merchantId: COMERCIO, customerId: CLIENTE, ...TOPES });
  const despues = inicioConDesfase(Date.now(), horas);
  const cuentas = b.pedido.filter((p) => p.op === 'count');
  assert.equal(cuentas.length, 2, 'SUELO: con cliente se pregunta dos veces');
  assert.equal(cuentas[0].where.createdAt.gte.getTime(), cuentas[1].where.createdAt.gte.getTime(), 'los dos topes miran el mismo día');
  return { usa: cuentas[0].where.createdAt.gte.getTime(), esperados: [antes, despues], pedido: b.pedido };
}

test('SCRUM-1513f · 🔴 la reserva pregunta la zona de ESE comercio, y la pregunta antes de pedir el cerrojo', async () => {
  const { pedido } = await inicioQueUsa({ timezone: 'Pacific/Kiritimati' }, 14);
  const lectura = pedido.find((p) => p.op === 'comercio');
  assert.deepEqual(lectura.where, { id: COMERCIO });
  assert.deepEqual(lectura.select, { timezone: true }, 'sólo la zona: el país no decide el día');
  assert.equal(pedido.findIndex((p) => p.op === 'comercio') < pedido.findIndex((p) => p.op === 'sentencia'), true);
});

test('SCRUM-1513f · 🔴 un comercio en UTC+14 cuenta desde SU medianoche, no desde la del servidor', async () => {
  const { usa, esperados } = await inicioQueUsa({ timezone: 'Pacific/Kiritimati' }, 14);
  assert.equal(esperados.includes(usa), true, `usa ${new Date(usa).toISOString()}`);
  assert.equal(new Date(usa).getUTCHours(), 10, 'la medianoche de UTC+14 son las 10:00 UTC');
});

test('SCRUM-1513f · 🔴 un comercio en UTC-11 cuenta desde SU medianoche, no desde la del servidor', async () => {
  const { usa, esperados } = await inicioQueUsa({ timezone: 'Pacific/Pago_Pago' }, -11);
  assert.equal(esperados.includes(usa), true, `usa ${new Date(usa).toISOString()}`);
  assert.equal(new Date(usa).getUTCHours(), 11, 'la medianoche de UTC-11 son las 11:00 UTC');
});

test('SCRUM-1513f · 🔴 sin zona declarada el día es el de UTC, NUNCA el de Madrid', async () => {
  const { usa, esperados } = await inicioQueUsa({ timezone: null }, 0);
  assert.equal(esperados.includes(usa), true, `usa ${new Date(usa).toISOString()}`);
  // La medianoche de Madrid cae a las 22:00 o a las 23:00 UTC: con Madrid por defecto esto no daría 0.
  assert.equal(new Date(usa).getUTCHours(), 0);
});

test('SCRUM-1513f · un comercio que no aparece, o una zona que el motor no reconoce, cae también a UTC', async () => {
  const sinFila = await inicioQueUsa(null, 0);
  assert.equal(sinFila.esperados.includes(sinFila.usa), true);
  const rara = await inicioQueUsa({ timezone: 'Marte/Olimpo' }, 0);
  assert.equal(rara.esperados.includes(rara.usa), true);
});

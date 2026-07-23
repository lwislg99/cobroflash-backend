// tests/merchant-fixture.test.mjs — SCRUM-113
//
// Prueba el helper de limpieza contra un DOBLE de prisma: sin BD, sin gate, en `npm test`
// normal. Es deliberado (regla 3 del runbook): la garantía estructural no puede vivir
// detrás de QA_DB_TEST, que es donde A12.4 se cayó entera sin que nadie se enterara.
//
// Y prueba lo que de verdad importa, que son los dos caminos de FALLO — no el feliz:
//   · revienta el MONTAJE de fixtures  → el merchant se borra igual
//   · revienta la PRIMERA operación de limpieza → las demás se ejecutan igual
//
// Un test de limpieza que no has visto fallar no sabes si limpia.
import test from 'node:test';
import assert from 'node:assert/strict';

import { withMerchant, limpiarMerchant, merchantsVivos } from './_merchant-fixture.mjs';

/**
 * Doble de PrismaClient. Registra cada deleteMany por modelo y permite programar fallos.
 * `fallan` = nombres de modelo cuyo deleteMany rechaza (para simular una limpieza rota).
 */
function fakePrisma({ fallan = [], merchantDeleteFallaVeces = 0 } = {}) {
  const llamadas = [];
  let borradosMerchant = 0;
  let fallosRestantes = merchantDeleteFallaVeces;

  const modelo = (nombre) => ({
    deleteMany: async (args) => {
      llamadas.push(nombre);
      if (fallan.includes(nombre)) throw new Error(`fallo simulado en ${nombre}`);
      return { count: 0 };
    },
    create: async ({ data }) => ({ id: 42, ...data }),
  });

  const cliente = new Proxy(
    {
      merchant: {
        create: async ({ data }) => ({ id: 42, ...data }),
        delete: async () => {
          llamadas.push('merchant.delete');
          if (fallosRestantes > 0) { fallosRestantes--; throw new Error('FK aún viva'); }
          borradosMerchant++;
          return { id: 42 };
        },
      },
    },
    { get: (obj, prop) => (prop in obj ? obj[prop] : modelo(String(prop))) },
  );

  return {
    cliente,
    llamadas,
    get merchantBorrado() { return borradosMerchant > 0; },
  };
}

test('SCRUM-113: si revienta el MONTAJE de fixtures, el merchant se borra igual', async () => {
  const f = fakePrisma();
  const boom = new Error('el customer.create reventó a media construcción');

  await assert.rejects(
    () => withMerchant(f.cliente, { name: 'QA', email: 'qa@test.local' }, async () => {
      throw boom; // el fallo ocurre montando fixtures, ANTES de cualquier assert
    }),
    (err) => err === boom, // ← el error del TEST se propaga tal cual, sin sustituir
  );

  assert.ok(f.merchantBorrado, 'el merchant tiene que borrarse aunque el montaje reviente');
  assert.equal(merchantsVivos.size, 0, 'y no puede quedar registrado como vivo');
});

test('SCRUM-113: si falla la PRIMERA operación de limpieza, las demás se ejecutan igual', async () => {
  // `auditLog` es el primero de la lista de borrado: si su fallo cancelara la pasada,
  // no se vería ninguno de los siguientes ni el merchant.
  const f = fakePrisma({ fallan: ['auditLog'] });

  const ok = await limpiarMerchant(f.cliente, 42);

  assert.ok(ok, 'el merchant debe quedar borrado pese al fallo de una operación');
  assert.ok(f.llamadas.includes('auditLog'), 'la operación que falla sí se intentó');
  assert.ok(f.llamadas.includes('customer'), 'y las de DESPUÉS se ejecutaron igual');
  assert.ok(f.llamadas.includes('merchant.delete'), 'incluido el borrado del merchant');
});

test('SCRUM-113: la limpieza NUNCA lanza — devuelve false y avisa', async () => {
  // Merchant imborrable: simula una FK que nunca se suelta. El caso real que esto cubre es
  // el throw dentro del finally de scrum74 (SCRUM-79), que enmascaraba el error del test.
  const f = fakePrisma({ merchantDeleteFallaVeces: 99 });

  const ok = await limpiarMerchant(f.cliente, 42, { intentos: 2 });

  assert.equal(ok, false, 'informa del fallo por valor de retorno, no lanzando');
});

test('SCRUM-113: reintenta la pasada cuando una escritura tardía revive la FK', async () => {
  // recordCustomerEvent (SCRUM-105) es fire-and-forget: el INSERT puede aterrizar DESPUÉS
  // de que el test haya limpiado. El primer intento falla, el segundo debe cerrar.
  const f = fakePrisma({ merchantDeleteFallaVeces: 1 });

  const ok = await limpiarMerchant(f.cliente, 42);

  assert.ok(ok, 'la segunda pasada debe cerrar el borrado');
  assert.equal(f.llamadas.filter((c) => c === 'merchant.delete').length, 2, 'dos intentos');
});

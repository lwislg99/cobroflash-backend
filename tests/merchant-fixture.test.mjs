// tests/merchant-fixture.test.mjs — SCRUM-113
//
// Prueba el helper de limpieza contra un DOBLE de prisma: sin BD, sin gate, en `npm test`
// normal. Es deliberado (SUITE_REGRESION.md «*Que la garantía estructural corra en `npm test` normal, sin gate*»): la garantía estructural no puede vivir
// detrás de QA_DB_TEST, que es donde A12.4 se cayó entera sin que nadie se enterara.
//
// Y prueba lo que de verdad importa, que son los dos caminos de FALLO — no el feliz:
//   · revienta el MONTAJE de fixtures  → el merchant se borra igual
//   · revienta la PRIMERA operación de limpieza → las demás se ejecutan igual
//
// Un test de limpieza que no has visto fallar no sabes si limpia.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  withMerchant, limpiarMerchant, merchantsVivos, barridoFinal, registrarBarridoFinal,
  _resetBarridoParaTests, telefonosDe,
} from './_merchant-fixture.mjs';

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

// ── Garantía nº3: el barrido final (verificación post-cierre de SCRUM-113) ─────────────────
// Las cuatro pruebas de arriba cubren las garantías 1 y 2. La 3 (after() de última
// instancia) estaba escrita y documentada, pero CERO ficheros la invocaban — la propia red
// dependía de que cada autor tendiera OTRA red aparte, y nadie lo probó porque nadie la
// usaba. Aquí se prueban las dos mitades: la barrida en sí (`barridoFinal`) y que
// `withMerchant` la deja activada SOLA, sin llamada aparte.

test('SCRUM-113: barridoFinal limpia lo que quedó vivo y avisa por consola', async () => {
  const f = fakePrisma();
  merchantsVivos.add(777); // simula un camino que NO pasó por withMerchant

  await barridoFinal(f.cliente);

  assert.ok(f.merchantBorrado, 'el huérfano debe quedar borrado');
  assert.equal(merchantsVivos.has(777), false, 'y desregistrado');
});

test('SCRUM-113: barridoFinal no toca nada si no hay huérfanos (no limpia en silencio lo que no existe)', async () => {
  const f = fakePrisma();
  assert.equal(merchantsVivos.size, 0, 'precondición: nada vivo antes de esta prueba');

  await barridoFinal(f.cliente);

  assert.equal(f.llamadas.length, 0, 'sin huérfanos, no debe llamar a nada');
});

test('SCRUM-113: registrarBarridoFinal ata la barrida al after() inyectado', async () => {
  let callbackRegistrado = null;
  const afterFalso = (cb) => { callbackRegistrado = cb; };

  registrarBarridoFinal({}, { after: afterFalso });

  assert.equal(typeof callbackRegistrado, 'function', 'debe registrar un callback en el after() recibido');
});

test('SCRUM-113: withMerchant deja el barrido ACTIVADO SOLO — nadie llama a registrarBarridoFinal aparte', async () => {
  _resetBarridoParaTests(); // aísla del withMerchant ya usado por una prueba anterior de este mismo fichero
  const f = fakePrisma();
  const afterCallbacks = [];
  const afterFalso = (cb) => { afterCallbacks.push(cb); };

  // Un uso normal de withMerchant, con el after() inyectado — como lo usaría cualquier
  // fichero real, sin tocar registrarBarridoFinal.
  await withMerchant(f.cliente, { name: 'QA', email: 'qa@test.local' }, async () => {}, { after: afterFalso });

  assert.equal(afterCallbacks.length, 1, 'el primer withMerchant del fichero debe activar la red');

  // Huérfano posterior (otro camino, sin pasar por withMerchant) — el after() ya registrado
  // debe barrerlo cuando el runner lo dispare de verdad; aquí se simula disparándolo a mano.
  merchantsVivos.add(888);
  await afterCallbacks[0]();
  assert.equal(merchantsVivos.has(888), false, 'el after() activado por withMerchant debe barrer huérfanos posteriores');

  // Un SEGUNDO withMerchant en el mismo fichero NO debe registrar un after() adicional
  // (evita barridos duplicados / N llamadas a la BD al cerrar el fichero).
  await withMerchant(f.cliente, { name: 'QA2', email: 'qa2@test.local' }, async () => {}, { after: afterFalso });
  assert.equal(afterCallbacks.length, 1, 'un segundo withMerchant no debe registrar otro after()');
});

// ── SCRUM-174: botSession con merchantId=null se barre por el PHONE que el fixture generó ────
// BotSession.merchantId es NULLABLE y SIN FK: el barrido por merchantId no alcanza las filas con
// merchantId=null, y como no hay FK merchant.delete no protesta si quedan (fallo MUDO). El fixture
// las barre por los teléfonos que él mismo generó. Doble CON store en memoria para verlo de verdad:
// la sesión anónima debe SOBREVIVIR al barrido por-id y MORIR en el barrido por-phone.
function fakePrismaConBotSessions(sesiones) {
  const casa = (s, where) =>
    (where.merchantId !== undefined && s.merchantId === where.merchantId) ||
    (Array.isArray(where.phone?.in) && where.phone.in.includes(s.phone));
  return new Proxy(
    {
      merchant: {
        create: async ({ data }) => ({ id: 42, ...data }),
        delete: async () => ({ id: 42 }),
      },
      botSession: {
        deleteMany: async ({ where }) => {
          const antes = sesiones.length;
          for (let i = sesiones.length - 1; i >= 0; i--) if (casa(sesiones[i], where)) sesiones.splice(i, 1);
          return { count: antes - sesiones.length };
        },
      },
    },
    { get: (obj, prop) => (prop in obj ? obj[prop] : { deleteMany: async () => ({ count: 0 }) }) },
  );
}

test('SCRUM-174: withMerchant barre botSession con merchantId=null por el phone que él generó', async () => {
  _resetBarridoParaTests();
  const MID = 42; // el fake crea merchant.id = 42
  const { cliente } = telefonosDe(MID); // EXACTAMENTE el phone que withMerchant generará para 42
  const sesiones = [
    { id: 1, phone: cliente, merchantId: null }, // anónima: SOLO la alcanza el barrido por phone
    { id: 2, phone: cliente, merchantId: MID },  // con merchantId: la alcanzaría también el por-id
  ];
  const prisma = fakePrismaConBotSessions(sesiones);

  await withMerchant(prisma, { name: 'QA S174', email: 'qa-s174@test.local' }, async () => {}, { after: () => {} });

  // Antes del fix (barrido solo por merchantId), la #1 (merchantId=null) SOBREVIVÍA → este assert
  // era rojo. Con el barrido por phone del fixture, las dos mueren.
  assert.equal(sesiones.length, 0, 'ambas sesiones borradas — incluida la de merchantId=null (SCRUM-174)');
});

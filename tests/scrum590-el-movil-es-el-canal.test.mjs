// tests/scrum590-el-movil-es-el-canal.test.mjs — SCRUM-590 (CONT-19)
//
// ¿SALE EL DOCUMENTO AL MÓVIL? — preguntado al CAMINO REAL DE ENVÍO, no al texto del fichero.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTE TEST EJECUTA EN VEZ DE LEER
//
// El riesgo entero de este ticket es que la separación en dos campos sea DECORATIVA: que los dos
// se guarden, que el formulario quede precioso, y que el WhatsApp siga saliendo al fijo. Un guard
// de texto sobre `sendQuote.service.ts` —que es lo que hace `scrum62-albaran-ventana`— no puede
// distinguir esos dos mundos: en los dos hay una línea que resuelve un destino. Así que aquí se
// EJECUTA `sendQuoteWhatsAppToCustomer`, el servicio de producción, y se mira A QUÉ NÚMERO acabó
// llamando. Probar que los dos campos se guardan sería probar un formulario, no el ticket.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS DOBLES, Y QUÉ **NO** SE DOBLA
//
//  · LA BASE se dobla (`require.cache` de `dist/core/db/prisma.js`, ANTES de cargar nada de
//    `dist/`). Sin esto haría falta una base real, y este encargo prohíbe staging y producción.
//  · META se dobla con el mecanismo que YA existe para esto: `WHATSAPP_DRY_RUN=1` +
//    `globalThis.__waDryRunOutbox`. En dry-run los senders **pasan TODOS los guards** (opt-out,
//    demo, topes, validación J7) y sólo se saltan la llamada HTTP — está escrito en
//    `whatsapp.ts:20`. Por eso el caso NEGATIVO de aquí abajo es real: el opt-out se comprueba
//    ANTES del corte de dry-run, no después.
//
// ⛔ NO SE MANDA NINGÚN MENSAJE A NINGÚN NÚMERO REAL. Los números son de laboratorio y no sale
//    un solo byte hacia Meta: `metaHttp` lanza si algo lo intentara (SCRUM-180).
//
// 🔴 LO QUE **NO** SE DOBLA es lo que se está probando: el resolvedor del canal, los guards de
//    envío y `sendQuoteWhatsAppToCustomer` entero son el código de producción tal cual.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// 🔴 SCRUM-262: los números de prueba salen del rango IMPOSIBLE (`34 0XX…`), nunca de un rango
// real. `+34 6XX` es móvil español ordinario: puede estar asignado a una persona que no ha
// pedido nada. Y no es teórico — hay tres crons que envían WhatsApp a teléfonos guardados.
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

// ANTES de cargar `dist/`: `config` se congela al importarse.
process.env.WHATSAPP_DRY_RUN = '1';

const requiere = createRequire(import.meta.url);

// El merchant NO es el 1: el 1 es la cuenta demo y `demoSendBlocked` la trata aparte (V0-2).
// Con el demo, un bloqueo por lista blanca se confundiría con el bloqueo que este test mide.
const MERCHANT = 4242;
const CLIENTE = 55;

// Números de laboratorio. Los dos son válidos para `normalizePhone` (8-15 dígitos) y son
// DISTINTOS entre sí — que lo sean es la premisa de todo lo que viene debajo, así que se afirma.
const FIJO = telefonoDePrueba(10000001); // la centralita de la empresa
const MOVIL = telefonoDePrueba(20000002); // el móvil de la persona de contacto

// ── EL DOBLE DE LA BASE ────────────────────────────────────────────────────────────────────
// Devuelve lo vacío por defecto —lista vacía, `null`, `0`— para que ninguna consulta que este
// test no gobierna (ventana de servicio, topes A3.2, log WA-0b, historial) decida nada por su
// cuenta. Lo que sí gobierna el escenario se pone en `respuestas`.
function dobleDeLaBase(respuestas) {
  const porDefecto = (metodo) => {
    if (metodo === 'findMany') return [];
    if (metodo === 'count') return 0;
    if (metodo === 'aggregate') return { _max: {}, _count: 0 };
    if (metodo === 'findUnique' || metodo === 'findFirst') return null;
    if (metodo === 'updateMany' || metodo === 'deleteMany') return { count: 0 };
    return {};
  };
  const modelo = (nombre) =>
    new Proxy({}, {
      get: (_t, metodo) => async (args) => {
        const propia = respuestas[`${nombre}.${String(metodo)}`];
        return typeof propia === 'function' ? propia(args) : propia ?? porDefecto(String(metodo));
      },
    });
  const cache = new Map();
  return new Proxy({}, {
    get: (_t, prop) => {
      const nombre = String(prop);
      if (nombre.startsWith('$')) return async () => undefined; // $disconnect, $transaction…
      if (!cache.has(nombre)) cache.set(nombre, modelo(nombre));
      return cache.get(nombre);
    },
  });
}

/**
 * Monta el escenario, ejecuta el camino real y devuelve lo que salió.
 *
 * `dadosDeBaja` son las filas que devolvería la consulta de `isWaOptedOut`: los clientes de ese
 * merchant con `waOptOut = true`. Vacío = nadie se ha dado de baja.
 */
async function enviarDeVerdad({ cliente, dadosDeBaja = [] }) {
  const quote = {
    id: 7,
    merchantId: MERCHANT,
    customerId: CLIENTE,
    status: 'sent',
    quoteNumber: 12,
    total: '150.00',
    currency: 'EUR',
    decisionToken: 'tok-590-de-laboratorio', // ya existe: no hace falta escribir en la base
    merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null },
    customer: cliente,
  };

  const respuestas = {
    'quote.findUnique': () => quote,
    'customer.findMany': () => dadosDeBaja,
  };

  // El doble se inyecta en la caché de módulos ANTES del primer `require` de `dist/`.
  const rutaPrisma = requiere.resolve('../dist/core/db/prisma.js');
  requiere.cache[rutaPrisma] = {
    id: rutaPrisma,
    filename: rutaPrisma,
    loaded: true,
    exports: { prisma: dobleDeLaBase(respuestas) },
  };
  // Y se descarta el servicio y la integración para que vuelvan a leer ESTE doble.
  for (const m of ['../dist/modules/quotes/domain/sendQuote.service.js', '../dist/integrations/whatsapp.js']) {
    delete requiere.cache[requiere.resolve(m)];
  }

  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    const { sendQuoteWhatsAppToCustomer } = requiere('../dist/modules/quotes/domain/sendQuote.service.js');
    // 🔴 SUELO: si el export desaparece o cambia de nombre, esto NO puede pasar en silencio.
    assert.equal(typeof sendQuoteWhatsAppToCustomer, 'function',
      'CIEGO: no se encuentra el camino de envío del presupuesto. Sabemos que existe: si se ha ' +
      'movido o renombrado, este test hay que reapuntarlo, no borrarlo.');
    const resultado = await sendQuoteWhatsAppToCustomer(7, MERCHANT);
    return { resultado, destinos: buzon.map((e) => e.to), buzon };
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
}

// ───────────────────────────────────────────────────────────────────────────────────────────
// PREMISA · los dos números son distintos y los dos son marcables
// ───────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-590 · premisa: fijo y móvil son números distintos y válidos', () => {
  const { normalizePhone } = requiere('../dist/core/utils/utils.js');
  assert.notEqual(FIJO, MOVIL, 'si los dos números fueran el mismo, TODO este fichero pasaría en vacío');
  assert.equal(normalizePhone(FIJO), FIJO, 'el fijo de laboratorio tiene que ser marcable');
  assert.equal(normalizePhone(MOVIL), MOVIL, 'el móvil de laboratorio tiene que ser marcable');
});

// ───────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CONTROL QUE DECIDE
// ───────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-590 🔴 el documento sale al MÓVIL, no al fijo (camino real de envío)', async () => {
  const { resultado, destinos, buzon } = await enviarDeVerdad({
    cliente: { id: CLIENTE, name: 'Reformas Ejemplo SL', phone: FIJO, mobile: MOVIL },
  });

  // SUELO, antes que ninguna afirmación sobre el destino: si no salió NADA, este test no ha
  // medido a dónde va el documento — ha medido que no hubo documento. Son cosas distintas.
  assert.ok(buzon.length > 0,
    `CIEGO: el camino de envío no produjo ni un mensaje (resultado: ${JSON.stringify(resultado)}). ` +
    'Sin salida no se puede afirmar a qué número fue.');

  assert.equal(resultado.ok, true, `el envío falló: ${JSON.stringify(resultado)}`);
  assert.ok(destinos.includes(MOVIL),
    `el documento NO salió al móvil. Destinos observados: ${JSON.stringify(destinos)}`);

  // ── EL SENTIDO CONTRARIO, PEGADO ────────────────────────────────────────────────────────
  // No basta con que llegue al móvil: hay que ver que YA NO llega al fijo. Si el servicio
  // mandara a los dos, el guard de arriba pasaría y el defecto seguiría vivo.
  assert.ok(!destinos.includes(FIJO),
    `el documento TAMBIÉN salió al fijo (${FIJO}). Destinos: ${JSON.stringify(destinos)}`);
  assert.equal(resultado.to, MOVIL, 'el `to` que el servicio devuelve a su llamador también es el móvil');

  // Y la contra-prueba de que el cambio hizo algo: la regla de ANTES —`normalizePhone(phone)`,
  // que es literalmente lo que había en los once puntos de resolución— resuelve el FIJO. O sea
  // que con el código anterior este mismo cliente habría recibido el presupuesto en la
  // centralita. No es un recuerdo: se calcula aquí.
  const { normalizePhone } = requiere('../dist/core/utils/utils.js');
  assert.equal(normalizePhone(FIJO), FIJO, 'la regla de ANTES resolvía el fijo — por eso este ticket existe');
});

// ───────────────────────────────────────────────────────────────────────────────────────────
// ✅ POSITIVO · el cliente de un solo número no cambia de comportamiento
// ───────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-590 ✅ con un solo número (el de hoy), sigue saliendo exactamente igual', async () => {
  // Éste es TODO cliente que existe hoy: la columna nace vacía, así que `mobile` es NULL.
  const { resultado, destinos, buzon } = await enviarDeVerdad({
    cliente: { id: CLIENTE, name: 'Juan Pérez', phone: FIJO, mobile: null },
  });

  assert.ok(buzon.length > 0, 'CIEGO: no salió nada; no se puede afirmar que el comportamiento se conserva');
  assert.equal(resultado.ok, true, `el envío falló: ${JSON.stringify(resultado)}`);
  assert.deepEqual([...new Set(destinos)], [FIJO],
    `un cliente sin móvil tiene que seguir recibiendo en su único número. Destinos: ${JSON.stringify(destinos)}`);
});

test('SCRUM-590 ✅ un móvil en blanco NO deja al cliente sin canal', async () => {
  // El campo existe pero está vacío —lo que deja un formulario del que se borra el contenido—.
  // `normalizePhone('   ')` es `''`, indistinguible de «no consta», así que se cae al fijo.
  for (const vacio of ['', '   ']) {
    const { resultado, destinos } = await enviarDeVerdad({
      cliente: { id: CLIENTE, name: 'Juan Pérez', phone: FIJO, mobile: vacio },
    });
    assert.equal(resultado.ok, true, `con mobile=${JSON.stringify(vacio)} el envío falló: ${JSON.stringify(resultado)}`);
    assert.ok(destinos.includes(FIJO), `con mobile=${JSON.stringify(vacio)} debería caer al fijo`);
  }
});

// ───────────────────────────────────────────────────────────────────────────────────────────
// ✅ NEGATIVO · la baja puesta sobre el MÓVIL bloquea, aunque el fijo esté limpio
// ───────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-590 ✅ opt-out sobre el MÓVIL: NO se manda, aunque el fijo esté limpio', async () => {
  const { resultado, destinos, buzon } = await enviarDeVerdad({
    cliente: { id: CLIENTE, name: 'Reformas Ejemplo SL', phone: FIJO, mobile: MOVIL },
    // 🔴 La fila dada de baja tiene el móvil y **NO tiene fijo**. Es deliberado: así el bloqueo
    // sólo puede venir del móvil. Con el código de antes —que comparaba el destino contra los
    // `phone` de los dados de baja— aquí no habría coincidido NADA y el mensaje habría salido.
    dadosDeBaja: [{ phone: null, mobile: MOVIL }],
  });

  assert.equal(resultado.ok, false, 'se envió a un número dado de baja');
  assert.equal(resultado.reason, 'wa_opt_out', `el motivo debería ser la baja del canal, fue: ${JSON.stringify(resultado)}`);
  assert.equal(buzon.length, 0, `no debería salir NADA, y salió: ${JSON.stringify(destinos)}`);

  // La contra-prueba: la comprobación de ANTES miraba sólo `phone`, y aquí es `null`.
  const { normalizePhone } = requiere('../dist/core/utils/utils.js');
  assert.notEqual(normalizePhone(null), MOVIL,
    'con la comprobación anterior (sólo `phone`) esta baja NO habría bloqueado nada');
});

test('SCRUM-590 · la baja de OTRO número no bloquea a éste (el aviso no se vuelve ruido)', async () => {
  // Control negativo del propio guard anterior: si `isWaOptedOut` bloqueara de más, el test de
  // arriba pasaría igual y no lo sabríamos. Aquí el dado de baja es un tercero.
  const { resultado, destinos } = await enviarDeVerdad({
    cliente: { id: CLIENTE, name: 'Reformas Ejemplo SL', phone: FIJO, mobile: MOVIL },
    dadosDeBaja: [{ phone: telefonoDePrueba(30000003), mobile: telefonoDePrueba(30000004) }],
  });
  assert.equal(resultado.ok, true, `una baja ajena está bloqueando este envío: ${JSON.stringify(resultado)}`);
  assert.ok(destinos.includes(MOVIL), 'debería haber salido al móvil con normalidad');
});

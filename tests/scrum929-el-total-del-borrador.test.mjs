// tests/scrum929-el-total-del-borrador.test.mjs — SCRUM-929
//
// EL BORRADOR QUE CREA EL CICLO DE MANTENIMIENTO NACÍA CON UN TOTAL QUE NO ERA EL DE LA CASA.
//
// `maintenance.service.ts` calculaba el importe del borrador con `line.price * line.qty` y lo
// guardaba en `Quote.total`. La MISMA línea entrando por `POST /quote/create` pasa por `calcTotal`,
// que multiplica por `(1 + tax)` y aplica el `dto` de la línea. Dos aritméticas para la misma cosa.
//
// Medido en staging el 17-sep-2026 (SCRUM-911, PASO 0), EN PANTALLA y no en la base: el documento
// se contradecía a sí mismo —línea «387,20 €», IVA «67,20 €», Total «320,00 €»— y el mismo 320
// salía en la lista, en el detalle y en el WhatsApp al pro, porque los tres leen esa columna.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTE TEST MIRA EL CICLO ENTERO Y NO LA ARITMÉTICA A SOLAS
//
// Porque el defecto no estaba en `calcTotal` —que siempre estuvo bien— sino en QUE EL CICLO NO LA
// LLAMABA. Un test de la aritmética a solas habría pasado en verde los dos días: la función buena
// existía, nadie la usaba. Lo que hay que poder afirmar es que **el número que este bucle ESCRIBE**
// es el de la casa, y eso sólo se ve mirando lo que le llega a `quote.create`.
//
// Y hasta hoy nadie lo miraba: medido por AST el 17-sep-2026, `runMaintenanceProposals` sólo la
// importaba `cron.ts`. Ni un test. Por eso el bucle acepta ahora `{ prisma, recordCustomerEvent }`
// con default al real — el patrón que este mismo fichero ya declara para `seleccionarLotes` y para
// `DepsAviso`. Sin BD, sin gate y sin que producción recorra una línea distinta.
//
// ⚠️ NO se inyecta `sendWhatsAppButtons`: el doble deja `whatsappPhone` a null y el bucle ni lo
// llama. Una dependencia que se puede cerrar desde el fixture no se inyecta — cada inyección es
// una rama más que producción no recorre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runMaintenanceProposals } from '../dist/modules/maintenance/domain/maintenance.service.js';
import { calcTotal } from '../dist/core/utils/utils.js';

// 12:00 de Madrid: fuera de las horas tranquilas (9-21), que el ciclo comprueba lo primero.
const AHORA = new Date('2026-09-17T10:00:00Z');

const PLAN = {
  id: 7, merchantId: 2, customerId: 30, quoteId: 1884,
  title: 'Revisión de termo/calentador', intervalMonths: 12,
  nextDueAt: new Date('2026-09-16T00:00:00Z'), active: true,
  lastProposedAt: null, rejectedStreak: 0,
};

/**
 * El doble: lo mínimo que el bucle toca, y nada más. Devuelve lo ESCRITO para poder mirarlo.
 *
 * `merchant.trade = 'fontanero'` y el concepto de la línea tienen que casar con `MAINTAINABLE_SEEDS`
 * o `suggestMaintenance` devuelve `null` y el bucle se queda con su línea de cortesía a precio 0 —
 * o sea que el test mediría OTRA COSA y saldría verde igual. Es la trampa de este fixture y por eso
 * hay un aserto abajo que comprueba que la línea heredada es la del presupuesto origen.
 */
function baseDeMentira(lineaOrigen) {
  const quotesCreadas = [];
  const planesActualizados = [];
  const eventos = [];
  const tx = {
    // `allocateQuoteNumber` lo usa como plantilla etiquetada (advisory lock). Aquí no bloquea nada.
    $executeRaw: async () => 1,
    merchant: {
      findUnique: async () => ({ id: 2, nextQuoteNumber: 7, quoteSeriesYear: 2026 }),
      update: async () => ({}),
    },
    quote: {
      create: async ({ data }) => { quotesCreadas.push(data); return { id: 991, ...data }; },
    },
  };
  const db = {
    customer: {
      findMany: async () => [],                           // nadie con waOptOut → un solo lote
      findUnique: async () => ({ id: 30, name: 'Cliente QA', phone: '34000000030', waOptOut: false, merchantId: 2 }),
    },
    maintenancePlan: {
      findMany: async () => [PLAN],
      aggregate: async () => ({ _max: { lastProposedAt: null } }),
      update: async (args) => { planesActualizados.push(args); return {}; },
    },
    merchant: {
      findUnique: async () => ({
        id: 2, name: 'QA', country: 'ES', flags: { MAINTENANCE_ENABLED: true },
        whatsappPhone: null,                               // sin teléfono → el bucle no llama a Meta
        trade: 'fontanero',
      }),
    },
    quote: { findUnique: async () => ({ lines: [lineaOrigen] }) },
    $transaction: async (fn) => fn(tx),
  };
  const deps = { prisma: db, recordCustomerEvent: async (e) => { eventos.push(e); } };
  return { deps, quotesCreadas, planesActualizados, eventos };
}

const LINEA_CON_IVA = { concept: 'Sustitución de termo eléctrico 80 L', qty: 1, price: 320, tax: 0.21 };
const LINEA_SIN_IVA = { concept: 'Sustitución de termo eléctrico 80 L', qty: 1, price: 320, tax: 0 };
const LINEA_CON_DTO = { concept: 'Sustitución de termo eléctrico 80 L', qty: 1, price: 320, tax: 0, dto: 50 };
const LINEA_DTO_E_IVA = { concept: 'Sustitución de termo eléctrico 80 L', qty: 2, price: 150, tax: 0.1, dto: 20 };

async function totalDelBorrador(linea) {
  const { deps, quotesCreadas, planesActualizados, eventos } = baseDeMentira(linea);
  const r = await runMaintenanceProposals(AHORA, deps);
  assert.equal(r.proposed, 1, `el ciclo no propuso: ${JSON.stringify(r)}`);
  assert.equal(quotesCreadas.length, 1, 'el ciclo no creó exactamente un borrador');
  return { data: quotesCreadas[0], planesActualizados, eventos, resumen: r };
}

test('SCRUM-929 · 🔴 EL DEFECTO: el total del borrador es el de `calcTotal`, con su IVA', async () => {
  const { data } = await totalDelBorrador(LINEA_CON_IVA);

  // El aserto que cae con el código viejo. Se escribe con el NÚMERO y no solo comparando con
  // `calcTotal`: si algún día las dos se rompieran a la vez, comparar una con otra saldría verde.
  assert.equal(data.total, '387.20',
    `320 € al 21 % son 387,20 €. El ciclo guardó ${data.total}.`);
  assert.equal(data.total, calcTotal([LINEA_CON_IVA]).toFixed(2),
    'el total del borrador tiene que ser EXACTAMENTE el que da la aritmética de la casa');

  // Y la discriminación: el número viejo era otro. Sin esto, un día que `calcTotal` devolviera
  // `price * qty` este test seguiría en verde sin que nada hubiera mejorado.
  const comoAntes = Number(LINEA_CON_IVA.price) * Number(LINEA_CON_IVA.qty);
  assert.notEqual(Number(data.total), comoAntes,
    'el total coincide con `price * qty`: la aritmética vieja ha vuelto');
});

test('SCRUM-929 · el descuento de línea también se respeta — el defecto no era solo el IVA', async () => {
  // Medido antes de escribirlo: con `price * qty` este caso guardaba 320,00 € para una línea de
  // 320 € con un 50 % de descuento. Se le pedía al CLIENTE el doble de lo pactado, que es la MISMA
  // avería en la dirección contraria.
  const { data } = await totalDelBorrador(LINEA_CON_DTO);
  assert.equal(data.total, '160.00', `320 € con 50 % de descuento son 160 €. Guardó ${data.total}.`);
  assert.equal(data.total, calcTotal([LINEA_CON_DTO]).toFixed(2));
});

test('SCRUM-929 · descuento Y IVA a la vez, con cantidad > 1', async () => {
  // 150 € × 2 = 300; con 20 % de dto = 240; con IVA 10 % = 264.
  const { data } = await totalDelBorrador(LINEA_DTO_E_IVA);
  assert.equal(data.total, '264.00', `esperaba 264,00 €, guardó ${data.total}`);
  assert.equal(data.total, calcTotal([LINEA_DTO_E_IVA]).toFixed(2));
});

test('SCRUM-929 · CONTROL POSITIVO: una línea con IVA 0 sigue dando lo mismo que antes', async () => {
  // 🔴 Este es el que dice que el arreglo NO movió nada que ya estuviera bien. Sin él, «ahora sale
  // otro número» y «ahora sale el número bueno» son indistinguibles.
  const { data } = await totalDelBorrador(LINEA_SIN_IVA);
  const comoAntes = Number(LINEA_SIN_IVA.price) * Number(LINEA_SIN_IVA.qty);
  assert.equal(data.total, comoAntes.toFixed(2), 'una línea sin IVA ni descuento tiene que dar EXACTAMENTE lo de siempre');
  assert.equal(data.total, '320.00');
});

test('SCRUM-929 · el importe que se le cuenta al pro es el MISMO que se guarda', async () => {
  // El `CustomerEvent` y el `Quote.total` salen de la misma variable. Si algún día dejaran de
  // salir de la misma, la ficha del cliente diría un número y el documento otro — y el pro no
  // tendría forma de saber cuál es el bueno. Es exactamente la avería de 929, un nivel más allá.
  const { data, eventos } = await totalDelBorrador(LINEA_CON_IVA);
  assert.equal(eventos.length, 1, 'no quedó el evento en la ficha del cliente');
  assert.equal(eventos[0].type, 'maintenance_proposed');
  assert.match(eventos[0].detail, /387,20/,
    `la ficha del cliente dice «${eventos[0].detail}» y el documento guarda ${data.total}`);
});

test('SCRUM-929 · el borrador hereda la línea del presupuesto origen (si no, el test mediría otra cosa)', async () => {
  // 🔴 EL SUELO DEL FIXTURE. Si `suggestMaintenance` no casara —por el gremio o por el concepto—
  // el bucle se quedaría con su línea de cortesía a precio 0 y TODOS los asertos de arriba darían
  // «0.00 === 0.00» tan contentos. Esto comprueba que se está midiendo la línea de verdad.
  const { data } = await totalDelBorrador(LINEA_CON_IVA);
  assert.equal(data.lines.length, 1);
  assert.equal(Number(data.lines[0].price), 320, 'el borrador no heredó el precio del presupuesto origen');
  assert.equal(Number(data.lines[0].tax), 0.21, 'el borrador no heredó el IVA del presupuesto origen');
  assert.equal(data.lines[0].concept, PLAN.title, 'el concepto tiene que ser el título del plan');
});

test('SCRUM-929 · el ciclo sigue haciendo todo lo demás igual (la inyección no cambió el recorrido)', async () => {
  const { data, planesActualizados, resumen } = await totalDelBorrador(LINEA_CON_IVA);
  assert.deepEqual({ due: resumen.due, proposed: resumen.proposed, skipped: resumen.skipped },
    { due: 1, proposed: 1, skipped: [] });
  assert.equal(data.status, 'draft');
  assert.equal(data.origin, 'maintenance');
  assert.equal(data.createdVia, 'maintenance');
  assert.equal(data.merchantId, 2);
  assert.equal(data.customerId, 30);
  assert.equal(data.currency, 'EUR');

  // El plan se reprograma a +90 d con `lastProposedAt` en el `now` recibido, no en el reloj real.
  assert.equal(planesActualizados.length, 1);
  const { where, data: cambio } = planesActualizados[0];
  assert.equal(where.id, PLAN.id);
  assert.equal(cambio.lastProposedAt.getTime(), AHORA.getTime());
  assert.equal(cambio.nextDueAt.getTime(), AHORA.getTime() + 90 * 24 * 3600 * 1000);
});

test('SCRUM-929 · sin nada inyectado, el ciclo sigue siendo el de producción', async () => {
  // No se ejercita el recorrido —eso necesitaría base— pero sí que el parámetro nuevo es OPCIONAL
  // y que su ausencia no cambia la firma: en producción `cron.ts:87` llama sin argumentos.
  assert.equal(runMaintenanceProposals.length, 0,
    'los dos parámetros tienen valor por defecto: llamarla sin nada tiene que seguir valiendo');
});

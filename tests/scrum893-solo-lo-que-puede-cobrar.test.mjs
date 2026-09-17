// tests/scrum893-solo-lo-que-puede-cobrar.test.mjs — SCRUM-893
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA CLIENTA NO PUEDE PAGAR: SE LE OFRECÍA UNA VÍA QUE ESE NEGOCIO NO PUEDE COBRAR.
//
// Medido en staging (SCRUM-882b b2) y reproducido aquí CORRIENDO antes de tocar nada: en un
// negocio sin Stripe Connect la única forma de pago ofrecida era la tarjeta, marcada además como
// RECOMENDADO; al pulsarla, 409 «no está disponible»; «Ver otras formas de pago» devolvía a la
// misma página. Bucle cerrado, y sin salida.
//
// ── POR QUÉ PASABA: OFRECER Y COBRAR NO SE HACÍAN LA MISMA PREGUNTA ───────────────────────────
//
//   ofrecer (payInvoice)  hasCard = !flag ? TRUE : (active || demo)   ← con el flag OFF, SIEMPRE
//   cobrar  (payCard)     useConnect = flag && active && stripeAccountId → cardChargeDecision
//
// `PAYMENTS_CONNECT_ENABLED` está OFF por defecto (tabla P), así que el selector NO CONSULTABA
// nada: SUPONÍA que sí. El PASO 0 lo dejó visible — los cinco casos medidos, incluido el control
// positivo con Connect activo, daban `tarjeta=true`. Cuando todas las ramas responden igual, el
// que no está midiendo es el producto.
//
// Y no era una página: eran TRES las que llevan a `/pay/card` (selector, recibo y portal del
// cliente). Las otras dos ni siquiera tenían condición.
//
// ── QUÉ VIGILA ESTE FICHERO ───────────────────────────────────────────────────────────────────
//
//   ① SUELO ................. el instrumento levanta la ruta real y DISTINGUE. Si no, CIEGO.
//   ② 🔴 LA TABLA DE VERDAD . las 32 combinaciones que deciden la tarjeta: lo que se OFRECE y lo
//                             que la PUERTA hace tienen que coincidir. La puerta se EJECUTA, no
//                             se lee: `payCard.routes.ts` tiene CERO líneas de diff en este PR.
//   ③ 🔴 CONTROL POSITIVO ... un criterio mutado en UNA combinación hace caer ② — y el veredicto
//                             dice CUÁL. Un «no coinciden» sobre 32 casos no sirve a las tres de
//                             la mañana.
//   ④ 🔴 LAS TRES PÁGINAS ... rojo real (sin Connect → la tarjeta NO aparece) y verde real (con
//                             Connect → SÍ aparece), en las tres superficies.
//   ⑤ 🔴 EL TERCER CASO ..... sin Connect y SIN IBAN: qué se le ofrece a la clienta.
//
// 🔴 NI BD, NI RED, NI STAGING, NI UNA CREDENCIAL. `dist/` es CommonJS, así que las rutas reales
// corren contra un DOBLE de prisma y otro de Stripe instalados en `require.cache`. Ninguna firma
// de `src/` se tocó para poder mirar: un test que necesita cambiar el código para ver mide el
// código cambiado, no el tuyo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_STRIPE = require_.resolve('./dist/integrations/stripe.js');
const R_INVOICE = require_.resolve('./dist/modules/billing/app/routes/payInvoice.routes.js');
const R_CARD = require_.resolve('./dist/modules/billing/app/routes/payCard.routes.js');
const R_RECIBO = require_.resolve('./dist/modules/billing/app/routes/receipt.routes.js');
const R_PORTAL = require_.resolve('./dist/modules/system/app/routes/customerPortal.routes.js');

const { cardChargeMode } = require_('./dist/modules/billing/domain/cardCharge.js');
const { DEMO_MERCHANT_ID } = require_('./dist/modules/invoicing/domain/emission.service.js');

// ── Los dobles ────────────────────────────────────────────────────────────────────────────────
function poner(ruta, exports) {
  require_.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports };
}

/** Deja constancia de lo que la puerta le pidió a Stripe: con `stripeAccount` o sin él. */
function dobleStripe(espia) {
  return {
    stripe: {
      checkout: {
        sessions: {
          create: async (_params, opts) => {
            espia.creada = true;
            espia.stripeAccount = opts?.stripeAccount ?? null;
            return { id: 'cs_test_893', url: 'https://checkout.stripe.test/893' };
          },
        },
      },
    },
    stripeEnabled: true,
  };
}

function merchant(extra = {}) {
  return {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL',
    email: 'ruiz@ejemplo.test', country: 'ES', logoUrl: null,
    iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
    connectStatus: 'none', stripeAccountId: null, flags: null,
    ...extra,
  };
}

function charge(m, extra = {}) {
  return {
    id: 7, receiptToken: 'tok893', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(),
    merchant: m, customer: { id: 3, name: 'Ana', email: null }, events: [], reconciliations: [],
    ...extra,
  };
}

/** Levanta la ruta pedida con los dobles puestos y devuelve la respuesta cruda. */
async function pedir({ rutaModulo, montaje, url, prisma, espiaStripe }) {
  delete require_.cache[rutaModulo];
  poner(R_PRISMA, { prisma });
  poner(R_STRIPE, dobleStripe(espiaStripe ?? {}));
  const express = require_('express');
  const app = express();
  app.use(montaje, require_(rutaModulo).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { redirect: 'manual' });
  const cuerpo = await res.text();
  await new Promise((r) => server.close(r));
  return { status: res.status, cuerpo, location: res.headers.get('location') };
}

const prismaDeCobro = (ch) => ({
  charge: { findUnique: async () => ch, update: async () => ch },
  invoice: { findFirst: async () => null, findUnique: async () => null },
  quote: { findFirst: async () => null },
  event: { create: async () => ({ id: 1 }) },
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAS 32 COMBINACIONES QUE DECIDEN LA TARJETA
//
// El flag va por `merchant.flags` A PROPÓSITO y no por `process.env`: el override por merchant
// gana sobre la variable de entorno (Parte P), así que la tabla vale igual si alguien corre la
// tanda con `PAYMENTS_CONNECT_ENABLED` puesta. Una tabla que depende del entorno mide el entorno.
//
// IBAN y Bizum NO entran aquí, y no es un olvido: la puerta de cobro no los lee. Meterlos
// multiplicaría por cuatro casos idénticos sin discriminar nada — medir de más no es medir mejor.
// Dónde sí cuentan es en ④ y ⑤, que miran la página entera.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const CASOS = [];
for (const flag of [false, true])
  for (const connectStatus of ['none', 'pending', 'active', 'restricted'])
    for (const stripeAccountId of [null, 'acct_TEST893'])
      for (const id of [DEMO_MERCHANT_ID, 42])
        CASOS.push({
          flag, connectStatus, stripeAccountId, id,
          nombre: `flag=${flag ? 'ON ' : 'OFF'} · connectStatus=${connectStatus.padEnd(10)} · `
                + `stripeAccountId=${stripeAccountId ? 'sí  ' : 'null'} · ${id === DEMO_MERCHANT_ID ? 'DEMO' : 'real'}`,
          merchant: merchant({
            id, connectStatus, stripeAccountId,
            email: id === DEMO_MERCHANT_ID ? 'demo@yaqu.app' : 'ruiz@ejemplo.test',
            flags: { PAYMENTS_CONNECT_ENABLED: flag },
          }),
        });

/** Lo que hace la PUERTA REAL, ejecutada. `refuse` | `demo_platform` | `connect`. */
async function veredictoDeLaPuerta(m) {
  const espia = {};
  const r = await pedir({
    rutaModulo: R_CARD, montaje: '/pay', url: '/pay/card/tok893',
    prisma: prismaDeCobro(charge(m)), espiaStripe: espia,
  });
  if (r.status === 409) return 'refuse';
  if (r.status === 303 && espia.creada) return espia.stripeAccount ? 'connect' : 'demo_platform';
  return `inesperado(HTTP ${r.status})`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO — si el instrumento no distingue, nada de lo que siga significa algo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-893 · ① SUELO: la puerta real se ejecuta y DISTINGUE los tres modos', async () => {
  const sinConnect = await veredictoDeLaPuerta(merchant({ id: 42 }));
  const conConnect = await veredictoDeLaPuerta(merchant({
    id: 42, connectStatus: 'active', stripeAccountId: 'acct_TEST893',
    flags: { PAYMENTS_CONNECT_ENABLED: true },
  }));
  const demo = await veredictoDeLaPuerta(merchant({ id: DEMO_MERCHANT_ID, email: 'demo@yaqu.app' }));

  assert.equal(sinConnect, 'refuse', '🔴 CIEGO: un merchant sin Connect debería toparse con el 409.');
  assert.equal(conConnect, 'connect', '🔴 CIEGO: con Connect activo la puerta cobra en la cuenta CONECTADA.');
  assert.equal(demo, 'demo_platform', '🔴 CIEGO: el merchant demo cobra en plataforma (reglas 8/18).');

  assert.equal(new Set([sinConnect, conConnect, demo]).size, 3,
    '🔴 el instrumento devuelve lo mismo para los tres: no está midiendo, está contestando.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL QUE DECIDE — ofrecer y cobrar, la MISMA pregunta sobre las 32
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Compara un `modoDe` cualquiera contra la puerta. Devuelve las discrepancias, con su nombre. */
function discrepancias(modoDe, puertaPorCaso) {
  const fuera = [];
  for (const caso of CASOS) {
    const ofrecido = modoDe(caso.merchant);
    const puerta = puertaPorCaso.get(caso.nombre);
    if (ofrecido !== puerta) {
      fuera.push(`${caso.nombre}\n        ofrece «${ofrecido}» · la puerta hace «${puerta}»`);
    }
  }
  return fuera;
}

/** 32 ejecuciones de la ruta real. Se calcula una vez y la comparten ② y ③. */
let PUERTA = null;
async function puertaMedida() {
  if (PUERTA) return PUERTA;
  PUERTA = new Map();
  for (const caso of CASOS) PUERTA.set(caso.nombre, await veredictoDeLaPuerta(caso.merchant));
  return PUERTA;
}

test('SCRUM-893 · 🔴 ② las 32 combinaciones: lo que se OFRECE es lo que la PUERTA acepta', async () => {
  assert.equal(CASOS.length, 32,
    `🔴 la población cambió: ${CASOS.length} casos. Si se añade una entrada al criterio, se `
    + 'declara aquí — una tabla que no sabe cuántas filas tiene no es una tabla.');

  const puerta = await puertaMedida();

  // Control de la propia tabla: si la puerta contestara lo mismo a todo, comparar no valdría nada.
  assert.ok(new Set(puerta.values()).size >= 2,
    '🔴 la puerta devuelve un único veredicto para las 32: la tabla no discrimina y el verde '
    + 'de abajo sería una tautología.');

  const fuera = discrepancias(cardChargeMode, puerta);
  assert.deepEqual(fuera, [],
    '🔴 OFRECER Y COBRAR NO DICEN LO MISMO. Cada línea es una combinación en la que la página '
    + 'enseñaría algo que la puerta rechaza (o escondería algo que sí se puede cobrar):\n\n      '
    + fuera.join('\n      ')
    + '\n\n  Es el defecto de SCRUM-893 exactamente. No se ajusta la tabla: se arregla el criterio.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ CONTROL POSITIVO — ② en rojo, a propósito, y diciendo CUÁL
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-893 · 🔴 ③ un criterio roto en UNA sola combinación cae, y el veredicto la nombra', async () => {
  const puerta = await puertaMedida();

  // La combinación que se rompe: un merchant real, sin Connect, con el flag ON. La puerta dice
  // `refuse`; el mutante dirá `connect`. Es EXACTAMENTE el defecto del ticket, en pequeño.
  const victima = CASOS.find((c) => c.flag === true && c.connectStatus === 'none'
                                 && c.stripeAccountId === null && c.id !== DEMO_MERCHANT_ID);
  assert.ok(victima, '🔴 CIEGO: la combinación que iba a romperse no está en la tabla.');
  assert.equal(puerta.get(victima.nombre), 'refuse',
    '🔴 CIEGO: la puerta no rechaza el caso elegido, así que la mutación no prueba lo que dice.');

  const mutante = (m) => (m === victima.merchant ? 'connect' : cardChargeMode(m));
  const fuera = discrepancias(mutante, puerta);

  assert.equal(fuera.length, 1,
    `🔴 el comparador no cazó la mutación (o cazó de más): ${fuera.length} discrepancias, `
    + 'esperaba exactamente 1. Si no cae con el criterio roto, su verde no vale nada.');
  assert.match(fuera[0], /connectStatus=none/,
    '🔴 cayó, pero sin decir CUÁL: un «no coinciden» sobre 32 casos no se puede accionar.');
  assert.match(fuera[0], /ofrece «connect» · la puerta hace «refuse»/,
    '🔴 el veredicto no dice qué ofrecía ni qué hacía la puerta, que es lo único que orienta.');

  // Y la otra mitad: sin mutación, cero. Si no, el control estaría cazando ruido.
  assert.deepEqual(discrepancias(cardChargeMode, puerta), [],
    '🔴 el comparador acusa con el criterio SANO: entonces ③ no prueba la mutación.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ LAS TRES PÁGINAS — rojo real y verde real, en las tres puertas que llevan a /pay/card
//
// No es una página, son TRES. Arreglar sólo el selector cerraría la puerta que estábamos mirando
// y dejaría las otras dos abiertas, que es peor que no arreglar nada: el siguiente que lo mida
// vería el selector correcto y creería que está resuelto. Un arreglo parcial de un defecto con
// tres puertas no reduce el defecto, reduce su visibilidad.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const SIN_CONNECT = merchant({ id: 42, iban: 'ES9121000418450200051332' });
const CON_CONNECT = merchant({
  id: 42, iban: 'ES9121000418450200051332',
  connectStatus: 'active', stripeAccountId: 'acct_TEST893',
  flags: { PAYMENTS_CONNECT_ENABLED: true },
});

const prismaDelPortal = (m) => ({
  customer: { findUnique: async () => ({
    id: 3, name: 'Ana', portalToken: 'tokcli', merchantId: m.id, merchant: m,
  }) },
  quote: { findMany: async () => [] },
  invoice: { findMany: async () => [{
    id: 11, number: '2026-0001', status: 'pending', currency: 'EUR', total: 250,
    createdAt: new Date(), paidAt: null, pdfUrl: null, lines: [], charge: { id: 7 },
  }] },
  charge: {
    findUnique: async () => ({ receiptToken: 'tok893' }),
    update: async () => ({ receiptToken: 'tok893' }),
  },
});

const PAGINAS = [
  {
    nombre: 'el selector · GET /pay/invoice/:token',
    fichero: 'payInvoice.routes.ts',
    pedir: (m) => pedir({
      rutaModulo: R_INVOICE, montaje: '/pay', url: '/pay/invoice/tok893',
      prisma: prismaDeCobro(charge(m)),
    }),
    // Prueba de que la página SE PINTÓ: si esto falta, «no hay tarjeta» no significa nada.
    testigo: 'Elige cómo pagar',
  },
  {
    nombre: 'el recibo · GET /recibo/:token',
    fichero: 'receipt.routes.ts',
    pedir: (m) => pedir({
      rutaModulo: R_RECIBO, montaje: '/recibo', url: '/recibo/tok893',
      prisma: prismaDeCobro(charge(m)),
    }),
    testigo: 'Pagar por transferencia',
  },
  {
    nombre: 'el portal del cliente · GET /cliente/:token',
    fichero: 'customerPortal.routes.ts',
    pedir: (m) => pedir({
      rutaModulo: R_PORTAL, montaje: '/cliente', url: '/cliente/tokcli',
      prisma: prismaDelPortal(m),
    }),
    testigo: '2026-0001',
  },
];

for (const pagina of PAGINAS) {
  test(`SCRUM-893 · 🔴 ④ ${pagina.nombre}: sin Connect NO enseña la tarjeta; con Connect SÍ`, async () => {
    const rojo = await pagina.pedir(SIN_CONNECT);
    const verde = await pagina.pedir(CON_CONNECT);

    // SUELO de este caso: las dos páginas se pintaron de verdad. Comparar dos errores 500 daría
    // «ninguna enseña la tarjeta» y sería un verde perfecto sobre nada.
    assert.equal(rojo.status, 200, `🔴 CIEGO: ${pagina.nombre} devolvió HTTP ${rojo.status} sin Connect.`);
    assert.equal(verde.status, 200, `🔴 CIEGO: ${pagina.nombre} devolvió HTTP ${verde.status} con Connect.`);
    assert.ok(rojo.cuerpo.includes(pagina.testigo),
      `🔴 CIEGO: la página no contiene «${pagina.testigo}», así que no se pintó y «no hay tarjeta» `
      + 'no dice nada. Un cero no es «está limpio»: es «no he mirado».');

    // 🔴 ROJO REAL — el defecto del ticket.
    assert.equal(rojo.cuerpo.includes('/pay/card/'), false,
      `🔴 ${pagina.fichero} SIGUE OFRECIENDO LA TARJETA a un merchant sin Stripe Connect.\n`
      + '    Es el defecto de SCRUM-893: la clienta pulsa, se lleva un 409 «no está disponible»\n'
      + '    y «Ver otras formas de pago» la devuelve a esta misma página. Reglas 18 y 23: la\n'
      + '    tarjeta sólo con Connect activo en ESE merchant.');

    // 🔴 VERDE REAL — sin esta mitad, un «siempre no» pasaría el test de arriba.
    assert.equal(verde.cuerpo.includes('/pay/card/'), true,
      `🔴 ${pagina.fichero} ESCONDE LA TARJETA a un merchant que SÍ puede cobrarla (Connect\n`
      + '    activo). El arreglo se pasó de frenada: eso no es cerrar el bucle, es cerrar el cobro.');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ EL TERCER CASO — sin Connect y SIN IBAN: ¿qué se le ofrece a la clienta?
//
// Hoy este camino era INALCANZABLE: como `hasCard` valía `true` para todo el mundo, la lista nunca
// quedaba vacía y el bloque de abajo no se pintaba nunca. El arreglo lo vuelve alcanzable, así que
// pasa a ser el mensaje REAL de un negocio sin Connect y sin IBAN.
//
// ⚠️ NO SE INVENTA TEXTO (regla 30). El literal ya existe en `payInvoice.routes.ts`, escrito para
// este caso exacto. Lo que este test fija es que el camino EXISTE y que la clienta no se queda
// ante una página muda. Si ese mensaje debe decir otra cosa, lo decide el fundador.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-893 · 🔴 ⑤ sin Connect y SIN IBAN: ningún método, y la página lo DICE', async () => {
  const pelado = merchant({ id: 42 }); // sin iban, sin clabe, sin teléfono, sin Connect
  const r = await pedir({
    rutaModulo: R_INVOICE, montaje: '/pay', url: '/pay/invoice/tok893',
    prisma: prismaDeCobro(charge(pelado)),
  });

  assert.equal(r.status, 200, `🔴 CIEGO: la página devolvió HTTP ${r.status}.`);
  assert.equal(r.cuerpo.includes('/pay/card/'), false, '🔴 sigue ofreciendo tarjeta sin Connect.');
  assert.equal(r.cuerpo.includes('/pay/bank/'), false, '🔴 ofrece transferencia sin IBAN ni CLABE.');
  assert.equal(r.cuerpo.includes('/pay/bizum/'), false, '🔴 ofrece Bizum sin flag y sin teléfono.');

  // Y que no se quede muda: el importe sigue ahí y hay una salida escrita.
  assert.ok(r.cuerpo.includes('250,00'),
    '🔴 la página no muestra ni el importe: eso no es «sin métodos», es una página rota.');
  assert.ok(/El profesional te indicar/.test(r.cuerpo),
    '🔴 NINGÚN método ofrecido y NINGÚN mensaje: la clienta se queda mirando una página que no le\n'
    + '    dice qué hacer. El literal existe en `payInvoice.routes.ts` para este caso — si dejó de\n'
    + '    pintarse, el arreglo cambió el caso de «no puede pagar aquí» a «no sabe qué pasa».');
});

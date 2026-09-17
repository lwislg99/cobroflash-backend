// tests/scrum910-la-transferencia-que-no-mira.test.mjs — SCRUM-910
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA TRANSFERENCIA SE OFRECÍA SIN COMPROBAR SI HABÍA CUENTA A LA QUE TRANSFERIR.
//
// SCRUM-893 cerró la puerta de la tarjeta. Al cerrarla apareció lo que tapaba: en `/recibo`, un
// merchant sin Connect se quedaba con «Pagar por transferencia» como ÚNICO botón — y ese botón
// lleva a `/pay/bank`, que sin IBAN (o con CLABE y país que no es MX) no puede enseñar ninguna
// cuenta. Cerrar una puerta y dejar la otra abierta no reduce el defecto: reduce su visibilidad.
//
// ── LOS CUATRO CRITERIOS, medidos el 17-sep-2026 ──────────────────────────────────────────────
//
//   `payInvoice.routes.ts:57`  el selector ....... `!!(iban || clabe)`      ← no miraba el país
//   `receipt.routes.ts:110`    el recibo ......... NINGUNO
//   `payBank.routes.ts:41`     la página destino . `country === 'MX' && clabe` · `else if (iban)`
//   `viasDeCobro.ts:79`        el dashboard ...... sólo `iban` — ignora CLABE
//
// Cuatro, uno más que los tres de la tarjeta. Y el que decide es el TERCERO: es quien pinta —o no
// pinta— el número de cuenta. Los otros tres opinan.
//
// ── QUÉ VIGILA ESTE FICHERO ───────────────────────────────────────────────────────────────────
//
//   ① SUELO ............. `/pay/bank` se ejecuta y DISTINGUE: a veces pinta cuenta y a veces no.
//   ② 🔴 LA TABLA ....... las 12 combinaciones de país × IBAN × CLABE: lo que se OFRECE y lo que
//                         la página destino PUEDE ENSEÑAR tienen que coincidir. La página se
//                         EJECUTA, no se lee — `payBank.routes.ts` tiene cero líneas de diff.
//   ③ 🔴 LAS DOS PUERTAS  rojo y verde real en el selector y en el recibo.
//   ④ 🔴 EL CASO DEL TICKET  sin Connect y SIN IBAN: `/recibo` no deja un botón que no lleva
//                         a ninguna parte.
//
// 🔴 Ni BD, ni red, ni staging. Rutas reales con dobles en `require.cache`.
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
const R_RECIBO = require_.resolve('./dist/modules/billing/app/routes/receipt.routes.js');
const R_BANK = require_.resolve('./dist/modules/billing/app/routes/payBank.routes.js');

const { transferenciaDisponible } = require_('./dist/modules/billing/domain/transferenciaDisponible.js');

const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

const IBAN = 'ES9121000418450200051332';
const CLABE = '012180012345678901';
const CONNECT = { connectStatus: 'active', stripeAccountId: 'acct_T', flags: { PAYMENTS_CONNECT_ENABLED: true } };

function merchant(extra = {}) {
  return {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
    country: 'ES', logoUrl: null, iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
    connectStatus: 'none', stripeAccountId: null, flags: null, ...extra,
  };
}

async function pedir(modulo, montaje, url, m) {
  delete require_.cache[modulo];
  const ch = {
    id: 7, receiptToken: 'tok910', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(), merchant: m,
    customer: { id: 3, name: 'Ana', email: null }, events: [], reconciliations: [],
  };
  poner(R_PRISMA, { prisma: {
    charge: { findUnique: async () => ch, update: async () => ch },
    invoice: { findFirst: async () => null, findUnique: async () => null },
    quote: { findFirst: async () => null },
    event: { create: async () => ({ id: 1 }) },
  } });
  poner(R_STRIPE, { stripe: { checkout: { sessions: { create: async () => ({ id: 'cs', url: 'https://x.test' }) } } }, stripeEnabled: true });
  const express = require_('express');
  const app = express();
  app.use(montaje, require_(modulo).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { redirect: 'manual' });
  const cuerpo = await res.text();
  await new Promise((r) => server.close(r));
  return { status: res.status, cuerpo };
}

/** ¿Puede `/pay/bank` enseñar un número de cuenta? Se EJECUTA la ruta y se mira el HTML.
 *
 * 🔴 El detector es `id="account-num"`, NO la clase `account-value`. Con `account-value` la
 * primera sonda de este ticket dio `true` para un merchant sin IBAN: esa clase vive en el
 * `<style>` del documento y está SIEMPRE. Medido: `account-value` aparece 6 veces en el fichero
 * y `account-num` exactamente 2, las dos dentro del bloque de cuenta.
 *
 *     🔒 Contar texto no es contar cosas. Un prefijo no es un nombre, y una clase CSS tampoco.
 */
async function pintaCuenta(m) {
  const r = await pedir(R_BANK, '/pay', '/pay/bank/tok910', m);
  return /id="account-num"/.test(r.cuerpo);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAS 12 COMBINACIONES · país × IBAN × CLABE
//
// Tres países y no dos: con sólo ES y MX, «no-MX» y «ES» serían indistinguibles, y la regla que se
// está probando es «CLABE sólo en MX», no «CLABE no en ES».
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const CASOS = [];
for (const country of ['ES', 'MX', 'PT'])
  for (const iban of [null, IBAN])
    for (const clabe of [null, CLABE])
      CASOS.push({
        nombre: `país=${country} · iban=${iban ? 'sí ' : 'no '} · clabe=${clabe ? 'sí ' : 'no '}`,
        merchant: merchant({ country, iban, clabe }),
      });

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-910 · ① SUELO: `/pay/bank` se ejecuta y DISTINGUE si hay cuenta que enseñar', async () => {
  const conIban = await pintaCuenta(merchant({ country: 'ES', iban: IBAN }));
  const sinNada = await pintaCuenta(merchant({ country: 'ES' }));
  const mxConClabe = await pintaCuenta(merchant({ country: 'MX', clabe: CLABE }));

  assert.equal(conIban, true, '🔴 CIEGO: con IBAN no pinta cuenta. El detector o la ruta no van.');
  assert.equal(sinNada, false, '🔴 CIEGO: sin datos bancarios pinta cuenta. El detector casa con algo que está siempre.');
  assert.equal(mxConClabe, true, '🔴 CIEGO: en MX con CLABE no pinta cuenta.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL QUE DECIDE — ofrecer y poder enseñar la cuenta, la MISMA pregunta
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-910 · 🔴 ② las 12 combinaciones: se ofrece transferencia sólo si hay cuenta que enseñar', async () => {
  assert.equal(CASOS.length, 12,
    `🔴 la población cambió: ${CASOS.length} casos. Si se añade un país o un dato bancario, se declara aquí.`);

  const puerta = new Map();
  for (const c of CASOS) puerta.set(c.nombre, await pintaCuenta(c.merchant));

  // Control: si la página destino contestara lo mismo a todo, comparar no mediría nada.
  assert.ok(new Set(puerta.values()).size >= 2,
    '🔴 `/pay/bank` da el mismo veredicto a las 12: la tabla no discrimina y el verde sería una tautología.');

  const fuera = [];
  for (const c of CASOS) {
    const ofrecido = transferenciaDisponible(c.merchant);
    const puedeEnsenar = puerta.get(c.nombre);
    if (ofrecido !== puedeEnsenar) {
      fuera.push(`${c.nombre}\n        se ofrece=${ofrecido} · `
               + `/pay/bank puede enseñar cuenta=${puedeEnsenar}`);
    }
  }

  assert.deepEqual(fuera, [],
    '🔴 SE OFRECE UNA TRANSFERENCIA QUE LA PÁGINA DESTINO NO PUEDE COMPLETAR (o al revés):\n\n      '
    + fuera.join('\n      ')
    + '\n\n  El caso que lo destapó: un negocio **ES con sólo CLABE**. `/pay/bank` sólo pinta la\n'
    + '  CLABE si el país es MX, así que la clienta llegaba a una página que le decía que el\n'
    + '  profesional no había configurado su cuenta. No se ajusta la tabla: se arregla el criterio.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ LAS DOS PUERTAS QUE OFRECEN TRANSFERENCIA — rojo y verde real
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const PUERTAS = [
  { nombre: 'el selector · GET /pay/invoice/:token', fichero: 'payInvoice.routes.ts',
    pedir: (m) => pedir(R_INVOICE, '/pay', '/pay/invoice/tok910', m), testigo: 'Elige cómo pagar' },
  { nombre: 'el recibo · GET /recibo/:token', fichero: 'receipt.routes.ts',
    pedir: (m) => pedir(R_RECIBO, '/recibo', '/recibo/tok910', m), testigo: 'Recibo' },
];

for (const p of PUERTAS) {
  test(`SCRUM-910 · 🔴 ③ ${p.nombre}: ES con sólo CLABE NO ofrece transferencia; con IBAN SÍ`, async () => {
    const rojo = await p.pedir(merchant({ country: 'ES', clabe: CLABE, ...CONNECT }));
    const verde = await p.pedir(merchant({ country: 'ES', iban: IBAN, ...CONNECT }));

    assert.equal(rojo.status, 200, `🔴 CIEGO: ${p.nombre} devolvió HTTP ${rojo.status}.`);
    assert.ok(rojo.cuerpo.includes(p.testigo),
      `🔴 CIEGO: la página no contiene «${p.testigo}», así que no se pintó y «no hay transferencia» no dice nada.`);

    assert.equal(rojo.cuerpo.includes('/pay/bank/'), false,
      `🔴 ${p.fichero} OFRECE TRANSFERENCIA a un negocio ES con sólo CLABE. \`/pay/bank\` no puede\n`
      + '    enseñarle ninguna cuenta —la CLABE sólo se pinta en MX— así que la clienta aterriza\n'
      + '    en «el profesional aún no ha configurado su cuenta bancaria».');

    assert.equal(verde.cuerpo.includes('/pay/bank/'), true,
      `🔴 ${p.fichero} ESCONDE la transferencia a un negocio con IBAN, que sí puede cobrarla.\n`
      + '    Eso no es cerrar el agujero: es cerrar el cobro.');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL CASO DEL TICKET — sin Connect y SIN IBAN
//
// Antes de este arreglo: `/recibo` dejaba «Pagar por transferencia» como ÚNICO botón, y llevaba a
// una página sin cuenta. Ahora no se le ofrece un botón que no lleva a ninguna parte.
//
// ⚠️ LO QUE ESTE TEST **NO** FIJA: qué se le dice a esa clienta en su lugar. Eso es texto y lo
// firma el fundador (regla 30). Aquí sólo se fija QUÉ SE PINTA, que es lo que sí se puede decidir
// sin firma.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-910 · 🔴 ④ sin Connect y SIN IBAN: `/recibo` no deja un botón que no lleva a ninguna parte', async () => {
  const pelado = merchant({ country: 'ES' }); // sin Connect, sin IBAN, sin CLABE
  const r = await pedir(R_RECIBO, '/recibo', '/recibo/tok910', pelado);

  assert.equal(r.status, 200, `🔴 CIEGO: devolvió HTTP ${r.status}.`);
  assert.equal(r.cuerpo.includes('/pay/bank/'), false,
    '🔴 SIGUE OFRECIENDO TRANSFERENCIA sin ninguna cuenta detrás. Es el caso del ticket: la\n'
    + '    clienta pulsa el único botón que tiene y llega a una página sin número de cuenta.');
  assert.equal(r.cuerpo.includes('/pay/card/'), false,
    '🔴 ofrece tarjeta sin Stripe Connect (esto lo cerró SCRUM-893: si vuelve, se ha perdido).');

  // Y el control que impide que lo de arriba sea un verde sobre una página rota.
  const conIban = await pedir(R_RECIBO, '/recibo', '/recibo/tok910', merchant({ country: 'ES', iban: IBAN }));
  assert.equal(conIban.cuerpo.includes('/pay/bank/'), true,
    '🔴 tampoco ofrece transferencia CON IBAN: entonces ④ no prueba nada, sólo que la página no pinta botones.');
});

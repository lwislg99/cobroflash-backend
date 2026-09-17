// docs/master/evidencias/scrum910/censo-formas-de-pago.mjs — SCRUM-910 ①
//
// ¿CUÁNTAS FORMAS DE PAGO SE OFRECEN SIN COMPROBAR SU CONDICIÓN?
//
// Se mide POR COMPORTAMIENTO, no leyendo el código: a cada oferta se le pone delante un merchant
// para el que ESA vía no es cobrable, y se mira si la página la ofrece igual. Leer el fuente diría
// «hay un `if`»; esto dice si el `if` sirve.
//
// Cada fila lleva su CONTROL POSITIVO: el mismo merchant, pero con la condición cumplida. Si la
// oferta tampoco aparece ahí, la fila no mide nada (podría estar oculta por otro motivo) y se
// declara CIEGA en vez de contarse como buena.
//
// Ni BD, ni red, ni staging: `dist/` es CommonJS y las rutas reales corren con dobles.
//
//   node docs/master/evidencias/scrum910/censo-formas-de-pago.mjs
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_STRIPE = require_.resolve('./dist/integrations/stripe.js');
const RUTA = {
  selector: [require_.resolve('./dist/modules/billing/app/routes/payInvoice.routes.js'), '/pay', '/pay/invoice/tok910'],
  recibo:   [require_.resolve('./dist/modules/billing/app/routes/receipt.routes.js'), '/recibo', '/recibo/tok910'],
  portal:   [require_.resolve('./dist/modules/system/app/routes/customerPortal.routes.js'), '/cliente', '/cliente/tokcli'],
};

const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

const IBAN = 'ES9121000418450200051332';
const TEL = '+34600111222';
const CONNECT = { connectStatus: 'active', stripeAccountId: 'acct_T', flags: { PAYMENTS_CONNECT_ENABLED: true } };

function merchant(extra = {}) {
  return {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
    country: 'ES', logoUrl: null, iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
    connectStatus: 'none', stripeAccountId: null, flags: null, ...extra,
  };
}

async function pedir(cual, m, importe = 250) {
  const [modulo, montaje, url] = RUTA[cual];
  delete require_.cache[modulo];
  const ch = {
    id: 7, receiptToken: 'tok910', status: 'pending', amount: importe, currency: 'EUR',
    concept: 'Obra', payMethods: null, createdAt: new Date(), merchant: m,
    customer: { id: 3, name: 'Ana', email: null }, events: [], reconciliations: [],
  };
  poner(R_PRISMA, {
    prisma: {
      charge: { findUnique: async () => (cual === 'portal' ? { receiptToken: 'tok910' } : ch), update: async () => ch },
      invoice: {
        findFirst: async () => null, findUnique: async () => null,
        findMany: async () => [{
          id: 11, number: '2026-0001', status: 'pending', currency: 'EUR', total: importe,
          createdAt: new Date(), paidAt: null, pdfUrl: null, lines: [], charge: { id: 7 },
        }],
      },
      quote: { findFirst: async () => null, findMany: async () => [] },
      event: { create: async () => ({ id: 1 }) },
      customer: { findUnique: async () => ({ id: 3, name: 'Ana', portalToken: 'tokcli', merchantId: m.id, merchant: m }) },
    },
  });
  poner(R_STRIPE, { stripe: { checkout: { sessions: { create: async () => ({ id: 'cs', url: 'https://x.test' }) } } }, stripeEnabled: true });
  const express = require_('express');
  const app = express();
  app.use(montaje, require_(modulo).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { redirect: 'manual' });
  const html = await res.text();
  await new Promise((r) => server.close(r));
  return html;
}

/** LA POBLACIÓN: cada oferta de forma de pago que una superficie pública puede pintar. */
const OFERTAS = [
  { n: 1, superficie: '/pay/invoice', forma: 'tarjeta',       ruta: 'selector', enlace: '/pay/card/',
    noCobrable: merchant(),                      cobrable: merchant(CONNECT),
    condicion: 'Stripe Connect activo' },
  { n: 2, superficie: '/pay/invoice', forma: 'transferencia', ruta: 'selector', enlace: '/pay/bank/',
    noCobrable: merchant(),                      cobrable: merchant({ iban: IBAN }),
    condicion: 'IBAN o CLABE' },
  { n: 3, superficie: '/pay/invoice', forma: 'Bizum',         ruta: 'selector', enlace: '/pay/bizum/',
    noCobrable: merchant({ bizumPhone: TEL }),   cobrable: merchant({ bizumPhone: TEL, flags: { BIZUM_MANUAL_ENABLED: true } }),
    condicion: 'flag BIZUM_MANUAL_ENABLED' },
  { n: 4, superficie: '/pay/invoice', forma: 'Bizum (teléfono)', ruta: 'selector', enlace: '/pay/bizum/',
    noCobrable: merchant({ flags: { BIZUM_MANUAL_ENABLED: true } }),
    cobrable: merchant({ bizumPhone: TEL, flags: { BIZUM_MANUAL_ENABLED: true } }),
    condicion: 'móvil para Bizum' },
  { n: 5, superficie: '/recibo',      forma: 'tarjeta',       ruta: 'recibo',   enlace: '/pay/card/',
    noCobrable: merchant({ iban: IBAN }),        cobrable: merchant({ iban: IBAN, ...CONNECT }),
    condicion: 'Stripe Connect activo' },
  { n: 6, superficie: '/recibo',      forma: 'transferencia', ruta: 'recibo',   enlace: '/pay/bank/',
    noCobrable: merchant(),                      cobrable: merchant({ iban: IBAN }),
    condicion: 'IBAN o CLABE' },
  { n: 7, superficie: '/cliente',     forma: 'tarjeta',       ruta: 'portal',   enlace: '/pay/card/',
    noCobrable: merchant(),                      cobrable: merchant(CONNECT),
    condicion: 'Stripe Connect activo' },
];

console.log('POBLACIÓN: ' + OFERTAS.length + ' ofertas de forma de pago, en 3 superficies públicas.');
console.log('Medido por COMPORTAMIENTO: se ofrece o no cuando su condición NO se cumple.\n');
console.log('  #  superficie     forma                condición                  ¿la comprueba?');
console.log('  ─────────────────────────────────────────────────────────────────────────────────');

const fallan = [];
const ciegas = [];
for (const o of OFERTAS) {
  const sinCondicion = (await pedir(o.ruta, o.noCobrable)).includes(o.enlace);
  const conCondicion = (await pedir(o.ruta, o.cobrable)).includes(o.enlace);

  let veredicto;
  if (!conCondicion) { veredicto = '🔴 CIEGA'; ciegas.push(o); }        // control positivo caído
  else if (sinCondicion) { veredicto = '🔴 NO'; fallan.push(o); }
  else veredicto = '✅ sí';

  console.log(`  ${String(o.n).padEnd(2)} ${o.superficie.padEnd(14)} ${o.forma.padEnd(20)} `
            + `${o.condicion.padEnd(26)} ${veredicto}`);
}

console.log('\n══ VEREDICTO ══');
console.log(`  comprueban su condición .... ${OFERTAS.length - fallan.length - ciegas.length} de ${OFERTAS.length}`);
console.log(`  NO la comprueban ........... ${fallan.length}`);
console.log(`  ciegas (control caído) ..... ${ciegas.length}`);
for (const o of fallan) {
  console.log(`\n  🔴 ${o.superficie} · ${o.forma}: se ofrece aunque falte «${o.condicion}».`);
}
if (!fallan.length && !ciegas.length) console.log('\n  ✅ Las siete derivan de lo que ese merchant puede cobrar.');

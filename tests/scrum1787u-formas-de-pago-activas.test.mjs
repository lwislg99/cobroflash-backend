// tests/scrum1787u-formas-de-pago-activas.test.mjs — SCRUM-1787u
//
// «QUÉ FORMAS DE PAGO ESTÁN ACTIVAS PARA ESTE COMERCIO Y ESTE IMPORTE», EN UNA SOLA FUNCIÓN.
//
// GO del fundador: SCRUM-1787 c.22401 («1-GO»). El cálculo vivía EN LÍNEA en la página pública de pago
// (`GET /pay/invoice/:token`, `payInvoice.routes.ts`) y J1 lo necesita al emitir (tramos 1787s y
// 1787s-bis). Se saca a `formasDePagoActivas` SIN CAMBIAR lo que la página decide.
//
// Test de CARACTERIZACIÓN: `ORO` es lo que la página decidía ANTES de la extracción, medido con este
// mismo fichero contra el código de antes (`origin/main` 19859bf0b). Ese oro es la aceptación:
//   ① la página (ruta REAL, dobles en `require.cache`, patrón de `scrum1787q-pago-vence-el`) sigue
//     pintando el oro;
//   ② la función devuelve el oro;
//   ③ la página pinta lo que DEVUELVE la función: con la función sustituida por un doble que contesta
//     otra cosa, la página pinta esa otra cosa. Si la página vuelve a decidir en línea, ③ cae.
//
// No usa `tests/_arnes-de-router.mjs`: ese arnés construye un `req` con SESIÓN (rol y comercio) para
// rutas de `/admin`, y ésta es pública, sin sesión: la manda el token.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_INVOICE = require_.resolve('./dist/modules/billing/app/routes/payInvoice.routes.js');
const R_FORMAS = path.join(RAIZ, 'dist/modules/billing/app/routes/formasDePagoActivas.js');

// Mutaciones que este fichero tiene que tumbar (catálogo del meta-guard, SCRUM-1731). Cada campo, LITERAL.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «La página vuelve a decidir EN LÍNEA»: deja de importar la función y lleva su propia copia del
    // cálculo (la misma regla). El oro sigue saliendo; lo que cae es ③.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: "import { formasDePagoActivas, type FormaDePago } from './formasDePagoActivas'; // SCRUM-1787u",
    a: [
      "import type { FormaDePago } from './formasDePagoActivas';",
      "import { isFlagEnabled } from '../../../../core/flags';",
      "import { bizumAutoDisponible } from '../../domain/bizumCharge';",
      "import { cardChargeMode } from '../../domain/cardCharge';",
      "import { transferenciaDisponible } from '../../domain/transferenciaDisponible';",
      'function formasDePagoActivas(o: any): FormaDePago[] {',
      '  const m = o.merchant;',
      '  const tel = m?.bizumPhone || m?.whatsappPhone || null;',
      "  const bizum = isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: m }) && !!tel && o.importe <= 1000;",
      "  const auto = bizumAutoDisponible({ flagOn: isFlagEnabled('BIZUM_AUTO_ENABLED', { merchant: m }), useConnect: m?.connectStatus === 'active' && !!m?.stripeAccountId, currency: o.moneda, amountCents: Math.round(o.importe * 100) }) === 'ok';",
      '  const p = (k: string) => !o.permitidas || o.permitidas.includes(k);',
      "  const base: FormaDePago[] = o.importe <= 500 ? ['bizum', 'card', 'transfer'] : ['card', 'bizum', 'transfer'];",
      "  return (auto ? base.flatMap((k) => (k === 'bizum' ? ['bizum', 'bizum_auto'] as FormaDePago[] : [k])) : base).filter((k) =>",
      "    (k === 'card' && cardChargeMode(m) !== 'refuse' && p('card')) || (k === 'bizum' && bizum && p('bizum')) ||",
      "    (k === 'bizum_auto' && p('bizum')) || (k === 'transfer' && transferenciaDisponible(m) && p('transfer')));",
      '}',
    ].join('\n'),
    cae: 'SCRUM-1787u · ③ la página pinta lo que devuelve la función, en su orden (no decide en línea)',
  },
  {
    // «Bizum también por encima de 1.000 €»: el tope del banco del pagador (W4) desaparece.
    fichero: 'src/modules/billing/app/routes/formasDePagoActivas.ts',
    de: '!!bizumPhone && importe <= 1000;',
    a: '!!bizumPhone;',
    cae: 'SCRUM-1787u · ② la función devuelve el oro, caso a caso',
  },
];

// ── La matriz del encargo: IBAN × Bizum activado × teléfono Bizum × Connect × importe ──────────────
const IMPORTES = [999.99, 1000.0, 1000.01];

function comercio({ iban = false, bizumFlag = false, tel = false, connect = false, auto = false,
  pais = 'ES', clabe = null, wa = null } = {}) {
  return {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
    country: pais, timezone: 'Europe/Madrid', logoUrl: null,
    iban: iban ? 'ES9121000418450200051332' : null, clabe,
    bizumPhone: tel ? '+34600111222' : null, whatsappPhone: wa,
    connectStatus: connect ? 'active' : 'none', stripeAccountId: connect ? 'acct_1787u_ejemplo' : null,
    // Los tres flags SIEMPRE explícitos por comercio: el override del comercio gana al entorno
    // (`isFlagEnabled`), así que el oro no depende de las variables de la máquina que lo corra.
    flags: { PAYMENTS_CONNECT_ENABLED: connect, BIZUM_MANUAL_ENABLED: bizumFlag, BIZUM_AUTO_ENABLED: auto },
  };
}

function casos() {
  const lista = [];
  for (const iban of [true, false]) for (const bizumFlag of [true, false]) for (const tel of [true, false])
    for (const connect of [true, false]) for (const importe of IMPORTES) {
      const nombre = `IBAN ${iban ? 'sí' : 'no'} · Bizum ${bizumFlag ? 'sí' : 'no'} · tel ${tel ? 'sí' : 'no'} · Connect ${connect ? 'sí' : 'no'} · ${importe.toFixed(2)}`;
      lista.push({ nombre, merchant: comercio({ iban, bizumFlag, tel, connect }), importe, moneda: 'EUR', payMethods: null });
    }
  // Extras: las otras ramas que decide la misma página (tramo de 500 €, Bizum automático, la lista
  // que el PRO limitó para ESTE cobro, CLABE por país, el móvil de WhatsApp como teléfono Bizum).
  const todo = { iban: true, bizumFlag: true, tel: true, connect: true };
  const extra = (nombre, opts, importe, moneda = 'EUR', payMethods = null) =>
    lista.push({ nombre, merchant: comercio(opts), importe, moneda, payMethods });
  extra('extra · todo · 500.00', todo, 500.0);
  extra('extra · todo · 500.01', todo, 500.01);
  extra('extra · todo + Bizum automático · 999.99', { ...todo, auto: true }, 999.99);
  extra('extra · todo + Bizum automático · 1000.01', { ...todo, auto: true }, 1000.01);
  extra('extra · todo + Bizum automático · 999.99 USD', { ...todo, auto: true }, 999.99, 'USD');
  extra('extra · todo · cobro limitado a transferencia', todo, 300, 'EUR', ['transfer']);
  extra('extra · todo + Bizum automático · cobro limitado a tarjeta y transferencia', { ...todo, auto: true }, 300, 'EUR', ['card', 'transfer']);
  extra('extra · MX solo CLABE · 999.99', { pais: 'MX', clabe: '012180001234567897' }, 999.99);
  extra('extra · ES solo CLABE · 999.99', { clabe: '012180001234567897' }, 999.99);
  extra('extra · Bizum con el móvil de WhatsApp · 999.99', { bizumFlag: true, wa: '+34600333444' }, 999.99);
  return lista;
}

// Lo que la página decidía ANTES de la extracción (origin/main 19859bf0b), caso a caso, en su orden.
const ORO = {
  'IBAN sí · Bizum sí · tel sí · Connect sí · 999.99': ['card', 'bizum', 'transfer'],
  'IBAN sí · Bizum sí · tel sí · Connect sí · 1000.00': ['card', 'bizum', 'transfer'],
  'IBAN sí · Bizum sí · tel sí · Connect sí · 1000.01': ['card', 'transfer'],
  'IBAN sí · Bizum sí · tel sí · Connect no · 999.99': ['bizum', 'transfer'],
  'IBAN sí · Bizum sí · tel sí · Connect no · 1000.00': ['bizum', 'transfer'],
  'IBAN sí · Bizum sí · tel sí · Connect no · 1000.01': ['transfer'],
  'IBAN sí · Bizum sí · tel no · Connect sí · 999.99': ['card', 'transfer'],
  'IBAN sí · Bizum sí · tel no · Connect sí · 1000.00': ['card', 'transfer'],
  'IBAN sí · Bizum sí · tel no · Connect sí · 1000.01': ['card', 'transfer'],
  'IBAN sí · Bizum sí · tel no · Connect no · 999.99': ['transfer'],
  'IBAN sí · Bizum sí · tel no · Connect no · 1000.00': ['transfer'],
  'IBAN sí · Bizum sí · tel no · Connect no · 1000.01': ['transfer'],
  'IBAN sí · Bizum no · tel sí · Connect sí · 999.99': ['card', 'transfer'],
  'IBAN sí · Bizum no · tel sí · Connect sí · 1000.00': ['card', 'transfer'],
  'IBAN sí · Bizum no · tel sí · Connect sí · 1000.01': ['card', 'transfer'],
  'IBAN sí · Bizum no · tel sí · Connect no · 999.99': ['transfer'],
  'IBAN sí · Bizum no · tel sí · Connect no · 1000.00': ['transfer'],
  'IBAN sí · Bizum no · tel sí · Connect no · 1000.01': ['transfer'],
  'IBAN sí · Bizum no · tel no · Connect sí · 999.99': ['card', 'transfer'],
  'IBAN sí · Bizum no · tel no · Connect sí · 1000.00': ['card', 'transfer'],
  'IBAN sí · Bizum no · tel no · Connect sí · 1000.01': ['card', 'transfer'],
  'IBAN sí · Bizum no · tel no · Connect no · 999.99': ['transfer'],
  'IBAN sí · Bizum no · tel no · Connect no · 1000.00': ['transfer'],
  'IBAN sí · Bizum no · tel no · Connect no · 1000.01': ['transfer'],
  'IBAN no · Bizum sí · tel sí · Connect sí · 999.99': ['card', 'bizum'],
  'IBAN no · Bizum sí · tel sí · Connect sí · 1000.00': ['card', 'bizum'],
  'IBAN no · Bizum sí · tel sí · Connect sí · 1000.01': ['card'],
  'IBAN no · Bizum sí · tel sí · Connect no · 999.99': ['bizum'],
  'IBAN no · Bizum sí · tel sí · Connect no · 1000.00': ['bizum'],
  'IBAN no · Bizum sí · tel sí · Connect no · 1000.01': [],
  'IBAN no · Bizum sí · tel no · Connect sí · 999.99': ['card'],
  'IBAN no · Bizum sí · tel no · Connect sí · 1000.00': ['card'],
  'IBAN no · Bizum sí · tel no · Connect sí · 1000.01': ['card'],
  'IBAN no · Bizum sí · tel no · Connect no · 999.99': [],
  'IBAN no · Bizum sí · tel no · Connect no · 1000.00': [],
  'IBAN no · Bizum sí · tel no · Connect no · 1000.01': [],
  'IBAN no · Bizum no · tel sí · Connect sí · 999.99': ['card'],
  'IBAN no · Bizum no · tel sí · Connect sí · 1000.00': ['card'],
  'IBAN no · Bizum no · tel sí · Connect sí · 1000.01': ['card'],
  'IBAN no · Bizum no · tel sí · Connect no · 999.99': [],
  'IBAN no · Bizum no · tel sí · Connect no · 1000.00': [],
  'IBAN no · Bizum no · tel sí · Connect no · 1000.01': [],
  'IBAN no · Bizum no · tel no · Connect sí · 999.99': ['card'],
  'IBAN no · Bizum no · tel no · Connect sí · 1000.00': ['card'],
  'IBAN no · Bizum no · tel no · Connect sí · 1000.01': ['card'],
  'IBAN no · Bizum no · tel no · Connect no · 999.99': [],
  'IBAN no · Bizum no · tel no · Connect no · 1000.00': [],
  'IBAN no · Bizum no · tel no · Connect no · 1000.01': [],
  'extra · todo · 500.00': ['bizum', 'card', 'transfer'],
  'extra · todo · 500.01': ['card', 'bizum', 'transfer'],
  'extra · todo + Bizum automático · 999.99': ['card', 'bizum', 'bizum_auto', 'transfer'],
  'extra · todo + Bizum automático · 1000.01': ['card', 'bizum_auto', 'transfer'],
  'extra · todo + Bizum automático · 999.99 USD': ['card', 'bizum', 'transfer'],
  'extra · todo · cobro limitado a transferencia': ['transfer'],
  'extra · todo + Bizum automático · cobro limitado a tarjeta y transferencia': ['card', 'transfer'],
  'extra · MX solo CLABE · 999.99': ['transfer'],
  'extra · ES solo CLABE · 999.99': [],
  'extra · Bizum con el móvil de WhatsApp · 999.99': ['bizum'],
};

/** Pinta `/pay/invoice/<token>` para un cobro de `importe` del comercio `merchant`. */
async function pedir({ merchant, importe, moneda, payMethods }) {
  const ch = {
    id: 7, merchantId: 42, receiptToken: 'tok1787u', status: 'pending', amount: importe, currency: moneda,
    concept: 'Reparación de bajante', payMethods, createdAt: new Date(), merchant,
  };
  delete require_.cache[R_INVOICE];
  require_.cache[R_PRISMA] = {
    id: R_PRISMA, filename: R_PRISMA, loaded: true,
    exports: { prisma: {
      charge: { findUnique: async ({ where }) => (where.receiptToken === ch.receiptToken ? ch : null) },
      invoice: { findFirst: async () => null },
    } },
  };
  const app = require_('express')();
  app.use('/pay', require_(R_INVOICE).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // `node:http` sin agente, no `fetch` (0xC0000409 con `--test-force-exit`: SCRUM-1204, cicatriz J2 27-oct).
  const res = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: '/pay/invoice/tok1787u', agent: false }, (r) => {
      const trozos = [];
      r.on('data', (t) => trozos.push(t));
      r.on('end', () => resolve({ status: r.statusCode, cuerpo: Buffer.concat(trozos).toString('utf8') }));
    }).on('error', reject);
  });
  await new Promise((r) => server.close(r));
  assert.equal(res.status, 200, 'la página de pago tiene que contestar 200');
  return res.cuerpo;
}

/** Las formas que la página PINTA, en su orden, leídas de los `<a class="method">`. */
function formasPintadas(html) {
  const out = [];
  const re = /<a class="method" href="([^"]+)">[\s\S]*?<span class="method-title">([^<]*)<\/span>/g;
  for (const [, href, titulo] of html.matchAll(re)) {
    if (href.startsWith('/pay/bizum/')) out.push('bizum');
    else if (href.startsWith('/pay/bank/')) out.push('transfer');
    else if (href.startsWith('/pay/card/') && titulo === 'Pagar con tarjeta') out.push('card');
    else if (href.startsWith('/pay/card/') && titulo === 'Bizum al instante') out.push('bizum_auto');
    else out.push(`DESCONOCIDA:${href}:${titulo}`);
  }
  return out;
}

test('SCRUM-1787u · ① la página de pago sigue decidiendo el oro, caso a caso', async () => {
  const obtenido = {};
  for (const c of casos()) obtenido[c.nombre] = formasPintadas(await pedir(c));
  assert.deepEqual(obtenido, ORO);
});

test('SCRUM-1787u · ② la función devuelve el oro, caso a caso', () => {
  delete require_.cache[R_FORMAS];
  const { formasDePagoActivas } = require_(R_FORMAS);
  const obtenido = {};
  for (const c of casos()) {
    obtenido[c.nombre] = formasDePagoActivas({ merchant: c.merchant, importe: c.importe, moneda: c.moneda, permitidas: c.payMethods });
  }
  assert.deepEqual(obtenido, ORO);
});

test('SCRUM-1787u · ③ la página pinta lo que devuelve la función, en su orden (no decide en línea)', async () => {
  // Un comercio SIN ninguna vía configurada (el oro le da la lista vacía) y una función doble que
  // contesta transferencia y tarjeta, al revés que el orden W4: sólo la función puede ponerlas ahí.
  const llamadas = [];
  require_.cache[R_FORMAS] = {
    id: R_FORMAS, filename: R_FORMAS, loaded: true,
    exports: { formasDePagoActivas: (o) => { llamadas.push(o); return ['transfer', 'card']; } },
  };
  try {
    const merchant = comercio({});
    const html = await pedir({ merchant, importe: 999.99, moneda: 'EUR', payMethods: ['card', 'transfer'] });
    assert.deepEqual(formasPintadas(html), ['transfer', 'card']);
    assert.equal(llamadas.length, 1, 'la página llama a la función UNA vez por petición');
    assert.equal(llamadas[0].merchant, merchant, 'le pasa el comercio del cobro, tal cual');
    assert.equal(llamadas[0].importe, 999.99);
    assert.equal(llamadas[0].moneda, 'EUR');
    assert.deepEqual(llamadas[0].permitidas, ['card', 'transfer'], 'y la lista que el PRO limitó para este cobro');
  } finally {
    delete require_.cache[R_FORMAS];
    delete require_.cache[R_INVOICE];
  }
});

test('SCRUM-1787u · control: el oro tiene la población entera y cada forma aparece y falta en algún caso', () => {
  const nombres = casos().map((c) => c.nombre);
  assert.equal(new Set(nombres).size, nombres.length, 'nombres de caso únicos');
  assert.equal(nombres.length, 2 * 2 * 2 * 2 * IMPORTES.length + 10, 'la matriz del encargo (48) + 10 extras');
  assert.deepEqual(Object.keys(ORO).sort(), [...nombres].sort(), 'el oro tiene un valor por caso, ni más ni menos');
  for (const forma of ['card', 'bizum', 'bizum_auto', 'transfer']) {
    assert.ok(Object.values(ORO).some((l) => l.includes(forma)), `«${forma}» aparece en algún caso`);
    assert.ok(Object.values(ORO).some((l) => !l.includes(forma)), `«${forma}» falta en algún caso`);
  }
  assert.ok(Object.values(ORO).some((l) => l.length === 0), 'hay casos sin ninguna forma');
});

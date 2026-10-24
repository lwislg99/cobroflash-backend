// SCRUM-85 (🔴 SEGURIDAD/RGPD, la TERCERA puerta de la misma fuga — SCRUM-72 → SCRUM-74 → esta)
// /pay/card, /pay/bizum y /pay/invoice compartían el mismo patrón enumerable que /recibo
// (P0-SEC-7, SCRUM-74): Charge.id autoincremental como identificador de RUTA, sin token ni
// secreto. Cualquiera, sin login, podía recorrer /pay/invoice/1, /pay/invoice/2… y ver las
// páginas de pago (importe, concepto, nombre/logo del merchant) de OTROS merchants.
//
// Fix: reutiliza Charge.receiptToken (ya existía desde SCRUM-74, SIN schema nuevo). Los 3
// endpoints pasan a identificarse por token — el id numérico ya no resuelve nada, con
// verificación "zero leak" (el 404 numérico no debe filtrar nada del cobro real).
//
// ⚠️ GATEADO (crea/BORRA merchants efímeros; /pay/card golpea Stripe test-mode real):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import http from 'node:http';

// `node:http` sin agente y no `fetch` (SCRUM-1218g): `fetch` contra un servidor propio puede
// abortar el proceso al salir (SCRUM-560). Devuelve lo que este fichero lee de la respuesta de `fetch`
// (status, headers.get, text, json, arrayBuffer) y, como el `redirect: 'manual'` de antes, no sigue
// redirecciones. El cuerpo se guarda en bytes: `text()` lo decodifica como `fetch` (TextDecoder).
const pedirSinAgente = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const cabeceras = { ...headers };
  if (body !== undefined) cabeceras['content-length'] = Buffer.byteLength(body);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: cabeceras, agent: false }, (r) => {
    const trozos = [];
    r.on('data', (t) => { trozos.push(t); });
    r.on('end', () => {
      const buf = Buffer.concat(trozos);
      ok({
        status: r.statusCode,
        headers: { get: (n) => { const v = r.headers[n.toLowerCase()]; return v === undefined ? null : [].concat(v).join(', '); } },
        text: async () => new TextDecoder().decode(buf),
        json: async () => JSON.parse(new TextDecoder().decode(buf)),
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      });
    });
  });
  req.on('error', mal);
  req.end(body);
});

const ENABLED = process.env.QA_DB_TEST === '1';

// SCRUM-1599c (decisión del fundador, SCRUM-1599 c.20650 ②: «Connect activo en el test»): desde
// SCRUM-893 la página de pago sólo enlaza la tarjeta si `cardChargeMode` no da 'refuse', y un
// merchant real sin Connect da 'refuse' (reglas 18/23). Para que el test siga probando el IDOR
// de /pay/card, el merchant A lleva Connect ACTIVO, con la misma forma que scrum893/scrum923.
// La cuenta es ficticia: por eso la clave de Stripe se vacía ANTES de cargar `dist/` (dotenv no
// pisa una variable que ya existe) y /pay/card no puede llamar a Stripe, haya o no clave en el .env.
const CONNECT_ACTIVO = { connectStatus: 'active', stripeAccountId: 'acct_QAS85', flags: { PAYMENTS_CONNECT_ENABLED: true } };

test('SCRUM-85: /pay/card, /pay/bizum, /pay/invoice cierran el IDOR — numérico 404 sin fuga, token funciona', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  process.env.STRIPE_SECRET_KEY = '';
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { ensureChargeReceiptToken } = await import('../dist/lib/invoicing.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: este fichero tenía la MISMA forma que scrum74 — un mkFixture que creaba el
  // merchant y sus hijos, invocado dos veces ANTES del try. Es el patrón que produjo los 4
  // huérfanos de SCRUM-79: si el segundo mkFixture reventaba, el primero ya estaba en la BD
  // y el finally no llegaba a plantearse. Ahora el merchant lo crea withMerchant y mkFixture
  // solo monta lo que cuelga de él, ya dentro de la red.
  const mkFixture = async (merchant, tag) => {
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: `Cliente Secreto QA-S85-${tag} ${stamp}`, phone: `3461${tag === 'A' ? 0 : 1}${stamp % 1000000}` },
    });
    const charge = await prisma.charge.create({
      data: { merchantId: merchant.id, customerId: customer.id, concept: `QA S85 ${tag}`, amount: '55.00', currency: 'EUR', method: 'card', status: 'pending' },
    });
    return { merchant, customer, charge };
  };

  try {
    await withMerchant(prisma, { name: 'QA S85 A', email: `qa-s85-A-${stamp}@test.local`, ...CONNECT_ACTIVO }, (mA) =>
      withMerchant(prisma, { name: 'QA S85 B', email: `qa-s85-B-${stamp}@test.local` }, async (mB) => {
    const A = await mkFixture(mA, 'A');
    const B = await mkFixture(mB, 'B');

    const tokenA = await ensureChargeReceiptToken(A.charge.id, prisma);
    const tokenB = await ensureChargeReceiptToken(B.charge.id, prisma);
    assert.notEqual(tokenA, tokenB, 'cobros distintos → tokens distintos');

    // ── /pay/invoice: numérico 404 sin fuga, token 200 con enlaces por token ──
    const rNumInvoice = await pedirSinAgente(`${base}/pay/invoice/${A.charge.id}`);
    assert.equal(rNumInvoice.status, 404, `GET /pay/invoice/<id numérico> debe ser 404 y fue ${rNumInvoice.status}`);
    const numInvoiceBody = await rNumInvoice.text();
    assert.ok(!numInvoiceBody.includes(A.merchant.name), 'FUGA: el 404 numérico expone el nombre del merchant');

    const rInvoice = await pedirSinAgente(`${base}/pay/invoice/${tokenA}`);
    assert.equal(rInvoice.status, 200, `GET /pay/invoice/:token debe ser 200 y fue ${rInvoice.status}`);
    const invoiceBody = await rInvoice.text();
    assert.ok(invoiceBody.includes(A.merchant.name), 'con el token correcto sí debe verse el propio merchant');
    assert.ok(invoiceBody.includes(`/pay/card/${tokenA}`), 'el link a /pay/card debe llevar el TOKEN');
    assert.ok(!invoiceBody.includes(`/pay/card/${A.charge.id}`), 'el link a /pay/card NO debe llevar el id numérico');

    // ── /pay/card: numérico 404, token resuelve el cobro (303 Stripe / 501 sin Stripe / 409 r23) ──
    const rNumCard = await pedirSinAgente(`${base}/pay/card/${A.charge.id}`, { redirect: 'manual' });
    assert.equal(rNumCard.status, 404, `GET /pay/card/<id numérico> debe ser 404 y fue ${rNumCard.status}`);

    const rCard = await pedirSinAgente(`${base}/pay/card/${tokenA}`, { redirect: 'manual' });
    // El token DEBE resolver el cobro (algo != 404). Statuses posibles: 303 (Stripe → Checkout),
    // 501 (Stripe ausente), o 409 (r23: merchant real SIN Connect → tarjeta = «cuenta conectada o
    // nada»; desde SCRUM-1599c el merchant A lleva Connect activo, así que con la clave vacía da 501).
    // Junto al 404 del id numérico, ESA es la
    // prueba del IDOR: el token resuelve (≠404, testigo de «mecanismo vivo»), el numérico no.
    assert.notEqual(rCard.status, 404, 'el token válido NO debe dar 404 (mecanismo vivo del IDOR)');
    assert.ok([303, 501, 409].includes(rCard.status), `GET /pay/card/:token: 303/501/409 y fue ${rCard.status}`);
    if (rCard.status === 303) {
      assert.match(rCard.headers.get('location') || '', /^https:\/\/checkout\.stripe\.com\//, 'debe redirigir a Stripe Checkout real');
    } else if (rCard.status === 409) {
      // SCRUM-130 (r23): merchant real sin Connect → NO cae a la cuenta de plataforma. El IDOR queda
      // verificado igual (numérico 404 ≠ token 409); lo que NO se ejerce aquí es el redirect a Stripe.
      t.diagnostic('ℹ️ SCRUM-130 (r23): /pay/card token → 409 (merchant real sin Connect: tarjeta = cuenta conectada o nada). IDOR verificado (numérico 404 ≠ token 409).');
    } else {
      // SCRUM-119 (criterio SCRUM-121): sin STRIPE_SECRET_KEY el redirect real (303) NO se ejerce.
      // El IDOR SÍ queda verificado (numérico 404 ≠ token 501). Se dice EN VOZ ALTA — ni verde
      // fingido ni skip mudo.
      t.diagnostic('⚠️ SCRUM-119: Stripe ausente — IDOR de /pay/card verificado (numérico 404 ≠ token 501); el redirect a Stripe Checkout (303) NO se ejerció aquí.');
    }

    // ── /pay/bizum: numérico 404; token resuelve (200 con el flag activo, o redirect a /pay/invoice/:token si no) ──
    const rNumBizum = await pedirSinAgente(`${base}/pay/bizum/${A.charge.id}`, { redirect: 'manual' });
    assert.equal(rNumBizum.status, 404, `GET /pay/bizum/<id numérico> debe ser 404 y fue ${rNumBizum.status}`);

    const rBizum = await pedirSinAgente(`${base}/pay/bizum/${tokenA}`, { redirect: 'manual' });
    assert.ok([200, 303].includes(rBizum.status), `GET /pay/bizum/:token debe resolver el cobro y fue ${rBizum.status}`);
    if (rBizum.status === 303) {
      const loc = rBizum.headers.get('location') || '';
      assert.ok(loc.includes(tokenA), `el redirect de bizum (no disponible) debe llevar el TOKEN y fue ${loc}`);
    }

    // token de OTRO cobro (B) en /pay/invoice: debe mostrar el negocio de B, NUNCA el de A
    const rInvoiceB = await pedirSinAgente(`${base}/pay/invoice/${tokenB}`);
    assert.equal(rInvoiceB.status, 200);
    const invoiceBodyB = await rInvoiceB.text();
    assert.ok(invoiceBodyB.includes(B.merchant.name), 'token de B debe mostrar el merchant de B');
    assert.ok(!invoiceBodyB.includes(A.merchant.name), 'FUGA: el token de B no debe mostrar nada del merchant de A');

    t.diagnostic('SCRUM-85: /pay/invoice, /pay/card y /pay/bizum — numérico 404 sin fuga, token propio 200/redirect correcto, sin cruce entre cobros ✓');
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant, que
    // además borra los `event` (cuelgan de charge, no de merchant) antes que los charges.
    server.close();
    await prisma.$disconnect();
  }
});

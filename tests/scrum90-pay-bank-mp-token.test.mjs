// SCRUM-90 (🔴 SEGURIDAD/RGPD, la QUINTA y ÚLTIMA puerta de la misma fuga —
// SCRUM-72 → SCRUM-74 → SCRUM-85 → esta) — /pay/bank y /pay/mp compartían el mismo
// patrón enumerable que ya se cerró en /recibo (P0-SEC-7) y /pay/card+bizum+invoice
// (P1-SEC-8): Charge.id autoincremental en la ruta, sin token ni secreto.
//
// /pay/bank era el MÁS sensible de los cinco: expone el IBAN/CLABE del PROFESIONAL
// (no del cliente final) — enumerable = recolectar cuentas bancarias de todos los
// merchants de la plataforma (riesgo de fraude "cambio de cuenta").
//
// Fix: reutiliza Charge.receiptToken (ya existía desde SCRUM-74, SIN schema nuevo).
//
// ⚠️ GATEADO (crea/BORRA merchants efímeros):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import { URL_BANCO } from './_banco-libro.mjs'; // SCRUM-1599i: segundo destino (LIBRO_PG_URL), inerte con el gate de staging
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import http from 'node:http';

// `node:http` sin agente y no `fetch` (SCRUM-1218d): `fetch` contra un servidor propio puede
// abortar el proceso al salir (SCRUM-560). Devuelve lo que este fichero lee de la respuesta de `fetch`
// (status, headers.get, text, json) y, como el `redirect: 'manual'` de antes, no sigue redirecciones.
const pedirSinAgente = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const cabeceras = { ...headers };
  if (body !== undefined) cabeceras['content-length'] = Buffer.byteLength(body);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: cabeceras, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => ok({
      status: r.statusCode,
      headers: { get: (n) => { const v = r.headers[n.toLowerCase()]; return v === undefined ? null : [].concat(v).join(', '); } },
      text: async () => d,
      json: async () => JSON.parse(d),
    }));
  });
  req.on('error', mal);
  req.end(body);
});

const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-90: /pay/bank y /pay/mp cierran el IDOR — numérico 404 sin fuga de IBAN, token funciona', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { ensureChargeReceiptToken } = await import('../dist/lib/invoicing.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: misma forma que scrum74/scrum85 — mkFixture creaba el merchant y sus hijos
  // dos veces ANTES del try. El merchant lo crea ahora withMerchant; mkFixture solo monta
  // lo que cuelga de él, ya dentro de la red.
  //
  // ⚠️ `iban` es CRÍTICO aquí y va por merchant: la guarda de presencia de SCRUM-108
  // comprueba que el IBAN de A SÍ aparece en su propia página antes de afirmar que NO
  // aparece en la de B. Sin el campo, esa guarda cae — que es justo lo que debe hacer.
  const mkFixture = async (merchant, tag) => {
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: `Cliente QA-S90-${tag} ${stamp}`, phone: `3462${tag === 'A' ? 0 : 1}${stamp % 1000000}` },
    });
    const charge = await prisma.charge.create({
      data: { merchantId: merchant.id, customerId: customer.id, concept: `QA S90 ${tag}`, amount: '30.00', currency: 'EUR', method: 'bank', status: 'pending' },
    });
    return { merchant, customer, charge };
  };

  const datosMerchant = (tag, iban) => ({
    name: `QA S90 ${tag}`, email: `qa-s90-${tag}-${stamp}@test.local`, iban,
  });

  try {
    await withMerchant(prisma, datosMerchant('A', 'ES9121000418450200051332'), (mA) =>
      withMerchant(prisma, datosMerchant('B', 'ES7620770024003102575766'), async (mB) => {
    const A = await mkFixture(mA, 'A');
    const B = await mkFixture(mB, 'B');

    const tokenA = await ensureChargeReceiptToken(A.charge.id, prisma);
    const tokenB = await ensureChargeReceiptToken(B.charge.id, prisma);

    // ── /pay/bank: numérico 404 sin fuga del IBAN, token 200 con el IBAN correcto ──
    const rNumBank = await pedirSinAgente(`${base}/pay/bank/${A.charge.id}`);
    assert.equal(rNumBank.status, 404, `GET /pay/bank/<id numérico> debe ser 404 y fue ${rNumBank.status}`);
    const numBankBody = await rNumBank.text();
    assert.ok(!numBankBody.includes(A.merchant.iban), 'FUGA GRAVE: el 404 numérico expone el IBAN del merchant');

    const rBank = await pedirSinAgente(`${base}/pay/bank/${tokenA}`);
    assert.equal(rBank.status, 200, `GET /pay/bank/:token debe ser 200 y fue ${rBank.status}`);
    const bankBody = await rBank.text();
    assert.ok(bankBody.includes(A.merchant.iban), 'con el token correcto sí debe verse el propio IBAN');

    // token de OTRO cobro (B) no debe mostrar el IBAN de A
    const rBankB = await pedirSinAgente(`${base}/pay/bank/${tokenB}`);
    assert.equal(rBankB.status, 200);
    const bankBodyB = await rBankB.text();
    assert.ok(bankBodyB.includes(B.merchant.iban), 'token de B debe mostrar el IBAN de B');
    assert.ok(!bankBodyB.includes(A.merchant.iban), 'FUGA GRAVE: el token de B no debe mostrar el IBAN de A');

    // ── /pay/mp: numérico 404; token resuelve el cobro (503 sin MP configurado, nunca 404) ──
    const rNumMp = await pedirSinAgente(`${base}/pay/mp/${A.charge.id}`, { redirect: 'manual' });
    assert.equal(rNumMp.status, 404, `GET /pay/mp/<id numérico> debe ser 404 y fue ${rNumMp.status}`);

    const rMp = await pedirSinAgente(`${base}/pay/mp/${tokenA}`, { redirect: 'manual' });
    assert.notEqual(rMp.status, 404, `GET /pay/mp/:token debe RESOLVER el cobro (no 404) y fue ${rMp.status}`);

    // ── /pay/mp/:token/result: numérico ya no aplica (ruta por token); token 200 ──
    const rResult = await pedirSinAgente(`${base}/pay/mp/${tokenA}/result?status=approved`);
    assert.equal(rResult.status, 200, `GET /pay/mp/:token/result debe ser 200 y fue ${rResult.status}`);
    const resultBody = await rResult.text();
    assert.ok(resultBody.includes('30.00') || resultBody.includes('30,00'), 'la página de resultado debe mostrar el importe del cobro correcto');

    t.diagnostic('SCRUM-90: /pay/bank y /pay/mp — numérico 404 sin fuga de IBAN, token propio 200/resuelve correctamente, sin cruce entre cobros ✓');
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant, que
    // además borra los `event` (cuelgan de charge) antes que los charges.
    server.close();
    await prisma.$disconnect();
  }
});

// SCRUM-1599i (diseño B de SCRUM-1599) · la mutación que tumba el caso de base, CATALOGADA en SCRUM-1599i.
// Va aparte de `MUTACIONES_QUE_ME_TUMBAN` a propósito: el job del meta-guard corre SIN base, el caso sale
// SALTADO en su pasada limpia y eso es CIEGO (PUERTA 1a), no un veredicto. La ejecuta, con el banco PGlite,
// `docs/master/evidencias/SCRUM-1599/mutar-1599i.mjs` (forma de SCRUM-1390e). Cada campo, LITERAL.
export const MUTACIONES_CON_BASE = [
  { fichero: "src/modules/billing/app/routes/payBank.routes.ts", de: "    where: { receiptToken: token },", a: "    where: /^\\d+$/.test(token) ? { id: Number(token) } : { receiptToken: token },", cae: "SCRUM-90: /pay/bank y /pay/mp cierran el IDOR" },
];

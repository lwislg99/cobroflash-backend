// tests/scrum1787h-pago-con-lineas.test.mjs — SCRUM-1787h
//
// LA PÁGINA DE PAGO DE LA FACTURA ENSEÑA SUS LÍNEAS, COMO LA PÁGINA DEL PRESUPUESTO.
//
// Decisión del fundador en SCRUM-1787 c.22327 («1-Sí», pregunta 6 de c.22301): el enlace que
// recibe el cliente para pagar (`GET /pay/invoice/:token`) enseñaba el concepto del cobro, el
// número y el total, y ninguna línea. Ahora pinta la tabla de la factura EMITIDA (`Invoice.lines`,
// leída, sin tocar la emisión) con los rótulos que ya sirve la página del presupuesto
// (`quoteDecisionLanding.routes.ts`: «Concepto», «Cant.», «Importe», «Base imponible», «IVA (21%)»).
//
// Se ejecuta la RUTA REAL contra dobles en `require.cache` (patrón de `scrum893b-el-pie-de-stripe`).
// El doble de `invoice.findFirst` FILTRA por el `where` que recibe, como una base: así una factura
// de OTRO comercio con el mismo `chargeId` sólo se cuela si la ruta no pide el comercio.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_INVOICE = require_.resolve('./dist/modules/billing/app/routes/payInvoice.routes.js');

// Mutaciones que este fichero tiene que tumbar (catálogo del meta-guard, SCRUM-1731). Cada campo, LITERAL.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «Vuelve a no pintar las líneas»: la página queda como antes de este ticket.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: '    ${detalleHtml}',
    a: '',
    cae: 'SCRUM-1787h · una factura de tres líneas: la página enseña cada concepto, cantidad e importe, y cuadra con el total',
  },
  {
    // Sin el comercio en el `where`, la factura de OTRO comercio con el mismo cobro se cuela.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: 'where: { chargeId: id, merchantId: charge.merchantId },',
    a: 'where: { chargeId: id },',
    cae: 'SCRUM-1787h · control: las líneas de la factura de OTRO comercio no salen',
  },
];

const M = { id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
  country: 'ES', logoUrl: null, iban: 'ES9121000418450200051332', clabe: null, bizumPhone: null,
  whatsappPhone: null, connectStatus: 'none', stripeAccountId: null, flags: null };

// Tres líneas de EJEMPLO: 2 × 45 + 1 × 60 + 1 × 15 = 165,00 de base; 21 % → 34,65; total 199,65.
const TRES_LINEAS = [
  { concept: 'Mano de obra fontanería', qty: 2, price: 45, tax: 0.21 },
  { concept: 'Grifo monomando', qty: 1, price: 60, tax: 0.21 },
  { concept: 'Desplazamiento', qty: 1, price: 15, tax: 0.21 },
];

function facturaDe(extra = {}) {
  return { merchantId: 42, chargeId: 7, number: 'F-2026-0007', total: 199.65, lines: TRES_LINEAS, ...extra };
}

/** Pinta la página de pago del cobro 7 (comercio 42) contra la «base» `facturas` y devuelve el HTML. */
async function pagina(facturas, cobro = {}) {
  const ch = {
    id: 7, merchantId: 42, receiptToken: 'tok1787h', status: 'pending', amount: 199.65, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(), merchant: M, ...cobro,
  };
  const casa = (f, where) => Object.entries(where).every(([k, v]) => f[k] === v);
  delete require_.cache[R_INVOICE];
  require_.cache[R_PRISMA] = {
    id: R_PRISMA, filename: R_PRISMA, loaded: true,
    exports: { prisma: {
      charge: { findUnique: async () => ch },
      invoice: { findFirst: async ({ where }) => facturas.find((f) => casa(f, where)) ?? null },
    } },
  };
  const app = require_('express')();
  app.use('/pay', require_(R_INVOICE).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // `node:http` sin agente, no `fetch` (0xC0000409 con `--test-force-exit`: SCRUM-1204, cicatriz J2 27-oct).
  const { status, cuerpo } = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: '/pay/invoice/tok1787h', agent: false }, (res) => {
      const trozos = [];
      res.on('data', (t) => trozos.push(t));
      res.on('end', () => resolve({ status: res.statusCode, cuerpo: Buffer.concat(trozos).toString('utf8') }));
    }).on('error', reject);
  });
  await new Promise((r) => server.close(r));
  // SUELO: la página se pintó. Un 500 tampoco tiene líneas, y sería un verde sobre nada.
  assert.equal(status, 200, `🔴 CIEGO: la página devolvió HTTP ${status}.`);
  assert.ok(cuerpo.includes('Elige cómo pagar') && cuerpo.includes('Importe a pagar'),
    '🔴 CIEGO: la página no contiene ni el rótulo ni el importe, así que no se pintó.');
  return cuerpo;
}

/** Las filas de la tabla de líneas, como [concepto, cantidad, importe] en texto. */
function filas(html) {
  const tabla = /<table class="lines-table">([\s\S]*?)<\/table>/.exec(html);
  if (!tabla) return null;
  return [...tabla[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((tr) => [...tr[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((td) => td[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()))
    .filter((celdas) => celdas.length > 0);
}

/** Los importes de las filas del bloque de totales, en número. */
function totales(html) {
  return [...html.matchAll(/<div class="totals-row"><span>([^<]*)<\/span><span>([^<]*)<\/span><\/div>/g)]
    .map((m) => ({ rotulo: m[1], importe: Number(m[2].replace(/[^\d,-]/g, '').replace(',', '.')) }));
}

test('SCRUM-1787h · una factura de tres líneas: la página enseña cada concepto, cantidad e importe, y cuadra con el total', async () => {
  const html = await pagina([facturaDe()]);
  const tabla = filas(html);
  assert.ok(tabla, '🔴 La página de pago no lleva la tabla de líneas de la factura (decisión de SCRUM-1787 c.22327).');
  assert.match(html, /<thead><tr><th>Concepto<\/th><th>Cant\.<\/th><th>Importe<\/th><\/tr><\/thead>/,
    '🔴 La cabecera no es la de la página del presupuesto (`renderQuoteDetail` de quoteDecisionLanding.routes.ts).');
  assert.equal(tabla.length, 3, `🔴 Tenía que haber 3 filas y hay ${tabla.length}: ${JSON.stringify(tabla)}`);
  const esperadas = [['Mano de obra fontanería', '2', '90,00'], ['Grifo monomando', '1', '60,00'], ['Desplazamiento', '1', '15,00']];
  esperadas.forEach(([concepto, cant, importe], i) => {
    assert.ok(tabla[i][0].endsWith(concepto), `🔴 Fila ${i + 1}: concepto «${tabla[i][0]}», esperaba «${concepto}».`);
    assert.equal(tabla[i][1], cant, `🔴 Fila ${i + 1}: cantidad «${tabla[i][1]}».`);
    assert.ok(tabla[i][2].startsWith(importe), `🔴 Fila ${i + 1}: importe «${tabla[i][2]}», esperaba ${importe}.`);
  });
  const t = totales(html);
  assert.deepEqual(t.map((x) => x.rotulo), ['Base imponible', 'IVA (21%)'],
    `🔴 Los rótulos del desglose no son los de la página del presupuesto: ${JSON.stringify(t)}`);
  const suma = Math.round(t.reduce((s, x) => s + x.importe, 0) * 100) / 100;
  assert.equal(suma, 199.65, `🔴 Base + IVA = ${suma}, y la factura dice 199,65.`);
  // CSP (SCRUM-1723 / 1773): lo nuevo no trae `style=` ni manejadores en línea.
  assert.equal(/\sstyle=/.test(html), false, '🔴 La página lleva un `style=` en línea.');
  assert.equal(/\son[a-z]+=/.test(html), false, '🔴 La página lleva un manejador `on*=` en línea.');
});

test('SCRUM-1787h · control: las líneas de la factura de OTRO comercio no salen', async () => {
  // La «base» tiene PRIMERO una factura de otro comercio con el mismo cobro: sólo una consulta
  // que pide el comercio del cobro la salta.
  const ajena = facturaDe({ merchantId: 99, number: 'X-9', lines: [{ concept: 'LINEA-AJENA-1787h', qty: 1, price: 165, tax: 0.21 }] });
  const html = await pagina([ajena, facturaDe()]);
  assert.equal(html.includes('LINEA-AJENA-1787h'), false, '🔴 Sale una línea de la factura de OTRO comercio.');
  assert.equal(html.includes('X-9'), false, '🔴 Sale el número de la factura de OTRO comercio.');
  // POSITIVO: la propia sí sale (si no, el «no sale» de arriba sería un cero sobre nada).
  assert.ok(html.includes('Grifo monomando'), '🔴 CIEGO: la factura propia tampoco salió.');
});

test('SCRUM-1787h · control: una factura sin líneas sigue como hoy, sin tabla ni desglose', async () => {
  for (const lines of [null, []]) {
    const html = await pagina([facturaDe({ lines })]);
    assert.equal(html.includes('lines-table'), false, `🔴 lines=${JSON.stringify(lines)}: pinta una tabla vacía.`);
    assert.equal(html.includes('totals-row'), false, `🔴 lines=${JSON.stringify(lines)}: pinta un desglose sin líneas.`);
    assert.ok(html.includes('Factura F-2026-0007'), '🔴 CIEGO: la referencia de la factura no salió.');
  }
});

test('SCRUM-1787h · control: si las líneas no cuadran con lo que se cobra, no se pinta un desglose que lo contradiga', async () => {
  // Cobro de 100 € (p. ej. una parte) contra una factura de 199,65 €: la tabla sumaría otra cosa.
  const html = await pagina([facturaDe()], { amount: 100 });
  assert.ok(html.includes('100,00'), '🔴 CIEGO: no salió el importe del cobro.');
  assert.equal(html.includes('lines-table'), false, '🔴 La tabla de 199,65 € sale encima de un cobro de 100 €.');
  // Y una factura cuyo total no es la suma de sus líneas (suplidos, redondeos de otro motor): tampoco.
  const html2 = await pagina([facturaDe({ total: 250 })], { amount: 250 });
  assert.ok(html2.includes('250,00'), '🔴 CIEGO: no salió el importe del cobro.');
  assert.equal(html2.includes('lines-table'), false, '🔴 Las líneas suman 199,65 € y la factura dice 250 €.');
});

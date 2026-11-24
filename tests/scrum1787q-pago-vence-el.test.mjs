// tests/scrum1787q-pago-vence-el.test.mjs — SCRUM-1787q
//
// LA PÁGINA DE PAGO DE LA FACTURA DICE HASTA CUÁNDO SE PAGA.
//
// Decisión del fundador en SCRUM-1787 c.22325 ①: la factura lleva fecha de vencimiento, rótulo
// «Vence el». Desde 1787i la factura suelta la congela al emitir (`Invoice.dueDate`), y la ficha y el
// PDF ya la pintan. Aquí la enseña la página pública de pago (`GET /pay/invoice/:token`), junto al
// importe, SÓLO si consta, leída de la factura EMITIDA (como las líneas de 1787h), nunca del
// presupuesto. La fecha va con el formato de la otra página pública de la misma familia, el recibo
// («Pagado el …», `receipt.routes.ts`): es-ES, día y mes largo, en la zona del negocio.
//
// Se ejecuta la RUTA REAL contra dobles en `require.cache` (patrón de `scrum1787h-pago-con-lineas`).
// El doble de `invoice.findFirst` FILTRA por el `where` que recibe, como una base.
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
    // «Vuelve a no pintar el vencimiento»: la página queda como antes de este ticket.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: '      ${venceHtml}',
    a: '',
    cae: 'SCRUM-1787q · una factura con vencimiento: la página dice «Vence el» y la fecha, junto al importe',
  },
  {
    // SCRUM-1787y · «el día vuelve a llevar el cero a la izquierda» (5 → 05).
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: "timeZone: zonaDelMerchant(m), day: 'numeric', month: 'long'",
    a: "timeZone: zonaDelMerchant(m), day: '2-digit', month: 'long'",
    cae: 'SCRUM-1787y · un día de una cifra sale sin el cero: «Vence el 5 de diciembre de 2026»',
  },
];

const M = { id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
  country: 'ES', timezone: 'Europe/Madrid', logoUrl: null, iban: 'ES9121000418450200051332', clabe: null,
  bizumPhone: null, whatsappPhone: null, connectStatus: 'none', stripeAccountId: null, flags: null };

// Fecha de EJEMPLO a medianoche UTC: en Madrid es el mismo día; sin la zona del negocio, en una
// máquina al oeste de Greenwich saldría el día anterior.
const VENCE = new Date('2026-12-21T00:00:00.000Z');

function facturaDe(extra = {}) {
  return { merchantId: 42, chargeId: 7, number: 'F-2026-0007', total: 199.65, lines: null, dueDate: VENCE, ...extra };
}

/** Pinta `/pay/invoice/<token>` (cobro 7, comercio 42) contra la «base» `facturas`. */
async function pedir(facturas, token = 'tok1787q', merchant = M) {
  const ch = {
    id: 7, merchantId: 42, receiptToken: 'tok1787q', status: 'pending', amount: 199.65, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(), merchant,
  };
  const casa = (f, where) => Object.entries(where).every(([k, v]) => f[k] === v);
  delete require_.cache[R_INVOICE];
  require_.cache[R_PRISMA] = {
    id: R_PRISMA, filename: R_PRISMA, loaded: true,
    exports: { prisma: {
      charge: { findUnique: async ({ where }) => (where.receiptToken === ch.receiptToken ? ch : null) },
      invoice: { findFirst: async ({ where }) => facturas.find((f) => casa(f, where)) ?? null },
    } },
  };
  const app = require_('express')();
  app.use('/pay', require_(R_INVOICE).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // `node:http` sin agente, no `fetch` (0xC0000409 con `--test-force-exit`: SCRUM-1204, cicatriz J2 27-oct).
  const res = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: `/pay/invoice/${token}`, agent: false }, (r) => {
      const trozos = [];
      r.on('data', (t) => trozos.push(t));
      r.on('end', () => resolve({ status: r.statusCode, cuerpo: Buffer.concat(trozos).toString('utf8') }));
    }).on('error', reject);
  });
  await new Promise((r) => server.close(r));
  return res;
}

async function pagina(facturas, merchant) {
  const { status, cuerpo } = await pedir(facturas, 'tok1787q', merchant);
  // SUELO: la página se pintó. Un 500 tampoco lleva «Vence el», y sería un verde sobre nada.
  assert.equal(status, 200, `🔴 CIEGO: la página devolvió HTTP ${status}.`);
  assert.ok(cuerpo.includes('Importe a pagar') && cuerpo.includes('Elige cómo pagar'),
    '🔴 CIEGO: la página no contiene ni el rótulo ni el importe, así que no se pintó.');
  return cuerpo;
}

/** El bloque del importe: del rótulo «Importe a pagar» hasta «Elige cómo pagar». */
const bloqueDelImporte = (html) => html.slice(html.indexOf('Importe a pagar'), html.indexOf('Elige cómo pagar'));

test('SCRUM-1787q · una factura con vencimiento: la página dice «Vence el» y la fecha, junto al importe', async () => {
  const html = await pagina([facturaDe()]);
  const bloque = bloqueDelImporte(html);
  assert.match(bloque, /Vence el 21 de diciembre de 2026/,
    '🔴 La página de pago no dice «Vence el 21 de diciembre de 2026» junto al importe (SCRUM-1787 c.22325 ①).');
  // Una sola vez: no se repite en otro sitio de la página.
  assert.equal(html.split('Vence el').length - 1, 1, '🔴 «Vence el» sale más de una vez.');
  // CSP (SCRUM-1723 / 1773): lo nuevo no trae `style=` ni manejadores en línea.
  assert.equal(/\sstyle=/.test(html), false, '🔴 La página lleva un `style=` en línea.');
  assert.equal(/\son[a-z]+=/.test(html), false, '🔴 La página lleva un manejador `on*=` en línea.');
});

test('SCRUM-1787q · la fecha va en la zona del negocio, no en la de la máquina', async () => {
  // Medianoche UTC del 21 es aún el 20 en Nueva York: la página tiene que decir el día del negocio.
  const html = await pagina([facturaDe()], { ...M, timezone: 'America/New_York' });
  assert.match(bloqueDelImporte(html), /Vence el 20 de diciembre de 2026/,
    '🔴 La fecha no sale en la zona del negocio.');
});

test('SCRUM-1787y · un día de una cifra sale sin el cero: «Vence el 5 de diciembre de 2026»', async () => {
  // Decisión del fundador, SCRUM-1787 c.22431: el día sin el cero de delante. Los de dos cifras no cambian.
  const html = await pagina([facturaDe({ dueDate: new Date('2026-12-05T00:00:00.000Z') })]);
  const bloque = bloqueDelImporte(html);
  assert.match(bloque, /Vence el 5 de diciembre de 2026/, '🔴 La página no dice «Vence el 5 de diciembre de 2026».');
  assert.equal(bloque.includes('Vence el 05 '), false, '🔴 El día sale con el cero de delante («05»).');
  // Control: un día de dos cifras sigue igual.
  const doble = bloqueDelImporte(await pagina([facturaDe({ dueDate: new Date('2026-12-10T00:00:00.000Z') })]));
  assert.match(doble, /Vence el 10 de diciembre de 2026/, '🔴 Un día de dos cifras ha cambiado.');
});

test('SCRUM-1787q · control: sin vencimiento, la página no dice «Vence el»', async () => {
  for (const dueDate of [null, undefined]) {
    const html = await pagina([facturaDe({ dueDate })]);
    assert.equal(html.includes('Vence el'), false, `🔴 dueDate=${dueDate}: la página dice «Vence el» sin fecha.`);
    // POSITIVO: la factura sí se leyó (si no, el «no sale» sería un cero sobre nada).
    assert.ok(html.includes('Factura F-2026-0007'), '🔴 CIEGO: la referencia de la factura no salió.');
  }
  // Y un cobro sin factura tampoco.
  const sinFactura = await pagina([]);
  assert.equal(sinFactura.includes('Vence el'), false, '🔴 Un cobro sin factura dice «Vence el».');
});

test('SCRUM-1787q · control: el vencimiento de la factura de OTRO comercio no sale', async () => {
  // La «base» tiene PRIMERO una factura de otro comercio con el mismo cobro y vencimiento.
  const ajena = facturaDe({ merchantId: 99, number: 'X-9', dueDate: new Date('2027-03-15T00:00:00.000Z') });
  const html = await pagina([ajena, facturaDe({ dueDate: null })]);
  assert.equal(html.includes('Vence el'), false, '🔴 Sale el vencimiento de la factura de OTRO comercio.');
  assert.ok(html.includes('Factura F-2026-0007'), '🔴 CIEGO: la factura propia no salió.');
});

test('SCRUM-1787q · control: un token que no es de ningún cobro no enseña nada', async () => {
  const { status, cuerpo } = await pedir([facturaDe()], 'token-ajeno-1787q');
  assert.equal(status, 404, `🔴 Un token ajeno devolvió HTTP ${status}.`);
  assert.equal(cuerpo.includes('Vence el'), false, '🔴 Un token ajeno enseña «Vence el».');
  assert.equal(cuerpo.includes('F-2026-0007'), false, '🔴 Un token ajeno enseña el número de la factura.');
  assert.ok(cuerpo.length > 0, '🔴 CIEGO: el 404 no trajo cuerpo.');
});

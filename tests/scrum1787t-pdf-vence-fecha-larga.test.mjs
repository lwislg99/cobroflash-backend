// tests/scrum1787t-pdf-vence-fecha-larga.test.mjs — SCRUM-1787t
//
// QUÉ SE PIDE (decisión del fundador, SCRUM-1787 c.22390 punto 3: «unificar al formato largo en la
// página de pago y el PDF»; GO regla 40 para `generateInvoicePdf`: SCRUM-1787 c.22408): en el PDF de
// FACTURA, la línea `Vence el …` pasa a la fecha LARGA es-ES, con las MISMAS opciones que ya usa la
// página pública de pago (SCRUM-1787q, `payInvoice.routes.ts`) y en la zona del negocio. La `Fecha:`
// de expedición NO cambia (dd/mm/aaaa).
//
// CÓMO SE MIDE: sobre el TEXTO y las POSICIONES leídos del PDF fabricado (`lineasDePdf`), no sobre el
// fuente. En el PDF la `y` crece hacia ARRIBA y la `x` es donde EMPIEZA la línea.
//
// ① `dueDate` 2026-12-23 → `Vence el 23 de diciembre de 2026`, y la `Fecha:` sigue en dd/mm/aaaa
// ② el día es el de la ZONA del negocio (23:30Z del 23 ya es 24 en Madrid; sin zona, el 23)
// ③ el mes más largo (septiembre, día 30) cabe en UNA línea, alineada a la derecha y sin pisar la
//    columna del logo (x > M + 120, el ancho máximo del logo de la cabecera)
// ④ control: sin `dueDate`, no hay línea `Vence el`
// ⑤ la cadena es la de la página de pago (SCRUM-1787z, vuelve a ser ENTERA tras c.22436 ③): el PDF y la
//    página PINTADOS dicen el mismo «Vence el …» para un día de una cifra en el borde de la zona y para
//    uno de dos, y los dos fuentes llevan las mismas opciones, día `numeric` incluido
// ⑥ SCRUM-1787x (c.22431): un día de una cifra sale sin cero («Vence el 5 de diciembre de 2026»)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_PAGO = require_.resolve('./dist/modules/billing/app/routes/payInvoice.routes.js');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El vencimiento vuelve al formato de la «Fecha:» (dd/mm/aaaa).
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'doc.text(`Vence el ${fechaLargaDeVencimiento(params.dueDate)}`',
    a: 'doc.text(`Vence el ${dateStr(params.dueDate)}`',
    cae: 'SCRUM-1787t ① «Vence el» sale con la fecha larga y la «Fecha:» sigue en dd/mm/aaaa',
  },
  {
    // SCRUM-1787x: el día vuelve a llevar cero a la izquierda («05 de diciembre»).
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "zonaDelMerchant({ timezone: params.zona }), day: 'numeric', month: 'long'",
    a: "zonaDelMerchant({ timezone: params.zona }), day: '2-digit', month: 'long'",
    cae: 'SCRUM-1787x ⑥ un día de una cifra sale sin cero a la izquierda',
  },
  {
    // SCRUM-1787z: la OTRA superficie (la página de pago, J2) vuelve a `2-digit`; el PDF sigue en `numeric`.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: "zonaDelMerchant(m), day: 'numeric', month: 'long', year: 'numeric' })",
    a: "zonaDelMerchant(m), day: '2-digit', month: 'long', year: 'numeric' })",
    cae: 'SCRUM-1787t ⑤ las opciones son las de la página de pago (SCRUM-1787q)',
  },
];

const { generateInvoicePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');

const EMISOR = { name: 'Oficio Ficticio', legalName: 'Oficio Ficticio SL', taxId: 'B00000000', address: 'Calle Inventada 1, 28000 Ciudad Ficticia' };
const CLIENTE = { name: 'Cliente QA', email: 'cliente@ejemplo.invalid' };
const M = 50; // margen de `generateInvoicePdf`
const ANCHO_LOGO = 120; // `fit: [120, 44]` del logo de la cabecera

let serie = 0;
async function lineasDeFactura(extra = {}) {
  serie += 1;
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1787T${serie}`, invoiceId: 1787, merchantId: 1787,
    merchant: EMISOR, customer: CLIENTE, currency: 'EUR', total: '121.00', qrData: '', type: 'F1',
    createdAt: new Date('2026-11-05T10:00:00.000Z'),
    lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
    zona: 'Europe/Madrid', merchantCriterioCaja: null,
    ...extra,
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
    return r.lineas;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

function laLinea(lineas, trozo) {
  const l = lineas.filter((x) => x.texto.includes(trozo));
  assert.equal(l.length, 1, `🔴 «${trozo}» sale en ${l.length} líneas; esperaba 1`);
  return l[0];
}

test('SCRUM-1787t ① «Vence el» sale con la fecha larga y la «Fecha:» sigue en dd/mm/aaaa', async () => {
  // 12:00Z del 23-dic: el 23 en cualquier zona de España.
  const lineas = await lineasDeFactura({ dueDate: new Date('2026-12-23T12:00:00.000Z') });
  assert.equal(laLinea(lineas, 'Fecha:').texto.trim(), 'Fecha: 05/11/2026', '🔴 la «Fecha:» de expedición ha cambiado de formato');
  assert.equal(laLinea(lineas, 'Vence el').texto.trim(), 'Vence el 23 de diciembre de 2026', '🔴 el vencimiento no sale en formato largo');
});

test('SCRUM-1787t ② el día del vencimiento largo es el de la zona del negocio', async () => {
  const instante = new Date('2026-12-23T23:30:00.000Z'); // 00:30 del 24 en Madrid; 23 en UTC
  const madrid = await lineasDeFactura({ dueDate: instante, zona: 'Europe/Madrid' });
  assert.equal(laLinea(madrid, 'Vence el').texto.trim(), 'Vence el 24 de diciembre de 2026');
  const sinZona = await lineasDeFactura({ dueDate: instante, zona: null });
  assert.equal(laLinea(sinZona, 'Vence el').texto.trim(), 'Vence el 23 de diciembre de 2026');
});

test('SCRUM-1787t ③ el mes más largo cabe en una línea, a la derecha y sin pisar el logo', async () => {
  const lineas = await lineasDeFactura({ dueDate: new Date('2026-09-30T12:00:00.000Z') });
  const vence = laLinea(lineas, 'Vence el');
  assert.equal(vence.texto.trim(), 'Vence el 30 de septiembre de 2026', '🔴 la fecha larga se corta o parte en dos líneas');
  assert.ok(vence.x > M + ANCHO_LOGO, `🔴 «Vence el» empieza en x=${vence.x}: pisa la columna del logo (hasta ${M + ANCHO_LOGO})`);
  const fecha = laLinea(lineas, 'Fecha:');
  assert.ok(vence.x < fecha.x, `🔴 «Vence el» (x=${vence.x}) no es más largo que «Fecha:» (x=${fecha.x}): no está alineado a la derecha como ella`);
  assert.ok(vence.y < fecha.y, `🔴 «Vence el» (y=${vence.y}) no está debajo de «Fecha:» (y=${fecha.y})`);
  // Ninguna otra línea a la altura del vencimiento: nada lo pisa.
  const misma = lineas.filter((l) => l !== vence && Math.abs(l.y - vence.y) < 6);
  assert.deepEqual(misma.map((l) => l.texto), [], '🔴 hay texto a la misma altura que «Vence el»');
});

test('SCRUM-1787t ④ control: sin vencimiento no hay línea «Vence el»', async () => {
  const lineas = await lineasDeFactura({});
  assert.equal(laLinea(lineas, 'Fecha:').texto.trim(), 'Fecha: 05/11/2026'); // positivo: el lector ve la cabecera
  assert.equal(lineas.filter((l) => l.texto.includes('Vence el')).length, 0, '🔴 una factura sin vencimiento imprime «Vence el»');
});

// SCRUM-1787x (decisión del fundador, SCRUM-1787 c.22431: «4-Sí ok quita el 0»; dentro del GO c.22408):
// el día va SIN cero a la izquierda. ① (23), ② (24) y ③ (30) llevan días de dos cifras y no cambian; este
// caso es el único que lo distingue: con `day: '2-digit'` sale «05 de diciembre».
test('SCRUM-1787x ⑥ un día de una cifra sale sin cero a la izquierda', async () => {
  const lineas = await lineasDeFactura({ dueDate: new Date('2026-12-05T12:00:00.000Z') });
  assert.equal(laLinea(lineas, 'Fecha:').texto.trim(), 'Fecha: 05/11/2026', '🔴 la «Fecha:» de expedición ha cambiado de formato');
  assert.equal(laLinea(lineas, 'Vence el').texto.trim(), 'Vence el 5 de diciembre de 2026', '🔴 el día del vencimiento sale con cero a la izquierda');
});

// ⑤ ENTERO otra vez (SCRUM-1787z, c.22436 ③). 1787x lo había partido (c.22436 ①) porque el día cambiaba en
// dos carriles que no caben en un PR; con 1787x (PDF, J1) y 1787y (página, J2) dentro, vuelve a exigir que las
// DOS superficies digan lo mismo, día incluido. Por EFECTO: se pintan el PDF y la página con el mismo
// vencimiento y se comparan las dos líneas «Vence el …», con un día de una cifra (que además cae en el borde de
// la zona: 23:30Z del 4 es el 5 en Madrid) y uno de dos. Y por FUENTE: las dos llevan el literal ENTERO de las
// opciones, porque una opción que hoy no cambia la salida también es una divergencia esperando fecha.

// La página de pago `/pay/invoice/<token>` con una «base» en memoria (el mismo montaje que
// `tests/scrum1787q-pago-vence-el.test.mjs`, que es de J2: no se importa, porque registraría sus casos aquí).
const COMERCIO = { id: 42, name: 'Oficio Ficticio', legalName: 'Oficio Ficticio SL', email: 'oficio@ejemplo.invalid',
  country: 'ES', timezone: 'Europe/Madrid', logoUrl: null, iban: 'ES9121000418450200051332', clabe: null,
  bizumPhone: null, whatsappPhone: null, connectStatus: 'none', stripeAccountId: null, flags: null };

async function venceEnLaPagina(dueDate) {
  const cobro = { id: 7, merchantId: 42, receiptToken: 'tok1787z', status: 'pending', amount: 121, currency: 'EUR',
    concept: 'Mano de obra', payMethods: null, createdAt: new Date(), merchant: COMERCIO };
  const factura = { merchantId: 42, chargeId: 7, number: 'F-2026-QA1787Z', total: 121, lines: null, dueDate };
  const casa = (f, where) => Object.entries(where).every(([k, v]) => f[k] === v);
  const previo = require_.cache[R_PRISMA];
  delete require_.cache[R_PAGO];
  require_.cache[R_PRISMA] = {
    id: R_PRISMA, filename: R_PRISMA, loaded: true,
    exports: { prisma: {
      charge: { findUnique: async ({ where }) => (where.receiptToken === cobro.receiptToken ? cobro : null) },
      invoice: { findFirst: async ({ where }) => (casa(factura, where) ? factura : null) },
    } },
  };
  let server;
  try {
    const app = require_('express')();
    app.use('/pay', require_(R_PAGO).default);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    // `node:http` sin agente, no `fetch` (0xC0000409 con `--test-force-exit`: SCRUM-1204).
    const { status, cuerpo } = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: server.address().port, path: '/pay/invoice/tok1787z', agent: false }, (r) => {
        const trozos = [];
        r.on('data', (t) => trozos.push(t));
        r.on('end', () => resolve({ status: r.statusCode, cuerpo: Buffer.concat(trozos).toString('utf8') }));
      }).on('error', reject);
    });
    // SUELO: la página se pintó. Un 500 tampoco lleva «Vence el», y sería «no dice nada» sobre nada.
    assert.equal(status, 200, `🔴 CIEGO: la página de pago devolvió HTTP ${status}`);
    assert.ok(cuerpo.includes('Importe a pagar'), '🔴 CIEGO: la página de pago no se pintó');
    const vistas = cuerpo.match(/Vence el [^<]+/g) ?? [];
    assert.equal(vistas.length, 1, `🔴 la página de pago dice «Vence el» ${vistas.length} veces; esperaba 1`);
    return vistas[0].trim();
  } finally {
    if (server) await new Promise((r) => server.close(r));
    delete require_.cache[R_PAGO];
    if (previo) require_.cache[R_PRISMA] = previo; else delete require_.cache[R_PRISMA];
  }
}

test('SCRUM-1787t ⑤ las opciones son las de la página de pago (SCRUM-1787q)', async () => {
  // Por EFECTO. Lo esperado va escrito a mano, no derivado de una de las dos: si las dos cambiaran a la vez
  // («05» en las dos), compararlas sólo entre sí seguiría en verde.
  for (const [instante, esperado] of [
    ['2026-12-04T23:30:00.000Z', 'Vence el 5 de diciembre de 2026'], // una cifra, y el día lo da la zona
    ['2026-12-23T12:00:00.000Z', 'Vence el 23 de diciembre de 2026'], // dos cifras
  ]) {
    const dueDate = new Date(instante);
    const enElPdf = laLinea(await lineasDeFactura({ dueDate, zona: 'Europe/Madrid' }), 'Vence el').texto.trim();
    const enLaPagina = await venceEnLaPagina(dueDate);
    assert.equal(enLaPagina, enElPdf, `🔴 ${instante}: el PDF dice «${enElPdf}» y la página de pago «${enLaPagina}»: las dos superficies divergen`);
    assert.equal(enElPdf, esperado, `🔴 ${instante}: las dos superficies dicen «${enElPdf}»; esperaba «${esperado}»`);
  }
  // Por FUENTE: el literal ENTERO de las opciones, día incluido, en las dos (el argumento de la zona es distinto).
  const OPCIONES = "toLocaleDateString('es-ES', { timeZone: zonaDelMerchant(";
  const RESTO = "), day: 'numeric', month: 'long', year: 'numeric' })";
  const pago = fs.readFileSync(path.join(RAIZ, 'src/modules/billing/app/routes/payInvoice.routes.ts'), 'utf8');
  const pdf = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  for (const [nombre, src] of [['payInvoice.routes.ts', pago], ['pdf.service.ts', pdf]]) {
    const i = src.indexOf(OPCIONES);
    assert.ok(i >= 0, `🔴 ${nombre} ya no formatea con «${OPCIONES}»: las dos superficies pueden divergir`);
    const trozo = src.slice(i, i + 200);
    assert.ok(trozo.includes(RESTO), `🔴 ${nombre}: las opciones de la fecha larga no son «…${RESTO}»`);
  }
});

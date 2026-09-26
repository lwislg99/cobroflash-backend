// SCRUM-1116 · EL CORREO DEL LUNES NO PUEDE CERTIFICAR «NADA PENDIENTE» CON UNA GARANTÍA RETENIDA.
//
// El resumen semanal sumaba sólo `Invoice.status='pending'`. La retención de garantía (SCRUM-1107) vive
// en un `Charge` que normalmente ya está PAGADO —el cliente pagó 9.500 de 10.000 y 500 quedan
// retenidos—, así que para `Invoice` no había nada pendiente y el correo decía
// «✅ ¡No tienes facturas pendientes de cobro!». No callaba: afirmaba algo falso con un visto verde.
//
// Ahora, sin facturas pendientes y CON retención viva, dice el literal firmado
// (docs/microcopy/2026-09-25-SCRUM-1108-garantia-retenida.md, ranura `digestSinPendientesConGarantia`),
// SIN el ✅ —a propósito: el visto verde es lo que convierte la frase en un certificado—. Sin
// retención, el literal de siempre no cambia.
//
// Sin banco: `sendWeeklyDigests` DE VERDAD contra un mini-Prisma, leyendo el HTML que sale hacia el
// proveedor (`axios.post` sustituido: nada sale de la máquina). La retención la calcula
// `garantiasRetenidasPorCliente` de J2 (SCRUM-1108), que aquí NO se dobla: se dobla la tabla.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { constaAprobado } from './_microcopy-aprobada.mjs';

// ANTES de importar dist: una clave inventada para que el correo vaya por `axios.post`, que es donde
// se lee. El POST está sustituido: no hay envío.
process.env.RESEND_API_KEY = 're_test_1116_no_sale';
delete process.env.INVOICING_ES_ENABLED; // ES sin facturación → el bloque de SCRUM-974 no consulta nada

const require_ = createRequire(import.meta.url);
const { prisma } = require_('../dist/core/db/prisma.js');
const { sendWeeklyDigests } = require_('../dist/modules/messaging/domain/weeklyDigest.service.js');
const axios = require_('axios'); // la instancia CJS: la MISMA que carga dist

const MERCHANT = {
  id: 1116, name: 'QA 1116', email: 'qa-1116@test.local', defaultCurrency: 'EUR', country: 'ES', flags: {},
};
const LITERAL_DE_SIEMPRE = '✅ ¡No tienes facturas pendientes de cobro!';

/** Un cobro PAGADO con 500 € retenidos, sin cobrar. */
const cobro = (o) => ({
  customerId: 7, status: 'paid',
  retencionGarantiaPorcentaje: 5, retencionGarantiaImporte: 500,
  retencionGarantiaLiberacion: new Date('2027-03-12T00:00:00Z'), retencionGarantiaCobrada: null, ...o,
});

/**
 * Corre el resumen de un merchant con `cobros` en la tabla de cobros y `pendiente` € en facturas
 * pendientes, y devuelve el HTML que habría salido.
 */
async function digest({ cobros = [], pendiente = 0, timezone = 'Europe/Madrid' } = {}) {
  const nombres = ['merchant', 'invoice', 'quote', 'customer', 'charge', 'emailMessage'];
  const orig = Object.fromEntries(nombres.map((n) => [n, prisma[n]]));
  const postOriginal = axios.post;
  const correos = [];
  prisma.merchant = {
    findMany: async () => [MERCHANT],
    findUnique: async () => ({ timezone }),
  };
  prisma.invoice = {
    aggregate: async ({ where }) => (where.status === 'pending' && pendiente > 0
      ? { _sum: { total: pendiente }, _count: { id: 1 } }
      : { _sum: { total: null }, _count: { id: 0 } }),
    count: async () => 0,
  };
  prisma.quote = { count: async () => 0 };
  prisma.customer = { count: async () => 0 };
  // Se respeta el `where` que importa (pagados, sin cobrar, de este merchant): así lo que se mide es
  // la consulta de verdad de J2, no un doble que devuelve lo que le pongan.
  prisma.charge = {
    findMany: async ({ where }) => cobros.filter((c) => where.merchantId === MERCHANT.id
      && c.status === where.status && c.retencionGarantiaCobrada === null),
  };
  prisma.emailMessage = { create: async () => ({ id: 1 }) };
  axios.post = async (url, body) => {
    assert.equal(url, 'https://api.resend.com/emails', `SUELO: el correo salía por otro sitio: ${url}`);
    correos.push(body.html);
    return { data: { id: 're_1116' } };
  };
  try {
    const parte = await sendWeeklyDigests();
    assert.equal(parte.entregados, 1, `SUELO: el resumen no salió (${JSON.stringify(parte)})`);
  } finally {
    Object.assign(prisma, orig);
    axios.post = postOriginal;
  }
  assert.equal(correos.length, 1, 'SUELO: no se capturó el resumen');
  assert.ok(correos[0].includes('Resumen semanal'), 'SUELO: lo capturado no es el resumen semanal');
  return correos[0];
}

/** La frase firmada tal como tiene que salir. */
const firmada = (importe, fecha) =>
  `No tienes facturas pendientes de cobro. Tienes ${importe} en garantía retenida, liberable desde el ${fecha}.`;

test('SCRUM-1116 · 🔴 con 500 € retenidos y nada pendiente, el lunes NO dice «✅ ¡No tienes facturas pendientes de cobro!»', async () => {
  const html = await digest({ cobros: [cobro()] });
  assert.ok(!html.includes(LITERAL_DE_SIEMPRE),
    '🔴 el resumen certifica con un ✅ que no le deben nada a quien tiene 500 € retenidos');
  assert.ok(!html.includes('✅ ¡No tienes') && !html.includes('✅ No tienes'),
    '🔴 el ✅ se quitó A PROPÓSITO del caso con retención (registro de SCRUM-1108)');
  assert.ok(html.includes(firmada('500,00 EUR', '12/03/2027')),
    '🔴 falta el literal firmado con el importe y el día de liberación');
});

test('SCRUM-1116 · control: sin retención, el literal de siempre NO cambia', async () => {
  const html = await digest({ cobros: [] });
  assert.ok(html.includes(LITERAL_DE_SIEMPRE), '🔴 CIEGO: el instrumento no ve el literal de siempre donde tiene que estar');
  assert.ok(!html.includes('garantía retenida'));
});

test('SCRUM-1116 · con la retención ya cobrada, el aviso se apaga solo y vuelve el literal de siempre', async () => {
  const html = await digest({ cobros: [cobro({ retencionGarantiaCobrada: new Date('2027-03-20T10:00:00Z') })] });
  assert.ok(html.includes(LITERAL_DE_SIEMPRE));
  assert.ok(!html.includes('garantía retenida'), '🔴 se avisa de una garantía que ya se cobró');
});

test('SCRUM-1116 · con facturas pendientes, el bloque «Pendiente de cobro» no cambia', async () => {
  const html = await digest({ cobros: [cobro()], pendiente: 1200 });
  assert.ok(html.includes('⏳ Pendiente de cobro'));
  assert.ok(!html.includes(LITERAL_DE_SIEMPRE));
  assert.ok(!html.includes('No tienes facturas pendientes'), '🔴 con facturas pendientes no puede decir que no las hay');
});

test('SCRUM-1116 · el día de liberación es el del MERCHANT, no el del proceso (SCRUM-735)', async () => {
  // 23:30Z del 11 es ya el 12 en Madrid.
  const c = [cobro({ retencionGarantiaLiberacion: new Date('2027-03-11T23:30:00Z') })];
  assert.ok((await digest({ cobros: c, timezone: 'Europe/Madrid' })).includes(firmada('500,00 EUR', '12/03/2027')));
  assert.ok((await digest({ cobros: c, timezone: 'UTC' })).includes(firmada('500,00 EUR', '11/03/2027')),
    'control: en UTC es el 11');
});

test('SCRUM-1116 · lo del mismo día se suma, aunque sea de clientes distintos', async () => {
  const html = await digest({ cobros: [cobro(), cobro({ customerId: 8, retencionGarantiaImporte: 300 })] });
  assert.ok(html.includes(firmada('800,00 EUR', '12/03/2027')));
});

// Dos días de liberación: 300 € en 2028 (cliente 8) y 500 € en 2027 (cliente 7), a propósito en ese
// orden en la tabla, para que el orden de salida sea el del código y no el de la entrada.
const DOS_DIAS = [
  cobro({ customerId: 8, retencionGarantiaImporte: 300, retencionGarantiaLiberacion: new Date('2028-01-20T12:00:00Z') }),
  cobro(),
];

test('SCRUM-1116 · 🔴 con dos días de liberación salen LAS DOS líneas, la más temprana primero', async () => {
  const html = await digest({ cobros: DOS_DIAS });
  const primera = firmada('500,00 EUR', '12/03/2027');
  const extra = 'Tienes 300,00 EUR en garantía retenida, liberable desde el 20/01/2028.';
  assert.ok(html.includes(primera), '🔴 falta la línea del primer día, con la frase de cabeza');
  assert.ok(html.includes(extra), '🔴 con dos retenciones sólo sale una: se esconde dinero');
  assert.ok(html.indexOf(primera) < html.indexOf(extra), '🔴 lo que se puede reclamar antes va primero');
  assert.equal(html.split('No tienes facturas pendientes de cobro.').length - 1, 1, 'la frase de cabeza, UNA vez');
  assert.ok(!html.includes('800,00'), '🔴 el total con una sola fecha es lo que se descartó (opción B)');
});

/** Las frases de garantía que pinta el resumen, cada una en su elemento. */
const frasesDeGarantia = (html) => [...html.matchAll(/>\s*((?:No tienes facturas pendientes de cobro\. )?Tienes [^<]*garantía retenida[^<]*?)\s*</g)]
  .map((m) => m[1]);

test('SCRUM-1116 · 🔴 cada línea que se pinta es un literal FIRMADO (constaAprobado), no uno parecido', async () => {
  const frases = frasesDeGarantia(await digest({ cobros: DOS_DIAS }));
  assert.equal(frases.length, 2, `🔴 CIEGO: se esperaban dos frases que comprobar y hay ${frases.length}`);
  for (const f of frases) {
    const plantilla = f.replace(/\d[\d.]*,\d{2} EUR/, '{importe}').replace(/\b\d{2}\/\d{2}\/\d{4}\b/, '{dd/mm/aaaa}');
    assert.notDeepEqual(constaAprobado(plantilla), [], `🔴 «${plantilla}» no consta aprobado en docs/microcopy/ (regla 39)`);
  }
  // Control negativo: el extractor no aprueba cualquier cosa que se le parezca.
  assert.deepEqual(constaAprobado('✅ No tienes facturas pendientes de cobro. Tienes {importe} en garantía retenida, liberable desde el {dd/mm/aaaa}.'), [],
    '🔴 CIEGO: la versión CON ✅ consta como aprobada; el control no distingue');
});

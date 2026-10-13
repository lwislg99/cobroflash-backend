// SCRUM-1288d · Los dos correos al profesional que quedaban dicen el dinero en es-ES.
//
// «💰 Pago recibido» decía «1234.5 EUR» (asunto y cuerpo) y «presupuesto aceptado» decía
// «1234.50 EUR»: a los dos les llega el importe YA HECHO TEXTO —`psp.routes.ts` pasa `.toString()`
// y `whatsappIncoming.routes.ts` pasa `toFixed(2)`— y la plantilla lo pegaba a la moneda.
//
// El arreglo NO toca a quien llama: `formatMoneyEs` acepta texto (y el `Decimal` de Prisma), así
// que el formato se pone donde se escribe la moneda. Por eso este test les pasa a las dos funciones
// EXACTAMENTE lo que hoy les pasan sus llamadores: un texto, no un número.
//
// Se lee el correo QUE SALE: las dos funciones reales, de `dist/`, con sólo el emisor doblado
// (`enviarCorreo`). ⛔ Ni un byte de red, ni una base.
//
// Lo que NO mide: el camino entero por la ruta (cobro confirmado → correo; aceptar por WhatsApp →
// correo), que pide base. Que la plantilla no vuelva a pegar el valor a la moneda lo ata el
// trinquete de `tests/scrum1452-gemelo-crudo.test.mjs` («ninguna identidad RETIRADA ha vuelto»).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const enviados = [];
{
  const f = rutaDe('dist/integrations/enviarCorreo.js');
  requiere.cache[f] = {
    id: f, filename: f, loaded: true,
    exports: {
      enviarCorreo: async (a) => { enviados.push(a); return { enviado: true, proveedor: 'doble' }; },
      resultadoSinDestino: () => ({ enviado: false, motivo: 'sin_destino' }),
    },
  };
  delete requiere.cache[rutaDe('dist/modules/messaging/domain/merchantNotifications.js')];
}
const { sendMerchantPaymentEmail, sendMerchantQuoteAcceptedEmail } = requiere(path.join(RAIZ, 'dist/modules/messaging/domain/merchantNotifications.js'));

// `amount` es lo que da `(body.amount ?? updated.amount).toString()`: «1234.5», sin el cero.
async function correoDePago(amount, currency = 'EUR') {
  enviados.length = 0;
  await sendMerchantPaymentEmail({
    merchantId: 7, merchantEmail: 'pro@example.invalid', merchantName: 'Reformas QA',
    customerName: 'Cliente QA', amount, currency, invoiceNumber: null,
  });
  assert.equal(enviados.length, 1, '🔴 CIEGO: el doble no ha visto el correo de pago, así que no se mide nada');
  return enviados[0];
}

// `total` es lo que da `Number(quote.total).toFixed(2)`: «1234.50».
async function correoDeAceptado(total, currency = 'EUR') {
  enviados.length = 0;
  await sendMerchantQuoteAcceptedEmail({
    merchantId: 7, merchantEmail: 'pro@example.invalid', merchantName: 'Reformas QA',
    customerName: 'Cliente QA', quoteId: 41, total, currency, modoEmision: 'fiscal',
  });
  assert.equal(enviados.length, 1, '🔴 CIEGO: el doble no ha visto el correo de aceptado, así que no se mide nada');
  return enviados[0];
}

// La fila del correo que lleva esa etiqueta, sin etiquetas HTML: lo que lee el profesional.
function filaDe(html, etiqueta) {
  const m = new RegExp(`${etiqueta}</span>\\s*<span[^>]*>([^<]*)</span>`).exec(html);
  assert.ok(m, `🔴 CIEGO: el correo ya no lleva su fila «${etiqueta}»; este test no sabe dónde mirar`);
  return m[1];
}

function enEsEs(texto, esperado, donde) {
  assert.match(texto, esperado, `🔴 ${donde} no está en es-ES: «${texto}»`);
  assert.ok(!/\d{4}/.test(texto), `🔴 ${donde}: sigue saliendo el número en crudo, sin punto de miles: «${texto}»`);
  assert.ok(!texto.includes('EUR'), `🔴 ${donde}: sigue saliendo el código de la moneda en vez del símbolo: «${texto}»`);
}

test('SCRUM-1288d · 🔴 «Pago recibido»: un importe con miles sale «1.234,50 €» en el CUERPO, no «1234.5 EUR»', async () => {
  const { html } = await correoDePago('1234.5');
  enEsEs(filaDe(html, 'Importe'), /^1\.234,50\s€$/, 'el importe del correo de pago');
});

test('SCRUM-1288d · 🔴 «Pago recibido»: y también en el ASUNTO, que es lo que se lee en la bandeja', async () => {
  const { subject } = await correoDePago('1234.5');
  enEsEs(subject, /^💰 Pago recibido: 1\.234,50\s€ de Cliente QA$/, 'el asunto del correo de pago');
});

test('SCRUM-1288d · 🔴 «Presupuesto aceptado»: un total con miles sale «1.234,50 €», no «1234.50 EUR»', async () => {
  const { html } = await correoDeAceptado('1234.50');
  enEsEs(filaDe(html, 'Total'), /^1\.234,50\s€$/, 'el total del correo de aceptado');
});

test('SCRUM-1288d · CONTROL: dos importes distintos salen distintos en los dos correos (el formateador no devuelve siempre lo mismo)', async () => {
  const a = filaDe((await correoDePago('99')).html, 'Importe');
  const b = filaDe((await correoDePago('1500')).html, 'Importe');
  assert.match(a, /^99,00\s€$/, `«${a}»`);
  assert.match(b, /^1\.500,00\s€$/, `«${b}»`);
  const c = filaDe((await correoDeAceptado('99.00')).html, 'Total');
  const d = filaDe((await correoDeAceptado('1500.00')).html, 'Total');
  assert.match(c, /^99,00\s€$/, `«${c}»`);
  assert.match(d, /^1\.500,00\s€$/, `«${d}»`);
});

test('SCRUM-1288d · la moneda la decide el cobro o el presupuesto: fuera del euro no se pinta «€»', async () => {
  for (const texto of [
    filaDe((await correoDePago('1500', 'MXN')).html, 'Importe'),
    filaDe((await correoDeAceptado('1500.00', 'MXN')).html, 'Total'),
  ]) {
    assert.ok(texto.includes('1.500,00'), `🔴 fuera del euro se pierde el formato del número: «${texto}»`);
    assert.ok(!texto.includes('€'), `🔴 un importe en MXN sale en euros: «${texto}»`);
  }
});

test('SCRUM-1288d · el resto de los dos correos no cambia: asunto del aceptado, cliente y frases siguen donde estaban', async () => {
  // Lo que se lee, sin etiquetas y con los espacios plegados.
  const leido = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const pago = await correoDePago('1234.5');
  assert.ok(leido(pago.html).includes('Cliente QA ha realizado un pago.'), '🔴 el correo de pago ha perdido su frase');
  assert.ok(leido(pago.html).includes('Este email fue enviado a Reformas QA.'), '🔴 el correo de pago ha perdido su pie');
  const aceptado = await correoDeAceptado('1234.50');
  assert.equal(aceptado.subject, '✅ Presupuesto #41 aceptado por Cliente QA');
  assert.ok(leido(aceptado.html).includes('Cliente QA ha aceptado el presupuesto #41 .'), '🔴 el correo de aceptado ha perdido su frase');
  assert.ok(leido(aceptado.html).includes('El cliente ha aceptado el presupuesto. Ya puedes emitir la factura.'), '🔴 el correo de aceptado ha perdido su frase final');
});

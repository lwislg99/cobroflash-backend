// tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs — SCRUM-1436 (hallazgo 2, la parte de J1)
//
// 🔴 EL RECORDATORIO MANUAL LLAMABA «FACTURA» A UN JUSTIFICANTE.
//
// `POST /admin/invoices/:id/send-reminder`, cuando la factura no tiene cobro, manda un texto libre
// al cliente. Ese texto llevaba «el pago de la factura *N*» escrito a mano, también para un `J-…`,
// que no es una factura (reglas 24 y 26). Los otros dos emisores del mismo documento ya eligen la
// palabra POR EL NÚMERO, con `isReceiptNumber`: el envío (`invoiceWhatsApp.service.ts`) y el
// recordatorio automático (`invoiceReminder.service.ts`).
//
// El arreglo NO trae un criterio nuevo: usa ese mismo. Y la forma es la firmada en SCRUM-1436
// (comentario 18287): el artículo va dentro de la etiqueta, «de la factura» / «del justificante».
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// El handler REAL de `dist/`, con la base doblada (`_envio-doblado.mjs`) y el WhatsApp por el
// dry-run de la casa: pasa todos los guards y deja el mensaje en un buzón. No sale nada a la red.
// ⚠️ Lo que NO mide: la plantilla `payment_request_es` (el camino con cobro). Su texto es de Meta
// y aquí sólo se comprueba que ese camino sigue yendo por plantilla.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTA = '../dist/modules/system/app/routes/invoicesAdmin.routes.js';
const NUMERO = '../dist/modules/invoicing/domain/invoiceNumber.service.js';
const DINERO = '../dist/core/utils/utils.js';

function documento(numero, extra = {}) {
  return {
    id: 7, merchantId: MERCHANT, customerId: CLIENTE, number: numero, status: 'pending', total: '419.87', currency: 'EUR',
    chargeId: null, reminder7SentAt: null, reminder14SentAt: null,
    merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null, country: 'ES' },
    customer: { id: CLIENTE, name: 'Cliente de prueba', phone: '34000000001', mobile: null },
    ...extra,
  };
}

/** Pulsa «recordar pago» sobre `doc` por la ruta real y devuelve la respuesta y lo que salió. */
async function recordar(doc, respuestas = {}) {
  inyectarBase({ 'invoice.findFirst': () => doc, ...respuestas }, [RUTA]);
  const router = moduloDeDist(RUTA).default;
  assert.ok(router && Array.isArray(router.stack), '🔴 CIEGO: no encuentro el router de facturas');
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/send-reminder' && l.route.methods.post);
  assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/send-reminder');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: '7' }, body: {}, headers: {} }), res);
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
  return { ...r, buzon };
}

/** El texto libre que recibió el cliente; falla si no salió exactamente uno. */
async function textoDelRecordatorio(numero) {
  const r = await recordar(documento(numero));
  assert.equal(r.buzon.length, 1, `🔴 CIEGO: con ${numero} no ha salido exactamente un mensaje (${r.buzon.length})`);
  assert.equal(r.buzon[0].kind, 'text', `🔴 CIEGO: con ${numero} no ha salido un texto libre sino «${r.buzon[0].kind}»`);
  return r.buzon[0].text;
}

test('SCRUM-1436b · SUELO: sin cobro, el recordatorio sale como texto libre y la ruta dice que salió', async () => {
  const r = await recordar(documento('F260007'));
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, true);
  assert.equal(r.cuerpo.via, 'text');
  assert.equal(r.buzon.length, 1, '🔴 CIEGO: el mensaje no ha llegado al buzón de pruebas');
  assert.equal(r.buzon[0].to, '34000000001');
});

test('SCRUM-1436b · 🔴 a un justificante `J-…` el recordatorio lo llama «justificante», no «factura»', async () => {
  const texto = await textoDelRecordatorio('J-2026-0007');
  assert.ok(texto.includes('el pago del justificante *J-2026-0007*'),
    `🔴 el cliente lee: «${texto}»`);
  assert.equal(/factura/i.test(texto), false,
    `🔴 el recordatorio de un justificante dice «factura»: «${texto}»`);
});

test('SCRUM-1436b · ✅ una factura de verdad sigue diciendo «factura», con la frase de siempre', async () => {
  const texto = await textoDelRecordatorio('F260007');
  // La frase ENTERA, letra a letra: para una factura este cambio no mueve nada. El importe lo da
  // el helper de la casa porque lleva un espacio de no separación (U+00A0), que escrito aquí no
  // se distinguiría de un espacio normal.
  const { formatMoneyEs } = moduloDeDist(DINERO);
  const importe = formatMoneyEs('419.87', 'EUR');
  assert.ok(importe.startsWith('419,87') && importe.endsWith('€'), `🔴 CIEGO: el helper del dinero ya no da la forma de la casa: «${importe}»`);
  assert.equal(texto,
    `Hola Cliente de prueba 👋, te recordamos que tienes pendiente el pago de la factura *F260007* por *${importe}* de parte de *Taller de prueba*.\n\n¡Gracias!`);
  assert.equal(/justificante/i.test(texto), false, `🔴 el recordatorio de una factura dice «justificante»: «${texto}»`);
});

test('SCRUM-1436b · la palabra la decide el MISMO criterio que en los otros dos emisores (`isReceiptNumber`)', async () => {
  const { isReceiptNumber } = moduloDeDist(NUMERO);
  assert.equal(typeof isReceiptNumber, 'function', '🔴 CIEGO: no encuentro isReceiptNumber: si se ha movido, se reapunta el test');
  // Los bordes salen del criterio, no de este fichero: lo que él llame justificante, lo es aquí.
  const numeros = ['J-2026-0007', 'J-1', 'F260007', 'CF-2026-0003', 'R260001', 'j-2026-0007', 'FJ-1'];
  const vistos = { justificante: 0, factura: 0 };
  for (const numero of numeros) {
    const texto = await textoDelRecordatorio(numero);
    const dice = texto.includes(`del justificante *${numero}*`) ? 'justificante'
      : texto.includes(`de la factura *${numero}*`) ? 'factura' : null;
    assert.ok(dice, `🔴 con ${numero} el recordatorio no nombra el documento de ninguna de las dos formas: «${texto}»`);
    assert.equal(dice, isReceiptNumber(numero) ? 'justificante' : 'factura',
      `🔴 con ${numero} el recordatorio dice «${dice}» y el criterio común dice lo contrario`);
    vistos[dice] += 1;
  }
  // Población: si el criterio dejara de distinguir, este caso compararía una sola clase.
  assert.ok(vistos.justificante >= 2 && vistos.factura >= 2,
    `🔴 CIEGO: la muestra ya no tiene de las dos clases (${JSON.stringify(vistos)} sobre ${numeros.length})`);
});

test('SCRUM-1436b · CONTROL: con cobro, el recordatorio sigue yendo por la plantilla, no por el texto', async () => {
  const r = await recordar(documento('J-2026-0007', { chargeId: 90 }),
    { 'charge.findUnique': () => ({ id: 90, receiptToken: 'tok-1436-de-laboratorio' }) });
  assert.equal(r.cuerpo.sent, true);
  assert.equal(r.cuerpo.via, 'template');
  assert.equal(r.buzon.length, 1);
  assert.equal(r.buzon[0].kind, 'template');
  assert.equal(r.buzon[0].templateName, 'payment_request_es');
});

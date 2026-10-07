// tests/scrum1436-disputa-firmado-solo-con-firma.test.mjs — SCRUM-1436 (hallazgo 1, la condición)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «TRANQUILO: TIENES EL PRESUPUESTO FIRMADO» SE MANDABA SIEMPRE
//
// Cuando un banco le reclama un cobro al profesional, `handleStripeDispute` le manda un WhatsApp.
// Hasta este ticket el texto afirmaba que tenía el presupuesto firmado sin mirar si había
// presupuesto ni si había firma: sólo miraba si había factura, y eso para poner su número. El
// profesional lo lee en el momento en que puede perder dinero: si se fía y no busca la prueba,
// responde al banco creyendo que tiene algo que quizá no existe.
//
// QUÉ SE COMPRUEBA
//   · la frase sale SÓLO si la factura del cobro viene de un presupuesto de ESE negocio cuya firma
//     tiene trazo. Es lo que el «Paquete de disputa» de esa factura va a enseñar (lee
//     `invoice.quote` y pinta `quote.signatureUrl`), así que el aviso y el paquete dicen lo mismo;
//   · en cualquier otro caso el aviso sale IGUAL que antes menos esa oración. No hay texto nuevo:
//     qué decirle al profesional cuando no hay firma necesita firma del fundador (regla 39);
//   · con presupuesto firmado, el aviso es byte a byte el de antes.
//
// EL DOBLE: el de `_envio-doblado.mjs` (base por `require.cache`, Meta en dry-run con buzón).
// `handleStripeDispute` entero es código de producción. El doble de `quote.findFirst` EVALÚA el
// `where` (id y negocio): sin eso, quitar el filtro de negocio de la consulta no cambiaría nada.
//
// ⛔ Ni una clave. Ni un byte hacia Meta. Ninguna base real.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { casosEscritos } from './_casos-escritos.mjs'; // SCRUM-1415

const FIRMAS = JSON.parse(fs.readFileSync(new URL('./fixtures/scrum892-firmas.json', import.meta.url), 'utf8'));
const FIRMA_CON_TRAZO = FIRMAS['firma-390px-dpr1'];
const LIENZO_VACIO = FIRMAS['vacia-304x150'];

const TELEFONO_PRO = '+34600000042'; // rango imposible de laboratorio (SCRUM-262)
const INTENT = 'pi_1TestDisputa1436';
const COBRO = 900;
const PRESUPUESTO = 77;
const OTRO_NEGOCIO = MERCHANT + 1;
const FACTURA = 'F-2026-001';
const CLIENTE = 'Cliente de laboratorio';
const FRASE = 'Tranquilo: tienes el presupuesto FIRMADO.';

const { formatMoneyEs } = moduloDeDist('../dist/core/utils/utils.js');
const IMPORTE = formatMoneyEs(120, 'EUR');

/** El aviso de ANTES de este ticket, entero. El caso con firma tiene que seguir saliendo así. */
const avisoDeSiempre = (numero) =>
  `⚠️ El banco de ${CLIENTE} ha abierto una disputa por ${IMPORTE}.\n`
  + `${FRASE} Entra en la factura${numero ? ` ${numero}` : ''} y pulsa "Paquete de disputa" — `
  + 'sale todo listo para responder al banco.';
/** El mismo, sin la oración. No lleva ni una palabra que no estuviera ya. */
const avisoSinLaFrase = (numero) => avisoDeSiempre(numero).replace(`${FRASE} `, '');

/**
 * Manda UNA disputa por el camino real y devuelve los textos que salieron hacia el profesional.
 *
 * `factura` es lo que devuelve la lectura de la factura del cobro (`null` = el cobro no tiene).
 * `presupuestos` son las filas de la tabla de presupuestos: la consulta sólo ve las que casan con
 * el `where` que el código le pase.
 */
async function avisoDe({ factura, presupuestos = [], lecturaRota = false }, etiqueta) {
  const consultas = [];
  inyectarBase({
    'charge.findFirst': (args) => (args?.where?.intentId !== INTENT ? null : {
      id: COBRO,
      merchantId: MERCHANT,
      customerId: 55,
      amount: '120.00',
      currency: 'EUR',
      merchant: { id: MERCHANT, name: 'Taller de prueba', whatsappPhone: TELEFONO_PRO },
      customer: { id: 55, name: CLIENTE },
    }),
    'invoice.findFirst': () => factura,
    'quote.findFirst': (args) => {
      consultas.push(args);
      if (lecturaRota) throw new Error('la base no contesta (laboratorio)');
      const w = args?.where ?? {};
      return presupuestos.find((p) => p.id === w.id && (w.merchantId === undefined || p.merchantId === w.merchantId)) ?? null;
    },
  }, ['../dist/modules/payments/disputes.service.js',
      '../dist/modules/system/customerEvents.service.js',
      '../dist/integrations/whatsappNotifications.js']);

  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    const { handleStripeDispute } = moduloDeDist('../dist/modules/payments/disputes.service.js');
    assert.equal(typeof handleStripeDispute, 'function', '🔴 CIEGO: no se encuentra `handleStripeDispute` en `dist/`.');
    await handleStripeDispute(
      { id: `dp_${etiqueta}`, payment_intent: INTENT, amount: 12000, currency: 'eur', reason: 'fraudulent' },
      `evt_${etiqueta}`,
    );
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
  const textos = buzon.filter((e) => e.kind === 'text').map((e) => e.text);
  // SUELO de cada caso: «no lleva la frase» sobre un buzón vacío no mediría nada.
  assert.equal(textos.length, 1,
    `🔴 CIEGO (${etiqueta}): han salido ${textos.length} textos hacia el profesional y se esperaba 1. `
    + `Buzón: ${JSON.stringify(buzon)}`);
  assert.match(textos[0], /ha abierto una disputa/, `🔴 CIEGO (${etiqueta}): el texto recogido no es el aviso de disputa.`);
  return { texto: textos[0], consultas };
}

const conFactura = (quoteId) => ({ id: 1, number: FACTURA, quoteId });
const presupuesto = (extra) => ({ id: PRESUPUESTO, merchantId: MERCHANT, signatureUrl: null, ...extra });

// ═══ ① EL POSITIVO QUE PUEDE TUMBARLO ════════════════════════════════════════════════════════

test('SCRUM-1436 · ✅ POSITIVO: con presupuesto FIRMADO, el aviso sale IGUAL que antes, byte a byte', async () => {
  const { texto, consultas } = await avisoDe({
    factura: conFactura(PRESUPUESTO),
    presupuestos: [presupuesto({ signatureUrl: FIRMA_CON_TRAZO })],
  }, 'firmado');

  assert.equal(texto, avisoDeSiempre(FACTURA),
    '🔴 el profesional que SÍ tiene el presupuesto firmado ha dejado de leer el aviso de siempre. '
    + 'La condición se ha comido el caso bueno.');
  assert.equal(consultas.length, 1, '🔴 la firma no se ha leído de la base: el «FIRMADO» sale sin haber mirado.');
});

// ═══ ② EL DEFECTO: LA FRASE SIN FIRMA DETRÁS ════════════════════════════════════════════════

const SIN_FIRMA = [
  ['la factura NO viene de un presupuesto', 'sin-presupuesto',
    { factura: conFactura(null) }],
  ['el presupuesto se ACEPTÓ SIN FIRMAR («Acepto sin firmar» deja la firma a null)', 'aceptado-sin-firma',
    { factura: conFactura(PRESUPUESTO), presupuestos: [presupuesto({ signatureUrl: null })] }],
  ['la firma guardada es un lienzo VACÍO (SCRUM-892)', 'lienzo-vacio',
    { factura: conFactura(PRESUPUESTO), presupuestos: [presupuesto({ signatureUrl: LIENZO_VACIO })] }],
  ['la firma guardada es `data:,`', 'data-coma',
    { factura: conFactura(PRESUPUESTO), presupuestos: [presupuesto({ signatureUrl: 'data:,' })] }],
  ['el presupuesto firmado es de OTRO negocio', 'otro-negocio',
    { factura: conFactura(PRESUPUESTO), presupuestos: [presupuesto({ merchantId: OTRO_NEGOCIO, signatureUrl: FIRMA_CON_TRAZO })] }],
  ['el presupuesto de la factura ya no existe', 'presupuesto-borrado',
    { factura: conFactura(PRESUPUESTO), presupuestos: [] }],
  ['la lectura del presupuesto FALLA: no saber no es «firmado»', 'lectura-rota',
    { factura: conFactura(PRESUPUESTO), presupuestos: [presupuesto({ signatureUrl: FIRMA_CON_TRAZO })], lecturaRota: true }],
];

// Un caso por fila, con el nombre ESCRITO (SCRUM-1415): con el bucle, el nombre se construía al
// ejecutar y la señal por nombres no podía decir que faltaba uno si la tanda lo perdía.
const sinFirma = casosEscritos(
  SIN_FIRMA,
  ([caso]) => `SCRUM-1436 · 🔴 ${caso} → el aviso NO dice «presupuesto FIRMADO»`,
  async ([caso, etiqueta, banco]) => {
    const { texto } = await avisoDe(banco, etiqueta);

    assert.ok(!texto.includes('FIRMADO'),
      `🔴 EL PROFESIONAL LEE «${FRASE}» Y NO ES VERDAD (${caso}). Se lo decimos justo cuando un `
      + `banco le reclama el dinero. Texto que salió:\n${texto}`);
    assert.equal(texto, avisoSinLaFrase(FACTURA),
      '🔴 sin firma, el aviso tiene que ser el de siempre MENOS esa oración, y nada más. Cualquier '
      + 'palabra nueva es texto que ve el usuario y necesita firma del fundador (regla 39).');
  },
);
test('SCRUM-1436 · 🔴 la factura NO viene de un presupuesto → el aviso NO dice «presupuesto FIRMADO»', sinFirma(0));
test('SCRUM-1436 · 🔴 el presupuesto se ACEPTÓ SIN FIRMAR («Acepto sin firmar» deja la firma a null) → el aviso NO dice «presupuesto FIRMADO»', sinFirma(1));
test('SCRUM-1436 · 🔴 la firma guardada es un lienzo VACÍO (SCRUM-892) → el aviso NO dice «presupuesto FIRMADO»', sinFirma(2));
test('SCRUM-1436 · 🔴 la firma guardada es `data:,` → el aviso NO dice «presupuesto FIRMADO»', sinFirma(3));
test('SCRUM-1436 · 🔴 el presupuesto firmado es de OTRO negocio → el aviso NO dice «presupuesto FIRMADO»', sinFirma(4));
test('SCRUM-1436 · 🔴 el presupuesto de la factura ya no existe → el aviso NO dice «presupuesto FIRMADO»', sinFirma(5));
test('SCRUM-1436 · 🔴 la lectura del presupuesto FALLA: no saber no es «firmado» → el aviso NO dice «presupuesto FIRMADO»', sinFirma(6));
sinFirma.todos();

test('SCRUM-1436 · 🔴 el cobro NO tiene factura → el aviso NO dice «presupuesto FIRMADO»', async () => {
  const { texto, consultas } = await avisoDe({
    factura: null,
    presupuestos: [presupuesto({ signatureUrl: FIRMA_CON_TRAZO })],
  }, 'sin-factura');

  assert.ok(!texto.includes('FIRMADO'),
    `🔴 sin factura no hay paquete de disputa al que ir a buscar la firma, y el aviso la afirma:\n${texto}`);
  assert.equal(texto, avisoSinLaFrase(null), '🔴 el resto del aviso ha cambiado, y sólo se retiraba una oración.');
  assert.equal(consultas.length, 0, '🔴 sin factura no hay presupuesto que consultar, y se ha consultado uno.');
});

// ═══ ③ EL NEGOCIO VA EN LA CONSULTA ═════════════════════════════════════════════════════════

test('SCRUM-1436 · 🔴 la firma se busca por el presupuesto de la factura Y por el negocio del cobro', async () => {
  const { consultas } = await avisoDe({
    factura: conFactura(PRESUPUESTO),
    presupuestos: [presupuesto({ signatureUrl: FIRMA_CON_TRAZO })],
  }, 'consulta');

  assert.equal(consultas.length, 1);
  assert.equal(consultas[0]?.where?.id, PRESUPUESTO, '🔴 no se consulta el presupuesto de ESA factura.');
  assert.equal(consultas[0]?.where?.merchantId, MERCHANT,
    '🔴 la consulta del presupuesto no filtra por negocio (regla 2: toda consulta lleva su merchant).');
});

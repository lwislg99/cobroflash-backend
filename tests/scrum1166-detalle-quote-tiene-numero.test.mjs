// tests/scrum1166-detalle-quote-tiene-numero.test.mjs — SCRUM-1166 (parte a de SCRUM-1163)
//
// EL DETALLE DEL PRESUPUESTO NO DECÍA SI EL CLIENTE TIENE NÚMERO.
//
// `getQuoteDetailAdmin` proyectaba del cliente sólo `phone`, así que la pantalla hacía
// `!!quote.customer.phone` y, con un cliente que sólo tiene MÓVIL, desactivaba el botón de WhatsApp
// diciendo que no tenía teléfono. El envío (`sendQuote.service.ts`) sí resuelve el móvil con
// `canalDeWhatsApp`, así que la pantalla y el envío discrepaban.
//
// El arreglo NO manda el móvil al front para que decida él: manda un BOOLEANO calculado con
// `tieneNumeroDeContacto`, la misma función que usa el envío. Un solo sitio para el criterio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { casosEscritos } from './_casos-escritos.mjs';

const moduloPrisma = await import('../dist/core/db/prisma.js');
const { getQuoteDetailAdmin } = await import('../dist/modules/system/quoteAdmin.js');

const MERCHANT = 7;

function presupuesto(customer) {
  return {
    id: 41, merchantId: MERCHANT, quoteNumber: null, revision: 0, status: 'SENT',
    signatureUrl: null, total: 100, createdAt: new Date('2026-09-27T10:00:00Z'),
    updatedAt: new Date('2026-09-27T10:00:00Z'), currency: 'EUR', lines: [], tiers: null,
    discountGlobalAmount: null,
    merchant: { id: MERCHANT, name: 'Fontanería Demo' },
    customer: { id: 5, name: 'Cliente', email: null, notes: null, phone: null, mobile: null, ...customer },
    charge: null, Invoice: [],
  };
}

/** Sustituye el delegado `quote` y apunta con qué `where` se le preguntó. */
function doblar(quote) {
  const preguntas = [];
  moduloPrisma.prisma.quote = {
    findFirst: async (args) => {
      preguntas.push(args.where);
      return args.where.merchantId === quote.merchantId && args.where.id === quote.id ? quote : null;
    },
    findUnique: async () => ({ decisionToken: 'tok' }), // ensureQuoteDecisionToken: ya tiene token
    findMany: async () => { throw new Error('no debería buscar hermanas: quoteNumber es null'); },
    update: async () => { throw new Error('el detalle no escribe'); },
  };
  return preguntas;
}

const original = moduloPrisma.prisma.quote;
test.after(() => { moduloPrisma.prisma.quote = original; });

const FILAS = [
  ['SOLO MÓVIL', { mobile: '34000000001' }, true],
  ['SOLO FIJO', { phone: '34000000002' }, true],
  ['NINGÚN número', {}, false],
  ['números en BLANCO', { phone: '  ', mobile: '' }, false],
];
const caso2 = casosEscritos(FILAS, ([caso, customer, esperado]) => `🔴 SCRUM-1166 · ${caso} → customer.tieneNumeroDeContacto = ${esperado}`, async ([caso, customer, esperado]) => {
  doblar(presupuesto(customer));
  const d = await getQuoteDetailAdmin(41, MERCHANT);
  assert.equal(d.customer.tieneNumeroDeContacto, esperado,
    `🔴 el detalle dice ${d.customer.tieneNumeroDeContacto} para un cliente con ${JSON.stringify(customer)}`);
});
test('🔴 SCRUM-1166 · SOLO MÓVIL → customer.tieneNumeroDeContacto = true', caso2(0));
test('🔴 SCRUM-1166 · SOLO FIJO → customer.tieneNumeroDeContacto = true', caso2(1));
test('🔴 SCRUM-1166 · NINGÚN número → customer.tieneNumeroDeContacto = false', caso2(2));
test('🔴 SCRUM-1166 · números en BLANCO → customer.tieneNumeroDeContacto = false', caso2(3));
caso2.todos();

test('SCRUM-1166 · ADITIVO: `phone` sigue saliendo igual y el MÓVIL no viaja al front', async () => {
  doblar(presupuesto({ phone: '34000000002', mobile: '34000000001' }));
  const d = await getQuoteDetailAdmin(41, MERCHANT);
  assert.equal(d.customer.phone, '34000000002');
  assert.equal('mobile' in d.customer, false,
    'el criterio vive en el servidor: si el front recibe los números, puede volver a decidir por su cuenta');
});

test('SCRUM-1166 · regla 2: otro comerciante no ve el presupuesto (la consulta filtra por merchantId)', async () => {
  const preguntas = doblar(presupuesto({ mobile: '34000000001' }));
  await assert.rejects(() => getQuoteDetailAdmin(41, MERCHANT + 1), /quote_not_found/);
  assert.equal(preguntas[0].merchantId, MERCHANT + 1);
});

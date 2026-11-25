// tests/scrum1800b-recibo-pendiente-a-continuacion.test.mjs — SCRUM-1800 ② (J2, 24-nov-2026)
//
// EL RECIBO PENDIENTE NOMBRA LOS BOTONES «A CONTINUACIÓN», PORQUE ESTÁN DEBAJO.
//
// `receipt.routes.ts` pinta `${statusMessage}` y, en la línea siguiente, `<div class="pay-stack">`
// con los botones. Los tres textos del recibo pendiente decían «que aparece(n) más arriba». Literales
// FIRMADOS por el fundador en Jira SCRUM-1800, comentario 22496 ② (regla 39): cambia SOLO «más
// arriba» por «a continuación»; el resto de cada frase es el firmado en SCRUM-910 c.16527.
//
// 🔴 POR LA RUTA MONTADA (A10, SCRUM-1344): arranca `dist/app.js` entero con el banco de SCRUM-597 y
// pide `GET /recibo/:token`, la puerta pública que abre el cliente final. Se exige la frase ENTERA,
// del «Estamos» al punto final: una subcadena dejaría pasar un cambio en el resto de la frase.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { montarAppReal, bancoDePrisma } from './_banco-camino-real.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

/** Mutaciones que este fichero tiene que tumbar (A3, SCRUM-1731). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: "el botón de <b>pago por banco</b> que aparece a continuación.'",
    a: "el botón de <b>pago por banco</b> que aparece más arriba.'",
    cae: 'pendiente solo con banco',
  },
];

const app = await montarAppReal();
after(() => app.cerrar());

// Copiados de Jira SCRUM-1800 c.22496 ②, byte a byte.
const AMBOS = 'Estamos esperando tu pago. Puedes completarlo usando los botones de <b>pago por banco</b> o <b>pago con tarjeta</b> que aparecen a continuación.';
const SOLO_BANCO = 'Estamos esperando tu pago. Puedes completarlo usando el botón de <b>pago por banco</b> que aparece a continuación.';
const SOLO_TARJETA = 'Estamos esperando tu pago. Puedes completarlo usando el botón de <b>pago con tarjeta</b> que aparece a continuación.';
const FIRMADOS = [AMBOS, SOLO_BANCO, SOLO_TARJETA];

const IBAN = 'ES9121000418450200051332';
const CONNECT = { connectStatus: 'active', stripeAccountId: 'acct_T', flags: { PAYMENTS_CONNECT_ENABLED: true } };
const TOKEN = 'tok1800b';

function programar({ estado = 'pending', merchant = {} } = {}) {
  const ch = {
    id: 18002, receiptToken: TOKEN, status: estado, amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(), paidAt: estado === 'paid' ? new Date() : null,
    merchantId: 42, customer: { id: 3, name: 'Ana', email: null }, events: [], reconciliations: [],
    merchant: {
      id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
      country: 'ES', logoUrl: null, iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
      connectStatus: 'none', stripeAccountId: null, flags: null, ...merchant,
    },
  };
  bancoDePrisma().programar({
    charge: { findUnique: async (a) => (a?.where?.receiptToken === TOKEN || a?.where?.id === ch.id ? ch : null), update: async () => ch },
    invoice: { findFirst: async () => null, findUnique: async () => null },
    quote: { findFirst: async () => null },
    event: { create: async () => ({ id: 1 }) },
  });
}

const pedir = () => app.pedir(`/recibo/${TOKEN}`);

const CASOS = [
  { nombre: 'pendiente solo con banco', merchant: { iban: IBAN }, esperado: SOLO_BANCO },
  { nombre: 'pendiente solo con tarjeta', merchant: { ...CONNECT }, esperado: SOLO_TARJETA },
  { nombre: 'pendiente con banco y tarjeta', merchant: { ...CONNECT, iban: IBAN }, esperado: AMBOS },
];

// Nombres ESCRITOS (scrum1415): `casosEscritos` comprueba que cada literal sigue siendo el de su fila.
const pendiente = casosEscritos(
  CASOS,
  (c) => `SCRUM-1800 ② · /recibo ${c.nombre} → su frase firmada en c.22496, entera, y el texto va ANTES de los botones`,
  async (c) => {
    programar({ merchant: c.merchant });
    const r = await pedir();
    assert.equal(r.status, 200, `suelo: /recibo devolvió ${r.status} ${String(r.texto).slice(0, 200)}`);
    assert.ok(r.texto.includes(c.esperado), `🔴 falta la frase firmada de «${c.nombre}»: «${c.esperado}»`);
    for (const otra of FIRMADOS.filter((f) => f !== c.esperado)) {
      assert.equal(r.texto.includes(otra), false, `🔴 «${c.nombre}» pinta la frase de otro caso: «${otra}»`);
    }
    assert.equal(/aparecen? más arriba/.test(r.texto), false, '🔴 el recibo pendiente sigue diciendo «más arriba»');
    // «a continuación» solo es verdad si los botones van detrás del texto.
    const enTexto = r.texto.indexOf(c.esperado);
    const enBotones = r.texto.indexOf('class="pay-stack"');
    assert.ok(enBotones > enTexto, `🔴 los botones (pay-stack @${enBotones}) no van detrás del texto (@${enTexto})`);
  },
);
test('SCRUM-1800 ② · /recibo pendiente solo con banco → su frase firmada en c.22496, entera, y el texto va ANTES de los botones', pendiente(0));
test('SCRUM-1800 ② · /recibo pendiente solo con tarjeta → su frase firmada en c.22496, entera, y el texto va ANTES de los botones', pendiente(1));
test('SCRUM-1800 ② · /recibo pendiente con banco y tarjeta → su frase firmada en c.22496, entera, y el texto va ANTES de los botones', pendiente(2));
pendiente.todos();

const CERRADOS = [{ estado: 'paid' }, { estado: 'cancelled' }];
const cerrado = casosEscritos(
  CERRADOS,
  ({ estado }) => `SCRUM-1800 ② · control: el recibo ${estado} no pinta ninguna frase del pendiente ni botones de pago`,
  async ({ estado }) => {
    programar({ estado, merchant: { ...CONNECT, iban: IBAN } });
    const r = await pedir();
    assert.equal(r.status, 200, `suelo: /recibo devolvió ${r.status} ${String(r.texto).slice(0, 200)}`);
    for (const f of FIRMADOS) assert.equal(r.texto.includes(f), false, `🔴 el recibo ${estado} pinta «${f}»`);
    assert.equal(r.texto.includes('Estamos esperando tu pago'), false);
    assert.equal(r.texto.includes('class="pay-stack"'), false);
    if (estado === 'paid') assert.ok(r.texto.includes('Pago recibido correctamente'), 'positivo: el pagado pinta su propio texto');
  },
);
test('SCRUM-1800 ② · control: el recibo paid no pinta ninguna frase del pendiente ni botones de pago', cerrado(0));
test('SCRUM-1800 ② · control: el recibo cancelled no pinta ninguna frase del pendiente ni botones de pago', cerrado(1));
cerrado.todos();

// Control del detector (SCRUM-113): si una frase fuera subcadena de otra, el «no pinta la de otro
// caso» pasaría en vacío.
test('SCRUM-1800 ② · control: las tres frases firmadas son mutuamente distinguibles', () => {
  for (const a of FIRMADOS) for (const b of FIRMADOS) if (a !== b) assert.equal(b.includes(a), false, `«${a}» ⊂ «${b}»`);
});

// tests/scrum1213-quoteadmin-tenencia-fail-closed.test.mjs — SCRUM-1213
//
// 🔴 TENENCIA FAIL-CLOSED en `src/modules/system/quoteAdmin.ts` (regla 2).
//
// `getQuoteDetailAdmin`, `acceptQuoteAdmin` y `rejectQuoteAdmin` construían el `where` con
// `...(merchantId != null ? { merchantId } : {})`: sin `merchantId` la consulta NO filtraba por
// negocio y servía, aceptaba o rechazaba el presupuesto de OTRO. Hoy sus tres llamadores pasan
// `req.merchantId`, así que era latente; el primero que se olvidara lo abría.
//
// Lo que se mide: sin merchantId las tres responden `quote_not_found` SIN preguntar a la base, y
// con él el `where` lleva SIEMPRE el merchantId (control positivo: si no, lo de arriba lo cumpliría
// una función que ya no consulta nada).
import test from 'node:test';
import assert from 'node:assert/strict';

const moduloPrisma = await import('../dist/core/db/prisma.js');
const { getQuoteDetailAdmin, acceptQuoteAdmin, rejectQuoteAdmin } =
  await import('../dist/modules/system/quoteAdmin.js');

const AJENO = { id: 41, merchantId: 9, status: 'sent', paymentTerms: null, evidence: null };

function doblar() {
  const preguntas = [];
  const escrituras = [];
  moduloPrisma.prisma.quote = {
    // Una base que NO filtra: si el `where` no lleva merchantId, devuelve el presupuesto ajeno.
    findFirst: async (args) => {
      preguntas.push(args.where);
      if (args.where.merchantId != null && args.where.merchantId !== AJENO.merchantId) return null;
      return AJENO;
    },
    update: async (a) => { escrituras.push(a); return { ...AJENO, ...a.data }; },
  };
  return { preguntas, escrituras };
}

const original = moduloPrisma.prisma.quote;
test.after(() => { moduloPrisma.prisma.quote = original; });

const CASOS = [
  ['getQuoteDetailAdmin', (m) => getQuoteDetailAdmin(41, m)],
  ['acceptQuoteAdmin', (m) => acceptQuoteAdmin(41, {}, m)],
  ['rejectQuoteAdmin', (m) => rejectQuoteAdmin(41, { reason: 'x' }, m)],
];

for (const [nombre, llamar] of CASOS) {
  test(`🔴 SCRUM-1213 · ${nombre} SIN merchantId → quote_not_found, sin leer ni escribir`, async () => {
    for (const sinMerchant of [undefined, null]) {
      const { preguntas, escrituras } = doblar();
      await assert.rejects(() => llamar(sinMerchant), /quote_not_found/,
        `🔴 ${nombre}(${sinMerchant}) no falló: sirve el presupuesto de otro negocio`);
      assert.deepEqual(preguntas, [], `🔴 ${nombre} consultó la base sin filtro de merchant`);
      assert.deepEqual(escrituras, [], `🔴 ${nombre} escribió sin filtro de merchant`);
    }
  });

  test(`SCRUM-1213 · ${nombre} con otro merchantId → quote_not_found, y el where lo lleva (control positivo)`, async () => {
    const { preguntas, escrituras } = doblar();
    await assert.rejects(() => llamar(7), /quote_not_found/);
    assert.equal(preguntas.length, 1, `🔴 ${nombre} ya no consulta: el test de arriba no mediría nada`);
    assert.equal(preguntas[0].merchantId, 7, `🔴 ${nombre} no filtra por el merchant que recibe`);
    assert.deepEqual(escrituras, []);
  });
}

// tests/scrum1151-conteo-no-deducible.test.mjs — SCRUM-1151
//
// `GET /admin/reports/resumen-trimestre` no traía el conteo que necesita la nota firmada de
// SCRUM-1049 («N gastos… no los has marcado como IVA deducible») ni los avisos del libro de
// recibidas — Informes seguía llamando a `/admin/libros/recibidas.json` SOLO para eso.
//
// 🔴 EL QUE DECIDE: `ivaSoportado.noDeducible.count + ivaSoportado.sinClasificar.count` NO es
// ese número (medido: distinto en 1718 de 2000 lotes, SCRUM-1147). Este test exige que el campo
// nuevo COINCIDA con lo que darían las filas reales del libro de recibidas
// (`filasLibroRecibidas`, filtradas por `deducible !== 'Sí'`), no con la suma del soportado.
//
// Handler REAL, `prisma` SUSTITUIDO (patrón de `scrum1057-duplicados-antes-de-id`): sin red, sin
// base. `expense.findMany` sirve a la vez a `construirResumenTrimestre` (selecciona menos campos)
// y a `leerLibroRecibidas` (selecciona `CAMPOS_GASTO`, superconjunto) — un solo mock basta porque
// Prisma no filtra columnas del lado del cliente en este doble.
import test from 'node:test';
import assert from 'node:assert/strict';

const DIST = '../dist/';

let router;
test.before(async () => { router = await routerDeInformes(); });

/** El router REAL de Informes. `dist` es CJS: el default queda anidado al importarlo desde ESM. */
async function routerDeInformes() {
  const mod = await import(DIST + 'modules/reports/app/routes/reports.routes.js');
  const r = mod.default?.stack ? mod.default : mod.default?.default;
  assert.ok(r?.stack, '🔴 no he podido cargar el router de Informes.');
  return r;
}

function llamarResumen(router, merchantId, year, quarter) {
  const capa = router.stack.find((l) => l.route?.path === '/resumen-trimestre');
  assert.ok(capa, '🔴 la ruta /resumen-trimestre ya no existe en el router de Informes.');
  return new Promise((resolve, reject) => {
    capa.route.stack[0].handle(
      { merchantId, query: { year, quarter } },
      { json: resolve, status: (c) => ({ json: (b) => reject(new Error(`HTTP ${c}: ${JSON.stringify(b)}`)) }) },
      reject,
    );
  });
}

// 6 gastos del mismo trimestre (2026 T3, dentro de rangoTrimestre(2026,3)):
//  - 2 CON base, deducible true       → SÍ cuentan como deducidos (no entran en el conteo nuevo)
//  - 2 CON base, deducible false      → entran en el conteo nuevo
//  - 1 CON base, deducible null       → entra en el conteo nuevo (nunca clasificado, no es "No")
//  - 1 SIN base (baseAmount null)     → NO es un asiento: es "sinClasificar" (dispara el aviso)
const GASTOS = [
  { id: 1, merchantId: 42, date: new Date('2026-08-01'), concept: 'a', amount: '121.00', currency: 'EUR', providerId: null, baseAmount: '100.00', vatRate: 21, vatAmount: '21.00', vatDeducible: true, providerInvoiceNumber: null, providerInvoiceDate: null },
  { id: 2, merchantId: 42, date: new Date('2026-08-02'), concept: 'b', amount: '121.00', currency: 'EUR', providerId: null, baseAmount: '100.00', vatRate: 21, vatAmount: '21.00', vatDeducible: true, providerInvoiceNumber: null, providerInvoiceDate: null },
  { id: 3, merchantId: 42, date: new Date('2026-08-03'), concept: 'c', amount: '50.00', currency: 'EUR', providerId: null, baseAmount: '41.32', vatRate: 21, vatAmount: '8.68', vatDeducible: false, providerInvoiceNumber: null, providerInvoiceDate: null },
  { id: 4, merchantId: 42, date: new Date('2026-08-04'), concept: 'd', amount: '50.00', currency: 'EUR', providerId: null, baseAmount: '41.32', vatRate: 21, vatAmount: '8.68', vatDeducible: false, providerInvoiceNumber: null, providerInvoiceDate: null },
  { id: 5, merchantId: 42, date: new Date('2026-08-05'), concept: 'e', amount: '30.00', currency: 'EUR', providerId: null, baseAmount: '24.79', vatRate: 21, vatAmount: '5.21', vatDeducible: null, providerInvoiceNumber: null, providerInvoiceDate: null },
  { id: 6, merchantId: 42, date: new Date('2026-08-06'), concept: 'f', amount: '15.00', currency: 'EUR', providerId: null, baseAmount: null, vatRate: null, vatAmount: null, vatDeducible: null, providerInvoiceNumber: null, providerInvoiceDate: null },
];

async function conPrismaSustituido(fn, gastos = GASTOS) {
  const moduloPrisma = await import(DIST + 'core/db/prisma.js');
  const original = {
    expense: moduloPrisma.prisma.expense,
    invoice: moduloPrisma.prisma.invoice,
    quote: moduloPrisma.prisma.quote,
    albaran: moduloPrisma.prisma.albaran,
  };
  moduloPrisma.prisma.expense = { findMany: async () => gastos };
  // Repercutido vacío a propósito: este ticket mide el lado de gastos, no el de facturas.
  moduloPrisma.prisma.invoice = { findMany: async () => [] };
  moduloPrisma.prisma.quote = { findMany: async () => [] };
  moduloPrisma.prisma.albaran = { findMany: async () => [] };
  try {
    return await fn();
  } finally {
    moduloPrisma.prisma.expense = original.expense;
    moduloPrisma.prisma.invoice = original.invoice;
    moduloPrisma.prisma.quote = original.quote;
    moduloPrisma.prisma.albaran = original.albaran;
  }
}

test('🔴 SCRUM-1151 · gastosNoDeducibleDeclarados coincide con filasLibroRecibidas(...).filter(deducible!=="Sí"), NO con noDeducible+sinClasificar', async () => {
  const { construirLibroRecibidas } = await import(DIST + 'modules/invoicing/domain/libroRecibidas.js');
  const { filasLibroRecibidas } = await import(DIST + 'modules/fiscal/librosAeat/librosAeat.js');

  // El mismo conteo, calculado por el camino INDEPENDIENTE que el ticket exige como referencia.
  const libro = construirLibroRecibidas({ gastos: GASTOS, merchantId: 42 });
  const filas = filasLibroRecibidas(libro, new Map());
  const esperado = filas.filter((f) => f.deducible !== 'Sí').length;
  assert.equal(esperado, 3, 'SUELO: el fixture no arma lo que este test cree que arma');

  const r = await conPrismaSustituido(() => llamarResumen(router, 42, 2026, 3));

  assert.equal(r.gastosNoDeducibleDeclarados, esperado);

  // El NEGATIVO real del ticket: la cifra vieja (equivocada) es OTRA.
  const cifraEquivocada = r.ivaSoportado.noDeducible.count + r.ivaSoportado.sinClasificar.count;
  assert.notEqual(r.gastosNoDeducibleDeclarados, cifraEquivocada,
    'este fixture tiene que discriminar las dos cifras, o el test no prueba nada');
});

test('SCRUM-1151 · avisosLibroRecibidas en la respuesta ya viene SIN el aviso de formato (posición 0)', async () => {
  const r = await conPrismaSustituido(() => llamarResumen(router, 42, 2026, 3));
  assert.ok(Array.isArray(r.avisosLibroRecibidas));
  assert.ok(!r.avisosLibroRecibidas.some((a) => /[Ff]ormato provisional/.test(a)),
    '🔴 se coló el aviso de formato: la nota firmada solo quiere los que importan');
  assert.ok(r.avisosLibroRecibidas.some((a) => /1 gasto sin datos de IVA no figura/.test(a)),
    `🔴 falta el aviso del gasto sin base (id 6): ${JSON.stringify(r.avisosLibroRecibidas)}`);
});

test('SCRUM-1151 · control negativo: sin ningún gasto sin marcar, el conteo es CERO, no ausente', async () => {
  const soloDeducibles = GASTOS.filter((g) => g.vatDeducible === true);
  const r = await conPrismaSustituido(() => llamarResumen(router, 42, 2026, 3), soloDeducibles);
  assert.equal(r.gastosNoDeducibleDeclarados, 0);
  assert.deepEqual(r.avisosLibroRecibidas, []);
});

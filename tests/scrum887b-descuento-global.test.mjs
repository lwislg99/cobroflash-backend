// tests/scrum887b-descuento-global.test.mjs — SCRUM-887 · PR 2 (caso B: descuento GLOBAL, un solo IVA)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// CON DESCUENTO GLOBAL, EL CLIENTE TAMBIÉN PAGA LO QUE FIRMÓ
//
// El PR 1 (#1369) arregló el descuento de LÍNEA y dejó a propósito el global como estaba: con
// global, `lineasParaFacturar` devuelve `Quote.lines` tal cual, sin `dto` y sin global. C3 con un
// solo IVA y 25 € de global firma 559,70 € y se cobraría 652,78 €.
//
// ── LA DECISIÓN (orquestador, 17-sep-2026, sobre la tabla de SCRUM-887) ───────────────────────
//   B · global con UN solo IVA → una línea NEGATIVA del mismo IVA, rotulada «Descuento global»
//       (el literal que ya pinta el pie del presupuesto). La reconciliación de SCRUM-141 hace el
//       resto contra el total firmado, igual que en el caso A.
//   C · global con IVA mezclado → la acotación SE MANTIENE (su test vive en scrum887, intacto).
//   Albarán (C7) con global → NO emite. Un parte factura «una parte» del presupuesto, y llevarse
//       una parte del global es un reparto, que es justo lo excluido. Tampoco a precio bruto: sería
//       volver a cobrar de más. Rechazo con código propio y ANTES de escribir nada (regla 29).
//
// ── LA MUESTRA ES FIJA ────────────────────────────────────────────────────────────────────────
// Mismo generador con semilla que scrum887 (mulberry32). Un fallo se reproduce con su índice.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const { calcTotal } = await import(DIST + 'core/utils/utils.js');
const { grossOfLines, stageLinesReconciled, lineasParaFacturar } = await import(DIST + 'modules/invoicing/domain/invoiceLines.service.js');
const { distributeStageAmounts } = await import(DIST + 'modules/quotes/domain/billingPlan.js');
const { pieDePresupuesto } = await import(DIST + 'modules/quotes/domain/presentacionIva.js');
const moduloPrisma = await import(DIST + 'core/db/prisma.js');

const PLANES = {
  entero: [{ index: 0, percentage: 1, label: 'full' }],
  '50/50': [{ index: 0, percentage: 0.5, label: 'a' }, { index: 1, percentage: 0.5, label: 'b' }],
  '30/70': [{ index: 0, percentage: 0.3, label: 'a' }, { index: 1, percentage: 0.7, label: 'b' }],
};

/** Lo que emiten los caminos de tramos: líneas del tramo reconciliadas contra el reparto del firmado. */
function facturasDe(quote, plan) {
  const lineas = lineasParaFacturar(quote);
  const objetivos = distributeStageAmounts(quote.total, plan);
  return plan.map((_, i) => {
    const ls = stageLinesReconciled(lineas, plan, i, objetivos[i]);
    return { lineas: ls, importe: grossOfLines(ls) };
  });
}

const cents = (n) => Math.round(n * 100);

/** C3 del electricista (SCRUM-883) con TODO al 21 %: el caso B. */
const C3_UN_IVA = [
  { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
  { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.21 },
  { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO · C3 con un IVA y 25 € de descuento global
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-887b · 🔴 C3 con global y un IVA: el cobro es EXACTAMENTE lo firmado, en todos los planes', () => {
  const quote = { lines: C3_UN_IVA, discountGlobalAmount: 25, total: calcTotal(C3_UN_IVA, 25).toFixed(2) };
  // SUELO: el firmado se LEE de `calcTotal` y tiene que llevar el global. Si no, se compararían
  // dos cifras sin descuento y el verde no miraría nada.
  assert.equal(quote.total, '559.70', '🔴 CIEGO: el total firmado ya no es el de los dos descuentos');

  for (const [nombre, plan] of Object.entries(PLANES)) {
    const cobrado = facturasDe(quote, plan).reduce((a, f) => a + cents(f.importe), 0);
    assert.equal(cobrado, cents(559.70),
      `🔴 plan ${nombre}: el cliente firmó 559,70 € y se le cobran ${(cobrado / 100).toFixed(2)} €`);
  }
});

test('SCRUM-887b · 🔴 la vista del plan promete lo MISMO que se emite con descuento global', async () => {
  const { buildBillingPlanView } = await import(DIST + 'modules/quotes/domain/billingPlanView.js');
  const quote = {
    lines: C3_UN_IVA, discountGlobalAmount: 25, total: calcTotal(C3_UN_IVA, 25).toFixed(2),
    currency: 'EUR', paymentTerms: 'FIFTY_FIFTY', customBillingPlan: null,
  };
  const vista = buildBillingPlanView(quote, 0);
  assert.equal(vista.billingPlan.length, 2, '🔴 CIEGO: FIFTY_FIFTY no dio dos tramos');
  const emitidos = facturasDe(quote, PLANES['50/50']).map((x) => x.importe);
  assert.deepEqual(vista.billingPlan.map((s) => s.amount), emitidos,
    '🔴 la pantalla promete un importe por tramo distinto del que se factura');
  assert.equal(cents(emitidos[0]) + cents(emitidos[1]), cents(559.70), '🔴 los tramos no suman lo firmado');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PIEZA · qué línea añade, con qué rótulo, y qué NO toca
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-887b · 🔴 con global y un IVA sale UNA línea negativa del mismo IVA, AL FINAL, rotulada como el pie', () => {
  // Número, texto y un Decimal de Prisma (se lee por `valueOf`): los tres llegan a la pieza.
  for (const global of [25, '25.00', { toString: () => '25.00', valueOf: () => 25 }]) {
    const salida = lineasParaFacturar({ lines: C3_UN_IVA, discountGlobalAmount: global });
    assert.equal(salida.length, 4, `🔴 global ${String(global)}: se esperaban las 3 líneas y la del descuento`);
    const ultima = salida[3];
    assert.deepEqual(ultima, { concept: 'Descuento global', qty: 1, price: -25, tax: 0.21 },
      `🔴 global ${String(global)}: la línea del descuento no es la esperada`);
    // El dto de línea se sigue aplicando, y la clave no viaja (misma regla que el caso A).
    assert.equal(salida[0].price, 24.95 * (1 - 15 / 100));
    assert.equal('dto' in salida[0], false, '🔴 la línea conserva `dto` con el precio YA descontado');
    assert.equal(salida[2], C3_UN_IVA[2], '🔴 una línea SIN descuento no sale como entró');
  }
  assert.equal(C3_UN_IVA[0].price, 24.95, '🔴 se ha MUTADO `Quote.lines`');
  assert.equal(C3_UN_IVA.length, 3, '🔴 se ha MUTADO `Quote.lines`');

  // EL RÓTULO NO SE INVENTA: es el que el cliente ya leyó en el pie del presupuesto que firmó.
  const pie = pieDePresupuesto({ lineas: C3_UN_IVA, modo: 'sumar', nombreImpuesto: 'IVA', descuentoGlobal: 25 });
  const etiquetas = pie.filas.map((f) => f.etiqueta);
  assert.ok(etiquetas.includes(`${lineasParaFacturar({ lines: C3_UN_IVA, discountGlobalAmount: 25 })[3].concept}:`),
    `🔴 el rótulo de la factura ya no es el del pie del presupuesto: ${etiquetas.join(' · ')}`);
});

test('SCRUM-887b · el descuento global nunca pasa de la base: se descuenta lo mismo que en `calcTotal`', () => {
  // `calcTotal` limita el global a la suma de bases (en céntimos, línea a línea). La línea
  // negativa usa el MISMO límite: si no, la factura restaría más de lo que el cliente firmó.
  const lines = [{ concept: 'x', qty: 3, price: 9.99, dto: 10, tax: 0.10 }];
  const salida = lineasParaFacturar({ lines, discountGlobalAmount: 1000 });
  assert.equal(salida.at(-1).price, -26.97, '🔴 el descuento no se ha limitado a la base firmada');
  assert.equal(salida.at(-1).tax, 0.1);
  assert.equal(calcTotal(lines, 1000), 0, '🔴 CIEGO: calcTotal ya no limita el global');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MUESTRA B · 2.000 presupuestos con global y un solo IVA
// ═════════════════════════════════════════════════════════════════════════════════════════════

function muestraB(semilla, n) {
  let s = semilla;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const qtys = [1, 2, 2.5, 3, 7, 11, 37, 0.75];
  const precios = [9.99, 0.875, 24.95, 19.99, 42.35, 120, 4.19, 36.35, 1.005, 689, 58.33, 2.37, 0.01, 1000];
  const dtos = [5, 10, 15, 33.33, 12.5, 50];
  const tipos = [0.21, 0.10, 0.04, 0];
  const globales = [0.01, 5, 25, 12.34, 99.99, 150];
  const out = [];
  while (out.length < n) {
    const tax = pick(tipos);
    const lines = [];
    const k = 1 + Math.floor(rand() * 4);
    for (let j = 0; j < k; j++) {
      const l = { concept: `L${j}`, qty: pick(qtys), price: pick(precios), tax };
      if (rand() < 0.5) l.dto = pick(dtos);
      lines.push(l);
    }
    const global = pick(globales);
    const total = calcTotal(lines, global).toFixed(2);
    // Un global que se come TODA la base firma 0 €: eso no es la muestra (se pregunta aparte).
    if (Number(total) === 0) continue;
    out.push({ lines, discountGlobalAmount: global, total });
  }
  return out;
}

// TECHOS medidos el 17-sep-2026 con el arreglo puesto. Sólo pueden BAJAR. Referencia medida el mismo
// día: esas MISMAS 2.000 líneas SIN el global dan 23 · 31 · 39 (la tasa de SCRUM-141, que existe sin
// descuento). El caso B no añade una tasa nueva.
const TECHO_DISTINTOS_B = { entero: 24, '50/50': 29, '30/70': 43 };

test('SCRUM-887b · 🔴 caso B (2.000): cobro ≠ firmado sólo por 1-2 céntimos, y con la tasa de SCRUM-141', () => {
  const quotes = muestraB(8870, 2000);
  for (const [nombre, plan] of Object.entries(PLANES)) {
    let distintos = 0;
    let peor = { d: 0 };
    quotes.forEach((q, i) => {
      const cobrado = facturasDe(q, plan).reduce((a, f) => a + cents(f.importe), 0);
      const d = Math.abs(cobrado - cents(Number(q.total)));
      if (d > 0) distintos++;
      if (d > peor.d) peor = { d, i, firmado: q.total, cobrado: cobrado / 100 };
    });
    assert.ok(peor.d <= 2,
      `🔴 ${nombre}: el caso ${peor.i} firma ${peor.firmado} € y se cobra ${peor.cobrado} € (${peor.d} cént.)`);
    assert.ok(distintos <= TECHO_DISTINTOS_B[nombre],
      `🔴 ${nombre}: ${distintos} de 2.000 no cobran lo firmado (techo ${TECHO_DISTINTOS_B[nombre]})`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ALBARÁN (C7) · con descuento global NO emite, y lo dice ANTES de escribir nada
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Handler real + `prisma` de doble, el patrón de scrum290-endpoint-convertir. Cualquier escritura
// —número de serie, factura, libro de líneas facturadas— queda registrada y el test la rechaza.

const routerDe = (mod) => mod.default?.default ?? mod.default;

async function convertirAlbaran(quote) {
  const escrituras = [];
  const p = moduloPrisma.prisma;
  const albaran = {
    id: 1, jobId: 1, numero: 'A-2026-0001', fecha: new Date('2026-08-01'),
    estado: 'firmado', modoValoracion: 'SIN_VALORAR', invoiceId: null,
    lineas: [{ concepto: 'Punto de luz', cantidad: 3, unidad: 'ud', quoteLineIndex: 0 }],
  };
  p.albaran = { findFirst: async () => albaran, findMany: async () => [{ id: 1, lineas: albaran.lineas }], update: async () => { escrituras.push('albaran.update'); } };
  p.job = { findFirst: async () => ({ id: 1, customerId: 5, quoteId: quote.id }) };
  p.customer = { findFirst: async () => ({ name: 'Cliente QA', legalName: null, taxId: null, email: null, phone: null }) };
  // Merchant REAL (id 7) con facturación: el modo justificante devolvería 409 antes de llegar aquí.
  p.merchant = {
    findUnique: async () => ({ id: 7, email: 'pro@electricidad.es', country: 'ES', flags: { INVOICING_ES_ENABLED: true }, defaultCurrency: 'EUR', taxId: 'B1' }),
  };
  p.quote = { findFirst: async () => quote };
  p.albaranLineaFacturada = { findMany: async () => [], createMany: async () => { escrituras.push('albaranLineaFacturada.createMany'); } };
  p.$transaction = async () => { escrituras.push('$transaction'); throw new Error('no debería abrir transacción'); };

  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/albaranes.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id/convertir-en-factura' && l.route?.methods?.post);
  assert.ok(capa, '🔴 CIEGO: no existe POST /:id/convertir-en-factura');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(
    { params: { id: '1' }, body: {}, merchantId: 7, userRole: 'admin', user: { id: 1 } }, res, () => {},
  );
  return { salida, escrituras };
}

test('SCRUM-887b · 🔴 albarán de un presupuesto con descuento global: 409 con código propio y CERO escrituras', async () => {
  const casos = {
    'B · un IVA': { id: 7, quoteNumber: 'P-1', lines: C3_UN_IVA, discountGlobalAmount: 25 },
    'C · IVA mezclado': {
      id: 7, quoteNumber: 'P-1', discountGlobalAmount: { toString: () => '25.00', valueOf: () => 25 },
      lines: [C3_UN_IVA[0], { ...C3_UN_IVA[1], tax: 0.10 }, C3_UN_IVA[2]],
    },
  };
  for (const [nombre, quote] of Object.entries(casos)) {
    const { salida, escrituras } = await convertirAlbaran(quote);
    assert.equal(salida?.code, 409, `🔴 ${nombre}: el albarán se ha convertido (${salida?.code}) — ${JSON.stringify(salida?.body)}`);
    assert.equal(salida.body.error, 'albaran_con_descuento_global', `🔴 ${nombre}: el rechazo no lleva su código propio`);
    assert.deepEqual(escrituras, [], `🔴 ${nombre}: se escribió antes de rechazar: ${escrituras.join(', ')}`);
  }
});

test('SCRUM-887b · ✅ CONTROL: el mismo albarán SIN descuento global sí llega a emitir', async () => {
  // Sin este control, un 409 de otra puerta (modo, firma, casación) pasaría por el rechazo nuevo.
  const { escrituras } = await convertirAlbaran({ id: 7, quoteNumber: 'P-1', lines: C3_UN_IVA, discountGlobalAmount: null });
  assert.ok(escrituras.includes('$transaction'), `🔴 CIEGO: sin global el albarán tampoco llega a emitir (${escrituras.join(', ') || 'nada'})`);
});

// SCRUM-888g (punto 7 de SCRUM-888) · LA PÁGINA DE FIRMA ENSEÑA EL IMPORTE DE LA SEÑAL.
//
// EL DEFECTO, medido en staging el 16-sep-2026 (presupuesto #4 del merchant QA, borrador):
//
//   · Condiciones `paymentTerms: 'MANUAL'` + plan propio `Señal 30 % / Resto al terminar 70 %`,
//     total 970,23 €. La página `/pay/quote/:token` pintaba la píldora de condiciones con el
//     código crudo «MANUAL» y **ningún 291,07 €** —que es exactamente lo que se emitió como señal
//     al aceptar el #6, con las mismas líneas—. El cliente firmaba sin saber cuánto paga.
//   · La causa: `termsLabel` (quoteDecisionLanding.routes.ts) sólo conoce FIFTY_FIFTY y
//     FULL_UPFRONT, devuelve cualquier otro código TAL CUAL, e ignora `customBillingPlan`.
//   · Y el camino normal del editor es peor: un plan propio se guarda con `paymentTerms: null`
//     (quotesView.js, opción «CUSTOM»), y con null la página no pinta NINGUNA condición.
//
// LA REGLA DEL ARREGLO: el importe de la señal sale de la MISMA función que el cobro. Nada de un
// segundo cálculo. Por eso el importe esperado de este test NO se calcula con la función que use
// la página, sino recomponiendo LITERALMENTE lo que hace la emisión al aceptar
// (`quotes.routes.ts`: `resolveBillingPlan` → `stageLinesReconciled(lines, plan, i,
// distributeStageAmounts(total, plan)[i])` → `grossOfLines`). Si la página calculara por su
// cuenta y divergiera en un céntimo, esto cae.
//
// ⚠️ MIRA EL HTML RENDERIZADO para lo visible (la trampa de auto-referencia de un guard de
// texto), y el ÁRBOL (AST) para «no hay segundo cálculo».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderQuoteDetail } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
import { resolveBillingPlan, distributeStageAmounts } from '../dist/modules/quotes/domain/billingPlan.js';
import { stageLinesReconciled, grossOfLines } from '../dist/modules/invoicing/domain/invoiceLines.service.js';
import { formatMoneyEs } from '../dist/core/utils/utils.js';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const PLAN_30_70 = [
  { label: 'Señal', percentage: 0.3 },
  { label: 'Resto al terminar', percentage: 0.7 },
];

/** Las líneas del C4 de SCRUM-883, tal cual están en staging (todas al 21 %). */
const presupuesto = ({ paymentTerms = null, customBillingPlan = null } = {}) => ({
  id: 1875,
  quoteNumber: 4,
  currency: 'EUR',
  total: 970.23,
  status: 'draft',
  createdAt: new Date('2026-09-16T10:00:00Z'),
  validUntil: null,
  paymentTerms,
  customBillingPlan,
  merchant: { name: 'Electricidad QA', legalName: null, logoUrl: null, address: null, country: 'ES', timezone: 'Europe/Madrid' },
  customer: { name: 'Cliente' },
  lines: [
    { concept: 'Cuadro eléctrico', qty: 1, price: 689, tax: 0.21 },
    { concept: 'Metro de cable', qty: 23, price: 2.37, tax: 0.21 },
    { concept: 'Desplazamiento', qty: 1, price: 58.33, tax: 0.21 },
  ],
});

/** Lo que la EMISIÓN cobra como tramo `i` al aceptar — recompuesto, no importado de la página. */
function importeQueEmite(q, i) {
  const plan = resolveBillingPlan(q);
  const lineas = stageLinesReconciled(q.lines, plan, i, distributeStageAmounts(q.total, plan)[i]);
  return grossOfLines(lineas);
}

/** Texto VISIBLE: sin etiquetas, sin atributos (un `data-*` interno no lo lee nadie). */
const visible = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ');

const CODIGOS_INTERNOS = /\b(MANUAL|SIN_CONDICIONES|FULL_UPFRONT|FIFTY_FIFTY|CUSTOM|fifty_fifty_\w+|full_upfront_\w+)\b/;

// ── SUELO ───────────────────────────────────────────────────────────────────────────────────
test('SCRUM-888g · SUELO: la fixture monta la página y el cobro da la señal medida en staging', () => {
  const q = presupuesto({ paymentTerms: 'MANUAL', customBillingPlan: PLAN_30_70 });
  const html = renderQuoteDetail(q, 'tok');
  assert.ok(html.includes('Cuadro eléctrico'), 'la fixture no encaja: no sale la línea');
  assert.ok(html.includes(formatMoneyEs(970.23, 'EUR')), 'la fixture no encaja: no sale el total');
  // El 291,07 es el `total` de la factura de señal que emitió staging para estas líneas (#6).
  assert.equal(importeQueEmite(q, 0), 291.07, 'la recomposición de la emisión no reproduce la señal real');
});

// ── ROJO ────────────────────────────────────────────────────────────────────────────────────
for (const [caso, paymentTerms] of [['MANUAL + plan propio (staging)', 'MANUAL'], ['null + plan propio (editor)', null]]) {
  test(`SCRUM-888g · 🔴 con señal, la firma enseña su importe — ${caso}`, () => {
    const q = presupuesto({ paymentTerms, customBillingPlan: PLAN_30_70 });
    const html = renderQuoteDetail(q, 'tok');
    const senal = formatMoneyEs(importeQueEmite(q, 0), 'EUR');
    assert.ok(
      visible(html).includes(senal),
      `🔴 EL CLIENTE FIRMA SIN SABER CUÁNTO PAGA AL ACEPTAR.\n` +
        `  El cobro de la señal emitirá ${senal} y la página de firma no lo enseña.`,
    );
  });
}

// ── NEGATIVO: ningún identificador interno a la vista ────────────────────────────────────────
for (const [caso, datos] of [
  ['MANUAL + plan propio', { paymentTerms: 'MANUAL', customBillingPlan: PLAN_30_70 }],
  ['MANUAL sin plan', { paymentTerms: 'MANUAL' }],
  ['SIN_CONDICIONES sin plan', { paymentTerms: 'SIN_CONDICIONES' }],
  ['FIFTY_FIFTY', { paymentTerms: 'FIFTY_FIFTY' }],
  ['FULL_UPFRONT', { paymentTerms: 'FULL_UPFRONT' }],
]) {
  test(`SCRUM-888g · 🔴 ningún código interno a la vista del cliente — ${caso}`, () => {
    const m = visible(renderQuoteDetail(presupuesto(datos), 'tok')).match(CODIGOS_INTERNOS);
    assert.equal(m, null, `🔴 el cliente lee el código interno «${m?.[0]}» en la página de firma`);
  });
}

// ── POSITIVO: sin señal, la página no cambia ────────────────────────────────────────────────
test('SCRUM-888g · sin señal la página NO cambia — pago completo y sin condiciones', () => {
  const full = renderQuoteDetail(presupuesto({ paymentTerms: 'FULL_UPFRONT' }), 'tok');
  assert.match(full, /<span class="terms-badge">Pago completo al aceptar<\/span>/, 'cambió la píldora del pago completo');
  assert.doesNotMatch(full, /senal-policy/, 'el pago completo no tiene política de señal');

  const sin = renderQuoteDetail(presupuesto(), 'tok');
  assert.doesNotMatch(sin, /terms-badge|senal-policy/, 'sin condiciones no se pinta ninguna');

  // Ningún importe nuevo: sólo los de siempre (líneas, base, IVA y total), en su orden. Lista
  // medida sobre `main` antes del arreglo.
  for (const html of [full, sin]) {
    const importes = (visible(html).match(/\d{1,3}(?:\.\d{3})*,\d{2}\s?€/g) || []).map((s) => s.replace(/\s/g, ' '));
    assert.deepEqual(
      importes,
      [
        '689,00 €',
        '54,51 €',
        '58,33 €',
        '801,84 €',
        '168,39 €',
        '970,23 €',
      ],
      'sin señal apareció o desapareció un importe',
    );
  }
});

// ── Y SIN SEGUNDO CÁLCULO (AST) ──────────────────────────────────────────────────────────────
test('SCRUM-888g · 🔴 la página toma la señal de la vista del plan, sin calcular por su cuenta', () => {
  const src = readFileSync(new URL('../src/modules/system/app/routes/quoteDecisionLanding.routes.ts', import.meta.url), 'utf8');
  const sf = ts.createSourceFile('landing.ts', src, ts.ScriptTarget.Latest, true);
  const importados = new Set();
  const llamados = new Set();
  const visitar = (n) => {
    if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
      for (const e of n.importClause.namedBindings.elements) importados.add(e.name.text);
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) llamados.add(n.expression.text);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  // Control positivo del instrumento: el extractor VE lo que ya hay.
  assert.ok(importados.has('calcVatBreakdown') && llamados.has('calcVatBreakdown'), 'el extractor AST está ciego');

  assert.ok(llamados.has('buildBillingPlanView'),
    '🔴 la página no pide la señal a `buildBillingPlanView` — la vista que usa el mismo reparto que la emisión');
  const segundos = ['distributeStageAmounts', 'getStageAmount', 'stageAmountsFromLines', 'stageLinesReconciled', 'grossOfLines', 'getBillingPlan', 'resolveBillingPlan']
    .filter((f) => llamados.has(f));
  assert.deepEqual(segundos, [], `🔴 SEGUNDO CÁLCULO de tramos en la página de firma: ${segundos.join(', ')}`);
});

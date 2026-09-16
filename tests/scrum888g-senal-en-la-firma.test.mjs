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
// (`quotes.routes.ts`: `resolveBillingPlan` → `stageLinesReconciled(lineasParaFacturar(quote), plan, i,
// distributeStageAmounts(total, plan)[i])` → `grossOfLines`). Si la página calculara por su
// cuenta y divergiera en un céntimo, esto cae.
//
// ⚠️ LÍMITE DECLARADO: el AST caza cualquier llamada a las funciones de reparto desde la página, y
// los importes caen si divergen en ESTOS casos. Una aritmética escrita a mano que coincidiera en
// todos ellos no se vería (con el 30/70 del ticket, «total × %» redondea igual; lo caza FIFTY_FIFTY).
//
// ⚠️ MIRA EL HTML RENDERIZADO para lo visible (la trampa de auto-referencia de un guard de
// texto), y el ÁRBOL (AST) para «no hay segundo cálculo».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderQuoteDetail } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
import { resolveBillingPlan, distributeStageAmounts } from '../dist/modules/quotes/domain/billingPlan.js';
import { stageLinesReconciled, grossOfLines, lineasParaFacturar } from '../dist/modules/invoicing/domain/invoiceLines.service.js';
import { formatMoneyEs } from '../dist/core/utils/utils.js';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const PLAN_30_70 = [
  { label: 'Señal', percentage: 0.3 },
  { label: 'Resto al terminar', percentage: 0.7 },
];

/** Las líneas del C4 de SCRUM-883, tal cual están en staging (todas al 21 %). */
const presupuesto = ({ paymentTerms = null, customBillingPlan = null, lines = null, total = 970.23 } = {}) => ({
  id: 1875,
  quoteNumber: 4,
  currency: 'EUR',
  total,
  status: 'draft',
  createdAt: new Date('2026-09-16T10:00:00Z'),
  validUntil: null,
  paymentTerms,
  customBillingPlan,
  // SCRUM-887: la emisión exige que venga cargado (`include` lo trae siempre de la BD; null = sin global).
  discountGlobalAmount: null,
  merchant: { name: 'Electricidad QA', legalName: null, logoUrl: null, address: null, country: 'ES', timezone: 'Europe/Madrid' },
  customer: { name: 'Cliente' },
  lines: lines ?? [
    { concept: 'Cuadro eléctrico', qty: 1, price: 689, tax: 0.21 },
    { concept: 'Metro de cable', qty: 23, price: 2.37, tax: 0.21 },
    { concept: 'Desplazamiento', qty: 1, price: 58.33, tax: 0.21 },
  ],
});

/** Lo que la EMISIÓN cobra como tramo `i` al aceptar — recompuesto, no importado de la página. */
function importeQueEmite(q, i) {
  const plan = resolveBillingPlan(q);
  // SCRUM-887: la emisión factura `lineasParaFacturar` (el dto de línea aplicado), no `quote.lines` a pelo.
  const lineas = stageLinesReconciled(lineasParaFacturar(q), plan, i, distributeStageAmounts(q.total, plan)[i]);
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

// ── LA PÍLDORA, tal cual se lee ─────────────────────────────────────────────────────────────
/** Texto de la píldora de condiciones, o `null` si no hay. Espacios normalizados (el € va con nbsp). */
function pildora(html) {
  const m = html.match(/<span class="terms-badge"[^>]*>([\s\S]*?)<\/span>/);
  return m ? visible(m[1]).replace(/\s+/g, ' ').trim() : null;
}
const euros = (n) => formatMoneyEs(n, 'EUR').replace(/\s/g, ' ');

// ── ROJO · 1 · plan propio: «{tramo}: {importe} · {tramo}: {importe}» ─────────────────────────
// Firma del formato: SCRUM-888 comentario 15624. Los nombres son los del plan; lo nuestro, «: » y « · ».
for (const [caso, paymentTerms] of [['MANUAL + plan propio (staging)', 'MANUAL'], ['null + plan propio (editor)', null]]) {
  test(`SCRUM-888g · 🔴 con señal, la firma enseña su importe — ${caso}`, () => {
    const q = presupuesto({ paymentTerms, customBillingPlan: PLAN_30_70 });
    const esperado = `Señal: ${euros(importeQueEmite(q, 0))} · Resto al terminar: ${euros(importeQueEmite(q, 1))}`;
    assert.equal(esperado, 'Señal: 291,07 € · Resto al terminar: 679,16 €', 'la recomposición de la emisión cambió');
    assert.equal(
      pildora(renderQuoteDetail(q, 'tok')),
      esperado,
      `🔴 EL CLIENTE FIRMA SIN SABER CUÁNTO PAGA AL ACEPTAR.\n` +
        `  El cobro emitirá lo de «${esperado}» y la página de firma no lo enseña así.`,
    );
  });
}

// ── Y CON DTO DE LÍNEA (SCRUM-887): la señal es la que cobra la emisión, con el dto aplicado ──────
test('SCRUM-888g · con dto de línea, la píldora enseña lo que cobra la emisión (no el precio sin dto)', () => {
  const lines = [
    { concept: 'Cuadro eléctrico', qty: 1, price: 689, tax: 0.21, dto: 10 },
    { concept: 'Desplazamiento', qty: 1, price: 58.33, tax: 0.21 },
  ];
  const total = grossOfLines(lineasParaFacturar({ lines, discountGlobalAmount: null }));
  const conDto = presupuesto({ customBillingPlan: PLAN_30_70, lines, total });
  const esperado = `Señal: ${euros(importeQueEmite(conDto, 0))} · Resto al terminar: ${euros(importeQueEmite(conDto, 1))}`;
  // Control: el dto mueve el importe. Si no lo moviera, este caso no distinguiría nada.
  const sinDto = presupuesto({ customBillingPlan: PLAN_30_70, lines: lines.map(({ dto, ...l }) => l), total });
  assert.notEqual(importeQueEmite(conDto, 0), grossOfLines(stageLinesReconciled(sinDto.lines, resolveBillingPlan(sinDto), 0)),
    'el dto no mueve la señal: el caso no discrimina');
  assert.equal(pildora(renderQuoteDetail(conDto, 'tok')), esperado, '🔴 con dto de línea la firma promete otra señal que la que se cobra');
});

// ── ROJO · 2 · los planes de serie: el MISMO formato, con sus textos ya aprobados ─────────────
for (const [paymentTerms, nombres] of [
  ['FIFTY_FIFTY', ['50% al aceptar', '50% al finalizar']],
  ['FULL_UPFRONT', ['Pago completo al aceptar']],
]) {
  test(`SCRUM-888g · 🔴 plan de serie con importe, mismo formato — ${paymentTerms}`, () => {
    const q = presupuesto({ paymentTerms });
    const esperado = nombres.map((n, i) => `${n}: ${euros(importeQueEmite(q, i))}`).join(' · ');
    assert.equal(pildora(renderQuoteDetail(q, 'tok')), esperado, `🔴 la píldora de ${paymentTerms} no dice lo que cobrará la emisión`);
  });
}

// ── ROJO · 4 · con opciones a elegir: PORCENTAJE en lugar de importe ─────────────────────────
// El importe depende de la opción que elija el cliente: antes de elegir no hay uno verdadero.
for (const [caso, datos, esperado] of [
  ['plan propio', { customBillingPlan: PLAN_30_70 }, 'Señal: 30% · Resto al terminar: 70%'],
  ['FIFTY_FIFTY', { paymentTerms: 'FIFTY_FIFTY' }, '50% al aceptar: 50% · 50% al finalizar: 50%'],
  ['FULL_UPFRONT', { paymentTerms: 'FULL_UPFRONT' }, 'Pago completo al aceptar: 100%'],
]) {
  test(`SCRUM-888g · 🔴 con opciones a elegir, porcentaje y no importe — ${caso}`, () => {
    const html = renderQuoteDetail(presupuesto(datos), 'tok', { min: 500 });
    assert.equal(pildora(html), esperado, '🔴 con tiers la píldora no lleva el porcentaje de cada tramo');
    assert.doesNotMatch(pildora(html) ?? '', /€/, '🔴 con tiers la píldora promete un importe que aún no existe');
  });
}

// ── NEGATIVO: ningún identificador interno a la vista, en NINGÚN caso ────────────────────────
const TODOS = [
  ['MANUAL + plan propio', { paymentTerms: 'MANUAL', customBillingPlan: PLAN_30_70 }],
  ['null + plan propio', { customBillingPlan: PLAN_30_70 }],
  ['MANUAL sin plan', { paymentTerms: 'MANUAL' }],
  ['SIN_CONDICIONES sin plan', { paymentTerms: 'SIN_CONDICIONES' }],
  ['FIFTY_FIFTY', { paymentTerms: 'FIFTY_FIFTY' }],
  ['FULL_UPFRONT', { paymentTerms: 'FULL_UPFRONT' }],
  ['sin condiciones', {}],
];
for (const [caso, datos] of TODOS) {
  for (const tiers of [null, { min: 500 }]) {
    test(`SCRUM-888g · 🔴 ningún código interno a la vista del cliente — ${caso}${tiers ? ' · con tiers' : ''}`, () => {
      const m = visible(renderQuoteDetail(presupuesto(datos), 'tok', tiers)).match(CODIGOS_INTERNOS);
      assert.equal(m, null, `🔴 el cliente lee el código interno «${m?.[0]}» en la página de firma`);
    });
  }
}

// ── 3 · MANUAL / SIN_CONDICIONES sin plan: sin píldora, IGUAL que null ───────────────────────
for (const paymentTerms of ['MANUAL', 'SIN_CONDICIONES']) {
  test(`SCRUM-888g · 🔴 ${paymentTerms} sin plan se pinta EXACTAMENTE igual que sin condiciones`, () => {
    for (const tiers of [null, { min: 500 }]) {
      assert.equal(
        renderQuoteDetail(presupuesto({ paymentTerms }), 'tok', tiers),
        renderQuoteDetail(presupuesto(), 'tok', tiers),
        `🔴 ${paymentTerms} sin plan no se pinta como null`,
      );
    }
  });
}

// ── POSITIVO: sin señal ni plan, la página queda como en main ─────────────────────────────────
// La igualdad byte a byte con `main` se midió al construir (registro en docs/master/SCRUM-888g.md);
// lo que queda vigilado aquí es lo que la define: sin píldora, sin política, y los mismos importes.
test('SCRUM-888g · sin señal ni plan la página NO cambia — ni píldora, ni política, ni importes nuevos', () => {
  const sin = renderQuoteDetail(presupuesto(), 'tok');
  assert.doesNotMatch(sin, /terms-badge|senal-policy/, 'sin condiciones no se pinta ninguna');
  // Control del detector: con condiciones, el MISMO patrón sí las ve (una negación sin hermano no prueba nada).
  assert.match(renderQuoteDetail(presupuesto({ paymentTerms: 'FIFTY_FIFTY' }), 'tok'), /terms-badge|senal-policy/, 'el detector de píldora está ciego');
  const importes = (visible(sin).match(/\d{1,3}(?:\.\d{3})*,\d{2}\s?€/g) || []).map((s) => s.replace(/\s/g, ' '));
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
});

// ── Y LA POLÍTICA DE SEÑAL (V8) NO SE MUEVE: sigue sólo con FIFTY_FIFTY ────────────────────────
test('SCRUM-888g · la política «La señal no es reembolsable» sigue donde estaba', () => {
  assert.match(renderQuoteDetail(presupuesto({ paymentTerms: 'FIFTY_FIFTY' }), 'tok'), /senal-policy/);
  assert.doesNotMatch(renderQuoteDetail(presupuesto({ paymentTerms: 'FULL_UPFRONT' }), 'tok'), /senal-policy/);
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

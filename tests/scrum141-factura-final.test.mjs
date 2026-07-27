// SCRUM-141 (FISCAL-1a) — el total de una factura es CONSECUENCIA de sus líneas, y motor de la
// factura final con deducción de anticipos.
//
// PUROS y SIN GATE (mismo criterio que vat.test.mjs): no tocan BD ni levantan servidor. Lo que
// protegen es DINERO SELLADO: `Invoice.total` va a `importeTotal` de la huella VeriFactu y
// `calcVatCuotaTotal(lines)` a `cuotaTotal` — dos campos de la MISMA huella, encadenada
// (`vfPrevHash`) e inmutable (regla 29). Un céntimo de descuadre entre ellos NO es "un céntimo
// mal": es un céntimo mal PARA SIEMPRE, corregible solo emitiendo una R1.
import test from 'node:test';
import assert from 'node:assert/strict';

const { getBillingPlan, distributeStageAmounts } = await import('../dist/modules/quotes/domain/billingPlan.js');
const { calcVatBreakdown } = await import('../dist/modules/invoicing/domain/vat.service.js');
const { stageLines, stageLinesReconciled, grossOfLines, stageAmountsFromLines } =
  await import('../dist/modules/invoicing/domain/invoiceLines.service.js');
const { buildFinalInvoice } = await import('../dist/modules/invoicing/domain/finalInvoice.service.js');
const { buildBillingPlanView } = await import('../dist/modules/quotes/domain/billingPlanView.js');

const round2 = (n) => Math.round(n * 100) / 100;
const brutoDe = (lines) => round2(lines.reduce((s, l) => s + (Number(l.qty) || 1) * Number(l.price) * (1 + (Number(l.tax) || 0)), 0));
const planCustom = (...pcts) => pcts.map((p, i) => ({ index: i, percentage: p, label: `t${i}` }));

// ── 1 · LA INVARIANTE QUE CIERRA LOS 3 TODO ────────────────────────────────────────────────
// El total emitido SIEMPRE es el bruto de las propias líneas de esa factura. Por construcción,
// no por suerte: `grossOfLines` es literalmente lo que se guarda en `Invoice.total`.

test('SCRUM-141: cada tramo emite un total que es EXACTAMENTE el bruto de sus líneas', () => {
  const lines = [{ concept: 'Obra', qty: 1, price: 82.65, tax: 0.21 }]; // total 100,01 (céntimo impar)
  assert.equal(brutoDe(lines), 100.01, 'fixture: total impar en céntimos, que es donde mordía el bug');

  for (const plan of [getBillingPlan('FIFTY_FIFTY'), planCustom(0.3, 0.4, 0.3)]) {
    plan.forEach((_, i) => {
      const del = stageLines(lines, plan, i);
      const total = grossOfLines(del);
      // Lo que se sella en la huella: importeTotal (el total) vs cuotaTotal (de las líneas).
      const bd = calcVatBreakdown(del);
      assert.equal(round2(bd.base + bd.cuota), total, `tramo ${i}: base+cuota == Invoice.total`);
    });
  }
});

test('SCRUM-141: los precios de los tramos suman EXACTAMENTE el precio original de cada línea', () => {
  // Esta es la garantía a nivel de línea: el reparto no pierde ni inventa dinero, aunque el
  // BRUTO de cada tramo se redondee después. `p·0,3 + p·0,4 + (p − p·0,3 − p·0,4) === p`.
  const lines = [
    { concept: 'A', qty: 2, price: 33.333, tax: 0.21 },
    { concept: 'B', qty: 1, price: 12.5, tax: 0.10 },
  ];
  const plan = planCustom(0.3, 0.4, 0.3);
  const porTramo = plan.map((_, i) => stageLines(lines, plan, i));

  lines.forEach((orig, li) => {
    const suma = porTramo.reduce((s, tramo) => s + Number(tramo[li].price), 0);
    assert.ok(Math.abs(suma - orig.price) < 1e-9, `línea ${li}: los precios de los tramos suman el original`);
  });
});

test('SCRUM-141: multi-IVA — el reparto conserva los tipos, no los mezcla', () => {
  const lines = [
    { concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 },
    { concept: 'Material', qty: 3, price: 33.33, tax: 0.10 },
  ];
  const plan = getBillingPlan('FIFTY_FIFTY');
  plan.forEach((_, i) => {
    const rates = calcVatBreakdown(stageLines(lines, plan, i)).entries.map((e) => e.rate).sort((a, b) => a - b);
    assert.deepEqual(rates, [10, 21], `tramo ${i}: deben conservarse los dos tipos (el 303 depende de esto)`);
  });
});

test('SCRUM-141: plan de un solo tramo (100 %) → las líneas del presupuesto, intactas', () => {
  const lines = [{ concept: 'Obra', qty: 3, price: 33.333, tax: 0.21 }];
  const plan = getBillingPlan('FULL_UPFRONT');
  const del = stageLines(lines, plan, 0);
  assert.equal(del[0].price, 33.333, 'al 100 % el precio no se toca');
  assert.equal(grossOfLines(del), brutoDe(lines), 'y el total es el bruto de esas mismas líneas');
});

test('SCRUM-141: casos degenerados — sin líneas, sin plan o índice fuera de rango → []', () => {
  const plan = getBillingPlan('FIFTY_FIFTY');
  assert.deepEqual(stageLines([], plan, 0), []);
  assert.deepEqual(stageLines([{ qty: 1, price: 10, tax: 0 }], [], 0), []);
  assert.deepEqual(stageLines([{ qty: 1, price: 10, tax: 0 }], plan, 5), []);
  assert.deepEqual(stageLines([{ qty: 1, price: 10, tax: 0 }], plan, -1), []);
});

// ── 2 · LA VISTA DEL PLAN NO PROMETE UN IMPORTE DISTINTO DEL QUE SE EMITE ───────────────────

test('SCRUM-141: billingPlanView muestra el MISMO importe que emitirá el endpoint', () => {
  const lines = [{ concept: 'Obra', qty: 1, price: 82.65, tax: 0.21 }];
  const quote = { total: '100.01', currency: 'EUR', paymentTerms: 'FIFTY_FIFTY', lines };
  const view = buildBillingPlanView(quote, 0);
  const plan = getBillingPlan('FIFTY_FIFTY');
  const objetivos = distributeStageAmounts('100.01', plan);

  view.billingPlan.forEach((v, i) => {
    // Se compara contra la MISMA llamada que hacen los 3 puntos de emisión (reconciliada),
    // no contra el reparto crudo: si divergieran, el usuario vería un importe y le llegaría otro.
    assert.equal(v.amount, grossOfLines(stageLinesReconciled(lines, plan, i, objetivos[i])),
      `tramo ${i}: la UI promete exactamente lo que se emitirá`);
  });
  // Y en este caso, además, coincide con el reparto aritmético (la reconciliación lo alcanza).
  assert.deepEqual(view.billingPlan.map((v) => v.amount), [50.01, 50]);
});

test('SCRUM-141: sin líneas guardadas, la vista cae al reparto aritmético (respaldo, no silencio)', () => {
  const view = buildBillingPlanView({ total: '100.01', currency: 'EUR', paymentTerms: 'FIFTY_FIFTY' }, 0);
  assert.deepEqual(view.billingPlan.map((v) => v.amount), [50.01, 50],
    'sin líneas se mantiene el comportamiento de SCRUM-32 (presupuestos antiguos)');
});

// ── 3 · MOTOR DE LA FACTURA FINAL (deducción de lo ya facturado) ────────────────────────────

test('SCRUM-141: caso 50/50 del ticket — final 200 € menos anticipo 100 €, IVA solo sobre el resto', () => {
  const lineasObra = [{ concept: 'Reforma baño', qty: 1, price: 200, tax: 0.21 }]; // 242,00 bruto
  const anticipo = {
    id: 7, number: '2026-CF-001', fecha: new Date('2026-03-10T10:00:00Z'),
    total: 121, lines: [{ concept: 'Anticipo 50 %', qty: 1, price: 100, tax: 0.21 }],
  };

  const r = buildFinalInvoice({ lines: lineasObra, total: 242, deducted: [anticipo] });

  assert.equal(r.total, 121, 'final = 242 − 121 anticipado');
  assert.equal(grossOfLines(r.lines), 121, 'las líneas de la final suman exactamente su total');

  const bd = calcVatBreakdown(r.lines);
  assert.equal(bd.base, 100, 'base neta = 200 − 100');
  assert.equal(bd.cuota, 21, 'IVA solo sobre los 100 € pendientes, no sobre los 200');

  assert.deepEqual(
    { invoiceId: r.deductsRefs[0].invoiceId, number: r.deductsRefs[0].number, base: r.deductsRefs[0].base, cuota: r.deductsRefs[0].cuota },
    { invoiceId: 7, number: '2026-CF-001', base: 100, cuota: 21 },
    'la referencia identifica el documento descontado con su base y cuota (auditable)',
  );
});

test('SCRUM-141: el 100 % ya anticipado → final a 0 € (expediente fiscal §P3)', () => {
  const deducted = [
    { id: 1, number: '2026-CF-001', fecha: '2026-03-01', total: 121, lines: [{ qty: 1, price: 100, tax: 0.21 }] },
    { id: 2, number: '2026-CF-002', fecha: '2026-04-01', total: 121, lines: [{ qty: 1, price: 100, tax: 0.21 }] },
  ];
  const r = buildFinalInvoice({ lines: [{ concept: 'Obra', qty: 1, price: 200, tax: 0.21 }], total: 242, deducted });

  assert.equal(r.total, 0, 'si se anticipó todo, la final cierra a 0 €');
  assert.equal(grossOfLines(r.lines), 0, 'y sus líneas también suman 0');
  assert.equal(calcVatBreakdown(r.lines).cuota, 0, 'cuota neta 0: no se repercute IVA dos veces');
  assert.equal(r.deductsRefs.length, 2, 'ambos anticipos quedan referenciados');
});

test('SCRUM-141: deducción MULTI-IVA — una línea negativa por tipo, no una por documento', () => {
  // Si se dedujera el total en UNA sola línea habría que elegir un tipo, y el 303 saldría mal.
  const anticipo = {
    id: 9, number: '2026-CF-005', fecha: '2026-05-01', total: 154,
    lines: [{ qty: 1, price: 100, tax: 0.21 }, { qty: 1, price: 30, tax: 0.10 }], // 121 + 33 = 154
  };
  const r = buildFinalInvoice({ lines: [{ concept: 'Obra', qty: 1, price: 200, tax: 0.21 }], total: 242, deducted: [anticipo] });

  const negativas = r.lines.filter((l) => Number(l.price) < 0);
  assert.equal(negativas.length, 2, 'una negativa por CADA tipo de IVA del documento descontado');
  assert.deepEqual(negativas.map((l) => l.tax).sort(), [0.1, 0.21],
    'las negativas conservan los tipos originales: neutralizan la cuota que se repercutió');
  assert.equal(r.total, 88, '242 − 154');
  assert.equal(grossOfLines(r.lines), 88, 'y las líneas cuadran con ese total');
});

test('SCRUM-141: documento SIN líneas → se deduce su total y se MARCA sinDesglose (no se inventa el IVA)', () => {
  const legacy = { id: 3, number: '2025-CF-099', fecha: '2025-12-01', total: 121, lines: null };
  const r = buildFinalInvoice({ lines: [{ concept: 'Obra', qty: 1, price: 200, tax: 0.21 }], total: 242, deducted: [legacy] });

  assert.equal(r.deductsRefs[0].sinDesglose, true, 'queda VISIBLE que esa deducción no lleva desglose de IVA');
  assert.equal(r.total, 121, 'se deduce su bruto igualmente');
  // Adivinar un tipo descuadraría el 303 en silencio; marcarlo deja el problema auditable.
  assert.equal(r.lines.find((l) => Number(l.price) < 0).tax, 0, 'se deduce como base a 0 %, sin suponer un tipo');
});

test('SCRUM-141: sin nada que deducir → la final es la operación completa', () => {
  const r = buildFinalInvoice({ lines: [{ concept: 'Obra', qty: 1, price: 200, tax: 0.21 }], total: 242, deducted: [] });
  assert.equal(r.total, 242);
  assert.deepEqual(r.deductsRefs, []);
  assert.equal(r.lines.length, 1, 'sin líneas negativas');
});

// ── 4 · FUZZ: la invariante aguanta, no acierta por suerte ──────────────────────────────────

test('SCRUM-141 (fuzz): en 45.000 tramos, el total emitido SIEMPRE es el bruto de sus líneas', () => {
  const tipos = [0, 0.04, 0.10, 0.21];
  const planes = [getBillingPlan('FULL_UPFRONT'), getBillingPlan('FIFTY_FIFTY'), planCustom(0.3, 0.4, 0.3), planCustom(0.15, 0.35, 0.5)];
  let comprobados = 0;
  let conDeriva = 0;      // tramos donde el importe del plan era INALCANZABLE
  let desviacionMax = 0;  // cuánto se aleja la suma de facturas del total del presupuesto

  for (let caso = 0; caso < 20000; caso++) {
    const nLineas = 1 + (caso % 3);
    const lines = Array.from({ length: nLineas }, (_, i) => ({
      concept: `L${i}`,
      qty: 1 + ((caso + i) % 4),
      price: Math.round((5 + ((caso * 7.77 + i * 3.13) % 300)) * 1000) / 1000, // decimales incómodos
      tax: tipos[(caso + i) % tipos.length],
    }));
    const plan = planes[caso % planes.length];
    const total = brutoDe(lines);
    const objetivos = distributeStageAmounts(total, plan);

    let suma = 0;
    plan.forEach((_, i) => {
      const del = stageLinesReconciled(lines, plan, i, objetivos[i]);
      const emitido = grossOfLines(del);
      const bd = calcVatBreakdown(del);
      // LA INVARIANTE INNEGOCIABLE: lo que se sella como `importeTotal` es EXACTAMENTE
      // base+cuota de las líneas que se sellan con él. Nunca puede fallar — es lo único que
      // no se puede arreglar después (huella inmutable y encadenada, regla 29).
      assert.equal(round2(bd.base + bd.cuota), emitido, `caso ${caso} tramo ${i}: descuadre DENTRO de la huella`);
      if (emitido !== round2(objetivos[i])) conDeriva++;
      suma += emitido;
      comprobados++;
    });
    desviacionMax = Math.max(desviacionMax, Math.abs(Math.round((round2(suma) - total) * 100)));
  }

  assert.ok(comprobados >= 45000, `deben comprobarse ≥45.000 tramos (fueron ${comprobados})`);

  // COSTE ACEPTADO Y MEDIDO (decisión del fundador, 27-jul-2026): cuando el importe aritmético
  // del tramo es INALCANZABLE (base y cuota redondean saltando ese valor), manda la coherencia
  // interna de la factura y la suma de las facturas queda a 1-2 céntimos del total del
  // presupuesto. Los dos topes de abajo existen para que ese coste no CREZCA sin que nadie lo
  // note: si suben, algo cambió en el reparto — hay que mirarlo, no subir el número.
  const pctDeriva = (conDeriva / comprobados) * 100;
  assert.ok(pctDeriva <= 1.5, `los tramos con deriva no deben pasar del 1,5 % (fue ${pctDeriva.toFixed(3)} %)`);
  assert.ok(desviacionMax <= 2, `la desviación máxima documentada es 2 céntimos (fue ${desviacionMax})`);
});

// tests/scrum887-el-cobro-es-lo-firmado.test.mjs — SCRUM-887 · PR 1 (caso A: descuento POR LÍNEA)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL CLIENTE PAGA LO QUE FIRMÓ, NI UN CÉNTIMO MÁS POR TENER UN DESCUENTO
//
// Medido en STAGING (SCRUM-883): un presupuesto con descuentos de línea firmado por 539,05 € se
// cobraba por 628,60 €. La firma enseña `Quote.total` (`calcTotal`, que SÍ aplica `dto`), y la
// factura —y con ella el cobro— sale de `calcVatBreakdown` sobre `Quote.lines` tal cual, que NO lo
// aplica: `base = qty * price`.
//
// ── LA DECISIÓN (SCRUM-887, comentarios 15616 y 15620 · 16-sep-2026) ─────────────────────────
//   ① El objetivo es el TOTAL FIRMADO (`calcTotal`). La factura sigue saliendo de SUS líneas con
//     la reconciliación de SCRUM-141 (`stageLinesReconciled` → `reconcileToTarget`), aplicando
//     el `dto` AL PRECIO antes de entrar. Sin aritmética nueva.
//     Coste aceptado: 1-2 céntimos en ~1,2 % de los casos, LA MISMA TASA que ya existe sin
//     descuento (la reconciliación no siempre alcanza el objetivo — SCRUM-141).
//   A · descuento por línea → se aplica (ESTE PR).
//   B · descuento global con un solo IVA → PR 2.  C · global con IVA mezclado → NO se improvisa.
//
// ── POR QUÉ `pieDePresupuesto` NO ES LA FUENTE (medido, 40.000 casos) ─────────────────────────
// `calcTotal` redondea la suma una vez; `calcVatBreakdown` redondea base y cuota POR TIPO. Sin
// ningún descuento discrepan en 1.498 de cada 10.000. Hacerla fuente movería céntimos de
// presupuestos que no tienen descuento.
//
// ── LA MUESTRA ES FIJA ────────────────────────────────────────────────────────────────────────
// Generador con semilla (mulberry32): la misma muestra en cada tanda y en cada máquina. Si un día
// falla, el caso que falla se puede reproducir con su índice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const { calcTotal } = await import(DIST + 'core/utils/utils.js');
const { grossOfLines, stageLinesReconciled } = await import(DIST + 'modules/invoicing/domain/invoiceLines.service.js');
const { calcVatBreakdown } = await import(DIST + 'modules/invoicing/domain/vat.service.js');
const { distributeStageAmounts } = await import(DIST + 'modules/quotes/domain/billingPlan.js');

/**
 * LAS LÍNEAS QUE LOS SEIS CAMINOS DE EMISIÓN METEN EN LA FACTURA. Hoy: `Quote.lines` tal cual.
 */
const lineasQueFactura = (quote) => (Array.isArray(quote.lines) ? quote.lines : []);

const PLANES = {
  entero: [{ index: 0, percentage: 1, label: 'full' }],
  '50/50': [{ index: 0, percentage: 0.5, label: 'a' }, { index: 1, percentage: 0.5, label: 'b' }],
  '30/70': [{ index: 0, percentage: 0.3, label: 'a' }, { index: 1, percentage: 0.7, label: 'b' }],
};

/** Lo que emiten los caminos de tramos: líneas del tramo reconciliadas contra el reparto del firmado. */
function facturasDe(quote, plan) {
  const lineas = lineasQueFactura(quote);
  const objetivos = distributeStageAmounts(quote.total, plan);
  return plan.map((_, i) => {
    const ls = stageLinesReconciled(lineas, plan, i, objetivos[i]);
    return { lineas: ls, importe: grossOfLines(ls) };
  });
}

const cents = (n) => Math.round(n * 100);

function muestra(semilla, n, tipo) {
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
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = pick(tipos);
    const lines = [];
    const k = 1 + Math.floor(rand() * 4);
    for (let j = 0; j < k; j++) {
      const tax = tipo === 'A_mixto' ? tipos[j % 2 === 0 ? 0 : 1 + Math.floor(rand() * 3)] : t0;
      const l = { concept: `L${j}`, qty: pick(qtys), price: pick(precios), tax };
      if (tipo !== 'SIN' && (j === 0 || rand() < 0.5)) l.dto = pick(dtos);
      lines.push(l);
    }
    const quote = { lines, discountGlobalAmount: null };
    quote.total = calcTotal(lines, null).toFixed(2);   // lo que se guarda y el cliente firma
    out.push(quote);
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO · C3 del electricista con descuentos de línea y UN solo IVA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-887 · 🔴 C3 con dto de línea: el cobro es EXACTAMENTE lo firmado, en todos los planes', () => {
  const lines = [
    { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
    { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.21 },
    { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
  ];
  const quote = { lines, discountGlobalAmount: null, total: calcTotal(lines, null).toFixed(2) };
  // SUELO: el firmado se LEE de `calcTotal`, y tiene que ser el descontado. Si no, el test
  // compararía dos cifras sin descuento y daría verde sin mirar nada.
  assert.equal(quote.total, '589.95', '🔴 CIEGO: el total firmado ya no es el descontado');

  for (const [nombre, plan] of Object.entries(PLANES)) {
    const f = facturasDe(quote, plan);
    const cobrado = f.reduce((a, x) => a + cents(x.importe), 0);
    assert.equal(cobrado, cents(589.95),
      `🔴 plan ${nombre}: el cliente firmó 589,95 € y se le cobran ${(cobrado / 100).toFixed(2)} €`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MUESTRA A · dto de línea, un solo IVA y IVA mezclado
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-887 · 🔴 caso A (2.000 + 2.000): cobro ≠ firmado sólo por 1-2 céntimos, y no más a menudo que sin descuento', () => {
  for (const tipo of ['A_uno', 'A_mixto']) {
    const quotes = muestra(887, 2000, tipo);
    assert.ok(quotes.filter((q) => q.lines.some((l) => l.dto > 0)).length === 2000,
      `🔴 CIEGO: la muestra ${tipo} tiene presupuestos sin descuento`);
    let distintos = 0;
    let peor = { d: 0 };
    quotes.forEach((q, i) => {
      const [f] = facturasDe(q, PLANES.entero);
      const d = Math.abs(cents(f.importe) - cents(Number(q.total)));
      if (d > 0) distintos++;
      if (d > peor.d) peor = { d, i, firmado: q.total, cobrado: f.importe };
    });
    assert.ok(peor.d <= 2,
      `🔴 ${tipo}: el caso ${peor.i} firma ${peor.firmado} € y se cobra ${peor.cobrado} € (${peor.d} cént.)`);
    // Techo: la tasa sin descuento en esta misma muestra es ~1,1 %. 1,5 % = 30 de 2.000.
    assert.ok(distintos <= 30, `🔴 ${tipo}: ${distintos} de 2.000 no cobran lo firmado (techo 30)`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ EL POSITIVO · sin descuento, los mismos céntimos que hoy
// ═════════════════════════════════════════════════════════════════════════════════════════════

// La huella de 10.000 presupuestos SIN descuento × 3 planes: importe, base y cuota de cada
// factura. Congelada con el código ANTERIOR a SCRUM-887. Si cambia UN céntimo, cambia la huella.
const HUELLA_SIN_DESCUENTO = '0f8e14d0ce42fab424daef3285864e4b09b90f5b788439174be180874a247753';

test('SCRUM-887 · ✅ sin descuento, 10.000 presupuestos × 3 planes dan los MISMOS céntimos que antes', () => {
  const quotes = muestra(20260916, 10000, 'SIN');
  assert.equal(quotes.filter((q) => q.lines.some((l) => 'dto' in l)).length, 0, '🔴 CIEGO: la muestra SIN trae dto');
  const h = createHash('sha256');
  let facturas = 0;
  for (const q of quotes) {
    for (const plan of Object.values(PLANES)) {
      for (const f of facturasDe(q, plan)) {
        const bd = calcVatBreakdown(f.lineas);
        h.update(`${cents(f.importe)}|${cents(bd.base)}|${cents(bd.cuota)};`);
        facturas++;
      }
    }
  }
  assert.equal(facturas, 50000, `🔴 CIEGO: se esperaban 50.000 facturas y se midieron ${facturas}`);
  assert.equal(h.digest('hex'), HUELLA_SIN_DESCUENTO,
    '🔴 un presupuesto SIN descuento ha cambiado de céntimos (importe, base o cuota). SCRUM-887 no '
    + 'puede mover nada que no tenga descuento, y el céntimo de SCRUM-624 no se toca.');
});

// tests/scrum1786b-cabeceras-fuera-de-factura.test.mjs — SCRUM-1786b (GO regla 40: SCRUM-1786 c.22269, P1)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNA CABECERA DE APARTADO ES UN TÍTULO DEL PRESUPUESTO, NO UNA LÍNEA DE FACTURA
//
// SCRUM-655 escribió que al facturar las cabeceras (`apartado: true`) no pasaban a `Invoice.lines`.
// Era falso (medido en SCRUM-1786a, c.22263): `lineasParaFacturar` las copiaba y ningún camino las
// quitaba. En la factura, la cabecera —sin `qty`, sin `price`, sin `tax`— abre en el desglose un tramo
// fantasma `0 % · base 0 · cuota 0`, y `clasificarDetalleDesglose` lanza
// `verifactu_desglose_no_clasificable`: el alta acaba en `encolado_fallido`.
//
// ── DÓNDE SE QUITAN, Y POR QUÉ NO DENTRO DE `lineasParaFacturar` (medido, 7 llamadores) ───────
//   · `stageLines` → los cuatro caminos de tramos (quotes, jobs, quotesAdmin ×2) y la vista del plan
//     (`stageAmountsFromLines`). Es el embudo común, y es de J1.
//   · `src/lib/invoicing.ts` (factura desde el cobro) → `lineasQueSuman(lineasParaFacturar(…))`, a la vista
//     del guard de SCRUM-887, que exige que esas líneas PROCEDAN de una llamada a `lineasParaFacturar`.
//   · El ALBARÁN NO: `casarLineas` busca la línea firmada POR POSICIÓN (`quoteLineIndex`) en la salida
//     de `lineasParaFacturar`. Quitar ahí las cabeceras correría los índices y facturaría el precio de
//     OTRA línea. Allí una cabecera ya no llega a factura: sin precio, va al adicional.
//
// ── CONTROL POSITIVO ──────────────────────────────────────────────────────────────────────────
// Un presupuesto SIN apartados sale idéntico a hoy: huella sha256 de todas las salidas, tomada
// del `dist/` de 609a46472 (antes del arreglo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { casosEscritos } from './_casos-escritos.mjs'; // SCRUM-1415 · un caso por fila, con su nombre escrito

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const { lineasParaFacturar, stageLinesReconciled, stageAmountsFromLines, grossOfLines } = await import(DIST + 'modules/invoicing/domain/invoiceLines.service.js');
const { calcVatBreakdown } = await import(DIST + 'modules/invoicing/domain/vat.service.js');
const { clasificarDetalleDesglose } = await import(DIST + 'modules/fiscal/verifactu/registro.builder.js');
const { distributeStageAmounts } = await import(DIST + 'modules/quotes/domain/billingPlan.js');
const { casarLineas } = await import(DIST + 'modules/jobs/domain/albaranAFactura.js');
const { calcTotal } = await import(DIST + 'core/utils/utils.js');
const { lineasQueSuman } = await import(DIST + 'modules/quotes/domain/apartados.js');

// Catálogo del meta-guard (SCRUM-1387 / A3, SCRUM-1731).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Las cabeceras vuelven a pasar por el embudo de los tramos.
    fichero: 'src/modules/invoicing/domain/invoiceLines.service.ts',
    de: '  const src = lineasQueSuman(Array.isArray(lines) ? lines : []);',
    a: '  const src = Array.isArray(lines) ? lines : [];',
    cae: 'los caminos de tramos no meten la cabecera en la factura',
  },
  {
    // Las cabeceras vuelven a pasar por la factura desde el cobro.
    fichero: 'src/lib/invoicing.ts',
    de: '  const lineasDelPresupuesto = quoteLines ? lineasQueSuman(lineasParaFacturar(quoteLines)) : [];',
    a: '  const lineasDelPresupuesto = quoteLines ? lineasParaFacturar(quoteLines) : [];',
    cae: 'la factura desde el cobro no mete la cabecera',
  },
];

const PLANES = {
  entero: [{ index: 0, percentage: 1, label: 'full' }],
  '50/50': [{ index: 0, percentage: 0.5, label: 'a' }, { index: 1, percentage: 0.5, label: 'b' }],
  '30/70': [{ index: 0, percentage: 0.3, label: 'a' }, { index: 1, percentage: 0.7, label: 'b' }],
};

const SUBPARTIDAS = [
  { concept: 'Pintura', description: 'Paredes y techo', qty: 1, price: 480, tax: 0.21 },
  { concept: 'Aire acondicionado', qty: 1, price: 1250.5, tax: 0.21, dto: 10 },
  { concept: 'Mano de obra', qty: 12.5, price: 32.4, tax: 0.1 },
];
const CABECERA = { concept: 'Salón', description: 'Reforma del salón', apartado: true };

const presupuesto = (lines, extra = {}) => ({ lines, discountGlobalAmount: null, total: calcTotal(lines), ...extra });
const CON_APARTADO = presupuesto([CABECERA, ...SUBPARTIDAS]);
const SIN_APARTADO = presupuesto(SUBPARTIDAS);

/** Lo que emiten los caminos de tramos (quotes, jobs, quotesAdmin): mismo cálculo que las rutas. */
function tramos(quote, plan) {
  const base = lineasParaFacturar(quote);
  const objetivos = distributeStageAmounts(quote.total, plan);
  return plan.map((s, i) => stageLinesReconciled(base, plan, s.index, objetivos[i]));
}
const esCabecera = (l) => l && l.apartado === true;

/** Lo que haría el sellado con esas líneas: desglose por tipo y clasificación de cada tramo. */
function desgloseClasificado(lines) {
  return calcVatBreakdown(lines).entries.map((e) => clasificarDetalleDesglose(e, 'T-1786b'));
}

// SCRUM-1415: un caso por plan con su nombre ESCRITO (no construido en un bucle).
const FILAS_PLANES = Object.entries(PLANES);

const sinCabeceraEnTramos = casosEscritos(FILAS_PLANES,
  ([nombre]) => `1786b · plan ${nombre}: los caminos de tramos no meten la cabecera en la factura`,
  ([, plan]) => {
    const facturas = tramos(CON_APARTADO, plan);
    const sinCabecera = tramos(SIN_APARTADO, plan);
    facturas.forEach((f, i) => {
      assert.equal(f.filter(esCabecera).length, 0, `tramo ${i}: la cabecera «Salón» llega a Invoice.lines`);
      assert.equal(f.length, 3, `tramo ${i}: ${f.length} líneas, esperaba las 3 subpartidas`);
      // El desglose por tipo es el de las subpartidas, sin tramo fantasma al 0 %.
      assert.deepEqual(calcVatBreakdown(f), calcVatBreakdown(sinCabecera[i]));
      assert.equal(grossOfLines(f), grossOfLines(sinCabecera[i]));
      assert.doesNotThrow(() => desgloseClasificado(f), `tramo ${i}: clasificarDetalleDesglose falla`);
    });
    // Los tramos suman el total firmado del presupuesto con apartados (mismo cálculo que sin ellos).
    const suma = facturas.reduce((a, f) => a + grossOfLines(f), 0);
    assert.equal(Math.round(suma * 100), Math.round(tramos(SIN_APARTADO, plan).reduce((a, f) => a + grossOfLines(f), 0) * 100));
  });

const vistaDelPlan = casosEscritos(FILAS_PLANES,
  ([nombre]) => `1786b · plan ${nombre}: la vista del plan promete lo mismo que factura`,
  ([, plan]) => {
    const prometido = stageAmountsFromLines(lineasParaFacturar(CON_APARTADO), plan, distributeStageAmounts(CON_APARTADO.total, plan));
    assert.deepEqual(prometido, tramos(CON_APARTADO, plan).map(grossOfLines));
  });

test('1786b · plan entero: los caminos de tramos no meten la cabecera en la factura', sinCabeceraEnTramos(0));
test('1786b · plan entero: la vista del plan promete lo mismo que factura', vistaDelPlan(0));
test('1786b · plan 50/50: los caminos de tramos no meten la cabecera en la factura', sinCabeceraEnTramos(1));
test('1786b · plan 50/50: la vista del plan promete lo mismo que factura', vistaDelPlan(1));
test('1786b · plan 30/70: los caminos de tramos no meten la cabecera en la factura', sinCabeceraEnTramos(2));
test('1786b · plan 30/70: la vista del plan promete lo mismo que factura', vistaDelPlan(2));
sinCabeceraEnTramos.todos();
vistaDelPlan.todos();

/** Las llamadas por nombre de `src/lib/invoicing.ts`, con el nombre de la llamada que las envuelve. */
function llamadasDeInvoicing() {
  const ruta = path.join(RAIZ, 'src/lib/invoicing.ts');
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  const out = [];
  const ver = (n, padre) => {
    let aqui = padre;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) { out.push({ nombre: n.expression.text, envuelta: padre }); aqui = n.expression.text; }
    ts.forEachChild(n, (h) => ver(h, aqui));
  };
  ver(sf, null);
  return out;
}

test('1786b · la factura desde el cobro no mete la cabecera', () => {
  const llamadas = llamadasDeInvoicing();
  assert.ok(llamadas.length > 20, `control: el instrumento solo vio ${llamadas.length} llamadas`);
  const lpf = llamadas.filter((c) => c.nombre === 'lineasParaFacturar');
  assert.equal(lpf.length, 1, 'src/lib/invoicing.ts debe llamar UNA vez a lineasParaFacturar');
  assert.equal(lpf[0].envuelta, 'lineasQueSuman', 'src/lib/invoicing.ts: lineasParaFacturar no va envuelta en lineasQueSuman');
  // Y lo que hace esa composición con el presupuesto del «Salón».
  const f = lineasQueSuman(lineasParaFacturar(CON_APARTADO));
  assert.equal(f.filter(esCabecera).length, 0);
  assert.equal(f.length, 3);
  assert.deepEqual(calcVatBreakdown(f), calcVatBreakdown(lineasParaFacturar(SIN_APARTADO)));
  assert.doesNotThrow(() => desgloseClasificado(f));
});

test('1786b · el albarán sigue casando POR POSICIÓN con la cabecera dentro (no se filtró en `lineasParaFacturar`)', () => {
  // `quoteLineIndex` cuenta la cabecera: la subpartida 3 («Mano de obra») es la posición 3.
  const c = casarLineas([{ concepto: 'Mano de obra', cantidad: 2, quoteLineIndex: 3 }], lineasParaFacturar(CON_APARTADO), {});
  assert.equal(c.facturables.length, 1);
  assert.equal(c.facturables[0].precioUnitario, 32.4);
  assert.equal(c.facturables[0].tax, 0.1);
  // Y una línea del albarán que apunte a la cabecera no se factura: va al adicional.
  const h = casarLineas([{ concepto: 'Salón', cantidad: 1, quoteLineIndex: 0 }], lineasParaFacturar(CON_APARTADO), {});
  assert.equal(h.facturables.length, 0);
});

// ── CONTROL POSITIVO: sin apartados, todo sale como hoy ───────────────────────────────────────
const MUESTRA_SIN_APARTADOS = [
  SIN_APARTADO,
  presupuesto([{ concept: 'Una', qty: 1, price: 99.99, tax: 0.21 }]),
  presupuesto([{ concept: 'A', qty: 3, price: 10.333, tax: 0.04 }, { concept: 'B', qty: 1, price: 250.77, tax: 0.21, dto: 5 }]),
  presupuesto([{ concept: 'Global', qty: 2, price: 100, tax: 0.21 }, { concept: 'Otra', qty: 1, price: 50, tax: 0.21 }], { discountGlobalAmount: 30 }),
  presupuesto([{ concept: 'C', qty: 1, price: 100, tax: 0.21 }, { concept: 'D', qty: 1, price: 100, tax: 0.1 }], { discountGlobalAmount: 20 }),
  presupuesto([]),
];
function salidasSinApartados() {
  const out = [];
  for (const q of MUESTRA_SIN_APARTADOS) {
    const lpf = lineasParaFacturar(q);
    out.push(lpf);
    for (const plan of Object.values(PLANES)) {
      out.push(tramos(q, plan));
      out.push(stageAmountsFromLines(lpf, plan, distributeStageAmounts(q.total, plan)));
    }
  }
  return JSON.stringify(out);
}
// Tomada con el `dist/` de 609a46472 (rama scrum-1786b antes del arreglo), con esta misma función.
const HUELLA_DE_HOY = '40dcf27010eeef727be29d912786f9cdcb8b05c53b28abded8490c7751dfef23';

test('1786b · control: un presupuesto SIN apartados da exactamente lo mismo que antes del arreglo', () => {
  const json = salidasSinApartados();
  assert.ok(json.length > 2000, `control: salida de ${json.length} B, el instrumento no ha visto nada`);
  const h = createHash('sha256').update(json).digest('hex');
  assert.equal(h, HUELLA_DE_HOY);
});

test('1786b · control: sin apartados, el filtro del cobro devuelve los MISMOS objetos que `lineasParaFacturar`', () => {
  for (const q of MUESTRA_SIN_APARTADOS) {
    const a = lineasParaFacturar(q);
    const b = lineasQueSuman(a);
    assert.equal(b.length, a.length);
    b.forEach((l, i) => assert.equal(l, a[i]));
  }
});

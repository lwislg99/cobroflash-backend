// SÓLO LEE. SCRUM-1566 (b) · el arreglo B CON DESCUENTO GLOBAL: ¿qué formas hay de calcular la cuota del pie
// del presupuesto cuando hay un descuento en euros, y qué da cada una?
// Uso: node descuento-global.cjs <árbol con dist/> [nPorPoblacion=4000]
//
// Mismo método que `expediente-tres-centimos.cjs`: funciones REALES de dist/, réplica con la forma como
// parámetro, y la réplica tiene que dar EXACTAMENTE lo mismo que el código con la forma de hoy (si no, se para).
// No escribe nada en ningún sitio: no genera PDF.
const path = require('node:path');

if (process.argv.includes('--help') || process.argv.length < 3) {
  console.log('Uso: node descuento-global.cjs <árbol con dist/> [nPorPoblacion=4000]');
  process.exit(0);
}
const raiz = path.resolve(process.argv[2]);
const N_POB = Number(process.argv[3] || 4000);
const d = (p) => path.join(raiz, 'dist', p);

const { fmtImporte } = require(d('modules/invoicing/infra/pdf/pdf.service.js'));
const { lineasParaFacturar, stageLinesReconciled, grossOfLines, tieneDescuentoGlobalConVariosIva } = require(d('modules/invoicing/domain/invoiceLines.service.js'));
const { distributeStageAmounts } = require(d('modules/quotes/domain/billingPlan.js'));
const { calcTotal, tipoEnPorcentaje, precioConDto } = require(d('core/utils/utils.js'));
const { calcVatBreakdown } = require(d('modules/invoicing/domain/vat.service.js'));
const { pieDePresupuesto } = require(d('modules/quotes/domain/presentacionIva.js'));

const R = (n) => Math.round(n * 100) / 100;   // el de hoy, en las cuatro copias

// ── LAS FORMAS de calcular la cuota de un tipo cuyo base lleva quitada `q` euros de descuento global ──
//   F0 · HOY (presentacionIva.ts:179): redondea la base del tipo, le quita q y multiplica.
//   F1 · la de la FACTURA: la canónica sobre las líneas + una línea negativa de −q en ese tipo
//        (con un solo tipo es exactamente `lineasParaFacturar`, invoiceLines.service.ts:136-139).
//   F2 · cuota de las líneas menos cuota del descuento, cada una redondeada.
const FORMAS = {
  'F0 hoy · R((R(base) − q) × tipo)': (sumaBase, sumaCuota, q, t) => R((R(sumaBase) - q) * t),
  'F1 factura · R(Σcuota − q × tipo)': (sumaBase, sumaCuota, q, t) => R(sumaCuota - q * t),
  'F2 R(Σcuota) − R(q × tipo)': (sumaBase, sumaCuota, q, t) => R(R(sumaCuota) - R(q * t)),
};

/** Réplica de `pieDePresupuesto` en modo `sumar` (presentacionIva.ts:109-184) con la forma como parámetro. */
function pie(lineas, descuentoGlobal, forma) {
  const efectivas = lineas.map((l) => (Number(l.dto) > 0 ? { ...l, price: precioConDto(l.price, l.dto) } : l));
  // Las sumas SIN redondear por tipo, como las acumula `calcVatBreakdown` antes de su round2.
  const crudo = new Map();
  for (const l of efectivas) {
    const t = Number(l.tax) || 0; const rate = tipoEnPorcentaje(t); const base = Number(l.qty) * (Number(l.price) || 0);
    const e = crudo.get(rate) || { b: 0, c: 0, t }; e.b += base; e.c += base * t; crudo.set(rate, e);
  }
  const bd = calcVatBreakdown(efectivas);
  const sinDescuento = calcVatBreakdown(lineas).base;
  const descuentoLineas = R(sinDescuento - bd.base);
  const gp = Number(descuentoGlobal);
  const global = Number.isFinite(gp) && gp > 0 ? Math.min(R(gp), bd.base) : 0;
  const filas = [];
  if (descuentoLineas > 0 || global > 0) {
    filas.push({ etiqueta: 'Suma de líneas:', importe: sinDescuento });
    if (descuentoLineas > 0) filas.push({ etiqueta: 'Descuento:', importe: -descuentoLineas });
    if (global > 0) filas.push({ etiqueta: 'Descuento global:', importe: -global });
  }
  filas.push({ etiqueta: 'Base imponible:', importe: R(bd.base - global) });
  const totalCents = Math.round(bd.base * 100); const globalCents = Math.round(global * 100);
  let acumulado = 0;
  const quita = bd.entries.map((e, i) => {
    if (globalCents <= 0 || totalCents <= 0) return 0;
    const cents = i === bd.entries.length - 1 ? globalCents - acumulado : Math.round((globalCents * Math.round(e.base * 100)) / totalCents);
    acumulado += cents; return cents / 100;
  });
  bd.entries.forEach((e, i) => {
    if (e.cuota === 0) return;
    const c = crudo.get(e.rate);
    const cuota = FORMAS[forma](c.b, c.c, quita[i], e.rate / 100);
    if (cuota === 0) return;
    filas.push({ etiqueta: `IVA ${e.rate}%:`, importe: cuota });
  });
  return filas;
}
const iva = (filas) => filas.filter((f) => /^IVA /.test(f.etiqueta));
const base = (filas) => filas.find((f) => f.etiqueta === 'Base imponible:').importe;
const cents = (n) => Math.round(n * 100);
const cuadra = (filas, total) => cents(base(filas)) + iva(filas).reduce((a, f) => a + cents(f.importe), 0) === cents(total);

// ── POBLACIÓN ────────────────────────────────────────────────────────────────────────────────
let semilla = 20261022;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
function presupuesto({ decimales, tipos }) {
  const lines = [];
  const n = 1 + Math.floor(azar() * 10);
  for (let k = 0; k < n; k++) {
    const l = { concept: 'L' + k, qty: decimales ? Math.round((0.5 + azar() * 40) * 100) / 100 : 1 + Math.floor(azar() * 8), price: Math.round(azar() * 40000) / 100, tax: tipos[Math.floor(azar() * tipos.length)] };
    if (azar() < 0.1) l.dto = [5, 10, 15][Math.floor(azar() * 3)];
    lines.push(l);
  }
  const bruto = lines.reduce((a, l) => a + l.qty * precioConDto(l.price, l.dto), 0);
  // La mitad, un descuento redondo en euros («50 € de descuento»); la otra mitad, con céntimos.
  const pct = 0.02 + azar() * 0.28;
  const g = azar() < 0.5 ? Math.max(1, Math.round(bruto * pct)) : Math.max(0.01, Math.round(bruto * pct * 100) / 100);
  return { lines, discountGlobalAmount: g };
}
const unica = [{ index: 0, percentage: 1 }];
const facturaDe = (q) => stageLinesReconciled(lineasParaFacturar(q), unica, 0, distributeStageAmounts(calcTotal(q.lines, q.discountGlobalAmount), unica)[0]);
/** El IVA que la factura declara (registro) y que el PDF imprimiría con el arreglo A. */
const ivaFactura = (lines) => calcVatBreakdown(lines).entries.filter((e) => e.cuota !== 0).map((e) => `${e.rate}=${fmtImporte(e.cuota)}`).join('|');
const ivaPie = (filas) => iva(filas).map((f) => `${f.etiqueta.replace(/^IVA |%:$/g, '')}=${fmtImporte(f.importe)}`).join('|');

// ── 0 · LA RÉPLICA CON F0 ES EL CÓDIGO ────────────────────────────────────────────────────────
let comprobados = 0;
function comprobar(q) {
  const real = pieDePresupuesto({ lineas: q.lines, modo: 'sumar', nombreImpuesto: 'IVA', descuentoGlobal: q.discountGlobalAmount });
  const rep = pie(q.lines, q.discountGlobalAmount, 'F0 hoy · R((R(base) − q) × tipo)');
  if (JSON.stringify(real.filas) !== JSON.stringify(rep)) { console.log('LA RÉPLICA NO ES pieDePresupuesto', JSON.stringify({ q, real: real.filas, rep })); process.exit(3); }
  comprobados++;
}
// Control positivo: el comparador tiene que DISTINGUIR dos formas que difieren. Se busca, con semilla propia,
// una línea de cantidad decimal al 21 % con global en la que F0 y F1 den cuotas distintas; si en 20.000
// intentos no aparece ninguna, el comparador (o la réplica) está ciego y se para.
{
  let s = 7, hallado = null;
  const az = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = 0; i < 20000 && !hallado; i++) {
    const l = { qty: Math.round((0.5 + az() * 40) * 100) / 100, price: Math.round(az() * 40000) / 100, tax: 0.21 };
    const g = Math.round(l.qty * l.price * 0.1 * 100) / 100;
    const a = ivaPie(pie([l], g, 'F0 hoy · R((R(base) − q) × tipo)')), b = ivaPie(pie([l], g, 'F1 factura · R(Σcuota − q × tipo)'));
    if (a !== b) hallado = { l, g, a, b };
  }
  if (!hallado) { console.log('CONTROL POSITIVO FALLA: en 20.000 casos F0 y F1 no difieren nunca; el comparador estaría ciego'); process.exit(4); }
  console.log(`CONTROL · ${hallado.l.qty} × ${hallado.l.price} € al 21 %, global ${hallado.g}: F0 IVA ${hallado.a} · F1 IVA ${hallado.b} · el comparador los distingue`);
}

const pct = (x, n) => (n ? (100 * x / n).toFixed(1).replace('.', ',') + ' %' : '—');

// ── 1 · LO QUE ESTÁ VIVO: descuento global con UN SOLO tipo ────────────────────────────────────
for (const [nombre, p] of [
  ['un tipo · cantidad entera · 21 %', { decimales: false, tipos: [0.21] }],
  ['un tipo · cantidad entera · 10 %', { decimales: false, tipos: [0.10] }],
  ['un tipo · cantidad decimal · 21 %', { decimales: true, tipos: [0.21] }],
  ['un tipo · cantidad decimal · 10 %', { decimales: true, tipos: [0.10] }],
]) {
  const muestra = [];
  for (let i = 0; i < N_POB; i++) { const q = presupuesto(p); if (i < 1000) comprobar(q); muestra.push({ q, f: facturaDe(q) }); }
  console.log(`\n## ${nombre} · ${N_POB} presupuestos con descuento global (y su factura única)`);
  console.log('forma | IVA del presupuesto ≠ IVA de la factura | idem con D (la factura sin reconciliar: su objetivo ya es su total) | presupuesto no cuadra consigo (total firmado = calcTotal) | idem con D (total = el de la factura) | total firmado ≠ total de la factura');
  for (const forma of Object.keys(FORMAS)) {
    let distinto = 0, distintoD = 0, noCuadra = 0, noCuadraD = 0, totales = 0;
    for (const { q, f } of muestra) {
      const filas = pie(q.lines, q.discountGlobalAmount, forma);
      if (ivaPie(filas) !== ivaFactura(f)) distinto++;
      if (ivaPie(filas) !== ivaFactura(lineasParaFacturar(q))) distintoD++;
      if (!cuadra(filas, calcTotal(q.lines, q.discountGlobalAmount))) noCuadra++;
      if (!cuadra(filas, grossOfLines(lineasParaFacturar(q)))) noCuadraD++;
      if (cents(calcTotal(q.lines, q.discountGlobalAmount)) !== cents(grossOfLines(f))) totales++;
    }
    console.log(`${forma} | ${pct(distinto, N_POB)} | ${pct(distintoD, N_POB)} | ${pct(noCuadra, N_POB)} | ${pct(noCuadraD, N_POB)} | ${pct(totales, N_POB)}`);
  }
}

// ── 2 · LO QUE NO ESTÁ VIVO: varios tipos con descuento global (caso C de SCRUM-887) ───────────
// No se guarda, no se revisa y no se factura (quotes.routes.ts:149, quoteAdmin.ts:667, lineasParaFacturar:128).
// Sólo pueden existir los HEREDADOS, anteriores al bloqueo. Se mide si su propio pie cuadra con lo firmado:
// `calcTotal` reparte el global en el orden en que APARECE cada tipo (utils.ts:262-268, un Map) y
// `pieDePresupuesto` en orden DESCENDENTE de tipo (presentacionIva.ts:164-171): el «último que absorbe el
// céntimo» no es el mismo tipo en los dos.
{
  const N = N_POB; let vivos = 0, noCuadra = { }, ordenDistinto = 0;
  for (const forma of Object.keys(FORMAS)) noCuadra[forma] = 0;
  for (let i = 0; i < N; i++) {
    const q = presupuesto({ decimales: azar() < 0.5, tipos: [0.21, 0.10, 0.04] });
    if (!tieneDescuentoGlobalConVariosIva(q)) continue;
    vivos++; if (vivos <= 1000) comprobar(q);
    const tiposEnOrden = [...new Set(q.lines.map((l) => tipoEnPorcentaje(Number(l.tax) || 0)))];
    const desc = [...tiposEnOrden].sort((a, b) => b - a);
    if (tiposEnOrden.at(-1) !== desc.at(-1)) ordenDistinto++;
    for (const forma of Object.keys(FORMAS)) if (!cuadra(pie(q.lines, q.discountGlobalAmount, forma), calcTotal(q.lines, q.discountGlobalAmount))) noCuadra[forma]++;
  }
  console.log(`\n## caso C heredado (varios tipos + global) · ${vivos} presupuestos · NO se pueden facturar`);
  console.log(`el tipo que absorbe el céntimo es distinto en calcTotal y en el pie: ${pct(ordenDistinto, vivos)}`);
  for (const forma of Object.keys(FORMAS)) console.log(`${forma} | presupuesto no cuadra consigo: ${pct(noCuadra[forma], vivos)}`);
}
console.log(`\nCONTROL · réplica del pie (F0) comprobada contra pieDePresupuesto real en ${comprobados} presupuestos con descuento global`);

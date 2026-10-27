// SÓLO LEE Y EJECUTA. SCRUM-1446b · ¿se llega al presupuesto con descuento global que se firma por un
// importe, da otro al hacer la cuenta y NO SE PUEDE FACTURAR, con los tipos que se pueden ELEGIR en los
// dos desplegables del editor? ¿O hace falta que el tipo entre por otra puerta?
//
//   node docs/master/evidencias/SCRUM-1446/medir-el-descuento-global-por-el-desplegable.mjs <raíz, con dist/>
//
// Ejecuta el módulo REAL de los desplegables (`public/dashboard/js/tiposDeIva.js`) para saber qué
// ofrecen, y con esos tipos llama a `calcTotal` (lo que se firma), a `lineasParaFacturar` (lo que
// entra en la factura) y a `tipoIvaNoEmitible` (el portón) de dist/. No toca `src/`, no abre ninguna
// base, no escribe ningún fichero.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const R = path.resolve(process.argv[2] || '.');
const out = (...a) => console.log(...a);
if (!fs.existsSync(path.join(R, 'dist/core/utils/utils.js'))) {
  out(`CIEGO: no hay dist/ en ${R}. Compila antes.`);
  out('EXIT=2');
  process.exit(2);
}
const require = createRequire(path.join(R, 'x.js'));
const u = require(path.join(R, 'dist/core/utils/utils.js'));
const il = require(path.join(R, 'dist/modules/invoicing/domain/invoiceLines.service.js'));
const te = require(path.join(R, 'dist/core/validation/tiposIvaEmitibles.js'));
const fi = require(path.join(R, 'dist/core/validation/fiscalInput.js'));
const tiposDeIva = require(path.join(R, 'public/dashboard/js/tiposDeIva.js'));

const eur = (c) => (c / 100).toFixed(2).replace('.', ',');
/** El editor manda `tax: vatPerc / 100` (quotesView.js, al montar el payload). La misma cuenta. */
const aFraccion = (pct) => pct / 100;

// ── la población: precios, cantidades y descuentos ────────────────────────────────────────────
const PRECIOS = [];
for (let c = 37; c <= 30000; c += 37) PRECIOS.push(c / 100);
const CANTIDADES = [1, 3];
const GLOBALES = [0.01, 0.5, 1, 9.99, 10, 33.33];

/**
 * Una pasada: todas las combinaciones con UN tipo (una línea, y dos líneas del mismo tipo).
 * Cuenta tres cosas distintas, porque son tres preguntas:
 *   · mecanismo: ¿el tipo con que se descuenta es el de la línea?
 *   · cuenta:    ¿lo firmado es (base − descuento) × (1 + tipo), en céntimos enteros?
 *   · portón:    ¿las líneas que entrarían en la factura pasan el portón de tipos?
 */
function pasada(pct) {
  const tax = aFraccion(pct);
  const bp = Math.round(pct * 100);
  const r = { n: 0, seComeLaBase: 0, mecanismo: 0, cuenta: 0, maxCuenta: 0, porton: 0, ejemplo: null, motivo: null };
  for (const lineas of [1, 2]) for (const qty of CANTIDADES) for (const p of PRECIOS) for (const g of GLOBALES) {
    const lines = [];
    for (let i = 0; i < lineas; i++) lines.push({ concept: `L${i + 1}`, qty, price: p, tax });
    const baseC = lines.reduce((a, l) => a + Math.round(l.qty * l.price * 100), 0);
    const gC = Math.round(g * 100);
    if (gC >= baseC) { r.seComeLaBase += 1; continue; }
    r.n += 1;
    const reparto = u.descuentoGlobalEnCentimos(lines, g);
    if (reparto.tipos.length !== 1 || reparto.tipos[0][0] * 100 !== bp) r.mecanismo += 1;
    const firmado = Math.round(u.calcTotal(lines, g) * 100);
    const cuenta = Math.round(((baseC - gC) * (10000 + bp)) / 10000);
    if (firmado !== cuenta) {
      r.cuenta += 1;
      r.maxCuenta = Math.max(r.maxCuenta, Math.abs(firmado - cuenta));
      if (!r.ejemplo) r.ejemplo = `${lineas} × (${qty} × ${eur(Math.round(p * 100))}) con ${eur(gC)} de descuento: se firma ${eur(firmado)}, la cuenta da ${eur(cuenta)}`;
    }
    const motivo = te.tipoIvaNoEmitible(il.lineasParaFacturar({ lines, discountGlobalAmount: g }));
    if (motivo) { r.porton += 1; if (!r.motivo) r.motivo = motivo; }
  }
  return r;
}
const fila = (rotulo, r) => `${rotulo.padEnd(34)} | ${String(r.n).padStart(6)} | ${String(r.mecanismo).padStart(9)} | ${String(r.cuenta).padStart(6)} (máx. ${r.maxCuenta} cént.) | ${String(r.porton).padStart(6)}`;

// ── 1 · qué ofrecen los dos desplegables ──────────────────────────────────────────────────────
out('══ 1 · LO QUE OFRECEN LOS DOS DESPLEGABLES (ejecutando public/dashboard/js/tiposDeIva.js)');
const delDocumento = tiposDeIva.opciones(21);   // quotesView.js: `pintarOpciones(fieldVatDefault.select, opciones(21))`
const deLaLinea = tiposDeIva.opciones(null);    // quotesView.js: `montar(null)` en cada línea nueva
out(`  «IVA por defecto» del documento: ${JSON.stringify(delDocumento)}`);
out(`  «IVA» de una línea nueva:        ${JSON.stringify(deLaLinea)}`);
const ELEGIBLES = [...new Set([...delDocumento, ...deLaLinea])].sort((a, b) => b - a);
const ADMITIDOS = [...fi.TIPOS_IVA_ES_BP].map((b) => b / 100).sort((a, b) => b - a);
out(`  POBLACION de tipos elegibles: ${ELEGIBLES.length} → ${JSON.stringify(ELEGIBLES)}`);
out(`  tipos que admite el portón (${ADMITIDOS.length}): ${JSON.stringify(ADMITIDOS)}`);
out(`  admitidos que NO se pueden elegir: ${JSON.stringify(ADMITIDOS.filter((t) => !ELEGIBLES.includes(t)))}`);
if (ELEGIBLES.length === 0) { out('CIEGO: los desplegables no ofrecen nada; un cero de abajo no diría nada.'); out('EXIT=3'); process.exit(3); }

// ── 2 · el caso del ticket, tal cual, y su control ────────────────────────────────────────────
out('\n══ 2 · EL CASO, TAL CUAL: 100,00 con 10,00 de descuento global');
for (const pct of [7.5, ...ELEGIBLES]) {
  const lines = [{ concept: 'L1', qty: 1, price: 100, tax: aFraccion(pct) }];
  const firmado = Math.round(u.calcTotal(lines, 10) * 100);
  const cuenta = Math.round((9000 * (10000 + Math.round(pct * 100))) / 10000);
  const paraFacturar = il.lineasParaFacturar({ lines, discountGlobalAmount: 10 });
  const motivo = te.tipoIvaNoEmitible(paraFacturar);
  out(`  ${String(pct).padStart(4)} % · se firma ${eur(firmado)} · la cuenta da ${eur(cuenta)} · diferencia ${firmado - cuenta} cént. · línea del descuento con tax ${paraFacturar[0].tax} · portón: ${motivo || 'pasa'}`);
}

// ── 3 · el recuento ───────────────────────────────────────────────────────────────────────────
out('\n══ 3 · EL RECUENTO: un solo tipo, una línea y dos líneas iguales');
out(`  precios: ${PRECIOS.length} (de ${eur(Math.round(PRECIOS[0] * 100))} a ${eur(Math.round(PRECIOS[PRECIOS.length - 1] * 100))}) × cantidades ${JSON.stringify(CANTIDADES)} × descuentos ${JSON.stringify(GLOBALES)} × 1 y 2 líneas`);
out('  tipo                               |  casos | mecanismo | la cuenta no sale       | portón');
const control = pasada(7.5);
out('  ' + fila('CONTROL 7,5 % (no elegible)', control));
let total = { n: 0, mecanismo: 0, cuenta: 0, porton: 0 };
for (const pct of ELEGIBLES) {
  const r = pasada(pct);
  out('  ' + fila(`${pct} % (elegible)`, r));
  if (r.ejemplo) out(`      p. ej. ${r.ejemplo}`);
  total = { n: total.n + r.n, mecanismo: total.mecanismo + r.mecanismo, cuenta: total.cuenta + r.cuenta, porton: total.porton + r.porton };
}
for (const pct of ADMITIDOS.filter((t) => !ELEGIBLES.includes(t) && t !== 7.5)) {
  const r = pasada(pct);
  out('  ' + fila(`${pct} % (admitido, no elegible)`, r));
}
out(`  control: ${control.ejemplo || 'SIN EJEMPLO'}`);
out(`  control: ${control.motivo || 'SIN RECHAZO'}`);
if (control.mecanismo === 0 || control.porton === 0) { out('CIEGO: el control no ve el defecto conocido; los ceros de arriba no valdrían.'); out('EXIT=3'); process.exit(3); }
out(`\n  ELEGIBLES, en total: ${total.n} casos · mecanismo ${total.mecanismo} · la cuenta no sale ${total.cuenta} · portón ${total.porton}`);

// ── 4 · dos tipos elegibles mezclados: lo que ya está decidido ────────────────────────────────
out('\n══ 4 · DOS TIPOS ELEGIBLES MEZCLADOS CON DESCUENTO GLOBAL (otra cosa: decidido en SCRUM-887)');
let pares = 0; let aCero = 0;
for (let i = 0; i < ELEGIBLES.length; i++) for (let j = i + 1; j < ELEGIBLES.length; j++) {
  pares += 1;
  const lines = [{ concept: 'L1', qty: 1, price: 100, tax: aFraccion(ELEGIBLES[i]) }, { concept: 'L2', qty: 1, price: 50, tax: aFraccion(ELEGIBLES[j]) }];
  const f = il.lineasParaFacturar({ lines, discountGlobalAmount: 10 });
  if (f.every((l) => Number(l.price) === 0)) aCero += 1;
}
out(`  pares de tipos: ${pares} · sus líneas salen a 0 al facturar (no se factura, a propósito): ${aCero}`);

// ── 5 · por dónde SÍ entra un 7,5 % sin tocar la API, y qué hace entonces el desplegable ──────
out('\n══ 5 · SI UNA LÍNEA LLEGA CON 7,5 %, EL DESPLEGABLE LO ENSEÑA Y LO CONSERVA');
out(`  opciones(7.5) → ${JSON.stringify(tiposDeIva.opciones(7.5))} · esEspanol(7.5) → ${tiposDeIva.esEspanol(7.5)}`);
out(`  invalidTipoIva(0.075) (la regla que usan el portón y el asistente) → ${fi.invalidTipoIva(0.075) === null ? 'admitido' : fi.invalidTipoIva(0.075)}`);
out(`  control · invalidTipoIva(0.08) → ${fi.invalidTipoIva(0.08)}`);
out('EXIT=0');

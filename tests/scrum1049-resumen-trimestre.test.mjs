// tests/scrum1049-resumen-trimestre.test.mjs — SCRUM-1049 (CON-07, mitad 2/2)
//
// «Resumen del trimestre» en Informes: IVA repercutido, IVA soportado (deducible) y gastos, con
// los números que TRES endpoints ya existentes dan hoy (`/admin/reports/vat`,
// `/admin/libros/recibidas.json`, `/admin/reports/pl`). Sin retenciones ni diferencia — eso es
// SCRUM-1048 (S1), bloqueado esperando al asesor, y la instrucción es dejarlo fuera sin hueco.
//
// Se mide en el DOM REAL que pinta `renderReportsView` (banco de SCRUM-417), no el fuente.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// `Intl.NumberFormat('es-ES', {style:'currency'})` separa el importe del símbolo con un ESPACIO
// DE NO RUPTURA (U+00A0), no un espacio normal — es lo que produce `fmtMoneyEs` (api.js:575).
const NBSP = ' ';
// `useGrouping:'always'` porque CLDR es-ES, sin forzarlo, NO agrupa los miles de 4 cifras
// (api.js:578) — es la misma trampa que `fmtMoneyEs` esquiva, y sin esto 2400 saldría «2400,00».
const eur = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + NBSP + '€';

const PL_VACIO = {
  months: Array.from({ length: 12 }, (_, i) => ({ label: String(i), revenue: 0, expenses: 0, profit: 0 })),
  totals: { revenue: 0, expenses: 0, profit: 0, maintenance: 0 },
  prevYear: { revenue: 0, expenses: 0, profit: 0 },
  currency: 'EUR',
  byEmployee: [],
};

/** `datos` del banco: responde por RUTA, con defaults inertes para todo lo que no es de este ticket. */
function datosDe({ vat, recibidas, pl } = {}) {
  return (url) => {
    const u = String(url);
    if (/\/admin\/reports\/vat\?/.test(u)) return vat ?? { year: 2026, quarter: 2, from: '2026-04-01', to: '2026-06-30', currency: 'EUR', rates: [], totals: { base: 0, cuota: 0 }, invoiceCount: 0, excluded: { count: 0, total: 0 } };
    if (/\/admin\/libros\/recibidas\.json\?/.test(u)) return recibidas ?? { filas: [], miradas: 0, avisos: ['Formato provisional: no contrastado contra especificación oficial.'], desde: '2026-04-01', hasta: '2026-06-30' };
    if (/\/admin\/reports\/pl\?/.test(u)) return pl ?? PL_VACIO;
    if (/\/admin\/reports\/x2\?/.test(u)) return { paymentMethods: [], reminderSavings: null, agingBuckets: [] };
    if (/\/admin\/metrics\//.test(u)) return {};
    return {};
  };
}

const kpiBlocks = (contenedor) => todos(contenedor)
  .filter((n) => n.className === 'kpi-card')
  .map((n) => {
    const label = todos(n).find((c) => c.className === 'kpi-label');
    const value = todos(n).find((c) => c.className === 'kpi-value');
    return { label: label && label.textContent, value: value && value.textContent };
  });

// ═══ SUELO ════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1049 · SUELO: Informes pinta con los tres endpoints en su forma vacía', async () => {
  const banco = cargarDashboard(RAIZ, { datos: datosDe() });
  const r = await pintarVista(banco, 'renderReportsView');
  assert.equal(r.error, null, `🔴 Informes revienta al abrirse: ${r.error && r.error.message}`);
  assert.ok(r.nodos > 20, `🔴 CIEGO: solo ${r.nodos} nodos — el verde de abajo no significaría nada.`);
});

// ═══ ① TRIMESTRE SIN DATOS: estado vacío, no tres ceros ═════════════════════════════════════

test('SCRUM-1049 · ① trimestre sin datos → mensaje de vacío, NO tres bloques a 0,00 €', async () => {
  const banco = cargarDashboard(RAIZ, { datos: datosDe() });
  const r = await pintarVista(banco, 'renderReportsView');
  const texto = todos(r.contenedor).map((n) => n.textContent || '').join(' ');
  assert.match(texto, /Sin movimientos en este trimestre/,
    '🔴 con los tres orígenes vacíos, la pantalla tenía que decir que no hay movimientos.');
  assert.equal(kpiBlocks(r.contenedor).filter((k) => /IVA repercutido|IVA soportado|Gastos del trimestre/.test(k.label || '')).length, 0,
    '🔴 pintó bloques de cifras además del mensaje de vacío: con cero datos no debería haber KPIs de este resumen.');
});

// ═══ ② LOS TRES BLOQUES, CON DATOS REALES ═══════════════════════════════════════════════════

test('SCRUM-1049 · ② con datos en los tres orígenes: repercutido, soportado (solo deducible) y gastos', async () => {
  const vat = {
    year: 2026, quarter: 2, from: '2026-04-01', to: '2026-06-30', currency: 'EUR',
    rates: [{ rate: 21, base: 1000, cuota: 210 }],
    totals: { base: 1000, cuota: 210 },
    invoiceCount: 3,
    excluded: { count: 0, total: 0 },
  };
  const recibidas = {
    filas: [
      // Deducible: SÍ entra en el soportado.
      { base: 300, tipoIva: 21, cuota: 63, deducible: 'Sí', concepto: 'Material' },
      // Otro tipo deducible: se SUMAN los dos.
      { base: 100, tipoIva: 10, cuota: 10, deducible: 'Sí', concepto: 'Herramienta' },
      // NO deducible: cuenta aparte, NO entra en la cuota.
      { base: 50, tipoIva: 21, cuota: 10.5, deducible: 'No', concepto: 'Comida' },
      // Sin decidir (null): tampoco entra, y también cuenta aparte.
      { base: 20, tipoIva: 21, cuota: 4.2, deducible: null, concepto: 'Sin clasificar aún' },
    ],
    miradas: 4,
    avisos: ['Formato provisional: no contrastado contra especificación oficial.'],
    desde: '2026-04-01', hasta: '2026-06-30',
  };
  // El componente elige por DEFECTO el trimestre REAL de hoy (no un valor fijo), así que el
  // fixture pone los gastos en los 3 meses del trimestre EN CURSO — no en un 2T a ciegas que
  // fallaría el día que esto se corra fuera de abril-junio.
  const mesesDelTrimestreActual = (() => {
    const q0 = Math.floor(new Date().getMonth() / 3); // 0..3
    return [q0 * 3, q0 * 3 + 1, q0 * 3 + 2];
  })();
  const [gasto1, gasto2, gasto3] = [900, 800, 700];
  const pl = {
    months: Array.from({ length: 12 }, (_, i) => ({
      label: String(i),
      revenue: mesesDelTrimestreActual.includes(i) ? 500 : 0,
      expenses: i === mesesDelTrimestreActual[0] ? gasto1
        : (i === mesesDelTrimestreActual[1] ? gasto2 : (i === mesesDelTrimestreActual[2] ? gasto3 : 0)),
      profit: 0,
    })),
    totals: { revenue: 1500, expenses: gasto1 + gasto2 + gasto3, profit: -900 },
  };

  const banco = cargarDashboard(RAIZ, { datos: datosDe({ vat, recibidas, pl }) });
  const r = await pintarVista(banco, 'renderReportsView');
  assert.equal(r.error, null, `🔴 Informes revienta con datos reales: ${r.error && r.error.message}`);

  const bloques = kpiBlocks(r.contenedor);
  const porLabel = Object.fromEntries(bloques.map((b) => [b.label, b.value]));

  assert.equal(porLabel['IVA repercutido'], eur(210),
    `🔴 el repercutido no es el total de \`/vat\` (esperaba ${eur(210)}, salió ${porLabel['IVA repercutido']}).`);
  assert.equal(porLabel['IVA soportado (deducible)'], eur(73),
    `🔴 el soportado tiene que sumar SOLO lo deducible (63 + 10 = 73), no lo No/sin decidir (salió ${porLabel['IVA soportado (deducible)']}).`);
  assert.equal(porLabel['Gastos del trimestre'], eur(gasto1 + gasto2 + gasto3),
    `🔴 los gastos del trimestre tienen que ser la suma de los 3 meses del trimestre en curso del P&L (salió ${porLabel['Gastos del trimestre']}).`);

  // Las exclusiones se DICEN, no se callan (A3 de la casa).
  const texto = todos(r.contenedor).map((n) => n.textContent || '').join(' ');
  assert.match(texto, /2 gastos de este trimestre no los has marcado como IVA deducible/,
    '🔴 los 2 gastos No/sin-decidir tienen que contarse aparte, con el texto APROBADO por el fundador — no desaparecer en silencio ni con la redacción vieja.');
});

// ═══ ③ CONTROL: el selector de trimestre es PROPIO, no el de «IVA repercutido» ═════════════

test('SCRUM-1049 · ③ el resumen tiene su PROPIO selector de trimestre (4 botones nT), no reutiliza el de repercutido a ciegas', async () => {
  const banco = cargarDashboard(RAIZ, { datos: datosDe() });
  const r = await pintarVista(banco, 'renderReportsView');
  const botonesTrimestre = todos(r.contenedor)
    .filter((n) => n.tagName === 'BUTTON' && /^[1-4]T$/.test(String(n.textContent)));
  // Dos filas de 4 (repercutido + resumen) = 8. Si solo hubiera 4, los dos bloques comparten
  // selector y una pulsación movería al otro sin que el test lo distinga.
  assert.equal(botonesTrimestre.length, 8,
    `🔴 esperaba 8 botones «nT» (2 selectores independientes de 4), encontré ${botonesTrimestre.length}.`);
});

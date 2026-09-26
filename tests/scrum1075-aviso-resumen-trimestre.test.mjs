// tests/scrum1075-aviso-resumen-trimestre.test.mjs — SCRUM-1075
//
// «Tu resumen del trimestre ya está listo»: el HÁBITO de la competencia (Contasimple anuncia un
// «Calendario Fiscal», Holded un panel «Upcoming Taxes») sin su AFIRMACIÓN — YaQu no puede decir
// una fecha de presentación hoy (regla 7). El aviso solo enlaza al «Resumen del trimestre»
// (SCRUM-1049); no calcula nada nuevo — reutiliza los mismos tres endpoints que aquél.
//
// Se mide `pintarResumenTrimestreEnHome` DIRECTAMENTE sobre un `<div id="home-resumen-trimestre">`
// suelto, como hace `scrum469-aviso-desalojo.test.mjs` con el suyo: montar la Home entera exigiría
// dar forma a `/admin/metrics/home` y compañía, que no es lo que este ticket mide.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const VAT_VACIO = { currency: 'EUR', totals: { base: 0, cuota: 0 }, invoiceCount: 0, excluded: { count: 0, total: 0 } };
const RECIBIDAS_VACIO = { filas: [], miradas: 0, avisos: [] };
const PL_VACIO = { months: Array.from({ length: 12 }, (_, i) => ({ label: String(i), revenue: 0, expenses: 0 })) };

const VAT_CON_DATOS = { currency: 'EUR', totals: { base: 1000, cuota: 210 }, invoiceCount: 3, excluded: { count: 0, total: 0 } };
const RECIBIDAS_CON_DATOS = { filas: [{ base: 300, tipoIva: 21, cuota: 63, deducible: 'Sí' }], miradas: 1, avisos: [] };
const PL_CON_DATOS = {
  months: Array.from({ length: 12 }, (_, i) => ({ label: String(i), revenue: i === 4 ? 500 : 0, expenses: i === 4 ? 120 : 0 })),
};

function datosDe({ vat, recibidas, pl } = {}) {
  return (url) => {
    const u = String(url);
    if (/\/admin\/reports\/vat\?/.test(u)) return vat ?? VAT_VACIO;
    if (/\/admin\/libros\/recibidas\.json\?/.test(u)) return recibidas ?? RECIBIDAS_VACIO;
    if (/\/admin\/reports\/pl\?/.test(u)) return pl ?? PL_VACIO;
    return {};
  };
}

/** Monta el dashboard y deja lista una caja `#home-resumen-trimestre` suelta, como en SCRUM-469. */
function montar({ vat, recibidas, pl, localStorage, merchantId = 1, teamMemberId = null } = {}) {
  const banco = cargarDashboard(RAIZ, { datos: datosDe({ vat, recibidas, pl }), localStorage });
  banco.ctx.appMerchantId = merchantId;
  banco.ctx.appTeamMemberId = teamMemberId;
  const caja = banco.mk('div');
  caja.id = 'home-resumen-trimestre';
  return { banco, caja };
}

async function pintar(banco) {
  await banco.ctx.pintarResumenTrimestreEnHome();
}

// ── 🔴 SUELO DEL BANCO ─────────────────────────────────────────────────────────────────────

test('SCRUM-1075 · 🔴 SUELO: homeView.js publica las tres piezas, o se declara CIEGO', () => {
  const { banco } = montar();
  const rotos = banco.fallos.filter((f) => f.fichero === 'js/homeView.js');
  assert.deepEqual(rotos, [], '🔴 homeView.js no carga: ' + JSON.stringify(rotos));
  for (const n of ['pintarResumenTrimestreEnHome', 'trimestreAnteriorMadrid', 'claveDescarteResumenTrimestre']) {
    assert.equal(typeof banco.ctx[n], 'function', `🔴 no está publicada \`${n}\`: todo lo de abajo mediría el vacío.`);
  }
});

// ── ① EL TRIMESTRE CAMBIA EXACTAMENTE EN SU PRIMER DÍA (hora de Madrid) ──────────────────────

test('SCRUM-1075 · ① el trimestre anterior cambia justo en el borde, en hora de Madrid, no antes', () => {
  const { banco } = montar();
  // Último instante de Q2 en Madrid (30-jun 23:30 CEST = 21:30 UTC): el trimestre anterior sigue
  // siendo Q1.
  // ⚠️ Cada valor se copia con `{ ...x }` antes de comparar: el objeto lo crea el VM del banco, con
  // el `Object.prototype` de SU realm, y `assert.deepEqual` (modo estricto) compara prototipos —
  // sin la copia, dos objetos con los mismos campos fallan por ser de "mundos" distintos, y eso
  // sería un hallazgo del arnés, no del producto (igual que la trampa NBSP de SCRUM-1049).
  const antesDelCambio = banco.ctx.trimestreAnteriorMadrid(new Date('2026-06-30T21:30:00Z'));
  assert.deepEqual({ ...antesDelCambio }, { anio: 2026, trimestre: 1 },
    '🔴 se adelantó al trimestre nuevo antes de que empezara.');
  // Primer instante de Q3 en Madrid (1-jul 00:30 CEST = 22:30 UTC del día anterior): ya es Q2 el
  // trimestre anterior.
  const primerDia = banco.ctx.trimestreAnteriorMadrid(new Date('2026-06-30T22:30:00Z'));
  assert.deepEqual({ ...primerDia }, { anio: 2026, trimestre: 2 },
    '🔴 no cambió en el primer día del trimestre.');
  // Vuelta de año: 1-ene → el trimestre anterior es el 4T del año QUE ACABA, no del que empieza.
  const finDeAnio = banco.ctx.trimestreAnteriorMadrid(new Date('2026-01-01T01:00:00Z'));
  assert.deepEqual({ ...finDeAnio }, { anio: 2025, trimestre: 4 }, '🔴 no cruzó el año hacia atrás.');
});

// ── ② SIN DATOS EN EL TRIMESTRE ANTERIOR → NO HAY AVISO (aceptación #4) ──────────────────────

test('SCRUM-1075 · ② trimestre anterior sin documentos ni gastos → NO sale el aviso', async () => {
  const { banco, caja } = montar(); // los tres orígenes en su forma vacía
  await pintar(banco);
  assert.equal(String(caja.innerHTML).trim(), '', '🔴 pintó un aviso sin nada que resumir.');
});

// ── ③ CON DATOS → SALE, CON EL LITERAL FIRMADO Y SIN PALABRAS FISCALES PROHIBIDAS ────────────

test('SCRUM-1075 · ③ con datos en el trimestre anterior: sale el aviso, literal firmado, sin fechas/plazos', async () => {
  const { banco, caja } = montar({ vat: VAT_CON_DATOS, recibidas: RECIBIDAS_CON_DATOS, pl: PL_CON_DATOS });
  await pintar(banco);
  const texto = todos(caja).map((n) => n.textContent || '').join(' ');
  assert.match(texto, /Tu resumen del trimestre ya está listo/, '🔴 falta el título firmado.');
  assert.match(texto, /Ver resumen/, '🔴 falta el botón de enlace.');
  for (const prohibida of [/presentar/i, /plazo/i, /Hacienda/i, /\b\d{1,2}\/\d{1,2}\b/]) {
    assert.doesNotMatch(texto, prohibida,
      `🔴 REGLA 7 · el aviso dice algo que suena a obligación fiscal (${prohibida}).`);
  }
});

// ── ④ DESCARTADO NO REAPARECE (aceptación #5) ────────────────────────────────────────────────

test('SCRUM-1075 · ④ ya descartado para este trimestre → no reaparece, aunque haya datos', async () => {
  const { banco: sonda } = montar();
  const { anio, trimestre } = sonda.ctx.trimestreAnteriorMadrid();
  const clave = sonda.ctx.claveDescarteResumenTrimestre(anio, trimestre);

  const { banco, caja } = montar({
    vat: VAT_CON_DATOS, recibidas: RECIBIDAS_CON_DATOS, pl: PL_CON_DATOS,
    localStorage: { [clave]: '1' },
  });
  await pintar(banco);
  assert.equal(String(caja.innerHTML).trim(), '', '🔴 seguía saliendo tras haberse descartado.');
});

test('SCRUM-1075 · ④b el botón de cerrar GUARDA el descarte y lo quita de pantalla', async () => {
  const { banco, caja } = montar({ vat: VAT_CON_DATOS, recibidas: RECIBIDAS_CON_DATOS, pl: PL_CON_DATOS });
  await pintar(banco);
  const cerrar = todos(caja).find((n) => n._id === 'btn-cerrar-resumen-trimestre');
  assert.ok(cerrar, '🔴 falta el botón de cerrar.');
  cerrar.click();
  assert.equal(String(caja.innerHTML).trim(), '', '🔴 cerrar no vació el aviso.');

  const { anio, trimestre } = banco.ctx.trimestreAnteriorMadrid();
  const clave = banco.ctx.claveDescarteResumenTrimestre(anio, trimestre);
  assert.equal(banco.ctx.localStorage.getItem(clave), '1', '🔴 cerrar no dejó rastro del descarte.');
});

// ── ⑤ AISLAMIENTO ENTRE COMERCIANTES (y entre usuarios del mismo) ───────────────────────────

test('SCRUM-1075 · ⑤ el descarte de un comerciante no calla el aviso de otro (misma clave física)', async () => {
  // SCRUM-409: ids inventados (11, 12), no el 1 — aquí no se prueba nada del comportamiento DEMO.
  const { banco: sonda } = montar({ merchantId: 11 });
  const { anio, trimestre } = sonda.ctx.trimestreAnteriorMadrid();
  const claveMerchant11 = sonda.ctx.claveDescarteResumenTrimestre(anio, trimestre);

  // El "navegador" comparte `localStorage`, pero es OTRO comerciante (merchantId 12): su clave es
  // distinta y el descarte del 11 no debe alcanzarle.
  const { banco, caja } = montar({
    vat: VAT_CON_DATOS, recibidas: RECIBIDAS_CON_DATOS, pl: PL_CON_DATOS,
    localStorage: { [claveMerchant11]: '1' }, merchantId: 12,
  });
  await pintar(banco);
  assert.match(String(caja.innerHTML), /Tu resumen del trimestre ya está listo/,
    '🔴 el descarte de OTRO comerciante silenció este aviso — fuga entre comerciantes.');
});

test('SCRUM-1075 · ⑤b dos usuarios del mismo comerciante lo descartan cada uno por su lado', async () => {
  // SCRUM-409: id inventado (11), no el 1 — aquí no se prueba nada del comportamiento DEMO.
  const { banco: sonda } = montar({ merchantId: 11, teamMemberId: 7 });
  const { anio, trimestre } = sonda.ctx.trimestreAnteriorMadrid();
  const claveTecnico7 = sonda.ctx.claveDescarteResumenTrimestre(anio, trimestre);

  const { banco, caja } = montar({
    vat: VAT_CON_DATOS, recibidas: RECIBIDAS_CON_DATOS, pl: PL_CON_DATOS,
    localStorage: { [claveTecnico7]: '1' }, merchantId: 11, teamMemberId: null, // el OWNER, no el técnico 7
  });
  await pintar(banco);
  assert.match(String(caja.innerHTML), /Tu resumen del trimestre ya está listo/,
    '🔴 el descarte del técnico calló el aviso del dueño de la cuenta.');
});

// ── ⑥ CONTRATO DEL DOM: el enlace navega a Informes ─────────────────────────────────────────

test('SCRUM-1075 · ⑥ «Ver resumen» navega a Informes (`renderAppView(\'reports\')`)', async () => {
  const { banco, caja } = montar({ vat: VAT_CON_DATOS, recibidas: RECIBIDAS_CON_DATOS, pl: PL_CON_DATOS });
  const llamadas = [];
  banco.ctx.renderAppView = (vista) => llamadas.push(vista);
  await pintar(banco);
  const verResumen = todos(caja).find((n) => n._id === 'btn-ver-resumen-trimestre');
  assert.ok(verResumen, '🔴 falta el botón «Ver resumen».');
  verResumen.click();
  assert.deepEqual(llamadas, ['reports'], '🔴 el enlace no navega a Informes.');
});

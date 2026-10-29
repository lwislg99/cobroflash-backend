// tests/scrum1636b-tipo-de-iva-con-coma.test.mjs — SCRUM-1636 ①
//
// Sin gate: el banco de vistas con la red doblada. Ni BD, ni red real.
//
// SCRUM-1608 arregló el REDONDEO del tipo (un 7,5 % ya no se pinta «8 %»), pero cinco sitios del
// panel seguían pintando el número tal cual llega, con PUNTO decimal: «7.5 %». Censo en
// `docs/master/SCRUM-1636.md`. El criterio no se inventa: es `fmtTipoIvaEs` (`api.js`, SCRUM-1608),
// que recibe la fracción; los cinco sitios tienen el tipo en porcentaje y le pasan `x / 100`.
//
// Cada caso lleva su CONTROL: un tipo entero (21 %) no gana una coma ni un «21,0».
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/tiposDeIva.js',
    de: 'op.textContent = fmtTipoIvaEs(Number(t) / 100);',
    a: 'op.textContent = String(t);',
    cae: 'SCRUM-1636 ① · selector',
  },
  {
    fichero: 'public/dashboard/js/reportsView.js',
    de: '<td style="font-weight:600">${fmtTipoIvaEs(r.rate / 100)}%</td>',
    a: '<td style="font-weight:600">${r.rate}%</td>',
    cae: 'SCRUM-1636 ① · Informes',
  },
  {
    fichero: 'public/dashboard/js/expensesView.js',
    de: "['Tipo de IVA', e.vatRate != null ? fmtTipoIvaEs(Number(e.vatRate) / 100) + '%' : null],",
    a: "['Tipo de IVA', e.vatRate != null ? Number(e.vatRate) + '%' : null],",
    cae: 'SCRUM-1636 ① · gasto',
  },
  {
    fichero: 'public/dashboard/js/quoteSuplido.js',
    de: "if (typeof fmtTipoIvaEs === 'function') ivaPerc = fmtTipoIvaEs(Number(ivaPerc) / 100);",
    a: '',
    cae: 'SCRUM-1636 ① · editor: el chip',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: '" " + fmtTipoIvaEs(Number(ivaPorDefecto) / 100) + " %"',
    a: '" " + ivaPorDefecto + " %"',
    cae: 'SCRUM-1636 ① · editor: «IVA por defecto',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const NAV = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
const resp = (status, data) => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => 'application/json' },
  json: async () => data, text: async () => JSON.stringify(data), blob: async () => ({}),
});
const textoDe = (raiz) => todos(raiz).map((n) => String(n.textContent || '')).join(' ').replace(/\s+/g, ' ');

// ── el selector de tipos (las dos listas del editor) ─────────────────────────────────────────

test('SCRUM-1636 ① · selector: la opción del 7,5 se LEE «7,5» y guarda «7.5»; la del 21, «21»', () => {
  const b = cargarDashboard(RAIZ, { red: { navigator: NAV, fetch: async () => resp(200, {}) } });
  const t = b.ctx.tiposDeIva;
  assert.ok(t && typeof t.pintarOpciones === 'function', '🔴 NO PUDE MIRAR: el banco no carga `tiposDeIva.pintarOpciones`.');
  const select = b.ctx.document.createElement('select');
  t.pintarOpciones(select, [21, 7.5, 0]);
  const ops = todos(select).filter((n) => n.tagName === 'OPTION').map((o) => [String(o.value), String(o.textContent)]);
  assert.equal(ops.length, 3, `🔴 NO PUDE MIRAR: se pintan ${ops.length} opciones, no 3.`);
  assert.deepEqual(ops.find(([v]) => v === '7.5'), ['7.5', '7,5'], `🔴 selector: la opción del 7,5 no se lee «7,5»: ${JSON.stringify(ops)}.`);
  assert.deepEqual(ops.find(([v]) => v === '21'), ['21', '21'], `🔴 selector: CONTROL — la del 21 ya no es «21»: ${JSON.stringify(ops)}.`);
});

// ── Informes: el desglose del IVA repercutido por tipo ───────────────────────────────────────

test('SCRUM-1636 ① · Informes: la fila del 7,5 dice «7,5%» y la del 21 sigue «21%»', async () => {
  const vat = {
    year: 2026, quarter: 2, from: '2026-04-01', to: '2026-06-30', currency: 'EUR',
    rates: [{ rate: 21, base: 1000, cuota: 210 }, { rate: 7.5, base: 1000, cuota: 75 }],
    totals: { base: 2000, cuota: 285 }, invoiceCount: 2, excluded: { count: 0, total: 0 },
  };
  const b = cargarDashboard(RAIZ, { datos: (url) => (/\/admin\/reports\/vat\?/.test(String(url)) ? vat : {}) });
  const v = await pintarVista(b, 'renderReportsView');
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: Informes no monta: ${v.error && v.error.message}`);
  await respirar();
  const celdas = todos(v.contenedor).filter((n) => n.tagName === 'TD').map((n) => textoDe(n).trim());
  assert.ok(celdas.includes('21%'), `🔴 NO PUDE MIRAR / CONTROL: no hay celda «21%» en Informes: ${JSON.stringify(celdas.slice(0, 20))}.`);
  assert.ok(celdas.includes('7,5%'), `🔴 Informes: la fila del 7,5 no dice «7,5%»: ${JSON.stringify(celdas.slice(0, 20))}.`);
  assert.ok(!celdas.includes('7.5%'), '🔴 Informes: la fila del 7,5 sigue con punto.');
});

// ── la ficha del gasto ───────────────────────────────────────────────────────────────────────

async function fichaDeGasto(vatRate) {
  const gasto = {
    id: 7, concept: 'Gasto 1636', amount: '107.50', category: 'materiales', date: '2026-10-14T00:00:00.000Z',
    notes: null, tieneFoto: false, job: null, quote: null, provider: null, quoteId: null, providerId: null,
    baseAmount: '100', vatRate, vatAmount: '7.5', providerInvoiceNumber: null, providerInvoiceDate: null,
  };
  const fetch = async (url) => (/\/admin\/expenses\/7$/.test(String(url)) ? resp(200, { ok: true, item: gasto }) : resp(200, []));
  const b = cargarDashboard(RAIZ, { red: { navigator: NAV, fetch } });
  b.ctx.appUserRole = 'admin';
  const v = await pintarVista(b, 'renderExpenseDetailView', 7);
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: la ficha del gasto no monta: ${v.error && v.error.message}`);
  return textoDe(v.contenedor);
}

test('SCRUM-1636 ① · gasto: «Tipo de IVA» dice «7,5%» y un 21 sigue «21%»', async () => {
  const conDecimal = await fichaDeGasto('7.5');
  assert.match(conDecimal, /Tipo de IVA/, `🔴 NO PUDE MIRAR: la ficha no pinta «Tipo de IVA»: «${conDecimal.slice(0, 300)}».`);
  assert.match(conDecimal, /7,5%/, `🔴 gasto: un 7,5 no se pinta «7,5%»: «${conDecimal.slice(0, 400)}».`);
  assert.doesNotMatch(conDecimal, /7\.5%/, '🔴 gasto: el tipo sigue con punto.');
  const entero = await fichaDeGasto('21');
  assert.match(entero, /Tipo de IVA 21%/, `🔴 gasto: CONTROL — un 21 ya no es «21%»: «${entero.slice(0, 400)}».`);
});

// ── el editor: el chip de la línea y el «IVA por defecto» del documento suelto ───────────────

/** `suelto` monta el documento suelto (el único con «IVA por defecto N %»); si no, el presupuesto,
 *  que es el que tiene descuento por línea (`quotesView.js`: el suelto no cuelga `dtoTd`). */
async function editorSuelto(suelto = true) {
  const fetch = async (url) => {
    const u = String(url);
    if (/\/admin\/merchant/.test(u)) return resp(200, { id: 1, name: 'Taller', defaultCurrency: 'EUR' });
    if (/\/admin\/customers/.test(u)) return resp(200, [{ id: 3, name: 'Cliente 1636' }]);
    return resp(200, []);
  };
  const b = cargarDashboard(RAIZ, { red: { navigator: NAV, fetch } });
  b.ctx.appDocumentoSuelto = suelto ? 'factura' : 'no';
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = () => {};
  const v = suelto
    ? await pintarVista(b, 'renderDocumentoSueltoView')
    : await pintarVista(b, 'renderQuotesView', null, false);
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: el editor no monta: ${v.error && v.error.message}`);
  await respirar();
  return { b, contenedor: v.contenedor };
}

/** Pone un valor en un `<select>` de tipos (como el profesional) y dispara su cambio. */
async function elegir(b, select, valor) {
  b.ctx.tiposDeIva.ponerValor(select, valor);
  select.value = valor;
  select.disparar('change');
  select.disparar('input');
  await respirar();
}

const selectoresDeTipo = (raiz) => todos(raiz)
  .filter((n) => n.tagName === 'SELECT' && todos(n).some((o) => o.tagName === 'OPTION' && String(o.value) === '21'));

test('SCRUM-1636 ① · editor: «IVA por defecto 7,5 %» con coma, y con 21 sigue «IVA por defecto 21 %»', async () => {
  const { b, contenedor } = await editorSuelto();
  const porDefecto = selectoresDeTipo(contenedor).find((n) => n.name === 'vat_default');
  assert.ok(porDefecto, '🔴 NO PUDE MIRAR: el editor no tiene el selector «vat_default».');
  assert.match(textoDe(contenedor), /IVA por defecto 21 %/, `🔴 NO PUDE MIRAR / CONTROL: no veo «IVA por defecto 21 %»: «${textoDe(contenedor).slice(0, 300)}».`);
  await elegir(b, porDefecto, '7.5');
  const texto = textoDe(contenedor);
  assert.match(texto, /IVA por defecto 7,5 %/, `🔴 IVA por defecto: el 7,5 no se pinta con coma: «${(texto.match(/IVA por defecto[^·|]{0,12}/) || [''])[0]}».`);
  assert.doesNotMatch(texto, /IVA por defecto 7\.5 %/, '🔴 IVA por defecto: sigue con punto.');
});

test('SCRUM-1636 ① · editor: el chip de la línea dice «IVA 7,5 % · Dto. 10 %», y un 21 sin descuento no gana coma', async () => {
  const { b, contenedor } = await editorSuelto(false);
  const boton = todos(contenedor).find((n) => n.tagName === 'BUTTON' && /quote-line__ajustes/.test(String(n.className || '')));
  assert.ok(boton, `🔴 NO PUDE MIRAR: no hay chip de ajustes en la línea: «${textoDe(contenedor).slice(0, 300)}».`);
  // El tipo y el descuento de la línea viven en la hoja que abre el chip.
  if (typeof boton.onclick === 'function') await boton.onclick({ type: 'click', target: boton, preventDefault() {} });
  else boton.disparar('click');
  await respirar();
  const cuerpo = b.ctx.document.body;
  const deLinea = selectoresDeTipo(cuerpo).find((n) => n.name !== 'vat_default');
  assert.ok(deLinea, '🔴 NO PUDE MIRAR: al abrir el chip no aparece el selector de tipo de la línea.');
  // El campo «Dto. %» de la línea (`quotesView.js`, SCRUM-594): numérico, de 0 a 100.
  const dto = [...todos(cuerpo), ...todos(contenedor)]
    .find((n) => n.tagName === 'INPUT' && n.type === 'number' && String(n.max) === '100' && String(n.min) === '0');
  assert.ok(dto, '🔴 NO PUDE MIRAR: no encuentro el campo de descuento de la línea.');
  await elegir(b, deLinea, '7.5');
  dto.value = '12.5';
  dto.disparar('input');
  dto.disparar('change');
  await respirar();
  const chipDec = String(boton.textContent);
  assert.equal(chipDec, 'IVA 7,5 % · Dto. 12,5 %', `🔴 chip: el descuento con decimales sigue con punto: «${chipDec}».`);
  // CONTROL: un descuento entero no gana coma ni «,0».
  dto.value = '10';
  dto.disparar('input');
  dto.disparar('change');
  await respirar();
  const chip = String(boton.textContent);
  assert.equal(chip, 'IVA 7,5 % · Dto. 10 %', `🔴 chip: CONTROL — un 10 entero no es «Dto. 10 %»: «${chip}».`);
  // CONTROL: con 21 y sin descuento, el texto que compone el chip es «IVA 21 %» (aunque se oculte, F4).
  dto.value = '';
  dto.disparar('input');
  await elegir(b, deLinea, '21');
  const chip21 = String(boton.textContent);
  assert.equal(chip21, 'IVA 21 %', `🔴 chip: CONTROL — un 21 sin descuento ya no es «IVA 21 %»: «${chip21}».`);
});

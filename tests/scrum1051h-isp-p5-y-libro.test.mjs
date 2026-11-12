// tests/scrum1051h-isp-p5-y-libro.test.mjs — SCRUM-1051h · relevo de 1051g
//
// ① P5, firmado por Javier en SCRUM-1051 c.21761: una factura con líneas S2 a un cliente con NIF
//    válido que NO es `tipoDestinatario = EMPRESARIO` se rechaza con P5, literal. P4 (sin NIF) no
//    cambia. Las dos bocas de J1 (`POST /admin/invoices` y el cobro) ya llevan el `message` del
//    error tipado (1051g); aquí se fija que el caso «no es empresario» deja de ir sin texto.
// ② P3, firmado en c.21750 punto 5: el libro de emitidas lleva la columna «ISP» y el valor «Sí» en
//    la fila S2, en la DESCARGA (`librosAeat.ts` + `librosAeatCsv.ts`) y en la PANTALLA
//    (`libroRegistroView.js`). Una fila sin S2 deja la celda VACÍA: no hay texto firmado para «no».
//
// El libro sólo LEE: nada del camino de emisión cambia por ②.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Literales copiados de Jira, byte a byte (c.21761, c.21750).
const P4 = 'Para facturar con inversión del sujeto pasivo, el cliente necesita NIF.';
const P5 = 'Para facturar con inversión del sujeto pasivo, el cliente tiene que ser empresario o profesional.';
const P3_COLUMNA = 'ISP';
const P3_VALOR = 'Sí';

const isp = await import('../dist/modules/invoicing/domain/destinatarioIsp.js');
const {
  COLUMNAS_EXPEDIDAS, filasLibroExpedidas,
} = await import('../dist/modules/fiscal/librosAeat/librosAeat.js');
const { csvLibroExpedidas } = await import('../dist/modules/fiscal/librosAeat/librosAeatCsv.js');

const S2 = Object.freeze({ concept: 'Subcontrata de obra', qty: 1, price: 1000, tax: 0, causa: 'S2' });
const NIF_OK = '12345678Z';

// ── ① P5 ─────────────────────────────────────────────────────────────────────────────────────

test('1051h ① · S2 con NIF válido y cliente NO empresario se rechaza con P5, literal', () => {
  for (const tipoDestinatario of [null, undefined, 'PARTICULAR', 'empresario']) {
    const r = isp.destinatarioIspNoValido([S2], { taxId: NIF_OK, tipoDestinatario });
    assert.deepEqual(r, { code: isp.ERROR_ISP_CLIENTE_NO_EMPRESARIO, message: P5 },
      `tipoDestinatario=${tipoDestinatario}`);
  }
  assert.equal(isp.COPY_ISP_NO_EMPRESARIO, P5);
});

test('1051h ① · el portón LANZA el error tipado con P5 (lo que leen la ruta y el cobro)', () => {
  let err = null;
  try { isp.exigirDestinatarioParaIsp([S2], { taxId: NIF_OK, tipoDestinatario: 'PARTICULAR' }); } catch (e) { err = e; }
  assert.ok(err, 'el portón no lanzó con una S2 a un cliente no empresario');
  assert.equal(isp.esErrorDestinatarioIsp(err), true);
  assert.equal(err.code, isp.ERROR_ISP_CLIENTE_NO_EMPRESARIO);
  assert.equal(err.mensaje, P5);
});

test('1051h ① · CONTROL: P4 no cambia, y P4 y P5 son textos distintos', () => {
  assert.deepEqual(isp.destinatarioIspNoValido([S2], { taxId: null, tipoDestinatario: 'PARTICULAR' }),
    { code: isp.ERROR_ISP_CLIENTE_SIN_NIF, message: P4 });
  assert.notEqual(P4, P5);
  assert.equal(isp.destinatarioIspNoValido([S2], { taxId: NIF_OK, tipoDestinatario: 'EMPRESARIO' }), null);
});

test('1051h ① · la ruta pasa el `message` del error al 422 (P5 llega a la respuesta, no se queda en el error)', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  const i = src.indexOf('esErrorDestinatarioIsp(err)');
  assert.ok(i > 0, 'la ruta ya no reconoce el error del portón ISP');
  const tramo = src.slice(i, i + 300);
  assert.match(tramo, /status\(422\)/);
  assert.match(tramo, /message:\s*err\.mensaje/);
});

// ── ② P3 en la DESCARGA ──────────────────────────────────────────────────────────────────────

function asiento(over = {}) {
  return {
    numero: '2026-CF-001', fecha: '2026-08-15T10:00:00.000Z', tipo: 'F1', clienteId: 70,
    base: 100, cuota: 21, porTipo: [{ tipo: 21, base: 100, cuota: 21 }], total: 121,
    moneda: 'EUR', estado: 'paid', importeIlegible: false,
    enlaces: { presupuestoId: null, presupuestoFirmado: null, albaranes: [], albaranesNoSellados: 0, cobroId: null },
    ...over,
  };
}
const libroDe = (asientos) => ({ asientos, miradas: asientos.length, ajenas: 0, sinNumero: 0 });
const DEST = new Map([[70, { nombre: 'Obras Pérez, S.L.', nif: 'B12345678' }]]);
// Una mixta: 1.000 de S2 al 21 % nominal con cuota 0, y 100 al 21 % con su cuota.
const MIXTA = asiento({
  base: 1100, cuota: 21, total: 1121,
  porTipo: [{ tipo: 21, base: 1000, cuota: 0, causa: 'S2' }, { tipo: 21, base: 100, cuota: 21 }],
});

test('1051h ② · la descarga declara la columna P3 con su rótulo literal «ISP»', () => {
  const col = COLUMNAS_EXPEDIDAS.find((c) => c.clave === 'isp');
  assert.ok(col, 'el libro de emitidas no tiene columna `isp`');
  assert.equal(col.rotulo, P3_COLUMNA);
  assert.equal(isp.COPY_ISP_COLUMNA, P3_COLUMNA);
  assert.equal(isp.COPY_ISP_VALOR_SI, P3_VALOR);
});

test('1051h ② · la fila S2 lleva «Sí» en la columna ISP y la otra fila de la misma factura la deja vacía', () => {
  const filas = filasLibroExpedidas(libroDe([MIXTA]), DEST);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].isp, P3_VALOR, 'la fila S2 no lleva «Sí»');
  assert.equal(filas[0].cuotaIva, 0);
  assert.equal(filas[1].isp, null, 'la fila con IVA no puede llevar «Sí»');

  const csv = csvLibroExpedidas(filas).replace(/^﻿/, '').split('\r\n');
  const cab = csv[0].split(';');
  const k = cab.indexOf(P3_COLUMNA);
  assert.ok(k >= 0, `la cabecera del CSV no lleva «${P3_COLUMNA}»: ${csv[0]}`);
  assert.equal(csv[1].split(';')[k], P3_VALOR);
  assert.equal(csv[2].split(';')[k], '');
});

test('1051h ② · CONTROL: una factura sin S2 no lleva «Sí» en ninguna fila', () => {
  const filas = filasLibroExpedidas(libroDe([asiento(), asiento({ importeIlegible: true }), asiento({ porTipo: [] })]), DEST);
  assert.equal(filas.length, 3);
  for (const f of filas) assert.equal(f.isp, null);
  assert.equal(csvLibroExpedidas(filas).includes(';' + P3_VALOR + ';'), false);
});

// ── ② P3 en la PANTALLA ──────────────────────────────────────────────────────────────────────

function nodo(tag) {
  const n = {
    tagName: String(tag).toUpperCase(), className: '', id: '', type: '',
    style: { cssText: '', color: '' }, dataset: {}, hijos: [], _texto: '',
    appendChild(h) { n.hijos.push(h); return h; },
    addEventListener() {},
    set textContent(v) { n._texto = String(v); n.hijos = []; },
    get textContent() { return n._texto; },
    set innerHTML(v) { if (v === '') n.hijos = []; },
    get innerHTML() { return ''; },
  };
  return n;
}
const todos = (n, out = []) => { out.push(n); for (const h of n.hijos) todos(h, out); return out; };

async function pintar(respuesta) {
  const vista = path.join(RAIZ, 'public/dashboard/js/libroRegistroView.js');
  const contenedor = nodo('div');
  const ctx = {
    document: { createElement: nodo }, window: {},
    Intl, Date, Array, Number, String, Boolean, Object, JSON, isNaN, console,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(path.dirname(vista), 'api.js'), 'utf8'), ctx, { filename: 'api.js' });
  ctx.apiRequest = async () => respuesta;
  vm.runInContext(fs.readFileSync(vista, 'utf8'), ctx, { filename: 'libroRegistroView.js' });
  assert.equal(typeof ctx.window.renderLibroRegistroView, 'function', 'la vista no se ha publicado: no se mide nada');
  ctx.window.renderLibroRegistroView(contenedor);
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  return contenedor;
}

test('1051h ② · la pantalla del libro pinta la cabecera «ISP» y «Sí» en la factura con S2, y vacío en la otra', async () => {
  const c = await pintar({
    asientos: [MIXTA, asiento({ numero: '2026-CF-002' })],
    miradas: 2, ajenas: 0, sinNumero: 0, importesIlegibles: [],
  });
  const ths = todos(c).filter((x) => x.tagName === 'TH').map((x) => x.textContent);
  assert.ok(ths.length > 0, 'SUELO: la pantalla no ha pintado ninguna cabecera');
  const k = ths.indexOf(P3_COLUMNA);
  assert.ok(k >= 0, `la tabla no tiene la cabecera «${P3_COLUMNA}»: ${ths.join(' | ')}`);

  const filas = todos(c).filter((x) => x.tagName === 'TR' && x.dataset.numero);
  assert.equal(filas.length, 2, 'SUELO: la pantalla no pinta los dos asientos');
  const celdas = (tr) => tr.hijos.filter((x) => x.tagName === 'TD');
  assert.equal(celdas(filas[0]).length, ths.length, 'la fila S2 no tiene tantas celdas como cabeceras');
  assert.equal(celdas(filas[0])[k].textContent, P3_VALOR);
  assert.equal(celdas(filas[1]).length, ths.length);
  assert.equal(celdas(filas[1])[k].textContent, '');
});

// El catálogo de la casa (scripts/meta-guard-mutaciones.mjs → aplicarUna).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/invoicing/domain/destinatarioIsp.ts',
    de: '    return { code: ERROR_ISP_CLIENTE_NO_EMPRESARIO, message: COPY_ISP_NO_EMPRESARIO };\n',
    a: '    return { code: ERROR_ISP_CLIENTE_NO_EMPRESARIO };\n',
    cae: '1051h ① · S2 con NIF válido y cliente NO empresario se rechaza con P5',
  },
  {
    fichero: 'src/modules/fiscal/librosAeat/librosAeat.ts',
    de: "    isp: t.causa === 'S2' ? COPY_ISP_VALOR_SI : null,\n",
    a: '    isp: null,\n',
    cae: '1051h ② · la fila S2 lleva «Sí» en la columna ISP',
  },
  {
    fichero: 'public/dashboard/js/libroRegistroView.js',
    de: "        celda(Array.isArray(a.porTipo) && a.porTipo.some((t) => t && t.causa === 'S2') ? COPY.valorIsp : '');\n",
    a: "        celda('');\n",
    cae: '1051h ② · la pantalla del libro pinta la cabecera «ISP»',
  },
];

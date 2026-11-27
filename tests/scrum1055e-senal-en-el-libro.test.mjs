// tests/scrum1055e-senal-en-el-libro.test.mjs — SCRUM-1055e · la señal «cobro sin fecha declarada»,
// en la PANTALLA del libro de registro.
//
// El servidor es de SCRUM-1055c (`tests/scrum1055c-senal-cobro-sin-fecha.test.mjs`): cada asiento de
// caja trae `cobroSinFechaDeclarada` y el libro trae `cobrosSinFechaDeclarada` y `cobrosSinFilas`.
// Aquí, la vista REAL montada en el banco de vistas (SCRUM-1005d), con un doble de `fetch` que contesta
// `/admin/libro-registro`: se mira QUÉ pinta.
//
// Los textos son los FIRMADOS por el fundador en SCRUM-1055 c.22857 ③, copiados de Jira; ficha:
// docs/microcopy/2026-11-26-SCRUM-1055-cobro-sin-fecha.md. `cobrosSinFilas` NO se pinta: lo decide
// el fundador (c.22882), y el último caso lo fija.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const espera = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

// Catálogo del meta-guard (SCRUM-1387 / A3, SCRUM-1731): `aplicarUna` de la casa.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «Quitar la condición»: la etiqueta sale en todos los asientos.
    fichero: 'public/dashboard/js/libroRegistroView.js',
    de: '        if (a.cobroSinFechaDeclarada === true) {\n',
    a: '        if (true) {\n',
    cae: 'SCRUM-1055e · la etiqueta sale SOLO en el asiento con la señal, con su explicación en el title',
  },
  {
    // «Plural fijo»: con 1 dice «1 facturas cobradas…».
    fichero: 'public/dashboard/js/libroRegistroView.js',
    de: '        avisar(sinFecha === 1 ? COPY.resumenSinFechaCobroUna\n',
    a: '        avisar(false ? COPY.resumenSinFechaCobroUna\n',
    cae: 'SCRUM-1055e · con 1, la línea del resumen va en singular',
  },
  {
    // La línea con 0 también.
    fichero: 'public/dashboard/js/libroRegistroView.js',
    de: "      if (typeof sinFecha === 'number' && sinFecha > 0) {\n",
    a: "      if (typeof sinFecha === 'number' && sinFecha >= 0) {\n",
    cae: 'SCRUM-1055e · con 0, no hay línea del resumen (y cobrosSinFilas no se pinta)',
  },
];

// ── Los tres textos de SCRUM-1055 c.22857 ③, copiados de Jira byte a byte ──────────────────────────
const TEXTO_1 = 'Fecha de cobro sin indicar';
const TEXTO_2 = 'Esta factura se marcó como cobrada sin indicar el día en que entró el dinero. Se ha tomado el día en que se marcó. Si entró otro día, corrígelo antes de pasarle el trimestre a tu asesor.';
const TEXTO_3 = (n) => `${n} facturas cobradas sin fecha de cobro indicada.`;
const TEXTO_3_UNA = '1 factura cobrada sin fecha de cobro indicada.';

const asiento = (numero, cobroSinFechaDeclarada) => ({
  numero, fecha: '2026-02-10T10:00:00.000Z', tipo: 'F1', base: 100, cuota: 21, total: 121,
  moneda: 'EUR', estado: 'paid', porTipo: [{ tipo: 21, base: 100, cuota: 21 }],
  enlaces: { cobroId: 9 }, cobroSinFechaDeclarada,
});

async function pintarLibro(libro) {
  const peticiones = [];
  const fetch = async (url) => {
    const pu = new URL(String(url), 'http://banco.invalid');
    peticiones.push(pu.pathname);
    const json = pu.pathname === '/admin/libro-registro' ? libro : [];
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, blob: async () => ({}),
      json: async () => json, text: async () => JSON.stringify(json) };
  };
  const banco = cargarDashboard(RAIZ, { red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch } });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderLibroRegistroView');
  assert.equal(r.error, null, `la vista no montó: ${r.error && r.error.message}`);
  await espera();
  assert.ok(peticiones.includes('/admin/libro-registro'), '🔴 CIEGO: la vista no ha pedido el libro');
  const c = r.contenedor;
  const filas = todos(c).filter((n) => n.tagName === 'TR' && n.dataset && n.dataset.numero);
  assert.equal(filas.length, libro.asientos.length, '🔴 SUELO: la vista no ha pintado los asientos');
  const marcas = (tr) => todos(tr).filter((n) => n.tagName === 'SPAN' && /\bbadge\b/.test(n.className || ''));
  const avisos = todos(c).filter((n) => n.tagName === 'DIV' && /\balert\b/.test(n.className || '')).map((n) => n.textContent);
  const COPY = banco.ctx.LIBRO_COPY || (banco.ctx.window && banco.ctx.window.LIBRO_COPY);
  return { filas, marcas, avisos, COPY };
}

const LIBRO = (n, extra = {}) => ({
  asientos: [asiento('F-MARCADO', true), asiento('F-DECLARADA', false)],
  miradas: 2, ajenas: 0, sinNumero: 0, importesIlegibles: [], cobrosSinFechaDeclarada: n, ...extra,
});

test('SCRUM-1055e · los tres textos de la vista son los firmados en c.22857 ③, literales', async () => {
  const { COPY } = await pintarLibro(LIBRO(0));
  assert.ok(COPY, '🔴 CIEGO: la vista no publica LIBRO_COPY');
  assert.equal(COPY.etiquetaSinFechaCobro, TEXTO_1);
  assert.equal(COPY.explicacionSinFechaCobro, TEXTO_2);
  assert.equal(COPY.resumenSinFechaCobroUna, TEXTO_3_UNA);
  assert.equal(`7 ${COPY.resumenSinFechaCobroVarias}`, TEXTO_3(7));
});

test('SCRUM-1055e · la etiqueta sale SOLO en el asiento con la señal, con su explicación en el title', async () => {
  const { filas, marcas } = await pintarLibro(LIBRO(2));
  const [conSenal, sinSenal] = filas;
  assert.equal(conSenal.dataset.numero, 'F-MARCADO');
  // Control positivo: la marca «Cobro» de los dos asientos sale (la columna se pinta).
  for (const tr of filas) assert.ok(marcas(tr).some((m) => m.textContent === 'Cobro'), `🔴 SUELO: ${tr.dataset.numero} sin «Cobro»`);
  const etiquetas = marcas(conSenal).filter((m) => m.textContent === TEXTO_1);
  assert.equal(etiquetas.length, 1, `🔴 el asiento con señal no lleva «${TEXTO_1}»`);
  assert.equal(etiquetas[0].title, TEXTO_2, '🔴 la etiqueta no lleva la explicación firmada');
  assert.match(etiquetas[0].className, /\bbadge-amber\b/, 'la etiqueta no es la pastilla de Aviso de la casa');
  assert.equal(marcas(sinSenal).filter((m) => m.textContent === TEXTO_1).length, 0,
    '🔴 el asiento SIN señal lleva la etiqueta');
});

test('SCRUM-1055e · con 2, la línea del resumen va en plural', async () => {
  const { avisos } = await pintarLibro(LIBRO(2));
  assert.deepEqual(avisos, [TEXTO_3(2)]);
});

test('SCRUM-1055e · con 1, la línea del resumen va en singular', async () => {
  const { avisos } = await pintarLibro(LIBRO(1));
  assert.deepEqual(avisos, [TEXTO_3_UNA]);
});

test('SCRUM-1055e · con 0, no hay línea del resumen (y cobrosSinFilas no se pinta)', async () => {
  const { avisos } = await pintarLibro(LIBRO(0, { cobrosSinFilas: 3 }));
  assert.deepEqual(avisos, [], '🔴 con 0 cobros sin fecha (y 3 sin filas) se ha pintado un aviso');
});

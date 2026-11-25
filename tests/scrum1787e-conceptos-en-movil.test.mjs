// tests/scrum1787e-conceptos-en-movil.test.mjs — SCRUM-1787e
//
// EN MÓVIL, LA TABLA DE CONCEPTOS DE LA FICHA DE FACTURA ESCONDÍA PRECIO, IVA Y TOTAL.
//
// Medido a 390 px el 21-nov-2026 con `docs/master/evidencias/SCRUM-1787/guion/sonda-1787e.js` (código de la
// rama, datos de EJEMPLO): 2 de 5 columnas a la vista y 197 px escondidos tras el scroll PROPIO de la tabla
// (la regla global `.table { display:block; overflow-x:auto }` + `white-space:nowrap` de ≤768 px). La página
// no scrollea; la tabla sí, y nada avisa de que hay más. El presupuesto (`quotesDetailView.js`, S2) tiene el
// mismo defecto con la misma medida: va a Luis en el registro, no se toca aquí.
//
// EL ARREGLO: a ≤640 px (el umbral de `.table--cards-mobile`/`.table--stack-mobile`) cada línea es un bloque:
// el concepto a todo el ancho y Cant./Precio/IVA/Total debajo, cada uno con su rótulo, que sale de la PROPIA
// cabecera (`data-label`): ni un texto nuevo ni dos copias del mismo. Después: 5 de 5, 0 px de scroll.
//
// QUÉ MIRA Y QUÉ NO. Pinta la ficha en el banco de vistas (sin navegador: los píxeles los mide la sonda) y lee
// `styles.css` SIN comentarios, con las reglas de dentro de cada `@media`. Control de escritorio: ninguna regla
// de `.j1-fac-conceptos` vive fuera de un `@media (max-width: 640px)`, así que a 1280 px la tabla es la de hoy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
const CLASE = 'j1-fac-conceptos';
const ROTULOS = ['Cant.', 'Precio', 'IVA', 'Total'];

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La tabla pierde la clase que la apila en móvil.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "tablaConc.className = 'table j1-fac-conceptos';",
    a: "tablaConc.className = 'table';",
    cae: 'SCRUM-1787e · ① la tabla de conceptos lleva su clase y cada celda numérica su rótulo de la cabecera',
  },
  {
    // La cabecera vuelve a verse en móvil: el apilado deja de ocultarla.
    fichero: 'public/dashboard/css/styles.css',
    de: '.j1-fac-conceptos thead { display:none; }',
    a: '.j1-fac-conceptos thead { display:table-header-group; }',
    cae: 'SCRUM-1787e · ② a ≤640 px la tabla se apila: cabecera fuera, cuatro columnas, concepto a todo el ancho y rótulo por celda',
  },
];

async function montar() {
  const factura = {
    id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 133.1, currency: 'EUR',
    createdAt: '2026-11-02T09:00:00.000Z', customerName: 'Cliente Ejemplo', customer: { id: 1, name: 'Cliente Ejemplo' },
    lines: [
      { apartado: true, concept: 'Baño' },
      { concept: 'ZZCONCEPTO alicatado', qty: 1, price: 100, tax: 0.21 },
      { concept: 'ZZCONCEPTO grifería', qty: 2, price: 5, tax: 0.21 },
    ],
    rectifiedBy: [],
  };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) });
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha de factura revienta al abrirse: ${r.error && r.error.message}`);
  return todos(r.contenedor);
}

/** Todas las reglas, con el `@media` que las envuelve (o `null`). Sin comentarios (sitio único, SCRUM-700). */
function reglas(css) {
  const out = [];
  const recorrer = (t, medio) => {
    let i = 0;
    while (i < t.length) {
      const abre = t.indexOf('{', i);
      if (abre < 0) break;
      const preludio = t.slice(i, abre).trim();
      let prof = 1, j = abre + 1;
      while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
      const cuerpo = t.slice(abre + 1, j - 1);
      if (preludio.startsWith('@media') || preludio.startsWith('@supports')) recorrer(cuerpo, preludio.replace(/\s+/g, ' '));
      else if (!preludio.startsWith('@')) out.push({ selectores: preludio.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo: cuerpo.replace(/\s+/g, ''), medio });
      i = j;
    }
  };
  recorrer(ejecutableDe(css, { ancla: '.j1-prog-paso', donde: 'public/dashboard/css/styles.css', almohadillaEsComentario: false }), null);
  return out;
}

test('SCRUM-1787e · ① la tabla de conceptos lleva su clase y cada celda numérica su rótulo de la cabecera', async () => {
  const nodos = await montar();
  const tablas = nodos.filter((n) => n.tagName === 'TABLE' && String(n.className).split(/\s+/).includes(CLASE));
  assert.equal(tablas.length, 1, `🔴 se esperaba UNA tabla .${CLASE} en la ficha y hay ${tablas.length}`);
  const filas = todos(tablas[0]).filter((n) => n.tagName === 'TR' && (n.hijos || []).length === 5);
  // Suelo: si el banco no ve las filas, «todas llevan rótulo» pasaría sobre la nada.
  assert.ok(filas.length >= 3, `CIEGO: el banco ve ${filas.length} filas de 5 celdas (cabecera + 2 líneas esperadas)`);
  const lineas = filas.filter((tr) => tr.hijos[0].tagName === 'TD');
  assert.equal(lineas.length, 2, `🔴 se esperaban las 2 líneas con importe y hay ${lineas.length}`);
  for (const tr of lineas) {
    assert.equal(tr.hijos[0].dataset.label, undefined, '🔴 la celda del concepto no lleva rótulo: va a todo el ancho');
    assert.deepEqual(tr.hijos.slice(1).map((td) => td.dataset.label), ROTULOS,
      '🔴 cada celda numérica lleva como rótulo el texto de SU columna en la cabecera');
  }
});

test('SCRUM-1787e · ② a ≤640 px la tabla se apila: cabecera fuera, cuatro columnas, concepto a todo el ancho y rótulo por celda', () => {
  const todas = reglas(CSS);
  // Suelo: el parser ve el bloque J1 de 1787b. Si no lo ve, cualquier «no hay» de abajo es CIEGO.
  assert.ok(todas.some((r) => r.selectores.includes('.j1-prog-paso')), 'CIEGO: el parser no ve `.j1-prog-paso` en styles.css');
  const movil = todas.filter((r) => r.medio === '@media (max-width: 640px)');
  const cuerpoDe = (sel) => movil.filter((r) => r.selectores.includes(sel)).map((r) => r.cuerpo).join(';');
  assert.match(cuerpoDe(`.${CLASE} thead`), /display:none/, '🔴 en móvil la cabecera se oculta: cada celda lleva su rótulo');
  assert.match(cuerpoDe(`.${CLASE} tbody tr`), /display:grid/, '🔴 cada línea es una rejilla, no una fila que scrollea');
  assert.match(cuerpoDe(`.${CLASE} tbody tr`), /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, '🔴 Cant., Precio, IVA y Total, en cuatro columnas que no desbordan');
  assert.match(cuerpoDe(`.${CLASE} tbody td`), /white-space:normal/, '🔴 sin el `nowrap` global de móvil, que ensancha la tabla');
  assert.match(cuerpoDe(`.${CLASE} tbody td:first-child`), /grid-column:1\/-1/, '🔴 el concepto ocupa todo el ancho');
  assert.match(cuerpoDe(`.${CLASE} tbody td[data-label]::before`), /content:attr\(data-label\)/, '🔴 el rótulo sale del data-label, no de un texto escrito en el CSS');
});

test('SCRUM-1787e · ③ control de escritorio: ninguna regla de la tabla vive fuera del @media de móvil', () => {
  const propias = reglas(CSS).filter((r) => r.selectores.some((s) => s.includes(CLASE)));
  assert.ok(propias.length >= 5, `CIEGO: el parser ve ${propias.length} reglas de .${CLASE}`);
  const fuera = propias.filter((r) => r.medio !== '@media (max-width: 640px)');
  assert.deepEqual(fuera.map((r) => r.selectores.join(', ')), [], '🔴 a 1280 px la tabla tiene que ser la de hoy');
});

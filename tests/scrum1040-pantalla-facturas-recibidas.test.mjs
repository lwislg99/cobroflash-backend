// tests/scrum1040-pantalla-facturas-recibidas.test.mjs — SCRUM-1040 (CON-04).
//
// ⚠️ MISMO CRITERIO QUE `scrum296-pantalla-libro.test.mjs`: esta pantalla se mide EJECUTÁNDOLA.
//
//   · la carga FALLA                    → aviso, y NI UNA fila.
//   · el servidor miró N y salieron 0   → aviso de descuadre, NO «no tienes».
//   · el servidor miró 0                → «todavía no tienes», que aquí sí es la verdad.
//
// Un `grep` sobre el fuente no distingue las tres, así que se ejecuta sobre un DOM mínimo de
// mentira (sin dependencias nuevas, regla 36).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ramaDeCase } from './_bloque-estructural.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const VISTA = path.join(RAIZ, 'public/dashboard/js/facturasRecibidasView.js');
const API = path.join(path.dirname(VISTA), 'api.js');

// ── El DOM de mentira: lo justo para que la vista corra y se pueda mirar lo que pinta ────────
function nodo(tag) {
  const n = {
    tagName: String(tag).toUpperCase(),
    className: '', id: '', type: '',
    style: { cssText: '', color: '' },
    dataset: {},
    hijos: [],
    _texto: '', _html: '',
    listeners: {},
    appendChild(h) { n.hijos.push(h); return h; },
    addEventListener(ev, fn) { n.listeners[ev] = fn; },
    querySelector(sel) {
      const id = sel.replace('#', '');
      return todos(n).find((x) => x.id === id) || null;
    },
    set textContent(v) { n._texto = String(v); n.hijos = []; },
    get textContent() { return n._texto; },
    set innerHTML(v) {
      n._html = String(v);
      if (v === '') { n.hijos = []; return; }
      // Solo hace falta reconocer los `id="..."` para que `querySelector` los encuentre: la
      // vista no lee nada más del HTML inyectado.
      const ids = [...v.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      n.hijos = ids.map((id) => { const h = nodo('div'); h.id = id; return h; });
    },
    get innerHTML() { return n._html; },
  };
  return n;
}

function todos(n, out = []) {
  out.push(n);
  for (const h of n.hijos) todos(h, out);
  return out;
}
const textos = (n) => todos(n).map((x) => x.textContent).filter(Boolean);
const filasDom = (n) => todos(n).filter((x) => x.tagName === 'TR' && x.dataset.fila);
const tablas = (n) => todos(n).filter((x) => x.tagName === 'TABLE');

/** Ejecuta la vista con una respuesta dada y devuelve el contenedor pintado. */
async function pintar(respuesta) {
  const codigo = fs.readFileSync(VISTA, 'utf8');
  const contenedor = nodo('div');
  const ctx = {
    document: { createElement: nodo },
    window: {},
    apiRequest: async () => { if (respuesta instanceof Error) throw respuesta; return respuesta; },
    URLSearchParams, Intl, Date, Array, Number, String, Boolean, Object, JSON, isNaN, console,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // `api.js` ANTES, como en el navegador (`index.html`): la vista formatea con
  // `fmtMoneyEsOAusente`, que vive ahí.
  vm.runInContext(fs.readFileSync(API, 'utf8'), ctx, { filename: 'api.js' });
  ctx.apiRequest = async () => { if (respuesta instanceof Error) throw respuesta; return respuesta; };
  vm.runInContext(codigo, ctx, { filename: 'facturasRecibidasView.js' });

  assert.equal(typeof ctx.window.renderFacturasRecibidasView, 'function',
    '🔴 la vista no ha publicado `renderFacturasRecibidasView`: el test no está midiendo la pantalla.');
  ctx.window.renderFacturasRecibidasView(contenedor);
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  return { contenedor, COPY: ctx.window.FACTURAS_RECIBIDAS_COPY };
}

const fila = (o = {}) => ({
  numeroProveedor: 'A-2026/443', fechaExpedicion: '2026-08-10', fechaApunte: '2026-08-11',
  nifProveedor: 'B12345678', nombreProveedor: 'Suministros Peña', concepto: 'Material',
  base: 100, tipoIva: 21, cuota: 21, deducible: 'Sí', total: 121, moneda: 'EUR',
  ...o,
});
const libro = (o = {}) => ({ filas: [fila()], miradas: 1, avisos: ['Formato provisional: no contrastado contra especificación oficial.'], ...o });

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1040 · SUELO: con datos buenos la pantalla PINTA la tabla', async () => {
  const { contenedor } = await pintar(libro({ filas: [fila(), fila({ numeroProveedor: 'A-2026/444' })], miradas: 2 }));
  assert.equal(tablas(contenedor).length, 1, '🔴 la pantalla no pinta ninguna tabla con datos correctos.');
  assert.equal(filasDom(contenedor).length, 2, '🔴 la pantalla no pinta las dos filas.');
});

// ── LAS TRES SITUACIONES QUE NO SE PUEDEN CONFUNDIR ──────────────────────────────────────────

test('SCRUM-1040 · si la carga FALLA no se pinta ni una fila', async () => {
  const { contenedor, COPY } = await pintar(new Error('boom'));
  assert.equal(tablas(contenedor).length, 0,
    '🔴 la pantalla ha pintado una tabla con la carga rota. Se lee como «no compraste nada».');
  assert.ok(textos(contenedor).includes(COPY.error), '🔴 no sale el aviso de error.');
  assert.ok(!textos(contenedor).includes(COPY.vacioDeVerdad),
    '🔴 con la carga rota la pantalla afirma que no tienes facturas recibidas.');
});

test('SCRUM-1040 · miró gastos y no salió ningún asiento → DESCUADRE, no «no tienes»', async () => {
  const { contenedor, COPY } = await pintar(libro({ filas: [], miradas: 40, avisos: [] }));
  const t = textos(contenedor);
  assert.ok(t.includes(COPY.descuadre(40)), '🔴 con 40 gastos mirados y 0 filas no avisa del descuadre.');
  assert.ok(!t.includes(COPY.vacioDeVerdad), '🔴 confunde el descuadre con «no tienes».');
});

test('SCRUM-1040 · miró CERO → «todavía no tienes facturas recibidas en este periodo» (aceptación 4)', async () => {
  const { contenedor, COPY } = await pintar(libro({ filas: [], miradas: 0, avisos: [] }));
  const t = textos(contenedor);
  assert.ok(t.includes(COPY.vacioDeVerdad), '🔴 con cero gastos mirados no lo dice.');
  assert.ok(!t.includes(COPY.descuadre(0)), '🔴 un periodo legítimamente vacío se presenta como roto.');
  assert.equal(tablas(contenedor).length, 0, '🔴 un periodo vacío no debería pintar una tabla rota.');
});

test('SCRUM-1040 · una respuesta SIN `miradas` es un fallo, no un cero', async () => {
  const { contenedor } = await pintar({ filas: [] });
  assert.equal(tablas(contenedor).length, 0);
  assert.ok(!textos(contenedor).some((x) => /todavía no tienes/i.test(x)),
    '🔴 sin `miradas` la pantalla afirma que no tienes facturas recibidas.');
});

// ── LOS GASTOS SIN CLASIFICAR SE SEÑALAN, NO SE OCULTAN (aceptación 6) ───────────────────────

test('SCRUM-1040 · el aviso de gastos sin clasificar (ya aprobado) se pinta tal cual llega', async () => {
  const AVISO = '2 gastos sin datos de IVA no figuran en este libro. Importe total: 100.';
  const { contenedor } = await pintar(libro({ avisos: ['Formato provisional: no contrastado contra especificación oficial.', AVISO] }));
  assert.ok(textos(contenedor).includes(AVISO),
    '🔴 el aviso de gastos excluidos no se pinta: se estarían ocultando en vez de señalar (SCRUM-1037 caso d).');
});

// ── LAS COLUMNAS Y LOS TOTALES AL PIE (aceptaciones 1 y 3) ───────────────────────────────────

test('SCRUM-1040 · las seis columnas de la aceptación están todas', async () => {
  const { contenedor, COPY } = await pintar(libro());
  const cabeceras = todos(contenedor).filter((n) => n.tagName === 'TH').map((n) => n.textContent);
  assert.deepEqual(cabeceras, [COPY.colFecha, COPY.colProveedor, COPY.colNif, COPY.colBase, COPY.colIva, COPY.colTotal]);
});

test('SCRUM-1040 · los totales al pie suman base, IVA y total del periodo mostrado', async () => {
  const { contenedor } = await pintar(libro({
    filas: [fila({ base: 100, cuota: 21, total: 121 }), fila({ numeroProveedor: 'B-2', base: 50, cuota: 5, total: 55 })],
    miradas: 2,
  }));
  const t = todos(contenedor).filter((n) => n.tagName === 'TFOOT');
  assert.equal(t.length, 1, '🔴 no hay pie de tabla con los totales.');
  const celdasFoot = todos(t[0]).filter((n) => n.tagName === 'TD').map((n) => n.textContent);
  // 150,00 € · 26,00 € · 176,00 € — sin asumir el símbolo exacto, solo que las CIFRAS están.
  assert.ok(celdasFoot.some((c) => c.includes('150')), `🔴 el total de base no es 150: ${JSON.stringify(celdasFoot)}`);
  assert.ok(celdasFoot.some((c) => c.includes('26')), `🔴 el total de IVA no es 26: ${JSON.stringify(celdasFoot)}`);
  assert.ok(celdasFoot.some((c) => c.includes('176')), `🔴 el total de total no es 176: ${JSON.stringify(celdasFoot)}`);
});

test('SCRUM-1040 · un total sin NINGUNA cifra sale «—», nunca 0,00 € (A5/A6)', async () => {
  // Las tres cifras `null`: ninguna fila trae cuota (caso `sinCuota`), y el hueco no es un cero.
  const { contenedor } = await pintar(libro({ filas: [fila({ cuota: null })], miradas: 1 }));
  const t = todos(contenedor).filter((n) => n.tagName === 'TFOOT')[0];
  const celdasFoot = todos(t).filter((n) => n.tagName === 'TD').map((n) => n.textContent);
  assert.ok(celdasFoot.includes('—'), `🔴 la columna IVA sin ninguna cuota no sale «—»: ${JSON.stringify(celdasFoot)}`);
});

// ── EL AISLAMIENTO DE ESTADO NO ES DE ESTA PANTALLA ──────────────────────────────────────────
// (el aislamiento entre merchants lo prueba la ruta del servidor, no la vista: aquí solo pinta
// lo que el servidor ya filtró — scrum1040-facturas-recibidas-servidor.test.mjs)

// ── EL CABLEADO: MENÚ, RUTA DEL `case` Y DEEP-LINK ──────────────────────────────────────────

test('SCRUM-1040 · la pantalla está enganchada: `case`, menú y HASH_VIEWS', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const caso = ramaDeCase(app, "case 'facturas-recibidas':");
  assert.ok(caso, "🔴 ESCÁNER CIEGO: no se localiza `case 'facturas-recibidas':` en app.js.");
  assert.ok(caso.includes('renderFacturasRecibidasView') && caso.includes('FACTURAS_RECIBIDAS_COPY'),
    '🔴 el case no llama a la vista o no toma el título de su propia constante de copy.');

  assert.match(app, /'libro-registro','facturas-recibidas','albaranes'/,
    '🔴 la vista no está en HASH_VIEWS: quien recargue estando en ella pierde la pantalla (lección de SCRUM-832).');

  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  assert.match(html, /<button class="nav-item" data-view="facturas-recibidas"/,
    '🔴 no hay entrada de menú para «Facturas recibidas», junto a la de emitidas (aceptación 1).');
  // SCRUM-553: hueco para atributos antes del `>` — nunca pegado a la etiqueta.
  assert.match(html, /<script[^>]*src="\.\/js\/facturasRecibidasView\.js"[^>]*>/,
    '🔴 la vista no está cargada en el dashboard.');
});

test('SCRUM-1040 · el rótulo del menú en el HTML es EXACTAMENTE el de la constante de copy, y SIN marcador (SCRUM-420 §④)', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  const vista = fs.readFileSync(VISTA, 'utf8');
  // SCRUM-553: hueco para atributos antes del `>` — nunca pegado a la etiqueta.
  const m = html.match(/<span[^>]*id="nav-facturas-recibidas-label"[^>]*>([^<]+)<\/span>/);
  assert.ok(m, '🔴 no encuentro el rótulo del nav en el HTML.');
  assert.ok(!m[1].includes('[PENDIENTE'),
    '🔴 el rótulo de la barra lleva el marcador. Es lo primero que ve el profesional cada día, y ' +
    'SCRUM-420 §④ prohíbe que cualquier entrada de la barra lo lleve, apruebe o no el texto.');
  const enCopy = vista.match(/menu: '([^']+)'/);
  assert.ok(enCopy, '🔴 no encuentro `COPY.menu` en la vista.');
  assert.equal(m[1], enCopy[1],
    '🔴 el rótulo del menú y `COPY.menu` han divergido: el día que se cambie uno, el otro se ' +
    'quedaría diciendo otra cosa.');
});

// ── MICROCOPY (regla 30): todo lo nuevo va marcado, salvo lo reutilizado o ya aprobado ───────

test('SCRUM-1040 · toda la copy DESCRIPTIVA de esta pantalla va marcada, salvo lo declarado fuera', async () => {
  const { COPY } = await pintar(libro());
  const MARCADOR = '[PENDIENTE microcopy oficial]';
  // Reutilizado tal cual de otra pantalla, impuesto por la propia aceptación del ticket
  // (cabeceras de columna, etiquetas de un selector de periodo ya existente en `exportView.js`,
  // y el botón de acción), o prohibido de llevar marcador por SCRUM-420 §④ (`menu`: la barra
  // nunca lo lleva, apruebe o no el texto).
  const DECLARADAS_FUERA = [
    'cargando', 'menu', 'colFecha', 'colProveedor', 'colNif', 'colBase', 'colIva', 'colTotal',
    'filaTotal', 'etiquetaAnio', 'etiquetaTrimestre', 'consultar',
  ];
  const sinMarcar = [];
  for (const [ranura, v] of Object.entries(COPY)) {
    if (DECLARADAS_FUERA.includes(ranura) || ranura === 'recuento') continue;
    const texto = typeof v === 'function' ? v(1) : v;
    if (!String(texto).startsWith(MARCADOR)) sinMarcar.push(`${ranura}: ${JSON.stringify(texto)}`);
  }
  assert.deepEqual(sinMarcar, [],
    `🔴 estas ranuras llevan texto que nadie ha aprobado y no lo dicen:\n   ${sinMarcar.join('\n   ')}`);
});

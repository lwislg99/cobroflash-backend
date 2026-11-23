// tests/scrum1768-ficha-aprovecha-el-ancho.test.mjs — SCRUM-1768 (FICHA, S2 · 18-nov)
//
// LA FICHA DEL TRABAJO SON DOS COLUMNAS REALES EN ESCRITORIO, Y EN MÓVIL SIGUE COMO ESTABA.
//
// Orden del fundador (18-nov): «en desktop se ve raro, todo en el medio sin aprovechar el espacio»; y
// buscaba «+ Nuevo presupuesto» sin encontrarlo (vivía dentro de la tarjeta Albaranes). Formato aprobado
// en c.22112: cabecera a todo el ancho · columna principal (lo que se hace) · columna LATERAL (el rail,
// «+ Nuevo presupuesto» bajo él y «El trabajo»). Es FORMA: cifras, textos y acciones, los de antes.
// Lo que este test sujeta (el aspecto lo miden la sonda y el «me gusta» del fundador):
//   ① EL ORDEN DE LA LATERAL, sobre la ficha REAL (banco de vistas): rail → «+ Nuevo presupuesto» →
//     «El trabajo», y el botón ya NO está en la barra de documentos de Albaranes.
//   ② EL RAIL SIGUE SIENDO EL `aside` de solo lectura (patrón B2, regla 4): la lateral lo CONTIENE, no
//     lo sustituye, y dentro del `aside` no hay ni un botón.
//   ③ EL OPERARIO (sin importe aceptado) tiene la misma lateral, sin el botón.
//   ④ EL CSS: la ficha deja de centrarse en 1120 px; a 390 la lateral se disuelve (`display: contents`)
//     y «El trabajo» vuelve al final; todo cuelga de `.detail-page--trabajo` y sólo usa tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const clases = (n) => String((n && n.className) || '').split(/\s+/);
const tiene = (n, c) => clases(n).includes(c);
const QUOTE = { id: 77, number: 3, total: 1210, currency: 'EUR', status: 'accepted' };
const base = (extra) => ({
  id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reforma baño',
  customer: { id: 5, name: 'Cliente de la obra', phone: '34000111222', mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '', invoices: [],
  quote: QUOTE, direccion: null, totalAceptado: 1210, totalCobrado: 0, ...extra,
});

async function ficha(job, rol = 'admin') {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url) || /gastos/.test(url)) return [];
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    return job;
  };
  banco.ctx.appUserRole = rol;
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `SUELO: la ficha no monta (${r.error && r.error.message})`);
  await respirar(20);
  const nodos = todos(banco.ctx.document.body);
  const cuerpo = nodos.find((n) => tiene(n, 'detail-cuerpo'));
  const lateral = nodos.find((n) => tiene(n, 'detail-lateral'));
  return {
    nodos, cuerpo, lateral,
    hijos: lateral ? [...lateral.children].filter((n) => n.tagName) : [],
    boton: nodos.find((n) => n.tagName === 'BUTTON' && n.getAttribute && n.getAttribute('data-presupuesto-del-trabajo') === '1'),
    barras: nodos.filter((n) => tiene(n, 'job-doc-toolbar')), // Partes y Albaranes: las DOS
  };
}

const esRail = (n) => n.tagName === 'ASIDE' && tiene(n, 'detail-rail');
const esElTrabajo = (n) => n.dataset && n.dataset.seccion === 'el-trabajo';
const dentroDe = (n, padre) => { for (let p = n; p; p = p.parentNode) if (p === padre) return true; return false; };

// SCRUM-1768 vuelta 2 (20-nov, c.22113): «El trabajo» vuelve a la columna principal como pestaña
// (tests/scrum1768b-ficha-pestanas.test.mjs ⑥). La lateral se queda con el contexto: rail + botón.
test('① admin con importe aceptado: la lateral es rail → «+ Nuevo presupuesto»', async () => {
  const f = await ficha(base());
  assert.ok(f.cuerpo, 'CIEGO: no hay rejilla .detail-cuerpo');
  assert.ok(f.lateral, 'la ficha no tiene columna lateral');
  assert.equal(f.lateral.parentNode, f.cuerpo, 'la lateral es columna de la rejilla');
  assert.ok(tiene(f.cuerpo, 'detail-cuerpo--con-rail'), 'la rejilla es de dos columnas');
  assert.deepEqual(f.hijos.map((n) => (esRail(n) ? 'rail' : n === f.boton ? 'presupuesto' : esElTrabajo(n) ? 'el-trabajo' : n.tagName)),
    ['rail', 'presupuesto']);
});

test('① «+ Nuevo presupuesto» ya no vive en la barra de Albaranes (donde el fundador no lo encontraba)', async () => {
  const f = await ficha(base());
  assert.equal(f.barras.length, 2, `CIEGO: se esperaban las dos barras de documentos (vio ${f.barras.length})`);
  assert.ok(f.boton, 'CIEGO: no hay botón');
  assert.deepEqual(f.barras.filter((b) => dentroDe(f.boton, b)).length, 0, 'el botón sigue dentro de una barra de documentos');
  assert.equal(f.boton.hidden, false, 'con el Trabajo abierto el botón se ve');
});

test('② el rail sigue siendo el aside de solo lectura: dentro no hay botones', async () => {
  const f = await ficha(base());
  const rail = f.hijos.find(esRail);
  assert.ok(rail, 'CIEGO: no hay rail');
  assert.deepEqual(todos(rail).filter((n) => n.tagName === 'BUTTON' || n.tagName === 'INPUT').map((n) => n.tagName), []);
});

test('③ operario (sin importe aceptado): la misma lateral, sin el botón', async () => {
  const f = await ficha(base({ totalAceptado: null, totalCobrado: null, quote: null }), 'tecnico');
  assert.ok(f.lateral, 'la ficha del operario no tiene columna lateral');
  assert.equal(f.boton, undefined);
  assert.deepEqual(f.hijos.map((n) => (esRail(n) ? 'rail' : esElTrabajo(n) ? 'el-trabajo' : n.tagName)), ['rail']);
});

// ── ④ el CSS ─────────────────────────────────────────────────────────────────────────────────────────
const INICIO = '/* ══ S2 · SCRUM-1768 ·';
const FIN = '/* ══ fin S2 · SCRUM-1768 ══ */';
function bloque(css) {
  const i = css.indexOf(INICIO);
  const f = css.indexOf(FIN);
  assert.ok(i >= 0 && f > i, 'el bloque «S2 · SCRUM-1768» de styles.css existe y está cerrado');
  return css.slice(i, f);
}
// Con SUELO (SCRUM-1395): si el filtro borrara el ancla, todo lo de abajo miraría la nada. En CSS «#» es un
// color, no un comentario.
const sinComentarios = (css) => ejecutableDe(css, { ancla: '.detail-page--trabajo', donde: 'el bloque S2 · SCRUM-1768 de styles.css', almohadillaEsComentario: false });
const compacto = (s) => s.replace(/\s+/g, ' ');
function selectores(trozo) {
  const out = [];
  for (const m of sinComentarios(trozo).matchAll(/([^{};]+)\{/g)) {
    const cab = m[1].trim();
    if (!cab || cab.startsWith('@')) continue;
    out.push(...cab.split(',').map((s) => s.trim()));
  }
  return out;
}
/** El cuerpo de la `@media (max-width: 720px)` del bloque. */
function movil(trozo) {
  const sin = sinComentarios(trozo);
  const i = sin.indexOf('@media (max-width: 720px)');
  assert.ok(i >= 0, 'el bloque tiene su regla de móvil');
  let nivel = 0;
  for (let k = sin.indexOf('{', i); k < sin.length; k++) {
    if (sin[k] === '{') nivel++;
    if (sin[k] === '}' && --nivel === 0) return compacto(sin.slice(i, k + 1));
  }
  return '';
}

test('④ la ficha deja de centrarse: ancho tope 1680 y pegada a la izquierda', () => {
  const sin = compacto(sinComentarios(bloque(CSS)));
  assert.match(sin, /\.detail-page--trabajo \{ max-width: 1680px; margin-inline: 0; \}/);
});

// Vuelta 2: «El trabajo» ya no está en la lateral, así que su `order: 1` de móvil se retira (no queda
// nada a lo que aplicarse). La lateral se sigue disolviendo a 390.
test('④ a 390 la lateral se disuelve', () => {
  const m = movil(bloque(CSS));
  assert.match(m, /\.detail-cuerpo > \.detail-lateral \{ display: contents; \}/);
  assert.doesNotMatch(m, /\.detail-lateral > \.detail-section/);
});

test('④ control positivo: sin la regla de móvil, ④ lo caza', () => {
  const mutado = bloque(CSS).replace('display: contents;', 'display: flex;');
  assert.doesNotMatch(movil(mutado), /\.detail-lateral \{ display: contents; \}/);
});

test('④ todo el bloque cuelga de .detail-page--trabajo y sólo usa tokens', () => {
  const sels = selectores(bloque(CSS));
  assert.ok(sels.length >= 8, `el parser ve las reglas del bloque (vio ${sels.length})`);
  assert.deepEqual(sels.filter((s) => !s.startsWith('.detail-page--trabajo')), []);
  const sin = sinComentarios(bloque(CSS));
  // Vuelta 2: al retirar las reglas de «El trabajo» en la lateral, el bloque se quedó sin colores (ni
  // tokens ni crudos). El control deja de ser «usa tokens» y pasa a ser POSITIVO: un color crudo metido
  // en el bloque, el detector lo caza.
  const COLOR_CRUDO = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g;
  assert.ok(COLOR_CRUDO.test(sinComentarios(bloque(CSS).replace('max-width: 1680px;', 'max-width: 1680px; color: #fff;'))), 'control: el detector caza un color crudo');
  COLOR_CRUDO.lastIndex = 0;
  assert.deepEqual(sin.match(COLOR_CRUDO) || [], []);
});

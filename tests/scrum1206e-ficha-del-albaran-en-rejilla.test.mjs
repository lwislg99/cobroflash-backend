// tests/scrum1206e-ficha-del-albaran-en-rejilla.test.mjs — SCRUM-1206e
//
// «Se ve fatal la pantalla de albaranes» (el fundador, 18-oct-2026). Medido en yaqu.app ese día
// (albaranes #46 y #47, cuenta QA): la ficha es SÓLO el rail, cinco filas de 78 px una debajo de
// otra, y a 1280 el rail mide 982 px de ancho para un contenido de 243 px como mucho (1622 px a 1920).
//
// LA CAUSA: `.detail-rail` está diseñada como la columna DERECHA, de 220–300 px, de
// `.detail-cuerpo--con-rail` (styles.css, SCRUM-316), con su filete izquierdo. Esta ficha la cuelga
// de la página sin cuerpo, así que se estira a todo el ancho y conserva el filete.
//
// EL ARREGLO (opción A del orquestador, 18-oct): el rail se reparte en rejilla `auto-fit` de 220 px
// (y cuatro columnas como mucho) en SU estilo en línea, sin tocar `styles.css`, y sin filete. Las filas cortas comparten fila en
// escritorio; las de texto (presupuesto, cabecera, observaciones, fotos) van a todo el ancho. A 390
// la rejilla da UNA columna y la ficha queda como antes. El CSS no se puede medir aquí (el banco no
// tiene motor de estilos): se fija lo que la ficha DECLARA, y el ancho real se mide en yaqu.app.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Todas las filas que el rail sabe pintar, con dato para cada una.
const ALBARAN = Object.freeze({
  id: 13, numero: 'AB260013', estado: 'emitido', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'parcial',
  quote: { id: 7, number: 7 }, invoiceId: null,
  job: { id: 1, titulo: 'Reforma baño', direccion: 'C/ Mayor, 3' }, customer: { name: 'Ana Ruiz' },
  pendientes: [{ pendiente: 1 }],
  docHeaderText: 'Acceso por el patio', notas: 'Se deja la llave de paso cerrada.',
  lineas: [{ concepto: 'Tubería', cantidad: 2 }],
});

function red(alb) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => {
      const u = String(url);
      if (/\/admin\/albaranes\/13$/.test(u)) return resp(200, alb);
      if (/\/admin\/albaranes\/13\/fotos$/.test(u)) return resp(200, [{ id: 501 }]);
      return resp(200, []);
    },
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

const clases = (n) => (typeof n.className === 'string' ? n.className.split(' ') : []);
// `cssText` en minúsculas y sin espacios: se compara lo que DICE, no cómo está escrito.
const css = (n) => String((n.style && n.style.cssText) || '').toLowerCase().replace(/\s+/g, '');
const textoDe = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();

async function pintarRail() {
  const banco = cargarDashboard(RAIZ, { red: red(ALBARAN) });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', ALBARAN.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  await new Promise((r) => setTimeout(r, 30)); // las fotos llegan en una segunda petición
  const rail = todos(v.contenedor).find((n) => clases(n).includes('detail-rail'));
  assert.ok(rail, '🔴 SUELO: no encuentro el rail (`.detail-rail`) en la ficha');
  const filas = (rail._hijos || rail.children || []).filter((n) => n.tagName);
  // SUELO: las ocho filas (4 datos + pendiente + presupuesto + cabecera sin rótulo + observaciones
  // + fotos = 9 hijos). Con menos, «las de texto van a todo el ancho» podría pasar en vacío.
  assert.equal(filas.length, 9, `🔴 SUELO: el rail pinta ${filas.length} filas y se esperaban 9: ${filas.map(textoDe).join(' | ')}`);
  return { rail, filas };
}

test('SCRUM-1206e · el rail se reparte en rejilla de 220 px, sin filete', async () => {
  const { rail } = await pintarRail();
  const s = css(rail);
  assert.match(s, /display:grid/, `🔴 el rail no es una rejilla (cssText: ${s})`);
  assert.match(s, /grid-template-columns:repeat\(auto-fit,minmax\(max\(220px,25%\),1fr\)\)/,
    `🔴 sin \`repeat(auto-fit, minmax(max(220px, 25%), 1fr))\` el rail o sigue siendo UNA columna a cualquier ancho, o (sin el 25 %) a 1920 deja los datos en 928 px con el borde cortado (cssText: ${s})`);
  assert.match(s, /border-left:none/,
    `🔴 sin cuerpo a la izquierda, el filete de \`.detail-rail\` es una raya que no separa nada (cssText: ${s})`);
  // Lo que ya estaba y no cambia: el aire de arriba, el hueco entre filas y el cuerpo de letra.
  assert.match(s, /margin-top:18px/, `🔴 se ha perdido el aire de arriba (cssText: ${s})`);
  assert.match(s, /font-size:13px/, `🔴 se ha perdido el cuerpo de letra (cssText: ${s})`);
  assert.match(s, /gap:8px0/, `🔴 el hueco entre filas debe seguir en 8 px, y SIN hueco entre columnas para que el borde de cada fila corra seguido (cssText: ${s})`);
});

test('SCRUM-1206e · las filas de TEXTO van a todo el ancho; las cortas, no', async () => {
  const { filas } = await pintarRail();
  const nota = (f) => clases(f).includes('detail-rail-linea--nota');
  const largas = filas.filter(nota);
  const cortas = filas.filter((f) => !nota(f));
  // Control: el reparto es el que se espera — 4 que encima no estén vacías y el pendiente.
  assert.equal(largas.length, 4, `🔴 SUELO: filas de texto ${largas.length}, se esperaban 4 (presupuesto, cabecera, observaciones, fotos)`);
  assert.equal(cortas.length, 5, `🔴 SUELO: filas cortas ${cortas.length}, se esperaban 5`);
  for (const f of largas) {
    assert.equal(f.style && f.style.gridColumn, '1 / -1',
      `🔴 «${textoDe(f).slice(0, 40)}» es texto libre y en una celda de 220 px se parte palabra a palabra: tiene que ocupar la fila entera`);
  }
  for (const f of cortas) {
    assert.ok(!(f.style && f.style.gridColumn),
      `🔴 «${textoDe(f).slice(0, 40)}» es un dato corto y debe compartir fila: no lleva \`grid-column\``);
  }
});

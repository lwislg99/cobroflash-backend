// tests/scrum1559k-albaranes-769-899.test.mjs — SCRUM-1559k
//
// Sin gate: lee styles.css y albaranesView.js, y monta la lista en el banco. Ni BD, ni red, ni navegador.
//
// Entre 769 y 899 la tabla de Albaranes desbordaba su carril 106 / 75 / 25 px (769 / 800 / 850) y
// «Enviar para firmar» quedaba cortado. La causa que ajustar columnas no tocaba: el suelo GLOBAL
// `.table-scroll .table { min-width: 520px }`, con un carril de 471 a 769. Aprobado V5 (orquestador,
// 19-oct): en esa banda se oculta «Entrega» y el suelo se anula SÓLO para esta tabla. Los píxeles se
// miden en navegador (registro en docs/master/SCRUM-1559.md); este test vigila lo que los sostiene: las
// reglas EN SU @media, el suelo global intacto, y que la 3.ª columna siga siendo «Entrega» y sea la
// ÚNICA celda con `cell-date` (si otra la llevara, la regla la escondería también).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranesView.js'), 'utf8');

/** Reglas con la condición de su @media (null = nivel superior). Un nivel de anidamiento basta aquí. */
function reglas(css) {
  const out = [];
  const recorrer = (t, media) => {
    let i = 0;
    while (i < t.length) {
      const abre = t.indexOf('{', i);
      if (abre < 0) break;
      const preludio = t.slice(i, abre).trim();
      let prof = 1, j = abre + 1;
      while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
      const cuerpo = t.slice(abre + 1, j - 1);
      if (preludio.startsWith('@media')) recorrer(cuerpo, preludio.replace(/^@media\s*/, '').replace(/\s+/g, ' '));
      else if (!preludio.startsWith('@')) out.push({ media, sel: preludio.split(',').map((s) => s.replace(/\s+/g, ' ').trim()), cuerpo });
      i = j;
    }
  };
  recorrer(css, null);
  return out;
}
const REGLAS = reglas(CSS);
const en = (media, sel, decl) => REGLAS.some((r) => r.media === media && r.sel.includes(sel) && decl.test(r.cuerpo));
const BANDA = '(min-width: 769px) and (max-width: 899px)';

test('SCRUM-1559k · CONTROL: el lector de reglas ve el suelo global de 520 px, fuera de toda @media', () => {
  assert.ok(en(null, '.table-scroll .table', /min-width:\s*520px/),
    '🔴 NO PUDE MIRAR: no encuentro `.table-scroll .table { min-width: 520px }` — o el lector falla o el suelo cambió, y lo de abajo no probaría nada');
});

test('SCRUM-1559k · en 769-899 se oculta «Entrega» y el suelo se anula sólo para esta tabla', () => {
  assert.ok(en(BANDA, '.table--albaranes th:nth-child(3)', /display:\s*none/), `🔴 la cabecera de «Entrega» no se oculta en @media ${BANDA}`);
  assert.ok(en(BANDA, '.table--albaranes td.cell-date', /display:\s*none/), `🔴 la celda de «Entrega» no se oculta en @media ${BANDA}`);
  assert.ok(en(BANDA, '.table-scroll .table--albaranes', /min-width:\s*0\b/),
    `🔴 sin \`.table-scroll .table--albaranes { min-width: 0 }\` en @media ${BANDA} la tabla vuelve a desbordar 49 px a 769`);
});

test('SCRUM-1559k · lo ACOTADO: el suelo global sigue en 520, y nada fuera de la banda lo anula ni esconde «Entrega»', () => {
  assert.ok(!REGLAS.some((r) => r.sel.includes('.table-scroll .table') && !/min-width:\s*520px/.test(r.cuerpo) && /min-width/.test(r.cuerpo)),
    '🔴 alguien cambió el suelo GLOBAL de `.table-scroll .table`: eso mueve todas las tablas con scroll, y no están medidas');
  const fuera = REGLAS.filter((r) => r.media !== BANDA && (r.sel.includes('.table--albaranes td.cell-date') || r.sel.includes('.table-scroll .table--albaranes'))
    && (/display:\s*none/.test(r.cuerpo) || /min-width:\s*0\b/.test(r.cuerpo)));
  assert.deepEqual(fuera.map((r) => r.media), [], '🔴 «Entrega» se oculta o el suelo se anula FUERA de 769-899: la ficha la conserva, pero la lista la pierde donde sí cabía');
});

test('SCRUM-1559k · la vista pinta lo que las reglas nombran: 3.ª columna «Entrega», y es la ÚNICA celda con `cell-date`', async () => {
  const m = VISTA.match(/\[\s*'Nº',\s*'Emisión'[^\]]*\]/);
  assert.ok(m, '🔴 no encuentro la lista de cabeceras de la tabla en albaranesView.js');
  const cab = JSON.parse(m[0].replace(/'/g, '"'));
  assert.equal(cab[2], 'Entrega', '🔴 «Entrega» ya no es la 3.ª columna: `th:nth-child(3)` ocultaría otra');

  const fila = { id: 1, numero: 'AB260001', emisionAt: '2026-10-01T10:00:00Z', fecha: '2026-10-02T10:00:00Z', cliente: 'Ana Ruiz',
    trabajo: 'Reforma', jobId: 1, estado: 'emitido', modoValoracion: 'VALORADO', quote: null, estadoFacturacion: 'sin_facturar' };
  const datos = { filas: [fila], ejes: { estado: ['borrador', 'emitido', 'firmado'], cobro: ['sin_facturar', 'parcial', 'facturado'] },
    contadores: { total: 1, porEstado: { emitido: 1 }, porCobro: { sin_facturar: 1 } } };
  const resp = (d) => ({ ok: true, status: 200, statusText: '200', headers: { get: () => 'application/json' }, json: async () => d, blob: async () => ({}), text: async () => JSON.stringify(d) });
  const banco = cargarDashboard(RAIZ, { red: {
    fetch: async (url) => (/\/admin\/albaranes(\?|$)/.test(String(url)) ? resp(datos) : resp({})),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  } });
  const v = await pintarVista(banco, 'renderAlbaranesView');
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: la lista no se pinta: ${v.error && v.error.message}`);
  await new Promise((r) => setTimeout(r, 40));
  const clases = (n) => (typeof n.className === 'string' ? n.className.split(' ') : []);
  const tr = todos(v.contenedor).find((n) => n.tagName === 'TR' && n.hijos.some((h) => clases(h).includes('cell-status')));
  assert.ok(tr, '🔴 NO PUDE MIRAR: no veo la fila del albarán');
  const tds = tr.hijos.filter((h) => h.tagName === 'TD');
  assert.equal(tds.length, cab.length, `🔴 la fila tiene ${tds.length} celdas y la cabecera ${cab.length}: las columnas ya no casan`);
  const conFecha = tds.map((td, i) => (clases(td).includes('cell-date') ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(conFecha, [2], `🔴 \`cell-date\` está en las celdas ${JSON.stringify(conFecha)}: la regla de 769-899 escondería otra cosa que «Entrega»`);
});

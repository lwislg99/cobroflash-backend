// tests/scrum1559i-tabla-albaranes-desde-900.test.mjs — SCRUM-1559i
//
// Sin gate: lee styles.css y albaranesView.js, y monta la lista en el banco. Ni BD, ni red, ni navegador.
//
// Entre 769 y 1279 la tabla de Albaranes partía número, fechas y estado LETRA A LETRA (medido en
// yaqu.app a 929: «AB260003» en 45 px, filas de 150-171). La causa es la regla GLOBAL `.table td
// { word-break: break-word }`, que deja el ancho mínimo de una celda en una letra. Decidido A+B por el
// orquestador (18-oct): A · en ESTA tabla se parte por palabras y las fechas no se parten; B · entre 641
// y 1279 se oculta «Emisión» y el relleno lateral baja a 8 px desde 769. Cabe entera desde 899.
// Los píxeles se miden en navegador (registro en docs/master/SCRUM-1559.md); este test vigila las dos
// mitades que los sostienen: que las reglas existan EN SU @media, y que la vista siga pintando las
// celdas que esas reglas nombran (la 2.ª columna es «Emisión» y su celda lleva `col-hide-mobile`).
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

test('SCRUM-1559i · CONTROL: el lector de reglas ve la regla global que causa el defecto, fuera de toda @media', () => {
  assert.ok(en(null, '.table td', /word-break:\s*break-word/),
    '🔴 NO PUDE MIRAR: no encuentro `.table td { word-break: break-word }` — o el lector falla o la causa cambió, y lo de abajo no probaría nada');
});

test('SCRUM-1559i · A: desde 641, en esta tabla se parte por palabras y las fechas no se parten', () => {
  const M = '(min-width: 641px)';
  assert.ok(en(M, '.table--albaranes td', /word-break:\s*normal/), `🔴 falta \`.table--albaranes td { word-break: normal }\` en @media ${M}: vuelve a partir letra a letra`);
  assert.ok(en(M, '.table--albaranes td', /overflow-wrap:\s*break-word/), '🔴 sin `overflow-wrap: break-word` una palabra más larga que su celda se sale');
  assert.ok(en(M, '.table--albaranes td.cell-date', /white-space:\s*nowrap/), '🔴 la fecha de entrega se vuelve a partir');
});

test('SCRUM-1559i · B: entre 641 y 1279 se oculta «Emisión», y el relleno baja a 8 px desde 769', () => {
  const M = '(min-width: 641px) and (max-width: 1279px)';
  assert.ok(en(M, '.table--albaranes th:nth-child(2)', /display:\s*none/), `🔴 la cabecera de «Emisión» no se oculta en @media ${M}`);
  assert.ok(en(M, '.table--albaranes td.col-hide-mobile', /display:\s*none/), `🔴 la celda de «Emisión» no se oculta en @media ${M}`);
  const P = '(min-width: 769px) and (max-width: 1279px)';
  assert.ok(en(P, '.table--albaranes td', /padding-left:\s*8px/) && en(P, '.table--albaranes td', /padding-right:\s*8px/),
    `🔴 falta el relleno lateral de 8 px en @media ${P}`);
});

test('SCRUM-1559i · la regla es ACOTADA: `.table td` global sigue igual para las demás tablas', () => {
  assert.ok(!REGLAS.some((r) => r.sel.includes('.table td') && /word-break:\s*normal/.test(r.cuerpo)),
    '🔴 alguien cambió `.table td` GLOBAL: eso mueve las cuatro listas hermanas, que es lo que el modificador evita');
});

test('SCRUM-1559i · la vista pinta lo que las reglas nombran: 2.ª columna «Emisión» con `col-hide-mobile`, 3.ª con `cell-date`', async () => {
  const m = VISTA.match(/\[\s*'Nº',\s*'Emisión'[^\]]*\]/);
  assert.ok(m, '🔴 no encuentro la lista de cabeceras de la tabla en albaranesView.js');
  const cab = JSON.parse(m[0].replace(/'/g, '"'));
  assert.equal(cab[1], 'Emisión', '🔴 «Emisión» ya no es la 2.ª columna: `th:nth-child(2)` ocultaría otra');

  const fila = { id: 1, numero: 'AB260001', emisionAt: '2026-10-01T10:00:00Z', fecha: '2026-10-02T10:00:00Z', cliente: 'Ana Ruiz',
    trabajo: 'Reforma', jobId: 1, estado: 'firmado', modoValoracion: 'VALORADO', quote: null, estadoFacturacion: 'sin_facturar' };
  const datos = { filas: [fila], ejes: { estado: ['borrador', 'emitido', 'firmado'], cobro: ['sin_facturar', 'parcial', 'facturado'] },
    contadores: { total: 1, porEstado: { firmado: 1 }, porCobro: { sin_facturar: 1 } } };
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
  assert.ok(clases(tds[1]).includes('col-hide-mobile'), `🔴 la 2.ª celda (Emisión) no lleva \`col-hide-mobile\`: lleva «${tds[1].className}»`);
  assert.ok(clases(tds[2]).includes('cell-date'), `🔴 la 3.ª celda (Entrega) no lleva \`cell-date\`: lleva «${tds[2].className}»`);
});

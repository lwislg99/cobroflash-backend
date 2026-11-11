// tests/scrum1669c-importe-en-la-lista-de-albaranes.test.mjs — SCRUM-1669, mitad S2 (PILOTO-1)
//
// Sin gate: monta la lista en el banco y lee styles.css. Ni BD, ni red, ni navegador.
//
// Medido en yaqu.app el 11-nov-2026 (cuenta QA, build 412ddc20d): `GET /admin/albaranes` ya trae
// `total` por fila desde #3064 (AB260006 = 242.36; las SIN_VALORAR, `null`), y la lista NO lo pintaba:
// cero importes. Y el borrador AB260003 enseñaba «Emisión 16/10/2026» (`emisionAt` = `createdAt`).
// Los píxeles se midieron en navegador (registro docs/master/SCRUM-1669.md); este test vigila lo que
// los sostiene.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';
import { ALBARAN_ESTADOS } from '../dist/modules/jobs/domain/albaran.service.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = soloCodigo(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'), 'styles.css');

function red(datos) {
  const resp = (data) => ({
    ok: true, status: 200, statusText: '200', headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (/\/admin\/albaranes(\?|$)/.test(String(url)) ? resp(datos) : resp({})),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}
const fila = (extra) => ({ emisionAt: '2026-11-10T10:00:00Z', fecha: '2026-11-10T10:00:00Z', cliente: 'Ana Ruiz',
  trabajo: 'Cambio de grifo', jobId: 1, quote: null, estadoFacturacion: 'sin_facturar', ...extra });
const LISTADO = {
  filas: [
    fila({ id: 1, numero: 'AB260006', estado: 'emitido', modoValoracion: 'VALORADO', total: 242.36 }),
    fila({ id: 2, numero: 'AB260005', estado: 'emitido', modoValoracion: 'SIN_VALORAR', total: null }),
    fila({ id: 3, numero: 'AB260003', estado: 'borrador', modoValoracion: 'VALORADO', total: 9999.99, emisionAt: null }),
  ],
  ejes: { estado: [...ALBARAN_ESTADOS], cobro: ['sin_facturar', 'parcial', 'facturado'] },
  contadores: { total: 3, porEstado: { borrador: 1, emitido: 2 }, porCobro: { sin_facturar: 3 } },
};
const conClase = (n, c) => typeof n.className === 'string' && n.className.split(' ').includes(c);
const texto = (n) => String(n.textContent == null ? '' : n.textContent).replace(/ | /g, ' ').trim();

async function filasPintadas() {
  const banco = cargarDashboard(RAIZ, { red: red(LISTADO) });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranesView');
  assert.ok(!v.error, `🔴 SUELO: la lista no se pinta: ${v.error && v.error.message}`);
  await new Promise((r) => setTimeout(r, 40));
  const trs = todos(v.contenedor).filter((n) => n.tagName === 'TR' && n.hijos.some((h) => conClase(h, 'cell-id')));
  assert.equal(trs.length, 3, `🔴 SUELO: esperaba 3 filas y veo ${trs.length}; lo de abajo no probaría nada`);
  const porNumero = {};
  // El número va en el enlace de dentro de la celda (el banco no agrega `textContent`).
  for (const tr of trs) porNumero[todos(tr.hijos.find((h) => conClase(h, 'cell-id'))).map(texto).join('')] = tr;
  assert.deepEqual(Object.keys(porNumero).sort(), ['AB260003', 'AB260005', 'AB260006'], '🔴 SUELO: no leo los números de las filas');
  return porNumero;
}

test('SCRUM-1669 · cada fila lleva su importe en Tinta 700 tabular (`.amount`), y una SIN_VALORAR «—», nunca 0', async () => {
  const f = await filasPintadas();
  const importe = (tr) => tr.hijos.find((h) => conClase(h, 'cell-amount'));
  for (const [num, tr] of Object.entries(f)) {
    const td = importe(tr);
    assert.ok(td, `🔴 la fila ${num} no tiene celda \`cell-amount\`: la lista sigue sin dinero`);
    assert.ok(conClase(td, 'amount'), `🔴 el importe de ${num} no lleva \`.amount\` (Tinta 700 tabular, AB4)`);
  }
  assert.equal(texto(importe(f.AB260006)), '242,36 €', '🔴 el albarán valorado no enseña su total');
  assert.equal(texto(importe(f.AB260005)), '—', '🔴 un albarán SIN_VALORAR (total null) tiene que decir «—», no «0,00 €»');
});

test('SCRUM-1669 · la columna nueva no desplaza a «Emisión»: sigue siendo la 2.ª celda y pinta lo que manda el servidor', async () => {
  // La «Emisión» de un borrador la decide el servidor (S1, `emisionAt: null`): aquí sólo se vigila que
  // «Importe» no la haya movido de sitio, porque `th:nth-child(2)` la oculta por POSICIÓN.
  const f = await filasPintadas();
  const emision = (tr) => texto(tr.hijos[1]);
  assert.equal(emision(f.AB260006), '10/11/2026', '🔴 la 2.ª celda ya no es la «Emisión»');
  assert.equal(emision(f.AB260003), '—', '🔴 con `emisionAt: null` la «Emisión» tiene que decir «—»');
});

test('SCRUM-1669 · en la tarjeta de móvil el importe tiene su área, en la línea de la fecha', () => {
  const m = CSS.match(/@media \(max-width: 640px\)[\s\S]*?\.table--albaranes tbody tr\s*\{\s*grid-template-areas:([^;]*);/);
  assert.ok(m, '🔴 NO PUDE MIRAR: no encuentro la rejilla de la tarjeta de `.table--albaranes`');
  assert.match(m[1].replace(/\s+/g, ' '), /"date amount"/,
    '🔴 la rejilla de la tarjeta no tiene área `amount`: el importe cae en la rejilla implícita y pisa otra celda');
});

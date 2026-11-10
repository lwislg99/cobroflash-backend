// tests/scrum1583-enlace-documento-cobros-44.test.mjs — SCRUM-1583
//
// Sin gate: lee styles.css y monta la vista de Cobros en el banco con los datos del censo. Ni BD, ni
// red, ni navegador.
//
// El enlace al documento de cada fila de Cobros («factura F-…», `cobrosView.js`) medía 17 px de toque
// a 320 y 390 y 19 a 1280 (caja 16/18, Edge). Se amplía su área con un `::before` (el mecanismo de
// `.casilla-tactil-44`), sin mover nada a la vista. El TOQUE lo mide en navegador
// `docs/master/evidencias/SCRUM-1583/medir.mjs`; este test, que sí corre en cada PR, vigila las dos
// mitades que lo sostienen: que la regla exista con su `inset`, y que Cobros siga pintando el enlace
// DENTRO de lo que la regla nombra (si cambia el `href` o deja de ser hijo de `td.cell-id`, la regla
// no le llega y el test cae, aunque el CSS siga ahí).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res)); };
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);
const atributo = (n, a) => (typeof n.getAttribute === 'function' ? n.getAttribute(a) : null) ?? n[a] ?? null;

const SELECTOR = 'td.cell-id > a[href="#invoice-detail"]';
// Caja del enlace medida en Edge a 320 y 390 (la más baja de las tres anchuras): 16 px.
const CAJA_MEDIDA = 16;
const MINIMO = 44;

const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim()), cuerpo }; });
const con = (s) => reglas().filter((r) => r.sel.includes(s));

test('SCRUM-1583 · el enlace es `position: relative` y su `::before` amplía el alto hasta 44', () => {
  assert.ok(con(SELECTOR).some((r) => /position:\s*relative/.test(r.cuerpo)),
    `🔴 ${SELECTOR} no es \`position: relative\`: su \`::before\` se colocaría contra otro elemento.`);
  const pseudo = con(`${SELECTOR}::before`);
  assert.equal(pseudo.length, 1, `🔴 no está el \`::before\` de ${SELECTOR}: el enlace vuelve a 17 px de toque.`);
  assert.match(pseudo[0].cuerpo, /content:\s*""/, '🔴 el `::before` no declara `content: ""`: no se pinta y no amplía nada.');
  const inset = /inset:\s*(-?\d+)px\s+0\b/.exec(pseudo[0].cuerpo);
  assert.ok(inset, '🔴 el `::before` no declara `inset: -Npx 0`: sólo debe crecer en vertical.');
  const alto = CAJA_MEDIDA + 2 * -Number(inset[1]);
  assert.ok(alto >= MINIMO, `🔴 inset ${inset[1]}px: ${CAJA_MEDIDA} + 2 × ${-Number(inset[1])} = ${alto}, por debajo de ${MINIMO}.`);
});

test('SCRUM-1583 · Cobros pinta el enlace al documento DENTRO de lo que la regla nombra', async () => {
  const dc = datosDelCenso();
  dc.enVista('renderCobrosView');
  const r = await pintarVista(cargarDashboard(RAIZ, { datos: dc.datos }), 'renderCobrosView', ...(ARGUMENTOS_DEL_CENSO.renderCobrosView || []));
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: renderCobrosView revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const nodos = todos(r.contenedor);
  // Control positivo: el contrato trae una fila con factura, y ésa TIENE que pintar un enlace.
  const enlaces = nodos.filter((n) => n.tagName === 'A' && /factura F-/.test(String(n.textContent || '')));
  assert.equal(enlaces.length, 1, `🔴 CIEGO: con los datos del censo hay ${enlaces.length} enlaces «factura F-…», esperaba 1.`);
  const a = enlaces[0];
  assert.equal(atributo(a, 'href'), '#invoice-detail', '🔴 el enlace cambió de `href`: la regla de SCRUM-1583 ya no le llega.');
  const td = a.parentNode;
  assert.ok(td && td.tagName === 'TD' && clases(td).includes('cell-id'),
    '🔴 el enlace ya no es hijo directo de `td.cell-id`: el «>» de la regla no le llega.');
});

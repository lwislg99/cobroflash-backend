// tests/scrum1265-casillas-de-pago-44px.test.mjs — SCRUM-1265
//
// Sin gate: lee styles.css y monta el editor de presupuesto en el banco. Ni BD, ni red, ni navegador.
//
// `.pay-methods-row` es UN componente con tres usos en el editor (formas de pago, datos del cliente en
// el documento y cláusulas), y su etiqueta medía 20 px con una casilla de 16 (medido en yaqu.app a 390
// y 1280, cuenta QA). Se arregla con el patrón de `.doc-asignados-fila` (SCRUM-1559g): la etiqueta a
// 44 y la casilla con un `::before` que amplía SU área sin crecer a la vista. La ALTURA la mide la
// sonda en navegador; este test vigila las dos mitades que la sostienen: que las reglas sigan ahí con
// sus números, y que el editor siga pintando `<label><input type=checkbox>` dentro de esa fila.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);
const hijos = (n) => [...(n.children || n.childNodes || [])].filter((h) => h.tagName);

const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim()), cuerpo }; });
const con = (s) => reglas().filter((r) => r.sel.includes(s));

test('SCRUM-1265 · la etiqueta de `.pay-methods-row` mide 44 y las líneas van pegadas', () => {
  assert.ok(con('.pay-methods-row label').some((r) => /min-height:\s*44px/.test(r.cuerpo)),
    '🔴 `.pay-methods-row label` ya no tiene min-height de 44 px: vuelve a 20.');
  assert.ok(con('.pay-methods-row label').some((r) => /min-width:\s*44px/.test(r.cuerpo)),
    '🔴 sin min-width, «NIF» se queda en 43,5 px de ancho.');
  // Con el `gap: 14px` de siempre, dos líneas de etiquetas de 44 dejan 14 px muertos entre ellas.
  assert.ok(con('.pay-methods-row').some((r) => /row-gap:\s*0\b/.test(r.cuerpo)),
    '🔴 `.pay-methods-row` perdió `row-gap: 0`.');
});

test('SCRUM-1265 · la casilla amplía SU área a 44 sin salirse de su etiqueta ni crecer a la vista', () => {
  const sel = '.pay-methods-row input[type="checkbox"]';
  assert.ok(con(sel).some((r) => /position:\s*relative/.test(r.cuerpo)),
    '🔴 la casilla no es `position: relative`: su `::before` se colocaría contra otro elemento.');
  assert.ok(!con(sel).some((r) => /(^|[;\s])(width|height|min-height)\s*:/.test(r.cuerpo)),
    '🔴 alguien agrandó la casilla a la vista: el área se gana con el `::before`, no con el dibujo.');
  const pseudo = con(sel + '::before');
  assert.equal(pseudo.length, 1, '🔴 no está el `::before` de la casilla: el área vuelve a 16 px.');
  const inset = /inset:\s*(-?\d+)px/.exec(pseudo[0].cuerpo);
  assert.ok(inset, '🔴 el `::before` de la casilla no declara `inset` en px.');
  // 16 px de casilla + 2 × 14 = 44, el alto de su etiqueta. Con más, se mete en la línea de abajo, que
  // marca OTRA forma de pago u OTRA cláusula.
  assert.equal(Number(inset[1]), -14, `🔴 inset ${inset[1]}px: con 16 px de casilla, -14 da 44 y cabe en su etiqueta de 44.`);
});

test('SCRUM-1265 · el editor pinta las tres filas como `<label>` con su casilla DENTRO de `.pay-methods-row`', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ), 'renderQuotesView');
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: el editor revienta al montarse: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  assert.ok(nodos.length > 50, `🔴 BANCO CIEGO: el editor montó ${nodos.length} nodos.`);
  const filas = nodos.filter((n) => clases(n).includes('pay-methods-row'));
  // Formas de pago y datos del cliente se pintan siempre; las cláusulas, sólo si el negocio tiene.
  assert.ok(filas.length >= 2, `🔴 CIEGO: ${filas.length} filas \`.pay-methods-row\` (esperaba al menos formas de pago y datos del cliente).`);
  let casillas = 0;
  for (const f of filas) {
    for (const h of hijos(f)) {
      assert.equal(h.tagName, 'LABEL', `🔴 un hijo de \`.pay-methods-row\` es <${h.tagName}>: \`.pay-methods-row label\` no le llega.`);
      const c = todos(h).filter((n) => n.tagName === 'INPUT' && n.type === 'checkbox');
      assert.equal(c.length, 1, '🔴 una etiqueta de la fila no lleva UNA casilla dentro: el `::before` no tiene a quién ampliar.');
      casillas++;
    }
  }
  assert.ok(casillas >= 7, `🔴 CIEGO: ${casillas} casillas (formas de pago 3 + datos del cliente 4).`);
});

// tests/scrum1559j-productos-44px.test.mjs — SCRUM-1559j
//
// Sin gate: lee styles.css y monta Productos en el banco con los datos del censo. Ni BD, ni red, ni
// navegador.
//
// El censo con detalle midió 7 objetivos de Productos por debajo de 44 px a 929 (6 a 390): los tres
// de la cabecera, «Editar» y «Activar» de cada fila, «Crear producto» y la casilla «Solo activos».
// Se arreglan con el patrón de SCRUM-1559g: reglas ACOTADAS a `.catalogo-productos` (SCRUM-786,
// opción ③; nunca `.btn-sm` global) y, para la casilla, el `::before` de SCRUM-1265. La ALTURA la mide
// `censo:tactil-panel` en navegador; este test vigila las dos mitades que la sostienen: que la regla
// exista con 44 px y que la vista siga pintando los controles DENTRO de lo que la regla nombra.
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
const texto = (n) => String(n.textContent || '').replace(/\s+/g, ' ').trim();
const dentroDe = (n, pred) => { for (let p = n.parentNode; p; p = p.parentNode) if (pred(p)) return true; return false; };

const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim()), cuerpo }; });
const con = (s) => reglas().filter((r) => r.sel.includes(s));

const CASILLA = '.catalogo-productos .data-card-toolbar input[type="checkbox"]';

test('SCRUM-1559j · las reglas acotadas de Productos existen con 44 px, y `.btn-sm` global sigue sin tocar', () => {
  for (const s of ['.catalogo-productos .btn-sm', '#pf-create-product', '.catalogo-productos .data-card-toolbar > label']) {
    assert.ok(con(s).some((r) => /min-height:\s*44px/.test(r.cuerpo)), `🔴 ${s} no tiene su min-height de 44 px en styles.css.`);
  }
  assert.ok(!con('.btn-sm').some((r) => /min-height:\s*44px/.test(r.cuerpo)),
    '🔴 alguien subió `.btn-sm` GLOBAL a 44 px: la decisión de SCRUM-786 es acotar, nunca global.');
});

test('SCRUM-1559j · la casilla «Solo activos» amplía SU área a 44 sin meterse en el buscador', () => {
  assert.ok(con(CASILLA).some((r) => /position:\s*relative/.test(r.cuerpo)),
    '🔴 la casilla no es `position: relative`: su `::before` se colocaría contra otro elemento.');
  const pseudo = con(CASILLA + '::before');
  assert.equal(pseudo.length, 1, '🔴 no está el `::before` de la casilla: vuelve a 14 px.');
  const inset = /inset:\s*(-?\d+)px\s+(-?\d+)px/.exec(pseudo[0].cuerpo);
  assert.ok(inset, '🔴 el `::before` de la casilla no declara `inset` vertical y horizontal en px.');
  // 13 px de casilla del navegador + 2 × 16 = 45. De lado, menos que el hueco de 10 px del toolbar.
  assert.ok(13 - 2 * Number(inset[1]) >= 44, `🔴 inset vertical ${inset[1]}px: con 13 px de casilla no llega a 44.`);
  assert.ok(-Number(inset[2]) < 10, `🔴 inset lateral ${inset[2]}px: se mete en el hueco de 10 px que la separa del buscador.`);
});

test('SCRUM-1559j · Productos lleva `.catalogo-productos` y sus controles caen dentro', async () => {
  const fn = 'renderProductsView';
  const dc = datosDelCenso();
  dc.enVista(fn);
  const r = await pintarVista(cargarDashboard(RAIZ, { datos: dc.datos }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || []));
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: ${fn} revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const nodos = todos(r.contenedor);
  const enCatalogo = (n) => dentroDe(n, (p) => clases(p).includes('catalogo-productos'));

  const btnSm = nodos.filter((n) => n.tagName === 'BUTTON' && clases(n).includes('btn-sm'));
  for (const t of ['Recargar', '⬇ Exportar CSV', '⬆ Importar CSV', 'Editar']) {
    const b = btnSm.filter((n) => texto(n) === t);
    assert.ok(b.length >= 1, `🔴 CIEGO: no está «${t}» como \`.btn-sm\` con estos datos; la regla no mide nada.`);
    assert.ok(b.every(enCatalogo), `🔴 «${t}» ya no cae dentro de \`.catalogo-productos\`: la regla no le llega.`);
  }
  assert.ok(btnSm.some((n) => /^(Activar|Desactivar)$/.test(texto(n)) && enCatalogo(n)),
    '🔴 CIEGO: no está «Activar»/«Desactivar» dentro de `.catalogo-productos` con estos datos.');

  const crear = nodos.filter((n) => n.id === 'pf-create-product');
  assert.equal(crear.length, 1, '🔴 CIEGO: no está #pf-create-product; la regla nombra un id que ya no existe.');

  const casillas = nodos.filter((n) => n.tagName === 'INPUT' && String(n.type || (n.getAttribute && n.getAttribute('type'))) === 'checkbox'
    && dentroDe(n, (p) => clases(p).includes('data-card-toolbar')) && enCatalogo(n));
  assert.equal(casillas.length, 1, '🔴 CIEGO: la casilla «Solo activos» no está en el toolbar de `.catalogo-productos`.');
  assert.equal(casillas[0].parentNode.tagName, 'LABEL', '🔴 la casilla ya no va dentro de su `<label>`: el área de la etiqueta no le llega.');
  assert.ok(dentroDe(casillas[0].parentNode, (p) => clases(p).includes('data-card-toolbar'))
    && clases(casillas[0].parentNode.parentNode).includes('data-card-toolbar'),
  '🔴 la etiqueta ya no es hija directa del toolbar: el «>» de la regla no le llega.');
});

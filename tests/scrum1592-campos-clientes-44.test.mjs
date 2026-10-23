// tests/scrum1592-campos-clientes-44.test.mjs — SCRUM-1592
//
// Sin gate: lee styles.css y monta la lista de Clientes y la ficha 360 en el banco con los fixtures de
// `guard:objetivo-tactil` (`scripts/_pagina-panel.mjs`). Ni BD, ni red, ni navegador.
//
// A 390 px el buscador de Clientes (37 de toque), los dos `select` de etiqueta y orden (39) y el campo de
// etiquetas de la ficha 360 (36,9) no llegaban a 44: su altura sale de `.input`, que es de todas las
// pantallas y no se toca. Se les da `min-height: 44px` hasta el corte de móvil con una regla ACOTADA en el
// bloque de J2 de styles.css. El TOQUE lo mide en navegador `docs/master/evidencias/SCRUM-1592/medir.mjs`
// (y `guard:objetivo-tactil` con el medidor de SCRUM-1584); este test, que corre en cada PR, vigila las dos
// mitades que lo sostienen: que la regla exista dentro del corte de móvil, y que las dos vistas sigan
// pintando los campos DONDE la regla los alcanza.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { parsearReglas } from './_censo-anillo-foco.mjs';
import { CLIENTES_DE_MUESTRA, DETALLE_360_DE_MUESTRA, ARGUMENTOS_DE_VISTA } from '../scripts/_pagina-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res)); };
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);

const BARRA = '.data-card:has(> .barra-seleccion) .data-card-toolbar > .input';
const META = '#c360-meta .input';
const MINIMO = 44;

// El parser de la casa: entra en los `@media` y dice en cuáles vive cada regla.
const REGLAS = parsearReglas(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'));
const enCorteMovil = (r) => r.medias.some((m) => /max-width:\s*768px/.test(m));

test('SCRUM-1592 · los cuatro campos de Clientes llevan min-height de 44 dentro del corte de móvil', () => {
  const reglas = REGLAS.filter(enCorteMovil);
  assert.ok(reglas.length > 0, '🔴 CIEGO: no encuentro ninguna regla dentro de `@media (max-width: 768px)` en styles.css.');
  for (const sel of [BARRA, META]) {
    const r = reglas.filter((x) => x.selectores.includes(sel));
    assert.equal(r.length, 1, `🔴 no está \`${sel}\` dentro del corte de móvil: el campo vuelve a quedarse por debajo de ${MINIMO} px a 390.`);
    const alto = /^(\d+)px$/.exec(r[0].decls.get('min-height') || '');
    assert.ok(alto && Number(alto[1]) >= MINIMO, `🔴 \`${sel}\` declara ${alto ? alto[1] + 'px' : 'ningún min-height'}: por debajo de ${MINIMO}.`);
  }
});

test('SCRUM-1592 · la lista pinta el buscador y los dos select como hijos directos de la barra que la regla nombra', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers/.test(u)) return CLIENTES_DE_MUESTRA;
      if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'Fontanería Soler' };
      return [];
    },
  }), 'renderCustomersView');
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: renderCustomersView revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const nodos = todos(r.contenedor);
  const barras = nodos.filter((n) => clases(n).includes('data-card-toolbar'));
  assert.equal(barras.length, 1, `🔴 CIEGO: la lista pinta ${barras.length} barras \`.data-card-toolbar\`, esperaba 1.`);
  const barra = barras[0];
  const tarjeta = barra._padre;
  assert.ok(tarjeta && clases(tarjeta).includes('data-card'), '🔴 la barra ya no cuelga directamente de `.data-card`.');
  assert.ok(tarjeta.hijos.some((h) => h && clases(h).includes('barra-seleccion')),
    '🔴 la tarjeta ya no tiene `.barra-seleccion` como hija directa: el `:has(> .barra-seleccion)` de la regla no le llega.');
  const campos = barra.hijos.filter((h) => h && clases(h).includes('input') && !h.hidden);
  const busca = campos.filter((h) => h.tagName === 'INPUT');
  const selects = campos.filter((h) => h.tagName === 'SELECT');
  assert.equal(busca.length, 1, `🔴 el buscador no es hijo directo \`.input\` de la barra (${busca.length}): la regla no le llega.`);
  assert.equal(selects.length, 2, `🔴 hay ${selects.length} \`select.input\` visibles como hijos directos de la barra, esperaba 2 (etiqueta y orden).`);
});

test('SCRUM-1592 · la ficha 360 pinta el campo de etiquetas dentro de #c360-meta', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers\/\d+\/detail/.test(u)) return DETALLE_360_DE_MUESTRA;
      if (u.includes('/admin/merchant')) return { id: 1, name: 'Fontanería Soler' };
      return [];
    },
  }), 'renderCustomer360View', ...ARGUMENTOS_DE_VISTA.renderCustomer360View);
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: renderCustomer360View revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const metas = todos(r.contenedor).filter((n) => n.id === 'c360-meta');
  assert.equal(metas.length, 1, `🔴 CIEGO: la ficha pinta ${metas.length} bloques #c360-meta, esperaba 1.`);
  const campos = todos(metas[0]).filter((n) => n !== metas[0] && n.tagName === 'INPUT' && clases(n).includes('input'));
  assert.equal(campos.length, 1, `🔴 hay ${campos.length} \`input.input\` dentro de #c360-meta, esperaba 1 (el de etiquetas).`);
});

// tests/scrum1562c-partes-oficina-con-teclado.test.mjs — SCRUM-1562c
//
// Sin gate: monta «Partes por valorar» en el banco con los datos del censo. Ni BD, ni red, ni navegador.
//
// La sonda de SCRUM-1562 midió que cada parte de la lista era un `DIV.customers-card` con un oyente de
// clic y nada nativo dentro: con teclado no se podía abrir un parte para valorarlo. Ahora la fila es un
// `<button type="button">` —la opción (b) del encargo: un control NATIVO que hace lo mismo—, así que el
// foco, Enter y Espacio los da el navegador y no hay que escribirlos.
//
// Dos mitades, y las dos hacen falta: (1) que la fila sea nativa, y (2) que el RATÓN siga haciendo lo
// mismo — sin la segunda no se distingue arreglar de cambiar una cosa por otra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN = 'renderPartesOficinaView';
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res)); };
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);
const NATIVOS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);

async function montar() {
  const dc = datosDelCenso();
  dc.enVista(FN);
  const pedidas = [];
  // La ficha del parte (`/admin/partes/:id/oficina`) no tiene contrato en los datos del censo: con
  // `null` `pintarParte` revienta. Aquí contesta con un fallo, que la vista recoge (su estado de
  // error): lo que se mide es que el clic PIDE esa ruta, no lo que pinta después.
  const datos = (url, ...resto) => {
    pedidas.push(String(url || ''));
    if (/^\/admin\/partes\/[^/]+\/oficina$/.test(String(url))) throw new Error('sin contrato en el censo');
    return dc.datos(url, ...resto);
  };
  const r = await pintarVista(cargarDashboard(RAIZ, { datos }), FN, ...(ARGUMENTOS_DEL_CENSO[FN] || []));
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: la vista revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const lista = todos(r.contenedor).filter((n) => n.id === 'po-lista');
  assert.equal(lista.length, 1, '🔴 NO PUDE MIRAR: no está `#po-lista`.');
  const filas = todos(lista[0]).filter((n) => clases(n).includes('customers-card'));
  assert.ok(filas.length > 0, '🔴 CIEGO: con los datos del censo la lista no pinta ningún parte.');
  return { filas, pedidas };
}

test('SCRUM-1562c · cada parte por valorar es un control NATIVO: `<button type="button">`', async () => {
  const { filas } = await montar();
  for (const f of filas) {
    assert.ok(NATIVOS.has(f.tagName), `🔴 la fila «${String(f.textContent).trim().slice(0, 30)}» es un ${f.tagName}: con teclado no se abre.`);
    assert.equal(f.tagName, 'BUTTON', `🔴 la fila es ${f.tagName} y no BUTTON.`);
    assert.equal(String(f.type || (f.getAttribute && f.getAttribute('type'))), 'button',
      '🔴 el botón no es `type="button"`: dentro de un formulario lo enviaría.');
  }
});

test('SCRUM-1562c · el foco en la fila SE VE: su propio `:focus-visible` con `--ring`', () => {
  // El global (`:focus-visible { box-shadow: var(--ring) }`) pesa lo mismo que `.customers-card`, que
  // va después y pone su sombra encima: medido en yaqu.app, con el foco en la fila no se veía nada.
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const regla = /\.parte-oficina-fila:focus-visible\s*\{([^}]*)\}/.exec(css);
  assert.ok(regla, '🔴 no hay `.parte-oficina-fila:focus-visible`: la sombra de la tarjeta tapa el anillo.');
  assert.match(regla[1], /box-shadow:\s*var\(--ring\)/, '🔴 el foco de la fila no usa el anillo `--ring` del sistema.');
});

test('SCRUM-1562c · con el RATÓN la fila sigue abriendo SU parte (la misma ruta que antes)', async () => {
  const { filas, pedidas } = await montar();
  const antes = pedidas.length;
  filas[0].click();
  await esperar();
  const nuevas = pedidas.slice(antes);
  assert.ok(nuevas.some((u) => /^\/admin\/partes\/[^/]+\/oficina$/.test(u)),
    `🔴 el clic ya no abre el parte: después del clic se pidió ${JSON.stringify(nuevas)}.`);
});

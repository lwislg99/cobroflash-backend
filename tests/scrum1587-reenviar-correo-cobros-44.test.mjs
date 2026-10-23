// tests/scrum1587-reenviar-correo-cobros-44.test.mjs — SCRUM-1587
//
// Sin gate: lee styles.css y monta la vista de Cobros en el banco con los datos del censo. Ni BD, ni
// red, ni navegador.
//
// El botón «Enviar de nuevo» del aviso de correo fallido de Cobros (`avisoCorreoNoSalio`,
// `cobrosView.js`) medía 30,7 px de toque a 320 y 390 y 30,9 a 1280 (caja 30, Edge). Se amplía su área
// con un `::before`, sin mover nada a la vista. El TOQUE lo mide en navegador
// `docs/master/evidencias/SCRUM-1587/medir.mjs`; este test, que sí corre en cada PR, vigila las dos
// mitades que lo sostienen: que la regla exista con su `inset`, y que Cobros siga pintando el botón
// DENTRO de lo que la regla nombra.
//
// El contrato del censo (`scripts/_datos-del-censo.mjs`, carril S3) trae `correoNoSalio: null` y con
// él el aviso no se pinta: aquí se le pone a la fila con factura, sólo en este test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res)); };
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);

const SELECTOR = 'td.cell-id [data-correo-no-salio] > button';
// Caja del botón medida en Edge en las tres anchuras: 30 px, con 1 px de borde (`.btn-secondary`).
// El `::before` se ancla al relleno, así que el borde no cuenta dos veces: 30 − 2 × 1 + 2 × N.
const CAJA_MEDIDA = 30;
const BORDE = 1;
const MINIMO = 44;

// El quitacomentarios es el de la casa (SCRUM-700); en CSS `#` es un selector, no un comentario.
const CSS = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'), { almohadillaEsComentario: false });
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim()), cuerpo }; });
const con = (s) => reglas().filter((r) => r.sel.includes(s));

test('SCRUM-1587 · el botón es `position: relative` y su `::before` amplía el alto hasta 44', () => {
  assert.ok(con(SELECTOR).some((r) => /position:\s*relative/.test(r.cuerpo)),
    `🔴 ${SELECTOR} no es \`position: relative\`: su \`::before\` se colocaría contra otro elemento.`);
  const pseudo = con(`${SELECTOR}::before`);
  assert.equal(pseudo.length, 1, `🔴 no está el \`::before\` de ${SELECTOR}: el botón vuelve a 30,7 px de toque.`);
  assert.match(pseudo[0].cuerpo, /content:\s*""/, '🔴 el `::before` no declara `content: ""`: no se pinta y no amplía nada.');
  const inset = /inset:\s*(-?\d+)px\s+0\b/.exec(pseudo[0].cuerpo);
  assert.ok(inset, '🔴 el `::before` no declara `inset: -Npx 0`: sólo debe crecer en vertical.');
  const alto = CAJA_MEDIDA - 2 * BORDE + 2 * -Number(inset[1]);
  assert.ok(alto >= MINIMO, `🔴 inset ${inset[1]}px: ${CAJA_MEDIDA} − 2 × ${BORDE} + 2 × ${-Number(inset[1])} = ${alto}, por debajo de ${MINIMO}.`);
});

test('SCRUM-1587 · Cobros pinta «Enviar de nuevo» DENTRO de lo que la regla nombra', async () => {
  const dc = datosDelCenso();
  dc.enVista('renderCobrosView');
  const datos = (url) => {
    const v = dc.datos(url);
    if (!/\/admin\/cobros(?:[?#]|$)/.test(String(url)) || !Array.isArray(v)) return v;
    return v.map((x) => x.invoiceId != null ? { ...x, correoNoSalio: { clase: 'invoice', invoiceId: x.invoiceId } } : x);
  };
  const r = await pintarVista(cargarDashboard(RAIZ, { datos }), 'renderCobrosView', ...(ARGUMENTOS_DEL_CENSO.renderCobrosView || []));
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: renderCobrosView revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const nodos = todos(r.contenedor);
  // Control positivo: la fila con factura lleva aviso, y ése TIENE que pintar un botón.
  const botones = nodos.filter((n) => n.tagName === 'BUTTON' && String(n.textContent || '').trim() === 'Enviar de nuevo');
  assert.equal(botones.length, 1, `🔴 CIEGO: con correoNoSalio en la fila hay ${botones.length} botones «Enviar de nuevo», esperaba 1.`);
  const caja = botones[0].parentNode;
  assert.ok(caja && caja.dataset && caja.dataset.correoNoSalio,
    '🔴 el botón ya no es hijo directo de la caja `[data-correo-no-salio]`: el «>» de la regla no le llega.');
  let td = caja.parentNode;
  while (td && td.tagName !== 'TD') td = td.parentNode;
  assert.ok(td && clases(td).includes('cell-id'), '🔴 el aviso ya no está dentro de `td.cell-id`: la regla no le llega.');
});

// tests/scrum1559g-dieciseis-controles-44px.test.mjs — SCRUM-1559g
//
// Sin gate: lee styles.css y monta cuatro vistas en el banco con los datos del censo. Ni BD, ni red,
// ni navegador.
//
// Con el banco que monta las fichas con datos de verdad (SCRUM-1560), S3 midió 16 controles NUESTROS
// por debajo de 44 px a 929 y a 390: tres en Inicio, ocho en la ficha del presupuesto (más la casilla
// de `documentoAsignados.js`, 21 px), dos en Solicitudes y dos en Albaranes (el número, 17 px a 390).
// Se arreglan con el patrón de SCRUM-1158c: reglas ACOTADAS (SCRUM-786, opción ③; nunca `.btn-sm`
// global). La ALTURA la mide `censo:tactil-panel` en navegador; este test, que sí corre en cada PR,
// vigila las dos mitades que la sostienen: que la regla exista con 44 px y que el producto siga
// pintando los controles DENTRO de lo que la regla nombra.
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
const esBtnSm = (n) => n.tagName === 'BUTTON' && clases(n).includes('btn-sm');
const hijos = (n) => [...(n.children || n.childNodes || [])];
const texto = (n) => String(n.textContent || '').replace(/\s+/g, ' ').trim();

const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
// Bloques de primer nivel y los de dentro de una @media, aplanados: basta para preguntar «¿qué
// declara este selector?», que es lo único que se pregunta aquí.
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim()), cuerpo }; });
const con = (s) => reglas().filter((r) => r.sel.includes(s));

async function vista(fn) {
  const dc = datosDelCenso();
  dc.enVista(fn);
  const r = await pintarVista(cargarDashboard(RAIZ, { datos: dc.datos }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || []));
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: ${fn} revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  return todos(r.contenedor);
}

test('SCRUM-1559g · las reglas acotadas existen con 44 px, y `.btn-sm` global sigue sin tocar', () => {
  for (const s of ['#btn-ver-resumen-trimestre', '#btn-cerrar-resumen-trimestre', '.home-hero-card > .btn-sm',
    '.presupuesto-ficha .btn-sm', '.solicitud-acciones > .btn-sm', '.table--albaranes td.cell-actions > .btn-sm',
    '.table--albaranes .alb-numero']) {
    assert.ok(con(s).some((r) => /min-height:\s*44px/.test(r.cuerpo)), `🔴 ${s} no tiene su min-height de 44 px en styles.css.`);
  }
  assert.ok(con('#btn-cerrar-resumen-trimestre').some((r) => /min-width:\s*44px/.test(r.cuerpo)),
    '🔴 «✕» perdió el ancho de 44 px: es un glifo, y sin ancho se queda en ~30.');
  assert.ok(!con('.btn-sm').some((r) => /min-height:\s*44px/.test(r.cuerpo)),
    '🔴 alguien subió `.btn-sm` GLOBAL a 44 px: la decisión de SCRUM-786 es acotar, nunca global.');
});

test('SCRUM-1559g · la casilla de `documentoAsignados` amplía SU área a 44 sin invadir la fila de al lado', () => {
  assert.ok(con('.doc-asignados-casilla').some((r) => /position:\s*relative/.test(r.cuerpo)),
    '🔴 la casilla no es `position: relative`: su `::before` se colocaría contra otro elemento.');
  const pseudo = con('.doc-asignados-casilla::before');
  assert.equal(pseudo.length, 1, '🔴 no está el `::before` de la casilla: vuelve a 21 px.');
  const inset = /inset:\s*(-?\d+)px/.exec(pseudo[0].cuerpo);
  assert.ok(inset, '🔴 el `::before` de la casilla no declara `inset` en px.');
  // 20 px de casilla + 2 × 12 = 44, justo el alto de su fila. Con más, se mete en la fila de otra persona.
  assert.equal(Number(inset[1]), -12, `🔴 inset ${inset[1]}px: con 20 px de casilla, -12 da 44 y cabe en su fila de 44.`);
  for (const r of con('.doc-asignados-fila')) {
    if (/min-height/.test(r.cuerpo)) assert.match(r.cuerpo, /min-height:\s*44px/, '🔴 la fila ya no mide 44: recalcula el inset de la casilla.');
  }
});

test('SCRUM-1559g · Inicio pinta «Ver resumen», «✕» y «Ver facturas →» DENTRO de lo que la regla nombra', async () => {
  const nodos = await vista('renderHomeView');
  for (const id of ['btn-ver-resumen-trimestre', 'btn-cerrar-resumen-trimestre']) {
    assert.equal(nodos.filter((n) => n.id === id).length, 1, `🔴 CIEGO: no está #${id} con estos datos; la regla no le llega o no mide nada.`);
  }
  const heroe = nodos.filter((n) => clases(n).includes('home-hero-card'));
  assert.equal(heroe.length, 1, '🔴 CIEGO: no está `.home-hero-card` con estos datos.');
  assert.ok(hijos(heroe[0]).some(esBtnSm), '🔴 «Ver facturas →» ya no es hijo directo `.btn-sm` de `.home-hero-card`: el «>» no le llega.');
});

test('SCRUM-1559g · la ficha del presupuesto lleva `.presupuesto-ficha` y sus botones `.btn-sm` caen dentro', async () => {
  const nodos = await vista('renderQuoteDetailView');
  const ficha = nodos.filter((n) => clases(n).includes('presupuesto-ficha'));
  assert.equal(ficha.length, 1, '🔴 la ficha del presupuesto no lleva `.presupuesto-ficha`: sus ocho botones vuelven a 30 px.');
  // «📄 PDF» y «⎘ Duplicar» se pintan con `innerHTML`, que el mini-DOM no convierte en texto: se
  // reconocen por su `title`, que sí es una propiedad.
  const dentro = todos(ficha[0]).filter(esBtnSm).map((n) => texto(n) || String(n.title || ''));
  for (const t of ['Ver o descargar el PDF (incluye la firma si el cliente firmó)', 'Crea un nuevo presupuesto con las mismas líneas',
    '← Volver', 'Aceptar presupuesto', 'Rechazar presupuesto', '+ Añadir gasto a este trabajo']) {
    assert.ok(dentro.includes(t), `🔴 CIEGO o fuera: «${t}» no está como \`.btn-sm\` dentro de la ficha (hay: ${dentro.join(' · ')}).`);
  }
  assert.ok(todos(ficha[0]).some((n) => clases(n).includes('doc-asignados-casilla')),
    '🔴 CIEGO: la ficha no pinta ninguna casilla de `documentoAsignados` con estos datos.');
});

test('SCRUM-1559g · Solicitudes pinta sus dos botones como hijos DIRECTOS de `.solicitud-acciones`', async () => {
  const nodos = await vista('renderQuoteRequestsView');
  const filas = nodos.filter((n) => clases(n).includes('solicitud-acciones'));
  assert.ok(filas.length > 0, '🔴 CIEGO: ninguna solicitud lleva `.solicitud-acciones` con estos datos.');
  const botones = filas.flatMap((f) => hijos(f).filter(esBtnSm)).map(texto);
  for (const t of ['+ Crear presupuesto', '✓ Marcar gestionada']) {
    assert.ok(botones.includes(t), `🔴 «${t}» no es hijo directo \`.btn-sm\` de \`.solicitud-acciones\` (hay: ${botones.join(' · ')}).`);
  }
});

test('SCRUM-1559g · Albaranes pinta el número y «Enviar para firmar» donde la regla los nombra', async () => {
  const nodos = await vista('renderAlbaranesView');
  const tabla = nodos.filter((n) => n.tagName === 'TABLE' && clases(n).includes('table--albaranes'));
  assert.equal(tabla.length, 1, '🔴 la tabla ya no lleva `.table--albaranes`: las dos reglas nombran un contenedor que no existe.');
  const acciones = todos(tabla[0]).filter((n) => n.tagName === 'TD' && clases(n).includes('cell-actions'));
  assert.ok(acciones.some((td) => hijos(td).some(esBtnSm)), '🔴 CIEGO o fuera: ninguna `td.cell-actions` tiene un `.btn-sm` hijo directo.');
  assert.ok(todos(tabla[0]).some((n) => n.tagName === 'A' && clases(n).includes('alb-numero')),
    '🔴 CIEGO: no hay ningún `a.alb-numero` en la tabla con estos datos.');
});

// tests/scrum417-descargar-datos-carga.test.mjs — SCRUM-417
//
// «Descargar datos» es hoy la ÚNICA pantalla del dashboard a la que solo se llega por un sitio:
// Configuración › Tus datos (SCRUM-420 la sacó de la barra lateral). Si esa pantalla revienta al
// cargar, no hay segundo camino que lo disimule.
//
// ⚠️ ESTE TEST NO COMPRUEBA QUE EXISTA SU `case` EN EL ROUTER. Eso ya lo hace SCRUM-420, y es el
// escalón que se queda corto: una pantalla que revienta al abrirse pasa esa comprobación y le falla
// al profesional igual. Aquí la vista se CARGA y se PINTA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, scriptsDelDashboard, nodo, contrastarScripts } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = 'js/exportView.js';

// ═══ SUELOS ═══════════════════════════════════════════════════════════════════════════════
//
// «Todo carga bien» y «no encontré nada que cargar» son el mismo verde. Un banco vacío pinta cero
// pantallas rotas con la misma cara que un dashboard sano.

test('SCRUM-417 · SUELO: el banco encuentra los scripts del dashboard', () => {
  const scripts = scriptsDelDashboard(RAIZ);
  // SCRUM-559: era `>= 40` sobre una población de 60 — 20 de holgura. Con eso, perder UNA
  // etiqueta (60 → 59) pasaba en verde y esa vista dejaba de estar vigilada sin avisar.
  // SCRUM-662: y ya no se contrasta una CUENTA sino la LISTA, que además dice CUÁL falta.
  const c = contrastarScripts(scripts);
  assert.deepEqual([...c.sobran, ...c.faltan], [],
    '🔴 BANCO CIEGO: el índice y la lista declarada no coinciden.\n\n'
    + (c.sobran.length ? `  SOBRAN en el índice: ${c.sobran.join(', ')}\n` : '')
    + (c.faltan.length ? `  FALTAN en el índice: ${c.faltan.join(', ')}\n` : '')
    + '\n  Si has añadido una vista, añádela a `SCRIPTS_DEL_DASHBOARD` en `tests/_banco-vistas.mjs`'
    + '\n  en ese mismo commit. Si FALTAN, hay vistas que este banco ya no carga: «ninguna vista'
    + '\n  falla» dejaría de significar nada.');
  assert.ok(scripts.includes(VISTA),
    `🔴 \`${VISTA}\` ya no está declarado en index.html: o cambió de nombre, o la pantalla dejó ` +
    'de servirse. Este test estaría midiendo un fichero que el navegador no carga.');
});

// ═══ ① EL POSITIVO: la pantalla CARGA y PINTA ════════════════════════════════════════════

test('SCRUM-417 · ① los scripts del dashboard se EJECUTAN, no solo parsean', async () => {
  const banco = cargarDashboard(RAIZ);
  const rotos = banco.fallos.map((f) => `${f.fichero} — ${f.error}${f.sitio ? '\n       ' + f.sitio : ''}`);
  assert.deepEqual(rotos, [],
    '🔴 hay ficheros que el navegador DESCARTA al cargarlos. Un script clásico que lanza se pierde ' +
    'ENTERO, y con él todas las pantallas que dependan de lo que publicaba:\n   · ' + rotos.join('\n   · '));
});

test('SCRUM-417 · ① «Descargar datos» se abre sin reventar', async () => {
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderExportView');

  assert.equal(r.error, null,
    '🔴 la pantalla «Descargar datos» REVIENTA al abrirse. Es la única a la que se llega por un ' +
    'solo camino (Configuración › Tus datos), así que un profesional que la pulse se queda sin ' +
    `nada:\n   ${r.error && r.error.name}: ${r.error && r.error.message}\n   ` +
    String((r.error && r.error.stack) || '').split('\n').slice(1, 4).join('\n   '));

  assert.ok(r.nodos > 1,
    `🔴 la vista no lanzó pero tampoco pintó nada (${r.nodos} nodo). Una pantalla en blanco y una ` +
    'pantalla rota se ven igual desde fuera, y las dos son un profesional sin su descarga.');

  assert.deepEqual(r.idsNoResueltos, [],
    '🔴 la vista busca elementos por id que su propio marcado NO declara. En el navegador eso es ' +
    'un `null` y la siguiente línea revienta:\n   · ' + r.idsNoResueltos.join('\n   · '));
});

test('SCRUM-417 · ① y pinta los anclajes que la pantalla necesita para funcionar', async () => {
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderExportView');
  assert.equal(r.error, null, 'suelo: si no pinta, lo de abajo no significa nada');
  // Los tres que sostienen la pantalla: dónde se listan los conjuntos, el botón del ZIP y el de
  // portabilidad. Si el marcado cambia de forma, esto cae y hay que mirarlo — no adivinarlo.
  for (const id of ['export-datasets', 'btn-export-zip', 'btn-portabilidad']) {
    assert.ok(banco.reg.porId.has(id),
      `🔴 la pantalla ya no declara \`#${id}\`: o se ha renombrado, o ha dejado de pintarse.`);
  }
});

// ═══ ② ROJO POR EL MECANISMO — con fixtures, para que corra siempre ══════════════════════
//
// Las inyecciones sobre el árbol real prueban el guard UNA vez, el día que se escribe. Estos
// ficheros sintéticos lo prueban en CADA tanda: si el banco dejara de cazar estos dos defectos,
// caen ellos y no hay que acordarse de volver a inyectar nada.

/** Ejecuta un fuente sintético en el mismo banco y devuelve el error de carga, si lo hay. */
function cargarSuelto(codigo, nombre) {
  const reg = { porId: new Map(), errores: [], idsNoResueltos: [] };
  const ctx = { document: { createElement: (t) => nodo(t, reg) }, console: { error() {} } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(codigo, ctx, { filename: nombre }); return null; }
  catch (e) { return e; }
}

test('SCRUM-417 · ② ROJO: el defecto histórico de exportView (backtick dentro del template)', () => {
  // Es el defecto real de `d5cd3b7c`, reproducido: un comentario con backticks DENTRO del template
  // literal. El primer backtick cierra la plantilla y lo que sigue se parsea como código.
  const roto = [
    'function renderX(container) {',
    '  container.innerHTML = `',
    '    <div>',
    '      <!-- sin `style="min-height:44px"`: la base ya da 44 px -->',
    '    </div>',
    '  `;',
    '}',
    'window.renderX = renderX;',
  ].join('\n');
  const e = cargarSuelto(roto, 'fixtureBacktick.js');
  assert.ok(e, '🔴 el banco NO caza un backtick dentro del template literal — que es exactamente ' +
    'el defecto que dejó «Descargar datos» sin cargar y pasó por encima de cuatro commits.');
  assert.match(e.message, /Unexpected|Invalid|missing/i,
    `el error tiene que decir qué se rompió; dijo: «${e.message}»`);
});

test('SCRUM-417 · ② ROJO: un símbolo que no existe en NINGÚN script cargado', () => {
  // El otro modo de fallo, y no lo caza `node --check`: parsea perfectamente y revienta al correr.
  const roto = 'function renderX(c) { if (SIMBOLO_QUE_NO_EXISTE) c.textContent = "x"; }\nrenderX({});';
  const e = cargarSuelto(roto, 'fixtureSimbolo.js');
  assert.ok(e, '🔴 el banco no caza un símbolo inexistente: entonces solo está midiendo el parseo, ' +
    'que ya lo mide `public-js-parsea` — y este test no añadiría nada.');
  assert.match(e.message, /SIMBOLO_QUE_NO_EXISTE/,
    `🔴 el mensaje no NOMBRA lo que falta; dijo: «${e.message}»`);
});

// ═══ ③ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-417 · ③ NEGATIVO: una vista sana NO da rojo', () => {
  const sana = [
    'function renderX(container) {',
    '  container.innerHTML = `<div id="x-caja"></div>`;',
    '  const c = document.createElement("button");',
    '  c.textContent = "vale";',
    '  container.appendChild(c);',
    '}',
    'window.renderX = renderX;',
  ].join('\n');
  assert.equal(cargarSuelto(sana, 'fixtureSana.js'), null,
    '🔴 el banco da rojo sobre una vista correcta: entonces sus rojos no distinguen nada. Un banco ' +
    'que falla con todo es tan inútil como uno que pasa con todo.');
});

test('SCRUM-417 · ③ NEGATIVO: el banco resuelve los id del marcado, como el navegador', () => {
  // Es el control de la fidelidad que costó dos falsos hallazgos: sin él, TODA vista que pinte con
  // `innerHTML` y luego busque por id daría un rojo que no es suyo.
  const reg = { porId: new Map(), errores: [], idsNoResueltos: [] };
  const n = nodo('div', reg);
  n.innerHTML = '<div id="export-datasets"></div><button id="btn-export-zip">Z</button>';
  assert.ok(reg.porId.has('export-datasets') && reg.porId.has('btn-export-zip'),
    '🔴 el mini-DOM no registra los id del marcado asignado. Con esto roto, el banco acusaría a ' +
    'la vista de un defecto que es del banco — ya pasó dos veces al construirlo.');
});

test('SCRUM-417 · ③ NEGATIVO: `window` es el global, como en el navegador', () => {
  // El tercer falso hallazgo: con `window` como objeto aparte, una vista que declara su función
  // con `function` de nivel superior «no publicaba» nada.
  const banco = cargarDashboard(RAIZ);
  assert.equal(banco.ctx.window, banco.ctx,
    '🔴 `window` y el global son objetos distintos: el banco diría que las vistas no publican su ' +
    'función de render, y sería mentira.');
});

// ═══ ④ LO QUE ESTE BANCO NO CUBRE, DECLARADO Y CON SU PRUEBA ═════════════════════════════

test('SCRUM-417 · ④ el hueco declarado: solo se cubre `export`, y se dice por qué', async () => {
  // El banco sirve `{}` a `apiRequest`. A `export` le vale —no pinta datos al abrirse—, pero otras
  // vistas esperan formas concretas (listas, objetos con campos) y darían un rojo del FIXTURE, no
  // del código. Extender el banco con datos por vista es otro trabajo, y se declara en vez de
  // fingir cobertura.
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderExportView');
  assert.equal(r.error, null);
  assert.equal(r.idsNoResueltos.length, 0,
    '🔴 si `export` empieza a dejar ids sin resolver, el banco ya no es fiel PARA ELLA tampoco, y ' +
    'este fichero pasa a medir otra cosa.');

  // Y la prueba de que el hueco es real y no una excusa: con datos vacíos, una vista que espera
  // una lista falla por el fixture. Se comprueba que el modo de fallo es ÉSE y no otro.
  const equipo = await pintarVista(banco, 'renderTeamView');
  assert.ok(equipo.error, 'suelo del hueco: si ya no falla, el hueco se ha cerrado solo y hay que ' +
    'volver a mirarlo — puede que el banco sirva ya para más vistas.');
  assert.match(String(equipo.error.message), /is not a function|undefined|null/i,
    'el fallo de las otras vistas es de FORMA DE DATOS (el fixture), no de carga. Si cambiara de ' +
    'naturaleza habría que mirarlo: podría ser un defecto de verdad.');
});

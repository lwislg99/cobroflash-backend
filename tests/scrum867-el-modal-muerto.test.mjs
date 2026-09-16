// tests/scrum867-el-modal-muerto.test.mjs — SCRUM-867
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL MODAL QUE NADIE ABRÍA, Y QUE EL PANEL SEGUÍA SIRVIENDO EN CADA VISITA
//
// `public/dashboard/js/nuevaFacturaModal.js` era la pantalla vieja de «Nueva factura». Desde que la
// lista navega a `invoices-new` (SCRUM-600b) nadie la abría: medido con el PASO 0 de este ticket,
// CERO referencias ejecutables en el panel y CERO aperturas montando la pantalla. Pero seguía
// **vivo por carga**: un `<script src>` en el índice y una entrada en el SHELL del service worker.
// Es decir, 266 líneas descargadas y ejecutadas en cada visita, y precacheadas para la siguiente.
//
// Se retiró. Este guard es lo que impide que vuelva, y vigila LAS TRES VÍAS por las que un fichero
// del panel puede seguir vivo, porque tapar una sola dejaría las otras dos abiertas:
//
//   ① el índice — un `<script src>` lo descarga y lo ejecuta, lo llame alguien o no;
//   ② el SHELL de `sw.js` — lo precachea, y además `addAll` es ATÓMICO: una ruta que ya no resuelve
//      tumba el precache entero y deja sin cobertura la primera visita (SCRUM-274);
//   ③ el código — una llamada o una cadena en otro `.js` del panel.
//
// 🔴 Y LA CUARTA PREGUNTA, LA QUE DE VERDAD IMPORTA: que la pantalla montada no lo abra. Con espía,
// y con el espía probado: un cero de un espía que no cuenta se lee igual que «nadie lo llamó».
//
// 🔴 POR AST, NO POR TEXTO. Un guard que busca el nombre en el fuente crudo se caza a sí mismo en
// el comentario que explica la prohibición —ha mordido cuatro veces en esta casa— y contaría como
// «vivo» un fichero al que sólo nombra la prosa. Este fichero lo nombra en cada párrafo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica el espacio
import ts from 'typescript';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { scriptsDelHtml, entradasDelShell, referenciasEnJs, censoDeReferencias } from './_censo-modal-muerto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHERO = 'nuevaFacturaModal.js';
const FUNCION = 'openNuevaFacturaModal';
const RUTA = `public/dashboard/js/${FICHERO}`;
const INDICE = 'public/dashboard/index.html';
const SW = 'public/sw.js';
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const scriptsDelPanel = () => fs.readdirSync(DIR_JS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ ruta: `public/dashboard/js/${f}`, texto: fs.readFileSync(path.join(DIR_JS, f), 'utf8') }));

const respirar = () => new Promise((r) => setTimeout(r, 60));

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⓪ SUELO · los tres censores TIENEN que ver una referencia fabricada
//
// Diferencial y EN MEMORIA: se compara el censo del árbol con el del mismo árbol más una
// referencia inventada, y se exige que suba en uno. No se escribe un byte en disco — ni en el
// árbol ni en el temporal—, así que no hay nada que restaurar ni nada que se pueda quedar puesto.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-867 · ⓪ SUELO: con una referencia FABRICADA, los tres censores la ven', () => {
  const html = leer(INDICE);
  const sw = leer(SW);
  const scripts = scriptsDelPanel();
  const base = censoDeReferencias({ html, sw, scripts, fichero: FICHERO, funcion: FUNCION });

  const conIndice = censoDeReferencias({
    html: html.replace('</head>', `  <script src="./js/${FICHERO}"></script>\n</head>`),
    sw, scripts, fichero: FICHERO, funcion: FUNCION,
  });
  assert.equal(conIndice.enIndice.length, base.enIndice.length + 1,
    '🔴 CIEGO sobre el índice: le meto un `<script>` del fichero y no lo cuenta. Su cero no vale.');

  const conShell = censoDeReferencias({
    html, sw: sw.replace('const SHELL = [', `const SHELL = [\n  '/dashboard/js/${FICHERO}',`),
    scripts, fichero: FICHERO, funcion: FUNCION,
  });
  assert.ok(base.enShell && conShell.enShell, '🔴 CIEGO: no sé leer el `const SHELL = [ … ];` de sw.js');
  assert.equal(conShell.enShell.length, base.enShell.length + 1,
    '🔴 CIEGO sobre el SHELL: le meto una entrada del fichero y no la cuenta.');

  const conCodigo = censoDeReferencias({
    html, sw, fichero: FICHERO, funcion: FUNCION,
    scripts: [...scripts, { ruta: 'fabricado.js', texto: `function x(){ ${FUNCION}(function(){}); }\n` }],
  });
  assert.equal(conCodigo.enCodigo.length, base.enCodigo.length + 1,
    '🔴 CIEGO sobre el código: le meto una llamada y no la cuenta.');
});

test('SCRUM-867 · ⓪ SUELO: y un COMENTARIO que lo nombra NO cuenta como referencia', () => {
  // La otra mitad del suelo, y la que decide que este guard sirva: si contara comentarios, este
  // mismo fichero —que lo nombra veinte veces— se cazaría a sí mismo, y el guard duraría una hora.
  const soloProsa = `// ${FICHERO} y ${FUNCION} citados en un comentario\n/* y ${FUNCION} en un bloque */\nconst x = 1;\n`;
  assert.deepEqual(referenciasEnJs(soloProsa, 'prosa.js', { fichero: FICHERO, funcion: FUNCION }), [],
    '🔴 el censor cuenta COMENTARIOS. Un fichero al que sólo nombra la prosa no está vivo, y con ' +
    'este criterio el guard no podría vivir en el mismo repositorio que su propia explicación.');

  // CONTROL POSITIVO del mismo censor, para que el vacío de arriba no sea «no supe mirar».
  assert.equal(referenciasEnJs(`${FUNCION}();\n`, 'x.js', { fichero: FICHERO, funcion: FUNCION }).length, 1,
    '🔴 el censor tampoco ve una llamada de verdad: entonces su cero no dice nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ①②③ LAS TRES VÍAS, CERRADAS
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-867 · ① el fichero NO está en el árbol', () => {
  assert.equal(fs.existsSync(path.join(RAIZ, RUTA)), false,
    `🔴 ${RUTA} ha vuelto. Se retiró por muerto: nadie lo abría y el panel lo descargaba en cada ` +
    'visita. Si hace falta otra vez, es cambio de máster ANTES de código.');
});

test('SCRUM-867 · ② el índice NO lo carga (y sí carga los demás: el lector ve)', () => {
  const scripts = scriptsDelHtml(leer(INDICE));
  assert.ok(scripts.length >= 40,
    `🔴 CIEGO: sólo veo ${scripts.length} <script src> en el índice. Con tan pocos, un «no está» ` +
    'significaría que no sé leer el índice.');
  assert.deepEqual(scripts.filter((s) => s.includes(FICHERO)), [],
    `🔴 el índice vuelve a cargar ${FICHERO}: son 266 líneas descargadas y ejecutadas en cada visita ` +
    'para una pantalla a la que nadie llega.');
});

test('SCRUM-867 · ③ el SHELL del service worker NO lo precachea (y `addAll` es atómico)', () => {
  const shell = entradasDelShell(leer(SW));
  assert.ok(shell && shell.length >= 40,
    '🔴 CIEGO: no encuentro el `const SHELL = [ … ];` de sw.js, o trae menos entradas de las que hay.');
  assert.deepEqual(shell.filter((e) => e.includes(FICHERO)), [],
    `🔴 el SHELL vuelve a precachear ${FICHERO}. Si el fichero no existe, \`cache.addAll\` falla ENTERO ` +
    'y la primera visita se queda sin precache (SCRUM-274).');
});

test('SCRUM-867 · ④ ningún script del panel lo nombra en código EJECUTABLE', () => {
  const vivas = [];
  for (const { ruta, texto } of scriptsDelPanel()) {
    for (const r of referenciasEnJs(texto, ruta, { fichero: FICHERO, funcion: FUNCION })) {
      vivas.push(`${ruta}:${r.linea} · ${r.via} · ${JSON.stringify(r.texto).slice(0, 60)}`);
    }
  }
  assert.deepEqual(vivas, [],
    `🔴 alguien vuelve a llamar o a nombrar ${FICHERO} desde el panel:\n  ${vivas.join('\n  ')}`);
});

test('SCRUM-867 · ⑤ ningún test ni guard lo MONTA (los comentarios que lo nombran, sí)', () => {
  // Lo que no puede volver es EJECUTARLO. Nombrarlo es justo lo que hacen este fichero y los que
  // guardan su historia —600, 600b, 601, 713, 776—, y tiene que seguir permitido: un guard que
  // prohíbe hablar de lo que vigila se borra a sí mismo de la memoria del equipo.
  const llamadas = [];
  for (const dir of ['tests', 'scripts']) {
    const base = path.join(RAIZ, dir);
    for (const f of fs.readdirSync(base).filter((x) => x.endsWith('.mjs'))) {
      const texto = fs.readFileSync(path.join(base, f), 'utf8');
      const sf = ts.createSourceFile(f, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const ver = (n) => {
        const llamado = ts.isCallExpression(n)
          && ((ts.isIdentifier(n.expression) && n.expression.text === FUNCION)
            || (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === FUNCION));
        if (llamado) llamadas.push(`${dir}/${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
        ts.forEachChild(n, ver);   // ⚠️ `ver` no devuelve nada: `forEachChild` CORTA con truthy
      };
      ver(sf);
    }
  }
  assert.deepEqual(llamadas, [],
    `🔴 un instrumento vuelve a ABRIR el modal retirado:\n  ${llamadas.join('\n  ')}\n  ` +
    'Si hace falta medir aquella pantalla otra vez, se restaura desde git dentro de un instrumento ' +
    'de evidencia que la vuelva a retirar — como hace `docs/master/evidencias/SCRUM-867/`.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ LA PREGUNTA QUE DE VERDAD IMPORTA · la pantalla montada no lo abre
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-867 · ⑥ montando el panel, «Nueva factura» NO abre el modal (con el espía probado)', async () => {
  const banco = cargarDashboard(RAIZ, {});
  banco.ctx.appDocumentoSuelto = 'factura';
  banco.ctx.appMerchantId = 1;

  let abiertas = 0;
  banco.ctx[FUNCION] = function () { abiertas += 1; };
  const navegaciones = [];
  banco.ctx.renderAppView = (v) => navegaciones.push(v);

  const lista = await pintarVista(banco, 'renderInvoicesView');
  assert.equal(lista.error, null, `🔴 la lista de Facturas no monta: ${lista.error && lista.error.message}`);
  const boton = todos(lista.contenedor).find((n) => n.tagName === 'BUTTON'
    && /Nueva factura|Nuevo justificante/.test(String(n.textContent || n._html || '')));
  assert.ok(boton, '🔴 CIEGO: no encuentro el botón «Nueva factura» en la lista');
  boton.disparar('click');
  await respirar();

  assert.deepEqual(navegaciones, ['invoices-new'],
    `🔴 el botón ya no navega a la página del documento suelto: ${JSON.stringify(navegaciones)}`);
  assert.equal(abiertas, 0, '🔴 el botón vuelve a abrir el modal retirado.');

  // CONTROL DEL ESPÍA: si nadie lo llamó, hay que probar que el espía sabría verlo. Sin esto, un
  // espía roto y una pantalla que no lo abre dan el mismo cero.
  banco.ctx[FUNCION](function () {});
  assert.equal(abiertas, 1, '🔴 el espía no cuenta ni una llamada directa: su cero no significa nada.');
});

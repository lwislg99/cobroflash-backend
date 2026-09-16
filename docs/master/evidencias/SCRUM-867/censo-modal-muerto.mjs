// docs/master/evidencias/SCRUM-867/censo-modal-muerto.mjs — SCRUM-867 · PASO 0
//
//   node docs/master/evidencias/SCRUM-867/censo-modal-muerto.mjs
//
// ¿ESTÁ MUERTO `public/dashboard/js/nuevaFacturaModal.js`? Se contesta por mecanismo y con suelo:
//
//   ① el índice: ¿lo carga un `<script src>`?
//   ② el service worker: ¿lo precachea el SHELL?
//   ③ el código del panel: ¿alguien lo nombra o llama a `openNuevaFacturaModal`? (AST)
//   ④ la pantalla montada: ¿la lista de Facturas lo abre? Con ESPÍA, y con el espía probado.
//   ⑤ los instrumentos que lo nombran: lo que habrá que resolver al retirarlo.
//
// 🔴 EL SUELO VA PRIMERO. A una copia EN MEMORIA del índice, del `sw.js` y de un script del panel
// se les fabrica una referencia. Si el censo no la ve, no dice «está muerto»: se declara CIEGO y
// sale con 2. Un cero de un instrumento roto se lee igual que un fichero muerto.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const { censoDeReferencias } = await import(new URL('../../../../tests/_censo-modal-muerto.mjs', import.meta.url));
const { cargarDashboard, pintarVista, todos } = await import(new URL('../../../../tests/_banco-vistas.mjs', import.meta.url));

const FICHERO = 'nuevaFacturaModal.js';
const FUNCION = 'openNuevaFacturaModal';
const INDICE = path.join(RAIZ, 'public', 'dashboard', 'index.html');
const SW = path.join(RAIZ, 'public', 'sw.js');
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');

const leer = (p) => fs.readFileSync(p, 'utf8');
const html = leer(INDICE);
const sw = leer(SW);
const scripts = fs.readdirSync(DIR_JS)
  .filter((f) => f.endsWith('.js') && f !== FICHERO)
  .map((f) => ({ ruta: `public/dashboard/js/${f}`, texto: leer(path.join(DIR_JS, f)) }));

let ciego = false;
const mal = (s) => { ciego = true; console.log(s); };

// ── ⓪ SUELO · con una referencia fabricada, el censo TIENE que verla ───────────────────────
//
// 🔴 DIFERENCIAL, y la primera versión no lo era: exigía «veo exactamente una» y con el árbol de
// HOY —que todavía carga el fichero— el censo veía dos, la de verdad y la fabricada, así que se
// declaró ciego estando sano. Lo que prueba que ve es que fabricar una SUBA el recuento en uno, y
// eso vale igual antes de retirar el fichero que después.
console.log('═══ ⓪ SUELO · referencias fabricadas en memoria (diferencial) ═══');
const base = censoDeReferencias({ html, sw, scripts, fichero: FICHERO, funcion: FUNCION });

const conIndice = censoDeReferencias({
  html: html.replace('</head>', `  <script src="./js/${FICHERO}"></script>\n</head>`),
  sw, scripts, fichero: FICHERO, funcion: FUNCION,
});
const subeIndice = conIndice.enIndice.length === base.enIndice.length + 1;
console.log(`  índice + <script> fabricado → ${base.enIndice.length} ⇒ ${conIndice.enIndice.length} · lo ve: ${subeIndice ? 'SÍ' : '🔴 NO'}`);
if (!subeIndice) mal('  🔴 CIEGO sobre el índice');

const conShell = censoDeReferencias({
  html, sw: sw.replace('const SHELL = [', `const SHELL = [\n  '/dashboard/js/${FICHERO}',`),
  scripts, fichero: FICHERO, funcion: FUNCION,
});
const nBase = base.enShell ? base.enShell.length : -1;
const nCon = conShell.enShell ? conShell.enShell.length : -1;
const subeShell = nCon === nBase + 1 && nBase >= 0;
console.log(`  SHELL + entrada fabricada → ${nBase} ⇒ ${nCon} · la ve: ${subeShell ? 'SÍ' : '🔴 NO'}`);
if (!subeShell) mal('  🔴 CIEGO sobre el SHELL');

const conCodigo = censoDeReferencias({
  html, sw, fichero: FICHERO, funcion: FUNCION,
  scripts: [...scripts, { ruta: 'fabricado.js', texto: `// ${FICHERO} en un comentario NO cuenta\nfunction x(){ ${FUNCION}(function(){}); }\n` }],
});
const subeCodigo = conCodigo.enCodigo.length === base.enCodigo.length + 1;
console.log(`  código + llamada fabricada → ${base.enCodigo.length} ⇒ ${conCodigo.enCodigo.length} · la ve: ${subeCodigo ? 'SÍ' : '🔴 NO'} · y el comentario del mismo fichero fabricado NO suma`);
if (!subeCodigo) mal('  🔴 CIEGO sobre el código, o contando comentarios');

// ── ①②③ EL ÁRBOL DE HOY ───────────────────────────────────────────────────────────────────
console.log('\n═══ ①②③ EL ÁRBOL DE HOY ═══');
const censo = censoDeReferencias({ html, sw, scripts, fichero: FICHERO, funcion: FUNCION });
if (censo.shellIlegible) mal('  🔴 CIEGO: no encuentro `const SHELL = [ … ];` en public/sw.js');
console.log(`  ① índice: ${censo.enIndice.length ? censo.enIndice.join(', ') : '(ninguno)'}`);
console.log(`  ② SHELL:  ${censo.enShell && censo.enShell.length ? censo.enShell.join(', ') : '(ninguna)'}`);
console.log(`  ③ código: ${censo.enCodigo.length ? '' : '(ninguna referencia ejecutable)'}`);
for (const r of censo.enCodigo) console.log(`      ${r.ruta}:${r.linea} · ${r.via} · ${JSON.stringify(r.texto).slice(0, 60)}`);

// ── ④ LA PANTALLA MONTADA ─────────────────────────────────────────────────────────────────
console.log('\n═══ ④ LA PANTALLA MONTADA (con el espía probado) ═══');
try {
  const banco = cargarDashboard(RAIZ, {});
  banco.ctx.appDocumentoSuelto = 'factura';
  banco.ctx.appMerchantId = 1;
  let abiertas = 0;
  banco.ctx[FUNCION] = function () { abiertas += 1; };
  const navegaciones = [];
  banco.ctx.renderAppView = (v) => navegaciones.push(v);

  const lista = await pintarVista(banco, 'renderInvoicesView');
  if (lista.error) throw lista.error;
  const boton = todos(lista.contenedor).find((n) => n.tagName === 'BUTTON'
    && /Nueva factura|Nuevo justificante/.test(String(n.textContent || n._html || '')));
  if (!boton) mal('  🔴 CIEGO: no encuentro el botón «Nueva factura» en la lista');
  else boton.disparar('click');
  await new Promise((r) => setTimeout(r, 50));

  const pagina = await pintarVista(banco, 'renderDocumentoSueltoView');
  if (pagina.error) throw pagina.error;

  console.log(`  «Nueva factura» → renderAppView(${JSON.stringify(navegaciones)})`);
  console.log(`  la página del documento suelto monta: ${todos(pagina.contenedor).length} nodos`);
  console.log(`  veces que se abrió el modal viejo: ${abiertas}`);

  // CONTROL DEL ESPÍA: si nadie lo llamó, hay que probar que el espía sabría verlo.
  banco.ctx[FUNCION](function () {});
  console.log(`  control del espía (llamada directa) → cuenta: ${abiertas === 1 ? 'SÍ' : '🔴 NO'}`);
  if (abiertas !== 1) mal('  🔴 el espía no cuenta ni una llamada directa: su cero no significa nada');
} catch (e) {
  mal(`  🔴 CIEGO: la pantalla no monta: ${(e && e.message) || e}`);
}

// ── ⑤ QUIÉN LO NOMBRA EN LOS INSTRUMENTOS ─────────────────────────────────────────────────
console.log('\n═══ ⑤ INSTRUMENTOS QUE LO NOMBRAN (lo que hay que resolver al retirarlo) ═══');
for (const dir of ['tests', 'scripts']) {
  const base = path.join(RAIZ, dir);
  for (const f of fs.readdirSync(base).filter((x) => x.endsWith('.mjs'))) {
    const t = leer(path.join(base, f));
    const veces = (t.match(new RegExp(FICHERO.replace('.', '\\.'), 'g')) || []).length
      + (t.match(new RegExp(FUNCION, 'g')) || []).length;
    if (veces) console.log(`  ${dir}/${f} · ${veces}`);
  }
}

console.log(ciego ? '\n🔴 CENSO CIEGO: no se puede afirmar que esté muerto' : '\n✅ censo completo');
process.exit(ciego ? 2 : 0);

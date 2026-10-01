// banco.mjs — SCRUM-1336 · LOS SIETE GUARDS, EJERCITADOS CON SU NAVEGADOR DE VERDAD.
//
//   node banco.mjs <raiz ABSOLUTA del repo> <sha o ref de git> <etiqueta> <dir de salida> [filtro]
//
//   filtro: un id de pasada («contraste-ciego»), un guard («contraste») o un escenario («ciego»).
//
// ── POR QUÉ UN ÁRBOL DESECHABLE Y NO ROMPER EL DE TRABAJO ────────────────────────────────────
// El banco de SCRUM-1327 rompía el producto en el árbol de trabajo y lo deshacía con la edición
// inversa. Si el proceso muere a mitad se salta su vuelta atrás y el árbol se queda roto. Éste
// saca los ficheros del SHA que se le dice (`git archive`) a un directorio temporal FUERA del
// repo, rompe ALLÍ y lo tira. El árbol de trabajo no se toca nunca; lo único que comparten es
// `node_modules`, por un enlace de directorio que se quita antes de borrar.
//
// Y por eso «antes» y «después» son el MISMO banco con otro SHA: lo único que cambia entre las
// dos pasadas es el fuente de los guards.
//
// ── LO QUE CADA PASADA TIENE QUE DEMOSTRAR ANTES DE CONTAR (A21) ─────────────────────────────
//   · que la rotura se aplicó: cada sustitución cuenta sus apariciones;
//   · que el guard corrió: código de salida numérico, sin señal, y con salida escrita.
// Una pasada que no cumple las dos NO SE CUENTA: ni verde, ni rojo, ni ciego del guard.
//
// ── SEIS Y UNO ───────────────────────────────────────────────────────────────────────────────
// Seis guards llevaban la marca `pintaElCiegoDeHallazgo` en `SALEN_A_MANO`; `rastro-del-menu` no.
// Van en dos grupos y sus líneas se dicen por separado: no se suman en ningún recuento.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lineaDeLosQueMidieron } from './linea.mjs';

const [RAIZ, REF, ETIQUETA, SALIDA, FILTRO] = process.argv.slice(2);
if (!RAIZ || !path.isAbsolute(RAIZ) || !REF || !ETIQUETA || !SALIDA) {
  console.error('uso: node banco.mjs <raiz ABSOLUTA> <sha> <etiqueta> <dir de salida> [filtro]');
  process.exit(2);
}

const INDICE = 'public/index.html';
const PANEL = 'public/dashboard/index.html';
const APP = 'public/dashboard/js/app.js';
const EDITOR = 'public/dashboard/js/quotesView.js';
const DETALLE = 'public/dashboard/js/quotesDetailView.js';
const INFORMES = 'public/dashboard/js/reportsView.js';
const PROVEEDORES = 'public/dashboard/js/providersView.js';
const MARCADOR = '[PENDIENTE microcopy oficial]';

// ── Las roturas. Cada una dice cuántas veces tiene que aparecer lo que sustituye. ────────────
const COMPARATIVA_SIN_SECCION = { f: INDICE, de: '<section id="comparativa"', a: '<section id="comparativa-rota"', veces: 1 };
const COMPARATIVA_SIN_ETIQUETA = { f: INDICE, de: '<p><span class="cmp-lbl">Con YaQu</span> Lo aceptó con su firma', a: '<p> Lo aceptó con su firma', veces: 1 };
const COMPARATIVA_SIN_GRID = { f: INDICE, de: '.cmp-row{display:grid;grid-template-columns:1.2fr 1fr 1fr;', a: '.cmp-row{display:block;', veces: 1 };

const LANDING_NOTA_VACIA = { f: INDICE, de: '<p class="note"><b>14 días gratis</b><span class="dot"></span>Sin tarjeta<span class="dot"></span>Listo en 5 minutos</p>', a: '<p class="note"></p>', veces: 1 };
const LANDING_REGION_SIN_NOMBRE = { f: INDICE, de: ' aria-labelledby="reg-faq"', a: '', veces: 1 };

const PAGINA_QUE_ROMPE_AL_MEDIDOR = { crear: 'public/zz-ciego-1336.html', contenido: '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>ciego</title></head><body><p>pagina que no se deja medir</p>'
  + '<script>window.getComputedStyle = function () { throw new Error("rota a proposito por el banco de SCRUM-1336"); };</script></body></html>\n' };
const PAGINA_CON_PAR_NUEVO = { crear: 'public/zz-hallazgo-1336.html', contenido: '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>hallazgo</title></head>'
  + '<body style="background:#ffffff"><p style="color:#c1c2c3;font-size:14px">texto gris claro sobre blanco</p></body></html>\n' };
const SOLO_UNA_PAGINA_CASI_VACIA = { dejarSoloEsteHtml: 'public/solo-1336.html', contenido: '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>solo</title></head><body><p>tres</p><p>nodos</p><p>de texto</p></body></html>\n' };

const DUPLICAR_SIN_BOTON = { f: DETALLE, de: "'⎘ Duplicar'", a: "'⎘ Clonar'", veces: 1 };
const DUPLICAR_PIERDE_EL_DESCUENTO = { f: EDITOR, de: "if (template.discountGlobalAmount != null && String(template.discountGlobalAmount).trim() !== '') {", a: 'if (false) {', veces: 1 };
const EDITOR_SIN_OPCION_5050 = { f: EDITOR, de: 'opt5050.value = "FIFTY_FIFTY";', a: 'opt5050.value = "FIFTY_FIFTY_ROTA";', veces: 1 };

const INFORMES_REVIENTA = { f: INFORMES, de: "async function renderReportsView(container) {\n  container.innerHTML = '';", a: "async function renderReportsView(container) {\n  container.innerHTML = '';\n  throw new Error('rota a proposito por el banco de SCRUM-1336');", veces: 1 };
const INFORMES_PINTA_MARCADOR = { f: INFORMES, de: "  container.appendChild(wrap);", a: "  container.appendChild(wrap);\n  container.appendChild(document.createTextNode('" + MARCADOR + " puesto por el banco de SCRUM-1336'));", veces: 1 };
const PROVEEDORES_REVIENTA = { f: PROVEEDORES, de: 'function renderProvidersView(container) {', a: "function renderProvidersView(container) {\n    throw new Error('rota a proposito por el banco de SCRUM-1336');", veces: 1 };
const PANEL_SIN_SCRIPTS = { f: PANEL, de: './js/', a: './jsx/', veces: 95 };

const TACTIL_SIN_ANUNCIO = { f: INDICE, de: 'id="announce"', a: 'id="announce-rota"', veces: 1 };
const TACTIL_BOTON_CORTO = { f: INDICE, de: '.cmp-lbl{display:block;', a: '.try-reset{min-height:0!important;height:20px!important;padding:0!important;line-height:1!important}\n  .cmp-lbl{display:block;', veces: 1 };

const MENU_CON_UN_DESTINO_MENOS = { f: PANEL, de: '<button class="nav-item" data-view="home">', a: '<button class="nav-item" data-vista="home">', veces: 1 };
// Un destino MÁS (19): un segundo botón hacia una vista que ya existe, para que lo único que cambie
// sea cuántos hay. Lo pidió el orquestador (c.17957): «verde con 19» estaba leído, no corrido.
const MENU_CON_UN_DESTINO_MAS = { f: PANEL, de: '<button class="nav-item" data-view="home">', a: '<button class="nav-item" data-view="settings">uno mas</button>\n        <button class="nav-item" data-view="home">', veces: 1 };
const MENU_POR_RENDER_CRUDO ={ f: APP, de: "btn.addEventListener('click', () => window.renderAppView(btn.dataset.view));", a: "btn.addEventListener('click', () => renderView(btn.dataset.view));", veces: 1 };

// ── Un ciego que, además, deja SIN VER algo que el guard espera ver. Sin el arreglo de este ticket
// eso fabricaba hallazgos falsos («ya no aparece», «ha bajado», «excepción caduca»): el mismo ciego
// pintado de 1 por otra puerta.
const ADMIN_NO_SE_DEJA_MEDIR = { f: 'public/admin.html', de: '</body>', a: '<script>window.getComputedStyle = function () { throw new Error("rota a proposito por el banco de SCRUM-1336"); };</script></body>', veces: 1 };
const RECIBIDAS_REVIENTA = { f: 'public/dashboard/js/facturasRecibidasView.js', de: '  function renderFacturasRecibidasView(container) {', a: "  function renderFacturasRecibidasView(container) {\n    throw new Error('rota a proposito por el banco de SCRUM-1336');", veces: 1 };
const CLIENTES_REVIENTA = { f: 'public/dashboard/js/customersView.js', de: 'function renderCustomersView(container) {', a: "function renderCustomersView(container) {\n  throw new Error('rota a proposito por el banco de SCRUM-1336');", veces: 1 };

const SEIS = 'seis';
const SEPTIMO = 'septimo';
const PASADAS = [
  // ── a11y-comparativa ──
  { guard: 'a11y-comparativa', grupo: SEIS, escenario: 'limpio', que: 'sin romper nada', cambios: [] },
  { guard: 'a11y-comparativa', grupo: SEIS, escenario: 'ciego', que: 'la sección #comparativa no existe en ningún ancho: 0 hallazgos, todo ciego', cambios: [COMPARATIVA_SIN_SECCION] },
  { guard: 'a11y-comparativa', grupo: SEIS, escenario: 'hallazgo', que: 'una celda llega sin su etiqueta de columna, y ningún ciego', cambios: [COMPARATIVA_SIN_ETIQUETA] },
  { guard: 'a11y-comparativa', grupo: SEIS, escenario: 'mixto', que: 'ciego a 1280 (no hay grid) y la celda sin etiqueta a 360', cambios: [COMPARATIVA_SIN_ETIQUETA, COMPARATIVA_SIN_GRID] },
  // ── a11y-landing ──
  { guard: 'a11y-landing', grupo: SEIS, escenario: 'limpio', que: 'sin romper nada', cambios: [] },
  { guard: 'a11y-landing', grupo: SEIS, escenario: 'ciego', que: '.note no da nombre accesible en ningún ancho: 0 hallazgos', cambios: [LANDING_NOTA_VACIA] },
  { guard: 'a11y-landing', grupo: SEIS, escenario: 'hallazgo', que: 'la sección de preguntas pierde su nombre de región, y ningún ciego', cambios: [LANDING_REGION_SIN_NOMBRE] },
  { guard: 'a11y-landing', grupo: SEIS, escenario: 'mixto', que: '.note ciega y la región sin nombre', cambios: [LANDING_NOTA_VACIA, LANDING_REGION_SIN_NOMBRE] },
  // ── contraste ──
  { guard: 'contraste', grupo: SEIS, escenario: 'limpio', que: 'sin romper nada', cambios: [] },
  { guard: 'contraste', grupo: SEIS, escenario: 'ciego', que: 'una página que no se deja medir: 0 hallazgos', cambios: [PAGINA_QUE_ROMPE_AL_MEDIDOR] },
  { guard: 'contraste', grupo: SEIS, escenario: 'ciego-suelo', que: 'una sola página con tres nodos de texto: por debajo del suelo de 50', cambios: [SOLO_UNA_PAGINA_CASI_VACIA] },
  { guard: 'contraste', grupo: SEIS, escenario: 'hallazgo', que: 'un par nuevo por debajo de AA, y ningún ciego', cambios: [PAGINA_CON_PAR_NUEVO] },
  { guard: 'contraste', grupo: SEIS, escenario: 'mixto', que: 'la página que no se deja medir va ANTES de la que trae el par nuevo', cambios: [PAGINA_QUE_ROMPE_AL_MEDIDOR, PAGINA_CON_PAR_NUEVO] },
  // ── duplicar-926 ──
  { guard: 'duplicar-926', grupo: SEIS, escenario: 'limpio', que: 'sin romper nada', cambios: [] },
  { guard: 'duplicar-926', grupo: SEIS, escenario: 'ciego', que: 'no hay botón «Duplicar» en ninguno de los dos casos: 0 hallazgos', cambios: [DUPLICAR_SIN_BOTON] },
  { guard: 'duplicar-926', grupo: SEIS, escenario: 'hallazgo', que: 'duplicar pierde el descuento global, y ningún ciego', cambios: [DUPLICAR_PIERDE_EL_DESCUENTO] },
  { guard: 'duplicar-926', grupo: SEIS, escenario: 'mixto', que: 'duplicar pierde el descuento (G) y el desplegable de cobro no se puede leer (P)', cambios: [DUPLICAR_PIERDE_EL_DESCUENTO, EDITOR_SIN_OPCION_5050] },
  // ── marcadores-en-pantalla ──
  { guard: 'marcadores-en-pantalla', grupo: SEIS, escenario: 'limpio', que: 'sin romper nada', cambios: [] },
  { guard: 'marcadores-en-pantalla', grupo: SEIS, escenario: 'ciego', que: 'la vista de Informes revienta en sus tres estados: 0 hallazgos', cambios: [INFORMES_REVIENTA] },
  { guard: 'marcadores-en-pantalla', grupo: SEIS, escenario: 'ciego-banco', que: 'index.html del panel sin scripts: «el banco no es el panel», antes de medir nada', cambios: [PANEL_SIN_SCRIPTS] },
  { guard: 'marcadores-en-pantalla', grupo: SEIS, escenario: 'hallazgo', que: 'Informes pinta un marcador nuevo, y ningún ciego', cambios: [INFORMES_PINTA_MARCADOR] },
  { guard: 'marcadores-en-pantalla', grupo: SEIS, escenario: 'mixto', que: 'Informes pinta un marcador nuevo y Proveedores revienta', cambios: [INFORMES_PINTA_MARCADOR, PROVEEDORES_REVIENTA] },
  // ── objetivo-tactil ──
  { guard: 'objetivo-tactil', grupo: SEIS, escenario: 'limpio', que: 'sin romper nada', cambios: [] },
  { guard: 'objetivo-tactil', grupo: SEIS, escenario: 'ciego', que: 'la barra de anuncio no existe: el destapar declarado y su conocido faltan; 0 hallazgos', cambios: [TACTIL_SIN_ANUNCIO] },
  { guard: 'objetivo-tactil', grupo: SEIS, escenario: 'hallazgo', que: '«Volver a empezar» mide 20 px, y ningún ciego', cambios: [TACTIL_BOTON_CORTO] },
  { guard: 'objetivo-tactil', grupo: SEIS, escenario: 'mixto', que: 'la barra de anuncio no existe y «Volver a empezar» mide 20 px', cambios: [TACTIL_SIN_ANUNCIO, TACTIL_BOTON_CORTO] },
  // ── EL SÉPTIMO, aparte: rastro-del-menu ──
  { guard: 'rastro-del-menu', grupo: SEPTIMO, escenario: 'limpio', que: 'sin romper nada', cambios: [] },
  { guard: 'rastro-del-menu', grupo: SEPTIMO, escenario: 'ciego', que: 'el menú pierde un destino: por debajo de su suelo', cambios: [MENU_CON_UN_DESTINO_MENOS] },
  { guard: 'rastro-del-menu', grupo: SEPTIMO, escenario: 'hallazgo', que: 'el menú navega por `renderView` crudo: no deja rastro, y ningún ciego', cambios: [MENU_POR_RENDER_CRUDO] },
  { guard: 'rastro-del-menu', grupo: SEPTIMO, escenario: 'gana-uno', que: 'el menú GANA un destino (19): qué dice el guard, él solo', cambios: [MENU_CON_UN_DESTINO_MAS] },
  // ── UN CIEGO QUE DEJA SIN VER LO QUE EL GUARD ESPERA VER (tres de los seis tienen juicios por ausencia) ──
  { guard: 'contraste', grupo: SEIS, escenario: 'ciego-ausencia', que: 'admin.html no se deja medir, y es donde vive un par CONOCIDO: 0 hallazgos reales', cambios: [ADMIN_NO_SE_DEJA_MEDIR] },
  { guard: 'marcadores-en-pantalla', grupo: SEIS, escenario: 'ciego-ausencia', que: 'revienta «facturas-recibidas», la única vista con techo en el CENSO: 0 hallazgos reales', cambios: [RECIBIDAS_REVIENTA] },
  { guard: 'objetivo-tactil', grupo: SEIS, escenario: 'ciego-ausencia', que: 'la lista de Clientes no monta, y sus excepciones dejan de verse: 0 hallazgos reales', cambios: [CLIENTES_REVIENTA] },
].map((p) => ({ ...p, id: p.guard + '-' + p.escenario }));

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES, CON NAVEGADOR. Cada una rompe UNA línea del guard arreglado en el árbol desechable
// y repite un escenario cuyo resultado sin mutar ya está en el resumen de ESTE SHA.
//
//   ciego-a-hallazgo .... el ciego vuelve a apuntarse como hallazgo: es el defecto del ticket, vuelto
//                         a poner. El escenario «ciego» tiene que dejar de salir 2.
//   hallazgo-a-ciego .... el hallazgo se apunta como ciego: es lo que la aceptación C teme. El
//                         escenario «hallazgo» tiene que dejar de salir 1.
//   juzga-por-ausencia .. se quita la suspensión de los juicios por ausencia. El escenario
//                         «ciego-ausencia» tiene que dejar de salir 2.
//
// Sólo corren con el filtro «mutaciones» (o por su id): no son parte de la pasada normal.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const g = (nombre) => 'scripts/guard-' + nombre + '.mjs';
const SUMIDERO_CIEGO = 'const noSupeMirar = (texto) => { console.error(texto); ciegos.push(texto); };';
const SUMIDERO_HALLAZGO = 'const hallazgo = (texto) => { console.error(texto); hallazgos.push(texto); };';
const MUTACIONES = [
  { guard: 'a11y-comparativa', grupo: SEIS, nombre: 'ciego-a-hallazgo', base: 'ciego', m: { f: g('a11y-comparativa'), de: SUMIDERO_CIEGO, a: SUMIDERO_CIEGO.replace('ciegos.push', 'hallazgos.push'), veces: 1 } },
  { guard: 'a11y-comparativa', grupo: SEIS, nombre: 'hallazgo-a-ciego', base: 'hallazgo', m: { f: g('a11y-comparativa'), de: SUMIDERO_HALLAZGO, a: SUMIDERO_HALLAZGO.replace('hallazgos.push', 'ciegos.push'), veces: 1 } },
  { guard: 'a11y-landing', grupo: SEIS, nombre: 'ciego-a-hallazgo', base: 'ciego', m: { f: g('a11y-landing'), de: SUMIDERO_CIEGO, a: SUMIDERO_CIEGO.replace('ciegos.push', 'hallazgos.push'), veces: 1 } },
  { guard: 'a11y-landing', grupo: SEIS, nombre: 'hallazgo-a-ciego', base: 'hallazgo', m: { f: g('a11y-landing'), de: SUMIDERO_HALLAZGO, a: SUMIDERO_HALLAZGO.replace('hallazgos.push', 'ciegos.push'), veces: 1 } },
  { guard: 'contraste', grupo: SEIS, nombre: 'ciego-a-hallazgo', base: 'ciego', m: { f: g('contraste'), de: 'ciegos.push(...recorrido.ciegos);', a: 'hallazgos.push(...recorrido.ciegos);', veces: 1 } },
  { guard: 'contraste', grupo: SEIS, nombre: 'hallazgo-a-ciego', base: 'hallazgo', m: { f: g('contraste'), de: '    hallazgos.push(`par nuevo · ', a: '    ciegos.push(`par nuevo · ', veces: 1 } },
  { guard: 'contraste', grupo: SEIS, nombre: 'juzga-por-ausencia', base: 'ciego-ausencia', m: { f: g('contraste'), de: 'if (desaparecidos.length && !medidoEntero) {', a: 'if (false) {', veces: 1 } },
  { guard: 'duplicar-926', grupo: SEIS, nombre: 'ciego-a-hallazgo', base: 'ciego', m: { f: g('duplicar-926'), de: "  if (estado === 'ciego') ciegos.push(texto);", a: "  if (estado === 'ciego') hallazgos.push(texto);", veces: 1 } },
  { guard: 'duplicar-926', grupo: SEIS, nombre: 'hallazgo-a-ciego', base: 'hallazgo', m: { f: g('duplicar-926'), de: "  if (estado === 'hallazgo') hallazgos.push(texto);", a: "  if (estado === 'hallazgo') ciegos.push(texto);", veces: 1 } },
  { guard: 'marcadores-en-pantalla', grupo: SEIS, nombre: 'ciego-a-hallazgo', base: 'ciego', m: { f: g('marcadores-en-pantalla'), de: '  ciegos.push(...recorrido.ciegos);', a: '  hallazgos.push(...recorrido.ciegos);', veces: 1 } },
  { guard: 'marcadores-en-pantalla', grupo: SEIS, nombre: 'hallazgo-a-ciego', base: 'hallazgo', m: { f: g('marcadores-en-pantalla'), de: 'const hallazgo = (m) => { console.error(m); hallazgos.push(m); };', a: 'const hallazgo = (m) => { console.error(m); ciegos.push(m); };', veces: 1 } },
  { guard: 'marcadores-en-pantalla', grupo: SEIS, nombre: 'juzga-por-ausencia', base: 'ciego-ausencia', m: { f: g('marcadores-en-pantalla'), de: 'const seVioEntera = (vista) => detectorVe && !vistasConCiego.has(vista);', a: 'const seVioEntera = (vista) => true;', veces: 1 } },
  { guard: 'objetivo-tactil', grupo: SEIS, nombre: 'ciego-a-hallazgo', base: 'ciego', m: { f: g('objetivo-tactil'), de: 'const noSupeMirar = (s) => { console.error(s); ciegos.push(s); };', a: 'const noSupeMirar = (s) => { console.error(s); hallazgos.push(s); };', veces: 1 } },
  { guard: 'objetivo-tactil', grupo: SEIS, nombre: 'hallazgo-a-ciego', base: 'hallazgo', m: { f: g('objetivo-tactil'), de: 'const hallazgo = (s) => { console.error(s); hallazgos.push(s); };', a: 'const hallazgo = (s) => { console.error(s); ciegos.push(s); };', veces: 1 } },
  { guard: 'objetivo-tactil', grupo: SEIS, nombre: 'juzga-por-ausencia', base: 'ciego-ausencia', m: { f: g('objetivo-tactil'), de: 'for (const e of (anchosDelPanelMedidos < ANCHOS_PANEL.length ? [] : EXCEPCIONES_PANEL)) {', a: 'for (const e of EXCEPCIONES_PANEL) {', veces: 1 } },
  { guard: 'rastro-del-menu', grupo: SEPTIMO, nombre: 'ciego-a-hallazgo', base: 'ciego', m: { f: g('rastro-del-menu'), de: '    ciegos.push(String((e && e.message) || e));', a: '    fallos.push(String((e && e.message) || e));', veces: 1 } },
  { guard: 'rastro-del-menu', grupo: SEPTIMO, nombre: 'hallazgo-a-ciego', base: 'hallazgo', m: { f: g('rastro-del-menu'), de: 'const veredictoFinal = veredictoDe({ hallazgos: fallos, ciegos });', a: 'const veredictoFinal = veredictoDe({ hallazgos: ciegos, ciegos: fallos });', veces: 1 } },
].map((x) => {
  const base = PASADAS.find((p) => p.id === x.guard + '-' + x.base);
  return { guard: x.guard, grupo: x.grupo, escenario: 'mut-' + x.nombre, id: x.guard + '-mut-' + x.nombre, esMutacion: true, baseId: base.id,
    que: 'MUTACIÓN «' + x.nombre + '» sobre el escenario «' + x.base + '»: ' + x.m.de.slice(0, 60), cambios: [...base.cambios, x.m] };
});
const TODAS = [...PASADAS, ...MUTACIONES];

const elegidas = !FILTRO ? PASADAS
  : FILTRO === 'mutaciones' ? MUTACIONES
  : FILTRO.startsWith('mutaciones:') ? MUTACIONES.filter((p) => p.guard === FILTRO.slice('mutaciones:'.length))
  : TODAS.filter((p) => p.id === FILTRO || (!p.esMutacion && (p.guard === FILTRO || p.escenario === FILTRO)));
if (!elegidas.length) { console.error('🔴 el filtro «' + FILTRO + '» no casa con ninguna pasada'); process.exit(2); }

// ── El árbol desechable ──────────────────────────────────────────────────────────────────────
const git = (args, opciones = {}) => spawnSync('git', args, { cwd: RAIZ, maxBuffer: 512 * 1024 * 1024, ...opciones });
const sha = String(git(['rev-parse', '--verify', REF + '^{commit}'], { encoding: 'utf8' }).stdout || '').trim();
if (!/^[0-9a-f]{40}$/.test(sha)) { console.error('🔴 «' + REF + '» no es un commit de este repositorio'); process.exit(2); }

const ayudantes = String(git(['ls-tree', '-r', '--name-only', sha, 'tests'], { encoding: 'utf8' }).stdout || '')
  .split('\n').filter((f) => /^tests\/_[^/]+\.mjs$/.test(f));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1336-'));
const PRISTINO = path.join(TMP, '_pristino');
const ARBOL = path.join(TMP, 'arbol');
fs.mkdirSync(PRISTINO); fs.mkdirSync(ARBOL);
// Lo que NO sale de git y el árbol desechable toma PRESTADO del de trabajo, por enlace de
// directorio: las dependencias, y `dist/` (lo lee `tests/_banco-vistas.mjs`, que monta las vistas
// del panel para `guard-objetivo-tactil`). `dist/` es del árbol de trabajo, no del SHA medido: vale
// porque este ticket no toca `src/`, y el banco lo comprueba antes de fiarse.
const PRESTADOS = ['node_modules', 'dist'];
const enlaceDe = (nombre) => path.join(ARBOL, nombre);
let limpiado = false;
function limpiar() {
  if (limpiado) return;
  limpiado = true;
  // Los enlaces PRIMERO y por su nombre: borrar el árbol con ellos dentro sería pedirle a `rm`
  // que decida si los sigue.
  for (const nombre of PRESTADOS) {
    const enlace = enlaceDe(nombre);
    try { fs.rmdirSync(enlace); } catch { try { fs.unlinkSync(enlace); } catch { /* no estaba */ } }
    if (fs.existsSync(enlace)) { console.error('🔴 no pude quitar el enlace a ' + nombre + ': NO borro ' + TMP); return; }
  }
  fs.rmSync(TMP, { recursive: true, force: true });
}
process.on('exit', limpiar);

const tar = git(['archive', '--format=tar', sha, 'scripts', 'public', 'package.json', ...ayudantes]);
if (tar.status !== 0 || !tar.stdout || tar.stdout.length < 1024 * 1024) {
  console.error('🔴 `git archive` no dio un árbol (' + (tar.stdout ? tar.stdout.length : 0) + ' bytes): ' + String(tar.stderr || ''));
  process.exit(2);
}
for (const destino of [PRISTINO, ARBOL]) {
  // Con `cwd` y no con `-C <ruta>`: el `tar` de Git Bash lee las barras invertidas de una ruta de
  // Windows como escapes (`\a` de `\arbol`) y no encuentra el directorio.
  const x = spawnSync('tar', ['-x', '-f', '-'], { cwd: destino, input: tar.stdout, maxBuffer: 64 * 1024 * 1024 });
  if (x.status !== 0) { console.error('🔴 no pude extraer el árbol en ' + destino + ': ' + String(x.stderr || '')); process.exit(2); }
}
for (const nombre of PRESTADOS) fs.symlinkSync(path.join(RAIZ, nombre), enlaceDe(nombre), 'junction');
if (!fs.existsSync(path.join(enlaceDe('node_modules'), 'puppeteer-core'))) { console.error('🔴 el árbol desechable no ve puppeteer-core'); process.exit(2); }
if (!fs.existsSync(path.join(enlaceDe('dist'), 'app.js'))) { console.error('🔴 el árbol desechable no ve dist/: falta `npm run build` en el de trabajo'); process.exit(2); }
// `dist/` prestado sólo vale si `src/` es el mismo en el SHA medido y en el árbol de trabajo.
const srcDistinto = git(['diff', '--quiet', sha, '--', 'src', 'prisma'], { encoding: 'utf8' });
if (srcDistinto.status !== 0) { console.error('🔴 `src/` o `prisma/` del árbol de trabajo no son los de ' + sha + ': el `dist/` prestado mediría otro producto'); process.exit(2); }

const veces = (texto, trozo) => texto.split(trozo).length - 1;
function listarHtml(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listarHtml(p, acc); else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}
/** Aplica una rotura en el árbol desechable. Devuelve `null`, o el motivo por el que NO se aplicó. */
function aplicar(c) {
  if (c.crear) { fs.writeFileSync(path.join(ARBOL, c.crear), c.contenido); return null; }
  if (c.dejarSoloEsteHtml) {
    const todas = listarHtml(path.join(ARBOL, 'public'));
    if (todas.length < 5) return 'sólo había ' + todas.length + ' páginas que quitar';
    for (const f of todas) fs.rmSync(f);
    fs.writeFileSync(path.join(ARBOL, c.dejarSoloEsteHtml), c.contenido);
    return null;
  }
  const abs = path.join(ARBOL, c.f);
  const antes = fs.readFileSync(abs, 'utf8');
  const n = veces(antes, c.de);
  if (n !== c.veces) return `${c.f}: «${c.de.slice(0, 50)}» aparece ${n} veces y esperaba ${c.veces}`;
  fs.writeFileSync(abs, antes.split(c.de).join(c.a));
  return null;
}

// El entorno del sujeto se construye a mano (A21): sin el color ni las opciones de quien lo lanza.
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

fs.mkdirSync(SALIDA, { recursive: true });
const CR = String.fromCharCode(13);
const filas = [];
// EL CONTROL DEL BANCO, por guard: sin romper nada tiene que salir 0. Si no sale, el banco no está
// midiendo ESE guard (le falta algo en el árbol desechable) y ninguna de sus pasadas cuenta. Lo
// enseñó `objetivo-tactil`: sin `dist/` reventaba al importar, salía con 1 en 0,4 s y con salida
// escrita —la traza—, y eso se leía igual que cuatro hallazgos.
const controlLimpio = new Map();
// El resumen de este MISMO SHA, si lo hay: contra él se comparan las mutaciones.
const ficheroResumen = path.join(SALIDA, `${ETIQUETA}-resumen.json`);
let previas = [];
if (fs.existsSync(ficheroResumen)) {
  const anterior = JSON.parse(fs.readFileSync(ficheroResumen, 'utf8'));
  if (anterior.sha === sha && Array.isArray(anterior.filas)) previas = anterior.filas;
}
console.log(`POBLACION=${elegidas.length} pasadas (de ${PASADAS.length}) · etiqueta=${ETIQUETA} · sha=${sha} · arbol desechable=${ARBOL}`);
for (const p of elegidas) {
  // `public/` y `scripts/` vuelven a nacer del prístino en CADA pasada: no hay nada que deshacer.
  for (const dir of ['public', 'scripts']) {
    fs.rmSync(path.join(ARBOL, dir), { recursive: true, force: true });
    fs.cpSync(path.join(PRISTINO, dir), path.join(ARBOL, dir), { recursive: true });
  }
  let noAplicada = null;
  for (const c of p.cambios) { noAplicada = aplicar(c); if (noAplicada) break; }

  let r = null;
  const t0 = Date.now();
  if (!noAplicada) {
    r = spawnSync(process.execPath, [path.join('scripts', 'guard-' + p.guard + '.mjs')], { cwd: ARBOL, env: entorno, encoding: 'utf8', timeout: 280000, maxBuffer: 64 * 1024 * 1024 });
  }
  const segundos = ((Date.now() - t0) / 1000).toFixed(1);
  const salida = r ? (String(r.stdout || '') + String(r.stderr || '')).split(CR).join('') : '';
  // EL TESTIGO: un guard que no corrió se lee igual que uno que no encontró nada.
  let invalida = null;
  if (noAplicada) invalida = 'la rotura NO se aplicó — ' + noAplicada;
  else if (r.error) invalida = 'el proceso no llegó a correr o se cortó — ' + String(r.error.message || r.error);
  else if (r.signal) invalida = 'el proceso murió por la señal ' + r.signal;
  else if (!Number.isInteger(r.status)) invalida = 'el proceso no dejó código de salida';
  else if (!salida.trim()) invalida = 'el proceso salió con ' + r.status + ' SIN SALIDA: no hay testigo de que midiera';
  else if (p.esMutacion) { /* su control es la pasada sin mutar, más abajo */ }
  else if (p.escenario !== 'limpio' && controlLimpio.get(p.guard) === false) invalida = 'el control LIMPIO de este guard no salió 0 en este banco: no lo está midiendo';
  else if (p.escenario !== 'limpio' && !controlLimpio.has(p.guard)) console.log('  ⚠️ ' + p.id + ': en esta invocación no ha corrido el control limpio de su guard');
  if (p.escenario === 'limpio') controlLimpio.set(p.guard, !invalida && r.status === 0);
  // Una excepción sin capturar también sale con 1 y también escribe: se apunta, porque es justo
  // una de las formas del defecto (el suelo de `rastro-del-menu` es un `throw`).
  const sinCapturar = !invalida && /\nNode\.js v\d/.test(salida) && /\n\s+at /.test(salida);

  const veredicto = (salida.split('\n').filter((l) => l.includes('⟦veredicto⟧')).pop() || '').trim();
  // UNA MUTACIÓN se lee contra su pasada SIN MUTAR, del mismo SHA: si no la hay, no dice nada.
  let mutacion = null;
  if (p.esMutacion && !invalida) {
    const sinMutar = [...previas, ...filas].filter((f) => f.id === p.baseId && f.valida).pop();
    if (!sinMutar) invalida = 'no hay pasada SIN MUTAR de «' + p.baseId + '» para este SHA: no se puede decir si la mutación se ve';
    else mutacion = { sinMutar: sinMutar.exit, vista: sinMutar.exit !== r.status };
  }
  const fila = { id: p.id, guard: p.guard, grupo: p.grupo, escenario: p.escenario, valida: !invalida, exit: r ? r.status : null, segundos: Number(segundos), sinCapturar, veredicto, invalida, ...(p.esMutacion ? { esMutacion: true, baseId: p.baseId, mutacion } : {}) };
  filas.push(fila);
  if (mutacion) console.log('           ' + (mutacion.vista ? '✅ MUTACIÓN VISTA' : '🔴 MUTACIÓN MUDA') + ': sin mutar «' + p.baseId + '» salía ' + mutacion.sinMutar + ' y mutado sale ' + r.status);
  fs.writeFileSync(path.join(SALIDA, `${ETIQUETA}-${p.id}.txt`),
    `# ${p.id} · guard-${p.guard}.mjs @ ${sha} · ${p.que}\n# ${invalida ? 'PASADA SIN CONTAR: ' + invalida : 'EXIT=' + r.status} · ${segundos} s\n\n${salida}`);
  console.log(`${String(invalida ? 'SIN CONTAR' : 'EXIT=' + r.status).padEnd(10)} ${p.id.padEnd(36)} ${segundos.padStart(6)} s  ${veredicto || '(sin línea de veredicto)'}${sinCapturar ? '  · EXCEPCIÓN SIN CAPTURAR' : ''}${invalida ? '  ← ' + invalida : ''}`);
}

// ── La línea agregada, por grupo y por escenario. Sale SIEMPRE, también con ceros (E2). ──────
for (const grupo of [SEIS, SEPTIMO]) {
  const suyas = filas.filter((f) => f.grupo === grupo && !f.esMutacion);
  if (!suyas.length) continue;
  console.log(`\n── ${grupo === SEIS ? 'LOS SEIS con la marca `pintaElCiegoDeHallazgo`' : 'EL SÉPTIMO, aparte (rastro-del-menu)'} ──`);
  for (const escenario of [...new Set(suyas.map((f) => f.escenario))]) {
    console.log(`  ${escenario.padEnd(12)} ${lineaDeLosQueMidieron(suyas.filter((f) => f.escenario === escenario))}`);
  }
}

const st = git(['status', '--porcelain'], { encoding: 'utf8' });
console.log(`\nporcelain del árbol de TRABAJO tras el banco: ${String(st.stdout || '').trim() ? '\n' + st.stdout : '(vacío)'}`);
// El resumen ACUMULA entre invocaciones del MISMO SHA: el banco se lanza por trozos (un guard cada
// vez, para que ninguno pase de diez minutos) y una pasada repetida sustituye a la suya. Con otro
// SHA no se mezcla: se empieza de cero.
const porId = new Map([...previas, ...filas].map((f) => [f.id, f]));
const acumuladas = TODAS.map((p) => porId.get(p.id)).filter(Boolean);
const normales = acumuladas.filter((f) => !f.esMutacion).length;
const mutadas = acumuladas.filter((f) => f.esMutacion);
fs.writeFileSync(ficheroResumen, JSON.stringify({ sha, pasadas: normales, de: PASADAS.length, mutaciones: mutadas.length, deMutaciones: MUTACIONES.length, filas: acumuladas }, null, 2) + '\n');
console.log(`resumen: ${normales} de ${PASADAS.length} pasadas y ${mutadas.length} de ${MUTACIONES.length} mutaciones acumuladas para ${sha}`);
if (filas.some((f) => f.esMutacion)) {
  const estas = filas.filter((f) => f.esMutacion);
  const vistas = estas.filter((f) => f.valida && f.mutacion && f.mutacion.vista).length;
  const mudas = estas.filter((f) => f.valida && f.mutacion && !f.mutacion.vista).length;
  console.log(`MUTACIONES de esta invocación: ${estas.length} · vistas ${vistas} · MUDAS ${mudas} · sin contar ${estas.length - vistas - mudas}`);
}
// Este banco no juzga los guards: apunta. Sale 2 si alguna pasada no se pudo contar o una mutación quedó MUDA.
const sinContar = filas.filter((f) => !f.valida).length + filas.filter((f) => f.esMutacion && f.mutacion && !f.mutacion.vista).length;
console.log(`EXIT=${sinContar ? 2 : 0}`);
process.exitCode = sinContar ? 2 : 0;

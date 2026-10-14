// scripts/guard-modo-en-ajustes.mjs — SCRUM-1257e · EL MODO DE EMISIÓN EN AJUSTES, MEDIDO EN NAVEGADOR.
//
// Uso:  npm run guard:modo-en-ajustes
//
// ── QUÉ SE MIDE, Y POR QUÉ NO BASTA LO QUE YA HABÍA ──────────────────────────────────────────
// `Configuración › Cumplimiento` pinta una fila con el modo de emisión del comercio: un rótulo y
// una frase, una por modo (`TITULO_MODO_EMISION` y `DETALLE_MODO_EMISION` en `settingsView.js`).
// La de `receipt` es la frase que lee un profesional español que NO puede facturar con YaQu
// (regla 24): «Por ahora, YaQu no genera facturas desde tu cuenta.». Si en `receipt` esa frase no
// sale, el profesional no se entera de por qué no tiene facturas.
//
// Lo que había antes de esto (medido el 14-oct-2026, por concepto y no por número):
//   · `tests/scrum298-modo-visible.test.mjs` y `tests/scrum1257-p8-…` leen el FUENTE: aprueban el
//     literal y su procedencia, pero no pintan nada. Siguen verdes si la fila se borra al pintarse.
//   · `tests/banco-scrum1220/medir-ajustes-modo-justificante.mjs` sí pinta, pero en un DOM de
//     mentira, sólo `receipt` y `fiscal`, busca por SUBCADENA y no lo corre nadie.
//   · Ningún `guard:*` de navegador abría `Cumplimiento` ni leía la fila del modo.
// El fundador miró su Ajustes y no vio ningún modo — normal: su cuenta no está en `receipt`. Que
// nadie la haya visto nunca es justo lo que esto convierte en una comprobación.
//
// ── EL CONTRASTE ES LA MEDICIÓN ──────────────────────────────────────────────────────────────
// Los tres modos (`fiscal`, `demo`, `receipt`) y el `null` («no se sabe», que no pinta nada). En
// cada caso, la frase y el rótulo pintados se comparan CARÁCTER A CARÁCTER (`===`, no subcadena:
// un prefijo no es un nombre) contra los TRES literales, sacados por AST de `settingsView.js`, y
// tienen que coincidir con el del modo pintado y con NINGUNO de los otros dos. Además, en todo el
// documento renderizado no puede aparecer la frase de otro modo. Si el guard pasara con la misma
// frase en los tres modos, no estaría midiendo el modo: por eso los literales tienen que ser
// distintos entre sí, o el guard se declara ciego.
//
// ── ⚠️ LO QUE NO PRUEBA ──────────────────────────────────────────────────────────────────────
// Prueba el CÓDIGO del panel con `window.appModoEmision` puesto a mano, que es lo que `app.js`
// deja tras leer `/admin/me`. No prueba qué modo le da el servidor a nadie (eso lo vigila
// `scrum298` con `modoEmisionVisible`), ni la pantalla de ningún comercio real.
//
// ── QUE LA PANTALLA MEDIDA SEA LA QUE CREO ───────────────────────────────────────────────────
// SUELOS antes de cualquier veredicto: (a) los literales salen del fuente por AST, los tres, no
// vacíos y distintos; (b) el render no lanzó y los submenús existen; (c) el detector SABE DECIR
// QUE NO: en cada caso con fila se le pasa el texto pintado sin su último carácter (un prefijo) y
// con un carácter de más (una superstring), y tiene que rechazar los dos; (d) se sirvió el JS y el
// CSS del árbol. Si algo falla, NO SUPO MIRAR (salida 2), nunca verde.
//
// Fuera de `npm test` por la misma decisión que `guard:aviso-bizum`: la suite no arranca un
// navegador; corre en CI en el job «guards de navegador» (`guards:visuales`).
// Salidas: 0 verde · 1 hallazgo · 2 no supe medir. Todo lo que corre DENTRO de la página va en
// cadenas dentro de `new Function` (censo SCRUM-258).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const FUENTE = path.join(PUBLIC, 'dashboard/js/settingsView.js');
let PUERTO = Number(process.env.GUARD_MODO_AJUSTES_PUERTO || 0);

const MODOS = ['fiscal', 'demo', 'receipt'];
const CASOS = [...MODOS, null];

const JS = [
  '/dashboard/js/settingsSubmenus.js',
  '/dashboard/js/puertaSerie.js',
  '/dashboard/js/settingsView.js',
];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];

const ciegos = [];
const fallos = [];

// ── (a) LOS LITERALES, DEL FUENTE POR AST ─────────────────────────────────────────────────────
// No se copian aquí: el árbitro es lo que dice `settingsView.js` hoy. Que ESE literal sea el
// firmado lo vigilan `scrum298` y `scrum1257-p8` en la tanda; esto vigila que SE PINTA.
function objetoLiteral(fuente, nombre) {
  const sf = ts.createSourceFile('settingsView.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let hallado = null;
  (function v(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === nombre
      && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      hallado = {};
      for (const p of n.initializer.properties) {
        if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) hallado[p.name.getText(sf)] = p.initializer.text;
      }
    }
    ts.forEachChild(n, v);
  })(sf);
  return hallado;
}

const fuente = fs.readFileSync(FUENTE, 'utf8');
const TITULO = objetoLiteral(fuente, 'TITULO_MODO_EMISION');
const DETALLE = objetoLiteral(fuente, 'DETALLE_MODO_EMISION');
for (const [nombre, obj] of [['TITULO_MODO_EMISION', TITULO], ['DETALLE_MODO_EMISION', DETALLE]]) {
  if (!obj) { ciegos.push('no encuentro `const ' + nombre + ' = { … }` en settingsView.js'); continue; }
  for (const m of MODOS) {
    if (typeof obj[m] !== 'string' || !obj[m].trim()) ciegos.push(nombre + '.' + m + ' no es un literal con texto en settingsView.js');
  }
  const valores = MODOS.map((m) => obj[m]);
  if (new Set(valores).size !== valores.length) {
    ciegos.push(nombre + ' tiene dos modos con el MISMO literal: el contraste no puede distinguirlos');
  }
}

/** Comparación EXACTA, con el primer carácter que difiere para el informe. */
function comparar(pintado, esperado) {
  if (pintado === esperado) return { igual: true };
  let i = 0;
  while (i < pintado.length && i < esperado.length && pintado[i] === esperado[i]) i++;
  return { igual: false, en: i, pintado: JSON.stringify(pintado), esperado: JSON.stringify(esperado) };
}

/** Qué modos casan EXACTAMENTE con un texto pintado. Tiene que ser uno solo: el del caso. */
const modosQueCasan = (obj, texto) => MODOS.filter((m) => obj[m] === texto);

const leer = (rel) => fs.readFileSync(path.join(PUBLIC, rel.replace(/^\//, '')), 'utf8');

function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n'
    + '<script>\n'
    // Stubs MÍNIMOS: lo que la pantalla pide de fuera. No se reimplementa nada de la vista.
    + '  window.__merchant = { country: "ES", defaultCurrency: "EUR", connectStatus: "none" };\n'
    + '  window.getMerchantProfile = async () => window.__merchant;\n'
    + '  window.apiRequest = async (ruta) => {\n'
    + '    if (ruta === "/admin/merchant") return window.__merchant;\n'
    + '    if (ruta === "/admin/connect/status") return { enabled: false };\n'
    + '    if (ruta === "/admin/referral") return { code: "X", redeemed: false };\n'
    + '    if (ruta === "/admin/metrics/whatsapp") return { rows: [] };\n'
    + '    return {};\n'
    + '  };\n'
    + '  window.appLocale = "es";\n'
    + '  window.appModoEmision = null;\n'
    + '  window.appPuertaSerieDisponible = false;\n'
    + '  window.appRetencionOpciones = null;\n'
    + '  window.__errores = [];\n'
    + '  window.addEventListener("error", (e) => window.__errores.push(String(e.message)));\n'
    + '<\/script>\n'
    + JS.map((s) => '<script src="' + s + '"><\/script>').join('\n')
    + '\n</body></html>';
}

function arrancarServidor() {
  const servidos = [];
  const srv = http.createServer((req, res) => {
    const ruta = req.url.split('?')[0];
    if (ruta === '/__modo-en-ajustes.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(paginaHtml());
    }
    try {
      const cuerpo = leer(ruta);
      servidos.push(ruta);
      const tipo = ruta.endsWith('.css') ? 'text/css' : ruta.endsWith('.js') ? 'text/javascript' : 'text/plain';
      res.writeHead(200, { 'content-type': tipo + '; charset=utf-8' });
      res.end(cuerpo);
    } catch {
      res.writeHead(404); res.end('');
    }
  });
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return { srv, servidos }; });
}

/** Pinta Ajustes con el modo dado. Se ejecuta DENTRO del navegador. */
const PINTAR = new Function('modo', `
  window.appModoEmision = modo;
  try {
    renderSettingsView(document.getElementById('vista'));
  } catch (e) {
    return { fatal: 'renderSettingsView lanzo: ' + (e && e.message ? e.message : String(e)) };
  }
  return { ok: true };
`);

/** Lee la fila DESPUÉS de dejar correr lo asíncrono, con su submenú abierto. */
const LEER = new Function(`
  var R = { errores: window.__errores.slice() };
  R.submenus = document.querySelectorAll('#vista [data-submenu]').length;
  var filas = document.querySelectorAll('.settings-modo-emision');
  R.nFilas = filas.length;
  var fila = filas[0];
  if (fila) {
    var panel = fila.closest('[data-submenu]');
    R.submenu = panel ? panel.dataset.submenu : null;
    var tab = panel ? document.querySelector('button[data-submenu="' + panel.dataset.submenu + '"]') : null;
    if (tab) tab.click();
    var pill = fila.querySelector('.status-pill');
    var detalle = fila.querySelector('p');
    R.dataModo = fila.dataset.modo;
    R.titulo = pill ? pill.textContent : null;
    R.detalle = detalle ? detalle.textContent : null;
    if (detalle) {
      var caja = detalle.getBoundingClientRect();
      var cs = getComputedStyle(detalle);
      R.alto = Math.round(caja.height);
      R.visible = cs.display !== 'none' && cs.visibility !== 'hidden' && detalle.offsetParent !== null;
      R.detalleVisto = detalle.innerText;
    }
  }
  // Todo el texto del documento, oculto incluido: la frase de OTRO modo no puede estar en
  // ningún sitio, ni en un panel cerrado.
  R.todo = document.body.textContent;
  return R;
`);

const filas = [];
const { srv, servidos } = await arrancarServidor();
let navegador;
try {
  if (!ciegos.length) {
    navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
    for (const modo of CASOS) {
      const nombre = modo === null ? 'null (sin modo)' : modo;
      const pag = await navegador.newPage();
      const consola = [];
      pag.on('pageerror', (e) => consola.push('pageerror: ' + e.message));
      await pag.goto('http://127.0.0.1:' + PUERTO + '/__modo-en-ajustes.html', { waitUntil: 'load' });
      const r1 = await pag.evaluate(PINTAR, modo);
      if (r1.fatal) { ciegos.push(nombre + ': ' + r1.fatal); await pag.close(); continue; }
      // Lo asíncrono (comercio, Connect, referidos…) puede repintar paneles: se mide al final.
      await new Promise((ok) => setTimeout(ok, 900));
      const r = await pag.evaluate(LEER);
      await pag.close();

      // ── (b) SUELO · ¿se pintó Ajustes? ──────────────────────────────────────────────────────
      if (!r.submenus) { ciegos.push(nombre + ': Ajustes no pintó ningún submenú; no estoy leyendo la pantalla'); continue; }

      const fila = { nombre, modo, nFilas: r.nFilas, submenu: r.submenu, titulo: r.titulo, detalle: r.detalle,
        alto: r.alto, visible: r.visible, consola: consola.concat(r.errores || []) };
      filas.push(fila);

      // Ninguna frase de OTRO modo en todo el documento.
      for (const m of MODOS) {
        if (m === modo) continue;
        if (r.todo.includes(DETALLE[m])) {
          fallos.push('🔴 [' + nombre + '] sale la frase del modo «' + m + '»: ' + JSON.stringify(DETALLE[m])
            + '. A un comercio en «' + nombre + '» se le está contando el modo de otro.');
        }
      }

      if (modo === null) {
        if (r.nFilas !== 0) fallos.push('🔴 [null] se pinta una fila de modo sin saber el modo: es inventarse el estado fiscal de alguien.');
        continue;
      }

      if (r.nFilas !== 1) {
        fallos.push('🔴 [' + nombre + '] en «Configuración › Cumplimiento» hay ' + r.nFilas + ' filas de modo, y tiene que haber UNA.'
          + (r.nFilas === 0 ? ' El profesional no ve en qué modo está.' : ''));
        continue;
      }

      // ── (c) CALIBRACIÓN · el detector rechaza un prefijo y una superstring ────────────────
      // Se construyen desde el LITERAL del fuente, no desde lo pintado: si lo pintado ya fuera un
      // prefijo, «pintado + un carácter» volvería a ser el literal y la calibración se lo comería
      // (visto en la mutación M3 de `docs/master/evidencias/SCRUM-1257e/mutar.mjs`).
      const t = r.detalle || '';
      const L = DETALLE[modo];
      if (comparar(L.slice(0, -1), L).igual || comparar(L + '.', L).igual
        || modosQueCasan(DETALLE, L.slice(0, -1)).length || modosQueCasan(DETALLE, L + '.').length) {
        ciegos.push(nombre + ': la CALIBRACIÓN falló — el detector acepta un prefijo o una superstring de la frase. No compara literal.');
        continue;
      }

      // ── EL VEREDICTO ─────────────────────────────────────────────────────────────────────
      const cd = comparar(t, DETALLE[modo]);
      if (!cd.igual) {
        fallos.push('🔴 [' + nombre + '] la frase pintada NO es la del fuente (difiere en el carácter ' + cd.en + ').\n'
          + '       pintada: ' + cd.pintado + '\n       fuente:  ' + cd.esperado);
      }
      const casanD = modosQueCasan(DETALLE, t);
      if (casanD.length !== 1 || casanD[0] !== modo) {
        fallos.push('🔴 [' + nombre + '] la frase pintada casa con los modos ' + JSON.stringify(casanD) + ', y tiene que casar SOLO con «' + modo + '».');
      }
      const ct = comparar(r.titulo || '', TITULO[modo]);
      if (!ct.igual) {
        fallos.push('🔴 [' + nombre + '] el rótulo pintado NO es el del fuente (difiere en el carácter ' + ct.en + ').\n'
          + '       pintado: ' + ct.pintado + '\n       fuente:  ' + ct.esperado);
      }
      const casanT = modosQueCasan(TITULO, r.titulo || '');
      if (casanT.length !== 1 || casanT[0] !== modo) {
        fallos.push('🔴 [' + nombre + '] el rótulo pintado casa con los modos ' + JSON.stringify(casanT) + ', y tiene que casar SOLO con «' + modo + '».');
      }
      if (r.dataModo !== modo) fallos.push('🔴 [' + nombre + '] la fila lleva data-modo=' + JSON.stringify(r.dataModo) + '.');
      if (r.submenu !== 'cumplimiento') fallos.push('🔴 [' + nombre + '] la fila vive en el submenú ' + JSON.stringify(r.submenu) + ', no en «cumplimiento».');
      if (!r.visible || !(r.alto > 0)) {
        fallos.push('🔴 [' + nombre + '] la frase está en el árbol pero no en la pantalla (alto ' + r.alto + ' px, visible=' + r.visible + ') con su submenú abierto.');
      }
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

// ── (d) SUELO · ¿se sirvió lo del árbol? ─────────────────────────────────────────────────────
if (navegador) {
  for (const nec of [...JS, ...CSS]) {
    if (!servidos.includes(nec)) ciegos.push('no se llegó a servir ' + nec + ': la página medida no es la del árbol');
  }
}
if (!filas.length && !ciegos.length) ciegos.push('no se midió ni un solo caso');

// ── INFORME ──────────────────────────────────────────────────────────────────────────────────
console.log('\n  SCRUM-1257e · EL MODO DE EMISIÓN EN «Configuración › Cumplimiento», MEDIDO EN EL DOM RENDERIZADO');
console.log('  población: ' + CASOS.length + ' casos (' + CASOS.map(String).join(', ') + ') · medidos: ' + filas.length);
console.log('  ' + '─'.repeat(92));
for (const f of filas) {
  const ok = f.modo === null ? f.nFilas === 0 : (f.detalle === DETALLE[f.modo] && f.titulo === TITULO[f.modo]);
  console.log('  ' + (ok ? '✔' : '✘') + ' ' + f.nombre.padEnd(16) + ' filas=' + f.nFilas
    + (f.modo === null ? '' : '  submenú=' + f.submenu + '  alto=' + f.alto + 'px'));
  if (f.titulo != null) console.log('      rótulo: ' + JSON.stringify(f.titulo));
  if (f.detalle != null) console.log('      frase:  ' + JSON.stringify(f.detalle));
  for (const c of f.consola) console.log('      ⚠ ' + c);
}
console.log('  ' + '─'.repeat(92));
if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MIRAR — y esto NO es «la frase sale bien»:\n');
  for (const c of ciegos) console.error('   · ' + c);
}
if (fallos.length) {
  console.error('\n  🔴 ' + fallos.length + ' FALLO(S):\n');
  for (const f of fallos) console.error('   ' + f + '\n');
}
const veredictoFinal = veredictoDe({ hallazgos: fallos, ciegos });
if (veredictoFinal.codigo !== 0) {
  console.error('  ' + veredictoFinal.linea + '\n');
  process.exit(veredictoFinal.codigo);
}
console.log('  ' + veredictoFinal.linea);
console.log('\n  ✔ cada modo pinta SU rótulo y SU frase, literales, y ninguno pinta la de otro.\n');

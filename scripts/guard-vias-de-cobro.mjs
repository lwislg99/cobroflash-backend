// scripts/guard-vias-de-cobro.mjs — SCRUM-519 · LAS DOS PANTALLAS, MEDIDAS A LA VEZ Y EN EL DOM.
//
// Uso:  npm run guard:vias-de-cobro
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// En la MISMA pantalla renderizada conviven dos afirmaciones sobre si este profesional puede
// cobrar, y hasta el 19-ago-2026 no miraban los mismos campos:
//
//   · la tarjeta «Tu cuenta, lista para cobrar», fila «Cobro por transferencia o Bizum»
//   · el aviso «te falta el móvil» del campo «Móvil de Bizum», dos pantallas más abajo
//
// El merchant con SOLO `whatsappPhone` recibía las dos a la vez: el aviso callado —porque su
// cliente sí ve el botón de Bizum— y la fila en gris diciéndole que no puede cobrar. Este guard
// no comprueba «que la tarjeta diga ✅»: comprueba que **las dos digan lo mismo sobre Bizum**.
//
// ── 🔴 POR QUÉ EN NAVEGADOR Y NO CON `assert.match` SOBRE EL FUENTE ──────────────────────────
// Porque ese instrumento ya falló aquí. SCRUM-515 lo dejó medido: con el aviso pintado y barrido
// por un `innerHTML` posterior —el fallo real del 13-ago-2026— los SIETE casos de
// `tests/scrum328-aviso-bizum-sin-telefono.test.mjs` siguieron en verde. Un test que lee el
// fichero contesta «¿está escrito?»; la pregunta es «¿está en la pantalla?». Siete verdes sobre
// el fuente no valen uno sobre el DOM.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// Misma decisión que `guard:contraste` (SCRUM-368), `guard:caja-avisos` (SCRUM-469) y
// `guard:aviso-bizum` (SCRUM-515): la suite no arranca un navegador. Lo que SÍ corre siempre es
// `tests/scrum519-un-solo-criterio-de-cobro.test.mjs`, que vigila que el criterio no vuelva a
// duplicarse — otra pregunta, y por eso otro fichero.
//
// ── ⚠️ EL SUELO ──────────────────────────────────────────────────────────────────────────────
// Si no encuentra la fila de la tarjeta o la ranura del aviso, NO dice «coherentes»: dice que NO
// SUPO MIRAR y sale con 1. Dos pantallas que no se han encontrado nunca se contradicen, y ése
// sería el verde más caro de este ticket.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { viasDeCobro } from '../dist/modules/billing/domain/viasDeCobro.js';
import { decidirAvisoBizum } from '../dist/modules/billing/domain/avisoBizumSinTelefono.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = Number(process.env.VIAS_PUERTO || 4403);

/** La etiqueta de la fila que se mide. Es microcopy aprobada y NO se toca: se busca por ella, y
 *  si cambia el guard se declara ciego en vez de dar por buena una fila que no ha encontrado. */
const ETIQUETA_FILA = 'Cobro por transferencia o Bizum';

const JS = [
  '/dashboard/js/settingsSubmenus.js',
  '/dashboard/js/puertaSerie.js',
  '/dashboard/js/settingsView.js',
];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];

// ── LOS OCHO CASOS ───────────────────────────────────────────────────────────────────────────
// Las TRES fuentes por separado y todas sus combinaciones: `iban`, `bizumPhone`, `whatsappPhone`.
// Sin los positivos, «ya no miente» y «ya no dice ✅ nunca» darían el mismo verde — por eso están
// enumerados uno a uno y cada fila declara qué se espera de ella.
// Teléfonos en el RANGO IMPOSIBLE (34 + 0 + 8 dígitos, SCRUM-262): nada que se pueda marcar.
const IBAN = 'ES9121000418450200051332';
const CASOS = [];
for (const iban of [null, IBAN]) {
  for (const bizumPhone of [null, '+34000000002']) {
    for (const whatsappPhone of [null, '+34000000001']) {
      CASOS.push({
        via: `${iban ? 'IBAN' : '—   '} · ${bizumPhone ? 'bizumPhone' : '—         '} · ${whatsappPhone ? 'whatsappPhone' : '—            '}`,
        iban, bizumPhone, whatsappPhone,
      });
    }
  }
}

const leer = (rel) => fs.readFileSync(path.join(PUBLIC, rel.replace(/^\//, '')), 'utf8');

function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n'
    + '<script>\n'
    + '  window.__merchant = {};\n'
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
  const srv = http.createServer((req, res) => {
    const ruta = req.url.split('?')[0];
    if (ruta === '/medicion.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(paginaHtml());
    }
    try {
      const cuerpo = leer(ruta);
      const tipo = ruta.endsWith('.css') ? 'text/css' : ruta.endsWith('.js') ? 'text/javascript' : 'text/plain';
      res.writeHead(200, { 'content-type': tipo + '; charset=utf-8' });
      res.end(cuerpo);
    } catch { res.writeHead(404); res.end(''); }
  });
  return new Promise((ok) => srv.listen(PUERTO, () => ok(srv)));
}

/**
 * EL DETECTOR, en texto y uno solo para las dos pantallas. Lee del DOM VIVO:
 *   · la fila de la tarjeta: ¿está en verde? (su marca es «✓»; lo demás es pendiente)
 *   · el aviso: ¿está pintado?
 * Si cualquiera de las dos ranuras no aparece, se declara CIEGO en vez de contestar.
 */
const DETECTOR = `
  function detectar(etiqueta) {
    var caja = document.getElementById('readiness-rows');
    if (!caja) return { ciego: true, motivo: 'no existe #readiness-rows: la tarjeta de readiness no se ha pintado' };
    var fila = null;
    var botones = caja.querySelectorAll('button');
    for (var i = 0; i < botones.length; i++) {
      if ((botones[i].textContent || '').indexOf(etiqueta) !== -1) { fila = botones[i]; break; }
    }
    if (!fila) return { ciego: true, motivo: 'no hay ninguna fila con la etiqueta «' + etiqueta + '» en la tarjeta' };
    var campo = document.querySelector('input[name="bizumPhone"]');
    if (!campo) return { ciego: true, motivo: 'no existe input[name=bizumPhone]: falta la ranura del aviso' };
    var marca = fila.querySelector('span');
    var aviso = document.querySelector('.aviso-bizum-sin-telefono');
    return {
      ciego: false,
      filaOk: (marca && (marca.textContent || '').trim() === '\\u2713'),
      filaTexto: (fila.textContent || '').replace(/\\s+/g, ' ').trim(),
      avisoPresente: !!aviso
    };
  }
`;

const MEDIR = new Function('merchant', 'veredictoAviso', 'etiqueta', DETECTOR + `
  window.__merchant = merchant;
  window.appBizumSinTelefono = veredictoAviso;
  try {
    renderSettingsView(document.getElementById('vista'));
  } catch (e) {
    return { fatal: 'renderSettingsView lanzo: ' + (e && e.message ? e.message : String(e)) };
  }
  return { t1: detectar(etiqueta) };
`);

const MEDIR_FINAL = new Function('etiqueta', DETECTOR + `
  var R = { errores: window.__errores.slice() };
  // Se abre el submenu del campo antes de mirar: los paneles nacen con display:none salvo el
  // activo, y medir sin abrirlo daria «no se ve» por un motivo que no es el que se investiga.
  var campo = document.querySelector('input[name="bizumPhone"]');
  if (campo) {
    var panel = campo.closest('[data-submenu]');
    if (panel) {
      var tab = document.querySelector('button[data-submenu="' + panel.dataset.submenu + '"]');
      if (tab) tab.click();
    }
  }
  R.t2 = detectar(etiqueta);
  if (R.t2.ciego) return R;

  // ── CALIBRACION, EN LAS DOS DIRECCIONES Y EN LOS OCHO CASOS ────────────────────────────
  // Si solo se calibrara donde hay aviso, los casos «sin aviso» pasarian gratis con un detector
  // averiado que siempre contesta «ausente» — y ese verde diria «coherentes» sin haber mirado.
  var aviso = document.querySelector('.aviso-bizum-sin-telefono');
  if (aviso) {
    var padre = aviso.parentNode;
    padre.removeChild(aviso);
    R.calAvisoSabeDecirNo = (detectar(etiqueta).avisoPresente === false);
    padre.appendChild(aviso);
  } else if (campo) {
    var ranura = campo.closest('.field');
    var senuelo = document.createElement('p');
    senuelo.className = 'aviso-bizum-sin-telefono';
    senuelo.textContent = 'SENUELO';
    ranura.appendChild(senuelo);
    R.calAvisoSabeDecirSi = (detectar(etiqueta).avisoPresente === true);
    ranura.removeChild(senuelo);
  }
  // Y el detector de la FILA: se le cambia la marca y tiene que cambiar de opinion.
  var caja = document.getElementById('readiness-rows');
  var botones = caja.querySelectorAll('button');
  for (var i = 0; i < botones.length; i++) {
    if ((botones[i].textContent || '').indexOf(etiqueta) !== -1) {
      var marca = botones[i].querySelector('span');
      var antes = marca.textContent;
      marca.textContent = (antes.trim() === '\\u2713') ? '\\u00b7' : '\\u2713';
      R.calFilaCambia = (detectar(etiqueta).filaOk !== R.t2.filaOk);
      marca.textContent = antes;
      break;
    }
  }
  return R;
`);

// ── EJECUCIÓN ────────────────────────────────────────────────────────────────────────────────
const fallos = [];
const ciegos = [];
const filas = [];

const srv = await arrancarServidor();
let navegador;
try {
  navegador = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  for (const caso of CASOS) {
    // Los DOS veredictos salen de las funciones REALES del dominio, no de una expectativa escrita
    // a mano: el guard mide qué contesta el código de hoy.
    const vias = viasDeCobro({
      iban: caso.iban,
      bizumPhone: caso.bizumPhone,
      whatsappPhone: caso.whatsappPhone,
      connectStatus: 'none',
      flagBizum: true, // BIZUM_MANUAL_ENABLED, encendido en producción desde el 13-ago-2026
    });
    const veredictoAviso = decidirAvisoBizum({
      flagBizum: true, bizumPhone: caso.bizumPhone, whatsappPhone: caso.whatsappPhone,
    });

    const merchant = {
      id: 1, name: 'QA vías', slug: null, country: 'ES',
      iban: caso.iban, bizumPhone: caso.bizumPhone, whatsappPhone: caso.whatsappPhone,
      connectStatus: 'none', legalName: null, taxId: null, address: null,
      viasDeCobro: vias,
    };

    const pag = await navegador.newPage();
    await pag.goto(`http://127.0.0.1:${PUERTO}/medicion.html`, { waitUntil: 'load' });
    const r1 = await pag.evaluate(MEDIR, merchant, veredictoAviso, ETIQUETA_FILA);
    if (r1.fatal) { ciegos.push(`${caso.via} → ${r1.fatal}`); await pag.close(); continue; }
    // Se deja correr TODO el render asíncrono: la tarjeta de readiness es `async` y llega tarde.
    await new Promise((ok) => setTimeout(ok, 600));
    const r2 = await pag.evaluate(MEDIR_FINAL, ETIQUETA_FILA);
    await pag.close();

    if (r2.t2.ciego) { ciegos.push(`${caso.via} → ${r2.t2.motivo}`); continue; }
    if (r2.calAvisoSabeDecirNo === false || r2.calAvisoSabeDecirSi === false || r2.calFilaCambia === false) {
      ciegos.push(`${caso.via} → el detector NO se calibra (aviso:${r2.calAvisoSabeDecirNo ?? r2.calAvisoSabeDecirSi} fila:${r2.calFilaCambia})`);
      continue;
    }

    // 🔴 LA COHERENCIA, que es lo único que este guard afirma.
    //
    // El aviso ausente significa «este merchant SÍ puede cobrar por Bizum» — lo dice el dominio y
    // lo ve el cliente. Entonces la fila, cuya etiqueta declara «transferencia o Bizum», tiene que
    // estar en verde si hay IBAN o si hay Bizum. Ni se decide aquí qué es «listo para cobrar», ni
    // se exige que la fila diga ✅: se exige que las dos pantallas no se contradigan.
    const bizumSegunElAviso = !r2.t2.avisoPresente;
    const filaEsperada = !!caso.iban || bizumSegunElAviso;
    const coherente = r2.t2.filaOk === filaEsperada;
    if (!coherente) {
      fallos.push({ caso, fila: r2.t2.filaOk, aviso: r2.t2.avisoPresente, esperada: filaEsperada, texto: r2.t2.filaTexto });
    }
    filas.push({ caso, r2, vias, veredictoAviso, coherente, filaEsperada });
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

// ── INFORME ──────────────────────────────────────────────────────────────────────────────────
console.log('');
console.log('  SCRUM-519 · LAS DOS PANTALLAS, MEDIDAS EN EL DOM RENDERIZADO');
console.log('  ' + '─'.repeat(108));
for (const f of filas) {
  const marca = f.coherente ? '✔' : '🔴';
  console.log(`  ${marca} ${f.caso.via}   tarjeta:${f.r2.t2.filaOk ? '✅ verde ' : '· pendiente'}`
    + `  aviso:${f.r2.t2.avisoPresente ? 'SÍ' : 'no'}  (bizum=${String(f.vias.bizum)}, aviso=${f.veredictoAviso})`);
}
console.log('  ' + '─'.repeat(108));

if (ciegos.length) {
  console.error('\n  🔴 EL ESCÁNER NO SUPO MIRAR — esto NO es «las pantallas son coherentes»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  console.error('\n  Sin haber encontrado las dos pantallas no se puede afirmar que digan lo mismo.');
  process.exit(1);
}

if (fallos.length) {
  console.error(`\n  🔴 ${fallos.length} DE ${CASOS.length} CASOS: LAS DOS PANTALLAS SE CONTRADICEN.\n`);
  for (const f of fallos) {
    console.error(`     [${f.caso.via}]`);
    console.error(`       · la TARJETA de Configuración («${ETIQUETA_FILA}») dice: `
      + `${f.fila ? '✅ puede cobrar' : '· le falta algo'}`);
    console.error(`       · el AVISO del campo «Móvil de Bizum» dice: `
      + `${f.aviso ? 'le falta el móvil, NO puede cobrar por Bizum' : 'tiene móvil, SÍ puede cobrar por Bizum'}`);
    console.error(`       · el campo que las separa: \`whatsappPhone\` = ${f.caso.whatsappPhone || 'sin poner'}`);
    console.error(`         (\`iban\`=${f.caso.iban ? 'puesto' : 'sin poner'}, \`bizumPhone\`=${f.caso.bizumPhone || 'sin poner'})`);
    console.error(`       · la fila pinta: «${f.texto}»\n`);
  }
  console.error('  El profesional ve las dos cosas en la MISMA pantalla, y la que mira primero es la');
  console.error('  que resume. El criterio vive en `src/modules/billing/domain/viasDeCobro.ts` y lo');
  console.error('  sirve `GET /admin/merchant`: si estas dos discrepan, o una pantalla ha dejado de');
  console.error('  consumir ese veredicto y ha vuelto a calcularlo, o el dominio y el aviso ya no');
  console.error('  usan el mismo criterio de teléfono.');
  process.exit(1);
}

console.log(`\n  ✔ los ${CASOS.length} casos: la tarjeta y el aviso dicen LO MISMO sobre si puede cobrar por Bizum.`);
console.log('    Medido en el DOM vivo al final del render, con el detector calibrado en cada caso.\n');

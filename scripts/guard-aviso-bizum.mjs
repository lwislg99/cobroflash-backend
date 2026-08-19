// scripts/guard-aviso-bizum.mjs — SCRUM-515 · EL CONTROL NEGATIVO DEL AVISO DE BIZUM, EN NAVEGADOR.
//
// Uso:  npm run guard:aviso-bizum
//
// ── QUÉ SE MIDE, Y POR QUÉ NO BASTA LO QUE YA HABÍA ──────────────────────────────────────────
// `tests/scrum328-aviso-bizum-sin-telefono.test.mjs` ya cubre la DECISIÓN (`decidirAvisoBizum`) y
// además comprueba que el aviso «está» en la vista — pero lo comprueba con `assert.match` SOBRE EL
// TEXTO DEL FICHERO. Ese test da verde con el aviso pintado y BORRADO cuatro líneas después.
//
// No es una hipótesis: pasó en esta casa el 13-ago-2026. Un aviso de otra pantalla se pintaba con
// `appendChild` y lo barría un `innerHTML` posterior; el test seguía verde porque el texto SÍ
// estaba en el fuente. Verificar que el FICHERO cambió no es verificar que el COMPORTAMIENTO
// cambió. Por eso aquí el árbitro es el DOM VIVO al FINAL del render, y no `fs.readFileSync`.
//
// ── POR QUÉ IMPORTA HOY, Y NO «algún día» ────────────────────────────────────────────────────
// `BIZUM_MANUAL_ENABLED` está ENCENDIDO en producción desde el 13-ago-2026. Censo de ese día sobre
// los 13 merchants reales: 2 con `bizumPhone`, 6 con `whatsappPhone`, y SIETE SIN NINGUNO DE LOS
// DOS. Siete profesionales pueden llegar hoy a la pantalla de cobro sin teléfono donde recibirlo.
// El aviso se construyó para ellos y NUNCA SE HA VISTO FUNCIONAR: el control negativo a mano se
// pidió cinco veces y no se hizo. Esto lo convierte en una comprobación que no depende de que
// nadie se acuerde.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// Misma decisión que `guard:contraste` (SCRUM-368) y `guard:caja-avisos` (SCRUM-469), y no es una
// excepción nueva: la suite no arranca un navegador. La red que SÍ corre siempre es
// `tests/scrum515-aviso-bizum-render.test.mjs`, que vigila el mecanismo y el cableado.
//
// ── ⚠️ QUE LA PANTALLA MEDIDA SEA LA QUE CREO ────────────────────────────────────────────────
// Una medición en navegador no es fiable POR SER en navegador. El servidor lee del disco en cada
// petición, y antes de dar ningún veredicto se comprueba (a) que la ranura del aviso EXISTE —el
// campo «Móvil de Bizum»—, (b) que el render no lanzó, y (c) que el detector SABE DECIR QUE NO:
// se le quita el nodo del DOM vivo y tiene que pasar a «ausente». Si algo de eso falla, el guard
// NO da un cero: dice que NO SUPO MIRAR. Un cero aquí se leería como «ningún merchant
// desprotegido», que es la mentira más cara posible en este ticket.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { decidirAvisoBizum } from '../dist/modules/billing/domain/avisoBizumSinTelefono.js';

/**
 * ¿Se espera aviso para este veredicto? Es `hayQueAvisar` del dominio, y NO se importa a propósito:
 * `scripts/` declarado en `package.json` ES una entrada viva para los censos de alcance, así que
 * importarlo aquí lo saca de la lista de huérfanos declarados y abre una discrepancia entre los dos
 * instrumentos de SCRUM-411/493 que su comparador no sabe clasificar. Arreglar ESE comparador es su
 * ticket, no éste (regla 9: se le llama, no se le cambia).
 *
 * La copia está ACOTADA Y VIGILADA: `tests/scrum515-aviso-bizum-render.test.mjs` la pincha contra
 * `hayQueAvisar` para los tres estados y para cualquiera que se añada. Si el dominio cambia la
 * regla, ese test cae NOMBRANDO este fichero — no se entera nadie por un verde hueco.
 */
const seEsperaAviso = (veredicto) => veredicto !== 'no_aplica';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = Number(process.env.BIZUM_PUERTO || 4402);

/** Lo que la pantalla necesita del árbol, en el orden en que lo carga `index.html`. */
const JS = [
  '/dashboard/js/settingsSubmenus.js',
  '/dashboard/js/puertaSerie.js',
  '/dashboard/js/settingsView.js',
];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];

// ── LOS CUATRO CASOS ─────────────────────────────────────────────────────────────────────────
// Las dos vías POR SEPARADO. `bizumPhone` y `whatsappPhone` son DOS fuentes, y probar solo el
// bloqueo no demuestra que no lo hayas bloqueado todo: sin el positivo, «avisa cuando falta» y
// «avisa siempre» dan el mismo verde.
//
// ⚠️ LA FILA 2 NO LA DECIDE ESTE GUARD. `esperado` se calcula con la MISMA función que usa
// `/admin/me` (`app.ts:406`), no con una expectativa escrita a mano: el guard MIDE qué contesta el
// código de hoy y lo reporta. Si esa respuesta no es la que el fundador quiere, es otro ticket.
//
// ⚠️ Teléfonos en el RANGO IMPOSIBLE (34 + 0 + 8 dígitos, SCRUM-262): un `+34 6XX` es un móvil
// español ordinario y hay tres crons que mandan WhatsApp a teléfonos guardados.
const CASOS = [
  { via: 'sin bizumPhone · sin whatsappPhone', bizumPhone: null, whatsappPhone: null },
  { via: 'sin bizumPhone · con whatsappPhone', bizumPhone: null, whatsappPhone: '+34000000001' },
  { via: 'con bizumPhone · sin whatsappPhone', bizumPhone: '+34000000002', whatsappPhone: null },
  { via: 'con bizumPhone · con whatsappPhone', bizumPhone: '+34000000002', whatsappPhone: '+34000000001' },
];

const leer = (rel) => fs.readFileSync(path.join(PUBLIC, rel.replace(/^\//, '')), 'utf8');

/** La página de medición. Se construye aquí, pero el JS y el CSS salen DEL DISCO en cada petición. */
function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n'
    + '<script>\n'
    // Stubs MÍNIMOS: solo lo que la pantalla pide de fuera. No se reimplementa NADA de la vista.
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
  const servidos = [];
  const srv = http.createServer((req, res) => {
    const ruta = req.url.split('?')[0];
    if (ruta === '/medicion.html') {
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
  return new Promise((ok) => srv.listen(PUERTO, () => ok({ srv, servidos })));
}

/**
 * EL DETECTOR, en texto. Se inyecta en las dos mediciones para que sean EXACTAMENTE el mismo
 * instrumento: dos copias que puedan divergir es cómo T1 y T2 acaban midiendo cosas distintas y
 * nadie lo nota.
 */
const DETECTOR = `
  function detectar() {
    var campo = document.querySelector('input[name="bizumPhone"]');
    if (!campo) return { ciego: true, motivo: 'no existe input[name=bizumPhone] en el DOM renderizado' };
    var ranura = campo.closest('.field');
    if (!ranura) return { ciego: true, motivo: 'el campo bizumPhone no cuelga de ningun .field' };
    var aviso = document.querySelector('.aviso-bizum-sin-telefono');
    if (!aviso) return { ciego: false, presente: false };
    return {
      ciego: false, presente: true,
      dentroDelCampo: ranura.contains(aviso),
      texto: (aviso.textContent || '').trim(),
      rol: aviso.getAttribute('role'),
      enElDocumento: document.contains(aviso)
    };
  }
`;

/** Se ejecuta DENTRO del navegador: pinta y mide el instante T1 (vuelta del render síncrono). */
const MEDIR_RENDER = new Function('merchant', 'veredicto', DETECTOR + `
  window.__merchant = merchant;
  window.appBizumSinTelefono = veredicto;
  try {
    renderSettingsView(document.getElementById('vista'));
  } catch (e) {
    return { fatal: 'renderSettingsView lanzo: ' + (e && e.message ? e.message : String(e)) };
  }
  return { t1: detectar() };
`);

/** Segunda mitad: se llama DESPUÉS de dejar correr las tarjetas asíncronas. */
const MEDIR_FINAL = new Function(DETECTOR + `
  var R = { errores: window.__errores.slice() };

  // T2 — EL FINAL DEL RENDER. Es el instante que importa: el aviso del 13-ago existia en T1 y ya
  // no en T2. Antes de mirar se ABRE el submenu donde vive el campo, porque los diez paneles se
  // pintan con display:none salvo el activo: medir geometria sin abrirlo daria 0 px de altura y
  // «no se ve» por un motivo que no es el que se investiga.
  var campo = document.querySelector('input[name="bizumPhone"]');
  if (campo) {
    var panel = campo.closest('[data-submenu]');
    if (panel) {
      R.submenu = panel.dataset.submenu;
      R.submenuPorDefecto = panel.style.display !== 'none';
      var tab = document.querySelector('button[data-submenu="' + panel.dataset.submenu + '"]');
      if (tab) tab.click();
    }
  }
  R.t2 = detectar();

  // ── CALIBRACION · EL DETECTOR TIENE QUE SABER DECIR LAS DOS COSAS ──────────────────────
  // Corre en LOS CUATRO CASOS, y no solo cuando hay aviso. Si solo se calibrara el caso que
  // avisa, los tres «sin aviso» pasarian gratis con un detector averiado que siempre contesta
  // «ausente» — y ese verde diria «no se avisa a quien no toca» sin haber mirado nada. Las dos
  // direcciones, siempre:
  //   · con aviso  -> se QUITA del DOM vivo: tiene que pasar a «ausente», y volver al restaurarlo.
  //   · sin aviso  -> se INYECTA uno sintetico: tiene que pasar a «presente», y volver al quitarlo.
  // Esto es lo que separa este guard del test que lee el fichero: mide el DOM, y lo demuestra.
  if (R.t2.presente) {
    var aviso = document.querySelector('.aviso-bizum-sin-telefono');
    var caja = aviso.getBoundingClientRect();
    var cs = getComputedStyle(aviso);
    R.geometria = {
      alto: Math.round(caja.height), ancho: Math.round(caja.width),
      display: cs.display, visibility: cs.visibility,
      colgadoDeAlgoOculto: aviso.offsetParent === null
    };
    var padre = aviso.parentNode;
    padre.removeChild(aviso);
    R.calSabeDecirNo = (detectar().presente === false);
    padre.appendChild(aviso);
    R.calVuelve = (detectar().presente === true);
  } else if (campo) {
    var ranura = campo.closest('.field');
    var senuelo = document.createElement('p');
    senuelo.className = 'aviso-bizum-sin-telefono';
    senuelo.textContent = 'SEÑUELO DE CALIBRACION';
    ranura.appendChild(senuelo);
    R.calSabeDecirSi = (detectar().presente === true);
    ranura.removeChild(senuelo);
    R.calVuelve = (detectar().presente === false);
  }
  return R;
`);

// ── EJECUCIÓN ────────────────────────────────────────────────────────────────────────────────
const fallos = [];
const ciegos = [];
const filas = [];

const { srv, servidos } = await arrancarServidor();
let navegador;
try {
  navegador = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  for (const caso of CASOS) {
    // El veredicto lo da la MISMA función que `/admin/me`. El guard no reimplementa la regla.
    const veredicto = decidirAvisoBizum({
      flagBizum: true, // BIZUM_MANUAL_ENABLED, encendido en producción desde el 13-ago-2026
      bizumPhone: caso.bizumPhone,
      whatsappPhone: caso.whatsappPhone,
    });
    const esperaAviso = seEsperaAviso(veredicto);

    const pag = await navegador.newPage();
    const consola = [];
    pag.on('pageerror', (e) => consola.push('pageerror: ' + e.message));
    await pag.goto('http://127.0.0.1:' + PUERTO + '/medicion.html', { waitUntil: 'load' });

    const merchant = {
      slug: 'medicion', name: 'Medición', legalName: 'Medición SL', taxId: 'B00000000',
      address: 'C/ Medición 1', iban: '', clabe: '', country: 'ES', defaultCurrency: 'EUR',
      bizumPhone: caso.bizumPhone, whatsappPhone: caso.whatsappPhone, connectStatus: 'none',
    };

    const r1 = await pag.evaluate(MEDIR_RENDER, merchant, veredicto);
    if (r1.fatal) {
      ciegos.push(caso.via + ': ' + r1.fatal);
      await pag.close();
      continue;
    }
    // Se deja correr TODO lo asíncrono: `loadMerchant`, la tarjeta de Connect, la de readiness,
    // la de referidos y el perfil público. Ahí es donde vivía el `innerHTML` que borró el aviso
    // del 13-ago, así que medir antes de esto sería medir el instante equivocado.
    await new Promise((ok) => setTimeout(ok, 900));
    const r2 = await pag.evaluate(MEDIR_FINAL);
    await pag.close();

    const t1 = r1.t1, t2 = r2.t2;

    // ── SUELO 1 · ¿existe la ranura? ────────────────────────────────────────────────────────
    if (t1.ciego || t2.ciego) {
      ciegos.push(caso.via + ': ' + (t2.ciego ? t2.motivo : t1.motivo));
      continue;
    }
    // ── SUELO 2 · ¿el detector sabe decir las DOS cosas? ────────────────────────────────────
    // Un detector que solo sabe decir «sí» —o solo «no»— da un verde que no significa nada.
    const calOk = t2.presente
      ? (r2.calSabeDecirNo === true && r2.calVuelve === true)
      : (r2.calSabeDecirSi === true && r2.calVuelve === true);
    if (!calOk) {
      ciegos.push(caso.via + ': la CALIBRACIÓN falló — el detector no supo cambiar de respuesta al '
        + (t2.presente ? 'QUITAR el aviso del DOM vivo' : 'INYECTAR un aviso señuelo en el campo')
        + '. No está leyendo la pantalla, así que su veredicto no vale.');
      continue;
    }

    filas.push({ via: caso.via, veredicto, esperaAviso, t1: t1.presente, t2: t2.presente,
      submenu: r2.submenu, submenuPorDefecto: r2.submenuPorDefecto, geometria: r2.geometria,
      texto: t2.texto, consola });

    // ── EL VEREDICTO ────────────────────────────────────────────────────────────────────────
    if (esperaAviso && !t1.presente) {
      fallos.push('🔴 [' + caso.via + '] EL AVISO NO SE PINTA en «Configuración › Cobro», campo '
        + '«Móvil de Bizum». El servidor dictó «' + veredicto + '» y la pantalla no pintó nada.\n'
        + '     Con BIZUM_MANUAL_ENABLED encendido, SIETE de los 13 merchants reales están en este '
        + 'caso: encienden Bizum, su cliente no ve la opción, y nadie les dice que falta un móvil.');
    } else if (esperaAviso && t1.presente && !t2.presente) {
      fallos.push('🔴 [' + caso.via + '] EL AVISO SE PINTA Y SE BORRA. Estaba en el DOM al volver '
        + 'del render síncrono y YA NO ESTÁ al final. Es EXACTAMENTE el fallo del 13-ago-2026: un '
        + '`appendChild` barrido por un `innerHTML` posterior, con el test de fuente en verde.\n'
        + '     Pantalla: «Configuración › Cobro» (submenú «' + r2.submenu + '»), campo «Móvil de Bizum».');
    } else if (!esperaAviso && t2.presente) {
      fallos.push('🔴 [' + caso.via + '] SE AVISA A UN MERCHANT QUE ESTÁ BIEN. El servidor dictó '
        + '«' + veredicto + '» (no hay que avisar) y la pantalla pintó el aviso igualmente.\n'
        + '     Un aviso que sale cuando no toca se aprende a ignorar, y entonces deja de proteger '
        + 'al que sí lo necesita — los siete sin ningún teléfono.');
    } else if (esperaAviso && t2.presente && !t2.dentroDelCampo) {
      fallos.push('🔴 [' + caso.via + '] el aviso se pinta LEJOS del campo «Móvil de Bizum»: si no '
        + 'cuelga del campo que lo arregla, deja de decir QUÉ hay que arreglar.');
    } else if (esperaAviso && t2.presente && r2.geometria && r2.geometria.alto === 0) {
      fallos.push('🔴 [' + caso.via + '] el aviso está en el DOM pero mide 0 px de alto: está en el '
        + 'árbol y no en la pantalla. «Existe» y «se ve» no son la misma cosa.');
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

// ── SUELO 3 · ¿se sirvió lo del árbol? ─────────────────────────────────────────────────────
for (const nec of [...JS, ...CSS]) {
  if (!servidos.includes(nec)) ciegos.push('no se llegó a servir ' + nec + ': la página medida no es la del árbol');
}
if (!filas.length && !ciegos.length) ciegos.push('no se midió ni un solo caso');

// ── INFORME ────────────────────────────────────────────────────────────────────────────────
console.log('\n  SCRUM-515 · EL AVISO DE BIZUM, MEDIDO EN EL DOM RENDERIZADO');
console.log('  ' + '─'.repeat(92));
for (const f of filas) {
  const g = f.geometria;
  console.log('  ' + (f.t2 === f.esperaAviso ? '✔' : '✘') + ' ' + f.via.padEnd(38)
    + ' veredicto=' + String(f.veredicto).padEnd(15)
    + ' aviso: render=' + (f.t1 ? 'SÍ' : 'no') + ' final=' + (f.t2 ? 'SÍ' : 'no')
    + (g ? '  (' + g.alto + 'px, submenú «' + f.submenu + '»)' : ''));
  if (f.texto) console.log('      texto: ' + f.texto);
  for (const c of (f.consola || [])) console.log('      ⚠ ' + c);
}
console.log('  ' + '─'.repeat(92));

if (ciegos.length) {
  console.error('\n  🔴 EL ESCÁNER NO SUPO MIRAR — y esto NO es «ningún merchant desprotegido»:\n');
  for (const c of ciegos) console.error('   · ' + c);
  console.error('\n  Un cero aquí se leería como que no hay nadie en riesgo. Son siete.\n');
  process.exit(1);
}
if (fallos.length) {
  console.error('\n  🔴 ' + fallos.length + ' FALLO(S):\n');
  for (const f of fallos) console.error('   ' + f + '\n');
  process.exit(1);
}
console.log('\n  ✔ los cuatro casos se comportan como dicta el servidor, medido en el DOM vivo.\n');

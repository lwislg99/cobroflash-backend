// scripts/guard-guardar-sin-callar.mjs — SCRUM-894 · «GUARDAR CAMBIOS» NO PUEDE VOLVER A CALLARSE.
//
// Uso:  npm run guard:guardar-sin-callar
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ SE MIDE
//
// En `Configuración`, el formulario de los diez paneles tiene UN solo «Guardar cambios». Este
// guard pulsa ese botón desde LAS NUEVE PESTAÑAS, con dos perfiles de merchant, y exige que en
// los 18 casos pase UNA de estas dos cosas — nunca ninguna:
//
//   · o GUARDA,
//   · o DICE QUÉ FALTA Y DÓNDE: aviso visible que nombra el campo y su pestaña, y el cursor
//     puesto en ese campo, con su pestaña abierta.
//
// ── EL DEFECTO QUE CIERRA, MEDIDO EL 17-SEP-2026 ─────────────────────────────────────────────
// Con el NIF vacío y la pestaña «Cobros» delante, el botón no guardaba y no decía nada. Sobre
// los mismos 18 casos de este guard, antes del arreglo:
//
//     perfil SIN NIF   →  0 de 9 guardaban   ·   8 de 9 MUDOS (ni aviso, ni foco, ni nada)
//     perfil COMPLETO  →  9 de 9 guardaban
//
// El noveno del primer grupo no era mérito de la pantalla: estando en «Empresa», el campo está a
// la vista y quien avisa es el globo del navegador.
//
// 🔴 Y LA CAUSA NO ERA NINGUNA DE LAS DOS QUE PARECÍAN. Ni el servidor callaba ni la pantalla
// dejaba de pintar lo que el servidor decía: **el `submit` no llegaba a dispararse**. Lo abortaba
// la validación interactiva del navegador, porque `taxId` es `required` y vive en un panel con
// `display:none`. El navegador lo dice —a la consola— y el profesional ve un botón inerte:
//
//     «An invalid form control with name='taxId' is not focusable.»
//
// ── POR QUÉ EN NAVEGADOR Y NO EN LA TANDA ────────────────────────────────────────────────────
// Porque lo que falla aquí es EL NAVEGADOR, no nuestro código: la validación interactiva y el
// `display:none` son suyos. Un test que lea el fichero vería el aviso escrito —de hecho estaba
// escrito, y era código muerto dentro de un `submit` que no ocurría— y daría verde. Misma
// decisión que `guard:aviso-bizum` (SCRUM-515) y `guard:contraste` (SCRUM-368). La red que SÍ
// corre siempre es `tests/scrum894-el-boton-que-no-callaba.test.mjs`.
//
// ── LOS SUELOS, QUE ES LO QUE LO SEPARA DE UN COMENTARIO ─────────────────────────────────────
//   ① Si una vista no se puede pintar, es CIEGO y FALLA. «No he podido mirar» no es «está bien».
//   ② CALIBRACIÓN EN CADA CASO: el detector del aviso tiene que saber decir las DOS cosas —se le
//      vacía la caja del DOM vivo y tiene que pasar a «no hay aviso», y volver al restaurarla.
//   ③ CONTROL POSITIVO: si NINGÚN caso guarda, el guard no está ejerciendo el camino bueno y no
//      puede afirmar nada sobre el malo. Rojo.
//   ④ Lo esperado se DERIVA de la pantalla (el `<label>` del campo vacío y el rótulo de su
//      pestaña), no se escribe aquí: un rótulo que cambie no puede dejar el guard midiendo otro.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');

// SCRUM-620 · puerto efímero por defecto; `GUARDAR_PUERTO` sigue mandando para quien lo fije.
let PUERTO = Number(process.env.GUARDAR_PUERTO || 0);

/** Lo que la pantalla necesita del árbol, en el orden en que lo carga `index.html`. */
const JS = [
  '/dashboard/js/settingsSubmenus.js',
  '/dashboard/js/puertaSerie.js',
  '/dashboard/js/settingsView.js',
];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];

const leer = (rel) => fs.readFileSync(path.join(PUBLIC, rel.replace(/^\//, '')), 'utf8');

/** La página de medición. Se arma aquí, pero el JS y el CSS salen DEL DISCO en cada petición. */
function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n'
    + '<script>\n'
    // Stubs MÍNIMOS: sólo lo que la pantalla pide de fuera. No se reimplementa NADA de la vista.
    + '  window.__merchant = {};\n'
    + '  window.__guardados = [];\n'
    + '  window.getMerchantProfile = async () => window.__merchant;\n'
    + '  window.updateMerchantProfile = async (p) => { window.__guardados.push(p); return {}; };\n'
    + '  window.apiRequest = async (ruta) => {\n'
    + '    if (ruta === "/admin/merchant") return window.__merchant;\n'
    + '    if (ruta === "/admin/connect/status") return { enabled: false };\n'
    + '    if (ruta === "/admin/referral") return { code: "X", redeemed: false };\n'
    + '    if (ruta === "/admin/metrics/whatsapp") return { month: { total: 0 }, channel: { windowMonth: 0 } };\n'
    + '    return {};\n'
    + '  };\n'
    + '  window.appLocale = { currency: "EUR" };\n'
    + '  window.appModoEmision = null;\n'
    + '  window.appPuertaSerieDisponible = false;\n'
    + '  window.appRetencionOpciones = null;\n'
    + '  window.__errores = [];\n'
    + '  window.addEventListener("error", (e) => window.__errores.push(String(e.message)));\n'
    + '<' + '/script>\n'
    + JS.map((s) => '<script src="' + s + '"><' + '/script>').join('\n')
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
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return { srv, servidos }; });
}

// ── LOS DOS PERFILES ─────────────────────────────────────────────────────────────────────────
// ⚠️ LOS `NOT NULL` CON DEFAULT VAN PUESTOS. `defaultCurrency` ('EUR') e `invoiceSeriesPrefix`
// ('CF') son NOT NULL con DEFAULT en `prisma/schema.prisma`, así que un merchant real NUNCA los
// tiene vacíos. Dejarlos en blanco —como hizo la primera sonda de este ticket— mete un segundo
// bloqueante que no existe en producción y tumba hasta el control positivo: el guard mediría un
// merchant imposible y diría que el botón no funciona NUNCA.
//
// Los cuatro que sí pueden estar vacíos de verdad son `legalName`, `taxId`, `address` y
// `whatsappPhone` — los cuatro `String?` del modelo, y los cuatro viven en «Empresa».
const COMPLETO = Object.freeze({
  slug: 'medicion', name: 'Medicion', legalName: 'Medicion SL', taxId: 'B12345674',
  address: 'C/ Medicion 1', whatsappPhone: '+34000000001',
  defaultCurrency: 'EUR', invoiceSeriesPrefix: 'CF',
  iban: '', clabe: '', bizumPhone: '', country: 'ES', connectStatus: 'none',
  viasDeCobro: { cobroManual: false },
});
const SIN_NIF = Object.freeze({ ...COMPLETO, taxId: '' });

const PERFILES = [
  { etiqueta: 'SIN NIF', merchant: SIN_NIF, debeGuardar: false },
  { etiqueta: 'COMPLETO', merchant: COMPLETO, debeGuardar: true },
];

/**
 * Las nueve pestañas. Se leen del MAPA de la pantalla dentro del navegador, no de esta lista: aquí
 * sólo está el SUELO del censo, para que «he medido 0 pestañas» no pueda salir verde.
 */
const PESTANAS_MINIMO = 9;

/**
 * EL DETECTOR, en texto, inyectado en la medición para que las dos mitades del control sean
 * EXACTAMENTE el mismo instrumento. Dos copias que puedan divergir es cómo se acaba midiendo una
 * cosa y afirmando otra.
 */
const DETECTOR = `
  function detectarAviso() {
    var caja = document.querySelector('#vista .alert');
    if (!caja) return { ciego: true, motivo: 'no existe la caja .alert en el DOM renderizado' };
    var r = caja.getBoundingClientRect();
    var texto = (caja.textContent || '').trim();
    return {
      ciego: false,
      presente: caja.style.display !== 'none' && texto.length > 0,
      texto: texto,
      alto: Math.round(r.height),
      esError: caja.classList.contains('error'),
    };
  }
`;

/** Se ejecuta DENTRO del navegador: pinta, pulsa desde una pestaña y mide. */
const MEDIR = new Function('merchant', 'pestana', DETECTOR + `
  return (async () => {
    window.__merchant = merchant;
    try { renderSettingsView(document.getElementById('vista')); }
    catch (e) { return { fatal: 'renderSettingsView lanzo: ' + (e && e.message ? e.message : String(e)) }; }
    // Se deja correr TODO lo asincrono (loadMerchant, readiness, connect, perfil publico): el
    // formulario no esta relleno hasta que vuelve \`loadMerchant\`.
    await new Promise((ok) => setTimeout(ok, 900));

    var form = document.querySelector('#vista form');
    if (!form) return { fatal: 'no hay <form> en la vista' };
    var tab = document.querySelector('button[data-submenu="' + pestana + '"]');
    if (!tab) return { fatal: 'no hay pestana ' + pestana };
    tab.click();

    var R = {};
    R.submitDisparado = false;
    form.addEventListener('submit', function () { R.submitDisparado = true; }, true);

    // LO ESPERADO SE DERIVA DE LA PANTALLA, no se escribe en el guard. \`validity\` no dispara
    // eventos; \`checkValidity()\` si, y un instrumento que provoca lo que mide no lo mide.
    R.esperados = [].slice.call(form.querySelectorAll('input,select,textarea'))
      .filter(function (el) { return el.willValidate && !el.validity.valid; })
      .map(function (el) {
        var ranura = el.closest('.field');
        var eti = ranura && ranura.querySelector('label');
        var panel = el.closest('[data-submenu]');
        var boton = panel && document.querySelector('button[data-submenu="' + panel.dataset.submenu + '"]');
        return {
          name: el.name || el.id,
          rotulo: eti ? (eti.textContent || '').trim() : '',
          pestanaClave: panel ? panel.dataset.submenu : null,
          pestanaRotulo: boton ? (boton.textContent || '').trim() : '',
          visible: el.offsetParent !== null,
        };
      });

    var boton = [].slice.call(form.querySelectorAll('button[type="submit"]')).pop();
    if (!boton) return { fatal: 'no hay boton de envio en el formulario' };
    document.body.focus();
    boton.click();
    await new Promise((ok) => setTimeout(ok, 500));

    R.guardados = window.__guardados.length;
    R.aviso = detectarAviso();
    if (R.aviso.ciego) return { fatal: R.aviso.motivo };

    var act = document.activeElement;
    R.foco = act ? (act.name || act.id || act.tagName) : null;
    R.focoVisible = act ? act.offsetParent !== null : false;
    R.panelAbierto = [].slice.call(document.querySelectorAll('div[data-submenu]'))
      .filter(function (p) { return p.style.display !== 'none'; })
      .map(function (p) { return p.dataset.submenu; }).join(',');

    // ── CALIBRACION · EL DETECTOR TIENE QUE SABER DECIR LAS DOS COSAS ────────────────────
    // Se corre SIEMPRE, haya aviso o no. Calibrar solo el caso que avisa deja pasar gratis los
    // otros con un detector averiado que siempre contesta lo mismo.
    var caja = document.querySelector('#vista .alert');
    if (R.aviso.presente) {
      var guardado = caja.textContent;
      caja.textContent = '';
      R.calSabeDecirNo = (detectarAviso().presente === false);
      caja.textContent = guardado;
      R.calVuelve = (detectarAviso().presente === true);
    } else {
      var displayOrig = caja.style.display;
      caja.textContent = 'SENUELO DE CALIBRACION';
      caja.style.display = 'block';
      R.calSabeDecirSi = (detectarAviso().presente === true);
      caja.textContent = '';
      caja.style.display = displayOrig;
      R.calVuelve = (detectarAviso().presente === false);
    }

    R.errores = window.__errores.slice();
    return R;
  })();
`);

/** Las pestañas que la pantalla declara, leídas de ella misma. */
const LISTAR_PESTANAS = new Function(`
  renderSettingsView(document.getElementById('vista'));
  return [].slice.call(document.querySelectorAll('button[data-submenu]'))
    .map(function (b) { return b.dataset.submenu; });
`);

// ── EJECUCIÓN ────────────────────────────────────────────────────────────────────────────────
const fallos = [];
const ciegos = [];
const filas = [];

const { srv, servidos } = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });

  // La POBLACIÓN se lee de la pantalla, no se escribe aquí.
  const pag0 = await navegador.newPage();
  await pag0.goto('http://127.0.0.1:' + PUERTO + '/medicion.html', { waitUntil: 'load' });
  let PESTANAS = [];
  try { PESTANAS = await pag0.evaluate(LISTAR_PESTANAS); } catch (e) { ciegos.push('no se pudo listar las pestañas: ' + e.message); }
  await pag0.close();
  if (PESTANAS.length < PESTANAS_MINIMO) {
    ciegos.push('la pantalla declara ' + PESTANAS.length + ' pestañas y el suelo son '
      + PESTANAS_MINIMO + '. Un censo corto mide una esquina y la llama pantalla.');
    PESTANAS = [];
  }

  for (const perfil of PERFILES) {
    for (const pestana of PESTANAS) {
      const donde = perfil.etiqueta + ' / ' + pestana;
      const pag = await navegador.newPage();
      const consola = [];
      pag.on('pageerror', (e) => consola.push('pageerror: ' + e.message));
      await pag.goto('http://127.0.0.1:' + PUERTO + '/medicion.html', { waitUntil: 'load' });
      let r;
      try { r = await pag.evaluate(MEDIR, perfil.merchant, pestana); }
      catch (e) { r = { fatal: 'la medición lanzó: ' + e.message }; }
      await pag.close();

      if (r.fatal) { ciegos.push(donde + ': ' + r.fatal); continue; }

      // ── SUELO ② · ¿el detector sabe cambiar de respuesta? ──────────────────────────────
      const calOk = r.aviso.presente
        ? (r.calSabeDecirNo === true && r.calVuelve === true)
        : (r.calSabeDecirSi === true && r.calVuelve === true);
      if (!calOk) {
        ciegos.push(donde + ': la CALIBRACIÓN falló — el detector no supo cambiar de respuesta al '
          + (r.aviso.presente ? 'VACIAR la caja del aviso' : 'INYECTAR un señuelo en ella')
          + '. No está leyendo la pantalla, así que su veredicto no vale.');
        continue;
      }

      filas.push({ perfil: perfil.etiqueta, pestana, ...r, consola });

      // ── EL VEREDICTO ───────────────────────────────────────────────────────────────────
      if (perfil.debeGuardar) {
        if (!r.guardados) {
          fallos.push('🔴 [' + donde + '] NO GUARDA con el perfil completo. Este es el camino bueno: '
            + 'si aquí no guarda, el botón está roto para todo el mundo y no sólo para quien '
            + 'tiene un hueco.\n     invalidos detectados: '
            + (r.esperados.map((e) => e.name).join(', ') || '(ninguno)'));
        } else if (r.aviso.presente && r.aviso.esError) {
          fallos.push('🔴 [' + donde + '] guarda Y avisa de un error: «' + r.aviso.texto + '». '
            + 'Un aviso que sale cuando no toca se aprende a ignorar, y entonces deja de proteger '
            + 'a quien sí lo necesita.');
        }
        continue;
      }

      // Perfil incompleto: NO debe guardar, y sobre todo NO puede callarse.
      if (r.guardados) {
        fallos.push('🔴 [' + donde + '] GUARDA con un obligatorio vacío. Este guard no decide qué '
          + 'es obligatorio —lo dicen los `required` de la pantalla— pero sí que lo que se exige '
          + 'se exija de verdad.');
        continue;
      }
      const falta = r.esperados[0];
      if (!falta) {
        ciegos.push(donde + ': el navegador no da por inválido ningún control con el NIF vacío, así '
          + 'que no hay defecto que provocar. O `required` desapareció de `taxId`, o `willValidate` '
          + 'dejó de valer aquí: en los dos casos este guard ha dejado de medir lo que dice.');
        continue;
      }
      if (!r.aviso.presente || r.aviso.alto === 0) {
        fallos.push('🔴 [' + donde + '] EL BOTÓN NO HACE NADA Y NO LO DICE. Con «' + falta.rotulo
          + '» vacío, «Guardar cambios» ni guarda ni avisa'
          + (r.aviso.alto === 0 && r.aviso.texto ? ' (el aviso está en el DOM y mide 0 px: existe y no se ve)' : '')
          + '.\n     Es la única salida del cobro sin Connect, y un botón mudo en una pantalla de '
          + 'cobros es donde el profesional deja de fiarse del resto de la aplicación.');
        continue;
      }
      if (!r.aviso.texto.includes(falta.rotulo)) {
        fallos.push('🔴 [' + donde + '] el aviso NO NOMBRA EL CAMPO. Dice «' + r.aviso.texto
          + '» y lo que falta es «' + falta.rotulo + '». Un aviso que no nombra lo que falta '
          + 'obliga a adivinar.');
        continue;
      }
      if (falta.pestanaRotulo && !r.aviso.texto.includes(falta.pestanaRotulo)) {
        fallos.push('🔴 [' + donde + '] el aviso nombra el campo pero NO SU PESTAÑA. Dice «'
          + r.aviso.texto + '» y «' + falta.rotulo + '» vive en «' + falta.pestanaRotulo + '». '
          + 'Saber qué falta sin saber dónde está es media respuesta en una pantalla de diez paneles.');
        continue;
      }
      if (falta.pestanaClave && r.panelAbierto !== falta.pestanaClave) {
        fallos.push('🔴 [' + donde + '] el aviso nombra la pestaña «' + falta.pestanaRotulo
          + '» pero NO LLEVA A ELLA: sigue abierta «' + r.panelAbierto + '». Decir dónde está y '
          + 'dejar que lo busque es pedirle al profesional que navegue con el error delante.');
        continue;
      }
      if (!r.focoVisible) {
        fallos.push('🔴 [' + donde + '] el cursor no queda en el campo que falta (quedó en «'
          + r.foco + '», que no se ve). Es el mismo silencio de antes con una capa menos: la '
          + 'pantalla cambia y el profesional sigue sin saber dónde escribir.');
      }
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

// ── SUELO ③ · ¿se sirvió lo del árbol? ───────────────────────────────────────────────────────
for (const nec of [...JS, ...CSS]) {
  if (!servidos.includes(nec)) {
    ciegos.push('no se llegó a servir ' + nec + ': la página medida no es la del árbol');
  }
}
if (!filas.length && !ciegos.length) ciegos.push('no se midió ni un solo caso');

// ── SUELO ④ · CONTROL POSITIVO ───────────────────────────────────────────────────────────────
// Si NINGÚN caso guardó, el guard no ha ejercido el camino bueno: no puede afirmar nada del malo.
const guardaron = filas.filter((f) => f.guardados).length;
if (filas.length && guardaron === 0) {
  ciegos.push('NINGUNO de los ' + filas.length + ' casos llegó a guardar. Sin la mitad que funciona, '
    + '«no guarda» no distingue un botón mudo de un instrumento que no sabe pulsarlo.');
}

// ── INFORME ──────────────────────────────────────────────────────────────────────────────────
console.log('\n  SCRUM-894 · «GUARDAR CAMBIOS» DESDE LAS NUEVE PESTAÑAS, MEDIDO EN EL DOM VIVO');
console.log('  POBLACIÓN: ' + filas.length + ' casos medidos (' + PERFILES.length + ' perfiles × las '
  + 'pestañas que declara la pantalla) · ' + guardaron + ' guardaron');
console.log('  ' + '─'.repeat(104));
for (const f of filas) {
  const ok = f.guardados || (f.aviso.presente && f.focoVisible);
  console.log('  ' + (ok ? '✔' : '✘') + ' ' + (f.perfil + ' / ' + f.pestana).padEnd(26)
    + ' submit=' + (f.submitDisparado ? 'SÍ' : 'no')
    + '  guarda=' + (f.guardados ? 'SÍ' : 'no')
    + '  panel=' + String(f.panelAbierto).padEnd(13)
    + '  foco=' + String(f.foco + (f.focoVisible ? '' : ' (oculto)')).padEnd(18)
    + (f.aviso.presente ? '  aviso: «' + f.aviso.texto + '»' : '  aviso: (ninguno)'));
  for (const c of (f.consola || [])) console.log('      ⚠ ' + c);
  for (const e of (f.errores || [])) console.log('      ⚠ error en página: ' + e);
}
console.log('  ' + '─'.repeat(104));

if (ciegos.length) {
  console.error('\n  🔴 EL GUARD NO SUPO MIRAR — y esto NO es «el botón funciona»:\n');
  for (const c of ciegos) console.error('   · ' + c);
  console.error('\n  Un verde aquí diría que nadie se queda delante de un botón mudo.\n');
  process.exit(1);
}
if (fallos.length) {
  console.error('\n  🔴 ' + fallos.length + ' FALLO(S):\n');
  for (const f of fallos) console.error('   ' + f + '\n');
  process.exit(1);
}
console.log('\n  ✔ en los ' + filas.length + ' casos el botón o guarda, o dice qué falta y lleva a ello.\n');

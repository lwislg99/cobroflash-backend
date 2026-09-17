// scripts/guard-completar-lleva-al-campo.mjs — SCRUM-904
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// CADA «COMPLETAR →» DEL CHECKLIST DE CONFIGURACIÓN LLEVA A DONDE ESTÁ LO QUE PIDE.
//
// El checklist «Tu cuenta, lista para cobrar» es la pantalla que le dice al profesional QUÉ LE
// FALTA PARA PODER COBRAR. Este guard pulsa cada una de sus filas DESDE TODAS LAS PESTAÑAS y exige
// que el clic acabe en el sitio: la pestaña del destino abierta, el destino a la vista, y —si es un
// campo— el cursor dentro y su rótulo legible.
//
// ── EL DEFECTO QUE CIERRA, MEDIDO EL 17-SEP-2026 ─────────────────────────────────────────────
// 4 filas × 9 pestañas = 36 casos. **33 no hacían NADA.** Sólo funcionaban 3: cada fila pulsada
// desde la pestaña donde ya vive su campo.
//
// Son DOS defectos distintos, y por eso no bastaba con arreglar uno:
//
//   · TRES FILAS apuntaban bien (`[name=…]`) y su panel estaba oculto. Los diez paneles se pintan
//     con `display:none` salvo el activo, y `scrollIntoView` + `focus()` sobre un elemento oculto
//     no hacen nada y no lo dicen. Es la causa de SCRUM-894, otra vez.
//   · LA FILA «Cobros con tarjeta» apuntaba a algo QUE NO EXISTE: buscaba un `<h2>` que casara
//     `/tarjeta|Stripe|Connect/i` y el rótulo de ese bloque es un `<p>`. Medido con la tarjeta de
//     Connect pintada de verdad: esos `<h2>` son CERO. Caía en su rama de reserva las 9 veces.
//
// ⚠️ Y ese segundo defecto sólo apareció al ARREGLAR EL BANCO. Con `/admin/connect/status`
// devolviendo `{enabled:false}` —como lo dejó la primera medición— `renderConnectCard` hace
// `return` en su primera línea, la tarjeta no se pinta y los 9 casos caen en la reserva POR OTRO
// MOTIVO. Un banco que no monta la superficie no mide la superficie: la declara no medida.
//
// ── POR QUÉ EN NAVEGADOR ─────────────────────────────────────────────────────────────────────
// Porque «se ve» no existe fuera de uno. `display:none`, `offsetParent`, el foco y el desplazamiento
// son del motor de maquetado; en el fuente, un `focus()` sobre un campo visible y uno sobre un campo
// oculto se leen IGUAL. Misma decisión que `guard:falta-en-otra-pestana` (SCRUM-894) y
// `guard:aviso-bizum` (SCRUM-515). La red que SÍ corre siempre es
// `tests/scrum904-completar-lleva-al-campo.test.mjs`.
//
// ── LAS CUATRO PATAS ─────────────────────────────────────────────────────────────────────────
//   ① ROJO REAL ..... el barrido sobre el árbol: una acción que no llega es un fallo con nombre.
//   ② VERDE REAL .... los 3 casos que YA funcionaban (fila pulsada desde la pestaña de su campo)
//                     tienen que seguir llegando SIN cambiar de pestaña. Si el arreglo los rompe
//                     —o los «arregla» moviendo una pestaña que ya estaba bien— se dice.
//   ③ SUELO ......... 0 acciones vistas es CIEGO, nunca «0 mudas». Lo mismo con 0 pestañas.
//   ④ MUTACIÓN ...... en CADA pasada se sirve el fichero con la apertura de pestaña quitada y se
//                     comprueba que el detector PASA A VER MUDAS. La sustitución se CUENTA: si no
//                     es exactamente 1, el guard no ha mutado nada y se declara ciego en vez de
//                     celebrar que «la mutación no rompió nada».
//
// ── LA POBLACIÓN SE MUEVE, ASÍ QUE SE COMPARA POR CONJUNTOS ──────────────────────────────────
// El checklist sólo pinta «Completar →» en las filas que NO están en verde, así que el número de
// acciones depende del merchant. Un número suelto sobre una población que cambia no es reproducible
// por construcción: aquí se listan los RÓTULOS vistos, se vuelven a leer al final, y se nombra qué
// entró y qué salió. (Lección de SCRUM-904/A12: comparar conjuntos y no cuentas es lo que explicó
// el parpadeo 147/148 de las ramas remotas.)
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

const SALIDA_CIEGO = 2; // «no supe medir» ≠ «no hay defectos» (vocabulario de `_servidor.mjs`)

let PUERTO = Number(process.env.COMPLETAR_PUERTO || 0);

const JS = [
  '/dashboard/js/settingsSubmenus.js',
  '/dashboard/js/puertaSerie.js',
  '/dashboard/js/settingsView.js',
];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];
const PAGINA = '/__completar-lleva-al-campo.html'; // ruta VIRTUAL: no la sirve ningún otro guard

const leer = (rel) => fs.readFileSync(path.join(PUBLIC, rel.replace(/^\//, '')), 'utf8');

// ── ④ LA MUTACIÓN ────────────────────────────────────────────────────────────────────────────
// Quita la apertura de pestaña, que es EXACTAMENTE el defecto que este guard vigila: la acción
// sigue apuntando bien y el panel sigue oculto. Se aplica al vuelo sobre lo servido; el árbol no
// se toca.
const DIANA = 'if (pestana) pestana.click();';
const SUSTITUTO = 'if (pestana) { /* MUTADO POR guard-completar-lleva-al-campo */ }';
const mutacion = { activa: false, sustituciones: null };

function cuerpoServido(ruta) {
  let texto = leer(ruta);
  if (mutacion.activa && ruta === '/dashboard/js/settingsView.js') {
    const trozos = texto.split(DIANA);
    mutacion.sustituciones = trozos.length - 1;
    texto = trozos.join(SUSTITUTO);
  }
  return texto;
}

function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n'
    + '<script>\n'
    + '  window.__merchant = {};\n'
    + '  window.getMerchantProfile = async () => window.__merchant;\n'
    + '  window.updateMerchantProfile = async () => ({});\n'
    + '  window.showToast = () => {};\n'
    + '  window.apiRequest = async (ruta) => {\n'
    + '    if (ruta === "/admin/merchant") return window.__merchant;\n'
    // 🔴 `enabled:true` NO ES DECORADO: con `false`, `renderConnectCard` hace `return` en su
    // primera línea y la fila «Cobros con tarjeta» se mediría sobre una superficie que no existe.
    + '    if (ruta === "/admin/connect/status") return { enabled: true, connectStatus: "none" };\n'
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
    if (ruta === PAGINA) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(paginaHtml());
    }
    try {
      const cuerpo = cuerpoServido(ruta);
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

// El merchant al que le falta TODO: las cuatro filas salen como «Completar →». Los `NOT NULL` con
// default van puestos ('EUR', 'CF'), porque en la base nunca están vacíos.
const MERCHANT = Object.freeze({
  slug: 'medicion', name: 'Medicion', legalName: '', taxId: '', address: '',
  whatsappPhone: '', defaultCurrency: 'EUR', invoiceSeriesPrefix: 'CF',
  iban: '', clabe: '', bizumPhone: '', country: 'ES', connectStatus: 'none',
  viasDeCobro: { cobroManual: false },
});

/** Lee la POBLACIÓN de la pantalla: qué acciones hay y qué pestañas hay. Nada escrito aquí. */
const CENSAR = new Function('merchant', `
  return (async () => {
    window.__merchant = merchant;
    try { renderSettingsView(document.getElementById('vista')); }
    catch (e) { return { fatal: 'renderSettingsView lanzo: ' + (e && e.message ? e.message : String(e)) }; }
    await new Promise((ok) => setTimeout(ok, 900));
    const caja = document.querySelector('#readiness-rows');
    if (!caja) return { fatal: 'no existe el checklist (#readiness-rows) en el DOM pintado' };
    return {
      acciones: [].slice.call(caja.children).map(function (b) {
        var t = b.querySelector('span span');
        return (t ? t.textContent : b.textContent).replace(/\\s+/g, ' ').trim();
      }),
      pestanas: [].slice.call(document.querySelectorAll('button[data-submenu]')).map(function (b) { return b.dataset.submenu; }),
      tarjetaConnectPintada: !!document.querySelector('#connect-status-body button'),
    };
  })();
`);

/** Pulsa UNA acción desde UNA pestaña y dice si llegó a alguna parte. */
const MEDIR = new Function('merchant', 'pestana', 'accion', `
  return (async () => {
    window.__merchant = merchant;
    try { renderSettingsView(document.getElementById('vista')); }
    catch (e) { return { fatal: 'renderSettingsView lanzo: ' + (e && e.message ? e.message : String(e)) }; }
    await new Promise((ok) => setTimeout(ok, 900));

    var tab = document.querySelector('button[data-submenu="' + pestana + '"]');
    if (!tab) return { fatal: 'no hay pestana ' + pestana };
    tab.click();
    var abierto = function () {
      return [].slice.call(document.querySelectorAll('div[data-submenu]'))
        .filter(function (p) { return p.style.display !== 'none'; })
        .map(function (p) { return p.dataset.submenu; }).join(',');
    };
    var panelAntes = abierto();

    var caja = document.querySelector('#readiness-rows');
    if (!caja) return { fatal: 'no existe el checklist' };
    var fila = [].slice.call(caja.children).find(function (b) {
      return b.textContent.replace(/\\s+/g, ' ').indexOf(accion) !== -1;
    });
    if (!fila) return { fatal: 'no existe la accion «' + accion + '»' };

    // A dónde intenta ir el clic. Se observa el DESTINO REAL, no se supone cuál es.
    var destinos = [];
    var orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function () {
      destinos.push({
        tag: this.tagName,
        nombre: this.name || this.id || '',
        visible: this.offsetParent !== null,
        // La «reserva»: la tarjeta del formulario, que se ve SIEMPRE y no es el destino de nadie.
        esReserva: !!(this.classList && this.classList.contains('customers-card') && !this.closest('[data-submenu]')),
        panel: (this.closest('[data-submenu]') || { dataset: {} }).dataset.submenu || null,
      });
      return orig.apply(this, arguments);
    };
    document.body.focus();
    fila.click();
    await new Promise((ok) => setTimeout(ok, 600));
    Element.prototype.scrollIntoView = orig;

    var act = document.activeElement;
    var ranura = act && act.closest ? act.closest('.field') : null;
    var eti = ranura ? ranura.querySelector('label') : null;
    return {
      destinos: destinos,
      panelAntes: panelAntes,
      panelDespues: abierto(),
      foco: act ? (act.name || act.id || act.tagName) : null,
      focoVisible: !!(act && act.offsetParent !== null),
      rotuloDelFoco: eti ? (eti.textContent || '').trim() : '',
      errores: window.__errores.slice(),
    };
  })();
`);

/**
 * ¿Llegó el clic a alguna parte? DOS formas válidas, que son las dos que el producto tiene:
 *   · el cursor acaba en un campo VISIBLE y su rótulo se puede leer (lleva Y nombra), o
 *   · se desplaza a un destino VISIBLE que no es la reserva (el bloque de Connect, que no se enfoca).
 */
function llego(r) {
  if (r.focoVisible && r.rotuloDelFoco) return true;
  return (r.destinos || []).some((d) => d.visible && !d.esReserva);
}

function motivo(r) {
  if (!r.destinos || !r.destinos.length) return 'el clic no intentó ir a ninguna parte';
  if (r.destinos.every((d) => d.esReserva)) {
    return 'cayó en la RESERVA (la tarjeta del formulario, que se ve siempre): el destino de verdad '
      + 'no se encontró';
  }
  if (r.destinos.every((d) => !d.visible)) {
    return 'el destino existe pero está OCULTO (su panel no se abrió): `scrollIntoView` y `focus()` '
      + 'sobre algo con `display:none` no hacen nada y no lo dicen';
  }
  if (r.focoVisible && !r.rotuloDelFoco) return 'el cursor llegó al campo pero NO tiene rótulo legible: se llega sin saber a qué';
  return 'no se pudo clasificar el destino';
}

/** Un barrido completo: devuelve una fila por caso. */
async function barrer(navegador, acciones, pestanas) {
  const filas = [];
  for (const pestana of pestanas) {
    for (const accion of acciones) {
      const pag = await navegador.newPage();
      const consola = [];
      pag.on('pageerror', (e) => consola.push('pageerror: ' + e.message));
      await pag.goto('http://127.0.0.1:' + PUERTO + PAGINA, { waitUntil: 'load' });
      let r;
      try { r = await pag.evaluate(MEDIR, MERCHANT, pestana, accion); }
      catch (e) { r = { fatal: 'la medición lanzó: ' + e.message }; }
      await pag.close();
      filas.push({ pestana, accion, consola, ...r });
    }
  }
  return filas;
}

// ── EJECUCIÓN ────────────────────────────────────────────────────────────────────────────────
const ciegos = [];
const fallos = [];
let censoAntes = null; let censoDespues = null; let filas = []; let mutadas = null;

const { srv, servidos } = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });

  // ── ③ SUELO · la POBLACIÓN se lee de la pantalla ──────────────────────────────────────────
  const pag0 = await navegador.newPage();
  await pag0.goto('http://127.0.0.1:' + PUERTO + PAGINA, { waitUntil: 'load' });
  censoAntes = await pag0.evaluate(CENSAR, MERCHANT);
  await pag0.close();

  if (censoAntes.fatal) {
    ciegos.push('no se pudo censar la pantalla: ' + censoAntes.fatal);
  } else {
    if (!censoAntes.acciones.length) {
      ciegos.push('el checklist tiene 0 acciones. Eso NO es «0 mudas»: es que no he mirado ninguna. '
        + 'O el merchant de prueba las pone todas en verde, o el checklist no se pintó.');
    }
    if (censoAntes.pestanas.length < 2) {
      ciegos.push('la pantalla declara ' + censoAntes.pestanas.length + ' pestañas. Con menos de dos '
        + 'no existe el caso «el campo está en OTRA pestaña», que es el único que este guard mide.');
    }
    if (!censoAntes.tarjetaConnectPintada) {
      ciegos.push('la tarjeta de Stripe Connect NO se ha pintado, así que la fila «Cobros con '
        + 'tarjeta» se mediría contra una superficie que no existe y su resultado no valdría. '
        + 'Es exactamente lo que dejó esos 9 casos sin medir en la primera pasada de SCRUM-904.');
    }
  }

  if (!ciegos.length) {
    // ── ① y ② · EL BARRIDO SOBRE EL ÁRBOL ───────────────────────────────────────────────────
    filas = await barrer(navegador, censoAntes.acciones, censoAntes.pestanas);

    for (const f of filas) {
      if (f.fatal) { ciegos.push(f.pestana + ' / ' + f.accion + ': ' + f.fatal); continue; }
      if (!llego(f)) {
        fallos.push('🔴 [' + f.pestana + ' → «' + f.accion + '»] LA ACCIÓN NO LLEVA A NINGUNA PARTE.\n'
          + '     ' + motivo(f) + '.\n'
          + '     Una lista que dice qué te falta para cobrar y cuyas flechas no llevan a ningún '
          + 'sitio no es una ayuda con fallos: enseña a no fiarse de ella.');
      }
    }

    // ── ② VERDE REAL, explícito ────────────────────────────────────────────────────────────
    // Los casos en los que la acción ya estaba en la pestaña de su campo tienen que llegar SIN
    // cambiar de pestaña. Si el arreglo mueve una pestaña que ya estaba bien, se nota aquí.
    const yaEstaban = filas.filter((f) => !f.fatal && f.panelAntes === f.panelDespues && llego(f));
    if (!yaEstaban.length) {
      ciegos.push('ni un solo caso llega SIN cambiar de pestaña. Antes del arreglo había tres, así '
        + 'que o el barrido no los está viendo o el arreglo cambia de pestaña siempre — y entonces '
        + 'mueve la pantalla debajo de quien ya estaba donde tenía que estar.');
    }

    // ── ④ MUTACIÓN · EN CADA PASADA ────────────────────────────────────────────────────────
    mutacion.activa = true;
    mutadas = await barrer(navegador, censoAntes.acciones, censoAntes.pestanas);
    mutacion.activa = false;

    if (mutacion.sustituciones !== 1) {
      ciegos.push('la MUTACIÓN no sustituyó exactamente una vez (sustituciones: '
        + mutacion.sustituciones + '). Si es 0, el guard ha medido DOS VECES el mismo código y su '
        + '«la mutación no rompió nada» no significa nada; si es más de 1, no sé qué he mutado. '
        + 'La diana es `' + DIANA + '` en `settingsView.js`.');
    } else {
      const mudasMutadas = mutadas.filter((f) => !f.fatal && !llego(f)).length;
      if (mudasMutadas === 0) {
        ciegos.push('con la apertura de pestaña QUITADA, el detector sigue sin ver una sola acción '
          + 'muda. No está midiendo lo que dice medir: un detector que no sabe ponerse rojo da un '
          + 'verde que no significa nada.');
      }
    }

    // ── LA POBLACIÓN, RELEÍDA · se comparan CONJUNTOS, no cuentas ───────────────────────────
    const pagN = await navegador.newPage();
    await pagN.goto('http://127.0.0.1:' + PUERTO + PAGINA, { waitUntil: 'load' });
    censoDespues = await pagN.evaluate(CENSAR, MERCHANT);
    await pagN.close();
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

// ── SUELO · ¿se sirvió lo del árbol? ─────────────────────────────────────────────────────────
for (const nec of [...JS, ...CSS]) {
  if (!servidos.includes(nec)) ciegos.push('no se llegó a servir ' + nec + ': la página medida no es la del árbol');
}

// ── INFORME ──────────────────────────────────────────────────────────────────────────────────
console.log('\n  SCRUM-904 · «COMPLETAR →» DEL CHECKLIST, PULSADO DESDE TODAS LAS PESTAÑAS');
if (censoAntes && !censoAntes.fatal) {
  console.log('  POBLACIÓN · acciones vistas: ' + censoAntes.acciones.length
    + ' · pestañas: ' + censoAntes.pestanas.length
    + ' · casos comprobados: ' + filas.length + ' (y otros ' + (mutadas ? mutadas.length : 0) + ' con la mutación puesta)');
  for (const a of censoAntes.acciones) console.log('     · ' + a);

  // La lista de acciones depende del merchant: si se moviera entre dos lecturas, un número suelto
  // no sería reproducible. Se nombra qué entra y qué sale.
  if (censoDespues && !censoDespues.fatal) {
    const antes = new Set(censoAntes.acciones);
    const despues = new Set(censoDespues.acciones);
    const salieron = [...antes].filter((x) => !despues.has(x));
    const entraron = [...despues].filter((x) => !antes.has(x));
    if (salieron.length || entraron.length) {
      ciegos.push('LA POBLACIÓN SE MOVIÓ DURANTE EL BARRIDO — salieron: ['
        + salieron.join(', ') + '] · entraron: [' + entraron.join(', ') + ']. Lo medido no describe '
        + 'ni la lista de antes ni la de después.');
    } else {
      console.log('  conjunto de acciones IDÉNTICO al releerlo (ninguna entró, ninguna salió)');
    }
  }
}
console.log('  ' + '─'.repeat(104));
for (const f of filas) {
  if (f.fatal) continue;
  const ok = llego(f);
  console.log('  ' + (ok ? '✔' : '✘') + ' ' + (f.pestana + ' → ' + f.accion).padEnd(52)
    + ' panel: ' + (f.panelAntes + '→' + f.panelDespues).padEnd(28)
    + ' foco: ' + String(f.foco + (f.focoVisible ? '' : ' (oculto)')).padEnd(20)
    + (f.rotuloDelFoco ? '«' + f.rotuloDelFoco + '»' : ''));
  for (const c of (f.consola || [])) console.log('      ⚠ ' + c);
}
console.log('  ' + '─'.repeat(104));
if (mutadas) {
  console.log('  ④ MUTACIÓN · sustituciones: ' + mutacion.sustituciones
    + ' · acciones mudas con ella puesta: ' + mutadas.filter((f) => !f.fatal && !llego(f)).length
    + ' de ' + mutadas.length);
}

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — y esto NO es «todas las acciones llevan a su sitio»:\n');
  for (const c of ciegos) console.error('   · ' + c);
  console.error('');
  process.exit(SALIDA_CIEGO);
}
if (fallos.length) {
  console.error('\n  🔴 ' + fallos.length + ' ACCIÓN(ES) QUE NO LLEVAN A NINGUNA PARTE:\n');
  for (const f of fallos) console.error('   ' + f + '\n');
  process.exit(1);
}
console.log('\n  ✔ las ' + filas.length + ' acciones llevan a su destino, y con la mutación puesta el detector las ve caer.\n');

// scripts/sonda-915-inventario-v3.mjs — SCRUM-915 · PASO 0: ¿QUÉ PARTE DE LA v3 APROBADA ESTÁ YA EN LA PANTALLA?
//
// Uso:  node scripts/sonda-915-inventario-v3.mjs
//
// ── QUÉ CONTESTA ────────────────────────────────────────────────────────────────────────────────
// La v3 del editor la aprobó el fundador (#1463) y su inventario «antes -> después» vive DENTRO del
// prototipo: `docs/prototipos/SCRUM-915/editor-presupuesto.html`, array `INV`. 915d entró la semana
// pasada y montó los PASOS. Nadie ha medido qué queda.
//
// Esta sonda recorre el editor REAL en un navegador real —los mismos ficheros de `public/` que sirve
// el panel— y contesta, fila a fila del inventario aprobado: YA ESTÁ · FALTA · NO MEDIBLE (con el
// motivo). No propone nada y no toca producto: sólo mide.
//
// ── POR QUÉ LA POBLACIÓN SE LEE DEL PROTOTIPO Y NO SE COPIA AQUÍ ────────────────────────────────
// Una copia a mano del inventario sería una segunda fuente que deriva. La sonda PARSEA el array
// `INV` del propio prototipo aprobado: si mañana alguien añade una fila allí, aquí aparece como
// «sin predicado» y se ve. La población es la del documento aprobado, no la que me convenga.
//
// ── CÓMO SE MIDE ────────────────────────────────────────────────────────────────────────────────
// 🔴 EL ESTADO DESPUÉS DE PULSAR, no el fuente ni una captura. Se recorre el camino del profesional
// (cliente -> Continuar -> línea -> Continuar -> Condiciones -> Continuar -> Revisar) y en cada
// parada se toma una FOTO de hechos del DOM vivo (`checkVisibility`, textos, recuentos). Los
// predicados se evalúan después, en Node, contra esas fotos.
//
// ── CONTROLES ───────────────────────────────────────────────────────────────────────────────────
//   ✅ POSITIVO · el instrumento VE los controles de hoy: el censo de 16 del inventario de 915d
//      (`inventario-hoy.md`). Si no los ve, no está mirando el editor y ningún «falta» vale nada.
//   ✅ POSITIVO 2 · las filas que 915d SÍ entregó (pasos, «Ajustes del documento», resúmenes) tienen
//      que salir YA ESTÁ. Si salen FALTA, el defecto es de la sonda: 915d está en main y medido.
//   ⛔ SUELO · si el editor no pinta, o la lista de clientes no llega al selector, o el recorrido se
//      corta, sale con 2 (NO SUPE MEDIR), que NO es «está todo». Un rojo sin población no es un
//      hallazgo.
//   🧾 TESTIGO · la última línea es `EXIT=<n>` y la primera, la POBLACIÓN. Una operación que no se
//      ejecutó se lee exactamente igual que un éxito.
//
// Todo lo que corre DENTRO de la página va en cadenas dentro de `new Function` (censo SCRUM-258).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROTOTIPO = path.join(RAIZ, 'docs', 'prototipos', 'SCRUM-915', 'editor-presupuesto.html');
let PUERTO = Number(process.env.SONDA915_PUERTO || 0);

// ═══ LA POBLACIÓN: el array INV del prototipo APROBADO ═══════════════════════════════════════════
//
// Se recorta el literal entre `const INV=[` y la línea `];`, y cada fila es un array JS. No se
// evalúa el fichero entero (es una página con IIFE): se evalúa SÓLO ese literal, que es datos.
function leerInventarioAprobado() {
  const txt = fs.readFileSync(PROTOTIPO, 'utf8');
  const i = txt.indexOf('const INV=[');
  if (i < 0) throw new Error('no encuentro `const INV=[` en el prototipo aprobado');
  const j = txt.indexOf('\n];', i);
  if (j < 0) throw new Error('no encuentro el cierre del array INV');
  const literal = txt.slice(i + 'const INV='.length, j + 3).replace(/;\s*$/, '');
  const filas = new Function('return ' + literal)();
  if (!Array.isArray(filas) || filas.length < 40) throw new Error(`INV tiene ${filas && filas.length} filas: no es el inventario`);
  return filas;
}

// ═══ EL SERVIDOR DE PEGA ═════════════════════════════════════════════════════════════════════════
// 🔴 EL CLIENTE LLEVA LO PACTADO A PROPÓSITO. Sin `dtoPorDefecto` ni `payMethodsPorDefecto` las dos
// TIRAS de propuesta (SCRUM-587 y SCRUM-586) no se pintan nunca, y sus dos filas del inventario
// saldrían «no medible» por culpa del banco, no del producto. Los nombres salen de
// `descuentoPorDefecto.propuestaPara` y `formaDePagoPorDefecto.propuestaPara`, que son quienes los
// leen — anclado al NOMBRE, no a la línea (SCRUM-710b). El teléfono va en el rango imposible
// `34 0XX XXX XXX` (SCRUM-262).
const CLIENTE = {
  id: 7, name: 'Comunidad Los Olivos', phone: '34000000001', email: 'olivos@correo.es',
  dtoPorDefecto: 10, payMethodsPorDefecto: ['transferencia'],
};
const MERCHANT = { id: 1, name: 'QA 915', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };
let modoSuelto = 'no';
// H2 · «generar dos veces crea dos presupuestos»: se cuentan los POST de verdad, no se supone.
const creaciones = [];

const me = () => ({
  id: 1, email: 'demo@yaqu.app', name: 'QA 915', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
  documentoSuelto: modoSuelto,
});

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (req.method === 'POST' && /\/quote\/create/.test(u)) {
      creaciones.push(Date.now());
      const id = 100 + creaciones.length;
      return json(res, { ok: true, id, quoteId: id, quote: { id, quoteNumber: id, status: 'draft', total: 0 } });
    }
    if (/^\/admin\/quotes\/\d+/.test(u)) {
      return json(res, { id: 101, quoteNumber: 101, status: 'draft', total: 0, currency: 'EUR', pdfUrl: '/x.pdf' });
    }
    if (u === '/admin/me') return json(res, me());
    if (u === '/admin/merchant') return json(res, MERCHANT);
    if (u === '/admin/customers') return json(res, [CLIENTE]);
    if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [] });
    const rel = u.replace(/^\//, '');
    const f = path.join(RAIZ, 'public', rel);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      const tipo = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
      res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('no');
  });
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

// ═══ LA FOTO DE HECHOS ═══════════════════════════════════════════════════════════════════════════
// Un solo paso por la página por parada. Todo lo que un predicado pueda necesitar sale de aquí.
const INVENTARIO_915D = [
  ['buscador de cliente', '.quote-buscador-cliente', 1],
  ['selector de cliente', 'select[name="customer_id"]', 1],
  ['direccion de la obra', 'select[name="shipping_address_mode"]', 1],
  ['direccion personalizada', 'input[name="shipping_address"]', 1],
  ['IVA por defecto', 'select[name="vat_default"]', 1],
  ['IVA del presupuesto', 'select[name="iva_modo"]', 1],
  ['+ Anadir linea', '.quote-add-line', 1],
  ['lineas', '.quote-line', 1],
  ['condiciones de pago', 'select[name="payment_terms"]', 1],
  ['valido hasta', '#quote-valid-until', 1],
  ['incluir descripcion', 'input[name="include_description"]', 1],
  ['formas de pago + datos del cliente (casillas)', '.pay-methods-row input[type="checkbox"]', 7],
  ['razon social / nombre comercial', 'input[name="df-nombre"]', 2],
  ['descuento global', '.quote-dto-global', 1],
  ['total', '.quote-total-kpi', 1],
  ['acciones', '.quote-block-actions .form-actions .btn', 2],
];

const FOTO = new Function('inventario', `
  var izq = document.querySelector('.quotes-left-card');
  var der = document.querySelector('.quotes-right-card') || document.querySelector('.quote-preview') && document.querySelector('.quote-preview').parentElement;
  if (!izq) return { error: 'no hay .quotes-left-card' };
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var ve = function (el) { return !!el && el.isConnected && el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }); };
  var q = function (s, r) { return (r || izq).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || izq).querySelectorAll(s)); };
  var textos = function (s, r) { return qa(s, r).map(function (e) { return limpio(e.textContent); }); };

  var titulos = qa('.quote-block-title');
  var bloqueDe = function (texto) {
    for (var i = 0; i < titulos.length; i++) if (limpio(titulos[i].textContent) === texto) return titulos[i].parentElement;
    return null;
  };
  var botonPorTexto = function (texto, dentro) {
    var bs = qa('button', dentro || izq);
    for (var i = 0; i < bs.length; i++) if (limpio(bs[i].textContent) === texto) return bs[i];
    return null;
  };
  var textoIzq = izq.innerText || '';
  var textoDer = der ? (der.innerText || '') : '';
  var submit = q('.quote-block-actions .btn-primary');
  var addLine = q('.quote-add-line');
  var hermanosDeAddLine = addLine && addLine.parentElement ? textos('button', addLine.parentElement) : [];

  // menu de la primera linea: los items solo existen tras abrirlo; aqui se mira si el boton esta
  var menuLinea = q('.quote-line .overflow-menu__trigger, .quote-line [aria-haspopup]');

  var lineas = qa('.quote-line');
  var primera = lineas[0] || null;
  // La ficha de ajustes de la linea (el texto vivo «IVA 21 %»): visible en una linea POR DEFECTO?
  var fichaPrimera = primera ? q('.quote-line__ajustes, .quote-line__ficha, .quote-line-settings', primera) : null;

  return {
    // --- pasos y estructura
    titulos: titulos.map(function (t) { return { texto: limpio(t.textContent), visible: ve(t) }; }),
    guias: qa('.quote-paso__guia').length,
    guiasVisibles: qa('.quote-paso__guia').filter(ve).length,
    visibles: {
      cliente: ve(q('select[name="customer_id"]')),
      concepto: ve(q('.quote-line .quote-line__concept input')),
      condiciones: ve(q('select[name="payment_terms"]')) || qa('label, span').some(function (el) { return limpio(el.textContent) === 'Condiciones de pago' && ve(el); }),
      generar: ve(submit),
      ivaDefecto: ve(q('select[name="vat_default"]')),
      pagoSelect: ve(q('select[name="payment_terms"]')),
    },
    continuar: (function () { var b = qa('button').filter(function (x) { return limpio(x.textContent) === 'Continuar' && ve(x); })[0]; return b ? { disabled: b.disabled } : null; })(),
    submit: submit ? { texto: limpio(submit.textContent), disabled: submit.disabled, visible: ve(submit) } : null,
    botonesVisiblesIzq: qa('button').filter(ve).map(function (b) { return limpio(b.textContent); }),

    // --- A · cabecera
    h2: (function () { var h = q('h2', document.body); return h ? limpio(h.textContent) : null; })(),
    subtituloViejo: (function () { var p = q('.quotes-desc'); return !!p && ve(p); })(),
    // 🔴 POR IDENTIDAD, NO POR TEXTO. La primera versión buscaba /NIF|Cargando datos de empresa/ en
    // el innerText, y daba FALSO con los datos DELANTE: el merchant del banco no tiene NIF y el
    // rótulo de carga ya se había sustituido. El elemento es '.quotes-merchant-info'.
    datosEmpresaIzq: (function () { var p = q('.quotes-merchant-info'); return !!p && ve(p); })(),
    datosEmpresaDer: !!(der && der.querySelector('.quotes-merchant-info')),
    guardadoJuntoAlTitulo: (function () {
      var e = qa('span').filter(function (s) { return limpio(s.textContent).indexOf('Guardado automaticamente') >= 0 || limpio(s.textContent).indexOf('Guardado automáticamente') >= 0; })[0];
      if (!e) return null;
      // 🔴 El encabezado es 'div.quotes-header-block', NO el h2. Preguntarle al h2 si
      // contiene el aviso daba «no» con el aviso dentro del encabezado: defecto de la sonda.
      var h = document.querySelector('.quotes-header-block');
      return { existe: true, dentroDelHeading: !!(h && h.contains(e)) };
    })(),

    // --- B · cliente
    selectorEsSelect: !!q('select[name="customer_id"]'),
    botonesDeCoincidencia: qa('.quote-cliente-opcion, .quote-customer-option, button[data-customer-id]').length,
    nuevoCliente: !!botonPorTexto('+ Nuevo cliente') || textoIzq.indexOf('+ Nuevo cliente') >= 0,

    // --- C · lineas
    numLineas: lineas.length,
    fichasPlantillaEnVista: qa('.quote-template-card, .template-card').length
      + (textoIzq.indexOf('Empieza con una plantilla') >= 0 ? 1 : 0)
      + (textoIzq.indexOf('Anadir una plantilla') >= 0 || textoIzq.indexOf('Añadir una plantilla') >= 0 ? 1 : 0),
    conceptosMasUsadosBloque: textoIzq.indexOf('Tus conceptos mas usados') >= 0 || textoIzq.indexOf('Tus conceptos más usados') >= 0,
    hermanosDeAddLine: hermanosDeAddLine,
    hayAsa: qa('.quote-line__drag, .quote-line .drag-handle').length,
    hayMenuLinea: !!menuLinea,
    fichaIvaEnLineaPorDefecto: !!fichaPrimera && ve(fichaPrimera),
    // 🔴 SOLO innerHTML, y una vez. La primera versión sumaba las coincidencias del innerText Y
    // las del innerHTML: contaba dos veces cada marcador visible. Y se cuentan POR SITIO, porque
    // tres filas distintas del inventario hablan de tres marcadores distintos.
    // 🔴 SE MIDE EL RÓTULO DEL CONTROL, NO SI SE VE. Los dos «tira pactada» viven dentro de filas
    // de Condiciones que llegan CERRADAS (915d), y la etiqueta de la descripción vive en la hoja de
    // ajustes de la línea, que se abre a demanda. Preguntar por VISIBILIDAD daba «ya está» con el
    // marcador puesto — un verde sobre población vacía. Lo que la fila del inventario pregunta es
    // si el marcador se ha sustituido por texto firmado, y eso está en el rótulo, se vea o no.
    marcadores: (function () {
      var MARCA = '[PENDIENTE microcopy oficial]';
      var re = /\\[PENDIENTE microcopy oficial\\]/g;
      var enDoc = (document.body.innerHTML.match(re) || []).length;
      var dePago = document.querySelector('.quote-propuesta-pago button');
      var deDto = document.querySelector('.quote-propuesta-dto__texto');
      var deDtoBtn = document.querySelector('.quote-propuesta-dto button');
      var etiquetaDesc = document.querySelector('.quote-line__descripcion .quote-line__label');
      return {
        enTodoElDocumento: enDoc,
        rotuloDescripcion: etiquetaDesc ? limpio(etiquetaDesc.textContent) : null,
        descripcionConMarca: !!etiquetaDesc && etiquetaDesc.textContent.indexOf(MARCA) >= 0,
        tiraPagoExiste: !!dePago,
        tiraPagoRotulo: dePago ? limpio(dePago.textContent) : null,
        tiraDtoExiste: !!deDto,
        tiraDtoTexto: deDto ? limpio(deDto.textContent) : null,
        tiraDtoBoton: deDtoBtn ? limpio(deDtoBtn.textContent) : null,
      };
    })(),

    // --- resumenes de paso (915d)
    textoCliente: (function () { var b = bloqueDe('Cliente'); return b ? limpio(b.innerText) : null; })(),
    textoConceptos: (function () { var b = bloqueDe('Conceptos'); return b ? limpio(b.innerText) : null; })(),
    textoCondiciones: (function () { var b = bloqueDe('Condiciones'); return b ? limpio(b.innerText) : null; })(),
    ajustes: (function () {
      var a = bloqueDe('Ajustes del documento');
      if (!a) return null;
      var b = botonPorTexto('Cambiar', a) || botonPorTexto('Listo', a);
      return { texto: limpio(a.innerText), expandido: b ? b.getAttribute('aria-expanded') : null, boton: b ? limpio(b.textContent) : null };
    })(),
    filasCambiar: qa('button').filter(function (b) { return limpio(b.textContent) === 'Cambiar'; }).length,

    // --- H · acciones y menu de arriba
    menuSuperior: (function () {
      // El caracter del menu se construye en ejecucion (A22: nada de escapes \\u escritos a mano).
      var PUNTOS = String.fromCharCode(0x22ef);
      var cab = document.querySelector('.quotes-left-card');
      var cands = qa('button', cab).filter(function (b) {
        var t = limpio(b.textContent);
        return (t === '...' || t === PUNTOS || t === 'Mas' || t === 'Más') && ve(b);
      });
      return cands.length;
    })(),
    guardarPlantillaVisible: (function () { var b = botonPorTexto('💾 Guardar como plantilla'); return !!b && ve(b); })(),
    limpiarVisible: (function () { var b = botonPorTexto('Limpiar formulario'); return !!b && ve(b); })(),

    // --- I/J · derecha
    tituloDerecha: (function () { var h = document.querySelector('.quote-preview-title'); return h ? limpio(h.textContent) : null; })(),
    hayPreview: !!document.querySelector('.quote-preview'),
    previewResalta: qa('.is-activo, .is-editando, .quote-preview--resalta', der || document.body).length,
    pieFijo30dias: textoDer.indexOf('valido durante 30 dias') >= 0 || textoDer.indexOf('válido durante 30 días') >= 0,
    panelEstado: !!document.querySelector('.quote-status-box'),
    totalesEnLaDerecha: /Base imponible/.test(textoDer),
    totalesEnLaIzquierda: /Base imponible/.test(textoIzq),
    totalPorLineaEnLaDerecha: (function () {
      var celdas = qa('td, .quote-preview-line__total', der || document.body);
      return celdas.some(function (c) { return /\\d+,\\d\\d\\s*(€|EUR)/.test(limpio(c.textContent)); });
    })(),

    // --- modal / hoja
    modalVisible: qa('.modal-overlay', document.body).some(ve),
    hojaEnvio: (function () {
      var t = document.body.innerText || '';
      return {
        enviarWhatsApp: t.indexOf('Enviar por WhatsApp') >= 0,
        loEnvioLuego: t.indexOf('Lo envio luego') >= 0 || t.indexOf('Lo envío luego') >= 0,
        copiarEnlace: t.indexOf('Copiar enlace') >= 0,
        abrirPdfNuevaPestana: t.indexOf('Abrir PDF en nueva pesta') >= 0,
        seguirEditando: t.indexOf('Seguir editando') >= 0,
        mensajeDelCliente: t.indexOf('Tocalo para verlo y responder') >= 0 || t.indexOf('Tócalo para verlo y responder') >= 0,
      };
    })(),

    // --- movil
    barraInferiorFija: (function () {
      var c = qa('*', document.body).filter(function (e) {
        var cs = getComputedStyle(e);
        return (cs.position === 'fixed' || cs.position === 'sticky') && ve(e) && /€/.test(e.innerText || '');
      });
      return c.length;
    })(),
    verDocumento: (document.body.innerText || '').indexOf('Ver documento') >= 0,

    // --- censo de hoy (control positivo)
    inventario915d: inventario.map(function (f) { return { nombre: f[0], hay: izq.querySelectorAll(f[1]).length, hacen: f[2] }; }),
    total: (function () { var e = document.querySelector('.quote-total-kpi__cifra'); return e ? limpio(e.textContent) : null; })(),
    desbordaLado: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
`);

const PULSAR = new Function('texto', 'enBloque', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var raiz = document.querySelector('.quotes-left-card');
  if (!raiz) return 'sin-editor';
  var ambito = raiz;
  if (enBloque) {
    ambito = null;
    var ts = raiz.querySelectorAll('.quote-block-title');
    for (var i = 0; i < ts.length; i++) if (limpio(ts[i].textContent) === enBloque) ambito = ts[i].parentElement;
    if (!ambito) return 'sin-bloque';
  }
  var bs = ambito.querySelectorAll('button');
  for (var j = 0; j < bs.length; j++) {
    var b = bs[j];
    if (limpio(b.textContent) === texto && b.checkVisibility()) {
      b.scrollIntoView({ block: 'center', behavior: 'instant' });
      b.click();
      return b.disabled ? 'deshabilitado' : 'pulsado';
    }
  }
  return 'no-encontrado';
`);

const ABRIR_MENU_LINEA = new Function(`
  var l = document.querySelector('.quote-line');
  if (!l) return { error: 'sin linea' };
  // 🔴 EL TRIGGER ES \`.overflow-trigger\` Y LOS ITEMS SON BOTONES SUELTOS DENTRO DE UN
  // \`[role="menu"]\` que monta \`overflowMenu\` en api.js: no llevan \`role="menuitem"\` ni clase. La
  // primera versión los buscaba por \`.overflow-menu__item, [role="menuitem"]\` y devolvía [] con el
  // menú ABIERTO delante — un cero que se leía como «el menú no tiene nada».
  // 🔴 PRIMERO POR CLASE, Y SOLO DESPUÉS POR ATRIBUTO, Y ADEMÁS QUE SEA UN BOTÓN. Una lista de
  // selectores en querySelector NO tiene prioridad: devuelve el PRIMERO del documento. Dentro de
  // una línea, el input del autocompletado lleva aria-haspopup y va ANTES que el menú, así que la
  // primera versión pulsaba el input, no abría nada, y el [] resultante se leía como «el menú está
  // vacío». Un rojo que no era del producto.
  var t = l.querySelector('.overflow-trigger') || l.querySelector('button[aria-haspopup]');
  if (!t) return { error: 'sin trigger' };
  t.click();
  var limpio = function (x) { return String(x || '').replace(/\\s+/g, ' ').trim(); };
  var panel = document.querySelector('[role="menu"]');
  if (!panel) return { error: 'el trigger no abrio ningun [role=menu]', abierto: t.getAttribute('aria-expanded') };
  var items = Array.prototype.slice.call(panel.querySelectorAll('button, a'))
    .filter(function (e) { return e.checkVisibility(); })
    .map(function (e) { return limpio(e.textContent); });
  return { items: items, abierto: t.getAttribute('aria-expanded') };
`);

// La hoja «Ajustes de la línea» se abre desde la FICHA de la línea (el texto vivo «IVA 21 %»),
// no desde el menú «...»: hoy el menú no la ofrece. Se abre para poder juzgar el rótulo de su
// campo de descripción, que con la hoja cerrada no está en el documento.
const ABRIR_AJUSTES_LINEA = new Function(`
  var l = document.querySelector('.quote-line');
  if (!l) return { error: 'sin linea' };
  var limpio = function (x) { return String(x || '').replace(/\\s+/g, ' ').trim(); };
  var bs = Array.prototype.slice.call(l.querySelectorAll('button'));
  for (var i = 0; i < bs.length; i++) {
    if (/IVA\\s*\\d+\\s*%|Suplido/.test(limpio(bs[i].textContent)) && bs[i].checkVisibility()) {
      bs[i].click();
      return { pulsado: limpio(bs[i].textContent) };
    }
  }
  return { error: 'no encuentro la ficha de la linea', botones: bs.map(function (b) { return limpio(b.textContent); }) };
`);

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function teclear(pag, selector, texto) {
  const el = await pag.$(selector);
  if (!el) return false;
  await el.evaluate((e) => { e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.focus(); e.value = ''; });
  await pag.keyboard.type(texto);
  return true;
}

const ciegos = [];

/** Recorre el editor y devuelve las fotos de cada parada. */
async function recorrer(navegador, ancho, { suelto = false } = {}) {
  const etiqueta = `${suelto ? 'justificante' : 'presupuesto'} ${ancho}px`;
  const contexto = await navegador.createBrowserContext();
  const pag = await contexto.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(String(e.message || e)));
  const fotos = {};
  try {
    modoSuelto = suelto ? 'justificante' : 'no';
    await pag.setViewport({ width: ancho, height: 900, isMobile: ancho < 800, hasTouch: ancho < 800 });
    const ruta = suelto ? 'invoices-new' : 'quotes-new';
    await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#${ruta}`, { waitUntil: 'networkidle0' });
    const pintado = await pag.waitForSelector('.quote-line .quote-line__concept input', { timeout: 10000 }).then(() => true, () => false);
    if (!pintado) { ciegos.push(`${etiqueta} -> el editor no se pinto (errores: ${errores.join(' | ') || 'ninguno'})`); return null; }
    const conClientes = await pag.waitForFunction(
      new Function(`var s = document.querySelector('select[name="customer_id"]'); return !!s && s.querySelector('option[value="${CLIENTE.id}"]');`),
      { timeout: 10000 },
    ).then(() => true, () => false);
    if (!conClientes) { ciegos.push(`${etiqueta} -> la lista de clientes no llego al selector`); return null; }
    await espera(300);

    fotos.entrada = await pag.evaluate(FOTO, INVENTARIO_915D);
    if (fotos.entrada.error) { ciegos.push(`${etiqueta} -> ${fotos.entrada.error}`); return null; }

    // El menu de la linea: se abre en la ENTRADA no, que el paso de conceptos aun no esta abierto.
    // Se mide despues, ya en Conceptos.

    await pag.select('select[name="customer_id"]', String(CLIENTE.id));
    await espera(200);
    const rC = await pag.evaluate(PULSAR, 'Continuar', null);
    await espera(300);
    fotos.conceptos = await pag.evaluate(FOTO, INVENTARIO_915D);
    if (rC !== 'pulsado' || !fotos.conceptos.visibles.concepto) {
      ciegos.push(`${etiqueta} -> «Continuar» (${rC}) no abrio Conceptos; el recorrido no arranca`);
      return null;
    }
    fotos.menuLinea = await pag.evaluate(ABRIR_MENU_LINEA);
    await pag.keyboard.press('Escape');
    await espera(150);

    if (!await teclear(pag, '.quote-line .quote-line__concept input', 'Mano de obra (hora)')
      || !await teclear(pag, '.quote-line .quote-line__qty input', '6')
      || !await teclear(pag, '.quote-line .quote-line__price input', '38')) {
      ciegos.push(`${etiqueta} -> no encontre concepto, cantidad o precio de la primera linea`); return null;
    }
    await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
    await espera(350);
    fotos.conLinea = await pag.evaluate(FOTO, INVENTARIO_915D);
    if (!fotos.conLinea.total || fotos.conLinea.total === '0,00 €') {
      ciegos.push(`${etiqueta} -> lo tecleado no llego al total (${fotos.conLinea.total})`); return null;
    }

    // La hoja de ajustes de la linea, abierta: es el unico estado en que su campo de descripcion
    // (y su rotulo, que es lo que juzga la fila C.2) esta en el documento.
    fotos.aperturaAjustesLinea = await pag.evaluate(ABRIR_AJUSTES_LINEA);
    await espera(300);
    fotos.ajustesLinea = await pag.evaluate(FOTO, INVENTARIO_915D);
    await pag.keyboard.press('Escape');
    await espera(250);

    // Tecla N DENTRO del editor (fila «Teclado»): no debe abrir la Cotizacion rapida.
    await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
    await pag.keyboard.press('KeyN');
    await espera(300);
    fotos.trasTeclaN = await pag.evaluate(FOTO, INVENTARIO_915D);
    if (fotos.trasTeclaN.modalVisible) { await pag.keyboard.press('Escape'); await espera(200); }

    await pag.evaluate(PULSAR, 'Continuar', null);
    await espera(300);
    fotos.condiciones = await pag.evaluate(FOTO, INVENTARIO_915D);

    if (!suelto) {
      await pag.evaluate(PULSAR, 'Continuar', null);
      await espera(300);
    }
    fotos.revisar = await pag.evaluate(FOTO, INVENTARIO_915D);

    // H2 · pulsar la accion primaria DOS veces: cuantos presupuestos se crean?
    if (!suelto) {
      const antes = creaciones.length;
      await pag.evaluate(PULSAR, 'Generar presupuesto', null);
      await espera(900);
      fotos.trasGenerar = await pag.evaluate(FOTO, INVENTARIO_915D);
      const r2 = await pag.evaluate(PULSAR, 'Generar presupuesto', null);
      await espera(900);
      fotos.trasGenerarDosVeces = await pag.evaluate(FOTO, INVENTARIO_915D);
      fotos.creaciones = { antes, despues: creaciones.length, segundoClic: r2 };
    }
    fotos.errores = errores;
    return fotos;
  } finally {
    await contexto.close();
  }
}

// ═══ LOS PREDICADOS, uno por fila del inventario aprobado ════════════════════════════════════════
//
// La clave es el texto EXACTO de la columna «Hoy» de la fila. Se casa por identidad, no por
// posicion: renumerar el array no rompe nada, y una fila nueva del prototipo sale «sin predicado».
// Cada predicado devuelve { estado, prueba }. `estado`: 'ya' | 'falta' | 'parcial'.
const P = (estado, prueba) => ({ estado, prueba });

function predicados(f, m, ancho) {
  // f = fotos del presupuesto a 1280 · m = fotos del presupuesto a 390 (puede ser null)
  const entrada = f.entrada, conceptos = f.conceptos, conLinea = f.conLinea,
    cond = f.condiciones, rev = f.revisar, gen = f.trasGenerar, gen2 = f.trasGenerarDosVeces;

  return {
    'título «Crear presupuesto» / tituloModal()':
      P(entrada.h2 === 'Crear presupuesto' ? 'falta' : 'ya', `el h2 del editor dice «${entrada.h2}»; la v3 pide «Nuevo presupuesto» arriba del editor`),

    'subtítulo «Genera un presupuesto… link de pago por WhatsApp.»':
      P(!entrada.subtituloViejo && entrada.guias >= 3 ? 'ya' : (entrada.guias >= 3 ? 'parcial' : 'falta'),
        `subtítulo viejo presente=${entrada.subtituloViejo} · frases guía por paso=${entrada.guias}`),

    'datos de empresa':
      P(entrada.datosEmpresaDer && !entrada.datosEmpresaIzq ? 'ya' : (entrada.datosEmpresaDer ? 'parcial' : 'falta'),
        `datos de empresa en la izquierda=${entrada.datosEmpresaIzq} · en el documento de la derecha=${entrada.datosEmpresaDer}`),

    'aviso global': P('no-medible', 'la v3 dice «avisos donde ocurren + toasts»: no hay un estado del DOM que lo decida sin provocar cada error uno a uno'),

    'buscador «Buscar por nombre, teléfono, email o referencia…»':
      P(entrada.inventario915d.find((x) => x.nombre === 'buscador de cliente').hay >= 1 && entrada.visibles.cliente ? 'ya' : 'falta',
        `buscador presente y paso 1 abierto al entrar (pasos abiertos: ${['cliente', 'concepto', 'condiciones', 'generar'].filter((k) => entrada.visibles[k]).join(', ') || 'ninguno'})`),

    'select Cliente + «+ Nuevo cliente»':
      P(!entrada.selectorEsSelect && entrada.botonesDeCoincidencia > 0 ? 'ya' : 'falta',
        `sigue siendo un <select> (${entrada.selectorEsSelect}); botones grandes de coincidencia=${entrada.botonesDeCoincidencia}. «+ Nuevo cliente» presente=${entrada.nuevoCliente}`),

    '«Sin resultados para tu búsqueda»':
      P('no-medible', 'exige teclear una búsqueda sin coincidencias y el banco sólo sirve un cliente; se mide en el corte que la toque'),

    'Dirección de la obra + campo':
      P(cond.ajustes && cond.ajustes.expandido === 'false' ? 'ya' : 'falta',
        cond.ajustes ? `«Ajustes del documento» llega cerrado (aria-expanded=${cond.ajustes.expandido}) con resumen «${cond.ajustes.texto.slice(0, 70)}»` : 'no hay fila «Ajustes del documento» en Condiciones'),

    'IVA por defecto (%)':
      P(cond.ajustes && !cond.visibles.ivaDefecto ? 'ya' : 'falta',
        `el IVA por defecto se ve con Ajustes cerrado=${cond.visibles.ivaDefecto}`),

    'IVA del presupuesto':
      P(cond.ajustes && cond.ajustes.texto.indexOf('IVA sumado') >= 0 ? 'parcial' : 'falta',
        `resumen de Ajustes=«${cond.ajustes ? cond.ajustes.texto.slice(0, 70) : '—'}». La v3 pide además que EL DOCUMENTO lo refleje y arreglar que hoy no tiene oyente: eso es del documento vivo`),

    '«✨ Sugerir con IA»':
      P(conceptos.hermanosDeAddLine.some((t) => /Sugerir con IA/.test(t)) ? 'ya' : 'falta',
        `«✨ Sugerir con IA» está en el mismo contenedor que «+ Añadir línea», dentro del paso Conceptos. ⚠️ lo que se mide es el CONTENEDOR COMPARTIDO, no la adyacencia visual: esa la juzga la captura de AB6`),

    '🎤 Dictar': P('no-medible', 'vive dentro del modal de IA y depende de VOICE_QUOTE_ENABLED + SpeechRecognition + https: el banco no puede dárselos'),

    'sugerencias + «Esto lo hemos puesto nosotros…»':
      P('no-medible', 'exige una respuesta real de /admin/ai/suggest-quote; la fila pide además conservar «supuestos» en la línea hasta «Revisado», que hoy no existe en el DOM'),

    '«📋 Usar plantilla» + modal + fichas':
      P(conceptos.hermanosDeAddLine.some((t) => /Usar plantilla/.test(t)) && conceptos.fichasPlantillaEnVista === 0 ? 'ya' : 'falta',
        `«Usar plantilla» junto a «+ Añadir línea»=${conceptos.hermanosDeAddLine.some((t) => /Usar plantilla/.test(t))} · fichas de plantilla aún en la vista=${conceptos.fichasPlantillaEnVista}`),

    '«Tus conceptos más usados»':
      P('no-medible',
        `el bloque sólo se pinta si hay señal de uso (conceptos repetidos en presupuestos previos) y el banco no la sirve: medido, bloque en la vista=${conceptos.conceptosMasUsadosBloque}. Un «no está» aquí sería del banco, no del producto`),

    '3 líneas en blanco':
      P(entrada.numLineas === 1 ? 'ya' : 'falta', `al entrar hay ${entrada.numLineas} línea(s); la v3 pide UNA`),

    '«+ Añadir línea»': P(conceptos.hermanosDeAddLine.length > 0 ? 'ya' : 'falta', `«+ Añadir línea» presente en Conceptos`),

    'Concepto con autocompletado': P('ya', 'el autocompletado es de hoy y la v3 lo deja «igual»: no cambia en este rediseño'),

    'Cantidad · Precio · Total por línea':
      P(conLinea.totalPorLineaEnLaDerecha ? 'ya' : 'falta',
        `el total de cada línea se ve en el documento de la derecha=${conLinea.totalPorLineaEnLaDerecha}`),

    'ficha «IVA 21 % · Dto.» / «Suplido»':
      P(conLinea.fichaIvaEnLineaPorDefecto ? 'falta' : 'ya',
        `la ficha se ve en una línea que va con lo de siempre=${conLinea.fichaIvaEnLineaPorDefecto}; la v3 la quiere sólo si la línea NO va con lo de siempre`),

    'asa ⠿ (sólo ratón)':
      P(conLinea.hayAsa === 0 ? 'ya' : 'falta', `asas de arrastre en las líneas=${conLinea.hayAsa}; la v3 la retira`),

    'menú ⋯ Subir/Bajar/Eliminar':
      P(f.menuLinea && f.menuLinea.items && f.menuLinea.items.some((t) => /Ajustes/.test(t)) ? 'ya' : 'falta',
        `items del menú ⋯ de la línea: ${JSON.stringify(f.menuLinea && f.menuLinea.items || f.menuLinea)}; la v3 pide Ajustes · Subir · Bajar · Eliminar`),

    'Suplido · IVA % · Coste · Dto. % · Listo': P('ya', 'la v3 lo deja «igual»: la hoja de ajustes de la línea no cambia'),

    '«[PENDIENTE microcopy oficial] descripción»':
      (!f.ajustesLinea || f.ajustesLinea.marcadores.rotuloDescripcion === null)
        ? P('no-medible', `no pude abrir la hoja «Ajustes de la línea» para leer el rótulo de su campo de descripción (${JSON.stringify(f.aperturaAjustesLinea)})`)
        : P(f.ajustesLinea.marcadores.descripcionConMarca ? 'falta' : 'ya',
          `con la hoja de ajustes de la línea ABIERTA (se pulsó «${f.aperturaAjustesLinea.pulsado}»), el rótulo de su campo de descripción dice «${f.ajustesLinea.marcadores.rotuloDescripcion}»`),

    'Condiciones de pago (5)':
      P(cond.textoCondiciones && /Pago 100% al aceptar/.test(cond.textoCondiciones) && !cond.visibles.pagoSelect ? 'ya' : 'falta',
        `fila de cobro cerrada con su resumen=${cond.textoCondiciones ? cond.textoCondiciones.slice(0, 70) : '—'} · el selector se ve=${cond.visibles.pagoSelect}`),

    'Tramos de cobro':
      P('no-medible', 'vive dentro de «Cambiar» con «Plan personalizado»: hace falta cambiar la condición de pago, que es otro gesto del recorrido; se mide en el corte que lo toque'),

    'Válido hasta + 7/14/30 días + nota':
      P(rev.textoCondiciones && /válido hasta \d{2}\/\d{2}\/\d{4}/.test(rev.textoCondiciones) && !rev.pieFijo30dias ? 'ya' : 'parcial',
        `resumen de Condiciones=«${rev.textoCondiciones ? rev.textoCondiciones.slice(0, 80) : '—'}» · el pie fijo «válido durante 30 días» sigue en el documento=${rev.pieFijo30dias}`),

    'Formas de pago + notas IBAN y 0,9 %':
      P(cond.textoCondiciones && /Formas de pago/.test(cond.textoCondiciones) && cond.filasCambiar >= 3 ? 'ya' : 'falta',
        `filas con «Cambiar» en Condiciones=${cond.filasCambiar} · resumen=«${cond.textoCondiciones ? cond.textoCondiciones.slice(0, 80) : '—'}»`),

    'tira de pagos pactados + «[PENDIENTE…]»':
      !cond.marcadores.tiraPagoExiste
        ? P('no-medible', 'la tira .quote-propuesta-pago no está en el documento ni con un cliente que lleva payMethodsPorDefecto: no puedo juzgar su rótulo')
        : P(cond.marcadores.tiraPagoRotulo === 'Aplicar' ? 'ya' : 'falta',
          `el botón de la tira de pagos pactados dice «${cond.marcadores.tiraPagoRotulo}»; la v3 lo quiere dentro de «Cambiar» y rotulado «Aplicar»`),

    'Datos del cliente en el documento + Razón social / Nombre comercial':
      P(cond.ajustes ? 'ya' : 'falta', `los datos del cliente viven en «Ajustes del documento»=${!!cond.ajustes}`),

    'Incluir descripción en el PDF':
      P(cond.ajustes ? 'ya' : 'falta', `«incluir descripción» dentro de «Ajustes del documento»=${!!cond.ajustes}`),

    'Base, IVA, Suma, Descuento':
      P(conLinea.totalesEnLaDerecha && !conLinea.totalesEnLaIzquierda ? 'ya' : 'falta',
        `«Base imponible» en el documento de la derecha=${conLinea.totalesEnLaDerecha} · todavía en el editor de la izquierda=${conLinea.totalesEnLaIzquierda}`),

    '«+ Añadir descuento» → Descuento global':
      P(conceptos.hermanosDeAddLine.some((t) => /Añadir descuento/.test(t)) ? 'ya' : 'falta',
        `botones en el contenedor de «+ Añadir línea»: ${JSON.stringify(conceptos.hermanosDeAddLine)} — «+ Añadir descuento» no está entre ellos: hoy vive en el bloque de totales`),

    'tira del descuento pactado «[PENDIENTE…]» ×2':
      !conLinea.marcadores.tiraDtoExiste
        ? P('no-medible', 'la tira .quote-propuesta-dto no está en el documento ni con un cliente que lleva dtoPorDefecto=10: no puedo juzgar sus dos rótulos')
        : P(/Este cliente tiene pactado/.test(conLinea.marcadores.tiraDtoTexto || '') && conLinea.marcadores.tiraDtoBoton === 'Aplicar a las líneas' ? 'ya' : 'falta',
          `la tira del descuento pactado dice «${conLinea.marcadores.tiraDtoTexto}» y su botón «${conLinea.marcadores.tiraDtoBoton}»; la v3 pide «Este cliente tiene pactado un descuento del N %» + «Aplicar a las líneas»`),

    '«Generar presupuesto» / «Emitir justificante»':
      P(rev.submit && rev.submit.texto === 'Guardar y enviar' ? 'ya' : 'falta',
        `el botón del último paso dice «${rev.submit ? rev.submit.texto : '—'}»; la v3 pide «Guardar y enviar», que abre la HOJA DE ENVÍO`),

    'Generar dos veces = dos presupuestos':
      P(f.creaciones && f.creaciones.despues - f.creaciones.antes <= 1 ? 'ya' : 'falta',
        `pulsar la acción primaria dos veces creó ${f.creaciones ? f.creaciones.despues - f.creaciones.antes : '?'} presupuesto(s) (segundo clic: ${f.creaciones ? f.creaciones.segundoClic : '?'})`),

    '«Limpiar formulario» (sin confirmar)':
      P(rev.menuSuperior > 0 && !rev.limpiarVisible ? 'ya' : 'falta',
        `menús «⋯» arriba del editor=${rev.menuSuperior} · «Limpiar formulario» suelto en el último paso=${rev.limpiarVisible}`),

    '«💾 Guardar como plantilla»':
      P(rev.menuSuperior > 0 && !rev.guardarPlantillaVisible ? 'ya' : 'falta',
        `menús «⋯» arriba=${rev.menuSuperior} · «Guardar como plantilla» suelto en el último paso=${rev.guardarPlantillaVisible}`),

    '«✓ Guardado automáticamente»':
      P(entrada.guardadoJuntoAlTitulo && entrada.guardadoJuntoAlTitulo.dentroDelHeading ? 'ya' : 'falta',
        `«Guardado automáticamente» junto al título=${JSON.stringify(entrada.guardadoJuntoAlTitulo)}`),

    '«Vista previa del documento» (no interactiva, incompleta, se «rompe»)':
      P(entrada.tituloDerecha === 'Vista previa del documento' ? 'falta' : 'parcial',
        `el título de la derecha sigue siendo «${entrada.tituloDerecha}» · resaltes de la zona editada=${conLinea.previewResalta} · «Ver documento» en móvil=${m ? m.conLinea.verDocumento : 'no medido'}`),

    '«Estado del presupuesto»':
      P(gen && !gen.panelEstado ? 'ya' : 'falta',
        `el panel «Estado del presupuesto» sigue en la derecha=${gen ? gen.panelEstado : '?'}; la v3 lo lleva al documento y al propio paso`),

    '«Enviar por WhatsApp», «✉ Enviar por email», «⬇ Descargar PDF»':
      P(gen && gen.hojaEnvio.mensajeDelCliente && gen.hojaEnvio.copiarEnlace && gen.hojaEnvio.loEnvioLuego ? 'ya' : 'falta',
        gen ? `tras generar: modal visible=${gen.modalVisible} · enseña el mensaje al cliente=${gen.hojaEnvio.mensajeDelCliente} · «Copiar enlace»=${gen.hojaEnvio.copiarEnlace} · «Lo envío luego»=${gen.hojaEnvio.loEnvioLuego}` : 'no se llegó a generar'),

    '—':
      P('no-medible', 'la fila dice que el texto del mensaje es la plantilla firmada quote_decision_es: se comprueba cuando exista la hoja de envío que lo pinta'),

    'mismo editor sin condiciones/envío/descuentos': null,   // se evalúa con las fotos del justificante
    '«Abrir PDF en nueva pestaña», «Seguir editando»':
      P(gen && !gen.hojaEnvio.abrirPdfNuevaPestana && !gen.hojaEnvio.seguirEditando ? 'ya' : 'falta',
        gen ? `tras generar siguen «Abrir PDF en nueva pestaña»=${gen.hojaEnvio.abrirPdfNuevaPestana} y «Seguir editando»=${gen.hojaEnvio.seguirEditando}` : 'no se llegó a generar'),

    'pendiente de aprobación (técnico por encima de su límite)':
      P('no-medible', 'exige un usuario con límite de aprobación y la respuesta del servidor que lo declara; el banco no lo monta'),

    'N dentro del editor abre la Cotización rápida':
      P(f.trasTeclaN && !f.trasTeclaN.modalVisible ? 'ya' : 'falta',
        `pulsar N con el editor abierto deja un modal encima=${f.trasTeclaN ? f.trasTeclaN.modalVisible : '?'}`),

    'G · KPI del total':
      P(conLinea.visibles.concepto && conLinea.total && (!m || m.conLinea.barraInferiorFija > 0) ? 'ya' : 'parcial',
        `KPI en Conceptos=${conLinea.total} · elementos fijos con importe a 390 px=${m ? m.conLinea.barraInferiorFija : 'no medido'} · «Ver documento» a 390=${m ? m.conLinea.verDocumento : 'no medido'}`),
  };
}

// ═══ EJECUCIÓN ═══════════════════════════════════════════════════════════════════════════════════
const srv = await arrancarServidor();
let navegador;
let f1280 = null, f390 = null, fSuelto = null;
let inventario = [];
try {
  inventario = leerInventarioAprobado();
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  f1280 = await recorrer(navegador, 1280);
  f390 = await recorrer(navegador, 390);
  fSuelto = await recorrer(navegador, 1280, { suelto: true });
} catch (e) {
  ciegos.push('la sonda reventó: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

const filasContenido = inventario.filter((r) => r.length > 1);
const grupos = inventario.filter((r) => r.length === 1);

console.log('');
console.log('  SCRUM-915 · PASO 0 — QUÉ PARTE DE LA v3 APROBADA ESTÁ YA EN LA PANTALLA DE HOY');
console.log(`  POBLACIÓN: ${filasContenido.length} filas de contenido en ${grupos.length} grupos, leídas del array INV`);
console.log(`             de docs/prototipos/SCRUM-915/editor-presupuesto.html (el prototipo APROBADO).`);
console.log(`  RECORRIDOS: presupuesto 1280 ${f1280 ? 'OK' : 'NO'} · presupuesto 390 ${f390 ? 'OK' : 'NO'} · justificante 1280 ${fSuelto ? 'OK' : 'NO'}`);

if (!f1280) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «está todo hecho»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  console.log('\nEXIT=' + SALIDA_NO_SUPE_MEDIR);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}

// ── CONTROL POSITIVO 1: el instrumento ve los controles de hoy ──────────────────────────────────
const censo = f1280.entrada.inventario915d;
const vistos = censo.filter((x) => x.hay >= x.hacen).length;
console.log(`  CONTROL POSITIVO · el instrumento ve ${vistos}/${censo.length} controles del inventario de hoy (915d)`);
if (vistos < censo.length) {
  console.error('\n  🔴 CIEGO: no veo todos los controles de hoy, así que ningún «falta» de abajo vale:\n');
  for (const x of censo.filter((y) => y.hay < y.hacen)) console.error(`     · ${x.nombre}: veo ${x.hay}, hay ${x.hacen}`);
  console.log('\nEXIT=' + SALIDA_NO_SUPE_MEDIR);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}

const tabla = predicados(f1280, f390, 1280);

// El justificante tiene su propia fila.
if (fSuelto) {
  const t = fSuelto.revisar;
  tabla['mismo editor sin condiciones/envío/descuentos'] = P(
    // SCRUM-915g · «ya está» exige las DOS mitades: la fila en Revisar Y el IVA por defecto fuera de
    // Conceptos. Con sólo la primera, un IVA que se viera en los dos sitios saldría como hecho.
    t && t.ajustes && !fSuelto.conceptos.visibles.ivaDefecto ? 'ya' : 'parcial',
    `los pasos del justificante son ${JSON.stringify(fSuelto.entrada.titulos.filter((x) => x.visible).map((x) => x.texto))} · fila «Ajustes del documento» en Revisar=${!!(t && t.ajustes)} · el IVA por defecto se ve en Conceptos=${fSuelto.conceptos.visibles.ivaDefecto} (915g: tiene que ser false)`,
  );
} else {
  tabla['mismo editor sin condiciones/envío/descuentos'] = P('no-medible', 'el recorrido del justificante no arrancó');
}

// ── CONTROL POSITIVO 2: lo que 915d YA entregó tiene que salir «ya está» ────────────────────────
//
// Estas ocho filas están en la tabla «antes -> después» de `docs/master/SCRUM-915.md`, entraron en
// main con 915d y su guard de navegador las mide en verde. Si alguna sale FALTA, el que está mal es
// este instrumento, no el producto: un «falta» sobre algo que está en main es una sonda ciega.
const YA_ENTREGADAS_POR_915D = [
  'buscador «Buscar por nombre, teléfono, email o referencia…»',
  'Dirección de la obra + campo',
  'IVA por defecto (%)',
  'Condiciones de pago (5)',
  'Formas de pago + notas IBAN y 0,9 %',
  'Datos del cliente en el documento + Razón social / Nombre comercial',
  'Incluir descripción en el PDF',
  '«✓ Guardado automáticamente»',
];
const fallosDelControl2 = YA_ENTREGADAS_POR_915D
  .map((k) => ({ k, e: tabla[k] ? tabla[k].estado : 'sin-predicado' }))
  .filter((x) => x.e !== 'ya');
console.log(`  CONTROL POSITIVO 2 · de las ${YA_ENTREGADAS_POR_915D.length} filas que 915d entregó, salen «ya está» ${YA_ENTREGADAS_POR_915D.length - fallosDelControl2.length}`);
if (fallosDelControl2.length) {
  console.error('\n  🔴 CIEGO: doy por «no hecho» algo que está en main desde 915d, así que la sonda no mide lo que dice:\n');
  for (const x of fallosDelControl2) console.error(`     · ${x.k} -> ${x.e}`);
  console.log('\nEXIT=' + SALIDA_NO_SUPE_MEDIR);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}

const cuenta = { ya: 0, parcial: 0, falta: 0, 'no-medible': 0, 'sin-predicado': 0 };
const lineas = [];
let grupo = '';
for (const fila of inventario) {
  if (fila.length === 1) { grupo = fila[0]; lineas.push({ grupo: fila[0] }); continue; }
  const clave = fila[0];
  const p = tabla[clave];
  const r = p || P('sin-predicado', 'esta fila del prototipo aprobado no tiene predicado en la sonda: se declara, no se calla');
  cuenta[r.estado] = (cuenta[r.estado] || 0) + 1;
  lineas.push({ grupo, hoy: fila[0], v3: fila[1], nota: fila[2], estado: r.estado, prueba: r.prueba });
}

const ICONO = { ya: '✅ YA ESTÁ  ', parcial: '🟡 PARCIAL  ', falta: '🔴 FALTA    ', 'no-medible': '⬜ NO MEDIBLE', 'sin-predicado': '❓ SIN PREDICADO' };
console.log('');
for (const l of lineas) {
  if (l.grupo && !l.hoy) { console.log(`\n  ── ${l.grupo} ${'─'.repeat(Math.max(0, 76 - l.grupo.length))}`); continue; }
  console.log(`  ${ICONO[l.estado]} ${l.hoy}`);
  console.log(`                 ${l.prueba}`);
}

console.log('');
console.log('  ── RECUENTO ───────────────────────────────────────────────────────────────────');
console.log(`  ✅ ya está: ${cuenta.ya}  ·  🟡 parcial: ${cuenta.parcial}  ·  🔴 falta: ${cuenta.falta}  ·  ⬜ no medible: ${cuenta['no-medible']}  ·  ❓ sin predicado: ${cuenta['sin-predicado']}`);
console.log(`  suma = ${cuenta.ya + cuenta.parcial + cuenta.falta + cuenta['no-medible'] + cuenta['sin-predicado']} de ${filasContenido.length} filas de contenido`);
if (f1280.errores && f1280.errores.length) console.log(`  ⚠️ errores de página en el recorrido de 1280: ${f1280.errores.join(' | ')}`);
if (ciegos.length) { console.log('  ⚠️ recorridos que no se pudieron medir:'); for (const c of ciegos) console.log('     · ' + c); }

// Volcado en JSON para el expediente (el informe cita el fichero, no lo reescribe a mano).
const salida = path.join(RAIZ, 'docs', 'prototipos', 'SCRUM-915', 'paso0-medido.json');
fs.writeFileSync(salida, JSON.stringify({ poblacion: filasContenido.length, grupos: grupos.length, cuenta, lineas }, null, 2));
console.log(`  📄 detalle en ${path.relative(RAIZ, salida)}`);
console.log('');
console.log('EXIT=0');

// scripts/guard-pasos-del-editor.mjs — SCRUM-915d · EL EDITOR SE RECORRE POR PASOS, DE UNO EN UNO.
//
// Uso:  npm run guard:pasos-del-editor
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// La v3 del editor (aprobada por el fundador; `docs/prototipos/SCRUM-915/`) parte el formulario en
// pasos —Cliente → Conceptos → Condiciones → Revisar y enviar— con SÓLO EL ACTUAL ABIERTO. Hoy los
// cuatro bloques se ven a la vez: es el «mucha información en pantalla, muchas opciones de golpe» que
// el fundador señaló en SCRUM-915 comentario 15790.
//
// 🔴 SE MIDE EL ESTADO DESPUÉS DE PULSAR, NO LA CAPTURA. Una captura bonita no prueba que el botón
// funcione. Por eso cada paso se recorre con clics de verdad y lo que se juzga es QUÉ SE VE después:
// qué control representativo de cada paso está visible (`checkVisibility`), no qué clase lleva el
// bloque. Una clase la pone el mismo código que se está juzgando; que el campo se vea o no, no.
//
// ── LO QUE EXIGE (presupuesto, a 390 y a 1280 px) ────────────────────────────────────────────
//   🔴 A · al entrar, UN solo paso abierto: el del cliente. De los cuatro controles representativos
//          (selector de cliente · concepto de la 1.ª línea · condiciones de pago · «Generar
//          presupuesto») se ve UNO.
//   🔴 B · «Continuar» está DESHABILITADO sin cliente, dice por qué («Elige un cliente para seguir»),
//          y pulsarlo NO cambia de paso.
//   🔴 C · con cliente, «Continuar» abre Conceptos y el paso del cliente queda CERRADO con su
//          resumen (el nombre del cliente) y un «Cambiar».
//   🔴 D · en Conceptos, «Continuar» deshabilitado sin una línea válida; con una línea, abre
//          Condiciones y Conceptos resume «1 concepto · <total>».
//   🔴 E · en Condiciones, las filas llegan CERRADAS («Condiciones de pago · Pago 100% al aceptar ·
//          Cambiar»): el selector no se ve. «Ajustes del documento» llega cerrado, con su resumen
//          («IVA sumado · sin dirección de obra»), y al pulsar «Cambiar» se abre EN LA PÁGINA —sin
//          modal— con el IVA por defecto a la vista.
//   🔴 F · «Continuar» abre Revisar: «Generar presupuesto» visible y habilitado, y Condiciones
//          resume «Pago 100% al aceptar · válido hasta dd/mm/aaaa».
//   🔴 G · «Cambiar» en un paso cerrado lo reabre y cierra el que estaba abierto.
//   ✅ H · POSITIVO · EL INVENTARIO: todos los controles de hoy siguen EN EL DOCUMENTO en todo
//          momento (la lista sale de `docs/prototipos/SCRUM-915/inventario-hoy.md`). Se mide también
//          contra el código de antes: si ahí no da 100 %, el que está mal es este instrumento.
//   ⛔ I · NEGATIVO · sin scroll lateral.
//   🔴 J · SCRUM-915j · EL CLIENTE SE ELIGE POR BOTONES, con clics de verdad: al entrar hay 4 botones
//          (de 6 clientes) de ≥ 44 px que caben en pantalla y el <select> guardián NO se ve; pulsar
//          uno lo marca y lo guarda (y el foco se queda en el botón); una búsqueda deja al elegido y
//          trae al que casa aunque viva fuera de los cuatro primeros; sin resultados lo dice; y
//          «+ Nuevo cliente» abre el alta sin tocar al elegido. El select sigue EN EL DOCUMENTO (el
//          inventario lo cuenta) porque es el portador del valor.
//
// Documento suelto (justificante, 1280 px): TRES pasos —Cliente · Conceptos · Revisar y emitir—,
// sin Condiciones, y el IVA por defecto YA NO está en Conceptos (SCRUM-915g): vive en la fila «Ajustes
// del documento» del último paso, cerrada por defecto. Lo que esa fila hace al pulsarla lo mide
// `guard:ajustes-del-justificante`; aquí sólo se juzga el ANDAMIO: Conceptos no lo enseña.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si el editor no se pinta o la lista de clientes no llega al selector, sale con 2 (NO SUPE MEDIR),
// que NO es «está bien». Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// Lo que se juzga es qué VE el profesional después de pulsar, y eso sólo existe con el CSS resuelto.
// La red que SÍ corre siempre es `tests/scrum915d-pasos-del-editor.test.mjs`, que vigila el
// MECANISMO sobre el fuente (los pasos son los bloques, nada se mueve de sitio al abrir y cerrar).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// SCRUM-915j · el `public/` que se sirve puede cambiarse (como `GASTOS_PUBLICO` en `guard-lista-gastos`):
// es lo que permite CORRER ESTE GUARD CONTRA EL CÓDIGO DE ANTES —`git archive origin/main public`— y
// comprobar que cae. Un guard que nunca se ha visto en rojo no se sabe si mide.
const PUBLICO = process.env.PASOS_PUBLICO || path.join(RAIZ, 'public');
let PUERTO = Number(process.env.PASOS_PUERTO || 0);

const CLIENTE = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001', email: 'olivos@correo.es' };
// SCRUM-915j · SEIS clientes, no uno: el cliente se elige por BOTONES (hasta 4) y con uno solo no se
// puede medir ni el recorte a 4, ni que el elegido quepa cuando vive fuera de los cuatro primeros, ni la
// búsqueda. El de siempre va PRIMERO: el resto del recorrido sigue eligiéndolo a él.
const CLIENTES = [
  CLIENTE,
  { id: 8, name: 'Fincas García SL', phone: '34000000002', email: 'fincas@correo.es', internalRef: 'FG-01' },
  { id: 9, name: 'Reformas Ortega', phone: '34000000003', email: 'ortega@correo.es' },
  { id: 10, name: 'Bar El Puerto', phone: '34000000004', email: 'puerto@correo.es' },
  { id: 11, name: 'Taller Martín', phone: '34000000005', email: 'martin@correo.es' },
  { id: 12, name: 'Peluquería Lola', phone: '34000000006', email: 'lola@correo.es' },
];
let modoSuelto = 'no';
const me = () => ({
  id: 1, email: 'demo@yaqu.app', name: 'QA 915', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
  documentoSuelto: modoSuelto,
});
const MERCHANT = { id: 1, name: 'QA 915', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/admin/me') return json(res, me());
    if (u === '/admin/merchant') return json(res, MERCHANT);
    if (u === '/admin/customers') return json(res, CLIENTES);
    if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [] });
    const rel = u.replace(/^\//, '');
    const f = path.join(PUBLICO, rel);
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

// ── LO QUE CORRE DENTRO DE LA PÁGINA (en cadenas: censo de SCRUM-258) ────────────────────────
// El inventario de HOY (inventario-hoy.md, A–H) como selectores. Son los controles; los textos no
// se juzgan aquí. `todos` = cuántos tiene que haber de ese selector.
const INVENTARIO = [
  ['buscador de cliente', '.quote-buscador-cliente', 1],
  ['selector de cliente', 'select[name="customer_id"]', 1],
  ['dirección de la obra', 'select[name="shipping_address_mode"]', 1],
  ['dirección personalizada', 'input[name="shipping_address"]', 1],
  ['IVA por defecto', 'select[name="vat_default"]', 1],
  ['IVA del presupuesto', 'select[name="iva_modo"]', 1],
  ['+ Añadir línea', '.quote-add-line', 1],
  ['líneas', '.quote-line', 1],
  ['condiciones de pago', 'select[name="payment_terms"]', 1],
  ['válido hasta', '#quote-valid-until', 1],
  ['incluir descripción', 'input[name="include_description"]', 1],
  ['formas de pago + datos del cliente (casillas)', '.pay-methods-row input[type="checkbox"]', 7],
  ['razón social / nombre comercial', 'input[name="df-nombre"]', 2],
  ['descuento global', '.quote-dto-global', 1],
  ['total', '.quote-total-kpi', 1],
  ['acciones (Generar · Limpiar)', '.quote-block-actions .form-actions .btn', 2],
];
const INVENTARIO_SUELTO = [
  ['buscador de cliente', '.quote-buscador-cliente', 1],
  ['selector de cliente', 'select[name="customer_id"]', 1],
  ['IVA por defecto', 'select[name="vat_default"]', 1],
  ['+ Añadir línea', '.quote-add-line', 1],
  ['líneas', '.quote-line', 1],
  ['total', '.quote-total-kpi', 1],
  ['acciones (Emitir · Limpiar)', '.quote-block-actions .form-actions .btn', 2],
];

const MEDIR = new Function('inventario', `
  var raiz = document.querySelector('.quotes-left-card');
  if (!raiz) return { error: 'no hay .quotes-left-card' };
  var ve = function (el) { return !!el && el.isConnected && el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }); };
  var q = function (s) { return raiz.querySelector(s); };
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var titulos = Array.prototype.slice.call(raiz.querySelectorAll('.quote-block-title'));
  var bloqueDe = function (texto) {
    for (var i = 0; i < titulos.length; i++) if (limpio(titulos[i].textContent) === texto) return titulos[i].parentElement;
    return null;
  };
  var botonVisible = function (texto, dentro) {
    var bs = (dentro || raiz).querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) if (limpio(bs[i].textContent) === texto && ve(bs[i])) return bs[i];
    return null;
  };
  var continuar = botonVisible('Continuar');
  var submit = q('.quote-block-actions .btn-primary');
  var inv = inventario.map(function (fila) {
    return { nombre: fila[0], hay: raiz.querySelectorAll(fila[1]).length, hacen: fila[2] };
  });
  var ajustes = bloqueDe('Ajustes del documento');
  var botonAjustes = ajustes ? botonVisible('Cambiar', ajustes) || botonVisible('Listo', ajustes) : null;
  var textoDe = function (texto) { var b = bloqueDe(texto); return b ? limpio(b.innerText) : null; };
  var modalVisible = Array.prototype.slice.call(document.querySelectorAll('.modal-overlay')).some(ve);
  // El representante de CONDICIONES es su rótulo «Condiciones de pago» a la vista: con el código
  // de antes es la etiqueta del selector, y con pasos es la fila, que sólo se ve con el paso
  // abierto. ⚠️ La primera versión usaba «se ve el bloque de Condiciones», y un paso CERRADO
  // también se ve —es su fila de resumen—: daba «dos pasos abiertos» contra un editor sano.
  var rotuloCondiciones = Array.prototype.slice.call(raiz.querySelectorAll('label, span'))
    .some(function (el) { return limpio(el.textContent) === 'Condiciones de pago' && ve(el); });
  return {
    visibles: {
      // SCRUM-915j · el representante del paso del cliente es su LISTA DE BOTONES. El select
      // customer_id sigue en el DOM (el inventario lo cuenta) pero hidden: es el portador del
      // valor, y juzgar por él daría «el paso del cliente no se ve» aunque esté abierto.
      // (Sin acentos graves aquí dentro: esto vive en una plantilla de JS y los cierra.)
      cliente: ve(q('.quote-clientes')),
      concepto: ve(q('.quote-line .quote-line__concept input')),
      condiciones: ve(q('select[name="payment_terms"]')) || rotuloCondiciones,
      generar: ve(submit),
      ivaDefecto: ve(q('select[name="vat_default"]')),
      pagoSelect: ve(q('select[name="payment_terms"]'))
    },
    continuar: continuar ? { disabled: continuar.disabled } : null,
    faltaCliente: raiz.innerText.indexOf('Elige un cliente para seguir') >= 0,
    faltaLinea: raiz.innerText.indexOf('Falta al menos una línea con concepto, cantidad y precio') >= 0,
    submit: submit ? { texto: limpio(submit.textContent), disabled: submit.disabled } : null,
    titulos: titulos.filter(ve).map(function (t) { return limpio(t.textContent); }),
    textoCliente: textoDe('Cliente'),
    textoConceptos: textoDe('Conceptos'),
    textoCondiciones: textoDe('Condiciones'),
    ajustes: ajustes ? {
      texto: limpio(ajustes.innerText),
      expandido: botonAjustes ? botonAjustes.getAttribute('aria-expanded') : null,
      boton: botonAjustes ? limpio(botonAjustes.textContent) : null
    } : null,
    modalVisible: modalVisible,
    total: (function () { var e = document.querySelector('.quote-total-kpi__cifra'); return e ? limpio(e.textContent) : null; })(),
    inventario: inv,
    // SCRUM-915j · el cliente por BOTONES: qué se pinta, cuál está marcado, cuánto miden y qué guarda el
    // select escondido. Todo se lee del DOM renderizado, no del fuente.
    clientes: (function () {
      var lista = q('.quote-clientes');
      var sel = q('select[name="customer_id"]');
      var todosLosBotones = lista ? Array.prototype.slice.call(lista.querySelectorAll('button.quote-cliente-opcion')) : [];
      var botones = todosLosBotones.filter(function (b) { return !b.classList.contains('quote-cliente-opcion--nuevo'); });
      var alta = lista ? lista.querySelector('.quote-cliente-opcion--nuevo') : null;
      var nota = lista ? lista.querySelector('.quote-clientes__nota') : null;
      var cajas = todosLosBotones.map(function (b) { return b.getBoundingClientRect(); });
      var idDe = function (b) { return b.getAttribute('data-customer-id'); };
      return {
        hay: botones.length,
        ids: botones.map(idDe),
        marcados: botones.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(idDe),
        primero: botones[0] ? limpio(botones[0].textContent) : null,
        minAlto: cajas.length ? Math.min.apply(null, cajas.map(function (c) { return c.height; })) : 0,
        caben: cajas.every(function (c) { return c.left >= -1 && c.right <= document.documentElement.clientWidth + 1; }),
        altaVisible: !!alta && ve(alta),
        nota: nota ? limpio(nota.textContent) : null,
        selectVisible: ve(sel),
        selectValor: sel ? sel.value : null,
        foco: document.activeElement ? document.activeElement.getAttribute('data-customer-id') : null
      };
    })(),
    desbordaLado: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  };
`);

// Pulsa el botón VISIBLE con ese texto exacto (dentro del bloque cuyo título es `enBloque`, si se da).
const PULSAR = new Function('texto', 'enBloque', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var raiz = document.querySelector('.quotes-left-card');
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

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function teclear(pag, selector, texto) {
  const el = await pag.$(selector);
  if (!el) return false;
  await el.evaluate((e) => { e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.focus(); e.value = ''; });
  await pag.keyboard.type(texto);
  return true;
}

/** SCRUM-915j · el botón de UN cliente. El id sale del fixture, nunca del texto. */
const BOTON_CLIENTE = (id) => `.quote-cliente-opcion[data-customer-id="${id}"]`;

/** Pulsa el botón del cliente con un CLIC de verdad (puppeteer lo lleva a la vista y pulsa en su caja). */
async function pulsarCliente(pag, id) {
  const el = await pag.$(BOTON_CLIENTE(id));
  if (!el) return false;
  await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await el.click();
  return true;
}

/** Vacía el buscador de cliente CON su evento (`teclear` no lo lanza al vaciar) y teclea `texto`. */
async function buscarCliente(pag, texto) {
  const el = await pag.$('.quote-buscador-cliente');
  if (!el) return false;
  await el.evaluate((e) => {
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    e.focus();
    e.value = '';
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  if (texto) await pag.keyboard.type(texto);
  return true;
}

const hallazgos = [];
const ciegos = [];
const informe = [];

/** Los cuatro representativos: cuántos se ven a la vez. */
const abiertos = (m) => ['cliente', 'concepto', 'condiciones', 'generar'].filter((k) => m.visibles[k]);

function juzgarInventario(etiqueta, m, mal) {
  for (const f of m.inventario) {
    if (f.hay < f.hacen) mal.push(`INVENTARIO: «${f.nombre}» — hay ${f.hay} y hoy hay ${f.hacen}: una función se ha perdido`);
  }
  informe.push(`${etiqueta} · inventario ${m.inventario.filter((f) => f.hay >= f.hacen).length}/${m.inventario.length}`);
}

async function casoPresupuesto(navegador, ancho) {
  const etiqueta = `presupuesto ${ancho}px`;
  const contexto = await navegador.createBrowserContext();
  const pag = await contexto.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(String(e.message || e)));
  const mal = [];
  try {
    modoSuelto = 'no';
    await pag.setViewport({ width: ancho, height: 900, isMobile: ancho < 800, hasTouch: ancho < 800 });
    await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#quotes-new`, { waitUntil: 'networkidle0' });
    const pintado = await pag.waitForSelector('.quote-line .quote-line__concept input', { timeout: 10000 }).then(() => true, () => false);
    if (!pintado) { ciegos.push(`${etiqueta} → el editor no se pintó (errores: ${errores.join(' | ') || 'ninguno'})`); return; }
    const conClientes = await pag.waitForFunction(
      new Function(`var s = document.querySelector('select[name="customer_id"]'); return !!s && s.querySelector('option[value="${CLIENTE.id}"]');`),
      { timeout: 10000 },
    ).then(() => true, () => false);
    if (!conClientes) { ciegos.push(`${etiqueta} → la lista de clientes no llegó al selector`); return; }
    await espera(300);

    // A · al entrar, un paso abierto: el del cliente.
    let m = await pag.evaluate(MEDIR, INVENTARIO);
    if (m.error) { ciegos.push(`${etiqueta} → ${m.error}`); return; }
    juzgarInventario(etiqueta, m, mal);
    if (m.desbordaLado) mal.push('I · hay scroll lateral');
    const a = abiertos(m);
    if (a.length !== 1 || !m.visibles.cliente) {
      mal.push(`A · al entrar se ven ${a.length} pasos a la vez (${a.join(', ')}); tiene que verse UNO, el del cliente`);
      return; // sin pasos no hay recorrido que juzgar
    }

    // B · «Continuar» sin cliente.
    if (!m.continuar) { mal.push('B · no hay un «Continuar» visible en el paso del cliente'); return; }
    if (!m.continuar.disabled) mal.push('B · «Continuar» está habilitado sin cliente');
    if (!m.faltaCliente) mal.push('B · no dice «Elige un cliente para seguir»');
    await pag.evaluate(PULSAR, 'Continuar', null);
    await espera(200);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (!m.visibles.cliente || m.visibles.concepto) mal.push('B · pulsar «Continuar» sin cliente CAMBIÓ de paso');

    // J · SCRUM-915j · el cliente por BOTONES, antes de elegir a nadie.
    const c0 = m.clientes;
    const idsPrimeros = CLIENTES.slice(0, 4).map((c) => String(c.id));
    if (c0.hay !== 4 || c0.ids.join() !== idsPrimeros.join()) mal.push(`J · al entrar tiene que haber 4 botones de cliente (${idsPrimeros.join(',')}) y hay ${c0.hay} (${c0.ids.join(',')})`);
    if (!c0.primero || !c0.primero.includes(CLIENTE.name) || !c0.primero.includes(CLIENTE.phone)) mal.push(`J · el botón de cliente no dice nombre y teléfono («${c0.primero}»)`);
    if (c0.marcados.length) mal.push(`J · sin elegir a nadie hay botones marcados (${c0.marcados.join(',')})`);
    if (c0.selectVisible) mal.push('J · el select de clientes SE VE: los botones son el control y el select sólo guarda el valor');
    if (c0.minAlto < 44) mal.push(`J · un botón de cliente mide ${Math.round(c0.minAlto)} px de alto; el mínimo táctil es 44`);
    if (!c0.caben) mal.push('J · un botón de cliente se sale de la pantalla');
    if (!c0.altaVisible) mal.push('J · no se ve «+ Nuevo cliente»');

    // C · con cliente, ELEGIDO CON UN CLIC DE VERDAD sobre su botón (no con `select` a pelo).
    if (!await pulsarCliente(pag, 8)) { ciegos.push(`${etiqueta} → no encontré el botón del cliente 8`); return; }
    await espera(200);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (m.clientes.selectValor !== '8' || m.clientes.marcados.join() !== '8') mal.push(`J · pulsar el botón del cliente 8 dejó select=«${m.clientes.selectValor}» y marcados=[${m.clientes.marcados}]`);
    if (m.clientes.foco !== '8') mal.push(`J · tras pulsar, el foco no se queda en el botón (foco: ${m.clientes.foco}): con teclado se perdería`);
    // Cambiar de idea: el segundo clic mueve la marca, no la duplica.
    await pulsarCliente(pag, CLIENTE.id);
    await espera(200);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (m.clientes.selectValor !== String(CLIENTE.id) || m.clientes.marcados.join() !== String(CLIENTE.id)) mal.push(`J · volver a pulsar el cliente ${CLIENTE.id} dejó select=«${m.clientes.selectValor}» y marcados=[${m.clientes.marcados}]`);

    // J · búsqueda. El elegido (7) NO se cae aunque no case, y el que sí casa (12) aparece aunque viva
    // fuera de los cuatro primeros.
    if (!await buscarCliente(pag, 'lola')) { ciegos.push(`${etiqueta} → no encontré el buscador de cliente`); return; }
    await espera(200);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (m.clientes.ids.join() !== '7,12') mal.push(`J · buscando «lola» con el 7 elegido salen [${m.clientes.ids}]; tienen que ser el elegido y el que casa (7,12)`);
    if (m.clientes.marcados.join() !== '7') mal.push(`J · al buscar se pierde la marca del elegido (marcados=[${m.clientes.marcados}])`);
    if (m.clientes.nota) mal.push(`J · sale un aviso de «sin resultados» (${m.clientes.nota}) habiendo un cliente que casa`);
    await pulsarCliente(pag, 12);
    await espera(200);
    await buscarCliente(pag, '');
    await espera(200);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (m.clientes.selectValor !== '12') mal.push(`J · elegir al 12 desde la búsqueda dejó select=«${m.clientes.selectValor}»`);
    if (m.clientes.hay !== 4 || m.clientes.ids[0] !== '12' || m.clientes.marcados.join() !== '12') {
      mal.push(`J · con el 12 elegido (fuera de los 4 primeros) y la búsqueda vacía salen [${m.clientes.ids}] marcados=[${m.clientes.marcados}]; el elegido tiene que ir a la cabeza y ser 4 en total`);
    }
    // J · una búsqueda que no casa con nadie lo dice, aunque el elegido siga a la vista.
    await buscarCliente(pag, 'zzzz');
    await espera(200);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (m.clientes.nota !== 'Sin resultados para tu búsqueda') mal.push(`J · buscando «zzzz» el aviso es «${m.clientes.nota}»; tiene que ser «Sin resultados para tu búsqueda»`);
    if (!m.clientes.altaVisible) mal.push('J · sin resultados, «+ Nuevo cliente» no se ve');
    if (m.clientes.marcados.join() !== '12') mal.push(`J · sin resultados se pierde la marca del elegido (marcados=[${m.clientes.marcados}])`);
    await buscarCliente(pag, '');
    await espera(200);
    await pulsarCliente(pag, CLIENTE.id);
    await espera(200);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (m.clientes.selectValor !== String(CLIENTE.id)) mal.push(`J · tras el recorrido de la búsqueda el select guarda «${m.clientes.selectValor}»; tenía que ser ${CLIENTE.id}`);
    if (!m.continuar || m.continuar.disabled) mal.push('C · con cliente, «Continuar» sigue deshabilitado');
    const rC = await pag.evaluate(PULSAR, 'Continuar', null);
    await espera(300);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (rC !== 'pulsado' || !m.visibles.concepto || abiertos(m).length !== 1) {
      mal.push(`C · «Continuar» (${rC}) no abrió Conceptos como único paso (se ven: ${abiertos(m).join(', ')})`);
      return;
    }
    if (!m.textoCliente || !m.textoCliente.includes(CLIENTE.name)) mal.push(`C · el paso cerrado del cliente no resume el nombre («${m.textoCliente}»)`);
    if (!m.textoCliente || !m.textoCliente.includes('Cambiar')) mal.push('C · el paso cerrado del cliente no ofrece «Cambiar»');

    // D · Conceptos.
    if (!m.continuar || !m.continuar.disabled) mal.push('D · «Continuar» habilitado sin ninguna línea');
    if (!m.faltaLinea) mal.push('D · no dice «Falta al menos una línea con concepto, cantidad y precio»');
    if (!await teclear(pag, '.quote-line .quote-line__concept input', 'Mano de obra (hora)')
      || !await teclear(pag, '.quote-line .quote-line__qty input', '6')
      || !await teclear(pag, '.quote-line .quote-line__price input', '38')) {
      ciegos.push(`${etiqueta} → no encontré concepto, cantidad o precio de la primera línea`); return;
    }
    await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
    await espera(300);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (!m.total || m.total === '0,00 €') { ciegos.push(`${etiqueta} → lo tecleado no llegó al total (${m.total})`); return; }
    if (!m.continuar || m.continuar.disabled) mal.push('D · con una línea válida, «Continuar» sigue deshabilitado');
    await pag.evaluate(PULSAR, 'Continuar', null);
    await espera(300);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (!m.visibles.condiciones || m.visibles.concepto || m.visibles.cliente) {
      mal.push(`D · «Continuar» no abrió Condiciones como único paso (se ven: ${abiertos(m).join(', ')})`);
      return;
    }
    if (!m.textoConceptos || !m.textoConceptos.includes(`1 concepto · ${m.total}`)) mal.push(`D · Conceptos cerrado no resume «1 concepto · ${m.total}» («${m.textoConceptos}»)`);

    // E · Condiciones: filas cerradas y Ajustes del documento.
    if (m.visibles.pagoSelect) mal.push('E · el selector de condiciones de pago llega ABIERTO; la fila tiene que llegar cerrada');
    if (!m.textoCondiciones || !m.textoCondiciones.includes('Pago 100% al aceptar')) mal.push(`E · la fila de cobro no resume «Pago 100% al aceptar» («${m.textoCondiciones}»)`);
    if (!m.ajustes) mal.push('E · no hay fila «Ajustes del documento»');
    else {
      if (m.ajustes.expandido !== 'false') mal.push(`E · «Ajustes del documento» no llega cerrado (aria-expanded=${m.ajustes.expandido})`);
      if (!m.ajustes.texto.includes('IVA sumado · sin dirección de obra')) mal.push(`E · el resumen de Ajustes no es «IVA sumado · sin dirección de obra» («${m.ajustes.texto}»)`);
      if (m.visibles.ivaDefecto) mal.push('E · el IVA por defecto se ve con Ajustes cerrado');
      await pag.evaluate(PULSAR, 'Cambiar', 'Ajustes del documento');
      await espera(200);
      m = await pag.evaluate(MEDIR, INVENTARIO);
      if (!m.ajustes || m.ajustes.expandido !== 'true') mal.push('E · «Cambiar» no abrió «Ajustes del documento»');
      if (!m.visibles.ivaDefecto) mal.push('E · abierto Ajustes, el IVA por defecto no se ve');
      if (m.modalVisible) mal.push('E · Ajustes se abrió en un MODAL; tiene que abrirse en la página');
      await pag.evaluate(PULSAR, 'Listo', 'Ajustes del documento');
      await espera(200);
      m = await pag.evaluate(MEDIR, INVENTARIO);
      if (m.visibles.ivaDefecto) mal.push('E · «Listo» no cerró «Ajustes del documento»');
    }

    // F · Revisar.
    await pag.evaluate(PULSAR, 'Continuar', null);
    await espera(300);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (!m.visibles.generar || m.visibles.pagoSelect || m.visibles.concepto) {
      mal.push(`F · «Continuar» no abrió Revisar como único paso (se ven: ${abiertos(m).join(', ')})`);
    } else {
      if (!m.submit || m.submit.texto !== 'Generar presupuesto' || m.submit.disabled) mal.push(`F · el botón de Revisar no es «Generar presupuesto» habilitado (${JSON.stringify(m.submit)})`);
      if (!m.textoCondiciones || !/Pago 100% al aceptar · válido hasta \d{2}\/\d{2}\/\d{4}/.test(m.textoCondiciones)) mal.push(`F · Condiciones cerrado no resume «Pago 100% al aceptar · válido hasta dd/mm/aaaa» («${m.textoCondiciones}»)`);
    }
    juzgarInventario(`${etiqueta} (al final)`, m, mal);

    // G · «Cambiar» reabre.
    await pag.evaluate(PULSAR, 'Cambiar', 'Cliente');
    await espera(300);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (!m.visibles.cliente || m.visibles.generar || abiertos(m).length !== 1) mal.push(`G · «Cambiar» en Cliente no lo reabrió como único paso (se ven: ${abiertos(m).join(', ')})`);
    if (m.desbordaLado) mal.push('I · hay scroll lateral');

    // J · «+ Nuevo cliente» abre el alta y NO toca al elegido (SCRUM-591: es una acción, no un cliente).
    const antes = m.clientes.selectValor;
    await pag.click('.quote-cliente-opcion--nuevo');
    await espera(500);
    m = await pag.evaluate(MEDIR, INVENTARIO);
    if (!m.modalVisible) mal.push('J · «+ Nuevo cliente» no abrió el formulario de alta');
    if (m.clientes.selectValor !== antes) mal.push(`J · abrir el alta cambió al elegido de «${antes}» a «${m.clientes.selectValor}»`);
    if (errores.length) mal.push(`errores de página: ${errores.join(' | ')}`);
    informe.push(`${etiqueta} · recorrido completo`);
  } finally {
    if (mal.length) hallazgos.push({ etiqueta, mal });
    await contexto.close();
  }
}

async function casoSuelto(navegador, ancho) {
  const etiqueta = `justificante ${ancho}px`;
  const contexto = await navegador.createBrowserContext();
  const pag = await contexto.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(String(e.message || e)));
  const mal = [];
  try {
    modoSuelto = 'justificante';
    await pag.setViewport({ width: ancho, height: 900 });
    await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#invoices-new`, { waitUntil: 'networkidle0' });
    const pintado = await pag.waitForSelector('.quote-line .quote-line__concept input', { timeout: 10000 }).then(() => true, () => false);
    if (!pintado) { ciegos.push(`${etiqueta} → el editor no se pintó (errores: ${errores.join(' | ') || 'ninguno'})`); return; }
    await espera(400);
    let m = await pag.evaluate(MEDIR, INVENTARIO_SUELTO);
    if (m.error) { ciegos.push(`${etiqueta} → ${m.error}`); return; }
    juzgarInventario(etiqueta, m, mal);
    const a = abiertos(m);
    if (a.length !== 1 || !m.visibles.cliente) { mal.push(`A · al entrar se ven ${a.length} pasos a la vez (${a.join(', ')})`); return; }
    const esperados = ['Cliente', 'Conceptos', 'Revisar y emitir'];
    if (JSON.stringify(m.titulos) !== JSON.stringify(esperados)) mal.push(`los pasos del justificante son ${JSON.stringify(m.titulos)}; se esperaban ${JSON.stringify(esperados)}`);
    // SCRUM-915j · también en el justificante el cliente se elige pulsando su botón.
    if (!await pulsarCliente(pag, CLIENTE.id)) { ciegos.push(`${etiqueta} → no encontré el botón del cliente ${CLIENTE.id}`); return; }
    await espera(200);
    m = await pag.evaluate(MEDIR, INVENTARIO_SUELTO);
    if (m.clientes.selectValor !== String(CLIENTE.id) || m.clientes.marcados.join() !== String(CLIENTE.id)) mal.push(`J · pulsar el botón del cliente dejó select=«${m.clientes.selectValor}» y marcados=[${m.clientes.marcados}]`);
    await pag.evaluate(PULSAR, 'Continuar', null);
    await espera(300);
    m = await pag.evaluate(MEDIR, INVENTARIO_SUELTO);
    if (!m.visibles.concepto) mal.push('el justificante no abre Conceptos con «Continuar»');
    // SCRUM-915g · invertido: hasta 915g el IVA por defecto tenía que verse aquí; ahora tiene que
    // haberse ido a «Ajustes del documento», en «Revisar y emitir» (medido por su propio guard).
    if (m.visibles.ivaDefecto) mal.push('en el justificante el IVA por defecto SE VE en Conceptos; desde 915g vive en «Ajustes del documento», en Revisar y emitir');
    if (m.desbordaLado) mal.push('I · hay scroll lateral');
    if (errores.length) mal.push(`errores de página: ${errores.join(' | ')}`);
  } finally {
    if (mal.length) hallazgos.push({ etiqueta, mal });
    await contexto.close();
  }
}

const srv = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  await casoPresupuesto(navegador, 390);
  await casoPresupuesto(navegador, 1280);
  await casoSuelto(navegador, 1280);
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-915d · LOS PASOS DEL EDITOR (panel real, estado medido después de pulsar)');
console.log('  POBLACIÓN: 3 casos — presupuesto a 390 y 1280 px, justificante a 1280 px');
for (const l of informe) console.log('   · ' + l);

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «los pasos están bien»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
if (hallazgos.length) {
  console.error(`\n  🔴 EN ${hallazgos.length} DE 3 CASOS EL EDITOR NO SE RECORRE POR PASOS:\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.etiqueta}]`);
    for (const x of h.mal) console.error('       · ' + x);
  }
  process.exit(SALIDA_HALLAZGO);
}
console.log('\n  ✔ en los 3 casos: un paso abierto, «Continuar» sólo cuando se puede, resúmenes, «Cambiar» e inventario completo.\n');

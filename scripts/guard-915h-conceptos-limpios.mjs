#!/usr/bin/env node
/**
 * SCRUM-915h · LOS CONCEPTOS, MÁS LIMPIOS — medido en el árbol RENDERIZADO, después de pulsar.
 *
 * Guard de NAVEGADOR. Lo que vigila no se ve en el fuente:
 *
 *   ① el DESGLOSE DEL DESCUENTO sale en el DOCUMENTO de la derecha («Suma de líneas», «Descuento»,
 *      «Descuento global»), y sale ANTES de que el editor deje de pintarlo. Si se quitara del editor
 *      sin ponerlo en el documento, el descuento no se vería en ninguna parte.
 *   ② en Conceptos, el editor ya sólo enseña el TOTAL: el bloque de apoyo `.quote-totals` no existe.
 *   ③ el editor abre con UNA línea, y «+ Añadir descuento» va junto a «+ Añadir línea».
 *   ④ la ficha de la línea sólo se ve si la línea NO va con lo de siempre, y la hoja de ajustes se
 *      abre desde el menú ⋯ («Ajustes, Subir, Bajar, Eliminar línea»).
 *   ⑤ la tecla «N» dentro del editor NO abre la Cotización rápida encima; fuera, sí (control).
 *
 * Cada caso lleva su control: una cosa que TIENE que cambiar y una que NO.
 *
 * Salidas: 0 todo bien · 1 hallazgo · 2 no supe medir (ciego). Un ciego NUNCA sale como verde.
 * Todo lo que corre DENTRO de la página va en cadenas dentro de `new Function` (censo SCRUM-258).
 */
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
let PUERTO = Number(process.env.GUARD915H_PUERTO || 0);

// Teléfono en el rango imposible `34 0XX XXX XXX` (SCRUM-262).
const CLIENTE = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001', email: 'olivos@correo.es' };
const MERCHANT = { id: 1, name: 'QA 915h', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };

const me = () => ({
  id: 1, email: 'demo@yaqu.app', name: 'QA 915h', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
  documentoSuelto: 'no',
});

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
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

const PULSAR = new Function('texto', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var bs = document.querySelectorAll('button');
  for (var j = 0; j < bs.length; j++) {
    var b = bs[j];
    if (limpio(b.textContent) === texto && b.checkVisibility()) {
      b.scrollIntoView({ block: 'center', behavior: 'instant' });
      b.click();
      return b.disabled ? 'estaba-deshabilitado' : 'pulsado';
    }
  }
  return 'no-encontrado';
`);

/** El paso Conceptos del EDITOR: líneas, fichas, apoyo de totales, KPI y el sitio del descuento. */
const EDITOR = new Function(`
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var ve = function (el) { return !!el && el.isConnected && el.checkVisibility({ visibilityProperty: true }); };
  var lineas = Array.prototype.slice.call(document.querySelectorAll('.quote-lines > .quote-line'));
  var add = document.querySelector('.quote-add-line');
  var dto = document.querySelector('.quote-dto-global');
  var kpi = document.querySelector('.quote-total-kpi');
  return {
    lineas: lineas.length,
    fichas: lineas.map(function (l) {
      var f = l.querySelector('.quote-line__ajustes');
      return f ? { texto: limpio(f.textContent), visible: ve(f) } : null;
    }),
    apoyoEnElEditor: document.querySelectorAll('.quotes-left-card .quote-totals').length,
    apoyoVisible: Array.prototype.slice.call(document.querySelectorAll('.quotes-left-card .quote-totals')).some(ve),
    kpi: kpi ? limpio(kpi.textContent) : null,
    kpiVisible: ve(kpi),
    hayAddLine: !!add,
    addLineVisible: ve(add),
    dtoGlobalExiste: !!dto,
    dtoGlobalVisible: ve(dto),
    // «junto a»: mismo padre y el descuento justo detrás de «+ Añadir línea».
    dtoJuntoAAddLine: !!(add && dto && add.parentElement === dto.parentElement && add.nextElementSibling === dto),
    textoBotonDto: dto ? limpio((dto.querySelector('button') || {}).textContent || '') : null,
  };
`);

/** Las filas del bloque de totales del DOCUMENTO de la derecha, como pares [rótulo, cifra]. */
const TOTALES_DOC = new Function(`
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var b = document.querySelector('.quote-preview .preview-totals-block');
  if (!b) return null;
  return Array.prototype.slice.call(b.querySelectorAll('.preview-total-row')).map(function (r) {
    return [limpio((r.querySelector('span') || {}).textContent || ''), limpio((r.querySelector('strong') || {}).textContent || '')];
  });
`);

/** Abre el menú ⋯ de la línea N y devuelve sus ítems (textos). No pulsa ninguno. */
const ABRIR_MENU = new Function('n', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var l = document.querySelectorAll('.quote-lines > .quote-line')[n];
  if (!l) return null;
  var t = l.querySelector('.overflow-trigger');
  if (!t) return null;
  t.scrollIntoView({ block: 'center', behavior: 'instant' });
  t.click();
  var panel = document.querySelector('.overflow-menu, .overflow-sheet');
  if (!panel) return [];
  return Array.prototype.slice.call(panel.querySelectorAll('button')).map(function (b) { return limpio(b.textContent); });
`);

// Abre el menú ⋯ de la línea N y pulsa el ítem EN LA MISMA LLAMADA: el menú compartido se cierra
// solo con cualquier desplazamiento, y entre dos `evaluate` el propio puppeteer puede provocar uno
// (medido: el ítem estaba y la segunda llamada ya no encontraba el menú).
const PULSAR_EN_MENU = new Function('n', 'texto', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var l = document.querySelectorAll('.quote-lines > .quote-line')[n];
  var t = l && l.querySelector('.overflow-trigger');
  if (!t) return 'sin-disparador';
  if (t.getAttribute('aria-expanded') !== 'true') t.click();
  var panel = document.querySelector('.overflow-menu, .overflow-sheet');
  if (!panel) return 'sin-menu';
  var bs = panel.querySelectorAll('button');
  for (var i = 0; i < bs.length; i++) if (limpio(bs[i].textContent) === texto) { bs[i].click(); return 'pulsado'; }
  return 'no-encontrado';
`);

/** Escribe en un campo de la hoja de ajustes abierta, como lo haría el teclado, y avisa igual. */
const PONER_EN_HOJA = new Function('selector', 'valor', `
  var hoja = document.querySelector('.quote-ajustes-modal');
  if (!hoja) return 'sin-hoja';
  var el = hoja.querySelector(selector);
  if (!el) return 'sin-campo';
  el.value = valor;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'puesto';
`);

/** Cuántos overlays de modal hay a la vista (lo que la «N» abriría encima). */
const OVERLAYS = new Function(`
  return Array.prototype.slice.call(document.querySelectorAll('.modal-overlay'))
    .filter(function (o) { return o.isConnected && o.checkVisibility(); }).length;
`);

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const hallazgos = [];
const ciegos = [];
const informe = [];

async function teclear(pag, selector, texto) {
  const el = await pag.$(selector);
  if (!el) return false;
  await el.evaluate((e) => { e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.focus(); e.value = ''; });
  await pag.keyboard.type(texto);
  return true;
}

/** Deja el editor abierto en el paso Conceptos, con el cliente ya elegido. */
async function abrirEditor(pag, etiqueta) {
  await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#quotes-new`, { waitUntil: 'networkidle0' });
  const pintado = await pag.waitForSelector('.quote-line .quote-line__concept input', { timeout: 10000 }).then(() => true, () => false);
  if (!pintado) { ciegos.push(`${etiqueta} -> el editor no se pintó`); return false; }
  const conClientes = await pag.waitForFunction(
    new Function(`var s = document.querySelector('select[name="customer_id"]'); return !!s && s.querySelector('option[value="${CLIENTE.id}"]');`),
    { timeout: 10000 },
  ).then(() => true, () => false);
  if (!conClientes) { ciegos.push(`${etiqueta} -> la lista de clientes no llegó al selector`); return false; }
  await espera(250);
  await pag.select('select[name="customer_id"]', String(CLIENTE.id));
  await espera(200);
  if (await pag.evaluate(PULSAR, 'Continuar') !== 'pulsado') { ciegos.push(`${etiqueta} -> «Continuar» no llevó a Conceptos`); return false; }
  await espera(300);
  return true;
}

async function rellenarPrimera(pag, etiqueta, concepto, cant, precio) {
  const ok = await teclear(pag, '.quote-line .quote-line__concept input', concepto)
    && await teclear(pag, '.quote-line .quote-line__qty input', cant)
    && await teclear(pag, '.quote-line .quote-line__price input', precio);
  if (!ok) ciegos.push(`${etiqueta} -> no encontré concepto, cantidad o precio de la primera línea`);
  await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
  await espera(300);
  return ok;
}

const ITEMS_V3 = ['Ajustes (IVA, descuento, descripción…)', 'Subir', 'Bajar', 'Eliminar línea'];
/** Quita el icono de delante («↑», «🗑️») para comparar el TEXTO del ítem, no su adorno. */
const sinIcono = (t) => String(t).replace(/^[^\p{L}]+/u, '').trim();

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LOS CASOS. La población se deriva de esta lista, no se escribe a mano.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const CASOS = [
  {
    clave: 'una-linea',
    titulo: 'A · el editor abre con UNA línea (y «+ Añadir línea» añade: control)',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      const e0 = await pag.evaluate(EDITOR);
      informe.push(`${etiqueta} · líneas al abrir=${e0.lineas}`);
      if (e0.lineas !== 1) hallazgos.push(`${etiqueta} -> el editor abre con ${e0.lineas} líneas; la v3 pide UNA`);
      if (await pag.evaluate(PULSAR, '+ Añadir línea') !== 'pulsado') { ciegos.push(`${etiqueta} -> no pude pulsar «+ Añadir línea»`); return; }
      await espera(250);
      const e1 = await pag.evaluate(EDITOR);
      informe.push(`${etiqueta} · tras «+ Añadir línea»=${e1.lineas}`);
      // CONTROL: si el contador no se moviera, «1» no diría nada del editor.
      if (e1.lineas !== e0.lineas + 1) ciegos.push(`${etiqueta} -> «+ Añadir línea» no cambió el recuento (${e0.lineas} → ${e1.lineas}): el lector no cuenta líneas`);
    },
  },
  {
    clave: 'totales',
    titulo: 'B · el desglose del descuento sale en el DOCUMENTO, y en el editor sólo queda el TOTAL',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      if (!await rellenarPrimera(pag, etiqueta, 'Mano de obra (hora)', '10', '40')) return;
      const e = await pag.evaluate(EDITOR);
      informe.push(`${etiqueta} · editor: apoyo .quote-totals=${e.apoyoEnElEditor} · KPI=«${e.kpi}» (visible=${e.kpiVisible})`);
      if (e.apoyoEnElEditor) hallazgos.push(`${etiqueta} -> el editor sigue pintando el bloque de apoyo de totales (${e.apoyoEnElEditor}); en Conceptos sólo va el TOTAL`);
      if (!e.kpiVisible) hallazgos.push(`${etiqueta} -> el TOTAL no se ve en el editor`);

      // CONTROL NEGATIVO: sin descuento, el documento NO lleva filas de descuento.
      const t0 = await pag.evaluate(TOTALES_DOC);
      if (!t0) { ciegos.push(`${etiqueta} -> no encontré el bloque de totales del documento`); return; }
      informe.push(`${etiqueta} · documento sin descuento: ${JSON.stringify(t0)}`);
      if (t0.some(([r]) => r === 'Suma de líneas')) hallazgos.push(`${etiqueta} -> sin descuento el documento ya dice «Suma de líneas»: el bloque tenía que quedar como estaba`);

      // Descuento de LÍNEA, puesto por el camino del profesional: menú ⋯ → Ajustes → «Dto. %».
      const items = await pag.evaluate(ABRIR_MENU, 0);
      if (!items || !items.length) { ciegos.push(`${etiqueta} -> no pude abrir el menú ⋯ de la línea`); return; }
      const pulsado = await pag.evaluate(PULSAR_EN_MENU, 0, ITEMS_V3[0]);
      if (pulsado !== 'pulsado') {
        hallazgos.push(`${etiqueta} -> no pude pulsar «${ITEMS_V3[0]}» en el menú ⋯ (${pulsado}): ${JSON.stringify(items)}`); return;
      }
      await espera(250);
      if (await pag.evaluate(PONER_EN_HOJA, '.quote-line__dto input', '10') !== 'puesto') { ciegos.push(`${etiqueta} -> la hoja de ajustes no tiene «Dto. %»`); return; }
      await pag.evaluate(PULSAR, 'Listo');
      await espera(300);
      const t1 = await pag.evaluate(TOTALES_DOC);
      informe.push(`${etiqueta} · documento con Dto. 10 %: ${JSON.stringify(t1)}`);
      const r1 = Object.fromEntries(t1);
      if (r1['Suma de líneas'] !== '400,00 €') hallazgos.push(`${etiqueta} -> con Dto. el documento no dice «Suma de líneas 400,00 €»: ${JSON.stringify(t1)}`);
      if (r1['Descuento'] !== '−40,00 €') hallazgos.push(`${etiqueta} -> con Dto. 10 % el documento no dice «Descuento −40,00 €»: ${JSON.stringify(t1)}`);
      if (r1['Base imponible'] !== '360,00 €') hallazgos.push(`${etiqueta} -> la base del documento no es 360,00 €: ${JSON.stringify(t1)}`);

      // Descuento GLOBAL, desde su botón junto a «+ Añadir línea».
      if (await pag.evaluate(PULSAR, '+ Añadir descuento') !== 'pulsado') { hallazgos.push(`${etiqueta} -> no hay «+ Añadir descuento» a la vista en Conceptos`); return; }
      await espera(200);
      if (!await teclear(pag, '.quote-dto-global input', '25')) { ciegos.push(`${etiqueta} -> no encontré el campo del descuento global`); return; }
      await espera(300);
      const t2 = await pag.evaluate(TOTALES_DOC);
      informe.push(`${etiqueta} · documento con Dto. + global 25: ${JSON.stringify(t2)}`);
      const r2 = Object.fromEntries(t2);
      if (r2['Descuento global'] !== '−25,00 €') hallazgos.push(`${etiqueta} -> el documento no dice «Descuento global −25,00 €»: ${JSON.stringify(t2)}`);
      if (r2['Base imponible'] !== '335,00 €') hallazgos.push(`${etiqueta} -> con los dos descuentos la base del documento no es 335,00 €: ${JSON.stringify(t2)}`);
      // Y el editor, con los dos descuentos puestos, SIGUE sin su bloque de apoyo.
      const e2 = await pag.evaluate(EDITOR);
      if (e2.apoyoEnElEditor) hallazgos.push(`${etiqueta} -> con descuentos, el editor vuelve a pintar su bloque de apoyo`);
      if (e2.kpi && e2.kpi.indexOf(r2['Total presupuesto'] || '§') < 0) {
        hallazgos.push(`${etiqueta} -> el TOTAL del editor («${e2.kpi}») no es el del documento («${r2['Total presupuesto']}»)`);
      }
    },
  },
  {
    clave: 'descuento-junto',
    titulo: 'C · «+ Añadir descuento» va JUNTO a «+ Añadir línea», dentro de Conceptos',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      const e = await pag.evaluate(EDITOR);
      informe.push(`${etiqueta} · addLine visible=${e.addLineVisible} · descuento existe=${e.dtoGlobalExiste} visible=${e.dtoGlobalVisible} junto=${e.dtoJuntoAAddLine} botón=«${e.textoBotonDto}»`);
      if (!e.hayAddLine) { ciegos.push(`${etiqueta} -> no encontré «+ Añadir línea»`); return; }
      if (!e.dtoGlobalExiste) { hallazgos.push(`${etiqueta} -> no existe el descuento global en el editor`); return; }
      if (!e.dtoJuntoAAddLine) hallazgos.push(`${etiqueta} -> «+ Añadir descuento» no va justo detrás de «+ Añadir línea»`);
      if (!e.dtoGlobalVisible) hallazgos.push(`${etiqueta} -> «+ Añadir descuento» no se ve en el paso Conceptos`);
      // CONTROL: al pasar a Condiciones, Conceptos se cierra y el descuento se va con él.
      if (!await rellenarPrimera(pag, etiqueta, 'Mano de obra (hora)', '1', '40')) return;
      if (await pag.evaluate(PULSAR, 'Continuar') !== 'pulsado') { ciegos.push(`${etiqueta} -> no pude pasar a Condiciones`); return; }
      await espera(300);
      const c = await pag.evaluate(EDITOR);
      informe.push(`${etiqueta} · en Condiciones: descuento visible=${c.dtoGlobalVisible}`);
      if (c.dtoGlobalVisible) hallazgos.push(`${etiqueta} -> con Conceptos cerrado, «+ Añadir descuento» sigue a la vista`);
    },
  },
  {
    clave: 'ficha-y-menu',
    titulo: 'D · la ficha sólo si la línea NO va con lo de siempre; «Ajustes» en el menú ⋯',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      if (!await rellenarPrimera(pag, etiqueta, 'Punto de luz', '3', '25')) return;
      const e0 = await pag.evaluate(EDITOR);
      informe.push(`${etiqueta} · línea de siempre: ficha=${JSON.stringify(e0.fichas[0])}`);
      if (!e0.fichas[0]) { ciegos.push(`${etiqueta} -> la línea no tiene ficha de ajustes en el DOM`); return; }
      if (e0.fichas[0].visible) hallazgos.push(`${etiqueta} -> una línea con el IVA de siempre, sin descuento ni suplido, sigue enseñando su ficha «${e0.fichas[0].texto}»`);

      const items = await pag.evaluate(ABRIR_MENU, 0);
      informe.push(`${etiqueta} · menú ⋯ = ${JSON.stringify(items)}`);
      if (!items || !items.length) { ciegos.push(`${etiqueta} -> no pude abrir el menú ⋯`); return; }
      const limpios = items.map(sinIcono);
      if (JSON.stringify(limpios) !== JSON.stringify(ITEMS_V3)) {
        hallazgos.push(`${etiqueta} -> el menú ⋯ es ${JSON.stringify(limpios)}; la v3 pide ${JSON.stringify(ITEMS_V3)}`);
      }
      const pulsado = await pag.evaluate(PULSAR_EN_MENU, 0, ITEMS_V3[0]);
      if (pulsado !== 'pulsado') { hallazgos.push(`${etiqueta} -> no pude pulsar «${ITEMS_V3[0]}» en el menú ⋯ (${pulsado})`); return; }
      await espera(250);
      // La línea deja de ir «con lo de siempre»: IVA 10 %.
      const puesto = await pag.evaluate(PONER_EN_HOJA, '.quote-line__vat select, .quote-line__vat input', '10');
      if (puesto !== 'puesto') { ciegos.push(`${etiqueta} -> no pude cambiar el IVA en la hoja (${puesto})`); return; }
      await pag.evaluate(PULSAR, 'Listo');
      await espera(300);
      const e1 = await pag.evaluate(EDITOR);
      informe.push(`${etiqueta} · con IVA 10 %: ficha=${JSON.stringify(e1.fichas[0])}`);
      // CONTROL POSITIVO: la ficha VUELVE y dice lo distinto. Sin esto, «oculta» pasaría escondiéndola siempre.
      if (!e1.fichas[0] || !e1.fichas[0].visible) hallazgos.push(`${etiqueta} -> con IVA 10 % la ficha sigue oculta: un dato distinto queda escondido`);
      else if (e1.fichas[0].texto.indexOf('10') < 0) hallazgos.push(`${etiqueta} -> la ficha vuelve pero dice «${e1.fichas[0].texto}», no el 10 %`);
    },
  },
  {
    clave: 'tecla-n',
    titulo: 'E · la «N» dentro del editor NO abre la Cotización rápida encima (fuera, sí: control)',
    async correr(pag, etiqueta) {
      // CONTROL POSITIVO, PRIMERO y en página limpia: en una vista sin destino propio (#home) el
      // respaldo SÍ abre algo. Sin esto, un teclado que no llegara a la página daría «no abre nada»
      // en los dos sitios. Va antes que el editor a propósito: medido al ver el rojo, un modal que
      // la «N» abriera en el editor dejaba el control con un overlay ya puesto y lo volvía ciego.
      await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#home`, { waitUntil: 'networkidle0' });
      await espera(600);
      await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
      const h0 = await pag.evaluate(OVERLAYS);
      await pag.keyboard.press('n');
      await espera(500);
      const h1 = await pag.evaluate(OVERLAYS);
      informe.push(`${etiqueta} · control en #home: overlays ${h0} → ${h1}`);
      if (h0 !== 0 || h1 <= h0) { ciegos.push(`${etiqueta} -> en #home la «N» no abre nada (${h0} → ${h1}): el instrumento no sabe pulsar la tecla`); return; }

      if (!await abrirEditor(pag, etiqueta)) return;
      await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
      const antes = await pag.evaluate(OVERLAYS);
      await pag.keyboard.press('n');
      await espera(500);
      const dentro = await pag.evaluate(OVERLAYS);
      informe.push(`${etiqueta} · en el editor: overlays ${antes} → ${dentro}`);
      if (dentro > antes) hallazgos.push(`${etiqueta} -> la «N» abrió ${dentro - antes} modal(es) encima del presupuesto a medias`);
    },
  },
];

async function main() {
  const srv = await arrancarServidor();
  let navegador = null;
  try {
    navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
    for (const c of CASOS) {
      const contexto = await navegador.createBrowserContext();
      const pag = await contexto.newPage();
      const errores = [];
      pag.on('pageerror', (e) => errores.push(String(e.message || e)));
      try {
        await pag.setViewport({ width: 1280, height: 900 });
        await c.correr(pag, c.clave);
        if (errores.length) ciegos.push(`${c.clave} -> la página lanzó ${errores.length} error(es): ${errores[0]}`);
      } finally {
        await pag.close().catch(() => {});
        await contexto.close().catch(() => {});
      }
    }
  } finally {
    if (navegador) await navegador.close().catch(() => {});
    srv.close();
  }

  const ancho = '═'.repeat(96);
  console.log(`\n  SCRUM-915h · LOS CONCEPTOS, MÁS LIMPIOS`);
  console.log(`  POBLACIÓN: ${CASOS.length} casos, ${CASOS.length} corridos · ${CASOS.map((c) => c.titulo.split(' · ')[0]).join(' · ')}`);
  informe.forEach((l) => console.log(`   · ${l}`));
  if (hallazgos.length) {
    console.log(`\n  🔴 HALLAZGOS ${hallazgos.length}:`);
    hallazgos.forEach((l) => console.log(`   🔴 ${l}`));
  }
  if (ciegos.length) {
    console.log(`\n  ⬜ NO SUPE MEDIR ${ciegos.length}:`);
    ciegos.forEach((l) => console.log(`   ⬜ ${l}`));
    console.log(`\n  Un ciego no es un verde: de esos casos no se ha juzgado nada.\n${ancho}`);
    process.exit(SALIDA_NO_SUPE_MEDIR);
  }
  if (hallazgos.length) {
    console.log(`\n${ancho}`);
    process.exit(SALIDA_HALLAZGO);
  }
  console.log(`\n  ✔ en los ${CASOS.length} casos: una línea al abrir, el desglose en el documento, el TOTAL en el`);
  console.log(`    editor, el descuento junto a «+ Añadir línea», la ficha sólo si es distinta y la «N» quieta.\n`);
}

main().catch((e) => { console.error('⬜ el guard no llegó a medir:', e); process.exit(SALIDA_NO_SUPE_MEDIR); });

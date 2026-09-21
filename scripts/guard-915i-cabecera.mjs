#!/usr/bin/env node
/**
 * SCRUM-915i · LA CABECERA Y EL MENÚ «⋯» DE ARRIBA — medido en el árbol RENDERIZADO, después de pulsar.
 *
 * Guard de NAVEGADOR. Lo que vigila no se ve en el fuente:
 *
 *   ① la cabecera dice «Nuevo presupuesto», sin el subtítulo viejo, y con un «⋯» («Más acciones»)
 *      en la fila del título; «Limpiar formulario» y «💾 Guardar como plantilla» ya no están sueltos:
 *      viven DENTRO de ese menú.
 *   ② «Limpiar formulario» PIDE CONFIRMACIÓN con los textos firmados; «No, seguir» y Escape no
 *      tocan nada; confirmar vacía el documento ENTERO — también lo que el reset viejo dejaba (el
 *      descuento global) — y vuelve al primer paso.
 *   ③ lo vaciado NO vuelve al recargar: el borrador se borra y el autoguardado pendiente no lo
 *      reescribe. Con su control: ANTES de vaciar, recargar SÍ restaura (si no, el banco no guarda).
 *   ④ el documento suelto tiene el mismo «⋯» con las dos acciones, y no el aviso de autoguardado.
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
let PUERTO = Number(process.env.GUARD915I_PUERTO || 0);

// Teléfono en el rango imposible `34 0XX XXX XXX` (SCRUM-262).
const CLIENTE = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001', email: 'olivos@correo.es' };
const MERCHANT = { id: 1, name: 'QA 915i', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };

// Los textos FIRMADOS (SCRUM-915 comentario 15868), literales.
const TITULO_HOJA = '¿Vaciar este documento?';
const FRASE_HOJA = 'Se quitan el cliente, las líneas y los cambios de este documento. Tus plantillas y tus opciones de siempre no se tocan.';
const ITEMS_MENU = ['💾 Guardar como plantilla', 'Limpiar formulario'];

const me = () => ({
  id: 1, email: 'demo@yaqu.app', name: 'QA 915i', plan: 'pro', role: 'admin',
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

/** La cabecera del editor y cualquier botón suelto de las dos acciones que se van al menú. */
const CABECERA = new Function(`
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var ve = function (el) { return !!el && el.isConnected && el.checkVisibility({ visibilityProperty: true }); };
  var cab = document.querySelector('.quotes-left-card .quotes-header-block');
  var fila = cab && cab.querySelector('.quotes-header-row');
  var h2 = cab && cab.querySelector('h2');
  var mas = fila && fila.querySelector('button.overflow-trigger');
  var sueltos = Array.prototype.slice.call(document.querySelectorAll('.quotes-left-card button'))
    .filter(function (b) { return ve(b) && (limpio(b.textContent) === 'Limpiar formulario' || limpio(b.textContent) === '💾 Guardar como plantilla'); })
    .map(function (b) { return limpio(b.textContent); });
  return {
    hayCabecera: !!cab,
    titulo: h2 ? limpio(h2.textContent) : null,
    subtitulo: !!(cab && cab.querySelector('.quotes-desc')),
    mas: mas ? { etiqueta: mas.getAttribute('aria-label'), visible: ve(mas) } : null,
    guardadoEnFila: !!(fila && Array.prototype.slice.call(fila.children).some(function (c) { return limpio(c.textContent) === '✓ Guardado automáticamente'; })),
    sueltos: sueltos,
  };
`);

// Abre el «⋯» de ARRIBA y devuelve sus ítems; si `texto`, pulsa ese ítem EN LA MISMA LLAMADA (el
// menú compartido se cierra solo con cualquier desplazamiento: trampa medida en 915h).
const MENU_ARRIBA = new Function('texto', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var t = document.querySelector('.quotes-header-row button.overflow-trigger');
  if (!t) return { estado: 'sin-disparador' };
  if (t.getAttribute('aria-expanded') !== 'true') t.click();
  var panel = document.querySelector('.overflow-menu, .overflow-sheet');
  if (!panel) return { estado: 'sin-menu' };
  var bs = Array.prototype.slice.call(panel.querySelectorAll('button'));
  var items = bs.map(function (b) { return limpio(b.textContent); });
  if (!texto) { t.click(); return { estado: 'leido', items: items }; }
  for (var i = 0; i < bs.length; i++) if (items[i] === texto) { bs[i].click(); return { estado: 'pulsado', items: items }; }
  return { estado: 'no-encontrado', items: items };
`);

// Abre el «⋯», pulsa «Limpiar formulario» y CONFIRMA, todo en la misma llamada: sin una sola espera
// entre la última tecla y el vaciado, el autoguardado de 700 ms de la pantalla vieja sigue PENDIENTE
// cuando se vacía.
// ⚠️ LO QUE ESTE GUARD NO CAZA, DECLARADO: el mutante que quita el `clearTimeout` de
// `vaciarDocumento` SOBREVIVE (medido 2 de 2 pasadas, 21-sep-2026, con y sin esta llamada sin
// esperas). Causa NO demostrada; hipótesis: la pantalla nueva escribe su propio borrador DESPUÉS del
// temporizador viejo y lo pisa. El `clearTimeout` se queda porque no depende de esa suerte; lo que
// no se afirma es que aquí haya una red que lo sujete.
const VACIAR_YA = new Function(`
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var t = document.querySelector('.quotes-header-row button.overflow-trigger');
  if (!t) return 'sin-disparador';
  t.click();
  var panel = document.querySelector('.overflow-menu, .overflow-sheet');
  if (!panel) return 'sin-menu';
  var item = Array.prototype.slice.call(panel.querySelectorAll('button')).filter(function (b) { return limpio(b.textContent) === 'Limpiar formulario'; })[0];
  if (!item) return 'sin-item';
  item.click();
  var ok = document.querySelector('.modal-overlay .hoja-vaciar .modal-footer .btn-danger');
  if (!ok) return 'sin-hoja';
  ok.click();
  return 'vaciado';
`);

/** La hoja de confirmación, si está: título, frase y botones. */
const HOJA = new Function(`
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var h = document.querySelector('.modal-overlay .hoja-vaciar');
  if (!h || !h.checkVisibility()) return null;
  var tit = h.querySelector('.modal-title');
  var fr = h.querySelector('.hoja-vaciar__frase');
  var pie = h.querySelector('.modal-footer');
  return {
    titulo: tit ? limpio(tit.textContent) : null,
    frase: fr ? limpio(fr.textContent) : null,
    botones: pie ? Array.prototype.slice.call(pie.querySelectorAll('button')).map(function (b) { return limpio(b.textContent); }) : [],
    foco: document.activeElement ? limpio(document.activeElement.textContent) : null,
  };
`);

/** Lo que el profesional ha puesto: cliente, primera línea, descuento global, y qué paso se ve. */
const ESTADO = new Function(`
  var ve = function (el) { return !!el && el.isConnected && el.checkVisibility({ visibilityProperty: true }); };
  var sel = document.querySelector('select[name="customer_id"]');
  var lineas = document.querySelectorAll('.quote-lines > .quote-line');
  var c = document.querySelector('.quote-line .quote-line__concept input');
  var dto = document.querySelector('.quote-dto-global input');
  return {
    cliente: sel ? sel.value : null,
    clienteVisible: ve(sel),
    lineas: lineas.length,
    concepto: c ? c.value : null,
    conceptoVisible: ve(c),
    dtoGlobal: dto ? dto.value : null,
    overlays: Array.prototype.slice.call(document.querySelectorAll('.modal-overlay')).filter(function (o) { return o.checkVisibility(); }).length,
  };
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

async function abrirPagina(pag, etiqueta, hash, selectorListo) {
  await pag.goto('about:blank');
  await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#${hash}`, { waitUntil: 'networkidle0' });
  const pintado = await pag.waitForSelector(selectorListo, { timeout: 10000 }).then(() => true, () => false);
  if (!pintado) { ciegos.push(`${etiqueta} -> #${hash} no se pintó`); return false; }
  await espera(400);
  return true;
}

/** Editor abierto, cliente elegido, primera línea escrita y un descuento global de 25. */
async function rellenar(pag, etiqueta) {
  if (!await abrirPagina(pag, etiqueta, 'quotes-new', '.quote-line .quote-line__concept input')) return false;
  const conClientes = await pag.waitForFunction(
    new Function(`var s = document.querySelector('select[name="customer_id"]'); return !!s && s.querySelector('option[value="${CLIENTE.id}"]');`),
    { timeout: 10000 },
  ).then(() => true, () => false);
  if (!conClientes) { ciegos.push(`${etiqueta} -> la lista de clientes no llegó al selector`); return false; }
  await pag.select('select[name="customer_id"]', String(CLIENTE.id));
  await espera(200);
  if (await pag.evaluate(PULSAR, 'Continuar') !== 'pulsado') { ciegos.push(`${etiqueta} -> «Continuar» no llevó a Conceptos`); return false; }
  await espera(300);
  const ok = await teclear(pag, '.quote-line .quote-line__concept input', 'Punto de luz')
    && await teclear(pag, '.quote-line .quote-line__qty input', '3')
    && await teclear(pag, '.quote-line .quote-line__price input', '25');
  if (!ok) { ciegos.push(`${etiqueta} -> no encontré concepto, cantidad o precio`); return false; }
  if (await pag.evaluate(PULSAR, '+ Añadir descuento') !== 'pulsado') { ciegos.push(`${etiqueta} -> no pude pulsar «+ Añadir descuento»`); return false; }
  await espera(200);
  if (!await teclear(pag, '.quote-dto-global input', '25')) { ciegos.push(`${etiqueta} -> no encontré el campo del descuento global`); return false; }
  await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
  await espera(300);
  const e = await pag.evaluate(ESTADO);
  if (e.cliente !== String(CLIENTE.id) || e.concepto !== 'Punto de luz' || e.dtoGlobal !== '25') {
    ciegos.push(`${etiqueta} -> el documento no quedó relleno como se tecleó: ${JSON.stringify(e)}`); return false;
  }
  return true;
}

/** Abre la hoja desde el «⋯» de arriba y comprueba que es la firmada. */
async function abrirHoja(pag, etiqueta) {
  const m = await pag.evaluate(MENU_ARRIBA, 'Limpiar formulario');
  if (m.estado !== 'pulsado') { hallazgos.push(`${etiqueta} -> no pude pulsar «Limpiar formulario» en el «⋯» de arriba (${m.estado}): ${JSON.stringify(m.items || [])}`); return null; }
  await espera(250);
  const h = await pag.evaluate(HOJA);
  if (!h) { hallazgos.push(`${etiqueta} -> «Limpiar formulario» no pidió confirmación: no hay hoja`); return null; }
  return h;
}

const CASOS = [
  {
    clave: 'cabecera',
    titulo: 'A · «Nuevo presupuesto», sin subtítulo, y las dos acciones dentro del «⋯» de arriba',
    async correr(pag, etiqueta) {
      if (!await abrirPagina(pag, etiqueta, 'quotes-new', '.quote-line .quote-line__concept input')) return;
      const c = await pag.evaluate(CABECERA);
      informe.push(`${etiqueta} · ${JSON.stringify(c)}`);
      if (!c.hayCabecera) { ciegos.push(`${etiqueta} -> no encontré la cabecera del editor`); return; }
      if (c.titulo !== 'Nuevo presupuesto') hallazgos.push(`${etiqueta} -> el título dice «${c.titulo}»; la v3 pide «Nuevo presupuesto»`);
      if (c.subtitulo) hallazgos.push(`${etiqueta} -> sigue el subtítulo viejo («Genera un presupuesto…»)`);
      if (!c.mas) { hallazgos.push(`${etiqueta} -> no hay «⋯» en la fila del título`); return; }
      if (c.mas.etiqueta !== 'Más acciones') hallazgos.push(`${etiqueta} -> el «⋯» de arriba se anuncia «${c.mas.etiqueta}», no «Más acciones»`);
      if (!c.mas.visible) hallazgos.push(`${etiqueta} -> el «⋯» de arriba existe pero no se ve`);
      if (!c.guardadoEnFila) hallazgos.push(`${etiqueta} -> «✓ Guardado automáticamente» no va en la fila del título`);
      if (c.sueltos.length) hallazgos.push(`${etiqueta} -> siguen sueltos en el editor: ${JSON.stringify(c.sueltos)}`);
      const m = await pag.evaluate(MENU_ARRIBA, null);
      informe.push(`${etiqueta} · «⋯» de arriba = ${JSON.stringify(m)}`);
      // CONTROL: el menú se abre y trae ítems; si no, «no están sueltos» no diría nada.
      if (m.estado !== 'leido' || !m.items.length) { ciegos.push(`${etiqueta} -> no pude leer el «⋯» de arriba (${m.estado})`); return; }
      if (JSON.stringify(m.items) !== JSON.stringify(ITEMS_MENU)) hallazgos.push(`${etiqueta} -> el «⋯» de arriba trae ${JSON.stringify(m.items)}; la v3 pide ${JSON.stringify(ITEMS_MENU)}`);
    },
  },
  {
    clave: 'confirmar',
    titulo: 'B · limpiar PIDE confirmación; «No, seguir» y Escape no tocan nada; confirmar vacía TODO',
    async correr(pag, etiqueta) {
      if (!await rellenar(pag, etiqueta)) return;
      const h = await abrirHoja(pag, etiqueta);
      if (!h) return;
      informe.push(`${etiqueta} · hoja = ${JSON.stringify(h)}`);
      if (h.titulo !== TITULO_HOJA) hallazgos.push(`${etiqueta} -> la hoja se titula «${h.titulo}», no «${TITULO_HOJA}»`);
      if (h.frase !== FRASE_HOJA) hallazgos.push(`${etiqueta} -> la hoja dice «${h.frase}», no la frase firmada`);
      if (JSON.stringify(h.botones) !== JSON.stringify(['No, seguir', 'Limpiar formulario'])) hallazgos.push(`${etiqueta} -> los botones de la hoja son ${JSON.stringify(h.botones)}`);
      if (h.foco !== 'No, seguir') hallazgos.push(`${etiqueta} -> al abrir la hoja el foco está en «${h.foco}»: un acto irreversible no es la acción principal`);

      // «No, seguir»: se cierra y NO toca nada.
      await pag.evaluate(PULSAR, 'No, seguir');
      await espera(250);
      const e1 = await pag.evaluate(ESTADO);
      informe.push(`${etiqueta} · tras «No, seguir»: ${JSON.stringify(e1)}`);
      if (e1.overlays) hallazgos.push(`${etiqueta} -> «No, seguir» no cerró la hoja`);
      if (e1.concepto !== 'Punto de luz' || e1.dtoGlobal !== '25' || e1.cliente !== String(CLIENTE.id)) hallazgos.push(`${etiqueta} -> «No, seguir» ha tocado el documento: ${JSON.stringify(e1)}`);

      // Escape: igual.
      if (!await abrirHoja(pag, etiqueta)) return;
      await pag.keyboard.press('Escape');
      await espera(250);
      const e2 = await pag.evaluate(ESTADO);
      informe.push(`${etiqueta} · tras Escape: ${JSON.stringify(e2)}`);
      if (e2.overlays) hallazgos.push(`${etiqueta} -> Escape no cerró la hoja`);
      if (e2.concepto !== 'Punto de luz' || e2.dtoGlobal !== '25') hallazgos.push(`${etiqueta} -> Escape ha tocado el documento: ${JSON.stringify(e2)}`);

      // Confirmar: todo fuera, y de vuelta al primer paso.
      if (!await abrirHoja(pag, etiqueta)) return;
      const hoja = await pag.$('.modal-overlay .hoja-vaciar .modal-footer .btn-danger');
      if (!hoja) { ciegos.push(`${etiqueta} -> no encontré el botón de confirmar de la hoja`); return; }
      await hoja.click();
      await espera(600);
      const e3 = await pag.evaluate(ESTADO);
      informe.push(`${etiqueta} · tras confirmar: ${JSON.stringify(e3)}`);
      if (e3.overlays) hallazgos.push(`${etiqueta} -> confirmar no cerró la hoja`);
      if (e3.cliente !== '') hallazgos.push(`${etiqueta} -> tras vaciar sigue elegido el cliente «${e3.cliente}»`);
      if (e3.lineas !== 1 || e3.concepto !== '') hallazgos.push(`${etiqueta} -> tras vaciar quedan ${e3.lineas} línea(s) y el concepto «${e3.concepto}»`);
      // Lo que el reset viejo DEJABA y la frase firmada promete quitar: «los cambios de este documento».
      if (e3.dtoGlobal !== '' && e3.dtoGlobal !== null) hallazgos.push(`${etiqueta} -> tras vaciar el descuento global sigue en «${e3.dtoGlobal}»: la hoja dice que se quitan los cambios del documento`);
      if (!e3.clienteVisible) hallazgos.push(`${etiqueta} -> tras vaciar no se vuelve al primer paso (el cliente no se ve)`);
    },
  },
  {
    clave: 'borrador',
    titulo: 'C · lo vaciado NO vuelve al recargar (y ANTES de vaciar, recargar SÍ restaura: control)',
    async correr(pag, etiqueta) {
      if (!await rellenar(pag, etiqueta)) return;
      await espera(1200); // el autoguardado va a 700 ms
      // CONTROL POSITIVO: recargar sin vaciar trae el borrador. Si no, el banco no guarda y el
      // «no vuelve» de abajo no diría nada.
      if (!await abrirPagina(pag, etiqueta, 'quotes-new', '.quote-line .quote-line__concept input')) return;
      await espera(600);
      const r0 = await pag.evaluate(ESTADO);
      informe.push(`${etiqueta} · recarga SIN vaciar: concepto=«${r0.concepto}»`);
      if (r0.concepto !== 'Punto de luz') { ciegos.push(`${etiqueta} -> recargar sin vaciar no restauró el borrador («${r0.concepto}»): el banco no guarda, y el caso no se puede juzgar`); return; }

      // Tocar algo (arma el autoguardado de 700 ms) y vaciar ENSEGUIDA: el temporizador pendiente
      // es justo el que podría reescribir el borrador recién borrado.
      await teclear(pag, '.quote-line .quote-line__concept input', 'Punto de luz doble');
      const v = await pag.evaluate(VACIAR_YA);
      if (v !== 'vaciado') { hallazgos.push(`${etiqueta} -> no pude vaciar desde el «⋯» de arriba (${v})`); return; }
      await espera(1500);
      if (!await abrirPagina(pag, etiqueta, 'quotes-new', '.quote-line .quote-line__concept input')) return;
      await espera(600);
      const r1 = await pag.evaluate(ESTADO);
      informe.push(`${etiqueta} · recarga TRAS vaciar: ${JSON.stringify(r1)}`);
      if (r1.concepto !== '') hallazgos.push(`${etiqueta} -> tras vaciar y recargar vuelve el concepto «${r1.concepto}»: el borrador no se borró`);
      if (r1.cliente !== '') hallazgos.push(`${etiqueta} -> tras vaciar y recargar vuelve el cliente «${r1.cliente}»`);
    },
  },
  {
    clave: 'suelto',
    titulo: 'D · el documento suelto: el mismo «⋯» con las dos acciones, y sin aviso de autoguardado',
    async correr(pag, etiqueta) {
      if (!await abrirPagina(pag, etiqueta, 'invoices-new', '.quote-line .quote-line__concept input')) return;
      const c = await pag.evaluate(CABECERA);
      informe.push(`${etiqueta} · ${JSON.stringify(c)}`);
      if (!c.hayCabecera) { ciegos.push(`${etiqueta} -> no encontré la cabecera del documento suelto`); return; }
      if (c.titulo === 'Nuevo presupuesto') hallazgos.push(`${etiqueta} -> el documento suelto se titula «Nuevo presupuesto»`);
      if (c.guardadoEnFila) hallazgos.push(`${etiqueta} -> el documento suelto enseña «✓ Guardado automáticamente», y no guarda borrador`);
      if (c.sueltos.length) hallazgos.push(`${etiqueta} -> siguen sueltos en el editor: ${JSON.stringify(c.sueltos)}`);
      const m = await pag.evaluate(MENU_ARRIBA, null);
      informe.push(`${etiqueta} · «⋯» de arriba = ${JSON.stringify(m)}`);
      if (m.estado !== 'leido') { hallazgos.push(`${etiqueta} -> el documento suelto no tiene el «⋯» de arriba (${m.estado})`); return; }
      if (JSON.stringify(m.items) !== JSON.stringify(ITEMS_MENU)) hallazgos.push(`${etiqueta} -> el «⋯» del suelto trae ${JSON.stringify(m.items)}`);
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
  console.log(`\n  SCRUM-915i · LA CABECERA Y EL MENÚ «⋯» DE ARRIBA`);
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
  console.log(`\n  ✔ en los ${CASOS.length} casos: «Nuevo presupuesto» sin subtítulo, las dos acciones en el «⋯» de arriba,`);
  console.log(`    limpiar con confirmación que vacía TODO y no vuelve al recargar, y el suelto igual.\n`);
}

main().catch((e) => { console.error('⬜ el guard no llegó a medir:', e); process.exit(SALIDA_NO_SUPE_MEDIR); });

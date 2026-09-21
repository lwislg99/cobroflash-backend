#!/usr/bin/env node
/**
 * SCRUM-915g · «AJUSTES DEL DOCUMENTO» DEL JUSTIFICANTE, en «Revisar y emitir» — medido en el árbol
 * RENDERIZADO, después de pulsar.
 *
 * Guard de NAVEGADOR. Lo que vigila no se ve en el fuente: qué queda a la vista tras cada clic, y qué
 * mide un botón, sólo existen con el CSS resuelto.
 *
 * La v3 aprobada (`docs/prototipos/SCRUM-915/editor-presupuesto.html`, `filaAjustes`) saca el IVA por
 * defecto del paso Conceptos del documento suelto y lo mete en una fila «Ajustes del documento» del
 * ÚLTIMO paso, cerrada por defecto, con su resumen y un «Cambiar»/«Listo». Textos firmados en el
 * comentario 15868 de SCRUM-915: «Ajustes del documento» y «IVA por defecto N %».
 *
 *   A · Conceptos ya NO lleva el IVA por defecto, y con Revisar cerrado la fila no asoma. CONTROL: el
 *       campo EXISTE en el documento (una sola vez); si no, «no se ve» no diría nada.
 *   B · en «Revisar y emitir» la fila llega CERRADA: «Ajustes del documento», «IVA por defecto 21 %»,
 *       «Cambiar» con aria-expanded=false y el campo sin verse. Va DENTRO del último paso y ANTES de la
 *       línea que resume el cliente.
 *   C · «Cambiar» la abre EN LA PÁGINA —sin modal—: el campo se ve, el botón pasa a «Listo»
 *       (aria-expanded=true) y el paso de Revisar sigue siendo el mismo (Emitir sigue a la vista).
 *   D · el valor viaja: elegir 10 y pulsar «Listo» cierra la fila y su resumen dice «IVA por defecto
 *       10 %». CONTROL: el selector tiene de verdad el 10.
 *   E · abierta, sólo enseña lo SUYO: nada de los ajustes del presupuesto (IVA del presupuesto,
 *       dirección de la obra, datos del cliente, descripción) ni la palabra «presupuesto». CONTROL: sí
 *       lleva su propio rótulo «IVA por defecto (%)», o se estaría leyendo otra cosa.
 *   F · a 390 px, «Cambiar» mide ≥44 px de alto y no hay scroll lateral.
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
let PUERTO = Number(process.env.GUARD915G_PUERTO || 0);

// Teléfono en el rango imposible `34 0XX XXX XXX` (SCRUM-262).
const CLIENTE = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001', email: 'olivos@correo.es' };
const MERCHANT = { id: 1, name: 'QA 915g', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };

// Los textos FIRMADOS (SCRUM-915 comentario 15868), literales.
const TITULO_FILA = 'Ajustes del documento';
const RESUMEN_CERRADO = 'IVA por defecto 21 %';
const RESUMEN_TRAS_CAMBIAR = 'IVA por defecto 10 %';
const ROTULO_DEL_CAMPO = 'IVA por defecto (%)';
// Lo que es de los ajustes del PRESUPUESTO y no puede colarse en la fila de un justificante.
const PROHIBIDO_EN_LA_FILA = ['IVA del presupuesto', 'Dirección de la obra', 'Datos del cliente', 'Incluir descripción', 'presupuesto'];

const me = () => ({
  id: 1, email: 'demo@yaqu.app', name: 'QA 915g', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
  documentoSuelto: 'justificante',
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

const PULSAR = new Function('texto', 'enFila', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var ambito = document.querySelector('.quotes-left-card');
  if (enFila) {
    ambito = null;
    var ts = document.querySelectorAll('.quotes-left-card .quote-block-title');
    for (var i = 0; i < ts.length; i++) if (limpio(ts[i].textContent) === enFila) ambito = ts[i].parentElement;
    if (!ambito) return 'sin-fila';
  }
  var bs = ambito.querySelectorAll('button');
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

/** Todo lo que se juzga de la fila y del campo, en un solo paso de lectura. */
const MEDIR = new Function(`
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var ve = function (el) { return !!el && el.isConnected && el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }); };
  var raiz = document.querySelector('.quotes-left-card');
  if (!raiz) return { error: 'no hay .quotes-left-card' };
  var titulos = Array.prototype.slice.call(raiz.querySelectorAll('.quote-block-title'))
    .filter(function (t) { return limpio(t.textContent) === '${TITULO_FILA}'; });
  var fila = titulos.length ? titulos[0].parentElement : null;
  var campos = raiz.querySelectorAll('select[name="vat_default"]');
  var campo = campos.length ? campos[0] : null;
  var botones = fila ? Array.prototype.slice.call(fila.querySelectorAll('button')).filter(function (b) {
    var t = limpio(b.textContent); return t === 'Cambiar' || t === 'Listo';
  }) : [];
  var boton = botones.length ? botones[0] : null;
  var caja = boton && ve(boton) ? boton.getBoundingClientRect() : null;
  var valor = fila ? fila.querySelector('.quote-fila__valor') : null;
  var revision = raiz.querySelector('.quote-paso__revision');
  var ultimo = raiz.querySelector('.quote-block-actions');
  var emitir = raiz.querySelector('.quote-block-actions .btn-primary');
  var opciones = campo ? Array.prototype.slice.call(campo.options).map(function (o) { return o.value; }) : [];
  return {
    filas: titulos.length,
    filaVisible: ve(titulos[0]),
    resumen: valor && ve(valor) ? limpio(valor.textContent) : null,
    boton: boton ? {
      texto: limpio(boton.textContent),
      expandido: boton.getAttribute('aria-expanded'),
      visible: ve(boton),
      alto: caja ? Math.round(caja.height) : null,
      ancho: caja ? Math.round(caja.width) : null
    } : null,
    campos: campos.length,
    campoVisible: ve(campo),
    campoValor: campo ? campo.value : null,
    campoOpciones: opciones,
    campoDentroDeLaFila: !!(fila && campo && fila.contains(campo)),
    dentroDelUltimoPaso: !!(fila && ultimo && ultimo.contains(fila)),
    antesDelResumen: !!(fila && revision && (fila.compareDocumentPosition(revision) & Node.DOCUMENT_POSITION_FOLLOWING)),
    emitirVisible: ve(emitir),
    textoDeLaFila: fila ? limpio(fila.innerText) : null,
    hayModal: Array.prototype.slice.call(document.querySelectorAll('.modal-overlay')).some(ve),
    desbordaLado: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
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

/**
 * Abre el documento suelto y lo lleva a un paso: 1 Cliente · 2 Conceptos · 3 Revisar y emitir.
 * Devuelve false (y apunta el ciego) si algo no llegó a donde tenía que llegar.
 */
async function llegarAlPaso(pag, etiqueta, paso) {
  // La URL va LITERAL (no `#${hash}`): el censo de SCRUM-548 lee qué página mide cada guard por sus
  // `goto`, y una plantilla se la escondería.
  await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#invoices-new`, { waitUntil: 'networkidle0' });
  const pintado = await pag.waitForSelector('.quote-line .quote-line__concept input', { timeout: 10000 }).then(() => true, () => false);
  if (!pintado) { ciegos.push(`${etiqueta} -> el editor del documento suelto no se pintó`); return false; }
  const conClientes = await pag.waitForFunction(
    new Function(`var s = document.querySelector('select[name="customer_id"]'); return !!s && s.querySelector('option[value="${CLIENTE.id}"]');`),
    { timeout: 10000 },
  ).then(() => true, () => false);
  if (!conClientes) { ciegos.push(`${etiqueta} -> la lista de clientes no llegó al selector`); return false; }
  await espera(300);
  if (paso === 1) return true;

  await pag.select('select[name="customer_id"]', String(CLIENTE.id));
  await espera(200);
  if (await pag.evaluate(PULSAR, 'Continuar', null) !== 'pulsado') { ciegos.push(`${etiqueta} -> «Continuar» no llevó a Conceptos`); return false; }
  await espera(300);
  if (paso === 2) return true;

  const escrito = await teclear(pag, '.quote-line .quote-line__concept input', 'Recibo de la luz')
    && await teclear(pag, '.quote-line .quote-line__qty input', '1')
    && await teclear(pag, '.quote-line .quote-line__price input', '120');
  if (!escrito) { ciegos.push(`${etiqueta} -> no encontré concepto, cantidad o precio de la primera línea`); return false; }
  await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
  await espera(300);
  if (await pag.evaluate(PULSAR, 'Continuar', null) !== 'pulsado') { ciegos.push(`${etiqueta} -> «Continuar» no llevó a Revisar y emitir`); return false; }
  await espera(300);
  return true;
}

const CASOS = [
  {
    clave: 'conceptos',
    titulo: 'A · Conceptos ya no lleva el IVA por defecto, y con Revisar cerrado la fila no asoma',
    async correr(pag, etiqueta) {
      for (const paso of [1, 2]) {
        if (!await llegarAlPaso(pag, `${etiqueta} (paso ${paso})`, paso)) return;
        const m = await pag.evaluate(MEDIR);
        if (m.error) { ciegos.push(`${etiqueta} -> ${m.error}`); return; }
        informe.push(`${etiqueta} · paso ${paso} = ${JSON.stringify({ campos: m.campos, campoVisible: m.campoVisible, filaVisible: m.filaVisible })}`);
        // CONTROL: el campo existe UNA vez. Si no está, «no se ve» sería cierto sobre la nada.
        if (m.campos !== 1) { ciegos.push(`${etiqueta} (paso ${paso}) -> hay ${m.campos} campos «IVA por defecto» en el documento; se esperaba 1, y sin él no hay nada que ocultar`); return; }
        if (m.campoVisible) hallazgos.push(`${etiqueta} (paso ${paso}) -> el IVA por defecto SE VE fuera de «Revisar y emitir»: la v3 lo mete en «${TITULO_FILA}», cerrado`);
        if (m.filaVisible) hallazgos.push(`${etiqueta} (paso ${paso}) -> «${TITULO_FILA}» asoma con «Revisar y emitir» cerrado`);
      }
    },
  },
  {
    clave: 'revisar-cerrado',
    titulo: 'B · en Revisar y emitir la fila llega CERRADA, dentro del último paso y antes del resumen',
    async correr(pag, etiqueta) {
      if (!await llegarAlPaso(pag, etiqueta, 3)) return;
      const m = await pag.evaluate(MEDIR);
      if (m.error) { ciegos.push(`${etiqueta} -> ${m.error}`); return; }
      informe.push(`${etiqueta} · ${JSON.stringify(m)}`);
      if (m.filas !== 1) { hallazgos.push(`${etiqueta} -> hay ${m.filas} filas «${TITULO_FILA}» en «Revisar y emitir»; tiene que haber UNA`); return; }
      if (!m.filaVisible) hallazgos.push(`${etiqueta} -> «${TITULO_FILA}» no se ve en «Revisar y emitir»`);
      if (!m.dentroDelUltimoPaso) hallazgos.push(`${etiqueta} -> «${TITULO_FILA}» no está DENTRO del último paso`);
      if (!m.antesDelResumen) hallazgos.push(`${etiqueta} -> «${TITULO_FILA}» no va ANTES de la línea que resume el cliente (orden de la v3)`);
      if (m.resumen !== RESUMEN_CERRADO) hallazgos.push(`${etiqueta} -> el resumen dice «${m.resumen}», no «${RESUMEN_CERRADO}»`);
      if (!m.boton) { hallazgos.push(`${etiqueta} -> la fila no tiene «Cambiar»`); return; }
      if (m.boton.texto !== 'Cambiar' || m.boton.expandido !== 'false') hallazgos.push(`${etiqueta} -> la fila no llega cerrada (botón «${m.boton.texto}», aria-expanded=${m.boton.expandido})`);
      if (m.campoVisible) hallazgos.push(`${etiqueta} -> con la fila cerrada el campo del IVA se ve`);
      if (!m.emitirVisible) hallazgos.push(`${etiqueta} -> la acción primaria del último paso no está a la vista`);
    },
  },
  {
    clave: 'abrir-en-la-pagina',
    titulo: 'C · «Cambiar» abre la fila EN LA PÁGINA, sin modal, y «Listo» la cierra',
    async correr(pag, etiqueta) {
      if (!await llegarAlPaso(pag, etiqueta, 3)) return;
      const r = await pag.evaluate(PULSAR, 'Cambiar', TITULO_FILA);
      await espera(250);
      const m = await pag.evaluate(MEDIR);
      informe.push(`${etiqueta} · «Cambiar» ${r} → ${JSON.stringify({ campoVisible: m.campoVisible, boton: m.boton, hayModal: m.hayModal, emitirVisible: m.emitirVisible })}`);
      if (r !== 'pulsado') { hallazgos.push(`${etiqueta} -> no pude pulsar «Cambiar» dentro de «${TITULO_FILA}» (${r})`); return; }
      if (!m.campoVisible) hallazgos.push(`${etiqueta} -> «Cambiar» no dejó a la vista el IVA por defecto`);
      if (m.hayModal) hallazgos.push(`${etiqueta} -> «Cambiar» abrió un MODAL; tiene que abrirse en la página`);
      if (!m.boton || m.boton.texto !== 'Listo' || m.boton.expandido !== 'true') hallazgos.push(`${etiqueta} -> abierta, el botón no dice «Listo» con aria-expanded=true (${JSON.stringify(m.boton)})`);
      if (!m.emitirVisible) hallazgos.push(`${etiqueta} -> al abrir la fila desapareció la acción primaria: se ha cambiado de paso`);
      // «Listo» la cierra.
      const r2 = await pag.evaluate(PULSAR, 'Listo', TITULO_FILA);
      await espera(250);
      const c = await pag.evaluate(MEDIR);
      if (r2 !== 'pulsado') { hallazgos.push(`${etiqueta} -> no pude pulsar «Listo» (${r2})`); return; }
      if (c.campoVisible) hallazgos.push(`${etiqueta} -> «Listo» no cerró la fila: el campo sigue a la vista`);
      if (!c.boton || c.boton.texto !== 'Cambiar' || c.boton.expandido !== 'false') hallazgos.push(`${etiqueta} -> cerrada, el botón no vuelve a «Cambiar» con aria-expanded=false (${JSON.stringify(c.boton)})`);
    },
  },
  {
    clave: 'el-valor-viaja',
    titulo: 'D · elegir 10 y pulsar «Listo»: el resumen dice «IVA por defecto 10 %»',
    async correr(pag, etiqueta) {
      if (!await llegarAlPaso(pag, etiqueta, 3)) return;
      const r = await pag.evaluate(PULSAR, 'Cambiar', TITULO_FILA);
      // Que la fila NO EXISTA es un hallazgo (el instrumento llegó, y B ya probó que sabe verla); que
      // exista y no se pueda pulsar, no: eso es no saber medir.
      if (r === 'sin-fila') { hallazgos.push(`${etiqueta} -> no hay fila «${TITULO_FILA}» en «Revisar y emitir» donde cambiar el IVA`); return; }
      if (r !== 'pulsado') { ciegos.push(`${etiqueta} -> no pude abrir la fila para cambiar el IVA (${r})`); return; }
      await espera(250);
      const antes = await pag.evaluate(MEDIR);
      // CONTROL: el selector tiene el 10 y arranca en 21. Si no, elegir 10 no probaría nada.
      if (!antes.campoOpciones.includes('10') || antes.campoValor !== '21') { ciegos.push(`${etiqueta} -> el selector no ofrece el 10 o no arranca en 21 (valor ${antes.campoValor}, opciones ${JSON.stringify(antes.campoOpciones)})`); return; }
      await pag.select('select[name="vat_default"]', '10');
      await espera(250);
      await pag.evaluate(PULSAR, 'Listo', TITULO_FILA);
      await espera(250);
      const m = await pag.evaluate(MEDIR);
      informe.push(`${etiqueta} · tras elegir 10 y «Listo»: ${JSON.stringify({ resumen: m.resumen, campoValor: m.campoValor, campoVisible: m.campoVisible })}`);
      if (m.campoValor !== '10') hallazgos.push(`${etiqueta} -> tras elegir 10 el campo vale «${m.campoValor}»`);
      if (m.resumen !== RESUMEN_TRAS_CAMBIAR) hallazgos.push(`${etiqueta} -> tras elegir 10 el resumen dice «${m.resumen}», no «${RESUMEN_TRAS_CAMBIAR}»`);
      if (m.campoVisible) hallazgos.push(`${etiqueta} -> tras «Listo» el campo sigue a la vista`);
    },
  },
  {
    clave: 'solo-lo-suyo',
    titulo: 'E · abierta, la fila sólo enseña lo SUYO: nada de los ajustes del presupuesto',
    async correr(pag, etiqueta) {
      if (!await llegarAlPaso(pag, etiqueta, 3)) return;
      const r = await pag.evaluate(PULSAR, 'Cambiar', TITULO_FILA);
      if (r === 'sin-fila') { hallazgos.push(`${etiqueta} -> no hay fila «${TITULO_FILA}» en «Revisar y emitir» que enseñar`); return; }
      if (r !== 'pulsado') { ciegos.push(`${etiqueta} -> no pude abrir la fila (${r})`); return; }
      await espera(250);
      const m = await pag.evaluate(MEDIR);
      informe.push(`${etiqueta} · texto de la fila abierta = «${m.textoDeLaFila}»`);
      // CONTROL: lo que se lee ES la fila abierta, con su propio rótulo. Si no lo trae, se está leyendo otra cosa.
      if (!m.textoDeLaFila || !m.textoDeLaFila.includes(ROTULO_DEL_CAMPO)) { ciegos.push(`${etiqueta} -> la fila abierta no trae su rótulo «${ROTULO_DEL_CAMPO}»: no sé qué estoy leyendo («${m.textoDeLaFila}»)`); return; }
      for (const p of PROHIBIDO_EN_LA_FILA) {
        if (m.textoDeLaFila.toLowerCase().includes(p.toLowerCase())) hallazgos.push(`${etiqueta} -> la fila de un justificante enseña «${p}», que es del presupuesto`);
      }
    },
  },
  {
    clave: 'movil-390',
    titulo: 'F · a 390 px, «Cambiar» mide ≥44 px de alto y no hay scroll lateral',
    ancho: 390,
    async correr(pag, etiqueta) {
      if (!await llegarAlPaso(pag, etiqueta, 3)) return;
      const m = await pag.evaluate(MEDIR);
      informe.push(`${etiqueta} · ${JSON.stringify({ boton: m.boton, desbordaLado: m.desbordaLado })}`);
      if (m.filas === 0) { hallazgos.push(`${etiqueta} -> no hay fila «${TITULO_FILA}» en «Revisar y emitir», así que no hay un «Cambiar» que tocar`); return; }
      if (!m.boton || !m.boton.visible) { ciegos.push(`${etiqueta} -> la fila existe pero no hay un «Cambiar» a la vista que medir`); return; }
      if (m.boton.alto < 44) hallazgos.push(`${etiqueta} -> «Cambiar» mide ${m.boton.alto} px de alto; el objetivo táctil es 44`);
      if (m.boton.ancho < 44) hallazgos.push(`${etiqueta} -> «Cambiar» mide ${m.boton.ancho} px de ancho; el objetivo táctil es 44`);
      if (m.desbordaLado) hallazgos.push(`${etiqueta} -> hay scroll lateral a 390 px`);
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
        const ancho = c.ancho || 1280;
        await pag.setViewport({ width: ancho, height: ancho < 800 ? 844 : 900, isMobile: ancho < 800, hasTouch: ancho < 800 });
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
  console.log(`\n  SCRUM-915g · «AJUSTES DEL DOCUMENTO» DEL JUSTIFICANTE, EN «REVISAR Y EMITIR»`);
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
  console.log(`\n  ✔ en los ${CASOS.length} casos: el IVA por defecto del justificante vive en «${TITULO_FILA}», cerrado, dentro de`);
  console.log(`    «Revisar y emitir»; «Cambiar» lo abre en la página, el valor viaja al resumen y a 390 px se toca.\n`);
}

main().catch((e) => { console.error('⬜ el guard no llegó a medir:', e); process.exit(SALIDA_NO_SUPE_MEDIR); });

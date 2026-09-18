// docs/prototipos/SCRUM-920/medir.mjs — el instrumento que mide gastos.html (SCRUM-920)
//
// 🔴 POR QUÉ ESTE INSTRUMENTO PULSA Y NO SÓLO MIRA
//
// El prototipo de SCRUM-917 se publicó con las opciones del «⋯» MUERTAS: un
// `event.stopPropagation()` en la hoja impedía que sus propios botones llegaran al manejador. Las
// capturas estaban perfectas.
//
//     🔒 Una captura bonita no prueba que el botón funcione: se mide el ESTADO después de pulsar.
//
// Por eso cada comprobación de comportamiento PULSA y luego pregunta por una consecuencia
// observable (qué pantalla hay, cuántas filas quedan, qué dice el aviso, si la hoja sigue abierta).
//
// Y PULSA COMO UN DEDO, no como un `el.click()`: `pulsar()` lleva el blanco al centro de la
// ventana, pregunta qué elemento está ENCIMA en ese punto y sólo entonces hace clic en esas
// coordenadas. Si encima hay otra cosa (una barra fija, un aviso), lo apunta como TAPADO. En la
// primera pasada sobre el borrador de anoche, el chip «Sin foto» «no filtraba» a 390 px: lo que
// pasaba es que la barra fija de abajo lo tapaba, y el clic se lo llevaba la barra.
//
//     🔒 Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.
//
// Por eso los tres detectores (desborde, controles < 44 px, frases vetadas) llevan un CONTROL
// POSITIVO que tiene que DISPARAR: se siembra un caso malo conocido, el detector tiene que verlo, y
// se retira. Si no lo ve, el informe dice CIEGO y el cero de esa pantalla no vale nada.
//
// Uso:  node docs/prototipos/SCRUM-920/medir.mjs [--capturas <carpeta>]
// No necesita red, ni staging, ni secretos: mide el fichero local por `file://`.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../scripts/_navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PAGINA = pathToFileURL(path.join(AQUI, 'gastos.html')).href;
const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > -1 ? process.argv[iCap + 1] : path.join(os.tmpdir(), 'yaqu-920');

const ANCHURAS = [
  { nombre: '1280', w: 1280, h: 900, movil: false },
  { nombre: '390', w: 390, h: 844, movil: true },
];

// Con escape, no el carácter: pasado por PowerShell, el literal se corrompe y el contador deja de
// ver ninguna cifra — que es justo lo que uno quiere leer (medido en SCRUM-917).
const EURO = '€';
const TOTAL_MES = '1.315,00 ' + EURO;
const SUMA_TRABAJO = '508,20 ' + EURO;
const FRASE_FIRMADA = 'Guardamos la foto como tu copia. Los datos fiscales salen de los campos de abajo.';
// Lo que el prototipo NO puede decir: el veredicto del motor del justificante y su lista de «qué
// falta» (SCRUM-324 E3, espera al asesor) y cualquier promesa de deducción.
const VETADAS = /deducib|desgrav|deducir|deducci|no_deducible|falta_confirmar|le falta|faltan/i;

const SELECTOR_CONTROLES = 'button, a[href], input:not([type="file"]), select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';

async function medirAnchura(nav, a) {
  const page = await nav.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errores.push('requestfailed: ' + r.url()));

  await page.setViewport({ width: a.w, height: a.h, isMobile: a.movil, hasTouch: a.movil, deviceScaleFactor: 1 });
  // Tras cambiar `isMobile` hay que RECARGAR, o las medias queries contestan con la anchura vieja.
  await page.goto(PAGINA, { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  const cuadro = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await cuadro();

  const tapados = [];
  // Pulsa como un dedo: centro de la ventana, quién está encima, clic en esas coordenadas.
  const pulsar = async (sel, i = 0) => {
    const p = await page.evaluate((s, k) => {
      const el = document.querySelectorAll(s)[k];
      if (!el) return { falta: true };
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      const tapa = top && !(el === top || el.contains(top)) ? (top.className || top.tagName) : null;
      return { x, y, tapa: tapa ? String(tapa).slice(0, 40) : null };
    }, sel, i);
    if (p.falta) throw new Error(`pulsar: no existe ${sel}[${i}]`);
    if (p.tapa) tapados.push(`${sel} tapado por «${p.tapa}»`);
    await page.mouse.click(p.x, p.y);
    await cuadro();
  };
  const ir = async (tab) => { await pulsar(`.proto [data-tab="${tab}"]`); };
  const texto = (s) => page.$eval(s, (e) => e.textContent.trim()).catch(() => null);
  const cuantos = (s) => page.$$eval(s, (e) => e.length);
  const cuantosVisibles = (s) => page.$$eval(s, (e) => e.filter((x) => x.offsetParent !== null || getComputedStyle(x).position === 'fixed').length);
  const aviso = () => page.$eval('.toast', (e) => e.textContent).catch(() => null);
  const sinAvisos = () => page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Los tres detectores, como funciones del NAVEGADOR, para poder sembrarles su positivo ─────
  await page.evaluate((selCtrl, vetadasSrc) => {
    window.__detectar = () => {
      const doc = document.documentElement;
      const cajas = [...document.querySelectorAll('*')]
        .filter((e) => !e.closest('.proto') && !e.closest('.oculto'))
        .filter((e) => e.scrollWidth - e.clientWidth > 1 && e.clientWidth > 1
          && getComputedStyle(e).overflowX !== 'hidden' && getComputedStyle(e).overflowX !== 'clip')
        .map((e) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''} (${e.scrollWidth}>${e.clientWidth})`);
      const todos = [...document.querySelectorAll(selCtrl)]
        .filter((e) => !e.closest('.proto') && (e.offsetParent !== null || getComputedStyle(e).position === 'fixed'));
      const pequenos = todos.map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
        .map(({ e, r }) => `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      const vetadas = (document.body.innerText.match(new RegExp(vetadasSrc, 'gi')) || []);
      return { pagina: doc.scrollWidth > doc.clientWidth + 1, cajas, pequenos, total: todos.length, alto: doc.scrollHeight,
        cifras: (document.body.innerText.match(/\d[\d.]*,\d\d\s*€/g) || []).length, vetadas };
    };
  }, SELECTOR_CONTROLES, VETADAS.source);

  // CONTROL POSITIVO de los tres: se siembra un caso malo, tiene que dispararse, se retira.
  const positivo = await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__siembra';
    d.innerHTML = '<div style="width:200px;overflow:auto"><div style="width:600px">ancho</div></div>'
      + '<button style="width:20px;height:20px;padding:0">x</button><p>este gasto es deducible</p>';
    document.getElementById('app').appendChild(d);
    const r = window.__detectar();
    d.remove();
    return { desborde: r.cajas.length > 0, pequeno: r.pequenos.length > 0, vetada: r.vetadas.length > 0 };
  });

  // ── ① Desbordes y controles, pantalla por pantalla ─────────────────────────
  const pantallas = ['lista', 'alta', 'detalle', 'inv'];
  const porPantalla = {};
  for (const p of pantallas) {
    await ir(p);
    porPantalla[p] = await page.evaluate(() => window.__detectar());
    // El inventario DESCRIBE lo que no se puede decir («la lista de qué le falta»): es documentación
    // del prototipo, no pantalla de producto. Las frases vetadas se miden en las tres pantallas.
    if (p === 'inv') porPantalla[p].vetadas = [];
  }

  // ── ② EL ESTADO DESPUÉS DE PULSAR ──────────────────────────────────────────
  const comportamiento = [];
  const anota = (q, ok, detalle) => comportamiento.push({ q, ok, detalle });

  await ir('lista');
  // Cifras de diseño (informativas, no son verde/rojo): cuánto ocupa lo de arriba antes de la primera
  // fila, medido desde el titular «Gastos» para no contar la barra negra del prototipo.
  const geometria = await page.evaluate(() => {
    const y = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; };
    const k = document.querySelector('.kpis').getBoundingClientRect();
    return { kpisAlto: Math.round(k.height), primeraFilaDesdeTitular: y('.fila') - y('.titular'), alturaFila: Math.round(document.querySelector('.fila').getBoundingClientRect().height) };
  });
  const filasTotal = await cuantos('.fila');
  anota('La lista pinta las 9 filas', filasTotal === 9, `${filasTotal} filas`);
  const conFoto = await cuantos('.just.si');
  const sinFoto = await cuantos('.just.no');
  anota('Cada fila dice si tiene su foto o no', conFoto + sinFoto === filasTotal && conFoto > 0 && sinFoto > 0, `${conFoto} con foto · ${sinFoto} sin foto`);
  anota('La miniatura del justificante se pinta de verdad', (await cuantos('.just.si .mini')) === conFoto, `${await cuantos('.just.si .mini')} miniaturas`);

  // Una cifra, una vez: el total del mes sale UNA vez en la lista sin filtros.
  const vecesTotal = await page.evaluate((t) => document.getElementById('app').innerText.split(t).length - 1, TOTAL_MES);
  anota('El total del mes sale UNA vez (sin filtros)', vecesTotal === 1, `${vecesTotal} veces «${TOTAL_MES}»`);
  const nuevos = await cuantosVisibles('button[data-ir="alta"]');
  anota('«Nuevo gasto» se ve UNA vez', nuevos === 1, `${nuevos} visibles`);
  anota('El trabajo se llama como en Trabajos', (await page.$$eval('.fila .trab a', (e) => e.map((x) => x.textContent))).includes('Presupuesto #5 · María López'), 'Presupuesto #5 · María López');

  await pulsar('[data-just="sinfoto"]');
  const trasChip = await cuantos('.fila');
  const chipPulsado = await page.$eval('[data-just="sinfoto"]', (e) => e.getAttribute('aria-pressed'));
  anota('El chip «Sin foto» filtra de verdad', trasChip === sinFoto && chipPulsado === 'true', `${trasChip} filas, aria-pressed=${chipPulsado}`);
  await pulsar('[data-just="todos"]');
  anota('El chip «Todos» devuelve las 9', (await cuantos('.fila')) === 9, `${await cuantos('.fila')} filas`);

  await page.select('#f-job', '3099');
  await cuadro();
  anota('El filtro por trabajo filtra de verdad', (await cuantos('.fila')) === 2, `${await cuantos('.fila')} filas con el trabajo 3099`);
  const sumaFiltrada = await texto('.mescab .suma');
  anota('Con filtro, la cabecera suma LO QUE SE VE', sumaFiltrada === SUMA_TRABAJO, `dice «${sumaFiltrada}»`);
  const salvedad = await texto('.mescab .salvedad');
  anota('…y dice que no es la del mes, sin repetir el total', !!salvedad && salvedad.includes('no la del mes') && !salvedad.includes(EURO), `dice «${salvedad}»`);

  await page.select('#f-cat', 'subcontrata');
  await cuadro();
  anota('Filtro imposible: 0 filas y su estado vacío', (await cuantos('.fila')) === 0 && !!(await texto('.vacio h3')), `«${await texto('.vacio h3')}»`);
  await pulsar('[data-limpiar]');
  anota('«Quitar los filtros» devuelve las 9 filas', (await cuantos('.fila')) === 9, `${await cuantos('.fila')} filas`);

  await pulsar('#mesvacio');
  const vacioTitulo = await texto('.vacio h3');
  anota('El estado vacío de hoy se conserva palabra por palabra', vacioTitulo === 'Sin gastos este mes', `«${vacioTitulo}»`);
  await pulsar('#mesvacio');
  anota('…y se deshace', (await cuantos('.fila')) === 9, `${await cuantos('.fila')} filas`);

  // El «⋯» de la fila: se abre, y CADA botón de dentro hace algo (el defecto de 917).
  await pulsar('.fila [data-mas]');
  const opciones = await cuantos('.hoja .lista-acc .btn');
  anota('El «⋯» de la fila abre su hoja', opciones >= 4, `${opciones} opciones`);
  const muertos = [];
  for (let i = 0; i < opciones; i++) {
    await page.evaluate(() => { document.getElementById('capa').innerHTML = ''; });
    await sinAvisos();
    await pulsar('.fila [data-mas]');
    const rotulo = await page.$$eval('.hoja .lista-acc .btn', (b, k) => (b[k] ? b[k].textContent.trim() : null), i);
    if (!rotulo) { muertos.push(`(opción ${i + 1}: la hoja no se abrió)`); continue; }
    await pulsar('.hoja .lista-acc .btn', i);
    await esperar(60);
    const hojaSigue = (await cuantos('.hoja')) > 0;
    const vivo = (await cuantos('.hoja img.grande')) > 0 || (!hojaSigue && !!(await aviso()));
    if (!vivo) muertos.push(rotulo);
    await page.evaluate(() => { document.getElementById('capa').innerHTML = ''; });
  }
  anota('🔴 Ninguna opción del «⋯» está muerta', muertos.length === 0, muertos.length ? 'MUERTAS: ' + muertos.join(' · ') : `las ${opciones} cambian el estado`);

  await pulsar('.fila [data-mas]');
  await page.mouse.click(5, 5); // el FONDO: el centro del velo es justo donde está la hoja
  await cuadro();
  anota('La hoja se cierra tocando el fondo', (await cuantos('.hoja')) === 0, `${await cuantos('.hoja')} hojas abiertas`);
  await pulsar('.fila [data-mas]');
  await pulsar('.hoja .cerrar');
  anota('La hoja se cierra con la «×»', (await cuantos('.hoja')) === 0, `${await cuantos('.hoja')} hojas abiertas`);

  // La fila abre el DETALLE (hoy abre el modal de edición). Se pulsa el CONCEPTO, no el centro de
  // la fila: el centro puede caer en el enlace del trabajo o en el «⋯».
  await pulsar('.fila .que b', 1);
  const titulo = await texto('.cab-det h1');
  anota('Tocar la fila abre el DETALLE de ESE gasto', titulo === 'SCRUM-920 · Compresor (factura del proveedor)', `«${titulo}»`);
  anota('…el justificante se ve grande', (await cuantos('.justificante img')) === 1, `${await cuantos('.justificante img')} foto`);
  const datosCompresor = await cuantos('.dato');
  anota('…y los datos de la factura que SÍ apuntó (6)', datosCompresor === 6, `${datosCompresor} datos`);
  await pulsar('[data-accion="verfoto"]');
  anota('«Ver a tamaño completo» abre la foto', (await cuantos('.hoja img.grande')) === 1, 'abierta');
  await pulsar('.hoja .cerrar');

  await ir('lista');
  await pulsar('.fila .que b', 2);
  const sinFotoTxt = await texto('.sinfoto p');
  anota('Un gasto sin foto lo dice, y ofrece añadirla', !!sinFotoTxt && (await cuantos('.sinfoto .btn')) === 1, `«${sinFotoTxt}»`);
  // 🔴 Sin datos de factura NO se pinta ninguna lista de vacíos: sería el «qué le falta» del motor.
  const guiones = await page.evaluate(() => (document.getElementById('app').innerText.match(/^\s*—\s*$/gm) || []).length);
  anota('🔴 Sin datos de factura, ni tarjeta ni columna de «—»', (await cuantos('.dato')) === 0 && guiones === 0, `${await cuantos('.dato')} datos, ${guiones} guiones sueltos`);
  anota('En el detalle no hay barra fija que repita importe y «Editar»', (await cuantosVisibles('#barraAbajo .btn')) === 0, `${await cuantosVisibles('#barraAbajo .btn')} botones en la barra`);

  // ── EL ALTA ────────────────────────────────────────────────────────────────
  await ir('alta');
  const ordenPasos = await page.$$eval('.paso > h2', (h) => h.map((x) => x.textContent.trim()));
  anota('🔴 El primer bloque del alta es LA FOTO', /foto del ticket/i.test(ordenPasos[0] || ''), `orden: ${ordenPasos.join(' → ')}`);
  const yTop = await page.evaluate(() => ({
    foto: Math.round(document.querySelector('#zona-foto').getBoundingClientRect().top + scrollY),
    concepto: Math.round(document.querySelector('#a-concepto').getBoundingClientRect().top + scrollY),
  }));
  anota('…y está por encima del concepto, medido en píxeles', yTop.foto < yTop.concepto, `foto en y=${yTop.foto}, concepto en y=${yTop.concepto}`);
  const camposAlta = await page.$$eval('.alta input, .alta select, .alta textarea', (e) => e.length);
  anota('Los 14 campos de hoy siguen estando (la foto es un input de fichero)', camposAlta === 14, `${camposAlta} campos`);
  const firmada = await page.evaluate((f) => document.body.innerText.split(f).length - 1, FRASE_FIRMADA);
  anota('La frase firmada va ENTERA, una vez, con «de abajo»', firmada === 1, `${firmada} veces`);
  const guardarVisibles = await cuantosVisibles('[data-accion="guardar"]');
  anota('«Añadir gasto» se ve UNA vez', guardarVisibles === 1, `${guardarVisibles} visibles`);

  await pulsar('[data-foto="hacer"]');
  anota('«Hacer foto» cambia el estado a foto hecha', (await cuantos('.foto.hecha')) === 1, `${await cuantos('.foto.hecha')} fotos hechas`);
  anota('Sin el andamio de 912, nada llega «leído de la foto»', (await cuantos('.leido')) === 0, `${await cuantos('.leido')} marcas`);
  await pulsar('[data-foto="quitar"]');
  anota('«Quitarla» lo deshace', (await cuantos('.foto.hecha')) === 0 && (await cuantos('.foto')) === 1, 'sin foto');

  // El hueco de SCRUM-912: se enciende el andamio, se hace la foto, y los campos llegan marcados.
  await pulsar('#lectura');
  anota('Con el andamio y SIN foto, no hay nada leído', (await cuantos('.leido')) === 0, `${await cuantos('.leido')} marcas`);
  await pulsar('[data-foto="hacer"]');
  const importeLeido = await page.$eval('#a-importe', (e) => e.value);
  anota('Hueco de 912: con la foto, importe y fecha llegan marcados y hay aviso', (await cuantos('.leido')) === 2 && importeLeido === '84.70' && (await cuantos('#aviso-leido')) === 1, `${await cuantos('.leido')} marcas, importe=${importeLeido}`);
  await pulsar('#lectura');
  await pulsar('[data-foto="quitar"]');
  await page.$eval('#a-importe', (e) => { e.value = ''; });

  const guardar = async () => {
    await sinAvisos();
    const i = await page.$$eval('[data-accion="guardar"]', (b) => b.findIndex((x) => x.offsetParent !== null || getComputedStyle(x.parentElement).position === 'fixed'));
    await pulsar('[data-accion="guardar"]', i);
    await esperar(60);
    return { av: await aviso(), foco: await page.evaluate(() => document.activeElement && document.activeElement.id) };
  };
  let g = await guardar();
  anota('Guardar sin concepto avisa Y lleva el foco al campo', g.av === 'El concepto es obligatorio.' && g.foco === 'a-concepto', `«${g.av}», foco en #${g.foco}`);
  await page.type('#a-concepto', 'Tubería PVC 20mm');
  g = await guardar();
  anota('Guardar sin importe avisa Y lleva el foco al importe', g.av === 'El importe debe ser mayor que 0.' && g.foco === 'a-importe', `«${g.av}», foco en #${g.foco}`);
  await page.type('#a-importe', '38.90');
  g = await guardar();
  anota('Con los dos obligatorios, guarda (y lo dice)', g.av === 'En el prototipo no se guarda nada.', `«${g.av}»`);

  const abiertoAntes = await page.$eval('#p-factura', (e) => e.open);
  await pulsar('#p-factura > summary');
  const abiertoDespues = await page.$eval('#p-factura', (e) => e.open);
  anota('Los campos del proveedor llegan plegados y se abren', abiertoAntes === false && abiertoDespues === true, 'plegado → abierto');

  // ── El inventario no trae dentro el defecto que quita ─────────────────────
  await ir('inv');
  anota('El inventario no inyecta HTML de sus propias celdas', (await cuantos('.inv td table')) === 0, `${await cuantos('.inv td table')} tablas dentro de celdas`);

  anota('🔴 Ningún blanco estaba tapado al pulsarlo', tapados.length === 0, tapados.length ? tapados.join(' · ') : `0 tapados`);

  // ── ③ Capturas ────────────────────────────────────────────────────────────
  fs.mkdirSync(CAPTURAS, { recursive: true });
  // Estado limpio para las capturas: lo tecleado en las pruebas (p. ej. el importe 38,90) se queda
  // en el alta y taparía lo que la captura del hueco de 912 viene a enseñar.
  await page.reload({ waitUntil: 'load' });
  await cuadro();
  const tomas = [['lista', null], ['alta', null], ['alta-leida', 'lectura'], ['detalle', null], ['detalle-sin-foto', 'sinfoto'], ['inv', null]];
  for (const [i, [nombre, extra]] of tomas.entries()) {
    const tab = nombre.split('-')[0];
    await ir(tab);
    if (extra === 'lectura') { await pulsar('#lectura'); await pulsar('[data-foto="hacer"]'); await sinAvisos(); }
    if (extra === 'sinfoto') { await ir('lista'); await pulsar('.fila .que b', 2); }
    if (nombre === 'detalle') { await ir('lista'); await pulsar('.fila .que b', 1); }
    await sinAvisos();
    await page.evaluate(() => scrollTo(0, 0));
    // Ventana y página entera: la barra fija sale donde la ve el dedo en la de ventana.
    await page.screenshot({ path: path.join(CAPTURAS, `${a.nombre}-${i + 1}-${nombre}.png`), fullPage: false });
    // La del inventario entera no: son 3.400-10.700 px de tabla y ~780 KB que no enseñan nada que
    // no diga el propio prototipo.
    if (nombre !== 'inv') await page.screenshot({ path: path.join(CAPTURAS, `${a.nombre}-${i + 1}-${nombre}-entera.png`), fullPage: true });
    if (extra === 'lectura') { await pulsar('[data-foto="quitar"]'); await pulsar('#lectura'); }
  }

  await page.close();
  return { errores, positivo, porPantalla, comportamiento, geometria };
}

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--allow-file-access-from-files'] });
const out = {};
for (const a of ANCHURAS) out[a.nombre] = await medirAnchura(nav, a);
await nav.close();

let fallos = 0;
for (const a of ANCHURAS) {
  const r = out[a.nombre];
  console.log(`\n══ ${a.nombre} × ${a.h}${a.movil ? ' táctil' : ''} ═══════════════════════════════`);
  console.log(`errores de consola: ${r.errores.length}${r.errores.length ? '\n  ' + r.errores.join('\n  ') : ''}`);
  const pos = r.positivo;
  const ciego = !pos.desborde || !pos.pequeno || !pos.vetada;
  console.log(`control positivo (siembra que TIENE que disparar): desborde ${pos.desborde ? 'lo ve' : 'CIEGO'} · <44 px ${pos.pequeno ? 'lo ve' : 'CIEGO'} · frase vetada ${pos.vetada ? 'la ve' : 'CIEGO'}`);
  if (ciego) fallos++;
  console.log(`geometría de la lista (informativa): KPI ${r.geometria.kpisAlto} px de alto · primera fila a ${r.geometria.primeraFilaDesdeTitular} px del titular · una fila ${r.geometria.alturaFila} px`);
  for (const [p, d] of Object.entries(r.porPantalla)) {
    const mal = d.pagina || d.cajas.length || d.pequenos.length || d.vetadas.length;
    console.log(`  ${p.padEnd(8)} alto ${String(d.alto).padStart(5)} px · scroll-H página: ${d.pagina ? 'SÍ' : 'no'} · cajas que desbordan: ${d.cajas.length}${d.cajas.length ? ' → ' + d.cajas.join(' | ') : ''} · controles <44: ${d.pequenos.length}${d.pequenos.length ? ' → ' + d.pequenos.join(' | ') : ''} · frases vetadas: ${d.vetadas.length}${d.vetadas.length ? ' → ' + d.vetadas.join(', ') : ''}  [población: ${d.total} controles, ${d.cifras} cifras en ${EURO}]`);
    if (mal) fallos++;
  }
  if (r.errores.length) fallos++;
  console.log('  comportamiento (ESTADO DESPUÉS DE PULSAR):');
  for (const c of r.comportamiento) {
    console.log(`    ${c.ok ? '✓' : '✗'} ${c.q} — ${c.detalle}`);
    if (!c.ok) fallos++;
  }
}
console.log(`\ncapturas en ${CAPTURAS}`);
console.log(fallos === 0 ? '\nTODO EN VERDE' : `\n${fallos} COSAS EN ROJO`);
process.exit(fallos === 0 ? 0 : 1);

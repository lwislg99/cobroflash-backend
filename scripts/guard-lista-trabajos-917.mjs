// scripts/guard-lista-trabajos-917.mjs — SCRUM-917c
//
// LA LISTA DE TRABAJOS REDISEÑADA, MEDIDA FILA A FILA CONTRA SU INVENTARIO Y **PULSADA**.
//
// El fundador aprobó el prototipo entero (SCRUM-917, 18-sep-2026) con UNA condición que no se
// negocia: al final de cada corte, el inventario (`docs/prototipos/SCRUM-917/inventario-hoy.md` y
// la tabla «antes → después» de `trabajos.html`) CUADRA — ni una función perdida. Este guard es esa
// condición escrita como máquina: cada fila de los grupos A, B, C y G del inventario (los de la
// LISTA; D, E y F son del detalle, corte 917e) tiene aquí su comprobación, y la numeración la cita.
//
// 🔒 Una captura bonita no prueba que el botón funcione: se mide el ESTADO después de pulsar
// (la lección del «⋯» que se tragaba sus propios clics, commit 4d694e73). Por eso cada acción de
// la fila se PULSA con el ratón de verdad (`ElementHandle.click`, no `el.click()` en la página: un
// elemento tapado por otro no recibe el clic del ratón y sí el sintético) y se mira qué quedó:
// qué petición salió, qué modal se abrió, si navegó o no.
//
// Fuera de `npm test`, como el resto de guards de navegador: la suite no arranca navegador.
//
// Salidas: 0 de acuerdo · 1 he encontrado un defecto · 2 NO SUPE MIRAR · 3 no arrancó el navegador.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
import { servirListas, abrirNavegador, abrirVista } from './_banco-lista.mjs';
import { reglasDeDatos, EQUIPO } from './_trabajos-de-muestra.mjs';
import { TRABAJOS, DOSCIENTOS, DOS_MONEDAS, ahora } from './_trabajos-917.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICO = path.join(RAIZ, 'public');

let fallos = 0;
let ciego = 0;
let comprobaciones = 0;
const di = (s) => console.log(s);
const bien = (s) => { comprobaciones += 1; di('   ✅ ' + s); };
const mal = (s) => { comprobaciones += 1; console.error('   🔴 ' + s); fallos += 1; };
const nosupe = (s) => { console.error('   🔴 NO SUPE MIRAR: ' + s); ciego += 1; };
const titulo = (s) => {
  di('\n══════════════════════════════════════════════════════════════════════════════');
  di(s);
  di('══════════════════════════════════════════════════════════════════════════════');
};

// Los Trabajos de muestra viven en `_trabajos-917.mjs`, compartidos con las capturas.
const POR_ID = new Map(TRABAJOS.map((j) => [j.id, j]));

// Lo ESPERADO, calculado aquí y NO leído de la pantalla: si se leyera de ella, el guard aprobaría
// cualquier suma que la vista decidiera pintar.
const VIVOS = TRABAJOS.filter((j) => j.status !== 'cerrado');
const faltaDe = (j) => (j.importeReferencia == null ? null : Math.max(0, j.importeReferencia - j.totalCobrado));
const ESPERADO = {
  porCobrar: Math.round(VIVOS.reduce((a, j) => a + (faltaDe(j) || 0), 0) * 100) / 100,
  conFalta: VIVOS.filter((j) => faltaDe(j) > 0).length,
  sinImporte: VIVOS.filter((j) => j.importeReferencia == null).length,
  // «Para hoy» = lo que está en marcha + lo agendado para hoy (prototipo, `deHoy`).
  paraHoy: [1, 2],
  // Qué ofrece el «⋯» por estado: las seis entradas de hoy, sin perder una (inventario C.2).
  menu: {
    1: ['Técnicos', '✅ Marcar terminado'],
    3: ['Técnicos', 'Reagendar', '▶ Empezar', '📆 Añadir a mi calendario'],
    4: ['Técnicos', 'Agendar'],
    8: ['Técnicos', 'Cerrar trabajo'],
  },
};

// SCRUM-1205b · CADA RUTA DECLARA EL MODO DE EMISIÓN DE SU MERCHANT. Desde SCRUM-1205 la fila sólo
// ofrece «💰 Cobrar el resto» si `facturaFiscalDisponible()` —`collect-rest` emite una factura y
// en modo justificante corta con 409—, y esa función falla cerrado sin `appModoEmision`, que pone
// `app.js` y aquí no se carga. Sin declararlo, C.1 medía un modo «desconocido» que nadie escribió.
// Las de siempre son `fiscal`: es el modo en el que se decidió el inventario de SCRUM-917.
// `/t-justificante` es el caso que SCRUM-1205 introdujo y nadie vigilaba (C.6).
const RUTAS = [
  { ruta: '/t', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS), modoEmision: 'fiscal' },
  { ruta: '/t-sin-equipo', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS).replace('D.equipo', '[]'), modoEmision: 'fiscal' },
  { ruta: '/t-200', fnVista: 'renderJobsView', datos: reglasDeDatos(DOSCIENTOS), modoEmision: 'fiscal' },
  { ruta: '/t-monedas', fnVista: 'renderJobsView', datos: reglasDeDatos(DOS_MONEDAS), modoEmision: 'fiscal' },
  { ruta: '/t-justificante', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS), modoEmision: 'receipt' },
];

const { srv, puerto } = await servirListas(PUBLICO, RUTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
di('navegador: ' + quien + ' · ' + TRABAJOS.length + ' trabajos · hoy ' + ahora.toDateString());
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });

const SEL_FILA = '#view-container tr.jobs-fila';

/** La fila de un Trabajo, por su CLIENTE (único en el fixture): referenciar por identidad, no por posición. */
async function filaDe(page, id) {
  const nombre = POR_ID.get(id).customer.name;
  const h = await page.evaluateHandle((sel, n) => [...document.querySelectorAll(sel)]
    .find((tr) => (tr.querySelector('.cell-client b, .cell-client') || {}).textContent.includes(n)) || null, SEL_FILA, nombre);
  return h.asElement();
}
/** Un control DENTRO de la fila, por su texto visible. */
async function controlDe(page, id, texto) {
  const tr = await filaDe(page, id);
  if (!tr) return null;
  const h = await tr.evaluateHandle((el, t) => [...el.querySelectorAll('button, a')].find((b) => b.textContent.trim().startsWith(t)) || null, texto);
  return h.asElement();
}
const estado = (page) => page.evaluate(() => ({
  peticiones: window.__peticiones.map((p) => ({ ...p })),
  navegaciones: window.__navegaciones.map((n) => ({ ...n })),
  avisos: window.__avisos.map((a) => a.texto),
  modales: [...document.querySelectorAll('.modal-overlay')].map((o) => (o.querySelector('.jobs-modal-titulo, .modal-title, label') || o).textContent.trim().slice(0, 40)),
  menus: [...document.querySelectorAll('.overflow-menu, .overflow-sheet')].map((m) => [...m.children].map((c) => c.textContent.trim())),
}));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * Pulsar con el ratón, PERO con el control ya a la vista.
 *
 * 🔴 Medido en la segunda pasada: `ElementHandle.click()` desplaza la página para llegar al
 * control, y el evento `scroll` llega DESPUÉS de que el «⋯» se haya abierto — el menú (overflowMenu,
 * api.js) se cierra con el scroll, a propósito, y el guard leía un menú vacío. El rojo era del
 * instrumento, no de la pantalla: una persona no desplaza y pulsa en el mismo fotograma. Se lleva
 * el control a la vista, se deja asentar, y entonces se pulsa.
 */
async function pulsar(el) {
  // `behavior: 'instant'` a propósito: la hoja del panel declara `scroll-behavior: smooth`, y con
  // él el desplazamiento dura más que la espera y sus `scroll` siguen llegando con el menú ya
  // abierto. La tercera pasada lo enseñó: 3 de 4 menús vacíos, justo los que había que desplazar.
  await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await espera(120);
  await el.click();
}

// ═══ ⓪ SUELO ════════════════════════════════════════════════════════════════════════════════
titulo('⓪ SUELO · ¿hay pantalla, con sus filas, sus grupos y sus controles?');
{
  const { page, errores } = await abrirVista(browser, puerto, '/t', 1280);
  const r = await page.evaluate((sel) => ({
    filas: document.querySelectorAll(sel).length,
    cerradosPlegados: !!document.querySelector('tr.jobs-grupo-abrir button'),
  }), SEL_FILA);
  if (errores.length) nosupe('la vista dejó errores en consola: ' + errores.join(' | '));
  // El grupo de Cerrados llega plegado (SCRUM-428): 11 filas a la vista y 1 detrás de su botón.
  if (r.filas !== TRABAJOS.length - 1) nosupe(`${r.filas} filas pintadas y esperaba ${TRABAJOS.length - 1} (los cerrados, plegados). Sin las filas, todo lo de abajo sería cierto por vacío.`);
  else di(`   filas pintadas: ${r.filas} de ${TRABAJOS.length} (1 cerrado detrás de su botón: ${r.cerradosPlegados ? 'sí' : 'NO'})`);
  await page.close();
}

// ═══ A · LO QUE SE VE ARRIBA ════════════════════════════════════════════════════════════════
titulo('A · arriba: título y botones (A.1) · las DOS cifras (A.2) · filtros de cobro (A.2) · filtro de técnico (A.3)');
{
  const { page } = await abrirVista(browser, puerto, '/t', 1280);
  const fmt = (n) => page.evaluate((x) => window.fmtMoneyEs(x, 'EUR'), n);
  const arriba = await page.evaluate(() => {
    const p = document.querySelector('.jobs-pantalla');
    const cifras = [...document.querySelectorAll('.jobs-cifra')].map((c) => ({
      rotulo: (c.querySelector('.jobs-cifra-rotulo') || {}).textContent || null,
      valor: (c.querySelector('.jobs-cifra-valor') || {}).textContent || null,
      pie: (c.querySelector('.jobs-cifra-pie') || {}).textContent || null,
      antesDeLaLista: !!(p && document.getElementById('jobs-list') && (c.compareDocumentPosition(document.getElementById('jobs-list')) & Node.DOCUMENT_POSITION_FOLLOWING)),
    }));
    return {
      h2: (document.querySelector('.jobs-cabecera h2') || {}).textContent || null,
      nuevo: !!document.getElementById('jobs-nuevo-btn'),
      // SCRUM-1700 (T7 de SCRUM-1686, D1=A c.21461; N2 c.21470): la puerta provisional de la
      // cabecera se RETIRA; «Partes por valorar» vive en el menú (#nav-partes-oficina), que este
      // banco no monta: el número del menú lo mide tests/scrum1700-abrir-parte-y-partes-por-valorar.
      valorar: !!document.getElementById('jobs-partes-valorar'),
      // SCRUM-1725i · el eje de COBRO vive en un desplegable de la barra («Cobro: todos (N)», c.22098) y
      // el de ESTADO en pestañas con contador (patrón de Albaranes). Se leen los dos, y las píldoras de
      // antes (`#jobs-filter > button`) se cuentan para exigir que ya no estén.
      filtros: [...document.querySelectorAll('#jobs-filter select.jobs-filtro-cobro option')].map((o) => o.textContent.trim()),
      pildorasDeCobro: document.querySelectorAll('#jobs-filter > button').length,
      pestanas: [...document.querySelectorAll('#jobs-filter .data-card-tab')].map((b) => ({
        rotulo: (b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.textContent : '').trim(),
        n: (b.querySelector('.badge') || {}).textContent || null,
        pulsada: b.getAttribute('aria-pressed'),
      })),
      tecnico: !!document.getElementById('jobs-filtro-tecnico-select'),
      cifras,
    };
  });
  // A.1 · igual
  if (arriba.h2 === 'Trabajos' && arriba.nuevo && !arriba.valorar) bien('A.1 «Trabajos» + «Nuevo trabajo» arriba; la puerta provisional «Partes por valorar» ya no está en la cabecera');
  else mal(`A.1 arriba no es lo firmado (SCRUM-1700): ${JSON.stringify({ h2: arriba.h2, nuevo: arriba.nuevo, valorarEnCabecera: arriba.valorar })}`);

  // A.2 · los filtros por cobro, en cuentas: igual
  const cuentas = { Pendiente: 0, Parcial: 0, Pagado: 0 };
  for (const j of TRABAJOS) if (cuentas[j.estadoCobro] != null) cuentas[j.estadoCobro]++;
  // SCRUM-1725i (c.22098) · las mismas cuatro cuentas, ahora como opciones de UN desplegable:
  // «Todos · N» pasa a «Cobro: todos (N)» (el «Todos» a secas es ya la pestaña de estado).
  const filtrosEsperados = [`Cobro: todos (${TRABAJOS.length})`, `Pendiente (${cuentas.Pendiente})`, `Parcial (${cuentas.Parcial})`, `Pagado (${cuentas.Pagado})`];
  if (JSON.stringify(arriba.filtros) === JSON.stringify(filtrosEsperados)) bien(`A.2 filtros de cobro, en cuentas: ${arriba.filtros.join(' · ')}`);
  else mal(`A.2 filtros: ${JSON.stringify(arriba.filtros)} ≠ ${JSON.stringify(filtrosEsperados)}`);
  if (arriba.pildorasDeCobro === 0) bien('A.2 el cobro va en el desplegable: ninguna píldora suelta en la barra');
  else mal(`A.2 siguen ${arriba.pildorasDeCobro} píldoras de filtro sueltas en la barra (c.22098: el cobro va en el desplegable)`);

  // A.4 (SCRUM-1725i) · las pestañas de ESTADO: «Todos» + las cinco de la ficha, con su cuenta.
  const ESTADOS_DE_LA_FICHA = [['pendiente_agendar', 'Sin agendar'], ['agendado', 'Agendado'], ['en_curso', 'En curso'], ['terminado', 'Terminado'], ['cerrado', 'Cerrado']];
  const pestanasEsperadas = [{ rotulo: 'Todos', n: String(TRABAJOS.length), pulsada: 'true' }]
    .concat(ESTADOS_DE_LA_FICHA.map(([estado, rotulo]) => ({ rotulo, n: String(TRABAJOS.filter((j) => j.status === estado).length), pulsada: 'false' })));
  if (JSON.stringify(arriba.pestanas) === JSON.stringify(pestanasEsperadas)) bien(`A.4 pestañas de estado, en cuentas: ${arriba.pestanas.map((p) => `${p.rotulo} ${p.n}`).join(' · ')}`);
  else mal(`A.4 pestañas de estado: ${JSON.stringify(arriba.pestanas)} ≠ ${JSON.stringify(pestanasEsperadas)}`);

  // A.2 · 🔴 LAS DOS CIFRAS — lo que estaba MAL DECIDIDO: la pantalla no decía en euros cuánto falta.
  const hoy = arriba.cifras.find((c) => c.rotulo === 'Para hoy');
  const cobrar = arriba.cifras.find((c) => c.rotulo === 'Por cobrar');
  const valorEsperado = await fmt(ESPERADO.porCobrar);
  if (!hoy) mal('A.2 no hay cifra «Para hoy»');
  else if (hoy.valor !== `${ESPERADO.paraHoy.length} trabajos` || !hoy.antesDeLaLista) mal(`A.2 «Para hoy» dice «${hoy.valor}» (esperaba «${ESPERADO.paraHoy.length} trabajos») · antes de la lista: ${hoy.antesDeLaLista}`);
  else if (!ESPERADO.paraHoy.every((id) => (hoy.pie || '').includes(POR_ID.get(id).customer.name))) mal(`A.2 el pie de «Para hoy» no nombra a los de hoy: «${hoy.pie}»`);
  else bien(`A.2 «Para hoy · ${hoy.valor}» · ${hoy.pie}`);
  const pieEsperado = `en ${ESPERADO.conFalta} trabajos sin cerrar · ${ESPERADO.sinImporte} sin importe de referencia, no entran`;
  if (!cobrar) mal('A.2 🔴 no hay cifra «Por cobrar»: la pantalla sigue sin decir en euros cuánto falta');
  else if (cobrar.valor !== valorEsperado) mal(`A.2 «Por cobrar» dice «${cobrar.valor}» y la suma es ${valorEsperado}`);
  else if ((cobrar.pie || '').trim() !== pieEsperado) mal(`A.2 pie de «Por cobrar»: «${cobrar.pie}» ≠ «${pieEsperado}»`);
  else if (!cobrar.antesDeLaLista) mal('A.2 «Por cobrar» se pinta DESPUÉS de la lista: tiene que contestar antes');
  else bien(`A.2 «Por cobrar · ${cobrar.valor}» · ${cobrar.pie}`);

  // A.3 · filtro por técnico: con equipo, se conserva
  if (arriba.tecnico) bien('A.3 filtro por técnico presente con equipo');
  else mal('A.3 falta el filtro por técnico con equipo dado de alta');

  // A.2 · y el filtro FILTRA: se pulsa y se mira qué filas quedan.
  // SCRUM-1725i · antes se PULSABA la píldora «Pendiente»; ahora se ELIGE en el desplegable, como lo
  // hace una persona (`page.select` dispara `input` y `change`). Lo que se exige es lo mismo: quedan
  // las filas pendientes, el control dice lo elegido y la cifra de arriba no se mueve.
  const SEL_COBRO = '#jobs-filter select.jobs-filtro-cobro';
  if (!(await page.$(SEL_COBRO))) nosupe('no encontré el desplegable de cobro para elegir «Pendiente»');
  else {
    await page.select(SEL_COBRO, 'Pendiente');
    await espera(120);
    const tras = await page.evaluate((sel, selCobro) => ({
      filas: document.querySelectorAll(sel).length,
      elegido: (document.querySelector(selCobro) || {}).value,
      cifra: ([...document.querySelectorAll('.jobs-cifra')].find((c) => /Por cobrar/.test(c.textContent)) || {}).textContent || null,
    }), SEL_FILA, SEL_COBRO);
    const pendientesVisibles = TRABAJOS.filter((j) => j.estadoCobro === 'Pendiente' && j.status !== 'cerrado').length;
    if (tras.filas !== pendientesVisibles || tras.elegido !== 'Pendiente') mal(`A.2 elegir «Pendiente» deja ${tras.filas} filas (esperaba ${pendientesVisibles}) · el desplegable dice «${tras.elegido}»`);
    else bien(`A.2 elegir «Pendiente» deja ${tras.filas} filas y el desplegable lo dice`);
    // La cifra de arriba contesta «cuánto me deben», no «cuánto hay en este filtro»: no se mueve.
    if (!tras.cifra || !tras.cifra.includes(valorEsperado)) mal(`A.2 con el filtro puesto, «Por cobrar» cambió: «${tras.cifra}»`);
    else bien('A.2 con el filtro puesto, «Por cobrar» sigue siendo el total');
    // Se deja como estaba: lo de abajo (A.4, A.1) mide la lista entera.
    await page.select(SEL_COBRO, 'all');
    await espera(120);
  }

  // A.4 (SCRUM-1725i) · y las pestañas FILTRAN, pulsadas con el ratón. «Cerrado» enseña los cerrados
  // DIRECTOS (sin «Ver N cerrados»); «Todos» los vuelve a plegar (P2 de c.22098).
  const pestana = (rotulo) => page.evaluateHandle((r) => [...document.querySelectorAll('#jobs-filter .data-card-tab')]
    .find((b) => b.firstChild && b.firstChild.textContent.trim() === r) || null, rotulo);
  const loQueSeVe = () => page.evaluate((sel) => ({
    pildoras: [...document.querySelectorAll(sel)].map((tr) => (tr.querySelector('td.cell-status .status-pill') || {}).textContent || ''),
    plegados: !!document.querySelector('tr.jobs-grupo-abrir button'),
    pulsadas: [...document.querySelectorAll('#jobs-filter .data-card-tab[aria-pressed="true"]')].map((b) => b.firstChild.textContent.trim()),
  }), SEL_FILA);
  const cerradosEsperados = TRABAJOS.filter((j) => j.status === 'cerrado').length;
  const terminadosEsperados = TRABAJOS.filter((j) => j.status === 'terminado').length;
  const bCerrado = (await pestana('Cerrado')).asElement();
  const bTerminado = (await pestana('Terminado')).asElement();
  const bTodos = (await pestana('Todos')).asElement();
  if (!bCerrado || !bTerminado || !bTodos) nosupe('no encontré las pestañas «Cerrado», «Terminado» y «Todos» para pulsarlas');
  else if (!cerradosEsperados || !terminadosEsperados) nosupe('el fixture no trae ni un cerrado o ni un terminado: pulsar esas pestañas no probaría nada');
  else {
    await pulsar(bCerrado);
    await espera(120);
    const enCerrado = await loQueSeVe();
    if (enCerrado.pildoras.length === cerradosEsperados && enCerrado.pildoras.every((p) => p === 'Cerrado') && !enCerrado.plegados && enCerrado.pulsadas.join() === 'Cerrado') bien(`A.4 la pestaña «Cerrado» enseña sus ${cerradosEsperados} directamente, sin «Ver N cerrados»`);
    else mal(`A.4 pestaña «Cerrado»: ${JSON.stringify(enCerrado)} (esperaba ${cerradosEsperados} filas «Cerrado», sin botón de plegados)`);
    await pulsar(bTerminado);
    await espera(120);
    const enTerminado = await loQueSeVe();
    if (enTerminado.pildoras.length === terminadosEsperados && enTerminado.pildoras.every((p) => p === 'Terminado') && !enTerminado.plegados) bien(`A.4 la pestaña «Terminado» enseña sus ${terminadosEsperados} y nada más`);
    else mal(`A.4 pestaña «Terminado»: ${JSON.stringify(enTerminado)} (esperaba ${terminadosEsperados} filas «Terminado»)`);
    await pulsar(bTodos);
    await espera(120);
    const enTodos = await loQueSeVe();
    if (enTodos.pildoras.length === TRABAJOS.length - cerradosEsperados && enTodos.plegados && enTodos.pulsadas.join() === 'Todos') bien(`A.4 «Todos» vuelve a las ${enTodos.pildoras.length} filas sin cerrar, con los cerrados plegados`);
    else mal(`A.4 «Todos»: ${JSON.stringify({ filas: enTodos.pildoras.length, plegados: enTodos.plegados, pulsadas: enTodos.pulsadas })} (esperaba ${TRABAJOS.length - cerradosEsperados} filas y los cerrados plegados)`);
  }

  // A.1 · y el botón de arriba HACE lo suyo. («Partes por valorar» ya no está aquí: SCRUM-1700.)
  const trasValorar = await estado(page);
  await pulsar(await page.$('#jobs-nuevo-btn'));
  await espera(150);
  const trasNuevo = await estado(page);
  if (trasNuevo.modales.length > trasValorar.modales.length) bien('A.1 «Nuevo trabajo» abre su modal');
  else mal('A.1 «Nuevo trabajo» no abrió ningún modal');
  await page.close();
}
for (const [ruta, motivo] of [['/t-200', 'la lista llega truncada (200 filas)'], ['/t-monedas', 'hay dos monedas']]) {
  const { page } = await abrirVista(browser, puerto, ruta, 1280);
  const r = await page.evaluate((sel) => ({
    filas: document.querySelectorAll(sel).length,
    rotulos: [...document.querySelectorAll('.jobs-cifra-rotulo')].map((x) => x.textContent),
  }), SEL_FILA);
  if (r.filas < 2) nosupe(`${ruta} pintó ${r.filas} filas: «no se pinta» sería cierto por no haber pintado nada`);
  else if (r.rotulos.includes('Por cobrar')) mal(`A.2 «Por cobrar» se pinta aunque ${motivo}: la suma sería de una parte, o de dos monedas`);
  else if (!r.rotulos.includes('Para hoy')) mal(`A.2 con ${motivo} desapareció también «Para hoy», y ése no depende de la suma`);
  else bien(`A.2 con ${motivo} «Por cobrar» NO se pinta (y «Para hoy» sí) · ${r.filas} filas`);
  await page.close();
}

// ═══ B · LAS COLUMNAS ═══════════════════════════════════════════════════════════════════════
titulo('B · columnas (B.1) · técnico en la línea del cliente (B.2) · una píldora por fila (B.3) · la cifra grande es lo que falta (B.4-B.6)');
{
  const { page } = await abrirVista(browser, puerto, '/t', 1280);
  const fmt = (n) => page.evaluate((x) => window.fmtMoneyEs(x, 'EUR'), n);
  const th = await page.evaluate(() => [...document.querySelectorAll('#view-container table thead th')].map((x) => x.textContent.trim()));
  // SCRUM-1725g · entra «Estado» (firmado, SCRUM-1725 c.22076; cambio de exigencia autorizado en
  // c.22078): la lista es plana y el estado lo dice la fila. «Técnicos» sigue sin ser columna.
  if (JSON.stringify(th) === JSON.stringify(['Cliente', 'Importe', 'Fecha', 'Estado', 'Acciones'])) bien('B.1 cinco columnas: ' + th.join(' · '));
  else mal(`B.1 columnas ${JSON.stringify(th)} (esperaba Cliente · Importe · Fecha · Estado · Acciones: «Técnicos» deja de ser columna)`);

  const celdas = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((tr) => {
    const imp = tr.querySelector('td.cell-amount');
    const partes = imp ? [...imp.children].map((c) => ({ t: c.textContent.trim(), fs: parseFloat(getComputedStyle(c).fontSize) })) : [];
    const cli = tr.querySelector('td.cell-client');
    return {
      cliente: (cli && cli.querySelector('b') || cli || {}).textContent?.trim() || '',
      linea: (cli && cli.querySelector('.jobs-fila-linea') || {}).textContent?.trim() || '',
      desplegable: !!(cli && cli.querySelector('details.jobs-tecnicos-menu')),
      celdaTecnicos: !!tr.querySelector('td.cell-tecnicos'),
      fecha: (tr.querySelector('td.cell-date') || {}).textContent?.trim() ?? null,
      // `.jobs-estado-pill` es la clase de la píldora que 917c quitó: se cuenta también, para que
      // su vuelta al lado de la nueva sea «dos», no «una».
      pildoras: tr.querySelectorAll('.status-pill, .jobs-estado-pill').length,
      importe: partes,
    };
  }), SEL_FILA);
  const deCliente = (id) => celdas.find((c) => c.cliente === POR_ID.get(id).customer.name);

  // B.2 · el técnico baja a la línea del cliente (con equipo, con el desplegable de SCRUM-816)
  const sinDesplegable = celdas.filter((c) => !c.desplegable);
  if (celdas.some((c) => c.celdaTecnicos)) mal('B.2 sigue habiendo celda de técnicos como columna');
  else if (sinDesplegable.length) mal(`B.2 con equipo, ${sinDesplegable.length} filas sin el desplegable de técnicos en la línea del cliente`);
  else bien(`B.2 el desplegable de técnicos vive en la línea del cliente en ${celdas.length} de ${celdas.length} filas`);
  const f1 = deCliente(1);
  if (!f1 || !f1.linea.startsWith('Cambio de cuadro eléctrico')) mal(`B.2 la línea del cliente no lleva el nombre propio del trabajo (tituloPropio): «${f1 && f1.linea}»`);
  else bien(`B.2 línea del cliente: «${f1.linea}»`);
  const f4 = deCliente(4);
  if (!f4 || f4.linea.startsWith('Lucía Romero')) mal(`B.2 sin nombre propio, la línea repite el cliente: «${f4 && f4.linea}»`);
  else bien(`B.2 sin nombre propio no se repite el cliente · «${f4.linea}»`);

  // B.3 · Fecha: la fecha o nada. Y la píldora: EXACTAMENTE UNA por fila, nunca dos apiladas.
  // SCRUM-1725g · CAMBIA DE EXIGENCIA (autorizado con nombre: SCRUM-1725 c.22081). Exigía «cero
  // píldoras "Sin agendar" debajo de su cabecera» buscando `.jobs-estado-pill`; desde la lista
  // plana esa clase no existe y la comprobación daba verde sin mirar nada. No se retira: C.4 lee
  // SOLO la primera píldora de la celda de estado (`querySelector`), así que dos apiladas le
  // pasarían. Aquí se cuentan TODAS las de la fila, estén en la celda que estén.
  const sinUna = celdas.filter((c) => c.pildoras !== 1);
  if (!celdas.length) nosupe('B.3 el banco no pinta ninguna fila: no se puede contar píldoras.');
  else if (sinUna.length) mal(`B.3 ${sinUna.length} de ${celdas.length} filas no llevan exactamente UNA píldora: ${sinUna.map((c) => `${c.cliente} ×${c.pildoras}`).join(' · ')}`);
  else bien(`B.3 exactamente una píldora por fila en ${celdas.length} de ${celdas.length} filas`);
  if (!f4 || f4.fecha !== '') mal(`B.3 un Trabajo sin fecha enseña «${f4 && f4.fecha}» en Fecha (esperaba nada)`);
  else bien('B.3 sin fecha, la celda Fecha está vacía');
  const f3 = deCliente(3);
  if (!f3 || !f3.fecha) mal('B.3 un Trabajo con fecha no la enseña');
  else bien(`B.3 con fecha, la enseña: «${f3.fecha}»`);

  // B.4 · la cifra grande es LO QUE FALTA, y debajo «de total»
  for (const id of [1, 3, 8]) {
    const j = POR_ID.get(id);
    const c = deCliente(id);
    const falta = await fmt(faltaDe(j));
    const de = 'de ' + await fmt(j.importeReferencia);
    if (!c || c.importe.length < 2) { mal(`B.4 ${j.customer.name}: la celda de importe no tiene dos partes: ${JSON.stringify(c && c.importe)}`); continue; }
    const [a, b] = c.importe;
    if (a.t !== falta || b.t !== de || !(a.fs > b.fs)) mal(`B.4 ${j.customer.name}: «${a.t}» (${a.fs}px) / «${b.t}» (${b.fs}px) · esperaba «${falta}» grande / «${de}» pequeño`);
    else bien(`B.4 ${j.customer.name}: «${a.t}» grande · «${b.t}» debajo`);
  }
  // B.4 · cobrado del todo → «✓ Cobrado»
  {
    const c = deCliente(12);
    const tot = await fmt(300);
    if (!c || !c.importe[0] || c.importe[0].t !== '✓ Cobrado' || !(c.importe[1] && c.importe[1].t === tot)) mal(`B.4 cobrado del todo: ${JSON.stringify(c && c.importe)} (esperaba «✓ Cobrado» + «${tot}»)`);
    else bien(`B.4 cobrado del todo: «✓ Cobrado» · «${tot}»`);
  }
  // B.5 · sin eje → «Sin importe · no hay presupuesto aceptado» (antes «—»)
  for (const id of [6, 9]) {
    const c = deCliente(id);
    const txt = c ? c.importe.map((x) => x.t) : [];
    if (JSON.stringify(txt) !== JSON.stringify(['Sin importe', 'no hay presupuesto aceptado'])) mal(`B.5 ${POR_ID.get(id).customer.name} sin eje: ${JSON.stringify(txt)}`);
    else bien(`B.5 ${POR_ID.get(id).customer.name}: «Sin importe» · «no hay presupuesto aceptado»`);
  }
  // B.6 · 🔴 cobrado DE MÁS: NO se construye (esperando a la S1). Se pinta COMO HOY.
  {
    const j = POR_ID.get(7);
    const c = deCliente(7);
    const txt = c ? c.importe.map((x) => x.t) : [];
    const hoy = [await fmt(j.quote.total), `${await fmt(j.totalCobrado)} de ${await fmt(j.importeReferencia)}`];
    const todo = JSON.stringify(celdas);
    if (JSON.stringify(txt) !== JSON.stringify(hoy)) mal(`B.6 cobrado de más: ${JSON.stringify(txt)} · tiene que pintarse como hoy: ${JSON.stringify(hoy)}`);
    else if (/cobrado de más/i.test(todo)) mal('B.6 se pinta «cobrado de más», que NO está firmado');
    else bien(`B.6 cobrado de más, como hoy: «${txt.join('» · «')}»`);
  }
  await page.close();
}
{
  // B.2 · SIN equipo: la línea no dice «Sin asignar» nunca; los nombres que CONSTAN se dicen.
  const { page } = await abrirVista(browser, puerto, '/t-sin-equipo', 1280);
  const r = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((tr) => ({
    texto: tr.textContent,
    desplegable: !!tr.querySelector('details.jobs-tecnicos-menu'),
  })), SEL_FILA);
  if (r.length < 5) nosupe(`sin equipo pintó ${r.length} filas`);
  else {
    const sinAsignar = r.filter((x) => x.texto.includes('Sin asignar')).length;
    if (sinAsignar) mal(`B.2 sin equipo, «Sin asignar» sale en ${sinAsignar} de ${r.length} filas (esperaba 0: ausente ≠ cero)`);
    else bien(`B.2 sin equipo, «Sin asignar» en 0 de ${r.length} filas`);
    if (r.some((x) => x.desplegable)) mal('B.2 sin equipo se pinta un desplegable sin opciones');
    else bien('B.2 sin equipo, ningún desplegable');
    const conNombre = r.filter((x) => x.texto.includes(EQUIPO[0].name)).length;
    if (conNombre !== 2) mal(`B.2 sin equipo, los técnicos que SÍ constan (${EQUIPO[0].name}) salen en ${conNombre} filas y esperaba 2`);
    else bien(`B.2 sin equipo, los técnicos que constan se siguen diciendo (${conNombre} filas)`);
  }
  await page.close();
}

// ═══ C · LAS ACCIONES, PULSADAS ═════════════════════════════════════════════════════════════
titulo('C · nunca dos primarias en la misma fila (C.1, SCRUM-1700) · el «⋯» entero (C.2) · la fila navega (C.3) · grupos (C.4-C.5) · sin cobro en modo justificante (C.6)');
{
  const { page } = await abrirVista(browser, puerto, '/t', 1280);
  // SCRUM-1700 · RE-ANCLADO a la regla FIRMADA por el fundador (SCRUM-1700 c.21526, opción (b) «N1»):
  // «cada fila con su primaria y nunca dos verdes en la MISMA fila». El anclaje viejo (917c: UNA sola
  // primaria en TODA la lista, la del dinero) se midió en ROJO contra el código de 1700:
  // 2 ["Abrir parte","💰 Cobrar el resto (740,00 €)"] — dos primarias, en DOS filas distintas, que es
  // justo lo que la regla nueva permite. Lo que se exige ahora: ninguna fila con más de UNA `.btn-primary`,
  // la del dinero sigue en su fila, y la del en curso es «Abrir parte».
  const porFila = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((f) => [...f.querySelectorAll('.btn-primary')].map((b) => b.textContent.trim())), SEL_FILA);
  const esperadaPrim = '💰 Cobrar el resto (' + await page.evaluate(() => window.fmtMoneyEs(740, 'EUR')) + ')';
  const dobles = porFila.filter((p) => p.length > 1);
  const primarias = porFila.flat();
  if (!porFila.length) mal('C.1 no hay filas que medir en /t');
  else if (dobles.length) mal(`C.1 dos primarias en la MISMA fila: ${JSON.stringify(dobles)}`);
  else if (!primarias.includes(esperadaPrim)) mal(`C.1 falta la primaria del dinero «${esperadaPrim}»: ${JSON.stringify(primarias)}`);
  else if (!primarias.includes('Abrir parte')) mal(`C.1 falta la primaria «Abrir parte» del en curso: ${JSON.stringify(primarias)}`);
  else bien(`C.1 ${porFila.length} filas, ninguna con dos primarias · primarias: ${JSON.stringify(primarias)}`);

  // C.1 · «Agendar» sigue, en secundaria, y ABRE el modal de agendar sin navegar
  {
    const b = await controlDe(page, 4, 'Agendar');
    if (!b) mal('C.1 la fila sin agendar no tiene «Agendar»');
    else {
      const clase = await b.evaluate((x) => x.className);
      const antes = await estado(page);
      await pulsar(b);
      await espera(100);
      const d = await estado(page);
      if (/btn-primary/.test(clase)) mal(`C.1 «Agendar» sigue siendo primaria (${clase})`);
      else if (d.modales.length !== antes.modales.length + 1 || d.navegaciones.length !== antes.navegaciones.length) mal(`C.1 pulsar «Agendar»: modales ${antes.modales.length}→${d.modales.length}, navegaciones ${antes.navegaciones.length}→${d.navegaciones.length}`);
      else bien(`C.1 «Agendar» en secundaria (${clase}) · pulsado abre «${d.modales.slice(-1)[0]}» y no navega`);
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
    }
  }
  // C.1 · «▶ Empezar» escribe la transición y NO navega
  {
    const b = await controlDe(page, 3, '▶ Empezar');
    if (!b) mal('C.1 la fila agendada no tiene «▶ Empezar»');
    else {
      const antes = await estado(page);
      await pulsar(b);
      await espera(100);
      const d = await estado(page);
      const nuevas = d.peticiones.slice(antes.peticiones.length);
      const p = nuevas.find((x) => x.metodo === 'PATCH');
      if (!p || p.ruta !== '/admin/jobs/3' || !/"status":"en_curso"/.test(p.cuerpo)) mal(`C.1 «▶ Empezar» no escribió en_curso: ${JSON.stringify(nuevas)}`);
      else if (d.navegaciones.length !== antes.navegaciones.length) mal('C.1 «▶ Empezar» navegó');
      else bien(`C.1 «▶ Empezar» · PATCH ${p.ruta} ${p.cuerpo} · no navega`);
    }
  }
  // C.1 · la primaria del dinero COBRA
  {
    const b = await controlDe(page, 8, '💰 Cobrar el resto');
    if (!b) mal('C.1 no encuentro «💰 Cobrar el resto» en el terminado con saldo');
    else {
      const antes = await estado(page);
      await pulsar(b);
      await espera(150);
      const d = await estado(page);
      const p = d.peticiones.slice(antes.peticiones.length).find((x) => x.metodo === 'POST');
      if (!p || p.ruta !== '/admin/jobs/8/collect-rest') mal(`C.1 «💰 Cobrar el resto» no pidió el cobro: ${JSON.stringify(d.peticiones.slice(antes.peticiones.length))}`);
      else bien(`C.1 «💰 Cobrar el resto» · POST ${p.ruta}`);
    }
  }
  await page.close();
}
{
  // C.2 · el «⋯»: las mismas entradas por estado, y cada una HACE lo suyo al pulsarla.
  const { page } = await abrirVista(browser, puerto, '/t', 1280);
  for (const [id, esperadas] of Object.entries(ESPERADO.menu)) {
    const tr = await filaDe(page, Number(id));
    const disparador = tr && (await tr.$('.overflow-trigger'));
    if (!disparador) { mal(`C.2 la fila de ${POR_ID.get(Number(id)).customer.name} no tiene «⋯»`); continue; }
    await pulsar(disparador);
    await espera(60);
    const d = await estado(page);
    const menu = d.menus[0] || [];
    if (JSON.stringify(menu) !== JSON.stringify(esperadas)) mal(`C.2 «⋯» de ${POR_ID.get(Number(id)).customer.name}: ${JSON.stringify(menu)} ≠ ${JSON.stringify(esperadas)}`);
    else bien(`C.2 «⋯» de ${POR_ID.get(Number(id)).customer.name}: ${menu.join(' · ')}`);
    await page.keyboard.press('Escape');
    await espera(40);
  }
  // Y se PULSA una entrada de dentro: «✅ Marcar terminado» tiene que escribir.
  {
    const tr = await filaDe(page, 1);
    await pulsar(await tr.$('.overflow-trigger'));
    await espera(60);
    const item = (await page.evaluateHandle(() => [...document.querySelectorAll('.overflow-menu > *')].find((x) => x.textContent.trim() === '✅ Marcar terminado') || null)).asElement();
    const antes = await estado(page);
    if (!item) mal('C.2 no encuentro «✅ Marcar terminado» dentro del «⋯» abierto');
    else {
      await pulsar(item);
      await espera(100);
      const d = await estado(page);
      const p = d.peticiones.slice(antes.peticiones.length).find((x) => x.metodo === 'PATCH');
      if (!p || p.ruta !== '/admin/jobs/1' || !/"status":"terminado"/.test(p.cuerpo)) mal(`C.2 pulsar «✅ Marcar terminado» del «⋯» no escribió: ${JSON.stringify(d.peticiones.slice(antes.peticiones.length))}`);
      else bien(`C.2 pulsar «✅ Marcar terminado» del «⋯» · PATCH ${p.ruta} ${p.cuerpo}`);
    }
  }
  // …y «Técnicos» abre su modal.
  {
    const tr = await filaDe(page, 4);
    await pulsar(await tr.$('.overflow-trigger'));
    await espera(60);
    const item = (await page.evaluateHandle(() => [...document.querySelectorAll('.overflow-menu > *')].find((x) => x.textContent.trim() === 'Técnicos') || null)).asElement();
    if (!item) mal('C.2 no encuentro «Técnicos» dentro del «⋯»');
    else {
      await pulsar(item);
      await espera(150);
      const d = await estado(page);
      if (!d.modales.some((m) => m.startsWith('Técnicos'))) mal(`C.2 pulsar «Técnicos» del «⋯» no abrió su modal: ${JSON.stringify(d.modales)}`);
      else bien('C.2 pulsar «Técnicos» del «⋯» abre el modal «Técnicos»');
    }
  }
  await page.close();
}
{
  // C.3 · la fila entera abre el Trabajo; no escribe
  const { page } = await abrirVista(browser, puerto, '/t', 1280);
  const tr = await filaDe(page, 4);
  const celda = tr && (await tr.$('td.cell-amount'));
  const antes = await estado(page);
  if (!celda) mal('C.3 no encuentro la celda de importe para pulsar la fila');
  else {
    await pulsar(celda);
    const d = await estado(page);
    const nav = d.navegaciones.slice(antes.navegaciones.length);
    const escrituras = d.peticiones.slice(antes.peticiones.length).filter((p) => p.metodo !== 'GET');
    if (nav.length !== 1 || nav[0].vista !== 'jobs-detail' || !nav[0].params || nav[0].params.jobId !== 4) mal(`C.3 el clic en la fila no abrió el Trabajo 4: ${JSON.stringify(nav)}`);
    else if (escrituras.length) mal(`C.3 el clic en la fila ESCRIBIÓ: ${JSON.stringify(escrituras)}`);
    else bien('C.3 el clic en la fila abre el Trabajo 4 y no escribe');
  }

  // ── SCRUM-1725g · C.4 y C.5 CAMBIAN DE EXIGENCIA (autorizado con nombre: SCRUM-1725 c.22078) ──
  // Exigían los siete rótulos de grupo en su orden, «📅 Hoy · 1», la cabecera «✅ Terminados — cobra
  // el resto · 4 · 740,00 € por cobrar» y su salvedad larga. El requisito cambió: veredicto del
  // fundador (c.22073, «un listado normal como los que tenemos en otros sitios») y P1-P4 firmadas
  // (c.22076). La lista es PLANA. Lo que queda de la intención de cada una:
  //   C.4 · ni una cabecera de grupo; las filas van en el ORDEN de la cola (en curso → hoy → esta
  //         semana → sin agendar → más adelante → terminados), con lo de hoy justo detrás de lo que
  //         está en curso; y cada fila dice su estado con la etiqueta de `jobStatusMeta`.
  //   C.5 · no hay cabecera de Terminados ni salvedad larga; el terminado con saldo lleva su
  //         «💰 Cobrar el resto», que es donde queda dicho lo que falta.
  // El tramo de cada Trabajo se calcula AQUÍ, con los datos del banco, y no se le pregunta a la
  // página: si se lo preguntara, el orden se compararía consigo mismo.
  const plana = await page.evaluate((sel) => ({
    cabeceras: [...document.querySelectorAll('tr.jobs-grupo-titulo, tr.jobs-grupo-salvedad')].map((t) => t.textContent.trim()),
    cuerpos: document.querySelectorAll('table.table--trabajos tbody').length,
    etiquetas: Object.fromEntries(['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado'].map((s) => [s, window.jobStatusMeta(s).label])),
    filas: [...document.querySelectorAll(sel)].map((tr) => {
      const cli = tr.querySelector('td.cell-client');
      return {
        cliente: (cli && cli.querySelector('b') || cli || {}).textContent?.trim() || '',
        pildora: (tr.querySelector('td.cell-status .status-pill') || {}).textContent?.trim() ?? null,
        cobrarElResto: [...tr.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('💰 Cobrar el resto (')),
      };
    }),
  }), SEL_FILA);
  const ahoraC4 = new Date();
  const TRAMOS = ['en curso', 'hoy', 'esta semana', 'sin agendar', 'más adelante', 'terminados'];
  const tramoDe = (j) => {
    if (j.status === 'en_curso') return 0;
    if (j.status === 'terminado') return 5;
    const d = j.scheduledAt ? new Date(j.scheduledAt) : null;
    if (j.status === 'agendado' && d && d.toDateString() === ahoraC4.toDateString()) return 1;
    if (j.status === 'agendado' && d && d.getTime() <= ahoraC4.getTime() + 7 * 86400000) return 2;
    if (j.status === 'pendiente_agendar') return 3;
    return 4;
  };
  const conSuTrabajo = plana.filas.map((f) => ({ ...f, job: TRABAJOS.find((j) => j.customer && j.customer.name === f.cliente) || null }));
  const sinTrabajo = conSuTrabajo.filter((f) => !f.job);
  if (!conSuTrabajo.length || sinTrabajo.length) nosupe(`C.4 ${sinTrabajo.length} de ${conSuTrabajo.length} filas no casan con ningún Trabajo del banco: sin eso, el orden y la píldora no se pueden comprobar.`);
  else {
    if (plana.cabeceras.length || plana.cuerpos !== 1) mal(`C.4 la lista no es plana: ${plana.cabeceras.length} fila(s) de cabecera ${JSON.stringify(plana.cabeceras)} y ${plana.cuerpos} tbody (esperaba 0 y 1)`);
    else bien(`C.4 lista plana: 0 cabeceras de grupo, 1 tbody, ${conSuTrabajo.length} filas`);
    const tramos = conSuTrabajo.map((f) => tramoDe(f.job));
    const vistos = [...new Set(tramos)].sort();
    const enOrden = tramos.every((t, i) => i === 0 || tramos[i - 1] <= t);
    // SUELO del orden: con un solo tramo en el banco, «en orden» sería cierto sin ordenar nada.
    if (vistos.length !== TRAMOS.length) nosupe(`C.4 el banco pinta ${vistos.length} de los ${TRAMOS.length} tramos (${vistos.map((t) => TRAMOS[t]).join(' · ')}): el orden no queda probado.`);
    else if (!enOrden) mal(`C.4 las filas no van en el orden de la cola: ${tramos.map((t) => TRAMOS[t]).join(' → ')}`);
    else bien('C.4 orden de la cola: ' + TRAMOS.map((n, t) => `${n} ×${tramos.filter((x) => x === t).length}`).join(' → '));
    const deHoy = tramos.filter((t) => t === 1).length;
    if (deHoy !== 1 || tramos[tramos.lastIndexOf(0) + 1] !== 1) mal(`C.4 esperaba 1 agendado para hoy, justo detrás de los en curso; hay ${deHoy} y los tramos van ${tramos.join(',')}`);
    else bien('C.4 lo de hoy (1) va justo detrás de lo que está en curso');
    const malDichas = conSuTrabajo.filter((f) => f.pildora !== plana.etiquetas[f.job.status]);
    if (malDichas.length) mal(`C.4 ${malDichas.length} fila(s) no dicen su estado con la etiqueta de la ficha: ${malDichas.map((f) => `${f.cliente} «${f.pildora}» ≠ «${plana.etiquetas[f.job.status]}»`).join(' · ')}`);
    else bien(`C.4 las ${conSuTrabajo.length} filas dicen su estado (${[...new Set(conSuTrabajo.map((f) => f.pildora))].join(' · ')})`);

    // C.5 · sin cabecera de Terminados ni salvedad larga; el cobro, en la fila
    const dichoArriba = plana.cabeceras.filter((c) => /Terminados|sin importe de referencia: /.test(c));
    if (dichoArriba.length) mal(`C.5 vuelve la cabecera de Terminados o su salvedad: ${JSON.stringify(dichoArriba)}`);
    else bien('C.5 sin cabecera de Terminados ni salvedad larga');
    const terminadosConBoton = conSuTrabajo.filter((f) => f.job.status === 'terminado' && f.cobrarElResto);
    if (!terminadosConBoton.length) mal('C.5 ningún terminado trae «💰 Cobrar el resto (…)»: sin la cabecera, lo que falta por cobrar ya no lo dice nadie en la lista');
    else bien(`C.5 ${terminadosConBoton.length} terminado(s) con «💰 Cobrar el resto (…)» en su fila`);
  }
  await page.close();
}
{
  // C.6 · SCRUM-1205b · EN MODO JUSTIFICANTE NO SE OFRECE COBRAR EL RESTO, NI COMO PRIMARIA NI COMO
  // SIGUIENTE PASO: `collect-rest` emite una factura y ahí corta con 409. Los MISMOS Trabajos que
  // `/t`, donde C.1 exige el botón: lo único que cambia entre las dos páginas es el modo.
  const { page, errores } = await abrirVista(browser, puerto, '/t-justificante', 1280);
  const r = await page.evaluate((sel) => ({
    filas: document.querySelectorAll(sel).length,
    cobros: [...document.querySelectorAll(sel + ' button, ' + sel + ' a')].map((b) => b.textContent.trim()).filter((t) => /Cobrar/.test(t)),
    primarias: [...document.querySelectorAll(sel + ' .btn-primary')].map((b) => b.textContent.trim()),
    modo: window.appModoEmision,
  }), SEL_FILA);
  if (errores.length) nosupe('en modo justificante la vista dejó errores en consola: ' + errores.join(' | '));
  else if (r.modo !== 'receipt') nosupe(`la página de modo justificante lleva appModoEmision=${JSON.stringify(r.modo)}: no mediría el modo que dice`);
  // Sin las filas —y sin la del terminado con saldo—, «no hay cobro» sería cierto por vacío.
  else if (r.filas !== TRABAJOS.length - 1 || !(await filaDe(page, 8))) nosupe(`en modo justificante ${r.filas} filas (esperaba ${TRABAJOS.length - 1}) o falta la de ${POR_ID.get(8).customer.name}`);
  else if (r.cobros.length) mal(`C.6 en modo justificante la lista ofrece cobrar, y ese cobro acaba en 409: ${JSON.stringify(r.cobros)}`);
  else bien(`C.6 en modo justificante ningún «Cobrar» en ${r.filas} filas (primarias: ${JSON.stringify(r.primarias)})`);
  await page.close();
}

// ═══ G · TAMAÑOS Y ANCHO ════════════════════════════════════════════════════════════════════
titulo('G · todo control a ≥ 44 px (G.2) y sin scroll horizontal, a 1280 y a 390');
for (const [ancho, alto] of [[1280, 900], [390, 844]]) {
  const { page } = await abrirVista(browser, puerto, '/t', ancho, alto);
  const m = await page.evaluate(() => {
    const p = document.querySelector('.jobs-pantalla');
    if (!p) return null;
    const visibles = [...p.querySelectorAll('button, a[href], input, select, summary')].filter((el) => {
      if (el.type === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const chicos = [];
    for (const el of visibles) {
      let h = el.getBoundingClientRect().height;
      // Exclusión DECLARADA, la misma que en SCRUM-915/917: una casilla dentro de una etiqueta de
      // ≥ 44 px cumple, porque el blanco del dedo es la etiqueta.
      if (el.type === 'checkbox' && el.closest('label')) h = el.closest('label').getBoundingClientRect().height;
      if (h < 43.5) chicos.push(`${el.tagName.toLowerCase()}«${(el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 24)}» ${h.toFixed(0)}px`);
    }
    // G.3 · ningún TEXTO de la pantalla se sale de su caja. Lo enseñó la captura a 390 px, no una
    // comprobación: «… 740,00 € por cobrar» quedaba cortado en la cabecera de Terminados (y la
    // salvedad aprobada ya se cortaba ANTES de este ticket). `scrollWidth > clientWidth` es el
    // desborde; sin `overflow` visible no hay barra que lo delate.
    const cajas = [...p.querySelectorAll('td, .jobs-cifra-pie, .jobs-cifra-valor, .jobs-fila-linea')]
      .filter((el) => el.getBoundingClientRect().width > 0);
    const cortados = cajas.filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `«${el.textContent.trim().slice(0, 40)}» ${el.scrollWidth}>${el.clientWidth}`);
    return {
      cajas: cajas.length,
      cortados,
      controles: visibles.length,
      chicos,
      vp: window.innerWidth,
      doc: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    };
  });
  if (!m || m.controles < 20) { nosupe(`a ${ancho} px encontré ${m ? m.controles : 0} controles: con tan pocos, «ninguno pequeño» no dice nada`); await page.close(); continue; }
  if (m.chicos.length) mal(`G.2 a ${ancho} px, ${m.chicos.length} de ${m.controles} controles por debajo de 44 px: ${m.chicos.slice(0, 6).join(' · ')}${m.chicos.length > 6 ? ' …' : ''}`);
  else bien(`G.2 a ${ancho} px, 0 de ${m.controles} controles por debajo de 44 px`);
  if (m.cajas < 30) nosupe(`a ${ancho} px sólo vi ${m.cajas} cajas de texto: «ninguna cortada» no diría nada`);
  else if (m.cortados.length) mal(`G.3 a ${ancho} px, ${m.cortados.length} de ${m.cajas} textos se salen de su caja: ${m.cortados.slice(0, 4).join(' · ')}`);
  else bien(`G.3 a ${ancho} px, 0 de ${m.cajas} textos cortados`);
  if (m.doc > m.vp + 0.5 || m.body > m.vp + 0.5) mal(`G a ${ancho} px la página scrollea en horizontal (doc ${m.doc}, body ${m.body})`);
  else bien(`G a ${ancho} px sin scroll horizontal`);
  await page.close();
}

await browser.close();
srv.close();

di('');
di(`población: ${comprobaciones} comprobaciones sobre ${TRABAJOS.length} trabajos + 200 + 2 monedas + sin equipo · a 1280 y 390`);
if (ciego) console.error(`🔴 NO SUPE MIRAR en ${ciego} sitio(s): un silencio así no es un verde.`);
if (fallos) console.error(`🔴 ${fallos} de ${comprobaciones} comprobaciones en rojo.`);
// SCRUM-1320 · el veredicto sale de las DOS cuentas (`_hallazgos-y-ciegos.mjs`): el hallazgo da el
// código aunque haya ciegos, y la línea dice las dos. Antes el ciego se miraba primero y lo tapaba.
const veredictoFinal = veredictoDe({ hallazgos: fallos, ciegos: ciego });
if (veredictoFinal.codigo !== 0) { console.error(veredictoFinal.linea); process.exit(veredictoFinal.codigo); }
di(`✅ la lista cuadra con su inventario: ${comprobaciones} de ${comprobaciones}.`);

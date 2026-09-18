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
import { servirListas, abrirNavegador, abrirVista } from './_banco-lista.mjs';
import { reglasDeDatos, EQUIPO } from './_trabajos-de-muestra.mjs';

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

// ── LOS TRABAJOS · uno por caso que el inventario nombra ─────────────────────────────────────
//
// Las fechas se calculan AL CORRER, en la hora local de esta máquina, que es la del navegador que
// pinta: «hoy» tiene que ser hoy, o el grupo «📅 Hoy» se mediría sobre un día que no es.
const ahora = new Date();
const enDias = (d, h, m = 0) => new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + d, h, m).toISOString();

function trabajo(id, cliente, o) {
  const ref = o.ref === undefined ? null : o.ref;
  const cobrado = o.cobrado || 0;
  return {
    id,
    status: o.status,
    scheduledAt: o.fecha || null,
    assignedUserId: null,
    notes: null,
    createdAt: '2026-09-01T09:00:00.000Z',
    titulo: o.titulo || cliente,
    tituloPropio: o.titulo || null,
    direccion: null,
    totalAceptado: ref,
    totalCobrado: cobrado,
    estadoCobro: ref == null ? null : (cobrado <= 0 ? 'Pendiente' : (cobrado >= ref ? 'Pagado' : 'Parcial')),
    importeReferencia: ref,
    customer: { id: 100 + id, name: cliente, phone: null },
    operarioId: null,
    operario: null,
    asignados: o.asignados || [],
    tipoOperacion: 'TRABAJO_UNICO',
    quote: ref == null ? null : { id, number: id, total: o.totalPresupuesto || ref, currency: o.moneda || 'EUR', paymentTerms: null },
    remaining: o.resto ? { amount: o.resto, currency: o.moneda || 'EUR' } : null,
    nextStage: null,
    pendingStagesCount: 0,
    hasCustomPlan: false,
    albaranes: o.albaranes || [],
    invoices: [],
  };
}

// Doce Trabajos: los cinco estados, los tres casos de dinero (falta, cobrado del todo, sin eje) y
// el caso que NO se construye (cobrado de más), que tiene que pintarse COMO HOY.
const TRABAJOS = [
  trabajo(1, 'Ana Cuadro', { status: 'en_curso', fecha: enDias(-1, 9), ref: 590, titulo: 'Cambio de cuadro eléctrico', asignados: [EQUIPO[0]] }),
  trabajo(2, 'Comunidad Los Olivos', { status: 'agendado', fecha: enDias(0, 16, 30), ref: 380, cobrado: 190, titulo: 'Revisión anual del portero', asignados: [EQUIPO[1]] }),
  trabajo(3, 'Recarga Garaje', { status: 'agendado', fecha: enDias(2, 8), ref: 970.23, cobrado: 291.07 }),
  trabajo(4, 'Lucía Romero', { status: 'pendiente_agendar', ref: 590 }),
  trabajo(5, 'QA Cinco', { status: 'pendiente_agendar', ref: 417.45 }),
  trabajo(6, 'Taller Hnos. Vega', { status: 'pendiente_agendar', titulo: 'Urgencia: sin luz en nave' }),
  trabajo(7, 'Cliente Electricista', { status: 'terminado', fecha: enDias(-7, 10), ref: 539.05, cobrado: 628.6 }),
  trabajo(8, 'Bar El Puerto', { status: 'terminado', fecha: enDias(-6, 12), ref: 1240, cobrado: 500, resto: 740, titulo: 'Cámara frigorífica', asignados: [EQUIPO[0], EQUIPO[1]] }),
  trabajo(9, 'Inmobiliaria Sur', { status: 'terminado', fecha: enDias(-9, 9, 30) }),
  trabajo(10, 'Hotel Arenal', { status: 'agendado', fecha: enDias(11, 9), ref: 2150 }),
  trabajo(11, 'Pilar Ibáñez', { status: 'cerrado', fecha: enDias(-20, 11), ref: 145, cobrado: 145 }),
  trabajo(12, 'Pagado Entero', { status: 'terminado', fecha: enDias(-5, 9), ref: 300, cobrado: 300 }),
];
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
  grupos: ['🔨 En curso', '📅 Hoy', '📅 Esta semana', '⏳ Sin agendar', '🗓 Más adelante', '✅ Terminados — cobra el resto', '🔒 Cerrados'],
  // Qué ofrece el «⋯» por estado: las seis entradas de hoy, sin perder una (inventario C.2).
  menu: {
    1: ['Técnicos', '✅ Marcar terminado'],
    3: ['Técnicos', 'Reagendar', '▶ Empezar', '📆 Añadir a mi calendario'],
    4: ['Técnicos', 'Agendar'],
    8: ['Técnicos', 'Cerrar trabajo'],
  },
};

// Dos pantallas más para las dos veces que «Por cobrar» NO se pinta: con la lista truncada (200
// filas, el `take` de `GET /admin/jobs`) la suma sería de una parte que parece el todo; con dos
// monedas, una suma de euros y dólares no es un importe.
const DOSCIENTOS = Array.from({ length: 200 }, (_, i) => trabajo(1000 + i, 'Cliente ' + i, { status: 'pendiente_agendar', ref: 100 }));
const DOS_MONEDAS = [
  trabajo(1, 'En Euros', { status: 'pendiente_agendar', ref: 100 }),
  trabajo(2, 'En Dólares', { status: 'pendiente_agendar', ref: 100, moneda: 'USD' }),
];

const RUTAS = [
  { ruta: '/t', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS) },
  { ruta: '/t-sin-equipo', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS).replace('D.equipo', '[]') },
  { ruta: '/t-200', fnVista: 'renderJobsView', datos: reglasDeDatos(DOSCIENTOS) },
  { ruta: '/t-monedas', fnVista: 'renderJobsView', datos: reglasDeDatos(DOS_MONEDAS) },
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
      valorar: !!document.getElementById('jobs-partes-valorar'),
      filtros: [...document.querySelectorAll('#jobs-filter > button')].map((b) => b.textContent.trim()),
      tecnico: !!document.getElementById('jobs-filtro-tecnico-select'),
      cifras,
    };
  });
  // A.1 · igual
  if (arriba.h2 === 'Trabajos' && arriba.nuevo && arriba.valorar) bien('A.1 «Trabajos» + «Nuevo trabajo» + «Partes por valorar» siguen');
  else mal(`A.1 falta algo de arriba: ${JSON.stringify({ h2: arriba.h2, nuevo: arriba.nuevo, valorar: arriba.valorar })}`);

  // A.2 · los filtros por cobro, en cuentas: igual
  const cuentas = { Pendiente: 0, Parcial: 0, Pagado: 0 };
  for (const j of TRABAJOS) if (cuentas[j.estadoCobro] != null) cuentas[j.estadoCobro]++;
  const filtrosEsperados = [`Todos · ${TRABAJOS.length}`, `Pendiente · ${cuentas.Pendiente}`, `Parcial · ${cuentas.Parcial}`, `Pagado · ${cuentas.Pagado}`];
  if (JSON.stringify(arriba.filtros) === JSON.stringify(filtrosEsperados)) bien(`A.2 filtros de cobro, en cuentas: ${arriba.filtros.join(' · ')}`);
  else mal(`A.2 filtros: ${JSON.stringify(arriba.filtros)} ≠ ${JSON.stringify(filtrosEsperados)}`);

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
  const bPend = await page.evaluateHandle(() => [...document.querySelectorAll('#jobs-filter > button')].find((b) => b.textContent.startsWith('Pendiente')) || null);
  if (!bPend.asElement()) nosupe('no encontré el filtro «Pendiente» para pulsarlo');
  else {
    await bPend.asElement().click();
    const tras = await page.evaluate((sel) => ({
      filas: document.querySelectorAll(sel).length,
      pulsado: ([...document.querySelectorAll('#jobs-filter > button')].find((b) => b.textContent.startsWith('Pendiente')) || {}).getAttribute?.('aria-pressed'),
      cifra: ([...document.querySelectorAll('.jobs-cifra')].find((c) => /Por cobrar/.test(c.textContent)) || {}).textContent || null,
    }), SEL_FILA);
    const pendientesVisibles = TRABAJOS.filter((j) => j.estadoCobro === 'Pendiente' && j.status !== 'cerrado').length;
    if (tras.filas !== pendientesVisibles || tras.pulsado !== 'true') mal(`A.2 pulsar «Pendiente» deja ${tras.filas} filas (esperaba ${pendientesVisibles}) · aria-pressed ${tras.pulsado}`);
    else bien(`A.2 pulsar «Pendiente» deja ${tras.filas} filas y queda pulsado`);
    // La cifra de arriba contesta «cuánto me deben», no «cuánto hay en este filtro»: no se mueve.
    if (!tras.cifra || !tras.cifra.includes(valorEsperado)) mal(`A.2 con el filtro puesto, «Por cobrar» cambió: «${tras.cifra}»`);
    else bien('A.2 con el filtro puesto, «Por cobrar» sigue siendo el total');
  }

  // A.1 · y los dos botones de arriba HACEN lo suyo.
  const antes = await estado(page);
  await (await page.$('#jobs-partes-valorar'))?.click();
  const trasValorar = await estado(page);
  const nav = trasValorar.navegaciones.slice(antes.navegaciones.length);
  if (nav.length === 1 && nav[0].vista === 'partes-oficina') bien('A.1 «Partes por valorar» lleva a partes-oficina');
  else mal(`A.1 «Partes por valorar» no navegó bien: ${JSON.stringify(nav)}`);
  await (await page.$('#jobs-nuevo-btn'))?.click();
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
titulo('B · columnas (B.1) · técnico en la línea del cliente (B.2) · sin píldora (B.3) · la cifra grande es lo que falta (B.4-B.6)');
{
  const { page } = await abrirVista(browser, puerto, '/t', 1280);
  const fmt = (n) => page.evaluate((x) => window.fmtMoneyEs(x, 'EUR'), n);
  const th = await page.evaluate(() => [...document.querySelectorAll('#view-container table thead th')].map((x) => x.textContent.trim()));
  if (JSON.stringify(th) === JSON.stringify(['Cliente', 'Importe', 'Fecha', 'Acciones'])) bien('B.1 cuatro columnas: ' + th.join(' · '));
  else mal(`B.1 columnas ${JSON.stringify(th)} (esperaba Cliente · Importe · Fecha · Acciones: «Técnicos» deja de ser columna)`);

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
      pildora: !!tr.querySelector('.jobs-estado-pill'),
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

  // B.3 · Fecha: la fecha o nada; ninguna píldora que repita su cabecera
  const conPildora = celdas.filter((c) => c.pildora).length;
  if (conPildora) mal(`B.3 ${conPildora} filas siguen con la píldora «Sin agendar» debajo de su cabecera`);
  else bien('B.3 cero píldoras «Sin agendar» en las filas');
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
titulo('C · una sola primaria y es la del dinero (C.1) · el «⋯» entero (C.2) · la fila navega (C.3) · grupos (C.4-C.5)');
{
  const { page } = await abrirVista(browser, puerto, '/t', 1280);
  const primarias = await page.evaluate((sel) => [...document.querySelectorAll(sel + ' .btn-primary')].map((b) => b.textContent.trim()), SEL_FILA);
  const esperadaPrim = '💰 Cobrar el resto (' + await page.evaluate(() => window.fmtMoneyEs(740, 'EUR')) + ')';
  if (primarias.length === 1 && primarias[0] === esperadaPrim) bien(`C.1 una sola primaria en la lista: «${primarias[0]}»`);
  else mal(`C.1 primarias en las filas: ${primarias.length} ${JSON.stringify(primarias)} (esperaba solo «${esperadaPrim}»)`);

  // C.1 · «Agendar» sigue, en secundaria, y ABRE el modal de agendar sin navegar
  {
    const b = await controlDe(page, 4, 'Agendar');
    if (!b) mal('C.1 la fila sin agendar no tiene «Agendar»');
    else {
      const clase = await b.evaluate((x) => x.className);
      const antes = await estado(page);
      await b.click();
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
      await b.click();
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
      await b.click();
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
    await disparador.click();
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
    await (await tr.$('.overflow-trigger')).click();
    await espera(60);
    const item = (await page.evaluateHandle(() => [...document.querySelectorAll('.overflow-menu > *')].find((x) => x.textContent.trim() === '✅ Marcar terminado') || null)).asElement();
    const antes = await estado(page);
    if (!item) mal('C.2 no encuentro «✅ Marcar terminado» dentro del «⋯» abierto');
    else {
      await item.click();
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
    await (await tr.$('.overflow-trigger')).click();
    await espera(60);
    const item = (await page.evaluateHandle(() => [...document.querySelectorAll('.overflow-menu > *')].find((x) => x.textContent.trim() === 'Técnicos') || null)).asElement();
    if (!item) mal('C.2 no encuentro «Técnicos» dentro del «⋯»');
    else {
      await item.click();
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
    await celda.click();
    const d = await estado(page);
    const nav = d.navegaciones.slice(antes.navegaciones.length);
    const escrituras = d.peticiones.slice(antes.peticiones.length).filter((p) => p.metodo !== 'GET');
    if (nav.length !== 1 || nav[0].vista !== 'jobs-detail' || !nav[0].params || nav[0].params.jobId !== 4) mal(`C.3 el clic en la fila no abrió el Trabajo 4: ${JSON.stringify(nav)}`);
    else if (escrituras.length) mal(`C.3 el clic en la fila ESCRIBIÓ: ${JSON.stringify(escrituras)}`);
    else bien('C.3 el clic en la fila abre el Trabajo 4 y no escribe');
  }

  // C.4 · grupos, en su orden, con «📅 Hoy» separado de «Esta semana»
  const grupos = await page.evaluate(() => [...document.querySelectorAll('tr.jobs-grupo-titulo td')].map((t) => t.textContent.trim()));
  const orden = grupos.map((g) => ESPERADO.grupos.find((e) => g.startsWith(e + ' ·')) || '?' + g);
  if (JSON.stringify(orden) !== JSON.stringify(ESPERADO.grupos)) mal(`C.4 grupos ${JSON.stringify(grupos)} (esperaba ${ESPERADO.grupos.join(' · ')})`);
  else bien('C.4 grupos: ' + orden.join(' · '));
  const hoyG = grupos.find((g) => g.startsWith('📅 Hoy'));
  if (hoyG !== '📅 Hoy · 1') mal(`C.4 el grupo «📅 Hoy» dice «${hoyG}» (esperaba «📅 Hoy · 1»: el en curso va en su grupo)`);
  else bien('C.4 «📅 Hoy · 1»');

  // C.5 · la cabecera de Terminados: microcopy aprobada + «por cobrar» junto a la suma
  const term = grupos.find((g) => g.startsWith('✅ Terminados'));
  const sumaT = await page.evaluate(() => window.fmtMoneyEs(740, 'EUR'));
  const cabT = `✅ Terminados — cobra el resto · 4 · ${sumaT} por cobrar`;
  if (term !== cabT) mal(`C.5 cabecera de Terminados «${term}» ≠ «${cabT}»`);
  else bien(`C.5 «${term}»`);
  const salvedad = await page.evaluate(() => (document.querySelector('tr.jobs-grupo-salvedad td') || {}).textContent || null);
  if (salvedad !== '1 sin importe de referencia: no se sabe cuánto falta y no entran en el total.') mal(`C.5 la salvedad aprobada cambió o falta: «${salvedad}»`);
  else bien('C.5 salvedad aprobada, palabra por palabra');
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
    return {
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
  if (m.doc > m.vp + 0.5 || m.body > m.vp + 0.5) mal(`G a ${ancho} px la página scrollea en horizontal (doc ${m.doc}, body ${m.body})`);
  else bien(`G a ${ancho} px sin scroll horizontal`);
  await page.close();
}

await browser.close();
srv.close();

di('');
di(`población: ${comprobaciones} comprobaciones sobre ${TRABAJOS.length} trabajos + 200 + 2 monedas + sin equipo · a 1280 y 390`);
if (ciego) { console.error(`🔴 NO SUPE MIRAR en ${ciego} sitio(s): un silencio así no es un verde.`); process.exit(2); }
if (fallos) { console.error(`🔴 ${fallos} de ${comprobaciones} comprobaciones en rojo.`); process.exit(1); }
di(`✅ la lista cuadra con su inventario: ${comprobaciones} de ${comprobaciones}.`);

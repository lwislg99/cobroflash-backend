// scripts/guard-lista-gastos.mjs — SCRUM-920c (con SCRUM-944 punto 1)
//
// LA LISTA DE GASTOS, SIN TABLA, MEDIDA EN UN NAVEGADOR DE VERDAD Y **PULSADA**.
//
// El prototipo de Gastos lo aprobó el fundador (SCRUM-920) y no estaba en pantalla: «un diseño
// aprobado que no está en la pantalla NO está hecho». Este guard es lo que dice que ya está:
//
//   ⓪ SUELO · hay pantalla, con sus filas y sus tres KPI. Sin filas, todo lo demás sería cierto por vacío.
//   A · 🔴 NO SE RECORRE DE LADO. A 390 px la lista de hoy (una <table style="min-width:600px">) medía
//        628 px dentro de una caja de 366 y había que arrastrarla para ver el importe. Aquí: sin
//        <table>, sin `.table-scroll`, la página no desborda y NINGUNA caja de la lista se sale de la suya.
//   B · TODO CONTROL A 44 PX (AB6), a 390 y a 1280.
//   C · 🔴 SCRUM-944 punto 1 · EL KPI «Mayor categoría» NO ENSEÑA LA CLAVE INTERNA. Con una categoría
//        que la pantalla no conoce («materials») el KPI decía «materials». Ahora dice «Otros», y la
//        píldora de la fila igual. Con una conocida dice su nombre (POSITIVO).
//   D · 🔴 CADA OPCIÓN DEL «⋯» CAMBIA EL ESTADO AL PULSARLA — con el ratón de verdad, no con `el.click()`
//        (la lección del «⋯» que se tragaba sus propios clics, 917): Editar abre el modal con ese gasto ·
//        Ver trabajo navega a ese trabajo y no abre nada · Eliminar pregunta y, si se acepta, borra ESE
//        gasto y la lista lo pierde; si se rechaza, no sale ninguna petición (NEGATIVO).
//   E · LA FILA Y SUS DOS EXCEPCIONES: tocar la fila abre el gasto; tocar el enlace del trabajo navega y
//        NO abre el modal; tocar el «⋯» no abre el modal.
//   F · «Sin trabajo» / «Presupuesto sin trabajo» / el nombre del trabajo, y el proveedor debajo.
//   G · SE CONSERVA LO QUE YA ESTABA: el estado vacío palabra por palabra, el filtro de categoría pide
//        `category=`, el CSV lleva mes y categoría, «Nuevo gasto» abre el alta.
//   H · CERO `style=` EN LÍNEA en la pantalla (norma A7) y las cinco píldoras pasan AA (4,5:1).
//
// Fuera de `npm test`, como el resto de guards de navegador: la suite no arranca navegador.
// Salidas: 0 de acuerdo · 1 he encontrado un defecto · 2 NO SUPE MIRAR · 3 no arrancó el navegador.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// `GASTOS_PUBLICO` existe para el CONTROL EN ROJO: apuntarlo a un `public/` con la lista de antes (la
// tabla) y comprobar que el guard cae. Sin ella, el `public/` de este árbol.
const PUBLICO = process.env.GASTOS_PUBLICO || path.join(RAIZ, 'public');

let fallos = 0;
let ciego = 0;
const di = (s) => console.log(s);
const bien = (s) => di('   ✅ ' + s);
const mal = (s) => { console.error('   🔴 ' + s); fallos += 1; };
const nosupe = (s) => { console.error('   🔴 NO SUPE MIRAR: ' + s); ciego += 1; };
const titulo = (s) => {
  di('\n══════════════════════════════════════════════════════════════════════════════');
  di(s);
  di('══════════════════════════════════════════════════════════════════════════════');
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// Un guard que se cuelga no dice nada: mejor «no supe mirar» a los cuatro minutos que un CI parado.
setTimeout(() => {
  console.error('🔴 NO SUPE MIRAR: el guard lleva más de 4 minutos sin terminar (una pulsación que no vuelve). Esto NO es «de acuerdo».');
  process.exit(2);
}, 240000).unref();

// ── LA MUESTRA ──────────────────────────────────────────────────────────────────────────────
// La forma es la de `listExpenses` (`expenses.service.ts`): `job` resuelto, `quote`, `provider`, `tieneFoto`.
const FECHA = '2026-09-17T10:00:00.000Z';
const gasto = (id, concept, category, amount, extra = {}) => ({
  id, concept, category, amount: amount.toFixed(2), currency: 'EUR', date: FECHA, notes: null,
  quoteId: null, providerId: null, tieneFoto: false, quote: null, provider: null, job: null, ...extra,
});
const JOB_500 = { id: 500, titulo: 'Presupuesto #5 · María López' };
const LARGO = 'Materialdeconstruccionmuylargosinespaciosparaprobarquenodesbordalacaja';
const ITEMS = [
  gasto(1, 'Tubo de cobre 22 mm', 'materiales', 42, { notes: 'Ticket del almacén', quoteId: 50, quote: { id: 50 }, job: JOB_500, provider: { id: 9, name: 'Saltoki' } }),
  gasto(2, 'Gasolina', 'desplazamiento', 61.3),
  gasto(3, 'Taladro percutor', 'herramientas', 129.9, { quoteId: 51, quote: { id: 51 }, job: { id: 501, titulo: 'Reforma baño' } }),
  gasto(4, 'Fontanero autónomo', 'subcontrata', 9999.99, { quoteId: 52, quote: { id: 52 }, job: { id: 502, titulo: 'Cocina Ruiz' }, provider: { id: 10, name: 'Instalaciones Pérez' } }),
  gasto(5, 'Varios', 'otros', 5),
  gasto(6, 'Silicona', 'materials', 3, { quoteId: 50, quote: { id: 50 }, job: JOB_500 }),
  gasto(7, 'Cinta aislante', 'materiales', 3.2, { quoteId: 77, quote: { id: 77 } }),
  gasto(8, LARGO + LARGO, 'materiales', 18, { notes: LARGO + ' ' + LARGO }),
];
const total = (xs) => Math.round(xs.reduce((a, g) => a + Number(g.amount), 0) * 100) / 100;
const porCategoria = (xs) => {
  const m = new Map();
  for (const g of xs) m.set(g.category, (m.get(g.category) || 0) + Number(g.amount));
  return [...m].map(([category, amount]) => ({ category, amount }));
};
const resumen = (xs) => ({
  totalAmount: total(xs), unassignedAmount: total(xs.filter((g) => !g.job)), byCategory: porCategoria(xs),
});

/** Lo que hace de servidor: la lista (con estado, para que borrar quite la fila), el resumen y el borrado. */
function datos(items, res) {
  return `(function () {
  var D = ${JSON.stringify({ items, res })};
  var borrados = [];
  return function (ruta, opciones) {
    var metodo = (opciones && opciones.method) || 'GET';
    var borra = /\\/admin\\/expenses\\/(\\d+)$/.exec(ruta);
    if (metodo === 'DELETE' && borra) { borrados.push(Number(borra[1])); return { ok: true }; }
    if (/\\/admin\\/expenses\\/summary/.test(ruta)) return D.res;
    if (/\\/admin\\/expenses/.test(ruta)) return { items: D.items.filter(function (g) { return borrados.indexOf(g.id) < 0; }) };
    return [];
  };
})()`;
}

// El resumen de «mayor categoría desconocida»: lo que más pesa es una clave que la pantalla no conoce.
const ITEMS_CRUDA = [gasto(1, 'Silicona', 'materials', 500), gasto(2, 'Gasolina', 'desplazamiento', 40)];

const RUTAS = [
  { ruta: '/g', fnVista: 'renderExpensesView', datos: datos(ITEMS, resumen(ITEMS)) },
  { ruta: '/g-cruda', fnVista: 'renderExpensesView', datos: datos(ITEMS_CRUDA, resumen(ITEMS_CRUDA)) },
  { ruta: '/g-vacio', fnVista: 'renderExpensesView', datos: datos([], resumen([])) },
];

const { srv, puerto } = await servirListas(PUBLICO, RUTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
di('navegador: ' + quien + ' · ' + ITEMS.length + ' gastos de muestra');
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });

const SEL_FILA = '#view-container .gasto-fila';

/** Abre la vista con los diálogos nativos (`confirm`) APUNTADOS y contestados como pida `respuesta.aceptar`. */
async function abrir(ruta, ancho, respuesta = { aceptar: true }) {
  const { page, errores } = await abrirVista(browser, puerto, ruta, ancho);
  page.__dialogos = [];
  page.on('dialog', async (d) => { page.__dialogos.push(d.message()); if (respuesta.aceptar) await d.accept(); else await d.dismiss(); });
  return { page, errores };
}
/** La fila de un gasto por su CONCEPTO (único en la muestra): por identidad, no por posición. */
async function filaDe(page, concept) {
  const h = await page.evaluateHandle((sel, c) => [...document.querySelectorAll(sel)]
    .find((f) => (f.querySelector('b') || {}).textContent === c) || null, SEL_FILA, concept);
  return h.asElement();
}
/** Pulsar con el ratón, con el control ya a la vista: el «⋯» se cierra con el scroll (api.js), y `click()` desplaza. */
async function pulsar(el) {
  await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await espera(120);
  await el.click();
}
const estado = (page) => page.evaluate(() => ({
  peticiones: window.__peticiones.map((p) => ({ ...p })),
  navegaciones: window.__navegaciones.map((n) => ({ ...n })),
  modal: !!document.getElementById('exp-modal'),
  concepto: (document.getElementById('exp-concept') || {}).value || null,
  menus: [...document.querySelectorAll('.overflow-menu, .overflow-sheet')].map((m) => [...m.children].map((c) => c.textContent.trim())),
}));
async function abrirMenu(page, concept) {
  const fila = await filaDe(page, concept);
  if (!fila) return null;
  const mas = await fila.$('.overflow-trigger');
  if (!mas) return null;
  await pulsar(mas);
  await espera(150);
  return fila;
}
async function opcionDelMenu(page, texto) {
  const h = await page.evaluateHandle((t) => [...document.querySelectorAll('.overflow-menu button, .overflow-sheet button')]
    .find((b) => b.textContent.trim() === t) || null, texto);
  return h.asElement();
}

// ═══ ⓪ SUELO ════════════════════════════════════════════════════════════════════════════════
titulo('⓪ SUELO · ¿hay pantalla, con sus filas y sus tres KPI?');
{
  const { page, errores } = await abrir('/g', 1280);
  const r = await page.evaluate((sel) => ({
    filas: document.querySelectorAll(sel).length,
    kpis: [...document.querySelectorAll('#exp-summary .gasto-kpi')].map((k) => (k.querySelector('.gasto-kpi-rotulo') || {}).textContent),
    tabla: !!document.querySelector('#view-container table'),
  }), SEL_FILA);
  if (errores.length) nosupe('la vista dejó errores en consola: ' + errores.join(' | '));
  if (r.filas !== ITEMS.length) nosupe(`${r.filas} filas pintadas y esperaba ${ITEMS.length}. Sin las filas, todo lo de abajo sería cierto por vacío.`);
  else di(`   filas pintadas: ${r.filas} de ${ITEMS.length}`);
  if (r.kpis.join('|') !== 'Gasto del mes|Sin asignar a trabajo|Mayor categoría') mal(`los tres KPI no son los de siempre: ${JSON.stringify(r.kpis)}`);
  else bien('los tres KPI, con los rótulos de siempre');
  await page.close();
}

// ═══ A · NO SE RECORRE DE LADO ══════════════════════════════════════════════════════════════
titulo('A · sin tabla y sin scroll lateral, a 390 y a 1280');
for (const ancho of [390, 1280]) {
  const { page } = await abrir('/g', ancho);
  const r = await page.evaluate((sel) => {
    const caja = document.querySelector('.gastos-filas');
    const cr = caja.getBoundingClientRect();
    // Una caja «desborda» si se sale por la derecha de la lista que la contiene (1 px de tolerancia).
    const desbordan = [...caja.querySelectorAll('*')].filter((n) => {
      const b = n.getBoundingClientRect();
      return b.width > 0 && b.right > cr.right + 1;
    }).map((n) => (n.className || n.tagName) + ' ' + Math.round(n.getBoundingClientRect().right - cr.right) + 'px');
    return {
      tabla: !!document.querySelector('#view-container table'),
      tableScroll: !!document.querySelector('#view-container .table-scroll'),
      paginaDesborda: document.documentElement.scrollWidth - window.innerWidth,
      listaScroll: caja.scrollWidth - caja.clientWidth,
      ancho: Math.round(cr.width), desbordan: desbordan.slice(0, 6), filas: document.querySelectorAll(sel).length,
    };
  }, SEL_FILA);
  if (r.tabla) mal(`${ancho}px · sigue habiendo un <table> en la pantalla`);
  if (r.tableScroll) mal(`${ancho}px · sigue habiendo un .table-scroll (la caja que se arrastra de lado)`);
  if (r.paginaDesborda > 0) mal(`${ancho}px · la página se sale ${r.paginaDesborda}px por la derecha`);
  if (r.listaScroll > 0) mal(`${ancho}px · la lista tiene ${r.listaScroll}px de scroll horizontal`);
  if (r.desbordan.length) mal(`${ancho}px · cajas que se salen de la lista: ${JSON.stringify(r.desbordan)}`);
  if (!r.tabla && !r.tableScroll && r.paginaDesborda <= 0 && r.listaScroll <= 0 && !r.desbordan.length) {
    bien(`${ancho}px · lista de ${r.ancho}px, ${r.filas} filas, 0 cajas que desbordan (incluida la de 130 caracteres sin espacios)`);
  }
  await page.close();
}

// ═══ B · TODO CONTROL A 44 PX ═══════════════════════════════════════════════════════════════
titulo('B · objetivo al pulgar (AB6): ningún control por debajo de 44 px');
for (const ancho of [390, 1280]) {
  const { page } = await abrir('/g', ancho);
  const r = await page.evaluate(() => {
    const visibles = [...document.querySelectorAll('#view-container button, #view-container a, #view-container select, #view-container input')]
      .filter((n) => n.checkVisibility());
    return {
      total: visibles.length,
      chicos: visibles.map((n) => ({ n: (n.className || n.tagName) + ':' + (n.textContent || '').trim().slice(0, 18), h: Math.round(n.getBoundingClientRect().height), w: Math.round(n.getBoundingClientRect().width) }))
        .filter((x) => x.h < 44),
    };
  });
  if (r.total < 8) nosupe(`${ancho}px · sólo ${r.total} controles: el censo no está mirando`);
  else if (r.chicos.length) mal(`${ancho}px · ${r.chicos.length} de ${r.total} controles por debajo de 44 px: ${JSON.stringify(r.chicos.slice(0, 5))}`);
  else bien(`${ancho}px · ${r.total} controles, todos a 44 px o más`);
  await page.close();
}

// ═══ C · EL KPI NO ENSEÑA LA CLAVE INTERNA (SCRUM-944 punto 1) ══════════════════════════════
titulo('C · «Mayor categoría» con una categoría que la pantalla no conoce');
{
  const { page } = await abrir('/g-cruda', 1280);
  const r = await page.evaluate(() => ({
    kpi: (document.querySelectorAll('#exp-summary .gasto-kpi-valor')[2] || {}).textContent || null,
    pildoraDeLaFila: (document.querySelector('.gasto-fila .gasto-cat') || {}).textContent || null,
    pantalla: document.getElementById('view-container').innerText,
  }));
  if (r.kpi === null) nosupe('no encuentro el tercer KPI');
  else {
    if (/materials/i.test(r.kpi) || /materials/i.test(r.pantalla)) mal(`🔴 la pantalla enseña la clave interna «materials»: KPI = «${r.kpi}»`);
    else bien(`el KPI dice «${r.kpi}», no la clave`);
    if (r.kpi !== 'Otros') mal(`el KPI de una categoría desconocida tiene que decir «Otros» (como la píldora) y dice «${r.kpi}»`);
    if (r.pildoraDeLaFila !== 'Otros') mal(`la píldora de una categoría desconocida tiene que decir «Otros» y dice «${r.pildoraDeLaFila}»`);
  }
  await page.close();
  const { page: p2 } = await abrir('/g', 1280);
  const conocida = await p2.evaluate(() => (document.querySelectorAll('#exp-summary .gasto-kpi-valor')[2] || {}).textContent || null);
  if (conocida !== 'Subcontrata') mal(`POSITIVO: con una categoría conocida el KPI dice su nombre («Subcontrata») y dice «${conocida}»`);
  else bien('POSITIVO · con una categoría conocida, el KPI dice su nombre («Subcontrata»)');
  await p2.close();
}

// ═══ D · CADA OPCIÓN DEL «⋯» CAMBIA EL ESTADO ═══════════════════════════════════════════════
titulo('D · el «⋯» de la fila, pulsado con el ratón: qué opciones ofrece y qué queda tras pulsar cada una');
for (const ancho of [1280, 390]) {
  // Menú: con Trabajo, tres opciones; sin él, dos (no se ofrece un «Ver trabajo» que no lleva a ningún sitio).
  {
    const { page } = await abrir('/g', ancho);
    const f1 = await abrirMenu(page, 'Tubo de cobre 22 mm');
    if (!f1) nosupe(`${ancho}px · no pude abrir el «⋯» de la fila con Trabajo`);
    else {
      const e = await estado(page);
      const m = e.menus[0] || [];
      if (m.join('|') !== 'Editar|Ver trabajo|🗑 Eliminar') mal(`${ancho}px · el «⋯» de un gasto con Trabajo ofrece ${JSON.stringify(m)}`);
      else bien(`${ancho}px · el «⋯» con Trabajo ofrece Editar · Ver trabajo · 🗑 Eliminar`);
      if (e.modal) mal(`${ancho}px · abrir el «⋯» abrió también el modal de edición`);
    }
    await page.close();
  }
  {
    const { page } = await abrir('/g', ancho);
    const f = await abrirMenu(page, 'Gasolina');
    if (!f) nosupe(`${ancho}px · no pude abrir el «⋯» de la fila sin Trabajo`);
    else {
      const m = (await estado(page)).menus[0] || [];
      if (m.join('|') !== 'Editar|🗑 Eliminar') mal(`${ancho}px · el «⋯» de un gasto SIN Trabajo ofrece ${JSON.stringify(m)}`);
      else bien(`${ancho}px · el «⋯» sin Trabajo ofrece sólo Editar · 🗑 Eliminar`);
    }
    await page.close();
  }
  // Editar → el modal, con ESE gasto.
  {
    const { page } = await abrir('/g', ancho);
    await abrirMenu(page, 'Taladro percutor');
    const op = await opcionDelMenu(page, 'Editar');
    if (!op) nosupe(`${ancho}px · no encuentro «Editar» en el menú`);
    else {
      await op.click(); await espera(250);
      const e = await estado(page);
      if (!e.modal || e.concepto !== 'Taladro percutor') mal(`${ancho}px · «Editar» no abrió el modal con ese gasto (modal ${e.modal}, concepto ${JSON.stringify(e.concepto)})`);
      else bien(`${ancho}px · «Editar» abre el modal con «Taladro percutor»`);
    }
    await page.close();
  }
  // Ver trabajo → navega a ESE trabajo, sin abrir el modal.
  {
    const { page } = await abrir('/g', ancho);
    await abrirMenu(page, 'Taladro percutor');
    const op = await opcionDelMenu(page, 'Ver trabajo');
    if (!op) nosupe(`${ancho}px · no encuentro «Ver trabajo» en el menú`);
    else {
      await op.click(); await espera(200);
      const e = await estado(page);
      const nav = e.navegaciones[0];
      if (!nav || nav.vista !== 'jobs-detail' || !nav.params || nav.params.jobId !== 501) mal(`${ancho}px · «Ver trabajo» no navegó al trabajo 501: ${JSON.stringify(e.navegaciones)}`);
      else if (e.modal) mal(`${ancho}px · «Ver trabajo» abrió además el modal de edición`);
      else bien(`${ancho}px · «Ver trabajo» navega al trabajo 501 y no abre el modal`);
    }
    await page.close();
  }
  // Eliminar, ACEPTANDO → pregunta, borra ESE gasto y la lista lo pierde.
  {
    const { page } = await abrir('/g', ancho, { aceptar: true });
    const antes = await page.evaluate((s) => document.querySelectorAll(s).length, SEL_FILA);
    await abrirMenu(page, 'Varios');
    const op = await opcionDelMenu(page, '🗑 Eliminar');
    if (!op) nosupe(`${ancho}px · no encuentro «Eliminar» en el menú`);
    else {
      await op.click(); await espera(400);
      const e = await estado(page);
      const del = e.peticiones.filter((p) => p.metodo === 'DELETE');
      const despues = await page.evaluate((s) => [...document.querySelectorAll(s)].map((f) => (f.querySelector('b') || {}).textContent), SEL_FILA);
      if (page.__dialogos[0] !== '¿Eliminar este gasto?') mal(`${ancho}px · la pregunta es ${JSON.stringify(page.__dialogos)} y tiene que ser «¿Eliminar este gasto?»`);
      if (del.length !== 1 || !/\/admin\/expenses\/5$/.test(del[0].ruta)) mal(`${ancho}px · «Eliminar» no borró el gasto 5: ${JSON.stringify(del)}`);
      else if (despues.length !== antes - 1 || despues.includes('Varios')) mal(`${ancho}px · el gasto borrado sigue en la lista (${antes} → ${despues.length})`);
      else bien(`${ancho}px · «Eliminar» pregunta, borra el gasto 5 y la lista pasa de ${antes} a ${despues.length} filas`);
    }
    await page.close();
  }
  // NEGATIVO: rechazar la pregunta NO borra nada.
  {
    const { page } = await abrir('/g', ancho, { aceptar: false });
    await abrirMenu(page, 'Varios');
    const op = await opcionDelMenu(page, '🗑 Eliminar');
    if (!op) nosupe(`${ancho}px · no encuentro «Eliminar» para el control negativo`);
    else {
      await op.click(); await espera(300);
      const e = await estado(page);
      const filas = await page.evaluate((s) => document.querySelectorAll(s).length, SEL_FILA);
      if (e.peticiones.some((p) => p.metodo === 'DELETE')) mal(`${ancho}px · NEGATIVO: se rechazó la pregunta y salió un DELETE`);
      else if (filas !== ITEMS.length) mal(`${ancho}px · NEGATIVO: se rechazó la pregunta y la lista tiene ${filas} filas`);
      else bien(`${ancho}px · NEGATIVO · rechazar «¿Eliminar este gasto?» no borra nada`);
    }
    await page.close();
  }
}

// ═══ E · LA FILA Y SUS DOS EXCEPCIONES ══════════════════════════════════════════════════════
titulo('E · tocar la fila abre el gasto · el enlace del trabajo y el «⋯» NO');
{
  const { page } = await abrir('/g', 1280);
  const fila = await filaDe(page, 'Tubo de cobre 22 mm');
  await pulsar(await fila.$('.gasto-que b'));
  await espera(250);
  const a = await estado(page);
  if (!a.modal || a.concepto !== 'Tubo de cobre 22 mm') mal(`tocar la fila no abrió el gasto (modal ${a.modal}, concepto ${JSON.stringify(a.concepto)})`);
  else bien('tocar la fila abre el gasto en el modal de edición');
  await page.close();
}
{
  const { page } = await abrir('/g', 1280);
  const fila = await filaDe(page, 'Tubo de cobre 22 mm');
  await pulsar(await fila.$('.gasto-trab-enlace'));
  await espera(200);
  const e = await estado(page);
  if (e.modal) mal('el enlace del trabajo abrió además el modal de edición');
  else if (!e.navegaciones.length || e.navegaciones[0].vista !== 'jobs-detail' || e.navegaciones[0].params.jobId !== 500) mal(`el enlace del trabajo no navegó al 500: ${JSON.stringify(e.navegaciones)}`);
  else bien('el enlace del trabajo navega al trabajo 500 y no abre el modal');
  await page.close();
}
{
  const { page } = await abrir('/g', 1280);
  const fila = await filaDe(page, 'Fontanero autónomo');
  await pulsar(await fila.$('.overflow-trigger'));
  await espera(150);
  const e = await estado(page);
  if (e.modal) mal('el «⋯» abrió el modal de edición además de su menú');
  else if (!e.menus.length) nosupe('el «⋯» no abrió su menú');
  else bien('el «⋯» abre su menú y no el modal');
  await page.close();
}

// ═══ F · LA CELDA DEL TRABAJO ═══════════════════════════════════════════════════════════════
titulo('F · «Sin trabajo» · «Presupuesto sin trabajo» · el nombre del trabajo y el proveedor');
{
  const { page } = await abrir('/g', 1280);
  const celda = (concept) => page.evaluate((c) => {
    const f = [...document.querySelectorAll('.gasto-fila')].find((x) => (x.querySelector('b') || {}).textContent === c);
    const t = f && f.querySelector('.gasto-trab');
    return t ? { texto: t.innerText.replace(/\s+/g, ' ').trim(), enlace: !!t.querySelector('a') } : null;
  }, concept);
  const esperado = [
    ['Gasolina', 'Sin trabajo', false],
    ['Tubo de cobre 22 mm', 'Presupuesto #5 · María López Saltoki', true],
    ['Cinta aislante', 'Presupuesto sin trabajo', true],
    ['Fontanero autónomo', 'Cocina Ruiz Instalaciones Pérez', true],
  ];
  for (const [c, texto, enlace] of esperado) {
    const r = await celda(c);
    if (!r) nosupe(`no encuentro la celda del trabajo de «${c}»`);
    else if (r.texto !== texto || r.enlace !== enlace) mal(`«${c}» · celda ${JSON.stringify(r)} y esperaba ${JSON.stringify({ texto, enlace })}`);
    else bien(`«${c}» · «${r.texto}»${r.enlace ? ' (enlace)' : ' (sin enlace)'}`);
  }
  await page.close();
}

// ═══ G · LO QUE YA ESTABA SE CONSERVA ═══════════════════════════════════════════════════════
titulo('G · el estado vacío, el filtro, el CSV y «Nuevo gasto»');
{
  const { page } = await abrir('/g-vacio', 1280);
  const r = await page.evaluate(() => ({
    titulo: (document.querySelector('.empty-state-title') || {}).textContent,
    desc: (document.querySelector('.empty-state-desc') || {}).textContent,
    cta: (document.getElementById('exp-empty-cta') || {}).textContent,
  }));
  const ok = r.titulo === 'Sin gastos este mes'
    && r.desc === 'Registra materiales, desplazamientos y subcontratas para conocer el margen real de cada trabajo.'
    && r.cta === '+ Añadir mi primer gasto';
  if (!ok) mal(`el estado vacío cambió: ${JSON.stringify(r)}`); else bien('el estado vacío, palabra por palabra');
  const cta = await page.$('#exp-empty-cta');
  await pulsar(cta); await espera(250);
  if (!(await estado(page)).modal) mal('«+ Añadir mi primer gasto» no abre el alta'); else bien('«+ Añadir mi primer gasto» abre el alta');
  await page.close();
}
{
  const { page } = await abrir('/g', 1280);
  await page.select('#exp-filter-cat', 'materiales');
  await espera(300);
  const e = await estado(page);
  const pide = e.peticiones.filter((p) => /\/admin\/expenses\?/.test(p.ruta)).pop();
  if (!pide || !/category=materiales/.test(pide.ruta)) mal(`el filtro de categoría no pide category=materiales: ${JSON.stringify(pide)}`);
  else bien('el filtro de categoría pide category=materiales');
  const csv = await page.evaluate(() => document.getElementById('exp-export-btn').getAttribute('href'));
  if (!/from=\d{4}-\d{2}-01/.test(csv) || !/to=\d{4}-\d{2}-\d{2}/.test(csv) || !/category=materiales/.test(csv)) mal(`el CSV no lleva mes y categoría: ${csv}`);
  else bien('el CSV lleva el mes y la categoría');
  await pulsar(await page.$('#exp-new-btn')); await espera(250);
  const nuevo = await estado(page);
  if (!nuevo.modal || nuevo.concepto) mal(`«Nuevo gasto» no abre el alta vacía (modal ${nuevo.modal}, concepto ${JSON.stringify(nuevo.concepto)})`);
  else bien('«Nuevo gasto» abre el alta vacía');
  await page.close();
}

// ═══ H · CERO `style=` EN LÍNEA Y CONTRASTE ═════════════════════════════════════════════════
titulo('H · sin estilos en línea (A7) · las cinco píldoras pasan AA');
{
  const { page } = await abrir('/g', 1280);
  const r = await page.evaluate(() => {
    const dentro = [...document.querySelectorAll('#view-container [style]')].map((n) => (n.className || n.tagName) + ' → ' + n.getAttribute('style').slice(0, 40));
    const lum = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const pildoras = {};
    for (const n of document.querySelectorAll('.gasto-cat')) {
      const cs = getComputedStyle(n);
      pildoras[n.className.replace('gasto-cat gasto-cat--', '')] = Math.round(ratio(cs.color, cs.backgroundColor) * 100) / 100;
    }
    return { dentro, pildoras };
  });
  if (r.dentro.length) mal(`${r.dentro.length} elementos con style= en línea: ${JSON.stringify(r.dentro.slice(0, 4))}`); else bien('0 elementos con style= en línea en la pantalla');
  const claves = Object.keys(r.pildoras);
  if (claves.length < 5) nosupe(`sólo ${claves.length} categorías distintas en la muestra: ${claves.join(', ')}`);
  const bajas = Object.entries(r.pildoras).filter(([, v]) => v < 4.5);
  if (bajas.length) mal(`píldoras por debajo de 4,5:1: ${JSON.stringify(bajas)}`); else bien(`píldoras ${JSON.stringify(r.pildoras)}: todas ≥ 4,5:1`);
  await page.close();
}

await browser.close();
di('');
if (ciego) { console.error(`🔴 NO SUPE MIRAR en ${ciego} sitios: esto NO es «de acuerdo».`); process.exit(2); }
if (fallos) { console.error(`🔴 ${fallos} hallazgos.`); process.exit(1); }
di('✅ De acuerdo: la lista de Gastos no se recorre de lado, cada opción del «⋯» cambia el estado y el KPI no enseña claves internas.');
// Salida EXPLÍCITA: el servidor del banco sigue abierto y, sin esto, el proceso no termina nunca en el
// camino verde (medido: una mutación equivalente dejó al guard colgado hasta que lo mató el reloj).
process.exit(0);

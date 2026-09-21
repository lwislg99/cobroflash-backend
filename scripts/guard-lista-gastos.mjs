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
//   H · CERO `style=` EN LÍNEA en la pantalla (norma A7) y las cinco píldoras pasan AA (4,5:1) — y, desde 920d,
//        también las dos de la foto.
//   I · (SCRUM-920d) LA FOTO EN LA FILA Y LOS FILTROS DE ESTA PANTALLA, pulsados con el ratón: cada fila dice
//        «Foto guardada» / «Sin foto» y la lista NO pide ni una foto (no hay <img>: el peso de la foto entera es
//        la razón) · el filtro por trabajo ofrece «Todos los trabajos», «Sin trabajo» y los trabajos de la lista ·
//        los chips «Todos · N» / «Sin foto · N» cuentan lo que verás al pulsarlos y filtran SIN pedir nada al
//        servidor · la cabecera del mes dice mes y cuenta (con filtro, la suma de lo que se ve y su salvedad; sin
//        filtro, ninguna suma: el total del mes sale sólo en el KPI) · el vacío de los filtros y «Quitar los
//        filtros», que también suelta la categoría (que sí filtra el servidor).
//   J · (SCRUM-920d) «Nuevo gasto» FIJO ABAJO A 390 PX, y sólo ahí: es el MISMO botón (id, atajo «N»), a ancho
//        completo, quieto mientras la lista se recorre, sin tapar la última fila, POR DEBAJO del modal; a 1280
//        vuelve arriba junto al «⬇ CSV». Y la primera fila entra en la primera pantalla.
//        (SCRUM-920j) Y el «?» flotante de ayuda NO lo tapa: un doble con el `cssText` de `tutorial.js`, rejilla de 27 puntos.
//
// Fuera de `npm test`, como el resto de guards de navegador: la suite no arranca navegador.
// Salidas: 0 de acuerdo · 1 he encontrado un defecto · 2 NO SUPE MIRAR · 3 no arrancó el navegador.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// `GASTOS_PUBLICO` existe para el CONTROL EN ROJO: apuntarlo a un `public/` con la lista de antes (la
// tabla) y comprobar que el guard cae. Sin ella, el `public/` de este árbol.
const PUBLICO = process.env.GASTOS_PUBLICO || path.join(RAIZ, 'public');
// SCRUM-920j · el «?» flotante lo pinta `tutorial.js`; el bloque J lee de aquí su `cssText` para pintar un doble fiel.
const tutorialJs = fs.readFileSync(path.join(PUBLICO, 'dashboard', 'js', 'tutorial.js'), 'utf8');

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
/** SCRUM-920d · espera a que se CUMPLA una condición en la página (hasta `ms`) en vez de dormir un tiempo fijo:
 *  con otras suites corriendo en la misma máquina, un `espera(300)` se queda corto y da un rojo que no es del producto.
 *  La condición va como TEXTO (una expresión del navegador), como `window.__listo === true` del banco: una función
 *  flecha con `document` dentro es un identificador que este script no declara (censo de SCRUM-258). */
const hasta = (page, expresion, ms = 4000) => page.waitForFunction(expresion, { timeout: ms, polling: 50 }).then(() => true, () => false);
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
// SCRUM-920d · la foto: 1, 3 y 6 la tienen (3 con foto, 5 sin ella). Los trabajos: el 500 lo comparten el 1 y el
// 6; el 501 sólo el 3; el 502 sólo el 4; SIN trabajo son 2, 5, 7 (que tiene presupuesto pero no trabajo) y 8.
const ITEMS = [
  gasto(1, 'Tubo de cobre 22 mm', 'materiales', 42, { notes: 'Ticket del almacén', quoteId: 50, quote: { id: 50 }, job: JOB_500, provider: { id: 9, name: 'Saltoki' }, tieneFoto: true }),
  gasto(2, 'Gasolina', 'desplazamiento', 61.3),
  gasto(3, 'Taladro percutor', 'herramientas', 129.9, { quoteId: 51, quote: { id: 51 }, job: { id: 501, titulo: 'Reforma baño' }, tieneFoto: true }),
  gasto(4, 'Fontanero autónomo', 'subcontrata', 9999.99, { quoteId: 52, quote: { id: 52 }, job: { id: 502, titulo: 'Cocina Ruiz' }, provider: { id: 10, name: 'Instalaciones Pérez' } }),
  gasto(5, 'Varios', 'otros', 5),
  gasto(6, 'Silicona', 'materials', 3, { quoteId: 50, quote: { id: 50 }, job: JOB_500, tieneFoto: true }),
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
    if (/\\/admin\\/expenses/.test(ruta)) {
      // SCRUM-920d · como el servidor: la CATEGORÍA la filtra él (el trabajo y la foto, no).
      var cat = /[?&]category=([^&]+)/.exec(ruta);
      return { items: D.items.filter(function (g) {
        return borrados.indexOf(g.id) < 0 && (!cat || g.category === decodeURIComponent(cat[1]));
      }) };
    }
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
    // SCRUM-920d · las dos píldoras de la foto, en la misma cuenta.
    for (const n of document.querySelectorAll('.gasto-foto')) {
      const cs = getComputedStyle(n);
      pildoras[n.className.replace('gasto-foto ', '')] = Math.round(ratio(cs.color, cs.backgroundColor) * 100) / 100;
    }
    return { dentro, pildoras };
  });
  if (r.dentro.length) mal(`${r.dentro.length} elementos con style= en línea: ${JSON.stringify(r.dentro.slice(0, 4))}`); else bien('0 elementos con style= en línea en la pantalla');
  const claves = Object.keys(r.pildoras);
  if (claves.length < 7) nosupe(`sólo ${claves.length} píldoras distintas en la muestra (cinco categorías y dos de foto): ${claves.join(', ')}`);
  const bajas = Object.entries(r.pildoras).filter(([, v]) => v < 4.5);
  if (bajas.length) mal(`píldoras por debajo de 4,5:1: ${JSON.stringify(bajas)}`); else bien(`píldoras ${JSON.stringify(r.pildoras)}: todas ≥ 4,5:1`);
  await page.close();
}

// ═══ I · LA FOTO EN LA FILA Y LOS FILTROS DE ESTA PANTALLA (SCRUM-920d) ═════════════════════════
titulo('I · la foto en la fila · el filtro por trabajo · los chips · la cabecera del mes · el vacío de los filtros');
const limpio = (s) => (s == null ? null : String(s).replace(/\xa0/g, ' ').replace(/\s+/g, ' ').trim());
const peticionesDeLista = (e) => e.peticiones.filter((p) => /\/admin\/expenses\?/.test(p.ruta));
const conceptosVisibles = (page) => page.evaluate((s) => [...document.querySelectorAll(s)].map((f) => (f.querySelector('b') || {}).textContent), SEL_FILA);
const chipsDe = (page) => page.evaluate(() => [...document.querySelectorAll('.gastos-chip')].map((c) => ({
  texto: c.textContent.replace(/\xa0/g, ' ').replace(/\s+/g, ' ').trim(), pulsado: c.getAttribute('aria-pressed'),
})));
const cabeceraDe = (page) => page.evaluate(() => {
  const c = document.querySelector('.gastos-mes');
  if (!c) return null;
  const t = (s) => { const n = c.querySelector(s); return n ? n.textContent.replace(/\xa0/g, ' ').replace(/\s+/g, ' ').trim() : null; };
  return { mes: t('b'), cuenta: t('.gastos-mes-n'), suma: t('.gastos-mes-suma'), salvedad: t('.gastos-mes-salvedad') };
});
const vacioDe = (page) => page.evaluate(() => {
  const t = document.querySelector('#exp-list .empty-state-title');
  const d = document.querySelector('#exp-list .empty-state-desc');
  const b = document.querySelector('#exp-quitar-filtros');
  return { titulo: t ? t.textContent : null, desc: d ? d.textContent : null, boton: b ? b.textContent : null };
});
async function elegirTrabajo(page, etiqueta) {
  const valor = await page.evaluate((t) => { const o = [...document.querySelectorAll('#exp-filter-job option')].find((x) => x.textContent === t); return o ? o.value : null; }, etiqueta);
  if (valor === null) return false;
  await page.select('#exp-filter-job', valor);
  await espera(150);
  return true;
}
async function pulsarChip(page, dato) {
  const c = await page.$('.gastos-chip[data-foto="' + dato + '"]');
  if (!c) return false;
  await pulsar(c);
  await espera(150);
  return true;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CONCEPTOS_TODOS = ITEMS.map((g) => g.concept);
const CONCEPTOS_SIN_FOTO = ITEMS.filter((g) => !g.tieneFoto).map((g) => g.concept);

for (const ancho of [1280, 390]) {
  const { page } = await abrir('/g', ancho);
  const mesEsperado = await page.evaluate(() => {
    const t = document.getElementById('exp-filter-month').selectedOptions[0].textContent.trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  // I.1 · la foto en cada fila, y la lista NO la pide.
  const fotos = await page.evaluate((s) => [...document.querySelectorAll(s)].map((f) => {
    const p = f.querySelector('.gasto-foto');
    return { c: (f.querySelector('b') || {}).textContent, texto: p ? p.textContent : null, clase: p ? p.className : null };
  }), SEL_FILA);
  const malas = fotos.filter((f) => {
    const tiene = ITEMS.find((g) => g.concept === f.c).tieneFoto;
    return f.texto !== (tiene ? 'Foto guardada' : 'Sin foto') || f.clase !== 'gasto-foto ' + (tiene ? 'gasto-foto--si' : 'gasto-foto--no');
  });
  if (fotos.length !== ITEMS.length) nosupe(`${ancho}px · I.1 ${fotos.length} filas y esperaba ${ITEMS.length}`);
  else if (malas.length) mal(`${ancho}px · la foto de la fila dice otra cosa que el gasto: ${JSON.stringify(malas.slice(0, 3))}`);
  else bien(`${ancho}px · cada fila dice «Foto guardada» (${fotos.filter((f) => f.texto === 'Foto guardada').length}) o «Sin foto» (${fotos.filter((f) => f.texto === 'Sin foto').length}) según su gasto`);
  const pesa = await page.evaluate(() => ({
    imgs: document.querySelectorAll('#view-container img').length,
    recursos: performance.getEntriesByType('resource').filter((r) => /\/foto(\?|$)/.test(r.name)).length,
  }));
  if (pesa.imgs || pesa.recursos) mal(`${ancho}px · 🔴 la lista pide fotos (${pesa.imgs} <img>, ${pesa.recursos} descargas de /foto): la foto entera pesa hasta 1,1 MiB y aquí serían N`);
  else bien(`${ancho}px · la lista no pide ninguna foto (0 <img>, 0 descargas de /foto)`);

  // I.2 · el filtro por trabajo: qué ofrece.
  const ops = await page.evaluate(() => [...document.querySelectorAll('#exp-filter-job option')].map((o) => o.textContent));
  const opsEsperadas = ['Todos los trabajos', 'Sin trabajo', 'Cocina Ruiz', 'Presupuesto #5 · María López', 'Reforma baño'];
  if (!igual(ops, opsEsperadas)) mal(`${ancho}px · el filtro por trabajo ofrece ${JSON.stringify(ops)} y esperaba ${JSON.stringify(opsEsperadas)}`);
  else bien(`${ancho}px · el filtro por trabajo ofrece «Todos los trabajos», «Sin trabajo» y los 3 trabajos de la lista, una vez cada uno`);

  // I.3 · sin filtros: chips, cabecera sin suma.
  {
    const c = await chipsDe(page);
    const h = await cabeceraDe(page);
    if (!igual(c, [{ texto: 'Todos · 8', pulsado: 'true' }, { texto: 'Sin foto · 5', pulsado: 'false' }])) mal(`${ancho}px · chips de arranque ${JSON.stringify(c)}`);
    else bien(`${ancho}px · chips «Todos · 8» (pulsado) y «Sin foto · 5»`);
    if (!h || h.mes !== mesEsperado || h.cuenta !== '· 8 gastos' || h.suma !== null || h.salvedad !== null) mal(`${ancho}px · cabecera sin filtros ${JSON.stringify(h)} y esperaba «${mesEsperado}» · 8 gastos, sin suma ni salvedad`);
    else bien(`${ancho}px · cabecera «${h.mes} ${h.cuenta}», sin suma (el total del mes sale sólo en el KPI)`);
  }

  // I.4 · «Sin foto»: se pulsa, se filtra SIN pedir nada al servidor, y cuenta lo que dice.
  {
    const antes = peticionesDeLista(await estado(page)).length;
    if (!(await pulsarChip(page, 'sinfoto'))) nosupe(`${ancho}px · no encuentro el chip «Sin foto»`);
    else {
      const filas = await conceptosVisibles(page);
      const c = await chipsDe(page);
      const h = await cabeceraDe(page);
      const despues = peticionesDeLista(await estado(page)).length;
      if (!igual(filas, CONCEPTOS_SIN_FOTO)) mal(`${ancho}px · «Sin foto» deja ${JSON.stringify(filas)} y esperaba ${JSON.stringify(CONCEPTOS_SIN_FOTO)}`);
      else bien(`${ancho}px · «Sin foto» deja las ${filas.length} filas sin foto (y sólo ésas)`);
      if (c[0].pulsado !== 'false' || c[1].pulsado !== 'true') mal(`${ancho}px · tras pulsar «Sin foto» el chip pulsado es ${JSON.stringify(c)}`);
      else bien(`${ancho}px · aria-pressed pasa de «Todos» a «Sin foto»`);
      if (antes !== despues) mal(`${ancho}px · pulsar el chip pidió la lista al servidor (${antes} → ${despues} peticiones): se filtra aquí`);
      else bien(`${ancho}px · el chip filtra sin pedir nada al servidor (${despues} petición de lista en total)`);
      if (!h || h.cuenta !== '· 5 gastos' || h.suma !== '10.087,49 €' || h.salvedad !== 'Es la suma de lo que estás viendo, no la del mes.') mal(`${ancho}px · cabecera con «Sin foto»: ${JSON.stringify(h)} y esperaba · 5 gastos, 10.087,49 € y la salvedad`);
      else bien(`${ancho}px · con filtro, la cabecera dice la suma de lo que se ve (10.087,49 €) y que no es la del mes`);
    }
    // NEGATIVO: «Todos» lo deja como estaba.
    await pulsarChip(page, 'todos');
    const filas = await conceptosVisibles(page);
    const h = await cabeceraDe(page);
    if (!igual(filas, CONCEPTOS_TODOS) || !h || h.suma !== null) mal(`${ancho}px · NEGATIVO: «Todos» no devuelve la lista entera y sin suma (${filas.length} filas, cabecera ${JSON.stringify(h)})`);
    else bien(`${ancho}px · NEGATIVO · «Todos» devuelve las 8 filas y quita la suma`);
  }

  // I.5 · el trabajo: filtra, cuenta, singular; y «Sin trabajo» son los que no tienen Trabajo.
  {
    const casos = [
      ['Presupuesto #5 · María López', ['Tubo de cobre 22 mm', 'Silicona'], 'Todos · 2', 'Sin foto · 0', '· 2 gastos', '45,00 €'],
      ['Sin trabajo', ['Gasolina', 'Varios', 'Cinta aislante', LARGO + LARGO], 'Todos · 4', 'Sin foto · 4', '· 4 gastos', '87,50 €'],
      ['Reforma baño', ['Taladro percutor'], 'Todos · 1', 'Sin foto · 0', '· 1 gasto', '129,90 €'],
    ];
    const pedidasAntes = peticionesDeLista(await estado(page)).length;
    for (const [etiqueta, conceptos, chipTodos, chipSin, cuenta, suma] of casos) {
      if (!(await elegirTrabajo(page, etiqueta))) { nosupe(`${ancho}px · no encuentro «${etiqueta}» en el filtro por trabajo`); continue; }
      const filas = await conceptosVisibles(page);
      const c = (await chipsDe(page)).map((x) => x.texto);
      const h = await cabeceraDe(page);
      if (!igual(filas, conceptos)) mal(`${ancho}px · «${etiqueta}» deja ${JSON.stringify(filas)} y esperaba ${JSON.stringify(conceptos)}`);
      else if (!igual(c, [chipTodos, chipSin])) mal(`${ancho}px · «${etiqueta}» · chips ${JSON.stringify(c)} y esperaba ${JSON.stringify([chipTodos, chipSin])}`);
      else if (!h || h.cuenta !== cuenta || h.suma !== suma) mal(`${ancho}px · «${etiqueta}» · cabecera ${JSON.stringify(h)} y esperaba ${cuenta} y ${suma}`);
      else bien(`${ancho}px · «${etiqueta}» deja ${filas.length} fila${filas.length === 1 ? '' : 's'} · ${chipTodos} · ${chipSin} · ${cuenta} · ${suma}`);
    }
    const pedidasDespues = peticionesDeLista(await estado(page)).length;
    if (pedidasAntes !== pedidasDespues) mal(`${ancho}px · cambiar de trabajo pidió la lista al servidor (${pedidasAntes} → ${pedidasDespues})`);
    else bien(`${ancho}px · cambiar de trabajo no pide nada al servidor`);
  }

  // I.6 · un filtro que no deja nada: el vacío, y «Quitar los filtros» lo quita TODO.
  {
    await elegirTrabajo(page, 'Reforma baño');
    await pulsarChip(page, 'sinfoto'); // el 501 tiene foto → 0 filas
    const filas = await conceptosVisibles(page);
    const v = await vacioDe(page);
    const cab = await cabeceraDe(page);
    const c = (await chipsDe(page)).map((x) => x.texto);
    if (filas.length) nosupe(`${ancho}px · I.6 sigue habiendo ${filas.length} filas y esperaba un filtro que no deja ninguna`);
    else if (v.titulo !== 'Ningún gasto con esos filtros' || v.desc !== 'Prueba con otro mes, otra categoría u otro trabajo.' || v.boton !== 'Quitar los filtros') mal(`${ancho}px · el vacío de los filtros dice ${JSON.stringify(v)}`);
    else if (cab) mal(`${ancho}px · con 0 filas sigue pintando la cabecera del mes: ${JSON.stringify(cab)}`);
    else bien(`${ancho}px · trabajo + «Sin foto» sin resultados → «Ningún gasto con esos filtros», su ayuda y «Quitar los filtros» (${c.join(' · ')})`);
    const boton = await page.$('#exp-quitar-filtros');
    if (!boton) nosupe(`${ancho}px · no encuentro «Quitar los filtros»`);
    else {
      await pulsar(boton); await espera(200);
      const f2 = await conceptosVisibles(page);
      const job = await page.evaluate(() => document.getElementById('exp-filter-job').value);
      const c2 = await chipsDe(page);
      if (!igual(f2, CONCEPTOS_TODOS) || job !== '' || c2[0].pulsado !== 'true') mal(`${ancho}px · «Quitar los filtros» deja ${f2.length} filas, trabajo «${job}» y chips ${JSON.stringify(c2)}`);
      else bien(`${ancho}px · «Quitar los filtros» devuelve las 8 filas, «Todos los trabajos» y el chip «Todos»`);
    }
  }
  await page.close();
}

// I.7 · la categoría SÍ la filtra el servidor: un vacío por categoría dice «Ningún gasto con esos filtros» (y no «Sin
// gastos este mes», que sería mentira), y «Quitar los filtros» la suelta y vuelve a pedir el mes entero.
{
  const { page } = await abrir('/g-cruda', 1280);
  await page.select('#exp-filter-cat', 'herramientas');
  await hasta(page, "!!document.querySelector('#exp-list .empty-state-title')");
  const v = await vacioDe(page);
  const hayVacioDelMes = await page.evaluate(() => !!document.getElementById('exp-empty-cta'));
  if (v.titulo !== 'Ningún gasto con esos filtros' || hayVacioDelMes) mal(`con una categoría sin gastos la pantalla dice ${JSON.stringify(v)} (vacío del mes: ${hayVacioDelMes})`);
  else bien('categoría sin gastos → «Ningún gasto con esos filtros», no «Sin gastos este mes»');
  const boton = await page.$('#exp-quitar-filtros');
  if (!boton) nosupe('no encuentro «Quitar los filtros» tras el vacío por categoría');
  else {
    await pulsar(boton);
    await hasta(page, "document.getElementById('exp-filter-cat').value === '' && document.querySelectorAll('.gasto-fila').length > 0");
    const cat = await page.evaluate(() => document.getElementById('exp-filter-cat').value);
    const filas = await conceptosVisibles(page);
    const e = await estado(page);
    const ultima = peticionesDeLista(e).pop();
    if (cat !== '' || filas.length !== ITEMS_CRUDA.length || !ultima || /category=/.test(ultima.ruta)) mal(`«Quitar los filtros» deja categoría «${cat}», ${filas.length} filas y la última petición ${JSON.stringify(ultima)}`);
    else bien('«Quitar los filtros» suelta la categoría y vuelve a pedir el mes entero (sin category=)');
  }
  await page.close();
}
// I.8 · mes sin gastos y sin ningún filtro: sigue diciendo lo de siempre, y los chips cuentan 0 (control del suelo).
{
  const { page } = await abrir('/g-vacio', 1280);
  const c = (await chipsDe(page)).map((x) => x.texto);
  const cab = await cabeceraDe(page);
  if (!igual(c, ['Todos · 0', 'Sin foto · 0']) || cab) mal(`mes vacío: chips ${JSON.stringify(c)}, cabecera ${JSON.stringify(cab)}`);
  else bien('mes vacío → chips «Todos · 0» y «Sin foto · 0», sin cabecera del mes');
  await page.close();
}

// ═══ J · «NUEVO GASTO» FIJO ABAJO A 390 PX (SCRUM-920d) ═════════════════════════════════════
titulo('J · «Nuevo gasto» abajo, fijo, en el móvil · arriba en el escritorio · la primera fila entra en la primera pantalla');
J390: {
  const { page } = await abrirVista(browser, puerto, '/g', 390, 844);
  const medir = () => page.evaluate(() => {
    const b = document.getElementById('exp-new-btn');
    const barra = document.querySelector('.gastos-barra');
    const csv = document.getElementById('exp-export-btn');
    // Una pieza que no está es un rojo CON NOMBRE, no una excepción que tira el guard sin veredicto.
    const falta = [['#exp-new-btn', b], ['.gastos-barra', barra], ['#exp-export-btn', csv]].filter(([, n]) => !n).map(([s]) => s);
    if (falta.length) return { falta };
    const r = b.getBoundingClientRect();
    const rb = barra.getBoundingClientRect();
    const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      posicion: getComputedStyle(barra).position, alto: window.innerHeight, ancho: window.innerWidth,
      top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), width: Math.round(r.width), barraTop: Math.round(rb.top),
      encima: !!centro && (centro === b || b.contains(centro)),
      csvDentro: barra.contains(csv), csvTop: Math.round(csv.getBoundingClientRect().top),
      recorrible: document.scrollingElement.scrollHeight - window.innerHeight,
      mismoBoton: document.querySelectorAll('#exp-new-btn').length === 1,
    };
  });
  const a = await medir();
  if (a.falta) { mal(`390px · faltan piezas de la cabecera: ${a.falta.join(', ')}`); await page.close(); break J390; }
  if (!a.mismoBoton) mal('hay más de un botón #exp-new-btn: «Nuevo gasto» tiene que ser UNO (el del atajo «N»)');
  else if (a.posicion !== 'fixed') mal(`390px · la barra de «Nuevo gasto» no es fija (position: ${a.posicion})`);
  else if (a.bottom > a.alto || a.bottom < a.alto - 24) mal(`390px · «Nuevo gasto» no está pegado al borde de abajo: bottom ${a.bottom} en una pantalla de ${a.alto}`);
  // SCRUM-920j · «a ancho completo» pasa a «hasta el hueco del ?»: la barra deja 78 px a la derecha (el «?» flotante
  // mide 48 y va a 20 del borde). El umbral baja de `ancho - 40` a `ancho - 100`; lo que vigila que el botón no se
  // acorte más de la cuenta es ahora el límite de abajo, y lo que vigila que no tape es el bloque del «?».
  else if (a.width < a.ancho - 100) mal(`390px · «Nuevo gasto» no va a ancho completo (menos el hueco del «?»): ${a.width} px de ${a.ancho}`);
  else if (!a.encima) mal('390px · algo tapa a «Nuevo gasto»: el punto central del botón no es el botón');
  else bien(`390px · «Nuevo gasto» va fijo abajo, a ${a.width} px de ${a.ancho}, pegado al borde (bottom ${a.bottom} de ${a.alto}) y nada lo tapa`);
  if (a.csvDentro || a.csvTop > 200) mal(`390px · «⬇ CSV» no se queda arriba (dentro de la barra: ${a.csvDentro}, top ${a.csvTop})`);
  else bien(`390px · «⬇ CSV» se queda arriba (top ${a.csvTop}), fuera de la barra`);
  // SCRUM-920j · 🔴 EL «?» DE AYUDA NO TAPA «NUEVO GASTO». `#tut-help-btn` (`tutorial.js`: fijo, 48 px, a 20 del
  // borde, z 350) lo pinta `tutorial.js`, que este banco no carga; en staging a 390 tapaba 1.632 px² del botón. Aquí
  // va un DOBLE con el MISMO `cssText`, leído del fichero servido (si `tutorial.js` cambia, el doble cambia con él) y
  // se mira con `elementFromPoint` en una rejilla de 27 puntos del botón.
  const fabCss = /btn\.id = 'tut-help-btn';[\s\S]*?btn\.style\.cssText = `([^`]*)`/.exec(tutorialJs)?.[1];
  if (!fabCss) nosupe('390px · no encuentro el `style.cssText` de `#tut-help-btn` en `tutorial.js`: no puedo pintar el «?» para ver si tapa');
  else {
    const fab = await page.evaluate((css) => {
      const n = document.createElement('button');
      n.id = 'tut-help-btn';
      n.style.cssText = css;
      n.textContent = '?';
      document.body.appendChild(n);
      const r = n.getBoundingClientRect();
      const b = document.getElementById('exp-new-btn').getBoundingClientRect();
      const en = (x, y) => document.elementFromPoint(x, y);
      // CONTROL POSITIVO del instrumento: el doble se ve a sí mismo en su centro; si no, nada de lo que sigue vale.
      const siMismo = en(r.left + r.width / 2, r.top + r.height / 2) === n;
      // Una REJILLA de 9×3 y no las cuatro esquinas y el centro: el «?» es un CÍRCULO y esos cinco puntos caían fuera
      // de él aun con 1.632 px² de solape (medido en la primera pasada de este bloque: «0 de 5 puntos» con el defecto).
      const puntos = [];
      for (let i = 0; i <= 8; i += 1) for (const f of [0.25, 0.5, 0.75]) puntos.push([b.left + 2 + (i / 8) * (b.width - 4), b.top + f * b.height]);
      const tapados = puntos.filter(([x, y]) => en(x, y) === n).length;
      const solape = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
      n.remove();
      return { siMismo, tapados, solape: Math.round(solape), fabLeft: Math.round(r.left), btnRight: Math.round(b.right) };
    }, fabCss);
    if (!fab.siMismo) nosupe('390px · el doble del «?» no se ve a sí mismo en su centro (algo lo tapa o no se pinta): la medida de abajo no vale');
    else if (fab.tapados > 0 || fab.solape > 0) mal(`390px · el «?» de ayuda TAPA a «Nuevo gasto»: ${fab.tapados} de 27 puntos del botón y ${fab.solape} px² (el botón acaba en x=${fab.btnRight} y el «?» empieza en x=${fab.fabLeft})`);
    else bien(`390px · el «?» de ayuda no toca «Nuevo gasto»: 0 de 27 puntos tapados, 0 px² de solape (el botón acaba en x=${fab.btnRight}, el «?» empieza en x=${fab.fabLeft})`);
  }
  if (a.recorrible < 60) nosupe(`390px · la página sólo se recorre ${a.recorrible} px: no puedo comprobar que la barra se queda quieta`);
  else {
    await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
    await espera(150);
    const b2 = await medir();
    const ultima = await page.evaluate(() => {
      const filas = [...document.querySelectorAll('.gasto-fila')];
      return Math.round(filas[filas.length - 1].getBoundingClientRect().bottom);
    });
    if (Math.abs(b2.top - a.top) > 1) mal(`390px · al recorrer la lista «Nuevo gasto» se mueve (top ${a.top} → ${b2.top})`);
    else bien(`390px · recorrida ${a.recorrible} px de lista, «Nuevo gasto» sigue en su sitio (top ${b2.top})`);
    if (ultima > b2.barraTop + 1) mal(`390px · la barra tapa la última fila (su borde inferior ${ultima}, la barra empieza en ${b2.barraTop})`);
    else bien(`390px · al final de la lista, la última fila acaba en ${ultima} y la barra empieza en ${b2.barraTop}: no la tapa`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  // La primera fila entra en la primera pantalla (es lo que el prototipo persigue con la rejilla de filtros).
  const primera = await page.evaluate(() => Math.round(document.querySelector('.gasto-fila').getBoundingClientRect().bottom));
  if (primera > a.barraTop) mal(`390×844 · la primera fila NO entra en la primera pantalla: acaba en ${primera} y la barra empieza en ${a.barraTop}`);
  else bien(`390×844 · la primera fila entera entra en la primera pantalla (acaba en ${primera}; la barra empieza en ${a.barraTop})`);
  // Se pulsa con el ratón y abre el alta; el modal queda POR ENCIMA de la barra.
  await pulsar(await page.$('#exp-new-btn'));
  await hasta(page, "!!document.getElementById('exp-modal')");
  await espera(150); // el modal ya está; un instante para que su animación de entrada no engañe al «qué hay encima»
  const m = await page.evaluate(() => {
    const b = document.getElementById('exp-new-btn').getBoundingClientRect();
    const punto = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { modal: !!document.getElementById('exp-modal'), botonTapado: !!punto && !document.getElementById('exp-new-btn').contains(punto) };
  });
  if (!m.modal) mal('390px · pulsar «Nuevo gasto» (el de la barra) no abre el alta');
  else if (!m.botonTapado) mal('390px · con el alta abierta la barra sigue POR ENCIMA del modal');
  else bien('390px · «Nuevo gasto» (el de la barra) abre el alta, y el modal queda por encima de la barra');
  await page.close();
}
{
  const { page } = await abrir('/g', 1280);
  const r = await page.evaluate(() => {
    const nb = document.getElementById('exp-new-btn');
    const nc = document.getElementById('exp-export-btn');
    const nbarra = document.querySelector('.gastos-barra');
    if (!nb || !nc || !nbarra) return { falta: true };
    const b = nb.getBoundingClientRect();
    const c = nc.getBoundingClientRect();
    return { posicion: getComputedStyle(nbarra).position, btnTop: Math.round(b.top), csvTop: Math.round(c.top), alto: window.innerHeight };
  });
  if (r.falta) mal('1280px · faltan piezas de la cabecera (#exp-new-btn, #exp-export-btn o .gastos-barra)');
  else if (r.posicion === 'fixed') mal('1280px · la barra de «Nuevo gasto» es fija también en escritorio: la barra de abajo es sólo del móvil');
  else if (r.btnTop > 200 || Math.abs(r.btnTop - r.csvTop) > 20) mal(`1280px · «Nuevo gasto» no está arriba junto a «⬇ CSV» (top ${r.btnTop} y ${r.csvTop})`);
  else bien(`1280px · «Nuevo gasto» está arriba, junto a «⬇ CSV» (top ${r.btnTop} y ${r.csvTop}), no en una barra fija`);
  // El atajo «N» (SCRUM-769) sigue siendo de ESTE botón. ⚠️ LÍMITE DECLARADO: la tecla en sí la escucha `app.js`,
  // que este banco no carga (mide una vista, no el router). Lo que sí se comprueba es lo que la vista le da a
  // `app.js`: el destino registrado (que al llamarlo abre el alta) y la marca de la tecla en el botón.
  const atajo = await page.evaluate(() => {
    const b = document.getElementById('exp-new-btn');
    const accion = window.atajoNuevo && window.atajoNuevo.accionDe('expenses');
    return {
      registrado: typeof accion === 'function',
      kbd: !!b && !!b.querySelector('kbd.btn-atajo'),
      // El rótulo es SU texto propio (el <kbd> de la tecla va aparte, para que el copy siga siendo una cadena).
      texto: b ? [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : null,
      abre: typeof accion === 'function' ? (accion(), true) : false,
    };
  });
  await hasta(page, "!!document.getElementById('exp-modal')");
  const modalDelAtajo = (await estado(page)).modal;
  if (!atajo.registrado) mal('1280px · «expenses» ya no tiene destino registrado en atajoNuevo: la tecla «N» no abriría nada (SCRUM-769)');
  else if (!atajo.kbd || atajo.texto !== 'Nuevo gasto') mal(`1280px · el botón perdió el rótulo o la marca del atajo: «${atajo.texto}», kbd ${atajo.kbd}`);
  else if (!modalDelAtajo) mal('1280px · el destino registrado del atajo «N» ya no abre el alta de gasto');
  else bien('1280px · el atajo «N» sigue siendo de este botón (rótulo «Nuevo gasto» + <kbd>N</kbd>) y su destino abre el alta (la tecla la escucha app.js: fuera del banco)');
  await page.close();
}

await browser.close();
di('');
if (ciego) { console.error(`🔴 NO SUPE MIRAR en ${ciego} sitios: esto NO es «de acuerdo».`); process.exit(2); }
if (fallos) { console.error(`🔴 ${fallos} hallazgos.`); process.exit(1); }
di('✅ De acuerdo: la lista de Gastos no se recorre de lado, cada opción del «⋯» cambia el estado, el KPI no enseña claves internas, la foto se ve en cada fila sin pedirla, los filtros y los chips cuentan lo que filtran y «Nuevo gasto» va fijo abajo en el móvil.');
// Salida EXPLÍCITA: el servidor del banco sigue abierto y, sin esto, el proceso no termina nunca en el
// camino verde (medido: una mutación equivalente dejó al guard colgado hasta que lo mató el reloj).
process.exit(0);

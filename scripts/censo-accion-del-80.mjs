// scripts/censo-accion-del-80.mjs — encargo del fundador, 8-sep-2026
//
// LAS CINCO LISTAS DEL PANEL: ¿a cuántos clics está lo que un fontanero hace el 80% de las veces?
//
// 🔴 SE MIDE EN PANTALLA, NO LEYENDO EL CÓDIGO. Cada lista se monta en Edge a 1700 px con el
// producto de verdad (`_banco-lista.mjs`) y se cuenta lo que se puede pulsar: cuántos controles
// hay, cuántos son PRIMARIOS, cuáles están dentro de un «⋯» —que cuesta un clic más sólo para
// verlos— y cuántos de ellos NAVEGAN a otra pantalla en vez de hacer la cosa.
//
// ⚠️ ESTO NO DECIDE CUÁL ES LA ACCIÓN DEL 80%: eso lo decide quien conoce el oficio, y va en el
// veredicto escrito. Lo que esto aporta es el DENOMINADOR — qué ofrece cada pantalla y a qué
// distancia— para que el veredicto no sea una opinión sobre una pantalla que nadie ha mirado.
//
// El coste en clics se cuenta así, y se dice para que se pueda discutir:
//   · 1 clic  → el control está a la vista en la fila y HACE la cosa allí mismo.
//   · 2 clics → está a la vista pero NAVEGA: hay que llegar y volver a pulsar.
//   · 2 clics → está dentro del «⋯»: abrir el menú + pulsar.
//   · 3 clics → está dentro del «⋯» y además abre un modal que hay que confirmar.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from './_banco-lista.mjs';
import { trabajosDeMuestra, reglasDeDatos, FACTURAS, ALBARANES, CLIENTES, PRESUPUESTOS } from './_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANCHO = 1700;

/** Lo que contestan las rutas que NO pasan por `apiRequest` (el `fetch` crudo de Facturas). */
const API = (ruta) => {
  if (ruta.includes('/admin/albaranes/pendientes-facturar')) return [];
  if (ruta.includes('/admin/invoices')) return FACTURAS;
  if (ruta.includes('/admin/albaranes')) return ALBARANES;
  if (ruta.includes('/admin/customers')) return CLIENTES;
  if (ruta.includes('/admin/quotes')) return PRESUPUESTOS;
  return [];
};

const LISTAS = [
  { ruta: '/trabajos', fnVista: 'renderJobsView', rotulo: 'Trabajos', datos: reglasDeDatos(trabajosDeMuestra(20)) },
  { ruta: '/presupuestos', fnVista: 'renderQuotesListView', rotulo: 'Presupuestos', datos: reglasDeDatos([]) },
  // 🔴 Facturas necesita `api`: carga con `fetch` CRUDO y el doble de `apiRequest` no la ve. Sin
  // esto se quedaba en `skeleton-row` y este censo leía «0 controles» — cero por no haber pintado,
  // no por no haber botones.
  { ruta: '/facturas', fnVista: 'renderInvoicesView', rotulo: 'Facturas', datos: reglasDeDatos([]), api: API },
  { ruta: '/albaranes', fnVista: 'renderAlbaranesView', rotulo: 'Albaranes', datos: reglasDeDatos([]) },
  { ruta: '/clientes', fnVista: 'renderCustomersView', rotulo: 'Clientes', datos: reglasDeDatos([]) },
];

/**
 * El inventario de lo pulsable de la PRIMERA fila, más lo de la barra de arriba.
 *
 * 🔴 SE MIDE UNA FILA, no la pantalla entera: la pregunta es «qué se hace con UN documento», y
 * sumar veinte filas sólo multiplica por veinte la misma respuesta.
 */
const INVENTARIO = `(() => {
  const vc = document.querySelector('#view-container');
  if (!vc) return { error: 'no hay contenedor' };
  const nodos = vc.querySelectorAll('*').length;

  const tabla = vc.querySelector('table.table');
  // 🔴 LA PRIMERA \`tr\` NO ES UNA FILA DE DATOS. Trabajos agrupa por estado y Facturas por
  // cliente, así que la primera es una CABECERA DE GRUPO: una sola celda con \`colSpan\` y ningún
  // control. La primera pasada de este censo dijo «0 controles en la fila» para Trabajos y para
  // Facturas — un cero por haber mirado la fila equivocada, no por no haber botones.
  // Una fila de datos se reconoce por tener VARIAS celdas; una cabecera de grupo tiene una.
  const candidatas = tabla ? [...tabla.querySelectorAll('tbody tr')] : [];
  const fila = candidatas.find((tr) => tr.children.length >= 3) || null;
  const saltadas = candidatas.length - candidatas.filter((tr) => tr.children.length >= 3).length;

  const texto = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 42);
  const esOverflow = (el) => !!el.closest('.overflow-menu, .overflow-sheet')
    || (el.className || '').includes('overflow-trigger');

  // Los controles de la BARRA de la pantalla (encima de la tabla): crear, filtros, buscadores.
  const barra = [...vc.querySelectorAll('button, a[href], input, select')]
    .filter((el) => !tabla || !tabla.contains(el))
    .map((el) => ({ etiqueta: el.tagName.toLowerCase(), texto: texto(el), clase: el.className || '' }));

  // Los de la FILA: los visibles y los que viven dentro del «⋯».
  const enFila = fila ? [...fila.querySelectorAll('button, a[href], input, select, summary')] : [];
  const disparador = fila ? fila.querySelector('.overflow-trigger, [data-overflow]') : null;

  return {
    nodos,
    hayTabla: !!tabla,
    anchoTabla: tabla ? +tabla.getBoundingClientRect().width.toFixed(0) : null,
    viewport: window.innerWidth,
    filas: candidatas.length,
    filasDeDatos: candidatas.filter((tr) => tr.children.length >= 3).length,
    cabecerasDeGrupo: saltadas,
    hayFila: !!fila,
    columnas: tabla ? [...tabla.querySelectorAll('thead th')].map(texto) : [],
    barra,
    fila: enFila.map((el) => ({
      etiqueta: el.tagName.toLowerCase(),
      texto: texto(el),
      clase: el.className || '',
      primario: (el.className || '').includes('btn-primary'),
      enOverflow: esOverflow(el),
    })),
    tieneOverflow: !!disparador,
  };
})()`;

/** Lo que hay DENTRO del «⋯» de la primera fila: cuesta un clic sólo para verlo. */
const ABRIR_OVERFLOW = `(() => {
  const fila = [...document.querySelectorAll('#view-container table.table tbody tr')].find((tr) => tr.children.length >= 3);
  if (!fila) return { error: 'sin fila' };
  const t = fila.querySelector('.overflow-trigger, [data-overflow]');
  if (!t) return { hay: false, dentro: [] };
  t.click();
  const menu = document.querySelector('.overflow-menu, .overflow-sheet');
  return {
    hay: true,
    dentro: menu ? [...menu.querySelectorAll('button, a[href]')].map((b) => (b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 42)) : [],
  };
})()`;

const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), LISTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
console.log(`navegador: ${quien}  ·  viewport: ${ANCHO} px  ·  árbol: esta rama (816 + 823 dentro)\n`);

let ciego = 0;
for (const l of LISTAS) {
  const { page, errores } = await abrirVista(browser, puerto, l.ruta, ANCHO);
  const r = await page.evaluate(INVENTARIO);
  console.log('═'.repeat(88));
  console.log(`  ${l.rotulo}`);
  console.log('═'.repeat(88));
  if (r.error || !r.hayTabla || !r.hayFila) {
    console.log(`  ⚠️ NO SUPE MIRAR: ${r.error || (r.hayTabla ? 'la tabla no tiene ninguna fila de DATOS (solo cabeceras de grupo)' : 'no hay tabla')} · ${r.nodos} nodos`);
    if (errores.length) console.log(`     errores: ${errores.join(' | ')}`);
    ciego += 1;
    await page.close();
    continue;
  }
  console.log(`  tabla ${r.anchoTabla} px de ${r.viewport}  ·  ${r.filasDeDatos} filas de datos (+${r.cabecerasDeGrupo} cabeceras de grupo)  ·  ${r.columnas.length} columnas`);
  console.log(`  columnas: ${r.columnas.join(' | ')}`);

  const visibles = r.fila.filter((c) => !c.enOverflow);
  const primarios = visibles.filter((c) => c.primario);
  console.log(`\n  EN LA FILA (visible, sin abrir nada): ${visibles.length} controles`);
  for (const c of visibles) {
    console.log(`     ${c.primario ? '★ PRIMARIO' : '  '}  <${c.etiqueta}> «${c.texto || '(sin texto)'}»`);
  }
  console.log(`     → primarios: ${primarios.length}`);

  const ov = await page.evaluate(ABRIR_OVERFLOW);
  if (ov.hay) {
    console.log(`\n  DENTRO DEL «⋯» (un clic sólo para verlo): ${ov.dentro.length}`);
    for (const t of ov.dentro) console.log(`        «${t}»`);
  } else {
    console.log('\n  DENTRO DEL «⋯»: no hay «⋯» en la fila');
  }

  const barraUtil = r.barra.filter((b) => b.texto || b.etiqueta === 'input' || b.etiqueta === 'select');
  console.log(`\n  BARRA DE LA PANTALLA: ${barraUtil.length} controles`);
  for (const b of barraUtil.slice(0, 12)) {
    console.log(`     <${b.etiqueta}> «${b.texto || '(sin texto)'}»${b.clase.includes('btn-primary') ? '   ★ PRIMARIO' : ''}`);
  }
  if (barraUtil.length > 12) console.log(`     … y ${barraUtil.length - 12} más`);
  console.log('');
  await page.close();
}

await browser.close();
srv.close();
if (ciego) { console.error(`🔴 ${ciego} lista(s) sin medir: su hueco NO se rellena con una opinión.`); process.exit(2); }

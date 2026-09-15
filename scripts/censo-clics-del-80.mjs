// scripts/censo-clics-del-80.mjs — encargo del fundador, 8-sep-2026 (segunda mitad)
//
// ¿A CUÁNTOS CLICS ESTÁ? Lo que el censo de inventario no puede contestar leyendo el DOM: qué
// pasa cuando PULSAS. Se pulsa de verdad, en Edge, a 1700 px.
//
// Por cada lista:
//   ① ¿la FILA entera navega al detalle? (entonces todo lo de dentro está a 2 clics: llegar + hacer)
//   ② ¿hay casilla de selección? (la vía de las acciones en lote)
//   ③ el PRIMARIO de la fila, si lo hay: ¿HACE la cosa o NAVEGA?
//
// 🔴 Y CADA RESPUESTA LLEVA SU SUELO. «No navegó» y «no encontré dónde pulsar» son el mismo
// silencio con significados opuestos, así que si no hay dónde pulsar se dice, no se cuenta como
// un no.
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
  // esto se quedaba en `skeleton-row` y los censos leían «0 controles» — cero por no haber
  // pintado, no por no haber botones.
  { ruta: '/facturas', fnVista: 'renderInvoicesView', rotulo: 'Facturas', datos: reglasDeDatos([]), api: API },
  { ruta: '/albaranes', fnVista: 'renderAlbaranesView', rotulo: 'Albaranes', datos: reglasDeDatos([]) },
  { ruta: '/clientes', fnVista: 'renderCustomersView', rotulo: 'Clientes', datos: reglasDeDatos([]) },
];

// La fila de DATOS (≥3 celdas: una cabecera de grupo tiene una sola con `colSpan`).
const SONDA = `(() => {
  const filas = [...document.querySelectorAll('#view-container table.table tbody tr')]
    .filter((tr) => tr.children.length >= 3);
  const fila = filas[0];
  if (!fila) return { error: 'no hay fila de datos' };

  // Una celda SIN controles dentro: es donde pulsaría alguien que quiere «abrir» el documento.
  const celdaLimpia = [...fila.children].find((td) =>
    !td.querySelector('button, a[href], input, select, summary') && (td.textContent || '').trim());

  const casillas = fila.querySelectorAll('input[type="checkbox"]').length;
  const primario = fila.querySelector('button.btn-primary');
  const enlaces = [...fila.querySelectorAll('a[href]')].map((a) => (a.textContent || '').trim().slice(0, 30));

  return {
    hayFila: true,
    celdaLimpia: celdaLimpia ? (celdaLimpia.className || '(sin clase)') : null,
    textoCelda: celdaLimpia ? (celdaLimpia.textContent || '').trim().slice(0, 30) : null,
    casillas,
    primario: primario ? primario.textContent.trim().slice(0, 42) : null,
    enlaces,
    cursorFila: getComputedStyle(fila).cursor,
  };
})()`;

const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), LISTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
console.log(`navegador: ${quien}  ·  viewport: ${ANCHO} px\n`);
console.log('lista'.padEnd(15) + 'la FILA navega'.padEnd(18) + 'casilla'.padEnd(10) + 'primario en la fila');
console.log('─'.repeat(96));

let ciego = 0;
const filas = [];
for (const l of LISTAS) {
  const { page } = await abrirVista(browser, puerto, l.ruta, ANCHO);
  // Los grupos plegados esconden filas: se abren con el mecanismo del producto antes de sondar.
  await page.evaluate(`document.querySelectorAll('#view-container .jobs-grupo-abrir button').forEach((b) => b.click())`);
  const s = await page.evaluate(SONDA);
  if (s.error) {
    console.log(`${l.rotulo.padEnd(15)}⚠️ NO SUPE MIRAR: ${s.error}`);
    ciego += 1;
    await page.close();
    continue;
  }

  // ── ① ¿NAVEGA LA FILA? ────────────────────────────────────────────────────────────────
  //
  // 🔴 EL ÁRBITRO NO PUEDE SER SÓLO `renderAppView`, y esto lo cazó una contradicción: la sonda
  // decía «Presupuestos NO navega» mientras su fila tenía `cursor: pointer`. Es que **no pasa por
  // el router**: `quotesListView` llama a `renderQuoteDetailView(contenedor, id)` DIRECTAMENTE y
  // reemplaza el contenido en el sitio. Con el router doblado, eso era invisible.
  //
  // Así que se pregunta por el HECHO —«¿cambió la pantalla?»— por las dos vías: el router, y el
  // contenido del contenedor. Y se guarda POR CUÁL, que es un dato en sí mismo: quien se salta el
  // router no deja rastro en el historial (la familia de SCRUM-819).
  let navega = null;
  let via = null;
  if (s.celdaLimpia) {
    const antes = await page.evaluate(`({
      navs: window.__navegaciones.length,
      huella: document.querySelector('#view-container').innerHTML.length,
      hayTabla: !!document.querySelector('#view-container table.table'),
    })`);
    await page.evaluate(`(() => {
      const fila = [...document.querySelectorAll('#view-container table.table tbody tr')].filter((tr) => tr.children.length >= 3)[0];
      const td = [...fila.children].find((c) => !c.querySelector('button, a[href], input, select, summary') && (c.textContent || '').trim());
      td.click();
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    const despues = await page.evaluate(`({
      navs: window.__navegaciones,
      huella: document.querySelector('#view-container').innerHTML.length,
      hayTabla: !!document.querySelector('#view-container table.table'),
    })`);
    if (despues.navs.length > antes.navs) {
      navega = despues.navs[despues.navs.length - 1].vista;
      via = 'router';
    } else if (!despues.hayTabla || Math.abs(despues.huella - antes.huella) > 400) {
      navega = '(otra pantalla)';
      via = 'SIN router — reemplaza el contenedor a mano';
    } else {
      navega = false;
    }
  }

  const txtNavega = navega === null ? '⚠️ sin celda limpia' : (navega ? `sí → ${navega}` : 'NO');
  console.log(
    l.rotulo.padEnd(15)
    + String(txtNavega).padEnd(18)
    + (s.casillas ? 'sí' : 'no').padEnd(10)
    + (s.primario ? `«${s.primario}»` : '—'),
  );
  filas.push({ lista: l.rotulo, navega, via, ...s });
  await page.close();
}

console.log('\n─── detalle por lista ───');
for (const f of filas) {
  console.log(`\n  ${f.lista}`);
  console.log(`     celda que se pulsa para «abrir»: ${f.celdaLimpia || '(ninguna: todas llevan control)'} «${f.textoCelda || ''}»`);
  console.log(`     cursor de la fila: ${f.cursorFila}${f.cursorFila === 'pointer' ? '  (se anuncia como pulsable)' : ''}`);
  console.log(`     enlaces dentro de la fila: ${f.enlaces.length ? f.enlaces.map((e) => `«${e}»`).join(', ') : 'ninguno'}`);
}

await browser.close();
srv.close();
if (ciego) { console.error(`\n🔴 ${ciego} lista(s) sin sondar.`); process.exit(2); }

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
console.log('lista'.padEnd(15) + 'la FILA navega'.padEnd(22) + 'casilla'.padEnd(10) + 'primario en la fila');
console.log('─'.repeat(96));

let ciego = 0;
const rotos = [];
const filas = [];

// ── CONTROL, ANTES DE MEDIR NADA: ¿este censo VE un error al pulsar? ─────────────────────────
//
// Un detector que nunca ha visto el defecto no ha demostrado que lo vea. Así que en cada pasada se
// le enseñan dos filas sintéticas, en una página del banco de verdad: una que NO hace nada al
// pulsarla (tiene que salir «NO», sin error: si no, el detector marca todo) y otra que REVIENTA a
// propósito (tiene que salir con su error). Si cualquiera de las dos falla, el censo no mide y lo
// dice: sale con 2, «no supe medir», y su tabla no vale como dato.
{
  const { page } = await abrirVista(browser, puerto, LISTAS[0].ruta, ANCHO);
  const montar = (revienta) => page.evaluate(`(() => {
    const vc = document.querySelector('#view-container');
    vc.innerHTML = '<table class="table"><tbody><tr><td>control</td><td>fila</td><td>sintetica</td></tr></tbody></table>';
    if (${revienta}) vc.querySelector('tr').addEventListener('click', () => { throw new Error('control-1179c: esta fila revienta a proposito'); });
  })()`);
  await montar(false);
  const quieta = await pulsarLaFila(page, await page.evaluate(SONDA));
  await montar(true);
  const rota = await pulsarLaFila(page, await page.evaluate(SONDA));
  await page.close();
  const veQuieta = quieta.navega === false && !quieta.errorAlPulsar;
  const veRota = !!rota.errorAlPulsar && rota.errorAlPulsar.includes('control-1179c');
  console.log(`control: fila quieta → ${veQuieta ? 'NO, sin error ✓' : '✗ ' + JSON.stringify(quieta)}  ·  fila que revienta → ${veRota ? 'ERROR visto ✓' : '✗ ' + JSON.stringify(rota)}\n`);
  if (!veQuieta || !veRota) {
    console.error('🔴 NO SUPE MEDIR: el control no sale como debe, así que la tabla no distinguiría «no navega» de «revienta al pulsar».');
    await browser.close();
    srv.close();
    process.exit(2);
  }
}

for (const l of LISTAS) {
  const { page } = await abrirVista(browser, puerto, l.ruta, ANCHO);
  // Los grupos plegados esconden filas: se abren con el mecanismo del producto antes de sondar.
  await page.evaluate(`document.querySelectorAll('#view-container .jobs-grupo-abrir button').forEach((b) => b.click())`);
  // Una vista que ya dio error al PINTARSE no es la pantalla que ve el profesional: lo que se sondee
  // ahí no describe nada. Se declara ciega, no se mide.
  const erroresAlPintar = await page.evaluate('window.__errores.slice()');
  if (erroresAlPintar.length) {
    console.log(`${l.rotulo.padEnd(15)}⚠️ NO SUPE MIRAR: la vista dio error al pintarse: ${erroresAlPintar.join(' · ')}`);
    ciego += 1;
    await page.close();
    continue;
  }
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
  //
  const { navega, via, errorAlPulsar } = await pulsarLaFila(page, s);

  if (errorAlPulsar) rotos.push(`${l.rotulo}: ${errorAlPulsar}`);
  const txtNavega = errorAlPulsar ? '🔴 ERROR al pulsar' : navega === null ? '⚠️ sin celda limpia' : (navega ? `sí → ${navega}` : 'NO');
  console.log(
    l.rotulo.padEnd(15)
    + String(txtNavega).padEnd(22)
    + (s.casillas ? 'sí' : 'no').padEnd(10)
    + (s.primario ? `«${s.primario}»` : '—'),
  );
  filas.push({ lista: l.rotulo, navega, via, ...s });
  await page.close();
}

/**
 * Pulsa la celda limpia de la primera fila de datos y contesta QUÉ PASÓ.
 *
 * 🔴 SCRUM-1179-C (29-sep-2026) · «NO NAVEGÓ» Y «REVENTÓ AL PULSAR» SON COSAS DISTINTAS. Este censo
 * pintó durante días «Facturas: NO» como si fuera diseño, y era que el clic de la fila lanzaba
 * `ReferenceError: cb is not defined` (invoicesView.js, desde SCRUM-845): en producción la fila de
 * una factura no abría nada. Por eso se leen los errores de la página ANTES y DESPUÉS de pulsar, y
 * `controlPositivo` comprueba en cada pasada que esta función SÍ ve un error cuando lo hay.
 */
async function pulsarLaFila(page, s) {
  let navega = null;
  let via = null;
  let errorAlPulsar = null;
  if (s.celdaLimpia) {
    const antes = await page.evaluate(`({
      errores: window.__errores.length,
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
      errores: window.__errores,
      navs: window.__navegaciones,
      huella: document.querySelector('#view-container').innerHTML.length,
      hayTabla: !!document.querySelector('#view-container table.table'),
    })`);
    if (despues.errores.length > antes.errores) {
      errorAlPulsar = despues.errores.slice(antes.errores).join(' · ');
      navega = null;
    } else if (despues.navs.length > antes.navs) {
      navega = despues.navs[despues.navs.length - 1].vista;
      via = 'router';
    } else if (!despues.hayTabla || Math.abs(despues.huella - antes.huella) > 400) {
      navega = '(otra pantalla)';
      via = 'SIN router — reemplaza el contenedor a mano';
    } else {
      navega = false;
    }
  }
  return { navega, via, errorAlPulsar };
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
// Salidas: 0 medido · 1 medido y ALGUNA FILA REVIENTA AL PULSARLA (defecto del producto, no del
// censo) · 2 alguna lista sin sondar (entonces su hueco no vale como dato, y eso pesa más).
if (rotos.length) {
  console.log('\n🔴 AL PULSAR LA FILA, LA PÁGINA LANZA UN ERROR (en producción esa fila no abre nada):');
  for (const r of rotos) console.log(`   ${r}`);
}
if (ciego) { console.error(`\n🔴 ${ciego} lista(s) sin sondar.`); process.exit(2); }
if (rotos.length) process.exit(1);

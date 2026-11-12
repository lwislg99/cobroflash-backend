// docs/master/evidencias/SCRUM-1562/sonda-1562g-teclado.mjs — SCRUM-1562g (J1, 27-oct-2026)
//
// DESDE LA LISTA DE FACTURAS, CON TECLADO, SE ABRE LA FACTURA. Y CON RATÓN Y CASILLA, IGUAL QUE ANTES.
//
// En Edge de verdad (puppeteer-core), con el banco de los guards de lista (`scripts/_banco-lista.mjs`),
// dos facturas (una pendiente, que lleva la casilla del lote, y una cobrada, que no), a 1280 y a 390,
// ANTES (el `public/` del punto de partida de la rama) y DESPUÉS (el árbol de hoy). Por cada fila:
//   · TAB REAL desde la página recién cargada hasta que el foco cae en «Ver detalle» de ESA fila:
//     cuántas paradas, y si `:focus-visible` casa (el anillo).
//   · INTRO real con el foco ahí → navegaciones. Página nueva, mismo Tab, ESPACIO real → navegaciones.
//   · RATÓN: clic real en la celda del cliente → navegaciones (la fila sigue abriendo).
//   · CASILLA (sólo la pendiente, sólo a 1280: en móvil se oculta): clic real → NO navega.
//
// CONTROL POSITIVO: en el ANTES la fila NO tiene «Ver detalle» y el Tab no llega (es el defecto que
// midió jv-j1dc, c.21124). Si la sonda lo encontrara también en el ANTES, no estaría mirando.
//
// Salida: 0 el DESPUÉS cumple todo · 1 algo falla · 2 no supe mirar (sin filas, sin control positivo).
// Uso: node docs/master/evidencias/SCRUM-1562/sonda-1562g-teclado.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from '../../../../scripts/_banco-lista.mjs';
import { reglasDeDatos, CLIENTES } from '../../../../scripts/_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ANCHOS = [1280, 390];
const FACTURAS = [
  { id: 41, number: 'F-2026-0041', status: 'pending', total: 120, currency: 'EUR', createdAt: '2026-10-20T09:00:00.000Z', customer: CLIENTES[0] },
  { id: 42, number: 'F-2026-0042', status: 'paid', total: 999.99, currency: 'EUR', createdAt: '2026-10-10T09:00:00.000Z', customer: CLIENTES[1] },
];
const API = (ruta) => (ruta.includes('/admin/albaranes') ? [] : ruta.includes('/admin/invoices') ? FACTURAS : []);
const RUTAS = [{ ruta: '/facturas', fnVista: 'renderInvoicesView', datos: reglasDeDatos([]), api: API }];

const FILA = (n) => `[...document.querySelectorAll('#view-container table.table tbody tr')].find((tr) => (tr.textContent || '').includes('${n}'))`;
const esVerDetalleDe = (n) => `(() => { const a = document.activeElement; const tr = ${FILA(n)};
  return !!a && !!tr && a.tagName === 'BUTTON' && a.textContent.trim() === 'Ver detalle' && tr.contains(a); })()`;
const navs = (page) => page.evaluate('JSON.stringify(window.__navegaciones)');
const unaA = (id) => JSON.stringify([{ vista: 'invoice-detail', params: { invoiceId: id } }]);

async function abrir(browser, puerto, ancho) {
  const { page } = await abrirVista(browser, puerto, '/facturas', ancho);
  await page.evaluate('window.__navegaciones.length = 0; document.activeElement && document.activeElement.blur && document.activeElement.blur();');
  return page;
}

/** Tabula hasta «Ver detalle» de la fila `n`. Devuelve el nº de paradas o null si no llega en 200. */
async function tabularHasta(page, n) {
  for (let i = 1; i <= 200; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(esVerDetalleDe(n))) return i;
  }
  return null;
}

async function medir(browser, puerto, f, ancho) {
  const r = { n: f.number, ancho };
  let page = await abrir(browser, puerto, ancho);
  Object.assign(r, await page.evaluate(`(() => {
    const tr = ${FILA(f.number)};
    if (!tr) return { fila: false };
    const b = [...tr.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Ver detalle');
    return { fila: true, hayBoton: !!b, role: tr.getAttribute('role'), casilla: !!tr.querySelector('input[type="checkbox"]') };
  })()`));
  if (r.fila) {
    r.paradas = await tabularHasta(page, f.number);
    if (r.paradas) {
      r.anillo = await page.evaluate('document.activeElement.matches(":focus-visible")');
      await page.keyboard.press('Enter');
      await new Promise((x) => setTimeout(x, 150));
      r.intro = await navs(page);
    }
  }
  await page.close();
  if (!r.fila) return r;

  if (r.paradas) {
    page = await abrir(browser, puerto, ancho);
    if (await tabularHasta(page, f.number)) {
      await page.keyboard.press('Space');
      await new Promise((x) => setTimeout(x, 150));
      r.espacio = await navs(page);
    }
    await page.close();
  }

  page = await abrir(browser, puerto, ancho);
  await page.evaluate(`${FILA(f.number)}.querySelector('td.cell-client').scrollIntoView()`);
  const celda = await page.evaluateHandle(`${FILA(f.number)}.querySelector('td.cell-client')`);
  await celda.asElement().click();
  await new Promise((x) => setTimeout(x, 150));
  r.raton = await navs(page);
  await page.close();

  if (r.casilla && ancho === 1280) {
    page = await abrir(browser, puerto, ancho);
    const cb = await page.evaluateHandle(`${FILA(f.number)}.querySelector('input[type="checkbox"]')`);
    await cb.asElement().click();
    await new Promise((x) => setTimeout(x, 150));
    r.casillaNavega = await navs(page);
    r.casillaMarcada = await page.evaluate(`${FILA(f.number)}.querySelector('input[type="checkbox"]').checked`);
    await page.close();
  }
  return r;
}

const antes = arbolDePartida(RAIZ, '1562g');
if (!antes.publico) { console.error('🔴 NO SUPE MIRAR: no resuelvo el punto de partida de la rama'); process.exit(2); }
const sA = await servirListas(antes.publico, RUTAS);
const sD = await servirListas(path.join(RAIZ, 'public'), RUTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
console.log(`navegador: ${quien} · antes = ${antes.base.sha} (${antes.base.como || 'merge-base'})`);

let fallos = 0;
let ciego = 0;
let casos = 0;
const marca = (ok) => (ok ? '✅' : '🔴');
try {
  for (const [nombre, srv] of [['ANTES', sA], ['DESPUÉS', sD]]) {
    console.log(`\n── ${nombre} ──────────────────────────────────────────────────────────────────`);
    console.log('factura       ancho  botón  role  Tab→paradas  anillo  Intro  Espacio  ratón  casilla');
    for (const f of FACTURAS) {
      for (const ancho of ANCHOS) {
        const r = await medir(browser, srv.puerto, f, ancho);
        if (!r.fila) { console.error(`   🔴 NO SUPE MIRAR · ${nombre} ${f.number} ${ancho}: sin fila`); ciego += 1; continue; }
        casos += 1;
        const uno = unaA(f.id);
        const raton = r.raton === uno;
        const casilla = r.casillaNavega === undefined ? '—' : marca(r.casillaNavega === '[]' && r.casillaMarcada);
        console.log(`${f.number.padEnd(14)}${String(ancho).padEnd(7)}${(r.hayBoton ? 'sí' : 'NO').padEnd(7)}${String(r.role ?? '—').padEnd(6)}`
          + `${String(r.paradas ?? 'NO LLEGA').padEnd(13)}${(r.paradas ? marca(r.anillo) : '—').padEnd(8)}`
          + `${(r.paradas ? marca(r.intro === uno) : '—').padEnd(7)}${(r.paradas ? marca(r.espacio === uno) : '—').padEnd(9)}${marca(raton).padEnd(7)}${casilla}`);
        if (!raton) { console.error(`   🔴 ${nombre} ${f.number} ${ancho}: el ratón en la fila hizo ${r.raton}`); fallos += 1; }
        if (r.casillaNavega !== undefined && !(r.casillaNavega === '[]' && r.casillaMarcada)) {
          console.error(`   🔴 ${nombre} ${f.number}: la casilla navegó ${r.casillaNavega} o no se marcó (${r.casillaMarcada})`); fallos += 1;
        }
        if (nombre === 'ANTES' && (r.hayBoton || r.paradas)) {
          console.error(`   🔴 NO SUPE MIRAR · ANTES ${f.number} ${ancho}: el control positivo falla (en el antes no había camino de teclado)`);
          ciego += 1;
        }
        if (nombre === 'DESPUÉS') {
          if (!r.hayBoton || !r.paradas || !r.anillo || r.intro !== uno || r.espacio !== uno) {
            console.error(`   🔴 ${f.number} ${ancho}: teclado roto · botón ${r.hayBoton} · paradas ${r.paradas} · anillo ${r.anillo} · Intro ${r.intro} · Espacio ${r.espacio}`);
            fallos += 1;
          }
          if (r.role != null) { console.error(`   🔴 ${f.number} ${ancho}: la fila lleva role=${r.role}`); fallos += 1; }
        }
      }
    }
  }
} finally {
  await browser.close();
  sA.srv.close(); sD.srv.close();
  antes.limpiar();
}
const esperados = 2 * FACTURAS.length * ANCHOS.length;
if (casos !== esperados) { console.error(`🔴 NO SUPE MIRAR: medí ${casos} casos de ${esperados}`); ciego += 1; }
const salida = ciego ? 2 : fallos ? 1 : 0;
console.log(`\n⟦veredicto⟧ ${fallos} fallo(s) · ${ciego} ciego(s) · ${casos} de ${esperados} casos (2 árboles × ${FACTURAS.length} facturas × ${ANCHOS.length} anchos) → salida ${salida}`);
process.exit(salida);

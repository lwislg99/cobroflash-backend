// docs/master/evidencias/SCRUM-1562/sonda-1562f-teclado.mjs — SCRUM-1562f (S4, 22-oct-2026)
//
// LA LISTA DE TRABAJOS SE SIGUE ABRIENDO CON TECLADO AL SACAR «Ver detalle» DE `.jobs-acciones`.
//
// En Edge de verdad (puppeteer-core), con el banco de los guards de lista (`scripts/_banco-lista.mjs`),
// los cinco estados del Trabajo, a 1280 y a 390, ANTES (el `public/` del punto de partida de la rama)
// y DESPUÉS (el árbol de hoy). Por cada caso:
//   · TAB REAL desde la página recién cargada hasta que el foco cae en «Ver detalle» de la fila:
//     cuántas paradas, y si `:focus-visible` casa (el anillo).
//   · INTRO real con el foco ahí → navegaciones. Página nueva, mismo Tab, ESPACIO real → navegaciones.
//   · RATÓN: clic real en la celda del cliente → navegaciones (la fila sigue abriendo).
//   · DÓNDE: ¿cuelga «Ver detalle» de `.jobs-acciones`? ¿en la misma línea que la acción? alto de fila.
//
// CONTROL POSITIVO: en el ANTES «Ver detalle» SÍ cuelga de `.jobs-acciones` (es el defecto). Si la
// sonda dijera «fuera» también en el ANTES, no estaría mirando.
//
// Salida: 0 el DESPUÉS cumple todo · 1 algo falla · 2 no supe mirar (sin filas, sin control positivo).
// Uso: node docs/master/evidencias/SCRUM-1562/sonda-1562f-teclado.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from '../../../../scripts/_banco-lista.mjs';
import { trabajosDeMuestra, reglasDeDatos, EQUIPO } from '../../../../scripts/_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ESTADOS = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado'];
const ANCHOS = [1280, 390];

// El mismo Trabajo por estado que `guard-escalera-por-estado.mjs` (sin resto, sin documentos).
const trabajoEn = (estado) => ({
  ...trabajosDeMuestra(1, { conDocumentos: false })[0],
  id: 1, status: estado,
  scheduledAt: estado === 'pendiente_agendar' ? null : '2026-09-10T09:30:00.000Z',
  remaining: null, albaranes: [], invoices: [], charge: null, entregaPendiente: null,
  customer: { id: 1, name: 'Carmen Ruiz', phone: null, email: null, taxId: null },
  asignados: [EQUIPO[0]],
});
const RUTAS = ESTADOS.map((e) => ({ ruta: `/lista-${e}`, fnVista: 'renderJobsView', datos: reglasDeDatos([trabajoEn(e)]) }));

const DESPLEGAR = `(() => { const b = document.querySelector('#view-container .jobs-grupo-abrir button'); if (b) b.click(); return !!b; })()`;
const ES_VER_DETALLE = `(() => { const a = document.activeElement;
  return !!a && a.tagName === 'BUTTON' && a.textContent.trim() === 'Ver detalle' && !!a.closest('tr.jobs-fila'); })()`;

async function abrir(browser, puerto, ruta, ancho) {
  const { page } = await abrirVista(browser, puerto, ruta, ancho);
  await page.evaluate(DESPLEGAR);
  await new Promise((r) => setTimeout(r, 150));
  await page.evaluate('window.__navegaciones.length = 0; document.activeElement && document.activeElement.blur && document.activeElement.blur();');
  return page;
}

/** Tabula hasta «Ver detalle» de la fila. Devuelve el nº de paradas o null si no llega en 200. */
async function tabularHasta(page) {
  for (let i = 1; i <= 200; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(ES_VER_DETALLE)) return i;
  }
  return null;
}

const navs = (page) => page.evaluate('JSON.stringify(window.__navegaciones)');
const UNA_A_LA_FICHA = JSON.stringify([{ vista: 'jobs-detail', params: { jobId: 1 } }]);

async function medir(browser, puerto, estado, ancho) {
  const ruta = `/lista-${estado}`;
  const r = { estado, ancho };

  let page = await abrir(browser, puerto, ruta, ancho);
  Object.assign(r, await page.evaluate(`(() => {
    const tr = document.querySelector('#view-container tr.jobs-fila');
    if (!tr) return { filas: 0 };
    const b = [...tr.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Ver detalle');
    if (!b) return { filas: 1, hayBoton: false };
    const otro = [...tr.querySelectorAll('td.cell-actions button')].find((x) => x !== b);
    const cb = b.getBoundingClientRect();
    const co = otro ? otro.getBoundingClientRect() : null;
    return {
      filas: 1, hayBoton: true,
      enAcciones: !!b.closest('.jobs-acciones'),
      mismaLinea: co ? Math.abs((cb.top + cb.height / 2) - (co.top + co.height / 2)) < 4 : null,
      altoFila: Math.round(tr.getBoundingClientRect().height),
      altoBoton: Math.round(cb.height),
    };
  })()`));
  if (!r.hayBoton) { await page.close(); return r; }

  r.paradas = await tabularHasta(page);
  if (r.paradas) {
    r.anillo = await page.evaluate('document.activeElement.matches(":focus-visible")');
    await page.keyboard.press('Enter');
    await new Promise((x) => setTimeout(x, 150));
    r.intro = await navs(page);
  }
  await page.close();

  page = await abrir(browser, puerto, ruta, ancho);
  if (await tabularHasta(page)) {
    await page.keyboard.press('Space');
    await new Promise((x) => setTimeout(x, 150));
    r.espacio = await navs(page);
  }
  await page.close();

  // Sobre el NOMBRE del cliente, no en el centro de la celda: la primera versión pulsaba el centro
  // de `td.cell-client`, caía en el desplegable de técnicos (`[data-fila-no-navega]`, que no navega
  // a propósito) y daba «ratón 🔴» en el ANTES y en el DESPUÉS por igual. Era la sonda, no la fila.
  page = await abrir(browser, puerto, ruta, ancho);
  await page.click('#view-container tr.jobs-fila .jobs-fila-cliente');
  await new Promise((x) => setTimeout(x, 150));
  r.raton = await navs(page);
  await page.close();
  return r;
}

const antes = arbolDePartida(RAIZ, '1562f');
if (!antes.publico) { console.error('🔴 NO SUPE MIRAR: no resuelvo el punto de partida de la rama'); process.exit(2); }
const sA = await servirListas(antes.publico, RUTAS);
const sD = await servirListas(path.join(RAIZ, 'public'), RUTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
console.log(`navegador: ${quien} · antes = ${antes.base.sha} (${antes.base.como || 'merge-base'})`);

let fallos = 0;
let ciego = 0;
const marca = (ok) => (ok ? '✅' : '🔴');
try {
  for (const [nombre, srv] of [['ANTES', sA], ['DESPUÉS', sD]]) {
    console.log(`\n── ${nombre} ──────────────────────────────────────────────────────────────────`);
    console.log('estado            ancho  en .jobs-acciones  misma línea  alto fila  Tab→paradas  anillo  Intro  Espacio  ratón');
    for (const estado of ESTADOS) {
      for (const ancho of ANCHOS) {
        const r = await medir(browser, srv.puerto, estado, ancho);
        // Sin fila no hay nada que medir: ciego. Pero una fila SIN «Ver detalle» en el DESPUÉS no es
        // ceguera, es el defecto: el arreglo que pone verde el guard quitando el botón deja la fila
        // sin camino de teclado. Medido con ese mutante el 22-oct: la primera versión lo daba como
        // «no supe mirar» (salida 2).
        if (!r.filas || (!r.hayBoton && nombre === 'ANTES')) {
          console.error(`   🔴 NO SUPE MIRAR · ${nombre} ${estado} ${ancho}: ${!r.filas ? 'sin fila' : 'sin «Ver detalle»'}`);
          ciego += 1; continue;
        }
        if (!r.hayBoton) {
          console.error(`   🔴 ${estado} ${ancho}: la fila no tiene «Ver detalle» → con teclado no se abre la ficha`);
          fallos += 1; continue;
        }
        const intro = r.intro === UNA_A_LA_FICHA;
        const espacio = r.espacio === UNA_A_LA_FICHA;
        const raton = r.raton === UNA_A_LA_FICHA;
        console.log(`${estado.padEnd(18)}${String(ancho).padEnd(7)}${(r.enAcciones ? 'SÍ' : 'no').padEnd(19)}`
          + `${String(r.mismaLinea === null ? '—' : r.mismaLinea ? 'sí' : 'NO').padEnd(13)}${String(r.altoFila).padEnd(11)}`
          + `${String(r.paradas ?? 'NO LLEGA').padEnd(13)}${marca(r.anillo).padEnd(8)}${marca(intro).padEnd(7)}${marca(espacio).padEnd(9)}${marca(raton)}`);
        if (nombre === 'ANTES' && !r.enAcciones) {
          console.error(`   🔴 NO SUPE MIRAR · ANTES ${estado} ${ancho}: el control positivo falla (en el antes tenía que estar DENTRO)`);
          ciego += 1;
        }
        if (nombre === 'DESPUÉS') {
          if (r.enAcciones) { console.error(`   🔴 ${estado} ${ancho}: «Ver detalle» sigue dentro de .jobs-acciones`); fallos += 1; }
          if (!r.paradas || !r.anillo || !intro || !espacio) {
            console.error(`   🔴 ${estado} ${ancho}: teclado roto · paradas ${r.paradas} · anillo ${r.anillo} · Intro ${r.intro} · Espacio ${r.espacio}`);
            fallos += 1;
          }
          if (!raton) { console.error(`   🔴 ${estado} ${ancho}: el ratón en la fila hizo ${r.raton}`); fallos += 1; }
        }
      }
    }
  }
} finally {
  await browser.close();
  sA.srv.close(); sD.srv.close();
  antes.limpiar();
}
const salida = ciego ? 2 : fallos ? 1 : 0;
console.log(`\n⟦veredicto⟧ ${fallos} fallo(s) · ${ciego} ciego(s) · ${ESTADOS.length * ANCHOS.length} casos por árbol → salida ${salida}`);
process.exit(salida);

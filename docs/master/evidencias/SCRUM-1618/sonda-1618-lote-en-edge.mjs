// docs/master/evidencias/SCRUM-1618/sonda-1618-lote-en-edge.mjs — SCRUM-1618 (J1, 30-oct-2026)
//
// EL CAMPO DE FECHA DEL LOTE, EN EDGE DE VERDAD. Con el banco de los guards de lista
// (`scripts/_banco-lista.mjs`) y una factura pendiente:
//   · sin seleccionar, el campo NO está en la pantalla (lo que deja idéntica la huella de Facturas);
//   · al marcar la casilla sale UNA vez, y una segunda selección no lo duplica;
//   · el POST a `/admin/invoices/bulk-paid` va sin `paidAt` con el campo vacío, y con él si se escribe.
//
// CONTROL POSITIVO: en el ANTES (el `public/` del punto de partida de la rama) el campo no sale nunca.
// Si saliera también ahí, la sonda no estaría mirando.
//
// Salida: 0 cumple · 1 algo falla · 2 no supe mirar (sin casilla, sin POST, sin control positivo).
// Uso: node docs/master/evidencias/SCRUM-1618/sonda-1618-lote-en-edge.mjs [carpeta-para-la-captura]
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from '../../../../scripts/_banco-lista.mjs';
import { reglasDeDatos, CLIENTES } from '../../../../scripts/_trabajos-de-muestra.mjs';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const FACTURAS = [
  { id: 41, number: 'F-2026-0041', status: 'pending', total: 120, currency: 'EUR', createdAt: '2026-10-20T09:00:00.000Z', customer: CLIENTES[0] },
  { id: 43, number: 'F-2026-0043', status: 'pending', total: 80, currency: 'EUR', createdAt: '2026-10-19T09:00:00.000Z', customer: CLIENTES[1] },
];
const API = (ruta) => (ruta.includes('/admin/albaranes') ? [] : ruta.includes('/admin/invoices') ? FACTURAS : []);
const RUTAS = [{ ruta: '/facturas', fnVista: 'renderInvoicesView', datos: reglasDeDatos([]), api: API }];
const CAMPO = '#bulk-fecha-cobro';
// El banco contesta `apiRequest` sin red: el cuerpo se lee envolviendo esa función, no en la petición.
const ESCUCHA = `window.__lote = [];
  { const orig = window.apiRequest;
    window.apiRequest = function (ruta, o) {
      if (String(ruta).includes('bulk-paid')) window.__lote.push(o && o.body);
      return orig.apply(this, arguments);
    }; }`;

const hay = (page) => page.evaluate(`document.querySelectorAll('${CAMPO}').length`);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Marca la casilla `i`, y dice cuántos campos hay y cuántas casillas había. */
async function marcar(page, i) {
  const n = await page.evaluate('document.querySelectorAll(".inv-row-check").length');
  if (n <= i) return { casillas: n, marcada: false };
  await page.evaluate(`document.querySelectorAll('.inv-row-check')[${i}].click()`);
  await espera(80);
  return { casillas: n, marcada: true };
}

async function medir(browser, puerto, captura) {
  const r = {};
  const { page } = await abrirVista(browser, puerto, '/facturas', 1280);
  await page.evaluate(ESCUCHA);
  r.alAbrir = await hay(page);
  Object.assign(r, await marcar(page, 0));
  r.conUna = await hay(page);
  await marcar(page, 1);
  r.conDos = await hay(page);
  if (r.conDos === 1) {
    if (captura) await page.screenshot({ path: path.join(captura, 'lote-1280.png') });
    await page.evaluate('document.querySelector("#bulk-paid-btn").click()');
    await espera(250);
    r.vacio = await page.evaluate('window.__lote.at(-1) ?? null');
    await page.close();

    const b = await abrirVista(browser, puerto, '/facturas', 1280);
    await b.page.evaluate(ESCUCHA);
    await marcar(b.page, 0);
    await b.page.evaluate(`document.querySelector('${CAMPO}').value = '2026-03-31'`);
    await b.page.evaluate('document.querySelector("#bulk-paid-btn").click()');
    await espera(250);
    r.conFecha = await b.page.evaluate('window.__lote.at(-1) ?? null');
    await b.page.close();
  } else {
    await page.close();
  }
  return r;
}

const partida = arbolDePartida(RAIZ, 'sonda1618');
if (!partida.base) { console.log('NO SUPE MIRAR: sin punto de partida'); process.exit(2); }
const { srv: srvA, puerto: pA } = await servirListas(partida.publico, RUTAS);
const { srv: srvB, puerto: pB } = await servirListas(path.join(RAIZ, 'public'), RUTAS);
const { browser } = await abrirNavegador(puppeteer);
let salida = 0;
try {
  const antes = await medir(browser, pA, null);
  const despues = await medir(browser, pB, process.argv[2] || null);
  console.log('población: 2 facturas pendientes · 1280 px · base', partida.base.sha);
  console.log('ANTES  ', JSON.stringify(antes));
  console.log('DESPUÉS', JSON.stringify(despues));
  const cuerpo = (t) => { try { return JSON.parse(t); } catch { return null; } };
  const vacio = cuerpo(despues.vacio);
  const conFecha = cuerpo(despues.conFecha);
  if (!antes.marcada || !despues.marcada || antes.conUna !== 0) { console.log('NO SUPE MIRAR'); salida = 2; }
  else if (despues.alAbrir !== 0 || despues.conUna !== 1 || despues.conDos !== 1) { console.log('FALLA: el campo'); salida = 1; }
  else if (!vacio || !conFecha) { console.log('NO SUPE MIRAR: sin POST'); salida = 2; }
  else if ('paidAt' in vacio || conFecha.paidAt !== '2026-03-31') { console.log('FALLA: el cuerpo'); salida = 1; }
  else console.log('CUMPLE');
} finally {
  await browser.close();
  srvA.close();
  srvB.close();
  partida.limpiar();
}
process.exit(salida);

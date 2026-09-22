// SCRUM-920d · CAPTURAS de la lista de Gastos (390 y 1280 px) con la muestra del guard, para VER lo que el guard mide.
// Uso, desde la raiz del worktree y con el arbol commiteado:   node docs/master/evidencias/scrum920/capturas-920d.mjs
// Es una FOTO: no prueba que los botones funcionen (eso lo hace `npm run guard:lista-gastos`, pulsando). Sirve para que un
// humano vea la pantalla. La muestra es la MISMA forma y los mismos 8 gastos que la del guard (copiada: el guard no exporta).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from '../../../../scripts/_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SALIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'capturas-920d');
fs.mkdirSync(SALIDA, { recursive: true });

const FECHA = '2026-09-17T10:00:00.000Z';
const gasto = (id, concept, category, amount, extra = {}) => ({
  id, concept, category, amount: amount.toFixed(2), currency: 'EUR', date: FECHA, notes: null,
  quoteId: null, providerId: null, tieneFoto: false, quote: null, provider: null, job: null, ...extra,
});
const JOB_500 = { id: 500, titulo: 'Presupuesto #5 · María López' };
const ITEMS = [
  gasto(1, 'Tubo de cobre 22 mm', 'materiales', 42, { notes: 'Ticket del almacén', quoteId: 50, quote: { id: 50 }, job: JOB_500, provider: { id: 9, name: 'Saltoki' }, tieneFoto: true }),
  gasto(2, 'Gasolina', 'desplazamiento', 61.3),
  gasto(3, 'Taladro percutor', 'herramientas', 129.9, { quoteId: 51, quote: { id: 51 }, job: { id: 501, titulo: 'Reforma baño' }, tieneFoto: true }),
  gasto(4, 'Fontanero autónomo', 'subcontrata', 9999.99, { quoteId: 52, quote: { id: 52 }, job: { id: 502, titulo: 'Cocina Ruiz' }, provider: { id: 10, name: 'Instalaciones Pérez' } }),
  gasto(5, 'Varios', 'otros', 5),
  gasto(6, 'Silicona', 'otros', 3, { quoteId: 50, quote: { id: 50 }, job: JOB_500, tieneFoto: true }),
  gasto(7, 'Cinta aislante', 'materiales', 3.2, { quoteId: 77, quote: { id: 77 } }),
  gasto(8, 'Brocas de widia', 'herramientas', 18),
];
const total = ITEMS.reduce((a, g) => a + Number(g.amount), 0);
const resumen = { totalAmount: Math.round(total * 100) / 100, unassignedAmount: 87.5 + 3.2 - 3.2, byCategory: [{ category: 'subcontrata', amount: 9999.99 }, { category: 'materiales', amount: 45.2 }] };
const datos = `(function(){ var D = ${JSON.stringify({ items: ITEMS, res: resumen })}; return function(ruta){
  if (/\\/admin\\/expenses\\/summary/.test(ruta)) return D.res;
  if (/\\/admin\\/expenses/.test(ruta)) { var c = /[?&]category=([^&]+)/.exec(ruta); return { items: D.items.filter(function(g){ return !c || g.category === decodeURIComponent(c[1]); }) }; }
  return []; }; })()`;

const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/g', fnVista: 'renderExpensesView', datos }]);
const { browser, quien } = await abrirNavegador(puppeteer);
console.log('TESTIGO · capturas 920d · navegador ' + quien + ' · ' + ITEMS.length + ' gastos');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hechas = [];
async function foto(page, nombre, opciones = {}) {
  await espera(400);
  const ruta = path.join(SALIDA, nombre);
  await page.screenshot({ path: ruta, ...opciones });
  hechas.push(nombre + ' · ' + fs.statSync(ruta).size + ' bytes');
}
async function elegirTrabajo(page, etiqueta) {
  const valor = await page.evaluate((t) => { const o = [...document.querySelectorAll('#exp-filter-job option')].find((x) => x.textContent === t); return o ? o.value : null; }, etiqueta);
  await page.select('#exp-filter-job', valor);
}

for (const ancho of [390, 1280]) {
  const alto = ancho === 390 ? 844 : 900;
  {
    const { page } = await abrirVista(browser, puerto, '/g', ancho, alto);
    await foto(page, `${ancho}-1-lista.png`);
    if (ancho === 390) await foto(page, '390-1b-lista-entera.png', { fullPage: true });
    await page.click('.gastos-chip[data-foto="sinfoto"]');
    await foto(page, `${ancho}-2-sin-foto.png`);
    await page.click('.gastos-chip[data-foto="todos"]');
    await elegirTrabajo(page, 'Presupuesto #5 · María López');
    await foto(page, `${ancho}-3-un-trabajo.png`);
    await elegirTrabajo(page, 'Reforma baño');
    await page.click('.gastos-chip[data-foto="sinfoto"]');
    await foto(page, `${ancho}-4-vacio-de-filtros.png`);
    await page.close();
  }
}
await browser.close();
srv.close();
console.log(hechas.join('\n'));
console.log('EXIT=' + (hechas.length === 9 ? 0 : 1));
process.exit(hechas.length === 9 ? 0 : 1);

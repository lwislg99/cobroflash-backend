// SCRUM-920j · CAPTURAS a 390×844 del «?» de ayuda y «Nuevo gasto»: ANTES (sin la regla `padding-right: 78px`) y DESPUÉS.
// Uso, desde la raíz del worktree y con el árbol commiteado:   node docs/master/evidencias/scrum920/capturas-920j.mjs
// Es una FOTO, no una prueba (la prueba es el bloque J de `npm run guard:lista-gastos`, con `elementFromPoint`). El «?» es un
// DOBLE con el `cssText` que se lee de `tutorial.js`, porque el banco no carga `tutorial.js`. «Antes» = una COPIA de `public/` sin la regla.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from '../../../../scripts/_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SALIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'capturas-920j');
fs.mkdirSync(SALIDA, { recursive: true });
const REGLA = '.gastos-barra { padding-right: 78px; }';

const FECHA = '2026-09-17T10:00:00.000Z';
const gasto = (id, concept, category, amount, extra = {}) => ({
  id, concept, category, amount: amount.toFixed(2), currency: 'EUR', date: FECHA, notes: null,
  quoteId: null, providerId: null, tieneFoto: false, quote: null, provider: null, job: null, ...extra,
});
const ITEMS = [
  gasto(1, 'Tubo de cobre 22 mm', 'materiales', 42, { tieneFoto: true }),
  gasto(2, 'Gasolina', 'desplazamiento', 61.3),
  gasto(3, 'Taladro percutor', 'herramientas', 129.9, { tieneFoto: true }),
];
const resumen = { totalAmount: 233.2, unassignedAmount: 61.3, byCategory: [{ category: 'herramientas', amount: 129.9 }, { category: 'materiales', amount: 42 }] };
const datos = `(function(){ var D = ${JSON.stringify({ items: ITEMS, res: resumen })}; return function(ruta){
  if (/\\/admin\\/expenses\\/summary/.test(ruta)) return D.res;
  if (/\\/admin\\/expenses/.test(ruta)) return { items: D.items };
  return []; }; })()`;

const tutorialJs = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'tutorial.js'), 'utf8');
const fabCss = /btn\.id = 'tut-help-btn';[\s\S]*?btn\.style\.cssText = `([^`]*)`/.exec(tutorialJs)?.[1];
if (!fabCss) { console.error('🔴 NO SUPE MIRAR: no encuentro el cssText de #tut-help-btn en tutorial.js'); process.exit(2); }

const { browser, quien } = await abrirNavegador(puppeteer);
console.log('TESTIGO · capturas 920j · navegador ' + quien);
const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-920j-'));
try {
  fs.cpSync(path.join(RAIZ, 'public'), path.join(copia, 'public'), { recursive: true });
  const css = path.join(copia, 'public', 'dashboard', 'css', 'styles.css');
  const conRegla = fs.readFileSync(css, 'utf8');
  if (!conRegla.includes(REGLA)) { console.error('🔴 NO SUPE MIRAR: la regla no está en styles.css; no hay «después» que fotografiar'); process.exit(2); }
  fs.writeFileSync(css, conRegla.replace(REGLA, ''));
  for (const [nombre, publico] of [['390-antes.png', path.join(copia, 'public')], ['390-despues.png', path.join(RAIZ, 'public')]]) {
    const { srv, puerto } = await servirListas(publico, [{ ruta: '/g', fnVista: 'renderExpensesView', datos }]);
    const { page } = await abrirVista(browser, puerto, '/g', 390, 844);
    await page.evaluate((c) => {
      const n = document.createElement('button');
      n.id = 'tut-help-btn';
      n.style.cssText = c;
      n.textContent = '?';
      document.body.appendChild(n);
    }, fabCss);
    await new Promise((r) => setTimeout(r, 400));
    const ruta = path.join(SALIDA, nombre);
    // Sólo la franja de abajo (la barra y el «?»): es lo que se compara.
    await page.screenshot({ path: ruta, clip: { x: 0, y: 720, width: 390, height: 124 } });
    console.log(nombre + ' · ' + fs.statSync(ruta).size + ' bytes');
    await page.close();
    srv.close();
  }
} finally {
  await browser.close();
  fs.rmSync(copia, { recursive: true, force: true });
}

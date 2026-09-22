// SCRUM-1041 · CAPTURA a 390×844 de la card «Facturas emitidas» (public/dashboard/js/exportView.js)
// con los 4 textos firmados (com. 16306/16307 de SCRUM-1041), pantalla ya limpia de marcador.
// Uso, desde la raíz del worktree:   node docs/master/evidencias/SCRUM-1041/capturas-1041.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from '../../../../scripts/_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SALIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'capturas-1041');
fs.mkdirSync(SALIDA, { recursive: true });

// Sin datos: la card «Facturas emitidas» no llama a la API al pintarse (sólo al pulsar el botón),
// así que un `[]` de respaldo basta para que el banco no se quede esperando una petición que no sale.
const datos = '(function(){ return function(){ return []; }; })()';

const { browser, quien } = await abrirNavegador(puppeteer);
console.log('TESTIGO · capturas 1041 · navegador ' + quien);
try {
  const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/g', fnVista: 'renderExportView', datos }]);
  const { page, errores } = await abrirVista(browser, puerto, '/g', 390, 844);
  if (errores.length > 0) { console.error('🔴 ERRORES en el render: ' + errores.join(' | ')); process.exit(1); }
  const caja = await page.evaluate(() => {
    const el = document.getElementById('libro-emitidas-card');
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  });
  const ruta = path.join(SALIDA, '390-facturas-emitidas.png');
  await page.screenshot({ path: ruta, clip: caja });
  console.log('390-facturas-emitidas.png · ' + fs.statSync(ruta).size + ' bytes · caja ' + JSON.stringify(caja));
  await page.close();
  srv.close();
} finally {
  await browser.close();
}

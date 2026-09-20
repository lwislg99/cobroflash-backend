// docs/prototipos/SCRUM-920/medir-hoy.mjs — la lista de Gastos de HOY, medida EN STAGING (SCRUM-920)
//
// Sólo LEE: entra con la sesión QA, abre Gastos a 390 y a 1280, y cuenta lo que se ve. No crea, no
// edita, no borra. Reutiliza el conductor del banco sin red SÓLO para entrar (la red no se corta).
//
// Nace de una corrección: las capturas del inventario del 17-sep se hicieron con los cuatro gastos de
// prueba sembrados con categorías en inglés, y enseñaban «Otros» en todas las filas y «materials» en
// el KPI. El 18-sep el fundador corrigió esas cuatro filas; esto vuelve a medir la lista sobre datos
// que el producto reconoce.
//
// Uso (PowerShell, el secreto NUNCA se imprime):
//   $c=Get-Content D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt -Raw
//   $env:E2E_TEST_LOGIN_SECRET=[regex]::Match($c,'E2E_TEST_LOGIN_SECRET\s*=\s*"?([^"\r\n]+)"?').Groups[1].Value.Trim()
//   node docs/prototipos/SCRUM-920/medir-hoy.mjs [--capturas <carpeta>]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { arrancar, entrar, dormir, BASE } from '../../master/evidencias/SCRUM-307/sin-red/_conductor.mjs';

const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > -1 ? process.argv[iCap + 1] : path.join(os.tmpdir(), 'yaqu-920-hoy');
fs.mkdirSync(CAPTURAS, { recursive: true });

const { page, cerrar } = await arrancar();
await entrar(page);

const out = {};
for (const a of [{ n: '390', w: 390, h: 844, movil: true }, { n: '1280', w: 1280, h: 900, movil: false }]) {
  await page.setViewport({ width: a.w, height: a.h, isMobile: a.movil, hasTouch: a.movil, deviceScaleFactor: 1 });
  // Tras cambiar `isMobile` hay que recargar y volver a esperar al panel (traspaso de la S4).
  await page.goto(BASE + '/dashboard/', { waitUntil: 'load' });
  for (let i = 0; i < 30 && !(await page.evaluate(() => typeof window.renderAppView === 'function')); i++) await dormir(500);
  await page.evaluate(() => window.renderAppView('expenses'));
  for (let i = 0; i < 30 && !(await page.evaluate(() => document.querySelectorAll('#exp-list tbody tr').length > 0 && !!document.querySelector('#exp-summary .kpi-card'))); i++) await dormir(500);
  await dormir(600);
  out[a.n] = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('#exp-list tbody tr')];
    const caja = document.querySelector('#exp-list .table-scroll');
    return {
      filas: filas.length,
      pildoras: filas.map((f) => f.children[1]?.textContent.trim()),
      trabajo: filas.map((f) => f.children[2]?.textContent.trim().replace(/\s+/g, ' ')),
      kpis: [...document.querySelectorAll('#exp-summary .kpi-card')].map((k) => k.innerText.replace(/\s+/g, ' ').trim()),
      cajaDesborda: caja ? `${caja.scrollWidth}>${caja.clientWidth}` : 'sin caja',
      paginaDesborda: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  await page.screenshot({ path: path.join(CAPTURAS, `${a.n}-lista-hoy.png`) });
}
await cerrar();
console.log(JSON.stringify(out, null, 1));
console.log(`capturas en ${CAPTURAS}`);

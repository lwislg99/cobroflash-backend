// SCRUM-911b · remedición SÓLO LECTURA de la pantalla del paso 6, con el instrumento corregido.
//
// La 1ª medida del paso 6 buscaba la subcadena «387,20» en toda la página, y la columna TOTAL de la
// línea la enseña en los DOS borradores: el control salió «roto» y era el instrumento. Aquí se lee
// el «Total:» del documento. No escribe nada en staging: sólo abre los dos borradores.
//
//   YAQU_ENV_FILE=<secreto> node tests/banco-scrum911/paso6b-pantalla.mjs
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { imp, sesionQA, BASE, WT } from './_entorno.mjs';

const DIR = `${WT}/tests/banco-scrum911`;
const { draftId } = JSON.parse(fs.readFileSync(`${DIR}/paso6.json`, 'utf8'));
const BORRADOR_17SEP = 1889;
if (!draftId) throw new Error('paso6.json sin draftId: el paso 6 no llegó a crear el borrador');

const { lanzarNavegador } = await imp('scripts/_navegador.mjs');
const { cookie } = await sesionQA();
const [nombre, ...resto] = cookie.split('=');
const R = {};
const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
try {
  const page = await nav.newPage();
  await page.setViewport({ width: 1280, height: 1400 });
  await page.setCookie({ name: nombre, value: resto.join('='), domain: new URL(BASE).hostname, path: '/' });
  await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction('typeof window.renderAppView === "function"', { timeout: 30000 });
  const mirar = async (id) => {
    await page.evaluate((q) => window.renderAppView('quotes-detail', { quoteId: q }), id);
    await page.waitForFunction(() => /Revisión de termo/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    const m = /\bTotal:\s*([\d.]+,\d{2})\s*€/.exec(t);
    const linea = /Revisión de termo\/calentador 1 ([\d.]+,\d{2}) € (\d+) % ([\d.]+,\d{2}) €/.exec(t);
    return { id, seAbre: /Revisión de termo/i.test(t), totalDocumento: m ? m[1] : null, linea: linea ? linea.slice(1) : null };
  };
  const nuevo = await mirar(draftId);
  const viejo = await mirar(BORRADOR_17SEP);
  console.log('PANTALLA nuevo:', JSON.stringify(nuevo));
  console.log('PANTALLA 17-sep (control):', JSON.stringify(viejo));
  R.pantallaConIva = nuevo.seAbre && nuevo.totalDocumento === '387,20' ? 'funciona' : `falla (${JSON.stringify(nuevo)})`;
  R.pantallaDistingue = viejo.seAbre && viejo.totalDocumento === '320,00'
    ? 'funciona (el del 17-sep enseña Total: 320,00)' : `control roto (${JSON.stringify(viejo)})`;
  // La línea es igual en los dos (320,00 € · 21 % · 387,20 €): lo que cambió con 929 es el total.
  R.lineaIgualEnLosDos = JSON.stringify(nuevo.linea) === JSON.stringify(viejo.linea) && nuevo.linea !== null ? 'sí' : 'no';
  fs.writeFileSync(`${DIR}/paso6b.json`, JSON.stringify({ medido: new Date().toISOString(), nuevo, viejo, R }, null, 2));
} finally {
  await nav.close().catch(() => {});
}
console.log('VEREDICTOS paso 6b:', R);

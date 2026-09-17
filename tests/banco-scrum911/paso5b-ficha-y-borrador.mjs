// SCRUM-911 · remedición de los DOS puntos que `paso5-pantalla.mjs` no supo mirar bien.
//
// 🔴 LOS DOS ROJOS ERAN MÍOS, NO DEL PRODUCTO, y por eso se remide en vez de apuntarlos:
//   · «borradorSeAbre: falla» — el borrador SÍ se abrió («Presupuesto #16», TOTAL 320,00 €); lo que
//     falló fue mi aserto, que buscaba el concepto en un recorte de 600 caracteres que no llegaba a
//     la tabla de CONCEPTOS. Un aserto que mira demasiado poco da un rojo que no es de nadie.
//   · la ficha 360 no es `customers-detail`: es `renderAppView('customer-360', { customerId360 })`
//     (app.js:355 y 543). Le pedí una vista que no existe y el router no cambió de pantalla.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BASE, imp, sesionQA } from './_entorno.mjs';

const { lanzarNavegador } = await imp('scripts/_navegador.mjs');
const { draftId } = JSON.parse(fs.readFileSync('./paso4.json', 'utf8'));
const { cookie } = await sesionQA();
const [nombre, ...resto] = cookie.split('=');
const R = {};

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
try {
  const page = await nav.newPage();
  await page.setViewport({ width: 1280, height: 1600 });
  await page.setCookie({ name: nombre, value: resto.join('='), domain: new URL(BASE).hostname, path: '/' });
  await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction('typeof window.renderAppView === "function"', { timeout: 30000 });

  // 1 · EL BORRADOR DEL CICLO, entero.
  await page.evaluate((id) => window.renderAppView('quotes-detail', { quoteId: id }), draftId);
  await page.waitForFunction(() => /CONCEPTOS/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  const b = await page.evaluate(() => {
    const t = document.body.innerText.replace(/\s+/g, ' ');
    const i = t.indexOf('CONCEPTOS');
    return {
      titulo: document.querySelector('#view-title')?.innerText ?? null,
      conceptos: i >= 0 ? t.slice(i, i + 320) : null,
      editable: /Editar|Enviar por WhatsApp/i.test(t),
    };
  });
  console.log('BORRADOR #' + draftId + ':', JSON.stringify(b, null, 2));
  await page.screenshot({ path: './pantalla-borrador.png', fullPage: true });
  R.borradorSeAbre = /Revisión de termo/i.test(b.conceptos ?? '') ? 'funciona' : `falla (${b.conceptos})`;
  R.borradorEsEditablePorElPro = b.editable ? 'funciona' : 'falla';

  // 2 · FICHA 360 del cliente, por su nombre de vista de verdad.
  await page.evaluate(() => window.renderAppView('customer-360', { customerId360: 3927 }));
  await page.waitForFunction(() => /Propuesta de mantenimiento|Historial|Actividad/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  const f = await page.evaluate(() => {
    const t = document.body.innerText.replace(/\s+/g, ' ');
    const i = t.indexOf('Propuesta de mantenimiento');
    return { hay: i >= 0, recorte: i >= 0 ? t.slice(Math.max(0, i - 60), i + 260) : t.slice(0, 400) };
  });
  console.log('FICHA 360:', JSON.stringify(f, null, 2));
  await page.screenshot({ path: './pantalla-ficha.png', fullPage: true });
  R.eventoEnLaFicha = f.hay ? 'funciona' : `falla (${f.recorte.slice(0, 200)})`;
} finally {
  await nav.close().catch(() => {});
}

fs.writeFileSync('./paso5b.json', JSON.stringify({ R }, null, 2));
console.log('VEREDICTOS remedidos:', R);

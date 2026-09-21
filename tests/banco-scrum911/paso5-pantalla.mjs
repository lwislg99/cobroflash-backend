// SCRUM-911 · PASO 0 · tramo 5: QUE SE VEA EN PANTALLA, en el navegador de verdad.
//
// El encargo dice «que se vea en pantalla», y la API contestando 200 no es eso: `buildMaintenanceBlock`
// (quotesDetailView.js:1292) puede devolver `null` y la pantalla quedarse muda con el servidor en verde.
// Solo lee; no pulsa ningún botón que envíe nada.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BASE, imp, sesionQA } from './_entorno.mjs';

const { lanzarNavegador } = await imp('scripts/_navegador.mjs');
const { quoteId, draftId } = JSON.parse(fs.readFileSync('./paso4.json', 'utf8'));
const { cookie } = await sesionQA();
const [nombre, ...resto] = cookie.split('=');
const dominio = new URL(BASE).hostname;
const R = {};

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
try {
  const page = await nav.newPage();
  await page.setViewport({ width: 1280, height: 1400 });
  await page.setCookie({ name: nombre, value: resto.join('='), domain: dominio, path: '/' });
  await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction('typeof window.renderAppView === "function"', { timeout: 30000 });

  // 1 · DETALLE del presupuesto aceptado: el bloque de mantenimiento con el plan vivo.
  await page.evaluate((id) => window.renderAppView('quotes-detail', { quoteId: id }), quoteId);
  await page.waitForFunction(
    () => /mantenimiento/i.test(document.body.innerText),
    { timeout: 20000 },
  ).catch(() => {});
  const detalle = await page.evaluate(() => {
    const txt = document.body.innerText;
    const i = txt.search(/🔧|mantenimiento/i);
    return {
      hayBloque: i >= 0,
      recorte: i >= 0 ? txt.slice(Math.max(0, i - 80), i + 320) : txt.slice(0, 300),
      hayCancelar: !!document.querySelector('#mant-cancel'),
      hayCrear: !!document.querySelector('#mant-create'),
    };
  });
  console.log('DETALLE · bloque de mantenimiento:', JSON.stringify(detalle, null, 2));
  await page.screenshot({ path: './pantalla-detalle.png', fullPage: true });
  R.bloqueEnElDetalle = detalle.hayBloque && (detalle.hayCancelar || detalle.hayCrear) ? 'funciona'
    : `falla (bloque=${detalle.hayBloque} cancelar=${detalle.hayCancelar} crear=${detalle.hayCrear})`;

  // 2 · LISTA de presupuestos: el borrador que creó el ciclo, con el importe que el pro ve.
  await page.evaluate(() => window.renderAppView('quotes-list'));
  await page.waitForFunction(
    (id) => document.body.innerText.includes('#' + id) || document.body.innerText.includes(String(id)),
    { timeout: 20000 },
    16,
  ).catch(() => {});
  const lista = await page.evaluate(() => {
    const filas = Array.from(document.querySelectorAll('tr, [class*="row"], [class*="card"]'))
      .map((e) => e.innerText?.replace(/\s+/g, ' ').trim())
      .filter((t) => t && /Revisión de termo|#16|QA 887 C3-A/i.test(t));
    return filas.slice(0, 6);
  });
  console.log('LISTA · filas que casan con el borrador del ciclo:', JSON.stringify(lista, null, 2));
  await page.screenshot({ path: './pantalla-lista.png', fullPage: true });
  R.borradorEnLaPantalla = lista.some((t) => /320/.test(t)) ? 'funciona (y enseña 320 €)'
    : lista.length ? `se ve, pero sin el importe esperado: ${lista[0]}` : 'falla (no aparece)';

  // 3 · el propio BORRADOR abierto: es editable y el pro decide.
  await page.evaluate((id) => window.renderAppView('quotes-detail', { quoteId: id }), draftId);
  await new Promise((r) => setTimeout(r, 2500));
  const borrador = await page.evaluate(() => ({
    titulo: document.querySelector('#view-title')?.innerText ?? null,
    texto: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600),
  }));
  console.log('BORRADOR en pantalla:', JSON.stringify(borrador, null, 2));
  await page.screenshot({ path: './pantalla-borrador.png', fullPage: true });
  R.borradorSeAbre = /Revisión de termo/i.test(borrador.texto) ? 'funciona' : 'falla';
  R.importeQueVeElPro = /320/.test(borrador.texto) && !/387/.test(borrador.texto)
    ? 'la pantalla enseña 320 € (sin IVA) para una línea de 320 € + 21 %' : `revisar: ${borrador.texto.slice(0, 200)}`;

  // 4 · FICHA 360 del cliente: el evento del ciclo.
  await page.evaluate(() => window.renderAppView('customers-detail', { customerId: 3927 }));
  await new Promise((r) => setTimeout(r, 3000));
  const ficha = await page.evaluate(() => {
    const t = document.body.innerText;
    const i = t.indexOf('Propuesta de mantenimiento');
    return { hay: i >= 0, recorte: i >= 0 ? t.slice(i - 40, i + 220).replace(/\s+/g, ' ') : t.slice(0, 200).replace(/\s+/g, ' ') };
  });
  console.log('FICHA 360:', JSON.stringify(ficha, null, 2));
  await page.screenshot({ path: './pantalla-ficha.png', fullPage: true });
  R.eventoEnLaFicha = ficha.hay ? 'funciona' : `no pude mirar/falla (${ficha.recorte})`;
} finally {
  await nav.close().catch(() => {});
}

fs.writeFileSync('./paso5.json', JSON.stringify({ R }, null, 2));
console.log('VEREDICTOS tramo 5 (pantalla):', R);

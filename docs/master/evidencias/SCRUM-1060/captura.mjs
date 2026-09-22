// SCRUM-1060 · captura a 390px del detalle de un gasto con foto, para el AC 3. UN gasto de
// prueba (creado, capturado, borrado), mismo patron que medir-peso-y-carga.mjs.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
const m = fs.readFileSync('D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt', 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
const pag = await nav.newPage();
let creadoId = null;
try {
  await pag.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await pag.goto(BASE + '/login.html', { waitUntil: 'load' });
  await pag.evaluate(async (secreto) => { await fetch('/auth/test-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa@staging.yaqu', secret: secreto }) }); }, m[1].trim());
  await pag.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2' });
  await pag.waitForSelector('#exp-new-btn', { timeout: 15000 });
  await pag.click('#exp-new-btn');
  await pag.waitForSelector('#exp-receipt', { timeout: 10000 });
  const CONCEPTO = 'QA 1060 captura ' + Date.now();
  await pag.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3264; c.height = 2448;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 3264, 2448); g.addColorStop(0, '#d8cfc0'); g.addColorStop(1, '#8a7f70');
    x.fillStyle = g; x.fillRect(0, 0, 3264, 2448);
    x.fillStyle = '#222'; x.font = '150px sans-serif'; x.fillText('TICKET QA-1060 · 18,00 EUR', 200, 1200);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const file = new File([blob], 'IMG_cap.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer(); dt.items.add(file);
    document.getElementById('exp-receipt').files = dt.files;
  });
  await pag.evaluate((concepto) => { document.getElementById('exp-concept').value = concepto; document.getElementById('exp-amount').value = '18'; }, CONCEPTO);
  await pag.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), { timeout: 5000 }).catch(() => {});
  const boton = await pag.$('#exp-save');
  await boton.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await boton.click();
  await pag.waitForFunction(() => !document.getElementById('exp-modal'), { timeout: 60000 });
  const g = await pag.evaluate(async (concepto) => {
    const r = await (await fetch('/admin/expenses')).json();
    const e = (r.items || []).find((x) => x.concept === concepto);
    return e ? e.id : null;
  }, CONCEPTO);
  creadoId = g;
  await pag.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2' });
  const selectorFila = `.gasto-fila[data-gasto-id="${creadoId}"]`;
  await pag.waitForSelector(selectorFila, { timeout: 15000 });
  await pag.click(selectorFila);
  await pag.waitForSelector('#exp-receipt-section img', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));
  const seccion = await pag.$('#exp-receipt-section');
  await seccion.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await new Promise((r) => setTimeout(r, 200));
  fs.mkdirSync(DIR + '/captura-390', { recursive: true });
  await seccion.screenshot({ path: DIR + '/captura-390/detalle-gasto-390.png' });
  console.log('captura OK, gasto ' + creadoId);
} finally {
  if (creadoId != null) await pag.evaluate(async (id) => { await fetch('/admin/expenses/' + id, { method: 'DELETE' }); }, creadoId);
  await nav.close();
}

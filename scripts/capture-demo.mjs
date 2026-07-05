// scripts/capture-demo.mjs — Barrido visual A6.6 (y reutilizable para QA).
// Conduce el Edge instalado vía CDP (puppeteer-core, sin descargar navegador)
// con viewport MÓVIL REAL (390×844 @2x). Motivo: `msedge --headless --screenshot`
// clampa la ventana a ~500px de ancho, así que las "capturas 390" salían con
// layout de 492px recortado — las media queries de móvil ni se aplicaban.
//
// Uso:
//   CAPTURE_PROFILE=<dir con sesión del dashboard> node scripts/capture-demo.mjs
//   (sin CAPTURE_PROFILE solo captura las páginas públicas)
//
// La sesión del BO se consigue visitando /auth/verify?token=<magic_link> una vez
// con ese mismo perfil (el token se acuña en BD: authSession type 'magic_link').
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PROFILE = process.env.CAPTURE_PROFILE || '';
const BASE = process.env.CAPTURE_BASE || 'https://yaqu.app';
const OUT = process.env.CAPTURE_OUT || 'docs/evidencias/demo-final';

const AUTH_VIEWS = [
  ['01-home', '/dashboard/#home'],
  ['04-quotes-new', '/dashboard/#quotes-new'],
  ['05-quotes-list', '/dashboard/#quotes-list'],
  ['06-customers', '/dashboard/#customers'],
  ['07-products', '/dashboard/#products'],
  ['08-invoices', '/dashboard/#invoices'],
  ['09-reports', '/dashboard/#reports'],
  ['10-quote-requests', '/dashboard/#quote-requests'],
  ['11-expenses', '/dashboard/#expenses'],
  ['12-providers', '/dashboard/#providers'],
  ['13-team', '/dashboard/#team'],
  ['14-settings', '/dashboard/#settings'],
];

// Públicas del cliente final (ids del seed demo; ajustar si se resiembra)
const PUBLIC_VIEWS = [
  ['15-firma-cliente', `/pay/quote/${process.env.QUOTE_ID || 85}`],
  ['16-pay-selector', `/pay/invoice/${process.env.CHARGE_PENDING || 23}`],
  ['17-recibo-celebra', `/recibo/${process.env.CHARGE_PAID || 22}?celebrate=1`],
  ['18-404', '/pagina-que-no-existe'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name, url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
  await sleep(1200); // renders async de las vistas (hashchange) + fuentes
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${name}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  userDataDir: PROFILE || undefined,
  args: ['--disable-gpu', '--hide-scrollbars', '--no-first-run'],
});

fs.mkdirSync(OUT, { recursive: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.setCacheEnabled(false); // el perfil persistente cachea CSS/JS viejos

if (PROFILE) {
  // El dashboard es PWA: su service worker sirve assets VIEJOS aunque el HTTP
  // cache esté apagado → desregistrarlo y vaciar sus caches antes del barrido.
  await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
  await page.evaluate(async () => {
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
      for (const r of regs) await r.unregister();
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    } catch {}
  }).catch(() => {});
  // Documento FRESCO tras el purge (las navegaciones por hash no recargan)
  await page.reload({ waitUntil: 'networkidle2' }).catch(() => {});

  for (const [name, url] of AUTH_VIEWS) await shoot(page, name, url);

  // Extras interactivos de la Home: modal de cotización rápida y panel A6.7
  await page.goto(`${BASE}/dashboard/#home`, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
  await sleep(1200);
  if (await page.$('#btn-quick-quote')) {
    await page.click('#btn-quick-quote');
    await sleep(900);
    await page.screenshot({ path: path.join(OUT, '02-quick-quote-modal.png'), fullPage: false });
    console.log('02-quick-quote-modal  ok');
    await page.keyboard.press('Escape');
    await sleep(400);
  }
  if (await page.$('#btn-home-prefs')) {
    await page.click('#btn-home-prefs');
    await sleep(600);
    await page.screenshot({ path: path.join(OUT, '03-home-personalizar.png'), fullPage: false });
    console.log('03-home-personalizar  ok');
    await page.keyboard.press('Escape');
  }
}

for (const [name, url] of PUBLIC_VIEWS) await shoot(page, name, url);

await browser.close();
console.log('DONE');

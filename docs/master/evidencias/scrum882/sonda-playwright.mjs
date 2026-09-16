// Conductor: node .qa882/pw.mjs <movil|escritorio> <pasos.mjs>  — el perfil persiste entre llamadas.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/x.js');
const { chromium } = require('playwright-core');
const modo = process.argv[2];
const pasos = (await import(pathToFileURL(path.resolve(process.argv[3])).href)).default;
const esMovil = modo === 'movil' || modo === 'cliente';
const vp = esMovil ? { width: 390, height: 844 } : { width: 1366, height: 860 };
const ctx = await chromium.launchPersistentContext('C:/Users/Admin/AppData/Local/Temp/claude/d--MILLONARIO-cobroFlash-cobroflash-backend/7eb1e714-5bde-4d65-b655-e80431304183/scratchpad/perfil-' + modo, {
  executablePath: 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe', headless: true, viewport: vp, deviceScaleFactor: 1, isMobile: esMovil, hasTouch: esMovil, locale: 'es-ES', timezoneId: 'Europe/Madrid',
});
const page = ctx.pages()[0] || (await ctx.newPage());
const errores = [];
page.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => errores.push('pageerror: ' + String(e.message).slice(0, 200)));
page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('railway.app')) errores.push(r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^https:\/\/[^/]+/, '')); });
const BASE = 'https://yaqu-staging-production.up.railway.app';
let n = 0;
const shot = async (nombre, full = false) => {
  const f = `.qa882/shots/${modo}-${nombre}.png`;
  await page.screenshot({ path: f, fullPage: full });
  console.log('📸 ' + f);
};
const texto = async (sel = 'body') => (await page.locator(sel).first().innerText().catch(() => '')).replace(/\n{2,}/g, '\n').slice(0, 2500);
const medir = () => page.evaluate(() => ({ w: innerWidth, movil: matchMedia('(max-width:768px)').matches, scrollX: document.documentElement.scrollWidth > innerWidth, hash: location.hash }));
try {
  await pasos({ page, ctx, shot, texto, medir, BASE, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
} catch (e) {
  console.log('❌ PASO FALLÓ: ' + String(e.message).split('\n')[0]);
  await shot('fallo-' + Date.now()).catch(() => {});
} finally {
  if (errores.length) console.log('ERRORES:\n  ' + [...new Set(errores)].join('\n  '));
  await ctx.close();
}

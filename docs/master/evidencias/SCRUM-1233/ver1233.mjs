// SCRUM-1233 · ver en yaqu.app que Trabajos y la firma del parte ya no enseñan la tripa del servidor.
// Nada que no sea GET sale a la red: los PATCH/POST del caso se contestan EN EL NAVEGADOR y
// cualquier otro no-GET se ABORTA y se apunta. La pantalla, la vista y apiRequest son las de producción.
// Uso: node ver1233.mjs <carpeta de salida>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright-core');
const OUT = process.argv[2];
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().replace(/^pf_session=/, '').split(';')[0];
const FRASE = 'Frase de prueba escrita para una persona.';

async function abrir(browser, manejar) {
  // 🔴 serviceWorkers:'block' — sin esto, en cuanto el SW de la casa toma la página, sus fetch NO
  // pasan por page.route y una escritura sale al servidor de verdad (medido: la 1.ª versión de este
  // banco dejó salir un PATCH /admin/jobs/77 con cuerpo `{}`; el trabajo quedó igual, releído).
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'pf_session', value: cookie, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  const page = await ctx.newPage();
  const cuenta = { contestadas: [], abortadas: [] };
  await page.route('**/*', async (route) => {
    const r = route.request();
    const m = r.method(); const u = new URL(r.url());
    const h = manejar(m, u.pathname);
    if (h) { cuenta.contestadas.push(`${m} ${u.pathname} → ${h.status === 0 ? 'abort' : h.status}`);
      if (h.status === 0) return route.abort('internetdisconnected');
      return route.fulfill({ status: h.status, contentType: 'application/json', body: JSON.stringify(h.body) }); }
    if (m === 'GET') return route.continue();
    cuenta.abortadas.push(`${m} ${u.pathname}`);
    return route.abort();
  });
  return { ctx, page, cuenta };
}
const toasts = (page) => page.$$eval('[data-msg]', (ns) => ns.map((n) => ({ kind: n.dataset.kind, msg: n.dataset.msg, visible: n.textContent.trim() })));

// ── Trabajos: «Agendar» del Trabajo #77 → PATCH /admin/jobs/77 con la respuesta que toque ─────────
async function trabajos(browser, nombre, resp) {
  const { ctx, page, cuenta } = await abrir(browser, (m, p) => (m === 'PATCH' && p === '/admin/jobs/77' ? resp : null));
  await page.goto('https://yaqu.app/dashboard/#jobs', { waitUntil: 'networkidle' });
  // La fila del #77 no enseña su título derivado: se reconoce por su importe (1,21 €), el único.
  const fila = page.locator('tr.jobs-fila', { hasText: '1,21 €' });
  await fila.first().waitFor({ timeout: 15000 });
  await fila.first().locator('button', { hasText: /^Agendar$/ }).click();
  await page.fill('#jobs-agendar-fecha', '2026-12-01T10:00');
  // El modal se cuelga al final del documento: su «Agendar» es el último de la página.
  await page.locator('button', { hasText: /^Agendar$/ }).last().click();
  await page.waitForTimeout(1500);
  const r = { caso: nombre, toasts: await toasts(page), ...cuenta };
  await page.screenshot({ path: `${OUT}/1233-${nombre}.png` });
  // CONTROL DEL INSTRUMENTO: lo que valía `err.message` ante ESA respuesta (lo que se pintaba antes).
  r.errMessageCrudo = await page.evaluate(async () => {
    try { await apiRequest('/admin/jobs/77', { method: 'PATCH', body: '{}' }); return 'NO LANZÓ'; }
    catch (e) { return e && e.message; }
  });
  await ctx.close();
  return r;
}

// ── Parte #9 (borrador, 1 línea): firma del cliente → POST /admin/partes/9/firmar rechazado ─────
async function parte(browser, nombre, resp) {
  const { ctx, page, cuenta } = await abrir(browser, (m, p) => (m === 'POST' && p === '/admin/partes/9/firmar' ? resp : null));
  await page.goto('https://yaqu.app/dashboard/#parte-detail/9', { waitUntil: 'networkidle' });
  await page.locator('[data-parte-firmar]').first().click({ timeout: 15000 });
  const canvas = page.locator('canvas').last();
  await canvas.waitFor({ timeout: 10000 });
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + 20, b.y + b.height / 2); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 20 + i * 15, b.y + b.height / 2 + (i % 2 ? 15 : -15));
  await page.mouse.up();
  await page.fill('#sp-nombre', 'Cliente de pruebas QA');
  await page.locator('button', { hasText: 'Confirmar firma' }).click();
  await page.waitForTimeout(2500);
  const r = { caso: nombre, avisoDelPad: await page.locator('[data-sp-aviso]').allTextContents(),
    botonDelPad: await page.locator('button', { hasText: /Reintentar|Confirmar firma|Guardando/ }).allTextContents(), ...cuenta };
  await page.screenshot({ path: `${OUT}/1233-${nombre}.png` });
  await ctx.close();
  return r;
}

// ── CONTROL: Albaranes, que ya lo hacía bien, ante el mismo 500 (GET contestado en el navegador) ──
async function albaranes(browser, nombre, resp) {
  const { ctx, page, cuenta } = await abrir(browser, (m, p) => (m === 'GET' && p === '/admin/albaranes' ? resp : null));
  await page.goto('https://yaqu.app/dashboard/#albaranes', { waitUntil: 'networkidle' });
  await page.locator('.alert.error').first().waitFor({ timeout: 15000 });
  const r = { caso: nombre, aviso: await page.locator('.alert.error').allTextContents(),
    detalle: await page.locator('.alert.error + p').allTextContents(), ...cuenta };
  await page.screenshot({ path: `${OUT}/1233-${nombre}.png` });
  await ctx.close();
  return r;
}

const browser = await chromium.launch();
try {
  const casos = [
    () => trabajos(browser, 'trabajos-500-sin-frase', { status: 500, body: { error: 'internal_error' } }),
    () => trabajos(browser, 'trabajos-400-con-frase', { status: 400, body: { error: 'x', message: FRASE } }),
    () => trabajos(browser, 'trabajos-sin-red', { status: 0 }),
    () => parte(browser, 'parte-400-firma-invalida', { status: 400, body: { error: 'firma_invalida' } }),
    () => parte(browser, 'parte-400-con-frase', { status: 400, body: { error: 'firma_invalida', message: FRASE } }),
    () => albaranes(browser, 'albaranes-500-sin-frase', { status: 500, body: { error: 'internal_error' } }),
    () => albaranes(browser, 'albaranes-500-con-frase', { status: 500, body: { error: 'internal_error', message: FRASE } }),
  ];
  for (const c of casos) {
    try { console.log(JSON.stringify(await c())); } catch (e) { console.log(JSON.stringify({ CASO_CIEGO: String(e && e.message).slice(0, 300) })); }
  }
} finally { await browser.close(); }

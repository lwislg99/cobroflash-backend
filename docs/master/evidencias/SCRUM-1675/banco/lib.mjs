// Banco SCRUM-1675 · playwright-core directo contra https://yaqu.app con la sesión QA (patrón de
// SCRUM-1658/banco/lib.mjs). La cookie se lee de fuera del repo y NUNCA se imprime.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.LOCALAPPDATA + '/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const { chromium } = require(PW);
const EXE = process.env.LOCALAPPDATA + '/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe';

function cookieValor() {
  const c = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim();
  const m = c.match(/pf_session=([^;\s]+)/);
  return m ? m[1] : c;
}

export async function abrir(ancho = 390, alto = 844) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const movil = ancho < 600;
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1,
    isMobile: movil, hasTouch: movil, serviceWorkers: 'block', locale: 'es-ES', timezoneId: 'Europe/Madrid',
  });
  await ctx.addCookies([{ name: 'pf_session', value: cookieValor(), domain: 'yaqu.app', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const page = await ctx.newPage();
  const log = [];
  page.on('pageerror', (e) => log.push(`[pageerror] ${String(e).slice(0, 300)}`));
  page.on('response', (r) => { const u = r.url(); if (u.includes('yaqu.app/admin') && r.status() >= 400) log.push(`[http ${r.status()}] ${r.request().method()} ${u.replace('https://yaqu.app', '')}`); });
  return { browser, ctx, page, log };
}

// Banco SCRUM-1658 · playwright-core directo contra https://yaqu.app con la sesión QA.
// La cookie se lee de fuera del repo y NUNCA se imprime.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.LOCALAPPDATA + '/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const { chromium } = require(PW);
const EXE = process.env.LOCALAPPDATA + '/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe';
export const OUT = process.env.BANCO_OUT || (process.env.CLAUDE_JOB_DIR + '/tmp/capturas');
fs.mkdirSync(OUT, { recursive: true });

function cookieValor() {
  let c = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim();
  const m = c.match(/pf_session=([^;\s]+)/);
  return m ? m[1] : c;
}

export async function abrir(ancho = 390, alto = 844) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const movil = ancho < 600;
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: movil ? 2 : 1,
    isMobile: movil, hasTouch: movil,
    serviceWorkers: 'block', locale: 'es-ES', timezoneId: 'Europe/Madrid',
  });
  await ctx.addCookies([{ name: 'pf_session', value: cookieValor(), domain: 'yaqu.app', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const page = await ctx.newPage();
  const log = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => log.push(`[pageerror] ${String(e).slice(0, 300)}`));
  page.on('response', (r) => { const u = r.url(); if (u.includes('yaqu.app/admin') && r.status() >= 400) log.push(`[http ${r.status()}] ${r.request().method()} ${u.replace('https://yaqu.app', '')}`); });
  return { browser, ctx, page, log, ancho };
}

export async function ir(page, hash) {
  await page.goto('https://yaqu.app/dashboard/' + hash, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
}

export async function foto(s, nombre, full = true) {
  const f = path.join(OUT, `${nombre}-${s.ancho}.png`);
  await s.page.screenshot({ path: f, fullPage: full });
  return f;
}

// Lista de lo visible y pulsable + rótulos, para saber qué hay sin leer el código.
export async function inventario(page, raiz = 'body') {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel) || document.body;
    const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const out = [];
    r.querySelectorAll('button, a[href], input, select, textarea, [role=button], summary').forEach((el) => {
      if (!vis(el)) return;
      const b = el.getBoundingClientRect();
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      out.push(`${el.tagName.toLowerCase()}${el.type ? '[' + el.type + ']' : ''} «${txt}» ${Math.round(b.width)}x${Math.round(b.height)} @${Math.round(b.x)},${Math.round(b.y)}${el.disabled ? ' DISABLED' : ''}`);
    });
    return out;
  }, raiz);
}

export async function desbordes(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth; const res = [];
    if (document.documentElement.scrollWidth > W + 1) res.push(`scroll horizontal de página: ${document.documentElement.scrollWidth} > ${W}`);
    document.querySelectorAll('body *').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.right > W + 2 && getComputedStyle(el).position !== 'fixed') {
        let p = el.parentElement, clip = false;
        while (p) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll') { clip = true; break; } p = p.parentElement; }
        if (!clip) res.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)} right=${Math.round(b.right)}`);
      }
    });
    return res.slice(0, 12);
  });
}

// Táctil < 44 px (AB6) entre lo pulsable visible.
export async function pequenos(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=button]').forEach((el) => {
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (b.width === 0 || cs.visibility === 'hidden' || cs.display === 'none') return;
      if (b.height < 44 || b.width < 44) out.push(`${el.tagName.toLowerCase()} «${(el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 30)}» ${Math.round(b.width)}x${Math.round(b.height)}`);
    });
    return out;
  });
}

export function guardar(nombre, datos) {
  fs.writeFileSync(path.join(OUT, nombre), typeof datos === 'string' ? datos : JSON.stringify(datos, null, 2));
}

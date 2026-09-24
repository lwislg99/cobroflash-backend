// SCRUM-920d · SONDA de SOLO LECTURA en staging: que hay FIJO (position: fixed) a 390×844 en Gastos y si algo se
// solapa con la barra de «Nuevo gasto». Nace del recorrido de staging: en la captura el boton redondo «?» de ayuda
// se dibuja encima del borde derecho de la barra. Aqui se MIDE (rectangulos) en vez de mirar la captura.
// Uso: node docs/master/evidencias/scrum920/sonda-flotantes-staging.mjs
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { abrirNavegador } from '../../../../scripts/_banco-lista.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging'); process.exit(2); }
const m = fs.readFileSync('D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt', 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('sin clave de login'); process.exit(2); }
const login = await fetch(BASE + '/auth/test-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa@staging.yaqu', secret: m[1].trim() }) });
const sesion = /pf_session=([^;]+)/.exec(login.headers.getSetCookie().join(';'));
if (login.status !== 200 || !sesion) { console.log('login ' + login.status + ' sin sesion'); process.exit(1); }

const { browser, quien } = await abrirNavegador(puppeteer);
console.log('TESTIGO · fijos en Gastos a 390×844 · ' + quien);
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.setCookie({ name: 'pf_session', value: sesion[1], domain: new URL(BASE).hostname, path: '/', httpOnly: true, secure: true });
await page.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForSelector('#exp-list .gasto-fila', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 800));

const r = await page.evaluate(() => {
  const rect = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const fijos = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; })
    .map((e) => ({ tag: e.tagName.toLowerCase(), id: e.id || '', clase: (e.className && e.className.baseVal === undefined ? e.className : '').toString().slice(0, 60), aria: e.getAttribute('aria-label') || '', texto: (e.textContent || '').trim().slice(0, 24), z: getComputedStyle(e).zIndex, ...rect(e) }));
  const btn = document.querySelector('#exp-new-btn');
  const barra = btn && (btn.closest('.gastos-barra') || btn);
  return { fijos, barra: barra ? rect(barra) : null, boton: btn ? rect(btn) : null };
});
for (const f of r.fijos) console.log(`   fijo · <${f.tag}${f.id ? ' #' + f.id : ''}${f.clase ? ' .' + f.clase.trim().replace(/\s+/g, '.') : ''}> aria="${f.aria}" texto="${f.texto}" z=${f.z} · x ${f.x}-${f.r} · y ${f.y}-${f.b} (${f.w}×${f.h})`);
console.log('   barra de «Nuevo gasto»: ' + JSON.stringify(r.barra) + ' · boton: ' + JSON.stringify(r.boton));
const solapa = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));
const otros = r.fijos.filter((f) => r.barra && !(f.x === r.barra.x && f.y === r.barra.y && f.w === r.barra.w && f.h === r.barra.h) && f.id !== 'exp-new-btn');
let malas = 0;
for (const f of otros) {
  const conBoton = solapa(f, r.boton);
  const conBarra = solapa(f, r.barra);
  const etiqueta = `<${f.tag}${f.id ? ' #' + f.id : ''}> aria="${f.aria}"`;
  if (conBoton > 0) { malas++; console.log(`   🔴 ${etiqueta} tapa ${conBoton} px² del BOTON «Nuevo gasto» (z=${f.z})`); }
  else if (conBarra > 0) { console.log(`   🟠 ${etiqueta} se solapa ${conBarra} px² con la BARRA pero no con el boton (z=${f.z})`); }
}
if (!otros.length) console.log('   (nada mas fijo en pantalla)');
console.log('población: ' + r.fijos.length + ' elementos fijos visibles · ' + otros.length + ' distintos de la barra');
await browser.close();
console.log('EXIT=' + (malas ? 1 : 0));
process.exit(malas ? 1 : 0);

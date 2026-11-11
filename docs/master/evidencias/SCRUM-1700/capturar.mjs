// Captura SCRUM-1700: yaqu.app con la sesión QA, pero jobsView.js y app.js servidos desde el árbol.
// Sólo lectura: toda petición que no sea GET se aborta (no se pulsa nada que escriba).
import fs from 'node:fs';
import { abrir, ir, foto } from 'file:///D:/MILLONARIO/cobroFlash/cobroflash-backend/.claude/worktrees/s4-11nov-t7/docs/master/evidencias/SCRUM-1658/banco/lib.mjs';
const ARBOL = 'D:/MILLONARIO/cobroFlash/cobroflash-backend/.claude/worktrees/s4-11nov-t7/public/dashboard/js/';
const lado = process.argv[2] || 'despues';
const ancho = Number(process.argv[3] || 390);
const s = await abrir(ancho, 844);
const bloqueadas = [];
try {
  await s.ctx.route('**/*', (route) => {
    const r = route.request();
    const permitido = process.argv[4] === 'clic' && r.method() === 'POST' && /\/admin\/partes$/.test(r.url());
    if (r.method() !== 'GET' && !permitido) { bloqueadas.push(r.method() + ' ' + r.url()); return route.abort(); }
    const m = r.url().match(/\/dashboard\/js\/(jobsView|app)\.js(\?|$)/);
    if (lado === 'despues' && m) return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: fs.readFileSync(ARBOL + m[1] + '.js', 'utf8') });
    return route.continue();
  });
  await ir(s.page, '#jobs');
  await s.page.waitForTimeout(2500);
  const r = await s.page.evaluate(() => {
    const lab = document.getElementById('nav-partes-oficina-label');
    const filas = [...document.querySelectorAll('tr.jobs-fila')].map((tr) => {
      const t = tr.innerText.replace(/\s+/g, ' ').slice(0, 70);
      const bs = [...tr.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => `«${b.innerText.trim()}» ${b.className} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
      return t + ' || ' + bs.join(' | ');
    });
    const cab = [...document.querySelectorAll('#jobs-nuevo button')].map((b) => b.innerText.trim());
    return { menu: lab ? lab.textContent : null, cabecera: cab, filas, anchoDoc: document.documentElement.scrollWidth };
  });
  console.log(JSON.stringify(r, null, 1));
  console.log(await foto(s, `c1700-${lado}-lista`));
  // El menú abierto (móvil): el botón de hamburguesa.
  const hamb = s.page.locator('#menu-toggle, .menu-toggle, button[aria-label*="menú" i]').first();
  if (process.argv[4] !== 'clic' && await hamb.count()) { await hamb.click(); await s.page.waitForTimeout(600); console.log(await foto(s, `c1700-${lado}-menu`, false)); }
  if (process.argv[4] === 'clic') {
        await s.page.getByRole('button', { name: 'Abrir parte' }).first().click(); await s.page.waitForTimeout(3000);
    console.log('tras el clic:', s.page.url(), JSON.stringify(await s.page.evaluate(() => ({ titulo: (document.getElementById('view-title') || {}).textContent, h3: (document.querySelector('h3') || {}).innerText }))));
    console.log(await foto(s, 'c1700-despues-parte', false));
  }
  console.log('bloqueadas:', bloqueadas.length ? bloqueadas.join(' ; ') : 'ninguna');
  if (s.log.length) console.log('log:', s.log.join('\n'));
} finally { await s.browser.close(); }

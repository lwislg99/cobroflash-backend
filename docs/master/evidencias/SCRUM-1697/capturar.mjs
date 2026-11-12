// Captura SCRUM-1697: yaqu.app con la sesión QA; en «despues», parteDetailView.js servido desde el árbol.
// Sólo lectura, salvo con el argumento «crear»: entonces se deja pasar UN POST /admin/partes para abrir la
// segunda visita del trabajo QA (QA en producción autorizado) si el trabajo tiene menos de dos partes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir, ir, foto } from '../SCRUM-1658/banco/lib.mjs';
const ARBOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../public/dashboard/js/');
const lado = process.argv[2] || 'despues';
const crear = process.argv[3] === 'crear';
const JOB = 77;
const s = await abrir(390, 844);
const bloqueadas = [];
try {
  await s.ctx.route('**/*', (route) => {
    const r = route.request();
    const permitido = crear && r.method() === 'POST' && /\/admin\/partes$/.test(r.url());
    if (r.method() !== 'GET' && !permitido) { bloqueadas.push(r.method() + ' ' + r.url()); return route.abort(); }
    if (lado === 'despues' && /\/dashboard\/js\/parteDetailView\.js(\?|$)/.test(r.url())) {
      return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: fs.readFileSync(path.join(ARBOL, 'parteDetailView.js'), 'utf8') });
    }
    return route.continue();
  });
  await ir(s.page, '#jobs');
  await s.page.waitForTimeout(2000);
  const partes = await s.page.evaluate(async ({ job, crear }) => {
    const leer = async () => ((await (await fetch('/admin/jobs/' + job, { credentials: 'include' })).json()).partes || []);
    let ps = await leer();
    if (crear && ps.length < 2) {
      await fetch('/admin/partes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job }) });
      ps = await leer();
    }
    return ps;
  }, { job: JOB, crear });
  console.log('partes del trabajo', JOB, JSON.stringify(partes));
  for (const p of partes) {
    await s.page.evaluate((id) => window.renderAppView && window.renderAppView('parte-detail', { parteId: id }), p.id);
    await s.page.waitForTimeout(2500);
    const cab = await s.page.evaluate(() => { const h = document.querySelector('h3'); return h ? h.innerText.replace(/\s+/g, ' ').trim() : null; });
    console.log(p.id, p.numero, p.estado, '→ cabecera:', JSON.stringify(cab));
    console.log(await foto(s, `c1697-${lado}-${p.numero}`, false));
  }
  console.log('bloqueadas:', bloqueadas.length ? bloqueadas.join(' ; ') : 'ninguna');
  if (s.log.length) console.log('log:', s.log.join('\n'));
} finally { await s.browser.close(); }

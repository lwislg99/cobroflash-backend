// SCRUM-1725 (FICHA, S2 · 18-nov) · capturas antes/después de la ficha del Trabajo en yaqu.app.
//   node prod-1725-ficha-visual.mjs <carpeta> [antes|despues]
//   LOCAL_DIR=<raíz del worktree> → sirve SU jobDetailView.js y SU styles.css (vista previa sin merge).
// Sólo GET (comun.mjs corta todo lo demás, con control positivo). Dos papeles por ancho (390, 1280):
//   · ADMIN REAL (cuenta QA): control.
//   · OPERARIO SIMULADO, DECLARADO: /admin/me → userRole 'tecnico'; GET /admin/jobs[/:id] pasan por la
//     MISMA proyección que el servidor aplica al operario (copia de trabajoParaElRol.ts @ origin/main
//     bcff9d8b1: notes/cobro vacíos, invoices [], charge null). Mide CÓMO PINTA EL FRONT lo que el servidor
//     le manda; que el servidor lo recorte con una sesión real lo vigila tests/scrum1707-*.
// Por cada ficha guarda: captura de página entera, desborde horizontal, cajas que se salen del viewport,
// y la HUELLA de función: el texto visible de la ficha y la lista de botones/enlaces. Esta tanda es FORMA:
// la huella de «despues» debe ser IDÉNTICA a la de «antes» (control: cifras, rótulos y acciones intactos).
import { abrir } from './comun.mjs'; // copia en git de sondas-s2/comun.mjs: abre el contexto con serviceWorkers: 'block' (guard SCRUM-1233g)
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const [OUT, FASE = 'antes'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

function trabajoOp(t) {
  const out = { ...t, notes: null, totalCobrado: null, estadoCobro: null, remaining: null, nextStage: null, pendingStagesCount: 0, hasCustomPlan: false, invoices: [] };
  if ('charge' in t) out.charge = null;
  return out;
}

const servir = {};
if (process.env.LOCAL_DIR) {
  servir['/dashboard/js/jobDetailView.js'] = path.join(process.env.LOCAL_DIR, 'public/dashboard/js/jobDetailView.js');
  servir['/dashboard/css/styles.css'] = path.join(process.env.LOCAL_DIR, 'public/dashboard/css/styles.css');
}

async function pasada(w, simular, ids) {
  const { browser, page, noGet, errores, build } = await abrir({ servir, viewport: { width: w, height: 900 } });
  const reescritas = { me: 0, jobs: 0 };
  await page.route('**/admin/me', async (route) => {
    const r = await route.fetch(); const j = await r.json();
    if (simular) reescritas.me++;
    return route.fulfill({ response: r, json: simular ? { ...j, userRole: 'tecnico', isOwner: false } : j });
  });
  if (simular) {
    await page.route(/\/admin\/jobs(\/\d+)?(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') return route.abort();
      const r = await route.fetch(); const j = await r.json();
      reescritas.jobs++;
      return route.fulfill({ response: r, json: Array.isArray(j) ? j.map(trabajoOp) : (j && j.id ? trabajoOp(j) : j) });
    });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.renderAppView === 'function', null, { timeout: 20000 });
  const quien = simular ? 'operario' : 'admin';
  const filas = [];
  for (const id of ids) {
    await page.evaluate((i) => window.renderAppView('jobs-detail', { jobId: i }), id);
    await page.waitForSelector('.detail-head-acciones', { state: 'attached', timeout: 20000 });
    await page.waitForTimeout(2200);
    const m = await page.evaluate(() => {
      const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const pag = document.querySelector('.detail-page');
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      const vw = document.documentElement.clientWidth;
      const fuera = [...(pag ? pag.querySelectorAll('*') : [])].filter(vis)
        .filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; })
        .filter((el) => !el.closest('.table-scroll'))
        .slice(0, 8).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(el.getBoundingClientRect().right)}`);
      const acciones = [...(pag ? pag.querySelectorAll('button, a') : [])].filter(vis)
        .map((b) => t(b.textContent) || b.getAttribute('aria-label') || '?');
      const primarias = [...(pag ? pag.querySelectorAll('.btn-primary') : [])].filter(vis).map((b) => t(b.textContent));
      const textoFicha = pag ? t(pag.innerText) : '';
      const altoMenor44 = [...(pag ? pag.querySelectorAll('button, a.btn, summary') : [])].filter(vis)
        .filter((b) => !b.classList.contains('btn-sm') && b.getBoundingClientRect().height < 43.5 && window.innerWidth <= 640)
        .map((b) => `${t(b.textContent).slice(0, 30)} ${Math.round(b.getBoundingClientRect().height)}`);
      return {
        rol: window.appUserRole,
        desbordeX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fuera, primarias, altoMenor44,
        acciones, textoFicha,
        euros: (textoFicha.match(/\d[\d.]*,\d{2}\s?€/g) || []),
        alto: Math.round(document.documentElement.scrollHeight),
      };
    });
    await page.screenshot({ path: path.join(OUT, `${FASE}-ficha-${id}-${quien}-${w}.png`), fullPage: true });
    filas.push({ id, ...m });
  }
  await browser.close();
  return { w, quien, fase: FASE, build, local: !!process.env.LOCAL_DIR, reescritas, filas, noGet: noGet.map((x) => `${x.metodo} ${x.ruta} ${x.hecho}`), errores };
}

// Elección de fichas: JOBS=1,2,3 o, si no, la más rica (más partes+albaranes, con tarea si la hay) y la más pobre.
let ids = (process.env.JOBS || '').split(',').map(Number).filter(Boolean);
if (!ids.length) {
  const { browser, page } = await abrir({});
  ids = await page.evaluate(async () => {
    const r = await window.apiRequest('/admin/jobs');
    const l = (Array.isArray(r) ? r : (r.jobs || r.items || [])).slice(0, 14);
    const det = [];
    for (const j of l) {
      try {
        const d = await window.apiRequest(`/admin/jobs/${j.id}`);
        det.push({ id: j.id, peso: (d.albaranes || []).length + (d.partes || []).length + (d.queHayQueHacer ? 3 : 0) + (d.direccion ? 1 : 0) });
      } catch { /* sin acceso: no se elige */ }
    }
    det.sort((a, b) => b.peso - a.peso);
    return det.length > 1 ? [det[0].id, det[det.length - 1].id] : det.map((d) => d.id);
  });
  await browser.close();
}
const salida = [];
for (const w of [390, 1280]) for (const s of [true, false]) salida.push(await pasada(w, s, ids));
writeFileSync(path.join(OUT, `${FASE}.json`), JSON.stringify({ ids, salida }, null, 1));
for (const p of salida) {
  console.log(JSON.stringify({ w: p.w, quien: p.quien, fase: p.fase, build: p.build, local: p.local, reescritas: p.reescritas, noGet: p.noGet, errores: p.errores,
    filas: p.filas.map((f) => ({ id: f.id, rol: f.rol, desbordeX: f.desbordeX, fuera: f.fuera, primarias: f.primarias, altoMenor44: f.altoMenor44, euros: f.euros.length, acciones: f.acciones.length, alto: f.alto })) }));
}

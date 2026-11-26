// r42 en vivo (S2, 25-nov-2026 tarde) · SCRUM-1808b sobre https://yaqu.app con la cuenta QA.
// Uso: node r42-1808b-v2.mjs <dirSalida>
// Derivada de la sonda de la antecesora (jobs/62792a25/tmp/r42-ficha-trabajo.mjs). Novedades:
//  · graba MÉTODO, RUTA y CUERPO de cada no-GET interceptado (el POST de cancelar NO llega a prod);
//  · caso «pagado»: el cancel interceptado contesta 409 {error:'document_already_paid'} y se mide el literal;
//  · control positivo: una factura SIN cobro pending (estadoDelCobro null) NO debe pintar el botón.
// Lectura REAL de GET /admin/jobs/:id + factura de prueba inyectada (la cuenta QA va en modo recibo).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [salida] = process.argv.slice(2);
const RAIZ_REPO = 'D:/MILLONARIO/cobroFlash/cobroflash-backend';
const WT = path.join(RAIZ_REPO, '.claude/worktrees/scrum-1834-error-visible-390');
const requiere = createRequire(path.join(RAIZ_REPO, 'node_modules/'));
const puppeteer = requiere('puppeteer-core');
const { abrirNavegador } = await import(pathToFileURL(path.join(WT, 'scripts/_banco-lista.mjs')).href);

const BASE = 'https://yaqu.app';
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim();
const [cNombre, ...cResto] = cookie.split('=');
const cValor = cResto.join('=');
fs.mkdirSync(salida, { recursive: true });

const LIT = {
  boton: 'Cancelar cobro',
  confirma: '¿Cancelar este cobro? El cliente ya no podrá pagarlo con este enlace.',
  pill: 'Cobro cancelado',
  pagado: 'Este documento ya consta como pagado: su cobro no se puede cancelar.',
};

const leer = async (ruta) => {
  const r = await fetch(BASE + ruta, { headers: { cookie, accept: 'application/json' } });
  if (!r.ok) throw new Error(`GET ${ruta} → ${r.status}`);
  return r.json();
};
const lista = await leer('/admin/jobs');
const trabajos = Array.isArray(lista) ? lista : (lista.jobs || lista.items || lista.data || []);
const job0 = trabajos[0];
if (!job0) { console.log('🔴 NO SUPE MIRAR: la cuenta QA no tiene trabajos'); process.exit(2); }
const JOB_ID = job0.id;
const real = await leer(`/admin/jobs/${JOB_ID}`);

const factura = (estadoDelCobro) => ({ id: 990808, number: 'F-QA-R42-1808', status: 'pending', type: 'F1', total: 121, currency: 'EUR',
  createdAt: '2026-11-25T08:00:00.000Z', paidAt: null, chargeId: 990077, payToken: 'tok-qa-r42', stageLabel: null,
  rectifiesId: null, envioDocumento: null, conIvaAlDiez: false, metodosConAvisoIvaAlDiez: ['cash'], estadoDelCobro });

const CASOS = [
  { nombre: 'ok', ancho: 390, alto: 844, inicial: 'pending', respuesta: { status: 200, body: { ok: true, status: 'cancelled' } } },
  { nombre: 'ok', ancho: 1280, alto: 900, inicial: 'pending', respuesta: { status: 200, body: { ok: true, status: 'cancelled' } } },
  { nombre: 'pagado', ancho: 390, alto: 844, inicial: 'pending', respuesta: { status: 409, body: { error: 'document_already_paid' } } },
  { nombre: 'pagado', ancho: 1280, alto: 900, inicial: 'pending', respuesta: { status: 409, body: { error: 'document_already_paid' } } },
  { nombre: 'control-sin-pending', ancho: 390, alto: 844, inicial: null, respuesta: null },
];

const resultados = [];
const { browser } = await abrirNavegador(puppeteer);
try {
  for (const caso of CASOS) {
    const page = await browser.newPage();
    await page.setViewport({ width: caso.ancho, height: caso.alto });
    await page.setCookie({ name: cNombre, value: cValor, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true });
    let lecturas = 0;
    let estadoServido = caso.inicial;
    const escrituras = [];
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      const enYaqu = u.startsWith(BASE);
      const m = req.method();
      if (enYaqu && m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
        escrituras.push({ metodo: m, ruta: u.slice(BASE.length), cuerpo: req.postData() ?? null });
        const esCancel = /\/admin\/charges\/\d+\/cancel$/.test(u);
        const resp = esCancel && caso.respuesta ? caso.respuesta : { status: 200, body: { ok: true } };
        if (esCancel && resp.status === 200) estadoServido = 'cancelled';
        return req.respond({ status: resp.status, contentType: 'application/json', body: JSON.stringify(resp.body) });
      }
      if (enYaqu && m === 'GET' && new RegExp(`/admin/jobs/${JOB_ID}(\\?|$)`).test(u)) {
        lecturas++;
        const cuerpo = { ...real, invoices: [factura(estadoServido), ...(real.invoices || [])] };
        return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
      }
      return req.continue();
    });
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e.message || e)));
    await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => { window.__preguntas = []; window.confirm = (m) => { window.__preguntas.push(String(m)); return true; }; window.prompt = (m) => { window.__preguntas.push(String(m)); return null; }; });
    await page.evaluate((id) => window.renderAppView('jobs-detail', { jobId: id }), JOB_ID);
    const hayTab = await page.waitForFunction("[...document.querySelectorAll('#view-container button, #view-container [role=\"tab\"]')].some((b) => b.textContent.trim() === 'Facturas')", { timeout: 30000 }).then(() => true, () => false);
    if (!hayTab) { await page.screenshot({ path: path.join(salida, `diag-${caso.nombre}-${caso.ancho}.png`) }); resultados.push({ caso: caso.nombre, ancho: caso.ancho, CIEGO: 'sin pestaña Facturas', lecturas }); await page.close(); continue; }
    await page.evaluate("[...document.querySelectorAll('#view-container button, #view-container [role=\"tab\"]')].find((b) => b.textContent.trim() === 'Facturas').click()");
    await new Promise((ok) => setTimeout(ok, 600));
    const enmascarar = () => page.evaluate("document.querySelectorAll('a[href^=\"tel:\"], a[href*=\"wa.me\"]').forEach((a) => { a.textContent = '••• (enmascarado)'; })");
    const abrirMenu = () => page.evaluate("(() => { const acts = [...document.querySelectorAll('#view-container .jobdet-inv-actions')].find((a) => a.parentElement.textContent.includes('F-QA-R42-1808')); const k = acts && acts.querySelector('.overflow-trigger'); if (!k) return false; k.scrollIntoView({ block: 'center', behavior: 'instant' }); k.click(); return true; })()");
    const medir = (texto) => page.evaluate((t) => {
      const vis = (n) => { const q = n.getBoundingClientRect(); return !n.hidden && q.width > 0 && q.height > 0; };
      const con = [...document.querySelectorAll('body *')].filter((n) => vis(n) && n.textContent.trim() === t);
      const a = con.filter((n) => !con.some((o) => o !== n && n.contains(o)))[0] || null;
      const q = a ? a.getBoundingClientRect() : null;
      return { visible: !!a, n: con.length, caja: q ? [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)] : null, cabe: q ? q.left >= 0 && q.right <= window.innerWidth : null };
    }, texto);
    const r = { caso: caso.nombre, ancho: caso.ancho, filaInyectadaPintada: await page.evaluate("[...document.querySelectorAll('#view-container .job-doc-row')].some((f) => f.textContent.includes('F-QA-R42-1808'))") };
    r.menuAbierto = await abrirMenu();
    await new Promise((ok) => setTimeout(ok, 400));
    r.botonAntes = await medir(LIT.boton);
    await enmascarar();
    await page.screenshot({ path: path.join(salida, `r42-1808b-${caso.nombre}-menu-${caso.ancho}.png`) });
    if (caso.respuesta) {
      await page.evaluate((t) => { const b = [...document.querySelectorAll('body button, body [role=menuitem]')].find((x) => x.textContent.trim() === t); if (b) b.click(); }, LIT.boton);
      const espera = caso.respuesta.status === 200 ? LIT.pill : LIT.pagado;
      await page.waitForFunction((t) => [...document.querySelectorAll('body *')].some((n) => n.textContent.trim() === t), { timeout: 20000 }, espera).catch(() => {});
      await new Promise((ok) => setTimeout(ok, 400));
      r.preguntas = await page.evaluate(() => window.__preguntas.slice());
      r.confirmaLiteral = r.preguntas[0] === LIT.confirma;
      if (caso.respuesta.status === 200) {
        r.pill = await medir(LIT.pill);
        await abrirMenu();
        await new Promise((ok) => setTimeout(ok, 300));
        r.botonDespues = await medir(LIT.boton);
      } else {
        r.avisoPagado = await page.evaluate((t) => {
          const vis = (n) => { const q = n.getBoundingClientRect(); return !n.hidden && q.width > 0 && q.height > 0; };
          const con = [...document.querySelectorAll('body *')].filter((n) => vis(n) && n.children.length === 0 && n.textContent.trim() === t);
          const q = con[0] ? con[0].getBoundingClientRect() : null;
          return { visible: con.length > 0, caja: q ? [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)] : null, enPantalla: q ? q.top >= 0 && q.bottom <= window.innerHeight : null };
        }, LIT.pagado);
        r.scrollY = await page.evaluate('window.scrollY');
        await enmascarar();
        await page.screenshot({ path: path.join(salida, `r42-1808b-pagado-tras409-${caso.ancho}.png`) });
        await abrirMenu();
        await new Promise((ok) => setTimeout(ok, 300));
        r.botonTrasError = await medir(LIT.boton);
      }
      await enmascarar();
      await page.screenshot({ path: path.join(salida, `r42-1808b-${caso.nombre}-despues-${caso.ancho}.png`) });
    }
    r.lecturasDelTrabajo = lecturas;
    r.escriturasInterceptadas = escrituras;
    r.erroresDePagina = errores;
    resultados.push(r);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(resultados, null, 1));

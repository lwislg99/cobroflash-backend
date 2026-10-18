// SCRUM-1562d · VISTO en yaqu.app: la lista de Trabajos con teclado. Cuenta QA, SÓLO GET (el resto
// se aborta y se cuenta), serviceWorkers:'block'. Por cada ancho:
//  0. control: ¿el jobsView.js SERVIDO lleva el arreglo? (texto del commit 3ec2824b)
//  ① Tab real desde el principio: en qué pulsación llega el foco a «Ver detalle» de la 1ª fila, y
//     si alguna vez lo recibe el <tr> (antes de #2561 no había nada en la fila que llevara a la ficha).
//  ② el anillo: box-shadow / outline computados con el foco puesto POR TAB, ancestros que recortan
//     (overflow distinto de visible), y dos recortes de pantalla (sin foco / con foco) comparados.
//  ③ Enter sobre «Ver detalle»: ¿abre la ficha de ESE trabajo? (hash + llamadas a renderAppView)
//  ④ ratón: clic en el nombre del cliente de la fila (abre la ficha, como antes) y clic en
//     «Ver detalle» (abre UNA vez: stopPropagation).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright-core');
const OUT = process.argv[2];
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().replace(/^pf_session=/, '').split(';')[0];
const ANCHOS = [[390, 844, true], [1280, 800, false]];
const ANTES = process.env.ANTES ? fs.readFileSync(process.env.ANTES, 'utf8') : null;

async function nuevaPagina(browser, w, h, movil) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: movil, hasTouch: movil, serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'pf_session', value: cookie, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  const page = await ctx.newPage();
  const cuenta = { gets: 0, abortadas: [] };
  await page.route('**/*', (route) => {
    const r = route.request();
    // ANTES=<fichero>: el GET de jobsView.js se contesta con el de antes de #2561 (57b0bc82^1),
    // para medir el «antes» con el MISMO instrumento. Todo lo demás, de producción.
    if (ANTES && r.method() === 'GET' && new URL(r.url()).pathname.endsWith('/js/jobsView.js')) { cuenta.sustituido = (cuenta.sustituido || 0) + 1; return route.fulfill({ status: 200, contentType: 'application/javascript', body: ANTES }); }
    if (r.method() === 'GET') { cuenta.gets++; return route.continue(); }
    cuenta.abortadas.push(`${r.method()} ${new URL(r.url()).pathname}`);
    return route.abort();
  });
  return { ctx, page, cuenta };
}

async function abrirLista(page) {
  await page.goto('https://yaqu.app/dashboard/#jobs', { waitUntil: 'networkidle' });
  await page.waitForSelector('tr.jobs-fila', { timeout: 15000 });
  await page.waitForTimeout(800);
  // Espía de navegación: se envuelve DESPUÉS de cargar, sin cambiar lo que hace.
  // Volver a #jobs sólo cambia el hash (no recarga): sin el cerrojo, cada vuelta envolvía OTRA VEZ
  // y una sola navegación salía 2 y 3 veces (r2.txt). El cerrojo lo deja en una capa.
  await page.evaluate(() => {
    window.__nav = [];
    if (window.__espia) return;
    window.__espia = true;
    const orig = window.renderAppView;
    window.renderAppView = function (v, o) { window.__nav.push([v, o && o.jobId]); return orig.apply(this, arguments); };
  });
}

const describe = () => {
  const a = document.activeElement;
  if (!a || a === document.body) return { tag: 'BODY' };
  const tr = a.closest('tr.jobs-fila');
  const filas = [...document.querySelectorAll('tr.jobs-fila')];
  return { tag: a.tagName, texto: (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), clase: String(a.className || ''), fila: tr ? filas.indexOf(tr) : null, esFila: a.tagName === 'TR' };
};

async function medir(browser, [w, h, movil]) {
  const { ctx, page, cuenta } = await nuevaPagina(browser, w, h, movil);
  const r = { ancho: w, alto: h };
  // 0 · control: el fichero servido
  const js = await page.request.get('https://yaqu.app/dashboard/js/jobsView.js');
  const src = await js.text();
  r.servidoLlevaArreglo = src.includes("bDetalle.textContent = 'Ver detalle'");
  await abrirLista(page);
  r.filas = await page.evaluate(() => document.querySelectorAll('tr.jobs-fila').length);
  r.verDetalleEnFilas = await page.evaluate(() => [...document.querySelectorAll('tr.jobs-fila')].filter((tr) => [...tr.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Ver detalle')).length);
  r.primeraFila = await page.evaluate(() => { const tr = document.querySelector('tr.jobs-fila'); return { cliente: tr.querySelector('.jobs-fila-cliente')?.innerText.trim(), botones: [...tr.querySelectorAll('button')].map((b) => b.innerText.trim().replace(/\s+/g, ' ')) }; });

  // ① Tab real
  // Recién cargada, nadie tiene el foco: el primer Tab sale del principio del documento.
  r.focoInicial = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  const recorrido = [];
  let tabVerDetalle = null, trConFoco = false;
  for (let i = 1; i <= 250; i++) {
    await page.keyboard.press('Tab');
    const d = await page.evaluate(describe);
    recorrido.push({ i, ...d });
    if (d.esFila) trConFoco = true;
    if (tabVerDetalle == null && d.fila === 0 && d.texto === 'Ver detalle') { tabVerDetalle = i; break; }
    if (ANTES && d.fila === 1) break; // la 1ª fila ya se recorrió entera
  }
  r.modo = ANTES ? 'ANTES (jobsView.js de 57b0bc82^1)' : 'producción tal cual';
  if (ANTES) {
    // Cada parada de la 1ª fila, con Enter: ¿alguna abre la ficha? Sólo las que no ejecutan nada:
    // «Agendar» abre su modal y «⋯» su menú, y eso NO es la ficha; no se pulsa nada que escriba.
    r.paradasFila0 = recorrido.filter((x) => x.fila === 0).map((x) => `${x.i}:${x.tag}«${x.texto}»`);
  }
  r.tabHastaVerDetalleFila0 = tabVerDetalle;
  r.trRecibioFoco = trConFoco;
  r.recorrido = recorrido.map((x) => `${x.i}:${x.tag}«${x.texto}»${x.fila != null ? '[fila' + x.fila + ']' : ''}`);

  // ② anillo — se espera a que acabe la transición (`box-shadow .15s`, styles.css FRONT-1): sin la
  // espera, la 1ª medida leyó el valor de ARRANQUE (rgba(0,0,0,0) 0 0 0 0) y parecía «sin anillo».
  if (tabVerDetalle != null) {
    await page.waitForTimeout(600);
    const est = await page.evaluate(() => {
      const b = document.activeElement;
      const cs = getComputedStyle(b);
      const q = b.getBoundingClientRect();
      const recortan = [];
      for (let p = b.parentElement; p && p !== document.body; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.overflow !== 'visible' || c.overflowX !== 'visible' || c.overflowY !== 'visible') {
          const pq = p.getBoundingClientRect();
          recortan.push({ el: p.tagName + '.' + String(p.className).split(' ').join('.'), overflow: c.overflow, margenIzq: Math.round(q.left - pq.left), margenDer: Math.round(pq.right - q.right), margenArr: Math.round(q.top - pq.top), margenAba: Math.round(pq.bottom - q.bottom) });
        }
      }
      return { focusVisible: b.matches(':focus-visible'), boxShadow: cs.boxShadow, outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, caja: { x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height) }, recortan };
    });
    r.anillo = est;
    const m = 10;
    const clip = { x: Math.max(0, est.caja.x - m), y: Math.max(0, est.caja.y - m), width: est.caja.w + 2 * m, height: est.caja.h + 2 * m };
    const con = await page.screenshot({ path: `${OUT}/trabajos-${w}-ver-detalle-con-foco.png`, clip });
    await page.screenshot({ path: `${OUT}/trabajos-${w}-pantalla-con-foco.png` });
    // Mismo sitio, sin foco: se quita el foco y se vuelve a fotografiar (no se mueve nada).
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(600);
    const sin = await page.screenshot({ path: `${OUT}/trabajos-${w}-ver-detalle-sin-foco.png`, clip });
    r.anillo.recorteCambiaConElFoco = !con.equals(sin);
    // Control del instrumento: si el recorte NO cambia ni con un borde forzado, no sabe mirar.
    await page.evaluate(() => { const b = [...document.querySelector('tr.jobs-fila').querySelectorAll('button')].find((x) => x.textContent.trim() === 'Ver detalle'); b.style.outline = '3px solid red'; });
    const forzado = await page.screenshot({ clip });
    r.anillo.controlRecorteVeUnBorde = !forzado.equals(sin);
    await page.evaluate(() => { const b = [...document.querySelector('tr.jobs-fila').querySelectorAll('button')].find((x) => x.textContent.trim() === 'Ver detalle'); b.style.outline = ''; });

    // ③ Enter (se vuelve a poner el foco con Tab real, desde el botón anterior)
    await page.evaluate(() => { const bs = [...document.querySelector('tr.jobs-fila').querySelectorAll('button')]; const i = bs.findIndex((x) => x.textContent.trim() === 'Ver detalle'); (i > 0 ? bs[i - 1] : document.body).focus(); });
    if (await page.evaluate(() => document.activeElement === document.body)) { /* sin botón previo: se repite el recorrido */ for (let i = 0; i < tabVerDetalle; i++) await page.keyboard.press('Tab'); }
    else await page.keyboard.press('Tab');
    r.enterSobre = await page.evaluate(describe);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);
    r.enter = await page.evaluate(() => ({ hash: location.hash, nav: window.__nav, h: (document.querySelector('.detail-page h1, .detail-page h2, main h1, h1')?.innerText || '').slice(0, 60) }));
    await page.screenshot({ path: `${OUT}/trabajos-${w}-tras-enter.png` });
  }

  // ④ ratón: control de que la fila sigue abriendo, y de que el botón abre una sola vez
  await abrirLista(page);
  await page.click('tr.jobs-fila >> nth=0 >> .jobs-fila-cliente');
  await page.waitForTimeout(1800);
  r.ratonFila = await page.evaluate(() => ({ hash: location.hash, nav: window.__nav }));
  if (!ANTES) {
    await abrirLista(page);
    await page.click('tr.jobs-fila >> nth=0 >> button:has-text("Ver detalle")');
    await page.waitForTimeout(1800);
    r.ratonBoton = await page.evaluate(() => ({ hash: location.hash, nav: window.__nav }));
  }
  r.sustituido = cuenta.sustituido || 0;

  r.gets = cuenta.gets; r.abortadas = cuenta.abortadas;
  await ctx.close();
  return r;
}

const browser = await chromium.launch();
try {
  for (const a of ANCHOS) {
    try { console.log(JSON.stringify(await medir(browser, a), null, 1)); }
    catch (e) { console.log(JSON.stringify({ ancho: a[0], CIEGO: String(e && e.message).slice(0, 400) })); }
  }
} finally { await browser.close(); }

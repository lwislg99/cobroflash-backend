// Sonda S4 · SCRUM-49d y privacidad:92 (SCRUM-1236). SOLO GET: todo lo demás se aborta y se cuenta.
//   node sonda-49d.mjs <dirSalida> <etiqueta>
// ① la ficha del albarán #46 en el panel (cuenta QA): ¿qué píldoras pinta?
// ② la página pública de firma del #46, con el firmaToken que da la ficha: ¿expone IP o navegador?
// El token NO se imprime ni se guarda: sólo su longitud.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright-core');
const [OUT, ETQ = 'medida'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().replace(/^pf_session=/, '').split(';')[0];
const UA = 'Mozilla/5.0 SondaS4-49d-NAVEGADOR-MARCA/1.0';
const ID = 46;
const res = { etiqueta: ETQ };

const browser = await chromium.launch();
try {
  // ── ① PANEL ───────────────────────────────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', userAgent: UA });
  await ctx.addCookies([{ name: 'pf_session', value: cookie, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  const page = await ctx.newPage();
  const abortadas = [];
  await page.route('**/*', (route) => {
    const r = route.request();
    if (r.method() === 'GET') return route.continue();
    abortadas.push(`${r.method()} ${new URL(r.url()).pathname}`);
    return route.abort();
  });
  let ficha = null;
  page.on('response', async (r) => {
    if (new URL(r.url()).pathname === `/admin/albaranes/${ID}` && r.request().method() === 'GET') ficha = await r.json().catch(() => null);
  });
  const version = await (await page.request.get('https://yaqu.app/version')).json();
  res.version = version.version;
  await page.goto(`https://yaqu.app/dashboard/#albaran-detail/${ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  res.panel = await page.evaluate(() => ({
    numero: (document.querySelector('.detail-head h2') || {}).textContent || null,
    pildoras: [...document.querySelectorAll('.status-pill')].map((e) => e.textContent.trim()),
  }));
  res.ficha = ficha ? { estado: ficha.estado, enviadoParaFirma: ficha.enviadoParaFirma, entregaParaFirmar: ficha.entregaParaFirmar, firmaToken: ficha.firmaToken ? `len${ficha.firmaToken.length}` : ficha.firmaToken } : 'NO_LEIDA';
  await page.screenshot({ path: `${OUT}/${ETQ}-ficha-46-1280.png` });
  res.abortadasPanel = abortadas.slice();

  // ── ② PÁGINA PÚBLICA DE FIRMA, SIN COOKIE ───────────────────────────────────────────────
  if (ficha && ficha.firmaToken) {
    const pub = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA });
    const p2 = await pub.newPage();
    const ab2 = [];
    await p2.route('**/*', (route) => {
      const r = route.request();
      if (r.method() === 'GET') return route.continue();
      ab2.push(`${r.method()} ${new URL(r.url()).pathname}`);
      return route.abort();
    });
    // La IP con la que Cloudflare nos ve: es la que el servidor guardaría como evidencia.
    const trace = await (await p2.request.get('https://yaqu.app/cdn-cgi/trace')).text();
    const ip = (trace.match(/^ip=(.+)$/m) || [])[1] || null;
    const resp = await p2.goto(`https://yaqu.app/albaran/${ficha.firmaToken}`, { waitUntil: 'networkidle' });
    const html = await p2.content();
    const texto = await p2.evaluate(() => document.body.innerText);
    const buscar = (hay) => ({
      ipPropia: !!ip && hay.includes(ip),
      marcaNavegador: hay.includes('SondaS4-49d-NAVEGADOR-MARCA'),
      ipv4: hay.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [],
      palabras: ['User-Agent', 'userAgent', 'evidencia', 'evidenciaFirma', 'Dirección IP', ' IP '].filter((w) => hay.includes(w)),
    });
    // CONTROL POSITIVO: la misma búsqueda sobre un texto que SÍ lleva las dos cosas tiene que cazarlas.
    const control = buscar(`x ${ip} y ${UA} z`);
    res.publica = {
      status: resp.status(), titulo: await p2.title(),
      haySaludo: /Hola, /.test(texto), hayFirmar: /Firmar el parte de trabajo/.test(texto), yaFirmado: /ya está firmado/.test(texto),
      ipConocida: !!ip,
      controlPositivo: { ipPropia: control.ipPropia, marcaNavegador: control.marcaNavegador },
      enElHtml: buscar(html), enElTexto: buscar(texto),
      bytesHtml: html.length,
      abortadas: ab2,
    };
    await p2.screenshot({ path: `${OUT}/${ETQ}-publica-46-390.png`, fullPage: true });
    await pub.close();
  } else res.publica = 'SIN_TOKEN';
  await ctx.close();
} finally { await browser.close(); }
const s = JSON.stringify(res, null, 2);
fs.writeFileSync(`${OUT}/${ETQ}.json`, s);
console.log(s);

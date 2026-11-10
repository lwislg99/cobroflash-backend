// Medida de SÓLO LECTURA (SCRUM-962, tramo S2 22-oct). Mismo banco, mismo árbitro y mismas vistas
// que scripts/censo-objetivo-tactil-panel.mjs; cambian DOS cosas, para ver qué se le escapa:
//   ① la población de «control» se amplía: + select, textarea, input de texto/número/fecha, role=tab…
//   ② en Configuración se abre CADA pestaña (lo mismo que hace pintarNav: un panel en flex, el resto none).
// Uso: node censo-ampliado.mjs <raiz-del-repo> <salida.json>
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const SALIDA = process.argv[3];
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { createRequire } = await import('node:module');
const reqRaiz = createRequire(path.join(RAIZ, 'package.json'));
const puppeteer = (await import(pathToFileURL(reqRaiz.resolve('puppeteer-core')).href)).default;
const { lanzarNavegador } = await imp('scripts/_navegador.mjs');
const { FUENTE_MEDIDOR, INTERACTIVOS } = await imp('scripts/_medidor-de-toque.mjs');
const { serializar, paginaDeClientes } = await imp('scripts/_pagina-panel.mjs');
const { cargarDashboard, pintarVista, todos } = await imp('tests/_banco-vistas.mjs');
const { datosDelCenso, ARGUMENTOS_DEL_CENSO } = await imp('scripts/_datos-del-censo.mjs');

const PUBLIC = path.join(RAIZ, 'public');
const ANCHOS = [390, 929];
const AMPLIADO = INTERACTIVOS + ', select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]), [role="tab"], [role="switch"], [role="radio"], [role="menuitem"]';
// Dos sondas: el botón de 12 px del censo, y un <select> de 20 px, que el censo NO puede cazar.
const SONDAS = '<button id="__sonda_b" style="width:12px;height:12px;padding:0;border:0">.</button>'
  + '<select id="__sonda_s" style="height:20px;min-height:0;padding:0"><option>s</option></select>';

const DC = datosDelCenso();
const BANCO = cargarDashboard(RAIZ);
const VISTAS = Object.keys(BANCO.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof BANCO.ctx[k] === 'function').sort();
const superficies = [];
const noMedidas = [];
for (const fn of VISTAS) {
  DC.enVista(fn);
  let r;
  try { r = await pintarVista(cargarDashboard(RAIZ, { datos: DC.datos }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || [])); }
  catch (e) { noMedidas.push([fn, String(e.message).slice(0, 80)]); continue; }
  if (r.error) { noMedidas.push([fn, 'no monta: ' + String(r.error.message).slice(0, 80)]); continue; }
  const nodos = todos(r.contenedor).length;
  if (nodos < 20) { noMedidas.push([fn, `sólo ${nodos} nodos`]); continue; }
  superficies.push({ fn, html: serializar(r.contenedor) });
}
const cli = await paginaDeClientes(RAIZ);
if (!cli.aviso) {
  const i = superficies.findIndex((s) => s.fn === 'renderCustomersView');
  const e = { fn: 'renderCustomersView', html: cli.html };
  if (i >= 0) superficies[i] = e; else superficies.push(e);
}

const HOJAS = '<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">';
const pagina = (c) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>' + c + '</body></html>';
const rutas = new Map();
for (const s of superficies) { rutas.set('/' + s.fn, pagina(s.html)); rutas.set('/' + s.fn + '__sonda', pagina(s.html + SONDAS)); }
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (rutas.has(u)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(rutas.get(u)); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': d.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

// Abre la pestaña `clave` igual que pintarNav (settingsView.js:143-145). null = estado del montaje.
const ABRIR = `((clave) => {
  if (clave == null) return [...document.querySelectorAll('.settings-panel')].map((p) => p.dataset.submenu);
  for (const p of document.querySelectorAll('.settings-panel')) p.style.display = p.dataset.submenu === clave ? 'flex' : 'none';
  return clave;
})`;
const MEDIR = `(async (SEL, CENSO) => {
  const out = { medidos: [], sinPintar: 0, noTocables: [] };
  const rotulo = (el) => {
    const l = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || el.getAttribute('placeholder')
      || (el.tagName === 'SELECT' ? '' : el.textContent) || '';
    let t = l.replace(/\\s+/g, ' ').trim();
    if (!t) { // rótulo hermano anterior (patrón de settingsView: <label> sin for + control)
      let p = el.previousElementSibling; while (p && !/^(LABEL|SPAN|P|DIV|STRONG)$/.test(p.tagName)) p = p.previousElementSibling;
      if (p) t = p.textContent.replace(/\\s+/g, ' ').trim();
      if (!t && el.parentElement) { const lab = el.parentElement.querySelector('label'); if (lab) t = lab.textContent.replace(/\\s+/g, ' ').trim(); }
    }
    return (t || el.id || el.name || '(sin rótulo)').slice(0, 48);
  };
  const tipo = (el) => el.tagName.toLowerCase() + (el.tagName === 'INPUT' ? '[' + (el.getAttribute('type') || 'text') + ']' : '') + (el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : '');
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) { out.sinPintar++; continue; }
    const ficha = { tipo: tipo(el), cls: (typeof el.className === 'string' ? el.className.trim() : ''), id: el.id || '', rotulo: rotulo(el), enSelectorDelCenso: el.matches(CENSO), sonda: /^__sonda/.test(el.id) };
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    if (m.error) { out.noTocables.push({ ...ficha, caja: m.caja ?? +r.height.toFixed(1), motivo: m.error }); continue; }
    out.medidos.push({ ...ficha, caja: m.caja, tocable: m.tocable, ancho: +r.width.toFixed(1) });
  }
  return out;
})`;

const navegador = await lanzarNavegador(puppeteer, {});
const res = [];
const sondasFallidas = [];
for (const ancho of ANCHOS) {
  for (const s of superficies) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    const estados = [null];
    if (s.fn === 'renderSettingsView') {
      await page.goto(`http://127.0.0.1:${PUERTO}/${s.fn}`, { waitUntil: 'load' });
      estados.push(...(await page.evaluate(`${ABRIR}(null)`)));
    }
    for (const est of estados) {
      for (const sonda of [true, false]) {
        await page.goto(`http://127.0.0.1:${PUERTO}/${s.fn}${sonda ? '__sonda' : ''}`, { waitUntil: 'load' });
        if (est) await page.evaluate(`${ABRIR}(${JSON.stringify(est)})`);
        const r = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIR}(${JSON.stringify(AMPLIADO)}, ${JSON.stringify(INTERACTIVOS)})`);
        if (sonda) {
          for (const id of ['__sonda_b', '__sonda_s']) {
            const m = r.medidos.find((x) => x.id === id);
            if (!m || !(m.tocable < 44)) sondasFallidas.push(`${s.fn}${est ? '#' + est : ''} @${ancho} ${id}: ${m ? 'medida ' + m.tocable : 'no medida'}`);
          }
        } else res.push({ fn: s.fn, pestana: est, ancho, ...r });
      }
    }
    await page.close();
  }
}
await navegador.close();
srv.close();
fs.writeFileSync(SALIDA, JSON.stringify({ vistas: VISTAS.length, superficies: superficies.map((s) => s.fn), noMedidas, sondasFallidas, res }, null, 1));
console.log(`vistas ${VISTAS.length} · superficies ${superficies.length} · no medidas ${noMedidas.length} · sondas fallidas ${sondasFallidas.length} · estados medidos ${res.length}`);
for (const f of sondasFallidas) console.log('  🔴 SONDA', f);
process.exit(sondasFallidas.length || superficies.length < 10 ? 2 : 0);

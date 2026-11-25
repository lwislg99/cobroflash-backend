// docs/master/evidencias/SCRUM-1850/medir.mjs — SCRUM-1850
//
// Mide TODOS los interactivos de la ficha 360 (`renderCustomer360View`) montada como la monta el censo
// (`paginaDeVista` + `datosDelCenso` + las hojas del índice) a 390, 929 y 1280 px, con el árbitro del
// guard y del censo (`__areaDeToque` de `FUENTE_MEDIDOR`). Imprime una fila por elemento y anchura:
// ancho · selector · texto · contenedor · caja · toque. Con `--capturas <dir>` guarda además una captura
// de página entera por anchura (`360-<ancho>.png`).
//
// Uso (desde la raíz del árbol, con `dist/` construido):
//   node docs/master/evidencias/SCRUM-1850/medir.mjs
//   node docs/master/evidencias/SCRUM-1850/medir.mjs --capturas docs/master/evidencias/SCRUM-1850/antes
//
// Población declarada: la salida dice cuántos interactivos midió en cada anchura y cuántos no alcanzó el
// árbitro. Si la vista no se monta o la fuente no carga, sale con 2 (CIEGO), no con una tabla vacía.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const desde = (r) => new URL('file:///' + path.join(RAIZ, r).replace(/\\/g, '/')).href;
const { resolverNavegador, lanzarNavegador } = await import(desde('scripts/_navegador.mjs'));
const { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } = await import(desde('scripts/_medidor-de-toque.mjs'));
const { paginaDeVista } = await import(desde('scripts/_pagina-panel.mjs'));
const { datosDelCenso, ARGUMENTOS_DEL_CENSO } = await import(desde('scripts/_datos-del-censo.mjs'));
const { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente, decirFuente } = await import(desde('scripts/_hojas-del-panel.mjs'));

const PUBLIC = path.join(RAIZ, 'public');
const VISTA = 'renderCustomer360View';
const ANCHOS = [390, 929, 1280];
const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > 0 ? path.resolve(process.argv[iCap + 1]) : null;

const nav0 = resolverNavegador();
if (!nav0.ok) { console.log(`CIEGO: sin navegador (${nav0.motivo})`); process.exit(2); }

const DC = datosDelCenso();
DC.enVista(VISTA);
const montada = await paginaDeVista(RAIZ, VISTA, { datos: DC.datos, args: ARGUMENTOS_DEL_CENSO[VISTA] || [] });
if (!montada.html) { console.log(`CIEGO: la vista no se monta: ${montada.aviso}`); process.exit(2); }
const HTML = '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC) + '</head><body>' + montada.html + '</body></html>';

const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (u === '/__c360') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(HTML); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d) || fs.statSync(d).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

let ciego = false;
const nav = await lanzarNavegador(puppeteer, {});
try {
  if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });
  for (const ancho of ANCHOS) {
    const page = await nav.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`http://127.0.0.1:${PUERTO}/__c360`, { waitUntil: 'load' });
    const fuente = await esperarFuentes(page);
    const ceguera = cegueraDeLaFuente(fuente, `${VISTA} @${ancho}px`);
    if (ceguera) { console.log(`CIEGO @${ancho}: ${ceguera} (${decirFuente(fuente)})`); ciego = true; }
    await page.evaluate(FUENTE_MEDIDOR);
    const filas = await page.evaluate(async (SEL) => {
      const out = [];
      for (const el of document.querySelectorAll(SEL)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const m = await window.__areaDeToque(el, SEL, { scroll: true });
        const padre = el.parentElement ? (el.parentElement.className || el.parentElement.tagName) : '';
        out.push({
          sel: el.tagName + (el.classList.length ? '.' + [...el.classList].join('.') : ''),
          texto: ((el.textContent || '').replace(/\s+/g, ' ').trim() || el.getAttribute('placeholder') || el.id || el.name || '(sin texto)').slice(0, 40),
          padre: String(padre).slice(0, 40),
          caja: m.caja ?? +r.height.toFixed(1),
          tocable: m.tocable ?? null,
          error: m.error || null,
        });
      }
      return out;
    }, INTERACTIVOS);
    const cortos = filas.filter((f) => !(typeof f.tocable === 'number' && f.tocable >= MINIMO_TACTIL));
    console.log(`\n@${ancho}px · ${filas.length} interactivos visibles · ${cortos.length} por debajo de ${MINIMO_TACTIL} · ${filas.filter((f) => f.error).length} sin alcanzar`);
    for (const f of filas) {
      const marca = (typeof f.tocable === 'number' && f.tocable >= MINIMO_TACTIL) ? 'ok   ' : 'CORTO';
      console.log(`  ${marca} ${f.sel} «${f.texto}» · en ${f.padre} · caja ${f.caja} · toque ${f.tocable}${f.error ? ' · ' + f.error : ''}`);
    }
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `360-${ancho}.png`), fullPage: true });
    await page.close();
  }
} finally {
  await nav.close();
  srv.close();
}
process.exit(ciego ? 2 : 0);

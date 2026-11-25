// docs/master/evidencias/SCRUM-1852/medir.mjs — SCRUM-1852
//
// Mide, CON CAJAS, si alguna acción de la cabecera de la ficha 360 (`.c360-cabecera-acciones > button`)
// se pinta encima del nombre del cliente (`.c360-nombre`), a 390, 929 y 1280 px. La ficha se monta como
// la monta el censo (`paginaDeVista` + `datosDelCenso` + las hojas del índice), igual que
// `tests/scrum1850-ficha-360-resto-44.test.mjs` y `docs/master/evidencias/SCRUM-1850/medir.mjs`.
//
// QUÉ ES «EL NOMBRE»: dos rectángulos, y se miden los dos.
//   · la CAJA del `h2.c360-nombre` (`getBoundingClientRect`): el hueco que el layout le da;
//   · la TINTA del nombre: los rectángulos de línea de un `Range` sobre su texto (`getClientRects`).
//     Una palabra más ancha que su columna DESBORDA la caja: la caja no toca el botón y la tinta sí.
//     Por eso la tinta es la que decide; la caja se imprime para que se vea la diferencia.
//
// Dos clientes, los dos de `CLIENTES_DE_MUESTRA` (no se inventa ninguno): el LARGO es el que el censo
// ya monta («Administración de Fincas Soler y Asociados», el [0]); el CORTO es el [1] («Carmen Ruiz»),
// el control: con un nombre corto no hay solape ni antes ni después.
//
// Uso (desde la raíz del árbol, con `dist/` construido):
//   node docs/master/evidencias/SCRUM-1852/medir.mjs
//   node docs/master/evidencias/SCRUM-1852/medir.mjs --capturas docs/master/evidencias/SCRUM-1852/antes
//
// Población declarada: imprime cuántas acciones y cuántas líneas de nombre midió en cada anchura. Si la
// vista no se monta, la fuente no carga o no encuentra el nombre o las acciones, sale con 2 (CIEGO).
// Salida 0 = medido (haya o no solape: la tabla lo dice); 2 = CIEGO.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const desde = (r) => new URL('file:///' + path.join(RAIZ, r).replace(/\\/g, '/')).href;
const { resolverNavegador, lanzarNavegador } = await import(desde('scripts/_navegador.mjs'));
const { paginaDeVista, CLIENTES_DE_MUESTRA } = await import(desde('scripts/_pagina-panel.mjs'));
const { datosDelCenso, ARGUMENTOS_DEL_CENSO } = await import(desde('scripts/_datos-del-censo.mjs'));
const { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente, decirFuente } = await import(desde('scripts/_hojas-del-panel.mjs'));

const PUBLIC = path.join(RAIZ, 'public');
const VISTA = 'renderCustomer360View';
const ANCHOS = [390, 929, 1280];
const NOMBRES = { largo: CLIENTES_DE_MUESTRA[0].name, corto: CLIENTES_DE_MUESTRA[1].name };
const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > 0 ? path.resolve(process.argv[iCap + 1]) : null;

const nav0 = resolverNavegador();
if (!nav0.ok) { console.log(`CIEGO: sin navegador (${nav0.motivo})`); process.exit(2); }

const montar = async (nombre) => {
  const DC = datosDelCenso();
  DC.enVista(VISTA);
  const datos = (url) => {
    const v = DC.datos(url);
    if (v && v.customer && /\/admin\/customers\/\d+\/detail(\?|$)/.test(url)) v.customer.name = nombre;
    return v;
  };
  const montada = await paginaDeVista(RAIZ, VISTA, { datos, args: ARGUMENTOS_DEL_CENSO[VISTA] || [] });
  if (!montada.html) { console.log(`CIEGO: la vista no se monta (${nombre}): ${montada.aviso}`); process.exit(2); }
  return montada.html;
};
// Dos MARCOS. `banco`: la vista sola en el <body>, como la monta el censo (y los tests de 1841/1850).
// `app`: dentro de la carcasa de `public/dashboard/index.html` (`.layout > aside.sidebar + main.main >
// section.view-container`): por encima de 768 la barra lateral (`--sidebar-w`) se come 248 px, y a
// 929 la tarjeta de la cabecera es más estrecha que la fila de acciones. El banco no lo ve.
const enMarco = (vista, marco) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC) + '</head><body>'
  + (marco === 'app' ? '<div class="layout"><aside class="sidebar"></aside><main class="main"><section id="view-container" class="view-container">' + vista + '</section></main></div>' : vista)
  + '</body></html>';
const VISTAS = { largo: await montar(NOMBRES.largo), corto: await montar(NOMBRES.corto) };
const HTML = {};
for (const cual of ['largo', 'corto']) for (const marco of ['banco', 'app']) HTML[`${cual}-${marco}`] = enMarco(VISTAS[cual], marco);

const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  const m = /^\/__c360-((?:largo|corto)-(?:banco|app))$/.exec(u);
  if (m) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(HTML[m[1]]); }
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
  for (const marco of ['banco', 'app']) for (const cual of ['largo', 'corto']) {
    for (const ancho of ANCHOS) {
      const page = await nav.newPage();
      await page.setViewport({ width: ancho, height: 900 });
      await page.goto(`http://127.0.0.1:${PUERTO}/__c360-${cual}-${marco}`, { waitUntil: 'load' });
      const fuente = await esperarFuentes(page);
      const ceguera = cegueraDeLaFuente(fuente, `${VISTA} @${ancho}px`);
      if (ceguera) { console.log(`CIEGO @${ancho} (${cual}): ${ceguera} (${decirFuente(fuente)})`); ciego = true; }
      const r = await page.evaluate(() => {
        const caja = (q) => ({ x: +q.left.toFixed(1), y: +q.top.toFixed(1), w: +q.width.toFixed(1), h: +q.height.toFixed(1) });
        const corte = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const h2 = document.querySelector('.c360-nombre');
        const acciones = [...document.querySelectorAll('.c360-cabecera-acciones > button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && q.height > 0; });
        if (!h2 || !h2.firstChild) return { error: 'no encuentro `.c360-nombre` con texto' };
        const rango = document.createRange();
        rango.selectNodeContents(h2);
        const tinta = [...rango.getClientRects()].map(caja).filter((q) => q.w > 0 && q.h > 0);
        const cajaNombre = caja(h2.getBoundingClientRect());
        // La tarjeta de la cabecera: el padre de `.c360-identidad`. «sale» = cuánto pasa una acción de
        // su borde derecho (el contenido, sin el relleno de 20 px).
        const tarjeta = h2.closest('.c360-identidad')?.parentElement;
        const bordeDcho = tarjeta ? tarjeta.getBoundingClientRect().right - parseFloat(getComputedStyle(tarjeta).paddingRight) : NaN;
        const fila = acciones.map((b) => {
          const q = b.getBoundingClientRect();
          const cb = caja(q);
          return {
            texto: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
            caja: cb,
            conTinta: +tinta.reduce((s, t) => s + corte(cb, t), 0).toFixed(1),
            conCaja: +corte(cb, cajaNombre).toFixed(1),
            sale: +Math.max(0, q.right - bordeDcho).toFixed(1),
          };
        });
        return { cajaNombre, tinta, fila, anchoDoc: document.documentElement.scrollWidth };
      });
      if (r.error || !r.fila.length || !r.tinta.length) {
        console.log(`CIEGO @${ancho} (${cual}): ${r.error || `acciones ${r.fila?.length ?? 0} · líneas de nombre ${r.tinta?.length ?? 0}`}`);
        ciego = true;
      } else {
        const solapan = r.fila.filter((f) => f.conTinta > 0);
        const salen = r.fila.filter((f) => f.sale > 0);
        console.log(`\n[${marco}] @${ancho}px · nombre ${cual} «${cual === 'largo' ? NOMBRES.largo : NOMBRES.corto}» · ${r.fila.length} acciones · ${r.tinta.length} líneas de tinta · ${solapan.length} acciones encima de la tinta · ${salen.length} fuera de la tarjeta · scrollWidth ${r.anchoDoc}`);
        console.log(`  caja del h2: x ${r.cajaNombre.x} y ${r.cajaNombre.y} w ${r.cajaNombre.w} h ${r.cajaNombre.h}`);
        for (const t of r.tinta) console.log(`  tinta: x ${t.x} y ${t.y} w ${t.w} h ${t.h}`);
        for (const f of r.fila) {
          console.log(`  ${f.conTinta > 0 ? 'ENCIMA' : f.sale > 0 ? 'SALE  ' : 'ok    '} «${f.texto}» x ${f.caja.x} y ${f.caja.y} w ${f.caja.w} h ${f.caja.h} · ∩tinta ${f.conTinta} px² · ∩caja ${f.conCaja} px² · sale ${f.sale} px`);
        }
      }
      // La vista entra con un fundido: sin esperar a que acabe, la captura sale a medio pintar
      // (cicatriz J2 del 2026-11-21). Las cajas no dependen de la opacidad; la captura sí.
      if (CAPTURAS && cual === 'largo') await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
      if (CAPTURAS && cual === 'largo') await page.screenshot({ path: path.join(CAPTURAS, `360-${ancho}${marco === 'app' ? '-app' : ''}.png`), fullPage: true });
      await page.close();
    }
  }
} finally {
  await nav.close();
  srv.close();
}
process.exit(ciego ? 2 : 0);

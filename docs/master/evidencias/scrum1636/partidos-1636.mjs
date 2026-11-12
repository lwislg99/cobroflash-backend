// SCRUM-1636 ② en yaqu.app: ¿se parten el ID y la píldora de Productos? (cuenta QA, sólo GET).
// Uso: node partidos-1636.mjs [carpeta-del-arbol]  → sin argumento mide prod tal cual; con argumento
// sirve su styles.css.
// Instrumento: un Range sobre el TEXTO de la celda ID y de la píldora; sus getClientRects() son las
// líneas en que sale (1 = entero). CONTROL: «ACTIVO» en una caja de 12 px con break-all tiene que
// salir en más de una línea, o el instrumento no ve partidos.
// Vecinos: ancho de la tabla contra su `.table-scroll` (desborde) y alto de fila, por ancho.
import { abrir } from './comun.mjs';

const arbol = process.argv[2];
const servir = arbol ? { '/dashboard/css/styles.css': arbol + '/public/dashboard/css/styles.css' } : {};
for (const ancho of [1280, 390, 1920]) {
  const { browser, page, build, errores } = await abrir({ servir, viewport: { width: ancho, height: 1400 } });
  await page.evaluate(() => window.renderAppView('products'));
  await page.waitForFunction(() => document.querySelectorAll('.catalogo-productos table tbody tr').length > 0, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const lineas = (el) => { if (!el) return null; const rg = document.createRange(); rg.selectNodeContents(el); return [...rg.getClientRects()].filter((b) => b.width > 0).length; };
    const ctl = document.createElement('span');
    ctl.style.cssText = 'display:inline-block;width:12px;word-break:break-all'; ctl.textContent = 'ACTIVO';
    document.body.appendChild(ctl);
    const control = lineas(ctl); ctl.remove();
    const filas = [...document.querySelectorAll('.catalogo-productos table tbody tr')].filter((tr) => tr.offsetParent);
    const datos = filas.map((tr) => {
      const id = tr.querySelector('td');
      const pill = tr.querySelector('.status-pill');
      return { id: id && id.textContent.trim(), lineasId: lineas(id), anchoId: id && Math.round(id.getBoundingClientRect().width),
        pill: pill && pill.textContent.trim(), lineasPill: lineas(pill), alto: Math.round(tr.getBoundingClientRect().height) };
    });
    const sc = document.querySelector('.catalogo-productos .table-scroll');
    const tb = document.querySelector('.catalogo-productos table');
    return { control, filas: datos.length, partidos: datos.filter((d) => d.lineasId > 1 || d.lineasPill > 1),
      muestra: datos.slice(0, 3), altoMax: Math.max(0, ...datos.map((d) => d.alto)),
      desborde: sc && tb ? Math.round(tb.getBoundingClientRect().width - sc.clientWidth) : null,
      display: tb && getComputedStyle(tb).display };
  });
  console.log(JSON.stringify({ build: build.slice(0, 9), servido: arbol ? 'rama' : 'prod', ancho,
    control: r.control > 1 ? `verde (${r.control} líneas)` : 'NO CAZA', filas: r.filas, partidos: r.partidos.length,
    ejemplos: r.partidos.slice(0, 3), muestra: r.muestra, altoMax: r.altoMax, desborde: r.desborde, display: r.display, errores }));
  await page.screenshot({ path: `cap1636/${arbol ? 'despues' : 'antes'}-${ancho}.png`, fullPage: false });
  await browser.close();
}

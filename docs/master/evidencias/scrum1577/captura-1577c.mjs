// SCRUM-1577c · captura (sólo lectura) de la tarjeta «Tu página pública» a 320/390/929, con el enlace
// `yaqu.app/p/…` del aviso «Tu página está activa». Mismo banco que banco-44.mjs. Además de la imagen
// imprime, por anchura y por dirección (una normal y una de 40 caracteres, el máximo que admite la
// pantalla): el ancho de página (`scrollWidth` contra `innerWidth`), la caja del enlace, cuántos
// renglones ocupa (`getClientRects`), la caja del aviso y si el enlace se sale del aviso (CORTADO).
// Uso: node captura-1577c.mjs <raiz> <carpeta public> <prefijo de salida>
//
// CONTROL: el `public` de `origin/main` tiene que dar el enlace a 16 de alto a 390 y partido en DOS
// renglones a 320 (lo medido antes del arreglo). Si la fila «antes» no lo da, esta captura no distingue
// las versiones.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const [RAIZ, PUB] = process.argv.slice(2, 4).map((p) => path.resolve(p));
const PREFIJO = process.argv[4];
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const datos = (slug) => `(r) => /\\/admin\\/merchant$/.test(r) ? { id: 1, name: 'Fontanería Soler', country: 'ES', slug: '${slug}', publicProfileEnabled: true, profileZones: ['Valencia'], slugChangedAt: null } : []`;
const SLUGS = { corta: 'fontaneria-soler', larga: 'fontaneria-y-calefaccion-soler-de-valenc' };
const rutas = Object.entries(SLUGS).map(([n, s]) => ({ ruta: `/conf-${n}`, fnVista: 'renderSettingsView', datos: datos(s), modoEmision: 'fiscal' }));
const { srv, puerto } = await servirListas(PUB, rutas);
const { browser } = await abrirNavegador(puppeteer);
const SEL = '.alert.success a[href^="/p/"]';
for (const ancho of [320, 390, 929]) {
  for (const n of Object.keys(SLUGS)) {
    const { page } = await abrirVista(browser, puerto, `/conf-${n}`, ancho);
    await page.click('.settings-nav [data-submenu="publica"]');
    await new Promise((ok) => setTimeout(ok, 150));
    const r = await page.evaluate((SEL) => {
      const a = document.querySelector(SEL);
      if (!a) return { falta: true };
      const b = a.getBoundingClientRect();
      const al = a.closest('.alert').getBoundingClientRect();
      const cortado = b.right > al.right + 0.5 || b.left < al.left - 0.5;
      return { scroll: document.documentElement.scrollWidth, ventana: window.innerWidth,
        enlace: `${b.height.toFixed(1)}×${b.width.toFixed(1)}`, renglones: a.getClientRects().length,
        aviso: `${al.height.toFixed(1)}×${al.width.toFixed(1)}`, cortado };
    }, SEL);
    if (r.falta) { console.log(`@${ancho} ${n} · enlace FALTA`); await page.close(); continue; }
    console.log(`@${ancho} ${n} · página ${r.scroll}/${r.ventana}${r.scroll > r.ventana ? ' DESBORDA' : ''} · enlace ${r.enlace} en ${r.renglones} caja(s) · aviso ${r.aviso}${r.cortado ? ' · CORTADO' : ''}`);
    const el = await page.$(SEL);
    const tarjeta = await el.evaluateHandle((e) => e.closest('.customers-card') || e.parentElement);
    await tarjeta.asElement().screenshot({ path: `${PREFIJO}-${n}-${ancho}.png` });
    await page.close();
  }
}
await browser.close();
srv.close();

// Estilo calculado EN REPOSO (sin ratón ni foco) de «Quitar» y «Añadir condición», y después con el
// ratón encima de «Quitar»: el hover tiene que dar OTRO fondo, o la sonda no distingue estados.
// Uso: node reposo.mjs <raiz> <carpeta public>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const [RAIZ, PUB] = process.argv.slice(2, 4).map((p) => path.resolve(p));
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const DATOS = `(r) => /\\/admin\\/merchant$/.test(r) ? { id: 1, name: 'Fontanería Soler', country: 'ES', clausulasPresupuesto: [{ id: 'a', titulo: 'Garantía', texto: 'Seis meses.' }] } : []`;
const { srv, puerto } = await servirListas(PUB, [{ ruta: '/conf', fnVista: 'renderSettingsView', datos: DATOS, modoEmision: 'fiscal' }]);
const { browser } = await abrirNavegador(puppeteer);
const lee = (page) => page.evaluate(() => {
  const f = (el) => { const s = getComputedStyle(el); return { clase: el.className, fondo: s.backgroundColor, borde: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor, color: s.color, peso: s.fontWeight, fondoCaja: getComputedStyle(el.parentElement).backgroundColor }; };
  return { quitar: f(document.querySelector('[data-clausula-quitar]')), anadir: f(document.querySelector('#clausulas-anadir')), activo: document.activeElement.tagName };
});
for (const ancho of [390, 929]) {
  const { page } = await abrirVista(browser, puerto, '/conf', ancho);
  await page.click('.settings-nav [data-submenu="facturacion"]');
  await page.mouse.move(0, 0);
  await new Promise((ok) => setTimeout(ok, 400));
  console.log(ancho, 'REPOSO', JSON.stringify(await lee(page)));
  await page.hover('[data-clausula-quitar]');
  await new Promise((ok) => setTimeout(ok, 400));
  console.log(ancho, 'HOVER-QUITAR', JSON.stringify((await lee(page)).quitar));
  await page.close();
}
await browser.close(); srv.close();

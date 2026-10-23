// Captura (sólo lectura) del bloque de cláusulas de Configuración → Facturación, y el anillo de foco
// de «Añadir condición» con el teclado. Mismo banco que banco-44.mjs.
// Uso: node captura.mjs <raiz> <carpeta public> <prefijo de salida>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const [RAIZ, PUB] = process.argv.slice(2, 4).map((p) => path.resolve(p));
const PREFIJO = process.argv[4];
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const DATOS = `(r) => /\\/admin\\/merchant$/.test(r) ? { id: 1, name: 'Fontanería Soler', country: 'ES', clausulasPresupuesto: [{ id: 'a', titulo: 'Garantía', texto: 'Seis meses.' }] } : []`;
const { srv, puerto } = await servirListas(PUB, [{ ruta: '/conf', fnVista: 'renderSettingsView', datos: DATOS, modoEmision: 'fiscal' }]);
const { browser } = await abrirNavegador(puppeteer);
for (const ancho of [390, 929]) {
  const { page } = await abrirVista(browser, puerto, '/conf', ancho);
  await page.click('.settings-nav [data-submenu="facturacion"]');
  await new Promise((ok) => setTimeout(ok, 150));
  const caja = await page.$('#clausulas-anadir');
  const bloque = await caja.evaluateHandle((b) => b.parentElement);
  await bloque.evaluate((b) => b.scrollIntoView({ block: 'center' }));
  await bloque.screenshot({ path: `${PREFIJO}-${ancho}.png` });
  await page.focus('#clausulas-anadir');
  await page.keyboard.press('Shift'); // modalidad teclado para :focus-visible
  await new Promise((ok) => setTimeout(ok, 300)); // `.btn` lleva `transition: all .12s`: leer a mitad da 0
  const foco = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { id: document.activeElement.id, boxShadow: s.boxShadow, outline: s.outlineStyle + ' ' + s.outlineWidth }; });
  console.log(ancho, 'foco', JSON.stringify(foco));
  await page.close();
}
await browser.close(); srv.close();

// SCRUM-1577b · captura (sólo lectura) de los dos `select` de Facturación y del selector de color de
// marca, a 320/390/929. Mismo banco que banco-44.mjs. Además de la imagen imprime, por anchura, el
// ancho de página (`scrollWidth` contra `innerWidth`: el color no puede empujar la fila fuera) y la caja
// del color, que a 320 se ENCOGÍA a 18 px de ancho.
// Uso: node captura-1577b.mjs <raiz> <carpeta public> <prefijo de salida>
//
// CONTROL: el `public` de `origin/main` tiene que dar el color a 38 de alto y menos de 48 de ancho a 320
// (lo medido antes del arreglo). Si la fila «antes» no lo da, esta captura no distingue las versiones.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const [RAIZ, PUB] = process.argv.slice(2, 4).map((p) => path.resolve(p));
const PREFIJO = process.argv[4];
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const DATOS = `(r) => /\\/admin\\/merchant$/.test(r) ? { id: 1, name: 'Fontanería Soler', country: 'ES', clausulasPresupuesto: [] } : []`;
const { srv, puerto } = await servirListas(PUB, [{ ruta: '/conf', fnVista: 'renderSettingsView', datos: DATOS, modoEmision: 'fiscal' }]);
const { browser } = await abrirNavegador(puppeteer);
const PESTANAS = [['facturacion', '#retencion-irpf-tipo', '#actividad-tipo'], ['marca', '#brand-color-input']];
for (const ancho of [320, 390, 929]) {
  const { page } = await abrirVista(browser, puerto, '/conf', ancho);
  for (const [pestana, ...sels] of PESTANAS) {
    await page.click(`.settings-nav [data-submenu="${pestana}"]`);
    await new Promise((ok) => setTimeout(ok, 150));
    const r = await page.evaluate((sels) => {
      const cajas = sels.map((s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? `${s} ${b.height.toFixed(1)}×${b.width.toFixed(1)}` : `${s} FALTA`; });
      // El botón de al lado del color: su borde derecho contra el de la tarjeta que lo contiene. El
      // `scrollWidth` NO lo ve (un ancestro recorta): así se midió el primer «después», con el botón cortado.
      const reset = document.querySelector('#brand-color-reset');
      let boton = '';
      if (sels[0] === '#brand-color-input') {
        const b = reset?.getBoundingClientRect();
        const t = reset?.closest('.card, .settings-panel, section')?.getBoundingClientRect();
        boton = !b || !t ? ' · botón o tarjeta FALTA' : ` · botón der ${b.right.toFixed(1)} / tarjeta der ${t.right.toFixed(1)}${b.right > t.right + 0.5 ? ' CORTADO' : ''}`;
      }
      return { cajas, scroll: document.documentElement.scrollWidth, ventana: window.innerWidth, boton };
    }, sels);
    console.log(`@${ancho} ${pestana} · página ${r.scroll}/${r.ventana}${r.scroll > r.ventana ? ' DESBORDA' : ''} · ${r.cajas.join(' · ')}${r.boton}`);
    const el = await page.$(sels[0]);
    const fila = await el.evaluateHandle((e) => e.closest('.field, .form-group') || e.parentElement);
    await fila.asElement().screenshot({ path: `${PREFIJO}-${pestana}-${ancho}.png` });
  }
  await page.close();
}
await browser.close();
srv.close();

// SCRUM-1725j · ¿QUÉ recibe el clic que `guard:lista-trabajos` da en la fila, y por qué no navega?
//
//   node docs/master/evidencias/SCRUM-1725/c1725j-clic-en-fila.mjs
//
// Monta la vista REAL con el mismo fixture que el guard (20 trabajos de muestra, 1280 px) y, para
// CADA fila, mira qué elemento hay en el centro de su `td.cell-client` (donde pulsa puppeteer) y si
// ese elemento, o un antecesor suyo dentro de la fila, es de los que el `click` de la fila deja pasar
// sin navegar (`[data-fila-no-navega]`, `button, a, input, textarea, select, label`). Después pulsa
// la primera fila, como el guard, y dice si navegó.
// Solo LEE. Sale 0 si el clic de la primera fila navega, 1 si no, 2 si no supo mirar.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from '../../../../scripts/_banco-lista.mjs';
import { reglasDeDatos, trabajosDeMuestra } from '../../../../scripts/_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [
  { ruta: '/trabajos20', fnVista: 'renderJobsView', datos: reglasDeDatos(trabajosDeMuestra(20)) },
]);
const { browser } = await abrirNavegador(puppeteer);
let salida = 2;
try {
  const { page } = await abrirVista(browser, puerto, '/trabajos20', 1280);
  const filas = await page.evaluate(() => [...document.querySelectorAll('#view-container tr.jobs-fila')].map((tr) => {
    const td = tr.querySelector('td.cell-client');
    if (!td) return { sinCelda: true };
    // `elementFromPoint` no ve lo que queda fuera de la ventana: cada fila se trae a la vista antes.
    tr.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = td.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const el = document.elementFromPoint(x, y);
    const describe = (n) => (n ? `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''}` : '(nada)');
    const frena = el && (el.closest('[data-fila-no-navega]') || el.closest('button, a, input, textarea, select, label'));
    return {
      celda: `${Math.round(r.width)}×${Math.round(r.height)}`,
      alto: Math.round(tr.getBoundingClientRect().height),
      enElCentro: describe(el),
      dentroDeLaFila: !!(el && tr.contains(el)),
      frena: frena ? describe(frena) : null,
    };
  }));
  if (!filas.length) { console.log('CIEGO: la vista no pintó ninguna fila'); process.exit(2); }
  console.log(`población: ${filas.length} filas a 1280`);
  filas.forEach((f, i) => console.log(`fila ${String(i + 1).padStart(2)} · alto ${f.alto} · celda ${f.celda} · en el centro: ${f.enElCentro}${f.dentroDeLaFila ? '' : ' (FUERA de la fila)'} · ${f.frena ? `lo FRENA ${f.frena}` : 'navegaría'}`));
  const frenadas = filas.filter((f) => f.dentroDeLaFila && f.frena).length;
  const ciegas = filas.filter((f) => !f.dentroDeLaFila).length;
  console.log(`resumen: en ${frenadas} de ${filas.length} filas el centro de la celda de cliente cae en un control que NO navega · ${ciegas} fila(s) sin poder mirar`);
  if (ciegas) { console.log('CIEGO: hay filas cuyo centro no se pudo leer; el resumen no vale'); process.exit(2); }

  await page.evaluate(() => window.scrollTo(0, 0));
  const antes = await page.evaluate('window.__navegaciones.length');
  await page.click('#view-container tr.jobs-fila td.cell-client');
  const nav = await page.evaluate('window.__navegaciones');
  const navego = nav.length === antes + 1 && nav[0] && nav[0].vista === 'jobs-detail';
  console.log(`clic del guard en la primera fila: ${navego ? 'NAVEGÓ' : 'NO navegó'} · ${JSON.stringify(nav)}`);
  salida = navego ? 0 : 1;
} finally {
  await browser.close();
  srv.close();
}
process.exit(salida);

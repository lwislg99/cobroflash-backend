// SCRUM-1725i · sonda LOCAL de los filtros de la lista de Trabajos (pestañas de estado + barra).
//
//   node docs/master/evidencias/SCRUM-1725/c1725i-sonda-local.mjs <carpeta de salida, FUERA del repo>
//
// Monta la vista REAL sobre el banco de listas (`scripts/_banco-lista.mjs`, los 12 trabajos de
// `_trabajos-917.mjs`) y mide lo que una captura no dice, a 1280 y a 390, como admin y como técnico:
//   · desborde horizontal de la página;
//   · alto de cada pestaña y de cada control de la barra (AB6: 44 px);
//   · si la tira de pestañas desplaza, y si la pestaña pulsada queda ENTERA a la vista;
//   · en escritorio, que la caja de filtros y la lista se tocan (0 px entre las dos, mismo ancho);
//   · el subrayado de la pestaña activa (2 px) y el foco por teclado.
// NO escribe en ningún sitio más que en la carpeta de salida. Sale 1 si algo no cuadra, 2 si no supo mirar.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from '../../../../scripts/_banco-lista.mjs';
import { reglasDeDatos } from '../../../../scripts/_trabajos-de-muestra.mjs';
import { TRABAJOS } from '../../../../scripts/_trabajos-917.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SALIDA = process.argv[2];
if (!SALIDA) { console.error('CIEGO: falta la carpeta de salida (fuera del repo)'); process.exit(2); }

const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [
  { ruta: '/t', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS), modoEmision: 'fiscal' },
]);
const { browser } = await abrirNavegador(puppeteer);
let rojos = 0;
const di = (s) => console.log(s);
const exige = (ok, texto) => { di(`${ok ? 'OK  ' : 'ROJO'} ${texto}`); if (!ok) rojos += 1; };

const medir = () => {
  const caja = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), an: Math.round(r.width), al: Math.round(r.height), der: Math.round(r.right), bajo: Math.round(r.bottom) }; };
  const tira = document.querySelector('#jobs-filter .data-card-tabs');
  const raiz = document.scrollingElement;
  const activa = document.querySelector('#jobs-filter .data-card-tab.active');
  return {
    testigo: getComputedStyle(document.querySelector('.jobs-pantalla')).getPropertyValue('--jobs-filtros').trim(),
    rol: window.appUserRole || null,
    desborde: raiz.scrollWidth - window.innerWidth,
    filtros: caja(document.getElementById('jobs-filter')),
    lista: caja(document.querySelector('#jobs-list > .customers-card')),
    tira: tira ? { ...caja(tira), ancho: tira.clientWidth, anchoDeScroll: tira.scrollWidth, scrollLeft: Math.round(tira.scrollLeft) } : null,
    pestanas: [...document.querySelectorAll('#jobs-filter .data-card-tab')].map((b) => ({ texto: b.textContent, pulsada: b.getAttribute('aria-pressed'), ...caja(b) })),
    subrayado: activa ? getComputedStyle(activa).borderBottomWidth + ' ' + getComputedStyle(activa).borderBottomColor : null,
    barra: [...document.querySelectorAll('#jobs-filter .jobs-barra select, #jobs-filter .jobs-barra input')].map((c) => ({ que: c.id || c.className, letra: getComputedStyle(c).fontSize, ...caja(c) })),
    filas: document.querySelectorAll('tr.jobs-fila').length,
  };
};

for (const rol of ['admin', 'tecnico']) {
  for (const ancho of [1280, 390]) {
    const { page, errores } = await abrirVista(browser, puerto, '/t', ancho, ancho < 600 ? 844 : 900);
    if (rol !== 'admin') {
      await page.evaluate(async (r) => { window.appUserRole = r; await window.renderJobsView(document.getElementById('view-container')); }, rol);
      await new Promise((r) => setTimeout(r, 300));
    }
    const m = await page.evaluate(medir);
    const quien = `${rol}@${ancho}`;
    di(`\n── ${quien} · rol en la página: ${m.rol} · ${m.filas} filas · testigo «${m.testigo}»`);
    if (m.testigo !== '1725i' || !m.tira || m.pestanas.length !== 6 || !m.filas) { console.error(`CIEGO (${quien}): no pinta el bloque de esta rama, las 6 pestañas o las filas`); process.exit(2); }
    if (errores.length) { console.error(`CIEGO (${quien}): errores en consola: ${errores.join(' | ')}`); process.exit(2); }
    exige(m.desborde <= 0, `${quien} la página no desborda a lo ancho (${m.desborde} px)`);
    exige(m.pestanas.every((p) => p.al >= 44), `${quien} las 6 pestañas miden ≥44 px de alto (${[...new Set(m.pestanas.map((p) => p.al))].join('/')})`);
    exige(m.barra.every((c) => c.al >= 44), `${quien} los ${m.barra.length} controles de la barra miden ≥44 px (${m.barra.map((c) => c.al).join('/')}) · letra ${[...new Set(m.barra.map((c) => c.letra))].join('/')}`);
    exige((rol === 'admin') === m.barra.some((c) => /jobs-filtro-cobro/.test(c.que)), `${quien} el desplegable de cobro ${rol === 'admin' ? 'está' : 'NO está'}`);
    exige(m.subrayado && m.subrayado.startsWith('2px'), `${quien} la pestaña activa lleva su subrayado de 2 px (${m.subrayado})`);
    if (ancho >= 641) {
      exige(m.lista && m.filtros.bajo === m.lista.y && m.filtros.x === m.lista.x && m.filtros.an === m.lista.an,
        `${quien} la caja de filtros y la lista son UNA pieza: se tocan y miden lo mismo (filtros ${JSON.stringify(m.filtros)} · lista ${JSON.stringify(m.lista)})`);
      exige(m.tira.anchoDeScroll <= m.tira.ancho, `${quien} las 6 pestañas caben sin desplazar (${m.tira.anchoDeScroll} en ${m.tira.ancho})`);
    } else {
      di(`     ${quien} la tira pide ${m.tira.anchoDeScroll} px en ${m.tira.ancho}: ${m.tira.anchoDeScroll > m.tira.ancho ? 'desplaza' : 'cabe'}`);
    }
    await page.screenshot({ path: path.join(SALIDA, `sonda-${rol}-${ancho}.png`), clip: { x: 0, y: 0, width: ancho, height: ancho < 600 ? 760 : 620 } });

    // Se pulsa la ÚLTIMA pestaña («Cerrado»), con el ratón: tiene que quedar pulsada y ENTERA a la vista.
    const ultima = (await page.$$('#jobs-filter .data-card-tab')).pop();
    await ultima.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
    await ultima.click();
    await new Promise((r) => setTimeout(r, 200));
    const t = await page.evaluate(medir);
    const c = t.pestanas[5];
    exige(c.pulsada === 'true' && c.x >= t.tira.x && c.der <= t.tira.der, `${quien} «Cerrado» pulsada queda entera dentro de la tira (x ${c.x}-${c.der} en ${t.tira.x}-${t.tira.der})`);
    exige(t.filas === TRABAJOS.filter((j) => j.status === 'cerrado').length, `${quien} la pestaña «Cerrado» enseña ${t.filas} fila(s)`);
    // Foco por teclado: el anillo va hacia dentro (no lo recorta la tira).
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => { const a = document.activeElement; return a ? { que: a.className || a.id || a.tagName, sombra: getComputedStyle(a).boxShadow } : null; });
    di(`     ${quien} tras Tab, el foco está en «${foco && foco.que}» · sombra ${foco && foco.sombra}`);
    await page.screenshot({ path: path.join(SALIDA, `sonda-${rol}-${ancho}-cerrado.png`), clip: { x: 0, y: 0, width: ancho, height: ancho < 600 ? 620 : 460 } });
    await page.close();
  }
}
await browser.close();
srv.close();
di(`\n${rojos ? 'ROJO' : 'VERDE'}: ${rojos} en rojo · población: 2 roles × 2 anchos sobre ${TRABAJOS.length} trabajos`);
process.exit(rojos ? 1 : 0);

// docs/master/evidencias/SCRUM-1159/medir.mjs — SCRUM-1159
//
// Mide EN NAVEGADOR (Edge vía puppeteer-core, el de la casa) el ÁREA QUE RECIBE EL TOQUE de los
// controles de forma de cobro, a 320, 390 y 1280 px, con el PRODUCTO pintando la página entera
// (`scripts/_banco-lista.mjs`: los mismos scripts que `public/dashboard/index.html`, sólo
// `apiRequest` doblado). NO usa el mini-DOM serializado: c.17188 de SCRUM-1159 pide navegador real.
//
// Población (declarada, no deducida del resultado):
//   · Cobros: los botones de filtro por método (`cobrosView.js`, `role="tab"`): 1 («Todos») +
//     los cubos del arranque, que salen de `cubosDeMetodo` IMPORTADA DE `dist`, como en el banco.
//   · Ficha de factura pendiente: el `<select>` de `selectorMetodoCobro.js` (`#metodo-cobro-factura`).
//
// Controles:
//   · SEMILLA (positivo sembrado, no prestado del árbol): en cada página se siembra un gemelo SIN
//     el `minHeight` en línea —un `button.btn-sm[role=tab]` en la barra y un `select.form-control`
//     junto al real—. TIENE que salir corto; si sale largo o no se mide, la página dice CIEGO.
//   · `--sin-semilla`: no se siembra nada → el instrumento TIENE que decir CIEGO (salida 2).
//   · `--mutar`: quita el `minHeight` en línea de los controles reales antes de medir → TIENEN que
//     salir cortos. Es lo que demuestra qué pieza trabaja.
//
// Salidas: 0 todos ≥ 44 · 1 alguno corto · 2 CIEGO (población o semilla no cuadran) · 3 navegador.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from '../../../../scripts/_banco-lista.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from '../../../../scripts/_medidor-de-toque.mjs';
import { CONTRATOS } from '../../../../scripts/_datos-del-censo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PUBLICO = path.join(RAIZ, 'public');
const require = createRequire(import.meta.url);
const metodo = require(path.join(RAIZ, 'dist/modules/billing/domain/metodoDeCobro.js'));

const ANCHOS = [320, 390, 1280];
const MUTAR = process.argv.includes('--mutar');
const SEMBRAR = !process.argv.includes('--sin-semilla');
// El `<select>` no está en INTERACTIVOS de la casa: se añade aquí para que el árbitro lo reconozca.
const SEL = INTERACTIVOS + ', select';

const CUBOS = metodo.cubosDeMetodo(metodo.ROTULO_SIN_METODO);
const DECLARABLES = metodo.opcionesDeMetodoDeclarable();

// Las respuestas, de los CONTRATOS del censo (las mismas muestras), servidas dentro de la página.
const tabla = CONTRATOS.map((c) => [c.ruta.source, c.ruta.flags, c.dato()]);
const reglasDatos = `(function () {
  window.appCobrosCubos = ${JSON.stringify(CUBOS)};
  window.appMetodosDeclarables = ${JSON.stringify(DECLARABLES)};
  var T = ${JSON.stringify(tabla)}.map(function (x) { return [new RegExp(x[0], x[1]), x[2]]; });
  return function (ruta) {
    var p = String(ruta).replace(/^[a-z]+:\\/\\/[^/]*/i, '').split(/[?#]/)[0];
    var r = T.find(function (x) { return x[0].test(p); });
    return r ? JSON.parse(JSON.stringify(r[1])) : null;
  };
})()`;

const SUPERFICIES = [
  { ruta: '/cobros', fnVista: 'renderCobrosView', datos: reglasDatos, args: '[]',
    reales: '[data-filtro-cobro]', esperados: 1 + CUBOS.length,
    sembrar: `(() => { const b = document.querySelector('[data-filtro-cobro]'); const s = document.createElement('button');
      s.type = 'button'; s.className = 'btn-sm btn-ghost'; s.setAttribute('role', 'tab'); s.textContent = 'SEMILLA';
      s.id = '__semilla'; b.parentNode.appendChild(s); })()` },
  { ruta: '/factura', fnVista: 'renderInvoiceDetailView', datos: reglasDatos, args: '[21]',
    reales: '#metodo-cobro-factura', esperados: 1,
    sembrar: `(() => { const r = document.querySelector('#metodo-cobro-factura'); const s = document.createElement('select');
      s.className = 'form-control'; s.id = '__semilla'; s.appendChild(new Option('SEMILLA', ''));
      r.parentNode.appendChild(s); })()` },
];

const MEDIR = `(async (REALES, SEL, MUTAR) => {
  const reales = [...document.querySelectorAll(REALES)];
  if (MUTAR) reales.forEach((el) => { el.style.minHeight = ''; });
  const ficha = async (el) => {
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    return { texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 28) || el.id, enLinea: el.style.minHeight || '(nada)', ...m };
  };
  const out = [];
  for (const el of reales) out.push(await ficha(el));
  const s = document.getElementById('__semilla');
  return { reales: out, semilla: s ? await ficha(s) : null };
})`;

const { browser, quien } = await abrirNavegador(puppeteer);
const { srv, puerto } = await servirListas(PUBLICO, SUPERFICIES);
let cortos = 0, ciego = 0;
console.log(`navegador: ${quien} · mínimo ${MINIMO_TACTIL} px · ${MUTAR ? 'MUTADO (sin minHeight en línea)' : 'producto tal cual'} · semilla ${SEMBRAR ? 'sí' : 'NO'}`);
for (const s of SUPERFICIES) {
  for (const ancho of ANCHOS) {
    const { page, errores } = await abrirVista(browser, puerto, s.ruta, ancho);
    await page.evaluate(FUENTE_MEDIDOR);
    const hay = await page.evaluate((q) => document.querySelectorAll(q).length, s.reales);
    if (SEMBRAR && hay) await page.evaluate(s.sembrar);
    const r = await page.evaluate(`${MEDIR}(${JSON.stringify(s.reales)}, ${JSON.stringify(SEL)}, ${MUTAR})`);
    await page.close();
    const cab = `${s.fnVista} @${ancho}px`;
    if (errores.length) console.log(`   ⚠️ ${cab} errores de página: ${errores.join(' | ').slice(0, 160)}`);
    if (r.reales.length !== s.esperados) {
      ciego++; console.log(`🔴 CIEGO ${cab}: población ${r.reales.length}, declarada ${s.esperados}`); continue;
    }
    const sem = r.semilla;
    if (!sem || sem.error || !(sem.tocable < MINIMO_TACTIL)) {
      ciego++; console.log(`🔴 CIEGO ${cab}: la semilla ${sem ? `salió ${sem.error || sem.tocable + ' px'}` : 'no está'} — los verdes de aquí no valen`);
    } else {
      console.log(`✅ semilla ${cab}: ${sem.tocable} px (corta, como debe)`);
    }
    for (const m of r.reales) {
      const ok = !m.error && m.tocable >= MINIMO_TACTIL;
      if (m.error) ciego++; else if (!ok) cortos++;
      console.log(`   ${m.error ? '🔴 NO MEDIDO' : ok ? '✅' : '❌ CORTO'} ${cab} «${m.texto}» caja ${m.caja} · toque ${m.tocable ?? '-'} · minHeight en línea ${m.enLinea}${m.error ? ' · ' + m.error : ''}`);
    }
  }
}
await browser.close();
srv.close();
const total = SUPERFICIES.reduce((t, s) => t + s.esperados, 0) * ANCHOS.length;
console.log(`\nRESUMEN · mediciones declaradas ${total} · cortas ${cortos} · ciegas ${ciego}`);
process.exit(ciego ? 2 : cortos ? 1 : 0);

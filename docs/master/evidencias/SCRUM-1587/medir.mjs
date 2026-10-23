// docs/master/evidencias/SCRUM-1587/medir.mjs — SCRUM-1587
//
// Mide EN NAVEGADOR (Edge vía puppeteer-core, el de la casa) el ÁREA QUE RECIBE EL TOQUE del botón
// «Enviar de nuevo» del aviso de correo fallido de la lista de Cobros (`avisoCorreoNoSalio`,
// `cobrosView.js`), a 320, 390 y 1280 px, con el PRODUCTO pintando la página entera
// (`scripts/_banco-lista.mjs`). Mismo esqueleto que `docs/master/evidencias/SCRUM-1583/medir.mjs`.
//
// Por qué el aviso se siembra AQUÍ y no en el contrato del censo: el contrato de `/admin/cobros`
// (`scripts/_datos-del-censo.mjs`, carril S3) trae `correoNoSalio: null`, así que con él el aviso
// no se pinta y `censo:tactil-panel` no ve el botón. Este instrumento le pone `correoNoSalio` a las
// filas con `invoiceId` — sólo para la medición, sin tocar el contrato.
//
// Población (declarada, no deducida del resultado): las filas del contrato que traen `invoiceId`,
// una por fila: cada una pinta un aviso con un botón.
//
// Además del botón imprime el ALTO DE LA FILA (`tr`), la caja del botón y el toque del enlace al
// documento de la misma celda (SCRUM-1583): el arreglo es sólo de toque, y ni la fila puede cambiar
// de alto ni el enlace perder su área.
//
// Controles:
//   · SEMILLA (positivo sembrado, no prestado del árbol): en la misma celda, FUERA del aviso, se
//     siembra un botón con las mismas clases (`btn-secondary btn-sm`), que la regla de SCRUM-1587
//     NO alcanza. TIENE que salir corto; si no, CIEGO — y demuestra que la regla no es `.btn-sm`.
//   · `--sin-semilla`: no se siembra nada → el instrumento TIENE que decir CIEGO (salida 2).
//   · `--mutar`: anula la regla de SCRUM-1587 con una hoja inyectada → el botón TIENE que salir
//     corto. Es lo que demuestra qué pieza trabaja.
//   · `--captura`: PNG de la fila con y sin la regla, que TIENEN que salir idénticos; con dos
//     controles: la misma captura repetida (determinismo) y el `::before` pintado (TIENE que salir
//     distinto). `CAPTURAS_EN=<dir>` guarda los PNG.
//
// Salidas: 0 todos ≥ 44 · 1 alguno corto o cambia el aspecto · 2 CIEGO · 3 navegador.
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
const CAPTURA = process.argv.includes('--captura');
const REALES = 'td.cell-id [data-correo-no-salio] > button';
const ENLACE = 'td.cell-id > a[href="#invoice-detail"]';
const CUBOS = metodo.cubosDeMetodo(metodo.ROTULO_SIN_METODO);
const conAviso = (c) => c.ruta.test('/admin/cobros')
  ? c.dato().map((x) => x.invoiceId != null ? { ...x, correoNoSalio: { clase: 'invoice', invoiceId: x.invoiceId } } : x)
  : c.dato();
const tabla = CONTRATOS.map((c) => [c.ruta.source, c.ruta.flags, conAviso(c)]);
const cobros = conAviso(CONTRATOS.find((c) => c.ruta.test('/admin/cobros')));
const ESPERADOS = cobros.filter((c) => c.invoiceId != null).length;

const reglasDatos = `(function () {
  window.appCobrosCubos = ${JSON.stringify(CUBOS)};
  var T = ${JSON.stringify(tabla)}.map(function (x) { return [new RegExp(x[0], x[1]), x[2]]; });
  return function (ruta) {
    var p = String(ruta).replace(/^[a-z]+:\\/\\/[^/]*/i, '').split(/[?#]/)[0];
    var r = T.find(function (x) { return x[0].test(p); });
    return r ? JSON.parse(JSON.stringify(r[1])) : null;
  };
})()`;

const SUPERFICIES = [{ ruta: '/cobros', fnVista: 'renderCobrosView', datos: reglasDatos, args: '[]' }];

const SEMBRAR_JS = `(() => { const b = document.querySelector(${JSON.stringify(REALES)}); const s = document.createElement('button');
  s.type = 'button'; s.className = 'btn-secondary btn-sm'; s.id = '__semilla'; s.textContent = 'SEMILLA';
  b.closest('td').appendChild(s); })()`;
const MUTAR_JS = `(() => { const st = document.createElement('style');
  st.textContent = ${JSON.stringify(REALES + ' { position: static !important; } ' + REALES + '::before { content: none !important; }')};
  document.head.appendChild(st); })()`;

const MEDIR = `(async (REALES, ENLACE, SEL) => {
  const ficha = async (el) => {
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    const r = el.getBoundingClientRect();
    return { texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 28) || el.id,
      fila: Math.round(el.closest('tr').getBoundingClientRect().height * 10) / 10,
      alto: Math.round(r.height * 10) / 10, ancho: Math.round(r.width * 10) / 10, ...m };
  };
  const out = [];
  for (const el of document.querySelectorAll(REALES)) out.push(await ficha(el));
  const enlaces = [];
  for (const el of document.querySelectorAll(ENLACE)) enlaces.push(await ficha(el));
  const s = document.getElementById('__semilla');
  return { reales: out, enlaces, semilla: s ? await ficha(s) : null };
})`;

const { browser, quien } = await abrirNavegador(puppeteer);
const { srv, puerto } = await servirListas(PUBLICO, SUPERFICIES);
let cortos = 0, ciego = 0;
console.log(`navegador: ${quien} · mínimo ${MINIMO_TACTIL} px · ${MUTAR ? 'MUTADO (regla de SCRUM-1587 anulada)' : 'producto tal cual'} · semilla ${SEMBRAR ? 'sí' : 'NO'} · población declarada ${ESPERADOS} por anchura`);
for (const s of SUPERFICIES) {
  for (const ancho of ANCHOS) {
    const { page, errores } = await abrirVista(browser, puerto, s.ruta, ancho);
    await page.evaluate(FUENTE_MEDIDOR);
    const hay = await page.evaluate((q) => document.querySelectorAll(q).length, REALES);
    if (MUTAR) await page.evaluate(MUTAR_JS);
    if (SEMBRAR && hay) await page.evaluate(SEMBRAR_JS);
    const r = await page.evaluate(`${MEDIR}(${JSON.stringify(REALES)}, ${JSON.stringify(ENLACE)}, ${JSON.stringify(INTERACTIVOS)})`);
    // `--captura` (AB6, capturas antes/después): la fila tal cual y la misma con el `::before`
    // anulado. Si el arreglo sólo toca el toque, los dos PNG salen IDÉNTICOS byte a byte. La semilla
    // se quita antes, para que no salga en ninguna de las dos.
    if (CAPTURA && !MUTAR && hay) {
      await page.evaluate(() => { const s = document.getElementById('__semilla'); if (s) s.remove(); });
      const fila = await page.$(`${REALES}`).then((a) => a.evaluateHandle((el) => el.closest('tr')));
      // Sin esto la captura no es determinista (lo midió SCRUM-1583): `tbody tr:hover` y su transición.
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }' });
      await fila.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.mouse.move(1, 1);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const con = await fila.screenshot();
      const otra = await fila.screenshot();
      const fs = await import('node:fs');
      if (process.env.CAPTURAS_EN) fs.writeFileSync(path.join(process.env.CAPTURAS_EN, `con-${ancho}.png`), con);
      const determinista = Buffer.compare(con, otra) === 0;
      if (!determinista) ciego++;
      console.log(`   · captura @${ancho}px repetida sin cambiar nada: ${determinista ? 'IDÉNTICA (la captura es determinista)' : 'DISTINTA — la captura no es determinista: lo de abajo no vale'}`);
      await page.evaluate(MUTAR_JS);
      const sin = await fila.screenshot();
      if (process.env.CAPTURAS_EN) fs.writeFileSync(path.join(process.env.CAPTURAS_EN, `sin-${ancho}.png`), sin);
      // Positivo sembrado: el mismo `::before`, pintado. TIENE que salir distinto; si no, el
      // comparador no ve nada y el «idénticas» de arriba no vale.
      await page.evaluate(`(() => { const st = document.createElement('style'); st.textContent = ${JSON.stringify(REALES + ' { position: relative !important; } ' + REALES + '::before { content: "" !important; position: absolute !important; inset: -8px 0 !important; background: rgba(255,0,0,.5); }')}; document.head.appendChild(st); })()`);
      const pintado = await fila.screenshot();
      const igual = Buffer.compare(con, sin) === 0;
      const ve = Buffer.compare(con, pintado) !== 0;
      if (!ve) ciego++; else if (!igual) cortos++;
      console.log(`   ${!ve ? '🔴 CIEGO' : igual ? '✅' : '❌'} captura @${ancho}px: con y sin el ::before ${igual ? 'IDÉNTICAS' : 'DISTINTAS'} (${con.length} B / ${sin.length} B) · positivo pintado ${ve ? 'DISTINTO, como debe' : 'IGUAL: comparador ciego'}`);
    }
    await page.close();
    const cab = `${s.fnVista} @${ancho}px`;
    if (errores.length) console.log(`   ⚠️ ${cab} errores de página: ${errores.join(' | ').slice(0, 160)}`);
    if (r.reales.length !== ESPERADOS || ESPERADOS === 0) {
      ciego++; console.log(`🔴 CIEGO ${cab}: población ${r.reales.length}, declarada ${ESPERADOS}`); continue;
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
      console.log(`   ${m.error ? '🔴 NO MEDIDO' : ok ? '✅' : '❌ CORTO'} ${cab} «${m.texto}» caja ${m.caja} · toque ${m.tocable ?? '-'} · alto ${m.alto} · ancho ${m.ancho} · fila ${m.fila}${m.error ? ' · ' + m.error : ''}`);
    }
    // El enlace de SCRUM-1583 comparte celda: el `::before` del botón no le puede robar el toque.
    if (r.enlaces.length !== ESPERADOS) { ciego++; console.log(`🔴 CIEGO ${cab}: enlaces ${r.enlaces.length}, declarados ${ESPERADOS}`); }
    for (const m of r.enlaces) {
      const ok = !m.error && m.tocable >= MINIMO_TACTIL;
      if (m.error) ciego++; else if (!ok) cortos++;
      console.log(`   ${m.error ? '🔴 NO MEDIDO' : ok ? '✅' : '❌ CORTO'} enlace ${cab} «${m.texto}» caja ${m.caja} · toque ${m.tocable ?? '-'}${m.error ? ' · ' + m.error : ''}`);
    }
  }
}
await browser.close();
srv.close();
console.log(`\nRESUMEN · mediciones declaradas ${ESPERADOS * ANCHOS.length} botones + ${ESPERADOS * ANCHOS.length} enlaces · cortas ${cortos} · ciegas ${ciego}`);
process.exit(ciego ? 2 : cortos ? 1 : 0);

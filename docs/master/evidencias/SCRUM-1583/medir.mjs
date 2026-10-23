// docs/master/evidencias/SCRUM-1583/medir.mjs — SCRUM-1583
//
// Mide EN NAVEGADOR (Edge vía puppeteer-core, el de la casa) el ÁREA QUE RECIBE EL TOQUE del enlace
// al documento de cada fila de Cobros («factura F-…», `cobrosView.js`, `td.cell-id > a`), a 320,
// 390 y 1280 px, con el PRODUCTO pintando la página entera (`scripts/_banco-lista.mjs`). Mismo
// esqueleto que `docs/master/evidencias/SCRUM-1159/medir.mjs`.
//
// Población (declarada, no deducida del resultado): las filas del contrato de `/admin/cobros`
// (`scripts/_datos-del-censo.mjs`) que traen `invoiceId` — sólo ésas pintan el enlace.
//
// Además del toque imprime el ALTO DE LA FILA (`tr`) y el ancho del enlace: el arreglo es sólo de
// toque, y una fila que cambia de alto en escritorio sería un cambio de aspecto.
//
// Controles:
//   · SEMILLA (positivo sembrado, no prestado del árbol): en la misma celda se siembra un `<a>` con
//     otro `href`, que la regla de SCRUM-1583 NO alcanza. TIENE que salir corto; si no, CIEGO.
//   · `--sin-semilla`: no se siembra nada → el instrumento TIENE que decir CIEGO (salida 2).
//   · `--mutar`: anula la regla de SCRUM-1583 con una hoja inyectada → el enlace TIENE que salir
//     corto. Es lo que demuestra qué pieza trabaja.
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
const REALES = 'td.cell-id > a[href="#invoice-detail"]';

// `--con-aviso`: la fila trae `correoNoSalio`, y en la MISMA celda, debajo del enlace, se pinta el
// aviso con su botón «Enviar de nuevo». Un `::before` posicionado se pinta encima del contenido en
// flujo: si el área ampliada alcanzara el botón, le robaría el toque. Se mide el botón también.
const CON_AVISO = process.argv.includes('--con-aviso');
const CUBOS = metodo.cubosDeMetodo(metodo.ROTULO_SIN_METODO);
const conAviso = (c) => c.ruta.test('/admin/cobros') && CON_AVISO
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

const SEMBRAR_JS = `(() => { const a = document.querySelector(${JSON.stringify(REALES)}); const s = document.createElement('a');
  s.href = '#semilla'; s.id = '__semilla'; s.textContent = 'SEMILLA'; a.parentNode.appendChild(s); })()`;
const MUTAR_JS = `(() => { const st = document.createElement('style');
  st.textContent = ${JSON.stringify(REALES + '::before { content: none !important; }')};
  document.head.appendChild(st); })()`;

const MEDIR = `(async (REALES, SEL) => {
  const ficha = async (el) => {
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    const r = el.getBoundingClientRect();
    return { texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 28) || el.id,
      fila: Math.round(el.closest('tr').getBoundingClientRect().height * 10) / 10,
      ancho: Math.round(r.width * 10) / 10, ...m };
  };
  const out = [];
  for (const el of document.querySelectorAll(REALES)) out.push(await ficha(el));
  const s = document.getElementById('__semilla');
  const avisos = [];
  for (const b of document.querySelectorAll('td.cell-id [data-correo-no-salio] button')) {
    const m = await window.__areaDeToque(b, SEL, { scroll: true });
    avisos.push({ texto: b.textContent.trim(), ...m });
  }
  return { reales: out, semilla: s ? await ficha(s) : null, avisos };
})`;

const { browser, quien } = await abrirNavegador(puppeteer);
const { srv, puerto } = await servirListas(PUBLICO, SUPERFICIES);
let cortos = 0, ciego = 0;
console.log(`navegador: ${quien} · mínimo ${MINIMO_TACTIL} px · ${MUTAR ? 'MUTADO (regla de SCRUM-1583 anulada)' : 'producto tal cual'} · semilla ${SEMBRAR ? 'sí' : 'NO'} · población declarada ${ESPERADOS} por anchura`);
for (const s of SUPERFICIES) {
  for (const ancho of ANCHOS) {
    const { page, errores } = await abrirVista(browser, puerto, s.ruta, ancho);
    await page.evaluate(FUENTE_MEDIDOR);
    const hay = await page.evaluate((q) => document.querySelectorAll(q).length, REALES);
    if (MUTAR) await page.evaluate(MUTAR_JS);
    if (SEMBRAR && hay) await page.evaluate(SEMBRAR_JS);
    const r = await page.evaluate(`${MEDIR}(${JSON.stringify(REALES)}, ${JSON.stringify(INTERACTIVOS)})`);
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
      console.log(`   ${m.error ? '🔴 NO MEDIDO' : ok ? '✅' : '❌ CORTO'} ${cab} «${m.texto}» caja ${m.caja} · toque ${m.tocable ?? '-'} · ancho ${m.ancho} · fila ${m.fila}${m.error ? ' · ' + m.error : ''}`);
    }
    if (CON_AVISO && r.avisos.length !== ESPERADOS) {
      ciego++; console.log(`🔴 CIEGO ${cab}: botones del aviso ${r.avisos.length}, declarados ${ESPERADOS}`);
    }
    // El botón del aviso es de otra regla (`.btn-sm`): aquí no se juzga contra 44, se IMPRIME para
    // comparar antes y después. Lo que importaría es que BAJE con el arreglo.
    for (const m of r.avisos) console.log(`   · aviso ${cab} «${m.texto}» caja ${m.caja} · toque ${m.tocable ?? '-'}${m.error ? ' · ' + m.error : ''}`);
  }
}
await browser.close();
srv.close();
console.log(`\nRESUMEN · mediciones declaradas ${ESPERADOS * ANCHOS.length} · cortas ${cortos} · ciegas ${ciego}`);
process.exit(ciego ? 2 : cortos ? 1 : 0);

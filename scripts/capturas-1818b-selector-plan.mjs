// scripts/capturas-1818b-selector-plan.mjs — SCRUM-1818b (S2)
//
// LAS CAPTURAS DEL SELECTOR DE PLAN en la tarjeta «Funnel de plataforma» de Informes (solo fundador),
// ANTES (merge-base de la rama) y DESPUÉS, a 390 y 1280, con 20 comercios:
//   · la fila del PRIMER comercio, con su selector «Plan de …» y «Cambiar plan»;
//   · la ÚLTIMA fila (comercio 20), que antes no salía por el tope de 15.
//
// Uso: `node scripts/capturas-1818b-selector-plan.mjs`  →  `docs/master/evidencias/SCRUM-1818b/`
//
// MIDE y lo dice: si el selector y el botón están, su alto (44 px de toque), si caben en el ancho de la
// ventana una vez desplazada la tabla hasta ellos, y si la PÁGINA desborda (la tabla tiene su propio
// scroll horizontal; la página no). CONTROL POSITIVO: ANTES no hay selector ni comercio 20. Sale con 1
// si DESPUÉS falla algo; con 2 si no supo mirar. ⚠️ La foto no prueba el PUT ni los literales: eso lo
// prueba `tests/scrum1818b-selector-de-plan.test.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-1818b');

const NOMBRES = ['Fontanería Soler', 'Electricidad Ruiz e Hijos S.L.', 'Climatización Levante', 'Reformas Hnos. García'];
const COMERCIOS = Array.from({ length: 20 }, (_, i) => ({
  id: 200 + i, name: i < NOMBRES.length ? NOMBRES[i] : `Comercio de prueba ${i + 1}`, registeredAt: '2026-11-01T10:00:00Z',
  acquisitionSource: i % 3 ? null : 'demo', plan: ['trial', 'pro', 'founding', 'equipo'][i % 4],
  quotes: 20 - i, sent: 12 - (i % 12), accepted: 6 - (i % 6), collectedCount: i % 3, collectedAmount: 1250.5 * (i % 3),
}));
const FUNNEL = {
  steps: { registered: 20, firstQuote: 14, sent: 11, accepted: 7, collected: 4 },
  paidVia: {}, quoteCreatedVia: {}, bySource: [], merchants: COMERCIOS,
};
const datos = `(function () {
  return function (ruta) {
    if (/\\/admin\\/metrics\\/platform-funnel/.test(ruta)) return ${JSON.stringify(FUNNEL)};
    return {};
  };
})()`;
const RUTAS = [{ ruta: '/informes', fnVista: 'renderReportsView', modoEmision: 'fiscal', args: '[]', datos }];

const QUIETO = "document.getAnimations().every((a) => a.playState !== 'running')";

/** Fila `n` (1 = primera): la lleva a la vista (también en horizontal) y mide sus controles. En la página. */
const MEDIR = `(n) => {
  const filas = [...document.querySelectorAll('#view-container table tbody tr')]
    .filter((tr) => tr.querySelector('td') && /Comercio|Fontanería|Electricidad|Climatización|Reformas/.test(tr.textContent));
  const tr = n === 'ultima' ? filas[filas.length - 1] : filas[n - 1];
  if (!tr) return { filas: filas.length, fila: false };
  const sel = tr.querySelector('select');
  const btn = [...tr.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cambiar plan') || null;
  (btn || sel || tr).scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  const caja = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
  const cabe = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; };
  return {
    filas: filas.length, fila: true, nombre: tr.querySelector('td').textContent.trim(),
    selector: caja(sel), boton: caja(btn), cabeSelector: cabe(sel), cabeBoton: cabe(btn),
    aria: sel ? sel.getAttribute('aria-label') : null,
    desborde: document.documentElement.scrollWidth > window.innerWidth,
  };
}`;

const ESCENAS = [
  { nombre: 'primera-fila', fila: 1 },
  { nombre: 'ultima-fila', fila: 'ultima' },
];

fs.mkdirSync(DESTINO, { recursive: true });
const antes = arbolDePartida(RAIZ, 'antes-1818b');
if (!antes.publico) { console.error('🔴 NO SUPE MIRAR: no resuelvo el merge-base de la rama'); process.exit(2); }
const { browser } = await abrirNavegador(puppeteer);
const filas = [];
try {
  for (const [etiqueta, publico] of [['antes', antes.publico], ['despues', path.join(RAIZ, 'public')]]) {
    const { srv, puerto } = await servirListas(publico, RUTAS);
    try {
      for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
        for (const e of ESCENAS) {
          const { page, errores } = await abrirVista(browser, puerto, '/informes', ancho, alto);
          await page.waitForFunction(QUIETO, { timeout: 20000 });
          // La tarjeta del funnel carga sin `await`: se espera a que su tabla tenga filas.
          const llego = await page.waitForFunction(() => document.querySelectorAll('#view-container table tbody tr').length > 5, { timeout: 20000 })
            .then(() => true, () => false);
          const m = llego ? await page.evaluate(`(${MEDIR})(${JSON.stringify(e.fila)})`) : { fila: false, filas: 0 };
          await new Promise((ok) => setTimeout(ok, 150));
          const fichero = `${e.nombre}-${etiqueta}-${ancho}.png`;
          await page.screenshot({ path: path.join(DESTINO, fichero) });
          filas.push({ fichero, etiqueta, ancho, escena: e.nombre, corte: llego ? null : 'la tabla del funnel no se pinta', errores: errores.length, ...m });
          await page.close();
        }
      }
    } finally { srv.close(); }
  }
} finally {
  await browser.close();
  antes.limpiar();
}

for (const f of filas) {
  console.log(`${f.fichero} · filas=${f.filas} · «${f.nombre ?? '—'}» · selector=${JSON.stringify(f.selector ?? null)} cabe=${f.cabeSelector ?? null}`
    + ` · botón=${JSON.stringify(f.boton ?? null)} cabe=${f.cabeBoton ?? null} · aria=${f.aria ?? null} · desborde=${f.desborde ?? null}`
    + `${f.corte ? ` · CORTE: ${f.corte}` : ''}${f.errores ? ` · errores de consola: ${f.errores}` : ''}`);
}
const ciegas = filas.filter((f) => f.corte);
const despues = filas.filter((f) => f.etiqueta === 'despues' && !f.corte);
const malas = despues.filter((f) => f.filas !== 20 || !f.selector || !f.boton || !f.cabeSelector || !f.cabeBoton
  || f.selector[3] < 44 || f.boton[3] < 44 || f.desborde || f.errores);
// CONTROL POSITIVO: ANTES hay 15 filas y ningún selector. Si el instrumento ve uno, no distingue.
const antesMal = filas.filter((f) => f.etiqueta === 'antes' && !f.corte && (f.selector || f.filas !== 15));
console.log(`capturas: ${filas.length} de ${ESCENAS.length * 4} · sin llegar: ${ciegas.length} · después con defecto: ${malas.length} · antes que no es el de antes (debe ser 0): ${antesMal.length}`);
if (malas.length) process.exitCode = 1;
else if (ciegas.length || antesMal.length || filas.length !== ESCENAS.length * 4) process.exitCode = 2;

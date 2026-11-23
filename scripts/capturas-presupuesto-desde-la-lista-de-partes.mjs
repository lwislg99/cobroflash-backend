// scripts/capturas-presupuesto-desde-la-lista-de-partes.mjs — SCRUM-915c
//
// «+ Nuevo presupuesto» en la FILA del parte firmado (sección «Partes» de la ficha del trabajo),
// antes y después, a 390 y 1280. Mide: el botón existe sólo en el «después», sólo en la fila
// firmada, cuánto mide, y que la página no se ensancha. Pulsa y lee lo que el panel recibió.
//
// ⚠️ DOBLE DECLARADO: `window.partePlantillaDelPresupuesto` aún NO está en main (lo añade S4 en
// scrum-1762d). Sin él el botón no se pinta (fallback defensivo), así que la foto del «después» lo
// pone con un doble que devuelve una plantilla fija. El viaje real lo prueba el test.
//
// Uso: `node scripts/capturas-presupuesto-desde-la-lista-de-partes.mjs` → docs/master/evidencias/SCRUM-915c/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-915c');
const AYER = new Date(Date.now() - 86400000).toISOString();
const HACE3 = new Date(Date.now() - 3 * 86400000).toISOString();
const PARTES = [
  { id: 23, numero: 'PT-2026-023', estado: 'borrador', fecha: AYER, jobId: 7 },
  { id: 22, numero: 'PT-2026-022', estado: 'firmado', fecha: HACE3, jobId: 7 },
];
const TRABAJO = {
  id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  customer: { id: 3, name: 'Comunidad Los Olivos' }, asignados: [], operario: null,
  albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null, partes: PARTES,
};
const PLANTILLA = { deTrabajo: { jobId: 7, customerId: 3 }, lines: [{ concept: 'Sustitución de la bomba', qty: 2 }] };
const datos = (conDoble) => `(function () {
  ${conDoble ? `window.partePlantillaDelPresupuesto = function () { return ${JSON.stringify(PLANTILLA)}; };` : ''}
  return function (ruta) {
    if (/\\/admin\\/team/.test(ruta)) return [];
    if (/\\/admin\\/merchant/.test(ruta)) return { id: 1, name: 'Fontanería Soler', timezone: 'Europe/Madrid' };
    if (/\\/admin\\/partes\\/22$/.test(ruta)) return { id: 22, jobId: 7, customerId: 3 };
    if (/\\/admin\\/partes/.test(ruta)) return { partes: ${JSON.stringify(PARTES)} };
    if (/gastos/.test(ruta)) return [];
    return ${JSON.stringify(TRABAJO)};
  };
})()`;

const QUIETO = "document.getAnimations().every((a) => a.playState !== 'running')";
const ANCHOS = [[390, 844], [1280, 900]];
let salida = 0;
const fallo = (c, t) => { console.error('🔴 ' + t); salida = Math.max(salida, c); };

const partida = arbolDePartida(RAIZ, 'antes-915c');
if (!partida.publico) { console.error('🔴 NO SUPE MIRAR: sin merge-base no hay «antes».'); process.exit(2); }
fs.mkdirSync(DESTINO, { recursive: true });
const { browser } = await abrirNavegador(puppeteer);
const antes = await servirListas(partida.publico, [{ ruta: '/ficha', fnVista: 'renderJobDetailView', datos: datos(true), args: '[7]' }]);
const despues = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/ficha', fnVista: 'renderJobDetailView', datos: datos(true), args: '[7]' }]);
const filas = [];

async function foto(etiqueta, puerto, ancho, alto) {
  const { page, errores } = await abrirVista(browser, puerto, '/ficha', ancho, alto);
  if (errores.length) fallo(1, `${etiqueta} ${ancho}: errores en consola: ${errores.join(' | ')}`);
  await page.waitForFunction(QUIETO, { timeout: 5000 }).catch(() => {});
  // Si la sección vive en una pestaña, se abre la de «Partes».
  await page.evaluate(() => {
    const sec = document.querySelector('[data-seccion="partes"]');
    if (sec && sec.offsetParent) return;
    const tab = [...document.querySelectorAll('[role="tab"],button')].find((b) => b.textContent.trim().startsWith('Partes'));
    if (tab) tab.click();
  });
  const m = await page.evaluate(() => {
    const sec = document.querySelector('[data-seccion="partes"]');
    const b = document.querySelector('[data-parte-fila-presupuesto]');
    const caja = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { ancho: Math.round(r.width), alto: Math.round(r.height), der: Math.round(r.right) }; };
    const tarjeta = b && b.closest('tr');
    return {
      seccion: !!(sec && sec.offsetParent), botones: document.querySelectorAll('[data-parte-fila-presupuesto]').length,
      deQuien: b ? b.getAttribute('data-parte-fila-presupuesto') : null, boton: caja(b), fila: caja(tarjeta),
      texto: b ? b.textContent : null, desborda: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  if (!m.seccion) { fallo(2, `NO SUPE MIRAR: ${etiqueta} ${ancho} no enseña la sección «Partes».`); await page.close(); return; }
  await page.evaluate(() => document.querySelector('[data-seccion="partes"]').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: path.join(DESTINO, `ficha-partes-${etiqueta}-${ancho}.png`) });
  filas.push({ etiqueta, ancho, ...m });
  if (etiqueta === 'antes' && m.botones) fallo(1, `antes ${ancho}: el punto de partida YA tiene el botón.`);
  if (etiqueta === 'despues') {
    if (m.botones !== 1 || m.deQuien !== '22') fallo(1, `despues ${ancho}: ${m.botones} botones (de ${m.deQuien}); se espera 1, en la fila firmada 22.`);
    if (m.boton && m.boton.alto < 44) fallo(1, `despues ${ancho}: mide ${m.boton.alto} px de alto (< 44).`);
    if (m.boton && m.fila && m.boton.der > m.fila.der) fallo(1, `despues ${ancho}: el botón se sale de la fila.`);
    if (m.desborda > 0) fallo(1, `despues ${ancho}: la página se ensancha ${m.desborda} px.`);
    if (m.boton) {
      await page.click('[data-parte-fila-presupuesto]');
      await new Promise((r) => setTimeout(r, 100));
      const nav = await page.evaluate('window.__navegaciones');
      if (nav.length !== 1 || nav[0].vista !== 'quotes-new' || JSON.stringify(nav[0].params.template) !== JSON.stringify(PLANTILLA)) fallo(1, `despues ${ancho}: el clic no abrió el editor con la plantilla: ${JSON.stringify(nav)}`);
    }
  }
  await page.close();
}

try {
  for (const [ancho, alto] of ANCHOS) {
    await foto('antes', antes.puerto, ancho, alto);
    await foto('despues', despues.puerto, ancho, alto);
  }
} finally {
  await browser.close(); antes.srv.close(); despues.srv.close(); partida.limpiar();
}
console.log(`punto de partida («antes»): ${partida.base.sha}`);
for (const f of filas) console.log(`${f.etiqueta.padEnd(7)} ${String(f.ancho).padStart(4)} · botones: ${f.botones} (fila ${f.deQuien}) · ${f.boton ? `${f.boton.ancho}×${f.boton.alto} «${f.texto}»` : 'no hay'} · desborda: ${f.desborda}`);
console.log(salida === 0 ? `✔ ${filas.length} capturas en ${path.relative(RAIZ, DESTINO)}` : `✖ salida ${salida}`);
process.exit(salida);

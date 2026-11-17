// scripts/capturas-aviso-visita-nueva.mjs — SCRUM-1751
//
// LAS CAPTURAS DEL AVISO «¿Empezar una visita nueva?», DESDE LAS DOS PUERTAS, a 390 y 1280.
//
// Uso: `node scripts/capturas-aviso-visita-nueva.mjs`  →  `docs/master/evidencias/SCRUM-1751/`
//
// Monta la lista de Trabajos y la ficha de un trabajo en un navegador de verdad, con los scripts
// REALES del panel (`_banco-lista.mjs`), y con un parte FIRMADO y ningún borrador: el caso en que
// el aviso sale. Pulsa la puerta, espera a que el modal deje de animarse (medir a media animación
// da cifras falsas: SCRUM-1745) y fotografía.
//
// Además de la foto, MIDE y lo dice: que el aviso cabe en el ancho, que el texto no se corta y
// cuánto miden los dos botones. Sale con 1 si el aviso no aparece o no cabe; con 2 si no supo mirar.
//
// ⚠️ Una captura no prueba que el aviso decida bien: eso lo prueba
// `tests/scrum1751-aviso-de-visita-nueva.test.mjs`. Esto sólo enseña cómo se ve.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from './_banco-lista.mjs';
import { reglasDeDatos } from './_trabajos-de-muestra.mjs';
import { TRABAJOS } from './_trabajos-917.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-1751');

const enCurso = TRABAJOS.find((t) => t.status === 'en_curso');
if (!enCurso) {
  console.error('🔴 NO SUPE MIRAR: los trabajos de muestra no traen ninguno EN CURSO; sin él no hay «Abrir parte».');
  process.exit(2);
}
const AYER = new Date(Date.now() - 86400000).toISOString();
const firmadoDe = (jobId) => ({ id: 22, numero: 'PT-2026-022', estado: 'firmado', fecha: AYER, jobId });

const datosLista = `(function (ruta, opciones) {
  if (/\\/admin\\/partes/.test(ruta)) return { partes: [${JSON.stringify(firmadoDe(enCurso.id))}] };
  return ${reglasDeDatos(TRABAJOS)}(ruta, opciones);
})`;

const TRABAJO_DE_LA_FICHA = {
  id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  customer: { id: 3, name: 'Comunidad Los Olivos' }, asignados: [], operario: null,
  albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null,
  partes: [firmadoDe(7)],
};
const datosFicha = `(function (ruta) {
  if (/\\/admin\\/team/.test(ruta)) return [];
  if (/\\/admin\\/merchant/.test(ruta)) return { id: 1, name: 'Fontanería Soler', timezone: 'Europe/Madrid' };
  if (/\\/admin\\/partes/.test(ruta)) return { partes: [${JSON.stringify(firmadoDe(7))}] };
  if (/gastos/.test(ruta)) return [];
  return ${JSON.stringify(TRABAJO_DE_LA_FICHA)};
})`;

const RUTAS = [
  { ruta: '/lista', fnVista: 'renderJobsView', datos: datosLista },
  { ruta: '/ficha', fnVista: 'renderJobDetailView', datos: datosFicha, args: '[7]' },
];

/** Ninguna animación en marcha. Se evalúa DENTRO de la página. */
const QUIETO = () => document.getAnimations().every((a) => a.playState !== 'running');

fs.mkdirSync(DESTINO, { recursive: true });
const { browser } = await abrirNavegador(puppeteer);
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), RUTAS);
const filas = [];
try {
  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    for (const [ruta, nombre] of [['/lista', 'lista'], ['/ficha', 'ficha']]) {
      const { page, errores } = await abrirVista(browser, puerto, ruta, ancho, alto);
      if (errores.length) { console.error(`🔴 ${nombre} ${ancho}: errores en consola: ${errores.join(' | ')}`); process.exitCode = 1; }
      const puerta = await page.$('#view-container [data-abrir-parte]');
      if (!puerta) { console.error(`🔴 NO SUPE MIRAR: ${nombre} ${ancho} no pinta la puerta al parte.`); process.exitCode = 2; await page.close(); continue; }
      // 🔴 QUIETA LA PANTALLA ANTES DE PULSAR. El clic del navegador va a unas COORDENADAS: medido en
      // este mismo script, con el desplazamiento todavía en marcha el clic caía en la tarjeta de la
      // fila (navegaba a la ficha) y el aviso «no salía» una pasada sí y otra no. Por eso el
      // desplazamiento es `instant` y se espera a que la puerta deje de moverse, no sólo a las
      // animaciones (`getAnimations()` no ve un desplazamiento suave).
      await puerta.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForFunction(QUIETO, { timeout: 20000 });
      await puerta.evaluate((b) => new Promise((hecho) => {
        let antes = null; let iguales = 0;
        const mira = () => {
          const r = b.getBoundingClientRect(); const ahora = `${r.left},${r.top}`;
          iguales = ahora === antes ? iguales + 1 : 0; antes = ahora;
          if (iguales >= 5) hecho(); else requestAnimationFrame(mira);
        };
        mira();
      }));
      const diana = await puerta.evaluate((b) => {
        const r = b.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { esLaPuerta: e === b, encima: e ? `${e.tagName}.${e.className}` : null, caja: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
      });
      await puerta.click();
      try {
        await page.waitForSelector('.jobs-modal', { timeout: 20000 });
      } catch (_e) {
        const tras = await page.evaluate(() => ({ navegaciones: window.__navegaciones, errores: window.__errores }));
        console.error(`🔴 ${nombre} ${ancho}: se pulsó la puerta y el aviso NO salió. diana=${JSON.stringify(diana)} tras=${JSON.stringify(tras)}`);
        process.exitCode = 1; await page.close(); continue;
      }
      // Quietas las animaciones del modal antes de medir (SCRUM-1745).
      await page.waitForFunction(QUIETO, { timeout: 20000 });
      const m = await page.evaluate(() => {
        const caja = (n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), an: Math.round(r.width), al: Math.round(r.height) }; };
        const modal = document.querySelector('.jobs-modal');
        const frase = modal.querySelector('.jobs-modal-cuerpo p');
        const botones = [...modal.querySelectorAll('.jobs-modal-pie button')];
        return {
          titulo: modal.querySelector('.jobs-modal-titulo').textContent,
          cuerpo: frase ? frase.textContent : null,
          modal: caja(modal),
          cortado: frase ? frase.scrollWidth > frase.clientWidth : null,
          botones: botones.map((b) => ({ rotulo: b.textContent, ...caja(b) })),
          desbordeHorizontal: document.documentElement.scrollWidth > window.innerWidth,
          altas: (window.__navegaciones || []).length,
        };
      });
      const cabe = m.modal.x >= 0 && m.modal.x + m.modal.an <= ancho && m.modal.y >= 0 && m.modal.y + m.modal.al <= alto;
      const dentro = m.botones.every((b) => b.x >= m.modal.x && b.x + b.an <= m.modal.x + m.modal.an);
      if (!cabe || !dentro || m.cortado || m.desbordeHorizontal) process.exitCode = 1;
      const fichero = `aviso-${nombre}-${ancho}.png`;
      await page.screenshot({ path: path.join(DESTINO, fichero) });
      filas.push({ fichero, ancho, ...m, cabe, botonesDentro: dentro });
      await page.close();
    }
  }
} finally {
  await browser.close();
  srv.close();
}

for (const f of filas) {
  console.log(`${f.fichero} · modal ${f.modal.an}×${f.modal.al} en (${f.modal.x},${f.modal.y}) · cabe=${f.cabe} · botones dentro=${f.botonesDentro} · texto cortado=${f.cortado} · desborde horizontal=${f.desbordeHorizontal}`);
  console.log(`    «${f.titulo}» · ${f.botones.map((b) => `«${b.rotulo}» ${b.an}×${b.al}`).join(' · ')}`);
}
console.log(`capturas: ${filas.length} de 4 (2 puertas × 2 anchos) en ${path.relative(RAIZ, DESTINO)}`);
if (filas.length !== 4 && !process.exitCode) process.exitCode = 2;

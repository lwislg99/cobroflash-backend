// scripts/capturas-lista-trabajos.mjs — SCRUM-816
//
// LAS CAPTURAS DE LA LISTA DE TRABAJOS, a 390 y 1280 px, con 20 Trabajos y con 1.
//
// 🔴 `page.setViewport` REAL, nunca `--window-size`: aquel fija la ventana del navegador, no el
// viewport, y la diferencia son los bordes y la barra de pestañas — o sea, se mide un ancho que
// no es el que ve el usuario.
//
// Uso: `node scripts/capturas-lista-trabajos.mjs antes|despues`
// Salen en `docs/capturas/scrum-816/<momento>/`. El fixture es el MISMO que usa el guard
// (`scripts/_trabajos-de-muestra.mjs`): dos copias del mismo fixture acabarían fotografiando una
// pantalla y vigilando otra.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';
import { trabajosDeMuestra, reglasDeDatos } from './_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOMENTO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const DESTINO = path.join(RAIZ, 'docs', 'capturas', 'scrum-816', MOMENTO);
fs.mkdirSync(DESTINO, { recursive: true });

// ═══ EL «ANTES» NO SE FOTOGRAFÍA A MANO NI SE GUARDA DE UNA PASADA VIEJA ════════════════════
//
// 🔴 Un «antes» que hay que acordarse de sacar ANTES caduca en cuanto alguien vuelve a correr el
// script con el árbol ya cambiado — y entonces las dos capturas son la misma y el par no prueba
// nada. Aquí el «antes» se materializa desde el PUNTO DE PARTIDA de la rama en cada pasada: es
// reproducible hoy y dentro de un mes. (Contra `merge-base` y no contra la punta de `origin/main`;
// el porqué está en `arbolDePartida`.)
//
// 🔴 Y EL DATO TAMBIÉN ES EL DE ANTES. `serializeJob` no mandaba `albaranes` ni `invoices`, así
// que servirle al código viejo un lote que SÍ los trae fotografiaría una pantalla que nunca
// existió: la escalera decidiría bien y el defecto de las veinte filas iguales no saldría en la
// imagen. `conDocumentos: false` reproduce lo que el servidor mandaba de verdad.
const DESDE_LA_BASE = MOMENTO === 'antes';
const conDocumentos = !DESDE_LA_BASE;

let PUBLICO = path.join(RAIZ, 'public');
let partida = null;
if (DESDE_LA_BASE) {
  partida = arbolDePartida(RAIZ, 'capturas');
  if (!partida.base) {
    console.error('🔴 NO SUPE MIRAR: no pude resolver el punto de partida de la rama (`merge-base`).');
    process.exit(2);
  }
  if (partida.ficheros.length < 50) {
    console.error(`🔴 NO SUPE MIRAR: la base dio ${partida.ficheros.length} ficheros de public/.`);
    process.exit(2);
  }
  PUBLICO = partida.publico;
  console.log(`base de la rama: ${partida.base.sha} (vía ${partida.base.ref}) · ${partida.ficheros.length} ficheros`);
}

const RUTAS = [
  { ruta: '/trabajos20', fnVista: 'renderJobsView', datos: reglasDeDatos(trabajosDeMuestra(20, { conDocumentos })), nombre: '20-trabajos' },
  { ruta: '/trabajos1', fnVista: 'renderJobsView', datos: reglasDeDatos(trabajosDeMuestra(1, { conDocumentos })), nombre: '1-trabajo' },
];

const { srv, puerto } = await servirListas(PUBLICO, RUTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
console.log(`navegador: ${quien}  ·  momento: ${MOMENTO}\n`);

let desbordes = 0;
for (const ancho of [390, 1280]) {
  for (const v of RUTAS) {
    const { page, errores } = await abrirVista(browser, puerto, v.ruta, ancho, ancho === 390 ? 844 : 900);
    if (errores.length) console.log(`  ⚠️ ${v.nombre} @${ancho}: ${errores.join(' | ')}`);
    const m = await page.evaluate(`(() => {
      const t = document.querySelector('#view-container table.table');
      return {
        vp: window.innerWidth,
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        tabla: t ? +t.getBoundingClientRect().width.toFixed(1) : null,
        filas: document.querySelectorAll('#view-container tr.jobs-fila').length,
      };
    })()`);
    // El árbitro es `scrollWidth`: `html { overflow-x: clip }` esconde la barra pero no encoge el
    // contenido, así que «no se ve scroll» daría verde con la página desbordada.
    const desborda = m.doc > m.vp + 0.5 || m.body > m.vp + 0.5;
    if (desborda) desbordes += 1;
    const fichero = path.join(DESTINO, `${v.nombre}-${ancho}px.png`);
    await page.screenshot({ path: fichero, fullPage: true });
    console.log(`  ${v.nombre} @ ${ancho} px · tabla ${m.tabla} px · ${m.filas} filas · scroll horizontal: ${desborda ? '🔴 SÍ' : 'no'}`);
    console.log(`      → ${path.relative(RAIZ, fichero).replace(/\\/g, '/')}`);
    await page.close();
  }
}

await browser.close();
srv.close();
if (partida) partida.limpiar();
if (desbordes) { console.error(`\n🔴 ${desbordes} pantalla(s) con scroll horizontal.`); process.exit(1); }
console.log('\n✅ cero scroll horizontal en los dos anchos, con 20 trabajos y con 1.');

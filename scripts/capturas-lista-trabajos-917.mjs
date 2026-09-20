// scripts/capturas-lista-trabajos-917.mjs — SCRUM-917c
//
// LAS CAPTURAS ANTES / DESPUÉS DE LA LISTA DE TRABAJOS REDISEÑADA (checklist AB6), a 1280 y 390.
//
// Uso: `node scripts/capturas-lista-trabajos-917.mjs`  →  `docs/capturas/scrum-917c/{antes,despues}/`
//
// El «antes» se materializa desde el PUNTO DE PARTIDA de la rama (`arbolDePartida`, merge-base), en
// cada pasada: un «antes» guardado de una pasada vieja caduca y deja dos fotos iguales que no
// prueban nada (la razón está escrita en `capturas-lista-trabajos.mjs`, SCRUM-816). Los datos son
// los MISMOS que mide el guard (`_trabajos-917.mjs`).
//
// ⚠️ Una captura no prueba que un botón funcione: eso lo prueba `guard:lista-trabajos-917`, que
// pulsa. Esto sólo enseña cómo se ve.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';
import { reglasDeDatos } from './_trabajos-de-muestra.mjs';
import { TRABAJOS } from './_trabajos-917.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'capturas', 'scrum-917c');

const RUTAS = [
  { ruta: '/t', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS) },
  { ruta: '/t-sin-equipo', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS).replace('D.equipo', '[]') },
];

const partida = arbolDePartida(RAIZ, 'capturas-917');
if (!partida.base) {
  console.error('🔴 NO SUPE MIRAR: no pude resolver el punto de partida de la rama. Sin «antes» no hay par.');
  process.exit(2);
}
const { browser } = await abrirNavegador(puppeteer);
let fotos = 0;
for (const [momento, publico] of [['antes', partida.publico], ['despues', path.join(RAIZ, 'public')]]) {
  const dir = path.join(DESTINO, momento);
  fs.mkdirSync(dir, { recursive: true });
  const { srv, puerto } = await servirListas(publico, RUTAS);
  for (const [ancho, alto] of [[1280, 900], [390, 844]]) {
    for (const [ruta, nombre] of [['/t', 'lista'], ['/t-sin-equipo', 'lista-sin-equipo']]) {
      const { page, errores } = await abrirVista(browser, puerto, ruta, ancho, alto);
      if (errores.length) { console.error(`🔴 ${momento} ${ruta} ${ancho}: errores en consola: ${errores.join(' | ')}`); process.exitCode = 1; }
      const filas = await page.evaluate(() => document.querySelectorAll('#view-container tr.jobs-fila').length);
      if (filas < 5) { console.error(`🔴 NO SUPE MIRAR: ${momento} ${ruta} ${ancho} pintó ${filas} filas`); process.exitCode = 2; }
      const f = path.join(dir, `${ancho}-${nombre}.png`);
      await page.screenshot({ path: f, fullPage: true });
      console.log(`   ${momento} · ${ancho} px · ${nombre} · ${filas} filas → ${path.relative(RAIZ, f)}`);
      fotos += 1;
      await page.close();
    }
  }
  srv.close();
}
await browser.close();
partida.limpiar();
console.log(`${fotos} capturas · base ${partida.base.sha}`);

// SCRUM-1442c · captura PNG de las tarjetas de opción de la página 1 de un PDF.
// Uso: node docs/master/evidencias/SCRUM-1442/capturar-tarjeta.mjs <pdf> <png>
// Pinta con pdf.js el pintor de SCRUM-1589 (`1589-visto/pintar-pdf.html`) en el Chrome de la máquina
// y recorta la franja de las tarjetas (de «Opciones disponibles» al pie de las tres cajas).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const [pdf, png] = process.argv.slice(2);
const pintor = 'file:///' + path.join(RAIZ, 'docs/master/evidencias/SCRUM-1589/1589-visto/pintar-pdf.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ESCALA = 2;

const nav = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
try {
  const p = await nav.newPage();
  await p.setViewport({ width: 1240, height: 1754 });
  await p.goto(pintor, { waitUntil: 'networkidle0' });
  const { w, h } = await p.evaluate((b64, e) => window.pintar(b64, e), fs.readFileSync(pdf).toString('base64'), ESCALA);
  await p.setViewport({ width: Math.ceil(w), height: Math.ceil(h) });
  // Franja de las tarjetas: se busca en el lienzo, no a ojo — de la primera fila con tinta verde
  // (#22c55e, la cabecera de la opción recomendada) menos 40 pt, hasta 150 pt por debajo.
  const y = await p.evaluate(() => {
    const c = document.getElementById('c'); const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    for (let fila = 0; fila < c.height; fila++) for (let x = 0; x < c.width; x += 4) {
      const i = (fila * c.width + x) * 4;
      if (d[i] === 0x22 && d[i + 1] === 0xc5 && d[i + 2] === 0x5e) return fila;
    }
    return -1;
  });
  if (y < 0) throw new Error('CIEGO: no encuentro la cabecera verde de la opción recomendada en la página 1');
  // Las tarjetas salen en ESCALERA (cada una empieza donde acabó la anterior): se recorta desde
  // 140 pt por encima de la verde (la primera tarjeta) hasta 340 pt de alto (la tercera entera).
  const top = Math.max(0, y - 140 * ESCALA);
  await p.screenshot({ path: png, clip: { x: 0, y: top, width: Math.ceil(w), height: 340 * ESCALA } });
  console.log(`captura ${png} · ${Math.ceil(w)}×${340 * ESCALA} desde y=${top}`);
} finally { await nav.close(); }

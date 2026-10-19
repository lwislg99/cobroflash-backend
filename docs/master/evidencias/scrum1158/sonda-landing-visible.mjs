// Sonda (S3, SCRUM-1158 pregunta 2b): ¿se VEN, en un navegador real, los textos de SCRUM-1236?
// uso: node sonda-landing-visible.mjs <raíz del árbol> <url>
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [raiz, url] = process.argv.slice(2);
const req = createRequire(path.join(raiz, 'package.json'));
const puppeteer = req('puppeteer-core');
const { lanzarNavegador } = await import(pathToFileURL(path.join(raiz, 'scripts/_navegador.mjs')).href);

// [id, literal, dónde lo busca: 'texto' o 'aria']
const CASOS = [
  ['#1 subtítulo', 'con tarjeta, Bizum o transferencia', 'texto'],
  ['#2 héroe oculto', 'te paga', 'texto'],
  ['#3a gremios', 'cobras al terminar', 'texto'],
  ['#3b gremios', 'no se quedan sin cobrar', 'texto'],
  ['#3c gremios', 'Cobras por tramos', 'texto'],
  ['#3d gremios', 'antes de recoger la herramienta', 'texto'],
  ['#3e gremios', 'antes de que compres la pintura', 'texto'],
  ['#4 tarjeta Cobros', 'Cobra trabajos completos o por adelantado', 'texto'],
  ['#5a comparativa', 'Tu libreta no firma', 'texto'],
  ['#5b comparativa', 'El recordatorio sale solo', 'texto'],
  ['#6 aria animación', 'Demostración: de presupuesto a', 'aria'],
  ['#7 llamada final', 'Únete a los profesionales', 'texto'],
];

const lanz = await lanzarNavegador(puppeteer, {});
const nav = lanz.navegador || lanz.browser || lanz;
const page = await nav.newPage();
const salida = [];
for (const ancho of [1280, 360]) {
  await page.setViewport({ width: ancho, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  // 🔴 La landing anima la entrada con `.reveal` (opacidad 0 hasta que el bloque entra en pantalla).
  // Sin recorrerla, `checkVisibility({checkOpacity})` da «no se ve» a lo que está bajo el pliegue:
  // la primera pasada de esta sonda llamó invisible a la tarjeta «Cobros» por eso.
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
  });
  const r = await page.evaluate((CASOS) => {
    const vis = (el) => (typeof el.checkVisibility === 'function'
      ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      : !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const anc = (el) => { const out = []; for (let p = el; p && p !== document.body; p = p.parentElement) if (p.hidden || p.hasAttribute('hidden')) out.push(p.id ? '#' + p.id : p.tagName.toLowerCase()); return out; };
    const ctrl = {
      h1Visible: vis(document.querySelector('h1')),
      revealSinDisparar: [...document.querySelectorAll('.reveal:not(.in)')].filter((e) => !e.closest('[hidden]')).length,
      gremiosSeccionVisible: document.getElementById('gremios') ? vis(document.getElementById('gremios')) : 'no existe',
    };
    const filas = CASOS.map(([id, lit, modo]) => {
      let els;
      if (modo === 'aria') els = [...document.querySelectorAll('[aria-label]')].filter((e) => e.getAttribute('aria-label').includes(lit));
      else {
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        els = []; let t;
        while ((t = w.nextNode())) if (t.nodeValue.replace(/\s+/g, ' ').includes(lit)) els.push(t.parentElement);
        if (!els.length) { // el literal puede cruzar etiquetas: buscar el elemento más profundo cuyo textContent lo tenga
          const todos = [...document.body.querySelectorAll('*')].filter((e) => e.textContent.replace(/\s+/g, ' ').includes(lit));
          els = todos.filter((e) => ![...e.children].some((c) => c.textContent.replace(/\s+/g, ' ').includes(lit)));
        }
      }
      return { id, lit, n: els.length, vistos: els.map((e) => ({ visible: vis(e), hiddenEn: anc(e) })) };
    });
    return { ctrl, filas };
  }, CASOS);
  salida.push({ ancho, ...r });
}
await nav.close();
for (const s of salida) {
  console.log(`== ${url} @${s.ancho} · CONTROL h1 visible=${s.ctrl.h1Visible} · #gremios visible=${s.ctrl.gremiosSeccionVisible} · .reveal fuera de hidden sin disparar=${s.ctrl.revealSinDisparar}`);
  for (const f of s.filas) console.log(`${f.id.padEnd(20)} n=${f.n} ${f.vistos.map((v) => (v.visible ? 'SE VE' : 'NO se ve') + (v.hiddenEn.length ? ' [hidden en ' + v.hiddenEn.join(' < ') + ']' : '')).join(' | ') || 'NO ENCONTRADO'} «${f.lit}»`);
}

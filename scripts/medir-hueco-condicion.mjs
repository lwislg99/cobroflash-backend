#!/usr/bin/env node
// scripts/medir-hueco-condicion.mjs — SCRUM-564
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ¿DÓNDE CABE LA CONDICIÓN, Y CUÁNTOS CARACTERES? — medido EN NAVEGADOR, no a ojo
//
// El fundador decidió DOCUMENTAR LA CONDICIÓN en vez de retirar el copy. Para elegir la frase
// necesita un dato que no estaba: **cuántos caracteres caben en cada sitio sin romper la
// maqueta**. Esto lo mide.
//
//   node scripts/medir-hueco-condicion.mjs            → imprime la tabla
//   node scripts/medir-hueco-condicion.mjs --json f   → además la escribe en `f`
//
// ⚠️ NO TOCA EL ÁRBOL. Sirve `public/` tal cual y toda la inyección ocurre en el DOM del
// navegador. El fichero en disco no se abre para escribir.
//
// ⚠️ NO está enganchado a `pretest`, como los demás guards de navegador: cuesta segundos y su
// resultado es un dato para decidir, no una condición que deba bloquear el CI.
//
// ── Tres trampas que se comieron dos intentos, y que están resueltas aquí ────────────────
//  ① `elementFromPoint` es RELATIVO AL VIEWPORT. Estas secciones están bajo el pliegue: sin
//     traer la sonda a la vista, se pregunta por un punto de otra parte de la página y sale
//     «tapada» SIEMPRE. Recortar las coordenadas al viewport no lo arregla — cambia la pregunta.
//  ② Sin comprobar que la sonda SE VE, el binario concluye «caben 400 caracteres» donde no se
//     ve ni uno: un `<details>` cerrado o un contenedor de alto fijo se la tragan y la sección
//     no cambia de alto. El «cabe» tiene que exigir caja Y arbitraje.
//  ③ La foto de táctiles hay que tomarla con el SCROLL FIJO, antes y después. Con la línea base
//     sin desplazar y la sonda desplazando salían diferencias NEGATIVAS —«menos táctiles rotos
//     que antes»—, que es la señal de que se comparaban dos páginas distintas.
//
// El árbitro de toque es el de SCRUM-562: `closest`, y DESDE EL CENTRO. Nunca
// `elementsFromPoint().includes()`, que da por bueno lo que otro tapa.
// ─────────────────────────────────────────────────────────────────────────────────────────
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import * as censoF from './censo-anclas-bloque-f.mjs';
import { veredictos, leerLanding, FALSA } from './_afirmaciones-publicadas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export const ANCHOS = [360, 1280];
export const SITIOS = ['junto al texto', 'pie del bloque', 'pie de la seccion'];
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };

const html = leerLanding(RAIZ);
const DIEZ = veredictos(html, RAIZ, censoF).veredictos
  .filter((v) => v.grupo === FALSA)
  .map((v) => ({ id: v.id, texto: v.texto, seccion: v.seccion }));
if (DIEZ.length === 0) {
  console.error('🔴 CIEGO: cero afirmaciones falsas. Están medidas: son diez. Un cero aquí diría '
    + '«no hay nada que documentar», que es la conclusión más cara.');
  process.exit(2);
}
if (!fs.existsSync(EDGE)) { console.error('🔴 NO SUPE MIRAR: no encuentro Edge en ' + EDGE + '. Pon EDGE_PATH.'); process.exit(2); }

const srv = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(RAIZ, 'public', url === '/' ? '/index.html' : url);
  if (!f.startsWith(path.join(RAIZ, 'public')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((x) => srv.listen(0, '127.0.0.1', x));
const PUERTO = srv.address().port;

const DENTRO = `(async (DIEZ) => {
  const limpiar = (s) => s.replace(/\\u00a0/g, ' ').replace(/\\s+/g, ' ').trim();
  const espera = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const INTERACTIVOS = 'a[href], button, [role="button"], input, select, textarea, summary';

  // El identificador derivado -> elemento del DOM, con el MISMO esquema del censo: cualquier
  // elemento que contenga texto directamente, contado por etiqueta y orden de aparición.
  const resolver = (seccion) => {
    const sec = document.querySelector('#' + seccion);
    if (!sec) return {};
    const mapa = {}; const cuenta = {};
    const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT, { acceptNode: (n) => {
      if (!limpiar(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p || ['SCRIPT', 'STYLE', 'SVG'].includes(p.tagName) || p.closest('svg')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT; } });
    let n;
    while ((n = w.nextNode())) {
      const clave = seccion + '/' + n.parentElement.tagName.toLowerCase();
      cuenta[clave] = (cuenta[clave] || 0) + 1;
      mapa[clave + '#' + cuenta[clave]] = { el: n.parentElement, texto: limpiar(n.nodeValue) };
    }
    return mapa;
  };

  const foto = () => [...document.querySelectorAll(INTERACTIVOS)].map((el) => {
    const c = el.getBoundingClientRect();
    if (c.width === 0 || c.height === 0) return null;
    const x = c.left + c.width / 2, y = c.top + c.height / 2;            // DESDE EL CENTRO
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null; // fuera: no se pregunta
    const enc = document.elementFromPoint(x, y);
    return { el, ok: Boolean(enc) && enc.closest(INTERACTIVOS) === el };
  }).filter(Boolean);

  const desbordaH = () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const out = [];

  for (const u of DIEZ) {
    const hit = resolver(u.seccion)[u.id];
    if (!hit) { out.push({ id: u.id, error: 'no se resuelve en el DOM' }); continue; }
    if (hit.texto !== u.texto) { out.push({ id: u.id, error: 'el texto del DOM no es el del censo', enDom: hit.texto }); continue; }

    const el = hit.el;
    const sec = document.querySelector('#' + u.seccion);
    const bloque = el.closest('li, .prod, .plan, .price-card, details, .try-step, .cmp-row, .fee-note') || el.parentElement;
    const pie = sec.querySelector('.wrap') || sec;
    const hosts = [['junto al texto', el, false], ['pie del bloque', bloque, true], ['pie de la seccion', pie, true]];

    // El relleno es EL PROPIO TEXTO de la unidad repetido: así «caben N caracteres» significa
    // N caracteres de prosa como la que ya está ahí, con su misma métrica, no de una fuente
    // inventada ni de una tira de equis.
    const base = (u.texto + ' ').repeat(40);
    const alto0 = sec.getBoundingClientRect().height;
    const ancho0 = sec.getBoundingClientRect().width;
    const medidas = [];

    for (const [nombre, host, enBloque] of hosts) {
      const probe = document.createElement('small');
      probe.setAttribute('data-sonda', '1');
      probe.style.fontSize = '13px';
      if (enBloque) probe.style.display = 'block';
      host.appendChild(probe);
      await espera();

      const cabe = async (n) => {
        probe.textContent = base.slice(0, n);
        await espera();
        let c = probe.getBoundingClientRect();
        const conCaja = c.width > 0 && c.height > 0;
        let seVe = false;
        if (conCaja) {
          probe.scrollIntoView({ block: 'center' });   // ① sin esto, siempre «tapada»
          await espera();
          c = probe.getBoundingClientRect();
          const x = c.left + c.width / 2, y = c.top + c.height / 2;
          if (x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight) {
            const enc = document.elementFromPoint(x, y);
            seVe = Boolean(enc) && (enc === probe || probe.contains(enc) || enc.contains(probe));
          }
        }
        return { alto: sec.getBoundingClientRect().height, ancho: sec.getBoundingClientRect().width,
          desborda: desbordaH(), conCaja, seVe,
          lineas: Math.round(c.height / parseFloat(getComputedStyle(probe).lineHeight || 16)) };
      };

      const v = await cabe(30);
      const busca = async (ok) => { let lo = 0, hi = 400;
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (ok(await cabe(mid))) lo = mid; else hi = mid - 1; }
        return lo; };
      const sinMover = await busca((m) => Math.abs(m.alto - alto0) < 0.5 && !m.desborda && m.conCaja && m.seVe);
      const unaLinea = await busca((m) => m.lineas <= 1 && !m.desborda && m.conCaja && m.seVe);
      const con200 = await cabe(200);

      // ③ la foto de táctiles, con el scroll FIJO: se toma aquí, se inyecta, se vuelve a tomar
      probe.textContent = '';
      host.scrollIntoView({ block: 'center' });
      await espera();
      const antes = foto();
      const rotosAntes = antes.filter((f) => !f.ok).map((f) => f.el);
      probe.textContent = 'x'.repeat(200);
      await espera();
      const despues = foto();
      const roba = despues.filter((f) => !f.ok).map((f) => f.el).filter((e) => !rotosAntes.includes(e));

      probe.remove();
      await espera();
      medidas.push({
        sitio: nombre,
        host: host.tagName.toLowerCase() + (host.className ? '.' + String(host.className).trim().split(/\\s+/).join('.') : ''),
        anchoHost: Math.round(host.getBoundingClientRect().width),
        visible: v.conCaja && v.seVe,
        unaLinea, sinMover,
        rompe: con200.desborda || Math.abs(con200.ancho - ancho0) > 0.5,
        tactilesEnVista: antes.length,
        rotosYaRotos: rotosAntes.length,
        roba: roba.map((e) => e.tagName.toLowerCase() + ' «' + limpiar(e.textContent).slice(0, 24) + '»'),
      });
    }
    out.push({ id: u.id, texto: u.texto, seccion: u.seccion, medidas });
  }
  return { out, sondasVivas: document.querySelectorAll('[data-sonda]').length };
})`;

const navegador = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const todo = {};
for (const ancho of ANCHOS) {
  const page = await navegador.newPage();
  await page.setViewport({ width: ancho, height: 900 });
  await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });
  const detalles = await page.evaluate(`(() => {
    document.querySelectorAll('.reveal').forEach((n) => n.classList.add('on'));
    const d = [...document.querySelectorAll('details')];
    const cerrados = d.filter((x) => !x.open).length;
    d.forEach((x) => { x.open = true; });
    return { total: d.length, cerrados };
  })()`);
  await new Promise((x) => setTimeout(x, 700));
  console.log(`ancho ${ancho} · <details>: ${detalles.total}, cerrados de origen ${detalles.cerrados} → abiertos para poder medir`);
  const res = await page.evaluate(`${DENTRO}(${JSON.stringify(DIEZ)})`);
  if (res.sondasVivas !== 0) { console.error('🔴 la sonda no se ha limpiado: ' + res.sondasVivas); process.exit(2); }
  todo[ancho] = res.out;
  await page.close();
}
await navegador.close();
srv.close();

for (const ancho of ANCHOS) {
  console.log('');
  console.log('════ ' + ancho + ' px ════');
  console.log('  id                sitio               ancho  1 linea  sin mover  rompe  visible  roba toque');
  for (const u of todo[ancho]) {
    if (u.error) { console.log('  🔴 ' + u.id + ' — ' + u.error); continue; }
    for (const m of u.medidas) {
      console.log('  ' + u.id.padEnd(17) + m.sitio.padEnd(20) + String(m.anchoHost).padStart(5)
        + String(m.unaLinea).padStart(9) + String(m.sinMover).padStart(11)
        + (m.rompe ? '  🔴 sí' : '    no') + (m.visible ? '     sí ' : '  🔴 NO ')
        + (m.roba.length ? '🔴 ' + m.roba.join(' | ') : 'no'));
    }
  }
}
const i = process.argv.indexOf('--json');
if (i !== -1 && process.argv[i + 1]) {
  fs.writeFileSync(process.argv[i + 1], JSON.stringify(todo, null, 1), 'utf8');
  console.log('');
  console.log('escrito: ' + process.argv[i + 1]);
}

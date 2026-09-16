// scripts/guard-primera-pantalla.mjs — SCRUM-331 (F4) · la primera pantalla, medida en NAVEGADOR.
//
//   node scripts/guard-primera-pantalla.mjs
//
// Fuera de `npm test` por la misma decisión que `guard:contraste` y `guard:caja-avisos`: la suite
// no levanta un navegador. Lo que SÍ corre siempre es `tests/scrum331-heroe.test.mjs`, que vigila
// el mecanismo (censo de cifras, regla 30, cero testimonios).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ MIDE, Y POR QUÉ CADA COSA
//
// ① **Con la fuente del dato ROTA, no aparece ningún número.** Es el control negativo del ticket:
//    el contador de plazas es el único dato dinámico de la primera pantalla, y SCRUM-330 decidió
//    que si no se puede leer **se oculta** en vez de enseñar un valor por defecto. Aquí se
//    comprueba **en el navegador**, sirviendo `/public/founding-status` roto a propósito — no
//    leyendo el código que dice que lo hace.
// ② **La demo del héroe no bloquea la primera pintura**: LCP y CLS con red 4G emulada.
// ③ **360 px**: que la primera pantalla quepa, sin scroll horizontal.
// ④ **Objetivos táctiles ≥44 px** (AB6) — informativo, y con un aviso: si el que falla es
//    `.p-link`, eso es **SCRUM-542** y no se arregla aquí.
//
// Levanta un servidor estático propio con el `http` de Node (sin dependencias nuevas, regla 36):
// hace falta un origen HTTP de verdad para emular red y para que el `fetch` del contador tenga a
// quién preguntar.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const puppeteer = createRequire(path.join(RAIZ, 'package.json'))('puppeteer-core');
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
// SCRUM-522 · la ruta ya no se escribe aqui. Era una ruta de WINDOWS por defecto, identica en
// los nueve guards, y por eso ninguno podia correr en el runner de CI —Ubuntu— donde de verdad
// hacen falta. `rutaDelNavegador` busca en los sitios conocidos y, si no hay ninguno, PARA
// declarandose ciega en vez de devolver una ruta plausible. `EDGE_PATH` sigue mandando.
const ANCHOS = [360, 390];

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

/** Servidor de `public/`. `modoFounding`: 'ok' | 'roto'. */
function servir(modoFounding) {
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/public/founding-status') {
      if (modoFounding === 'roto') { res.writeHead(500); res.end('boom'); return; }
      // 🔴 SCRUM-546 · AQUÍ FALTABA `taken`, Y ESO DEJABA AL GUARD SIN CONTROL POSITIVO.
      // La landing solo pinta la escasez si `taken > 0` (`pintarPlazas`), así que sirviendo
      // `{seatsLeft:7}` a secas la escasez tampoco salía en el caso «la fuente responde»: el
      // control negativo comparaba OCULTA contra OCULTA y habría pasado en verde igual con el
      // detector roto. Ahora el caso vivo es una venta de verdad y el número TIENE que verse.
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ price: 9.9, seatsTotal: 20, seatsLeft: 18, taken: 2 }));
      return;
    }
    const rel = url === '/' ? '/index.html' : url;
    const f = path.join(RAIZ, 'public', rel);
    if (!f.startsWith(path.join(RAIZ, 'public')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); res.end('no'); return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  // SCRUM-620 · el servidor se levanta por el módulo común: el ÚNICO sitio donde se decide
  // qué pasa si NO se puede. Antes cada guard hacía su propio `listen` sin tratar el error, y un
  // puerto ocupado subía como excepción → exit 1 → la puerta lo pintaba `rojo(1)`, o sea «he
  // encontrado un defecto». Ahora para con 4 y lo dice.
  return levantarServidor(srv, 0, '127.0.0.1').then((puerto) => ({ srv, puerto }));
}

async function medir(nav, puerto, ancho) {
  const p = await nav.newPage();
  await p.setViewport({ width: ancho, height: 780, deviceScaleFactor: 2 });
  const cdp = await p.target().createCDPSession();
  await cdp.send('Network.enable');
  // 4G «regular»: 9 Mbps bajada, 4 subida, 170 ms de ida y vuelta.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 170, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (4 * 1024 * 1024) / 8,
  });
  await p.evaluateOnNewDocument(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = Math.round(e.startTime); })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  });
  await p.goto('http://127.0.0.1:' + puerto + '/index.html', { waitUntil: 'networkidle2' });
  const r = await p.evaluate(() => {
    const alto = window.innerHeight;
    const heroe = document.querySelector('section.hero:not([hidden])');
    const enPantalla = [...document.querySelectorAll('a,button')].filter((e) => {
      const b = e.getBoundingClientRect();
      return b.top < alto && b.bottom > 0 && b.width > 0;
    });
    return {
      lcp: window.__lcp,
      cls: Math.round(window.__cls * 1000) / 1000,
      fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0),
      scrollHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      heroes: document.querySelectorAll('section.hero').length,
      heroesVisibles: document.querySelectorAll('section.hero:not([hidden])').length,
      altoHeroe: heroe ? Math.round(heroe.getBoundingClientRect().height) : null,
      // El dato dinámico: los dos contenedores que SCRUM-330 separó para poder ocultar la escasez.
      plazasAnuncio: (() => { const e = document.getElementById('ann-plazas'); return e ? { oculto: e.hidden || getComputedStyle(e).display === 'none', texto: e.textContent.trim() } : null; })(),
      anuncioOculto: (() => { const e = document.getElementById('announce'); return e ? (e.hidden || getComputedStyle(e).display === 'none') : null; })(),
      // Números visibles en la primera pantalla (para el control negativo).
      numerosEnPantalla: [...document.querySelectorAll('body *')]
        .filter((e) => { const b = e.getBoundingClientRect(); return b.top < alto && b.bottom > 0 && e.children.length === 0; })
        .map((e) => e.textContent.trim()).filter((t) => /[0-9]/.test(t)),
      tocables: enPantalla.map((e) => {
        const b = e.getBoundingClientRect();
        return { txt: (e.textContent || '').trim().slice(0, 28), clase: e.className, h: Math.round(b.height), w: Math.round(b.width) };
      }),
    };
  });
  await p.close();
  return r;
}

// SCRUM-617 · el arranque pasa por el módulo común: es el ÚNICO sitio donde se decide cómo
// arranca el navegador. Antes cada guard lo escribía a mano y el flag de aislamiento se
// propagó por COPIA de uno a otro — por eso el más antiguo (contraste) se quedó sin él. Y aquí
// está lo que arregla este ticket: si no levanta, `lanzarNavegador` PARA con código 3 («no
// pude arrancarlo»), que no es 2 («no lo encuentro») ni 1 («he encontrado un defecto»).
const nav = await lanzarNavegador(puppeteer, {});

let fallos = 0;
console.log('primera pantalla de la landing, medida en Edge con red 4G emulada — SCRUM-331 (F4)\n');

for (const modo of ['ok', 'roto']) {
  const { srv, puerto } = await servir(modo);
  console.log('══ /public/founding-status ' + (modo === 'ok' ? 'RESPONDE (2 vendidas, quedan 18) — control positivo' : 'ROTO (500) — control negativo') + ' ══');
  for (const ancho of ANCHOS) {
    const r = await medir(nav, puerto, ancho);
    console.log('  ' + ancho + ' px · FCP ' + r.fcp + ' ms · LCP ' + r.lcp + ' ms · CLS ' + r.cls
      + ' · héroe ' + r.altoHeroe + ' px · scroll horizontal: ' + (r.scrollHorizontal ? '🔴 SÍ' : 'no'));

    if (r.heroesVisibles !== 1) { console.log('    🔴 hay ' + r.heroesVisibles + ' héroes visibles (de ' + r.heroes + ')'); fallos++; }
    if (r.scrollHorizontal) fallos++;

    if (modo === 'ok') {
      // CONTROL POSITIVO (SCRUM-546): con la fuente viva y una venta real, el número TIENE que
      // salir. Sin esto, el «OCULTA ✔» de abajo lo cumpliría igual un detector que no ve nada.
      const escasez = r.plazasAnuncio;
      const seVe = !!(escasez && !escasez.oculto && /[0-9]/.test(escasez.texto));
      console.log('    control positivo · escasez con la fuente viva: '
        + (seVe ? 'VISIBLE con número ✔ («' + escasez.texto + '»)' : '🔴 NO SE VE — y entonces el control negativo no prueba nada'));
      if (!seVe) fallos++;
    }

    if (modo === 'roto') {
      const escasez = r.plazasAnuncio;
      const ok = !escasez || escasez.oculto || r.anuncioOculto;
      console.log('    control negativo · escasez de plazas: ' + (ok ? 'OCULTA ✔' : '🔴 VISIBLE con la fuente rota: «' + escasez.texto + '»'));
      if (!ok) fallos++;
      const inventados = r.numerosEnPantalla.filter((t) => /\bplazas?\b/i.test(t) && /[0-9]/.test(t));
      console.log('    números de plazas pintados con la fuente rota: ' + (inventados.length ? '🔴 ' + JSON.stringify(inventados) : 'ninguno ✔'));
      if (inventados.length) fallos++;
    }

    const cortos = r.tocables.filter((t) => t.h < 44);
    if (cortos.length) {
      const pLink = cortos.filter((t) => String(t.clase).includes('p-link'));
      console.log('    ⚠️ objetivos táctiles < 44 px (AB6): ' + cortos.length
        + (pLink.length ? ' — de ellos ' + pLink.length + ' son `.p-link` → SCRUM-542, NO se arregla aquí' : ''));
      for (const c of cortos.slice(0, 6)) console.log('        ' + c.h + 'px  «' + c.txt + '»  [' + c.clase + ']');
    }
  }
  srv.close();
  console.log('');
}

await nav.close();
console.log(fallos === 0 ? '✓ primera pantalla en verde' : '🔴 ' + fallos + ' fallo(s) en la primera pantalla');
process.exit(fallos === 0 ? 0 : 1);

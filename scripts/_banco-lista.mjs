// scripts/_banco-lista.mjs — SCRUM-816
//
// UNA LISTA DEL PANEL, PINTADA POR EL PRODUCTO, EN UN NAVEGADOR DE VERDAD Y **PULSABLE**.
//
// ── POR QUÉ NO VALE `_pagina-panel.mjs` PARA ESTO ────────────────────────────────────────────
// Aquel serializa el árbol del mini-DOM de `tests/_banco-vistas.mjs` y lo sirve como HTML muerto:
// perfecto para GEOMETRÍA, imposible para COMPORTAMIENTO — no hay JS vivo, así que no se puede
// pulsar nada. Y este ticket tiene que probar CORRIENDO que el clic en el desplegable asigna sin
// navegar y que el clic en la fila navega sin asignar.
//
// 🔴 Y HAY UN SEGUNDO MOTIVO, MEDIDO. El mini-DOM **aplana `innerHTML`**: `renderJobsView` abre su
// pantalla con `container.innerHTML = '<div class="jobs-pantalla">…'` y al serializar salía ese
// div VACÍO con todo lo demás de hermano — o sea, **el envoltorio que llevaba el tope de ancho
// desaparecía**. La primera medición de SCRUM-816 dio 982 px para Trabajos, idéntico a las otras
// cuatro listas, que es imposible con un `max-width: 980px` encima. El instrumento se cazó por el
// NÚMERO, no por la sospecha.
//
// Aquí se cargan los MISMOS scripts que declara `public/dashboard/index.html`, en su orden, y lo
// único doblado es `apiRequest` —el punto por el que la vista pide datos— más `renderAppView`,
// que se APUNTA en vez de navegar: así se puede afirmar «no navegó» sin salir de la página.
//
// `app.js` queda fuera: arranca el router y la sesión. Se mide una vista, no el router.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { resolverNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
import { baseDeLaRama } from '../tests/_base-de-la-rama.mjs';

const TIPOS = {
  '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json',
};

/** Los `<script src>` del índice, EN SU ORDEN. Se derivan del fichero: una lista a mano caduca. */
export function scriptsDelIndice(publico) {
  const indice = fs.readFileSync(path.join(publico, 'dashboard', 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(indice)) !== null) out.push(m[1].replace(/^\.\//, '/dashboard/'));
  return out.filter((s) => s !== '/dashboard/js/app.js');
}

/**
 * El shell REAL del panel, copiado de `public/dashboard/index.html`: `aside.sidebar` +
 * `main.main` + `section#view-container.view-container`.
 *
 * 🔴 SIN ÉL LOS ANCHOS SALEN INFLADOS. `.main { margin-left: var(--sidebar-w) }` descuenta los
 * 248 px de la barra lateral; medir dentro de un `<div>` suelto daría 248 px de más y el
 * veredicto sobre el ancho sería el de otra pantalla.
 */
function documento(publico, fnVista, reglasDatos, args) {
  const scripts = scriptsDelIndice(publico).map((s) => `<script src="${s}"></script>`).join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">
</head><body>
<aside class="sidebar"><div class="sidebar-logo"><div class="sidebar-logo-mark">YQ</div><div class="sidebar-logo-text">YaQu</div></div><nav class="sidebar-nav"></nav></aside>
<main class="main"><section id="view-container" class="view-container"></section></main>
${scripts}
<script>
window.__errores = [];
window.addEventListener('error', (e) => window.__errores.push(String(e.message)));
window.appUserRole = 'admin';
window.__peticiones = [];
window.__navegaciones = [];
window.__avisos = [];
// Navegar se APUNTA, no se hace: así «no navegó» es una afirmación comprobable y la página no
// se va a ningún sitio en mitad de la medición.
window.renderAppView = function (vista, params) { window.__navegaciones.push({ vista: vista, params: params || null }); };
const __datos = ${reglasDatos};
window.apiRequest = function (ruta, opciones) {
  window.__peticiones.push({ ruta: String(ruta), metodo: (opciones && opciones.method) || 'GET', cuerpo: (opciones && opciones.body) || null });
  const r = __datos(String(ruta), opciones || {});
  if (r && typeof r.then === 'function') return r;
  if (r instanceof Error) return Promise.reject(r);
  return Promise.resolve(r);
};
// Los avisos también se APUNTAN, además de pintarse: «lo dice» hay que poder comprobarlo, y el
// toast se desvanece solo a los pocos segundos.
const __toast = window.showToast;
window.showToast = function (msg, kind) { window.__avisos.push({ texto: String(msg), tipo: kind || 'ok' }); if (__toast) return __toast(msg, kind); };
window.__listo = false;
(async () => {
  try { await window.${fnVista}(document.getElementById('view-container'), ...${args}); }
  catch (e) { window.__errores.push('render: ' + e.message); }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__listo = true; }));
})();
</script>
</body></html>`;
}

/**
 * Levanta un servidor que sirve `rutas` como páginas y el resto DEL DISCO, desde `publico`.
 *
 * `publico` es un parámetro y no una constante a propósito: el control de que las otras cuatro
 * listas no se han movido compara el árbol de HOY con el de `origin/main`, y para eso hacen falta
 * DOS raíces servidas a la vez.
 */
export async function servirListas(publico, rutas) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const v = rutas.find((x) => x.ruta === p);
    if (v) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(documento(publico, v.fnVista, v.datos, v.args || '[]'));
    }
    const abs = path.join(publico, p);
    if (!abs.startsWith(publico) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(abs)] || 'application/octet-stream' });
    res.end(fs.readFileSync(abs));
  });
  const puerto = await levantarServidor(srv, 0, '127.0.0.1');
  return { srv, puerto };
}

/**
 * ═══ EL «ANTES» SE MATERIALIZA DESDE EL PUNTO DE PARTIDA DE LA RAMA ═════════════════════════
 *
 * Devuelve `{ publico, limpiar, base, ficheros }` con el `public/` tal y como estaba cuando esta
 * rama nació, escrito en un directorio temporal.
 *
 * 🔴 CONTRA `merge-base`, NO CONTRA `origin/main`. La pregunta es «¿qué ha cambiado ESTA rama?»,
 * y `origin/main` se mueve cada vez que entra otro PR: la primera versión de esto leía la PUNTA y
 * el guard de SCRUM-723 la cazó por su nombre. Con la punta, el día que otra sesión mergee un
 * cambio en `customersView.js` este comparador diría «Clientes HA CAMBIADO» sobre una rama que no
 * la ha tocado — que es exactamente la avería que SCRUM-723 existe para impedir. El punto de
 * partida es un commit y no se mueve.
 *
 * Si no se puede resolver, devuelve `base: null` y NO cae hacia `origin/main`: un respaldo
 * silencioso devolvería el defecto sin que nadie se entere.
 */
export function arbolDePartida(raiz, etiqueta = 'antes') {
  const base = baseDeLaRama(raiz);
  if (!base) return { publico: null, base: null, ficheros: [], limpiar: () => {} };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-816-${etiqueta}-`));
  const ficheros = execFileSync('git', ['ls-tree', '-r', '--name-only', base.sha, 'public'], { cwd: raiz, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((s) => /\.(html|css|js)$/.test(s));
  for (const f of ficheros) {
    const destino = path.join(tmp, f);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, execFileSync('git', ['show', `${base.sha}:${f}`], { cwd: raiz, maxBuffer: 32 * 1024 * 1024 }));
  }
  return {
    publico: path.join(tmp, 'public'),
    base,
    ficheros,
    limpiar: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
}

/** El navegador. Si no hay ninguno, se PARA con 2: «no supe mirar» no es «está bien». */
export async function abrirNavegador(puppeteer) {
  const nav = resolverNavegador();
  if (!nav.ok) {
    console.error('🔴 NO SUPE MIRAR: ' + nav.motivo);
    process.exit(2);
  }
  const browser = await puppeteer.launch({ executablePath: nav.ruta, headless: 'new', args: ['--no-sandbox'] });
  return { browser, quien: nav.quien };
}

/** Abre una página ya pintada al ancho pedido, con `page.setViewport` REAL (nunca `--window-size`). */
export async function abrirVista(browser, puerto, ruta, ancho, alto = 900) {
  const page = await browser.newPage();
  await page.setViewport({ width: ancho, height: alto });
  await page.goto(`http://127.0.0.1:${puerto}${ruta}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__listo === true', { timeout: 20000 });
  return { page, errores: await page.evaluate('window.__errores') };
}

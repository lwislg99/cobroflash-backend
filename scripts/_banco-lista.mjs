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
// SCRUM-816 (certificación) · SE CUENTAN LAS PETICIONES EN VUELO. El banco es dueño de este doble,
// así que sabe exactamente cuántas hay pendientes — no hay que adivinarlo desde fuera.
window.__enVuelo = 0;
window.apiRequest = function (ruta, opciones) {
  window.__peticiones.push({ ruta: String(ruta), metodo: (opciones && opciones.method) || 'GET', cuerpo: (opciones && opciones.body) || null });
  const r = __datos(String(ruta), opciones || {});
  const p = (r && typeof r.then === 'function') ? r
    : (r instanceof Error ? Promise.reject(r) : Promise.resolve(r));
  window.__enVuelo++;
  // El .finally devuelve una promesa que resuelve o RECHAZA igual que la de dentro: quien llama
  // recibe lo mismo que antes. Lo único que se añade es el descuento.
  // (Sin acentos graves en este bloque: va DENTRO de un template literal y cerrarían la cadena.)
  return p.finally(function () { window.__enVuelo--; });
};
// 🔴 Y TAMBIÉN EL fetch CRUDO, que es por donde se escapaba de verdad. Contar sólo apiRequest
// deja fuera a quien no lo usa: invoicesView carga su bandeja de «pendientes de facturar» con
// fetch directo (invoicesView.js:89), así que esa petición no aparecía en la cuenta y la captura
// podía llegar antes de que aterrizara. Ésos eran los 80 caracteres que faltaban.
// Se envuelve, no se dobla: la petición sigue yendo al mismo sitio; sólo se apunta que está viva.
const __fetch = window.fetch.bind(window);
window.fetch = function () {
  window.__enVuelo++;
  return __fetch.apply(null, arguments).finally(function () { window.__enVuelo--; });
};
// Los avisos también se APUNTAN, además de pintarse: «lo dice» hay que poder comprobarlo, y el
// toast se desvanece solo a los pocos segundos.
const __toast = window.showToast;
window.showToast = function (msg, kind) { window.__avisos.push({ texto: String(msg), tipo: kind || 'ok' }); if (__toast) return __toast(msg, kind); };
window.__listo = false;
(async () => {
  try { await window.${fnVista}(document.getElementById('view-container'), ...${args}); }
  catch (e) { window.__errores.push('render: ' + e.message); }
  // 🔴 SCRUM-816 (certificación, 8-sep-2026) · «AWAIT DEL RENDER» NO ES «PINTADA», Y ESO HACÍA
  // OSCILAR AL GUARD.
  //
  // (Sin acentos graves en este bloque: va DENTRO de un template literal y cerrarían la cadena.)
  //
  // Las vistas disparan cargas que NO esperan: renderInvoicesView pide su lista y, aparte, los
  // pendientes de facturar. El await del render vuelve antes de que la segunda aterrice, y dos
  // requestAnimationFrame (~32 ms) no sincronizan con una promesa: son un plazo, no una espera.
  // Bajo carga —la comparación de las cuatro hermanas monta ocho páginas seguidas— el plazo se
  // agota antes y se captura la pantalla A MEDIO PINTAR.
  //
  // MEDIDO: la lista de Facturas salió una vez con 5.839 caracteres contra los 5.919 de siempre,
  // 80 de menos, y el guard la denunció como «HA CAMBIADO» contra una rama que no toca facturas.
  // No se reproducía: dos pasadas después, idéntica. Un guard que se pone rojo al azar enseña a
  // ignorar la suite, que es la familia de defecto de SCRUM-822.
  //
  // Se espera a que no quede NINGUNA petición en vuelo, y a que siga sin quedar ninguna un tick
  // después: una cadena A→B pasa por cero entre las dos, y un solo vistazo la daría por acabada.
  // Con tope (2 s) para que una vista que nunca termina se declare, en vez de colgar la pasada.
  let quietas = 0;
  for (let i = 0; i < 400 && quietas < 2; i++) {
    await new Promise((r) => setTimeout(r, 5));
    quietas = window.__enVuelo === 0 ? quietas + 1 : 0;
  }
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
    // ═══ 🔴 LAS RUTAS QUE NO PASAN POR `apiRequest` ══════════════════════════════════════════
    //
    // `invoicesView` carga su lista y su bandeja de pendientes con **`fetch` CRUDO**
    // (`fetchInvoices` y los pendientes de facturar), así que el doble de `apiRequest` NO las
    // intercepta: llegan aquí, al servidor, y sin esto se iban por el 404 de abajo.
    //
    // MEDIDO el 8-sep-2026: la lista de Facturas se quedaba en `skeleton-row` — el marcador de
    // carga— y dos censos distintos leyeron «0 controles en la fila». **Cero por no haber pintado,
    // no por no haber botones.** Es la otra cara del mismo `fetch` crudo que ya obligó a contar
    // las peticiones en vuelo para quitarle el temblor al guard: aquel afectaba a CUÁNDO se mira,
    // éste a SI hay algo que mirar.
    //
    // La respuesta sale del mismo sitio que el resto (`reglasDatos`, evaluado en la página), así
    // que aquí sólo se sirve lo que la ruta pida y se declara vacío si no se sabe: `[]` es una
    // respuesta válida y visible (estado vacío), y nunca un esqueleto eterno.
    if (p.startsWith('/admin/')) {
      const cuerpo = (rutas.find((x) => x.api) || {}).api;
      const dato = typeof cuerpo === 'function' ? cuerpo(p) : null;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(dato === null || dato === undefined ? [] : dato));
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

/**
 * El navegador, con los TRES desenlaces separados — que es lo que hace útil un código de salida:
 *   · 2 «NO SUPE MIRAR»  — no hay navegador que usar.
 *   · 3 «no arrancó»     — lo hay, y no ha querido levantarse.
 *   · 0/1 los deja el guard, que es quien juzga.
 *
 * 🔴 EL 3 ESTABA PROMETIDO Y NO IMPLEMENTADO. Las cabeceras de los dos guards de esta familia
 * anunciaban «3 no arrancó el navegador» y el `launch` iba a pelo: cuando Edge dejó un proceso
 * huérfano reteniendo su perfil, la excepción subió sin tratar → exit 1, que en esta casa
 * significa **«he encontrado un defecto»**. Un guard que grita «defecto» porque no pudo abrir el
 * navegador enseña a ignorar sus rojos, que es la familia de SCRUM-822. Lo mismo que ya arregló
 * SCRUM-620 con los servidores, aquí para el navegador.
 */
export async function abrirNavegador(puppeteer) {
  const nav = resolverNavegador();
  if (!nav.ok) {
    console.error('🔴 NO SUPE MIRAR: ' + nav.motivo);
    process.exit(2);
  }
  try {
    const browser = await puppeteer.launch({ executablePath: nav.ruta, headless: 'new', args: ['--no-sandbox'] });
    return { browser, quien: nav.quien };
  } catch (e) {
    console.error('🔴 NO PUDE ARRANCAR EL NAVEGADOR.');
    console.error(`   ejecutable: ${nav.ruta}  (${nav.quien})`);
    console.error(`   detalle: ${e && e.message ? e.message : e}`);
    if (/already running/i.test(String(e && e.message))) {
      console.error('   Hay un proceso anterior reteniendo el perfil temporal. Ciérralo (en Windows,');
      console.error('   `taskkill /F /IM msedge.exe /T`) y vuelve a lanzarlo.');
    }
    console.error('   Esto NO es «he encontrado un defecto» (eso sale con 1) ni «no supe mirar»');
    console.error('   (2): el guard NO HA LLEGADO A MEDIR NADA, así que su silencio no dice nada.');
    process.exit(3);
  }
}

/** Abre una página ya pintada al ancho pedido, con `page.setViewport` REAL (nunca `--window-size`). */
export async function abrirVista(browser, puerto, ruta, ancho, alto = 900) {
  const page = await browser.newPage();
  await page.setViewport({ width: ancho, height: alto });
  await page.goto(`http://127.0.0.1:${puerto}${ruta}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__listo === true', { timeout: 20000 });
  return { page, errores: await page.evaluate('window.__errores') };
}

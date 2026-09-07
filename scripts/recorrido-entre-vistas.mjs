// scripts/recorrido-entre-vistas.mjs — la sonda que RECORRE, no la que fotografía.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE, Y POR QUÉ NO LA CUBRE `capture-demo.mjs`
//
// `capture-demo.mjs` es un BANCO DE VISTAS: para cada pantalla hace `page.goto(BASE +
// '/dashboard/#loquesea')` y dispara una captura. Monta cada pantalla SUELTA, y la monta
// poniendo el hash ÉL MISMO. Por construcción, en ese banco el hash y la vista SIEMPRE
// coinciden — no porque la app lo garantice, sino porque el instrumento lo impone.
//
// Esta sonda hace lo contrario: entra UNA vez y a partir de ahí se mueve como un usuario,
// haciendo CLIC en la barra lateral. Y después de cada clic pregunta lo que el banco no
// puede preguntar: ¿la URL dice dónde estoy? ¿el <title> dice dónde estoy? ¿queda algo en
// el historial para que «atrás» me devuelva a la pantalla anterior?
//
// Medido el 7-sep-2026 contra el commit af08201 (el mismo que servía producción): la
// respuesta es NO a las tres. `renderView` (crudo) es lo que llama el manejador del menú
// en `public/dashboard/js/app.js`; el envoltorio `window.renderAppView`, que es quien
// escribe el hash, no participa. Y ese envoltorio usa `replaceState`, nunca `pushState`,
// así que ni siquiera las navegaciones que sí tocan el hash dejan entrada de historial.
//
// ⚠️ LÍMITE HONESTO — SE PIERDE LA INDEPENDENCIA DE MOTOR. El defecto se encontró con el
// MCP de Playwright, que no comparte una línea con la casa. Esto está escrito en
// puppeteer-core porque es lo que YA hay en devDependencies: meter Playwright sería una
// dependencia nueva y eso pide OK del fundador (regla 36). Así que esta sonda comparte
// motor con `capture-demo.mjs`; lo que NO comparte es el MÉTODO, y el método es lo que
// cazó el fallo. Para el control de dos sondas de verdad —el que rompe el «de acuerdo
// dentro del error» de SCRUM-700— sigue haciendo falta conducir el MCP a mano.
//
// ⚠️ TRAMPA MEDIDA, para que nadie pierda otra tanda con ella: `html { scroll-behavior:
// smooth }` (styles.css) cuelga el `click()` de Playwright en «scrolling into view if
// needed» aunque el elemento ya esté dentro del viewport y nada lo tape. NO es un defecto
// del producto: un dedo humano no se entera. Si tu clic caduca ahí, mira eso antes de
// escribir un hallazgo.
//
// USO (nunca contra producción: esto NAVEGA autenticado):
//   RECORRIDO_BASE=http://127.0.0.1:3399 RECORRIDO_TOKEN_FILE=<fichero con un magic_link>
//   node scripts/recorrido-entre-vistas.mjs
//
// El token se lee de un FICHERO a propósito: así no viaja por la línea de comandos ni
// acaba en un historial de shell.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.RECORRIDO_BASE || 'http://127.0.0.1:3399';
const TOKEN_FILE = process.env.RECORRIDO_TOKEN_FILE || '';
// 390×844 = el móvil del técnico. Viewport REAL vía CDP: `--window-size` maqueta a ~484 y
// las media queries de móvil ni se aplican (el motivo por el que existe capture-demo.mjs).
const PIELES = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'movil-390', width: 390, height: 844 },
];

// Producción no se recorre: esto hace clic por toda la app con sesión abierta.
if (/yaqu\.app/i.test(BASE)) {
  console.error('🔴 Esta sonda navega AUTENTICADA. No apunta a producción. Levanta un banco local.');
  process.exit(1);
}
if (!TOKEN_FILE || !fs.existsSync(TOKEN_FILE)) {
  console.error('🔴 Falta RECORRIDO_TOKEN_FILE (fichero con un token magic_link del banco local).');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { console.log(`  ❌ ${m}`); fallos++; };

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: true,
  args: ['--disable-gpu', '--hide-scrollbars', '--no-first-run'],
});

try {
  const page = await browser.newPage();
  await page.goto(`${BASE}/auth/verify?token=${fs.readFileSync(TOKEN_FILE, 'utf8').trim()}`,
    { waitUntil: 'networkidle2' });

  for (const piel of PIELES) {
    console.log(`\n── piel ${piel.nombre} (${piel.width}×${piel.height}) ──`);
    await page.setViewport({ width: piel.width, height: piel.height, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2' });
    await sleep(1200);

    // El onboarding tapa el panel en una cuenta recién sembrada.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Saltar por ahora/i.test(x.textContent || ''));
      if (b) b.click();
    });
    await sleep(600);

    // CONTROL POSITIVO DEL INSTRUMENTO, antes de creerse ninguna medición: si la media
    // query de móvil no se aplicó, el viewport miente y todo lo de abajo mide otra cosa.
    const ctx = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      mqMovil: window.matchMedia('(max-width: 768px)').matches,
    }));
    const esperadaMovil = piel.width <= 768;
    if (ctx.innerWidth !== piel.width || ctx.mqMovil !== esperadaMovil) {
      mal(`viewport no fiable: innerWidth=${ctx.innerWidth}, mqMovil=${ctx.mqMovil} (esperado ${esperadaMovil})`);
      continue;
    }
    ok(`viewport real: ${ctx.innerWidth}px, media query móvil ${ctx.mqMovil ? 'activa' : 'inactiva'}`);

    const destinos = await page.evaluate(() =>
      [...document.querySelectorAll('nav .nav-item[data-view]')].map((b) => b.dataset.view));
    console.log(`  destinos en el menú: ${destinos.length}`);

    const incoherentes = [];
    let historialAlEmpezar = null;

    for (const vista of destinos) {
      const r = await page.evaluate(async (v) => {
        const btn = document.querySelector(`nav .nav-item[data-view="${v}"]`);
        if (!btn) return { falta: true };
        btn.click();
        await new Promise((res) => setTimeout(res, 800));
        return {
          hash: (location.hash || '').replace('#', ''),
          titulo: document.title,
          h1: document.querySelector('main h1')?.textContent?.trim() || '',
          historyLength: history.length,
        };
      }, vista);
      if (r.falta) { mal(`el menú no tiene botón para «${vista}»`); continue; }
      if (historialAlEmpezar === null) historialAlEmpezar = r.historyLength;
      // La pregunta: tras el clic, ¿la URL sabe dónde estoy?
      if (r.hash !== vista) incoherentes.push({ vista, hash: r.hash || '(vacío)', h1: r.h1 });
    }

    if (incoherentes.length === 0) {
      ok('la URL sigue a la vista en los 100 % de los destinos');
    } else {
      mal(`la URL NO sigue a la vista en ${incoherentes.length}/${destinos.length} destinos`);
      for (const i of incoherentes.slice(0, 4)) {
        console.log(`       pantalla «${i.h1}» → la URL dice «${i.hash}»`);
      }
      console.log('       consecuencia: recargar (F5) devuelve al usuario a la vista que diga la URL, no a la suya.');
    }

    // Y la otra mitad: ¿queda rastro para «atrás»? En móvil es el gesto de siempre.
    const historialAlAcabar = await page.evaluate(() => history.length);
    if (historialAlAcabar > historialAlEmpezar) {
      ok(`navegar deja rastro en el historial (+${historialAlAcabar - historialAlEmpezar} entradas)`);
    } else {
      mal(`${destinos.length} navegaciones y CERO entradas de historial: «atrás» saca de la app, no vuelve a la pantalla anterior`);
    }
  }
} finally {
  await browser.close();
}

console.log(`\n${fallos === 0 ? '✅ recorrido coherente' : `❌ ${fallos} incoherencia(s) de navegación`}`);
process.exitCode = fallos === 0 ? 0 : 1;

// SCRUM-1464 · el final de cada pantalla deja sitio al botón flotante de ayuda, en TODOS los anchos.
//
// `#tut-help-btn` (lo pinta `tutorial.js`) es fijo: abajo a la derecha. Lo último de una pantalla
// bajada del todo queda debajo de él si el relleno inferior de `.view-container` es más bajo que el
// botón, y entonces no hay más recorrido para apartarlo. En móvil el hueco existía (80 y 88 px); en
// escritorio eran 24. Medido en yaqu.app el 6-oct-2026 a 1280×800, ficha del parte: el botón quedaba
// sobre la última línea («Sin notas») y sobre el aviso de «No se ha podido guardar el cambio».
//
// QUÉ MIDE ESTO, y qué no: lee de `tutorial.js` cuánto ocupa el botón y de la hoja cuánto reserva
// cada regla de `.view-container`, y exige que la reserva lo cubra. No pinta nada: lo que tapa o
// deja de tapar en pantalla está medido con navegador y escrito en `docs/master/SCRUM-1464.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** Lo que el botón ocupa desde el borde inferior: su `bottom` más su `height`, leídos de su estilo. */
function altoQueOcupaElBoton(fuente) {
  const i = fuente.indexOf("btn.id = 'tut-help-btn'");
  if (i < 0) return null;
  const estilo = fuente.slice(i, i + 700);
  const px = (prop) => { const m = new RegExp(`(?:^|[;\\s\`])${prop}\\s*:\\s*(\\d+)px`).exec(estilo); return m ? Number(m[1]) : null; };
  const abajo = px('bottom'), alto = px('height');
  return abajo === null || alto === null || !/position\s*:\s*fixed/.test(estilo) ? null : abajo + alto;
}

/** El relleno INFERIOR (px) de cada regla cuyo selector es exactamente `.view-container`. */
function rellenosInferiores(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(limpio))) {
    if (!m[1].split(',').map((s) => s.trim()).includes('.view-container')) continue;
    const corto = /(?:^|;)\s*padding\s*:\s*([^;]+)/.exec(m[2]);
    const largo = /(?:^|;)\s*padding-bottom\s*:\s*([^;]+)/.exec(m[2]);
    if (largo) { out.push(parseFloat(largo[1])); continue; }
    if (!corto) continue;
    const v = corto[1].trim().split(/\s+/).map(parseFloat);
    out.push(v.length === 1 ? v[0] : v.length === 2 ? v[0] : v[2]);
  }
  return out;
}

/**
 * SCRUM-1464 (b) · lo que la PÁGINA da por ocupado abajo al traer algo a la vista: el
 * `scroll-padding-bottom` (px) de cada regla cuyo selector es exactamente `html`. La página es la
 * que se desplaza (`document.scrollingElement`), así que la reserva sólo cuenta puesta ahí.
 */
function reservasAlTraerALaVista(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(limpio))) {
    if (!m[1].split(',').map((s) => s.trim()).includes('html')) continue;
    const largo = /(?:^|;)\s*scroll-padding-bottom\s*:\s*([^;]+)/.exec(m[2]);
    const corto = /(?:^|;)\s*scroll-padding\s*:\s*([^;]+)/.exec(m[2]);
    if (largo) { out.push(parseFloat(largo[1])); continue; }
    if (!corto) continue;
    const v = corto[1].trim().split(/\s+/).map(parseFloat);
    out.push(v.length <= 2 ? v[0] : v[2]);
  }
  return out;
}

const BOTON = altoQueOcupaElBoton(leer('public/dashboard/js/tutorial.js'));
const RELLENOS = rellenosInferiores(leer('public/dashboard/css/styles.css'));
const RESERVAS = reservasAlTraerALaVista(leer('public/dashboard/css/styles.css'));

test('SCRUM-1464 · SUELO: se lee cuánto ocupa el botón y cuánto reserva cada regla de la página', () => {
  assert.ok(Number.isFinite(BOTON) && BOTON >= 44,
    `🔴 CIEGO: no sé leer el botón de ayuda en \`tutorial.js\` (leído: ${BOTON}). Si ha cambiado de sitio o de forma, este guard no mide nada.`);
  assert.ok(RELLENOS.length >= 3,
    `🔴 CIEGO: esperaba al menos las tres reglas de \`.view-container\` (escritorio y dos de móvil) y leo ${RELLENOS.length}.`);
});

test('SCRUM-1464 · 🔴 toda regla de `.view-container` reserva abajo, como mínimo, lo que ocupa el botón de ayuda', () => {
  const cortos = RELLENOS.filter((r) => !(r >= BOTON));
  assert.deepEqual(cortos, [],
    `🔴 hay ${cortos.length} regla(s) de \`.view-container\` con menos relleno inferior (${cortos.join(', ')} px) que lo que ocupa el botón `
    + `(${BOTON} px = su \`bottom\` + su \`height\`): lo último de la pantalla queda debajo del botón y no se puede apartar.`);
});

test('SCRUM-1464 · CONTROL POSITIVO: con los 24 px de antes, el lector CAE; y entiende las tres formas de `padding`', () => {
  assert.deepEqual(rellenosInferiores('.view-container { padding: 24px; flex: 1; }'), [24]);
  assert.deepEqual(rellenosInferiores('.view-container { padding: 16px 14px 80px; }'), [80]);
  assert.deepEqual(rellenosInferiores('.x, .view-container { padding: 10px 20px; }'), [10]);
  assert.deepEqual(rellenosInferiores('.view-container { padding: 1px; padding-bottom: 90px; }'), [90]);
  assert.deepEqual(rellenosInferiores('/* .view-container { padding: 999px; } */ .view-container img { padding: 0; }'), [],
    'ni un comentario ni `.view-container img` son la regla de la página');
  assert.equal(altoQueOcupaElBoton("btn.id = 'tut-help-btn';\nbtn.style.cssText = `position:fixed;bottom:20px;right:20px;width:48px;height:48px;`"), 68);
  assert.equal(altoQueOcupaElBoton('nada que ver'), null);
});

// ── (b) · lo que se trae a la vista ──────────────────────────────────────────────────────────────
// El relleno de arriba sólo sirve con la página bajada DEL TODO. A mitad de página, un
// `scrollIntoView({ block: 'nearest' })` o el foco dejan lo traído pegado al borde inferior, debajo
// del botón: medido en yaqu.app a 390 y a 360 sobre el aviso del parte (tapaba letras). Lo que lo
// evita es que la página dé por ocupado ese trozo. QUÉ NO MIDE: que algo traiga el aviso a la
// vista. Eso es de cada pantalla, y la del parte hoy no lo hace (`docs/master/SCRUM-1464.md`).

test('SCRUM-1464 (b) · 🔴 al traer algo a la vista, la página da por ocupado abajo lo que ocupa el botón de ayuda', () => {
  assert.ok(RESERVAS.length >= 1,
    `🔴 ninguna regla de \`html\` declara \`scroll-padding-bottom\` (leídas: ${RESERVAS.length}): lo que se traiga a la vista con `
    + '`nearest` acaba pegado al borde inferior, debajo del botón de ayuda.');
  const cortas = RESERVAS.filter((r) => !(r >= BOTON));
  assert.deepEqual(cortas, [],
    `🔴 la página reserva ${cortas.join(', ')} px al traer algo a la vista y el botón ocupa ${BOTON} px.`);
});

test('SCRUM-1464 (b) · CONTROL POSITIVO: sin la reserva, o con una corta, el lector lo ve; y no se confunde de regla', () => {
  assert.deepEqual(reservasAlTraerALaVista('html { scroll-behavior: smooth; }'), [], 'sin reserva no se inventa una');
  assert.deepEqual(reservasAlTraerALaVista('html { scroll-behavior: smooth; scroll-padding-bottom: 80px; }'), [80]);
  assert.deepEqual(reservasAlTraerALaVista('html, body { scroll-padding: 10px 0 24px; }'), [24]);
  assert.deepEqual(reservasAlTraerALaVista('html { scroll-padding: 40px; }'), [40]);
  assert.deepEqual(reservasAlTraerALaVista('/* html { scroll-padding-bottom: 999px; } */ html.x { scroll-padding-bottom: 999px; } .modal { scroll-padding-bottom: 999px; }'), [],
    'ni un comentario, ni `html.x`, ni otro contenedor son la página');
});

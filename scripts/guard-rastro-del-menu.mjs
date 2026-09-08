#!/usr/bin/env node
// scripts/guard-rastro-del-menu.mjs — SCRUM-819
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿DEJA RASTRO NAVEGAR POR EL MENÚ?
//
// La casa no tenía cómo preguntarlo. El banco de vistas (`tests/_banco-vistas.mjs`) monta cada
// pantalla llamando a su `renderXView` y —cuando navega— **pone el hash él mismo**. En su mundo
// hash y vista coinciden POR CONSTRUCCIÓN, así que «¿coinciden?» no es una pregunta que se le
// pueda hacer: la respuesta está cableada en el instrumento.
//
// Aquí se navega **como el profesional**: pulsando el botón del menú, en un navegador de verdad,
// y se le pregunta a `location.hash`, a `window.appState.view` y a `history.length` — tres cosas
// que sólo existen fuera del banco.
//
// 🔴 SUELO: si el barrido encuentra menos de 17 destinos, está ciego. Un «0 incoherencias» sobre
// 3 botones diría que no se ha mirado, no que todo esté bien.
// ═════════════════════════════════════════════════════════════════════════════════════════
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MINIMO_DESTINOS = 17;

const ME = {
  id: 1, email: 'demo@yaqu.app', name: 'Epipe', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
};

/** Sirve el dashboard real y responde a `/admin/*` con lo mínimo para que arranque. */
function servidor() {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/admin/me') return json(res, ME);
    if (u === '/admin/merchant') return json(res, { name: 'Epipe' });
    if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [], partes: [], gastos: [] });
    const rel = u === '/' || u === '/dashboard/' ? 'dashboard/index.html' : u.replace(/^\//, '');
    const f = path.join(RAIZ, 'public', rel);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      const tipo = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
      res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('no');
  });
}
const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };

/**
 * Navega por los 17 destinos de la forma que se le pida y devuelve, por destino, qué quedó.
 *
 * `como`: 'menu' pulsa el botón (lo que hace el profesional) · 'envoltorio' llama a
 * `renderAppView` (el control positivo: se sabe que ése sí escribe el hash).
 */
async function recorrer(pag, como) {
  return pag.evaluate(async (modo) => {
    const botones = [...document.querySelectorAll('.nav-item[data-view]')];
    const filas = [];
    for (const b of botones) {
      const destino = b.dataset.view;
      const historialAntes = history.length;
      if (modo === 'menu') b.click();
      else window.renderAppView(destino);
      await new Promise((r) => setTimeout(r, 90));
      filas.push({
        destino,
        hash: (location.hash || '').replace('#', ''),
        vista: (window.appState && window.appState.view) || null,
        historialSumado: history.length - historialAntes,
      });
    }
    return filas;
  }, como);
}

export async function medir() {
  const srv = servidor();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${srv.address().port}/dashboard/index.html`;
  const nav = await lanzarNavegador(puppeteer, { headless: 'new' });
  try {
    const pag = await nav.newPage();
    await pag.setViewport({ width: 1280, height: 900 });
    await pag.goto(BASE, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 700));

    const destinos = await pag.evaluate(() => [...document.querySelectorAll('.nav-item[data-view]')].map((b) => b.dataset.view));
    if (destinos.length < MINIMO_DESTINOS) {
      throw new Error(`[guard] SUELO: sólo ${destinos.length} destinos en el menú (mínimo ${MINIMO_DESTINOS}). `
        + 'Un «cero incoherencias» sobre esta población diría que no he mirado.');
    }

    const porMenu = await recorrer(pag, 'menu');
    await pag.evaluate(() => { location.hash = ''; });
    const porEnvoltorio = await recorrer(pag, 'envoltorio');

    // CONTROL NEGATIVO: un hash inventado no puede romper nada ni dejar la pantalla en blanco.
    await pag.evaluate(() => { location.hash = '#no-existe-esta-vista-819'; });
    await new Promise((r) => setTimeout(r, 300));
    const traeHashInventado = await pag.evaluate(() => ({
      vista: (window.appState && window.appState.view) || null,
      nodos: document.querySelectorAll('#view-container *').length,
    }));

    // 🔴 Y LO QUE DE VERDAD PREGUNTA EL PROFESIONAL: «atrás», ¿vuelve a la pantalla anterior o me
    // saca de la aplicación? `history.length` sube aunque el botón no sirva de nada; esto lo pulsa.
    await pag.evaluate(() => { location.hash = ''; });
    const clic = async (v) => {
      await pag.evaluate((x) => document.querySelector(`.nav-item[data-view="${x}"]`).click(), v);
      await new Promise((r) => setTimeout(r, 120));
    };
    await clic('customers'); await clic('products'); await clic('reports');
    const enReports = await pag.evaluate(() => window.appState.view);
    await pag.goBack(); await new Promise((r) => setTimeout(r, 300));
    const tras1 = await pag.evaluate(() => ({ vista: window.appState.view, hash: location.hash.replace('#', '') }));
    await pag.goBack(); await new Promise((r) => setTimeout(r, 300));
    const tras2 = await pag.evaluate(() => ({ vista: window.appState.view, hash: location.hash.replace('#', '') }));

    return { destinos, porMenu, porEnvoltorio, traeHashInventado, atras: { enReports, tras1, tras2 } };
  } finally {
    await nav.close();
    srv.close();
  }
}

// ⚠️ `ejecutadoDirectamente` y NO comparar `import.meta.url` con `process.argv[1]`: esa
// comparación NUNCA casa en Windows, así que el guard no habría arrancado al invocarlo por su
// ruta — una puerta que no abre. Me lo cazó `scrum765` (techo de 2 puertas frágiles) antes de
// llegar a CI, y tenía razón: el respaldo por nombre de fichero que había puesto tapaba el
// defecto en vez de arreglarlo.
if (ejecutadoDirectamente(import.meta.url)) {
  const r = await medir();
  const coh = (fs2) => fs2.filter((f) => f.hash === f.destino).length;
  const hist = (fs2) => fs2.reduce((a, f) => a + f.historialSumado, 0);
  console.log(`destinos del menú: ${r.destinos.length}\n`);
  console.log('════════ POR EL MENÚ (lo que hace el profesional) ════════');
  console.log(`  hash coherente con el destino: ${coh(r.porMenu)}/${r.porMenu.length}`);
  console.log(`  entradas de historial creadas: ${hist(r.porMenu)}`);
  for (const f of r.porMenu.filter((x) => x.hash !== x.destino).slice(0, 20)) {
    console.log(`    🔴 pulsé «${f.destino}» y el hash dice «${f.hash || '(vacío)'}» (vista: ${f.vista})`);
  }
  console.log('\n════════ CONTROL POSITIVO · por `renderAppView` ════════');
  console.log(`  hash coherente: ${coh(r.porEnvoltorio)}/${r.porEnvoltorio.length}`);
  console.log(`  entradas de historial creadas: ${hist(r.porEnvoltorio)}`);
  console.log('\n════════ CONTROL NEGATIVO · hash inventado ════════');
  console.log(`  vista: ${r.traeHashInventado.vista} · nodos pintados: ${r.traeHashInventado.nodos}`);
  console.log('\n════════ «ATRÁS», PULSADO DE VERDAD ════════');
  console.log(`  clientes → productos → informes  (estoy en: ${r.atras.enReports})`);
  console.log(`  atrás → vista ${r.atras.tras1.vista} · hash ${r.atras.tras1.hash || '(vacío)'}`);
  console.log(`  atrás → vista ${r.atras.tras2.vista} · hash ${r.atras.tras2.hash || '(vacío)'}`);

  // ── EL VEREDICTO ───────────────────────────────────────────────────────────
  const fallos = [];
  if (coh(r.porMenu) !== r.porMenu.length) {
    fallos.push(`el menú deja la URL incoherente en ${r.porMenu.length - coh(r.porMenu)} de `
      + `${r.porMenu.length} destinos: F5 lleva a otra pantalla y un enlace guardado abre la vista `
      + 'anterior. Navega por `window.renderAppView`, no por `renderView` crudo.');
  }
  if (hist(r.porMenu) < r.porMenu.length) {
    fallos.push(`${r.porMenu.length} clics del menú dejan ${hist(r.porMenu)} entradas de historial. `
      + 'Con `replaceState` no se crea ninguna y «atrás» saca de la aplicación.');
  }
  if (r.atras.tras1.vista !== 'products' || r.atras.tras2.vista !== 'customers') {
    fallos.push(`«atrás» no vuelve: desde informes debería dar productos y luego clientes, y da `
      + `${r.atras.tras1.vista} y ${r.atras.tras2.vista}.`);
  }
  if (r.traeHashInventado.nodos < 20) {
    fallos.push(`un hash inventado deja la pantalla con ${r.traeHashInventado.nodos} nodos: `
      + 'se ha quedado en blanco, que es peor que ignorarlo.');
  }

  if (fallos.length) {
    console.error('\n🔴 RASTRO DE NAVEGACIÓN ROTO:');
    for (const f of fallos) console.error(`   · ${f}`);
    process.exit(1);
  }
  console.log('\n✓ los 17 destinos dejan rastro, «atrás» vuelve, y un hash inventado no rompe nada.');
}

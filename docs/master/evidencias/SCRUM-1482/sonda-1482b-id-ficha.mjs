// SCRUM-1482 · Qué se lee en el TÍTULO de la vista y en la CABECERA de la ficha de un presupuesto:
// mientras carga, cargada, si la carga falla, y si el usuario se va (o abre otra) antes de que cargue.
// Sobre yaqu.app, cuenta QA. Sólo GET (control positivo del interceptor en comun.mjs).
//
//   node id-ficha.mjs            → lo que sirve producción
//   node id-ficha.mjs <carpeta>  → sirve <carpeta>/app.js y <carpeta>/quotesDetailView.js en su lugar
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { abrir } from './comun.mjs';

const carpeta = process.argv[2] && process.argv[2] !== '-' ? resolve(process.argv[2]) : null;
const servir = {};
if (carpeta) {
  for (const f of ['app.js', 'quotesDetailView.js']) {
    const ruta = join(carpeta, f);
    if (!existsSync(ruta)) { console.log(`CIEGO: no existe ${ruta}`); console.log('EXIT=2'); process.exit(2); }
    servir[`/dashboard/js/${f}`] = ruta;
  }
}

const { browser, page, noGet, errores, build } = await abrir({ servir });
console.log(`SERVIDO=${carpeta ? `LOCAL ${carpeta} (app.js y quotesDetailView.js)` : 'lo de producción'} · build ${build}`);

// TESTIGO de que lo servido es lo que se ejecuta: el fuente de la función que pinta la ficha.
const testigo = await page.evaluate(() => {
  const f = String(renderQuoteDetailView);
  return { conRegex: f.includes('/^Presupuesto #/'), conConectada: f.includes('page.isConnected'), conMontada: f.includes('page.parentNode === container'), conIgualdad: f.includes('textContent === window.appLocale.quote'), conPalabraExacta: f.includes('viewTitleEl.textContent === palabraDelDocumento'), h2ConId: f.includes('Number.isFinite(id) ? id') };
});
console.log(`TESTIGO=${JSON.stringify(testigo)} · palabra del locale: «${await page.evaluate(() => window.appLocale && window.appLocale.quote)}»`);

// PALABRA=Cotización fuerza la palabra del locale EN LA PÁGINA (la cuenta QA es de España): simula otro país, no lo es.
if (process.env.PALABRA) { await page.evaluate((p) => { window.appLocale.quote = p; }, process.env.PALABRA); console.log(`PALABRA FORZADA POR LA SONDA: «${process.env.PALABRA}»`); }

const lista = await page.evaluate(async () => { const r = await getQuotesList(); return Array.isArray(r) ? r : (r.quotes || r.items || r.data || []); });
const distintos = lista.map((q) => ({ id: q.id, numero: q.number ?? q.quoteNumber ?? null })).filter((q) => q.numero != null && q.numero !== q.id);
console.log(`POBLACION=${lista.length} presupuestos · ${distintos.length} con número distinto de su id`);
if (distintos.length < 2) { console.log('CIEGO: hacen falta dos presupuestos con número distinto de su id'); console.log('EXIT=2'); await browser.close(); process.exit(2); }
const [A, B] = distintos;
console.log(`A = id ${A.id} / número ${A.numero} · B = id ${B.id} / número ${B.numero}`);

const leer = () => page.evaluate(() => ({
  titulo: document.getElementById('view-title')?.textContent ?? null,
  pestana: document.title,
  h2: document.querySelector('.detail-head h2')?.textContent ?? null,
  aviso: document.querySelector('.detail-page .alert')?.textContent?.trim() || null,
}));
const abrirFicha = (id) => page.evaluate((i) => { window.appState = window.appState || {}; window.appState.quoteId = i; renderAppView('quotes-detail'); }, id);
const rutaFicha = (id) => (url) => new URL(url).pathname === `/admin/quotes/${id}`;
const aInicio = async () => { await page.evaluate(() => renderAppView('home')); await page.waitForTimeout(600); };
const filas = [];
const fila = (escenario, momento, l, espera) => { filas.push({ escenario, momento, ...l, espera }); };

async function conRutas(reglas, cuerpo) {
  const puestas = [];
  const cuenta = {};
  for (const [id, modo] of reglas) {
    cuenta[id] = 0;
    const h = async (route) => {
      cuenta[id]++;
      if (modo === 'lenta') { await new Promise((r) => setTimeout(r, 2500)); return route.continue(); }
      return route.abort();
    };
    const casa = rutaFicha(id);
    await page.route(casa, h);
    puestas.push([casa, h]);
  }
  await cuerpo();
  for (const [casa, h] of puestas) await page.unroute(casa, h);
  await aInicio();
  return cuenta;
}

// E1 · carga lenta de A
let c = await conRutas([[A.id, 'lenta']], async () => {
  await abrirFicha(A.id); await page.waitForTimeout(600);
  fila('E1 carga lenta de A', 'mientras carga', await leer(), 'sin el id de la tabla');
  await page.waitForTimeout(4500);
  fila('E1 carga lenta de A', 'cargada', await leer(), `título y cabecera con el número ${A.numero}`);
});
console.log(`E1 · peticiones retrasadas: ${c[A.id]}`);

// E2 · la carga de A falla
c = await conRutas([[A.id, 'corta']], async () => {
  await abrirFicha(A.id); await page.waitForTimeout(3500);
  fila('E2 la carga de A falla', 'después', await leer(), 'sin el id de la tabla');
});
console.log(`E2 · peticiones cortadas: ${c[A.id]}`);

// E3 · el usuario se va a Inicio mientras A carga: el título de Inicio no se toca
c = await conRutas([[A.id, 'lenta']], async () => {
  await abrirFicha(A.id); await page.waitForTimeout(600);
  await page.evaluate(() => renderAppView('home')); await page.waitForTimeout(400);
  const antes = await leer();
  await page.waitForTimeout(4500);
  const l = await leer();
  fila('E3 se va a Inicio mientras A carga', 'cuando A ya llegó', l, `el título de Inicio («${antes.titulo}»), intacto`);
});
console.log(`E3 · peticiones retrasadas: ${c[A.id]}`);

// E4 · abre A (lenta) y enseguida B, cuya carga falla
c = await conRutas([[A.id, 'lenta'], [B.id, 'corta']], async () => {
  await abrirFicha(A.id); await page.waitForTimeout(600);
  await abrirFicha(B.id); await page.waitForTimeout(5000);
  fila('E4 abre A (lenta) y luego B, que falla', 'cuando A ya llegó', await leer(), `nada de A (ni ${A.numero} ni ${A.id}) sobre la ficha de B`);
});
console.log(`E4 · retrasadas de A: ${c[A.id]} · cortadas de B: ${c[B.id]}`);

// E5 · abre A (lenta) y enseguida B, que carga bien
c = await conRutas([[A.id, 'lenta']], async () => {
  await abrirFicha(A.id); await page.waitForTimeout(600);
  await abrirFicha(B.id); await page.waitForTimeout(5000);
  fila('E5 abre A (lenta) y luego B, que carga', 'cuando A ya llegó', await leer(), `título y cabecera con el número ${B.numero}`);
});
console.log(`E5 · retrasadas de A: ${c[A.id]}`);

console.log('--- FILAS (escenario | momento | título de la vista | pestaña del navegador | cabecera de la ficha | aviso | lo que se espera)');
for (const f of filas) console.log(`${f.escenario} | ${f.momento} | «${f.titulo}» | «${f.pestana}» | «${f.h2}» | ${f.aviso ? `«${f.aviso}»` : '-'} | ${f.espera}`);
console.log(`no-GET: ${noGet.map((n) => `${n.metodo} ${n.ruta} → ${n.hecho}`).join(' · ') || 'ninguna'}`);
console.log(`errores de página: ${errores.join(' · ') || 'ninguno'}`);
await browser.close();
console.log('EXIT=0');

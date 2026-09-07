#!/usr/bin/env node
// scripts/guard-portal-en-la-ficha.mjs — SCRUM-795 · EL BOTÓN DEL PORTAL, MEDIDO EN NAVEGADOR
//
//   npm run guard:portal-en-la-ficha
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS PANTALLAS DEL MISMO CLIENTE NO DECÍAN LO MISMO
//
//   LISTA     (`customersView.js`)      → pinta «Portal» SIEMPRE; al pulsar llama a
//                                         `/admin/customers/:id/portal-url`, que CURA.
//   FICHA 360 (`customerDetailView.js`) → pintaba «🔗 Portal` SÓLO si `customer.portalUrl`,
//                                         que el endpoint sirve en crudo (`portalToken ? url : null`).
//
// Sin token, en la ficha **el botón no existía**. No fallaba el enlace: desaparecía el botón, sin
// decir nada — y medido el 6-sep-2026, los SIETE clientes del demo estaban en ese caso.
//
// ── 🔴 SE MIDE EL DOM RENDERIZADO, NO EL FUENTE ──────────────────────────────────────────────
// Un `${cond ? botón : ''}` bien puesto y uno mal puesto SE LEEN IGUAL en el fuente. Es la
// lección de SCRUM-515: el árbitro es el DOM vivo al final del render, en navegador de verdad.
//
// ── 🔴 LAS VISTAS SON LAS DE VERDAD ──────────────────────────────────────────────────────────
// Se cargan `customerDetailView.js` y `customersView.js` DEL ÁRBOL y se llaman sus funciones de
// render. Lo único doblado es `apiRequest`, que es el punto por el que las dos vistas piden datos:
// medir una reproducción mediría mi reproducción.
//
// ── SUELOS, y son la mitad del guard ─────────────────────────────────────────────────────────
// Antes de dar ningún veredicto se exige que la vista HAYA PINTADO (un ancla suya en el DOM). Una
// vista que no pinta no tiene botón, y ese «no hay botón» se lee igual que el defecto — que es
// justo la confusión que este guard existe para deshacer. Si algo no se puede medir: exit 2.
//
// SALIDAS: 0 las dos pantallas de acuerdo · 1 hallazgo · 2 no supe medir.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';   // SCRUM-730
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';

const AQUI = fileURLToPath(import.meta.url);
const RAIZ = path.join(path.dirname(AQUI), '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

/** El id del botón de la ficha. Sale del propio fuente, no de una copia de aquí. */
const ID_BOTON_FICHA = 'btn-copy-portal-360';

/** Los dos casos. El SIN token es el defecto; el CON token es el control positivo. */
const CASOS = [
  { nombre: 'SIN token', portalUrl: null },
  { nombre: 'CON token', portalUrl: 'https://ejemplo.test/cliente/tok-de-prueba' },
];

const leer = (f) => fs.readFileSync(path.join(JS, f), 'utf8');

function pagina(caso) {
  const detalle = {
    customer: {
      id: 7, name: 'Cliente de medición', phone: '34000000001', email: 'x@test.local',
      portalUrl: caso.portalUrl, tags: null,
    },
    quotes: [], invoices: [], events: [],
    stats: { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0 },
  };
  // `getCustomers` devuelve el ARRAY tal cual (api.js:1314 → apiRequest('/admin/customers')), y
  // `pintar()` hace `Array.isArray(ultimoLote)`. Devolver un objeto envuelto daría lote vacío y
  // cero filas — o sea, el mismo 'no hay botón' que el defecto. Se devuelve lo que devuelve.
  const lista = [{ id: 7, name: 'Cliente de medición', phone: '34000000001', email: 'x@test.local' }];
  // 🔴 LAS DEPENDENCIAS SE CARGAN DE VERDAD, Y EN EL ORDEN QUE DECLARA LA CASA.
  // `api.js` trae `fmtMoneyEs` (y su propio `apiRequest`, que se dobla DESPUÉS para que gane);
  // `filtroClientes.js` va antes de `customersView.js` — dependencia declarada en
  // `tests/_banco-vistas.mjs` (SCRUM-581). Sustituir un ayudante por un muñón mediría mi muñón.
  return `<!doctype html><meta charset="utf-8">
<div class="layout"><div class="main">
  <div id="ficha"></div>
  <div id="lista"></div>
</div></div>
<script>${leer('api.js')}</script>
<script>${leer('csvImport.js')}</script>
<script>${leer('filtroClientes.js')}</script>
<script>${leer('customerDetailView.js')}</script>
<script>${leer('customersView.js')}</script>
<script>
  // EL UNICO DOBLE, y va DESPUES de los reales para pisar al de api.js: es el punto por el que
  // las dos vistas piden datos, y el que permite fijar el caso «sin token».
  // (sin comillas invertidas aqui dentro: esto vive en una plantilla y las cerraria)
  window.__peticiones = [];
  window.apiRequest = async (url) => {
    window.__peticiones.push(url);
    if (String(url).includes('/detail')) return ${JSON.stringify(detalle)};
    if (String(url).includes('/portal-url')) return { portalUrl: 'https://ejemplo.test/cliente/curado', token: 'curado' };
    return ${JSON.stringify(lista)};
  };
  window.appState = { customerId360: 7 };
  window.appLocale = {};
  window.renderAppView = () => {};
  window.showToast = () => {};
  window.openModal = () => {};
  window.setAlert = () => {};
  // NO se dobla createElement: lo define customersView.js. Pisarlo mediria mi createElement.
</script>
`;
}

const servidor = http.createServer((req, res) => {
  const caso = CASOS.find((c) => req.url.includes(encodeURIComponent(c.nombre)) || req.url.includes(c.nombre.replace(' ', '-')));
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(pagina(caso || CASOS[0]));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${servidor.address().port}`;

const navegador = await lanzarNavegador(puppeteer, {});
const filas = [];
let ciego = null;

try {
  const page = await navegador.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  for (const caso of CASOS) {
    await page.goto(`${base}/${caso.nombre.replace(' ', '-')}`, { waitUntil: 'networkidle0' });

    const r = await page.evaluate(async (idBoton) => {
      const out = { pintoFicha: false, pintoLista: false, botonFicha: false, botonLista: false, peticiones: [] };
      // ── LA FICHA 360, la de verdad ──
      if (typeof renderCustomer360View !== 'function') return { ...out, error: 'renderCustomer360View no está definida' };
      await renderCustomer360View(document.getElementById('ficha'), 7);
      // SUELO: ¿ha pintado algo suyo? Sin ancla, «no hay botón» no significa nada.
      out.pintoFicha = Boolean(document.querySelector('#ficha #btn-edit-360'));
      out.botonFicha = Boolean(document.querySelector('#ficha #' + idBoton));

      // ── LA LISTA, la de verdad ──
      if (typeof renderCustomersView === 'function') {
        try {
          await renderCustomersView(document.getElementById('lista'));
          await new Promise((res) => setTimeout(res, 300));
        } catch (e) { out.errorLista = String(e && e.message); }
      }
      const botones = [...document.querySelectorAll('#lista button')];
      out.pintoLista = botones.length > 0;
      out.botonLista = botones.some((b) => b.textContent.trim() === 'Portal');
      out.peticiones = window.__peticiones.slice();
      return out;
    }, ID_BOTON_FICHA);

    if (r.error) { ciego = `${caso.nombre}: ${r.error}`; break; }
    if (!r.pintoFicha) { ciego = `${caso.nombre}: la FICHA 360 no ha pintado (sin \`#btn-edit-360\`). Sin ancla, «no hay botón» no dice nada.`; break; }
    if (!r.pintoLista) { ciego = `${caso.nombre}: la LISTA no ha pintado ningún botón${r.errorLista ? ` (${r.errorLista})` : ''}.`; break; }
    filas.push({ caso: caso.nombre, ficha: r.botonFicha, lista: r.botonLista, peticiones: r.peticiones });
  }
} finally {
  await navegador.close().catch(() => {});
  servidor.close();
}

console.log(`\n${'═'.repeat(84)}`);
console.log('EL BOTÓN DEL PORTAL · medido en NAVEGADOR, sobre el DOM renderizado');
console.log(`${'═'.repeat(84)}`);

if (ciego) {
  console.error(`\n🔴 NO SUPE MEDIR — no se da ningún veredicto:\n   · ${ciego}\n`);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}

console.log('  caso        LISTA    FICHA 360');
for (const f of filas) {
  console.log(`  ${f.caso.padEnd(12)}${(f.lista ? 'botón' : 'NO').padEnd(9)}${f.ficha ? 'botón' : 'NO EXISTE'}`);
}

const sinToken = filas.find((f) => f.caso === 'SIN token');
const conToken = filas.find((f) => f.caso === 'CON token');
const hallazgos = [];
if (!sinToken.lista) hallazgos.push('la LISTA no pinta el botón sin token: ha cambiado el lado que estaba bien');
if (!sinToken.ficha) hallazgos.push('la FICHA 360 NO pinta el botón sin token: las dos pantallas del mismo cliente no dicen lo mismo');
if (!conToken.ficha || !conToken.lista) hallazgos.push('con token alguna de las dos ha dejado de pintarlo');

// 🔴 Y LA OTRA MITAD: abrir la ficha NO puede pedir `/portal-url`. Si lo pidiera, abrir la
// pantalla dispararía la cura — una ESCRITURA — sin que nadie pulse nada, que es exactamente la
// salida que se descartó.
const abrirPide = filas.some((f) => f.peticiones.some((u) => String(u).includes('/portal-url')));
if (abrirPide) hallazgos.push('ABRIR la ficha llama a `/portal-url`: eso CURA, y curar escribe. El botón se pinta siempre, pero la llamada es del CLIC');

console.log('\n  peticiones al abrir (las dos vistas):');
for (const f of filas) console.log(`    ${f.caso.padEnd(12)}${f.peticiones.join(' · ') || '(ninguna)'}`);

if (hallazgos.length) {
  console.error('\n🔴 HALLAZGOS:\n  · ' + hallazgos.join('\n  · ') + '\n');
  process.exit(SALIDA_HALLAZGO);
}
console.log('\n✅ Las dos pantallas dicen lo mismo, y abrir la ficha no cura.\n');

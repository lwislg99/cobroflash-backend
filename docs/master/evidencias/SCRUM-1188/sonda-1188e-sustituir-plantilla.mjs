// SCRUM-1188e (parte C) · ¿Qué pasa al «Guardar como plantilla» con el NOMBRE de una plantilla que ya existe?
// Sobre yaqu.app, cuenta QA. NO ESCRIBE: las plantillas viven en un servidor en memoria de la sonda,
// con la MISMA regla que `templates.routes.ts` tras SCRUM-1188c (en el PUT, `paymentTerms` se escribe
// si la clave viaja, aunque sea null; `name`/`currency`/`lines`/`tiers` ignoran null). La lista (GET),
// el POST y el PUT los contesta la sonda; nada de eso llega a producción. Control positivo del
// interceptor en comun.mjs.
//
//   node sustituir-plantilla.mjs                  → el quotesView.js de producción
//   node sustituir-plantilla.mjs <quotesView.js>  → sirve ese fichero en su lugar
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { abrir } from './comun.mjs';

const local = process.argv[2] && process.argv[2] !== '-' ? resolve(process.argv[2]) : null;
if (local && !existsSync(local)) { console.log(`CIEGO: no existe ${local}`); console.log('EXIT=2'); process.exit(2); }

// ── el servidor en memoria ──
let guardadas = [];
let reloj = 0;
const sembrar = () => { reloj = 1; guardadas = [{ id: 990010, name: 'Caldera (sonda)', currency: 'EUR', tiers: null, paymentTerms: 'FIFTY_FIFTY', updatedAt: 1, lines: [{ concept: 'Revisión de caldera (sonda)', qty: 1, price: 90, tax: 0.21 }] }]; };
const respuestas = (metodo, ruta, cuerpo) => {
  if (metodo === 'POST' && ruta === '/admin/templates') {
    const fila = { id: 990010 + guardadas.length, name: cuerpo?.name, currency: cuerpo?.currency, lines: cuerpo?.lines, tiers: cuerpo?.tiers ?? null, paymentTerms: cuerpo?.paymentTerms ?? null, updatedAt: ++reloj };
    guardadas.push(fila);
    return { status: 201, body: fila };
  }
  const m = ruta.match(/^\/admin\/templates\/(\d+)$/);
  if (metodo === 'PUT' && m) {
    const fila = guardadas.find((g) => g.id === Number(m[1]));
    if (!fila) return { status: 404, body: { error: 'not_found' } };
    if (cuerpo?.name != null) fila.name = String(cuerpo.name).trim();
    if (cuerpo?.currency != null) fila.currency = String(cuerpo.currency).slice(0, 3).toUpperCase();
    if (cuerpo?.lines != null) fila.lines = cuerpo.lines;
    if (cuerpo?.tiers != null) fila.tiers = cuerpo.tiers;
    if (cuerpo && Object.prototype.hasOwnProperty.call(cuerpo, 'paymentTerms')) fila.paymentTerms = cuerpo.paymentTerms;
    fila.updatedAt = ++reloj;
    return { status: 200, body: fila };
  }
  return null;
};
let aceptar = true;
const { browser, page, noGet, dialogos, errores, build } = await abrir({
  servir: local ? { '/dashboard/js/quotesView.js': local } : {},
  respuestas,
  acepta: () => aceptar,
});
let listasServidas = 0;
await page.route((url) => new URL(url).pathname === '/admin/templates', async (route) => {
  if (route.request().method() !== 'GET') return route.fallback();
  listasServidas++;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...guardadas].sort((a, b) => b.updatedAt - a.updatedAt)) });
});

console.log(`SERVIDO=${local ? `LOCAL ${local}` : 'el quotesView.js de producción'} · build del panel ${build}`);
const fuente = await page.evaluate(async () => (await fetch('/dashboard/js/quotesView.js')).text());
console.log(`TESTIGO=${JSON.stringify({ sustituye: fuente.includes('¿Quieres sustituirla?'), guardaCobro: fuente.includes('lines: templateLines, paymentTerms })') })} · ROL=${await page.evaluate(() => window.appUserRole)}`);

const abrirEditor = async () => {
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacén */ } renderAppView('home'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => renderAppView('quotes-new'));
  await page.waitForSelector('select[name="payment_terms"]', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1500);
};
const poner = (sel, valor) => page.evaluate(([s, v]) => {
  const el = document.querySelector(s);
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, [sel, valor]);
const pulsarPorTexto = (sel, t) => page.evaluate(([s, x]) => { const b = [...document.querySelectorAll(s)].find((e) => e.textContent.includes(x)); if (b) b.click(); return !!b; }, [sel, t]);
const alerta = () => page.evaluate(() => [...document.querySelectorAll('#view-container .alert')]
  .filter((a) => a.textContent.trim() && getComputedStyle(a).display !== 'none').map((a) => `${a.textContent.trim()} [${a.className}]`).join(' ‖ ') || null);

const CASOS = [
  { que: 'MISMO NOMBRE, dice que SÍ (cobro «Acordar con el cliente»)', nombre: 'Caldera (sonda)', cobro: 'MANUAL', precio: '120', acepta: true },
  { que: 'MISMO NOMBRE, dice que NO', nombre: 'Caldera (sonda)', cobro: 'MANUAL', precio: '120', acepta: false },
  { que: 'MISMO NOMBRE desde «Personalizado», dice que SÍ', nombre: 'Caldera (sonda)', cobro: 'CUSTOM', precio: '120', acepta: true },
  { que: 'otras mayúsculas y espacios («  caldera (SONDA) »), dice que SÍ', nombre: '  caldera (SONDA) ', cobro: 'FULL_UPFRONT', precio: '120', acepta: true },
  { que: 'CONTROL · nombre que no existe', nombre: 'Caldera de gasoil (sonda)', cobro: 'FULL_UPFRONT', precio: '120', acepta: true },
];
const filas = [];
for (const c of CASOS) {
  sembrar();
  aceptar = c.acepta;
  await abrirEditor();
  noGet.length = 0; dialogos.length = 0;
  await poner('.quote-line__concept input', 'Revisión de caldera (sonda)');
  await poner('.quote-line__qty input', '1');
  await poner('.quote-line__price input', c.precio);
  const opciones = await page.evaluate(() => [...document.querySelector('select[name="payment_terms"]').options].map((o) => o.value));
  if (!opciones.includes(c.cobro)) { filas.push({ ...c, ciego: `el selector no ofrece ${c.cobro}` }); continue; }
  await poner('select[name="payment_terms"]', c.cobro);
  await page.locator('button[aria-label="Más acciones"]').first().click();
  if (!(await pulsarPorTexto('[role="menu"] button', 'Guardar como plantilla'))) { filas.push({ ...c, ciego: 'no está «Guardar como plantilla»' }); continue; }
  await page.waitForSelector('#tpl-name-input', { timeout: 5000 });
  await page.fill('#tpl-name-input', c.nombre);
  await page.click('#save-tpl-btn');
  await page.waitForTimeout(1200);
  const hoja = await page.evaluate(() => { const b = document.querySelector('#save-tpl-btn'); return b ? { abierta: true, boton: b.textContent.trim(), desactivado: b.disabled, nombre: document.querySelector('#tpl-name-input').value } : { abierta: false }; });
  // El aviso se lee ANTES de pulsar la ficha: la ficha pinta el suyo encima («… cargada — 1 líneas añadidas»).
  const avisoDeGuardar = hoja.abierta ? null : await alerta();
  // La ficha rápida de la plantilla, DESPUÉS de guardar: se pulsa y se lee el precio de la línea que añade.
  let ficha = 'no se probó';
  if (!hoja.abierta) {
    const antes = await page.evaluate(() => document.querySelectorAll('.quote-line__price input').length);
    if (await pulsarPorTexto('.quote-plantilla-chip', 'Caldera (sonda)')) {
      await page.waitForTimeout(500);
      const precios = await page.evaluate(() => [...document.querySelectorAll('.quote-line__price input')].map((i) => i.value));
      ficha = precios.length === antes + 1 ? `añade una línea a ${precios.at(-1)}` : `CIEGO: líneas ${antes} → ${precios.length}`;
    } else ficha = 'no hay ficha rápida de «Caldera (sonda)»';
  } else await page.evaluate(() => document.querySelector('#save-tpl-close')?.click());
  filas.push({ ...c, dialogos: dialogos.map((d) => `${d.tipo}: «${d.texto}»`), escrituras: noGet.map((n) => `${n.metodo} ${n.ruta} ${JSON.stringify(Object.keys(n.cuerpo || {}).sort())} paymentTerms=${n.cuerpo && 'paymentTerms' in n.cuerpo ? JSON.stringify(n.cuerpo.paymentTerms) : 'NO VIAJA'} → ${n.hecho}`), alerta: avisoDeGuardar, hoja, ficha, servidor: guardadas.map((g) => `#${g.id} «${g.name}» ${g.lines[0].price} € · cobro ${JSON.stringify(g.paymentTerms)}`) });
}
console.log('--- FILAS (partida de cada caso: UNA plantilla «Caldera (sonda)» a 90 € con cobro FIFTY_FIFTY; se teclea 120 €)');
for (const f of filas) {
  console.log(`\n· ${f.que}`);
  if (f.ciego) { console.log(`    CIEGO: ${f.ciego}`); continue; }
  console.log(`    pregunta     : ${f.dialogos.join(' ; ') || 'ninguna'}`);
  console.log(`    escrituras   : ${f.escrituras.join(' ; ') || 'NINGUNA'}`);
  console.log(`    en el servidor de la sonda: ${f.servidor.join(' ; ')}`);
  console.log(`    lo que dice  : ${f.alerta ? `«${f.alerta}»` : `(la hoja sigue abierta: botón «${f.hoja.boton}», ${f.hoja.desactivado ? 'DESACTIVADO' : 'activo'}, nombre «${f.hoja.nombre}»)`}`);
  console.log(`    ficha rápida : ${f.ficha}`);
}
console.log(`\nerrores de página: ${errores.join(' · ') || 'ninguno'}`);
console.log(`POBLACION=${filas.length} casos · ciegos=${filas.filter((f) => f.ciego).length} · listas servidas por la sonda=${listasServidas}`);
await browser.close();
console.log('EXIT=0');

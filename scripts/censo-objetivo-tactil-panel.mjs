// scripts/censo-objetivo-tactil-panel.mjs — SCRUM-787
//
//   npm run censo:tactil-panel
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// CUÁNTOS OBJETIVOS DE TOQUE DEL PANEL NO LLEGAN A LOS 44 px DE AB6. **ESTO NO ARREGLA NADA.**
//
// SCRUM-782 añadió la lista de Clientes al guard de objetivo táctil y, en cuanto miró, encontró
// botones `.btn-sm` a 30,8–31,0 px que llevaban ahí desde siempre. `.btn-sm` está en TODA la
// aplicación, así que la pregunta que quedó abierta es **cuántos son en total** — y sin ese
// número no se puede decidir si se toca una clase compartida.
//
// ── POR QUÉ ES UN CENSO Y NO UN GUARD ───────────────────────────────────────────────────────
// Medir es barato; VIGILAR cuesta segundos en cada PR, y el total de guards de navegador ya está
// bajo vigilancia (`npm run censo:guards-navegador`). Esto se ejecuta cuando alguien quiere el
// número, no en cada tanda. Qué superficies merecen entrar al guard lo decide el asesor.
//
// ── EL ÁRBITRO ES EL DEL GUARD, NO UNA COPIA ────────────────────────────────────────────────
// Se importa `FUENTE_MEDIDOR` de `_medidor-de-toque.mjs`, que instala `window.__areaDeToque` y
// mide con `elementsFromPoint` expandiendo desde el centro.
//
// 🔴 **LA CAJA CSS NO DECIDE, Y NO ES UN DETALLE DE ESTILO.** La caja miente siempre hacia el
// lado cómodo: en este mismo árbol hay un `BUTTON.detail-miga-link` cuya caja parece razonable y
// cuyo ÁREA DE TOQUE son 19,6 px. Un censo por caja habría dado un número más bonito y falso.
//
// ── LA POBLACIÓN SE DERIVA ──────────────────────────────────────────────────────────────────
// Las vistas son las que el banco PUBLICA (`render*View`), como en SCRUM-698. Una lista escrita a
// mano envejece y convertiría esto en «cuento lo que escribí».
//
// ── LO QUE NO SE PUEDE MEDIR SE DICE ────────────────────────────────────────────────────────
// Una vista que no monta, o que serializa un árbol ridículo, sale en `NO MEDIDAS` con su motivo.
// **No se cuenta como cero.** Un cero por no haber mirado es la peor cifra posible.
//
// ── Y CADA SUPERFICIE SE PRUEBA CON UNA SONDA ───────────────────────────────────────────────
// Un botón deliberadamente pequeño inyectado en CADA superficie y CADA anchura tiene que salir
// corto. La superficie que no lo caza **no está medida**, aunque devuelva cero. La sonda va en el
// HTML que se sirve, en memoria: **no se toca ningún fichero del árbol**.
//
// SALIDAS: 0 censo completo · 2 no supe medir (sonda fallida, o cero superficies).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from './_medidor-de-toque.mjs';
import { serializar, paginaDeClientes, CLIENTES_DE_MUESTRA } from './_pagina-panel.mjs';
import { cargarDashboard, pintarVista, todos } from '../tests/_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const ANCHOS = [929, 390];
const SONDA_TEXTO = '.';
const SONDA = '<button id="__sonda" style="width:12px;height:12px;padding:0;border:0">' + SONDA_TEXTO + '</button>';
const MINIMO_SUPERFICIES = 10;

let salida = 0;
const decir = (s) => console.log(s);
const noSupe = (s) => { console.error(s); salida = 2; };

/** Datos de muestra generosos: cuantas más vistas monten, mayor la población medida. */
const DATOS = (url) => {
  const u = String(url || '');
  if (u.includes('/admin/merchant')) return { id: 1, name: 'Fontanería Soler' };
  if (/\/admin\/customers/.test(u)) return CLIENTES_DE_MUESTRA;
  if (/\/admin\/products\b/.test(u)) return { ok: true, items: [{ id: 1, name: 'Grifo', price: 100, cost: 60, description: '', providerId: null, itemKind: null, active: true }] };
  if (/\/admin\/providers\b/.test(u)) return { ok: true, items: [{ id: 1, name: 'Proveedor QA', phone: '', email: '', notes: '' }] };
  if (/\/billing\/plans/.test(u)) return { plans: [], currentPlan: null, founding: null };
  if (/\/albaranes\//.test(u)) return { id: 1, estado: 'borrador', lines: [], items: [] };
  return [];
};

const vistasDelBanco = () => {
  const b = cargarDashboard(RAIZ);
  return Object.keys(b.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b.ctx[k] === 'function').sort();
};

// ═══ ① CENSO DE SUPERFICIES ══════════════════════════════════════════════════════════════════
const VISTAS = vistasDelBanco();
const superficies = [];
const noMedidas = [];
for (const fn of VISTAS) {
  let r;
  try { r = await pintarVista(cargarDashboard(RAIZ, { datos: DATOS }), fn); }
  catch (e) { noMedidas.push([fn, 'el banco no la pudo montar: ' + String(e.message).slice(0, 70)]); continue; }
  if (r.error) { noMedidas.push([fn, 'no monta: ' + String(r.error.message).slice(0, 70)]); continue; }
  let html;
  try { html = serializar(r.contenedor); }
  catch (e) { noMedidas.push([fn, 'no serializa: ' + String(e.message).slice(0, 70)]); continue; }
  const nodos = todos(r.contenedor).length;
  // Una vista con cuatro nodos no es una vista medida: es una vista que no llegó a pintarse.
  if (nodos < 20) { noMedidas.push([fn, `sólo ${nodos} nodos: la vista está a medias o vacía con estos datos`]); continue; }
  superficies.push({ fn, html });
}
// Clientes se monta con SU helper —el mismo que usa el guard— porque necesita una fila
// seleccionada para que la barra del móvil exista.
const cli = await paginaDeClientes(RAIZ);
if (cli.aviso) noMedidas.push(['renderCustomersView', 'el helper del guard no la pudo montar: ' + cli.aviso]);
else {
  const i = superficies.findIndex((s) => s.fn === 'renderCustomersView');
  const entrada = { fn: 'renderCustomersView', html: cli.html, viaHelper: true };
  if (i >= 0) superficies[i] = entrada; else superficies.push(entrada);
}

decir('═══ ① SUPERFICIES ═══');
decir(`vistas que publica el banco: ${VISTAS.length} · montadas y serializadas: ${superficies.length} · NO medidas: ${noMedidas.length}`);
const hayClientes = superficies.some((s) => s.fn === 'renderCustomersView');
decir(`✅ CONTROL POSITIVO · ¿está la de Clientes, que ya está montada en el guard? ${hayClientes ? 'sí' : '🔴 NO'}`);
if (!hayClientes) noSupe('🔴 CIEGO: sin la superficie que ya sabemos montar, el resto del censo no se sostiene.');
if (superficies.length < MINIMO_SUPERFICIES) {
  noSupe(`🔴 CIEGO: sólo ${superficies.length} superficies. Con una población así, los números de abajo no dicen nada.`);
}
decir('\nNO MEDIDAS (no se cuentan como cero — se dicen):');
for (const [fn, motivo] of noMedidas) decir(`   ⚠️ ${fn} → ${motivo}`);

// ═══ ② MEDIR ═════════════════════════════════════════════════════════════════════════════════
const HOJAS = '<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">';
const pagina = (cuerpo) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>' + cuerpo + '</body></html>';
const rutas = new Map();
for (const s of superficies) {
  rutas.set('/' + s.fn, pagina(s.html));
  rutas.set('/' + s.fn + '__sonda', pagina(s.html + SONDA));
}
const TIPOS = { '.css': 'text/css; charset=utf-8' };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (rutas.has(u)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(rutas.get(u)); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

// El recorrido: mismo criterio que el guard —censo derivado del DOM, con scroll, y el área de
// toque como árbitro—, escrito una vez aquí en vez de copiar el medidor.
const MEDIR = `(async (SEL, MIN) => {
  const nodos = [...document.querySelectorAll(SEL)];
  const medidos = [], sinPintar = [], noTocables = [];
  const nombreDe = (el) => {
    let c = '';
    if (el.className && typeof el.className === 'string') c = el.className.trim().split(/\\s+/).filter(Boolean).join('.');
    return el.tagName + (c ? '.' + c : '');
  };
  for (const el of nodos) {
    const r0 = el.getBoundingClientRect();
    const ficha = { sel: nombreDe(el), texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 34) || '(sin texto)' };
    if (!r0.width || !r0.height) { sinPintar.push(ficha); continue; }
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    if (m.error) { noTocables.push({ ...ficha, motivo: m.error }); continue; }
    medidos.push({ ...ficha, caja: m.caja, tocable: m.tocable, cumple: m.tocable >= MIN });
  }
  return { medidos, sinPintar, noTocables, total: nodos.length };
})`;
const EVAL = `${FUENTE_MEDIDOR};${MEDIR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO_TACTIL})`;

const navegador = await lanzarNavegador(puppeteer, {});
const resultados = [];
const sondasFallidas = [];
for (const ancho of ANCHOS) {
  for (const s of superficies) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });

    await page.goto(`http://127.0.0.1:${PUERTO}/${s.fn}__sonda`, { waitUntil: 'load' });
    const rs = await page.evaluate(EVAL);
    const sonda = rs.medidos.find((m) => m.sel === 'BUTTON' && m.texto === SONDA_TEXTO);
    if (!sonda || sonda.cumple !== false) {
      sondasFallidas.push(`${s.fn} @${ancho}px (${sonda ? 'medida pero NO marcada corta' : 'ni siquiera medida'})`);
    }

    await page.goto(`http://127.0.0.1:${PUERTO}/${s.fn}`, { waitUntil: 'load' });
    resultados.push({ fn: s.fn, ancho, ...(await page.evaluate(EVAL)) });
    await page.close();
  }
}
await navegador.close();
srv.close();

decir('\n═══ ✅ LA SONDA ═══');
decir(`superficies × anchuras: ${superficies.length * ANCHOS.length} · sondas NO cazadas: ${sondasFallidas.length}`);
for (const s of sondasFallidas) decir('   🔴 SUPERFICIE NO MEDIDA: ' + s);
if (sondasFallidas.length) {
  noSupe('🔴 hay superficies que no cazan un objetivo de 12 px: sus ceros no valen y el total está incompleto.');
}

// ═══ ③ EL NÚMERO ═════════════════════════════════════════════════════════════════════════════
decir('\n═══ ③ POR PANTALLA Y ANCHURA ═══');
decir('pantalla'.padEnd(30) + 'ancho  medidos  cortos  sinPintar  noTocables');
for (const r of resultados) {
  decir(r.fn.padEnd(30) + String(r.ancho).padEnd(7) + String(r.medidos.length).padEnd(9)
    + String(r.medidos.filter((m) => !m.cumple).length).padEnd(8)
    + String(r.sinPintar.length).padEnd(11) + r.noTocables.length);
}

/** Un elemento es el MISMO aunque se mida a dos anchuras: pantalla + selector + texto. */
const distintos = new Map();
for (const r of resultados) {
  for (const m of r.medidos.filter((x) => !x.cumple)) {
    const k = `${r.fn}|${m.sel}|${m.texto}`;
    const p = distintos.get(k);
    if (!p || m.tocable < p.tocable) distintos.set(k, { fn: r.fn, sel: m.sel, texto: m.texto, tocable: m.tocable });
  }
}
const mediciones = resultados.reduce((t, r) => t + r.medidos.filter((m) => !m.cumple).length, 0);
const esSm = (sel) => sel.includes('btn-sm');
const smDistintos = [...distintos.values()].filter((v) => esSm(v.sel)).length;

decir('\n═══ ③ POR CLASE (elementos DISTINTOS, sin duplicar por anchura) ═══');
const porClase = new Map();
for (const v of distintos.values()) {
  if (!porClase.has(v.sel)) porClase.set(v.sel, { n: 0, min: Infinity, max: 0, pant: new Set(), ej: new Set() });
  const e = porClase.get(v.sel);
  e.n += 1; e.min = Math.min(e.min, v.tocable); e.max = Math.max(e.max, v.tocable);
  e.pant.add(v.fn); if (e.ej.size < 3) e.ej.add(v.texto);
}
for (const [sel, e] of [...porClase.entries()].sort((a, b) => b[1].n - a[1].n)) {
  decir(`   ${String(e.n).padStart(3)}  ${sel.padEnd(42)} ${e.min.toFixed(1)}–${e.max.toFixed(1)} px · ${e.pant.size} pantalla(s) · p.ej. ${[...e.ej].join(' / ')}`);
}

decir('\n═══ EL NÚMERO ═══');
decir(`   elementos DISTINTOS por debajo de ${MINIMO_TACTIL} px: ${distintos.size}`);
decir(`   mediciones (pantalla × anchura × elemento): ${mediciones}`);
decir(`   de los distintos, con .btn-sm: ${smDistintos} (${distintos.size ? (100 * smDistintos / distintos.size).toFixed(1) : '—'} %)`);
decir(`   de los distintos, SIN .btn-sm: ${distintos.size - smDistintos}`);

// ═══ ✅ CONTROL POSITIVO FINAL: reproducir lo que el guard imprime para Clientes ══════════════
decir('\n═══ ✅ CONTROL POSITIVO · Clientes, contra lo que imprime el guard ═══');
for (const ancho of ANCHOS) {
  const r = resultados.find((x) => x.fn === 'renderCustomersView' && x.ancho === ancho);
  if (!r) { noSupe(`   🔴 no he medido Clientes a ${ancho}px`); continue; }
  const cortos = r.medidos.filter((m) => !m.cumple);
  decir(`   @${ancho}px → medidos ${r.medidos.length} · cortos ${cortos.length} · no tocables ${r.noTocables.length}`);
  for (const c of cortos) decir(`        ${c.sel.padEnd(34)} ${String(c.tocable).padEnd(6)} «${c.texto}»`);
}
decir('   (el guard imprime, hoy: 929 → 20 medidos / 11 cortos / 6 no tocables · 390 → 19 / 2 / 6)');

process.exit(salida);

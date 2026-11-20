// tests/scrum1768b-ficha-pestanas.test.mjs — SCRUM-1768 VUELTA 2 (FICHA, S2 · 20-nov)
//
// LA FICHA DEL TRABAJO SE LEE POR PESTAÑAS, Y EL DINERO VA ARRIBA.
//
// Vuelta 2 del formato (c.22113): la columna principal apilaba Lo que falta · Partes · Albaranes · Facturas
// y «El trabajo» vivía en la lateral; el dinero era una tarjeta más del cuerpo. Decidido y aceptado:
//   · Las pestañas SON los `<h3>` que ya existen: ni un rótulo nuevo (regla 39). Por defecto se abre la que
//     contiene la primaria; si ninguna la tiene, la primera. Sin rutas nuevas: es estado de la página, y un
//     `refresh()` del mismo Trabajo vuelve a la pestaña que estaba abierta.
//   · La franja Aceptado/Cobrado (EL MISMO NODO) sube a la cabecera, encima de las acciones; el CTA sigue en
//     su barra con `data-accion="cta"`. El cuerpo ya no tiene dinero.
//   · El operario ve las mismas pestañas menos la que su rol no ve («Lo que falta» es cobro).
// Lo que este test sujeta, sobre la ficha REAL (banco de vistas):
//   ⑤ dinero en la cabecera · ⑥ pestañas = h3 en su orden · ⑦ por defecto · ⑧ cambiar y recordar ·
//   ⑨ el hueco de «Lo que falta» abre su pestaña · ⑩ operario · ⑪ el CSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const clases = (n) => String((n && n.className) || '').split(/\s+/);
const tiene = (n, c) => clases(n).includes(c);
const attr = (n, a) => (n && n.getAttribute ? n.getAttribute(a) : null);
const texto = (n) => String((n && n.textContent) || '').trim();
const QUOTE = { id: 77, number: 3, total: 1210, currency: 'EUR', status: 'accepted' };
const base = (extra) => ({
  id: 42, status: 'aceptado', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reforma baño',
  customer: { id: 5, name: 'Cliente de la obra', phone: '34000111222', mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '', invoices: [],
  quote: QUOTE, direccion: null, totalAceptado: 1210, totalCobrado: 0, ...extra,
});

async function montar(job, rol = 'admin') {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url) || /gastos/.test(url)) return [];
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    return job;
  };
  banco.ctx.appUserRole = rol;
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `SUELO: la ficha no monta (${r.error && r.error.message})`);
  await respirar(20);
  return { banco, contenedor: r.contenedor };
}

function leer(m) {
  const nodos = todos(m.contenedor);
  const head = nodos.find((n) => tiene(n, 'detail-head'));
  const cuerpo = nodos.find((n) => tiene(n, 'detail-cuerpo'));
  const principal = cuerpo ? [...cuerpo.children].find((n) => n.tagName && !tiene(n, 'detail-lateral')) : null;
  const tablist = nodos.find((n) => attr(n, 'role') === 'tablist');
  const tabs = tablist ? todos(tablist).filter((n) => attr(n, 'role') === 'tab') : [];
  const paneles = nodos.filter((n) => attr(n, 'role') === 'tabpanel');
  const panelDe = (tab) => paneles.find((p) => p.id && p.id === attr(tab, 'aria-controls'));
  const elegida = tabs.filter((t) => attr(t, 'aria-selected') === 'true');
  return { nodos, head, cuerpo, principal, tablist, tabs, paneles, panelDe, elegida };
}
// Una primaria que SE VE (la de «Consolidar seleccionados» vive en una barra con display: none).
const oculto = (n) => n.hidden || (n.style && (n.style.display === 'none' || /(^|;)\s*display\s*:\s*none/.test(n.style.cssText || '')));
const seVe = (el, hasta) => { for (let n = el; n && n !== hasta; n = n.parentNode) if (oculto(n)) return false; return true; };
const conPrimaria = (p) => todos(p).some((n) => tiene(n, 'btn-primary') && seVe(n, p));
const h3De = (panel) => [...panel.children].find((n) => n.tagName === 'H3' && tiene(n, 'detail-section-title'));

// ── ⑤ el dinero, en la cabecera ─────────────────────────────────────────────────────────────────────
test('⑤ la franja del dinero vive en la cabecera, antes de las acciones; el cuerpo no tiene dinero', async () => {
  const f = leer(await montar(base({ status: 'terminado' }))); // terminado: hay CTA («+ Nuevo albarán»)
  assert.ok(f.head, 'CIEGO: no hay .detail-head');
  const franjas = f.nodos.filter((n) => tiene(n, 'detail-dinero'));
  assert.equal(franjas.length, 1, `SUELO: una franja del dinero (vio ${franjas.length})`);
  const enHead = todos(f.head).includes(franjas[0]);
  assert.ok(enHead, 'la franja del dinero no está en la cabecera');
  assert.equal(todos(f.cuerpo).filter((n) => tiene(n, 'detail-dinero')).length, 0, 'queda dinero en el cuerpo');
  const hijos = [...f.head.children].filter((n) => n.tagName);
  const iDinero = hijos.findIndex((n) => todos(n).includes(franjas[0]));
  const iAcciones = hijos.findIndex((n) => tiene(n, 'detail-head-acciones'));
  assert.ok(iAcciones >= 0, 'CIEGO: no hay barra de acciones');
  assert.ok(iDinero >= 0 && iDinero < iAcciones, `el dinero va ANTES que las acciones (dinero ${iDinero}, acciones ${iAcciones})`);
  const cta = todos(hijos[iAcciones]).find((n) => (n.dataset && n.dataset.accion === 'cta') || attr(n, 'data-accion') === 'cta');
  assert.ok(cta, 'el CTA sigue en la barra de acciones con data-accion="cta"');
});

test('⑤ sin importe que conste (SCRUM-651/917i), la cabecera no cuelga un hueco de dinero', async () => {
  const f = leer(await montar(base({ totalAceptado: null, quote: null })));
  assert.ok(f.head, 'CIEGO: no hay .detail-head');
  assert.equal(todos(f.head).filter((n) => tiene(n, 'detail-summary') || tiene(n, 'detail-head-dinero')).length, 0);
});

// ── ⑥ las pestañas son los h3 que ya existen ────────────────────────────────────────────────────────
test('⑥ pestañas = los h3 de las secciones, en su orden; la tira es lo primero de la columna principal', async () => {
  const f = leer(await montar(base({ invoices: [{ id: 9, number: 'F-1', status: 'sent', total: 1210, createdAt: '2026-09-02T09:00:00Z' }] })));
  assert.ok(f.tablist, 'la ficha no tiene tira de pestañas');
  assert.equal(f.principal && [...f.principal.children].find((n) => n.tagName), f.tablist, 'la tira es el primer hijo de la columna principal');
  const rotulos = f.tabs.map(texto);
  assert.ok(rotulos.length >= 4, `SUELO: pocas pestañas (${rotulos.join(' · ')})`);
  for (const r of ['Partes', 'Albaranes', 'El trabajo']) assert.ok(rotulos.includes(r), `falta la pestaña «${r}» (${rotulos.join(' · ')})`);
  assert.equal(rotulos[rotulos.length - 1], 'El trabajo', '«El trabajo» es la última');
  assert.ok(rotulos.indexOf('Partes') < rotulos.indexOf('Albaranes'), 'Partes antes que Albaranes (SCRUM-1694)');
  // Cada pestaña controla SU sección, y su rótulo es el h3 de esa sección: ni un texto nuevo.
  for (const t of f.tabs) {
    const p = f.panelDe(t);
    assert.ok(p, `la pestaña «${texto(t)}» no controla ningún panel`);
    assert.ok(tiene(p, 'detail-section'), 'el panel es la sección misma, no un envoltorio');
    assert.equal(texto(h3De(p)), texto(t), 'el rótulo de la pestaña es el h3 de su sección');
    assert.equal(p.parentNode, f.principal, 'la sección sigue siendo hija directa de la columna (el CSS cuelga de ahí)');
  }
  // «El trabajo» vuelve a la columna principal: la lateral es rail + «+ Nuevo presupuesto».
  const lateral = f.nodos.find((n) => tiene(n, 'detail-lateral'));
  assert.equal(todos(lateral).filter((n) => n.dataset && n.dataset.seccion === 'el-trabajo').length, 0, '«El trabajo» sigue en la lateral');
});

// ── ⑦ cuál se abre ──────────────────────────────────────────────────────────────────────────────────
test('⑦ una sola pestaña elegida; las demás secciones, ocultas', async () => {
  const f = leer(await montar(base()));
  assert.equal(f.elegida.length, 1, `elegidas: ${f.elegida.length}`);
  for (const t of f.tabs) {
    const p = f.panelDe(t);
    assert.equal(p.hidden, t !== f.elegida[0], `«${texto(t)}» visible=${!p.hidden} con elegida «${texto(f.elegida[0])}»`);
    assert.equal(attr(t, 'tabindex'), t === f.elegida[0] ? '0' : '-1', 'tabindex itinerante');
  }
});

test('⑦ sin primaria en ninguna sección, se abre la primera', async () => {
  const f = leer(await montar(base()));
  assert.ok(f.tabs.length >= 2 && f.elegida.length === 1, `SUELO: hay pestañas y una elegida (${f.tabs.length}/${f.elegida.length})`);
  assert.equal(f.paneles.filter(conPrimaria).length, 0, 'SUELO: ninguna sección con primaria a la vista');
  // Control: la primaria oculta de «Consolidar» SÍ está (si no, este caso no probaría nada sobre `seVe`).
  assert.ok(f.paneles.some((p) => todos(p).some((n) => tiene(n, 'btn-primary'))), 'CONTROL: hay una primaria oculta');
  assert.equal(f.elegida[0], f.tabs[0], `se abrió «${texto(f.elegida[0])}»`);
});

test('⑦ en curso, la primaria es «Nuevo parte» (SCRUM-1749) y se abre «Partes»', async () => {
  const f = leer(await montar(base({ status: 'en_curso' })));
  assert.equal(f.paneles.filter(conPrimaria).length, 1, 'SUELO: en curso hay UNA sección con primaria a la vista');
  assert.equal(texto(f.elegida[0]), 'Partes');
});

// ── ⑧ cambiar y recordar ────────────────────────────────────────────────────────────────────────────
test('⑧ pulsar una pestaña la abre, y un refresh() del mismo Trabajo la conserva', async () => {
  const m = await montar(base());
  let f = leer(m);
  const albaranes = f.tabs.find((t) => texto(t) === 'Albaranes');
  assert.ok(albaranes && albaranes !== f.elegida[0], 'SUELO: Albaranes no es la abierta');
  albaranes.click();
  f = leer(m);
  assert.equal(texto(f.elegida[0]), 'Albaranes');
  assert.equal(f.panelDe(f.elegida[0]).hidden, false);
  await m.banco.ctx.renderJobDetailView(m.contenedor, 42);
  await respirar(20);
  f = leer(m);
  assert.equal(texto(f.elegida[0]), 'Albaranes', 'el refresh volvió a la primera');
});

// ── ⑨ el hueco de «Lo que falta» lleva a su pestaña ─────────────────────────────────────────────────
test('⑨ el enlace de un hueco abre la pestaña de su sección antes de llevar allí', async () => {
  const m = await montar(base());
  let f = leer(m);
  const lqf = f.tabs.find((t) => texto(t) === 'Lo que falta');
  assert.ok(lqf, `SUELO: hay «Lo que falta» (${f.tabs.map(texto).join(' · ')})`);
  const enlaces = todos(f.panelDe(lqf)).filter((n) => n.tagName === 'BUTTON' && tiene(n, 'btn-ghost'));
  assert.ok(enlaces.length >= 1, 'SUELO: «Lo que falta» tiene algún enlace');
  enlaces[0].click();
  f = leer(m);
  const destino = f.panelDe(f.elegida[0]);
  assert.ok(['albaranes', 'facturas'].includes(destino.dataset.seccion), `abrió «${texto(f.elegida[0])}»`);
  assert.equal(destino.hidden, false);
});

// ── ⑩ el operario ───────────────────────────────────────────────────────────────────────────────────
test('⑩ operario: las mismas pestañas menos «Lo que falta»; el dinero, el importe y en la cabecera', async () => {
  const f = leer(await montar(base({ totalCobrado: null, estadoCobro: null }), 'tecnico'));
  const rotulos = f.tabs.map(texto);
  assert.ok(!rotulos.includes('Lo que falta'), rotulos.join(' · '));
  for (const r of ['Partes', 'Albaranes', 'El trabajo']) assert.ok(rotulos.includes(r), `falta «${r}»`);
  assert.equal(f.elegida.length, 1);
  assert.equal(todos(f.cuerpo).filter((n) => tiene(n, 'detail-dinero')).length, 0);
});

// ── ⑪ el CSS ────────────────────────────────────────────────────────────────────────────────────────
const INICIO = '/* ══ S2 · SCRUM-1768b ·';
const FIN = '/* ══ fin S2 · SCRUM-1768b ══ */';
function bloque(css) {
  const i = css.indexOf(INICIO);
  const f = css.indexOf(FIN);
  assert.ok(i >= 0 && f > i, 'el bloque «S2 · SCRUM-1768b» de styles.css existe y está cerrado');
  return css.slice(i, f);
}
const sinComentarios = (css) => ejecutableDe(css, { ancla: '.detail-page--trabajo', donde: 'el bloque S2 · SCRUM-1768b de styles.css', almohadillaEsComentario: false });
const compacto = (s) => s.replace(/\s+/g, ' ');

test('⑪ el bloque cuelga de .detail-page--trabajo, sólo usa tokens y el panel oculto no se ve', () => {
  const sin = sinComentarios(bloque(CSS));
  const sels = [];
  for (const m of sin.matchAll(/([^{};]+)\{/g)) {
    const cab = m[1].trim();
    if (!cab || cab.startsWith('@')) continue;
    sels.push(...cab.split(',').map((s) => s.trim()));
  }
  assert.ok(sels.length >= 5, `el parser ve las reglas (vio ${sels.length})`);
  assert.deepEqual(sels.filter((s) => !s.startsWith('.detail-page--trabajo')), []);
  assert.ok(/var\(--/.test(sin), 'control: usa tokens');
  assert.deepEqual(sin.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) || [], []);
  // El panel oculto lo esconde la regla GLOBAL de `[hidden]`; aquí no se añade otra (trinquete SCRUM-731).
  assert.doesNotMatch(compacto(sin), /\[hidden\]/);
  // …y en este bloque nada pone `display` a un panel, que es lo que le ganaría a esa regla.
  assert.doesNotMatch(compacto(sin), /\[role="tabpanel"\][^{]*\{[^}]*display:/);
});

test('⑪ la regla global de [hidden] existe (es la que oculta los paneles)', () => {
  assert.match(compacto(CSS), /(^|[\s,}])\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
});

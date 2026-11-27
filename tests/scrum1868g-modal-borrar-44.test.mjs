// tests/scrum1868g-modal-borrar-44.test.mjs — SCRUM-1868g
//
// QUÉ VIGILA: en el modal «Eliminar cliente» de la ficha 360 (`[data-rol="modal-borrar-cliente"]`,
// SCRUM-1868b), CADA interactivo visible da un área de TOQUE de al menos `MINIMO_TACTIL` (AB6) a 390 y
// 1280 px, en sus dos estados: LIBRE (el «?», «Cancelar» y «Eliminar») y BLOQUEADO (el «?», el enlace
// a la fusión y «Cerrar»). Medido en un navegador real con el árbitro de la casa (`__areaDeToque`).
//
// DE DÓNDE NACE: el recorrido en staging de SCRUM-1868f (c.22930). A 1280 el pie del modal medía 36 px
// («Cancelar», «Eliminar», «Cerrar») y el enlace a la fusión, 36; a 390, 44. SCRUM-1845 c.22728
// (decisión del fundador): todo lo que no es un `.btn-sm` no primario llega a 44, y la cura es por
// CONTENEDOR, nunca global. En este modal no hay ningún `.btn-sm`: no hay exentos.
// El «?» (29×26 de caja) ya daba 45 de TOQUE: el `::before` de 44 de SCRUM-962d (bloque S2). El
// recorrido de staging medía la caja, no el área. Aquí se mide el área, y el «?» entra en la cuenta.
//
// LOS CUATRO CASOS:
//   a) SUELO: los dos estados se montan con el código del producto (banco de 1868b) y la fuente de la
//      app, están los objetivos esperados de cada uno y el árbitro alcanza a todos. Si no, CIEGO.
//   b) 🔴 cada interactivo del modal llega a `MINIMO_TACTIL` en los dos anchos y los dos estados.
//   c) ningún interactivo del modal es un `.btn-sm`: si alguno lo fuera, c.22728 lo dejaría exento y
//      este guard tendría que saberlo.
//   d) CONTROL: en la MISMA página se QUITAN de la hoja las reglas del bloque de SCRUM-1868g (CSSOM,
//      `deleteRule`): a 1280 el pie y el enlace vuelven a quedar cortos, y el «?» mide lo mismo (su
//      área es de SCRUM-962d, no de este bloque). Se quita la regla REAL, como SCRUM-1850.
//
// El modal se abre a 1200 px de alto: a 900, en el estado bloqueado a 390, «Cerrar» cae por debajo del
// borde (el modal lleva `max-height: calc(100vh - 40px)` y `overflow-y: auto`) y el árbitro no llega.
// Y se espera a que acaben las animaciones de entrada (`slide-up`): a media animación, el árbitro mide
// una caja que se mueve. Sin navegador se SALTA con su motivo, como `scrum1850-ficha-360-resto-44`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolverNavegador, lanzarNavegador } from '../scripts/_navegador.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from '../scripts/_medidor-de-toque.mjs';
import { serializar } from '../scripts/_pagina-panel.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente, decirFuente } from '../scripts/_hojas-del-panel.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const ANCHOS = [390, 1280];
const ALTO = 1200;
const ESCRITORIO = 1280;
const RAIZ_MODAL = '[data-rol="modal-borrar-cliente"]';
const CUENTA = { documentos: 3, sitios: 2, equipos: 4, historial: 7, solicitudes: 6, presupuestos: 0, facturas: 0, trabajos: 0, partes: 0, mantenimientos: 0 };
// Lo que cada estado TIENE que enseñar (por `data-accion`, o la clase del «?»), y nada de texto.
const ESTADOS = {
  libre: { previa: { bloqueado: false, motivos: [], cuenta: CUENTA }, esperados: ['ayuda', 'cancelar-borrado', 'confirmar-borrado'] },
  bloqueado: { previa: { bloqueado: true, motivos: ['tiene_facturas', 'tiene_presupuestos'], cuenta: { ...CUENTA, facturas: 2, presupuestos: 5 } },
    esperados: ['ayuda', 'fusionar-en-vez', 'cerrar-borrado'] },
};
// Las reglas del bloque de SCRUM-1868g, tal como las serializa el navegador (`selectorText`).
const LAS_REGLAS = [`${RAIZ_MODAL} .modal-footer > .btn`, `${RAIZ_MODAL} .fusion-linea > .contacto-link`];
const REGLAS_DEL_BLOQUE = 2;

const navegador = resolverNavegador();
const espera = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

/** Abre el modal con el código del producto en el banco y lo devuelve serializado. */
async function modalSerializado(previa) {
  const CLIENTE = { id: 10068, name: 'Cliente QA 1868g', phone: null, mobile: null, email: null, notes: null, portalToken: null,
    createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, tags: null };
  const STATS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };
  const fetch = async (url) => {
    const u = new URL(String(url), 'http://banco.invalid').pathname;
    let j = [];
    if (/\/borrado-previa$/.test(u)) j = previa;
    else if (/\/detail$/.test(u)) j = { customer: CLIENTE, quotes: [], invoices: [], events: [], stats: STATS };
    else if (/\/historial/.test(u)) j = { trabajos: [], partesSueltos: [] };
    else if (/\/whatsapp/.test(u)) j = { waOptOut: false, mensajes: [] };
    else if (/\/documentos$/.test(u)) j = { documentos: [], limites: {} };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, blob: async () => ({}), json: async () => j, text: async () => JSON.stringify(j) };
  };
  const banco = cargarDashboard(RAIZ, { rol: 'admin', red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch } });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: un script del panel no cargó');
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  assert.equal(r.error, null, `🔴 CIEGO: la ficha no montó: ${r.error && r.error.message}`);
  await espera();
  const abrir = todos(r.contenedor).find((n) => n.dataset && n.dataset.accion === 'abrir-borrado');
  assert.ok(abrir, '🔴 CIEGO: la ficha no pinta el botón que abre el modal de borrado');
  abrir.disparar('click');
  await espera();
  const modal = todos(banco.ctx.document.body).find((n) => n.dataset && n.dataset.rol === 'modal-borrar-cliente');
  assert.ok(modal, '🔴 CIEGO: el modal de borrado no se abrió en el banco');
  return serializar(modal);
}

// Corre EN LA PÁGINA, escrito dentro de `page.evaluate` (analizador de SCRUM-258).
const medirEnLaPagina = (page) => page.evaluate(async (SEL, RAIZ_SEL) => {
  const raiz = document.querySelector(RAIZ_SEL);
  if (!raiz) return null;
  const filas = [];
  for (const el of raiz.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    filas.push({
      clave: el.classList.contains('modal-ayuda') ? 'ayuda' : (el.dataset.accion || '(sin accion)'),
      etiqueta: el.tagName + (el.classList.length ? '.' + [...el.classList].join('.') : ''),
      btnSm: el.classList.contains('btn-sm'),
      caja: +r.height.toFixed(1),
      tocable: m.tocable ?? null,
      error: m.error || null,
    });
  }
  return filas;
}, INTERACTIVOS, RAIZ_MODAL);

// Borra de las hojas cada regla de FUERA de `@media` cuyo selector es uno de `SELECTORES`.
const quitarLasReglas = (page) => page.evaluate((SELECTORES) => {
  let quitadas = 0;
  let ilegibles = 0;
  for (const h of document.styleSheets) {
    try {
      for (let i = h.cssRules.length - 1; i >= 0; i--) {
        const r = h.cssRules[i];
        if (r.selectorText && r.selectorText.split(',').map((s) => s.trim()).some((s) => SELECTORES.includes(s))) {
          h.deleteRule(i);
          quitadas += 1;
        }
      }
    } catch { ilegibles += 1; }
  }
  return { quitadas, ilegibles };
}, LAS_REGLAS);

const linea = (m) => `${m.clave} (${m.etiqueta}) caja ${m.caja} · toque ${m.tocable}` + (m.error ? ` · NO ALCANZA: ${m.error}` : '');
const cumple = (m) => typeof m.tocable === 'number' && m.tocable >= MINIMO_TACTIL;

test('SCRUM-1868g · el modal «Eliminar cliente» llega a 44 px de toque en todo, a 390 y 1280, libre y bloqueado (c.22728)',
  { skip: !navegador.ok && `sin navegador donde mirar (resolverNavegador): ${navegador.motivo}` }, async (t) => {
    const HOJAS = enlacesDelPanel(PUBLIC);
    const paginas = {};
    for (const [estado, { previa }] of Object.entries(ESTADOS)) {
      paginas[`/__${estado}`] = '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>'
        + (await modalSerializado(previa)) + '</body></html>';
    }
    const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
    const srv = http.createServer((rq, res) => {
      const u = rq.url.split('?')[0];
      if (paginas[u]) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(paginas[u]); }
      const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
      if (!d.startsWith(PUBLIC) || !fs.existsSync(d) || fs.statSync(d).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(d));
    });
    const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

    const nav = await lanzarNavegador(puppeteer, {});
    const medidas = new Map();
    try {
      for (const estado of Object.keys(ESTADOS)) {
        for (const ancho of ANCHOS) {
          const page = await nav.newPage();
          await page.setViewport({ width: ancho, height: ALTO });
          await page.goto(`http://127.0.0.1:${PUERTO}/__${estado}`, { waitUntil: 'load' });
          const fuente = await esperarFuentes(page);
          await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
          await page.evaluate(FUENTE_MEDIDOR);
          const conReglas = await medirEnLaPagina(page);
          const quitar = await quitarLasReglas(page);
          const sinReglas = await medirEnLaPagina(page);
          medidas.set(`${estado}@${ancho}`, { estado, ancho, fuente, conReglas, quitar, sinReglas });
          await page.close();
        }
      }
    } finally {
      await nav.close();
      srv.close();
    }

    await t.test('a) SUELO · los dos estados se montan con la fuente de la app, con sus objetivos, y el árbitro alcanza a todos', () => {
      assert.equal(medidas.size, Object.keys(ESTADOS).length * ANCHOS.length, '🔴 CIEGO: faltan páginas medidas');
      for (const [donde, { estado, fuente, conReglas: f }] of medidas) {
        const ceguera = cegueraDeLaFuente(fuente, donde);
        assert.equal(ceguera, null, `🔴 CIEGO: ${ceguera} (${decirFuente(fuente)})`);
        assert.ok(Array.isArray(f), `🔴 CIEGO · ${donde}: no está \`${RAIZ_MODAL}\` en la página servida.`);
        assert.deepEqual(f.map((m) => m.clave).sort(), [...ESTADOS[estado].esperados].sort(),
          `🔴 CIEGO · ${donde}: los objetivos visibles no son los del estado: ${f.map(linea).join(' | ')}`);
        const sinAlcanzar = f.filter((m) => typeof m.tocable !== 'number');
        assert.equal(sinAlcanzar.length, 0, `🔴 CIEGO · ${donde}: el árbitro no alcanza a ${sinAlcanzar.length} de ${f.length}: ${sinAlcanzar.map(linea).join(' | ')}`);
      }
    });

    await t.test(`b) cada interactivo del modal da al menos ${MINIMO_TACTIL} px de toque, a ${ANCHOS.join(' y ')} px, libre y bloqueado`, () => {
      const cortos = [];
      let medidos = 0;
      for (const [donde, { conReglas }] of medidas) {
        for (const m of conReglas || []) {
          medidos += 1;
          if (!cumple(m)) cortos.push(`${donde} ${linea(m)}`);
        }
      }
      const esperados = Object.values(ESTADOS).reduce((s, e) => s + e.esperados.length, 0) * ANCHOS.length;
      assert.equal(medidos, esperados, `🔴 CIEGO: ${medidos} mediciones, se esperan ${esperados} (ver el caso a).`);
      assert.equal(cortos.length, 0, `🔴 ${cortos.length} de ${medidos} mediciones por debajo de ${MINIMO_TACTIL} px en el modal de borrado:\n   ${cortos.join('\n   ')}`);
    });

    await t.test('c) ningún interactivo del modal es un `.btn-sm`: c.22728 no deja ninguno exento aquí', () => {
      for (const [donde, { conReglas }] of medidas) {
        const sm = (conReglas || []).filter((m) => m.btnSm);
        assert.equal(sm.length, 0, `🔴 ${donde}: hay \`.btn-sm\` en el modal (${sm.map(linea).join(' | ')}); un \`.btn-sm\` no primario queda exento por c.22728 y este guard no lo sabe.`);
      }
    });

    await t.test('d) CONTROL · sin las reglas del bloque, a 1280 el pie y el enlace vuelven a ser cortos, y el «?» mide lo mismo', () => {
      let vuelvenTodos = 0;
      for (const [donde, { ancho, conReglas, quitar, sinReglas }] of medidas) {
        assert.equal(quitar.quitadas, REGLAS_DEL_BLOQUE,
          `🔴 ${donde}: se esperaban ${REGLAS_DEL_BLOQUE} reglas del bloque de SCRUM-1868g y se han quitado ${quitar.quitadas} (hojas ilegibles: ${quitar.ilegibles}).`);
        const ayuda = (f) => (f || []).filter((m) => m.clave === 'ayuda').map((m) => `${m.caja}:${m.tocable}`);
        assert.deepEqual(ayuda(sinReglas), ayuda(conReglas), `🔴 ${donde}: el «?» cambia al quitar el bloque; el bloque se escapa del pie y del enlace.`);
        if (ancho !== ESCRITORIO) continue;
        const vuelven = (sinReglas || []).filter((m) => m.clave !== 'ayuda');
        assert.equal(vuelven.length, 2, `🔴 CIEGO · ${donde}: sin las reglas no encuentro los dos objetivos del pie y del enlace (${vuelven.length}).`);
        const siguen = vuelven.filter((m) => m.caja >= MINIMO_TACTIL);
        assert.equal(siguen.length, 0, `🔴 ${donde}: sin las reglas del bloque siguen a ${MINIMO_TACTIL} o más: ${siguen.map(linea).join(' | ')}. La que los sube no es esta regla.`);
        vuelvenTodos += vuelven.length;
      }
      assert.equal(vuelvenTodos, 4, `🔴 CIEGO: a ${ESCRITORIO} se esperaban 4 objetivos que vuelven a ser cortos (2 por estado), y hay ${vuelvenTodos}.`);
    });
  });

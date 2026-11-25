// tests/scrum1852-editar-encima-del-nombre.test.mjs — SCRUM-1852
//
// QUÉ VIGILA: en la cabecera de la ficha 360 (`renderCustomer360View`) ninguna acción de
// `.c360-cabecera-acciones` se pinta encima del nombre del cliente (`.c360-nombre`), ni sale de su
// tarjeta, a 390, 929 y 1280 px; medido con CAJAS en un navegador real.
//
// DE DÓNDE NACE: a 929 y 1280 «✎ Editar» tapaba el nombre. La causa, medida: `.c360-identidad` lleva
// `flex:1;min-width:0` (SCRUM-1756i, el literal del atributo de main) y la fila de acciones
// `flex-shrink:0`; la identidad se encogía a 141 px, por debajo de lo que ocupa su contenido (201), y
// el contenido desbordaba por debajo de los botones. Con «Carmen Ruiz» también: el ancho mínimo lo
// pone el correo. Y dentro de la carcasa del panel (barra lateral de 248 px), a 929, la fila no se
// partía y «+ Nuevo presupuesto» salía 128,9 px fuera de la tarjeta.
//
// «EL NOMBRE» son dos rectángulos: la CAJA del h2 y su TINTA (los rectángulos de línea de un Range
// sobre su texto). Una palabra más ancha que la columna desborda la caja; la tinta es la que decide.
//
// DOS MARCOS: `banco` (la vista sola, como la monta el censo y los tests de 1841/1850) y `app` (dentro
// de `.layout > aside.sidebar + main.main > section.view-container`, la carcasa de index.html).
//
// LOS CASOS:
//   a) SUELO: fuente de la app, al menos 4 acciones, tinta del nombre y tarjeta. Si no, CIEGO.
//   b) 🔴 nombre largo y nombre corto: intersección 0 entre cada acción y la caja y la tinta del nombre,
//      y ninguna acción fuera de la tarjeta, en las tres anchuras y los dos marcos.
//   c) los 44 px de SCRUM-1841 siguen: cada acción mide al menos `MINIMO_TACTIL` de alto.
//   d) CONTROL: en la MISMA página se QUITAN de la hoja las dos reglas de SCRUM-1852 (CSSOM, por selector
//      Y declaración, fuera de `@media`): el solape vuelve a 1280 en los dos marcos, y la acción que se
//      sale vuelve a 929 en la carcasa. Prueba que el instrumento ve el defecto y que la cura es ESTA.
//
// Sin navegador se SALTA con su motivo, como `scrum1850-ficha-360-resto-44`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolverNavegador, lanzarNavegador } from '../scripts/_navegador.mjs';
import { MINIMO_TACTIL } from '../scripts/_medidor-de-toque.mjs';
import { paginaDeVista, CLIENTES_DE_MUESTRA } from '../scripts/_pagina-panel.mjs';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente, decirFuente } from '../scripts/_hojas-del-panel.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const VISTA = 'renderCustomer360View';
const ANCHOS = [390, 929, 1280];
const MARCOS = ['banco', 'app'];
// Los dos de `CLIENTES_DE_MUESTRA`, no inventados: el [0] es el que el censo monta.
const NOMBRES = { largo: CLIENTES_DE_MUESTRA[0].name, corto: CLIENTES_DE_MUESTRA[1].name };
const MINIMO_ACCIONES = 4;      // Editar, Portal, Guardar en mis contactos y + Nuevo presupuesto (Fusionar es de admin)
// Las dos reglas de SCRUM-1852: selector Y declaración, porque el selector solo también casa con la
// regla de 1756i (`.c360-identidad`) y con la base de la fila (`.c360-cabecera-acciones`).
const LAS_REGLAS = [['.c360-identidad', 'min-width', 'auto'], ['.c360-cabecera-acciones', 'flex-shrink', '1']];

const navegador = resolverNavegador();
const HOJAS = enlacesDelPanel(PUBLIC);
const enMarco = (vista, marco) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>'
  + (marco === 'app' ? '<div class="layout"><aside class="sidebar"></aside><main class="main"><section id="view-container" class="view-container">' + vista + '</section></main></div>' : vista)
  + '</body></html>';

// Corre EN LA PÁGINA, escrito dentro de `page.evaluate` (analizador de SCRUM-258).
const medirEnLaPagina = (page) => page.evaluate(() => {
  const caja = (q) => ({ x: q.left, y: q.top, w: q.width, h: q.height });
  const corte = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const h2 = document.querySelector('.c360-nombre');
  const tarjeta = h2 && h2.closest('.c360-identidad') ? h2.closest('.c360-identidad').parentElement : null;
  if (!h2 || !tarjeta) return { acciones: [], tinta: 0 };
  const rango = document.createRange();
  rango.selectNodeContents(h2);
  const tinta = [...rango.getClientRects()].map(caja).filter((q) => q.w > 0 && q.h > 0);
  const cajaNombre = caja(h2.getBoundingClientRect());
  const bordeDcho = tarjeta.getBoundingClientRect().right - parseFloat(getComputedStyle(tarjeta).paddingRight);
  const acciones = [...document.querySelectorAll('.c360-cabecera-acciones > button')]
    .map((b) => ({ b, q: b.getBoundingClientRect() })).filter(({ q }) => q.width > 0 && q.height > 0)
    .map(({ b, q }) => ({
      texto: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
      alto: +q.height.toFixed(1),
      encima: +(tinta.reduce((s, t) => s + corte(caja(q), t), 0) + corte(caja(q), cajaNombre)).toFixed(1),
      sale: +Math.max(0, q.right - bordeDcho).toFixed(1),
    }));
  return { acciones, tinta: tinta.length };
});

const quitarLasReglas = (page) => page.evaluate((REGLAS) => {
  let quitadas = 0;
  let ilegibles = 0;
  for (const h of document.styleSheets) {
    try {
      for (let i = h.cssRules.length - 1; i >= 0; i--) {
        const r = h.cssRules[i];
        if (r.selectorText && REGLAS.some(([sel, prop, val]) => r.selectorText.trim() === sel && r.style.getPropertyValue(prop) === val)) {
          h.deleteRule(i);
          quitadas += 1;
        }
      }
    } catch { ilegibles += 1; }
  }
  return { quitadas, ilegibles };
}, LAS_REGLAS);

const linea = (m) => `«${m.texto}» encima ${m.encima} px² · sale ${m.sale} px · alto ${m.alto}`;

test('SCRUM-1852 · en la cabecera de la ficha 360 ninguna acción tapa el nombre ni sale de la tarjeta (390, 929, 1280)',
  { skip: !navegador.ok && `sin navegador donde mirar (resolverNavegador): ${navegador.motivo}` }, async (t) => {
    const montar = async (nombre) => {
      const DC = datosDelCenso();
      DC.enVista(VISTA);
      const datos = (url) => {
        const v = DC.datos(url);
        if (v && v.customer && /\/admin\/customers\/\d+\/detail(\?|$)/.test(url)) v.customer.name = nombre;
        return v;
      };
      const montada = await paginaDeVista(RAIZ, VISTA, { datos, args: ARGUMENTOS_DEL_CENSO[VISTA] || [] });
      assert.ok(montada.html, `🔴 CIEGO: la ficha 360 no se monta como la monta el censo: ${montada.aviso}`);
      return montada.html;
    };
    const VISTAS = { largo: await montar(NOMBRES.largo), corto: await montar(NOMBRES.corto) };

    const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
    const srv = http.createServer((rq, res) => {
      const u = rq.url.split('?')[0];
      const m = /^\/__c360-(largo|corto)-(banco|app)$/.exec(u);
      if (m) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(enMarco(VISTAS[m[1]], m[2])); }
      const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
      if (!d.startsWith(PUBLIC) || !fs.existsSync(d) || fs.statSync(d).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(d));
    });
    const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

    const nav = await lanzarNavegador(puppeteer, {});
    const medidas = [];
    try {
      for (const marco of MARCOS) for (const cual of ['largo', 'corto']) for (const ancho of ANCHOS) {
        const page = await nav.newPage();
        await page.setViewport({ width: ancho, height: 900 });
        await page.goto(`http://127.0.0.1:${PUERTO}/__c360-${cual}-${marco}`, { waitUntil: 'load' });
        const fuente = await esperarFuentes(page);
        const conReglas = await medirEnLaPagina(page);
        const quitar = cual === 'largo' ? await quitarLasReglas(page) : null;
        const sinReglas = cual === 'largo' ? await medirEnLaPagina(page) : null;
        medidas.push({ donde: `[${marco}] @${ancho}px nombre ${cual}`, marco, cual, ancho, fuente, conReglas, quitar, sinReglas });
        await page.close();
      }
    } finally {
      await nav.close();
      srv.close();
    }

    await t.test('a) SUELO · la vista se mide con la fuente de la app, con acciones, tinta del nombre y tarjeta', () => {
      assert.equal(medidas.length, MARCOS.length * 2 * ANCHOS.length, '🔴 CIEGO: faltan mediciones');
      for (const m of medidas) {
        const ceguera = cegueraDeLaFuente(m.fuente, `${VISTA} ${m.donde}`);
        assert.equal(ceguera, null, `🔴 CIEGO: ${ceguera} (${decirFuente(m.fuente)})`);
        assert.ok(m.conReglas.acciones.length >= MINIMO_ACCIONES, `🔴 CIEGO · ${m.donde}: ${m.conReglas.acciones.length} acciones, se esperan al menos ${MINIMO_ACCIONES}.`);
        assert.ok(m.conReglas.tinta >= 1, `🔴 CIEGO · ${m.donde}: no encuentro la tinta de \`.c360-nombre\`.`);
      }
    });

    await t.test('b) 🔴 ninguna acción encima del nombre (caja y tinta) ni fuera de la tarjeta, con nombre largo y corto', () => {
      const malas = [];
      let medidas_ = 0;
      for (const m of medidas) {
        for (const a of m.conReglas.acciones) {
          medidas_ += 1;
          if (a.encima > 0 || a.sale > 0) malas.push(`${m.donde} ${linea(a)}`);
        }
      }
      assert.ok(medidas_ >= MINIMO_ACCIONES * medidas.length, `🔴 CIEGO: sólo ${medidas_} acciones medidas.`);
      assert.equal(malas.length, 0, `🔴 ${malas.length} de ${medidas_} acciones tapan el nombre o salen de la tarjeta:\n   ${malas.join('\n   ')}`);
    });

    await t.test(`c) los ${MINIMO_TACTIL} px de SCRUM-1841 siguen en cada acción de la cabecera`, () => {
      const bajas = medidas.flatMap((m) => m.conReglas.acciones.filter((a) => a.alto < MINIMO_TACTIL).map((a) => `${m.donde} ${linea(a)}`));
      assert.equal(bajas.length, 0, `🔴 acciones por debajo de ${MINIMO_TACTIL} px:\n   ${bajas.join('\n   ')}`);
    });

    await t.test('d) CONTROL · sin las dos reglas de SCRUM-1852 el solape vuelve a 1280 y la acción que se sale vuelve a 929 en la carcasa', () => {
      for (const m of medidas.filter((x) => x.cual === 'largo')) {
        assert.equal(m.quitar.quitadas, LAS_REGLAS.length,
          `🔴 ${m.donde}: se esperaban ${LAS_REGLAS.length} reglas de SCRUM-1852 fuera de \`@media\` y se han quitado ${m.quitar.quitadas} (hojas ilegibles: ${m.quitar.ilegibles}).`);
      }
      const de = (marco, ancho) => medidas.find((x) => x.cual === 'largo' && x.marco === marco && x.ancho === ancho).sinReglas.acciones;
      for (const marco of MARCOS) {
        assert.ok(de(marco, 1280).some((a) => a.encima > 0), `🔴 [${marco}] @1280: sin las reglas NINGUNA acción tapa el nombre; el instrumento no ve el defecto o la cura no es esta.`);
      }
      assert.ok(de('app', 929).some((a) => a.sale > 0), '🔴 [app] @929: sin las reglas ninguna acción sale de la tarjeta; el instrumento no ve el defecto o la cura no es esta.');
    });
  });

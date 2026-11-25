// tests/scrum1843-marcar-cobrada-44.test.mjs — SCRUM-1843
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «MARCAR COMO COBRADA», LA PRIMARIA DE UNA FACTURA PENDIENTE, A 44 PX DE TOQUE (AB6).
//
// En `pending` sin Bizum disponible la primaria es `btnTogglePaid` (`invoiceActionsRegistry.js`), y
// `ubicarAccion` le pone `btn-primary btn-sm`: 30 px de caja y 30,7-31,0 de toque (censo táctil de
// SCRUM-936f). DESIGN.md exime a `.btn-sm` con una frontera: «una acción primaria de pantalla nunca
// usa la variante pequeña». Ésta la usaba.
//
// La cura es la de SCRUM-1148 / 1559g (opción ③ de SCRUM-786): una regla de `styles.css` ACOTADA a su
// contenedor —la barra «Siguiente paso» de la ficha de FACTURA—, sin tocar `.btn-sm` global ni el JS.
// El ancla es `.j1-prog` (la línea de progreso, hermana anterior de `.detail-next`), que ya existía y
// sólo pinta esta ficha: la ficha del presupuesto también tiene `.detail-next` y no puede cambiar.
//
// ① en NAVEGADOR: la vista REAL montada con el banco, serializada y servida con las hojas del índice
//   (las mismas de `censo:tactil-panel`), medida con el árbitro de la casa (`__areaDeToque`) a 390 y
//   1280 px. Controles: el botón existe con sus clases, la fuente cargó, un botón SEMBRADO de 30 px
//   sale corto, y «← Volver a facturas» (cabecera, FUERA de la barra) mide lo mismo que antes.
// ② sin navegador: el selector de la regla cuelga del ancla, y el ancla sólo la escribe esta ficha.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { serializar } from '../scripts/_pagina-panel.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente } from '../scripts/_hojas-del-panel.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from '../scripts/_medidor-de-toque.mjs';
import { resolverNavegador, lanzarNavegador } from '../scripts/_navegador.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const HOJA = path.join(PUBLIC, 'dashboard', 'css', 'styles.css');
const ANCHOS = [390, 1280];
const ROTULO = 'Marcar como cobrada';
const CONTROL = '← Volver a facturas';
// Medido EN ROJO (antes de la regla, 25-nov-2026) a 390 y a 1280: 31,0 px las dos. El árbitro acierta
// el píxel, no la décima (SCRUM-1603c), así que se admite ±1 px.
const CONTROL_EN_ROJO = 31;
const SEMBRADO = { id: '__sembrado1843', alto: 30 };

// Pendiente, sin cobro en vuelo: la primaria es «Marcar como cobrada» y no Bizum (SCRUM-402).
const FACTURA = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 121, currency: 'EUR',
  createdAt: '2026-09-01T09:00:00.000Z', customer: { id: 1, name: 'ZZCLIENTE prueba', phone: '+447700900123' },
  items: [], rectifiedBy: [],
});

async function montar() {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? FACTURA : []) });
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha de factura revienta al abrirse: ${r.error && r.error.message}`);
  return r.contenedor;
}

const clases = (c) => String(c || '').trim().split(/\s+/).filter(Boolean).sort();
const porTexto = (lista, texto) => lista.filter((b) => (b.textContent || '').trim() === texto);

// Se evalúa EN LA PÁGINA, después de `FUENTE_MEDIDOR`.
const MEDIR = `(async (SEL, R, C, S) => {
  const boton = (raiz, t) => raiz ? [...raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === t) : null;
  const medir = async (el) => el ? { clases: el.className, ...(await window.__areaDeToque(el, SEL, { scroll: true })) } : { error: 'NO EXISTE' };
  const barra = document.querySelector('.detail-next');
  return {
    cobrada: await medir(boton(barra, R)),
    pdf: await medir(boton(barra, 'Descargar PDF')),
    whatsapp: await medir(boton(barra, 'Enviar por WhatsApp')),
    volver: await medir(boton(document.querySelector('.detail-head-acciones'), C)),
    sembrado: await medir(document.getElementById(S)),
  };
})`;

const navegador = resolverNavegador();

test('SCRUM-1843 ① · «Marcar como cobrada» da 44 px de toque a 390 y a 1280; la cabecera no cambia', { skip: !navegador.ok && `sin navegador donde medir (resolverNavegador): ${navegador.motivo}` }, async () => {
  const contenedor = await montar();
  const botones = todos(contenedor).filter((n) => n.tagName === 'BUTTON');
  const vistos = botones.map((b) => `[${b.className}] ${(b.textContent || '').trim()}`).join(' | ');
  // CIEGO: el botón del ticket existe, UNA vez, con las clases que le pone `ubicarAccion` a la primaria.
  const cobrada = porTexto(botones, ROTULO);
  assert.equal(cobrada.length, 1, `🔴 CIEGO: «${ROTULO}» sale ${cobrada.length} veces (botones: ${vistos}).`);
  assert.deepEqual(clases(cobrada[0].className), clases('btn-primary btn-sm'),
    `🔴 CIEGO: «${ROTULO}» ya no es la primaria pequeña (className "${cobrada[0].className}"): el caso del ticket ha cambiado.`);
  assert.ok(!botones.some((b) => /bizum/i.test(b.textContent || '')), `🔴 CIEGO: la ficha pinta Bizum; la primaria no es la del ticket (${vistos}).`);
  assert.equal(porTexto(botones, CONTROL).length, 1, `🔴 CIEGO: no encuentro el control «${CONTROL}» (${vistos}).`);

  const html = serializar(contenedor);
  const pagina = '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC)
    + `<style>#${SEMBRADO.id}{display:block;box-sizing:border-box;width:120px;height:${SEMBRADO.alto}px;min-height:0;padding:0;border:0;margin:24px 0}</style>`
    + '</head><body>' + html + `<button id="${SEMBRADO.id}">·</button></body></html>`;
  const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
  const srv = http.createServer((rq, res) => {
    const u = rq.url.split('?')[0];
    if (u === '/ficha') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(pagina); }
    const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
    if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(d));
  });
  const puerto = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
  const nav = await lanzarNavegador(puppeteer, {});
  try {
    for (const ancho of ANCHOS) {
      const page = await nav.newPage();
      await page.setViewport({ width: ancho, height: 900 });
      await page.goto(`http://127.0.0.1:${puerto}/ficha`, { waitUntil: 'load' });
      const f = await esperarFuentes(page);
      const ceguera = cegueraDeLaFuente(f, `la ficha @${ancho}px`);
      assert.equal(ceguera, null, ceguera);
      assert.ok(f.cargadas > 0, `🔴 CIEGO @${ancho}px: ninguna cara de la fuente cargó; se mediría con la de reserva.`);
      await page.evaluate(FUENTE_MEDIDOR);
      const m = await page.evaluate(`${MEDIR}(${JSON.stringify(INTERACTIVOS)}, ${JSON.stringify(ROTULO)}, ${JSON.stringify(CONTROL)}, ${JSON.stringify(SEMBRADO.id)})`);
      await page.close();
      const visto = `@${ancho}px ${JSON.stringify(m)}`;

      // CIEGO: el medidor ve cortos (un botón sembrado de 30 px sale corto) y alcanza a los tres.
      assert.ok(!m.sembrado.error && m.sembrado.tocable < MINIMO_TACTIL && Math.abs(m.sembrado.tocable - SEMBRADO.alto) <= 2,
        `🔴 CIEGO: el botón sembrado de ${SEMBRADO.alto} px no sale corto; el medidor no sabe decir que no. ${visto}`);
      for (const k of ['cobrada', 'volver']) assert.ok(!m[k].error, `🔴 CIEGO: el medidor no alcanza «${k}»: ${m[k].error}. ${visto}`);
      assert.deepEqual(clases(m.cobrada.clases), clases('btn-primary btn-sm'), `🔴 CIEGO: en la página servida el botón no lleva sus clases. ${visto}`);

      // EL TICKET.
      assert.ok(m.cobrada.tocable >= MINIMO_TACTIL,
        `🔴 «${ROTULO}» mide ${m.cobrada.tocable} px de toque a ${ancho} px (mínimo ${MINIMO_TACTIL}, AB6). ${visto}`);
      // La regla es de la BARRA entera: sus hermanas pequeñas suben con ella (misma fila, SCRUM-1559g).
      for (const k of ['pdf', 'whatsapp']) {
        assert.ok(!m[k].error && m[k].tocable >= MINIMO_TACTIL, `🔴 «${k}», en la misma barra, mide ${m[k].tocable} px (${m[k].error || 'sin error'}). ${visto}`);
      }
      // CONTROL: la cabecera queda fuera de la regla y mide lo mismo que en rojo.
      assert.ok(Math.abs(m.volver.tocable - CONTROL_EN_ROJO) <= 1,
        `🔴 CONTROL: «${CONTROL}» (cabecera, fuera de la barra) mide ${m.volver.tocable} px y en rojo medía ${CONTROL_EN_ROJO}: la regla se sale de su contenedor. ${visto}`);
    }
  } finally {
    await nav.close();
    srv.close();
  }
});

// ── ② el ancla ──────────────────────────────────────────────────────────────────────────────
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
function bloque1843(hoja) {
  const ini = hoja.indexOf('/* J1: SCRUM-1843');
  const fin = hoja.indexOf('/* J1: fin del bloque SCRUM-1843 */');
  if (ini < 0 || fin < ini || hoja.indexOf('/* J1: SCRUM-1843', ini + 1) >= 0) return null;
  return hoja.slice(ini, fin);
}
// El NOMBRE de la clase, no un prefijo: `j1-prog-paso` no cuenta (A10).
const TOKEN_ANCLA = /(?<![\w-])j1-prog(?![\w-])/;

test('SCRUM-1843 ② · la regla cuelga de `.j1-prog`, y esa clase sólo la escribe la ficha de factura', () => {
  const bloque = bloque1843(fs.readFileSync(HOJA, 'utf8'));
  assert.ok(bloque, '🔴 `styles.css` no tiene UN bloque «/* J1: SCRUM-1843 … */» con su cierre.');
  const reglas = [...sinComentarios(bloque).matchAll(/([^{}]+)\{([^}]*)\}/g)];
  assert.ok(reglas.length >= 1, '🔴 CIEGO: el bloque J1 de SCRUM-1843 no tiene ninguna regla.');
  for (const [, sel] of reglas) {
    for (const s of sel.split(',').map((x) => x.trim())) {
      assert.match(s, /^\.j1-prog ~ \.detail-next > div > /, `🔴 «${s}» no cuelga del ancla de la ficha de factura.`);
    }
  }
  // Quién escribe el ancla en el marcado: todo .js y .html de public/.
  const escritores = [];
  let mirados = 0;
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (/\.(js|html)$/.test(e.name)) {
        mirados += 1;
        if (TOKEN_ANCLA.test(fs.readFileSync(p, 'utf8'))) escritores.push(path.relative(RAIZ, p).split(path.sep).join('/'));
      }
    }
  };
  andar(PUBLIC);
  assert.ok(mirados > 50, `🔴 CIEGO: sólo ${mirados} ficheros .js/.html en public/.`);
  assert.deepEqual(escritores, ['public/dashboard/js/invoiceDetailView.js'],
    `🔴 el ancla \`.j1-prog\` la escriben ${JSON.stringify(escritores)} (sobre ${mirados} ficheros): la regla alcanzaría otra pantalla, o la ficha la ha perdido.`);
});

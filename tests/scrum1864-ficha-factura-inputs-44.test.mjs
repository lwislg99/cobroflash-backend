// tests/scrum1864-ficha-factura-inputs-44.test.mjs — SCRUM-1864
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS CAMPOS `.input` DE LA FICHA DE FACTURA A 44 PX DE TOQUE (AB6).
//
// El censo de SCRUM-1845 los dejaba «(sin texto)» a 36 y 34,7 px. Medido aquí qué son:
//   · la FECHA «¿Cuándo lo has cobrado?» (`pintarFechaDeCobro`, `type=date`, id `fecha-cobro-factura`):
//     sólo en una factura `pending`, dentro de la barra «Siguiente paso» (`.detail-next`);
//   · el campo de ETIQUETAS (`montarEtiquetasDelDocumento`, `type=text`): en cualquier estado, suelto
//     en su `.detail-section`. Lo monta también la ficha del PRESUPUESTO, que no puede cambiar.
//
// La cura es la de 1843/1849: una regla de `styles.css` ACOTADA a la ficha, sólo tamaño, sin tocar
// `.input` global ni el JS. El ancla es `.j1-prog`, que sólo pinta esta ficha.
// «← Volver a facturas» (`.btn-secondary.btn-sm`, cabecera) es EXENTO: SCRUM-1845 c.22728 y DESIGN.md
// («Única excepción, y es deliberada: `btn-sm`»): no es la primaria. Se mide y no cambia.
//
// ① en NAVEGADOR, la vista REAL del banco, serializada y servida con las hojas del índice, medida con
//   el árbitro de la casa (`__areaDeToque`) a 390, 929 y 1280. Controles: los dos campos existen con
//   su clase, la fuente cargó, un campo SEMBRADO de 34 px sale corto, el exento no cambia, y el campo
//   de Etiquetas de la ficha del PRESUPUESTO mide lo mismo que en rojo.
// ② sin navegador: cada selector del bloque cuelga del ancla, y el ancla sólo la escribe esta ficha.
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
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const HOJA = path.join(PUBLIC, 'dashboard', 'css', 'styles.css');
const ANCHOS = [390, 929, 1280];
const EXENTO = '← Volver a facturas';
// Medidos EN ROJO (antes de la regla, 25-nov-2026). El árbitro acierta el píxel, no la décima
// (SCRUM-1603c): se admite ±1 px.
const EXENTO_EN_ROJO = 31;
const PRESUPUESTO_EN_ROJO = 35;
const SEMBRADO = { id: '__sembrado1864', alto: 34 };

// Pendiente: es el estado que pinta la fecha de cobro (la de Etiquetas sale en todos).
const FACTURA = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 121, currency: 'EUR',
  createdAt: '2026-09-01T09:00:00.000Z', customer: { id: 1, name: 'ZZCLIENTE prueba', phone: '+447700900123' },
  items: [], rectifiedBy: [], tags: ['obra'],
});

async function montarFactura() {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? FACTURA : []) });
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha de factura revienta al abrirse: ${r.error && r.error.message}`);
  return r.contenedor;
}
async function montarPresupuesto() {
  const r = await pintarVista(cargarDashboard(RAIZ, { datos: datosDelCenso().datos }), 'renderQuoteDetailView', ...ARGUMENTOS_DEL_CENSO.renderQuoteDetailView);
  assert.equal(r.error, null, `🔴 la ficha del presupuesto revienta al abrirse: ${r.error && r.error.message}`);
  return r.contenedor;
}

const clases = (c) => String(c || '').trim().split(/\s+/).filter(Boolean).sort();

// Se evalúa EN LA PÁGINA, después de `FUENTE_MEDIDOR`.
const MEDIR = `(async (SEL, E, S) => {
  const medir = async (el) => el ? { clases: el.className, tipo: el.type, ...(await window.__areaDeToque(el, SEL, { scroll: true })) } : { error: 'NO EXISTE' };
  const etiquetas = [...document.querySelectorAll('.detail-section > input.input')];
  const volver = [...document.querySelectorAll('.detail-head-acciones button')].find((b) => b.textContent.trim() === E);
  return {
    fecha: await medir(document.querySelector('.detail-next input.input[type="date"]')),
    etiquetas: etiquetas.length === 1 ? await medir(etiquetas[0]) : { error: etiquetas.length + ' campos de Etiquetas' },
    volver: await medir(volver),
    sembrado: await medir(document.getElementById(S)),
  };
})`;

async function servirYMedir(paginas) {
  const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
  const srv = http.createServer((rq, res) => {
    const u = rq.url.split('?')[0];
    if (paginas[u]) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(paginas[u]); }
    const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
    if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(d));
  });
  const puerto = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
  const nav = await lanzarNavegador(puppeteer, {});
  const salida = {};
  try {
    for (const ruta of Object.keys(paginas)) {
      for (const ancho of ANCHOS) {
        const page = await nav.newPage();
        await page.setViewport({ width: ancho, height: 900 });
        await page.goto(`http://127.0.0.1:${puerto}${ruta}`, { waitUntil: 'load' });
        const f = await esperarFuentes(page);
        const ceguera = cegueraDeLaFuente(f, `${ruta} @${ancho}px`);
        assert.equal(ceguera, null, ceguera);
        assert.ok(f.cargadas > 0, `🔴 CIEGO ${ruta} @${ancho}px: ninguna cara de la fuente cargó; se mediría con la de reserva.`);
        await page.evaluate(FUENTE_MEDIDOR);
        salida[`${ruta}@${ancho}`] = await page.evaluate(`${MEDIR}(${JSON.stringify(INTERACTIVOS)}, ${JSON.stringify(EXENTO)}, ${JSON.stringify(SEMBRADO.id)})`);
        await page.close();
      }
    }
  } finally {
    await nav.close();
    srv.close();
  }
  return salida;
}

const pagina = (contenedor) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC)
  + `<style>#${SEMBRADO.id}{display:block;box-sizing:border-box;width:120px;height:${SEMBRADO.alto}px;min-height:0;padding:0;margin:24px 0}</style>`
  + '</head><body>' + serializar(contenedor) + `<input class="input" id="${SEMBRADO.id}" aria-label="sembrado"></body></html>`;

const navegador = resolverNavegador();

test('SCRUM-1864 ① · los dos campos de la ficha de factura dan 44 px de toque; el exento y el presupuesto no cambian', { skip: !navegador.ok && `sin navegador donde medir (resolverNavegador): ${navegador.motivo}` }, async () => {
  const factura = await montarFactura();
  const presupuesto = await montarPresupuesto();
  // CIEGO: en el banco, la factura pinta UN botón exento con su clase pequeña, y el presupuesto NO pinta el ancla.
  const volver = todos(factura).filter((n) => n.tagName === 'BUTTON' && (n.textContent || '').trim() === EXENTO);
  assert.equal(volver.length, 1, `🔴 CIEGO: «${EXENTO}» sale ${volver.length} veces.`);
  assert.deepEqual(clases(volver[0].className), clases('btn-secondary btn-sm'), `🔴 CIEGO: «${EXENTO}» ya no es \`.btn-sm\` (className "${volver[0].className}"): el exento ha cambiado.`);
  assert.ok(!todos(presupuesto).some((n) => /(?<![\w-])j1-prog(?![\w-])/.test(String(n.className || ''))), '🔴 la ficha del presupuesto pinta `.j1-prog`: la regla la alcanzaría.');

  const m = await servirYMedir({ '/factura': pagina(factura), '/presupuesto': pagina(presupuesto) });
  for (const ancho of ANCHOS) {
    const f = m[`/factura@${ancho}`];
    const q = m[`/presupuesto@${ancho}`];
    const visto = `@${ancho}px factura ${JSON.stringify(f)} · presupuesto ${JSON.stringify(q)}`;
    // CIEGO: el medidor sabe decir que no, y alcanza a los campos con su clase.
    for (const s of [f.sembrado, q.sembrado]) {
      assert.ok(!s.error && s.tocable < MINIMO_TACTIL && Math.abs(s.tocable - SEMBRADO.alto) <= 2,
        `🔴 CIEGO: el campo sembrado de ${SEMBRADO.alto} px no sale corto; el medidor no sabe decir que no. ${visto}`);
    }
    for (const [k, v] of [['fecha', f.fecha], ['etiquetas', f.etiquetas], ['volver', f.volver], ['etiquetas del presupuesto', q.etiquetas]]) {
      assert.ok(!v.error, `🔴 CIEGO: el medidor no alcanza «${k}»: ${v.error}. ${visto}`);
    }
    assert.deepEqual([f.fecha.tipo, f.etiquetas.tipo, q.etiquetas.tipo], ['date', 'text', 'text'], `🔴 CIEGO: los campos no son los medidos en el registro. ${visto}`);
    for (const v of [f.fecha, f.etiquetas, q.etiquetas]) assert.deepEqual(clases(v.clases), ['input'], `🔴 CIEGO: un campo no lleva \`.input\`. ${visto}`);

    // EL TICKET.
    assert.ok(f.fecha.tocable >= MINIMO_TACTIL, `🔴 la fecha «¿Cuándo lo has cobrado?» mide ${f.fecha.tocable} px de toque a ${ancho} px (mínimo ${MINIMO_TACTIL}, AB6). ${visto}`);
    assert.ok(f.etiquetas.tocable >= MINIMO_TACTIL, `🔴 el campo de Etiquetas de la factura mide ${f.etiquetas.tocable} px de toque a ${ancho} px (mínimo ${MINIMO_TACTIL}, AB6). ${visto}`);
    // EXENTO (SCRUM-1845 c.22728): `.btn-sm` que no es la primaria; mide lo mismo que en rojo.
    assert.ok(Math.abs(f.volver.tocable - EXENTO_EN_ROJO) <= 1,
      `🔴 EXENTO: «${EXENTO}» mide ${f.volver.tocable} px y en rojo medía ${EXENTO_EN_ROJO}: la regla se sale de los campos. ${visto}`);
    // CONTROL: la ficha del presupuesto comparte clases y no cambia.
    assert.ok(Math.abs(q.etiquetas.tocable - PRESUPUESTO_EN_ROJO) <= 1,
      `🔴 CONTROL: el campo de Etiquetas del PRESUPUESTO mide ${q.etiquetas.tocable} px y en rojo medía ${PRESUPUESTO_EN_ROJO}: la regla alcanza otra ficha. ${visto}`);
  }
});

// ── ② el ancla ──────────────────────────────────────────────────────────────────────────────
// El quitacomentarios es el de la casa (SCRUM-700), con `#` y `//` como código: en CSS no son
// comentarios (SCRUM-1851).
const ANCLAS = ['.j1-prog ~ .detail-next > div > .form-group > .input', '.detail-page:has(> .detail-section > .j1-prog) > .detail-section > .input'];
const sinComentarios = (s) => ejecutableDe(s, { ancla: ANCLAS[0], donde: 'styles.css (bloque J1 de SCRUM-1864)', almohadillaEsComentario: false, barraDobleEsComentario: false });
function bloque1864(hoja) {
  const ini = hoja.indexOf('/* J1: SCRUM-1864');
  const fin = hoja.indexOf('/* J1: fin del bloque SCRUM-1864 */');
  if (ini < 0 || fin < ini || hoja.indexOf('/* J1: SCRUM-1864', ini + 1) >= 0) return null;
  return hoja.slice(ini, fin);
}

test('SCRUM-1864 ② · las reglas cuelgan de `.j1-prog`, y esa clase sólo la escribe la ficha de factura', () => {
  const bloque = bloque1864(fs.readFileSync(HOJA, 'utf8'));
  assert.ok(bloque, '🔴 `styles.css` no tiene UN bloque «/* J1: SCRUM-1864 … */» con su cierre.');
  const codigo = sinComentarios(bloque);
  const reglas = [...codigo.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  assert.ok(reglas.length >= 1, '🔴 CIEGO: el bloque J1 de SCRUM-1864 no tiene ninguna regla.');
  const llaves = (re) => (codigo.match(re) || []).length;
  assert.ok(llaves(/\{/g) === reglas.length && llaves(/\}/g) === reglas.length, `🔴 CIEGO: el troceo no es fiable (${llaves(/\{/g)} «{», ${llaves(/\}/g)} «}», ${reglas.length} reglas).`);
  const selectores = reglas.flatMap(([, sel]) => sel.split(/,(?![^(]*\))/).map((x) => x.trim()));
  assert.deepEqual(selectores.sort(), [...ANCLAS].sort(), '🔴 el bloque no tiene exactamente los dos selectores anclados a la ficha de factura.');
  for (const [, , cuerpo] of reglas) assert.equal(cuerpo.trim().replace(/;$/, ''), 'min-height:44px', `🔴 el bloque hace algo más que dar tamaño: «${cuerpo.trim()}».`);
  const escritores = [];
  let mirados = 0;
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (/\.(js|html)$/.test(e.name)) {
        mirados += 1;
        if (/(?<![\w-])j1-prog(?![\w-])/.test(fs.readFileSync(p, 'utf8'))) escritores.push(path.relative(RAIZ, p).split(path.sep).join('/'));
      }
    }
  };
  andar(PUBLIC);
  assert.ok(mirados > 50, `🔴 CIEGO: sólo ${mirados} ficheros .js/.html en public/.`);
  assert.deepEqual(escritores, ['public/dashboard/js/invoiceDetailView.js'], `🔴 el ancla \`.j1-prog\` la escriben ${JSON.stringify(escritores)} (sobre ${mirados}).`);
});

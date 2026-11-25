// tests/scrum1849-lista-facturas-44.test.mjs — SCRUM-1849
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA LISTA DE FACTURAS (`invoicesView.js`) A 44 PX DE TOQUE (AB6).
//
// El censo táctil de SCRUM-1845 contó 10 objetivos cortos en esta pantalla: «Nueva factura»
// (`.btn-primary`, 36), los cuatro campos de la barra de filtros (`.input`, 34-36), las dos casillas
// de la tabla (cabecera y fila, 14) y tres `.btn-sm`. Regla del fundador (SCRUM-1845 c.22728, sobre
// `DESIGN.md:171`): un `.btn-sm` que NO es la primaria de su pantalla se queda en 30 px; uno que hace
// de primaria, y todo lo demás por debajo de 44, se cura. «⬇ CSV» y «Ver detalle» no son la primaria
// (lo es «Nueva factura»): quedan EXENTOS, y aquí se comprueba que la cura no los toca.
// Dos primarias pequeñas que el censo no vio porque nacen ocultas se curan con la misma regla:
// «✓ Marcar como pagadas» de la barra del lote (con su campo de fecha) y la llamada del estado vacío.
//
// La cura es la de 1559j y 1843: una regla de `styles.css` ACOTADA al contenedor de la lista (la
// tarjeta que contiene `.j1-fac-lista`), sólo tamaño. Las casillas no crecen: su `::before` les da
// el área de toque (13 + 2 × 16 = 45), como la de «Solo activos» de Productos (1559j).
//
// ① en NAVEGADOR: la vista REAL montada con el banco, serializada y servida con las hojas del índice,
//   medida con el árbitro de la casa (`__areaDeToque`) a 390, 929 y 1280 px, en tres estados: la
//   lista, la lista con una fila marcada (barra del lote) y la lista vacía. Controles: un botón
//   SEMBRADO de 30 px sale corto, la fuente cargó, y cada objetivo existe y se pinta.
// ② sin navegador: cada selector del bloque cuelga del ancla, el ancla sólo la escribe esta lista,
//   y ningún selector apunta a un `.btn-sm` exento.
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
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL, CORTE_MOVIL } from '../scripts/_medidor-de-toque.mjs';
import { resolverNavegador, lanzarNavegador } from '../scripts/_navegador.mjs';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const HOJA = path.join(PUBLIC, 'dashboard', 'css', 'styles.css');
const ANCHOS = [390, 929, 1280];
const SEMBRADO = { id: '__sembrado1849', alto: 30 };
const CAPTURAS = process.env.SCRUM1849_CAPTURAS || '';

// Dos facturas: la pendiente lleva casilla de lote (`sePuedeMarcarPagadaEnLote`); la cobrada, no.
const FACTURAS = [
  { id: 41, number: 'F2026-0012', type: 'F1', customerName: 'Cliente A', status: 'pending', total: '1250.00', currency: 'EUR', paidVia: null, createdAt: '2026-11-20T09:15:00Z', tags: [] },
  { id: 42, number: 'F2026-0011', type: 'F1', customerName: 'Cliente B', status: 'paid', total: '480.50', currency: 'EUR', paidVia: 'transfer', createdAt: '2026-11-18T16:40:00Z', tags: [] },
];

async function montar(facturas) {
  const banco = cargarDashboard(RAIZ, { datos: (url) => (/\/admin\/invoices(\?|$)/.test(url) ? facturas : []) });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: el dashboard no carga entero en el banco.');
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderInvoicesView');
  assert.equal(r.error, null, `🔴 CIEGO: la lista de facturas revienta al montarse: ${r.error && r.error.message}`);
  return r.contenedor;
}

// Se evalúa EN LA PÁGINA, después de `FUENTE_MEDIDOR`. La tarjeta es la que contiene `.j1-fac-lista`.
const MEDIR = `(async (SEL, S) => {
  const card = [...document.querySelectorAll('.data-card')].find((d) => d.querySelector('.j1-fac-lista'));
  const q = (s) => (card ? card.querySelector(s) : null);
  const qa = (s) => (card ? [...card.querySelectorAll(s)] : []);
  const medir = async (el) => el
    ? { clases: el.className, texto: (el.textContent || '').trim().slice(0, 24), ...(await window.__areaDeToque(el, SEL, { scroll: true })) }
    : { error: 'NO EXISTE' };
  const varios = async (els) => { const o = []; for (const el of els) o.push(await medir(el)); return o; };
  return {
    tarjeta: !!card,
    sembrado: await medir(document.getElementById(S)),
    nueva: await medir(q(':scope > .data-card-header > .btn-primary')),
    csv: await medir(q(':scope > .data-card-header > .btn-secondary.btn-sm')),
    campos: await varios(qa(':scope > div > .data-card-toolbar > .input')),
    todas: await medir(q('#inv-check-all')),
    fila: await medir(q('.inv-row-check')),
    detalle: await varios(qa('.j1-fac-lista .btn-ghost.btn-sm')),
    lote: await medir(q('#bulk-paid-btn')),
    loteFecha: await medir(q('#bulk-fecha-cobro')),
    loteCancelar: await medir(q('#bulk-cancel-btn')),
    vacio: await medir(q('#inv-empty-cta')),
  };
})`;

const NO_PINTA = /no se está pintando/;
const pinta = (m) => m && !m.error;

const navegador = resolverNavegador();

test('SCRUM-1849 ① · la lista de facturas da 44 px de toque a 390, 929 y 1280; los `.btn-sm` exentos no cambian', { skip: !navegador.ok && `sin navegador donde medir (resolverNavegador): ${navegador.motivo}` }, async (t) => {
  // Tres estados de la MISMA vista real: la lista, la lista con una fila marcada y la lista vacía.
  const lista = await montar(FACTURAS);
  const htmlLista = serializar(lista);
  const casilla = todos(lista).find((n) => n.tagName === 'INPUT' && String(n.className || '').split(/\s+/).includes('inv-row-check'));
  assert.ok(casilla, '🔴 CIEGO: la fila pendiente no pinta su casilla de lote; no hay barra del lote que medir.');
  casilla.checked = true;
  assert.ok(casilla.disparar('change') > 0, '🔴 CIEGO: nadie escucha la casilla de la fila.');
  const htmlLote = serializar(lista);
  assert.ok(htmlLote.includes('bulk-fecha-cobro'), '🔴 CIEGO: al marcar la fila no nace la barra del lote con su fecha.');
  const htmlVacio = serializar(await montar([]));
  assert.ok(htmlVacio.includes('inv-empty-cta'), '🔴 CIEGO: la lista vacía no pinta su llamada «Crear un presupuesto».');

  const pagina = (html) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC)
    + `<style>#${SEMBRADO.id}{display:block;box-sizing:border-box;width:120px;height:${SEMBRADO.alto}px;min-height:0;padding:0;border:0;margin:24px 0}</style>`
    + '</head><body>' + html + `<button id="${SEMBRADO.id}">·</button></body></html>`;
  const PAGINAS = { '/lista': pagina(htmlLista), '/lote': pagina(htmlLote), '/vacio': pagina(htmlVacio) };
  const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
  const srv = http.createServer((rq, res) => {
    const u = rq.url.split('?')[0];
    if (PAGINAS[u]) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGINAS[u]); }
    const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
    if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(d));
  });
  const puerto = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
  const nav = await lanzarNavegador(puppeteer, {});
  const medidas = {};
  try {
    for (const ancho of ANCHOS) {
      for (const ruta of Object.keys(PAGINAS)) {
        const page = await nav.newPage();
        await page.setViewport({ width: ancho, height: 900 });
        await page.goto(`http://127.0.0.1:${puerto}${ruta}`, { waitUntil: 'load' });
        const f = await esperarFuentes(page);
        const ceguera = cegueraDeLaFuente(f, `la lista ${ruta} @${ancho}px`);
        assert.equal(ceguera, null, ceguera);
        assert.ok(f.cargadas > 0, `🔴 CIEGO @${ancho}px: ninguna cara de la fuente cargó; se mediría con la de reserva.`);
        // Evidencia, sólo si se pide: `SCRUM1849_CAPTURAS=<carpeta>/<prefijo>` (antes y después del registro).
        if (CAPTURAS && ancho !== 929 && (ruta === '/lista' || (ruta === '/lote' && ancho === 1280))) {
          await page.screenshot({ path: `${CAPTURAS}${ruta.slice(1)}-${ancho}.png`, fullPage: true });
        }
        await page.evaluate(FUENTE_MEDIDOR);
        medidas[`${ruta}@${ancho}`] = await page.evaluate(`${MEDIR}(${JSON.stringify(INTERACTIVOS)}, ${JSON.stringify(SEMBRADO.id)})`);
        await page.close();
      }
    }
  } finally {
    await nav.close();
    srv.close();
  }
  // La tabla entera sale SIEMPRE, también en verde: es la medida «después» del registro.
  const fila = (m) => (m ? (m.error ? `· ${m.error}` : `${m.tocable}`) : '—');
  for (const [k, m] of Object.entries(medidas)) {
    t.diagnostic(`${k} · nueva ${fila(m.nueva)} · csv ${fila(m.csv)} · campos [${m.campos.map(fila).join(', ')}] · todas ${fila(m.todas)} · fila ${fila(m.fila)} · detalle [${m.detalle.map(fila).join(', ')}] · lote ${fila(m.lote)} · loteFecha ${fila(m.loteFecha)} · loteCancelar ${fila(m.loteCancelar)} · vacio ${fila(m.vacio)}`);
  }

  for (const ancho of ANCHOS) {
    const escritorio = ancho >= CORTE_MOVIL;
    const L = medidas[`/lista@${ancho}`];
    const B = medidas[`/lote@${ancho}`];
    const V = medidas[`/vacio@${ancho}`];
    const visto = `@${ancho}px ${JSON.stringify({ L, B, V })}`;
    for (const m of [L, B, V]) {
      assert.ok(m.tarjeta, `🔴 CIEGO @${ancho}px: no encuentro la tarjeta que contiene \`.j1-fac-lista\`. ${visto}`);
      // CIEGO: el medidor ve cortos (un botón sembrado de 30 px sale corto).
      assert.ok(pinta(m.sembrado) && m.sembrado.tocable < MINIMO_TACTIL && Math.abs(m.sembrado.tocable - SEMBRADO.alto) <= 2,
        `🔴 CIEGO: el botón sembrado de ${SEMBRADO.alto} px no sale corto; el medidor no sabe decir que no. ${visto}`);
    }

    // ── LA LISTA ──
    assert.ok(pinta(L.nueva) && /\bbtn-primary\b/.test(L.nueva.clases) && !/\bbtn-sm\b/.test(L.nueva.clases),
      `🔴 CIEGO: «Nueva factura» no está o ya no es \`.btn-primary\` grande. ${visto}`);
    assert.ok(L.nueva.tocable >= MINIMO_TACTIL, `🔴 «Nueva factura» mide ${L.nueva.tocable} px de toque a ${ancho} px (mínimo ${MINIMO_TACTIL}). ${visto}`);
    const campos = L.campos.filter(pinta);
    assert.ok(campos.length >= 4, `🔴 CIEGO: la barra de filtros pinta ${campos.length} campos y el censo midió 4. ${visto}`);
    for (const c of campos) assert.ok(c.tocable >= MINIMO_TACTIL, `🔴 el campo [${c.clases}] «${c.texto}» de la barra mide ${c.tocable} px. ${visto}`);
    if (escritorio) {
      for (const k of ['todas', 'fila']) {
        assert.ok(pinta(L[k]), `🔴 CIEGO: la casilla «${k}» no se pinta en escritorio: ${L[k].error}. ${visto}`);
        assert.ok(L[k].caja < 20, `🔴 la casilla «${k}» ha CRECIDO a ${L[k].caja} px de caja: el ticket pide el área de toque, no agrandarla. ${visto}`);
        assert.ok(L[k].tocable >= MINIMO_TACTIL, `🔴 la casilla «${k}» mide ${L[k].tocable} px de toque a ${ancho} px. ${visto}`);
      }
    } else {
      // En móvil la tabla es de tarjetas y las casillas se esconden (`col-hide-mobile`): el lote es de escritorio.
      for (const k of ['todas', 'fila']) assert.match(String(L[k].error), NO_PINTA, `🔴 la casilla «${k}» se pinta en móvil y aquí no se mide. ${visto}`);
    }
    // EXENTOS por c.22728: no son la primaria. Siguen cortos: la cura no se ha salido de su sitio.
    assert.ok(pinta(L.csv) && L.csv.tocable < 36, `🔴 CONTROL: «⬇ CSV» (\`.btn-sm\` exento) mide ${L.csv.tocable} px: la regla lo alcanza. ${visto}`);
    const detalle = L.detalle.filter(pinta);
    assert.ok(detalle.length >= 2, `🔴 CIEGO: sólo ${detalle.length} «Ver detalle» medidos (hay 2 filas). ${visto}`);
    if (escritorio) for (const d of detalle) assert.ok(d.tocable < 36, `🔴 CONTROL: «Ver detalle» (\`.btn-sm\` exento) mide ${d.tocable} px: la regla lo alcanza. ${visto}`);

    // ── LA BARRA DEL LOTE (sólo escritorio: en móvil no hay casillas que la abran) ──
    if (escritorio) {
      for (const k of ['lote', 'loteFecha', 'loteCancelar']) assert.ok(pinta(B[k]), `🔴 CIEGO: «${k}» no se pinta con una fila marcada: ${B[k].error}. ${visto}`);
      assert.ok(/\bbtn-primary\b/.test(B.lote.clases), `🔴 CIEGO: «Marcar como pagadas» ya no es la primaria del lote. ${visto}`);
      assert.ok(B.lote.tocable >= MINIMO_TACTIL, `🔴 «Marcar como pagadas» (primaria del lote) mide ${B.lote.tocable} px. ${visto}`);
      assert.ok(B.loteFecha.tocable >= MINIMO_TACTIL, `🔴 la fecha de cobro del lote mide ${B.loteFecha.tocable} px. ${visto}`);
      assert.ok(B.loteCancelar.tocable < 36, `🔴 CONTROL: «Cancelar» del lote (\`.btn-ghost.btn-sm\` exento) mide ${B.loteCancelar.tocable} px. ${visto}`);
    }

    // ── LA LISTA VACÍA ──
    assert.ok(pinta(V.vacio) && /\bbtn-primary\b/.test(V.vacio.clases), `🔴 CIEGO: la llamada del estado vacío no se pinta: ${V.vacio.error}. ${visto}`);
    assert.ok(V.vacio.tocable >= MINIMO_TACTIL, `🔴 «Crear un presupuesto» (primaria del estado vacío) mide ${V.vacio.tocable} px. ${visto}`);
  }
});

// ── ② el ancla ──────────────────────────────────────────────────────────────────────────────
// El quitacomentarios es el de la casa (SCRUM-700: `ejecutableDe`). En CSS `#` es un selector.
const ANCLA = '.data-card:has(.j1-fac-lista)';
const sinComentarios = (s) => ejecutableDe(s,
  { ancla: ANCLA, donde: 'styles.css (bloque J1 de SCRUM-1849)', almohadillaEsComentario: false });
function bloque1849(hoja) {
  const ini = hoja.indexOf('/* J1: SCRUM-1849');
  const fin = hoja.indexOf('/* J1: fin del bloque SCRUM-1849 */');
  if (ini < 0 || fin < ini || hoja.indexOf('/* J1: SCRUM-1849', ini + 1) >= 0) return null;
  return hoja.slice(ini, fin);
}
// El NOMBRE de la clase, no un prefijo (A10).
const TOKEN_ANCLA = /(?<![\w-])j1-fac-lista(?![\w-])/;

test('SCRUM-1849 ② · el bloque cuelga de la tarjeta de `.j1-fac-lista`, que sólo escribe la lista de facturas, y no toca un `.btn-sm` exento', () => {
  const bloque = bloque1849(fs.readFileSync(HOJA, 'utf8'));
  assert.ok(bloque, '🔴 `styles.css` no tiene UN bloque «/* J1: SCRUM-1849 … */» con su cierre.');
  const codigo = sinComentarios(bloque);
  const reglas = [...codigo.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  assert.ok(reglas.length >= 1, '🔴 CIEGO: el bloque J1 de SCRUM-1849 no tiene ninguna regla.');
  // El filtro de la casa toma `//` por comentario también en CSS (SCRUM-1843b): se cuentan las llaves.
  const llaves = (c) => (codigo.match(c === '{' ? /\{/g : /\}/g) || []).length;
  assert.ok(llaves('{') === reglas.length && llaves('}') === reglas.length,
    `🔴 CIEGO: tras quitar comentarios hay ${llaves('{')} «{» y ${llaves('}')} «}» para ${reglas.length} reglas: el troceo no es fiable.`);
  let selectores = 0;
  for (const [, sel, cuerpo] of reglas) {
    for (const s of sel.split(',').map((x) => x.trim())) {
      selectores += 1;
      assert.ok(s.startsWith(ANCLA + ' '), `🔴 «${s}» no cuelga del ancla \`${ANCLA}\`: la regla alcanzaría otra pantalla.`);
      assert.doesNotMatch(s, /\.btn-(ghost|secondary)\b|\.btn-sm\b/, `🔴 «${s}» apunta a un \`.btn-sm\` o a una variante exenta por SCRUM-1845 c.22728.`);
    }
    // Sólo tamaño: ninguna propiedad de color, fuente o texto.
    for (const decl of cuerpo.split(';').map((x) => x.trim()).filter(Boolean)) {
      const prop = decl.split(':')[0].trim();
      assert.ok(['min-height', 'position', 'content', 'inset'].includes(prop), `🔴 el bloque declara «${decl}»: SCRUM-1849 es sólo tamaño.`);
    }
  }
  assert.ok(selectores >= 5, `🔴 CIEGO: sólo ${selectores} selectores en el bloque.`);
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
  assert.deepEqual(escritores, ['public/dashboard/js/invoicesView.js'],
    `🔴 el ancla \`.j1-fac-lista\` la escriben ${JSON.stringify(escritores)} (sobre ${mirados} ficheros): la regla alcanzaría otra pantalla, o la lista la ha perdido.`);
});

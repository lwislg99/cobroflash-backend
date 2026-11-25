// tests/scrum1847-clientes-44.test.mjs — SCRUM-1847
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA LISTA DE CLIENTES (`renderCustomersView`) A 44 PX DE TOQUE (AB6), CON LA REGLA DE SCRUM-1845 c.22728.
//
// El censo de SCRUM-1845 le contaba 21 cortos a 929 px. La decisión del fundador (c.22728, sobre
// `DESIGN.md:171`, de Luis) parte la lista en dos:
//   · SE CURAN (≥ 44): «Nuevo cliente» (`.btn-primary`, la primaria de la pantalla), el buscador y los
//     `select` (`.input`), los enlaces de contacto (`.contacto-link`) y, en la lista vacía, «+ Añadir
//     cliente» (`.btn-primary.btn-sm` que HACE de primaria; el censo no lo vio porque tenía clientes).
//   · EXENTOS: los `.btn-sm` que NO son la primaria («⬆ Importar clientes», «⬇ Clientes CSV», «Editar»,
//     «Portal», «📊 Historial»). Se quedan como los dejó SCRUM-1149: 36 en escritorio, 44 en móvil.
//
// La cura es la de SCRUM-1149/1843 (opción ③ de SCRUM-786): una regla de `styles.css` ACOTADA a la
// tarjeta de esta lista —el ancla de 1149, `.data-card:has(> .barra-seleccion)`—, sólo tamaño, sin JS,
// sin texto y sin tocar `.btn-sm`, `.input`, `.btn-primary` ni `.contacto-link` globales.
//
// ① en NAVEGADOR: la vista REAL con el banco de la casa (`paginaDeClientes`, la del guard táctil),
//   servida con las hojas del índice y medida con el árbitro de la casa (`__areaDeToque`) a 390 y 1280.
//   Controles: un botón SEMBRADO de 30 px sale corto, la fuente cargó, y los exentos siguen exentos
//   (a 1280 por debajo de 44: la regla no se ha comido un `.btn-sm` que no es primario).
// ② la lista vacía: «+ Añadir cliente» da 44 a 390 y a 1280.
// ③ sin navegador: cada selector del bloque cuelga del ancla, ninguno apunta a un `.btn-sm` que no sea
//   el de la lista vacía, y el ancla sólo la escribe esta vista.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { paginaDeClientes, paginaDeVista } from '../scripts/_pagina-panel.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente } from '../scripts/_hojas-del-panel.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from '../scripts/_medidor-de-toque.mjs';
import { resolverNavegador, lanzarNavegador } from '../scripts/_navegador.mjs';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const HOJA = path.join(PUBLIC, 'dashboard', 'css', 'styles.css');
const ANCHOS = [390, 1280];
const SEMBRADO = { id: '__sembrado1847', alto: 30 };
// Del censo de SCRUM-1845 (21 = 10 que se curan + 11 `.btn-sm` exentos), con los 3 clientes de
// `CLIENTES_DE_MUESTRA`: 1 «Nuevo cliente» + 1 buscador + 2 `select` + 3 × 2 enlaces de contacto.
const A_CURAR_MINIMO = 10;
// 2 de la cabecera + 3 × 3 de las filas.
const EXENTOS_MINIMO = 11;
const VACIO = '+ Añadir cliente';

// Se evalúa EN LA PÁGINA, después de `FUENTE_MEDIDOR`. Sólo lo que se pinta: lo oculto no se toca.
const MEDIR = `(async (SEL, S) => {
  const tarjeta = document.querySelector('.data-card');
  const pintado = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const texto = (el) => (el.textContent || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 30);
  const medir = async (el) => ({ tag: el.tagName, clases: el.className, texto: texto(el), ...(await window.__areaDeToque(el, SEL, { scroll: true })) });
  const lista = async (els) => { const o = []; for (const el of els) if (pintado(el)) o.push(await medir(el)); return o; };
  if (!tarjeta) return { error: 'sin .data-card' };
  const nuevo = [...tarjeta.querySelectorAll('.data-card-header .btn-primary')].filter((b) => !b.classList.contains('btn-sm'));
  return {
    curar: await lista([...nuevo, ...tarjeta.querySelectorAll('.input, .contacto-link, .clientes-vacio-cta')]),
    exentos: await lista([...tarjeta.querySelectorAll('.btn-sm:not(.clientes-vacio-cta)')]),
    sembrado: await medir(document.getElementById(S)),
  };
})`;

async function medirPagina(html, etiqueta) {
  const pagina = '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC)
    + `<style>#${SEMBRADO.id}{display:block;box-sizing:border-box;width:120px;height:${SEMBRADO.alto}px;min-height:0;padding:0;border:0;margin:24px 0}</style>`
    + '</head><body>' + html + `<button id="${SEMBRADO.id}">·</button></body></html>`;
  const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
  const srv = http.createServer((rq, res) => {
    const u = rq.url.split('?')[0];
    if (u === '/lista') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(pagina); }
    const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
    if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(d));
  });
  const puerto = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
  const nav = await lanzarNavegador(puppeteer, {});
  const salida = {};
  try {
    for (const ancho of ANCHOS) {
      const page = await nav.newPage();
      await page.setViewport({ width: ancho, height: 900 });
      await page.goto(`http://127.0.0.1:${puerto}/lista`, { waitUntil: 'load' });
      const f = await esperarFuentes(page);
      const ceguera = cegueraDeLaFuente(f, `${etiqueta} @${ancho}px`);
      assert.equal(ceguera, null, ceguera);
      assert.ok(f.cargadas > 0, `🔴 CIEGO @${ancho}px: ninguna cara de la fuente cargó; se mediría con la de reserva.`);
      await page.evaluate(FUENTE_MEDIDOR);
      const m = await page.evaluate(`${MEDIR}(${JSON.stringify(INTERACTIVOS)}, ${JSON.stringify(SEMBRADO.id)})`);
      await page.close();
      assert.ok(!m.error, `🔴 CIEGO @${ancho}px: ${m.error}`);
      // CIEGO: el medidor sabe decir que no (un botón sembrado de 30 px sale corto).
      assert.ok(!m.sembrado.error && m.sembrado.tocable < MINIMO_TACTIL && Math.abs(m.sembrado.tocable - SEMBRADO.alto) <= 2,
        `🔴 CIEGO: el botón sembrado de ${SEMBRADO.alto} px no sale corto; el medidor no sabe decir que no. @${ancho}px ${JSON.stringify(m.sembrado)}`);
      salida[ancho] = m;
    }
  } finally {
    await nav.close();
    srv.close();
  }
  return salida;
}

const resumen = (xs) => xs.map((x) => `${x.tag}.${String(x.clases).trim().replace(/\s+/g, '.')} «${x.texto}» ${x.error || x.tocable}`).join(' | ');
const navegador = resolverNavegador();

test('SCRUM-1847 ① · la lista de Clientes: lo que no es un .btn-sm secundario da 44 px de toque a 390 y a 1280',
  { skip: !navegador.ok && `sin navegador donde medir (resolverNavegador): ${navegador.motivo}` }, async (t) => {
  const p = await paginaDeClientes(RAIZ, { seleccionar: false });
  assert.ok(p.html, `🔴 CIEGO: la lista de Clientes no se monta: ${p.aviso}`);
  const medidas = await medirPagina(p.html, 'la lista');
  for (const ancho of ANCHOS) {
    const m = medidas[ancho];
    const visto = `@${ancho}px · a curar: ${resumen(m.curar)} · exentos: ${resumen(m.exentos)}`;
    t.diagnostic(visto);
    // CIEGO: están los del censo, y el medidor alcanza a todos.
    assert.ok(m.curar.length >= A_CURAR_MINIMO, `🔴 CIEGO: sólo ${m.curar.length} objetivos a curar pintados (mínimo ${A_CURAR_MINIMO}). ${visto}`);
    assert.ok(m.exentos.length >= EXENTOS_MINIMO, `🔴 CIEGO: sólo ${m.exentos.length} .btn-sm exentos pintados (mínimo ${EXENTOS_MINIMO}). ${visto}`);
    for (const x of [...m.curar, ...m.exentos]) assert.ok(!x.error, `🔴 CIEGO: el medidor no alcanza ${resumen([x])}. ${visto}`);
    assert.ok(m.curar.some((x) => /^Nuevo cliente/.test(x.texto)), `🔴 CIEGO: no encuentro «Nuevo cliente». ${visto}`);

    // EL TICKET.
    const cortos = m.curar.filter((x) => x.tocable < MINIMO_TACTIL);
    assert.deepEqual(cortos.map((x) => resumen([x])), [], `🔴 se quedan por debajo de ${MINIMO_TACTIL} px (AB6) a ${ancho} px. ${visto}`);

    // CONTROL (c.22728): a 1280 los `.btn-sm` secundarios NO suben a 44: siguen con lo de SCRUM-1149.
    if (ancho === 1280) {
      const subidos = m.exentos.filter((x) => x.tocable >= MINIMO_TACTIL);
      assert.deepEqual(subidos.map((x) => resumen([x])), [],
        `🔴 CONTROL: un .btn-sm que no es la primaria ha subido a 44 a 1280: la regla se sale de lo que decidió c.22728. ${visto}`);
    }
  }
});

test('SCRUM-1847 ② · la lista vacía: «+ Añadir cliente», la primaria pequeña, da 44 px de toque a 390 y a 1280',
  { skip: !navegador.ok && `sin navegador donde medir (resolverNavegador): ${navegador.motivo}` }, async (t) => {
  const datos = (u) => (/\/admin\/merchant/.test(String(u || '')) ? { id: 1, name: 'Fontanería Soler' } : []);
  const p = await paginaDeVista(RAIZ, 'renderCustomersView', { datos });
  assert.ok(p.html, `🔴 CIEGO: la lista vacía no se monta: ${p.aviso}`);
  assert.ok(p.html.includes(VACIO), `🔴 CIEGO: la lista vacía no pinta «${VACIO}».`);
  const medidas = await medirPagina(p.html, 'la lista vacía');
  for (const ancho of ANCHOS) t.diagnostic(`@${ancho}px · lista vacía: ${resumen(medidas[ancho].curar)}`);
  for (const ancho of ANCHOS) {
    const cta = medidas[ancho].curar.filter((x) => /clientes-vacio-cta/.test(x.clases));
    assert.equal(cta.length, 1, `🔴 CIEGO @${ancho}px: «${VACIO}» sale ${cta.length} veces. ${resumen(medidas[ancho].curar)}`);
    assert.ok(/\bbtn-sm\b/.test(cta[0].clases), `🔴 CIEGO: «${VACIO}» ya no es la primaria pequeña (${cta[0].clases}): el caso ha cambiado.`);
    assert.ok(!cta[0].error && cta[0].tocable >= MINIMO_TACTIL, `🔴 «${VACIO}» mide ${cta[0].error || cta[0].tocable} px a ${ancho} px (mínimo ${MINIMO_TACTIL}).`);
  }
});

// ── ③ el ancla ──────────────────────────────────────────────────────────────────────────────
// El quitacomentarios es el de la casa (SCRUM-700), con su suelo; en CSS `#` es un selector.
const ANCLA_REGLA = '.data-card:has(> .barra-seleccion) ';
const sinComentarios = (s) => ejecutableDe(s,
  { ancla: ANCLA_REGLA, donde: 'styles.css (bloque J2 de SCRUM-1847)', almohadillaEsComentario: false });
function bloque1847(hoja) {
  const ini = hoja.indexOf('/* J2: SCRUM-1847');
  const fin = hoja.indexOf('/* J2: fin del bloque SCRUM-1847 */');
  if (ini < 0 || fin < ini || hoja.indexOf('/* J2: SCRUM-1847', ini + 1) >= 0) return null;
  return hoja.slice(ini, fin);
}
// El NOMBRE de la clase, no un prefijo: `barra-seleccion-etiquetar` no cuenta (A10).
const TOKEN_ANCLA = /(?<![\w-])barra-seleccion(?![\w-])/;

test('SCRUM-1847 ③ · la regla cuelga de la tarjeta de Clientes, no toca un .btn-sm secundario, y el ancla sólo la escribe esta vista', () => {
  const bloque = bloque1847(fs.readFileSync(HOJA, 'utf8'));
  assert.ok(bloque, '🔴 `styles.css` no tiene UN bloque «/* J2: SCRUM-1847 … */» con su cierre.');
  const codigo = sinComentarios(bloque);
  const reglas = [...codigo.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  assert.ok(reglas.length >= 1, '🔴 CIEGO: el bloque J2 de SCRUM-1847 no tiene ninguna regla.');
  // El filtro de la casa toma `//` por comentario también en CSS: con las llaves se ve si se comió algo.
  const llaves = (c) => (codigo.match(c === '{' ? /\{/g : /\}/g) || []).length;
  assert.ok(llaves('{') === reglas.length && llaves('}') === reglas.length,
    `🔴 CIEGO: tras quitar comentarios hay ${llaves('{')} «{» y ${llaves('}')} «}» para ${reglas.length} reglas: el troceo no es fiable.`);
  for (const [, sel, cuerpo] of reglas) {
    // Sólo tamaño.
    for (const decl of cuerpo.split(';').map((x) => x.trim()).filter(Boolean)) {
      assert.match(decl, /^min-(height|width)\s*:/, `🔴 «${decl}» no es sólo tamaño.`);
    }
    for (const s of sel.split(',').map((x) => x.trim())) {
      assert.ok(s.startsWith(ANCLA_REGLA), `🔴 «${s}» no cuelga del ancla de la lista de Clientes.`);
      // c.22728: un `.btn-sm` que no es la primaria se queda; el único `.btn-sm` aquí es el de la lista vacía.
      assert.ok(!/\.btn-sm(?![\w-])/.test(s) || /\.clientes-vacio-cta(?![\w-])/.test(s), `🔴 «${s}» toca un .btn-sm que no es la primaria (c.22728).`);
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
  assert.deepEqual(escritores, ['public/dashboard/js/customersView.js'],
    `🔴 el ancla \`.barra-seleccion\` la escriben ${JSON.stringify(escritores)} (sobre ${mirados} ficheros): la regla alcanzaría otra pantalla, o la lista la ha perdido.`);
});

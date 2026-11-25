// tests/scrum1848-ajustes-planes-44.test.mjs — SCRUM-1848
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// AJUSTES (`renderSettingsView`) Y PLANES (`renderPlansView`) A 44 PX DE TOQUE (AB6).
//
// El censo de SCRUM-1845 (`docs/master/SCRUM-1845.md`, «Detalle por pantalla») dejó 10 cortos en
// Ajustes —7 sólo con las pestañas abiertas; 4 son casillas de 17 px— y 7 en Planes (`.plan-btn`,
// el conmutador Mensual/Anual y 3 enlaces de exportación). La regla del fundador (SCRUM-1845
// c.22728, sobre DESIGN.md:171): un `.btn-sm` que NO es la primaria de su pantalla se queda en
// 30 px; todo lo demás por debajo de 44 se cura. Aquí quedan exentos tres, y sólo esos tres.
//
// La cura es la de SCRUM-1843 (opción ③ de SCRUM-786): reglas de `styles.css` ACOTADAS al
// contenedor de cada vista (`.settings-panel`, `.j3e-5521062`), sólo tamaño, sin tocar las
// clases globales ni el JS.
//
// Las 4 casillas de Ajustes NO se curan aquí: quedan PENDIENTES por SCRUM-1848 c.22742 («Quitar
// Avisos y avisar»). Sus dos reglas (etiqueta a 44 y `::before` de 44, el patrón de SCRUM-962f) las
// tumbaba el ③ de `scrum962f-editor-cuatro-44` (S2), que sólo admite reglas de 44 de la familia
// `.inline-checkbox` dentro de `.quote-ajustes`. No se saltan en silencio: ① exige que sigan pintadas
// y CORTAS, y cuántas medidas cortas dan; el día que se curen, la lista sobra y el test lo dice.
//
// ① en NAVEGADOR: cada vista REAL montada con los datos del censo (`datosDelCenso`), con CADA
//   pestaña pulsada en el banco como hace el censo, serializada y servida con las hojas del índice,
//   y medida con el árbitro de la casa (`__areaDeToque`) a 390, 929 y 1280 px. Se mide TODO
//   interactivo pintado, no una lista: lo que quede corto y no sea un exento declarado, cae.
//   Controles: un botón SEMBRADO de 30 px sale corto; los 17 objetivos del censo aparecen; los
//   tres exentos siguen pintados y en 30 (la regla no se sale de su sitio); las 4 PENDIENTES
//   aparecen una vez por anchura, siguen cortas y dan exactamente 4 × anchuras medidas cortas.
// ② sin navegador: cada selector del bloque cuelga de su ancla, y cada ancla la escribe sólo su
//   vista.
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
// 929 es la anchura del censo de SCRUM-1845 («Añadir condición» sólo salía corto ahí); 390 y 1280,
// las del encargo.
const ANCHOS = [390, 929, 1280];
const SEMBRADO = { id: '__sembrado1848', alto: 30 };

const VISTAS = Object.freeze(['renderSettingsView', 'renderPlansView']);
// Las anclas del bloque, y la ÚNICA vista que escribe cada una. La fila del enlace de referidos y la de
// canjear viven en Ajustes pero FUERA de `.settings-panel` (medido en rojo: salen en las nueve pestañas).
const ANCLAS = Object.freeze([
  { ancla: '.settings-panel', fichero: 'public/dashboard/js/settingsView.js' },
  { ancla: '.j3e-033e7ec', fichero: 'public/dashboard/js/settingsView.js' },
  { ancla: '.j3e-3d68052', fichero: 'public/dashboard/js/settingsView.js' },
  { ancla: '.j3e-5521062', fichero: 'public/dashboard/js/plansView.js' },
]);

// Los 17 del censo (SCRUM-1845, «Detalle por pantalla»), por lo que los identifica en la página.
// Sirven de CONTROL de población: si uno no aparece pintado, la vista medida no es la del censo.
const OBJETIVOS = Object.freeze([
  { fn: 'renderSettingsView', nombre: 'enlace de referidos', casa: (e) => e.tag === 'INPUT' && tiene(e, 'j3e-a636e53') },
  { fn: 'renderSettingsView', nombre: '«Copiar link»', casa: (e) => e.tag === 'BUTTON' && e.txt === 'Copiar link' },
  // No es del censo: con sus datos (`freeMonthsEarned: 0`) no se pinta. Aquí se monta con un mes ganado.
  { fn: 'renderSettingsView', nombre: '«Canjear 1 mes gratis»', casa: (e) => e.tag === 'BUTTON' && e.txt === 'Canjear 1 mes gratis' },
  { fn: 'renderSettingsView', nombre: '«Añadir condición»', casa: (e) => e.tag === 'BUTTON' && e.txt === 'Añadir condición' },
  { fn: 'renderSettingsView', nombre: 'casillas (4)', casa: (e) => e.tag === 'INPUT' && e.tipo === 'checkbox', cuantos: 4 },
  { fn: 'renderSettingsView', nombre: '«Vista previa»', casa: (e) => e.tag === 'BUTTON' && e.txt === 'Vista previa' },
  { fn: 'renderSettingsView', nombre: '«⬆ Subir logo»', casa: (e) => e.tag === 'BUTTON' && e.txt === '⬆ Subir logo' },
  { fn: 'renderSettingsView', nombre: '«Sin color (por defecto)»', casa: (e) => e.tag === 'BUTTON' && e.txt === 'Sin color (por defecto)' },
  { fn: 'renderPlansView', nombre: 'enlaces de exportación (3)', casa: (e) => e.tag === 'A' && tiene(e, 'j3e-4a12b6e'), cuantos: 3 },
  { fn: 'renderPlansView', nombre: '«Quiero mi plaza founding…»', casa: (e) => e.tag === 'BUTTON' && tiene(e, 'plan-btn') && !tiene(e, 'btn-primary') },
  { fn: 'renderPlansView', nombre: '«Mensual»', casa: (e) => e.id === 'toggle-monthly' },
  { fn: 'renderPlansView', nombre: '«Anual -17%»', casa: (e) => e.id === 'toggle-annual' },
  { fn: 'renderPlansView', nombre: '«Suscribirme…»', casa: (e) => e.tag === 'BUTTON' && tiene(e, 'plan-btn') && tiene(e, 'btn-primary') },
]);

// EXENTOS por SCRUM-1845 c.22728 (DESIGN.md:171): `.btn-sm` que NO son la primaria de su pantalla.
// Ninguno lleva `btn-primary` (se comprueba abajo) y los tres están en la pestaña Marca, cuya
// primaria es guardar. Se quedan en 30 px a propósito.
const EXENTOS = Object.freeze([
  { txt: 'Vista previa', clases: 'btn-ghost btn-sm' },
  { txt: '⬆ Subir logo', clases: 'btn btn-secondary btn-sm' },
  { txt: 'Sin color (por defecto)', clases: 'btn-secondary btn-sm' },
]);

// PENDIENTES por SCRUM-1848 c.22742 (decisión del fundador, «Quitar Avisos y avisar»): las 4 casillas de
// Ajustes (3 en la pestaña Avisos y `showTechPhotoToClient`, en Equipo; las cuatro cuelgan de
// `.settings-panel .inline-checkbox`) se quedan en 17 px. NO son exentas: el test exige que sigan CORTAS,
// para que el día que S2 acote su ③ y alguien las cure, esta lista avise de que sobra.
const PENDIENTES = Object.freeze([
  { id: 'notifyEmailOnPaid', motivo: 'SCRUM-1848 c.22742: bloqueadas por el ③ de scrum962f (S2) hasta que S2 lo acote' },
  { id: 'notifyEmailOnQuoteAccepted', motivo: 'SCRUM-1848 c.22742: bloqueadas por el ③ de scrum962f (S2) hasta que S2 lo acote' },
  { id: 'notifyEmailWeeklyDigest', motivo: 'SCRUM-1848 c.22742: bloqueadas por el ③ de scrum962f (S2) hasta que S2 lo acote' },
  { id: 'showTechPhotoToClient', motivo: 'SCRUM-1848 c.22742: bloqueadas por el ③ de scrum962f (S2) hasta que S2 lo acote' },
]);

const clases = (c) => String(c || '').trim().split(/\s+/).filter(Boolean).sort();
const tiene = (e, c) => clases(e.cls).includes(c);
const exentoDe = (e) => EXENTOS.find((x) => e.tag === 'BUTTON' && e.txt === x.txt && clases(e.cls).join(' ') === clases(x.clases).join(' '));
const pendienteDe = (e) => (e.tag === 'INPUT' && e.tipo === 'checkbox' ? PENDIENTES.find((p) => p.id === e.id) : undefined);

/** La vista montada con los datos del censo y, como el censo, un estado por cada pestaña pulsada. */
async function estadosDe(fn) {
  const dc = datosDelCenso();
  dc.enVista(fn);
  // Lo único que se cambia de los datos del censo: un mes gratis ganado, para que Ajustes pinte también
  // «Canjear 1 mes gratis» (otra `.btn-primary.btn-sm` de la tarjeta de referidos) y se mida.
  const datos = (url, opts) => {
    const v = dc.datos(url, opts);
    return v && typeof v === 'object' && 'freeMonthsEarned' in v ? { ...v, freeMonthsEarned: 1 } : v;
  };
  const banco = cargarDashboard(RAIZ, { datos });
  const r = await pintarVista(banco, fn, ...(ARGUMENTOS_DEL_CENSO[fn] || []));
  assert.equal(r.error, null, `🔴 ${fn} revienta al abrirse: ${r.error && r.error.message}`);
  const c = r.contenedor;
  const estados = [{ estado: 'al abrir', html: serializar(c) }];
  const pestanasDe = () => todos(c).filter((x) => typeof x.getAttribute === 'function' && x.getAttribute('role') === 'tab');
  const iniciales = pestanasDe();
  const avisos = [];
  for (const [k, t0] of iniciales.entries()) {
    if (t0.getAttribute('aria-selected') === 'true') continue;
    const t = pestanasDe()[k];
    if (!t) { avisos.push(`la pestaña ${k + 1} ya no está`); continue; }
    const rotulo = String(t.textContent || '').replace(/\s+/g, ' ').trim();
    const rechazos = [];
    const anota = (e) => rechazos.push(String((e && e.message) || e).slice(0, 70));
    process.on('unhandledRejection', anota);
    try {
      t.click();
      for (let j = 0; j < 10; j++) await new Promise((ok) => setImmediate(ok));
    } finally {
      process.off('unhandledRejection', anota);
    }
    if (rechazos.length) { avisos.push(`«${rotulo}»: ${rechazos.join(' · ')}`); continue; }
    const html = serializar(c);
    if (estados.some((e) => e.html === html)) { avisos.push(`«${rotulo}»: pulsarla no cambia nada`); continue; }
    estados.push({ estado: `pestaña «${rotulo}»`, html });
  }
  return { estados, pestanas: iniciales.length, avisos };
}

// Se evalúa EN LA PÁGINA, después de `FUENTE_MEDIDOR`. Mide TODO interactivo pintado.
const MEDIR = `(async (SEL, ANCLA, S) => {
  const out = [];
  let ocultos = 0;
  for (const el of document.querySelectorAll(SEL)) {
    if (el.id === S) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) { ocultos += 1; continue; }
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    const etiqueta = el.labels && el.labels[0] ? el.labels[0].textContent : '';
    out.push({ tag: el.tagName, id: el.id || '', cls: String(el.className || ''), tipo: el.type || '',
      txt: String(el.tagName === 'INPUT' ? etiqueta : el.textContent).replace(/\\s+/g, ' ').trim().slice(0, 40),
      dentro: !!el.closest(ANCLA), padre: String((el.parentElement && el.parentElement.className) || ''), ...m });
  }
  const sembrado = await window.__areaDeToque(document.getElementById(S), SEL, { scroll: true });
  return { out, ocultos, sembrado };
})`;

const navegador = resolverNavegador();

test('SCRUM-1848 ① · Ajustes (todas sus pestañas) y Planes: todo interactivo da 44 px de toque a 390, 929 y 1280, salvo los 3 `.btn-sm` exentos por c.22728 y las 4 casillas PENDIENTES por c.22742',{ skip: !navegador.ok && `sin navegador donde medir (resolverNavegador): ${navegador.motivo}` }, async (t) => {
  const paginas = [];
  const poblacion = {};
  for (const fn of VISTAS) {
    const { estados, pestanas, avisos } = await estadosDe(fn);
    poblacion[fn] = { estados: estados.length, pestanas, avisos };
    for (const e of estados) paginas.push({ fn, estado: e.estado, html: e.html });
  }
  // CIEGO: Ajustes tiene pestañas y el banco las abre (el censo midió 7 cortos sólo con ellas abiertas).
  assert.ok(poblacion.renderSettingsView.pestanas >= 2 && poblacion.renderSettingsView.estados === poblacion.renderSettingsView.pestanas,
    `🔴 CIEGO: Ajustes da ${poblacion.renderSettingsView.estados} estados para ${poblacion.renderSettingsView.pestanas} pestañas (${poblacion.renderSettingsView.avisos.join(' | ')}).`);

  const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
  const cabeza = '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC)
    + `<style>#${SEMBRADO.id}{display:block;box-sizing:border-box;width:120px;height:${SEMBRADO.alto}px;min-height:0;padding:0;border:0;margin:24px 0}</style></head><body>`;
  const srv = http.createServer((rq, res) => {
    const u = rq.url.split('?')[0];
    const m = /^\/__e\/(\d+)$/.exec(u);
    if (m && paginas[+m[1]]) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(cabeza + paginas[+m[1]].html + `<button id="${SEMBRADO.id}">·</button></body></html>`);
    }
    const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
    if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(d));
  });
  const puerto = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
  const nav = await lanzarNavegador(puppeteer, {});
  const cortos = [];
  const sinMedir = [];
  const vistos = [];
  let medidos = 0;
  try {
    for (const ancho of ANCHOS) {
      for (const [i, p] of paginas.entries()) {
        const page = await nav.newPage();
        await page.setViewport({ width: ancho, height: 900 });
        await page.goto(`http://127.0.0.1:${puerto}/__e/${i}`, { waitUntil: 'load' });
        const f = await esperarFuentes(page);
        const ceguera = cegueraDeLaFuente(f, `${p.fn} ${p.estado} @${ancho}px`);
        assert.equal(ceguera, null, ceguera);
        await page.evaluate(FUENTE_MEDIDOR);
        const m = await page.evaluate(`${MEDIR}(${JSON.stringify(INTERACTIVOS)}, ${JSON.stringify(ANCLAS.map((a) => a.ancla).join(', '))}, ${JSON.stringify(SEMBRADO.id)})`);
        await page.close();
        // CIEGO: el medidor sabe decir que no (el sembrado de 30 px sale corto).
        assert.ok(!m.sembrado.error && m.sembrado.tocable < MINIMO_TACTIL && Math.abs(m.sembrado.tocable - SEMBRADO.alto) <= 2,
          `🔴 CIEGO: el botón sembrado de ${SEMBRADO.alto} px no sale corto @${ancho}px: ${JSON.stringify(m.sembrado)}`);
        for (const e of m.out) {
          medidos += 1;
          const fila = { ancho, fn: p.fn, estado: p.estado, ...e };
          vistos.push(fila);
          if (e.error) sinMedir.push(fila);
          else if (e.tocable < MINIMO_TACTIL) cortos.push(fila);
        }
      }
    }
  } finally {
    await nav.close();
    srv.close();
  }
  const linea = (e) => `@${e.ancho} · ${e.fn} · ${e.estado} · ${e.tag}${e.tipo ? `[${e.tipo}]` : ''}${e.id ? '#' + e.id : ''}.${clases(e.cls).join('.')} «${e.txt}» · padre «${e.padre}» · dentro ${e.dentro} · caja ${e.caja} · toque ${e.tocable ?? e.error}`;

  // CIEGO: lo que no se pudo medir no es un verde.
  assert.equal(sinMedir.length, 0, `🔴 CIEGO: ${sinMedir.length} interactivos pintados sin medida:\n${sinMedir.map(linea).join('\n')}`);
  // CONTROL de población: los 17 del censo aparecen pintados, a cada anchura.
  for (const o of OBJETIVOS) {
    for (const ancho of ANCHOS) {
      const n = new Set(vistos.filter((e) => e.fn === o.fn && e.ancho === ancho && o.casa(e)).map((e) => `${e.tag}|${e.id}|${e.cls}|${e.txt}`)).size;
      assert.ok(n >= (o.cuantos || 1), `🔴 CIEGO: ${o.nombre} (${o.fn}) aparece ${n} veces @${ancho}px; el censo dio ${o.cuantos || 1}. Medidos ${medidos}.`);
    }
  }
  // CONTROL: los exentos siguen pintados, son `.btn-sm` no primarios y siguen en ~30 px.
  for (const x of EXENTOS) {
    assert.ok(clases(x.clases).includes('btn-sm') && !clases(x.clases).includes('btn-primary'), `🔴 «${x.txt}» no cumple la regla de c.22728 para quedar exento.`);
    const suyos = vistos.filter((e) => exentoDe(e) === x);
    assert.ok(suyos.length >= ANCHOS.length, `🔴 CIEGO: el exento «${x.txt}» no aparece a cada anchura (${suyos.length}).`);
    for (const e of suyos) assert.ok(e.tocable < 36, `🔴 CONTROL: el exento «${x.txt}» mide ${e.tocable} px: la regla se ha salido de su sitio. ${linea(e)}`);
  }
  // PENDIENTES (c.22742): cada una pintada UNA vez por anchura y todavía CORTA. Si ya llega a 44, sobra en
  // la lista: se quita de PENDIENTES y pasa a exigirse como las demás.
  for (const p of PENDIENTES) {
    for (const ancho of ANCHOS) {
      const suyas = vistos.filter((e) => e.ancho === ancho && pendienteDe(e) === p);
      assert.equal(suyas.length, 1, `🔴 CIEGO: la casilla pendiente #${p.id} aparece ${suyas.length} veces @${ancho}px; se esperaba 1.`);
      assert.ok(suyas[0].tocable < MINIMO_TACTIL,
        `🔴 la casilla #${p.id} ya da ${suyas[0].tocable} px @${ancho}px y sigue en PENDIENTES («${p.motivo}»): sobra en la lista; quítala y que se exija a ${MINIMO_TACTIL}. ${linea(suyas[0])}`);
    }
  }
  const cortosPendientes = cortos.filter(pendienteDe);
  assert.equal(cortosPendientes.length, PENDIENTES.length * ANCHOS.length,
    `🔴 cortos declarados PENDIENTES: ${cortosPendientes.length}; la lista dice ${PENDIENTES.length} casillas × ${ANCHOS.length} anchuras = ${PENDIENTES.length * ANCHOS.length}.`);
  // La población y el toque MÍNIMO de cada objetivo, por anchura: lo que el registro copia como «después».
  t.diagnostic(`medidas ${medidos} · estados ${paginas.length} · anchuras ${ANCHOS.join('/')} · cortos ${cortos.length} (exentos ${cortos.filter(exentoDe).length} · pendientes ${cortosPendientes.length})`);
  for (const o of OBJETIVOS) {
    t.diagnostic(`${o.nombre}: ` + ANCHOS.map((a) => `@${a} ${Math.min(...vistos.filter((e) => e.fn === o.fn && e.ancho === a && o.casa(e)).map((e) => e.tocable))}`).join(' · '));
  }
  // EL TICKET: nada por debajo de 44 salvo los exentos y las pendientes.
  const malos = cortos.filter((e) => !exentoDe(e) && !pendienteDe(e));
  assert.equal(malos.length, 0,
    `🔴 ${malos.length} objetivos por debajo de ${MINIMO_TACTIL} px (AB6) sobre ${medidos} medidas en ${paginas.length} estados × ${ANCHOS.length} anchuras:\n${malos.map(linea).join('\n')}`);
});

// ── ② el ancla ──────────────────────────────────────────────────────────────────────────────
// El quitacomentarios es el de la casa (SCRUM-700: `ejecutableDe`). En CSS `#` es un selector, no
// un comentario. Y toma `//` por comentario también en CSS: por eso se cuentan las llaves (1843b).
const sinComentarios = (s) => ejecutableDe(s,
  { ancla: '.settings-panel ', donde: 'styles.css (bloque J3 de SCRUM-1848)', almohadillaEsComentario: false });
function bloque1848(hoja) {
  const ini = hoja.indexOf('/* J3: SCRUM-1848');
  const fin = hoja.indexOf('/* J3: fin del bloque SCRUM-1848 */');
  if (ini < 0 || fin < ini || hoja.indexOf('/* J3: SCRUM-1848', ini + 1) >= 0) return null;
  return hoja.slice(ini, fin);
}

test('SCRUM-1848 ② · cada regla del bloque cuelga de un contenedor de Ajustes o de Planes, y cada ancla la escribe sólo su vista', () => {
  const bloque = bloque1848(fs.readFileSync(HOJA, 'utf8'));
  assert.ok(bloque, '🔴 `styles.css` no tiene UN bloque «/* J3: SCRUM-1848 … */» con su cierre.');
  const codigo = sinComentarios(bloque);
  const reglas = [...codigo.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  assert.ok(reglas.length >= 1, '🔴 CIEGO: el bloque J3 de SCRUM-1848 no tiene ninguna regla.');
  const llaves = (c) => (codigo.match(c === '{' ? /\{/g : /\}/g) || []).length;
  assert.ok(llaves('{') === reglas.length && llaves('}') === reglas.length,
    `🔴 CIEGO: tras quitar comentarios hay ${llaves('{')} «{» y ${llaves('}')} «}» para ${reglas.length} reglas: el troceo no es fiable.`);
  for (const [, sel] of reglas) {
    for (const s of sel.split(',').map((x) => x.trim())) {
      assert.ok(ANCLAS.some((a) => s.startsWith(a.ancla + ' ')), `🔴 «${s}» no cuelga de ningún contenedor de Ajustes ni de Planes.`);
    }
  }
  // Quién escribe cada ancla en el marcado: todo .js y .html de public/. El NOMBRE, no un prefijo (A10).
  let mirados = 0;
  const textos = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (/\.(js|html)$/.test(e.name)) { mirados += 1; textos.push([path.relative(RAIZ, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8')]); }
    }
  };
  andar(PUBLIC);
  assert.ok(mirados > 50, `🔴 CIEGO: sólo ${mirados} ficheros .js/.html en public/.`);
  for (const v of ANCLAS) {
    const nombre = v.ancla.slice(1);
    const token = new RegExp(`(?<![\\w-])${nombre}(?![\\w-])`);
    const escritores = textos.filter(([, t]) => token.test(t)).map(([r]) => r);
    assert.deepEqual(escritores, [v.fichero],
      `🔴 el ancla \`${v.ancla}\` la escriben ${JSON.stringify(escritores)} (sobre ${mirados} ficheros): la regla alcanzaría otra pantalla, o la vista la ha perdido.`);
  }
});

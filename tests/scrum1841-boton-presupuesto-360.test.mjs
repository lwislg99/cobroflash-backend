// tests/scrum1841-boton-presupuesto-360.test.mjs — SCRUM-1841
//
// QUÉ VIGILA: en la ficha 360 del cliente (`renderCustomer360View`), CADA interactivo de la cabecera
// de acciones (`.c360-cabecera-acciones`: «✎ Editar», «🔗 Portal», «📇 Guardar en mis contactos»,
// «Fusionar» si el rol es admin y «+ Nuevo presupuesto») da un área de TOQUE de al menos
// `MINIMO_TACTIL` (AB6) a 390 y a 1280 px, medida en un navegador real.
//
// DE DÓNDE NACE: SCRUM-1841. «+ Nuevo presupuesto» (`#btn-new-quote-360`, `btn-primary btn-sm`) medía
// 30,7–31,0 px de toque, y sus hermanos `btn-secondary btn-sm` lo mismo: `.btn-sm` los deja en 30 px.
// La cura es la de SCRUM-1148 (`.plantillas-cabecera > .btn-sm`): una regla ACOTADA A SU CONTENEDOR,
// `.c360-cabecera-acciones > .btn-sm { min-height: 44px; }`, y `.btn-sm` global no se toca.
//
// CÓMO MIDE, SIN MEDIDOR PROPIO: la página es la que sirve `censo:tactil-panel` —la vista montada por
// el banco con los datos de `datosDelCenso()` y los argumentos de `ARGUMENTOS_DEL_CENSO`, serializada
// con `paginaDeVista` y con las hojas del índice (`enlacesDelPanel`)—, y el árbitro es
// `window.__areaDeToque` de `FUENTE_MEDIDOR`, el mismo del guard y del censo.
//
// LOS TRES CASOS:
//   a) SUELO: el contenedor existe, lleva `#btn-new-quote-360` y al menos tres interactivos, la fuente
//      de la app cargó y el árbitro alcanza al menos a uno de ellos y al control. Si no, el test está
//      CIEGO y lo dice. Un botón al que el árbitro NO alcanza no es ceguera: es un toque de 0 px, y
//      sale en b) con su motivo.
//   b) 🔴 cada interactivo del contenedor llega a `MINIMO_TACTIL`, a 390 y a 1280.
//   c) CONTROL: en la MISMA página se QUITA la regla de la hoja (CSSOM, `deleteRule`). Un `.btn-sm` de
//      la misma vista FUERA del contenedor («← Volver a Clientes») mide lo mismo con y sin ella, y la
//      caja de «+ Nuevo presupuesto» vuelve a quedar por debajo del mínimo.
//      ⚠️ Se quita la regla REAL y no se tapa con `addStyleTag(… { min-height: 0 !important })`: una
//      regla inyectada sólo prueba el selector que escribe el test, así que si la del árbol se
//      ensanchara (`.c360-cabecera-acciones > .btn-sm, .btn-ghost.btn-sm`) el control saldría igual en
//      los dos estados y no cazaría la fuga; y `min-height: 0` deja la caja en 24,5, no en los 30 de
//      `.btn-sm`, que es el «antes» de verdad.
//
// Sin navegador se SALTA con su motivo, como `scrum936d-variante-del-medidor`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolverNavegador, lanzarNavegador } from '../scripts/_navegador.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from '../scripts/_medidor-de-toque.mjs';
import { paginaDeVista } from '../scripts/_pagina-panel.mjs';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente, decirFuente } from '../scripts/_hojas-del-panel.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const VISTA = 'renderCustomer360View';
const ANCHOS = [390, 1280];
const CONTENEDOR = '.c360-cabecera-acciones';
const HEROE = '#btn-new-quote-360';
const MINIMO_EN_CONTENEDOR = 3;
// La regla de SCRUM-1841, tal como la serializa el navegador (`selectorText`).
const LA_REGLA = `${CONTENEDOR} > .btn-sm`;
// El control: un `.btn-sm` de la misma vista que no cuelga del contenedor. Se pinta siempre, antes de
// pedir nada al servidor (customerDetailView.js, `backBtn`), así que no depende de los datos de muestra.
const CONTROL_TEXTO = 'Volver a Clientes';

const navegador = resolverNavegador();

// La página como la arma el censo (`pagina` de censo-objetivo-tactil-panel.mjs): hojas del índice y el
// HTML serializado de la vista, sin envoltorio.
const HOJAS = enlacesDelPanel(PUBLIC);
const pagina = (cuerpo) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>' + cuerpo + '</body></html>';

// Las dos funciones de abajo corren EN LA PÁGINA. Van escritas DENTRO de `page.evaluate`, y no como
// funciones sueltas pasadas por nombre: así `window` y `document` son del navegador también para el
// analizador de SCRUM-258, que sólo reconoce el callback directo de `evaluate`.
//
// Mide el contenedor, el héroe y el control, con `__areaDeToque` ya instalado.
const medirEnLaPagina = (page) => page.evaluate(async (SEL, CONT, HEROE_SEL, CONTROL) => {
  const ficha = async (el) => {
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    // Si el árbitro no lo alcanza, se dice si su centro queda FUERA de la ventana (recortado por
    // `overflow-x: clip` de `html, body`): eso no es ceguera del detector, es un botón que no se ve.
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    return {
      id: el.id ? '#' + el.id : '(sin id)',
      texto: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) || '(sin texto)',
      caja: m.caja ?? +r.height.toFixed(1),
      tocable: m.tocable ?? null,
      error: m.error || null,
      fuera: cx < 0 || cx > document.documentElement.clientWidth,
      x: Math.round(r.left),
    };
  };
  const cont = document.querySelector(CONT);
  const enContenedor = [];
  if (cont) for (const el of cont.querySelectorAll(SEL)) enContenedor.push(await ficha(el));
  const heroe = cont ? cont.querySelector(HEROE_SEL) : null;
  const ctl = [...document.querySelectorAll('.btn-sm')]
    .find((b) => !b.closest(CONT) && (b.textContent || '').includes(CONTROL));
  return {
    hayContenedor: !!cont,
    heroeDentro: !!heroe,
    enContenedor,
    heroe: heroe ? await ficha(heroe) : null,
    control: ctl ? await ficha(ctl) : null,
    ancho: document.documentElement.clientWidth,
  };
}, INTERACTIVOS, CONTENEDOR, HEROE, CONTROL_TEXTO);

// Borra de las hojas cada regla cuyo selector incluye `SELECTOR` (también dentro de `@media`), y
// devuelve cuántas quitó y cuántas hojas no se dejaron leer.
const quitarLaRegla = (page) => page.evaluate((SELECTOR) => {
  let quitadas = 0;
  let ilegibles = 0;
  const recorrer = (lista) => {
    for (let i = lista.cssRules.length - 1; i >= 0; i--) {
      const r = lista.cssRules[i];
      if (r.selectorText) {
        if (r.selectorText.split(',').map((s) => s.trim()).includes(SELECTOR)) { lista.deleteRule(i); quitadas += 1; }
      } else if (r.cssRules) {
        recorrer(r);
      }
    }
  };
  for (const h of document.styleSheets) {
    try { recorrer(h); } catch { ilegibles += 1; }
  }
  return { quitadas, ilegibles };
}, LA_REGLA);

const linea = (m) => `${m.id} «${m.texto}» caja ${m.caja} · toque ${m.tocable}`
  + (m.error ? ` · NO ALCANZA: ${m.error}${m.fuera ? ` (su centro cae FUERA de la ventana, x=${m.x}: recortado)` : ''}` : '');

test('SCRUM-1841 · la cabecera de acciones de la ficha 360 llega a 44 px de toque, con la regla acotada a su contenedor',
  { skip: !navegador.ok && `sin navegador donde mirar (resolverNavegador): ${navegador.motivo}` }, async (t) => {
    const DC = datosDelCenso();
    DC.enVista(VISTA);
    const montada = await paginaDeVista(RAIZ, VISTA, { datos: DC.datos, args: ARGUMENTOS_DEL_CENSO[VISTA] || [] });
    assert.ok(montada.html, `🔴 CIEGO: la ficha 360 no se monta como la monta el censo: ${montada.aviso}`);
    const HTML = pagina(montada.html);

    const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
    const srv = http.createServer((rq, res) => {
      const u = rq.url.split('?')[0];
      if (u === '/__c360') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(HTML); }
      const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
      if (!d.startsWith(PUBLIC) || !fs.existsSync(d) || fs.statSync(d).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(d));
    });
    const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

    const nav = await lanzarNavegador(puppeteer, {});
    const porAncho = new Map();
    try {
      for (const ancho of ANCHOS) {
        const page = await nav.newPage();
        await page.setViewport({ width: ancho, height: 900 });
        await page.goto(`http://127.0.0.1:${PUERTO}/__c360`, { waitUntil: 'load' });
        const fuente = await esperarFuentes(page);
        await page.evaluate(FUENTE_MEDIDOR);
        const conRegla = await medirEnLaPagina(page);
        const quitar = await quitarLaRegla(page);
        const sinRegla = await medirEnLaPagina(page);
        porAncho.set(ancho, { fuente, conRegla, quitar, sinRegla });
        await page.close();
      }
    } finally {
      await nav.close();
      srv.close();
    }

    await t.test('a) SUELO · el contenedor está, con «+ Nuevo presupuesto» y al menos tres interactivos, medido con la fuente de la app', () => {
      for (const ancho of ANCHOS) {
        const { fuente, conRegla: r } = porAncho.get(ancho);
        const donde = `${VISTA} @${ancho}px`;
        const ceguera = cegueraDeLaFuente(fuente, donde);
        assert.equal(ceguera, null, `🔴 CIEGO: ${ceguera} (${decirFuente(fuente)})`);
        assert.ok(r.hayContenedor, `🔴 CIEGO · ${donde}: no hay \`${CONTENEDOR}\` en la página servida; el test no mide nada.`);
        assert.ok(r.heroeDentro, `🔴 CIEGO · ${donde}: \`${HEROE}\` no está dentro de \`${CONTENEDOR}\`; el test no mide el botón de SCRUM-1841.`);
        assert.ok(r.enContenedor.length >= MINIMO_EN_CONTENEDOR,
          `🔴 CIEGO · ${donde}: ${r.enContenedor.length} interactivos en \`${CONTENEDOR}\` y se esperan al menos ${MINIMO_EN_CONTENEDOR}: ${r.enContenedor.map(linea).join(' | ')}`);
        // CONTROL POSITIVO del árbitro en ESTA página: si no alcanza a ninguno, no sabe medir aquí.
        const alcanzados = r.enContenedor.filter((m) => typeof m.tocable === 'number');
        assert.ok(alcanzados.length >= 1, `🔴 CIEGO · ${donde}: el árbitro no alcanza a ninguno de los ${r.enContenedor.length}: ${r.enContenedor.map(linea).join(' | ')}`);
        assert.ok(r.control && typeof r.control.tocable === 'number',
          `🔴 CIEGO · ${donde}: no encuentro o no alcanzo el \`.btn-sm\` «${CONTROL_TEXTO}» fuera de \`${CONTENEDOR}\`: ${r.control ? linea(r.control) : 'no está'}`);
      }
    });

    await t.test(`b) cada interactivo de la cabecera da al menos ${MINIMO_TACTIL} px de toque a ${ANCHOS.join(' y a ')} px`, () => {
      const cortos = [];
      let medidos = 0;
      for (const ancho of ANCHOS) {
        const { conRegla: r } = porAncho.get(ancho);
        for (const m of r.enContenedor) {
          medidos += 1;
          if (!(typeof m.tocable === 'number' && m.tocable >= MINIMO_TACTIL)) cortos.push(`@${ancho}px ${linea(m)}`);
        }
      }
      assert.ok(medidos >= MINIMO_EN_CONTENEDOR * ANCHOS.length, `🔴 CIEGO: sólo ${medidos} mediciones (ver el caso a).`);
      assert.equal(cortos.length, 0,
        `🔴 ${cortos.length} de ${medidos} mediciones por debajo de ${MINIMO_TACTIL} px en \`${CONTENEDOR}\`:\n   ${cortos.join('\n   ')}`);
    });

    await t.test('c) CONTROL · sin la regla, «← Volver a Clientes» (fuera del contenedor) mide igual y la caja de «+ Nuevo presupuesto» vuelve a ser corta', () => {
      for (const ancho of ANCHOS) {
        const { conRegla, quitar, sinRegla } = porAncho.get(ancho);
        const donde = `${VISTA} @${ancho}px`;
        assert.equal(quitar.quitadas, 1,
          `🔴 ${donde}: se esperaba UNA regla \`${LA_REGLA}\` en las hojas del panel y se han quitado ${quitar.quitadas} (hojas ilegibles: ${quitar.ilegibles}).`);
        assert.ok(conRegla.control && sinRegla.control,
          `🔴 CIEGO · ${donde}: no encuentro el \`.btn-sm\` «${CONTROL_TEXTO}» fuera de \`${CONTENEDOR}\`; sin él no hay control.`);
        assert.deepEqual([sinRegla.control.caja, sinRegla.control.tocable], [conRegla.control.caja, conRegla.control.tocable],
          `🔴 ${donde}: el control fuera del contenedor CAMBIA al quitar la regla (con: ${linea(conRegla.control)} · sin: ${linea(sinRegla.control)}); la regla se escapa de \`${CONTENEDOR}\`.`);
        assert.ok(conRegla.heroe && sinRegla.heroe, `🔴 CIEGO · ${donde}: \`${HEROE}\` no está en alguno de los dos estados.`);
        // La CAJA y no el toque: así el control no depende de que el árbitro lo alcance.
        assert.ok(conRegla.heroe.caja >= MINIMO_TACTIL && sinRegla.heroe.caja < MINIMO_TACTIL,
          `🔴 ${donde}: la caja de \`${HEROE}\` es ${conRegla.heroe.caja} con la regla y ${sinRegla.heroe.caja} sin ella; se esperaba ≥ ${MINIMO_TACTIL} y < ${MINIMO_TACTIL}: la que lo sube no es esta regla.`);
      }
    });
  });

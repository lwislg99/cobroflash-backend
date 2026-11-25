// tests/scrum1850-ficha-360-resto-44.test.mjs — SCRUM-1850
//
// QUÉ VIGILA: en la ficha 360 del cliente (`renderCustomer360View`), CADA interactivo visible da un
// área de TOQUE de al menos `MINIMO_TACTIL` (AB6) a 390, 929 y 1280 px, medida en un navegador real,
// salvo los `.btn-sm` que NO son la acción primaria de la pantalla, que se quedan en su tamaño.
//
// DE DÓNDE NACE: SCRUM-1850, la lista J del censo de SCRUM-1845 después de SCRUM-1841. Quedaban 12
// cortos a 929 y 1280 (8 a 390): las 6 pestañas del historial (`.c360-pestanas`, 39), los 3
// `.contacto-link` de la cabecera (37 por encima de 768), el campo de etiquetas (`#c360-meta .input`,
// 38,9 por encima de 768) y 2 `.btn-ghost.btn-sm`. Y «Cómo llegar» (`#c360-como-llegar`, también
// `.contacto-link`), que el censo no ve porque su cliente de muestra no lleva dirección: aquí se le
// pone una para que se mida.
//
// LA REGLA DE `.btn-sm` (SCRUM-1845 c.22728, decisión del fundador): DESIGN.md la deja en 30 px a
// propósito; un `.btn-sm` que no es la acción primaria de su pantalla SE QUEDA, y todo lo demás por
// debajo de 44 se cura. Los dos de esta pantalla son navegación y acción de fila: «← Volver a
// Clientes» y «Ver →». La primaria es «+ Nuevo presupuesto» (`btn-primary`), que curó SCRUM-1841.
//
// LOS CUATRO CASOS:
//   a) SUELO: la vista se monta con la fuente de la app, y están las pestañas, los enlaces de contacto,
//      «Cómo llegar», el campo de etiquetas y los dos exentos; el árbitro alcanza a todos. Si no, CIEGO.
//   b) 🔴 cada interactivo que no es exento llega a `MINIMO_TACTIL` en las tres anchuras.
//   c) los exentos siguen siendo `.btn-sm` no primarios y siguen por debajo de 44: la regla de
//      c.22728 se cumple, y la cura no se ha escapado a `.btn-sm`.
//   d) CONTROL: en la MISMA página se QUITAN de la hoja las reglas del bloque de SCRUM-1850 (CSSOM,
//      `deleteRule`, solo fuera de `@media`): las pestañas vuelven a quedar cortas en las tres
//      anchuras, y los enlaces y el campo en las de escritorio; los exentos miden lo mismo.
//      ⚠️ Se quita la regla REAL y no se tapa con una inyectada (lo mismo que SCRUM-1841): una regla
//      inyectada sólo prueba el selector que escribe el test.
//
// Sin navegador se SALTA con su motivo, como `scrum1841-boton-presupuesto-360`.
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
const ANCHOS = [390, 929, 1280];
// Por encima de este ancho no manda el `@media (max-width: 768px)` que ya daba 44 a enlaces y campo.
const CORTE_MOVIL = 768;
// Los `.btn-sm` que se quedan (c.22728): ni son `btn-primary` ni son la acción primaria de la ficha.
const EXENTOS = ['← Volver a Clientes', 'Ver →'];
const MINIMO_PESTANAS = 4;      // Presupuestos, Facturas, Trabajos y Sitios se pintan para cualquier rol
const MINIMO_CONTACTO = 3;      // teléfono, WhatsApp y correo del cliente de muestra
// Las reglas del bloque de SCRUM-1850, tal como las serializa el navegador (`selectorText`).
const LAS_REGLAS = ['.c360-pestanas > button', '.c360-datos .contacto-link', '#c360-meta .contacto-link', '#c360-meta .input'];
const REGLAS_DEL_BLOQUE = 3;    // pestañas · enlaces (dos selectores en una regla) · campo

const navegador = resolverNavegador();

const HOJAS = enlacesDelPanel(PUBLIC);
const pagina = (cuerpo) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>' + cuerpo + '</body></html>';

// Corre EN LA PÁGINA, escrito dentro de `page.evaluate` (analizador de SCRUM-258).
const medirEnLaPagina = (page) => page.evaluate(async (SEL) => {
  const filas = [];
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    filas.push({
      etiqueta: el.tagName + (el.classList.length ? '.' + [...el.classList].join('.') : '') + (el.id ? '#' + el.id : ''),
      texto: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) || '(sin texto)',
      btnSm: el.classList.contains('btn-sm'),
      primaria: el.classList.contains('btn-primary'),
      zona: el.closest('.c360-pestanas') ? 'pestanas' : el.closest('.c360-datos') ? 'datos'
        : el.closest('#c360-meta') ? 'meta' : el.closest('.c360-cabecera-acciones') ? 'cabecera' : 'resto',
      caja: m.caja ?? +r.height.toFixed(1),
      tocable: m.tocable ?? null,
      error: m.error || null,
    });
  }
  return filas;
}, INTERACTIVOS);

// Borra de las hojas cada regla de FUERA de `@media` cuyo selector incluye alguno de `SELECTORES`.
// Las de dentro se quedan: `#c360-meta .input` también vive en el `@media` de SCRUM-1592.
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

const linea = (m) => `${m.etiqueta} «${m.texto}» caja ${m.caja} · toque ${m.tocable}` + (m.error ? ` · NO ALCANZA: ${m.error}` : '');
const esExento = (m) => m.btnSm && !m.primaria && EXENTOS.includes(m.texto);
const cumple = (m) => typeof m.tocable === 'number' && m.tocable >= MINIMO_TACTIL;

test('SCRUM-1850 · la ficha 360 llega a 44 px de toque en todo lo que no es un `.btn-sm` no primario (c.22728)',
  { skip: !navegador.ok && `sin navegador donde mirar (resolverNavegador): ${navegador.motivo}` }, async (t) => {
    const DC = datosDelCenso();
    DC.enVista(VISTA);
    // El cliente de muestra, con una dirección: sin ella «Cómo llegar» no se pinta y no se mide.
    const datos = (url) => {
      const v = DC.datos(url);
      if (v && v.customer && /\/admin\/customers\/\d+\/detail(\?|$)/.test(url)) v.customer.billingAddress = 'Calle Mayor 1';
      return v;
    };
    const montada = await paginaDeVista(RAIZ, VISTA, { datos, args: ARGUMENTOS_DEL_CENSO[VISTA] || [] });
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
        const conReglas = await medirEnLaPagina(page);
        const quitar = await quitarLasReglas(page);
        const sinReglas = await medirEnLaPagina(page);
        porAncho.set(ancho, { fuente, conReglas, quitar, sinReglas });
        await page.close();
      }
    } finally {
      await nav.close();
      srv.close();
    }

    await t.test('a) SUELO · la vista se mide con la fuente de la app, y están las pestañas, los enlaces, «Cómo llegar», el campo y los dos exentos', () => {
      for (const ancho of ANCHOS) {
        const { fuente, conReglas: f } = porAncho.get(ancho);
        const donde = `${VISTA} @${ancho}px`;
        const ceguera = cegueraDeLaFuente(fuente, donde);
        assert.equal(ceguera, null, `🔴 CIEGO: ${ceguera} (${decirFuente(fuente)})`);
        const de = (zona) => f.filter((m) => m.zona === zona);
        assert.ok(de('pestanas').length >= MINIMO_PESTANAS,
          `🔴 CIEGO · ${donde}: ${de('pestanas').length} pestañas en \`.c360-pestanas\`, se esperan al menos ${MINIMO_PESTANAS}.`);
        assert.ok(de('datos').filter((m) => /contacto-link/.test(m.etiqueta)).length >= MINIMO_CONTACTO,
          `🔴 CIEGO · ${donde}: menos de ${MINIMO_CONTACTO} \`.contacto-link\` en \`.c360-datos\`: ${de('datos').map(linea).join(' | ')}`);
        assert.ok(f.some((m) => /#c360-como-llegar/.test(m.etiqueta)), `🔴 CIEGO · ${donde}: no se pinta «Cómo llegar»; la dirección de muestra no llegó.`);
        assert.ok(de('meta').some((m) => /^INPUT\.input/.test(m.etiqueta)), `🔴 CIEGO · ${donde}: no está el campo de etiquetas en \`#c360-meta\`.`);
        for (const texto of EXENTOS) {
          assert.ok(f.some((m) => m.texto === texto), `🔴 CIEGO · ${donde}: no encuentro «${texto}»; sin él no se comprueba la regla de c.22728.`);
        }
        const sinAlcanzar = f.filter((m) => typeof m.tocable !== 'number');
        assert.equal(sinAlcanzar.length, 0, `🔴 CIEGO · ${donde}: el árbitro no alcanza a ${sinAlcanzar.length} de ${f.length}: ${sinAlcanzar.map(linea).join(' | ')}`);
      }
    });

    await t.test(`b) cada interactivo que no es un \`.btn-sm\` no primario da al menos ${MINIMO_TACTIL} px de toque a ${ANCHOS.join(', ')} px`, () => {
      const cortos = [];
      let medidos = 0;
      for (const ancho of ANCHOS) {
        for (const m of porAncho.get(ancho).conReglas) {
          if (esExento(m)) continue;
          medidos += 1;
          if (!cumple(m)) cortos.push(`@${ancho}px ${linea(m)}`);
        }
      }
      assert.ok(medidos >= (MINIMO_PESTANAS + MINIMO_CONTACTO + 2) * ANCHOS.length, `🔴 CIEGO: sólo ${medidos} mediciones (ver el caso a).`);
      assert.equal(cortos.length, 0, `🔴 ${cortos.length} de ${medidos} mediciones por debajo de ${MINIMO_TACTIL} px en la ficha 360:\n   ${cortos.join('\n   ')}`);
    });

    await t.test('c) los exentos de c.22728 siguen siendo `.btn-sm` no primarios y siguen por debajo de 44: la cura no toca `.btn-sm`', () => {
      for (const ancho of ANCHOS) {
        const exentos = porAncho.get(ancho).conReglas.filter(esExento);
        assert.ok(exentos.length >= EXENTOS.length, `🔴 CIEGO · @${ancho}px: ${exentos.length} exentos medidos, se esperan ${EXENTOS.length}.`);
        for (const m of exentos) {
          assert.ok(m.caja < MINIMO_TACTIL, `🔴 @${ancho}px: ${linea(m)} ya no es un \`.btn-sm\` de 30: algo de la cura se ha escapado a \`.btn-sm\`.`);
        }
      }
    });

    await t.test('d) CONTROL · sin las reglas del bloque, pestañas, enlaces y campo vuelven a ser cortos, y los exentos miden lo mismo', () => {
      for (const ancho of ANCHOS) {
        const { conReglas, quitar, sinReglas } = porAncho.get(ancho);
        const donde = `${VISTA} @${ancho}px`;
        assert.equal(quitar.quitadas, REGLAS_DEL_BLOQUE,
          `🔴 ${donde}: se esperaban ${REGLAS_DEL_BLOQUE} reglas del bloque de SCRUM-1850 fuera de \`@media\` y se han quitado ${quitar.quitadas} (hojas ilegibles: ${quitar.ilegibles}).`);
        const vuelven = sinReglas.filter((m) => m.zona === 'pestanas' || (ancho > CORTE_MOVIL && (m.zona === 'datos' || m.zona === 'meta')));
        assert.ok(vuelven.length >= MINIMO_PESTANAS, `🔴 CIEGO · ${donde}: sin las reglas no encuentro qué medir (${vuelven.length}).`);
        const siguen = vuelven.filter((m) => m.caja >= MINIMO_TACTIL);
        assert.equal(siguen.length, 0, `🔴 ${donde}: sin las reglas del bloque siguen a ${MINIMO_TACTIL} o más: ${siguen.map(linea).join(' | ')}. La que los sube no es esta regla.`);
        const ex = (f) => f.filter(esExento).map((m) => `${m.texto}:${m.caja}:${m.tocable}`);
        assert.deepEqual(ex(sinReglas), ex(conReglas), `🔴 ${donde}: los exentos CAMBIAN al quitar las reglas; el bloque se escapa de sus contenedores.`);
      }
    });
  });

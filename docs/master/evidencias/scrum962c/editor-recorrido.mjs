// Sólo lectura (SCRUM-962c). Editor de presupuestos VIVO (scripts/_banco-lista.mjs), RECORRIDO como el
// profesional: cada estado se alcanza pulsando lo que la pantalla ofrece (clics de ratón reales), y en cada
// estado se miden los controles pintados con el árbitro del censo. Al final, para cada corto, la prueba de la
// ETIQUETA (clic real en la etiqueta, lejos del control: ¿cambia el estado?) y la clasificación.
// Uso: node editor-recorrido.mjs <raiz> <salida.json> [--listar]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const RAIZ = path.resolve(process.argv[2]);
const SALIDA = process.argv[3];
const LISTAR = process.argv.includes('--listar');
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const { FUENTE_MEDIDOR, INTERACTIVOS } = await imp('scripts/_medidor-de-toque.mjs');
const AMPLIADO = INTERACTIVOS + ', select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]), [role="tab"], [role="switch"], [role="radio"], [role="menuitem"]';
const DATOS = `(ruta) => {
  if (/\\/admin\\/merchant$/.test(ruta)) return { id: 1, name: 'Fontanería Soler', country: 'ES', currency: 'EUR', slug: 'fontaneria-soler' };
  if (/\\/admin\\/customers/.test(ruta)) return [{ id: 1, name: 'Ana López', phone: '34000000001', email: 'ana@example.com', dtoPorDefecto: 10, payMethodsPorDefecto: ['bizum'] }, { id: 2, name: 'Fincas Soler SL', phone: '34000000002' }];
  if (/\\/admin\\/templates/.test(ruta)) return [1, 2, 3, 4, 5].map((i) => ({ id: i, name: 'Plantilla ' + i, lines: [{ concept: 'Revisión anual', quantity: 1, unitPrice: 60 }], paymentTerms: null }));
  if (/frequent-concepts/.test(ruta)) return { ok: true, items: [{ concepto: 'Desatasco', usos: 6 }, { concepto: 'Cambio de grifo', usos: 4 }, { concepto: 'Revisión de caldera', usos: 3 }] };
  if (/\\/admin\\/products/.test(ruta)) return [{ id: 1, name: 'Mano de obra', price: 35, unit: 'h', active: true, kind: 'service' }];
  return [];
}`;

// Identidad estable de un control entre estados: tipo + id + clase + texto + su posición entre los iguales.
const PAGINA = `
window.__S = ${JSON.stringify(AMPLIADO)};
window.__CENSO = ${JSON.stringify(INTERACTIVOS)};
window.__cont = () => document.body;
window.__fuera = (e) => !!e.closest('.sidebar');
window.__pintado = (e) => { if (window.__fuera(e)) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
window.__txt = (e) => (e.tagName === 'SELECT' ? '' : (e.textContent || e.placeholder || e.getAttribute('aria-label') || '')).replace(/\\s+/g, ' ').trim().slice(0, 40);
window.__clave = (e) => {
  const base = e.tagName + '|' + (e.getAttribute('type') || '') + '|' + (e.id || '') + '|' + (typeof e.className === 'string' ? e.className.replace(/\\bis-[\\w-]+/g, '').trim() : '') + '|' + window.__txt(e);
  const iguales = [...window.__cont().querySelectorAll(window.__S)].filter((x) => (x.tagName + '|' + (x.getAttribute('type') || '') + '|' + (x.id || '') + '|' + (typeof x.className === 'string' ? x.className.replace(/\\bis-[\\w-]+/g, '').trim() : '') + '|' + window.__txt(x)) === base);
  return base + '#' + iguales.indexOf(e);
};
window.__rotulo = (e) => {
  let t = (e.labels && e.labels[0] && e.labels[0].textContent) || e.getAttribute('aria-label') || e.getAttribute('placeholder') || window.__txt(e) || '';
  t = t.replace(/\\s+/g, ' ').trim();
  if (!t) { const g = e.closest('.field, .form-group, label'); if (g) { const l = g.querySelector('label, .field-label'); if (l) t = l.textContent.replace(/\\s+/g, ' ').trim(); } }
  return (t || e.name || '(sin rótulo)').slice(0, 50);
};
window.__medir = async () => {
  const out = [];
  for (const e of window.__cont().querySelectorAll(window.__S)) {
    if (!window.__pintado(e)) continue;
    const m = await window.__areaDeToque(e, window.__S, { scroll: true });
    const r = e.getBoundingClientRect();
    out.push({ clave: window.__clave(e), tag: e.tagName.toLowerCase(), tipo: e.getAttribute('type') || '', cls: typeof e.className === 'string' ? e.className : '',
      rotulo: window.__rotulo(e), caja: +r.height.toFixed(1), tocable: m.tocable ?? null, error: m.error || null,
      enCenso: e.matches(window.__CENSO), display: getComputedStyle(e).display, readonly: e.readOnly === true,
      bloque: (e.closest('[class*="quote-block"], .quote-fila, .quote-line, .quote-hoja, [role="dialog"], .modal, .overflow-menu') || {}).className || '' });
  }
  return out;
};
window.__visiblesTxt = () => [...window.__cont().querySelectorAll(window.__S)].filter(window.__pintado).map((e) => e.tagName.toLowerCase() + (e.getAttribute('type') ? '[' + e.getAttribute('type') + ']' : '') + '«' + (window.__txt(e) || window.__rotulo(e)) + '»' + (e.disabled ? '(off)' : ''));
`;

const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/ed', fnVista: 'renderQuotesView', datos: DATOS, modoEmision: 'fiscal' }]);
const { browser } = await abrirNavegador(puppeteer);
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Pulsa (ratón real) el primer control PINTADO y HABILITADO que cumpla el filtro. Devuelve lo pulsado o null.
async function pulsar(page, filtroJs) {
  const h = await page.evaluateHandle(`(() => [...window.__cont().querySelectorAll(window.__S)].find((e) => window.__pintado(e) && !e.disabled && (${filtroJs})(e)) || null)()`);
  const el = h.asElement();
  if (!el) return null;
  const desc = await page.evaluate((e) => e.tagName.toLowerCase() + '«' + window.__txt(e) + '»', el);
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const b = await el.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await espera(200);
  return desc;
}
async function escribir(page, filtroJs, texto) {
  const h = await page.evaluateHandle(`(() => [...window.__cont().querySelectorAll(window.__S)].find((e) => window.__pintado(e) && (${filtroJs})(e)) || null)()`);
  const el = h.asElement();
  if (!el) return null;
  await el.click({ clickCount: 3 });
  await el.type(texto);
  await espera(150);
  return texto;
}
const txtEs = (t) => `(e) => window.__txt(e) === ${JSON.stringify(t)}`;
const txtEmpieza = (t) => `(e) => window.__txt(e).startsWith(${JSON.stringify(t)})`;

// El RECORRIDO: [nombre del estado, acción que lo alcanza desde el anterior]. Cada acción dice qué pulsó;
// si no encuentra lo que busca, el estado queda «NO ALCANZADO» y se dice — no se cuenta como cero.
// Cierra lo abierto con Escape y COMPRUEBA que se cerró (no queda overlay/menú/diálogo pintado).
async function cerrar(p) {
  await p.keyboard.press('Escape'); await espera(250);
  const abierto = await p.evaluate(`[...document.querySelectorAll('.modal-overlay, .overflow-menu, [role=dialog], .quote-hoja, .hoja-documento')].some(window.__pintado)`);
  if (abierto) { // segundo intento: el botón de cerrar visible del diálogo
    await pulsar(p, `(e) => /^(×|✕|Cerrar|Cancelar)$/.test(window.__txt(e)) && e.closest('.modal-overlay, [role=dialog], .quote-hoja, .hoja-documento')`);
    await espera(250);
  }
  const sigue = await p.evaluate(`[...document.querySelectorAll('.modal-overlay, .overflow-menu, [role=dialog], .quote-hoja, .hoja-documento')].some(window.__pintado)`);
  return sigue ? null : 'cerrado';
}
// Abre la fila n-ésima de Condiciones (sus botones llevan aria-expanded; se cuentan en orden del DOM).
const fila = (n) => async (p) => {
  const total = await p.evaluate(`[...document.querySelectorAll('.quote-paso__cambiar[aria-expanded]')].filter(window.__pintado).length`);
  if (n >= total) return null;
  const h = await p.evaluateHandle(`[...document.querySelectorAll('.quote-paso__cambiar[aria-expanded]')].filter(window.__pintado)[${n}]`);
  const el = h.asElement(); await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const b = await el.boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await espera(200);
  const nombre = await p.evaluate(`(() => { const e = [...document.querySelectorAll('.quote-paso__cambiar[aria-expanded]')].filter(window.__pintado)[${n}]; const f = e.closest('.quote-fila, .quote-ajustes, [class*=quote-block]'); return (f ? (f.querySelector('.quote-fila__rotulo, .quote-block-title, strong, h3') || f).textContent : '').replace(/\\s+/g, ' ').trim().slice(0, 30) + ' · ' + e.getAttribute('aria-expanded'); })()`);
  return `fila ${n + 1}/${total} «${nombre}»`;
};

const RECORRIDO = [
  ['1 · Cliente (montaje)', async () => 'montaje'],
  ['1 · menú ⋯ de la página', (p) => pulsar(p, `(e) => window.__txt(e) === '⋯' && !e.closest('.quote-line')`)],
  ['1 · (cerrado)', cerrar],
  ['1 · alta de cliente', (p) => pulsar(p, txtEs('+ Nuevo cliente'))],
  ['1 · (cerrado)', cerrar],
  ['1 · Ver documento', (p) => pulsar(p, txtEs('Ver documento'))],
  ['1 · (cerrado)', cerrar],
  ['1 · Cliente elegido', (p) => pulsar(p, txtEmpieza('Ana López'))],
  ['2 · Conceptos', (p) => pulsar(p, `(e) => window.__txt(e) === 'Continuar' && e.closest('.is-abierto')`)],
  ['2 · Conceptos con una línea', async (p) => {
    const a = await escribir(p, `(e) => e.placeholder && /Concepto/.test(e.placeholder)`, 'Cambio de grifo');
    const b = await escribir(p, `(e) => e.type === 'number' && e.closest('.quote-line')`, '1');
    const nums = await p.evaluate(`[...window.__cont().querySelectorAll('.quote-line input[type=number]')].filter(window.__pintado).length`);
    let c = null;
    if (nums > 1) {
      const h = await p.evaluateHandle(`[...window.__cont().querySelectorAll('.quote-line input[type=number]')].filter(window.__pintado)[1]`);
      await h.asElement().click({ clickCount: 3 }); await h.asElement().type('45'); await espera(150); c = '45';
    }
    return a && b ? `concepto + cantidad${c ? ' + precio' : ''}` : null;
  }],
  ['2 · menú ⋯ de la línea', (p) => pulsar(p, `(e) => window.__txt(e) === '⋯' && e.closest('.quote-line')`)],
  ['2 · (cerrado)', cerrar],
  ['2 · menú ⋯ de la línea, otra vez', (p) => pulsar(p, `(e) => window.__txt(e) === '⋯' && e.closest('.quote-line')`)],
  ['2 · ajustes de la línea (IVA)', (p) => pulsar(p, txtEmpieza('Ajustes (IVA'))],
  ['2 · (cerrado)', cerrar],
  ['2 · Usar plantilla', (p) => pulsar(p, txtEmpieza('📋'))],
  ['2 · (cerrado)', cerrar],
  ['2 · Sugerir con IA', (p) => pulsar(p, txtEmpieza('✨ Sugerir con IA'))],
  ['2 · (cerrado)', cerrar],
  ['2 · descuento global', (p) => pulsar(p, txtEmpieza('+ Añadir descuento'))],
  ['3 · Condiciones', (p) => pulsar(p, `(e) => window.__txt(e) === 'Continuar' && e.closest('.is-abierto')`)],
  ['3 · fila 1', fila(0)],
  ['3 · fila 2', fila(1)],
  ['3 · fila 3', fila(2)],
  ['3 · fila 4', fila(3)],
  ['3 · dirección de obra personalizada', async (p) => {
    // Elegir la opción en el <select> es lo que hace el profesional; page.select dispara `change` como el navegador.
    const h = await p.evaluateHandle(`[...document.querySelectorAll('select')].filter(window.__pintado).find((s) => [...s.options].some((o) => o.value === 'personalizada')) || null`);
    const el = h.asElement(); if (!el) return null;
    await el.select('personalizada'); await espera(250);
    return 'select → personalizada';
  }],
  ['3 · sitios guardados', (p) => pulsar(p, `(e) => /sitios-guardados__boton/.test(e.className)`)],
  ['3 · (cerrado)', cerrar],
  ['4 · Revisar',(p) => pulsar(p, `(e) => window.__txt(e) === 'Continuar' && e.closest('.is-abierto')`)],
  ['4 · menú ⋯ de la página', (p) => pulsar(p, `(e) => window.__txt(e) === '⋯' && !e.closest('.quote-line')`)],
  ['4 · (cerrado)', cerrar],
];

const resultados = [];
for (const ancho of [390, 929]) {
  const { page, errores } = await abrirVista(browser, puerto, '/ed', ancho, 4000);
  await page.evaluate(FUENTE_MEDIDOR);
  await page.evaluate(PAGINA);
  for (const [nombre, accion] of RECORRIDO) {
    let hecho;
    try { hecho = await accion(page); } catch (e) { hecho = null; console.log('   (error en la acción: ' + String(e.message).slice(0, 80) + ')'); }
    const medidos = hecho ? await page.evaluate('window.__medir()') : [];
    // LA PRUEBA DE LA ETIQUETA (de 962b): para cada corto con etiqueta asociada, área de la etiqueta con el
    // mismo árbitro y CLIC REAL en el punto de la etiqueta más alejado del control. ¿Cambia su estado?
    for (const m of medidos.filter((x) => x.tocable !== null && x.tocable < 44)) {
      const h = await page.evaluateHandle((clave) => [...window.__cont().querySelectorAll(window.__S)].find((e) => window.__pintado(e) && window.__clave(e) === clave) || null, m.clave);
      const el = h.asElement();
      if (!el) continue;
      const etiquetas = await el.evaluate((e) => [...(e.labels || [])].length);
      m.etiquetas = [];
      for (let i = 0; i < etiquetas; i++) {
        const info = await el.evaluate(async (e, i) => {
          const l = e.labels[i]; l.scrollIntoView({ block: 'center' });
          const t = await window.__areaDeToque(l, 'label', { scroll: false });
          const lr = l.getBoundingClientRect(), er = e.getBoundingClientRect();
          let mejor = null;
          for (let y = lr.top + 1; y < lr.bottom - 1; y += 2) for (let x = lr.left + 1; x < lr.right - 1; x += 8) {
            const top = document.elementFromPoint(x, y);
            if (!top || top === e || e.contains(top) || top.closest('label') !== l) continue;
            const dy = Math.abs(y - (er.top + er.height / 2));
            if (!mejor || dy > mejor.dy) mejor = { x, y, dy };
          }
          return { contiene: l.contains(e), tocable: t.tocable ?? null, punto: mejor };
        }, i);
        if (info.punto) {
          const estado = (e) => (e.type === 'checkbox' || e.type === 'radio' ? e.checked : document.activeElement === e);
          const antes = await el.evaluate(estado);
          await page.mouse.click(info.punto.x, info.punto.y); await espera(80);
          const despues = await el.evaluate(estado);
          info.activa = m.tipo === 'radio' ? despues === true : (antes !== despues || (despues === true && m.tipo !== 'checkbox'));
          info.yaMarcado = m.tipo === 'radio' && antes === true;
          if (['checkbox', 'radio'].includes(m.tipo) && antes !== despues && m.tipo === 'checkbox') { await page.mouse.click(info.punto.x, info.punto.y); await espera(80); }
        } else info.activa = null;
        m.etiquetas.push(info);
      }
    }
    const err = await page.evaluate('window.__errores.slice()');
    resultados.push({ ancho, estado: nombre, alcanzado: !!hecho, accion: hecho, medidos, errores: err });
    console.log(`@${ancho} ${hecho ? '✔' : '✖ NO ALCANZADO'} ${nombre}${hecho ? ' ← ' + hecho : ''} · pintados ${medidos.length}${err.length ? ' · ERRORES ' + JSON.stringify(err).slice(0, 120) : ''}`);
    if (LISTAR && ancho === 390) console.log('      ' + (await page.evaluate('window.__visiblesTxt()')).join(' · '));
  }
  await page.close();
}
await browser.close(); srv.close();
fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 1));

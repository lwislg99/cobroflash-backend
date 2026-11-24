// scripts/capturas-iva10-parte-s.mjs — SCRUM-1804 (PARTE S de SCRUM-1316, S2)
//
// LAS CAPTURAS DEL IVA AL 10 %, ANTES (merge-base de la rama) Y DESPUÉS, a 390 y 1280:
//   · editor del presupuesto, hoja de ajustes de la línea, con el IVA de la línea al 10 % (②);
//   · editor del presupuesto, «IVA por defecto» al 10 % (②), por el camino del profesional;
//   · ficha del trabajo, factura con línea al 10 %, «efectivo» elegido (T4) y «Marcar como PAGADA»
//     sin elegir (T3) (③).
//
// Uso: `node scripts/capturas-iva10-parte-s.mjs`  →  `docs/master/evidencias/SCRUM-1804/`
//
// Además de la foto, MIDE y lo dice: si el aviso está a la vista, si su texto es el firmado, si
// cabe en el ancho y si hay desborde horizontal. Sale con 1 si en DESPUÉS falta un aviso o no
// cabe; con 2 si no supo mirar. ⚠️ Una captura no prueba que el aviso decida bien: eso lo prueba
// `tests/scrum1804-iva10-parte-s.test.mjs`. Esto sólo enseña cómo se ve.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-1804');

const METODOS = [
  { valor: 'bizum_manual', rotulo: 'Bizum' }, { valor: 'card', rotulo: 'Tarjeta' },
  { valor: 'transfer', rotulo: 'Transferencia' }, { valor: 'cash', rotulo: 'Efectivo' },
];
const TRABAJO = {
  id: 1804, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'Reforma de baño',
  customer: { id: 3, name: 'Comunidad Los Olivos', phone: null, mobile: null },
  asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
  quote: null, direccion: null, totalAceptado: 160.5, totalCobrado: 0, estadoCobro: 'Pendiente',
  tipoOperacion: 'OPERACIONES_SUELTAS',
  invoices: [{
    id: 91, number: 'F-2026-0091', status: 'pending', type: 'F1', total: 160.5, currency: 'EUR',
    createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: null, payToken: null,
    stageLabel: null, rectifiesId: null, envioDocumento: null,
    conIvaAlDiez: true, metodosConAvisoIvaAlDiez: ['cash'],
  }],
};
const MERCHANT = { id: 1, name: 'Fontanería Soler', defaultCurrency: 'EUR', country: 'ES', timezone: 'Europe/Madrid' };
const CLIENTE = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001' };

// `__datos` se evalúa en la página ANTES de pintar: el IIFE deja servidas las opciones del selector
// (lo que `app.js` hace en el arranque con `/admin/me`, y aquí no se carga).
const datos = (cuerpo) => `(function () {
  window.appMetodosDeclarables = ${JSON.stringify(METODOS)};
  return function (ruta, opciones) { ${cuerpo} };
})()`;
const RUTAS = [
  {
    ruta: '/editor', fnVista: 'renderQuotesView', modoEmision: 'fiscal',
    datos: datos(`if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(MERCHANT)};
      if (/\\/admin\\/customers/.test(ruta)) return [${JSON.stringify(CLIENTE)}];
      return [];`),
  },
  {
    ruta: '/ficha', fnVista: 'renderJobDetailView', modoEmision: 'fiscal', args: '[1804]',
    datos: datos(`if (opciones && opciones.method === 'PUT') return { ok: true };
      if (/\\/admin\\/team/.test(ruta)) return [];
      if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(MERCHANT)};
      if (/gastos|partes/.test(ruta)) return [];
      return ${JSON.stringify(TRABAJO)};`),
  },
];

const QUIETO = "document.getAnimations().every((a) => a.playState !== 'running')";

/** Mide el aviso visible que contiene `firma`, si lo hay. Se evalúa EN la página. */
const MEDIR = `(firma) => {
  const vis = (n) => { const r = n.getBoundingClientRect(); return !n.hidden && r.width > 0 && r.height > 0; };
  const avisos = [...document.querySelectorAll('.alert.warning')].filter((n) => vis(n) && n.textContent.includes(firma));
  const a = avisos[0] || null;
  const r = a ? a.getBoundingClientRect() : null;
  return {
    visible: !!a,
    texto: a ? a.textContent : null,
    caja: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null,
    cabe: r ? r.left >= 0 && r.right <= window.innerWidth : null,
    desborde: document.documentElement.scrollWidth > window.innerWidth,
  };
}`;

async function pulsarTexto(page, selector, texto) {
  const h = await page.evaluateHandle((s, t) => [...document.querySelectorAll(s)]
    .find((b) => b.textContent.trim() === t && b.getBoundingClientRect().width > 0) || null, selector, texto);
  const el = h.asElement();
  if (!el) return false;
  await el.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await el.click();
  await new Promise((ok) => setTimeout(ok, 250));
  return true;
}

async function elegir(page, selector, valor) {
  return page.evaluate((s, v) => {
    const sel = document.querySelector(s);
    if (!sel) return false;
    sel.value = v;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    sel.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  }, selector, valor);
}

const T4_INICIO = 'Desde el 1 de diciembre de 2026, el IVA del 10 %';
const T3 = 'Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.';

/** Cada escena: prepara la pantalla y devuelve el texto que el aviso tiene que llevar, o null si no supo llegar. */
const ESCENAS = [
  {
    nombre: 'linea', ruta: '/editor', firma: T4_INICIO,
    preparar: async (page) => {
      const chip = await page.$('#view-container .quote-line__ajustes');
      if (!chip) return 'no hay chip de ajustes en la primera línea';
      await chip.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await chip.click();
      await page.waitForFunction(QUIETO, { timeout: 20000 });
      const ok = await page.evaluate(() => {
        const sel = [...document.querySelectorAll('.quote-line__vat select')].find((s) => s.getBoundingClientRect().width > 0);
        if (!sel) return false;
        sel.value = '10'; sel.dispatchEvent(new Event('change', { bubbles: true }));
        sel.scrollIntoView({ block: 'center', behavior: 'instant' });
        return true;
      });
      return ok ? null : 'la hoja de ajustes no enseña el IVA de la línea';
    },
  },
  {
    nombre: 'iva-por-defecto', ruta: '/editor', firma: T4_INICIO,
    preparar: async (page) => {
      // El camino del profesional (SCRUM-915d): cliente → Continuar → Continuar → «Cambiar» de Ajustes.
      await page.evaluate((nombre) => {
        const inp = [...document.querySelectorAll('#view-container input')].find((i) => i.getBoundingClientRect().width > 0);
        if (inp) { inp.focus(); inp.value = nombre; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      }, CLIENTE.name);
      await new Promise((ok) => setTimeout(ok, 400));
      const opcion = await page.evaluateHandle((nombre) => [...document.querySelectorAll('#view-container li, #view-container button, #view-container [role="option"]')]
        .find((n) => n.textContent.trim().startsWith(nombre) && n.getBoundingClientRect().width > 0) || null, CLIENTE.name);
      if (opcion.asElement()) await opcion.asElement().click();
      for (const paso of ['Continuar', 'Continuar', 'Cambiar']) {
        await pulsarTexto(page, '#view-container button', paso);
        await page.waitForFunction(QUIETO, { timeout: 20000 });
      }
      const visible = await page.evaluate(() => {
        const s = document.querySelector('select[name="vat_default"]');
        return !!s && s.getBoundingClientRect().width > 0;
      });
      if (!visible) return '«IVA por defecto» no quedó a la vista al final del camino';
      await elegir(page, 'select[name="vat_default"]', '10');
      return null;
    },
  },
  {
    nombre: 'trabajo-efectivo', ruta: '/ficha', firma: T4_INICIO,
    preparar: async (page) => (await elegir(page, '#metodo-cobro-inv-91', 'cash')) ? null : 'NO_HAY_SELECTOR',
  },
  {
    nombre: 'trabajo-sin-elegir', ruta: '/ficha', firma: T3,
    preparar: async (page) => {
      await page.evaluate(() => { window.confirm = () => true; window.prompt = () => '160.50'; });
      return (await pulsarTexto(page, '#view-container button', 'Marcar como PAGADA')) ? null : 'no hay «Marcar como PAGADA»';
    },
  },
];

fs.mkdirSync(DESTINO, { recursive: true });
const antes = arbolDePartida(RAIZ, 'antes-1804');
if (!antes.publico) { console.error('🔴 NO SUPE MIRAR: no resuelvo el merge-base de la rama'); process.exit(2); }
const { browser } = await abrirNavegador(puppeteer);
const filas = [];
try {
  for (const [etiqueta, publico] of [['antes', antes.publico], ['despues', path.join(RAIZ, 'public')]]) {
    const { srv, puerto } = await servirListas(publico, RUTAS);
    try {
      for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
        for (const e of ESCENAS) {
          const { page, errores } = await abrirVista(browser, puerto, e.ruta, ancho, alto);
          const corte = await e.preparar(page);
          await page.waitForFunction(QUIETO, { timeout: 20000 });
          const m = await page.evaluate(`(${MEDIR})(${JSON.stringify(e.firma)})`);
          const fichero = `${e.nombre}-${etiqueta}-${ancho}.png`;
          await page.screenshot({ path: path.join(DESTINO, fichero) });
          filas.push({ fichero, etiqueta, ancho, escena: e.nombre, corte, errores: errores.length, ...m });
          await page.close();
        }
      }
    } finally { srv.close(); }
  }
} finally {
  await browser.close();
  antes.limpiar();
}

for (const f of filas) {
  console.log(`${f.fichero} · aviso visible=${f.visible} · cabe=${f.cabe} · desborde=${f.desborde} · caja=${JSON.stringify(f.caja)}`
    + `${f.corte ? ` · CORTE: ${f.corte}` : ''}${f.errores ? ` · errores de consola: ${f.errores}` : ''}`);
}
const despues = filas.filter((f) => f.etiqueta === 'despues');
const ciegas = despues.filter((f) => f.corte);
const malas = despues.filter((f) => !f.corte && (!f.visible || !f.cabe || f.desborde || f.errores));
console.log(`capturas: ${filas.length} de ${ESCENAS.length * 4} · después sin llegar: ${ciegas.length} · después con defecto: ${malas.length}`);
if (malas.length) process.exitCode = 1;
else if (ciegas.length || filas.length !== ESCENAS.length * 4) process.exitCode = 2;

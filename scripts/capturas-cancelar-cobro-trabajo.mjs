// scripts/capturas-cancelar-cobro-trabajo.mjs — SCRUM-1808b (S2)
//
// LAS CAPTURAS DE «Cancelar cobro» EN LA FICHA DEL TRABAJO, ANTES (merge-base de la rama) Y DESPUÉS,
// a 390 y 1280:
//   · factura con el cobro `pending`, pestaña «Facturas», «⋯» de la fila ABIERTO: «Cancelar cobro»;
//   · factura con el cobro `cancelled`: la etiqueta «Cobro cancelado» en la fila, y sin botón.
//
// Uso: `node scripts/capturas-cancelar-cobro-trabajo.mjs`  →  `docs/master/evidencias/SCRUM-1808b/`
//
// Además de la foto, MIDE y lo dice: si el elemento está a la vista, si cabe en el ancho y si hay
// desborde horizontal. CONTROL POSITIVO: en ANTES el elemento NO puede estar (la rama es lo que lo
// pone); si está, el instrumento no distingue y sale con 2. Sale con 1 si en DESPUÉS falta o no
// cabe; con 2 si no supo mirar. ⚠️ Una captura no prueba que el botón decida bien: eso lo prueba
// `tests/scrum1808b-cancelar-cobro-en-ficha-trabajo.test.mjs`. Esto sólo enseña cómo se ve.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-1808b');

const trabajo = (estadoDelCobro) => ({
  id: 1808, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'Cambio de caldera',
  customer: { id: 3, name: 'Comunidad Los Olivos', phone: '34000000001', mobile: null },
  asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
  quote: null, direccion: null, totalAceptado: 1250, totalCobrado: 0, estadoCobro: 'Pendiente',
  tipoOperacion: 'OPERACIONES_SUELTAS',
  invoices: [{
    id: 81, number: 'F-2026-0081', status: 'pending', type: 'F1', total: 1250, currency: 'EUR',
    createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: 77, payToken: 'tok-capturas-1808b',
    stageLabel: null, rectifiesId: null, envioDocumento: null, conIvaAlDiez: false, metodosConAvisoIvaAlDiez: ['cash'],
    estadoDelCobro,
  }],
});
const MERCHANT = { id: 1, name: 'Fontanería Soler', defaultCurrency: 'EUR', country: 'ES', timezone: 'Europe/Madrid' };

const datos = (job) => `(function () {
  return function (ruta, opciones) {
    if (opciones && opciones.method === 'POST') return { ok: true, status: 'cancelled' };
    if (/\\/admin\\/team/.test(ruta)) return [];
    if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(MERCHANT)};
    if (/gastos|partes/.test(ruta)) return [];
    return ${JSON.stringify(job)};
  };
})()`;
const RUTAS = [
  { ruta: '/pendiente', fnVista: 'renderJobDetailView', modoEmision: 'fiscal', args: '[1808]', datos: datos(trabajo('pending')) },
  { ruta: '/cancelado', fnVista: 'renderJobDetailView', modoEmision: 'fiscal', args: '[1808]', datos: datos(trabajo('cancelled')) },
];

const QUIETO = "document.getAnimations().every((a) => a.playState !== 'running')";

/** Mide el nodo visible MÁS INTERNO cuyo texto es exactamente `texto`. Se evalúa EN la página. */
const MEDIR = `(texto) => {
  const vis = (n) => { const r = n.getBoundingClientRect(); return !n.hidden && r.width > 0 && r.height > 0; };
  const con = [...document.querySelectorAll('body *')].filter((n) => vis(n) && n.textContent.trim() === texto);
  const a = con.filter((n) => !con.some((o) => o !== n && n.contains(o)))[0] || null;
  const r = a ? a.getBoundingClientRect() : null;
  return {
    visible: !!a,
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
  await el.evaluate((b) => { b.scrollIntoView({ block: 'center', behavior: 'instant' }); b.click(); });
  await new Promise((ok) => setTimeout(ok, 250));
  return true;
}

async function aFacturas(page) {
  if (!(await pulsarTexto(page, '#view-container button, #view-container [role="tab"]', 'Facturas'))) return 'no hay pestaña «Facturas»';
  await page.waitForFunction(QUIETO, { timeout: 20000 });
  return null;
}

const ESCENAS = [
  {
    nombre: 'menu-pendiente', ruta: '/pendiente', busca: 'Cancelar cobro',
    preparar: async (page) => {
      const corte = await aFacturas(page);
      if (corte) return corte;
      // El «⋯» de la fila de la factura: sus acciones solo existen con el menú abierto.
      const abierto = await page.evaluate(() => {
        const t = document.querySelector('#view-container .jobdet-inv-actions .overflow-trigger');
        if (!t) return false;
        t.scrollIntoView({ block: 'center', behavior: 'instant' });
        t.click();
        return true;
      });
      await new Promise((ok) => setTimeout(ok, 300));
      return abierto ? null : 'no hay «⋯» en la fila de la factura';
    },
  },
  {
    nombre: 'cobro-cancelado', ruta: '/cancelado', busca: 'Cobro cancelado',
    preparar: async (page) => {
      const corte = await aFacturas(page);
      if (corte) return corte;
      await page.evaluate(() => {
        const f = document.querySelector('#view-container .job-doc-row');
        if (f) f.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      return null;
    },
  },
];

fs.mkdirSync(DESTINO, { recursive: true });
const antes = arbolDePartida(RAIZ, 'antes-1808b');
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
          await page.waitForFunction(QUIETO, { timeout: 20000 });
          const corte = await e.preparar(page);
          await page.waitForFunction(QUIETO, { timeout: 20000 });
          const m = await page.evaluate(`(${MEDIR})(${JSON.stringify(e.busca)})`);
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
  console.log(`${f.fichero} · visible=${f.visible} · cabe=${f.cabe} · desborde=${f.desborde} · caja=${JSON.stringify(f.caja)}`
    + `${f.corte ? ` · CORTE: ${f.corte}` : ''}${f.errores ? ` · errores de consola: ${f.errores}` : ''}`);
}
const despues = filas.filter((f) => f.etiqueta === 'despues');
const ciegas = despues.filter((f) => f.corte);
const malas = despues.filter((f) => !f.corte && (!f.visible || !f.cabe || f.desborde || f.errores));
// CONTROL POSITIVO: en ANTES no existe ni el botón ni la etiqueta. Si el instrumento los «ve», no distingue.
const antesConElemento = filas.filter((f) => f.etiqueta === 'antes' && f.visible);
console.log(`capturas: ${filas.length} de ${ESCENAS.length * 4} · después sin llegar: ${ciegas.length} · después con defecto: ${malas.length} · antes con el elemento (debe ser 0): ${antesConElemento.length}`);
if (malas.length) process.exitCode = 1;
else if (ciegas.length || antesConElemento.length || filas.length !== ESCENAS.length * 4) process.exitCode = 2;

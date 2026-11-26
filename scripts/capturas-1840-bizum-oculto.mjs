// scripts/capturas-1840-bizum-oculto.mjs — SCRUM-1840 (S2)
//
// LAS CAPTURAS DE «📲 Confirmar Bizum recibido» EN LA FICHA DEL TRABAJO, ANTES (merge-base de la rama)
// Y DESPUÉS, a 390 y 1280, pestaña «Facturas»:
//   · cobro `cancelled`: ANTES el botón está (el defecto); DESPUÉS ya no está;
//   · cobro `pending`: el botón está ANTES y DESPUÉS (CONTROL POSITIVO: el instrumento sí lo ve).
//
// Uso: `node scripts/capturas-1840-bizum-oculto.mjs`  →  `docs/master/evidencias/SCRUM-1840/`
//
// MIDE y lo dice: si el botón está a la vista, si cabe en el ancho y si hay desborde horizontal. Sale
// con 1 si DESPUÉS el botón sigue con el cobro cancelado, o falta / no cabe con el pendiente; con 2 si
// no supo mirar (o si ANTES no ve el defecto: entonces el instrumento no distingue). ⚠️ Una captura
// no prueba la condición: eso lo prueba `tests/scrum1840-bizum-solo-con-cobro-pendiente.test.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-1840');
const BIZUM = '📲 Confirmar Bizum recibido';

const trabajo = (estadoDelCobro) => ({
  id: 1840, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'Cambio de caldera',
  customer: { id: 3, name: 'Comunidad Los Olivos', phone: '34000000001', mobile: null },
  asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
  quote: null, direccion: null, totalAceptado: 1250, totalCobrado: 0, estadoCobro: 'Pendiente',
  tipoOperacion: 'OPERACIONES_SUELTAS',
  invoices: [{
    id: 84, number: 'F-2026-0084', status: 'pending', type: 'F1', total: 1250, currency: 'EUR',
    createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: 78, payToken: 'tok-capturas-1840',
    stageLabel: null, rectifiesId: null, envioDocumento: null, conIvaAlDiez: false, metodosConAvisoIvaAlDiez: ['cash'],
    estadoDelCobro,
  }],
});
const MERCHANT = { id: 1, name: 'Fontanería Soler', defaultCurrency: 'EUR', country: 'ES', timezone: 'Europe/Madrid' };

const datos = (job) => `(function () {
  return function (ruta, opciones) {
    if (opciones && opciones.method === 'POST') return { ok: true };
    if (/\\/admin\\/team/.test(ruta)) return [];
    if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(MERCHANT)};
    if (/gastos|partes/.test(ruta)) return [];
    return ${JSON.stringify(job)};
  };
})()`;
const RUTAS = [
  { ruta: '/cancelado', fnVista: 'renderJobDetailView', modoEmision: 'fiscal', args: '[1840]', datos: datos(trabajo('cancelled')) },
  { ruta: '/pendiente', fnVista: 'renderJobDetailView', modoEmision: 'fiscal', args: '[1840]', datos: datos(trabajo('pending')) },
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

/** Pestaña «Facturas» y la fila de acciones de la factura a la vista. */
async function aLaFila(page) {
  if (!(await pulsarTexto(page, '#view-container button, #view-container [role="tab"]', 'Facturas'))) return 'no hay pestaña «Facturas»';
  await page.waitForFunction(QUIETO, { timeout: 20000 });
  const hay = await page.evaluate(() => {
    const f = document.querySelector('#view-container .jobdet-inv-actions');
    if (f) f.scrollIntoView({ block: 'center', behavior: 'instant' });
    return !!f;
  });
  return hay ? null : 'no hay fila de acciones de la factura';
}

// `debe`: si el botón TIENE que verse en cada lado.
const ESCENAS = [
  { nombre: 'bizum-cancelado', ruta: '/cancelado', debe: { antes: true, despues: false } },
  { nombre: 'bizum-pendiente', ruta: '/pendiente', debe: { antes: true, despues: true } },
];

fs.mkdirSync(DESTINO, { recursive: true });
const antes = arbolDePartida(RAIZ, 'antes-1840');
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
          const corte = await aLaFila(page);
          await page.waitForFunction(QUIETO, { timeout: 20000 });
          const m = await page.evaluate(`(${MEDIR})(${JSON.stringify(BIZUM)})`);
          const fichero = `${e.nombre}-${etiqueta}-${ancho}.png`;
          await page.screenshot({ path: path.join(DESTINO, fichero) });
          filas.push({ fichero, etiqueta, ancho, escena: e.nombre, debe: e.debe[etiqueta], corte, errores: errores.length, ...m });
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
  console.log(`${f.fichero} · debe verse=${f.debe} · visible=${f.visible} · cabe=${f.cabe} · desborde=${f.desborde} · caja=${JSON.stringify(f.caja)}`
    + `${f.corte ? ` · CORTE: ${f.corte}` : ''}${f.errores ? ` · errores de consola: ${f.errores}` : ''}`);
}
const ciegas = filas.filter((f) => f.corte);
const despues = filas.filter((f) => f.etiqueta === 'despues' && !f.corte);
const malas = despues.filter((f) => f.visible !== f.debe || (f.debe && !f.cabe) || f.desborde || f.errores);
// CONTROL POSITIVO: ANTES el botón está en las dos escenas (el defecto y el control). Si no lo ve, no distingue.
const antesSinVer = filas.filter((f) => f.etiqueta === 'antes' && !f.corte && !f.visible);
console.log(`capturas: ${filas.length} de ${ESCENAS.length * 4} · sin llegar: ${ciegas.length} · después con defecto: ${malas.length} · antes sin ver el botón (debe ser 0): ${antesSinVer.length}`);
if (malas.length) process.exitCode = 1;
else if (ciegas.length || antesSinVer.length || filas.length !== ESCENAS.length * 4) process.exitCode = 2;

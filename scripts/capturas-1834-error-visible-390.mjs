// scripts/capturas-1834-error-visible-390.mjs — SCRUM-1834 (S2)
//
// ¿SE VE T3 EN LA PANTALLA cuando el profesional pulsa «Marcar como PAGADA» sin decir cómo lo
// cobró? ANTES (merge-base de la rama) y DESPUÉS, a 390 y a 1280, con un navegador de verdad.
//
// Uso: `node scripts/capturas-1834-error-visible-390.mjs`  →  `docs/master/evidencias/SCRUM-1834/`
//
// 🔴 POR QUÉ NO BASTABA `capturas-iva10-parte-s.mjs` (SCRUM-1804): aquel mide «visible» como
// «ancho y alto > 0», y la barra de estado de arriba los tiene aunque esté 196 px por ENCIMA de la
// ventana. Aquí «se ve» es lo que ve una persona: la caja de T3 dentro de la VENTANA, de arriba
// abajo (`top >= 0 && bottom <= innerHeight`), después de que el foco haya ido al selector.
//
// Sale con 1 si en DESPUÉS T3 no está en la ventana (o desborda); con 2 si no supo llegar.
// Datos FICTICIOS (el mismo trabajo de muestra de SCRUM-1804): nada de producción.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-1834');

const METODOS = [
  { valor: 'bizum_manual', rotulo: 'Bizum' }, { valor: 'card', rotulo: 'Tarjeta' },
  { valor: 'transfer', rotulo: 'Transferencia' }, { valor: 'cash', rotulo: 'Efectivo' },
];
const TRABAJO = {
  id: 1834, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'Reforma de baño',
  customer: { id: 3, name: 'Comunidad Los Olivos', phone: null, mobile: null },
  asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
  quote: null, direccion: null, totalAceptado: 160.5, totalCobrado: 0, estadoCobro: 'Pendiente',
  tipoOperacion: 'OPERACIONES_SUELTAS',
  // 🔴 CONTROL POSITIVO: con UNA factura la ficha es corta (scrollY 177 a 390) y la barra de arriba
  // sigue en la ventana: el ANTES salía «se ve» y el instrumento no reproducía el defecto medido en
  // vivo (scrollY 688). Seis facturas ANTERIORES, sin 10 %, alargan la ficha como una de verdad.
  invoices: [...[1, 2, 3, 4, 5, 6].map((k) => ({
    id: 80 + k, number: `F-2026-008${k}`, status: 'pending', type: 'F1', total: 121, currency: 'EUR',
    createdAt: `2026-11-0${k}T10:00:00.000Z`, paidAt: null, chargeId: null, payToken: null,
    stageLabel: null, rectifiesId: null, envioDocumento: null, conIvaAlDiez: false,
  })), {
    id: 91, number: 'F-2026-0091', status: 'pending', type: 'F1', total: 160.5, currency: 'EUR',
    createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: null, payToken: null,
    stageLabel: null, rectifiesId: null, envioDocumento: null,
    conIvaAlDiez: true, metodosConAvisoIvaAlDiez: ['cash'],
  }],
};
const MERCHANT = { id: 1, name: 'Fontanería Soler', defaultCurrency: 'EUR', country: 'ES', timezone: 'Europe/Madrid' };

const RUTAS = [{
  ruta: '/ficha', fnVista: 'renderJobDetailView', modoEmision: 'fiscal', args: '[1834]',
  datos: `(function () {
    window.appMetodosDeclarables = ${JSON.stringify(METODOS)};
    return function (ruta, opciones) {
      if (opciones && opciones.method === 'PUT') return { ok: true };
      if (/\\/admin\\/team/.test(ruta)) return [];
      if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(MERCHANT)};
      if (/gastos|partes/.test(ruta)) return [];
      return ${JSON.stringify(TRABAJO)};
    };
  })()`,
}];

const T3 = 'Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.';
const QUIETO = "document.getAnimations().every((a) => a.playState !== 'running')";

/** Se evalúa EN la página: el nodo más interno con T3 que tiene caja, y si cae dentro de la ventana. */
const MEDIR = `(firma) => {
  const caja = (n) => { const r = n.getBoundingClientRect(); return !n.hidden && r.width > 0 && r.height > 0; };
  const con = [...document.querySelectorAll('body *')].filter((n) => caja(n) && n.textContent.includes(firma));
  const a = con.filter((n) => !con.some((o) => o !== n && n.contains(o)))[0] || null;
  const r = a ? a.getBoundingClientRect() : null;
  const f = document.activeElement;
  return {
    hay: !!a,
    texto: a ? a.textContent : null,
    caja: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null,
    enVentana: r ? r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth : false,
    scrollY: Math.round(window.scrollY),
    foco: f ? (f.id || f.tagName) : null,
    desborde: document.documentElement.scrollWidth > window.innerWidth,
  };
}`;

async function pulsarTexto(page, selector, texto, dentroDe = null) {
  const h = await page.evaluateHandle((s, t, d) => {
    const raiz = d ? (document.querySelector(d) || { closest: () => null }).closest('.job-doc-row') : document;
    if (!raiz) return null;
    return [...raiz.querySelectorAll(s)].find((b) => b.textContent.trim() === t && b.getBoundingClientRect().width > 0) || null;
  }, selector, texto, dentroDe);
  const el = h.asElement();
  if (!el) return false;
  // Como el profesional: desplaza hasta el botón y lo toca. El foco al selector lo mueve la vista.
  await el.evaluate((b) => { b.scrollIntoView({ block: 'center', behavior: 'instant' }); b.click(); });
  await new Promise((ok) => setTimeout(ok, 250));
  return true;
}

fs.mkdirSync(DESTINO, { recursive: true });
const antes = arbolDePartida(RAIZ, 'antes-1834');
if (!antes.publico) { console.error('🔴 NO SUPE MIRAR: no resuelvo el merge-base de la rama'); process.exit(2); }
const { browser } = await abrirNavegador(puppeteer);
const filas = [];
try {
  for (const [etiqueta, publico] of [['antes', antes.publico], ['despues', path.join(RAIZ, 'public')]]) {
    const { srv, puerto } = await servirListas(publico, RUTAS);
    try {
      for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
        const { page, errores } = await abrirVista(browser, puerto, '/ficha', ancho, alto);
        let corte = null;
        if (!(await pulsarTexto(page, '#view-container button, #view-container [role="tab"]', 'Facturas'))) corte = 'no hay pestaña «Facturas»';
        else {
          await page.waitForFunction(QUIETO, { timeout: 20000 });
          await page.evaluate(() => { window.confirm = () => true; window.prompt = () => '160.50'; });
          // El botón de la fila de la factura con 10 % (la del selector), no el primero de la ficha.
          if (!(await pulsarTexto(page, 'button', 'Marcar como PAGADA', '#metodo-cobro-inv-91'))) corte = 'no hay «Marcar como PAGADA» en la fila con 10 %';
        }
        await page.waitForFunction(QUIETO, { timeout: 20000 });
        const m = await page.evaluate(`(${MEDIR})(${JSON.stringify(T3)})`);
        const fichero = `trabajo-sin-elegir-${etiqueta}-${ancho}.png`;
        await page.screenshot({ path: path.join(DESTINO, fichero) });
        filas.push({ fichero, etiqueta, ancho, corte, errores: errores.length, ...m });
        await page.close();
      }
    } finally { srv.close(); }
  }
} finally {
  await browser.close();
  antes.limpiar();
}

for (const f of filas) {
  console.log(`${f.fichero} · T3 en la ventana=${f.enVentana} · caja=${JSON.stringify(f.caja)} · scrollY=${f.scrollY} · foco=${f.foco}`
    + ` · texto firmado=${f.texto === T3} · desborde=${f.desborde}`
    + `${f.corte ? ` · CORTE: ${f.corte}` : ''}${f.errores ? ` · errores de consola: ${f.errores}` : ''}`);
}
const despues = filas.filter((f) => f.etiqueta === 'despues');
const ciegas = despues.filter((f) => f.corte || !f.hay);
const malas = despues.filter((f) => !f.corte && f.hay && (!f.enVentana || f.texto !== T3 || f.desborde || f.errores));
// Control positivo: el ANTES a 390 TIENE que dejar T3 fuera de la ventana (es el defecto medido en
// vivo). Si sale dentro, la ficha de muestra se ha quedado corta y el «después» no prueba nada.
const control = filas.find((f) => f.etiqueta === 'antes' && f.ancho === 390);
const controlOk = !!control && control.hay && !control.enVentana;
console.log(`capturas: ${filas.length} de 4 · control positivo (antes-390 fuera de la ventana): ${controlOk ? 'reproduce' : '🔴 NO reproduce'}`
  + ` · después sin llegar: ${ciegas.length} · después con defecto: ${malas.length}`);
if (malas.length) process.exitCode = 1;
else if (!controlOk || ciegas.length || filas.length !== 4) process.exitCode = 2;

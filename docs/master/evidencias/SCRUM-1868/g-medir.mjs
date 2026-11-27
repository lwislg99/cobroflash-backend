// docs/master/evidencias/SCRUM-1868/g-medir.mjs — SCRUM-1868g
//
// Mide EN LOCAL, con Edge (`scripts/_navegador.mjs`), lo que el recorrido en staging de 1868f dejó
// como hallazgo AB6: (1) los objetivos del modal «Eliminar cliente» en sus dos estados (libre y
// bloqueado) a 390 y 1280, con el ÁRBITRO de la casa (`__areaDeToque`), no con la caja; y (2) los
// nodos de la lista de clientes que se salen por la derecha, diciendo de cada uno si se VE o lo
// recorta un contenedor con `overflow`.
//
// El modal lo monta el código del producto en el banco (`tests/_banco-vistas.mjs`, como
// `tests/scrum1868b-borrar-cliente-pantalla.test.mjs`) y se serializa con `scripts/_pagina-panel.mjs`;
// la lista, con `paginaDeClientes`. No hay red, ni staging, ni sesión.
//
//   node docs/master/evidencias/SCRUM-1868/g-medir.mjs > <fuera del árbol>/g-medir.txt
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolverNavegador, lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS } from '../../../../scripts/_medidor-de-toque.mjs';
import { serializar, paginaDeClientes } from '../../../../scripts/_pagina-panel.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, decirFuente } from '../../../../scripts/_hojas-del-panel.mjs';
import { cargarDashboard, pintarVista, todos } from '../../../../tests/_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const PUBLIC = path.join(RAIZ, 'public');
const espera = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
const CUENTA = { documentos: 3, sitios: 2, equipos: 4, historial: 7, solicitudes: 6, presupuestos: 0, facturas: 0, trabajos: 0, partes: 0, mantenimientos: 0 };
const PREVIAS = {
  libre: { bloqueado: false, motivos: [], cuenta: CUENTA },
  bloqueado: { bloqueado: true, motivos: ['tiene_facturas', 'tiene_presupuestos'], cuenta: { ...CUENTA, facturas: 2, presupuestos: 5 } },
};

async function modalSerializado(previa) {
  const CLIENTE = { id: 10068, name: 'Cliente QA 1868g', phone: null, mobile: null, email: null, notes: null, portalToken: null,
    createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, tags: null };
  const fetch = async (url) => {
    const u = new URL(String(url), 'http://banco.invalid').pathname;
    let j = [];
    if (/\/borrado-previa$/.test(u)) j = previa;
    else if (/\/detail$/.test(u)) j = { customer: CLIENTE, quotes: [], invoices: [], events: [], stats: { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 } };
    else if (/\/historial/.test(u)) j = { trabajos: [], partesSueltos: [] };
    else if (/\/whatsapp/.test(u)) j = { waOptOut: false, mensajes: [] };
    else if (/\/documentos$/.test(u)) j = { documentos: [], limites: {} };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, blob: async () => ({}), json: async () => j, text: async () => JSON.stringify(j) };
  };
  const banco = cargarDashboard(RAIZ, { rol: 'admin', red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch } });
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  if (r.error) throw new Error('la ficha no monta: ' + r.error.message);
  await espera();
  const boton = todos(r.contenedor).find((n) => n.dataset && n.dataset.accion === 'abrir-borrado');
  if (!boton) throw new Error('CIEGO: no hay botón «Eliminar cliente» en la ficha');
  boton.disparar('click');
  await espera();
  const modal = todos(banco.ctx.document.body).find((n) => n.dataset && n.dataset.rol === 'modal-borrar-cliente');
  if (!modal) throw new Error('CIEGO: el modal no se abrió');
  return serializar(modal);
}

const HOJAS = enlacesDelPanel(PUBLIC);
const pagina = (cuerpo) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>' + cuerpo + '</body></html>';

const navegador = resolverNavegador();
if (!navegador.ok) { console.log('CIEGO: sin navegador: ' + navegador.motivo); process.exit(2); }

const paginas = {
  '/__libre': pagina(await modalSerializado(PREVIAS.libre)),
  '/__bloqueado': pagina(await modalSerializado(PREVIAS.bloqueado)),
};
const lista = await paginaDeClientes(RAIZ, { seleccionar: false });
if (!lista.html) { console.log('CIEGO: ' + lista.aviso); process.exit(2); }
paginas['/__lista'] = pagina('<main class="main-content">' + lista.html + '</main>');

const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (paginas[u]) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(paginas[u]); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d) || fs.statSync(d).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
const nav = await lanzarNavegador(puppeteer, {});
try {
  for (const estado of ['libre', 'bloqueado']) {
    for (const ancho of [390, 1280]) {
      const page = await nav.newPage();
      await page.setViewport({ width: ancho, height: 1200 }); // a 900, «Cerrar» (bloqueado@390) cae bajo el borde
      await page.goto(`http://127.0.0.1:${PUERTO}/__${estado}`, { waitUntil: 'load' });
      const fuente = await esperarFuentes(page);
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished))); // `slide-up` de `.modal`
      await page.evaluate(FUENTE_MEDIDOR);
      const filas = await page.evaluate(async (SEL) => {
        const out = [];
        for (const el of document.querySelectorAll('[data-rol="modal-borrar-cliente"] ' + SEL.split(', ').join(', [data-rol="modal-borrar-cliente"] '))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const m = await window.__areaDeToque(el, SEL, { scroll: true });
          if (typeof m.tocable !== 'number') {
            const q = el.getBoundingClientRect();
            const arriba = document.elementsFromPoint(q.left + q.width / 2, q.top + q.height / 2)[0];
            m.error += ` · encima: ${arriba ? arriba.tagName.toLowerCase() + '.' + String(arriba.className) : 'nada'} · centro y ${Math.round(q.top + q.height / 2)} de ${window.innerHeight}`;
          }
          out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}${el.dataset.accion ? '[' + el.dataset.accion + ']' : ''} «${(el.textContent || '').trim().slice(0, 30)}» caja ${Math.round(r.width)}×${Math.round(r.height)} · toque ${m.tocable ?? m.error}`);
        }
        return out;
      }, INTERACTIVOS);
      console.log(`modal ${estado}@${ancho} · ${decirFuente(fuente)} · ${filas.length} interactivos\n   ${filas.join('\n   ')}`);
      // `--capturas`: «después» con la hoja tal cual; «antes», en la MISMA página tras quitar por CSSOM las
      // reglas del bloque J2 de SCRUM-1868g (lo mismo que hace el caso d del test).
      if (process.argv.includes('--capturas')) {
        const modal = await page.$('[data-rol="modal-borrar-cliente"] .modal');
        const dir = path.dirname(fileURLToPath(import.meta.url));
        await modal.screenshot({ path: path.join(dir, `g-${estado}-${ancho}-despues.png`) });
        const quitadas = await page.evaluate(() => {
          let n = 0;
          for (const h of document.styleSheets) {
            try { for (let i = h.cssRules.length - 1; i >= 0; i--) { const s = h.cssRules[i].selectorText || ''; if (s.startsWith('[data-rol="modal-borrar-cliente"] .modal-footer > .btn') || s.startsWith('[data-rol="modal-borrar-cliente"] .fusion-linea > .contacto-link')) { h.deleteRule(i); n += 1; } } } catch { /* hoja ajena */ }
          }
          return n;
        });
        await modal.screenshot({ path: path.join(dir, `g-${estado}-${ancho}-antes.png`) });
        console.log(`   capturas g-${estado}-${ancho}-{antes,despues}.png · reglas quitadas para «antes»: ${quitadas}`);
      }
      await page.close();
    }
  }
  for (const ancho of [390, 1012, 1280]) {
    const page = await nav.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`http://127.0.0.1:${PUERTO}/__lista`, { waitUntil: 'load' });
    await esperarFuentes(page);
    const m = await page.evaluate(() => {
      const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
      const recorte = (n) => { for (let p = n.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX !== 'visible') return p; } return null; };
      const fuera = [...document.body.querySelectorAll('*')].filter((n) => vis(n) && n.getBoundingClientRect().right > window.innerWidth + 0.5);
      const porClase = {};
      for (const n of fuera) {
        const c = recorte(n);
        const visible = c ? n.getBoundingClientRect().left < c.getBoundingClientRect().right : true;
        const k = `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''} · recorta ${c ? c.tagName.toLowerCase() + '.' + String(c.className).trim().split(/\s+/).join('.') + ' (overflow-x ' + getComputedStyle(c).overflowX + ')' : 'NADIE'} · ${visible ? 'asoma' : 'oculto'}`;
        porClase[k] = (porClase[k] || 0) + 1;
      }
      const tabla = document.querySelector('table');
      const tw = tabla ? tabla.getBoundingClientRect() : null;
      const correos = [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => { const r = a.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; });
      return { scroll: document.documentElement.scrollWidth, vista: document.documentElement.clientWidth, fuera: fuera.length, porClase,
        tabla: tw ? `${Math.round(tw.left)}..${Math.round(tw.right)} (${Math.round(tw.width)})` : null, correos };
    });
    console.log(`lista@${ancho} · scroll ${m.scroll}/${m.vista} · se salen ${m.fuera} · tabla ${m.tabla} · correos ${m.correos.join(' ')}\n   ${Object.entries(m.porClase).map(([k, v]) => v + ' × ' + k).join('\n   ')}`);
    await page.close();
  }
} finally {
  await nav.close();
  srv.close();
}

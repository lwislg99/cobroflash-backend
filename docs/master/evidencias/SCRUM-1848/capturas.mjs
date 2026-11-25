// docs/master/evidencias/SCRUM-1848/capturas.mjs — capturas antes/después de SCRUM-1848.
// Uso: node docs/master/evidencias/SCRUM-1848/capturas.mjs <antes|despues>
// Monta Planes y Ajustes (pestañas Avisos y Facturación) como el test, con los datos del censo,
// y saca la página entera a 390 y 1280 px en esta carpeta: <fase>-<estado>-<ancho>.png
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { cargarDashboard, pintarVista, todos } from '../../../../tests/_banco-vistas.mjs';
import { serializar } from '../../../../scripts/_pagina-panel.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes } from '../../../../scripts/_hojas-del-panel.mjs';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { datosDelCenso } from '../../../../scripts/_datos-del-censo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const PUBLIC = path.join(RAIZ, 'public');
const fase = process.argv[2];
if (!['antes', 'despues'].includes(fase)) { console.error('uso: capturas.mjs <antes|despues>'); process.exit(2); }

async function montar(fn, pestana) {
  const dc = datosDelCenso();
  dc.enVista(fn);
  const datos = (u, o) => { const v = dc.datos(u, o); return v && typeof v === 'object' && 'freeMonthsEarned' in v ? { ...v, freeMonthsEarned: 1 } : v; };
  const r = await pintarVista(cargarDashboard(RAIZ, { datos }), fn);
  if (r.error) throw r.error;
  if (pestana) {
    const t = todos(r.contenedor).find((x) => typeof x.getAttribute === 'function' && x.getAttribute('role') === 'tab' && String(x.textContent).trim() === pestana);
    if (!t) throw new Error(`no encuentro la pestaña «${pestana}»`);
    t.click();
    for (let j = 0; j < 10; j++) await new Promise((ok) => setImmediate(ok));
  }
  return serializar(r.contenedor);
}

const ESTADOS = [
  ['planes', await montar('renderPlansView')],
  ['ajustes-avisos', await montar('renderSettingsView', 'Avisos')],
  ['ajustes-facturacion', await montar('renderSettingsView', 'Facturación')],
];
const cabeza = '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC) + '</head><body>';
const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  const m = /^\/__e\/(\d+)$/.exec(u);
  if (m && ESTADOS[+m[1]]) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(cabeza + ESTADOS[+m[1]][1] + '</body></html>'); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const puerto = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
const nav = await lanzarNavegador(puppeteer, {});
let hechas = 0;
try {
  for (const ancho of [390, 1280]) {
    for (const [i, [nombre]] of ESTADOS.entries()) {
      const page = await nav.newPage();
      await page.setViewport({ width: ancho, height: 900 });
      await page.goto(`http://127.0.0.1:${puerto}/__e/${i}`, { waitUntil: 'load' });
      await esperarFuentes(page);
      const f = path.join(AQUI, `${fase}-${nombre}-${ancho}.png`);
      await page.screenshot({ path: f, fullPage: true });
      await page.close();
      hechas += 1;
      console.log(`${path.basename(f)} · ${fs.statSync(f).size} B`);
    }
  }
} finally {
  await nav.close();
  srv.close();
}
console.log(`capturas ${hechas} de ${ESTADOS.length * 2}`);
process.exit(hechas === ESTADOS.length * 2 ? 0 : 1);

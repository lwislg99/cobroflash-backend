// docs/master/evidencias/SCRUM-1847/capturas.mjs — capturas de la lista de Clientes a 390 y 1280 px.
// Uso: node docs/master/evidencias/SCRUM-1847/capturas.mjs <antes|despues>
// Monta la vista REAL con el banco de la casa (`paginaDeClientes`, el mismo del guard táctil y del test
// `tests/scrum1847-clientes-44.test.mjs`), la sirve con las hojas del índice y hace una captura de página
// entera por anchura. Escribe `<sufijo>-390.png` y `<sufijo>-1280.png` junto a este fichero.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { paginaDeClientes } from '../../../../scripts/_pagina-panel.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente } from '../../../../scripts/_hojas-del-panel.mjs';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const PUBLIC = path.join(RAIZ, 'public');
const sufijo = process.argv[2];
if (!['antes', 'despues'].includes(sufijo)) { console.error('uso: capturas.mjs <antes|despues>'); process.exit(2); }

const p = await paginaDeClientes(RAIZ, { seleccionar: false });
if (!p.html) { console.error('CIEGO: la lista no monta: ' + p.aviso); process.exit(2); }
const pagina = '<!doctype html><html lang="es"><head><meta charset="utf-8">' + enlacesDelPanel(PUBLIC)
  + '</head><body>' + p.html + '</body></html>';
const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (u === '/lista') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(pagina); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const puerto = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
const nav = await lanzarNavegador(puppeteer, {});
let fallos = 0;
try {
  for (const ancho of [390, 1280]) {
    const page = await nav.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`http://127.0.0.1:${puerto}/lista`, { waitUntil: 'load' });
    const ceguera = cegueraDeLaFuente(await esperarFuentes(page), `capturas @${ancho}px`);
    if (ceguera) { console.error(ceguera); fallos += 1; }
    const destino = path.join(AQUI, `${sufijo}-${ancho}.png`);
    await page.screenshot({ path: destino, fullPage: true });
    console.log(`${path.relative(RAIZ, destino).split(path.sep).join('/')} · ${fs.statSync(destino).size} B`);
    await page.close();
  }
} finally {
  await nav.close();
  srv.close();
}
process.exit(fallos ? 1 : 0);

// Banco SCRUM-1677 (copiado del de SCRUM-1676, con los casos del parte firmado): sirve la vista y el CSS REALES. /antes/* = origin/main (copias), /despues/* = el árbol.
// Uso: node servir.mjs <raiz-del-arbol> <puerto>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [, , ARBOL, PUERTO = '55761'] = process.argv;
const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PUBLIC = path.join(ARBOL, 'public');
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };

function pagina(lado, caso) {
  const parte = {
    id: 13, jobId: 79, numero: 'PT-2026-013', clienteNombre: 'Cliente de prueba',
    fecha: '2026-11-10T08:00:00.000Z', obra: '', referencia: '', entrada: '09:00', salida: '11:00',
    desplazamientos: 0, kilometros: 0, tecnicos: [], tipo: 'averia',
    lineas: caso !== 'vacio' ? [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Cambio de grifo' }] : [],
    notas: '', estado: caso === 'firmado' ? 'firmado' : 'borrador', firmoElCliente: caso === 'firmado', firmoElTecnico: caso === 'firmado', firmadoPorNombre: 'Ana', firmadoTecnicoNombre: 'Israel',
    puedeEditarContenido: { ok: caso !== 'firmado', motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
  };
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/fonts/inter.css"><link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/${lado}/dashboard/css/styles.css"></head>
<body style="background:var(--bg);margin:0"><main style="padding:16px"><div class="card" id="c"></div></main>
<script src="/${lado}/dashboard/js/parteDetailView.js"></script>
<script>window.__ok = renderParte(document.getElementById('c'), ${JSON.stringify(parte)});</script></body></html>`;
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/banco\/(antes|despues)\/(vacio|linea|firmado)$/);
  if (m) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(pagina(m[1], m[2])); }
  let f;
  if (u.pathname.startsWith('/antes/')) f = path.join(AQUI, u.pathname);
  else if (u.pathname.startsWith('/despues/')) f = path.join(PUBLIC, u.pathname.slice('/despues'.length));
  else f = path.join(PUBLIC, u.pathname);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('404 ' + u.pathname); }
    res.writeHead(200, { 'content-type': (TIPOS[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(d);
  });
}).listen(Number(PUERTO), '127.0.0.1', () => console.log('banco listo en ' + PUERTO));



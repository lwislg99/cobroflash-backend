// SCRUM-1787e · servidor ESTÁTICO de `public/` en 127.0.0.1:5787 para los guiones de captura y la sonda
// de esta carpeta. Solo sirve ficheros (GET); /admin/* lo contesta el guion de Playwright con datos de
// EJEMPLO, nunca este servidor. Uso: node docs/master/evidencias/SCRUM-1787/guion/servidor-estatico.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..', 'public');
// El puerto, por argumento: el 5787 de 1787a/b puede estar ocupado por el servidor de OTRO árbol, y medir
// contra él es medir otro código (medido el 21-nov: lo estaba). Por defecto 5788.
const PUERTO = Number(process.argv[2] || 5788);
const TIPOS ={ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PUERTO, '127.0.0.1', () => console.log('sirviendo', RAIZ, 'en 127.0.0.1:' + PUERTO));

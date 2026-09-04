import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.join(process.cwd(), 'public');
const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = u.pathname === '/' ? '/dashboard/index.html' : u.pathname;
  const f = path.join(RAIZ, p);
  if (u.pathname.startsWith('/admin/') || u.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, partes: [], pendientes: [], items: [] }));
  }
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(404); res.end('no');
}).listen(8791, () => console.log('sirviendo public/ en http://127.0.0.1:8791'));

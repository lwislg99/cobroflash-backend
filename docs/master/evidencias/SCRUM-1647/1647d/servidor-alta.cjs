// SCRUM-1647d · Servidor del recorrido del ALTA en navegador: la `app` REAL de un `dist/` dado, con prisma
// DOBLADO (ni base de datos, ni producción, ni staging) y la política de SCRUM-1637 APLICADA o quitada.
// Mismo método que `servidor-csp.cjs` de SCRUM-1647e (J2), copiado aquí y no importado: aquél vive en
// otra rama (#3113) y este recorrido no puede depender de que entre antes.
//
// Uso:  node servidor-alta.cjs <distDir> <puerto> <aplicada|sin>
//   aplicada → la cabecera `Content-Security-Policy-Report-Only` que pone `cspSoloInforme` se escribe como
//              `Content-Security-Policy`, con el MISMO valor (paso 3 de 1637, sin tocar política ni app).
//   sin      → la cabecera de informe se quita: la página tal como se pinta hoy, sin bloquear nada.
//
// `POST /auth/register` NO llega aquí: el recorrido lo intercepta en el navegador y contesta 200, porque
// lo que mide es si el guion de la página corre bajo la política, no el alta del servidor (que no cambia).
'use strict';
const http = require('node:http');
const path = require('node:path');

const [distDir, puertoTxt, modo] = process.argv.slice(2);
if (!distDir || !puertoTxt || !['aplicada', 'sin'].includes(modo)) {
  console.error('uso: node servidor-alta.cjs <distDir> <puerto> <aplicada|sin>');
  process.exit(2);
}
const DIST = path.resolve(distDir);
const PUERTO = Number(puertoTxt);

// Doble de prisma: cualquier modelo, cualquier método → null. Si algo de la página llegara a la base,
// lo contaría `/__lecturas` (el recorrido exige 0).
let lecturasDelDoble = 0;
const modelo = new Proxy({}, { get: () => async () => { lecturasDelDoble++; return null; } });
const prismaDoble = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : modelo) });
const R_PRISMA = require.resolve(path.join(DIST, 'core/db/prisma.js'));
require.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma: prismaDoble } };

const { app } = require(path.join(DIST, 'app.js'));

const servidor = http.createServer((req, res) => {
  if (req.url === '/__lecturas') { res.end(String(lecturasDelDoble)); return; }
  // CONTROL POSITIVO SEMBRADO (no depende de ningún defecto del árbol): un `<script>` en línea y un
  // `onerror` bajo la misma política. Con la política aplicada TIENE que dar informes de `script-src`.
  if (req.url === '/__sembrado') {
    const { POLITICA_CSP } = require(path.join(DIST, 'core/http/csp.js'));
    if (modo === 'aplicada') res.setHeader('Content-Security-Policy', POLITICA_CSP);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html><head><link rel="icon" href="data:,"><script>window.__sembrado=1</script></head><body>'
      + '<img src="/no-existe/s.png" onerror="window.__sembrado2=1"></body></html>');
    return;
  }
  const original = res.setHeader.bind(res);
  res.setHeader = (n, v) => {
    if (String(n).toLowerCase() === 'content-security-policy-report-only') {
      return modo === 'aplicada' ? original('Content-Security-Policy', v) : res;
    }
    return original(n, v);
  };
  app(req, res);
});
servidor.listen(PUERTO, '127.0.0.1', () => console.log(`LISTO ${PUERTO} ${modo} ${DIST}`));

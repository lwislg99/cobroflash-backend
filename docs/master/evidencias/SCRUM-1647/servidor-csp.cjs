// SCRUM-1647e · Servidor del recorrido en navegador: la `app` REAL de un `dist/` dado, con prisma DOBLADO
// (ni base de datos, ni producción, ni staging, ni Stripe) y la política de SCRUM-1637 APLICADA.
//
// Uso:  node servidor-csp.cjs <distDir> <puerto> <aplicada|sin>
//   aplicada → la cabecera `Content-Security-Policy-Report-Only` que pone `cspSoloInforme` se escribe
//              como `Content-Security-Policy`, con el MISMO valor: es el paso 3 de 1637, sin tocar la
//              política ni el código de la app (se intercepta `res.setHeader` desde fuera).
//   sin      → la cabecera de informe se quita: la página tal como la ve hoy el navegador, sin bloquear.
//
// Los datos son FABRICADOS: un cobro pendiente de un comercio inventado, y el logo apunta a
// `/no-existe/logo.png` del propio servidor (404), así que la imagen falla por carga y no por `img-src`.
'use strict';
const http = require('node:http');
const path = require('node:path');

const [distDir, puertoTxt, modo] = process.argv.slice(2);
if (!distDir || !puertoTxt || !['aplicada', 'sin'].includes(modo)) {
  console.error('uso: node servidor-csp.cjs <distDir> <puerto> <aplicada|sin>');
  process.exit(2);
}
const DIST = path.resolve(distDir);
const PUERTO = Number(puertoTxt);

let lecturasDelDoble = 0;
function cobro() {
  lecturasDelDoble++;
  return {
    id: 7, receiptToken: 'tok1647e', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', reference: 'REF-1647E', payMethods: null,
    createdAt: new Date('2026-11-12T10:00:00Z'),
    merchant: {
      id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
      country: 'ES', logoUrl: '/no-existe/logo.png', iban: 'ES9121000418450200051332', clabe: null,
      bizumPhone: '600111222', whatsappPhone: null, connectStatus: 'none', stripeAccountId: null,
      flags: { BIZUM_MANUAL_ENABLED: true }, deletedAt: null,
    },
    customer: { id: 3, name: 'Ana', email: null },
  };
}
const prismaDoble = {
  charge: { findUnique: async () => cobro(), update: async () => cobro() },
  invoice: { findFirst: async () => null, findUnique: async () => null },
  quote: { findFirst: async () => null },
  event: { findFirst: async () => null, create: async () => { throw new Error('el recorrido no escribe'); } },
};
const R_PRISMA = require.resolve(path.join(DIST, 'core/db/prisma.js'));
require.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma: prismaDoble } };

const { app } = require(path.join(DIST, 'app.js'));

const servidor = http.createServer((req, res) => {
  if (req.url === '/__lecturas') { res.end(String(lecturasDelDoble)); return; }
  // CONTROL POSITIVO SEMBRADO: una página fabricada aquí, con un `<script>` en línea y un `onerror`,
  // bajo la misma política. Con la política aplicada TIENE que dar informes de `script-src`; si da 0,
  // el contador del recorrido está ciego. No depende de ningún defecto del árbol.
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

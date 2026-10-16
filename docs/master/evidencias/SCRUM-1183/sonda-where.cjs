// Sonda de los tres `where` de exports.routes (charges/jobs/quotes.csv). Uso:
//   node sonda-where.cjs <raiz> base|mutante <salida.json>
// mutante = los tres bloques `const where = {...}; ... ` borrados del JS compilado (en memoria).
const path = require('path');
const fs = require('fs');
const Module = require('module');
const [raiz, modo, salida] = process.argv.slice(2);
const req = Module.createRequire(path.join(raiz, 'package.json'));
const rutaRouter = path.join(raiz, 'dist/modules/exports/app/routes/exports.routes.js');

// ── la base falsa: apunta cada llamada y devuelve filas fijas ─────────────────────────────
const { prisma } = req(path.join(raiz, 'dist/core/db/prisma.js'));
const llamadas = [];
const apunta = (modelo, filas) => ({
  findMany: async (args) => { llamadas.push({ modelo, where: args && args.where }); return structuredClone(filas); },
  findUnique: async () => null, findFirst: async () => null,
  create: async () => ({}), count: async () => 0,
});
const F = new Date('2026-02-10T10:00:00Z');
prisma.charge = apunta('charge', [{ id: 1, createdAt: F, updatedAt: F, customer: { name: 'Ana' }, events: [], concepto: 'x', importe: 10, moneda: 'EUR', method: 'bizum', status: 'paid', paidAt: F, referencia: 'r' }]);
prisma.job = apunta('job', [{ id: 2, titulo: 't', status: 'done', customerId: null, operarioId: null, scheduledAt: F, createdAt: F, totalAceptado: 5, totalCobrado: 5 }]);
prisma.quote = apunta('quote', [{ id: 3, createdAt: F, customer: { name: 'Ana', email: '', phone: '' }, total: 7, currency: 'EUR', status: 'accepted', acceptedAt: F }]);
prisma.customer = apunta('customer', []);
prisma.teamMember = apunta('teamMember', []);
prisma.auditLog = apunta('auditLog', []);
prisma.merchant = apunta('merchant', []);

// ── el router, mutado o no, cargado desde su sitio (sus require relativos resuelven igual) ──
let codigo = fs.readFileSync(rutaRouter, 'utf8');
const ancla = /const where = \{ merchantId: req\.merchantId \};[\s\S]*?\n(\s*)auditExport\(/g;
const veces = (codigo.match(ancla) || []).length;
if (veces !== 3) { console.error(`CIEGO: el ancla sale ${veces} veces, no 3`); process.exit(2); }
if (modo === 'mutante') codigo = codigo.replace(ancla, '$1auditExport(');
if (modo === 'control') {
  const c = /\(req\.merchantId, \{ from, to \}, status\)/g;
  const n = (codigo.match(c) || []).length;
  if (n !== 4) { console.error(`CIEGO control: ${n}`); process.exit(2); } // + buildFacturas, fuera de la batería
  codigo = codigo.replace(c, "(req.merchantId, { from, to }, 'all')");
}
const m = new Module(rutaRouter, module);
m.filename = rutaRouter;
m.paths = Module._nodeModulePaths(path.dirname(rutaRouter));
m._compile(codigo, rutaRouter);
const router = m.exports.default;

const express = req('express');
const app = express();
app.use((r, _s, next) => { r.merchantId = 7; r.teamMemberId = null; next(); });
app.use('/x', router);

const PETICIONES = [
  '/x/charges.csv', '/x/charges.csv?from=2026-01-01&to=2026-03-31', '/x/charges.csv?status=paid&from=2026-01-01',
  '/x/jobs.csv', '/x/jobs.csv?from=2026-01-01&to=2026-03-31', '/x/jobs.csv?status=done&to=2026-03-31',
  '/x/quotes.csv', '/x/quotes.csv?from=2026-01-01&to=2026-03-31', '/x/quotes.csv?status=accepted',
];
const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const out = [];
  for (const p of PETICIONES) {
    llamadas.length = 0;
    const r = await fetch(base + p);
    const cuerpo = await r.text();
    out.push({ p, status: r.status, cuerpo, llamadas: JSON.parse(JSON.stringify(llamadas)) });
  }
  fs.writeFileSync(salida, JSON.stringify({ modo, veces, out }, null, 1));
  console.log(modo, '· peticiones', out.length, '· estados', out.map((o) => o.status).join(','), '· llamadas', out.reduce((n, o) => n + o.llamadas.length, 0));
  srv.close(); process.exit(0);
});

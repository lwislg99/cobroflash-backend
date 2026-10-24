// docs/master/evidencias/scrum1064c/repercutido-dos-rutas.mjs — SCRUM-1064c
//
// ¿Dan `GET /admin/reports/vat` y `GET /admin/modelo-303` el MISMO IVA repercutido para el mismo
// merchant y trimestre? Se fabrican facturas y se pasan por los DOS HANDLERS REALES de `dist/`
// (no una réplica del cálculo): el `prisma` singleton de `src/core/db/prisma.ts` se sustituye,
// ANTES de cargar los routers, por una base en memoria que filtra por `merchantId` y por fecha
// como lo haría Postgres. Sin red, sin base, sin escribir nada.
//
// Uso (desde la raíz del árbol, con `dist/` compilado):  node docs/master/evidencias/scrum1064c/repercutido-dos-rutas.mjs
// Sale 0 si se pudo medir (haya o no discrepancia: esto MIDE, no exige); 2 si el instrumento no llegó.
import { createRequire } from 'node:module';
import path from 'node:path';

process.env.TZ = process.env.TZ || 'UTC'; // Railway va en UTC: se mide como en producción.
const require = createRequire(path.resolve('package.json'));
const MIO = 7;
const OTRO = 8;

/** Una factura como la lee el libro. `tax` en FRACCIÓN (0.21 = 21 %). */
const factura = (o = {}) => ({
  id: 0, merchantId: MIO, number: '2026-CF-001', createdAt: new Date(Date.UTC(2026, 4, 12, 10)),
  paidAt: null, type: 'F1', total: '121.00', currency: 'EUR', status: 'pending', customerId: 3,
  quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }], ...o,
});

function enRango(v, f) {
  if (!f) return true;
  if (f.gte && !(v >= f.gte)) return false;
  if (f.gt && !(v > f.gt)) return false;
  if (f.lte && !(v <= f.lte)) return false;
  if (f.lt && !(v < f.lt)) return false;
  return true;
}

/** La base en memoria. Cuenta las consultas: un handler que no consulta no ha medido nada. */
function baseEnMemoria(facturas) {
  const consultas = { invoice: 0, expense: 0, merchant: 0 };
  return {
    consultas,
    invoice: { findMany: async ({ where }) => {
      consultas.invoice += 1;
      const campo = Object.keys(where).find((k) => k !== 'merchantId');
      return facturas.filter((f) => f.merchantId === where.merchantId && (!campo || enRango(f[campo], where[campo])));
    } },
    quote: { findMany: async () => [] },
    albaran: { findMany: async () => [] },
    expense: { findMany: async () => { consultas.expense += 1; return []; } },
    merchant: { findUnique: async ({ where }) => { consultas.merchant += 1; return { id: where.id, timezone: 'Europe/Madrid' }; } },
  };
}

let db = baseEnMemoria([]);
// El singleton: `globalForPrisma.prisma ?? new PrismaClient(...)`. Un proxy para poder cambiar de
// juego sin recargar los módulos.
globalThis.prisma = new Proxy({}, { get: (_t, k) => db[k] });

const cjs = (m) => (m.default?.stack ? m.default : m.default?.default ?? m);
const informes = cjs(require('./dist/modules/reports/app/routes/reports.routes.js'));
const r303 = cjs(require('./dist/modules/fiscal/modelo303/modelo303.routes.js'));

function llamar(router, ruta, query) {
  const capa = router.stack.find((l) => l.route?.path === ruta);
  if (!capa) { console.error(`CIEGO: no hay ruta ${ruta} en el router`); process.exit(2); }
  return new Promise((resolve, reject) => {
    capa.route.stack[0].handle(
      { merchantId: MIO, userRole: 'admin', query },
      { json: resolve, status: (c) => ({ json: (b) => reject(new Error(`HTTP ${c}: ${JSON.stringify(b)}`)) }) },
      reject,
    );
  });
}

async function medir(nombre, facturas, query) {
  db = baseEnMemoria(facturas);
  const vat = await llamar(informes, '/vat', query);
  const m = await llamar(r303, '/', query);
  if (db.consultas.invoice < 2) { console.error(`CIEGO en «${nombre}»: ${db.consultas.invoice} consultas de facturas`); process.exit(2); }
  const fila = {
    caso: nombre,
    periodo: { vat: `${vat.year}-${vat.quarter}T`, m303: `${m.año}-${m.trimestre}T` },
    cuota: { vat: vat.totals.cuota, m303_27: m.casillaTotalCuota.valor },
    base: { vat: vat.totals.base, m303_casillas: m.totalBase },
    vatTipos: vat.rates.map((r) => r.rate),
    m303SinClasificar: m.sinClasificar.map((o) => `${o.tipo}%:${o.motivo}:${o.base}/${o.cuota}`),
  };
  fila.cuotaIgual = fila.cuota.vat === fila.cuota.m303_27;
  fila.baseIgual = fila.base.vat === fila.base.m303_casillas;
  fila.periodoIgual = fila.periodo.vat === fila.periodo.m303;
  console.log(JSON.stringify(fila));
  return fila;
}

const Q2 = { year: '2026', quarter: '2' };
const filas = [];
// ① CONTROL: sólo 21/10/4 % — las dos tienen que coincidir. Si no, el instrumento está mal.
filas.push(await medir('control 21/10/4', [
  factura({ id: 1, number: 'A-1', lines: [{ concept: 'a', qty: 3, price: 33.33, tax: 0.21 }] }),
  factura({ id: 2, number: 'A-2', lines: [{ concept: 'b', qty: 1, price: 19.99, tax: 0.10 }] }),
  factura({ id: 3, number: 'A-3', lines: [{ concept: 'c', qty: 1, price: 999.99, tax: 0.04 }] }),
  factura({ id: 4, number: 'X-1', merchantId: OTRO, lines: [{ concept: 'ajena', qty: 1, price: 500, tax: 0.21 }] }),
  factura({ id: 5, number: 'A-4', createdAt: new Date(Date.UTC(2026, 6, 2, 10)) }), // 3T: fuera
], Q2));
// ② una línea al 0 %
filas.push(await medir('con 0 %', [
  factura({ id: 1, number: 'B-1' }),
  factura({ id: 2, number: 'B-2', lines: [{ concept: 'exento?', qty: 1, price: 150, tax: 0 }] }),
], Q2));
// ③ una línea a un tipo sin tripleta (5 %)
filas.push(await medir('con 5 %', [
  factura({ id: 1, number: 'C-1' }),
  factura({ id: 2, number: 'C-2', lines: [{ concept: 'tipo raro', qty: 1, price: 200, tax: 0.05 }] }),
], Q2));
// ④ sin trimestre en la petición, a las 22:30Z del 30-jun (00:30 del 1-jul en Madrid)
{
  const RealDate = Date;
  const fijo = RealDate.UTC(2026, 5, 30, 22, 30);
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fijo])); } static now() { return fijo; } };
  try {
    filas.push(await medir('sin trimestre, 30-jun 22:30Z', [
      factura({ id: 1, number: 'D-1', createdAt: new RealDate(RealDate.UTC(2026, 4, 12, 10)) }),
      factura({ id: 2, number: 'D-2', createdAt: new RealDate(RealDate.UTC(2026, 6, 1, 8)) }),
    ], {}));
  } finally { globalThis.Date = RealDate; }
}

const [control] = filas;
if (!control.cuotaIgual || !control.baseIgual || control.cuota.vat <= 0) {
  console.error('CIEGO: el control no cuadra o sale a cero; el instrumento no mide lo que dice.');
  process.exit(2);
}
console.log(`población: ${filas.length} casos · discrepan en cuota: ${filas.filter((f) => !f.cuotaIgual).length} · en base: ${filas.filter((f) => !f.baseIgual).length} · en periodo: ${filas.filter((f) => !f.periodoIgual).length}`);

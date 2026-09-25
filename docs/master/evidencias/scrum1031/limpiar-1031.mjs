// Limpieza puntual: borra SOLO los presupuestos y el cliente «ZZZ PRUEBA 1031 …» que dejó la
// sonda (su DELETE de cliente dio 500 — FK: un cliente con presupuestos no se puede borrar por
// la API). Regla 9: el secret file se lee EN RUNTIME; al chat solo van hosts y conteos.
// Uso: node limpiar-1031.mjs
import { readFileSync } from 'node:fs';

const SECRETS = 'D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt';
const raw = readFileSync(SECRETS, 'utf8');
const m = raw.match(/^(?:STAGING_DATABASE_URL|DATABASE_URL_STAGING|DATABASE_URL)=(.+)$/m);
if (!m) { console.error('NO-DB: sin DATABASE_URL de staging en el secret file'); process.exit(2); }
const dbUrl = m[1].trim();
if (dbUrl.includes('autorack.proxy.rlwy.net')) { console.error('❌ DATABASE_URL apunta a PRODUCCIÓN — abortado.'); process.exit(1); }
let host = 'desconocido';
try { host = new URL(dbUrl.replace(/^postgres(ql)?:/, 'http:')).hostname; } catch {}
console.log('BD staging host:', host);

process.env.DATABASE_URL = dbUrl;
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const nombre = 'ZZZ PRUEBA 1031 cliente';
const clientes = await prisma.customer.findMany({ where: { name: nombre }, select: { id: true, merchantId: true } });
console.log('clientes encontrados:', clientes.map((c) => c.id));

let quotesBorrados = 0;
let eventosBorrados = 0;
let clientesBorrados = 0;
for (const c of clientes) {
  const q = await prisma.quote.deleteMany({ where: { customerId: c.id, merchantId: c.merchantId } });
  quotesBorrados += q.count;
  const e = await prisma.customerEvent.deleteMany({ where: { customerId: c.id, merchantId: c.merchantId } }).catch(() => ({ count: 0 }));
  eventosBorrados += e.count;
  const del = await prisma.customer.deleteMany({ where: { id: c.id, merchantId: c.merchantId } });
  clientesBorrados += del.count;
}
console.log(JSON.stringify({ quotesBorrados, eventosBorrados, clientesBorrados }, null, 2));

const quedan = await prisma.customer.count({ where: { name: nombre } });
console.log('CONTROL: clientes «' + nombre + '» que quedan =', quedan);
await prisma.$disconnect();
process.exit(quedan === 0 ? 0 : 1);

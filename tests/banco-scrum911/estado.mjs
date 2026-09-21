// SCRUM-911 · PASO 0 · estado HOY de MANT-1 en staging (solo lectura).
import { prismaStaging, sesionQA, BASE } from './_entorno.mjs';

const { db, base, host } = await prismaStaging();
console.log(`BD: ${base} @ ${host}`);
const ver = await (await fetch(`${BASE}/version`)).json();
console.log('staging /version:', ver.version);

const m2 = await db.merchant.findUnique({ where: { id: 2 }, select: { id: true, email: true, country: true, trade: true, flags: true, whatsappPhone: true } });
console.log('merchant 2:', { ...m2, whatsappPhone: m2?.whatsappPhone ? `…${String(m2.whatsappPhone).slice(-3)}` : null });

const conOverride = await db.$queryRaw`select id, flags->'MAINTENANCE_ENABLED' as v from merchants where flags ? 'MAINTENANCE_ENABLED'`;
console.log('merchants con override MAINTENANCE_ENABLED:', conOverride);
const totalMerchants = await db.merchant.count();
console.log('merchants en staging:', totalMerchants);

const planes = await db.maintenancePlan.groupBy({ by: ['merchantId', 'active'], _count: { _all: true } });
console.log('planes por merchant/activo:', planes);
const vencidos = await db.maintenancePlan.findMany({ where: { active: true, nextDueAt: { lte: new Date() } }, select: { id: true, merchantId: true, customerId: true, nextDueAt: true } });
console.log('planes activos vencidos HOY:', vencidos.length, vencidos.slice(0, 20));
const drafts = await db.quote.count({ where: { origin: 'maintenance' } });
console.log('quotes origin=maintenance (toda la BD):', drafts);

const { api } = await sesionQA();
const post = await api('POST', '/admin/maintenance', { customerId: 3927, title: 'sonda', intervalMonths: 12 });
console.log('POST /admin/maintenance (flag?):', post.status, post.json);
const q = await api('GET', '/admin/quotes/1881');
console.log('GET /admin/quotes/1881 → status', q.json?.status, '· clave maintenance:', JSON.stringify(q.json?.maintenance));
const c = await db.customer.findUnique({ where: { id: 3927 }, select: { id: true, merchantId: true, name: true, waOptOut: true } });
console.log('cliente 3927:', c);
await db.$disconnect();

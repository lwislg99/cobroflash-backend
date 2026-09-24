// SCRUM-911 · DEVOLVER el fixture COMPARTIDO merchant QA 2 a como estaba (merchant2-antes.json)
// y dejar constancia de lo que queda escrito en staging (planes y borradores del recorrido).
//
// Se ejecuta SIEMPRE al acabar, aunque el recorrido haya fallado a medias. El flag vuelve a su
// valor previo (OFF) por decisión del orquestador: `runMaintenanceProposals` es un ciclo GLOBAL
// diario a las 10:00 UTC, y un flag olvidado encendido propone solo mañana sin nadie mirando.
import fs from 'node:fs';
import { prismaStaging } from './_entorno.mjs';

const { db, base } = await prismaStaging();
if (base !== 'railway') throw new Error('base inesperada');

const antes = JSON.parse(fs.readFileSync('./merchant2-antes.json', 'utf8'));
await db.merchant.update({ where: { id: 2 }, data: { flags: antes.flags ?? null, trade: antes.trade ?? null } });
const ahora = await db.merchant.findUnique({ where: { id: 2 }, select: { flags: true, trade: true } });
console.log('merchant 2 RESTAURADO:', ahora);
console.log('coincide con el original:', JSON.stringify(ahora) === JSON.stringify(antes) ? 'sí' : `NO (antes=${JSON.stringify(antes)})`);

// Lo que el recorrido deja escrito, dicho en voz alta (no se borra: es la evidencia del PASO 0).
const planes = await db.maintenancePlan.findMany({ select: { id: true, merchantId: true, customerId: true, quoteId: true, active: true, nextDueAt: true, lastProposedAt: true, rejectedStreak: true } });
console.log('MaintenancePlan en staging:', planes);
const drafts = await db.quote.findMany({ where: { origin: 'maintenance' }, select: { id: true, merchantId: true, quoteNumber: true, status: true, total: true } });
console.log('quotes origin=maintenance:', drafts);
await db.$disconnect();

// SCRUM-911 · lo que se quita del fixture COMPARTIDO al acabar, y lo que se deja dicho.
//
// SE QUITA lo que fabriqué a mano y no es evidencia de nada que haga el producto:
//   · el presupuesto #9001 (1887), creado con `prisma.quote.create` para poder pulsar «Aprobar»;
//     su `quoteNumber` inventado no lo produjo el contador y en una lista compartida solo estorba.
//   · el plan 6, que quedó ACTIVO. Con el flag ya en OFF sería inerte (`flag_off`), pero un plan
//     activo en un fixture de otros es justo la clase de resto que luego nadie sabe de quién es.
//
// SE DEJA el borrador #16 (1889): lo creó el CICLO de verdad y es la prueba del recorrido. Y los
// planes 1-5, ya inactivos, con su historia (2 «posponer» → pausa, un «cancelar»).
import { prismaStaging } from './_entorno.mjs';

const { db, base } = await prismaStaging();
if (base !== 'railway') throw new Error('base inesperada');

await db.quote.deleteMany({ where: { id: 1887, merchantId: 2, origin: 'maintenance', status: 'draft' } });
await db.maintenancePlan.updateMany({ where: { merchantId: 2, active: true }, data: { active: false } });

const m = await db.merchant.findUnique({ where: { id: 2 }, select: { flags: true, trade: true } });
const activos = await db.maintenancePlan.count({ where: { active: true } });
const total = await db.maintenancePlan.count();
const drafts = await db.quote.findMany({ where: { origin: 'maintenance' }, select: { id: true, quoteNumber: true, status: true, total: true } });
console.log('merchant 2:', m);
console.log(`MaintenancePlan: ${total} en total, ${activos} activos`);
console.log('quotes origin=maintenance que quedan:', drafts);
await db.$disconnect();

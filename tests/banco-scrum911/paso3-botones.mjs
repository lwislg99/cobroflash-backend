// SCRUM-911 · PASO 0 · tramo 3: los BOTONES que el pro contesta por WhatsApp.
//
// `handleMaintenanceButton` es lo que el webhook llama al recibir `mant_(ok|later|cancel)_{plan}_{draft}`
// (whatsappIncoming.routes.ts). Aquí se llama a la función directamente: el webhook real necesita
// una entrega de Meta, que es justo lo que este entorno no puede tener.
//
// ⚠️ `later`/`ok`/`cancel` usan `Date.now()` REAL (no el `now` simulado del ciclo): las fechas que
// escriben salen de hoy, y así se leen los veredictos.
// 🔴 Sin credenciales de WhatsApp: `replyToPro` y `sendQuoteWhatsAppToCustomer` devuelven
// `not_configured` y no tocan la red. Se comprueba antes de correr.
import fs from 'node:fs';
import { cargarSecretos, imp } from './_entorno.mjs';

const secretos = cargarSecretos();
process.env.DATABASE_URL = secretos.DATABASE_URL_STAGING;
delete process.env.WHATSAPP_PHONE_NUMBER_ID;
delete process.env.WHATSAPP_TOKEN;

const { parseBDSegura, STAGING_HOST } = await imp('scripts/_db-guard.mjs');
const p = parseBDSegura(process.env.DATABASE_URL);
if (!p || p.host !== STAGING_HOST) throw new Error(`NO ES STAGING (host=${p?.host ?? 'ilegible'})`);
const { config } = await imp('dist/core/config/env.js');
if (config.WHATSAPP_PHONE_NUMBER_ID || config.WHATSAPP_TOKEN) throw new Error('ABORTA: hay credenciales de WhatsApp');

const { prisma } = await imp('dist/core/db/prisma.js');
const { handleMaintenanceButton, runMaintenanceProposals } = await imp('dist/modules/maintenance/domain/maintenance.service.js');

const { planId } = JSON.parse(fs.readFileSync('./paso1.json', 'utf8'));
const { draftId } = JSON.parse(fs.readFileSync('./paso2.json', 'utf8'));
const merchant = await prisma.merchant.findUnique({ where: { id: 2 }, select: { whatsappPhone: true } });
const R = {};

// ── 0 · EL TOTAL DEL BORRADOR, que es dinero y no cuadra ───────────────────────────────────
// El ciclo calcula `price = line.price * line.qty` (maintenance.service.ts:344) y guarda eso como
// `Quote.total`. `POST /quote/create` calcula el MISMO tipo de línea con `calcTotal`, que
// multiplica por `(1 + tax)` (utils.ts:224-228). Dos aritméticas para la misma línea.
{
  const d = await prisma.quote.findUnique({ where: { id: draftId }, select: { total: true, lines: true } });
  const l = d.lines[0];
  const conIva = Math.round(Number(l.qty) * Number(l.price) * (1 + Number(l.tax || 0)) * 100) / 100;
  console.log(`borrador ${draftId}: total guardado=${d.total} · línea ${l.price}×${l.qty} al ${Number(l.tax) * 100}% → calcTotal daría ${conIva}`);
  R.totalDelBorradorCuadra = Number(d.total) === conIva ? 'funciona' : `FALLA (guardado ${d.total}, con IVA ${conIva})`;
}

// ── 1 · POSPONER (1.º): streak 1, sigue activo, +30 d, y el borrador se borra ──────────────
const antes1 = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
const ok1 = await handleMaintenanceButton(merchant.whatsappPhone, 'later', planId, draftId);
const tras1 = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
const draftTras1 = await prisma.quote.findUnique({ where: { id: draftId } });
console.log('later #1 →', ok1, { streak: tras1.rejectedStreak, active: tras1.active, nextDueAt: tras1.nextDueAt, borrador: draftTras1 ? 'sigue' : 'borrado' });
R.posponer1 = ok1 && tras1.rejectedStreak === antes1.rejectedStreak + 1 && tras1.active === true && draftTras1 === null
  ? 'funciona' : `falla (ok=${ok1} streak=${tras1.rejectedStreak} active=${tras1.active} borrador=${draftTras1 ? 'sigue' : 'borrado'})`;
const en30d = Math.round((tras1.nextDueAt.getTime() - Date.now()) / (24 * 3600 * 1000));
R.posponer30d = en30d === 30 ? 'funciona' : `falla (${en30d} días)`;

// ── 2 · un segundo ciclo para tener otro borrador, y POSPONER (2.º): pausa ─────────────────
// El cooldown de 90 d/cliente manda, así que el `now` del 2.º ciclo va 91 días después del 1.º.
const { now: now1 } = JSON.parse(fs.readFileSync('./paso2.json', 'utf8'));
const now2 = new Date(new Date(now1).getTime() + 91 * 24 * 3600 * 1000);
await prisma.maintenancePlan.update({ where: { id: planId }, data: { nextDueAt: new Date(now2.getTime() - 3600 * 1000) } });
const ajenos2 = (await prisma.maintenancePlan.findMany({ where: { active: true, nextDueAt: { lte: now2 } }, select: { id: true } })).filter((x) => x.id !== planId);
if (ajenos2.length) throw new Error(`ABORTA: planes ajenos entrarían en el 2.º ciclo: ${JSON.stringify(ajenos2)}`);
const res2 = await runMaintenanceProposals(now2);
console.log('2.º ciclo →', res2);
const draft2 = await prisma.quote.findFirst({ where: { origin: 'maintenance', merchantId: 2 }, orderBy: { id: 'desc' } });
console.log('2.º borrador:', draft2?.id, draft2?.status);

const ok2 = await handleMaintenanceButton(merchant.whatsappPhone, 'later', planId, draft2.id);
const tras2 = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
const draftTras2 = await prisma.quote.findUnique({ where: { id: draft2.id } });
console.log('later #2 →', ok2, { streak: tras2.rejectedStreak, active: tras2.active, borrador: draftTras2 ? 'sigue' : 'borrado' });
R.dosPosponerPausan = ok2 && tras2.rejectedStreak === 2 && tras2.active === false ? 'funciona' : `falla (streak=${tras2.rejectedStreak} active=${tras2.active})`;

// ── 3 · un plan pausado NO vuelve a entrar en el ciclo ─────────────────────────────────────
const res3 = await runMaintenanceProposals(new Date(now2.getTime() + 200 * 24 * 3600 * 1000));
console.log('3.er ciclo (plan pausado) →', res3);
R.pausadoNoVuelve = res3.due === 0 && res3.proposed === 0 ? 'funciona' : `falla (${JSON.stringify(res3)})`;

// ── 4 · TELÉFONO AJENO: el botón de quien no es el pro del plan se ignora ──────────────────
const ajeno = await handleMaintenanceButton('34600000999', 'cancel', planId, draft2.id);
console.log('botón desde teléfono ajeno →', ajeno);
const trasAjeno = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
R.telefonoAjeno = ajeno === false ? 'funciona' : 'falla';

// ── 5 · APROBAR y CANCELAR sobre un plan NUEVO (el primero quedó pausado) ──────────────────
const plan2 = await prisma.maintenancePlan.create({
  data: { merchantId: 2, customerId: 3927, quoteId: null, title: 'SCRUM-911 · plan para ok/cancel', intervalMonths: 12, nextDueAt: new Date(Date.now() - 1000) },
});
const draftOk = await prisma.quote.create({
  data: { merchantId: 2, customerId: 3927, quoteNumber: 9001, status: 'draft', origin: 'maintenance', createdVia: 'maintenance', total: '100.00', currency: 'EUR', lines: [{ concept: 'SCRUM-911 ok', qty: 1, price: 100, tax: 0.21 }] },
});
const okAprobar = await handleMaintenanceButton(merchant.whatsappPhone, 'ok', plan2.id, draftOk.id);
const plan2Tras = await prisma.maintenancePlan.findUnique({ where: { id: plan2.id } });
const draftOkTras = await prisma.quote.findUnique({ where: { id: draftOk.id }, select: { id: true, status: true } });
const enMeses = Math.round((plan2Tras.nextDueAt.getTime() - Date.now()) / (30.44 * 24 * 3600 * 1000));
console.log('ok →', okAprobar, { streak: plan2Tras.rejectedStreak, nextDueAt: plan2Tras.nextDueAt, borrador: draftOkTras });
R.aprobar = okAprobar && plan2Tras.rejectedStreak === 0 && enMeses === 12 ? 'funciona' : `falla (ok=${okAprobar} streak=${plan2Tras.rejectedStreak} meses=${enMeses})`;
// El envío al cliente NO ocurre (sin credenciales): el borrador NO se borra y sigue en el panel.
R.aprobarSinCanalDejaElBorrador = draftOkTras?.status === 'draft' ? 'funciona' : `ojo: status=${draftOkTras?.status}`;

const draftCancel = await prisma.quote.create({
  data: { merchantId: 2, customerId: 3927, quoteNumber: 9002, status: 'draft', origin: 'maintenance', createdVia: 'maintenance', total: '100.00', currency: 'EUR', lines: [{ concept: 'SCRUM-911 cancel', qty: 1, price: 100, tax: 0.21 }] },
});
const okCancel = await handleMaintenanceButton(merchant.whatsappPhone, 'cancel', plan2.id, draftCancel.id);
const plan2Fin = await prisma.maintenancePlan.findUnique({ where: { id: plan2.id } });
const draftCancelTras = await prisma.quote.findUnique({ where: { id: draftCancel.id } });
console.log('cancel →', okCancel, { active: plan2Fin.active, borrador: draftCancelTras ? 'sigue' : 'borrado' });
R.cancelar = okCancel && plan2Fin.active === false && draftCancelTras === null ? 'funciona' : `falla (active=${plan2Fin.active})`;

// ── 6 · con el flag APAGADO, el botón no hace nada ────────────────────────────────────────
await prisma.merchant.update({ where: { id: 2 }, data: { flags: { MAINTENANCE_ENABLED: false } } });
const plan3 = await prisma.maintenancePlan.create({
  data: { merchantId: 2, customerId: 3927, title: 'SCRUM-911 · flag off', intervalMonths: 12, nextDueAt: new Date(Date.now() - 1000) },
});
const conFlagOff = await handleMaintenanceButton(merchant.whatsappPhone, 'cancel', plan3.id, draftOk.id);
const plan3Tras = await prisma.maintenancePlan.findUnique({ where: { id: plan3.id } });
console.log('botón con flag OFF →', conFlagOff, '· plan sigue activo:', plan3Tras.active);
R.botonConFlagOff = conFlagOff === false && plan3Tras.active === true ? 'funciona' : `falla (ok=${conFlagOff} active=${plan3Tras.active})`;
await prisma.merchant.update({ where: { id: 2 }, data: { flags: { MAINTENANCE_ENABLED: true } } });

fs.writeFileSync('./paso3.json', JSON.stringify({ planId, plan2: plan2.id, plan3: plan3.id, R }, null, 2));
console.log('VEREDICTOS tramo 3:', R);
await prisma.$disconnect();

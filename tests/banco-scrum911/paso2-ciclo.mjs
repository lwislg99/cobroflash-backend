// SCRUM-911 · PASO 0 · tramo 2: el CICLO del cron, con `now` SIMULADO.
//
// ⚠️ NO se tocan fechas en la base. `runMaintenanceProposals` recibe el `now` por parámetro, así
// que se le pasa una fecha futura y el plan real se queda con su `nextDueAt` de verdad hasta que
// el propio ciclo lo reprograme. Mover fechas en la BD de un fixture compartido sería ensuciar.
//
// 🔴 EL CICLO ES GLOBAL: `seleccionarLotes(now)` recorre TODOS los merchants. Con un `now` a un
// año vista podría barrer planes de otras sesiones. Por eso, ANTES de llamarlo, se aborta si hay
// algún plan activo vencido a ese `now` que no sea el mío.
//
// 🔴 NADA SALE A META: este proceso no lleva credenciales de WhatsApp, y se COMPRUEBA antes de
// correr (`config.WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_TOKEN` vacíos → los senders devuelven
// `not_configured` sin tocar la red, `whatsapp.ts:632`). Si alguna estuviera puesta, se aborta.
import fs from 'node:fs';
import { cargarSecretos, imp, WT } from './_entorno.mjs';

const secretos = cargarSecretos();
process.env.DATABASE_URL = secretos.DATABASE_URL_STAGING;
delete process.env.WHATSAPP_PHONE_NUMBER_ID;
delete process.env.WHATSAPP_TOKEN;

const { parseBDSegura, STAGING_HOST } = await imp('scripts/_db-guard.mjs');
const p = parseBDSegura(process.env.DATABASE_URL);
if (!p || p.host !== STAGING_HOST) throw new Error(`NO ES STAGING (host=${p?.host ?? 'ilegible'})`);

const { config } = await imp('dist/core/config/env.js');
const creds = { id: !!config.WHATSAPP_PHONE_NUMBER_ID, token: !!config.WHATSAPP_TOKEN };
console.log('credenciales de WhatsApp en ESTE proceso:', creds);
if (creds.id || creds.token) throw new Error('ABORTA: hay credenciales de WhatsApp; este recorrido podría enviar de verdad');

const { prisma } = await imp('dist/core/db/prisma.js');
const [{ current_database }] = await prisma.$queryRaw`select current_database()`;
if (current_database !== 'railway') throw new Error(`base inesperada: ${current_database}`);
console.log('BD del proceso:', current_database);

const { planId, quoteId } = JSON.parse(fs.readFileSync('./paso1.json', 'utf8'));
const mio = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
if (!mio) throw new Error(`no existe el plan ${planId}`);
console.log('MI plan:', mio);

// `now` = nextDueAt + 1 día, a las 12:00 de Madrid (fuera de horas tranquilas, 9-21h).
const d = new Date(mio.nextDueAt.getTime() + 24 * 3600 * 1000);
const now = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10, 0, 0)); // 12:00 Madrid (CEST)
console.log('now SIMULADO:', now.toISOString(), '· hora Madrid:',
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(now));

// ── LA PUERTA: ningún plan ajeno puede entrar en este ciclo ────────────────────────────────
const vencidosAlNow = await prisma.maintenancePlan.findMany({
  where: { active: true, nextDueAt: { lte: now } },
  select: { id: true, merchantId: true, customerId: true, nextDueAt: true },
});
console.log('planes activos vencidos al now simulado:', vencidosAlNow);
const ajenos = vencidosAlNow.filter((v) => v.id !== planId);
if (ajenos.length) throw new Error(`ABORTA: ${ajenos.length} plan(es) que no son míos entrarían en el ciclo: ${JSON.stringify(ajenos)}`);

const eventosAntes = await prisma.customerEvent.count({ where: { customerId: mio.customerId } });
const draftsAntes = await prisma.quote.count({ where: { origin: 'maintenance' } });

// ── EL CICLO ───────────────────────────────────────────────────────────────────────────────
const { runMaintenanceProposals } = await imp('dist/modules/maintenance/domain/maintenance.service.js');
const res = await runMaintenanceProposals(now);
console.log('runMaintenanceProposals →', res);

// ── QUÉ DEJÓ ───────────────────────────────────────────────────────────────────────────────
const R = {};
R.cicloPropone = res.due === 1 && res.proposed === 1 ? 'funciona' : 'falla';

const drafts = await prisma.quote.findMany({
  where: { origin: 'maintenance' },
  select: { id: true, merchantId: true, customerId: true, quoteNumber: true, status: true, total: true, currency: true, lines: true, createdVia: true },
});
console.log('borradores origin=maintenance:', JSON.stringify(drafts, null, 2));
const draft = drafts.find((q) => q.merchantId === 2);
R.borradorCreado = drafts.length === draftsAntes + 1 && draft?.status === 'draft' && draft?.createdVia === 'maintenance' ? 'funciona' : 'falla';
// El precio del borrador sale de la línea mantenible del presupuesto origen (320 €, no el total 417,45).
R.borradorHeredaLinea = Number(draft?.total) === 320 ? 'funciona' : `falla (total=${draft?.total})`;

const planDespues = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
console.log('plan DESPUÉS:', planDespues);
const esperadoNextDue = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
R.planReprogramado = planDespues.lastProposedAt?.getTime() === now.getTime()
  && planDespues.nextDueAt?.getTime() === esperadoNextDue.getTime() ? 'funciona'
  : `falla (lastProposedAt=${planDespues.lastProposedAt?.toISOString()} nextDueAt=${planDespues.nextDueAt?.toISOString()} esperado=${esperadoNextDue.toISOString()})`;

// `recordCustomerEvent` se llama SIN await en el bucle (maintenance.service.ts:395): se espera un
// instante antes de contar, o se mediría una carrera y no el efecto.
await new Promise((r) => setTimeout(r, 1500));
const eventos = await prisma.customerEvent.findMany({
  where: { customerId: mio.customerId }, orderBy: { id: 'desc' }, take: 3,
  select: { id: true, type: true, title: true, detail: true },
});
console.log('últimos CustomerEvent del cliente:', eventos);
const ev = eventos.find((e) => e.type === 'maintenance_proposed');
R.eventoEnFicha = ev ? 'funciona' : 'falla';
R.eventoDiceQueElWAFalló = ev && /not_configured/.test(ev.detail ?? '') ? 'funciona' : `falla (detail=${ev?.detail})`;

fs.writeFileSync('./paso2.json', JSON.stringify({ now: now.toISOString(), quoteId, planId, draftId: draft?.id, res, R }, null, 2));
console.log('VEREDICTOS tramo 2:', R);
await prisma.$disconnect();

// SCRUM-911 · PASO 0 · tramo 4: QUÉ VE EL PRO por la API que pinta las pantallas.
//
// Deja a propósito UN borrador vivo del ciclo (el que la pantalla tiene que enseñar) y un plan
// activo colgando del presupuesto aceptado, para el recorrido visual de `paso5-pantalla.mjs`.
import fs from 'node:fs';
import { cargarSecretos, imp, sesionQA } from './_entorno.mjs';

const secretos = cargarSecretos();
process.env.DATABASE_URL = secretos.DATABASE_URL_STAGING;
delete process.env.WHATSAPP_PHONE_NUMBER_ID;
delete process.env.WHATSAPP_TOKEN;

const { parseBDSegura, STAGING_HOST } = await imp('scripts/_db-guard.mjs');
if (parseBDSegura(process.env.DATABASE_URL)?.host !== STAGING_HOST) throw new Error('NO ES STAGING');
const { config } = await imp('dist/core/config/env.js');
if (config.WHATSAPP_PHONE_NUMBER_ID || config.WHATSAPP_TOKEN) throw new Error('ABORTA: hay credenciales de WhatsApp');

const { prisma } = await imp('dist/core/db/prisma.js');
const { runMaintenanceProposals } = await imp('dist/modules/maintenance/domain/maintenance.service.js');
const { quoteId } = JSON.parse(fs.readFileSync('./paso1.json', 'utf8'));
const R = {};

// `now` posterior al cooldown de 90 d del cliente (el plan 1 se propuso el 2027-12-18).
const now = new Date('2028-04-01T10:00:00Z');

// ── LA PUERTA, ANTES DE CREAR NADA ─────────────────────────────────────────────────────────
// El ciclo es GLOBAL: un plan de OTRO merchant vencido a este `now` recibiría una propuesta de
// verdad. Eso aborta, y no se negocia.
const deOtros = await prisma.maintenancePlan.findMany({
  where: { active: true, nextDueAt: { lte: now }, merchantId: { not: 2 } }, select: { id: true, merchantId: true },
});
if (deOtros.length) throw new Error(`ABORTA: planes de otros merchants entrarían: ${JSON.stringify(deOtros)}`);

// Los planes activos de merchant 2 son TODOS míos —a las 18:26Z había 0 MaintenancePlan en toda la
// base—, y son restos de los tramos anteriores (el del control «flag OFF», que quedó activo a
// propósito, y los de una pasada abortada). Se retiran aquí, que es donde estorban.
const restos = await prisma.maintenancePlan.updateMany({ where: { merchantId: 2, active: true }, data: { active: false } });
console.log('planes propios retirados antes del ciclo de pantalla:', restos.count);

// Un plan NUEVO colgado del presupuesto aceptado 1884 (el primero quedó pausado por los 2 «later»).
const plan = await prisma.maintenancePlan.create({
  data: { merchantId: 2, customerId: 3927, quoteId, title: 'Revisión de termo/calentador', intervalMonths: 12, nextDueAt: new Date('2028-03-31T00:00:00Z') },
});
const res = await runMaintenanceProposals(now);
console.log('ciclo para la pantalla →', res);
const draft = await prisma.quote.findFirst({ where: { origin: 'maintenance', merchantId: 2 }, orderBy: { id: 'desc' } });
console.log('borrador del ciclo:', draft.id, '· quoteNumber', draft.quoteNumber, '· total', draft.total);

const { api } = await sesionQA();

// 1 · el DETALLE del presupuesto aceptado: bloque maintenance con el plan vivo (el toggle marcado).
const det = await api('GET', `/admin/quotes/${quoteId}`);
console.log(`GET /admin/quotes/${quoteId} → maintenance =`, JSON.stringify(det.json?.maintenance));
R.detalleMuestraElPlan = det.json?.maintenance?.plan?.id === plan.id ? 'funciona' : 'falla';

// 2 · el BORRADOR del ciclo, tal como lo sirve la API que pinta el detalle.
const detDraft = await api('GET', `/admin/quotes/${draft.id}`);
const l = detDraft.json?.lines?.[0];
const conIva = Math.round(Number(l?.qty) * Number(l?.price) * (1 + Number(l?.tax || 0)) * 100) / 100;
console.log(`GET /admin/quotes/${draft.id} → status=${detDraft.json?.status} total=${detDraft.json?.total} lines=${JSON.stringify(detDraft.json?.lines)}`);
R.borradorEnLaApi = detDraft.status === 200 && detDraft.json?.status === 'draft' ? 'funciona' : 'falla';
R.totalQueVeElPro = Number(detDraft.json?.total) === conIva
  ? 'funciona' : `FALLA (la API sirve ${detDraft.json?.total} y la línea al ${Number(l?.tax) * 100}% suma ${conIva})`;

// 3 · el borrador aparece en la LISTA de presupuestos.
const lista = await api('GET', '/admin/quotes?limit=10');
const filas = lista.json?.items ?? lista.json?.quotes ?? lista.json ?? [];
const enLista = Array.isArray(filas) ? filas.find((q) => q.id === draft.id) : null;
console.log('lista de presupuestos: status', lista.status, '· ¿está el borrador?', !!enLista, enLista ? JSON.stringify(enLista).slice(0, 200) : '');
R.borradorEnLaLista = enLista ? 'funciona' : `falla (status=${lista.status}, ${Array.isArray(filas) ? filas.length : 'forma inesperada'} filas)`;

// 4 · la FICHA 360 del cliente: los eventos del ciclo.
const ficha = await api('GET', '/admin/customers/3927');
const eventos = ficha.json?.events ?? ficha.json?.customerEvents ?? null;
console.log('GET /admin/customers/3927 → status', ficha.status, '· claves:', Object.keys(ficha.json ?? {}).join(', '));
const propuestas = Array.isArray(eventos) ? eventos.filter((e) => e.type === 'maintenance_proposed') : null;
console.log('eventos maintenance_proposed en la ficha:', propuestas ? propuestas.length : 'la ficha no trae eventos en esta ruta');
R.fichaDelCliente = propuestas?.length ? 'funciona' : `no pude mirar por esta ruta (status=${ficha.status})`;

fs.writeFileSync('./paso4.json', JSON.stringify({ planId: plan.id, draftId: draft.id, quoteId, R }, null, 2));
console.log('VEREDICTOS tramo 4 (API):', R);
await prisma.$disconnect();

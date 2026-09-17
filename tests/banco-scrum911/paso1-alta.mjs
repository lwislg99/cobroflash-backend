// SCRUM-911 · PASO 0 · tramo 1: encender (merchant QA) → presupuesto aceptado → sugerencia → alta del plan.
//
// ⚠️ `merchant2-antes.json` NO se sobreescribe si ya existe: en una segunda pasada el estado
// "antes" ya es el ENCENDIDO, y guardarlo perdería para siempre el original (flags null, trade
// null). El fixture es COMPARTIDO; restaurarlo mal es peor que no restaurarlo.
import fs from 'node:fs';
import { prismaStaging, sesionQA } from './_entorno.mjs';

const R = {}; // veredictos
const { db, base } = await prismaStaging();
if (base !== 'railway') throw new Error('base inesperada');
const { api } = await sesionQA();

const antes = await db.merchant.findUnique({ where: { id: 2 }, select: { flags: true, trade: true } });
if (fs.existsSync('./merchant2-antes.json')) {
  console.log('merchant2-antes.json YA existe (no se toca):', fs.readFileSync('./merchant2-antes.json', 'utf8'));
} else {
  fs.writeFileSync('./merchant2-antes.json', JSON.stringify(antes));
}
console.log('merchant 2 AHORA:', antes);

// Control negativo con el flag apagado. Solo tiene sentido si el flag está REALMENTE apagado:
// en una segunda pasada ya está encendido y este control no mide nada, así que se declara.
const flagYaOn = !!(antes.flags && typeof antes.flags === 'object' && antes.flags.MAINTENANCE_ENABLED);
if (flagYaOn) {
  console.log('flag OFF · control negativo → NO MEDIDO en esta pasada (el flag ya estaba ON)');
  R.flagApagado404 = 'no pude mirar (ya estaba ON en esta pasada)';
} else {
  const off = await api('POST', '/admin/maintenance', { customerId: 3927, title: 'sonda', intervalMonths: 12 });
  console.log('flag OFF · POST /admin/maintenance →', off.status, off.json);
  R.flagApagado404 = off.status === 404 && off.json?.error === 'not_found' ? 'funciona' : 'falla';
}

// 1 · ENCENDER solo para el merchant QA (override de merchant, Parte P: opt-in por merchant).
const flags = { ...(antes.flags && typeof antes.flags === 'object' ? antes.flags : {}), MAINTENANCE_ENABLED: true };
await db.merchant.update({ where: { id: 2 }, data: { flags, trade: 'fontanero' } });
console.log('merchant 2 DESPUÉS:', await db.merchant.findUnique({ where: { id: 2 }, select: { flags: true, trade: true } }));

// 2 · presupuesto con una línea mantenible del gremio fontanero, y aceptado por el panel.
// ⚠️ `tax` va en FRACCIÓN (0.21) y no en porcentaje: `schemas.ts:156` lo pasa por
// `invalidTipoIva`, que solo acepta los tipos españoles reales. Un `21` da 400 validation_error.
const cr = await api('POST', '/quote/create', {
  merchant_id: 2, customer_id: 3927, currency: 'EUR',
  paymentTerms: 'FULL_UPFRONT',
  lines: [
    { concept: 'Sustitución de termo eléctrico 80 L', qty: 1, price: 320, tax: 0.21 },
    { concept: 'Desplazamiento', qty: 1, price: 25, tax: 0.21 },
  ],
});
console.log('POST /quote/create →', cr.status, JSON.stringify(cr.json).slice(0, 400));
const quoteId = cr.json?.id ?? cr.json?.quote?.id ?? cr.json?.quoteId;
if (!quoteId) { await db.$disconnect(); throw new Error('sin id de presupuesto'); }

const detBorrador = await api('GET', `/admin/quotes/${quoteId}`);
console.log(`GET /admin/quotes/${quoteId} (sin aceptar) status=${detBorrador.json?.status} maintenance=`, JSON.stringify(detBorrador.json?.maintenance));
// En DRAFT el bloque viaja pero sin sugerencia: `suggestion` solo si status==='accepted'.
R.sinAceptarNoSugiere = detBorrador.json?.maintenance?.enabled === true
  && detBorrador.json?.maintenance?.suggestion == null ? 'funciona' : 'falla';

const acc = await api('POST', `/admin/quotes/${quoteId}/accept`, { channel: 'backoffice', comment: 'SCRUM-911 PASO 0' });
console.log('POST accept →', acc.status, acc.json);

// 3 · la sugerencia aparece en el detalle del aceptado
const det = await api('GET', `/admin/quotes/${quoteId}`);
console.log(`GET /admin/quotes/${quoteId} (aceptado) maintenance=`, JSON.stringify(det.json?.maintenance));
R.sugerencia = det.json?.maintenance?.suggestion ? 'funciona' : 'falla';

// 4 · alta del plan (lo que envía el toggle: quotesDetailView.js:1343)
const s = det.json?.maintenance?.suggestion;
const alta = await api('POST', '/admin/maintenance', { customerId: 3927, quoteId, title: s?.title ?? 'Revisión de termo/calentador', intervalMonths: s?.intervalMonths ?? 12 });
console.log('POST /admin/maintenance →', alta.status, alta.json);
const alta2 = await api('POST', '/admin/maintenance', { customerId: 3927, quoteId, title: 'duplicado', intervalMonths: 12 });
console.log('POST /admin/maintenance (repetido, idempotencia) →', alta2.status, alta2.json?.id);
R.alta = alta.status === 201 ? 'funciona' : 'falla';
R.idempotencia = alta2.status === 200 && alta2.json?.id === alta.json?.id ? 'funciona' : 'falla';

const det2 = await api('GET', `/admin/quotes/${quoteId}`);
console.log('detalle tras el alta maintenance=', JSON.stringify(det2.json?.maintenance));
R.planEnDetalle = det2.json?.maintenance?.plan?.id === alta.json?.id && det2.json?.maintenance?.suggestion === null ? 'funciona' : 'falla';

// Multi-tenant: un cliente que no es del merchant → 404
const ajeno = await db.customer.findFirst({ where: { NOT: { merchantId: 2 } }, select: { id: true } });
const t = await api('POST', '/admin/maintenance', { customerId: ajeno.id, title: 'ajeno', intervalMonths: 12 });
console.log('POST con cliente ajeno →', t.status, t.json);
R.clienteAjeno = t.status === 404 && t.json?.error === 'customer_not_found' ? 'funciona' : 'falla';

fs.writeFileSync('./paso1.json', JSON.stringify({ quoteId, planId: alta.json?.id, R }, null, 2));
console.log('VEREDICTOS tramo 1:', R);
await db.$disconnect();

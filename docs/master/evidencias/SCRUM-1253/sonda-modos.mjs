// SCRUM-1253 · sonda: qué modo de emisión sale para cada merchant y qué hace allocateInvoiceNumber
// en el modo 'receipt'. Funciones REALES de dist/, cliente Prisma FALSO, NINGUNA base.
// uso (desde la raíz, tras `npm run build`): node docs/master/evidencias/SCRUM-1253/sonda-modos.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'node:url';
const raiz = fileURLToPath(new URL('../../../../', import.meta.url));
const { getEmissionMode } = require(raiz + 'dist/modules/invoicing/domain/emission.service.js');
const { allocateInvoiceNumber } = require(raiz + 'dist/modules/invoicing/domain/invoiceNumber.service.js');

delete process.env.INVOICING_ES_ENABLED; // se mide con el valor POR DEFECTO del código (OFF)

const casos = [
  ['ES real, sin override', { id: 7, email: 'a@x.es', country: 'ES', flags: {} }],
  ['ES real, country vacío', { id: 7, email: 'a@x.es', country: '', flags: {} }],
  ['ES real, country null', { id: 7, email: 'a@x.es', country: null, flags: {} }],
  ['ES real, override ON', { id: 7, email: 'a@x.es', country: 'ES', flags: { INVOICING_ES_ENABLED: true } }],
  ['demo (id=1)', { id: 1, email: 'demo@yaqu.app', country: 'ES', flags: {} }],
  ['PT', { id: 9, email: 'p@x.pt', country: 'PT', flags: {} }],
  ['MX', { id: 9, email: 'm@x.mx', country: 'MX', flags: {} }],
  ['AR', { id: 9, email: 'r@x.ar', country: 'AR', flags: {} }],
];

const filas = [];
for (const [nombre, m] of casos) {
  const modo = getEmissionMode(m);
  const llamadas = [];
  const tx = {
    $executeRaw: async () => { llamadas.push('lock'); return 1; },
    merchant: {
      findUnique: async () => { llamadas.push('merchant.findUnique'); return {
        ...m, timezone: 'Europe/Madrid', invoiceSeriesPrefix: 'F', nextInvoiceNumber: 1,
        nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026, invoiceStartSeq: null, invoiceStartYear: null }; },
      update: async () => { llamadas.push('merchant.update'); return {}; },
    },
    invoice: { findMany: async () => { llamadas.push('invoice.findMany'); return []; },
               findFirst: async () => { llamadas.push('invoice.findFirst'); return null; } },
    auditLog: { create: async () => { llamadas.push('auditLog.create'); return {}; } },
  };
  let desenlace;
  try {
    const n = await allocateInvoiceNumber(tx, m.id, { camino: 'C1', actor: { tipo: 'sistema' } }, new Date('2026-09-28T12:00:00Z'));
    desenlace = `NÚMERO ${n}`;
  } catch (e) { desenlace = `LANZA ${e.message}`; }
  filas.push({ nombre, modo, desenlace, escrituras: llamadas.filter((c) => /update|create/.test(c)).join(',') || '—' });
}
console.table(filas);
const receipt = filas.filter((f) => f.modo === 'receipt');
console.log(`población: ${filas.length} merchants · modo receipt: ${receipt.length} · receipt que lanza invoicing_es_disabled: ${receipt.filter((f) => f.desenlace === 'LANZA invoicing_es_disabled').length}`);
// control positivo: al menos un caso NO receipt que sí llega más allá de la puerta (no lanza invoicing_es_disabled)
const otros = filas.filter((f) => f.modo !== 'receipt');
console.log(`control: casos no-receipt que NO lanzan invoicing_es_disabled: ${otros.filter((f) => f.desenlace !== 'LANZA invoicing_es_disabled').length} de ${otros.length}`);

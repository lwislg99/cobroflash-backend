// Escribe el XML de exportación (dos altas + una anulación) y el de remisión de un comercio id=7,
// desde el dist/ del árbol actual, a argv[2] (exportación) y argv[3] (remisión).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dist = (rel) => pathToFileURL(path.resolve('dist', rel)).href;
const { buildVerifactuRegistrosXml, registroParaRemision } = await import(dist('modules/invoicing/domain/verifactu.service.js'));
const merchant = { id: 7, country: 'ES', taxId: 'B12345678', legalName: 'Reformas Integrales del Norte S.L.', name: 'Reformas Norte' };
const mk = (o = {}) => ({ id: 70, merchantId: 7, number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '121.00', type: 'F1',
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }], vfHash: 'A'.repeat(64), vfPrevHash: null,
  vfTimestamp: new Date('2026-03-15T10:00:05Z'), vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null,
  customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null, ...o });
const invoices = [mk(), mk({ id: 71, number: '2026-CF-002', vfHash: 'B'.repeat(64), vfPrevHash: 'A'.repeat(64),
  vfTimestamp: new Date('2026-03-16T10:00:05Z'), createdAt: new Date('2026-03-16T10:00:00Z'),
  vfAnulHash: 'C'.repeat(64), vfAnulTimestamp: new Date('2026-03-17T10:00:05Z'), vfAnulPrevHash: 'B'.repeat(64) })];
const fake = (inv) => ({ merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? inv.filter((i) => i.vfHash) : inv), findUnique: async () => inv[0], findFirst: async () => null } });
const { xml, count, excluidos } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fake(invoices));
fs.writeFileSync(process.argv[2], xml);
fs.writeFileSync(process.argv[3], await registroParaRemision(70, fake([mk()])));
console.log(`count=${count} excluidos=${JSON.stringify(excluidos)} bytes=${xml.length}`);

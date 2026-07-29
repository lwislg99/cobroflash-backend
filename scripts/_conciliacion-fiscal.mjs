// scripts/_conciliacion-fiscal.mjs — SCRUM-207 · el CLASIFICADOR, puro y probado aparte.
//
// Vive fuera de `conciliar-auditoria-fiscal.mjs` por el mismo motivo que
// `tests/_embudo-factura.mjs` vive fuera de su test (SCRUM-203): contra una base real casi
// nunca se pisan todas las ramas —staging hoy solo tiene justificantes—, así que un verde
// de ejecución NO demuestra que los cubos estén bien. Aquí es puro, y
// `tests/scrum207-conciliacion.test.mjs` lo ejercita rama a rama con datos sintéticos.
// Un contador que nunca ha contado nada no es una medición.
//
// EL CRITERIO NO SE INVENTA. «Documento que debe llevar huella» es EXACTAMENTE la condición
// que el código usa antes de sellar, en sus dos call-sites:
//
//   lib/invoicing.ts:53   inv.merchant.country === 'ES' && inv.merchant.taxId
//                         && !vfHash && !isReceiptNumber(inv.number)
//   lib/invoicing.ts:146  (idéntica)
//
// `isReceiptNumber` se IMPORTA de `dist/` en vez de reimplementarse: el prefijo 'J-' vive en
// un solo sitio ([invoiceNumber.service.ts:20-24](../src/modules/invoicing/domain/invoiceNumber.service.ts#L20-L24)).
import { isReceiptNumber } from '../dist/modules/invoicing/domain/invoiceNumber.service.js';

export const DEMO_MERCHANT_ID = 1;
export const DEMO_MERCHANT_EMAIL = 'demo@yaqu.app';

export const CUBOS = [
  'justificante',     // J-… → fuera de la cadena por diseño (verifactu.service.ts:156)
  'noEspanaOSinNif',  // el predicado de sellado no aplica (lib/invoicing.ts:53)
  'selladas',
  'huecoSinLineas',   // H3-B: sin huella, pero EXPLICADO (fail-closed, verifactu.service.ts:179)
  'huecoDemo',        // H3-D: merchant demo, ruido conocido (regla 8)
  'huecoReal',        // H3-A: ⬅️ EL AGUJERO
];

/**
 * Reparte los documentos en los 6 cubos. **El orden de los `if` ES el criterio** y no es
 * intercambiable: un justificante sin líneas tiene que salir por `justificante`, no por
 * `huecoSinLineas`, o el titular contaría como agujero algo que jamás debió sellarse.
 *
 * @param {Array<{id:number,merchantId:number,number:string,vfHash:string|null,lines:unknown}>} docs
 * @param {Array<{id:number,country:string|null,taxId:string|null,email:string|null}>} merchants
 */
export function clasificarDocumentos(docs, merchants) {
  const porMerchant = new Map(merchants.map((m) => [m.id, m]));
  const esDemo = (m) =>
    !!m && (m.id === DEMO_MERCHANT_ID || (m.email ?? '').trim().toLowerCase() === DEMO_MERCHANT_EMAIL);

  const cubos = Object.fromEntries(CUBOS.map((c) => [c, []]));

  for (const d of docs) {
    const m = porMerchant.get(d.merchantId);
    if (isReceiptNumber(d.number)) { cubos.justificante.push(d); continue; }
    const debeSellarse = !!m && (m.country ?? '').trim().toUpperCase() === 'ES' && !!(m.taxId ?? '').trim();
    if (!debeSellarse) { cubos.noEspanaOSinNif.push(d); continue; }
    if (d.vfHash) { cubos.selladas.push(d); continue; }
    const nLineas = Array.isArray(d.lines) ? d.lines.length : 0;
    if (nLineas === 0) { cubos.huecoSinLineas.push(d); continue; }
    if (esDemo(m)) { cubos.huecoDemo.push(d); continue; }
    cubos.huecoReal.push(d);
  }
  return cubos;
}

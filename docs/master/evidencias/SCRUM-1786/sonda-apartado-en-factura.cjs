// Sonda SCRUM-1786: ¿qué hace el camino de factura con una cabecera de apartado (SCRUM-655)?
// Solo LEE: importa el código compilado (tsc --noCheck a un dir temporal) y lo llama.
const D = process.argv[2];
const { calcVatBreakdown } = require(D + '/modules/invoicing/domain/vat.service.js');
const { lineasParaFacturar } = require(D + '/modules/invoicing/domain/invoiceLines.service.js');
const { clasificarDetalleDesglose } = require(D + '/modules/fiscal/verifactu/registro.builder.js');
const { QuoteSchema } = (() => { try { return require(D + '/core/validation/schemas.js'); } catch (e) { return {}; } })();
const { calcTotal } = require(D + '/core/utils/utils.js');

const casos = {
  // control negativo: sin cabecera
  sinApartado: [{ concept: 'Pintura', qty: 1, price: 100, tax: 0.21 }],
  // caso del fundador: cabecera «Salón» (como la deja la puerta zod: tax por defecto 0)
  conApartado: [{ concept: 'Salón', apartado: true, tax: 0 }, { concept: 'Pintura', qty: 1, price: 100, tax: 0.21 }],
  // cabecera sin tax (si llegara por un camino que no pasa por zod)
  apartadoSinTax: [{ concept: 'Salón', apartado: true }, { concept: 'Pintura', qty: 1, price: 100, tax: 0.21 }],
};
for (const [n, lineas] of Object.entries(casos)) {
  const fact = lineasParaFacturar({ lines: lineas, discountGlobalAmount: null });
  const bd = calcVatBreakdown(fact);
  let xml;
  try { xml = bd.entries.map((e) => clasificarDetalleDesglose(e, 'F-TEST', { criterioCaja: false })); xml = 'OK ' + xml.length + ' detalle(s)'; }
  catch (e) { xml = 'LANZA: ' + String(e.message).slice(0, 160); }
  console.log(JSON.stringify({ caso: n, totalPresupuesto: calcTotal ? calcTotal(lineas) : '?', lineasFactura: fact.length, cabeceraEnFactura: fact.some((l) => l.apartado === true), entries: bd.entries, registro: xml }));
}

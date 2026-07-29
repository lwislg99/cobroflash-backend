// Obtiene el XML REAL igual que tests/scrum145: importa de dist/ e inyecta un prisma falso.
// CERO cambios en el camino de emision: ni un helper extraido, ni una firma tocada.
import fs from 'node:fs';
process.env.VERIFACTU_PRODUCTOR_NOMBRE = 'QA Productor';
process.env.VERIFACTU_PRODUCTOR_NIF = '89890001K';
process.env.VERIFACTU_ID_SISTEMA = '01';
process.env.VERIFACTU_VERSION = '1.0.0';
process.env.VERIFACTU_NUM_INSTALACION = '1';

const merchant = { id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA' };
const invoice = {
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '121.00', type: 'F1',
  lines: [{ concept: 'Reparación', qty: 1, price: 100, vat: 21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Cliente QA', taxId: null }, rectifies: null,
};
const fakePrisma = (invoices) => ({
  merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices) },
});

const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
const { xml } = await buildVerifactuRegistrosXml({ merchantId: 1, year: 2026 }, fakePrisma([invoice]));
fs.writeFileSync('spike/valido.xml', xml);

// INVALIDO A PROPOSITO: TipoFactura 'F9' no esta en la enumeracion del XSD.
// Elegido a proposito porque NINGUN assert de cadena de los que hay hoy lo caza:
// el elemento esta presente y bien escrito; lo que falla es el VALOR contra el tipo.
const malo = xml.replace('<sum1:TipoFactura>F1<', '<sum1:TipoFactura>F9<');
if (malo === xml) { console.error('LA MUTACION NO SE APLICO — el invalido seria falso'); process.exit(1); }
fs.writeFileSync('spike/invalido.xml', malo);
console.log('valido.xml   ' + xml.length + ' bytes');
console.log('invalido.xml ' + malo.length + ' bytes  (TipoFactura F1 -> F9, fuera de la enumeracion)');

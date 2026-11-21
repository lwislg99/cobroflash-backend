// Sonda de un solo uso (SCRUM-1788a): imprime las líneas del PDF de factura hasta la cabecera de la tabla.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const raiz = process.argv[2];
const { generateInvoicePdf } = await import(pathToFileURL(path.join(raiz, 'dist/lib/pdf.js')).href);
const { lineasDePdf } = await import(pathToFileURL(path.join(raiz, 'tests/_texto-del-pdf.mjs')).href);
const largo = process.argv[3] === 'largo';
const merchant = largo
  ? { name: 'Fontanería Ficticia', legalName: 'Fontanería Ficticia del Norte SL', taxId: 'B00000000',
      address: 'Calle Inventada de los Ejemplos Larguísimos 123, Portal 4, Escalera B, 28000 Ciudad Ficticia',
      phone: '+34 600 000 000', email: 'facturas@ejemplo.invalid' }
  : { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' };
const { outPath } = await generateInvoicePdf({
  number: 'F-2026-QA1788', merchant, customer: { name: 'Cliente QA', email: 'c@ejemplo.invalid' },
  currency: 'EUR', total: 12.1, qrData: '', type: 'F1',
  lines: [{ concept: 'Mano de obra', qty: 1, unitPrice: 10, vatRate: 21 }],
});
const buf = fs.readFileSync(outPath);
if (process.argv[4]) fs.copyFileSync(outPath, process.argv[4]);
fs.rmSync(outPath, { force: true });
const r = lineasDePdf(buf);
if (!r.ok) { console.log('CIEGO', r.motivo); process.exit(2); }
for (const l of r.lineas) { console.log(l.y.toFixed(2), l.x.toFixed(1), l.texto.slice(0, 90)); if (l.texto.includes('CONCEPTO')) break; }

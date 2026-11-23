// SCRUM-1787 T4 · medición: presupuesto y factura con los MISMOS datos fabricados.
// Se ejecuta con cwd = esta carpeta: `invoicesDir` = <cwd>/storage/invoices (fuera del repo).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Raíz del repo: cinco niveles por encima de docs/master/evidencias/SCRUM-1787/1787v/.
// Uso: node docs/master/evidencias/SCRUM-1787/1787v/generar-pdfs.mjs <carpeta de salida FUERA del repo>
// (necesita `dist/`: `./node_modules/.bin/tsc -p . --noCheck`).
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const OUT = process.argv[2] || process.cwd();
const imp = (p) => import(pathToFileURL(path.join(REPO, p)).href);

const { generateInvoicePdf, generateQuotePdf } = await imp('dist/modules/invoicing/infra/pdf/pdf.service.js');
const { calcTotal, precioConDto } = await imp('dist/core/utils/utils.js');
const { lineasDePdf } = await imp('tests/_texto-del-pdf.mjs');

const MERCHANT = {
  name: 'Fontanería Ejemplo', legalName: 'Fontanería Ejemplo SL', taxId: 'B00000000',
  address: 'Calle Inventada 1, 28000 Ciudad Ficticia',
};
const CLIENTE = { name: 'Cliente Ejemplo', taxId: '00000000T', email: 'cliente@ejemplo.invalid' };
const DIR_CLIENTE = { billingAddress: 'Calle Falsa 123', billingPostalCode: '28000', billingCity: 'Ciudad Ficticia' };
const DIR_UNA_LINEA = 'Calle Falsa 123, 28000, Ciudad Ficticia';

// 3 líneas, dos tipos (21 y 10), una con descripción (concepto\ndescripción), una con dto de línea (%).
const LINEAS_PRESUPUESTO = [
  { concept: 'Sustitución de grifo\nGrifo monomando de cocina, incluye desmontaje del antiguo', qty: 1, price: 80, tax: 0.21 },
  { concept: 'Mano de obra', qty: 2, price: 35, tax: 0.21, dto: 10 },
  { concept: 'Material de fontanería', qty: 3, price: 12.5, tax: 0.10 },
];
// La factura guarda las líneas NETAS: el dto se aplica al precio y la clave no se guarda
// (src/modules/invoicing/domain/facturaSuelta.ts:237-238).
const LINEAS_FACTURA = LINEAS_PRESUPUESTO.map(({ dto, ...l }) => ({ ...l, price: precioConDto(l.price, dto) }));

const total = String(calcTotal(LINEAS_PRESUPUESTO, null));
const OBS = 'Pago a 30 días.\nGarantía de 6 meses sobre la mano de obra.';

function volcar(nombre, outPath) {
  const buf = fs.readFileSync(outPath);
  fs.writeFileSync(path.join(OUT, `${nombre}.pdf`), buf);
  const r = lineasDePdf(buf);
  if (!r.ok) throw new Error(`NO SUPE LEER ${nombre}: ${r.motivo}`);
  // page: lineasDePdf no separa páginas; se marca por el número de flujo no disponible -> null.
  const lineas = r.lineas.map((l) => ({ text: l.texto, x: Math.round(l.x * 100) / 100, y: Math.round(l.y * 100) / 100, page: null }));
  fs.writeFileSync(path.join(OUT, `${nombre}.json`), JSON.stringify(lineas, null, 1));
  const paginas = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`${nombre}: ${lineas.length} líneas, ${paginas} página(s), ${buf.length} B`);
  fs.rmSync(outPath, { force: true });
}

const q = await generateQuotePdf({
  quoteId: 917870001, quoteNumber: 1001, revision: 0,
  merchant: MERCHANT, customer: CLIENTE, currency: 'EUR', total,
  lines: LINEAS_PRESUPUESTO, country: 'ES', taxName: 'IVA', modoIva: null,
  docHeaderText: null, docFooterText: OBS,
  direccionObra: { modo: 'facturacion', personalizada: null, cliente: DIR_CLIENTE },
  clausulas: [{ id: 'g', titulo: 'Garantía', texto: 'Seis meses sobre la mano de obra.' }],
  clausulasExcluidas: [],
  validez: 'Válido hasta el 05 de diciembre de 2026',
  zona: 'Europe/Madrid',
});
volcar('quote', q.outPath);

const f = await generateInvoicePdf({
  number: 'F-2026-0001', invoiceId: 1787, merchantId: 1787,
  merchant: MERCHANT, customer: CLIENTE, customerAddress: DIR_UNA_LINEA,
  currency: 'EUR', total, qrData: '', vfHash: null, type: 'F1', watermark: null,
  createdAt: new Date('2026-11-05T10:00:00.000Z'),
  lines: LINEAS_FACTURA, taxName: 'IVA',
  zona: 'Europe/Madrid', merchantCriterioCaja: null,
  docFooterText: OBS,
  dueDate: new Date('2026-12-05T22:59:59.000Z'), payMethods: ['card', 'bizum', 'transfer'],
});
volcar('invoice', f.outPath);
console.log('total guardado', total, '· líneas factura', JSON.stringify(LINEAS_FACTURA.map((l) => l.price)));

// SCRUM-1787m · huella de las LÍNEAS (texto y posición) del PDF de una factura fabricada, para comparar
// el documento de una factura SIN vencimiento ni formas de pago antes y después del cambio.
// Uso (desde la raíz del worktree, con `dist/` compilado):
//   node docs/master/evidencias/SCRUM-1787/pdf-vence/lineas.mjs            → imprime las dos huellas
//   node docs/master/evidencias/SCRUM-1787/pdf-vence/lineas.mjs <carpeta>  → además deja ahí los dos PDF
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { lineasDePdf } from '../../../../../tests/_texto-del-pdf.mjs';

const { generateInvoicePdf } = await import('../../../../../dist/modules/invoicing/infra/pdf/pdf.service.js');
const destino = process.argv[2] || null;

async function fabricar(nombre, extra) {
  const { outPath } = await generateInvoicePdf({
    number: 'F-2026-QA1787M', invoiceId: 1787, merchantId: 1787,
    merchant: { name: 'Oficio Ficticio', legalName: 'Oficio Ficticio SL', taxId: 'B00000000', address: 'Calle Inventada 1, 28000 Ciudad Ficticia' },
    customer: { name: 'Cliente QA', email: 'cliente@ejemplo.invalid' },
    currency: 'EUR', total: '121.00', qrData: '', type: 'F1',
    createdAt: new Date('2026-11-05T10:00:00.000Z'),
    lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
    zona: 'Europe/Madrid', merchantCriterioCaja: null,
    ...extra,
  });
  const buf = fs.readFileSync(outPath);
  if (destino) fs.copyFileSync(outPath, path.join(destino, `${nombre}.pdf`));
  fs.rmSync(outPath, { force: true });
  const r = lineasDePdf(buf);
  if (!r.ok) { console.log(JSON.stringify({ nombre, ciego: r.motivo })); process.exitCode = 2; return; }
  const huella = crypto.createHash('sha256').update(JSON.stringify(r.lineas)).digest('hex');
  console.log(JSON.stringify({ nombre, lineas: r.lineas.length, huella }));
}

await fabricar('sin-datos', {});
await fabricar('con-datos', { dueDate: new Date('2026-12-05T22:59:59.000Z'), payMethods: ['card', 'bizum'] });

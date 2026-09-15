// docs/master/evidencias/scrum665/dos-regeneraciones.mjs — SCRUM-665
//
// ¿PUEDE EL PDF DE UNA FACTURA EMITIDA SALIR HOY DISTINTO DE COMO SALIO EL DIA QUE SE EMITIO?
//
// Se genera el PDF de LA MISMA factura DOS VECES, cambiando en medio un dato del MERCHANT —lo
// que un profesional hace cuando corrige su direccion fiscal— y se comparan los dos ficheros por
// BYTES y por CONTENIDO.
//
// 🔴 NO TOCA NADA: `generateInvoicePdf` recibe todos sus datos POR PARAMETRO, asi que se le pasan
// dos juegos y se mira lo que pinta. Ni una linea de src/ modificada, ni base de datos, ni red.
// Es la misma funcion que llaman los cuatro caminos de regeneracion (`ensureInvoicePdf`).
//
// 🔴 CONTROL POSITIVO, y sin el un «no cambia» no significaria nada:
//   (a) se comprueba que el cambio ENTRO — el texto del PDF 1 lleva la direccion vieja y el del
//       PDF 2 la nueva. Una mutacion que no entra y una cobertura que no existe dan la misma
//       salida;
//   (b) se genera una TERCERA vez SIN cambiar nada, para ver que el instrumento distingue
//       «cambio» de «ruido del formato».
//
// SUELO: si no se consigue generar el primer PDF, se declara CIEGO y se sale con 3.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const DIST = new URL('../../../../dist/', import.meta.url).href;

const { generateInvoicePdf } = await import(DIST + 'modules/invoicing/infra/pdf/pdf.service.js');
const { textoDePdf, contiene } = await import(new URL('../../../../tests/_pdf-texto.mjs', import.meta.url).href);

const DIRECCION_DE_ENTONCES = 'Calle Mayor 1, 28001 Madrid';
const DIRECCION_DE_HOY = 'Avenida Nueva 99, 08005 Barcelona';

/** La factura, EMITIDA y congelada. Lo unico que se mueve entre pasadas es el merchant. */
const FACTURA = (direccion) => ({
  number: '2026-CF-0007',
  invoiceId: 90007,
  merchantId: 9001,
  merchant: {
    name: 'Fontaneria QA',
    legalName: 'Fontaneria QA S.L.',
    taxId: 'B12345678',
    address: direccion,          // ← lo unico que cambia
    logoUrl: null,
    phone: null,
    email: 'pro@ejemplo.test',
  },
  customer: { name: 'Ferreteria Pepe', legalName: 'Ferreteria Pepe SL', taxId: 'B99999999', email: null, phone: null },
  currency: 'EUR',
  total: '480.00',
  qrData: 'INV:2026-CF-0007|AMOUNT:480.00|CUR:EUR',
  vfHash: 'abc123def456',
  createdAt: new Date('2026-06-15T10:00:00Z'),
  lines: [{ description: 'Reparacion de bajante', qty: 1, price: 396.69, tax: 0.21 }],
  type: 'F1',
  rectifiesNumber: null,
  watermark: null,
  stageLabel: null,
});

const copiar = (destino) => {
  const origen = path.join(RAIZ, 'storage', 'invoices', '9001-2026-CF-0007.pdf');
  if (!fs.existsSync(origen)) return null;
  const buf = fs.readFileSync(origen);
  fs.writeFileSync(destino, buf);
  return buf;
};

const TMP = path.join(RAIZ, 'storage', 'invoices');
fs.mkdirSync(TMP, { recursive: true });

// ── PASADA 1 · el dia que se emitio ──────────────────────────────────────────────────────
await generateInvoicePdf(FACTURA(DIRECCION_DE_ENTONCES));
const pdf1 = copiar(path.join(TMP, '_665-pasada1.pdf'));
if (!pdf1) {
  console.log('🔴 CIEGO: no se pudo generar el primer PDF. No se afirma nada sobre el segundo.');
  process.exit(3);
}

// ── PASADA 2 · hoy, despues de que el profesional corrija su direccion ────────────────────
await generateInvoicePdf(FACTURA(DIRECCION_DE_HOY));
const pdf2 = copiar(path.join(TMP, '_665-pasada2.pdf'));

// ── PASADA 3 · otra vez lo MISMO que la 2, sin tocar nada (control de ruido) ──────────────
await generateInvoicePdf(FACTURA(DIRECCION_DE_HOY));
const pdf3 = copiar(path.join(TMP, '_665-pasada3.pdf'));

const t1 = textoDePdf(path.join(TMP, '_665-pasada1.pdf'));
const t2 = textoDePdf(path.join(TMP, '_665-pasada2.pdf'));

console.log('BYTES   pasada1: ' + pdf1.length + '  ·  pasada2: ' + pdf2.length + '  ·  pasada3: ' + pdf3.length);
console.log('');
console.log('🔴 CONTROL POSITIVO (a) — ¿ENTRO el cambio?');
console.log('   PDF 1 contiene la direccion DE ENTONCES: ' + (contiene(t1, DIRECCION_DE_ENTONCES) ? 'SI ✅' : 'NO 🔴'));
console.log('   PDF 2 contiene la direccion DE HOY .....: ' + (contiene(t2, DIRECCION_DE_HOY) ? 'SI ✅' : 'NO 🔴'));
console.log('   PDF 2 YA NO contiene la de entonces ....: ' + (contiene(t2, DIRECCION_DE_ENTONCES) ? '🔴 SIGUE' : 'correcto ✅'));
if (!contiene(t1, DIRECCION_DE_ENTONCES) || !contiene(t2, DIRECCION_DE_HOY)) {
  console.log('');
  console.log('🔴 EL BANCO NO ESTA TOCANDO LO QUE CREE: el cambio no aparece en el PDF, asi que');
  console.log('   cualquier conclusion sobre «cambia / no cambia» seria sobre otra cosa.');
  process.exit(3);
}

console.log('');
console.log('CONTROL (b) — el instrumento distingue CAMBIO de RUIDO, y aqui hay ruido:');
const t3 = textoDePdf(path.join(TMP, '_665-pasada3.pdf'));
const igual23 = Buffer.compare(pdf2, pdf3) === 0;
console.log('   pasada2 vs pasada3, MISMOS datos:');
console.log('     por BYTES ....: ' + (igual23 ? 'IDENTICOS ✅' : '⚠️ DISTINTOS — el PDF no es determinista'));
console.log('     por CONTENIDO : ' + (t2 === t3 ? 'IDENTICO ✅' : '🔴 DISTINTO'));
if (!igual23 && t2 !== t3) {
  console.log('');
  console.log('🔴 INSTRUMENTO INSUFICIENTE: con los MISMOS datos el texto ya sale distinto, asi que');
  console.log('   una diferencia entre la pasada 1 y la 2 no demuestra que la causa sea el cambio.');
  process.exit(3);
}
if (!igual23) {
  console.log('');
  console.log('   ⚠️ LEIDO CON CUIDADO: dos pasadas IDENTICAS ya difieren en BYTES (el PDF lleva');
  console.log('      dentro algo que cambia solo, p. ej. la fecha de creacion del fichero). Por eso');
  console.log('      EL VEREDICTO NO SE APOYA EN LOS BYTES: se apoya en el CONTENIDO, que con datos');
  console.log('      iguales SI sale identico — y por tanto una diferencia ahi es del dato, no del ruido.');
}

console.log('');
const igual12 = Buffer.compare(pdf1, pdf2) === 0;
console.log('═══ EL VEREDICTO ═══');
console.log('   pasada1 vs pasada2 (el merchant corrigio su direccion):');
console.log('     por BYTES ....: ' + (igual12 ? 'IDENTICOS' : '🔴 DISTINTOS'));
console.log('     por CONTENIDO : ' + (t1 === t2 ? 'IDENTICO' : '🔴 DISTINTO'));
console.log('');
console.log(igual12 && t1 === t2
  ? '   -> el PDF de una factura emitida NO cambia al cambiar el merchant.'
  : '   🔴 -> EL PDF DE UNA FACTURA EMITIDA SALE DISTINTO. El papel que se reimprime hoy no es\n'
    + '         el que se entrego el dia de la emision, y nadie ha hecho nada mal.');

for (const f of ['_665-pasada1.pdf', '_665-pasada2.pdf', '_665-pasada3.pdf', '9001-2026-CF-0007.pdf']) {
  try { fs.unlinkSync(path.join(TMP, f)); } catch { /* ya no esta */ }
}

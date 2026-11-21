// SCRUM-1785b · ¿Qué pinta el PDF del PRESUPUESTO en la línea del WhatsApp cuando el comercio NO tiene
// nombre comercial? Mide, no decide: ese caso se firma aparte (SCRUM-1785 c.22281).
// Uso (con `dist/` compilado): node docs/master/evidencias/scrum1785/sin-nombre-comercial.mjs
// Sale 0 si midió los cuatro casos; 2 si alguno fue CIEGO (el lector no leyó el PDF).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const imp = (r) => import(pathToFileURL(path.join(RAIZ, r)).href);
const { paramsDePresupuestoParaPdf } = await imp('dist/modules/quotes/domain/presupuestoParaPdf.js');
const { generateQuotePdf } = await imp('dist/lib/pdf.js');
const { extraerTextoPdf } = await imp('tests/_texto-del-pdf.mjs');

const TEL = '34000178522';
const CASOS = [
  { caso: 'CONTROL: con nombre comercial', merchant: { name: 'QAComercial1785b', legalName: 'QARazon1785bSL' } },
  { caso: 'name vacío, con razón social', merchant: { name: '', legalName: 'QARazon1785bSL' } },
  { caso: 'name sólo espacios, con razón social', merchant: { name: '   ', legalName: 'QARazon1785bSL' } },
  { caso: 'name vacío y sin razón social', merchant: { name: '', legalName: null } },
];

let ciegos = 0;
for (const c of CASOS) {
  const quote = { id: 17854, quoteNumber: 1785, currency: 'EUR', total: '121.00',
    lines: [{ concept: 'Bajante1785b', qty: 1, price: 100, tax: 0.21 }], docFields: null };
  const merchant = { ...c.merchant, taxId: 'B00000000', country: 'ES', whatsappPhone: TEL };
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote, merchant, customer: { id: 5, name: 'QA1785bCLIENTE' } }));
  let l;
  try { l = extraerTextoPdf(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
  if (!l.ok || !l.texto.includes('Bajante1785b')) { ciegos++; console.log(`CIEGO · ${c.caso}`); continue; }
  // El lector junta el texto sin saltos de línea: se corta entre las etiquetas vecinas.
  const lineaWa = (l.texto.match(/(WhatsApp.*?)Cliente:/) ?? [, '(no sale)'])[1];
  const emisor = (l.texto.match(/(Emisor: .*?)NIF:/) ?? [, '(no sale)'])[1];
  console.log(`${c.caso} · WhatsApp → «${lineaWa}» · ${emisor}`);
}
console.log(`población: ${CASOS.length} casos · ciegos ${ciegos}`);
process.exitCode = ciegos ? 2 : 0;

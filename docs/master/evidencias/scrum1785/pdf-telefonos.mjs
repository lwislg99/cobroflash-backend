// docs/master/evidencias/scrum1785/pdf-telefonos.mjs — SCRUM-1785 (relevo jv-j1gm, 21-nov-2026)
//
// QUÉ NÚMERO sale en el PDF del presupuesto, DE QUIÉN es y CÓMO se rotula, con «ocultar teléfono»
// y sin él. Texto EXTRAÍDO del PDF real (`generateQuotePdf` de `dist/`), no a ojo.
//
// Uso (desde la raíz, con `dist/` compilado):  node docs/master/evidencias/scrum1785/pdf-telefonos.mjs
// Sale 0 si pudo leer los cinco PDF; 2 (CIEGO) si alguno no se pudo leer o no aparece el concepto.
//
// Tokens sin espacios e improbables: el número del CLIENTE y el del COMERCIO son distintos, y los
// dos nombres del comercio (comercial y fiscal) también, para poder decir cuál sale.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const imp = (r) => import(pathToFileURL(path.join(RAIZ, r)).href);
const { paramsDePresupuestoParaPdf } = await imp('dist/modules/quotes/domain/presupuestoParaPdf.js');
const { generateQuotePdf } = await imp('dist/lib/pdf.js');
const { extraerTextoPdf } = await imp('tests/_texto-del-pdf.mjs');

const TEL_CLIENTE = '600178511';
const TEL_COMERCIO = '611178522';
const COMERCIAL = 'QAComercial1785';
const FISCAL = 'QARazon1785SL';
const CONCEPTO = 'Bajante1785';
const CLIENTE = { id: 5, name: 'QA1785NOMBRE', phone: TEL_CLIENTE, email: 'qa1785@correo.es', taxId: 'X1785000Z' };

const CASOS = [
  { id: 'A', que: 'comercio con nombre comercial + razón social + WhatsApp; sin ocultar', m: { name: COMERCIAL, legalName: FISCAL, whatsappPhone: TEL_COMERCIO }, df: null },
  { id: 'B', que: 'igual que A, con «Teléfono» OCULTO', m: { name: COMERCIAL, legalName: FISCAL, whatsappPhone: TEL_COMERCIO }, df: { phone: false } },
  { id: 'C', que: 'comercio SIN razón social, con «Teléfono» OCULTO', m: { name: COMERCIAL, legalName: null, whatsappPhone: TEL_COMERCIO }, df: { phone: false } },
  { id: 'D', que: 'comercio SIN WhatsApp, con «Teléfono» OCULTO', m: { name: COMERCIAL, legalName: FISCAL, whatsappPhone: null }, df: { phone: false } },
  { id: 'E', que: 'el WhatsApp del comercio ES el teléfono del cliente, con «Teléfono» OCULTO', m: { name: COMERCIAL, legalName: FISCAL, whatsappPhone: TEL_CLIENTE }, df: { phone: false } },
];

let ciego = 0;
for (const c of CASOS) {
  const quote = { id: 17851, quoteNumber: 1785, currency: 'EUR', total: '121.00', lines: [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }], docFields: c.df };
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote, merchant: { ...c.m, taxId: 'B00000000', country: 'ES' }, customer: CLIENTE }));
  let leido;
  try { leido = extraerTextoPdf(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
  if (!leido.ok || !leido.texto.includes(CONCEPTO)) { ciego++; console.log(`${c.id} · CIEGO: ${leido.motivo || 'sin concepto'}`); continue; }
  // El lector devuelve el texto SIN saltos de línea: se enseña cada aparición con lo que lleva DELANTE
  // (ahí va el rótulo) hasta el token, cortado en el final del bloque anterior conocido.
  const t = leido.texto;
  const apariciones = (tok) => { const out = []; let i = t.indexOf(tok); while (i >= 0) { out.push(t.slice(Math.max(0, i - 24), i + tok.length)); i = t.indexOf(tok, i + 1); } return out; };
  console.log(`${c.id} · ${c.que}`);
  console.log(`    tel. CLIENTE ${TEL_CLIENTE}: ${JSON.stringify(apariciones(TEL_CLIENTE))}`);
  console.log(`    tel. COMERCIO ${TEL_COMERCIO}: ${JSON.stringify(apariciones(TEL_COMERCIO))}`);
  console.log(`    nombre COMERCIAL ${COMERCIAL}: ${apariciones(COMERCIAL).length} · razón social ${FISCAL}: ${apariciones(FISCAL).length}`);
  console.log(`    rótulo «WhatsApp »: ${JSON.stringify(apariciones('WhatsApp ').map((s) => s.slice(-9) + t.slice(t.indexOf(s) + s.length, t.indexOf(s) + s.length + 9)))}`);
}
console.log(`población: ${CASOS.length} PDF · ciegos: ${ciego}`);
process.exit(ciego ? 2 : 0);

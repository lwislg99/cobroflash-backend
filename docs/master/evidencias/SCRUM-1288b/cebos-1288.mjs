// SCRUM-1288 punto 4 · ¿qué formas de «dinero en formato inglés en un aviso» caza HOY el censo de src/?
// Sonda de sólo lectura: le pasa cebos EN MEMORIA a `censarFuente` del censo del árbol que se le dé.
// Uso: node cebos-1288.mjs <raíz del árbol>
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = process.argv[2];
const censo = await import(pathToFileURL(path.join(raiz, 'scripts', '_censo-gemelo-crudo.mjs')).href);

const envoltura = (cuerpo) => `
import { sendWhatsAppText } from '../../integrations/whatsapp';
export async function avisar(importe: number, currency: string, tel: string) {
${cuerpo}
}
`;
const CEBOS = [
  // ── la aceptación literal: «toFixed junto a un literal de moneda»
  ['1 · el cebo del orquestador: suma con EUR, en un text:', `  await sendWhatsAppText({ to: tel, text: 'Cobrado ' + importe.toFixed(2) + ' EUR' });`],
  ['2 · plantilla con €', '  await sendWhatsAppText({ to: tel, text: `Cobrado ${importe.toFixed(2)} €` });'],
  ['3 · plantilla con la moneda interpolada', '  await sendWhatsAppText({ to: tel, text: `Cobrado ${importe.toFixed(2)} ${currency}` });'],
  ['4 · suma con Number(…) y la moneda en variable', `  await sendWhatsAppText({ to: tel, text: 'Cobrado ' + Number(importe).toFixed(2) + ' ' + currency });`],
  ['5 · partido en varias líneas', "  const texto = 'Cobrado '\n    + importe.toFixed(2)\n    + ' EUR';\n  await sendWhatsAppText({ to: tel, text: texto });"],
  ['6 · con «euros» escrito', '  await sendWhatsAppText({ to: tel, text: `Cobrado ${importe.toFixed(2)} euros` });'],
  // ── fuera de la aceptación literal: la misma avería por otro camino
  ['7 · por una variable intermedia', '  const t = importe.toFixed(2);\n  await sendWhatsAppText({ to: tel, text: `Cobrado ${t} €` });'],
  ['8 · toFixed(2) y la moneda en OTRA pieza del array', "  const lineas = ['Cobrado', importe.toFixed(2), 'EUR'];\n  await sendWhatsAppText({ to: tel, text: lineas.join(' ') });"],
  ['9 · la coma a mano: toFixed(2).replace', "  await sendWhatsAppText({ to: tel, text: 'Cobrado ' + importe.toFixed(2).replace('.', ',') + ' €' });"],
  ['10 · sin toFixed: el número tal cual con EUR', '  await sendWhatsAppText({ to: tel, text: `Cobrado ${importe} EUR` });'],
  ['11 · toFixed(0) con €', '  await sendWhatsAppText({ to: tel, text: `Cobrado ${importe.toFixed(0)} €` });'],
  ['12 · Intl en-US a mano', "  await sendWhatsAppText({ to: tel, text: 'Cobrado ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(importe) });"],
  ['13 · toLocaleString() sin locale, con €', "  await sendWhatsAppText({ to: tel, text: 'Cobrado ' + importe.toLocaleString() + ' €' });"],
  // ── controles negativos: no se deben acusar
  ['N1 · el formateador de la casa', "  await sendWhatsAppText({ to: tel, text: 'Cobrado ' + formatMoneyEs(importe, currency) });"],
  ['N2 · toFixed(2) en un console.log con EUR', "  console.log('cobrado ' + importe.toFixed(2) + ' EUR');"],
];

console.log(`POBLACION · ${CEBOS.length} cebos · censo de ${path.join(raiz, 'scripts', '_censo-gemelo-crudo.mjs')} · carpetas que recorre: [${censo.CARPETAS.join(', ')}]`);
let cazados = 0;
for (const [nombre, cuerpo] of CEBOS) {
  const r = censo.censarFuente('src/modules/cebo/aviso.ts', envoltura(cuerpo));
  if (r.error) { console.log(`🔴 CIEGO · ${nombre}: el cebo no parsea (${r.error})`); process.exitCode = 2; continue; }
  const acusadas = r.filas.filter((f) => (f.forma === censo.IMPORTE || f.forma === censo.SIN_FORMATEAR) && censo.acusada(f));
  if (acusadas.length) cazados++;
  console.log(`${acusadas.length ? 'CAZA   ' : 'NO CAZA'} · ${nombre}`
    + (acusadas.length ? ` · ${acusadas.map((f) => `${f.forma} ${f.destino} (${f.sumidero})`).join(', ')}` : ` · filas IMPORTE=${r.filas.filter((f) => f.forma === censo.IMPORTE).length} sueltos=${r.sueltos} enTextoSinMoneda=${r.enTextoSinMoneda}`));
}
console.log(`RECUENTO · cazados ${cazados} de ${CEBOS.length}`);

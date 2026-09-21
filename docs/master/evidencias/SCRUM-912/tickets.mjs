// docs/master/evidencias/SCRUM-912/tickets.mjs — los tickets SINTÉTICOS de la medición, con su verdad.
//
// Sintéticos a propósito: con una foto real no sabríamos qué debía leer, y «parece bien» no es una
// medición. Lo que NO miden, declarado: arrugas, sombras, papel térmico gastado, foto torcida.
// Los NIF son inventados y con el dígito de control correcto (B + 7654321 → control 4).
//
// `node tickets.mjs <dir>` escribe los .html; el PNG lo saca chrome-headless-shell (ver mide.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const estilo = `body{margin:0;background:#fff;font-family:'Courier New',monospace;font-size:15px;color:#111}
.t{width:360px;padding:18px 16px}.c{text-align:center}.r{display:flex;justify-content:space-between}
hr{border:0;border-top:1px dashed #333;margin:8px 0}b{font-weight:bold}`;

const pagina = (cuerpo) => `<!doctype html><html><head><meta charset="utf-8"><style>${estilo}</style></head><body><div class="t">${cuerpo}</div></body></html>`;
const fila = (a, b) => `<div class="r"><span>${a}</span><span>${b}</span></div>`;

export const TICKETS = [
  {
    id: 't1-completo-21',
    html: pagina(`<div class="c"><b>SUMINISTROS FONTANERÍA RUIZ S.L.</b><br>C/ Mayor 12, 28001 Madrid<br>CIF: B76543214</div><hr>
      ${fila('FACTURA SIMPLIFICADA', 'Nº T-2026-00481')}${fila('Fecha: 15/09/2026', '10:42')}<hr>
      ${fila('10 x Codo cobre 15mm', '12,00')}${fila('1 x Tubo multicapa 16mm 5m', '18,00')}<hr>
      ${fila('Base imponible', '30,00')}${fila('IVA 21%', '6,30')}${fila('<b>TOTAL</b>', '<b>36,30 €</b>')}<hr>
      <div class="c">Pago con tarjeta · Gracias por su visita</div>`),
    verdad: {
      amount: 36.3, baseAmount: 30, vatRate: 21, vatAmount: 6.3, date: '2026-09-15',
      providerInvoiceNumber: 'T-2026-00481', nifProveedor: 'B76543214',
    },
  },
  {
    id: 't2-dos-tipos',
    html: pagina(`<div class="c"><b>FERRETERÍA Y DROGUERÍA LÓPEZ</b><br>Av. de la Paz 3, Sevilla<br>NIF: B76543214</div><hr>
      ${fila('Ticket nº 88213', '16/09/2026')}<hr>
      ${fila('Silicona sanitaria', '8,26')}${fila('Botella agua 1,5L', '0,91')}<hr>
      ${fila('Base 21%', '8,26')}${fila('IVA 21%', '1,73')}${fila('Base 10%', '0,91')}${fila('IVA 10%', '0,09')}
      ${fila('<b>TOTAL</b>', '<b>10,99 €</b>')}<hr><div class="c">Efectivo</div>`),
    // Con DOS tipos, el prompt pide tipoIva y cuota a null: un solo tipo mentiría.
    verdad: { amount: 10.99, vatRate: null, vatAmount: null, date: '2026-09-16', providerInvoiceNumber: '88213' },
  },
  {
    id: 't3-solo-total',
    html: pagina(`<div class="c"><b>GASOLINERA EL CRUCE</b></div><hr>
      ${fila('17-09-2026', '08:15')}${fila('Surtidor 4 · Diésel', '')}${fila('38,52 L x 1,519', '58,51')}<hr>
      ${fila('<b>TOTAL</b>', '<b>58,51 EUR</b>')}<div class="c">IVA incluido</div>`),
    // Sin desglose ni NIF: lo que no está, null. «IVA incluido» NO es un desglose.
    verdad: { amount: 58.51, baseAmount: null, vatRate: null, vatAmount: null, nifProveedor: null, date: '2026-09-17' },
  },
];

// SCRUM-912b · solo como CLI. Antes miraba `process.argv[2]` a secas, y al importarlo `mide.mjs`
// ese argumento es el SHA: escribía una carpeta con nombre de SHA DENTRO del árbol (18-sep).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) {
  fs.mkdirSync(process.argv[2], { recursive: true });
  for (const t of TICKETS) fs.writeFileSync(path.join(process.argv[2], `${t.id}.html`), t.html);
  console.log(`${TICKETS.length} tickets escritos en ${process.argv[2]}`);
}

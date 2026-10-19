// Control positivo del extractor: un PDF COMPRIMIDO hecho con el pdfkit del repo, con lo que la sonda
// busca (IP, navegador) y acentos. Si el extractor no lo recupera, está CIEGO y no vale para nada.
// Uso: node control-pdf.mjs <raíz del repo>
import { createRequire } from 'node:module';
import { textoDePdf } from './pdf-texto.mjs';
const PDFDocument = createRequire(process.argv[2] + '/package.json')('pdfkit');
const doc = new PDFDocument({ size: 'A4', margin: 50 }); // igual que pdf.service.ts: compress por defecto
const trozos = []; doc.on('data', (c) => trozos.push(c));
const fin = new Promise((r) => doc.on('end', r));
doc.font('Helvetica').fontSize(10).text('Firmado desde 192.168.1.23 con Mozilla/5.0 (Windows NT 10.0) AppleWebKit');
doc.font('Helvetica-Bold').text('Presupuesto nº 5 · Instalación eléctrica — 1.210,00 €');
doc.end(); await fin;
const buf = Buffer.concat(trozos);
const r = textoDePdf(buf);
const crudo = buf.toString('latin1');
console.log(JSON.stringify({
  bytes: buf.length, flateEnElFichero: /\/FlateDecode/.test(crudo), textoEnBytesCrudos: crudo.includes('Mozilla'),
  streams: r.streams, inflados: r.inflados, fallidos: r.fallidos, cadenas: r.cadenas,
  ve_ip: /\b192\.168\.1\.23\b/.test(r.texto), ve_navegador: r.texto.includes('Mozilla/5.0'),
  ve_acentos: r.texto.includes('Instalación eléctrica') && r.texto.includes('€'), texto: r.texto,
}));

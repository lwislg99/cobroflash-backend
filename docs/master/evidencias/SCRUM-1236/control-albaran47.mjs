// Control sobre un PDF REAL con evidencia: el del albarán #47 (firmado), por el panel (GET, cookie QA),
// y su negativo, el #46 (emitido, sin firmar). Si el extractor no ve el certificado en el #47, el «sin
// certificado» de los presupuestos no significaría nada.
import fs from 'node:fs';
import { textoDePdf } from './pdf-texto.mjs';
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().split(';')[0];
for (const id of [47, 46]) {
  const r = await fetch(`https://yaqu.app/admin/albaranes/${id}/pdf`, { headers: { cookie } });
  const buf = Buffer.from(await r.arrayBuffer());
  const t = textoDePdf(buf);
  const ip4 = (t.texto.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).filter((x) => x.split('.').every((o) => Number(o) <= 255));
  const lineasCert = t.texto.split('\n').filter((l) => /certificado|evidencia|SHA-256|sello|canal|firmante/i.test(l));
  console.log(JSON.stringify({ albaran: id, status: r.status, bytes: buf.length, streams: t.streams, inflados: t.inflados,
    fallidos: t.fallidos, cadenas: t.cadenas, crudoVeCertificado: buf.toString('latin1').includes('Certificado'),
    certificado: lineasCert.length > 0, lineasCert, ip4, navegador: t.texto.match(/Mozilla\/5\.0|AppleWebKit|Chrome\/\d|userAgent/g) || [] }));
}

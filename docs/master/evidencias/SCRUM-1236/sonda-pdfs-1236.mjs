// SCRUM-1236 · los PDF de presupuesto que enlaza el portal del cliente 83, leídos POR DENTRO.
// Sólo GET. La cookie del panel se usa UNA vez, para leer el portalUrl; el portal y los PDF se piden SIN
// cookie (es la vía pública). Los tokens no se imprimen.
// Uso: node sonda-pdfs-1236.mjs <carpeta donde guardar los PDF>
import fs from 'node:fs';
import path from 'node:path';
import { textoDePdf } from './pdf-texto.mjs';
const OUT = process.argv[2];
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().split(';')[0];
const BASE = 'https://yaqu.app';
const det = await fetch(`${BASE}/admin/customers/83/detail`, { headers: { cookie } });
const dj = await det.json();
const portalUrl = dj.portalUrl || (dj.customer && dj.customer.portalUrl);
if (!portalUrl) { console.log(JSON.stringify({ CIEGO: 'sin portalUrl', status: det.status, claves: Object.keys(dj) })); process.exit(2); }
const portal = await fetch(new URL(portalUrl, BASE)); // SIN cookie
const html = await portal.text();
const enlaces = [...new Set([...html.matchAll(/\/pay\/quote\/[A-Za-z0-9_-]+\/pdf/g)].map((m) => m[0]))];
console.log(JSON.stringify({ portal: portal.status, bytes: html.length, pdfsEnlazados: enlaces.length }));
const IP4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IP6 = /\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi;
const NAV = /Mozilla\/5\.0|AppleWebKit|Chrome\/\d|Safari\/\d|Firefox\/\d|userAgent|"ua":|"ip":|direcci[oó]n IP/gi;
let n = 0;
for (const e of enlaces) {
  n++;
  const r = await fetch(BASE + e); // SIN cookie
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(OUT, `pdf-${n}.pdf`), buf);
  const t = textoDePdf(buf);
  // IPv4 que no sean importes ni fechas: un importe «1.210,00» no casa (\b + 4 grupos de puntos).
  const ip4 = (t.texto.match(IP4) || []).filter((x) => x.split('.').every((o) => Number(o) <= 255));
  console.log(JSON.stringify({
    pdf: n, status: r.status, tipo: r.headers.get('content-type'), bytes: buf.length,
    streams: t.streams, inflados: t.inflados, fallidos: t.fallidos, cadenas: t.cadenas,
    conocido_cliente: t.texto.includes('Cliente de pruebas QA'), conocido_presupuesto: /Presupuesto/i.test(t.texto),
    ip4, ip6: t.texto.match(IP6) || [], navegador: t.texto.match(NAV) || [],
    certificado: /certificado|evidencia|SHA-256|sello/i.test(t.texto),
    primeras: t.texto.split('\n').slice(0, 6),
  }));
}

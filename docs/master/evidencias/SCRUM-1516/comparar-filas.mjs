// comparar-filas.mjs <antes.txt> <despues.txt>
// ¿Las filas del PRODUCTO son las mismas antes y después de sembrar? Compara todo lo que hay por
// encima de la primera línea «-- CONTROLES» y, aparte, la línea TOTALES. Las fechas ISO se cambian
// por FECHA en los dos lados y se dice cuántas se cambiaron (0 fechas en un eje que las lleva sería
// un comparador que no lee).
import fs from 'node:fs';
const [a, b] = process.argv.slice(2);
if (!a || !b) { console.log('CIEGO: faltan los dos ficheros'); process.exit(2); }
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
const lee = (f) => {
  const bruto = fs.readFileSync(f, 'utf8');
  const lineas = bruto.split('\n');
  const corte = lineas.findIndex((l) => l.startsWith('-- CONTROLES'));
  if (corte < 0) return { ciego: true, bytes: bruto.length };
  const fechas = (lineas.slice(0, corte).join('\n').match(ISO) || []).length;
  // `GET /admin/referral` prueba códigos con un sufijo al azar de 3 caracteres: se normaliza (lo midió J1 en SCRUM-1514b).
  return { bytes: bruto.length, filas: lineas.slice(0, corte).map((l) => l.replace(ISO, 'FECHA').replace(/("referralCode":"NEGOCIO26)[A-Z0-9]{3}"/g, '$1???"')), fechas,
    totales: lineas.find((l) => l.startsWith('TOTALES:')) || null };
};
const A = lee(a); const B = lee(b);
if (A.ciego || B.ciego) { console.log('CIEGO: no encuentro la línea «-- CONTROLES» en ' + (A.ciego ? a : b)); process.exit(2); }
const distintas = [];
for (let i = 0; i < Math.max(A.filas.length, B.filas.length); i++) if (A.filas[i] !== B.filas[i]) distintas.push(i + 1);
console.log('antes   : ' + A.bytes + ' B · ' + A.filas.length + ' líneas por encima de los controles · fechas normalizadas ' + A.fechas);
console.log('después : ' + B.bytes + ' B · ' + B.filas.length + ' líneas por encima de los controles · fechas normalizadas ' + B.fechas);
console.log('líneas distintas: ' + distintas.length + (distintas.length ? ' → ' + distintas.slice(0, 12).join(', ') : ''));
for (const i of distintas.slice(0, 6)) { console.log('   ' + i + ' antes  : ' + String(A.filas[i - 1]).slice(0, 200)); console.log('   ' + i + ' después: ' + String(B.filas[i - 1]).slice(0, 200)); }
console.log('TOTALES iguales: ' + (A.totales === B.totales) + ' · ' + B.totales);
const ok = distintas.length === 0 && A.totales === B.totales && A.filas.length > 10;
console.log('EXIT=' + (ok ? 0 : 1)); process.exit(ok ? 0 : 1);

// SCRUM-1316 ② · La trampa del corte por fecha_vigencia, medida.
//
// uso: node corte-por-fecha-vigencia.cjs <LIVA.xml>
//
// Reproduce el filtro de docs/master/evidencias/SCRUM-1232b/extraer-articulo.cjs («la última versión con
// fecha_vigencia <= hoy») sobre el art. 91, con cinco valores de «hoy», y dice si la versión que
// devolvería trae la condición del medio de pago.
//
// La versión del RDL 26/2026 venía con fecha_vigencia="20261201". La del RDL 29/2026 viene con
// "20261008", y sus efectos son igualmente del 1-dic-2026 (lo dice su nota al pie y el art. 7.Tres).
const fs = require('fs');
const f = process.argv[2];
if (!f || !fs.existsSync(f)) { console.error('CIEGO: falta el XML'); process.exit(2); }
const x = fs.readFileSync(f, 'utf8');
const i = x.indexOf('<bloque id="a91"');
if (i < 0) { console.error('CIEGO: no existe el bloque a91'); process.exit(2); }
const b = x.slice(i, x.indexOf('</bloque>', i));
const todas = [...b.matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)];
if (!todas.length) { console.error('CIEGO: sin versiones'); process.exit(2); }
console.log(`POBLACION: ${todas.length} versiones del art. 91`);
const attr = (s, n) => (s.match(new RegExp('\\b' + n + '="([^"]*)"')) || [])[1] || '';
for (const v of todas.slice(-3)) {
  const t = v[2].replace(/<[^>]+>/g, ' ');
  console.log(`${attr(v[1], 'id_norma')} · fecha_vigencia ${attr(v[1], 'fecha_vigencia')}` +
    ` · «Téngase en cuenta»: ${t.split('Téngase en cuenta').length - 1}` +
    ` · «Redacción anterior»: ${t.split('Redacción anterior').length - 1}`);
}
for (const hoy of ['20260928', '20261007', '20261008', '20261130', '20261201']) {
  const vs = todas.filter((v) => attr(v[1], 'fecha_vigencia') <= hoy);
  const v = vs[vs.length - 1];
  console.log(`corte «fecha_vigencia <= ${hoy}» -> ${attr(v[1], 'id_norma')} (vigencia ${attr(v[1], 'fecha_vigencia')})` +
    ` · condición del medio de pago: ${v[2].includes('cheque nominativo') ? 'SI' : 'no'}`);
}

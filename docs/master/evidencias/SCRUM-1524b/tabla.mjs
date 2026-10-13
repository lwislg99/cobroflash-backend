import fs from 'node:fs';
const [, , tsv, modo, filtro] = process.argv;
const L = fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean);
const cab = L[0].split('\t');
const filas = L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
const vivas = filas.filter((f) => f.tachada === 'false');
console.log(`POBLACION · ${filas.length} filas · ${vivas.length} vivas · columnas ${cab.length}`);
if (modo === 'tabla') {
  const docs = [...new Set(vivas.map((f) => f.doc))].sort();
  const V = ['F2_DESPLAZADA', 'F2_CAMBIADA', 'INTACTA', 'SIN_REFERENCIA'];
  let tot = 0;
  for (const d of docs) {
    const x = vivas.filter((f) => f.doc === d);
    tot += x.length;
    const firmesF2 = x.filter((f) => f.casa === 'FIRME' && f.veredicto.startsWith('F2')).length;
    const unicas = new Set(x.filter((f) => f.veredicto.startsWith('F2')).map((f) => f.id)).size;
    const lineas = new Set(x.filter((f) => f.veredicto.startsWith('F2')).map((f) => f.linea)).size;
    console.log(d.replace('docs/legal/', '').padEnd(46), String(x.length).padStart(3), V.map((v) => `${v}=${x.filter((f) => f.veredicto === v).length}`).join(' '), `· F2 con testigo=${firmesF2} · F2 unicas=${unicas} · lineas del doc con F2=${lineas}`);
  }
  console.log('SUMA por documento =', tot, '(tiene que ser', vivas.length + ')');
  const otros = filas.filter((f) => !f.doc.startsWith('docs/legal/')).length;
  console.log('CERO derivado · filas fuera de docs/legal/ =', otros);
}
if (modo === 'filas') {
  const [doc, ver] = filtro.split('@');
  const x = vivas.filter((f) => f.doc.includes(doc) && f.veredicto === ver);
  console.log(`${doc} @ ${ver}: ${x.length}`);
  for (const f of x) console.log(`\n· L${f.linea} · ${f.id} · ${f.casa} · ${f.sub} · salto=${f.salto} · nacio ${f.nacio} · ${f.nota}\n    DECIA: ${f.decia.slice(0, 170)}\n    DICE : ${f.dice.slice(0, 170)}`);
}

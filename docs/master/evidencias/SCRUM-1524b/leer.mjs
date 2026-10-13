// Pone cada cita al lado de la FRASE del documento que la lleva y de lo que hay HOY en la linea citada.
import fs from 'node:fs';
const [, , tsv, docF, verF] = process.argv;
const L = fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean);
const cab = L[0].split('\t');
const filas = L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v]))).filter((f) => f.tachada === 'false');
const x = filas.filter((f) => f.doc.includes(docF) && (verF === '*' ? f.veredicto.startsWith('F2') : f.veredicto === verF));
console.log(`POBLACION · ${filas.length} vivas · ${docF} @ ${verF}: ${x.length}`);
const cache = new Map();
const leer = (p) => { if (!cache.has(p)) cache.set(p, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : null); return cache.get(p); };
for (const f of x) {
  const doc = leer(f.doc);
  const frase = (doc[Number(f.linea) - 1] || '').trim();
  const corto = f.id.replace(/:\d+(-\d+)?$/, '');
  const i = frase.indexOf(corto);
  const ventana = frase.slice(Math.max(0, i - 230), i + corto.length + 140);
  const m = f.id.match(/:(\d+)(?:-(\d+))?$/);
  const hoy = leer(f.rutaHoy);
  const a = Number(m[1]);
  const b = Number(m[2] || m[1]);
  const dice = hoy ? hoy.slice(a - 1, Math.min(b, a + 2)).map((s) => s.trim().slice(0, 150)).join(' // ') : 'NO EXISTE';
  console.log(`\n[${f.veredicto.replace('F2_', '')}] L${f.linea} · ${f.id} · ${f.casa} · ${f.sub} · salto=${f.salto} · ${f.nacio}${f.nota ? ' · ' + f.nota : ''}`);
  console.log(`  FRASE: …${ventana}…`);
  console.log(`  DECIA: ${f.decia.slice(0, 200)}`);
  console.log(`  HOY  : ${dice}`);
}

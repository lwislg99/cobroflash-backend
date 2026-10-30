// SCRUM-1599h · las cinco banderas de §1599f ①, por programa, sobre los ficheros de un commit.
// Uso: node docs/master/evidencias/SCRUM-1599/banderas-1599h.mjs <commit> <fichero>...
// Lee cada fichero con `git show <commit>:tests/<f>` (no del disco) e imprime una fila por fichero:
// bytes, las cuatro banderas de riesgo (M = merchant fijo, H = HTTP/app, E = emisión/fiscal,
// C = carrera), B = ya tiene banco, y el grupo: «sencillo» = ninguna de las cuatro; «solo-H» = sólo H.
// Los patrones son los que nombra §1599f ①; su «…» no está escrito, así que la sonda se calibra:
// sobre el commit de antes del lote 1 (0e86dada) tiene que dar los mismos 7 sencillos que dio 1599f.
import { execFileSync } from 'node:child_process';

const [commit, ...ficheros] = process.argv.slice(2);
if (!commit || ficheros.length === 0) { console.error('uso: <commit> <fichero>...'); process.exit(2); }

const PATRONES = {
  M: /MERCHANT_ID\s*=\s*1\b/,
  H: /\bfetch\s*\(|\.listen\s*\(|\bspawn(Sync)?\s*\(/,
  E: /verifactu|invoicing\/|emitir|sellar/i,
  C: /Promise\.all|carrera/i,
  B: /_banco-libro\.mjs|process\.env\.LIBRO_PG_URL/,
};

const filas = [];
for (const f of ficheros) {
  let src;
  try { src = execFileSync('git', ['show', `${commit}:tests/${f}`], { encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch { filas.push({ f, error: 'NO EXISTE en el commit' }); continue; }
  const b = Object.fromEntries(Object.entries(PATRONES).map(([k, re]) => [k, re.test(src)]));
  const riesgo = ['M', 'H', 'E', 'C'].filter((k) => b[k]);
  const grupo = riesgo.length === 0 ? 'sencillo' : riesgo.join('') === 'H' ? 'solo-H' : riesgo.join('');
  filas.push({ f, bytes: Buffer.byteLength(src), ...b, grupo });
}
filas.sort((a, b) => (a.grupo || '').localeCompare(b.grupo || '') || (a.bytes || 0) - (b.bytes || 0));
for (const r of filas) {
  if (r.error) { console.log(`${r.f}\t${r.error}`); continue; }
  const m = ['M', 'H', 'E', 'C', 'B'].map((k) => (r[k] ? k : '·')).join('');
  console.log(`${r.grupo}\t${r.bytes}\t${m}\t${r.f}`);
}
const n = filas.filter((r) => !r.error).length;
const cuenta = {};
for (const r of filas) if (!r.error) cuenta[r.grupo] = (cuenta[r.grupo] || 0) + 1;
console.log(`# poblacion ${n} de ${ficheros.length} pedidos · commit ${commit} · grupos ${JSON.stringify(cuenta)}`);
if (n === 0) { console.log('# CIEGO: no se leyó ningún fichero'); process.exit(2); }

// SCRUM-1321 · Lee historia.tsv (lo que deja historia-del-meta-guard.sh) y saca el antes/después.
// Uso: node resumen-de-la-historia.mjs <historia.tsv>
import fs from 'node:fs';

// El merge de #1951 (SCRUM-1263), commit 488410b5: `mergedAt` leído de `gh pr view 1951`.
const MERGE = '2026-09-29T09:44:13Z';
const RAMA_DEL_CAUSANTE = 'scrum-1263-empuje-solo-en-verde';

const filas = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => l.split('\t'));
const con = filas.filter((x) => (x[8] || '').startsWith('vivas')).sort((a, b) => (a[1] < b[1] ? -1 : 1));
const sinJob = filas.filter((x) => x[5] === 'SIN-JOB');
const sinRecuento = filas.filter((x) => x[5] !== 'SIN-JOB' && !(x[8] || '').startsWith('vivas'));
const mudo = (x) => x[6] !== '0';
const ciego = (x) => x[7] !== '0';
const antes = con.filter((x) => x[1] < MERGE);
const despues = con.filter((x) => x[1] >= MERGE);
const delCausante = antes.filter((x) => x[3] === RAMA_DEL_CAUSANTE);
const enMain = despues.filter((x) => x[2] === 'push');

console.log(`POBLACION · runs ${filas.length} · con recuento leído ${con.length} · con job y SIN recuento `
  + `${sinRecuento.length} (${[...new Set(sinRecuento.map((x) => x[5]))].join(', ')}) · sin job ${sinJob.length}`);
if (!con.length) { console.log('CIEGO: ni un run con recuento.'); process.exit(2); }
console.log(`ventana con recuento · ${con[0][1]} → ${con.at(-1)[1]}`);
console.log(`\nscrum853 MUDO · ANTES del merge (${MERGE}): ${antes.filter(mudo).length} de ${antes.length}`
  + ` — de ellos, del propio PR causante: ${delCausante.filter(mudo).length} de ${delCausante.length}`);
console.log(`scrum853 MUDO · DESPUÉS: ${despues.filter(mudo).length} de ${despues.length}`
  + ` (valores: ${[...new Set(despues.map((x) => x[6]))].join(', ')}) — en main (push): ${enMain.filter(mudo).length} de ${enMain.length}`);
const primero = despues.find(mudo);
if (primero) console.log(`   primer run posterior con MUDO: ${primero[1]} ${primero[2]} ${primero[3]} ${primero[4]}`);
console.log(`\nscrum859 CIEGO · antes ${antes.filter(ciego).length} de ${antes.length} · después `
  + `${despues.filter(ciego).length} de ${despues.length} · total ${con.filter(ciego).length} de ${con.length}`
  + ` (${Math.round((con.filter(ciego).length / con.length) * 100)} %)`);
console.log('\nEXIT=0');

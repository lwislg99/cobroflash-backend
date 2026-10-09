// Fecha cada carpeta de banco «fuera del catalogo» (salida de bancos.mjs de SCRUM-1394) por el primer
// commit que anadio un fichero con «mut» en el nombre dentro de ella, y la compara con la decision c.18016.
// USO: node fechar-bancos.mjs <raiz> <salida de bancos.mjs>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(process.argv[2]);
const SALIDA = fs.readFileSync(process.argv[3], 'utf8').split(/\r?\n/);
const DECISION = new Date('2026-10-02T02:10:21Z'); // c.18016: 2026-10-02T04:10:21+02:00
const MEDIDA_1394 = new Date('2026-10-01T18:46:27Z'); // ancla del registro de SCRUM-1394 (31 bancos, 18 fuera)
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 28 });
const i = SALIDA.findIndex((l) => l.startsWith('FUERA DEL CAT'));
const fuera = [];
for (const l of SALIDA.slice(i + 1)) { const m = /^\s{3}(docs\/\S+)/.exec(l); if (m) fuera.push({ dir: m[1], nota: l.replace(m[0], '').trim() }); else if (fuera.length && !l.trim()) break; }
console.log('POBLACION: ' + fuera.length + ' carpetas «fuera del catalogo» leidas de la salida de bancos.mjs · HEAD ' + git('rev-parse', 'HEAD').trim());
const seguidos = git('ls-files', '-z').split('\0').filter(Boolean);
let antes = 0; let entre = 0; let despues = 0; let sinFecha = 0;
for (const b of fuera) {
  const muts = seguidos.filter((f) => f.startsWith(b.dir + '/') && /mut/i.test(path.basename(f)));
  let primera = null; let cual = null; let sha = null;
  for (const f of muts) {
    const out = git('log', '--diff-filter=A', '--format=%cI %H', '--', f).trim().split('\n').filter(Boolean).pop();
    if (!out) continue;
    const [iso, h] = out.split(' ');
    const d = new Date(iso);
    if (!primera || d < primera) { primera = d; cual = f; sha = h; }
  }
  // cuando ENTRO en main: el primer commit de la primera linea de main (first-parent) que contiene ese fichero
  let enMain = null;
  if (cual) {
    const fp = git('log', '--first-parent', '--diff-filter=A', '--format=%cI', '--', cual).trim().split('\n').filter(Boolean).pop();
    if (fp) enMain = new Date(fp);
  }
  const ref = enMain || primera;
  let clase;
  if (!ref) { clase = 'SIN FECHA (no pude mirar)'; sinFecha++; }
  else if (ref > DECISION) { clase = 'DESPUES de la decision'; despues++; }
  else if (ref > MEDIDA_1394) { clase = 'entre la medida de 1394 y la decision'; entre++; }
  else { clase = 'antes de la medida de 1394'; antes++; }
  console.log([b.dir, 'ficheros mut: ' + muts.length, 'commit: ' + (primera ? primera.toISOString() : '-') + ' ' + (sha || '').slice(0, 9), 'en main: ' + (enMain ? enMain.toISOString() : '-'), clase, b.nota].join(' | '));
}
console.log('RECUENTO · antes de la medida de 1394: ' + antes + ' · entre medida y decision: ' + entre + ' · DESPUES de la decision (2026-10-02T02:10:21Z): ' + despues + ' · sin fecha: ' + sinFecha + ' · suma ' + (antes + entre + despues + sinFecha) + ' de ' + fuera.length);

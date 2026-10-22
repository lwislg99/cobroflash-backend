// SCRUM-1289c · ¿Un registro que dejó la unión de git (merge=union) está ROTO, o es lo que habría dado
// una fusión correcta? Se contesta RECONSTRUYENDO desde los padres, no mirando la forma del texto.
//
// Solo lectura: lee blobs con `git show`, escribe en una carpeta temporal del sistema y la borra.
//
//   node reconstruye-desde-los-padres.mjs <merge> <ruta> [<base>] [--salida=<fichero>]
//
//   --salida  escribe ahí la reconstrucción, para compararla (`git diff --no-index`) con el blob.
//
//   <base>  el commit donde las DOS mitades comparten un ancestro del fichero (p. ej. el primer
//           commit del ticket que está en los dos padres). Sin <base>, la base es el VACÍO: las dos
//           mitades nacieron por separado y lo correcto es una detrás de otra (padre 1, padre 2).
//
// Reconstrucción: `git merge-file --diff3` de tres vías (padre 1, base, padre 2); cada conflicto se
// resuelve conservando LOS DOS lados, primero el del padre 1. Nada se elige a ojo.
//
// 🔴 `--diff3` NO es estético. Sin él, git refina cada conflicto partiéndolo por las líneas que los dos
// lados tienen en común (es lo que hace la unión de `merge=union`), y la reconstrucción reproducía el
// mismo entrelazado que tenía que juzgar: con base vacía daba «idéntica» en SCRUM-964 y en SCRUM-1569, el
// caso real de SCRUM-1572. Con `--diff3` git no refina (nivel EAGER), y un conflicto es un bloque entero.
//
// Imprime, y sale 0 aunque haya diferencias (es un instrumento, no un guard):
//   · los dos padres y las líneas de cada blob (la POBLACIÓN);
//   · `conflictos`: cuántos tuvo la tres vías;
//   · `cadaMitadEnteraYEnOrden`: cada padre es subsecuencia de la reconstrucción (nada perdido);
//   · `mismasLineasQueElMerge`: el multiconjunto de líneas coincide con el blob del merge (nada inventado);
//   · `identicaAlMerge`: la reconstrucción es byte a byte el blob del merge → NO HAY DAÑO de contenido.
// Sale 2 (NO PUDE MIRAR) si falta un blob o git no responde.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const salidaA = process.argv.find((a) => a.startsWith('--salida='))?.slice('--salida='.length);
const [merge, ruta, base] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!merge || !ruta) { console.error('uso: node reconstruye-desde-los-padres.mjs <merge> <ruta> [<base>]'); process.exit(2); }
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });

let p1, p2, blobs;
try {
  [p1, p2] = git('rev-list', '--parents', '-n', '1', merge).trim().split(' ').slice(1);
  if (!p2) throw new Error(`${merge} no es un merge`);
  blobs = {
    p1: git('show', `${p1}:${ruta}`),
    p2: git('show', `${p2}:${ruta}`),
    merge: git('show', `${merge}:${ruta}`),
    base: base ? git('show', `${base}:${ruta}`) : '',
  };
} catch (e) {
  console.log(`NO PUDE MIRAR: ${e.message.split('\n')[0]}`);
  process.exit(2);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reconstruye-'));
for (const [k, v] of Object.entries(blobs)) fs.writeFileSync(path.join(dir, k), v);
let salida, conflictos = 0;
try {
  salida = execFileSync('git', ['merge-file', '-p', '--diff3', '-L', 'p1', '-L', 'base', '-L', 'p2',
    path.join(dir, 'p1'), path.join(dir, 'base'), path.join(dir, 'p2')], { encoding: 'utf8' });
} catch (e) {
  if (typeof e.status !== 'number' || e.status < 0 || e.status > 127) { console.log('NO PUDE MIRAR: git merge-file'); process.exit(2); }
  salida = e.stdout; conflictos = e.status;
}
fs.rmSync(dir, { recursive: true, force: true });

const rec = [];
let estado = 0; const A = [], B = [];
for (const l of salida.split('\n')) {
  // estados: 1 = lado del padre 1 · 3 = la base (se descarta) · 2 = lado del padre 2
  if (estado === 0 && l.startsWith('<<<<<<< ')) { estado = 1; continue; }
  if (estado === 1 && l.startsWith('||||||| ')) { estado = 3; continue; }
  if ((estado === 1 || estado === 3) && l === '=======') { estado = 2; continue; }
  if (estado === 2 && l.startsWith('>>>>>>> ')) { rec.push(...A, ...B); A.length = 0; B.length = 0; estado = 0; continue; }
  if (estado === 3) continue;
  (estado === 1 ? A : estado === 2 ? B : rec).push(l);
}
const texto = rec.join('\n');
if (salidaA) fs.writeFileSync(salidaA, texto);
const lineas = (t) => t.split('\n');
const subsecuencia = (x, y) => { let i = 0; for (const l of y) if (i < x.length && l === x[i]) i++; return i === x.length; };
const cuenta = (a) => a.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
const igualMulti = (a, b) => { const ca = cuenta(a), cb = cuenta(b); return [...new Set([...ca.keys(), ...cb.keys()])].every((k) => ca.get(k) === cb.get(k)); };

console.log(JSON.stringify({
  merge, ruta, padre1: p1, padre2: p2, base: base || '(vacío)',
  lineas: { p1: lineas(blobs.p1).length, p2: lineas(blobs.p2).length, base: base ? lineas(blobs.base).length : 0, merge: lineas(blobs.merge).length, reconstruida: rec.length },
  conflictos,
  cadaMitadEnteraYEnOrden: subsecuencia(lineas(blobs.p1), rec) && subsecuencia(lineas(blobs.p2), rec),
  mismasLineasQueElMerge: igualMulti(rec, lineas(blobs.merge)),
  identicaAlMerge: texto === blobs.merge,
}, null, 2));

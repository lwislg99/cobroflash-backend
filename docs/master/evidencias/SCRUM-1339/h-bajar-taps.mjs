// Baja el artefacto `tanda-tap` de cada run MEDIDO de la ventana (g-tasa-de-main.tsv). SOLO LECTURA.
//   node docs/master/evidencias/SCRUM-1339/h-bajar-taps.mjs <tsv> <carpeta FUERA del árbol> [--solo N]
// `--solo 1` es el canario: se baja UNO y se mira antes de lanzar los cincuenta.
// Los artefactos caducan: los del 2-oct, el 9-oct; los del 7-oct, el 14-oct.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [tsv, destino, , solo] = process.argv.slice(2);
const [cab, ...lineas] = fs.readFileSync(tsv, 'utf8').split(/\r?\n/).filter(Boolean);
const k = cab.split('\t');
const filas = lineas.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [k[i], v])))
  .filter((f) => ['CON AUSENTES', 'completo', 'sólo dudosos'].includes(f.estado));
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
fs.mkdirSync(destino, { recursive: true });
const salida = [['sha', 'run', 'estado', 'conclusion', 'resultado', 'ficheros', 'bytes'].join('\t')];
let n = 0;
for (const f of filas) {
  if (solo && n >= Number(solo)) break;
  n++;
  const dir = path.join(destino, f.sha.slice(0, 8));
  let resultado = 'bajado';
  if (!fs.existsSync(dir)) {
    try {
      execFileSync('gh', ['run', 'download', String(f.run), '-R', 'lwislg99/cobroflash-backend', '-n', 'tanda-tap', '-D', dir], { env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    } catch (e) { resultado = 'FALLO: ' + String(e.stderr || e.message).split('\n')[0]; }
  } else resultado = 'ya estaba';
  const dentro = fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).filter((x) => fs.statSync(path.join(dir, x)).isFile()) : [];
  const bytes = dentro.map((x) => fs.statSync(path.join(dir, x)).size).join(',');
  salida.push([f.sha.slice(0, 8), f.run, f.estado, f.conclusion, resultado, dentro.join(','), bytes].join('\t'));
  console.log(salida.at(-1));
}
fs.writeFileSync(path.join(destino, 'h-bajados.tsv'), salida.join('\n') + '\n');
console.log(`POBLACION: ${filas.length} runs medidos · intentados ${n} · con fichero ${salida.slice(1).filter((l) => l.split('\t')[5]).length}`);

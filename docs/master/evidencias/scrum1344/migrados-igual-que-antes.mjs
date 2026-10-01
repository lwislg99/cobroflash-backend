// docs/master/evidencias/scrum1344/migrados-igual-que-antes.mjs — SCRUM-1344
//
// LOS ARNESES MIGRADOS DAN LO MISMO QUE ANTES DE MIGRAR.
//
//     node docs/master/evidencias/scrum1344/migrados-igual-que-antes.mjs [<ref de base>]
//
// Corre, de uno en uno, cada test de `tests/` que este árbol modifica respecto a la base, y compara
// su código de salida y sus recuentos (tests, pasan, caen, saltan) con los que `antes.json` apuntó
// para ese mismo fichero ANTES de migrarlo. Un recuento que no se pudo leer es CIEGO, no «cero».
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const BASE = process.argv[2] || 'origin/main';
const antes = JSON.parse(fs.readFileSync(path.join(AQUI, 'antes.json'), 'utf8'));
const modificados = execFileSync('git', ['diff', '--name-only', '--diff-filter=M', BASE, '--', 'tests'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter((f) => f.endsWith('.test.mjs'));

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NO_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const CAMPOS = ['codigo', 'tests', 'pass', 'fail', 'skipped'];

console.log(`POBLACION=${modificados.length} tests modificados respecto a ${BASE}`);
let distintos = 0;
let ciegos = 0;
for (const f of modificados) {
  const fila = antes.filas.find((x) => 'tests/' + x.fichero === f);
  const r = spawnSync(process.execPath, [f], { cwd: RAIZ, env: entorno, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  const txt = (r.stdout || '') + (r.stderr || '');
  const n = (k) => { const m = txt.match(new RegExp(`^(?:#|\\u2139) ${k} (\\d+)`, 'm')); return m ? Number(m[1]) : null; };
  const ahora = { codigo: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped') };
  const ciego = ahora.tests === null || !fila;
  const igual = !ciego && CAMPOS.every((k) => ahora[k] === fila.base[k]);
  if (ciego) ciegos++; else if (!igual) distintos++;
  const pinta = (x) => `${x.pass}/${x.tests} caen ${x.fail} saltan ${x.skipped} (código ${x.codigo})`;
  console.log(`${ciego ? 'CIEGO   ' : igual ? 'IGUAL   ' : 'DISTINTO'} · ${f} · antes ${fila ? pinta(fila.base) : '(no estaba en antes.json)'} · ahora ${pinta(ahora)}`);
}
console.log(`RESULTADO: ${modificados.length} corridos · ${distintos} distintos · ${ciegos} ciegos`);
const fallo = distintos > 0 || ciegos > 0 || modificados.length === 0;
console.log(`EXIT=${fallo ? 1 : 0}`);
process.exit(fallo ? 1 : 0);

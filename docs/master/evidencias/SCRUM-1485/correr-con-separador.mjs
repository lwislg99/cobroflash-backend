// Corre ficheros de test DOS veces: tal cual, y con el prototipo que pone «/» de separador.
// uso: node correr-con-separador.mjs <árbol> <fichero de test>…   (rutas relativas al árbol)
// Cada pasada es un `node --test` aparte; su TAP va a esta carpeta. Imprime tests/pass/fail y qué cayó.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const [arbol, ...tests] = process.argv.slice(2);
const shim = pathToFileURL(path.join(aqui, 'separador-de-linux.mjs')).href;
const env = { ...process.env };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NO_COLOR;
console.log(`POBLACION · ${tests.length} ficheros × 2 pasadas · árbol ${arbol}`);
let ciegos = 0;
for (const t of tests) {
  const fila = [];
  for (const conShim of [false, true]) {
    const tap = path.join(aqui, `sep-${path.basename(t)}-${conShim ? 'con' : 'sin'}.tap`);
    fs.rmSync(tap, { force: true });
    const args = [...(conShim ? ['--import', shim] : []), '--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, t];
    const r = spawnSync(process.execPath, args, { cwd: arbol, env, encoding: 'utf8', timeout: 240000 });
    const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
    const n = (k) => { const m = new RegExp(`^# ${k} (\\d+)`, 'm').exec(texto); return m ? Number(m[1]) : null; };
    const activo = /separador-de-linux: ACTIVO/.test(r.stderr || '') || /separador-de-linux: ACTIVO/.test(texto);
    const caidos = [...texto.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1].slice(0, 110));
    fila.push({ conShim, exit: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), activo, caidos });
  }
  const [sin, con] = fila;
  const ciego = sin.tests === null || con.tests === null || !sin.tests || sin.tests !== con.tests;
  if (ciego) ciegos++;
  const veredicto = ciego ? 'CIEGO' : (sin.fail === 0 && con.fail === 0) ? 'IGUAL-VERDE' : (sin.fail === con.fail ? 'IGUAL-ROJO' : 'DIFIERE');
  console.log(`${veredicto} · ${t} · sin: ${sin.pass}/${sin.tests} (exit ${sin.exit}) · con «/»: ${con.pass}/${con.tests} (exit ${con.exit})`);
  for (const c of sin.caidos) console.log(`    cae SIN · ${c}`);
  for (const c of con.caidos) console.log(`    cae CON · ${c}`);
}
console.log(`CIEGOS=${ciegos}`);
console.log('EXIT=0');

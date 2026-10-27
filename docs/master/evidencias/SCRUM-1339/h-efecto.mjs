// EL MECANISMO, POR EFECTO: fabrica un arbol de mentira FUERA del repo, lo corre con `node --test`
// de verdad (reporter tap) y le pasa ese TAP a la senal de la casa, sin tocarla.
//   node docs/master/evidencias/SCRUM-1339/h-efecto.mjs [<ruta de _senal-de-nombres.mjs>]
// Casos: a = limpio (control) · b = muere AL CARGAR (import que no resuelve) · c = muere A MEDIAS
// (pasa un caso y sale con 1).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { temporal } from '../../../../tests/_temporal.mjs';
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const m = await import(pathToFileURL(path.resolve(process.argv[2] ?? path.join(RAIZ, 'scripts', '_senal-de-nombres.mjs'))).href);
const raiz = temporal('scrum1339h-efecto-');
const tests = path.join(raiz, 'tests');
fs.mkdirSync(tests);
const cab = "import { test } from 'node:test';\n";
const F = {
  'a.test.mjs': cab + "test('a uno', () => {});\ntest('a dos', () => {});\n",
  'b.test.mjs': cab + "import './no-existe.mjs';\ntest('b uno', () => {});\ntest('b dos', () => {});\ntest('b tres', () => {});\n",
  'c.test.mjs': cab + "test('c uno', () => {});\ntest('c dos', () => { process.exit(1); });\ntest('c tres', () => {});\n",
};
for (const [n, c] of Object.entries(F)) fs.writeFileSync(path.join(tests, n), c);
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;

function pasada(rotulo, ficheros) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...ficheros.map((n) => 'tests/' + n)], { cwd: raiz, env, encoding: 'utf8' });
  const tap = r.stdout;
  const t = m.leerTap(tap);
  const fuentes = ficheros.map((n) => ({ fichero: n, codigo: F[n] }));
  const s = m.senalDeNombres({ fuentes, tap });
  console.log(`\n=== ${rotulo} · node ${process.version} ${process.platform} · EXIT de node --test: ${r.status}`);
  console.log(`  TAP: tests ${t.tests} · pass ${t.pass} · fail ${t.fail} · entero ${t.entero}${t.motivo ? ' (' + t.motivo + ')' : ''}`);
  console.log(`  entradas de fichero que ve la casa: ${JSON.stringify(t.entradasDeFichero)}`);
  for (const l of tap.split('\n')) if (/^\s+(exitCode|signal|error|code|failureType):/.test(l)) console.log('    del TAP → ' + l.trim());
  console.log(`  SEÑAL: medible=${s.medible} · ausentes=${s.ausentes} · dudosos=${s.dudosos}${s.motivo ? ' · ' + s.motivo : ''}`);
  for (const b of s.bloques) console.log(`    bloque: ${b.fichero} faltan ${b.faltan} de ${b.llamadas} (${b.forma}) conEntradaDeFichero=${b.conEntradaDeFichero}\n      lo que IMPRIME: ${m.describirBloque(b)}`);
  const reg = m.registroDesdeLinea(m.lineaDeRegistro(s));
  const tasa = m.tasaDeRegistros([reg]);
  console.log(`  ¿cuenta este run en la tasa como «con ausentes»? ${tasa.conAusentes} de ${tasa.medidos} medidos`);
  return { s, t };
}
const ctl = pasada('CONTROL · sólo el limpio', ['a.test.mjs']);
const b = pasada('MUERE AL CARGAR · a + b', ['a.test.mjs', 'b.test.mjs']);
const c = pasada('MUERE A MEDIAS · a + c', ['a.test.mjs', 'c.test.mjs']);
console.log('\n=== VEREDICTO');
console.log(`  control de CERO (árbol limpio): ausentes ${ctl.s.ausentes} · entradas de fichero ${ctl.t.entradasDeFichero.length}`);
const cuentaB = b.s.medible && b.s.ausentes === 3 && b.s.bloques[0]?.conEntradaDeFichero === true && b.t.entradasDeFichero[0]?.caida === true;
const cuentaC = c.s.medible && c.s.ausentes === 3 && c.s.bloques[0]?.conEntradaDeFichero === true && c.t.entradasDeFichero[0]?.caida === true;
console.log(`  fichero que muere al cargar → sus 3 casos salen «ausentes», con la entrada CAÍDA a la vista y sin usar: ${cuentaB ? 'SÍ' : 'NO'}`);
console.log(`  fichero que muere a medias → sus 3 casos (también el que PASÓ) salen «ausentes»: ${cuentaC ? 'SÍ' : 'NO'}`);
console.log('  NO fabricado aquí: el proceso que NO SE CREA (spawn ENOENT). Lo midió J4 en SCRUM-1389 caso 9.');

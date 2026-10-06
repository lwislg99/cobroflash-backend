// Sonda de SCRUM-1395 (J4c, 6-oct-2026) · las CUATRO esquinas de scrum589.
//   A  arbol sano                                   -> se espera VERDE
//   B  filtro vaciado (la mutacion del censo)       -> el censo dice que sigue VERDE (MUDO)
//   C  filtro sano + la frase prohibida en codigo   -> si el guard vive de verdad, ROJO
//   D  filtro vaciado + la frase prohibida          -> VERDE donde NO deberia
// Muta DOS ficheros versionados del arbol que se le pasa y los devuelve byte a byte.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = process.argv[2];
const TEST = process.argv[3] || 'tests/scrum589-nombre-por-documento.test.mjs';
const HELPER = path.join(RAIZ, 'tests', '_guard-texto.mjs');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesView.js');
const FIRMA = 'export function soloEjecutable(fuente, { almohadillaEsComentario = true } = {}) {\n'; // la MISMA que censo-mudez.mjs
const FRASE = 'la razón social sustituye al nombre si existe';

const H0 = fs.readFileSync(HELPER);
const V0 = fs.readFileSync(VISTA);
if (H0.toString('utf8').split(FIRMA).length !== 2) { console.log('CIEGO: no encuentro la firma del filtro'); process.exit(2); }

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT', 'NO_COLOR']) delete entorno[k];

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, encoding: 'utf8', env: entorno, timeout: 180000 });
  const s = `${r.stdout || ''}${r.stderr || ''}`;
  const n = (k) => { const m = s.match(new RegExp(`^# ${k} (\\d+)`, 'm')); return m ? Number(m[1]) : null; };
  const caidos = [...s.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { exit: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped'), caidos };
}
const helperVacio = () => fs.writeFileSync(HELPER, H0.toString('utf8').replace(FIRMA, FIRMA + "  return ''; // sonda 1395\n"), 'utf8');
const fraseEnCodigo = () => fs.writeFileSync(VISTA, Buffer.concat([V0, Buffer.from(`\nvar __sonda1395 = "${FRASE}";\n`, 'utf8')]));
const sano = () => { fs.writeFileSync(HELPER, H0); fs.writeFileSync(VISTA, V0); };
const aplicado = () => `helper ${fs.readFileSync(HELPER).equals(H0) ? 'SANO' : 'MUTADO'} · vista ${fs.readFileSync(VISTA).equals(V0) ? 'SANA' : 'CON LA FRASE'}`;

console.log(`POBLACION: 1 fichero de test (${TEST}) · arbol ${RAIZ}`);
const filas = [];
try {
  sano(); filas.push(['A sano', aplicado(), correr()]);
  helperVacio(); filas.push(['B filtro vaciado', aplicado(), correr()]);
  sano(); fraseEnCodigo(); filas.push(['C frase en codigo, filtro sano', aplicado(), correr()]);
  helperVacio(); filas.push(['D frase en codigo, filtro vaciado', aplicado(), correr()]);
} finally { sano(); }
for (const [nombre, estado, r] of filas) {
  console.log(`\n${nombre} · [${estado}]`);
  console.log(`   exit=${r.exit} tests=${r.tests} pass=${r.pass} fail=${r.fail} skipped=${r.skipped} -> ${r.tests ? (r.exit === 0 ? 'VERDE' : 'ROJO') : 'CIEGO (0 tests)'}`);
  for (const c of r.caidos) console.log(`   cae: ${c}`);
}
const ok = fs.readFileSync(HELPER).equals(H0) && fs.readFileSync(VISTA).equals(V0);
console.log(`\nRESTAURADO byte a byte: ${ok ? 'SI' : 'NO  <-- MIRAR A MANO'}`);
console.log(`EXIT=${ok ? 0 : 3}`);
process.exit(ok ? 0 : 3);

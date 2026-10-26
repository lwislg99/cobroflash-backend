// Rojo primero de SCRUM-1516c: aplica cada mutación de MUTACIONES_QUE_ME_TUMBAN (leídas del propio test, por
// texto, sin importarlo: importarlo correría sus casos), corre el test y dice QUÉ casos caen. Restaura siempre.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const raiz = path.resolve(process.argv[2]);
const TEST = 'tests/scrum1516c-frontera-en-el-obligatorio.test.mjs';
const fuente = fs.readFileSync(path.join(raiz, TEST), 'utf8');
const bloque = fuente.slice(fuente.indexOf('export const MUTACIONES_QUE_ME_TUMBAN'));
const muts = [...bloque.matchAll(/fichero: '([^']+)',\s*de: ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),\s*a: ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),\s*cae: '([^']+)'/g)]
  .map((m) => ({ fichero: m[1], de: eval(m[2]), a: eval(m[3]), cae: m[4] }));
console.log('mutaciones leídas del catálogo: ' + muts.length);
const soloCensoyTest = process.argv.includes('--sin-src');
const compila = () => execFileSync(process.execPath, [path.join(raiz, '..', '..', '..', 'node_modules', 'typescript', 'bin', 'tsc'), '--noCheck'], { cwd: raiz, stdio: 'pipe' });
const corre = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', TEST], { cwd: raiz, encoding: 'utf8', timeout: 300000 });
  const todo = (r.stdout || '') + (r.stderr || '');
  // El reporter spec REPITE los caídos tras «✖ failing tests:»: se cuenta sólo lo de antes.
  const corte = todo.indexOf('\n✖ failing tests:');
  const sale = corte >= 0 ? todo.slice(0, corte) : todo;
  const caen = sale.split(/\r?\n/).filter((l) => /^✖ SCRUM-/.test(l)).map((l) => l.replace(/ \([\d.]+ms\)$/, ''));
  const pasan = sale.split(/\r?\n/).filter((l) => /^✔ SCRUM-/.test(l)).length;
  const total = Number((todo.match(/^ℹ tests (\d+)/m) || [])[1]);
  // Qué aserción: el primer mensaje que empieza por el eje entre corchetes y NO es la línea de diagnóstico.
  const porque = [...new Set(todo.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^AssertionError \[ERR_ASSERTION\]: /.test(l)).map((l) => l.replace(/^AssertionError \[ERR_ASSERTION\]: /, '')))].slice(0, 4);
  return { codigo: r.status, caen, pasan, total, porque };
};
const base = corre();
console.log(`BASE sin mutar: código ${base.codigo} · pasan ${base.pasan} · caen ${base.caen.length} · total ${base.total}`);
if (base.codigo !== 0 || base.caen.length) process.exit(2);
let malas = 0;
for (const m of muts) {
  if (soloCensoyTest && m.fichero.startsWith('src/')) { console.log('\n(saltada por --sin-src) ' + m.fichero); continue; }
  const f = path.join(raiz, m.fichero);
  const orig = fs.readFileSync(f, 'utf8');
  const veces = orig.split(m.de).length - 1;
  console.log(`\n· ${m.fichero} · ancla ${veces} vez/veces · cae esperado: «${m.cae}»`);
  if (veces !== 1) { console.log('  ✗ ancla no única: no se aplica'); malas += 1; continue; }
  try {
    fs.writeFileSync(f, orig.replace(m.de, m.a));
    console.log('  numstat: ' + execFileSync('git', ['diff', '--numstat', '--', m.fichero], { cwd: raiz, encoding: 'utf8' }).trim());
    if (m.fichero.startsWith('src/')) compila();
    const r = corre();
    const cayoElSuyo = r.caen.some((l) => l.includes(m.cae));
    console.log(`  código ${r.codigo} · pasan ${r.pasan} · caen ${r.caen.length} (suman ${r.pasan + r.caen.length} de ${r.total})`);
    for (const l of r.caen) console.log('    ' + l);
    for (const l of r.porque) console.log('      por: ' + l.slice(0, 220));
    console.log('  ' + (cayoElSuyo ? '✓ cae el caso que nombra' : '✗ NO cae el caso que nombra'));
    if (!cayoElSuyo) malas += 1;
  } finally {
    fs.writeFileSync(f, orig);
    if (m.fichero.startsWith('src/')) compila();
  }
}
const sucio = execFileSync('git', ['status', '--porcelain'], { cwd: raiz, encoding: 'utf8' }).trim();
console.log('\nárbol tras restaurar: ' + (sucio || 'limpio'));
console.log('EXIT=' + (malas || sucio ? 1 : 0));
process.exit(malas || sucio ? 1 : 0);

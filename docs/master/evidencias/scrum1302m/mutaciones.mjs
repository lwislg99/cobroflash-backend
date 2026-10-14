// docs/master/evidencias/scrum1302m/mutaciones.mjs — SCRUM-1302m (y SCRUM-1302n: el banco, al catálogo)
//
// EL TEST, VISTO EN ROJO. Quita el arreglo trozo a trozo en `pdf.service.ts`, compila y corre
// `tests/scrum1302m-el-total-y-la-leyenda.test.mjs`. Cada mutación tiene que tumbar EL CASO QUE
// NOMBRA; la BASE, sin mutar, ninguno.
//
// 🔴 ESTE GUION NO LLEVA LISTA PROPIA (SCRUM-1387). Las mutaciones son las `MUTACIONES_QUE_ME_TUMBAN`
// que declara el test, leídas con el lector del meta-guard (`mutacionesDeclaradas`, por AST y sin
// ejecutar el test): la red de la casa es `npm run meta:mutaciones`, que corre en el CI; esto es la
// segunda sonda, local, sobre las MISMAS cinco. Una mutación que se añada o se quite allí cambia aquí.
//
// Uso, desde la raíz, CON EL ÁRBOL COMITEADO (restaura el fichero con sus bytes de antes):
//     node docs/master/evidencias/scrum1302m/mutaciones.mjs
//
// ⚠️ Compila con `tsc --noCheck` del `node_modules` que resuelva node desde aquí. Deja `dist/`
// compilado SIN mutar al terminar, y lo comprueba con `git status`.
//
// Salidas: 0 las cinco cazadas · 1 alguna muda o la base rota, o el árbol no quedó limpio
// · 2 no supe medir (ciego).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const REL = 'src/modules/invoicing/infra/pdf/pdf.service.ts';
const FUENTE = path.join(RAIZ, REL);
const TEST = 'tests/scrum1302m-el-total-y-la-leyenda.test.mjs';
const TSC = createRequire(import.meta.url).resolve('typescript/bin/tsc');

const DECLARADAS = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), TEST);
if (DECLARADAS.length === 0) {
  console.error('CIEGO: ' + TEST + ' no declara ninguna MUTACIONES_QUE_ME_TUMBAN legible. No he mutado nada.');
  process.exit(2);
}
const ajenas = DECLARADAS.filter((m) => m.fichero !== REL);
if (ajenas.length > 0) {
  console.error('CIEGO: ' + ajenas.length + ' mutación(es) declaradas tocan otro fichero que ' + REL
    + ' (' + ajenas.map((m) => m.fichero).join(', ') + '); este guion sólo sabe restaurar ése.');
  process.exit(2);
}

// El entorno del hijo, a mano: el de un `node --test` padre o el color del chat cambian la salida.
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const correr = (orden, args) => spawnSync(orden, args, { cwd: RAIZ, env: entorno, encoding: 'utf8' });
const git = (...args) => correr('git', args).stdout.trim();

if (git('status', '--porcelain', '--', REL) !== '') {
  console.error('PARO: ' + REL + ' tiene cambios sin comitear; restaurarlo se los llevaría.');
  process.exit(2);
}

console.log('POBLACION mutaciones=' + DECLARADAS.length + ' declaradas en ' + TEST + ' + la base');
const original = fs.readFileSync(FUENTE, 'utf8');
let mal = 0;
try {
  for (const m of [null, ...DECLARADAS]) {
    const esBase = m === null;
    const nombre = esBase ? 'BASE (sin mutar)' : 'M' + (DECLARADAS.indexOf(m) + 1) + ' · «' + m.de + '» → «' + m.a + '»';
    if (!esBase) {
      const veces = original.split(m.de).length - 1;
      if (veces !== 1) throw new Error('CIEGO: «' + m.de + '» aparece ' + veces + ' veces, no 1');
      fs.writeFileSync(FUENTE, original.replace(m.de, m.a));
    }
    const numstat = git('diff', '--numstat', '--', REL);
    if (!esBase && numstat === '') throw new Error('CIEGO: la mutación no cambió el fichero con ' + nombre);
    const build = correr(process.execPath, [TSC, '--noCheck', '-p', '.']);
    if (build.status !== 0) throw new Error('CIEGO: no compila con ' + nombre + '\n' + build.stdout);
    const r = correr(process.execPath, ['--test', '--test-reporter=tap', TEST]);
    const cifra = (clave) => Number((r.stdout.match(new RegExp('^# ' + clave + ' (\\d+)$', 'm')) || [])[1]);
    const [tests, fail] = [cifra('tests'), cifra('fail')];
    if (!Number.isInteger(tests) || tests === 0) throw new Error('CIEGO: el test no dio recuento con ' + nombre + '\n' + r.stdout + r.stderr);
    const caidos = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((x) => x[1]);
    // Cazada = cae EL CASO NOMBRADO, no «alguno»: es lo mismo que exige el meta-guard.
    const esperado = esBase ? fail === 0 : caidos.some((c) => c.includes(m.cae));
    if (!esperado) mal += 1;
    console.log('\n== ' + nombre);
    if (!esBase) console.log('   tiene que caer: ' + m.cae);
    console.log('   diff --numstat: ' + (numstat === '' ? '(vacío)' : numstat.replace(/\s+/g, ' ')));
    console.log('   tests ' + tests + ' · fail ' + fail + ' · exit ' + r.status + ' → ' + (esperado ? (esBase ? 'VERDE' : 'CAZADA') : (esBase ? '🔴 LA BASE CAE' : '🔴 MUDA')));
    for (const c of caidos) console.log('     cae: ' + c);
    fs.writeFileSync(FUENTE, original);
  }
} finally {
  fs.writeFileSync(FUENTE, original);
  correr(process.execPath, [TSC, '--noCheck', '-p', '.']);
}
const resto = git('status', '--porcelain', '--', REL);
console.log('\nARBOL tras restaurar: ' + (resto === '' ? 'limpio' : '🔴 ' + resto));
console.log('MUDAS_O_BASE_ROTA=' + mal);
process.exit(mal === 0 && resto === '' ? 0 : 1);

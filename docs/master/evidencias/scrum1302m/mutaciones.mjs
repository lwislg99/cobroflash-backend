// docs/master/evidencias/scrum1302m/mutaciones.mjs — SCRUM-1302m
//
// EL TEST, VISTO EN ROJO. Quita el arreglo trozo a trozo en `pdf.service.ts`, compila y corre
// `tests/scrum1302m-el-total-y-la-leyenda.test.mjs`. Cada mutación tiene que tumbar al menos un
// caso; la BASE, sin mutar, ninguno.
//
// Uso, desde la raíz, CON EL ÁRBOL COMITEADO (restaura el fichero con `git restore`):
//     node docs/master/evidencias/scrum1302m/mutaciones.mjs
//
// ⚠️ Compila con `tsc --noCheck` del `node_modules` que resuelva node desde aquí. Deja `dist/`
// compilado SIN mutar al terminar, y lo comprueba con `git status`.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const REL = 'src/modules/invoicing/infra/pdf/pdf.service.ts';
const FUENTE = path.join(RAIZ, REL);
const TEST = 'tests/scrum1302m-el-total-y-la-leyenda.test.mjs';
const TSC = createRequire(import.meta.url).resolve('typescript/bin/tsc');

const MUTACIONES = [
  { nombre: 'BASE (sin mutar)', quita: null, pone: null },
  { nombre: 'M1 · el total vuelve a ser el guardado a secas',
    quita: '? Number(params.total) - ivaDentroDelImporte(params.lines, params.discountGlobalAmount ?? null)',
    pone: '? Number(params.total)' },
  { nombre: 'M2 · el importe de la línea vuelve a llevar el IVA',
    quita: '(1 + (ivaFueraDelPapel ? 0 : l.tax))', pone: '(1 + l.tax)' },
  { nombre: 'M3 · el total de cada opción vuelve a ser el guardado',
    quita: 'Number(tier.total) - ivaDentroDelImporte(tier.lines)', pone: 'Number(tier.total)' },
  { nombre: 'M4 · la línea de cada opción vuelve a llevar el IVA',
    quita: '(ivaFueraDelPapel ? 0 : (l.tax ?? 0))', pone: '(l.tax ?? 0)' },
  { nombre: 'M5 · el IVA de dentro se calcula sin el descuento global',
    quita: 'ivaDentroDelImporte(params.lines, params.discountGlobalAmount ?? null)',
    pone: 'ivaDentroDelImporte(params.lines)' },
];

// El entorno del hijo, a mano: el de un `node --test` padre o el color del chat cambian la salida.
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const correr = (orden, args) => spawnSync(orden, args, { cwd: RAIZ, env: entorno, encoding: 'utf8' });
const git = (...args) => correr('git', args).stdout.trim();

if (git('status', '--porcelain', '--', REL) !== '') {
  console.error('PARO: ' + REL + ' tiene cambios sin comitear; restaurarlo se los llevaría.');
  process.exit(2);
}

console.log('POBLACION mutaciones=' + (MUTACIONES.length - 1) + ' + la base');
const original = fs.readFileSync(FUENTE, 'utf8');
let mal = 0;
try {
  for (const m of MUTACIONES) {
    const esBase = m.quita === null;
    if (!esBase) {
      const veces = original.split(m.quita).length - 1;
      if (veces !== 1) throw new Error('CIEGO: «' + m.quita + '» aparece ' + veces + ' veces, no 1');
      fs.writeFileSync(FUENTE, original.replace(m.quita, m.pone));
    }
    const numstat = git('diff', '--numstat', '--', REL);
    const build = correr(process.execPath, [TSC, '--noCheck', '-p', '.']);
    if (build.status !== 0) throw new Error('CIEGO: no compila con ' + m.nombre + '\n' + build.stdout);
    const r = correr(process.execPath, ['--test', '--test-reporter=tap', TEST]);
    const cifra = (clave) => Number((r.stdout.match(new RegExp('^# ' + clave + ' (\\d+)$', 'm')) || [])[1]);
    const [tests, fail] = [cifra('tests'), cifra('fail')];
    if (!Number.isInteger(tests) || tests === 0) throw new Error('CIEGO: el test no dio recuento con ' + m.nombre + '\n' + r.stdout + r.stderr);
    const caidos = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((x) => x[1]);
    const esperado = esBase ? fail === 0 : fail > 0;
    if (!esperado) mal += 1;
    console.log('\n== ' + m.nombre);
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

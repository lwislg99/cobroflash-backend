// Banco: ¿qué ficheros que importan el oráculo de microcopy se MUEVEN con un tercer estado?
// SOLO MIDE. Muta tests/_microcopy-aprobada.mjs en un árbol de medida, corre los importadores y RESTAURA.
// uso: node banco-tercer-estado.mjs <raíz del árbol fijado a origin/main> <dir de salida>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [, , RAIZ, SALIDA] = process.argv;
const ORACULO = path.join(RAIZ, 'tests', '_microcopy-aprobada.mjs');
const git = (...a) => spawnSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8' });

const sucio = git('status', '--porcelain').stdout.trim();
if (sucio !== '') { console.log('CIEGO: el árbol de medida no está limpio; no muto encima.\n' + sucio); process.exit(2); }
const SHA = git('rev-parse', 'HEAD').stdout.trim();

// --- población: los tests/*.test.mjs que nombran el módulo (git grep, sobre lo seguido por git) ---
const todos = git('grep', '-l', '_microcopy-aprobada', '--', 'tests').stdout.split(/\r?\n/).filter(Boolean);
const sujetos = todos.filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f)).sort();
console.log(`POBLACION · árbol ${SHA} · ficheros de tests/ que nombran el oráculo ${todos.length} · de ellos tests/*.test.mjs ${sujetos.length}`);
if (sujetos.length < 10) { console.log('CIEGO: menos de 10 sujetos; el grep no ha mirado.'); process.exit(2); }

// --- el entorno del sujeto, construido a mano (A21): sin color ni opciones heredadas ---
const env = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'ComSpec', 'PATHEXT']) if (process.env[k]) env[k] = process.env[k];

function corre(fichero) {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', fichero], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const n = (clave) => { const m = new RegExp('^# ' + clave + ' (\\d+)$', 'm').exec(r.stdout || ''); return m ? Number(m[1]) : null; };
  const fila = { fichero, exit: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped') };
  fila.ciego = fila.tests === null || fila.tests === 0;
  // los nombres de los que caen, para decir QUÉ se mueve y no sólo cuántos
  fila.caidos = [...(r.stdout || '').matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((m) => m[1]).filter((s) => !s.endsWith('.test.mjs'));
  return fila;
}

const original = fs.readFileSync(ORACULO, 'utf8');
const LINEA = "        aprobada: firmante === 'fundador' || (firmante === 'orquestador' && delegacion !== null && vigente),";
if (original.split(LINEA).length !== 2) { console.log('CIEGO: la línea de «aprobada» no aparece exactamente UNA vez; el oráculo ha cambiado.'); process.exit(2); }
const CONGELADO = "      aprobada: true,";
if (original.split(CONGELADO).length !== 2) { console.log('CIEGO: la línea «aprobada: true» del congelado no aparece exactamente UNA vez.'); process.exit(2); }

const VARIANTES = {
  // el árbol tal cual: sin esta fila, un test inestable se leería como «movido»
  BASE: null,
  // ADITIVO: el criterio NO cambia (`aprobada` igual); se añade un campo `estado` de tres valores
  ADITIVO: original
    .replace(LINEA, LINEA + "\n        estado: firmante === 'fundador' ? 'aprobada' : ((firmante === 'orquestador' && delegacion !== null && vigente) ? 'aprobada-por-delegacion-sin-comprobar' : 'no-aprobada'),")
    .replace(CONGELADO, CONGELADO + "\n      estado: 'aprobada',"),
  // TECHO: el tercer estado DEJA de contar como aprobado (lo que NO se ha pedido; mide cuánto colgaría de él)
  TECHO: original.replace(LINEA, "        aprobada: firmante === 'fundador',"),
};

const resultado = {};
try {
  for (const [nombre, texto] of Object.entries(VARIANTES)) {
    if (texto !== null) fs.writeFileSync(ORACULO, texto);
    const numstat = git('diff', '--numstat').stdout.trim() || '(sin diferencias)';
    console.log(`\n=== ${nombre} · git diff --numstat: ${numstat}`);
    if (texto !== null && numstat === '(sin diferencias)') { console.log('CIEGO: la mutación no se aplicó.'); process.exit(2); }
    const filas = sujetos.map(corre);
    resultado[nombre] = filas;
    const ciegos = filas.filter((f) => f.ciego);
    console.log(`${nombre} · sujetos ${filas.length} · exit 0: ${filas.filter((f) => f.exit === 0).length} · exit ≠ 0: ${filas.filter((f) => f.exit !== 0).length} · ciegos (sin recuento): ${ciegos.length} · tests ${filas.reduce((s, f) => s + (f.tests || 0), 0)} · pass ${filas.reduce((s, f) => s + (f.pass || 0), 0)} · fail ${filas.reduce((s, f) => s + (f.fail || 0), 0)} · skipped ${filas.reduce((s, f) => s + (f.skipped || 0), 0)}`);
    for (const f of filas.filter((x) => x.exit !== 0 || x.ciego)) console.log(`   ✗ ${f.fichero} · exit ${f.exit} · tests ${f.tests} · fail ${f.fail}${f.ciego ? ' · CIEGO' : ''}`);
    git('restore', '--source=HEAD', '--worktree', '--', 'tests/_microcopy-aprobada.mjs');
  }
} finally {
  git('restore', '--source=HEAD', '--worktree', '--', 'tests/_microcopy-aprobada.mjs');
}
const despues = git('status', '--porcelain').stdout.trim();
console.log(`\nRESTAURADO · git status --porcelain: ${despues === '' ? '(limpio)' : despues}`);

// --- la comparación, por CONJUNTOS (A3): qué ficheros cambian de veredicto respecto de la BASE ---
const rojo = (v) => new Set(resultado[v].filter((f) => f.exit !== 0).map((f) => f.fichero));
const base = rojo('BASE');
for (const v of ['ADITIVO', 'TECHO']) {
  const r = rojo(v);
  const nuevos = [...r].filter((f) => !base.has(f));
  const curados = [...base].filter((f) => !r.has(f));
  console.log(`\nMOVIDOS con ${v} respecto de BASE · pasan a rojo ${nuevos.length} de ${sujetos.length} · pasan a verde ${curados.length}`);
  for (const f of nuevos) {
    const fila = resultado[v].find((x) => x.fichero === f);
    console.log(`   ${f} · fail ${fila.fail} de ${fila.tests}`);
  }
}
fs.writeFileSync(path.join(SALIDA, 'banco-tercer-estado.json'), JSON.stringify({ sha: SHA, sujetos, resultado }, null, 1));
console.log('EXIT=0');

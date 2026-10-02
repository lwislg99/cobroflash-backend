// distancia-mudez.mjs — SCRUM-1391 · a qué distancia vive `censo-mudez` de su plazo de 180 s por fichero.
//
// Corre UNO A UNO, en serie, los ficheros que el censo tomaría como población (su misma expresión),
// con su misma orden (`node --test tests/<f>`) y su mismo plazo (180 s), y cronometra cada uno.
//
//   node docs/master/evidencias/SCRUM-1391/distancia-mudez.mjs limpia <raíz> <salida.jsonl>
//       La pasada LIMPIA. No muta nada: vale sobre cualquier árbol.
//   node docs/master/evidencias/SCRUM-1391/distancia-mudez.mjs mutada <copia> <salida.jsonl>
//       La pasada MUTADA: pone en `tests/_guard-texto.mjs` DE LA COPIA la misma línea que pone el censo
//       (`soloEjecutable` devuelve la cadena vacía), cronometra y lo devuelve a sus bytes.
//       ⛔ Se NIEGA a correr si <copia> es o cuelga de un repositorio git: sólo muta una copia suelta.
//   node docs/master/evidencias/SCRUM-1391/distancia-mudez.mjs censo <copia>
//       El censo DE VERDAD (`scripts/censo-mudez.mjs` de la copia, sin tocar), entero. Misma negativa.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MODO = process.argv[2];
const RAIZ = path.resolve(process.argv[3] || '');
const SALIDA = process.argv[4] ? path.resolve(process.argv[4]) : null;
const DIR = path.join(RAIZ, 'tests');
const HELPER = path.join(DIR, '_guard-texto.mjs');
const PLAZO_MS = 180000;
// Las dos constantes de `scripts/censo-mudez.mjs`, copiadas: si allí cambian, esto se declara CIEGO abajo.
const FIRMA = 'export function soloEjecutable(fuente, { almohadillaEsComentario = true } = {}) {\n';
const LINEA_MUTADA = "  return ''; // SCRUM-719 mutación de medida\n";

if (!['limpia', 'mutada', 'censo'].includes(MODO) || !fs.existsSync(DIR)) {
  console.error('uso: node distancia-mudez.mjs <limpia|mutada|censo> <raíz o copia> [salida.jsonl]'); process.exit(2);
}
const cuelgaDeGit = () => { for (let d = RAIZ; ; d = path.dirname(d)) { if (fs.existsSync(path.join(d, '.git'))) return d; if (path.dirname(d) === d) return null; } };
if (MODO !== 'limpia' && cuelgaDeGit()) {
  console.error('⛔ ' + RAIZ + ' cuelga del repositorio ' + cuelgaDeGit() + ': el modo «' + MODO + '» muta `tests/_guard-texto.mjs` y sólo corre sobre una COPIA suelta. No se ha tocado nada.');
  console.log('EXIT=2'); process.exit(2);
}
const env = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'DATABASE_URL_PROD_RO']) delete env[k];

if (MODO === 'censo') {
  const antes = fs.readFileSync(HELPER);
  console.log('POBLACION: el censo de verdad, `scripts/censo-mudez.mjs` de la copia, sin tocar · ' + RAIZ);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['scripts/censo-mudez.mjs'], { cwd: RAIZ, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  console.log(((r.stdout || '') + (r.stderr || '')).split('\n').map((l) => '   | ' + l).join('\n'));
  console.log('censo-mudez · tardó ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s · salida ' + r.status + ' · señal ' + r.signal + ' · el filtro de la copia quedó idéntico: ' + (Buffer.compare(antes, fs.readFileSync(HELPER)) === 0));
  console.log('EXIT=' + (r.status === null ? 2 : 0)); process.exit(r.status === null ? 2 : 0);
}

const candidatos = fs.readdirSync(DIR)
  .filter((f) => /\.test\.mjs$/.test(f))
  .filter((f) => /soloEjecutable|ejecutableDe|ejecutablesDe|leerFuente|literalesDeCadena/.test(fs.readFileSync(path.join(DIR, f), 'utf8')))
  .sort();
const todos = fs.readdirSync(DIR).filter((f) => /\.test\.mjs$/.test(f)).length;
console.log('POBLACION: ' + candidatos.length + ' candidatos de ' + todos + ' .test.mjs · pasada ' + MODO.toUpperCase() + ' · plazo ' + PLAZO_MS + ' ms · FORCE_COLOR en el hijo: ' + ('FORCE_COLOR' in env) + ' · ' + RAIZ);

const ORIGINAL = fs.readFileSync(HELPER);
let aplicada = false;
if (MODO === 'mutada') {
  const texto = ORIGINAL.toString('utf8');
  if (texto.split(FIRMA).length !== 2) { console.error('CIEGO: no encuentro la firma de `soloEjecutable` en la copia: no se muta ni se mide.'); console.log('EXIT=2'); process.exit(2); }
  fs.writeFileSync(HELPER, texto.replace(FIRMA, FIRMA + LINEA_MUTADA), 'utf8');
  aplicada = Buffer.compare(ORIGINAL, fs.readFileSync(HELPER)) !== 0;
  console.log('mutación aplicada al filtro de la copia: ' + aplicada + ' (' + ORIGINAL.length + ' → ' + fs.readFileSync(HELPER).length + ' bytes)');
  if (!aplicada) { console.error('CIEGO: la mutación no cambió el fichero.'); console.log('EXIT=2'); process.exit(2); }
}

const filas = [];
if (SALIDA) fs.writeFileSync(SALIDA, '');
const t00 = Date.now();
try {
  for (const f of candidatos) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ['--test', path.join('tests', f)], { cwd: RAIZ, encoding: 'utf8', timeout: PLAZO_MS, env, maxBuffer: 64 * 1024 * 1024 });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/^\D*tests (\d+)/m);
    const fila = { f, durMs: Date.now() - t0, status: r.status, signal: r.signal, error: r.error ? r.error.code : null, tests: m ? Number(m[1]) : null };
    filas.push(fila);
    if (SALIDA) fs.appendFileSync(SALIDA, JSON.stringify(fila) + '\n');
  }
} finally {
  if (MODO === 'mutada') fs.writeFileSync(HELPER, ORIGINAL);
}
if (MODO === 'mutada') console.log('filtro de la copia devuelto a sus bytes: ' + (Buffer.compare(ORIGINAL, fs.readFileSync(HELPER)) === 0));

const orden = [...filas].sort((a, b) => b.durMs - a.durMs);
console.log('CORRIDOS: ' + filas.length + ' de ' + candidatos.length + ' en ' + ((Date.now() - t00) / 1000).toFixed(0) + ' s');
console.log('  status 0: ' + filas.filter((x) => x.status === 0).length + ' · status 1: ' + filas.filter((x) => x.status === 1).length
  + ' · status null (cortados por el plazo o matados): ' + filas.filter((x) => x.status === null).length + ' · sin resumen de tests: ' + filas.filter((x) => x.tests === null).length);
console.log('  los 8 más lentos:');
for (const x of orden.slice(0, 8)) console.log('     ' + (x.durMs / 1000).toFixed(1) + ' s (' + (100 * x.durMs / PLAZO_MS).toFixed(1) + ' % del plazo) · ' + x.f + ' · status ' + x.status + ' · tests ' + x.tests);
console.log('  mediana ' + (orden[Math.floor(orden.length / 2)].durMs / 1000).toFixed(1) + ' s · más del 10 % del plazo: ' + filas.filter((x) => x.durMs > PLAZO_MS / 10).length + ' · más del 50 %: ' + filas.filter((x) => x.durMs > PLAZO_MS / 2).length);
console.log('EL MÁS LENTO: ' + (orden[0].durMs / 1000).toFixed(1) + ' s = ' + (100 * orden[0].durMs / PLAZO_MS).toFixed(1) + ' % de 180 s · margen ×' + (PLAZO_MS / orden[0].durMs).toFixed(1));
console.log('EXIT=0');

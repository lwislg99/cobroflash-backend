// docs/master/evidencias/SCRUM-1539/banco-de-la-carrera.mjs — SCRUM-1539
//
// Lanza el test REAL `tests/scrum804b-el-barrido-de-la-42.test.mjs`, SIN TOCARLO, con la precarga
// `remoto-interpuesto.mjs` delante, y dice qué pasó. No escribe en el árbol ni en el remoto.
//
//   node docs/master/evidencias/SCRUM-1539/banco-de-la-carrera.mjs <cronometro|carrera|fabricado> <carpeta de salida> [ticket]
//
// · cronometro  la BASE: nada cambia, se mide cuánto pasa entre las dos lecturas del remoto.
// · carrera     la 1ª lectura es la de verdad; en la 2ª ya no están las ramas del ticket elegido.
// · fabricado   sin red: la 1ª lectura trae UNA rama viva del ticket dado (sha que no existe en el
//               almacén, como en CI, donde la rama de otro PR no está traída); la 2ª ya no la trae.
//
// La carpeta de salida va FUERA del árbol. Cada pasada deja `<modo>.salida.txt` y `<modo>.testigo.jsonl`.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [modo, carpeta, ticket = '1529'] = process.argv.slice(2);
if (!['cronometro', 'carrera', 'fabricado'].includes(modo) || !carpeta) {
  console.error('uso: banco-de-la-carrera.mjs <cronometro|carrera|fabricado> <carpeta de salida> [ticket]');
  process.exit(2);
}
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..', '..', '..', '..');
const sujeto = path.join(raiz, 'tests', 'scrum804b-el-barrido-de-la-42.test.mjs');
const precarga = pathToFileURL(path.join(aqui, 'remoto-interpuesto.mjs')).href;
const testigo = path.join(carpeta, `${modo}.testigo.jsonl`);
rmSync(testigo, { force: true });

const conf = { modo, testigo };
if (modo === 'fabricado') {
  const sha = 'f'.repeat(40);
  conf.lecturas = [
    `${sha}\trefs/heads/scrum-${ticket}c-rama-fabricada\n`,
    `${'e'.repeat(40)}\trefs/heads/otra-rama-sin-numero\n`,
  ];
}

// El entorno del sujeto, A MANO: sin el color del chat ni el contexto de un `node --test` de fuera.
const entorno = { ...process.env, REMOTO_INTERPUESTO: JSON.stringify(conf) };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

const t0 = Date.now();
const r = spawnSync(process.execPath, ['--import', precarga, '--test-reporter=tap', sujeto],
  { cwd: raiz, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;

if (!existsSync(testigo)) {
  console.log(`🔴 CIEGO: el sujeto no dejó testigo (${testigo}). La interposición NO corrió; EXIT=${r.status}`);
  process.exit(3);
}
const apuntes = readFileSync(testigo, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const lecturas = apuntes.filter((a) => a.que === 'ls-remote');
const fin = apuntes.find((a) => a.que === 'fin');

console.log(`POBLACION: 1 fichero de test · modo ${modo} · ${lecturas.length} lecturas del remoto · ${Date.now() - t0} ms`);
for (const l of lecturas) {
  console.log(`  lectura ${l.n}: ${l.lineas} líneas · tardó ${l.acaba - l.empieza} ms`
    + (l.msDesdeLaPrimera === undefined ? '' : ` · ${l.msDesdeLaPrimera} ms después del FIN de la 1ª`)
    + (l.quitadas ? ` · elegido SCRUM-${l.elegido} · quitadas ${l.quitadas.length}: ${l.quitadas.join(', ')}` : ''));
}
console.log(`  ramas que la 1ª pasada dio por vivas: ${fin?.vivos}`);
for (const l of salida.split('\n')) {
  if (/^(not ok|ok) \d+ - |^# (tests|pass|fail|skipped) /.test(l)) console.log(`  ${l}`);
  if (/tiene rama viva SIN mergear y el criterio lo saca|CIEGO/.test(l)) console.log(`  >>> ${l.trim().slice(0, 400)}`);
}
console.log(`SALIDA_COMPLETA_BYTES=${Buffer.byteLength(salida)}`);
console.log(`EXIT=${r.status}`);
process.stdout.write(`\n===== salida completa del sujeto =====\n${salida}`);

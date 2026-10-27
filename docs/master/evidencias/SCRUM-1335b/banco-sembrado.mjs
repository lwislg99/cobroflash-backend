// docs/master/evidencias/SCRUM-1335b/banco-sembrado.mjs — SCRUM-1335b · EL SEMBRADO, POR EL GUION REAL.
//
//   node docs/master/evidencias/SCRUM-1335b/banco-sembrado.mjs [<fichero donde dejar la salida>]
//
// QUÉ MIDE. Las condiciones ① y ② de la decisión (SCRUM-1335 c.18387), no con medidas de mentira
// sino lanzando `scripts/trinquete-de-zona.mjs` ENTERO —sonda, canarios, dos pasadas, repesca,
// veredicto, código de salida— sobre un árbol en miniatura que este banco fabrica FUERA del repo.
//
// Y lo hace DOS VECES con los mismos ficheros sembrados: con el instrumento de ANTES (el de
// `BASE`, sacado de git) y con el de AHORA (el del árbol de trabajo). La diferencia entre las dos
// columnas es lo que este ticket cambia, y nada más.
//
// POR QUÉ UN ÁRBOL EN MINIATURA Y NO EL DE VERDAD. La pasada completa son dos tandas enteras y no
// cabe en la memoria de la máquina de desarrollo; y sembrar en `tests/` de una rama empujada es
// arriesgarse a que el sembrado entre en `main` (el check obligatorio corre en UTC y lo vería en
// verde). El guion no sabe que el árbol es pequeño: `RAIZ` sale de dónde vive el propio guion.
//
// ⚠️ LA PÉRDIDA SE IMITA. El fichero sembrado deja de escribir su salida en una zona
// (`process.stdout.write = () => true`). La pérdida real sólo se ha visto en el runner de Linux.
// Lo que este banco demuestra es qué hace el instrumento con un resultado que no llega.
//
// Cada escenario declara qué código de salida ESPERA en cada versión, y el banco sale ≠ 0 si
// alguno no se cumple: sus «esperados» son afirmaciones, no decoración.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
/** El `main` del que salió la rama: el instrumento de ANTES. */
const BASE = '8dcc6d2ad6cab55e9b550220868b12adc82eb40e';
const GUIONES = ['scripts/_trinquete-de-zona.mjs', 'scripts/_trinquete-de-zona-hijo.mjs', 'scripts/trinquete-de-zona.mjs'];

const CAB = `import test from 'node:test';
import assert from 'node:assert/strict';
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;
`;
const ESPERA = "import { setTimeout as espera } from 'node:timers/promises';\n";
const ENMUDECE = "if (ZONA === 'Pacific/Midway') process.stdout.write = () => true;";

/** La censada del guion apunta a este fichero y a este nombre: aquí es un doble que cae en Midway. */
const CENSADA = {
  'scrum592-numeracion-doc02.test.mjs': `${CAB}
test('SCRUM-592 · una mezcla de renumerados y sin renumerar no se pisa', () => {
  assert.equal(new Date('2027-01-01').getFullYear(), 2027);
});
`,
  'limpio.test.mjs': `${CAB}
test('limpio · no habla de fechas', () => { assert.equal(2 + 2, 4); });
`,
};

const SEMBRADOS = {
  'perdida-entera.test.mjs': `${CAB}${ENMUDECE}
test('perdida entera · pasa (1)', () => {});
test('perdida entera · pasa (2)', () => {});
`,
  'perdida-parcial.test.mjs': `${CAB}${ESPERA}
test('perdida parcial · llega', () => {});
test('perdida parcial · pasa y no llega (1)', async () => { await espera(400); ${ENMUDECE} });
test('perdida parcial · pasa y no llega (2)', () => {});
`,
  'real.test.mjs': `${CAB}
test('real · pasa en las dos', () => {});
test('real · cae SOLO en Midway', () => { assert.notEqual(ZONA, 'Pacific/Midway'); });
`,
  'real-perdida.test.mjs': `${CAB}${ESPERA}
test('real perdida · llega', () => {});
test('real perdida · cae SOLO en Midway y no llega', async () => { await espera(400); ${ENMUDECE} assert.notEqual(ZONA, 'Pacific/Midway'); });
`,
  'muere-al-cargar.test.mjs': `${CAB}
if (ZONA === 'Pacific/Midway') throw new Error('muero al cargar en Midway');
test('muere al cargar · pasa donde carga', () => {});
`,
  'cae-en-las-dos.test.mjs': `${CAB}${ENMUDECE}
test('cae en las dos · cae siempre', () => { assert.fail('siempre'); });
`,
};

/** salida esperada del guion: [ANTES, AHORA]. 0 verde · 1 HABLA. */
const ESCENARIOS = [
  { nombre: 'A · BASE: la censada y un fichero limpio', ficheros: [], espera: [0, 0] },
  { nombre: 'B · PÉRDIDA PURA: todo pasa, en Midway faltan resultados', ficheros: ['perdida-entera.test.mjs', 'perdida-parcial.test.mjs'], espera: [1, 0] },
  { nombre: 'C · REAL: una prueba cae sólo en Midway, vista en las dos zonas', ficheros: ['real.test.mjs'], espera: [1, 1] },
  { nombre: 'D · REAL con su resultado PERDIDO donde cae', ficheros: ['real-perdida.test.mjs'], espera: [1, 1] },
  { nombre: 'E · un fichero MUERE AL CARGAR en una zona sola', ficheros: ['muere-al-cargar.test.mjs'], espera: [1, 1] },
  { nombre: 'F · cae en LAS DOS zonas y en una se pierde', ficheros: ['cae-en-las-dos.test.mjs'], espera: [1, 0] },
  { nombre: 'G · RETIRADO el sembrado real: queda sólo la pérdida', ficheros: ['perdida-parcial.test.mjs'], espera: [1, 0] },
];

const env = { ...process.env };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;

const guionDe = (version, ruta) => (version === 'AHORA'
  ? fs.readFileSync(path.join(RAIZ, ruta))
  : execFileSync('git', ['show', `${BASE}:${ruta}`], { cwd: RAIZ, maxBuffer: 1 << 26 }));

function correr(version, escenario, dir) {
  const arbol = path.join(dir, `${version}-${escenario.nombre[0]}`);
  fs.mkdirSync(path.join(arbol, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(arbol, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(arbol, 'dist'), { recursive: true });
  for (const g of GUIONES) fs.writeFileSync(path.join(arbol, g), guionDe(version, g));
  fs.copyFileSync(path.join(RAIZ, 'tests', '_temporal.mjs'), path.join(arbol, 'tests', '_temporal.mjs'));
  for (const [n, c] of Object.entries(CENSADA)) fs.writeFileSync(path.join(arbol, 'tests', n), c);
  for (const n of escenario.ficheros) fs.writeFileSync(path.join(arbol, 'tests', n), SEMBRADOS[n]);

  const r = spawnSync(process.execPath, [path.join(arbol, 'scripts', 'trinquete-de-zona.mjs')], {
    cwd: arbol, env, encoding: 'utf8', maxBuffer: 1 << 26,
  });
  const L = (r.stdout || '').split('\n');
  return {
    salida: r.status,
    ficheros: (L.find((l) => /ficheros de la tanda \+/.test(l)) || '').trim(),
    // La ruta del árbol en miniatura es de ESTA máquina y de ESTA corrida: se recorta.
    nuevas: L.filter((l) => /^ {3}🔴 NUEVA /.test(l))
      .map((l) => l.replace(/^ {3}🔴 NUEVA /, '').trim().replace(arbol + path.sep, '<árbol>/')),
    sinComparar: (L.find((l) => /^NO PUDE COMPARAR/.test(l)) || '(esta versión no lo dice)').trim(),
    detalle: L.filter((l) => /^ {3}· .*faltan \d+ en /.test(l)).map((l) => l.trim()),
    canarios: L.filter((l) => /DEPENDIENTE|FIJADO/.test(l) && /denunciado|DENUNCIADO/.test(l)).length,
    final: (L.find((l) => /^(✔|🔴) (TRINQUETE|EL TRINQUETE|CIEGO|UNA CENSADA|EL INSTRUMENTO)/.test(l)) || '(sin línea final)').trim(),
  };
}

// La salida la escribe el propio banco, no una redirección: el `>` de PowerShell 5.1 mete un BOM,
// y un fichero de evidencias con BOM es justo lo que A22.1 pide no añadir.
const lineas = [];
const console = { log: (l) => { lineas.push(l); process.stdout.write(`${l}\n`); } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1335b-banco-'));
let incumplidos = 0;
try {
  console.log(`POBLACION · ${ESCENARIOS.length} escenarios × 2 versiones = ${ESCENARIOS.length * 2} corridas del guion · node ${process.version} · ${os.platform()}`);
  console.log(`ANTES = ${BASE}   AHORA = el árbol de trabajo (HEAD ${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).trim()})`);
  for (const e of ESCENARIOS) {
    console.log(`\n══ ${e.nombre}`);
    console.log(`   sembrados: ${e.ficheros.join(', ') || '(ninguno)'}`);
    ['ANTES', 'AHORA'].forEach((version, i) => {
      const r = correr(version, e, dir);
      const cumple = r.salida === e.espera[i];
      if (!cumple) incumplidos++;
      console.log(`   ${version} · salida ${r.salida} (esperada ${e.espera[i]}) ${cumple ? '✔' : '🔴 NO CUMPLE'} · ${r.ficheros} · canarios juzgados ${r.canarios}`);
      console.log(`           ${r.final}`);
      console.log(`           acusa (🔴 NUEVA): ${r.nuevas.length}${r.nuevas.length ? ` → ${r.nuevas.join(' | ')}` : ''}`);
      console.log(`           ${r.sinComparar}`);
      for (const d of r.detalle) console.log(`             ${d}`);
    });
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`\nRESUMEN · ${ESCENARIOS.length * 2 - incumplidos} de ${ESCENARIOS.length * 2} corridas dan la salida esperada`);
console.log(`EXIT=${incumplidos ? 1 : 0}`);
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), `${lineas.join('\n')}\n`);
process.exit(incumplidos ? 1 : 0);

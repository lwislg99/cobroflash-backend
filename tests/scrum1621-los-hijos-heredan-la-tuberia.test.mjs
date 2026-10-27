// tests/scrum1621-los-hijos-heredan-la-tuberia.test.mjs — SCRUM-1621 (pieza 1) · S5
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA SALIDA C DE SCRUM-1405 LLEGA A LOS DOS `run()` QUE QUEDABAN SIN ELLA
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// SCRUM-1339s la llevó al hijo del meta-guard y dejó escrito el hueco: `_trinquete-de-zona-hijo.mjs` y
// `censo-guards-gateados.mjs` lanzan hijos con `run()` y `forceExit`, sin `execArgv`, así que en Linux
// esos hijos siguen pudiendo perder la cola de su informe. Los dos son de S5 (`carriles.mjs de`,
// `dos-equipos.md:189`), y SCRUM-1621 los pide. La autorización es la misma: SCRUM-1405 c.19584 («Ok la
// C») extendida a los `run()` por SCRUM-1339 c.20219.
//
// Se mide el EFECTO, como en 1339s: cada instrumento corre una cobaya de fuera del árbol que sólo da su
// veredicto bueno si el módulo se cargó en SU proceso. Y el control positivo demuestra que cada cobaya
// discrimina: lanzada por el mismo `run()` sin el `--import`, da el otro.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO dice que esos dos instrumentos hayan perdido informes en Linux: no está medido. Dice que sus hijos
//    cargan el módulo que, medido en SCRUM-1405, hace que no se pierdan. En Windows no hay rojo que ver.
//
// ⚠️ `run()` no se puede llamar dentro de un fichero de test (lo detecta y devuelve CERO tests): cada
// medida va en un proceso aparte, sin `NODE_TEST_CONTEXT` ni el `--import` de la tanda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HIJO_DE_ZONA = path.join(RAIZ, 'scripts', '_trinquete-de-zona-hijo.mjs');
const CENSO = pathToFileURL(path.join(RAIZ, 'scripts', 'censo-guards-gateados.mjs')).href;

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/_trinquete-de-zona-hijo.mjs',
    de: '  execArgv: [`--import=${TUBERIA_BLOQUEANTE}`],',
    a: '  execArgv: [], // sin la tuberia bloqueante, a proposito',
    cae: 'SCRUM-1621 · 🔴 el hijo de la tanda de zona carga la tubería bloqueante' },
  { fichero: 'scripts/censo-guards-gateados.mjs',
    de: '    execArgv: [`--import=${TUBERIA_BLOQUEANTE}`],',
    a: '    execArgv: [], // sin la tuberia bloqueante, a proposito',
    cae: 'SCRUM-1621 · 🔴 el hijo del censo de gateados carga la tubería bloqueante' },
];

const MARCA = "Symbol.for('yaqu.scrum1405c.tuberiaBloqueante')";
const NOMBRE_ZONA = 'cobaya 1621: la tubería está cargada en este proceso';
/** Pasa si el módulo está cargado; si no, CAE. Es la que lee el hijo de zona (`pass` / `fail`). */
const COBAYA_ZONA = `import test from 'node:test';
import assert from 'node:assert/strict';
test(${JSON.stringify(NOMBRE_ZONA)}, () => { assert.ok(globalThis[${MARCA}], 'el módulo NO se cargó en el hijo'); });
`;
/** Corre si el módulo está cargado; si no, se SALTA. Es la que lee el censo (`reales` / `saltados`). */
const COBAYA_CENSO = `import test from 'node:test';
test('cobaya 1621 del censo', { skip: !globalThis[${MARCA}] && 'sin la tubería' }, () => {});
`;

/** Un entorno sin lo que la tanda inyecta: así el control positivo mide un hijo que de verdad no lo lleva. */
function entornoLimpio(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; delete env.FORCE_COLOR;
  return env;
}

/** Corre un guion en un node aparte y devuelve el JSON de su línea `RESULTADO `. */
function resultadoDe(dir, codigo, args = []) {
  const guion = path.join(dir, 'medir.mjs');
  fs.writeFileSync(guion, codigo);
  const r = spawnSync(process.execPath, [guion, ...args], { cwd: RAIZ, env: entornoLimpio(), encoding: 'utf8', timeout: 120000 });
  const linea = String(r.stdout || '').split(/\r?\n/).find((l) => l.startsWith('RESULTADO '));
  assert.ok(linea, `NO PUDE MIRAR: el proceso aparte no devolvió resultado (status ${r.status}, stderr ${String(r.stderr || '').slice(0, 400)})`);
  return JSON.parse(linea.slice('RESULTADO '.length));
}

/** El veredicto que el hijo de zona apunta para la cobaya. Población: UNA clave, con su nombre. */
function veredictoDelHijoDeZona(script) {
  const dir = temporal('scrum1621-zona-');
  const cobaya = path.join(dir, 'cobaya.test.mjs');
  fs.writeFileSync(cobaya, COBAYA_ZONA);
  const lista = path.join(dir, 'lista.json');
  fs.writeFileSync(lista, JSON.stringify([cobaya]));
  const destino = path.join(dir, 'medida.json');
  const r = spawnSync(process.execPath, [script, lista, destino, dir, '60000', '90000'],
    { cwd: RAIZ, env: entornoLimpio({ TZ: 'UTC' }), encoding: 'utf8', timeout: 120000 });
  assert.ok(fs.existsSync(destino), `NO PUDE MIRAR: el hijo de zona no escribió su medida (status ${r.status}, stderr ${String(r.stderr || '').slice(0, 400)})`);
  const m = JSON.parse(fs.readFileSync(destino, 'utf8'));
  const claves = m.veredictos.filter(([k]) => k.endsWith(`::${NOMBRE_ZONA}`));
  assert.equal(claves.length, 1, `NO PUDE MIRAR: la cobaya no llegó con su nombre (${JSON.stringify(m.veredictos)})`);
  return claves[0][1];
}

test('SCRUM-1621 · 🔴 el hijo de la tanda de zona carga la tubería bloqueante', () => {
  assert.equal(veredictoDelHijoDeZona(HIJO_DE_ZONA), 'pass',
    'el hijo de `_trinquete-de-zona-hijo.mjs` NO cargó scripts/tuberia-bloqueante.mjs');
});

test('SCRUM-1621 · control positivo: el MISMO hijo de zona sin el --import da la cobaya por caída', () => {
  const dir = temporal('scrum1621-zona-sin-');
  const fuente = fs.readFileSync(HIJO_DE_ZONA, 'utf8');
  const sin = fuente.replace(MUTACIONES_QUE_ME_TUMBAN[0].de, MUTACIONES_QUE_ME_TUMBAN[0].a);
  assert.notEqual(sin, fuente, 'NO PUDE MIRAR: la línea del --import no está en el hijo de zona; el control no se aplicó');
  // La copia va FUERA del árbol: escribir en `scripts/` movería el árbol mientras otros miden. Sin el
  // `--import` no carga nada de `scripts/`: sólo usa módulos de node.
  const copia = path.join(dir, 'hijo-sin-tuberia.mjs');
  fs.writeFileSync(copia, sin);
  assert.equal(veredictoDelHijoDeZona(copia), 'fail',
    'la cobaya NO discrimina: sin el módulo también pasa. Un verde del caso de arriba no probaría nada.');
});

test('SCRUM-1621 · 🔴 el hijo del censo de gateados carga la tubería bloqueante', () => {
  const dir = temporal('scrum1621-censo-');
  const cobaya = path.join(dir, 'cobaya.test.mjs');
  fs.writeFileSync(cobaya, COBAYA_CENSO);
  const r = resultadoDe(dir, `const { medirGateados } = await import(${JSON.stringify(CENSO)});
const m = await medirGateados([process.argv[2]]);
console.log('RESULTADO ' + JSON.stringify(Object.fromEntries(m)));`, [cobaya]);
  // Población: la cobaya, una vez, con su único caso contado de algún lado.
  assert.deepEqual(Object.keys(r), ['cobaya.test.mjs'], `NO PUDE MIRAR: el censo no vio la cobaya (${JSON.stringify(r)})`);
  assert.deepEqual(r['cobaya.test.mjs'], { reales: 1, saltados: 0 },
    `el hijo de medirGateados() NO cargó scripts/tuberia-bloqueante.mjs: ${JSON.stringify(r)}`);
});

test('SCRUM-1621 · control positivo: la cobaya del censo, lanzada por run() sin el --import, se SALTA', () => {
  const dir = temporal('scrum1621-censo-sin-');
  const cobaya = path.join(dir, 'cobaya.test.mjs');
  fs.writeFileSync(cobaya, COBAYA_CENSO);
  const r = resultadoDe(dir, `import { run } from 'node:test';
let reales = 0; let saltados = 0;
for await (const ev of run({ files: [process.argv[2]], forceExit: true, timeout: 60000 })) {
  if (ev.type === 'test:pass') { if (ev.data.skip) saltados++; else reales++; } else if (ev.type === 'test:fail') reales++;
}
console.log('RESULTADO ' + JSON.stringify({ reales, saltados }));`, [cobaya]);
  assert.deepEqual(r, { reales: 0, saltados: 1 },
    `la cobaya del censo NO discrimina: sin el módulo no se salta (${JSON.stringify(r)}). Un verde del caso de arriba no probaría nada.`);
});

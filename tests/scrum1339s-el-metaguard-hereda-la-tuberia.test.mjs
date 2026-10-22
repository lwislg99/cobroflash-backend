// tests/scrum1339s-el-metaguard-hereda-la-tuberia.test.mjs — SCRUM-1339 (tramo 1339s) · S3
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA SALIDA C DE SCRUM-1405 NO LLEGABA AL META-GUARD
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// SCRUM-1405c puso BLOQUEANTE la tubería de salida de cada hijo de la tanda
// (`scripts/tuberia-bloqueante.mjs`, cargado con `--import` en el script `test`). Su registro dejó
// escrito el hueco: las copias del flag que lanzan hijos con `run()` de `node:test` «siguen
// perdiendo», porque la autorización era para el script `test` y no las cubre. Javier aprobó
// extenderla (SCRUM-1339 c.20219). Este tramo cubre SÓLO la del meta-guard, que es la de la S3; las
// otras dos (`_trinquete-de-zona-hijo.mjs`, `censo-guards-gateados.mjs`) no tienen dueño declarado
// y esperan a que la S0 se lo ponga (orquestador, 22-oct-2026).
//
// Lo que se comprueba es el EFECTO, no el texto: `correr()` lanza un fichero de fuera del árbol que
// sólo pasa si el módulo se cargó en SU proceso. Y el control positivo demuestra que esa cobaya
// discrimina: lanzada por el mismo `run()` sin el `--import`, cae.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO dice que el meta-guard haya dejado de perder informes en Linux. Dice que su hijo carga el
//    módulo que, medido en SCRUM-1405 (0 de 12 tandas, 0 de 4 pasadas en el obligatorio de #2429),
//    hace que no se pierdan. En Windows la tubería ya es bloqueante y no hay rojo que ver.
//
// ⚠️ `run()` NO se puede llamar dentro de un fichero de test: node lo detecta, avisa «run() is
// being called recursively within a test file. skipping running files» y devuelve CERO tests. Medido
// en la primera versión de este guard, que lo cazó su propio suelo de población («NO PUDE MIRAR»).
// Por eso las dos pasadas van en un proceso APARTE, sin `NODE_TEST_CONTEXT` y sin el `--import` de
// la tanda en su `execArgv`: así el control positivo mide un hijo que de verdad no lo lleva.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { paso, cayo } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const META = pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href;

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    execArgv: [`--import=${TUBERIA_BLOQUEANTE}`],',
    a: '    execArgv: [], // sin la tuberia bloqueante, a proposito',
    cae: 'SCRUM-1339s · 🔴 el hijo que lanza correr() carga la tubería bloqueante' },
];

const NOMBRE_COBAYA = 'cobaya 1339s: el módulo de la tubería está cargado en este proceso';
const COBAYA = `import test from 'node:test';
import assert from 'node:assert/strict';
test(${JSON.stringify(NOMBRE_COBAYA)}, () => {
  assert.ok(globalThis[Symbol.for('yaqu.scrum1405c.tuberiaBloqueante')], 'el módulo NO se cargó en el hijo');
});
`;

/** Escribe la cobaya fuera del árbol, corre `codigo` en un node aparte y devuelve el JSON que imprime. */
function enOtroProceso(codigo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1339s-'));
  try {
    const fichero = path.join(dir, 'cobaya.test.mjs');
    fs.writeFileSync(fichero, COBAYA);
    // ⚠️ Un GUION, no `node -e`: con `--input-type=module -e` el hijo de `run()` hereda ese flag,
    // no arranca sobre un fichero, y node:test lo informa como el FICHERO «pasado» con cero tests.
    // Medido al escribir esto: un falso verde del control positivo con forma de resultado.
    const guion = path.join(dir, 'medir.mjs');
    fs.writeFileSync(guion, codigo);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; delete env.FORCE_COLOR;
    const r = spawnSync(process.execPath, [guion, fichero],
      { cwd: RAIZ, env, encoding: 'utf8', timeout: 120000 });
    const linea = String(r.stdout || '').split(/\r?\n/).find((l) => l.startsWith('RESULTADO '));
    assert.ok(linea, `NO PUDE MIRAR: el proceso aparte no devolvió resultado (status ${r.status}, `
      + `stderr ${String(r.stderr || '').slice(0, 400)})`);
    const res = JSON.parse(linea.slice('RESULTADO '.length));
    // Población: la cobaya tiene UN test, y tiene que llegar CON SU NOMBRE. Contar «algo llegó» no
    // basta: un hijo que no arranca llega como el fichero «pasado» (lo de arriba).
    assert.ok(paso(res, NOMBRE_COBAYA) || cayo(res, NOMBRE_COBAYA),
      `NO PUDE MIRAR: el test de la cobaya no llegó con su nombre (${linea})`);
    return res;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('SCRUM-1339s · 🔴 el hijo que lanza correr() carga la tubería bloqueante', () => {
  const r = enOtroProceso(`const { correr } = await import(${JSON.stringify(META)});
const r = await correr(process.argv[2]);
console.log('RESULTADO ' + JSON.stringify({ pasados: r.pasados, caidos: r.caidos }));`);
  assert.ok(paso(r, NOMBRE_COBAYA),
    `el hijo de correr() NO cargó scripts/tuberia-bloqueante.mjs: pasados ${JSON.stringify(r.pasados)} · caídos ${JSON.stringify(r.caidos)}`);
});

test('SCRUM-1339s · control positivo: sin el --import, la MISMA cobaya cae', () => {
  const r = enOtroProceso(`import { run } from 'node:test';
const pasados = []; const caidos = [];
for await (const ev of run({ files: [process.argv[2]], forceExit: true, timeout: 60000 })) {
  if (ev.type === 'test:pass' && !ev.data.skip) pasados.push(ev.data.name);
  else if (ev.type === 'test:fail') caidos.push(ev.data.name);
}
console.log('RESULTADO ' + JSON.stringify({ pasados, caidos }));`);
  assert.ok(cayo(r, NOMBRE_COBAYA),
    `la cobaya NO discrimina: sin el módulo también pasa (pasados ${JSON.stringify(r.pasados)}). `
    + 'Un verde del caso de arriba no probaría nada.');
});

// SCRUM-1743 · `scripts/tanda-entera-por-tramos.mjs --tramo` se niega a ir ENCADENADO con otro tramo en el
// mismo comando del arnés. Un bucle de tramos pasa de 600 s, el arnés lo manda a segundo plano y allí su reaper
// lo mata por memoria (medido el 16-nov en jv-j5bc y jv-j1f2).
//
// La señal NO es `process.ppid`: medido el 18-nov (c.21996), desde Git Bash el padre directo de node es un bash
// recién forkeado en CADA vuelta del bucle (11 de 11 distintos). Lo estable es la RAÍZ DEL COMANDO, el primer
// ancestro cuyo padre es `claude.exe`, guardada con pid + hora de creación (el PID se reutiliza: el 19380 fue un
// node y a los 22 s un bash de otro comando). Decisión: c.21998.
//
// La cadena de ancestros se SIMULA con `TANDA_TRAMOS_CADENA` (JSON, del padre hacia arriba). Tres casos:
//   · misma raíz en la misma pasada → la segunda llamada sale 2 con el mensaje literal del ticket;
//   · raíz distinta (mismo pid, otra hora de creación: la reutilización de PID) → 0;
//   · sin `claude.exe` en la cadena (CI, una terminal a mano) → 0 y una línea CIEGO que se ve en la salida
//     del runner y, por `t.diagnostic`, en el TAP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'tanda-entera-por-tramos.mjs');

const PASA = "import { test } from 'node:test';\ntest('pasa', () => {});\n";
const MENSAJE = 'un tramo por comando: encadenados pasan de 600 s, el arnés los manda a segundo plano y allí los mata por memoria';
const AVISO_CIEGO = /🔴 CIEGO · no sé quién me lanza \(no hay claude\.exe entre mis ancestros\): no compruebo si vas encadenado \(SCRUM-1743\)/;

// El rojo de la pieza, declarado: lo ejecuta `npm run meta:mutaciones` (y a mano, `aplicarUna`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/tanda-entera-por-tramos.mjs',
    de: 'const repetida = previas.find((p) => p.pid === raiz.pid && p.creado === raiz.creado);',
    a: 'const repetida = previas.find((p) => p.pid === raiz.pid);',
    cae: 'SCRUM-1743 · raíz DISTINTA (mismo pid, otra hora de creación: PID reutilizado) → 0',
  },
  {
    fichero: 'scripts/tanda-entera-por-tramos.mjs',
    de: 'if (repetida) {',
    a: 'if (false) {',
    cae: 'SCRUM-1743 · 🔴 EL CASO: dos --tramo con la MISMA raíz en la misma pasada → el segundo sale 2',
  },
];

/** Cadena simulada, del padre hacia arriba: bash forkeado ← bash del comando ← raíz ← claude.exe. */
const cadena = (raizPid, raizCreado, { conClaude = true } = {}) => JSON.stringify([
  { pid: 9001, nombre: 'bash.exe', creado: '2026-11-18T04:33:43.486Z' },
  { pid: 9002, nombre: 'bash.exe', creado: '2026-11-18T04:33:41.455Z' },
  { pid: raizPid, nombre: 'bash.exe', creado: raizCreado },
  ...(conClaude ? [{ pid: 15440, nombre: 'claude.exe', creado: '2026-11-18T04:30:24.601Z' }] : []),
]);

function conBanco(cuerpo) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1743-'));
  try {
    const dir = path.join(raiz, 'tests');
    fs.mkdirSync(dir);
    for (const n of ['a', 'b', 'c', 'd']) fs.writeFileSync(path.join(dir, `${n}.test.mjs`), PASA);
    cuerpo({ raiz, dir });
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
}

function correr({ raiz, dir }, args, cadenaSimulada) {
  const env = {
    ...process.env, TANDA_TRAMOS_BASE: path.join(raiz, 'registro'), TANDA_TRAMOS_ARBOL: 'banco-1743',
    TANDA_TRAMOS_CADENA: cadenaSimulada,
  };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete env[k];
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', dir, ...args], { cwd: RAIZ, env, encoding: 'utf8', timeout: 120000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('SCRUM-1743 · 🔴 EL CASO: dos --tramo con la MISMA raíz en la misma pasada → el segundo sale 2', () => {
  conBanco((b) => {
    const misma = cadena(12496, '2026-11-18T04:33:41.440Z');
    const primero = correr(b, ['--tramo', '1/2'], misma);
    assert.equal(primero.status, 0, `CONTROL: un tramo suelto en su comando sale 0\n${primero.out}`);
    assert.ok(!primero.out.includes(MENSAJE), primero.out);
    const segundo = correr(b, ['--tramo', '2/2'], misma);
    assert.equal(segundo.status, 2, segundo.out);
    assert.ok(segundo.out.includes(MENSAJE), segundo.out);
    assert.match(segundo.out, /SCRUM-1743/);
  });
});

test('SCRUM-1743 · raíz DISTINTA (mismo pid, otra hora de creación: PID reutilizado) → 0', () => {
  conBanco((b) => {
    const uno = correr(b, ['--tramo', '1/2'], cadena(12496, '2026-11-18T04:33:41.440Z'));
    assert.equal(uno.status, 0, uno.out);
    const otro = correr(b, ['--tramo', '2/2'], cadena(12496, '2026-11-18T04:35:02.117Z'));
    assert.equal(otro.status, 0, otro.out);
    assert.ok(!otro.out.includes(MENSAJE), otro.out);
    const tercero = correr(b, ['--tramo', '1/2'], cadena(9884, '2026-11-18T04:33:45.476Z'));
    assert.equal(tercero.status, 0, `otro pid, otro comando: 0\n${tercero.out}`);
  });
});

test('SCRUM-1743 · sin claude.exe en la cadena → 0 y un aviso CIEGO que se ve (salida y TAP)', (t) => {
  conBanco((b) => {
    const sin = cadena(12496, '2026-11-18T04:33:41.440Z', { conClaude: false });
    const r1 = correr(b, ['--tramo', '1/2'], sin);
    const r2 = correr(b, ['--tramo', '2/2'], sin);
    const linea = r2.out.split('\n').find((l) => AVISO_CIEGO.test(l));
    if (linea) t.diagnostic(`salida del runner: ${linea.trim()}`);
    assert.equal(r1.status, 0, r1.out);
    assert.equal(r2.status, 0, `sin saber quién lanza, no bloquea\n${r2.out}`);
    assert.match(r1.out, AVISO_CIEGO);
    assert.ok(linea, `el CIEGO tiene que IMPRIMIRSE, no callar\n${r2.out}`);
    assert.ok(!r2.out.includes(MENSAJE), r2.out);
  });
});

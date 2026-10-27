// tests/scrum1553c-la-consulta-vacia-se-vigila.test.mjs · J3 (equipo de Javier), 14-oct-2026
//
// SCRUM-1553 ③, salida D: `docs/master/evidencias/SCRUM-1553/contradiccion.mjs` es la consulta que tiene que
// salir VACÍA (`listo-para-construir` junto a `esperando-*`, `decision-jefe`, `fundador` o `sin-firma`). La
// consulta REAL se corre a mano en el PASO 0 de quien reparte: CI no tiene Jira, y una foto commiteada se
// congela en la hora en que se sacó. Aquí entra SOLO `--solo-controles`, que no lee nada de fuera: vigila que
// el instrumento siga cazando su semilla (SCRUM-90001…90008), no que las etiquetas digan verdad.
//
// Por qué hace falta: si el instrumento deja de cazar, su salida es la misma que la de «no hay nada que cazar».
// Este test distingue tres cosas, y solo la primera es verde:
//   · los controles PASAN       → exit 0 Y la línea «CONTROLES · N tickets sembrados … pasan», con N ≥ 8;
//   · los controles FALLAN      → exit 2 y «FALLAN» (lo prueba el segundo test, con una copia rota);
//   · el guion NO ARRANCÓ       → falta el fichero, revienta al cargar, o sale 0 sin la línea: ROJO, nunca mudo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUION = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-1553', 'contradiccion.mjs');
const MINIMO_SEMBRADOS = 8;
const RE_LINEA = /^CONTROLES · (\d+) tickets sembrados .*: (pasan|🔴 FALLAN)$/m;

// El hijo de `node --test` hereda NODE_TEST_CONTEXT y no ejecuta nada (SCRUM-1308): entorno a mano.
function entornoDelHijo() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  delete env.FORCE_COLOR;
  return env;
}

function lanzar(ruta) {
  const r = spawnSync(process.execPath, [ruta, '--solo-controles'], { encoding: 'utf8', env: entornoDelHijo(), timeout: 30000 });
  return { status: r.status, signal: r.signal, error: r.error, salida: `${r.stdout || ''}${r.stderr || ''}` };
}

test('SCRUM-1553c · la consulta vacía caza su semilla: exit 0 y la línea de controles con su recuento', () => {
  assert.ok(fs.existsSync(GUION), `NO ARRANCÓ: no existe ${path.relative(RAIZ, GUION)} (¿borrado o renombrado?)`);
  const r = lanzar(GUION);
  assert.equal(r.error, undefined, `NO ARRANCÓ: ${r.error && r.error.message}`);
  assert.equal(r.signal, null, `NO ARRANCÓ: el hijo murió por ${r.signal}\n${r.salida}`);
  const m = RE_LINEA.exec(r.salida);
  assert.ok(m, `NO ARRANCÓ o no informó: falta la línea «CONTROLES · N tickets sembrados …»; salida:\n${r.salida.slice(0, 1500)}`);
  assert.ok(Number(m[1]) >= MINIMO_SEMBRADOS, `solo ${m[1]} tickets sembrados (mínimo ${MINIMO_SEMBRADOS}): alguien ha vaciado la semilla`);
  assert.equal(m[2], 'pasan', `los controles FALLAN:\n${r.salida}`);
  assert.equal(r.status, 0, `exit ${r.status} con los controles pasando:\n${r.salida}`);
});

test('SCRUM-1553c · 🔴 con un control roto el guion sale 2 y lo dice (este test sabe caer)', () => {
  const original = fs.readFileSync(GUION, 'utf8');
  const ancla = "export const PREFIJO_CONTRARIO = 'esperando-';";
  assert.ok(original.includes(ancla), `la mutación no encuentra su ancla «${ancla}»: el guion cambió y este control ya no rompe nada`);
  const roto = original.replace(ancla, "export const PREFIJO_CONTRARIO = 'nunca-casa-1553c-';");
  assert.notEqual(roto, original);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1553c-'));
  try {
    const ruta = path.join(dir, 'contradiccion.mjs');
    fs.writeFileSync(ruta, roto);
    const r = lanzar(ruta);
    const m = RE_LINEA.exec(r.salida);
    assert.ok(m, `la copia rota no imprimió su línea de controles:\n${r.salida.slice(0, 1500)}`);
    assert.equal(m[2], '🔴 FALLAN', `con el prefijo roto los controles debían FALLAR:\n${r.salida}`);
    assert.equal(r.status, 2, `con el prefijo roto debía salir 2 y salió ${r.status}`);
    assert.match(r.salida, /SCRUM-90001/, 'el fallo tiene que nombrar el positivo que dejó de cazar');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1553c · 🔴 un guion que no existe o revienta al cargar sale ROJO, no mudo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1553c-'));
  try {
    const roto = path.join(dir, 'revienta.mjs');
    fs.writeFileSync(roto, "throw new Error('revienta al cargar');\n");
    for (const ruta of [roto, path.join(dir, 'no-existe.mjs')]) {
      const r = lanzar(ruta);
      assert.notEqual(r.status, 0, `${path.basename(ruta)} salió 0`);
      assert.equal(RE_LINEA.exec(r.salida), null, `${path.basename(ruta)} no debía imprimir la línea de controles`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

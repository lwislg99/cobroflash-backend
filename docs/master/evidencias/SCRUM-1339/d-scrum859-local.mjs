#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/d-scrum859-local.mjs — SCRUM-1339d
//
// ¿CONTRIBUYE el contenido de `docs/master/SCRUM-1339.md` a que `scrum859` pierda sus cuatro
// últimos casos en la pasada mutada del meta-guard? J3h lo declaró sin medir (c.17961).
//
// Lo que esto mide es la parte DETERMINISTA: con el registro en cada una de sus versiones, corre
// `tests/scrum859-identidad-y-motivo-cerrado.test.mjs` N veces LIMPIO y N veces con la mutación
// que el propio scrum859 declara (la segunda: la clave vuelve a ser posicional), y mira si los
// cuatro nombres aparecen. Si el contenido del registro los hiciera desaparecer, desaparecerían
// siempre y también aquí.
//
// Lo que NO mide: si el contenido cambia la PROBABILIDAD de la pérdida intermitente en Linux
// (SCRUM-1339), que en esta máquina no se ha reproducido nunca. Eso es `d-meta-scrum859.mjs`.
//
// ⚠️ MUTA dos ficheros del árbol (`tests/scrum267-ancla-de-medicion.test.mjs` y el registro):
// se lanza con TODO commiteado, restaura en `finally` y comprueba los bytes.
//
//   node d-scrum859-local.mjs <raíz> <N> <etiqueta=ref> [<etiqueta=ref> ...]
//     ref: un commit de git (se lee `<ref>:docs/master/SCRUM-1339.md`) o `ARBOL` (el del disco)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';

const [raiz, nTexto, ...variantes] = process.argv.slice(2);
const N = Number(nTexto);
if (!raiz || !Number.isFinite(N) || !variantes.length) { console.error('uso: node d-scrum859-local.mjs <raíz> <N> <etiqueta=ref> ...'); process.exit(2); }
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const TEST = 'tests/scrum859-identidad-y-motivo-cerrado.test.mjs';
const GUARD = path.join(raiz, 'tests/scrum267-ancla-de-medicion.test.mjs');
const REGISTRO = path.join(raiz, 'docs/master/SCRUM-1339.md');
const DE = '    const id = identidadDeEntrada(e.tituloCompleto);';
const A = '    const id = String(vistos.size); // vuelta a la clave POSICIONAL, a proposito';
const CUATRO = [
  'SCRUM-859 · 🔴 insertar una entrada en medio NO mueve ninguna clave',
  'SCRUM-859 · 🔴 CONTROL del control: por POSICIÓN sí se habrían desplazado',
  'SCRUM-859 · 🔴 `INVISIBLE_HASTA_859` está cerrado en CINCO',
  'SCRUM-859 · 🔴 CONTROL: una SEXTA que alegue el motivo hace CAER el guard',
];

function pasada() {
  const tap = path.join(os.tmpdir(), `scrum1339d-859-${process.pid}.tap`);
  fs.rmSync(tap, { force: true });
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, TEST], { cwd: raiz, env, encoding: 'utf8' });
  if (!fs.existsSync(tap)) return 'CIEGO(sin TAP)';
  const L = fs.readFileSync(tap, 'utf8').split('\n');
  fs.rmSync(tap, { force: true });
  const num = (k) => { const l = L.find((x) => new RegExp(`^# ${k} \\d+`).test(x)); return l ? Number(l.match(/\d+/)[0]) : '?'; };
  const estan = CUATRO.filter((n) => L.some((l) => /^(not )?ok \d+ - /.test(l) && l.replace(/^(not )?ok \d+ - /, '') === n.replace(/#/g, '\\#'))).length;
  const elQueDebeCaer = L.some((l) => l === `not ok ${l.match(/\d+/)?.[0]} - ${CUATRO[0]}`);
  return `tests ${num('tests')} pass ${num('pass')} fail ${num('fail')} · los cuatro: ${estan}/4 · «insertar…» ${elQueDebeCaer ? 'CAE' : 'no cae'} · salida ${r.status}`;
}

const guardOriginal = fs.readFileSync(GUARD);
const registroOriginal = fs.readFileSync(REGISTRO);
if (guardOriginal.toString('utf8').split(DE).length - 1 !== 1) { console.log('CIEGO: el ancla de la mutación no aparece exactamente una vez en scrum267'); process.exit(3); }
console.log(`POBLACIÓN: ${variantes.length} versiones del registro × 2 (limpia, mutada) × ${N} pasadas = ${variantes.length * 2 * N} pasadas`);
try {
  for (const v of variantes) {
    const [etiqueta, ref] = v.split('=');
    const contenido = ref === 'ARBOL' ? registroOriginal : execFileSync('git', ['cat-file', 'blob', `${ref}:docs/master/SCRUM-1339.md`], { cwd: raiz, maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(REGISTRO, contenido);
    const secciones = contenido.toString('utf8').split('\n').filter((l) => /^# SCRUM-\d+/.test(l)).length;
    for (const mutada of [false, true]) {
      fs.writeFileSync(GUARD, mutada ? guardOriginal.toString('utf8').replace(DE, A) : guardOriginal);
      const cuenta = new Map();
      for (let i = 0; i < N; i++) { const s = pasada(); cuenta.set(s, (cuenta.get(s) ?? 0) + 1); }
      for (const [s, k] of cuenta) console.log(`  registro «${etiqueta}» (${contenido.length} bytes, ${secciones} secciones) · ${mutada ? 'MUTADA' : 'limpia'} · ${k} de ${N} pasadas: ${s}`);
    }
  }
} finally {
  fs.writeFileSync(GUARD, guardOriginal);
  fs.writeFileSync(REGISTRO, registroOriginal);
}
const ok = sha(fs.readFileSync(GUARD)) === sha(guardOriginal) && sha(fs.readFileSync(REGISTRO)) === sha(registroOriginal);
console.log(`restaurados los dos ficheros, byte a byte: ${ok ? 'sí' : '🔴 NO'}`);
console.log(`EXIT=${ok ? 0 : 3}`);
process.exit(ok ? 0 : 3);

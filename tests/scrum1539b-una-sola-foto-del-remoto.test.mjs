// tests/scrum1539b-una-sola-foto-del-remoto.test.mjs — SCRUM-1539b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ ESTE FICHERO NO TOCA EL REMOTO. Lo que contesta `git ls-remote` aquí se FABRICA.
//
// La avería: `tests/scrum804b-…` elegía su negativo (un ticket con rama viva) con UNA lectura del
// remoto y el censo de la regla 42 lo clasificaba con OTRA. Si entre las dos alguien mergeaba ese
// ticket, su rama se borraba, la segunda lectura no la veía, el censo decía «DENTRO» y el caso
// caía en el obligatorio de un PR que no tenía nada que ver (#2370, 13-oct-2026, job 115277830730).
//
// El arreglo: `leerRemoto()` es la única orden que sale de la máquina y devuelve una FOTO (las
// ramas y el sha de `origin/main` del mismo instante); el negativo y el censo se la reparten.
//
// Dos comprobaciones, y las dos se vieron en ROJO con el código de antes:
//   ① la carrera, fabricada: el `scrum804b` REAL, sin tocarlo, con una precarga que hace que la
//     rama elegida desaparezca a partir de la segunda lectura. Antes: 4 lecturas y el caso cae.
//   ② el censo no vuelve a preguntar si le pasan la foto, y juzga «mergeada» contra el sha de la
//     foto y no contra la ref `origin/main`, que cualquier `git fetch` de otro árbol mueve.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';
import { censarConMotivo, FUERA } from '../scripts/censo-regla-42.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SUJETO = path.join(RAIZ, 'tests', 'scrum804b-el-barrido-de-la-42.test.mjs');

/** Un ticket con entrada en `main`: sin el arreglo, la segunda lectura lo da por DENTRO. */
const TICKET = 1539;
const SHA_QUE_NO_ESTA = 'f'.repeat(40);

// La precarga: se pone delante de `execFileSync` en el proceso del sujeto. La 1ª lectura del remoto
// trae una rama viva de TICKET; de la 2ª en adelante ya no está, que es lo que deja un merge.
const PRECARGA = `
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { appendFileSync } from 'node:fs';
const cp = createRequire(import.meta.url)('node:child_process');
const conf = JSON.parse(process.env.FOTO_FABRICADA);
const deVerdad = cp.execFileSync;
let n = 0;
cp.execFileSync = function (orden, args, ...resto) {
  if (orden === 'git' && Array.isArray(args) && args[0] === 'ls-remote') {
    n += 1;
    appendFileSync(conf.testigo, 'ls-remote ' + n + '\\n');
    return conf.lecturas[Math.min(n, conf.lecturas.length) - 1];
  }
  return deVerdad.call(this, orden, args, ...resto);
};
syncBuiltinESMExports();
`;

function git(...args) {
  return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

test('SCRUM-1539b · ① 🔴 la carrera fabricada: el negativo y el censo salen de UNA lectura, y el caso aguanta', () => {
  const dir = temporal('scrum1539b-');
  const precarga = path.join(dir, 'foto-fabricada.mjs');
  const testigo = path.join(dir, 'testigo.txt');
  fs.writeFileSync(precarga, PRECARGA);
  const conf = {
    testigo,
    lecturas: [
      `${SHA_QUE_NO_ESTA}\trefs/heads/scrum-${TICKET}z-rama-fabricada\n`,
      `${'e'.repeat(40)}\trefs/heads/otra-rama-sin-numero\n`,
    ],
  };
  const entorno = { ...process.env, FOTO_FABRICADA: JSON.stringify(conf) };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

  const r = spawnSync(process.execPath, ['--import', pathToFileURL(precarga).href, '--test-reporter=tap', SUJETO],
    { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;

  // 🔴 EL TESTIGO NO ES OPCIONAL: sin él, un sujeto que corrió sin la precarga se lee como un verde.
  assert.ok(fs.existsSync(testigo),
    `🔴 CIEGO: la precarga no dejó testigo, así que el sujeto corrió SIN la carrera puesta y su verde no dice nada. Salida:\n${salida.slice(-1500)}`);
  const lecturas = fs.readFileSync(testigo, 'utf8').split('\n').filter(Boolean).length;
  assert.equal(lecturas, 1,
    `🔴 el sujeto ha preguntado al remoto ${lecturas} veces. Con más de una, el negativo y el censo pueden `
    + 'hablar de dos instantes distintos, y un merge entre los dos tumba el obligatorio de un PR ajeno (SCRUM-1539).');
  assert.match(salida, /^ok \d+ - SCRUM-804b · 🔴 SUELO y CONTROLES/m,
    `🔴 el caso del negativo cae con la carrera puesta. Salida:\n${salida.slice(-1500)}`);
  assert.equal(r.status, 0, `🔴 el sujeto sale con ${r.status}. Salida:\n${salida.slice(-1500)}`);
});

test('SCRUM-1539b · ② con la foto, el censo no vuelve a preguntar y juzga contra el sha de la foto, no contra la ref', (t) => {
  let tip;
  let viejo;
  try {
    tip = git('rev-parse', 'origin/main^{commit}');
    viejo = git('rev-parse', 'origin/main~1^{commit}');
  } catch (e) {
    t.skip(`sin \`origin/main\` y su padre en este clon no se puede montar la foto: ${String(e?.stderr || e?.message).trim().slice(0, 200)}`);
    return;
  }

  // Cuenta las lecturas del remoto en ESTE proceso mientras dura el caso.
  const cp = createRequire(import.meta.url)('node:child_process');
  const deVerdad = cp.execFileSync;
  let lecturas = 0;
  cp.execFileSync = function (orden, args, ...resto) {
    if (orden === 'git' && Array.isArray(args) && args[0] === 'ls-remote') {
      lecturas += 1;
      throw new Error('ls-remote prohibido en este caso: el censo tiene la foto');
    }
    return deVerdad.call(this, orden, args, ...resto);
  };
  syncBuiltinESMExports();
  t.after(() => { cp.execFileSync = deVerdad; syncBuiltinESMExports(); });

  // La rama apunta a la punta de hoy. Contra una foto tomada un commit antes, NO está mergeada.
  const salida = `${tip}\trefs/heads/scrum-${TICKET}z-rama-de-la-foto\n`;
  // `somero: false` a propósito: los dos commits están en el almacén, y lo que se mide aquí es contra
  // QUÉ sha se juzga, no la profundidad del clon (eso es SCRUM-1541, en su propio test).
  const antes = censarConMotivo([TICKET], { foto: { salida, main: viejo, somero: false, ciego: null } });
  const ahora = censarConMotivo([TICKET], { foto: { salida, main: tip, somero: false, ciego: null } });

  assert.equal(lecturas, 0, `🔴 el censo ha preguntado al remoto ${lecturas} veces teniendo la foto.`);
  assert.equal(antes.ciego, null, `🔴 el censo sale CIEGO con una foto completa: ${JSON.stringify(antes.ciego)}`);
  const fAntes = antes.censo.filas.find((f) => f.n === TICKET);
  const fAhora = ahora.censo.filas.find((f) => f.n === TICKET);
  assert.equal(fAntes.cubo, FUERA,
    `🔴 con la foto de un commit antes, la rama que apunta a la punta de hoy NO está mergeada, y el censo `
    + `la saca ${fAntes.cubo} (${fAntes.motivo}). Está juzgando contra la ref \`origin/main\`, no contra la foto.`);
  assert.match(fAntes.motivo, /rama viva SIN mergear/);
  // CONTROL: la misma rama, con la foto de la punta, sí está dentro de main y ya no es «viva».
  assert.doesNotMatch(fAhora.motivo, /rama viva SIN mergear/,
    `🔴 CONTROL: con la foto de la punta la rama está mergeada y el censo la sigue dando viva (${fAhora.motivo}). `
    + 'Si los dos casos salen igual, el de arriba no prueba nada.');
});

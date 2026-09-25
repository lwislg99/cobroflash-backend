// tests/scrum1089b-espejo-skills-agentes.test.mjs — SCRUM-1089
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ESPEJO SE VOLVIÓ A CONGELAR UNA VEZ SIN QUE NADIE LO NOTARA. ESTO ES PARA QUE NO PASE OTRA.
//
// SCRUM-1089 midió que `.agents/skills/yaqu-verifactu-sif` y `.agents/skills/yaqu-release-check`
// llevaban 86 días (29-jun → hoy) sin las 3 correcciones que `.claude/` sí recibió en SCRUM-538.
// Javier confirmó que el espejo lo lee Luis desde otra máquina (comentario 16600): no era un
// fichero muerto, era una skill fiscal desactualizada que otro jefe daba por buena.
//
// Este ticket sincronizó las dos parejas byte a byte. Este test es el guardián para que la
// PRÓXIMA corrección a `.claude/` no vuelva a quedarse sin espejar 86 días.
//
// ⛔ NO CORRIGE NADA: si cae, el arreglo es sincronizar la skill (gobierno de S0 + firma del
// fundador si es materia fiscal), nunca tocar este fichero para que pase.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs';
import { censar, verificar, poblacionEspejada, EXCLUIDAS } from '../scripts/_guard-espejo-skills.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_CLAUDE = path.join(RAIZ, '.claude', 'skills');
const DIR_AGENTS = path.join(RAIZ, '.agents', 'skills');

/** Copia los `SKILL.md` de una carpeta de skills a un temporal fuera del árbol (SCRUM-864). */
function copiarSkillsA(dirOrigen) {
  const destino = temporal('scrum1089b-');
  for (const nombre of fs.readdirSync(dirOrigen)) {
    const origen = path.join(dirOrigen, nombre, 'SKILL.md');
    if (!fs.existsSync(origen)) continue;
    fs.mkdirSync(path.join(destino, nombre));
    fs.copyFileSync(origen, path.join(destino, nombre, 'SKILL.md'));
  }
  return destino;
}

test('SCRUM-1089b · SUELO: la población ve los 4 pares espejados conocidos, y no a impeccable', () => {
  const poblacion = poblacionEspejada(DIR_CLAUDE, DIR_AGENTS);
  assert.ok(Array.isArray(poblacion), 'la población salió CIEGA (null): revisa que existan ambas carpetas.');
  for (const esperada of ['yaqu-premium-ui', 'yaqu-release-check', 'yaqu-sprint', 'yaqu-verifactu-sif']) {
    assert.ok(poblacion.includes(esperada), `🔴 falta «${esperada}» en la población espejada.`);
  }
  assert.ok(!poblacion.includes('impeccable'), '🔴 «impeccable» debería estar excluida (se gobierna por skills-lock.json).');
  assert.deepEqual([...EXCLUIDAS], ['impeccable']);
});

test('SCRUM-1089b · EN VERDE: el árbol real está sincronizado byte a byte tras este ticket', () => {
  const v = verificar(censar(DIR_CLAUDE, DIR_AGENTS));
  assert.ok(v.ok, v.mensaje);
});

test('SCRUM-1089b · 🔴 EL QUE DECIDE: una divergencia sembrada en una COPIA del espejo lo tumba', () => {
  const copiaAgents = copiarSkillsA(DIR_AGENTS);

  // Control negativo: la copia SIN sembrar tiene que dar el mismo verde que el original. Si no,
  // un rojo más abajo podría venir de copiar mal, no de la siembra.
  const limpio = verificar(censar(DIR_CLAUDE, copiaAgents));
  assert.ok(limpio.ok, `🔴 la copia SIN sembrar ya no coincide con el original:\n${limpio.mensaje}`);

  const antesDelOriginal = fs.readFileSync(path.join(DIR_AGENTS, 'yaqu-verifactu-sif', 'SKILL.md'));
  fs.appendFileSync(path.join(copiaAgents, 'yaqu-verifactu-sif', 'SKILL.md'), '\n<!-- divergencia sembrada por el test -->\n');

  const sembrado = verificar(censar(DIR_CLAUDE, copiaAgents));
  assert.equal(sembrado.ok, false, '🔴 un byte de más en la copia del espejo NO tumba el guard: no vigila nada.');
  assert.match(sembrado.mensaje, /yaqu-verifactu-sif/, '🔴 cae, pero no nombra la skill que diverge.');

  // El original real no se ha tocado: la siembra fue en la copia, nunca en el árbol de verdad.
  assert.deepEqual(fs.readFileSync(path.join(DIR_AGENTS, 'yaqu-verifactu-sif', 'SKILL.md')), antesDelOriginal);
});

test('SCRUM-1089b · 🔴 SUELO ciego: sin una de las dos carpetas, no hay falso verde', () => {
  const censoCarpetaFalsa = censar(DIR_CLAUDE, path.join(RAIZ, 'no-existe-esta-carpeta-1089b'));
  assert.ok(censoCarpetaFalsa.ciego, '🔴 sin `.agents/skills`, el censo tiene que declararse CIEGO.');
  assert.equal(verificar(censoCarpetaFalsa).ok, false, '🔴 un censo ciego no puede dar verde.');
});

test('SCRUM-1089b · 🔴 SUELO ciego: población vacía (todo excluido) tampoco es un verde silencioso', () => {
  // Fabricado sin tocar el árbol real: una carpeta con solo `impeccable` en común dentro de un
  // temporal, para no depender de que el árbol real algún día pierda sus otros tres pares.
  const soloExcluida = temporal('scrum1089b-vacio-');
  fs.mkdirSync(path.join(soloExcluida, 'impeccable'));
  fs.writeFileSync(path.join(soloExcluida, 'impeccable', 'SKILL.md'), 'x');
  const otraCopia = temporal('scrum1089b-vacio2-');
  fs.mkdirSync(path.join(otraCopia, 'impeccable'));
  fs.writeFileSync(path.join(otraCopia, 'impeccable', 'SKILL.md'), 'y');

  const censo = censar(soloExcluida, otraCopia);
  assert.ok(censo.ciego, '🔴 población vacía (solo la excluida) tiene que salir CIEGA, no verde.');
  assert.equal(verificar(censo).ok, false);
});

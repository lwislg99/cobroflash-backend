// tests/scrum976-guards-entrada-con-techo.test.mjs — SCRUM-976
//
// `guards:entrada` DEBE COMPROBAR LO QUE CAE EN CI, Y DEBE SEGUIR TARDANDO SEGUNDOS.
//
// ── EL DEFECTO, MEDIDO ──────────────────────────────────────────────────────────────────────
// El 20-sep-2026 el #1541 cayó en CI por `tests/scrum237-negacion-respaldada.test.mjs` (una negación
// sin respaldo en `scrum320-que-falta-para-cobrar:418`). Reproducido en un worktree en ESE commit,
// sin `dist` y sin base:
//
//     node --test tests/scrum237-negacion-respaldada.test.mjs   → tests 8 · pass 7 · fail 1
//     node scripts/guards-entrada.mjs                            → «4 guards de entrada en verde»  EXIT 0
//
// El mismo commit daba ROJO en CI y VERDE en el comando que dice «lo que puede poner un PR en rojo,
// se mira antes de empujar». La lista no lo incluía. Un censo cuya población crece sola —la suite
// entera— no puede quedarse fuera de quien se corre «para no enterarte por el PR».
//
// ── LA DECISIÓN, Y SU LÍMITE ────────────────────────────────────────────────────────────────
// Criterio tal cual (todo lo que pasa sin `dist` ni base): 313 ficheros, ~14 minutos. No cabe. Entran
// SEIS (237, 258, 514, 522, 548, 723) y el comando entero tiene un TECHO de 90 s. Un techo que solo
// vive en un comentario es una frase: aquí lo cumple el propio comando (plazo del `spawnSync`) y lo
// vigila este fichero lanzándolo de verdad.
//
// ── LAS DOS MITADES ─────────────────────────────────────────────────────────────────────────
//   ① «no baja en silencio»: los once están, por NOMBRE (se compara el conjunto, no una cuenta), y
//      el suelo no es menor que ellos. Quitar uno «porque molestaba» hace caer esto.
//   ② el techo: fijado, y solo BAJABLE desde el entorno.
//   ③ mitad NEGATIVA: con un plazo de 1 ms el comando sale 1 y dice por qué. Sin esto, el techo podría
//      no hacer nada nunca y este fichero seguiría verde (un control que no se vio fallar).
//   ④ mitad POSITIVA: el comando de verdad, sobre el árbol de verdad, sale 0, cabe en el techo y
//      ejecutó los guards que dice (no «0 tests, 0 fallos»).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { GUARDS, MINIMO, TECHO_MS, techoEfectivo } from '../scripts/guards-entrada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'guards-entrada.mjs');

// Los cinco de antes y los seis de SCRUM-976. Es la lista por la que se decidió, escrita a
// propósito: añadir un duodécimo NO toca esto; quitar uno sí.
const LOS_ONCE = [
  'tests/scrum273-registro-por-fichero.test.mjs',
  'tests/scrum267-ancla-de-medicion.test.mjs',
  'tests/scrum391-guards-declarados-presentes.test.mjs',
  'tests/scrum242-scripts-no-prometen-documentos.test.mjs',
  'tests/public-js-parsea.test.mjs',
  'tests/scrum237-negacion-respaldada.test.mjs',
  'tests/scrum258-nota-por-sesion.test.mjs',
  'tests/scrum514-aprobado-y-aplicado.test.mjs',
  'tests/scrum522-guards-fuera-de-la-tanda.test.mjs',
  'tests/scrum548-peaje-package-json.test.mjs',
  'tests/scrum723-guard-contra-su-base.test.mjs',
];

/**
 * El comando de verdad, en un proceso hijo. ⚠️ `NODE_TEST_CONTEXT` se hereda y cambia el reporter del
 * hijo a uno serializado que no escribe nada por stdout (medido en SCRUM-928): sin quitarlo, este
 * test leería una salida VACÍA. Y `FORCE_COLOR` fuera, que no es lo que se mide aquí.
 */
function lanzar(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  delete env.FORCE_COLOR;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: RAIZ, encoding: 'utf8', env });
  return { r, ms: Date.now() - t0 };
}

test('SCRUM-976 ① están los once, por nombre, y el suelo no baja de ellos', () => {
  const nombres = GUARDS.map((g) => g.fichero);
  assert.equal(new Set(nombres).size, nombres.length, '🔴 hay un guard repetido en la lista');
  const faltan = LOS_ONCE.filter((f) => !nombres.includes(f));
  assert.deepEqual(faltan, [],
    '🔴 `guards:entrada` ha perdido un guard que se decidió que llevara: ' + faltan.join(', '));
  assert.ok(MINIMO >= LOS_ONCE.length,
    `🔴 el suelo (${MINIMO}) bajó de los ${LOS_ONCE.length} decididos: quitar una línea ya no haría saltar nada.`);
  assert.ok(GUARDS.length >= MINIMO, '🔴 la lista es menor que su propio suelo');
  for (const g of GUARDS) {
    assert.ok(fs.existsSync(path.join(RAIZ, g.fichero)), `🔴 ${g.fichero} no existe`);
    assert.ok(g.porque && g.porque.length > 20, `🔴 ${g.fichero} no dice POR QUÉ está en la lista`);
  }
});

test('SCRUM-976 ② el techo está fijado en 90 s y desde el entorno solo se puede BAJAR', () => {
  assert.equal(TECHO_MS, 90000,
    '🔴 el techo cambió: si es a propósito, que este número lo diga en el mismo PR que lo explica.');
  assert.equal(techoEfectivo(undefined), TECHO_MS, 'sin petición vale el techo');
  assert.equal(techoEfectivo('5000'), 5000, 'un plazo menor se respeta (así se prueba la mitad negativa)');
  assert.equal(techoEfectivo('999999999'), TECHO_MS, '🔴 el entorno NO puede subir el techo');
  for (const malo of ['', 'abc', '0', '-5', 'NaN', 'Infinity']) {
    assert.equal(techoEfectivo(malo), TECHO_MS, `«${malo}» no es un plazo: vale el techo, no «sin plazo»`);
  }
});

test('SCRUM-976 ③ mitad NEGATIVA: con un plazo de 1 ms el comando sale 1 y dice que es el techo', () => {
  const { r } = lanzar({ GUARDS_ENTRADA_TECHO_MS: '1' });
  assert.equal(r.status, 1, `🔴 con el plazo agotado el comando debe salir 1 (salió ${r.status}) — el techo no muerde`);
  assert.match(r.stderr || '', /se pasaron del TECHO/,
    '🔴 salió 1, pero NO por el techo: un rojo por otra causa no prueba que el techo funcione.');
  assert.doesNotMatch(r.stdout || '', /guards de entrada en verde/, '🔴 dijo «verde» con el plazo agotado');
});

test('SCRUM-976 ④ mitad POSITIVA: el comando de verdad sale 0, cabe en el techo y ejecutó los guards',
  { timeout: 120000 }, () => {
    const { r, ms } = lanzar();
    assert.equal(r.status, 0,
      `🔴 \`guards:entrada\` salió ${r.status} sobre este árbol.\n${(r.stdout || '').slice(-1500)}\n${(r.stderr || '').slice(-1500)}`);
    assert.ok(ms < TECHO_MS, `🔴 tardó ${ms} ms y el techo es ${TECHO_MS}: hay que dejar sitio o subirlo A PROPÓSITO.`);
    assert.match(r.stdout || '', new RegExp(`✓ ${GUARDS.length} guards de entrada en verde \\(\\d+ tests`),
      '🔴 no dice haber corrido los guards de la lista: un verde sin población es una frase.');
    // El recuento de tests ejecutados: al menos tantos como ficheros (cada uno lleva ≥ 1).
    const n = Number(/en verde \((\d+) tests/.exec(r.stdout || '')?.[1]);
    assert.ok(n >= GUARDS.length, `🔴 se ejecutaron ${n} tests entre ${GUARDS.length} ficheros`);
  });

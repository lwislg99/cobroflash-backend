// SCRUM-182 — la tanda tiene que darse cuenta de que sus artefactos cambiaron bajo los pies
// (sin gate: corre en `npm test`, no toca BD ni red).
//
// EL FALLO QUE ESTO PERSIGUE no es un test rojo: es un rojo PLAUSIBLE. Una tanda de ~11 min
// (SCRUM-159, 27-jul-2026) devolvió "esperaba 404, recibí 501" sobre un arreglo que ya estaba
// en el árbol, y un stacktrace señalando una línea que en el fichero actual es otra cosa.
// Parecía una regresión de verdad y mandó a investigar código correcto; costó comparar
// fuente, ancestría del commit y mtime del `dist` para llegar a "el árbol no era el que crees".
//
// LA PREMISA DEL TICKET ERA OTRA Y SE CORRIGIÓ MIDIENDO: sospechaba de un `dist` compartido
// por junction entre worktrees. De los 24 worktrees vivos, NINGUNO tiene `dist` como junction.
// Lo compartido es `node_modules`, por dos vías (junction explícito en tres worktrees, y
// resolución hacia arriba de Node en los de `.claude/worktrees/`, que ni siquiera tienen la
// carpeta). Y lo más importante: el solapamiento NO necesita worktrees — `npm test` compila
// antes de correr, así que dos tandas en el mismo árbol ya se pisan. Por eso el guard no mira
// quién comparte qué, mira el EFECTO: ¿cambiaron los artefactos entre el principio y el final?
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  huellaDe,
  huellaArtefactos,
  compararHuellas,
  rutaClientePrisma,
} from '../scripts/_artefactos-guard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-182-'));

test('SCRUM-182 · un fichero reescrito cambia la huella', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.js'), 'uno');
  const antes = huellaDe(dir);

  // mtime explícito: escribir dos veces seguidas puede caer en el mismo tick del reloj de
  // ficheros y entonces la comprobación pasaría por casualidad, no por funcionar.
  fs.writeFileSync(path.join(dir, 'a.js'), 'dos');
  fs.utimesSync(path.join(dir, 'a.js'), new Date(), new Date(Date.now() + 10_000));

  assert.deepEqual(compararHuellas({ d: antes }, { d: huellaDe(dir) }).length, 1);
});

test('SCRUM-182 · un fichero nuevo o borrado cambia la huella', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.js'), 'uno');
  const antes = huellaDe(dir);
  fs.writeFileSync(path.join(dir, 'b.js'), 'dos');
  assert.ok(compararHuellas({ d: antes }, { d: huellaDe(dir) }).some((c) => c.includes('1 → 2 ficheros')));
});

test('SCRUM-182 · un árbol quieto NO produce falsos positivos', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.js'), 'uno');
  const antes = huellaDe(dir);
  assert.deepEqual(
    compararHuellas({ d: antes }, { d: huellaDe(dir) }),
    [],
    '🔴 Un falso positivo aquí invalida tandas buenas de 11 minutos y enseña a ignorar el aviso. ' +
      'Un guard que grita sin motivo se acaba puenteando igual que uno que no grita nunca.',
  );
});

test('SCRUM-182 · desaparecer también cuenta', () => {
  const dir = tmp();
  const antes = huellaDe(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.ok(compararHuellas({ d: antes }, { d: huellaDe(dir) })[0].includes('desaparecido'));
});

// ── El modo de fallo silencioso que casi se cuela ─────────────────────────────────────────
//
// Si la ruta del cliente de Prisma se construyera a mano (`raiz/node_modules/@prisma/client`),
// en los worktrees de `.claude/worktrees/` daría "no existe" en las DOS huellas —porque ahí
// esa carpeta no existe, Node resuelve la del padre— y el guard nunca vería un cambio. Verde
// permanente: la peor forma de fallar, porque se lee igual que "todo bien".

test('SCRUM-182 · el cliente de Prisma se RESUELVE, no se adivina', () => {
  const resuelto = rutaClientePrisma(RAIZ);
  assert.ok(resuelto, '🔴 no se resolvió @prisma/client: el guard estaría ciego a ese artefacto');
  assert.ok(fs.existsSync(resuelto), `🔴 la ruta resuelta no existe: ${resuelto}`);

  const huella = huellaArtefactos(RAIZ);
  assert.equal(huella.prisma.existe, true);
  assert.ok(
    huella.prisma.ficheros > 0,
    '🔴 huella del cliente de Prisma vacía: cero ficheros es indistinguible de "no cambió nunca"',
  );
});

// ── Ratchet: el runner tiene que seguir llamando al guard ─────────────────────────────────

test('SCRUM-182 · el runner gateado comprueba el árbol antes de dar por buenos sus números', () => {
  const runner = fs.readFileSync(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'), 'utf8');
  assert.ok(runner.includes('_artefactos-guard.mjs'), '🔴 el runner ya no importa el guard');
  assert.ok(runner.includes('huellaArtefactos'), '🔴 el runner ya no toma la huella');

  const iComparacion = runner.indexOf('compararHuellas(');
  const iAgregado = runner.indexOf('const suma = agg.pass');
  assert.ok(iComparacion !== -1, '🔴 el runner ya no compara las huellas');
  assert.ok(
    iComparacion < iAgregado,
    '🔴 la comprobación del árbol debe ir ANTES de presentar el agregado: si el árbol se movió, ' +
      'esos números invitan a interpretarse y no son evidencia de nada.',
  );
});

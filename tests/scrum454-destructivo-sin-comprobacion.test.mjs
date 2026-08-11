// tests/scrum454-destructivo-sin-comprobacion.test.mjs — SCRUM-454
//
// ── PARTE 1 · LA AUTORREFERENCIA, QUE ES PRERREQUISITO ──────────────────────────────────────
//
// El guard bloqueaba comandos que solo MENCIONAN el patrón. Tres casos medidos con el hook real
// el 11-ago-2026, antes de tocar nada:
//
//   · `node medir.mjs "git push --force origin main"`          → BLOQUEADO
//   · `node hook.mjs '{"tool_input":{"command":"…db push"}}'`   → BLOQUEADO
//   · `grep -n "rm -rf /" docs/RUNBOOKS.md`                     → BLOQUEADO
//
// El tercero es el que lo define: **la barrera impedía leer la documentación de la barrera**. Y
// por eso va ANTES de añadir patrones nuevos y no después: cada patrón que se añada multiplica
// los sitios donde verificar el guard queda bloqueado, y lo que se abandona entonces no es el
// patrón nuevo — es la verificación.
//
// ⚠️ LA MITAD QUE IMPORTA MÁS es la de abajo: arreglar el falso positivo cargándose el verdadero
// positivo no se nota nunca. Un guard que ya no bloquea nada se lee igual que uno que no tiene
// nada que bloquear (SCRUM-176 lo dejó escrito y sigue valiendo).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluar, tokenizar, acciones, coincide } from '../.claude/hooks/guard-dangerous.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(AQUI, '..', '.claude', 'hooks', 'guard-dangerous.mjs');

// Sentinel de usar y tirar: un test JAMÁS toca `.claude/allow-db-push`, que puede ser el permiso
// que otra sesión acaba de pedirle al fundador.
const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-454-sentinel-inexistente');

const llamada = (command, description = 'sin descripcion') =>
  JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, description } });

const bloquea = (command) => evaluar(llamada(command), SENTINEL_FALSO).bloqueado;

// Los literales se componen para que este fichero no se dispare a sí mismo si alguien lo pega
// en una línea de comando. No es cosmética: es el mismo defecto, un nivel más arriba.
const FORCE = `--${'force'}`;

test('SCRUM-454 · SUELO: el hook se lee, exporta el mecanismo y tiene contenido', () => {
  let fuente;
  try {
    fuente = fs.readFileSync(HOOK, 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer el hook (${e && e.code ? e.code : e}). «No bloquea nada» y «no supe mirar» son el mismo verde.`);
  }
  assert.ok(fuente.length > 4000, `🔴 el hook tiene ${fuente.length} caracteres: no es el fichero que se cree`);
  assert.equal(typeof tokenizar, 'function', '🔴 el tokenizador ya no se exporta: sin él no hay máscara, y sin máscara vuelve el falso positivo');
  assert.equal(typeof acciones, 'function');
  assert.equal(typeof coincide, 'function');
});

// ── 1.a · MENCIONAR NO ES EJECUTAR (los tres casos medidos) ──────────────────────────────────

const MENCIONES_QUE_DEBEN_PASAR = [
  ['medir el propio guard pasándole el comando como argumento', `node medir.mjs "git push ${FORCE} origin main"`],
  ['probar el propio guard con el JSON del tool call', `node hook.mjs '{"tool_input":{"command":"npx prisma db push"}}'`],
  ['BUSCAR LA REGLA EN EL RUNBOOK', 'grep -n "rm -rf /" docs/RUNBOOKS.md'],
  ['imprimir la regla', `printf '%s' "nunca uses git push ${FORCE}"`],
  ['un test que lleva el literal como dato', `node --test tests/x.mjs # ${FORCE}`],
];

for (const [nombre, comando] of MENCIONES_QUE_DEBEN_PASAR) {
  test(`SCRUM-454 · PASA (menciona, no ejecuta): ${nombre}`, () => {
    assert.equal(bloquea(comando), false,
      '🔴 FALSO POSITIVO: el guard bloquea un comando que solo LLEVA el literal dentro de un '
      + 'argumento. Es el defecto que impedía leer la documentación de la propia barrera — y el '
      + 'que hace que, a la tercera vez, alguien deje de verificarla.');
  });
}

// ── 1.b · Y LA MITAD QUE IMPORTA MÁS: lo que se invoca de verdad sigue cayendo ───────────────

const INVOCACIONES_QUE_DEBEN_BLOQUEAR = [
  ['la invocación pelada', 'npx prisma db push --accept-data-loss'],
  ['migrate dev', 'npx prisma migrate dev --name x'],
  ['push forzado', `git push ${FORCE} origin main`],
  ['borrado recursivo con unidad de Windows', 'rm -rf D:/MILLONARIO/cobroFlash'],
  // El flag entrecomillado SE EJECUTA IGUAL: la máscara no puede convertirse en una vía de escape.
  ['el flag entre comillas, que el shell pasa igual', `git push "${FORCE}" origin main`],
  // Los dos que SCRUM-176 puso en verde, y que ahora siguen en verde POR CONSTRUCCIÓN:
  ['envoltorio: bash -c con el comando entre comillas', 'bash -c "npx prisma db push"'],
  ['sustitución de comando dentro del mensaje', 'git commit -m "$(npx prisma db push)"'],
  ['envoltorio de Windows', 'cmd /c "npx prisma migrate dev"'],
  ['la ruta con espacios va entrecomillada, el borrado no', 'rm -rf "D:/carpeta con espacios"'],
];

for (const [nombre, comando] of INVOCACIONES_QUE_DEBEN_BLOQUEAR) {
  test(`SCRUM-454 · BLOQUEA (se invoca de verdad): ${nombre}`, () => {
    assert.equal(bloquea(comando), true,
      `🔴 VERDADERO POSITIVO PERDIDO: "${nombre}" pasa el guard. Arreglar la autorreferencia a `
      + 'costa de esto es peor que el problema, y no se nota nunca: un guard que ya no bloquea '
      + 'nada se lee igual que uno sin nada que bloquear.');
  });
}

// ── 1.c · El mecanismo en aislado ────────────────────────────────────────────────────────────

test('SCRUM-454 · la máscara distingue el argumento de la invocación', () => {
  const [dentro] = acciones(`printf '%s' "git push ${FORCE}"`);
  assert.equal(coincide(/--force/, dentro), false,
    '🔴 el flag va dentro de un argumento entrecomillado de `printf`: no se ejecuta');
  const [fuera] = acciones(`git push ${FORCE}`);
  assert.equal(coincide(/--force/, fuera), true, '🔴 aquí sí se ejecuta');
});

test('SCRUM-454 · el envoltorio se analiza aparte, no se descuenta', () => {
  const lista = acciones('bash -c "npx prisma db push"');
  assert.ok(lista.length >= 2,
    '🔴 el argumento de `bash -c` tiene que volver a analizarse como línea de comando. Si se '
    + 'descuenta por ir entre comillas, el shell anidado se convierte en la vía de escape.');
  assert.ok(lista.some((a) => coincide(/db +push/, a)));
});

test('SCRUM-454 · el tokenizador no confunde el descriptor con una palabra', () => {
  // `2>&1` no es una redirección que trunque nada, y `2` no es un argumento.
  const t = tokenizar('node x.mjs 2>&1');
  assert.deepEqual(t.filter((x) => !x.operador).map((x) => x.texto), ['node', 'x.mjs']);
});

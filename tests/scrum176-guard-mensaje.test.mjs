// SCRUM-176 — el guard `guard-dangerous` debe mirar LA ACCIÓN, no el TEXTO (sin gate: corre
// en `npm test` normal, no toca BD ni red).
//
// QUÉ SE PRUEBA, y por qué las dos mitades son igual de obligatorias:
//
//   · FALSOS POSITIVOS (deben PASAR): un commit cuyo mensaje —o cuyo campo `description`—
//     menciona `db push`, `--force` o `rm -rf` en prosa. Eran bloqueos reales, reproducidos
//     el 27-jul-2026: el mensaje llevaba el literal, no se ejecutaba ningún Prisma, y
//     reescribiendo el mensaje el mismo commit pasaba.
//
//   · VERDADEROS POSITIVOS (deben seguir BLOQUEADOS): la invocación de verdad. Esta mitad es
//     la que de verdad importa. Arreglar el falso positivo cargándose el verdadero positivo
//     sería peor que el problema, y no se nota nunca: un guard que ya no bloquea nada se ve
//     idéntico a uno que no tiene nada que bloquear. Por eso están aquí los casos que un
//     "descontar lo que va entre comillas" ingenuo dejaría escapar — `bash -c "…"` y la
//     sustitución de comando dentro de `-m`.
//
// EL SENTINEL NO SE TOCA: `evaluar()` recibe una ruta de sentinel de usar y tirar en un tmp.
// Si el test usara el de verdad (.claude/allow-db-push) podría CONSUMIR el permiso que otra
// sesión acaba de pedirle al fundador, o fabricar uno. Un test no puede tener ese poder.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evaluar, descontarTexto } from '../.claude/hooks/guard-dangerous.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HOOK_MJS = path.join(AQUI, '..', '.claude', 'hooks', 'guard-dangerous.mjs');

// Ruta de sentinel que NO existe y que nadie más usa: basta para que la regla 2 bloquee.
const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-scrum176-sentinel-inexistente');

const llamada = (command, description = 'sin descripcion') =>
  JSON.stringify({
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description },
  });

// ── 1. Falsos positivos: prosa que menciona la acción peligrosa ───────────────────────────

const PROSA_QUE_DEBE_PASAR = [
  [
    'mensaje de commit con el literal entre comillas dobles',
    llamada('git commit -m "docs(asesor): nunca se ejecuta prisma db push a mano"'),
  ],
  [
    'mensaje de commit con comillas simples',
    llamada("git commit -m 'docs: prohibido prisma migrate dev, usa migrate diff'"),
  ],
  [
    'mensaje de commit que menciona --force',
    llamada('git commit -m "revert del git push --force de ayer"'),
  ],
  [
    'mensaje de commit que menciona rm -rf con ruta absoluta',
    llamada('git commit -m "runbook: jamas hagas rm -rf /home ni rm -rf D:/repo"'),
  ],
  [
    'el campo description lleva la prosa y el comando es inofensivo',
    llamada('git log --oneline -5', 'Revisar el commit que usaba git push --force'),
  ],
  [
    'here-string de PowerShell como cuerpo del mensaje (flujo multilinea del CLAUDE.md)',
    llamada("git commit -m @'\ndocs: la regla 3 prohibe prisma migrate dev\ny el db push va con preview\n'@"),
  ],
  [
    'heredoc de bash con delimitador entrecomillado',
    llamada("git commit -F - <<'EOF'\ndocs: nunca npx prisma db push contra prod\nEOF"),
  ],
  ['--message= en su forma larga', llamada('git commit --message="chore: documenta el db push"')],
];

for (const [nombre, entrada] of PROSA_QUE_DEBE_PASAR) {
  test(`SCRUM-176 · PASA (prosa, no accion): ${nombre}`, () => {
    const { bloqueado, motivo } = evaluar(entrada, SENTINEL_FALSO);
    assert.equal(
      bloqueado,
      false,
      `🔴 FALSO POSITIVO: el guard bloqueó un comando inofensivo por el TEXTO que lleva ` +
        `dentro (${motivo}). Es el bug de SCRUM-176: documentar mejor la regla no puede ` +
        `costar más bloqueos. Y cada falso positivo empuja a --no-verify, que apaga el guard entero.`,
    );
  });
}

// ── 2. Verdaderos positivos: la acción de verdad, incluidas las formas "entre comillas" ───

const ACCION_QUE_DEBE_BLOQUEAR = [
  ['db push directo', llamada('npx prisma db push --accept-data-loss'), 'db push'],
  ['migrate dev directo', llamada('npx prisma migrate dev --name x'), 'migrate dev'],
  ['git push --force', llamada('git push --force origin main'), '--force'],
  ['--force-with-lease', llamada('git push --force-with-lease origin main'), '--force'],
  ['rm -rf con unidad de Windows', llamada('rm -rf D:/MILLONARIO/cobroFlash'), 'rm -rf'],
  ['rm -rf con ruta absoluta unix', llamada('rm -rf /home/luis'), 'rm -rf'],
  // Los dos siguientes son el motivo por el que NO se descuenta "todo lo entrecomillado":
  ['shell anidado: el comando va entre comillas pero -c no es flag de mensaje', llamada('bash -c "npx prisma db push"'), 'db push'],
  ['sustitucion de comando DENTRO del argumento de -m', llamada('git commit -m "$(npx prisma db push)"'), 'db push'],
  ['npm --force', llamada('npm install --force'), '--force'],
];

for (const [nombre, entrada, esperado] of ACCION_QUE_DEBE_BLOQUEAR) {
  test(`SCRUM-176 · BLOQUEA (accion real): ${nombre}`, () => {
    const { bloqueado, motivo } = evaluar(entrada, SENTINEL_FALSO);
    assert.equal(
      bloqueado,
      true,
      `🔴 VERDADERO POSITIVO PERDIDO: "${nombre}" pasó el guard. Arreglar el falso positivo ` +
        `de SCRUM-176 a costa de esto es peor que el problema original, y no se nota nunca: ` +
        `un guard que ya no bloquea nada se lee igual que uno sin nada que bloquear.`,
    );
    assert.ok(motivo.includes(esperado), `el motivo deberia citar "${esperado}", dijo: ${motivo}`);
  });
}

// ── 3. Fail-closed: si el JSON no se puede leer, se vuelve a mirar el blob crudo ──────────

test('SCRUM-176 · JSON ilegible: fail-closed, se mira el blob entero como antes', () => {
  const roto = '{"tool_input":{"command": "npx prisma db push"';
  assert.equal(
    evaluar(roto, SENTINEL_FALSO).bloqueado,
    true,
    '🔴 Con el JSON ilegible el guard debe volver al comportamiento antiguo (mirar todo el ' +
      'blob), no dejar pasar. Ruidoso es aceptable; ciego no.',
  );
});

test('SCRUM-176 · tool_input sin command: fail-closed', () => {
  const sinComando = JSON.stringify({ tool_name: 'Bash', tool_input: { description: 'npx prisma db push' } });
  assert.equal(evaluar(sinComando, SENTINEL_FALSO).bloqueado, true);
});

// ── 4. El sentinel de un solo uso sigue funcionando ───────────────────────────────────────

test('SCRUM-176 · el sentinel autoriza UN db push y se consume', () => {
  const sentinel = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-176-')), 'allow-db-push');
  fs.writeFileSync(sentinel, '');

  const entrada = llamada('npx prisma db push --accept-data-loss');
  assert.equal(evaluar(entrada, sentinel).bloqueado, false, 'con sentinel debe pasar');
  assert.equal(fs.existsSync(sentinel), false, 'el sentinel debe consumirse');
  assert.equal(evaluar(entrada, sentinel).bloqueado, true, 'el segundo intento debe bloquear');
});

// ── 5. El hook de verdad, extremo a extremo (código de salida 2 = bloquear) ───────────────
//
// Los tests de arriba llaman a la función; este ejecuta EL FICHERO que el hook invoca, para
// que un fallo de cableado (export mal puesto, CLI que no lee stdin, exit code equivocado) no
// pase inadvertido. Se lanza con `node` y no con `bash` a propósito: `bash` NO está en el PATH
// de la máquina Windows del fundador, y este test tiene que correr en las dos.

function correrHook(entrada) {
  const r = spawnSync(process.execPath, [HOOK_MJS], { input: entrada, encoding: 'utf8' });
  return { code: r.status, err: r.stderr };
}

test('SCRUM-176 · e2e: la accion real sale con codigo 2 y explica por que', () => {
  const { code, err } = correrHook(llamada('npx prisma migrate dev --name x'));
  assert.equal(code, 2, `deberia bloquear con exit 2, salio ${code}`);
  assert.match(err, /guard-dangerous BLOQUEADO/);
});

test('SCRUM-176 · e2e: el commit con prosa sale con codigo 0', () => {
  const { code, err } = correrHook(llamada('git commit -m "docs: nunca prisma migrate dev"'));
  assert.equal(code, 0, `deberia pasar con exit 0, salio ${code} (${err})`);
});

// ── 6. El espejo de Codex no puede tener su propia copia de las reglas ────────────────────
//
// AA2 mantiene el tooling duplicado en `.claude/` (Claude Code) y `.codex/` (Codex), con la
// instrucción "al tocar uno, revisar el espejo" — es decir, la divergencia estaba confiada a
// que alguien se acordase. Ya había divergido: la copia de Codex buscaba el sentinel en
// `.codex/allow-db-push` mientras su propio mensaje mandaba crear `.claude/allow-db-push`.
// Este test es el mecanismo que sustituye al acordarse.

test('SCRUM-176 · el hook de Codex delega, no reimplementa las reglas', () => {
  const espejo = fs.readFileSync(path.join(AQUI, '..', '.codex', 'hooks', 'guard-dangerous.sh'), 'utf8');
  assert.ok(
    espejo.includes('guard-dangerous.mjs'),
    '🔴 el hook de .codex/ debe delegar en .claude/hooks/guard-dangerous.mjs',
  );
  assert.ok(
    !/grep -qE/.test(espejo),
    '🔴 el hook de .codex/ ha vuelto a llevar sus propias reglas: eso es exactamente la ' +
      'divergencia que SCRUM-176 cerró. Una sola implementación, dos envoltorios finos.',
  );
});

// ── 7. El saneado, en aislado ─────────────────────────────────────────────────────────────

test('SCRUM-176 · descontarTexto quita el mensaje pero deja la invocacion', () => {
  assert.ok(!descontarTexto('git commit -m "npx prisma db push"').includes('db push'));
  assert.ok(descontarTexto('bash -c "npx prisma db push"').includes('db push'));
  // Sustitución dentro del mensaje: NO es texto inerte, no se descuenta.
  assert.ok(descontarTexto('git commit -m "$(npx prisma db push)"').includes('db push'));
});

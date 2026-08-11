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
import { spawnSync } from 'node:child_process';
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

// ── PARTE 2 · LA FAMILIA QUE LA BARRERA NO MIRABA ────────────────────────────────────────────
//
// Medido con el hook real el 11-ago-2026, ANTES de tocar nada: `git checkout --`, `git restore`,
// `git clean`, `git reset --hard` y `>` sobre una ruta existente pasaban LOS CINCO. Los cuatro
// trabajos perdidos ese día se perdieron por mecanismos que la barrera no miraba.
//
// ⚠️ EL ORDEN DE ESTE BLOQUE NO ES DECORATIVO. Primero los CONTROLES NEGATIVOS, porque son los
// que deciden si esto se puede mergear: el hook es infraestructura de las cuatro sesiones, y una
// barrera que bloquea lo legítimo no la arregla nadie — la desactiva entera alguien con prisa.
//
// ⚠️ Y SE MIDE CONTRA REPOS DE VERDAD, no contra dobles: «el árbol está limpio» es justo el hecho
// que el guard tiene que comprobar. Un doble que dijera «limpio» probaría que el doble dice
// «limpio».

/** Un repo desechable. `sucio` decide si hay trabajo que perder — que es TODA la diferencia. */
function repo(sucio) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-454-')));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'x@x');
  git('config', 'user.name', 'x');
  fs.writeFileSync(path.join(dir, 'limpio.txt'), 'original\n');
  fs.writeFileSync(path.join(dir, 'sucio.txt'), 'original\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'ignorado/\nenlazado/\nreal/\ncompartido/\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  fs.mkdirSync(path.join(dir, 'ignorado'));
  fs.writeFileSync(path.join(dir, 'ignorado/salida.txt'), 'basura\n');
  if (sucio) {
    fs.writeFileSync(path.join(dir, 'sucio.txt'), 'CAMBIO SIN COMMITEAR\n');
    fs.writeFileSync(path.join(dir, 'borrador.txt'), 'no rastreado\n');
  }
  // Dos árboles: uno con el `node_modules` ENLAZADO (junction) y otro con carpeta real.
  fs.mkdirSync(path.join(dir, 'compartido'));
  fs.mkdirSync(path.join(dir, 'enlazado'));
  fs.mkdirSync(path.join(dir, 'real/node_modules'), { recursive: true });
  let hayEnlace = true;
  try {
    fs.symlinkSync(path.join(dir, 'compartido'), path.join(dir, 'enlazado/node_modules'), 'junction');
  } catch {
    hayEnlace = false; // sin privilegios: el caso se declara ciego, no se da por bueno
  }
  return { dir, hayEnlace };
}

const SUCIO = repo(true);
const LIMPIO = repo(false);
test.after(() => {
  for (const r of [SUCIO, LIMPIO]) fs.rmSync(r.dir, { recursive: true, force: true });
});

const veredicto = (comando, cwd) =>
  evaluar(llamada(comando), SENTINEL_FALSO, { cwd, sentinelDestructivo: path.join(os.tmpdir(), 'yaqu-454-no-existe') });

// ── 2.a · CONTROLES NEGATIVOS · lo legítimo NO puede caer ────────────────────────────────────

const NO_PUEDEN_CAER = [
  ['redirección sobre un fichero NUEVO', 'node -e "1" > nuevo.txt', 'SUCIO'],
  ['git checkout -- con el árbol LIMPIO en esa ruta', 'git checkout -- limpio.txt', 'SUCIO'],
  ['redirección sobre un fichero que git IGNORA', 'node -e "1" > ignorado/salida.txt', 'SUCIO'],
  ['añadir (>>) a un fichero existente', 'node -e "1" >> sucio.txt', 'SUCIO'],
  ['redirección a /dev/null', 'node -e "1" > /dev/null', 'SUCIO'],
  ['git restore --staged, que no toca el árbol', 'git restore --staged sucio.txt', 'SUCIO'],
  ['cambiar de rama', 'git checkout -q otra-rama', 'SUCIO'],
  ['git status', 'git status --porcelain', 'SUCIO'],
  ['git clean sin nada no rastreado que llevarse', 'git clean -fd', 'LIMPIO'],
  ['git reset --hard con el árbol limpio', 'git reset --hard HEAD', 'LIMPIO'],
  ['borrar un árbol cuyo node_modules es carpeta REAL', 'git worktree remove real', 'LIMPIO'],
];

for (const [nombre, comando, donde] of NO_PUEDEN_CAER) {
  test(`SCRUM-454 · 🔴 CONTROL NEGATIVO: ${nombre}`, () => {
    const r = donde === 'SUCIO' ? SUCIO : LIMPIO;
    const { bloqueado, motivo } = veredicto(comando, r.dir);
    assert.equal(bloqueado, false,
      `🔴 EL GUARD BLOQUEA ALGO LEGÍTIMO: ${motivo}\n\n`
      + '  Esto no es un falso positivo más: el hook corre en las cuatro sesiones a la vez. Una\n'
      + '  barrera que estorba no se corrige, se desactiva entera — y entonces protege menos que\n'
      + '  ninguna. Si el caso de verdad hay que bloquearlo, se decide, se escribe y se mide;\n'
      + '  pero no puede colarse como efecto colateral de cubrir otro.');
  });
}

// ── 2.b · LOS CINCO DE LA TABLA · con algo que perder, se bloquea ────────────────────────────

const DEBEN_BLOQUEAR = [
  ['git checkout -- sobre una ruta con cambios', 'git checkout -- sucio.txt', /DESCARTA cambios/],
  ['git restore sobre una ruta con cambios', 'git restore sucio.txt', /DESCARTA cambios/],
  ['git reset --hard con el árbol sucio', 'git reset --hard HEAD', /DESCARTA cambios/],
  ['git clean con no rastreados', 'git clean -fd', /BORRA ficheros no rastreados/],
  ['redirección que trunca un fichero existente', 'node -e "1" > sucio.txt', /TRUNCA un fichero/],
  ['y el caso exacto del 11-ago: > sobre un .md que ya existe', 'node x.mjs > limpio.txt', /TRUNCA un fichero/],
];

for (const [nombre, comando, esperado] of DEBEN_BLOQUEAR) {
  test(`SCRUM-454 · BLOQUEA (hay algo que perder): ${nombre}`, () => {
    const { bloqueado, motivo } = veredicto(comando, SUCIO.dir);
    assert.equal(bloqueado, true,
      `🔴 "${nombre}" pasa sin comprobación previa. Es la familia entera de SCRUM-454: cuatro `
      + 'trabajos perdidos en un día por comandos que nadie miró ANTES de ejecutar.');
    assert.match(motivo, esperado, `el motivo no dice qué se perdía: ${motivo}`);
    assert.ok(/sucio\.txt|borrador\.txt|limpio\.txt/.test(motivo),
      `🔴 el mensaje no NOMBRA lo que se perdería (${motivo}). Un bloqueo que no enseña el daño `
      + 'obliga a repetir el comando para enterarse, que es exactamente el orden que falló.');
  });
}

test('SCRUM-454 · el junction se comprueba ANTES de seguirlo (SCRUM-429)', (t) => {
  if (!SUCIO.hayEnlace) {
    t.skip('sin privilegios para crear el enlace: el caso se declara ciego, no se da por bueno');
    return;
  }
  for (const comando of ['git worktree remove enlazado', 'rm -rf enlazado', 'cmd /c rmdir /s /q enlazado']) {
    const { bloqueado, motivo } = veredicto(comando, SUCIO.dir);
    assert.equal(bloqueado, true,
      `🔴 "${comando}" sigue el enlace y se lleva el destino COMPARTIDO. Así se vació el `
      + 'node_modules común dos veces (SCRUM-429), y la comprobación previa —¿esto es un enlace `'
      + 'o una carpeta?— cuesta una llamada a lstat.');
    assert.match(motivo, /ENLACE|junction/i);
  }
});

// ── 2.c · La autorización, con el mismo diseño que ya existe para `db push` ───────────────────

test('SCRUM-454 · el sentinel autoriza UNA vez y se consume', () => {
  const sentinel = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-454s-')), 'allow-destructivo');
  const opciones = { cwd: SUCIO.dir, sentinelDestructivo: sentinel };
  const entrada = llamada('git checkout -- sucio.txt');

  assert.equal(evaluar(entrada, SENTINEL_FALSO, opciones).bloqueado, true, 'sin sentinel, bloquea');
  fs.writeFileSync(sentinel, '');
  assert.equal(evaluar(entrada, SENTINEL_FALSO, opciones).bloqueado, false, 'con sentinel, pasa');
  assert.equal(fs.existsSync(sentinel), false, '🔴 el permiso no se consumió: dejaría la puerta abierta');
  assert.equal(evaluar(entrada, SENTINEL_FALSO, opciones).bloqueado, true, 'y el segundo intento vuelve a bloquear');
});

test('SCRUM-454 · el permiso NO se quema si otra regla bloquea antes', () => {
  // Misma lección que SCRUM-176: una autorización de un solo uso se gasta cuando algo se va a
  // ejecutar, no cuando se mira.
  const sentinel = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-454t-')), 'allow-destructivo');
  fs.writeFileSync(sentinel, '');
  const { bloqueado } = evaluar(llamada(`git checkout ${FORCE} -- sucio.txt`), SENTINEL_FALSO,
    { cwd: SUCIO.dir, sentinelDestructivo: sentinel });
  assert.equal(bloqueado, true);
  assert.equal(fs.existsSync(sentinel), true,
    '🔴 el comando salió bloqueado por otra regla y aun así se gastó el permiso de un solo uso.');
});

// ── 2.d · No se puede reordenar la comprobación para que llegue tarde ────────────────────────

test('SCRUM-454 · 🔴 crear el permiso EN EL MISMO comando no vale', () => {
  // «La comprobación estaba en el propio comando y me llegó DESPUÉS de haber escrito — el orden
  // era el error». Ese es el diagnóstico de la sesión que perdió el cuarto trabajo, y es lo que
  // este test sostiene: el hook decide ANTES de que nada se ejecute, así que un `touch` en la
  // misma línea todavía no ha creado nada cuando se juzga.
  const sentinel = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-454u-')), 'allow-destructivo');
  const { bloqueado } = evaluar(
    llamada(`touch ${sentinel.replace(/\\/g, '/')} && git checkout -- sucio.txt`),
    SENTINEL_FALSO,
    { cwd: SUCIO.dir, sentinelDestructivo: sentinel },
  );
  assert.equal(bloqueado, true,
    '🔴 el permiso creado en la misma línea autorizó el descarte. Eso devuelve la comprobación a '
    + 'DESPUÉS, que es el orden que falló las cuatro veces.');
});

test('SCRUM-454 · el guard mira el árbol donde se va a ejecutar, no donde corre él', () => {
  // Con cuatro worktrees, `cd X && …` es la forma normal de trabajar. Mirar el árbol equivocado
  // sería peor que no mirar: diría «limpio» de otro sitio.
  const desdeFuera = llamada(`cd ${SUCIO.dir.replace(/\\/g, '/')} && git checkout -- sucio.txt`);
  const { bloqueado } = evaluar(desdeFuera, SENTINEL_FALSO,
    { base: LIMPIO.dir, sentinelDestructivo: path.join(os.tmpdir(), 'yaqu-454-no-existe') });
  assert.equal(bloqueado, true,
    '🔴 el guard juzgó desde su propio directorio y no desde aquel al que el comando hace `cd`.');
});

test('SCRUM-454 · si no se puede comprobar el estado, se trata como el peor caso', () => {
  const fuera = path.join(os.tmpdir(), 'yaqu-454-no-es-un-repo');
  fs.mkdirSync(fuera, { recursive: true });
  const { bloqueado, motivo } = veredicto('git checkout -- algo.txt', fuera);
  assert.equal(bloqueado, true,
    '🔴 «no hay nada que perder» y «no supe mirar» son la misma respuesta con significados '
    + 'opuestos. Si el guard no puede preguntar, no puede absolver.');
  assert.match(motivo, /NO se pudo comprobar/);
});

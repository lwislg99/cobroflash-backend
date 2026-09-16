// tests/scrum677b-el-vigia-esta-cableado.test.mjs — SCRUM-677
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// MENCIONAR NO ES HACER · que el vigía EXISTA no prueba que alguien lo llame
//
// `scrum677-vigilante-de-despliegue` comprueba que el veredicto es correcto. Este fichero
// comprueba la otra mitad, que es la que falló de verdad: **que alguien lo ejecute**. Durante
// nueve días el problema no fue que el instrumento se equivocara — fue que no había ninguno, y
// nadie miró.
//
// Y vigila TRES invariantes del cableado, cada uno con su motivo. Los tres se pueden romper
// editando un YAML sin darse cuenta, y los tres dejarían al vigía mudo o dañino.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const CI = leer('.github/workflows/ci.yml');
const CRON = leer('.github/workflows/vigia-despliegue.yml');

test('SCRUM-677b · 🔴 SUELO: los dos workflows se leen de verdad', () => {
  assert.ok(CI.length > 2000, `🔴 CIEGO: ci.yml tiene ${CI.length} bytes.`);
  assert.ok(CRON.length > 500, `🔴 CIEGO: el workflow del vigía tiene ${CRON.length} bytes.`);
  assert.match(CI, /guards-visuales:/, '🔴 el trozo leído no es el CI que creemos.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 1 · ALGUIEN LO LLAMA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677b · 🔴 el vigía se EJECUTA en el PR y en el programado', () => {
  assert.match(CI, /node scripts\/vigilante-de-despliegue\.mjs/,
    '🔴 el CI no llama al vigía. Existir no sirve de nada: lo que faltó fue que alguien mirara.');
  assert.match(CRON, /node scripts\/vigilante-de-despliegue\.mjs/,
    '🔴 el workflow programado no llama al vigía.');
  // Y que el fichero que llaman exista, que es la otra mitad de «mencionar no es hacer».
  assert.ok(fs.existsSync(path.join(RAIZ, 'scripts/vigilante-de-despliegue.mjs')),
    '🔴 los dos workflows llaman a un fichero que no está en el disco.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 2 · 🔴 EN EL PR NO PUEDE BLOQUEAR
//
// Si el vigía está en rojo, EL ARREGLO LLEGA MERGEANDO. Un check bloqueante le cierra la puerta
// justo a quien viene a arreglarlo: la rama que aplica el `ALTER` que falta no podría entrar
// porque producción sigue atrasada por no tener ese `ALTER`. Es un candado que se cierra por
// dentro.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677b · 🔴 el job del PR es INFORMATIVO: `continue-on-error: true`', () => {
  const i = CI.indexOf('vigia-despliegue:');
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro el job del vigía en el CI.');
  const job = CI.slice(i, CI.indexOf('\n  ', i + 200) === -1 ? CI.length : CI.length);
  assert.match(job, /continue-on-error:\s*true/,
    '🔴 el vigía BLOQUEA el PR. Si está en rojo, el arreglo llega mergeando: un check bloqueante '
    + 'cierra la puerta justo al que viene a arreglarlo.');
});

test('SCRUM-677b · 🔴 y el PROGRAMADO sí falla: es el que canta', () => {
  // El del PR informa; éste es el aviso. Si también fuera `continue-on-error`, nadie se enteraría
  // NUNCA — que es exactamente lo que pasó durante nueve días.
  assert.equal(/continue-on-error/.test(CRON), false,
    '🔴 el workflow programado no falla: entonces no avisa de nada. GitHub notifica un scheduled '
    + 'workflow EN ROJO; si no se pone rojo, el aviso no existe.');
  assert.match(CRON, /schedule:/, '🔴 no está programado.');
});

test('SCRUM-677b · 🔴 la cadencia del cron es ≤ 2 h, y se deriva del margen', () => {
  const m = CRON.match(/cron:\s*'([^']+)'/);
  assert.ok(m, '🔴 CIEGO: no encuentro la expresión cron.');
  const cada = m[1].match(/^0 \*\/(\d+) \* \* \*$/);
  assert.ok(cada, `🔴 no sé leer la cadencia «${m[1]}»: no puedo comprobar que sea suficiente.`);
  assert.ok(Number(cada[1]) <= 2,
    `🔴 el cron corre cada ${cada[1]} h. Con el margen en 6 h, el peor caso del aviso es margen + `
    + 'cadencia; a 6 h de cadencia el aviso llegaría entre las 6 y las 12 horas.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 3 · 🔴 EL HISTORIAL ENTERO, O EL VIGÍA SE QUEDA CIEGO JUSTO CUANDO IMPORTA
//
// El vigía resuelve el sha que dice producción contra la historia de `main`. Con el checkout
// superficial que GitHub hace por defecto, un commit de hace nueve días NO ESTÁ en el clon: el
// vigía se declararía «no supe mirar» — honesto, pero mudo — exactamente en el caso que existe
// para detectar. Cuanto más grave el atraso, más seguro que no lo ve.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677b · 🔴 los DOS checkouts del vigía piden el historial entero', () => {
  for (const [nombre, yml] of [['ci.yml', CI], ['vigia-despliegue.yml', CRON]]) {
    const i = yml.indexOf('vigilante-de-despliegue.mjs');
    assert.notEqual(i, -1, `🔴 CIEGO: no encuentro la llamada en ${nombre}.`);
    // El checkout de ESE job: el último `fetch-depth` antes de la llamada.
    const antes = yml.slice(0, i);
    const j = antes.lastIndexOf('fetch-depth');
    assert.notEqual(j, -1,
      `🔴 en ${nombre} el job del vigía no declara \`fetch-depth\`. Con el clon superficial de por `
      + 'defecto, un commit de hace nueve días no está y el vigía se queda ciego JUSTO en el caso '
      + 'que persigue.');
    assert.match(antes.slice(j, j + 40), /fetch-depth:\s*0/,
      `🔴 en ${nombre} el \`fetch-depth\` del vigía no es 0.`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Y EL COMANDO, para quien quiera preguntarlo a mano
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677b · el comando existe y apunta al vigía', () => {
  const pkg = JSON.parse(leer('package.json'));
  assert.equal(pkg.scripts['vigia:despliegue'], 'node scripts/vigilante-de-despliegue.mjs',
    '🔴 el comando no está o no apunta donde dice.');
  assert.ok(pkg.scripts['//vigia:despliegue'],
    '🔴 falta el comentario del comando. En este `package.json` cada script lleva el suyo, y es '
    + 'donde vive el porqué para quien lo encuentre dentro de seis meses.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CONTROL NEGATIVO DEL PROPIO TRINQUETE: sabe decir que NO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677b · 🔴 CONTROL: el detector no ve lo que no está', () => {
  // Sin esto, todos los `match` de arriba también pasarían con un lector roto que dijera que sí
  // a todo. Se le pregunta por algo que seguro NO está en esos ficheros.
  assert.equal(/node scripts\/vigilante-que-no-existe\.mjs/.test(CI), false,
    '🔴 el lector dice ver una llamada inventada: sus verdes no significan nada.');
  assert.equal(/cron:\s*'0 \*\/999/.test(CRON), false, '🔴 el lector ve una cadencia inventada.');
});

// tests/scrum829b-la-ref-rancia-se-poda.test.mjs — SCRUM-829b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA REF RANCIA, FABRICADA. Lo que le faltaba a SCRUM-829 para cerrarse por EFECTO y no por texto.
//
// SCRUM-829 arregló dos cosas —una sola regla rama→ticket y un `fetch` que PODA—, las dos están en
// `main` desde el #1212 (15-sep-2026), y las dos tenían guard de la mitad fácil:
//
//   · la regla, comparada sobre NOMBRES sueltos (`scrum753`), nunca sobre un repositorio;
//   · la poda, fijada por TEXTO: una expresión regular que busca `'fetch', '--prune'` en el fuente.
//
// 🔴 Y EL VERDE DE CI NO PRUEBA LA PODA. CI clona limpio, así que NUNCA tiene una ref rancia
// delante: el defecto sólo existía en los clones vivos, que es justo donde CI no corre. Que la
// palabra esté en el fuente no dice que git pode lo que tiene que podar.
//
// Aquí se FABRICA el escenario por el mismo camino que lo produjo: una rama existe en `origin`, el
// clon la trae, `origin` la borra —lo que hace GitHub al mergear— y el clon se queda con su
// `refs/remotes/origin/…` apuntando a una rama que ya no está. Y se le pregunta al instrumento.
//
// ⛔ NUNCA SOBRE EL REPOSITORIO REAL. Los worktrees de esta casa comparten `.git`: una ref creada o
// podada ahí la ven —y la pierden— todas las sesiones a la vez. Todo vive en un directorio
// temporal, y el SUELO comprueba que el `.git` del banco está DENTRO de ese directorio.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { traerRefs, instantanea, poblacionDe } from '../scripts/_censo-alcanzabilidad.mjs';
import { agruparRamas } from '../scripts/_censo-reparto.mjs';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase

/** El nombre que generó GitHub al pulsar «Revert»: el literal del incidente, no uno inventado. */
const REVERT = 'revert-1192-scrum-824b-el-vigia-que-no-deja-pasar';
/** Una rama legítima del mismo ticket. Es el CONTROL: tiene que seguir yendo a su ticket. */
const VIVA = 'scrum-824-la-rama-que-sigue-en-origin';

// 🔴 LAS VARIABLES QUE MANDAN A GIT A OTRO REPOSITORIO. Si una llegara heredada —desde un hook, o
// un `rebase --exec`—, cada `git` de este fichero y el `fetch --prune` de `traerRefs` actuarían
// sobre el `.git` compartido en vez de sobre el banco. Se quitan del proceso ANTES de tocar nada:
// `execFileSync` hereda `process.env` en el momento de la llamada.
for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY']) {
  delete process.env[v];
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function lineas(texto) {
  return texto.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Las refs de seguimiento del clon, con el refname COMPLETO. */
function refsDeOrigin(clon) {
  return lineas(git(clon, 'for-each-ref', '--format=%(refname)', 'refs/remotes/origin/'));
}

/**
 * EL BANCO: un `origen` con `main`, la rama VIVA y la de REVERT; un `clon` que trae las tres; y
 * después `origen` BORRA la de revert. Queda lo mismo que había en los worktrees vivos: una ref de
 * seguimiento de una rama que en el remoto ya no existe.
 *
 * Un banco por test, a propósito: el de la poda lo MODIFICA, y compartirlo haría que el orden de
 * los tests decidiera si hay ref rancia delante o no.
 */
function bancoConRefRancia() {
  const dir = temporal('scrum829b-');
  const origen = path.join(dir, 'origen');
  const clon = path.join(dir, 'clon');
  fs.mkdirSync(origen);
  git(origen, 'init', '-q');
  git(origen, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(origen, 'config', 'user.email', 'banco@yaqu.test');
  git(origen, 'config', 'user.name', 'Banco');
  git(origen, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(origen, 'a.txt'), 'x\n');
  git(origen, 'add', '-A');
  git(origen, 'commit', '-q', '-m', 'base');
  git(origen, 'branch', VIVA);
  git(origen, 'branch', REVERT);

  git(dir, 'clone', '-q', origen, clon);
  // El refspec comodín, igual que en el árbol real: sin él el fetch no mira todas las ramas.
  git(clon, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
  // 🔴 LA PODA APAGADA EN LA CONFIGURACIÓN, y a propósito. Con `fetch.prune=true` global en la
  // máquina que corre esto, git podaría aunque el código no lo pidiera, y este guard saldría verde
  // con `--prune` borrado. Lo que se mide es que pode EL CÓDIGO, no la configuración de quien corre.
  git(clon, 'config', 'fetch.prune', 'false');
  git(clon, 'config', 'remote.origin.prune', 'false');

  // Lo que hace GitHub al mergear o cerrar: la rama desaparece de origin. El clon no se entera.
  git(origen, 'branch', '-D', REVERT);

  return { dir, origen, clon, limpia: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// ═══ SUELO · el banco tiene de verdad lo que dice tener ══════════════════════════════════════

test('SCRUM-829b · SUELO: la ref RANCIA está en el clon y ya no en origen, y el banco no es el repo real', () => {
  const b = bancoConRefRancia();
  try {
    const comun = fs.realpathSync.native(path.resolve(b.clon, git(b.clon, 'rev-parse', '--git-common-dir').trim()));
    assert.ok(comun.startsWith(fs.realpathSync.native(b.dir) + path.sep),
      `🔴 el .git del banco es «${comun}», FUERA de su directorio temporal. Los tests de abajo `
      + 'podarían refs de un repositorio de verdad, que en esta casa comparten todos los worktrees.');

    const refs = refsDeOrigin(b.clon);
    assert.ok(refs.includes(`refs/remotes/origin/${REVERT}`),
      '🔴 el clon no tiene la ref de revert: no hay nada rancio delante, y el verde de la poda no '
      + 'significaría nada.');
    assert.ok(refs.includes(`refs/remotes/origin/${VIVA}`), '🔴 el clon no tiene la rama viva: el control no existe.');

    const enOrigen = lineas(git(b.origen, 'for-each-ref', '--format=%(refname)', 'refs/heads/'));
    assert.equal(enOrigen.includes(`refs/heads/${REVERT}`), false,
      '🔴 la rama de revert sigue en origen, así que la ref del clon NO está rancia.');
    assert.ok(enOrigen.includes(`refs/heads/${VIVA}`), '🔴 la rama viva no está en origen.');
  } finally {
    b.limpia();
  }
});

// ═══ ① LA REGLA · con la ref rancia delante, las dos partes del censo dicen lo mismo ═══════════

test('SCRUM-829b · 🔴 con la ref rancia DELANTE, quien agrupa y quien enumera dan el mismo número', () => {
  const b = bancoConRefRancia();
  try {
    // Se le pregunta al INSTRUMENTO por su camino —la instantánea del clon—, sin traer: la ref
    // rancia tiene que seguir ahí para que la pregunta tenga sentido.
    const inst = instantanea({ raiz: b.clon, traer: false });
    const nombres = inst.ramas.map((r) => r.nombre);
    assert.ok(nombres.includes(REVERT),
      '🔴 SUELO: la instantánea no ve la ref rancia, así que lo de abajo compararía sin el caso delante.');

    const agrupadas = agruparRamas(nombres);
    const deAgrupar = new Map();
    for (const [n, ramas] of agrupadas.porTicket) for (const r of ramas) deAgrupar.set(r.nombre, n);
    for (const r of agrupadas.sinNumero) deAgrupar.set(r.nombre, null);
    // `poblacionDe` no da el número POR rama, da el conjunto. Se le pregunta rama a rama con una
    // instantánea de UNA sola rama: decide su código, no una copia de su regla escrita aquí.
    const deEnumerar = (r) => [...poblacionDe({ ...inst, ramas: [r], entradas: [] }).deRamas][0] ?? null;

    const filas = inst.ramas
      .filter((r) => r.nombre !== 'main')
      .map((r) => ({
        rama: r.nombre,
        agrupa: deAgrupar.has(r.nombre) ? deAgrupar.get(r.nombre) : 'NO LA VIO',
        enumera: deEnumerar(r),
      }));

    assert.deepEqual(filas.filter((f) => f.agrupa !== f.enumera), [],
      '🔴 con una ref rancia delante, quien AGRUPA (`agruparRamas`) y quien ENUMERA (`poblacionDe`) '
      + 'no dan el mismo número. Es el desacuerdo de SCRUM-829: un nombre `revert-…` leído con el '
      + 'lector de CLAVES (subcadena) sale como su ticket en una parte y como «sin ticket» en la '
      + 'otra, y el censo parte un ticket en dos sin que nadie lo vea. La regla única está en '
      + '`scripts/_numero-de-rama.mjs`, y va anclada.');

    // ✅ CONTROL POSITIVO: la rama legítima sigue yendo a su ticket en las dos partes. Sin esto, un
    // censo que no numerase NADA pasaría el `deepEqual` de arriba.
    assert.deepEqual(filas.find((f) => f.rama === VIVA), { rama: VIVA, agrupa: 824, enumera: 824 },
      '🔴 la rama legítima ya no va a su ticket en alguna de las dos partes: el acuerdo de arriba '
      + 'podría ser el de dos lectores que no leen nada.');
    // Y la de revert, SIN TICKET en las dos: la decisión ② de SCRUM-829, no un accidente.
    assert.deepEqual(filas.find((f) => f.rama === REVERT), { rama: REVERT, agrupa: null, enumera: null },
      '🔴 la rama de revert tiene número en alguna parte. Una rama de revert no es trabajo del '
      + 'ticket: es su deshacer.');
  } finally {
    b.limpia();
  }
});

// ═══ ② LA PODA · lo que CI no puede ver, provocado ═══════════════════════════════════════════

test('SCRUM-829b · 🔴 traerRefs PODA la ref rancia, y sólo ésa', () => {
  const b = bancoConRefRancia();
  try {
    assert.ok(refsDeOrigin(b.clon).includes(`refs/remotes/origin/${REVERT}`),
      '🔴 SUELO: no hay ref rancia antes de traer, así que la poda no se estaría midiendo.');

    traerRefs(b.clon);
    const despues = refsDeOrigin(b.clon);

    assert.equal(despues.includes(`refs/remotes/origin/${REVERT}`), false,
      '🔴 `traerRefs` NO poda: la ref de una rama que ya no existe en origin sigue en el clon.\n'
      + '  Es el defecto de SCRUM-829: sin `--prune` el fetch sólo AÑADE, y el censo cuenta como viva '
      + 'una rama borrada. Da rojo en los clones vivos y verde en CI, que clona limpio y nunca la ve.');

    // ✅ CONTROL: podar no es vaciar. Lo que sí existe en origen tiene que seguir aquí.
    for (const sigue of [`refs/remotes/origin/${VIVA}`, 'refs/remotes/origin/main', 'refs/remotes/origin/HEAD']) {
      assert.ok(despues.includes(sigue),
        `🔴 \`traerRefs\` se ha llevado «${sigue}», que SÍ existe en origen. Una poda que borra de más `
        + 'es peor que ninguna: el censo dejaría de ver trabajo vivo.');
    }

    // Y el censo, por su propio camino, ya no la cuenta.
    const inst = instantanea({ raiz: b.clon, traer: false });
    assert.equal(inst.ramas.some((r) => r.nombre === REVERT), false,
      '🔴 la ref se ha podado pero la instantánea sigue contando la rama de revert.');
  } finally {
    b.limpia();
  }
});

/** 🔴 LAS MUTACIONES QUE TIENEN QUE TUMBARME (contrato de SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① La poda, quitada: el fetch vuelve a sólo AÑADIR. Es el segundo defecto de SCRUM-829, tal cual.
    fichero: 'scripts/_censo-alcanzabilidad.mjs',
    de: "  gitDe(raiz)('fetch', '--prune', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*');",
    a: "  gitDe(raiz)('fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*');",
    cae: 'traerRefs PODA la ref rancia, y sólo ésa',
  },
  {
    // ② Quien agrupa vuelve al lector de CLAVES: el primer defecto de SCRUM-829, tal cual.
    fichero: 'scripts/_censo-reparto.mjs',
    de: '    const n = numeroDeRama(nombre);',
    a: '    const n = numeroDeClave(nombre);',
    cae: 'con la ref rancia DELANTE, quien agrupa y quien enumera dan el mismo número',
  },
];

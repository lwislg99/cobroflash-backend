// tests/scrum830-la-rama-que-ya-no-esta.test.mjs — SCRUM-830
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN INSTRUMENTO CALIBRADO CONTRA EL MUNDO DE ANTES SE PONE ROJO CUANDO EL MUNDO MEJORA.
//
// El 8-sep-2026 se activó «Automatically delete head branches». El censo de SCRUM-804 leía sólo
// `refs/remotes/origin/`, así que un ticket entregado y mergeado pasó a `SIN RASTRO` —el veredicto
// de «no lo veo»— y cuatro tests se pusieron rojos para todo el mundo. Tres sesiones lo reportaron
// por separado el mismo día.
//
// La segunda fuente (`ramasMergeadasYBorradas`) recupera esos nombres del historial de `main`.
// Este fichero prueba que la fuente hace su trabajo **y que sigue cazando lo que el guard viejo
// cazaba**, que es lo que el ticket exige antes de dar nada por bueno.
//
// ── POR QUÉ NO SE SUBIÓ EL SUELO A 98, Y POR QUÉ NO SE RETIRÓ ────────────────────────────────
//
// Subirlo habría caducado igual: con borrado automático, las refs vivas ya no miden el tamaño de
// la casa, miden **cuántos PR hay abiertos ahora mismo**. Retirar la comprobación tampoco valía,
// porque lo que aquel suelo cazaba —que el barrido no llegue a las ramas— **sigue pudiendo pasar**,
// sólo que ahora por otra vía: que el lector de asuntos de merge se quede mudo. Así que la
// comprobación no se rebaja ni se borra: **cambia de magnitud**, de un recuento a una proporción,
// que es lo único que no caduca cuando main sólo crece.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ramasMergeadasYBorradas } from '../scripts/_rastro-del-ticket.mjs';
// 🔴 CONTRA EL PUNTO DE PARTIDA DE LA RAMA, no contra la punta movil de la principal. Lo pidio el
// guard de SCRUM-723 y tiene razon: una referencia que se mueve acusa a una rama limpia el dia que
// otro PR la desplaza. Aqui ademas no cambia lo que se mide —el historial solo crece, asi que la
// base lleva todos los merges menos los de hoy— y el suelo sigue significando lo mismo. Se cambia
// el codigo, no el guard.
//
// ⚠️ Y devuelve un OBJETO `{ sha, ref }`, no una cadena. Pasarselo entero a `git log` lo hace
// fallar, y el lector devuelve un mapa vacio SIN quejarse: seria un cero que parece un dato. Lo
// cazo el suelo de aqui abajo, que es para lo que esta.
import { baseDeLaRama } from './_base-de-la-rama.mjs';

const RAIZ = path.join(import.meta.dirname, '..');

/** Un repo de juguete: sirve para provocar estados que en el árbol real no se pueden provocar. */
function repoDeJuguete() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum830-'));
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'banco@yaqu.test');
  g('config', 'user.name', 'Banco');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'uno\n');
  g('add', '.'); g('commit', '-qm', 'base');
  return { dir, g };
}

/** Crea una rama, la mergea SIN fast-forward (deja commit de merge) y la BORRA. */
function mergearYBorrar(g, dir, rama, asunto) {
  g('checkout', '-q', '-b', rama);
  fs.appendFileSync(path.join(dir, 'a.txt'), rama + '\n');
  g('add', '.'); g('commit', '-qm', 'trabajo de ' + rama);
  g('checkout', '-q', 'main');
  g('merge', '--no-ff', '-q', rama, '-m', asunto);
  g('branch', '-qD', rama);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 0 · SUELO — el instrumento sabe encontrar, o lo de abajo no prueba nada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-830 · 🔴 SUELO: sobre el árbol REAL la segunda fuente recupera ramas', () => {
  const { sha } = baseDeLaRama(RAIZ);
  assert.ok(sha, '🔴 CIEGO: no se ha podido resolver la base de la rama; sin sha no hay historial '
    + 'que leer y el cero de abajo no significaria nada.');
  const vivas = new Set(execFileSync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/'],
    { cwd: RAIZ, encoding: 'utf8' }).split('\n').map((s) => s.replace(/^origin\//, '').trim()).filter(Boolean));
  const borradas = ramasMergeadasYBorradas({ raiz: RAIZ, sha, vivas });

  assert.ok(borradas.size > 0,
    '🔴 CIEGO: cero ramas recuperadas del historial de `main`. Un cero aquí NO es «no se ha '
    + 'borrado ninguna rama»: es que el lector de asuntos de merge no está leyendo, y entonces '
    + 'todo ticket con su rama borrada volvería a salir `SIN RASTRO`.');

  // Y ninguna de las recuperadas puede estar viva: son fuentes que no se solapan.
  const solapadas = [...borradas.keys()].filter((n) => vivas.has(n));
  assert.deepEqual(solapadas, [],
    '🔴 hay ramas contadas por las DOS fuentes: ' + solapadas.join(', ') + '. Se contarían dos '
    + 'veces y la población mentiría por exceso.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 EL CASO QUE ORIGINÓ EL TICKET, PROVOCADO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-830 · 🔴 una rama mergeada y BORRADA se recupera, con el sha de su merge', () => {
  const { dir, g } = repoDeJuguete();
  try {
    mergearYBorrar(g, dir, 'scrum-999-la-que-se-borro',
      'Merge pull request #1 from lwislg99/scrum-999-la-que-se-borro');
    const sha = g('rev-parse', 'HEAD').trim();
    const borradas = ramasMergeadasYBorradas({ raiz: dir, sha, vivas: new Set() });

    assert.ok(borradas.has('scrum-999-la-que-se-borro'),
      '🔴 la rama no se recupera. Es EXACTAMENTE el caso del ticket: se mergeó, GitHub la borró, y '
      + `el censo la daría por inexistente. Recuperadas: ${JSON.stringify([...borradas.keys()])}`);

    // 🔴 Y EL SHA TIENE QUE SER EL DEL MERGE, porque de él depende que se clasifique `en-main`.
    const suSha = borradas.get('scrum-999-la-que-se-borro');
    assert.doesNotThrow(() => execFileSync('git', ['merge-base', '--is-ancestor', suSha, sha], { cwd: dir }),
      '🔴 el sha guardado NO es ancestro de main, así que clasificarla `en-main` sería una '
      + 'afirmación sin respaldo.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-830 · 🔴 lee las DOS formas de asunto que deja git, y sólo ésas', () => {
  const { dir, g } = repoDeJuguete();
  try {
    mergearYBorrar(g, dir, 'scrum-901-por-pr', 'Merge pull request #7 from lwislg99/scrum-901-por-pr');
    mergearYBorrar(g, dir, 'scrum-902-por-remota', "Merge remote-tracking branch 'origin/scrum-902-por-remota'");
    // ✅ CONTROL NEGATIVO: un merge cuyo asunto NO nombra rama no puede inventarse una.
    mergearYBorrar(g, dir, 'scrum-903-sin-nombre', 'Arreglo del cierre de mes');

    const sha = g('rev-parse', 'HEAD').trim();
    const borradas = ramasMergeadasYBorradas({ raiz: dir, sha, vivas: new Set() });

    assert.deepEqual([...borradas.keys()].sort(), ['scrum-901-por-pr', 'scrum-902-por-remota'],
      '🔴 el lector no distingue las dos formas de asunto, o se ha inventado una rama a partir de '
      + `un merge que no la nombra. Leyó: ${JSON.stringify([...borradas.keys()])}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-830 · ✅ una rama VIVA no la toca esta fuente: la clasifica quien sabe más de ella', () => {
  const { dir, g } = repoDeJuguete();
  try {
    mergearYBorrar(g, dir, 'scrum-904-viva', 'Merge pull request #9 from lwislg99/scrum-904-viva');
    const sha = g('rev-parse', 'HEAD').trim();

    const sinFiltro = ramasMergeadasYBorradas({ raiz: dir, sha, vivas: new Set() });
    assert.ok(sinFiltro.has('scrum-904-viva'), '🔴 SUELO: sin filtro tenía que verla.');

    const conFiltro = ramasMergeadasYBorradas({ raiz: dir, sha, vivas: new Set(['scrum-904-viva']) });
    assert.ok(!conFiltro.has('scrum-904-viva'),
      '🔴 una rama que SIGUE VIVA se cuela por la segunda fuente. Se contaría dos veces, y peor: '
      + 'entraría como `en-main` por construcción cuando puede tener trabajo por encima del merge '
      + '— justo el falso «está todo dentro» que SCRUM-804 vino a impedir.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 LO QUE EL GUARD VIEJO CAZABA, Y QUE EL NUEVO SIGUE CAZANDO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-830 · 🔴 si el lector se queda MUDO, la proporción lo dice', () => {
  // El modo de fallo real: GitHub cambia el texto de sus merges, o se pasa a squash. Provocado con
  // tres merges cuyos asuntos no nombran rama: el lector recupera CERO y la razón se hunde.
  const { dir, g } = repoDeJuguete();
  try {
    for (const n of [1, 2, 3]) mergearYBorrar(g, dir, 'scrum-9' + n + '-muda', 'Squashed changes ' + n);
    const sha = g('rev-parse', 'HEAD').trim();
    const merges = Number(execFileSync('git', ['rev-list', '--count', '--merges', sha],
      { cwd: dir, encoding: 'utf8' }).trim());
    const borradas = ramasMergeadasYBorradas({ raiz: dir, sha, vivas: new Set() });
    const razon = merges ? borradas.size / merges : 0;

    assert.equal(merges, 3, '🔴 SUELO: el banco no ha dejado los tres merges que creía.');
    assert.ok(razon < 0.2,
      `🔴 con TRES merges que no nombran rama, la razón sale ${razon.toFixed(2)} y el suelo de `
      + 'SCRUM-804 (0,20) no hablaría. Entonces el guard no cazaría el día que GitHub cambie el '
      + 'texto de sus merges, que es justo para lo que se puso.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-830 · ✅ y con asuntos normales la proporción NO habla — el suelo no grita por nada', () => {
  // La otra mitad: un suelo que salta siempre se desactiva. Mismo banco, asuntos buenos.
  const { dir, g } = repoDeJuguete();
  try {
    for (const n of [1, 2, 3]) {
      mergearYBorrar(g, dir, 'scrum-8' + n + '-buena',
        'Merge pull request #' + n + ' from lwislg99/scrum-8' + n + '-buena');
    }
    const sha = g('rev-parse', 'HEAD').trim();
    const merges = Number(execFileSync('git', ['rev-list', '--count', '--merges', sha],
      { cwd: dir, encoding: 'utf8' }).trim());
    const razon = merges ? ramasMergeadasYBorradas({ raiz: dir, sha, vivas: new Set() }).size / merges : 0;
    assert.ok(razon >= 0.2,
      `🔴 con tres merges BIEN nombrados la razón sale ${razon.toFixed(2)} y el suelo hablaría en `
      + 'un árbol sano. Un guard que da rojo en falso se desactiva, y con él se pierde lo que sí '
      + 'vigilaba.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

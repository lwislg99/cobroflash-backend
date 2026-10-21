// tests/scrum1572-registro-creado-por-dos-ramas.test.mjs — SCRUM-1572 (decisión c.20164)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EN `docs/master/` GIT NO DA CONFLICTO: UNE. Y CUANDO LAS DOS RAMAS CREAN EL MISMO REGISTRO,
// LA UNIÓN LO SACA LIMPIO Y ROTO.
//
// `.gitattributes` declara `docs/master/*.md merge=union` (SCRUM-839d): dos tramos que se añaden
// en el mismo sitio se quedan los dos, y está bien. Pero si el fichero NO existe en la base del
// merge y los dos padres lo CREAN, git une dos ficheros enteros contra una base vacía y los
// entrelaza línea a línea, sin un solo marcador. Medido el 21-oct-2026:
//   · fa1897e48 (SCRUM-1569, #2625): el tramo de una sesión cayó DENTRO de la tabla de la otra;
//     se encontró leyendo el fichero, y se rehízo a mano en b7dd7eeb0.
//   · 18c3e3686 (SCRUM-964, #1544): el mismo mecanismo, y el fichero sigue en la línea principal
//     tal como lo dejó la unión.
//   · `git merge-file --union` sobre los dos padres reproduce BYTE A BYTE el blob de los dos.
//
// POR CAUSA, NO POR SÍNTOMA: no se mira la forma del texto (una tabla cortada, un ancla
// repetida), que con prosa no deja huella. Se mira el MERGE: en cada merge que trae la rama,
// ¿hay un registro que los dos padres crean, con contenidos distintos, cuyo resultado es
// exactamente la unión de los dos, y que nadie ha vuelto a tocar después? Eso es una unión que
// entrelazó dos registros y que todavía no ha juntado nadie a mano.
//
// LA POBLACIÓN es la de la rama: los merges desde su punto de partida (`baseDeLaRama`, SCRUM-723)
// hasta el árbol bajo prueba. En la línea principal es vacía, y por eso el instrumento lleva su
// propia SIEMBRA: si la siembra no cae, el veredicto sobre el árbol es CIEGO, nunca verde.
//
// LO QUE NO MIRA, declarado: los merges que ya están en la línea principal (SCRUM-964 sigue ahí;
// es un hallazgo del registro de SCRUM-1572, no de este test) ni un registro que se toca después
// de la unión sin arreglarlo (cualquier commit posterior lo da por revisado).
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUTA_DE_REGISTRO } from '../scripts/conflicto-de-registro.mjs';
import { baseDeLaRama } from './_base-de-la-rama.mjs';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Mirar los que se MODIFICAN en vez de los que se crean: el caso de la unión sana.
    fichero: 'tests/scrum1572-registro-creado-por-dos-ramas.test.mjs',
    de: "'--diff-filter=A'",
    a: "'--diff-filter=M'",
    cae: '🔴 POSITIVO SEMBRADO: dos ramas crean el mismo registro y la unión lo entrelaza',
  },
  {
    // Sin comparar con la unión, un merge resuelto a mano se acusaría igual.
    fichero: 'tests/scrum1572-registro-creado-por-dos-ramas.test.mjs',
    de: '      if (enMerge !== unir(g, enUno, enOtro)) continue;\n',
    a: '',
    cae: '🔴 RESUELTO EN EL PROPIO MERGE',
  },
  {
    // Sin mirar el estado final, un registro ya juntado a mano seguiría rojo para siempre.
    fichero: 'tests/scrum1572-registro-creado-por-dos-ramas.test.mjs',
    de: '      if (blob(g, hasta, f) !== enMerge) continue;\n',
    a: '',
    cae: '🔴 REPARADO DESPUÉS',
  },
  {
    // El suelo apagado: una siembra que no cae dejaría pasar el árbol como verde.
    fichero: 'tests/scrum1572-registro-creado-por-dos-ramas.test.mjs',
    de: "if (!siembra || siembra.hallazgos.length !== 1) return 'CIEGO';",
    a: "if (!siembra) return 'CIEGO';",
    cae: '🔴 CIEGO: sin la siembra',
  },
];

/** Un `git` atado a un directorio. */
const gitEn = (cwd) => (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();

/** El blob de `ruta` en `commit`, o `null` si no está. */
function blob(g, commit, ruta) {
  try { return g('rev-parse', '--verify', '-q', `${commit}:${ruta}`); } catch { return null; }
}

/** Lo que `merge=union` saca de dos blobs creados contra una base vacía, como blob. */
function unir(g, a, b) {
  const dir = temporal('scrum1572-unir-');
  const leer = (h) => execFileSync('git', ['cat-file', 'blob', h], { cwd: g.cwd });
  fs.writeFileSync(path.join(dir, 'uno'), leer(a));
  fs.writeFileSync(path.join(dir, 'base'), '');
  fs.writeFileSync(path.join(dir, 'otro'), leer(b));
  const r = spawnSync('git', ['merge-file', '--union', '-p', 'uno', 'base', 'otro'], { cwd: dir });
  if (r.status !== 0 || r.error) throw new Error(`no pude mirar: git merge-file salió ${r.status}`);
  return execFileSync('git', ['hash-object', '--stdin'], { cwd: g.cwd, input: r.stdout, encoding: 'utf8' }).trim();
}

/**
 * Los merges de `desde..hasta` donde la unión entrelazó un registro que crean los dos padres y
 * nadie lo ha juntado después. Devuelve la población (`merges`, `pares`) junto al resultado.
 */
export function unionesQueEntrelazan(g, { desde, hasta }) {
  const merges = g('rev-list', '--merges', '--parents', `${desde}..${hasta}`).split('\n').filter(Boolean);
  const hallazgos = [];
  let pares = 0;
  for (const linea of merges) {
    const [m, p1, p2, ...mas] = linea.split(' ');
    if (mas.length) throw new Error(`no pude mirar: ${m} tiene ${mas.length + 2} padres`);
    const base = g('merge-base', p1, p2);
    const creados = (p) => g('diff', '--name-only', '--no-renames', '--diff-filter=A', base, p, '--', 'docs/master/')
      .split('\n').filter((f) => RUTA_DE_REGISTRO.test(f));
    const delOtro = new Set(creados(p2));
    for (const f of creados(p1)) {
      if (!delOtro.has(f)) continue;
      pares++;
      const enUno = blob(g, p1, f), enOtro = blob(g, p2, f), enMerge = blob(g, m, f);
      // El merge se quedó con un lado entero (o los dos eran iguales): no hay nada entrelazado.
      if (enMerge === null || enMerge === enUno || enMerge === enOtro) continue;
      // Resuelto a mano dentro del propio merge: no es lo que saca la unión.
      if (enMerge !== unir(g, enUno, enOtro)) continue;
      // Alguien lo volvió a escribir después: ya no es el registro que dejó la unión.
      if (blob(g, hasta, f) !== enMerge) continue;
      hallazgos.push({ merge: m, fichero: f });
    }
  }
  return { merges: merges.length, pares, hallazgos };
}

/** El veredicto sobre el árbol solo vale si la siembra, en la misma pasada, cayó. */
export function veredicto(siembra, real) {
  if (!siembra || siembra.hallazgos.length !== 1) return 'CIEGO';
  return real.hallazgos.length ? 'ROJO' : 'VERDE';
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SIEMBRA: un repositorio de verdad, con la regla de `.gitattributes` copiada del árbol.
// ═════════════════════════════════════════════════════════════════════════════════════════

const REGLA = fs.readFileSync(path.join(RAIZ, '.gitattributes'), 'utf8')
  .split(/\r?\n/).filter((l) => /^docs\/master\/\S+\s+merge=union\s*$/.test(l));

const REGISTRO = 'docs/master/SCRUM-9001.md';

// La unión solo intercala si los dos ficheros comparten un bloque de 4 líneas o más: con 3 los
// pega uno detrás de otro (medido el 21-oct-2026 con `git merge-file --union`; en fa1897e48 el
// bloque común eran 5 filas de una tabla que las dos sesiones copiaron igual). Aquí son 4 filas.
const FILAS_COMUNES = [
  '| A9 en el registro | `tests/scrum1294-a9-leccion-en-a10.test.mjs` |',
  '| ancla de medición | `tests/scrum267-ancla-de-medicion.test.mjs` |',
  '| un registro por ticket | `tests/scrum273-registro-por-fichero.test.mjs` |',
  '| sin marcadores de conflicto | `tests/scrum393-marcadores-de-conflicto.test.mjs` |',
];
const TITULO_OTRO = '# SCRUM-9001 · el tramo de otra sesión';
const TRAMO_UNO = [
  '# SCRUM-9001 · el tramo de una sesión', '', '**Medido contra:** `aaaaaaa`', '',
  '| aceptación | dónde se ve |', '|---|---|', '| uno-a | `tests/uno-a.test.mjs` |',
  ...FILAS_COMUNES, '| uno-b | `tests/uno-b.test.mjs` |', '', 'A9: sin fallo que generalice — uno', '',
].join('\n');
const TRAMO_OTRO = [
  TITULO_OTRO, '', '**Medido contra:** `bbbbbbb`', '', 'Lo que entra en esta rama:',
  ...FILAS_COMUNES, '', 'A9: sin fallo que generalice — otro', '',
].join('\n');

/**
 * Dos ramas que parten de la misma base; la segunda se une a la primera con `git merge`.
 * `{ uno, otro }` son los ficheros que escribe cada rama; `luego`, lo que se commitea después.
 * `aMano`, si está, sustituye el registro dentro del propio merge (una resolución a mano).
 */
function sembrar({ uno, otro, luego = null, aMano = null }) {
  const dir = temporal('scrum1572-');
  const g = gitEn(dir);
  g.cwd = dir;
  const escribir = (ficheros) => {
    for (const [f, txt] of Object.entries(ficheros)) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), txt);
    }
    g('add', '-A');
  };
  g('init', '-q');
  g('config', 'core.autocrlf', 'false');
  g('config', 'user.email', 'scrum1572@test');
  g('config', 'user.name', 'scrum1572');
  escribir({ '.gitattributes': REGLA.join('\n') + '\n', 'docs/master/SCRUM-9000.md': '# SCRUM-9000\n\ntramo común\n' });
  g('commit', '-qm', 'base');
  const desde = g('rev-parse', '--verify', 'HEAD');
  g('checkout', '-qb', 'otra');
  escribir(otro);
  g('commit', '-qm', 'otra');
  g('checkout', '-qb', 'una', desde);
  escribir(uno);
  g('commit', '-qm', 'una');
  const merge = spawnSync('git', ['merge', '--no-edit', '--no-commit', 'otra'], { cwd: dir, encoding: 'utf8' });
  if (aMano) escribir({ [REGISTRO]: aMano });
  g('commit', '-qm', 'merge de otra en una');
  if (luego) { escribir(luego); g('commit', '-qm', 'luego'); }
  return { g, dir, desde, hasta: g('rev-parse', '--verify', 'HEAD'), mergeSalio: merge.status };
}

const SIEMBRA = { uno: { [REGISTRO]: TRAMO_UNO }, otro: { [REGISTRO]: TRAMO_OTRO } };

test('🔴 POSITIVO SEMBRADO: dos ramas crean el mismo registro y la unión lo entrelaza sin conflicto → cae', () => {
  assert.equal(REGLA.length, 1, 'no encuentro la regla merge=union de docs/master en .gitattributes');
  const s = sembrar(SIEMBRA);
  assert.equal(s.mergeSalio, 0, 'la unión debía salir sin conflicto: es justo el defecto');
  const unido = fs.readFileSync(path.join(s.dir, REGISTRO), 'utf8').split('\n');
  assert.ok(!unido.some((l) => /^(<<<<<<<|=======|>>>>>>>)/.test(l)), 'la unión no deja marcadores');
  // Entrelazado de verdad, como en fa1897e48: el título del otro tramo cae DENTRO de la tabla del primero.
  const cabecera = unido.indexOf('| aceptación | dónde se ve |');
  const ultimaDeUno = unido.indexOf('| uno-b | `tests/uno-b.test.mjs` |');
  const deOtro = unido.indexOf(TITULO_OTRO);
  assert.ok(cabecera !== -1 && cabecera < deOtro && deOtro < ultimaDeUno,
    `la siembra no entrelazó la tabla: el instrumento no se está probando contra el defecto\n${unido.join('\n')}`);
  const r = unionesQueEntrelazan(s.g, s);
  assert.deepEqual({ merges: r.merges, pares: r.pares }, { merges: 1, pares: 1 });
  assert.deepEqual(r.hallazgos.map((h) => h.fichero), [REGISTRO]);
});

test('🔴 NEGATIVO: un registro sano de la línea principal y dos tramos en un registro que ya existía → no cae', () => {
  const sano = fs.readFileSync(path.join(RAIZ, 'docs/master/SCRUM-1569.md'), 'utf8');
  const s = sembrar({
    uno: { [REGISTRO]: sano, 'docs/master/SCRUM-9000.md': '# SCRUM-9000\n\ntramo común\n\n## tramo de una\n' },
    otro: { 'docs/master/SCRUM-9000.md': '# SCRUM-9000\n\ntramo común\n\n## tramo de otra\n' },
  });
  assert.equal(s.mergeSalio, 0);
  const r = unionesQueEntrelazan(s.g, s);
  assert.deepEqual(r, { merges: 1, pares: 0, hallazgos: [] });
});

test('🔴 RESUELTO EN EL PROPIO MERGE: quien junta los dos tramos al hacer el merge → no cae', () => {
  const s = sembrar({ ...SIEMBRA, aMano: TRAMO_UNO + '\n' + TRAMO_OTRO });
  const r = unionesQueEntrelazan(s.g, s);
  assert.deepEqual({ pares: r.pares, hallazgos: r.hallazgos }, { pares: 1, hallazgos: [] });
});

test('🔴 REPARADO DESPUÉS: el registro entrelazado que alguien vuelve a escribir en un commit posterior → no cae', () => {
  const s = sembrar({ ...SIEMBRA, luego: { [REGISTRO]: TRAMO_UNO + '\n' + TRAMO_OTRO } });
  const r = unionesQueEntrelazan(s.g, s);
  assert.deepEqual({ pares: r.pares, hallazgos: r.hallazgos }, { pares: 1, hallazgos: [] });
});

test('🔴 CIEGO: sin la siembra (la segunda rama no crea el registro) el veredicto es CIEGO, nunca verde', () => {
  const sinSiembra = sembrar({ uno: SIEMBRA.uno, otro: { 'docs/master/SCRUM-9002.md': TRAMO_OTRO } });
  const control = unionesQueEntrelazan(sinSiembra.g, sinSiembra);
  assert.equal(control.hallazgos.length, 0);
  assert.equal(veredicto(control, { hallazgos: [] }), 'CIEGO');
  assert.equal(veredicto(null, { hallazgos: [] }), 'CIEGO');
});

test('🔴 EL ÁRBOL: ningún merge de esta rama deja un registro creado por las dos ramas y entrelazado', (t) => {
  const base = baseDeLaRama(RAIZ);
  assert.ok(base, 'CIEGO: no encuentro el punto de partida de la rama (¿checkout somero?)');
  const g = gitEn(RAIZ);
  g.cwd = RAIZ;
  const real = unionesQueEntrelazan(g, { desde: base.sha, hasta: 'HEAD' });
  const s = sembrar(SIEMBRA);
  const siembra = unionesQueEntrelazan(s.g, s);
  t.diagnostic(`población: ${real.merges} merges desde ${base.sha.slice(0, 9)} (${base.ref}), ${real.pares} registros creados por los dos padres · siembra: ${siembra.hallazgos.length} de 1`);
  const v = veredicto(siembra, real);
  assert.notEqual(v, 'CIEGO', 'CIEGO: la siembra no cayó, así que un cero sobre el árbol no dice nada');
  assert.equal(v, 'VERDE',
    'la unión de git entrelazó registros que crean las dos ramas; junta los dos tramos a mano y commitéalo:\n'
    + real.hallazgos.map((h) => `  ${h.fichero} · merge ${h.merge}`).join('\n'));
});

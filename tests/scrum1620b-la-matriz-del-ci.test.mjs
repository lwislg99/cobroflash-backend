// tests/scrum1620b-la-matriz-del-ci.test.mjs — SCRUM-1620b · S5
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MATRIZ DE `ci.yml`: EL META-GUARD EN TRES PARTES, Y UN JOB QUE LAS JUNTA
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Con #2962 ya dentro, el log de `main` seguía diciendo «parte ÚNICA: el censo entero» y se cortaba
// con mutaciones SIN JUZGAR (las cifras, con su job y su sha, en `docs/master/SCRUM-1620.md`). El
// script sabía correr una parte; `ci.yml` no se la pedía. Lo que se exige aquí:
//   ① la matriz, `META_PARTE` y `--juntar` dicen el MISMO K, y el resumen de cada parte llega al
//      agregador (mismo directorio, mismo nombre de artefacto);
//   ② el job que lee el vigía de main (`JOB_META_GUARD`) es UNO, es el agregador, cae en su paso
//      (`PASO_DEL_META_GUARD`), no corre en un run cancelado y no corre `npm run meta:mutaciones`
//      (si lo corriera, `techoDelJob` no sabría de qué job es);
//   ③ el veredicto junto dice sobre cuántos GUARDS, no sólo sobre cuántas mutaciones: «238 ficheros
//      DECLARANTES» es el censo, y el corte dejaba 46 sin ninguna mutación juzgada;
//   ④ el bloque principal cuenta un guard como juzgado con su primera mutación juzgada.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 Que las tres partes CABEN. Eso lo dice la primera pasada del CI con la matriz («juzgadas N de M»
//    y el margen de la parte más lenta), copiada en `docs/master/SCRUM-1620.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { veredictoDeLasPartes, techoDelJob } from '../scripts/meta-guard-mutaciones.mjs';
import { JOB_META_GUARD, PASO_DEL_META_GUARD } from '../scripts/vigia-silencio-de-main.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8').replace(/\r\n/g, '\n');

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: '.github/workflows/ci.yml',
    de: '          META_PARTE: ${{ matrix.parte }}/3\n',
    a: '          META_PARTE: ${{ matrix.parte }}/2\n',
    cae: 'SCRUM-1620b · ① la matriz, META_PARTE y --juntar dicen el MISMO K, y el resumen llega al agregador' },
  { fichero: '.github/workflows/ci.yml',
    de: '    if: ${{ !cancelled() }}\n',
    a: '    if: always()\n',
    cae: 'SCRUM-1620b · ② el job que lee el vigía es UNO, es el agregador, y no corre en un run cancelado' },
  { fichero: '.github/workflows/ci.yml',
    de: '    name: meta-guard · parte ${{ matrix.parte }} de 3\n',
    a: '    name: meta-guard · los guards caen cuando deben\n',
    cae: 'SCRUM-1620b · ② el job que lee el vigía es UNO, es el agregador, y no corre en un run cancelado' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    guardsJuzgados = Number.isInteger(r.guardsJuzgados) && guardsJuzgados !== null ? guardsJuzgados + r.guardsJuzgados : null;',
    a: '    guardsJuzgados += r.guardsJuzgados || 0;',
    cae: 'SCRUM-1620b · ③ el veredicto junto dice sobre cuántos GUARDS, y «no lo sé» no es un número' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '      if (desde === 0) resumenDeLaParte.guardsJuzgados += 1;',
    a: '      if (desde === 0) resumenDeLaParte.guardsJuzgados += 0;',
    cae: 'SCRUM-1620b · ④ el bloque principal cuenta un guard como juzgado con su primera mutación' },
];

/** Los jobs de `ci.yml`: `{ clave, bloque }`, de su clave a la siguiente clave de job. */
function jobsDelCi() {
  const ini = CI.indexOf('\njobs:\n');
  assert.ok(ini >= 0, 'NO PUDE MIRAR: no encuentro `jobs:` en ci.yml');
  const jobs = [];
  for (const linea of CI.slice(ini + '\njobs:\n'.length).split('\n')) {
    if (/^\S/.test(linea)) break;
    const m = /^ {2}([\w-]+):\s*$/.exec(linea);
    if (m) jobs.push({ clave: m[1], bloque: '' });
    else if (jobs.length) jobs.at(-1).bloque += `${linea}\n`;
  }
  assert.ok(jobs.length > 5, `NO PUDE MIRAR: sólo ${jobs.length} jobs en ci.yml`);
  return jobs;
}
const nombreDe = (bloque) => /^ {4}name:\s*(.+?)\s*$/m.exec(bloque)?.[1] ?? null;
const job = (clave) => {
  const j = jobsDelCi().find((x) => x.clave === clave);
  assert.ok(j, `NO PUDE MIRAR: no hay job \`${clave}\` en ci.yml`);
  return j.bloque;
};

test('SCRUM-1620b · ① la matriz, META_PARTE y --juntar dicen el MISMO K, y el resumen llega al agregador', () => {
  const partes = job('meta-mutaciones');
  const agregador = job('meta-veredicto');
  const matriz = /^ {8}parte:\s*\[([^\]]*)\]\s*$/m.exec(partes);
  assert.ok(matriz, 'NO PUDE MIRAR: no encuentro `parte: [...]` en la matriz de `meta-mutaciones`');
  const valores = matriz[1].split(',').map((v) => Number(v.trim()));
  const k = valores.length;
  assert.deepEqual(valores, Array.from({ length: k }, (_, i) => i + 1), '🔴 las partes tienen que ser 1..K, sin huecos ni repetidas');
  assert.ok(k >= 2, `🔴 una matriz de ${k} parte(s) es el censo entero otra vez: el corte de hoy`);
  assert.match(partes, /^ {6}fail-fast: false$/m, '🔴 una parte en rojo cancelaría a las otras, y el agregador las diría CIEGAS');

  const env = /^ {10}META_PARTE: \$\{\{ matrix\.parte \}\}\/(\d+)$/m.exec(partes);
  assert.ok(env, '🔴 el paso no pasa `META_PARTE`: cada parte juzgaría el censo entero y se cortaría');
  assert.equal(Number(env[1]), k, `🔴 la matriz tiene ${k} partes y META_PARTE dice /${env[1]}`);
  const juntar = /node scripts\/meta-guard-mutaciones\.mjs --juntar (\S+) (\d+)/.exec(agregador);
  assert.ok(juntar, 'NO PUDE MIRAR: el agregador no llama a `--juntar <dir> <K>`');
  assert.equal(Number(juntar[2]), k, `🔴 la matriz tiene ${k} partes y --juntar espera ${juntar[2]}`);

  // El camino del resumen: lo escribe la parte, lo sube, lo baja el agregador, lo lee `--juntar`.
  const salida = /^ {10}META_SALIDA_EN: ([\w-]+)\/parte-\$\{\{ matrix\.parte \}\}\.json$/m.exec(partes);
  assert.ok(salida, '🔴 la parte no deja su resumen (`META_SALIDA_EN`): el agregador la diría CIEGA siempre');
  assert.match(partes, new RegExp(`^ {10}path: ${salida[1]}/$`, 'm'), '🔴 se sube otra carpeta que la del resumen');
  assert.match(partes, /^ {10}name: meta-parte-\$\{\{ matrix\.parte \}\}$/m);
  assert.match(agregador, /^ {10}pattern: meta-parte-\*$/m, '🔴 el agregador baja otros artefactos que los de las partes');
  assert.match(agregador, new RegExp(`^ {10}path: ${juntar[1]}$`, 'm'), '🔴 se bajan los resúmenes a otra carpeta que la que lee --juntar');
  assert.equal(juntar[1], salida[1], '🔴 --juntar lee otra carpeta que la que escriben las partes');
  assert.match(agregador, /^ {10}merge-multiple: true$/m, '🔴 sin merge-multiple cada parte cae en su subcarpeta y --juntar no la ve');
  assert.match(partes, /- name: Guardar el resumen de la parte\n {8}if: always\(\)\n/,
    '🔴 la parte que cae es la que más interesa, y sin `always()` no sube su resumen');
});

test('SCRUM-1620b · ② el job que lee el vigía es UNO, es el agregador, y no corre en un run cancelado', () => {
  const jobs = jobsDelCi();
  const conElNombre = jobs.filter((j) => nombreDe(j.bloque) === JOB_META_GUARD).map((j) => j.clave);
  assert.deepEqual(conElNombre, ['meta-veredicto'], `🔴 el vigía de main lee «${JOB_META_GUARD}» y lo llevan: ${conElNombre.join(', ') || 'ninguno'}`);
  const agregador = job('meta-veredicto');
  assert.match(agregador, /^ {4}needs: meta-mutaciones$/m, '🔴 el agregador no espera a las partes');
  assert.match(agregador, /^ {4}if: \$\{\{ !cancelled\(\) \}\}$/m,
    '🔴 sin `!cancelled()` no corre si una parte cae; con `always()` corre en un run CANCELADO y lo pinta CIEGO');
  const pasos = agregador.split('\n').filter((l) => /^ {6}- name: /.test(l)).map((l) => l.replace(/^ {6}- name: /, ''));
  assert.equal(pasos.filter((p) => p === PASO_DEL_META_GUARD).length, 1,
    `🔴 el vigía lee el código del paso «${PASO_DEL_META_GUARD}», y el agregador lo lleva ${pasos.filter((p) => p === PASO_DEL_META_GUARD).length} veces`);
  assert.match(agregador, /exit "\$codigo"/, '🔴 el paso no sale con el código de `--juntar`: el vigía no leería su 2');
  assert.doesNotMatch(agregador, /npm run meta:mutaciones/, '🔴 el agregador corre el censo: techoDelJob ya no sabría de qué job es');
  // CONTROL POSITIVO: el techo de las partes se sigue leyendo (un solo job con la línea).
  assert.equal(techoDelJob(CI), 1800, '🔴 el meta-guard ya no lee su techo en ci.yml: un corte del job sería mudo');
  assert.notEqual(nombreDe(job('meta-mutaciones')), JOB_META_GUARD);
});

/** Una parte que salió con `codigo`, como la deja `META_SALIDA_EN`. */
const parte = (i, codigo, juzgadas, declaraciones, extra = {}) => ({
  parte: `${i}/3`, codigo, juzgadas, declaraciones, declaracionesDelCenso: 940, segundos: 600, presupuestoS: 1695,
  guardsJuzgados: 79 + (i === 1 ? 1 : 0), guardsDelCenso: 238, ...extra,
});

test('SCRUM-1620b · ③ el veredicto junto dice sobre cuántos GUARDS, y «no lo sé» no es un número', () => {
  const verdes = [parte(1, 0, 314, 314), parte(2, 0, 313, 313), parte(3, 0, 313, 313)];
  const v = veredictoDeLasPartes(verdes, 3).lineas.join('\n');
  assert.match(v, /juzgadas 940 de 940 declaraciones, en 3 partes/);
  assert.match(v, /guards con alguna mutación juzgada: 238 de 238 del censo/);
  // El corte de hoy, en una parte: el total de guards BAJA y se ve.
  const cortada = veredictoDeLasPartes([verdes[0], verdes[1], parte(3, 2, 200, 313, { guardsJuzgados: 33 })], 3).lineas.join('\n');
  assert.match(cortada, /guards con alguna mutación juzgada: 192 de 238 del censo/);
  // Una parte de antes de este cambio (sin el campo) o sin resumen: «?», nunca la suma de las otras.
  const sinCampo = veredictoDeLasPartes([verdes[0], verdes[1], parte(3, 0, 313, 313, { guardsJuzgados: undefined })], 3).lineas.join('\n');
  assert.match(sinCampo, /guards con alguna mutación juzgada: \? de 238/, '🔴 una parte que no lo dijo se leería como 0 guards suyos');
  const sinParte = veredictoDeLasPartes([verdes[0], verdes[1], null], 3).lineas.join('\n');
  assert.match(sinParte, /guards con alguna mutación juzgada: \? de 238/);
});

/** El bloque principal del script, SIN comentarios (A23 nº 2). */
function bloquePrincipal() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs'), 'utf8');
  const sf = ts.createSourceFile('m.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const si = sf.statements.find((s) => ts.isIfStatement(s) && /ejecutadoDirectamente/.test(s.expression.getText(sf)));
  assert.ok(si && ts.isBlock(si.thenStatement), 'NO PUDE MIRAR: no encuentro el bloque `if (ejecutadoDirectamente(…))`');
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, si.thenStatement, sf);
}

test('SCRUM-1620b · ④ el bloque principal cuenta un guard como juzgado con su primera mutación', () => {
  const codigo = bloquePrincipal();
  const bucle = codigo.indexOf('bucle: for (');
  assert.ok(bucle > 0, 'NO PUDE MIRAR: no encuentro el bucle de mutaciones');
  const cuenta = codigo.indexOf('if (desde === 0)', bucle);
  assert.ok(cuenta > bucle, '🔴 el bucle no cuenta los guards juzgados: el agregador diría 0 de 238');
  assert.match(codigo.slice(cuenta, cuenta + 80), /^if \(desde === 0\)\s*resumenDeLaParte\.guardsJuzgados \+= 1;/);
  assert.ok(cuenta > codigo.indexOf('juzgadas += 1;', bucle), '🔴 se cuenta el guard antes de juzgar su mutación');
  assert.match(codigo, /guardsDelCenso: guardsConDeclaracion/, '🔴 la parte no dice cuántos guards tiene el censo');
});

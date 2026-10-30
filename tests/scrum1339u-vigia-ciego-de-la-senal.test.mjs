// tests/scrum1339u-vigia-ciego-de-la-senal.test.mjs — SCRUM-1339u
//
// El vigía de `main` recoge «la señal de nombres no pudo medir» como CIEGO (decisión del fundador,
// SCRUM-1339 c.20240, «a»): la señal sigue saliendo 0 en ese caso y no bloquea, pero el vigía lo
// nombra, aunque otro job esté en rojo, y no lo absuelve un verde. Sin red. El dato es la anotación
// del job «build + tests», no el log. Las anotaciones de abajo son las LITERALES de tres jobs reales
// (sólo `annotation_level`, `title` y `message`). Medido antes de escribir esto: en los 400 runs del
// CI del 15 al 22-oct la señal no dejó de medir NINGUNA vez (u-salida-senal-en-los-runs.txt); el
// positivo es el control ④ de SCRUM-1339d, que la hizo fallar a propósito. Que `checks: read` deje
// leerlas con el `GITHUB_TOKEN` no se prueba aquí: es el CIEGO que ya declaró 1339r.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeCommit, accionDelIssue, marcaDeAviso, sueloPorCommit, conRun, topeDeCorridaDelCI,
  lecturaDeLaSenal, ciegoDeLaSenal, JOBS_DEL_CI, JOB_DE_LA_SENAL, CAUSA_SENAL,
  JOB_META_GUARD, PASO_DEL_META_GUARD, CAUSA_META_GUARD,
} from '../scripts/vigia-silencio-de-main.mjs';
import { comandosDeAnotacion, TITULO } from '../scripts/_senal-de-nombres.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI_YML = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');
const GUION = fs.readFileSync(path.join(RAIZ, 'scripts', 'senal-de-nombres.mjs'), 'utf8');
const AHORA = '2026-10-22T10:30:00Z';
const TOPE = topeDeCorridaDelCI(CI_YML);
const NAVEGADOR = 'guards de navegador (fuera de la tanda)';
const job = (name, conclusion, extra = {}) => ({ name, status: 'completed', conclusion, ...extra });
const run = (conclusion) => ({ status: 'completed', conclusion, created_at: '2026-10-22T10:00:00Z', html_url: 'https://x/run' });
/** Los seis jobs del CI en success, con «build + tests» leyendo `anotaciones` y los `otros` cambiados. */
const jobsCon = (anotaciones, otros = [], conclusion = 'success') => [
  ...JOBS_DEL_CI.filter((n) => n !== JOB_DE_LA_SENAL && !otros.some((o) => o.name === n)).map((n) => job(n, 'success')),
  ...otros, job(JOB_DE_LA_SENAL, conclusion, { senal: lecturaDeLaSenal(anotaciones) }),
];
const juzgar = (sha, jobs, concl = 'success') => veredictoDeCommit({ sha, run: run(concl), jobs, ahora: AHORA, topeMin: TOPE });
const VERDE = (sha) => juzgar(sha, JOBS_DEL_CI.map((n) => job(n, 'success')));
const P = 'a'.repeat(40);
const V = 'b'.repeat(40);
const pasada = (veredictos) => ({ veredictos, ahora: AHORA, origen: 'siembra', urlDelRun: 'https://x/p', punta: P });

const NODE20 = { annotation_level: 'warning', title: '', message: 'Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4, actions/upload-artifact@v4.' };
const UBUNTU = { annotation_level: 'notice', title: '', message: '"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026."' };
// job 110501932336 (run 36901626137, el control ④ de SCRUM-1339d): la tanda cortada, y el guion sin TAP.
const ANOT_TAP_CORTADO = [NODE20,
  { annotation_level: 'warning', title: 'señal de nombres · NO PUDE MEDIR', message: 'el TAP no tiene resumen (`# tests N`): la tanda no llegó al final. Esto NO es «no falta nada»: es que no se ha podido comprobar.' },
  { annotation_level: 'notice', title: 'señal de nombres · NO PUDE MEDIR', message: '[señal de nombres v1] medible=no ausentes=? ficheros_con_ausentes=? dudosos=? declarados=9547 literales=9432 no_comparables=115 ficheros=1193 tap_tests=? tap_fail=?' },
  UBUNTU];
const ANOT_SIN_TAP = [NODE20,
  { annotation_level: 'warning', title: 'señal de nombres · NO PUDE MEDIR', message: "no pude leer el TAP «/home/runner/work/_temp/no-existe.tap»: ENOENT: no such file or directory, open '/home/runner/work/_temp/no-existe.tap'" },
  UBUNTU];
// job 119327978951 (75884928b, push a main): midió y no faltó nada.
const ANOT_MIDIO_0 = [NODE20,
  { annotation_level: 'notice', title: 'señal de nombres · completo · 0 ausentes', message: '[señal de nombres v1] medible=si ausentes=0 ficheros_con_ausentes=0 dudosos=0 declarados=11998 literales=11998 no_comparables=0 ficheros=1436 tap_tests=12079 tap_fail=0' },
  UBUNTU];
// job 113113442033 (#2303): midió y faltaban 18. Eso lo tumba el obligatorio (1339t + #2663), no el vigía.
const ANOT_MIDIO_18 = [NODE20,
  { annotation_level: 'warning', title: 'señal de nombres · faltan casos', message: 'tests/scrum176-guard-mensaje.test.mjs · faltan 6 de 26 (cola) · posiciones 21–26 · líneas 179–247. La tanda no informó de ellos y salió igual.' },
  { annotation_level: 'notice', title: 'señal de nombres · FALTAN al menos 18 en 2 fichero(s)', message: '[señal de nombres v1] medible=si ausentes=18 ficheros_con_ausentes=2 dudosos=0 declarados=11005 literales=11005 no_comparables=0 ficheros=1292 tap_tests=11064 tap_fail=0' },
  UBUNTU];

/** De un comando de workflow (`::notice title=T::M`) a la anotación que deja GitHub. */
const desescapar = (s) => s.replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%0A/g, '\n').replace(/%0D/g, '\r').replace(/%25/g, '%');
const anotacionDe = (cmd) => {
  const m = /^::(notice|warning|error) title=(.*?)::(.*)$/s.exec(cmd);
  return { annotation_level: m[1] === 'error' ? 'failure' : m[1], title: desescapar(m[2]), message: desescapar(m[3]) };
};

test('SCRUM-1339u · las identidades existen: el job está en ci.yml, el título es el de la señal, y el guion escribe el aviso que se lee', () => {
  assert.ok(JOBS_DEL_CI.includes(JOB_DE_LA_SENAL), 'el job de la señal es uno de los que juzga el vigía');
  assert.match(CI_YML, new RegExp(`^\\s+name: ${JOB_DE_LA_SENAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'));
  assert.match(CI_YML, /^\s+run: node scripts\/senal-de-nombres\.mjs /m, 'la señal corre en el CI');
  assert.equal(TITULO, 'señal de nombres');
  assert.ok(GUION.includes('::warning title=${ROTULO} · NO PUDE MEDIR::'), 'el guion deja el aviso con el título que lee el vigía');
});

test('SCRUM-1339u · lo que ESCRIBE el módulo es lo que LEE el vigía: no pudo medir, midió 0 y midió con ausentes', () => {
  const poblacion = { llamadas: 10, literales: 10, noComparables: 0, ficheros: 1 };
  const base = { poblacion, tap: { tests: 10, fail: 0 }, bloques: [], dudas: [] };
  const anot = (r) => comandosDeAnotacion(r).map(anotacionDe);
  assert.deepEqual(lecturaDeLaSenal(anot({ ...base, medible: false, motivo: 'TAP cortado', tap: {}, ausentes: null, dudosos: null })), { estado: 'no-pudo', motivo: 'TAP cortado. Esto NO es «no falta nada»: es que no se ha podido comprobar.' });
  assert.deepEqual(lecturaDeLaSenal(anot({ ...base, medible: true, motivo: null, ausentes: 0, dudosos: 0 })), { estado: 'midio', ausentes: 0 });
});

test('SCRUM-1339u · las anotaciones REALES: las dos formas de «no pude medir» son CIEGO; las que midieron, no', () => {
  const cegar = (a, c = 'success') => ciegoDeLaSenal([job(JOB_DE_LA_SENAL, c, { senal: lecturaDeLaSenal(a) })]);
  assert.match(cegar(ANOT_TAP_CORTADO), /^NO PUDO MEDIR: el TAP no tiene resumen/);
  assert.match(cegar(ANOT_SIN_TAP), /^NO PUDO MEDIR: no pude leer el TAP/);
  assert.match(cegar(ANOT_TAP_CORTADO, 'failure'), /^NO PUDO MEDIR/, 'con su job en rojo, también');
  assert.equal(cegar(ANOT_MIDIO_0), null);
  assert.equal(cegar(ANOT_MIDIO_18), null, 'midió: los ausentes los tumba el obligatorio, no son un CIEGO');
  assert.deepEqual(lecturaDeLaSenal(ANOT_MIDIO_18), { estado: 'midio', ausentes: 18 });
});

test('SCRUM-1339u · la línea de registro con medible=no basta sola, aunque el aviso no llegue a anotarse', () => {
  // GitHub recorta las anotaciones por paso y por job: el aviso puede no estar y la línea sí.
  const soloRegistro = ANOT_TAP_CORTADO.filter((a) => a.annotation_level !== 'warning' || !a.title);
  assert.equal(soloRegistro.filter((a) => a.title.startsWith(TITULO)).length, 1, 'el cebo es lo que dice: sólo la línea de registro');
  assert.deepEqual(lecturaDeLaSenal(soloRegistro), { estado: 'no-pudo', motivo: 'medible=no en su línea de registro' });
});

test('SCRUM-1339u · sin línea de registro, o sin poder leer, tampoco midió; sin intentarlo (`senal` sin definir) no se juzga', () => {
  assert.match(ciegoDeLaSenal([job(JOB_DE_LA_SENAL, 'success', { senal: lecturaDeLaSenal([NODE20, UBUNTU]) })]), /no dejó una línea de registro \(deja 0\)/);
  assert.match(ciegoDeLaSenal([job(JOB_DE_LA_SENAL, 'success', { senal: null })]), /no se pudieron leer/);
  assert.equal(lecturaDeLaSenal(null), null);
  assert.equal(ciegoDeLaSenal([job(JOB_DE_LA_SENAL, 'success')]), null, 'los jueces de antes, sin lectura, siguen igual');
  // un job cancelado ya es CIEGO por su cuenta («sin probar»): no se le pega la causa de la señal
  const cancelado = juzgar(V, jobsCon([NODE20], [], 'cancelled'), 'cancelled');
  assert.equal(cancelado.estado, 'CIEGO');
  assert.equal(cancelado.causa, null);
});

test('SCRUM-1339u · SIEMBRA: la señal que no pudo medir con «guards de navegador» en rojo es CIEGO de la señal, y nombra el rojo', () => {
  const v = juzgar(V, jobsCon(ANOT_TAP_CORTADO, [job(NAVEGADOR, 'failure')]), 'failure');
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.causa, CAUSA_SENAL);
  assert.match(v.motivo, /^CIEGO de la señal de nombres: NO PUDO MEDIR/);
  assert.ok(v.motivo.includes(`además en rojo: «${NAVEGADOR}»`), v.motivo);
  // y a solas, con todo lo demás verde, también
  const solo = juzgar(V, jobsCon(ANOT_SIN_TAP));
  assert.equal(solo.estado, 'CIEGO');
  assert.equal(solo.causa, CAUSA_SENAL);
  // el control: el mismo commit con la señal que midió 0 es VERDE
  assert.equal(juzgar(V, jobsCon(ANOT_MIDIO_0)).estado, 'VERDE');
});

test('SCRUM-1339u · con el meta-guard también CIEGO, se nombran los dos y la causa es la del meta-guard', () => {
  const mg = job(JOB_META_GUARD, 'failure', { steps: [{ name: PASO_DEL_META_GUARD, conclusion: 'failure' }], codigoDeSalida: 2 });
  const v = juzgar(V, jobsCon(ANOT_SIN_TAP, [mg]), 'failure');
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.causa, CAUSA_META_GUARD);
  assert.match(v.motivo, /^CIEGO del meta-guard: .* · CIEGO de la señal de nombres: NO PUDO MEDIR/);
});

test('SCRUM-1339u · el CIEGO de la señal NO lo absuelve la punta VERDE, y tiene run', () => {
  const ciego = juzgar(V, jobsCon(ANOT_TAP_CORTADO, [job(NAVEGADOR, 'failure')]), 'failure');
  const pendiente = accionDelIssue(pasada([VERDE(P)]), { previos: marcaDeAviso(ciego), estado: 'abierto' });
  assert.deepEqual(pendiente.pasos, []);
  assert.match(pendiente.motivo, /CIEGO pendiente/);
  // el control: el mismo commit como el ROJO que era antes sí deja cerrar
  const comoRojo = { ...ciego, estado: 'ROJO', causa: null };
  assert.deepEqual(accionDelIssue(pasada([VERDE(P)]), { previos: marcaDeAviso(comoRojo), estado: 'abierto' }).pasos, ['comentar', 'cerrar']);
  assert.equal(conRun(ciego), true);
});

test('SCRUM-1339u · el suelo reconoce los cebos de la señal, y un juez que no la mira no pasa', () => {
  assert.equal(sueloPorCommit().ok, true, sueloPorCommit().detalle);
  const sinSenal = (e) => veredictoDeCommit({ ...e, jobs: Array.isArray(e.jobs) ? e.jobs.map(({ senal, ...j }) => j) : e.jobs });
  assert.equal(sueloPorCommit(sinSenal).ok, false, 'el vigía de antes (sin leer la señal) tiene que salir CIEGO del suelo');
});

// SCRUM-1339x. El paso se busca por su `run` (identidad), no por su nombre ni por su línea. Se lee el
// YAML sin las líneas de comentario —el propio paso lleva uno que cita `continue-on-error`— y sólo las
// claves PROPIAS del paso, a su sangría: un `continue-on-error` de otro paso no lo activa ni lo calla.
const RUN_DE_LA_SENAL = 'node scripts/senal-de-nombres.mjs';
const sangria = (l) => /^ */.exec(l)[0].length;
/** Las claves propias (`clave: valor`, recortadas) de cada paso cuyo `run` empieza por `comando`. */
const pasosConRun = (yml, comando) => {
  const lineas = yml.split(/\r?\n/).filter((l) => l.trim() !== '' && !/^\s*#/.test(l));
  const pasos = [];
  lineas.forEach((l, i) => {
    const m = /^( *)(- +)?run: +(.*)$/.exec(l);
    if (!m || !m[3].startsWith(`${comando} `)) return;
    const claves = m[1].length + (m[2] ? m[2].length : 0);
    let ini = i;
    while (ini >= 0 && !(/^ *- /.test(lineas[ini]) && sangria(lineas[ini]) === claves - 2)) ini--;
    if (ini < 0) return;
    let fin = ini + 1;
    while (fin < lineas.length && sangria(lineas[fin]) >= claves) fin++;
    const propias = lineas.slice(ini, fin)
      .map((x, k) => (k === 0 ? ' '.repeat(claves) + x.slice(claves) : x))
      .filter((x) => sangria(x) === claves);
    pasos.push(propias.map((x) => x.trim()));
  });
  return pasos;
};
const sinContinue = (yml) => {
  const pasos = pasosConRun(yml, RUN_DE_LA_SENAL);
  assert.equal(pasos.length, 1, `el paso de la señal tiene que estar UNA vez en ci.yml (hay ${pasos.length})`);
  assert.ok(pasos[0].some((c) => c.startsWith('run: ')), 'el paso leído es el del `run`');
  const coe = pasos[0].filter((c) => /^continue-on-error\s*:/.test(c));
  assert.deepEqual(coe, [], '🔴 el paso de la señal lleva `continue-on-error`: su rojo dejaría de bloquear el obligatorio (SCRUM-1339 c.20228)');
};

test('SCRUM-1339x · el paso de la señal NO lleva continue-on-error: su rojo tumba el obligatorio', () => {
  sinContinue(CI_YML);
  // Sembrado: el mismo ci.yml con `continue-on-error: true` dentro del paso de la señal, cae.
  const LINEA_RUN = /^( +)run: node scripts\/senal-de-nombres\.mjs .*$/m;
  assert.match(CI_YML, LINEA_RUN, 'el cebo se puede sembrar');
  const conContinue = CI_YML.replace(LINEA_RUN, (l, s) => `${s}continue-on-error: true\n${l}`);
  assert.notEqual(conContinue, CI_YML);
  assert.throws(() => sinContinue(conContinue), /lleva `continue-on-error`/);
  // y en la forma `- run:` (el paso sin nombre), también
  const enGuion = 'jobs:\n  j:\n    steps:\n      - run: node scripts/senal-de-nombres.mjs x\n        continue-on-error: true\n';
  assert.throws(() => sinContinue(enGuion), /lleva `continue-on-error`/);
  // Controles: un `continue-on-error` en el paso de AL LADO, o en un comentario del paso, no lo activa.
  const vecino = 'jobs:\n  j:\n    steps:\n      - name: otro\n        continue-on-error: true\n        run: echo x\n'
    + '      - name: señal\n        # continue-on-error: true\n        if: always()\n        run: node scripts/senal-de-nombres.mjs x\n'
    + '      - name: después\n        continue-on-error: true\n        run: echo y\n';
  sinContinue(vecino);
  // Y un ci.yml sin el paso, o con dos, no pasa por limpio.
  assert.throws(() => sinContinue(CI_YML.replace(LINEA_RUN, (l, s) => `${s}run: echo nada`)), /UNA vez/);
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin el CIEGO de la señal: la que no pudo medir, con el navegador en rojo, vuelve a ser ROJO.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: '  if (deLaSenal) {',
    a: '  if (false) {',
    cae: 'SCRUM-1339u · SIEMBRA: la señal que no pudo medir con «guards de navegador» en rojo es CIEGO de la señal',
  },
  {
    // La línea de registro con medible=no deja de contar como «no pudo»: la tanda cortada pasa por medida.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'if (aviso || registros.some((r) => !r.medible)) return',
    a: 'if (aviso) return',
    cae: 'SCRUM-1339u · la línea de registro con medible=no basta sola',
  },
  {
    // SCRUM-1339x: vuelve el `continue-on-error` al paso de la señal y su rojo deja de bloquear.
    fichero: '.github/workflows/ci.yml',
    de: '        run: node scripts/senal-de-nombres.mjs "${{ runner.temp }}/tanda.tap"\n',
    a: '        continue-on-error: true\n        run: node scripts/senal-de-nombres.mjs "${{ runner.temp }}/tanda.tap"\n',
    cae: 'SCRUM-1339x · el paso de la señal NO lleva continue-on-error',
  },
];

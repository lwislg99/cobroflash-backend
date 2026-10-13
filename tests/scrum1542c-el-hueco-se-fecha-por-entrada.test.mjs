// tests/scrum1542c-el-hueco-se-fecha-por-entrada.test.mjs — SCRUM-1542
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL VIGÍA DEL DESPLIEGUE: LA CIFRA, EL RITMO Y EL AVISO QUE NO HABÍA SONADO NUNCA
//
// Medido por el equipo de Javier el 13-oct-2026 (`docs/master/SCRUM-1542.md`), tres cosas:
//
//   ① LA CIFRA. El hueco se fechaba con el commit más viejo de TODO `prod..main`, que es la fecha
//      en que se ESCRIBIÓ el commit más viejo de la rama recién mergeada. Dijo «95,8 h» con
//      producción 59 segundos por detrás. Ahora se fecha por la cadena de PRIMER PADRE: cuándo
//      ENTRÓ en `main`.
//   ② EL RITMO. Comparaba la producción de ahora con una lectura anterior de la que sólo leía
//      `prod=`: ni su hora ni su `main`. No sabía si el hueco de hoy existía ya entonces.
//   ③ EL AVISO. El Issue de SCRUM-1123 no había disparado ni una vez. Aquí va lo que se puede
//      probar sin GitHub: el simulacro fabrica una producción congelada y el vigía de verdad
//      CANTA sobre ella. Que el Issue se abra de verdad no lo prueba ningún test: se vio en vivo,
//      y dónde, en el registro.
//
// 🔴 LOS CASOS DE PUNTA A PUNTA CORREN EL CLI DE VERDAD contra un repo de usar y tirar que tiene
// un MERGE (rama con commits viejos, merge reciente): es la única forma de que el defecto ① exista
// en el fixture. Un repo lineal no lo reproduce, porque ahí «todo el rango» y «primer padre» son
// lo mismo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs';
import {
  veredictoDeDespliegue, constanciaDeEjecucion, epochsDeGitLog, MARGEN_HORAS_PROPUESTO,
} from '../scripts/_vigilante-de-despliegue.mjs';
import {
  ritmoDeDespliegue, salidaConRitmo, lecturaDeLaConstancia,
  DESPLIEGA, CONGELADO, NO_SE_SABE, HOLGURA_DE_LECTURA_S,
} from '../scripts/_ritmo-de-despliegue.mjs';
import {
  componerCuerpo, decidirAviso, AVISO_DE_SIMULACRO, TITULO_DEL_AVISO, TITULO_DEL_SIMULACRO,
} from '../scripts/vigia-despliegue-aviso.mjs';
import {
  elegirProduccionFabricada, urlFabricada, veredictoDelSimulacro, COLCHON_HORAS,
} from '../scripts/equipo/simulacro-del-vigia.mjs';
import {
  veredictoDelVigiaDeDespliegue, TITULO_DE_CORRIDA_DE_SIMULACRO, MARCA_DE_CONGELADA,
  PASO_QUE_MIRA, PASO_QUE_AVISA,
} from '../scripts/equipo/latido.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'vigilante-de-despliegue.mjs');
const SIMULACRO = path.join(RAIZ, 'scripts', 'equipo', 'simulacro-del-vigia.mjs');
const YAML = path.join(RAIZ, '.github', 'workflows', 'vigia-despliegue.yml');

// ═══ EL BANCO: un repo con un MERGE, y el vigía de verdad corriendo sobre él ═══════════════

/**
 * Un repo de usar y tirar con la forma del 13-oct: `base` (lo desplegado), una rama con un commit
 * ESCRITO hace `horasRama` horas, y su merge en la principal fechado hace `segundosMerge` segundos.
 * `origin/main` queda en el merge. Las fechas llevan huso (`toISOString` acaba en Z).
 */
function repoConMerge({ horasRama, segundosMerge }) {
  const dir = temporal('scrum1542c-');
  const ahora = Date.now();
  const hace = (segundos) => {
    const iso = new Date(ahora - segundos * 1000).toISOString();
    return { GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso };
  };
  const { g, fechado } = gitEn(dir);
  g('init', '-q');
  g('config', 'user.email', 'v@test.local');
  g('config', 'user.name', 'vigia');
  fechado(hace(400 * 3600), 'commit', '--allow-empty', '-q', '-m', 'base: lo que está desplegado');
  const base = g('rev-parse', 'HEAD');
  const principal = g('symbolic-ref', '--short', 'HEAD');
  g('checkout', '-q', '-b', 'rama-vieja');
  fechado(hace(horasRama * 3600), 'commit', '--allow-empty', '-q', '-m', 'escrito hace días, dentro de la rama');
  g('checkout', '-q', principal);
  fechado(hace(segundosMerge), 'merge', '--no-ff', '-q', '-m', 'Merge pull request #1 from rama-vieja', 'rama-vieja');
  const main = g('rev-parse', 'HEAD');
  g('update-ref', 'refs/remotes/origin/main', main);
  return { dir, base, main, g };
}

/** git dentro de `dir`: `g(...)` a secas, y `fechado(fechas, ...)` para un commit con su fecha puesta. */
function gitEn(dir) {
  const corre = (a, env) => String(execFileSync('git', a, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } })).trim();
  return { g: (...a) => corre(a, {}), fechado: (fechas, ...a) => corre(a, fechas) };
}

/**
 * El entorno del SUJETO se construye a mano, no se le presta el del laboratorio (A21): sólo lo
 * que hace falta para encontrar `git` y un temporal, más lo que cada caso le dé. Así el vigía que
 * se prueba aquí no hereda nada del job que corre la tanda —ni su resumen, ni sus anotaciones, ni
 * el color del chat— y este fichero no tiene que nombrar ninguna de esas señales para apagarlas.
 */
const LO_QUE_HEREDA_EL_SUJETO = ['PATH', 'Path', 'SystemRoot', 'windir', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE'];
function entornoDelSujeto(extra = {}) {
  const env = {};
  for (const k of LO_QUE_HEREDA_EL_SUJETO) if (process.env[k] !== undefined) env[k] = process.env[k];
  return { ...env, ...extra };
}

/**
 * El vigía DE VERDAD, como proceso. La URL viaja por el ENTORNO (`VIGIA_URL`), no por el `argv`:
 * es la forma que pide el guard de SCRUM-226, y la misma por la que la pasa el simulacro.
 * Devuelve el código, la salida entera y el renglón de constancia.
 */
function correElVigia({ cwd, sha, estado }) {
  const r = spawnSync(process.execPath, [CLI], {
    cwd, encoding: 'utf8',
    env: entornoDelSujeto({ VIGIA_URL: urlFabricada(sha), VIGIA_ESTADO: estado || '' }),
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const renglon = salida.split('\n').find((l) => l.startsWith('vigía · ')) || '';
  return { codigo: r.status, salida, renglon };
}

// ═══ ① LA CIFRA ══════════════════════════════════════════════════════════════════════════

test('SCRUM-1542 · 🔴 SUELO: en el repo del banco, «todo el rango» y «primer padre» dan huecos DISTINTOS', () => {
  // Sin esto, los dos casos de abajo podrían pasar sobre un repo donde las dos formas coinciden,
  // y «el vigía dice 0,0 h» no probaría el arreglo: lo diría también el código viejo.
  const r = repoConMerge({ horasRama: 96, segundosMerge: 59 });
  const todo = epochsDeGitLog(r.g('log', '--format=%ct', `${r.base}..${r.main}`));
  const primerPadre = epochsDeGitLog(r.g('log', '--first-parent', '--format=%ct', `${r.base}..${r.main}`));
  assert.equal(todo.length, 2, `🔴 el rango entero debería traer 2 commits (el de la rama y el merge) y trae ${todo.length}`);
  assert.equal(primerPadre.length, 1, `🔴 la cadena de primer padre debería traer 1 (el merge) y trae ${primerPadre.length}`);
  const horasDeMas = (Math.min(...primerPadre) - Math.min(...todo)) / 3600;
  assert.ok(horasDeMas > 90,
    `🔴 CIEGO: entre las dos formas sólo hay ${horasDeMas.toFixed(1)} h. Hace falta que la diferencia `
    + `pase holgadamente del margen del vigía (${MARGEN_HORAS_PROPUESTO} h), o el defecto no cambiaría ningún veredicto.`);
});

test('SCRUM-1542 · 🔴 EL CASO DEL 13-oct: una rama escrita hace 96 h y mergeada hace 59 s es un hueco de 0,0 h, no de 96', () => {
  const r = repoConMerge({ horasRama: 96, segundosMerge: 59 });
  const p = correElVigia({ cwd: r.dir, sha: r.base });
  assert.ok(p.renglon, '🔴 CIEGO: el vigía no dejó su renglón de constancia.\n' + p.salida);
  assert.match(p.renglon, / · al-dia · /,
    '🔴 el vigía vuelve a fechar el hueco con el commit más viejo de la RAMA: producción va 59 '
    + 'segundos por detrás y no dice «al día».\n' + p.renglon);
  assert.match(p.renglon, / · hueco=0\.0h · commits=2$/,
    '🔴 la cifra no es la de la ENTRADA en `main` (59 s → 0,0 h). Si aquí pone 96, es la fecha en '
    + 'que se escribió el commit de la rama.\n' + p.renglon);
  assert.equal(p.codigo, 0, '🔴 un hueco de 59 segundos no puede salir con código ' + p.codigo + '.\n' + p.salida);
  assert.match(p.salida, /ESTA LECTURA NO ES DE PRODUCCIÓN/,
    '🔴 el vigía ha leído una «producción» que no es yaqu.app y no lo dice en su salida.');
});

test('SCRUM-1542 · 🔴 Y SIGUE CANTANDO: mergeado hace 9 h y sin llegar es CONGELADA con 9,0 h — la hora de entrada, no las 96 de la rama', () => {
  // El control que protege la alarma: fechar por primer padre no puede dejarla muda. Es el caso
  // de septiembre, donde el vigía dijo 177 → 193 h y el hueco real era de 6,5 → 22,6 h.
  const r = repoConMerge({ horasRama: 96, segundosMerge: 9 * 3600 });
  const estado = path.join(r.dir, '.vigia', 'constancias.log');
  const p1 = correElVigia({ cwd: r.dir, sha: r.base, estado });
  assert.equal(p1.codigo, 2, '🔴 la primera pasada (con hueco y sin lectura anterior) tenía que salir 2.\n' + p1.salida);
  assert.match(p1.renglon, / · atrasado · .* · hueco=9\.0h · commits=2$/,
    '🔴 9 h en `main` sin llegar tienen que ser «atrasado» con 9,0 h.\n' + p1.renglon);
  const p2 = correElVigia({ cwd: r.dir, sha: r.base, estado });
  assert.equal(p2.codigo, 1,
    '🔴 producción quieta entre dos lecturas con 9 h de hueco REAL tiene que cantar (salida 1).\n' + p2.salida);
  assert.match(p2.salida, /PRODUCCIÓN CONGELADA/);
  assert.match(p2.salida, /en 1 entrada\(s\) a `main`/,
    '🔴 no dice cuántas ENTRADAS hay detrás de los commits: «20 commits» eran 2 merges el 13-oct.');
  assert.doesNotMatch(p2.salida, /96\.\d h/, '🔴 la cifra de la rama (96 h) ha vuelto a la salida.');
});

test('SCRUM-1542 · una salida de `git log` vacía o ilegible NO es el año 1970', () => {
  assert.deepEqual(epochsDeGitLog('1760000000\n1760000100\n'), [1760000000, 1760000100]);
  assert.deepEqual(epochsDeGitLog(' 1760000000 \r\n\r\n'), [1760000000]);
  for (const nada of ['', '\n', null, undefined, 'fatal: bad revision', '-5', '1.5e9']) {
    assert.deepEqual(epochsDeGitLog(nada), [],
      `🔴 de ${JSON.stringify(nada)} ha salido un epoch. Una línea vacía daba 0, y con 0 el hueco eran 56 años.`);
  }
  // Y lo que hace el vigía con «ninguno»: ciego, no un número.
  const v = veredictoDeDespliegue({
    versionDeProduccion: 'a'.repeat(40), shaDeMain: 'b'.repeat(40), conoceElCommit: true, estaEnMain: true,
    commitsPorDelante: 3, epochDelPrimeroSinDesplegar: null, ahoraEpoch: 1760000000,
  });
  assert.equal(v.veredicto, 'no-supe-mirar');
  assert.equal(v.salida, 2);
});

// ═══ ② EL RITMO ══════════════════════════════════════════════════════════════════════════

const AHORA = Math.trunc(Date.parse('2026-10-13T11:38:12Z') / 1000);
const hace = (horas) => AHORA - Math.round(horas * 3600);
const PROD_A = '9358f02b14f474d0fb4095cb0643e069388e4935';
const PROD_B = '38de705e7c0f7ddcf8a0670ab54c46407a7bba9d';
const MAIN_VIEJO = '388dc0454f9e8a1b2c3d4e5f60718293a4b5c6d7';
const MAIN_NUEVO = 'f7a4c8166f9e8a1b2c3d4e5f60718293a4b5c6d7';
/** Una lectura anterior: producción, `main` y la hora, como las deja `lecturaDeLaConstancia`. */
const antes = (versionDeProduccion, shaDeMain, epoch) => ({ versionDeProduccion, shaDeMain, epoch });
const ahora = (versionDeProduccion, epochDelPrimeroSinDesplegar) => ({ versionDeProduccion, epochDelPrimeroSinDesplegar });
/** El veredicto REAL del vigía para un hueco que se abrió en `e`, sin reimplementarlo. */
const atrasado = (prod, e) => veredictoDeDespliegue({
  versionDeProduccion: prod, shaDeMain: MAIN_NUEVO, conoceElCommit: true, estaEnMain: true,
  commitsPorDelante: 5, epochDelPrimeroSinDesplegar: e, ahoraEpoch: AHORA,
});

test('SCRUM-1542 · 🔴 la lectura anterior trae TAMBIÉN su hora y su `main`, sacados de un renglón de verdad', () => {
  const datos = {
    versionDeProduccion: PROD_A, shaDeMain: MAIN_VIEJO, conoceElCommit: true, estaEnMain: true,
    commitsPorDelante: 4, epochDelPrimeroSinDesplegar: hace(9), ahoraEpoch: hace(3),
  };
  // El renglón NO se escribe aquí: se le pide a quien lo produce.
  const { renglon } = constanciaDeEjecucion(veredictoDeDespliegue(datos), datos);
  const l = lecturaDeLaConstancia(renglon);
  assert.ok(l, '🔴 no se puede leer el renglón que escribe el vigía: ' + renglon);
  assert.ok(PROD_A.startsWith(l.versionDeProduccion));
  assert.ok(l.shaDeMain && MAIN_VIEJO.startsWith(l.shaDeMain),
    `🔴 la lectura no trae el \`main\` de entonces (${l.shaDeMain}): sin él no se puede saber si aquella lectura vio hueco.`);
  assert.equal(l.epoch, hace(3),
    `🔴 la lectura no trae su HORA (${l.epoch}): sin ella no se sabe si el hueco de hoy existía ya.`);
  // Lo que falta viaja como «no lo sé», y sigue siendo una lectura de producción.
  assert.deepEqual(lecturaDeLaConstancia('algo · prod=9358f02b · sin más'),
    { versionDeProduccion: '9358f02b', shaDeMain: null, epoch: null });
  assert.deepEqual(lecturaDeLaConstancia('vigía · 2026-10-13T08:37:00Z · atrasado · prod=9358f02b · main=? · hueco=? · commits=?'),
    { versionDeProduccion: '9358f02b', shaDeMain: null, epoch: Math.trunc(Date.parse('2026-10-13T08:37:00Z') / 1000) });
});

test('SCRUM-1542 · 🔴 producción cambió, pero el hueco se abrió DESPUÉS de la lectura anterior: NO SE SABE (antes salía VERDE)', () => {
  // La parada real que empieza justo después de un despliegue: la lectura anterior es de hace 8 h
  // (producción en A); después producción pasa a B, y hace 7 h entra algo que ya no llega.
  const e = hace(7);
  const r = ritmoDeDespliegue(antes(PROD_A, MAIN_VIEJO, hace(8)), ahora(PROD_B, e));
  assert.equal(r.ritmo, NO_SE_SABE,
    `🔴 el ritmo dice «${r.ritmo}». Producción cambió entre las dos lecturas, pero el hueco de ahora `
    + 'se abrió después de la primera: ese cambio pudo ocurrir antes, y no dice que se esté cerrando.');
  assert.match(r.motivo, /DESPUÉS de la lectura anterior/);
  const f = salidaConRitmo(atrasado(PROD_B, e), r);
  assert.equal(f.salida, 2,
    `🔴 sale con ${f.salida}. Con 7 h de hueco y sin saber si se cierra, ni es verde (0) ni está medido que esté congelada (1).`);
});

test('SCRUM-1542 · ✅ el 6-sep sigue sin bloquear: el hueco YA ESTABA en la lectura anterior y producción se movió → DESPLIEGA', () => {
  // El control negativo del caso de arriba: no todo cambio de producción se vuelve «no sé».
  const e = hace(10.4);
  const r = ritmoDeDespliegue(antes(PROD_A, MAIN_VIEJO, hace(2)), ahora(PROD_B, e));
  assert.equal(r.ritmo, DESPLIEGA, `🔴 el hueco existía hace 2 h y producción se ha movido desde entonces: es «despliega», no «${r.ritmo}».`);
  assert.equal(salidaConRitmo(atrasado(PROD_B, e), r).salida, 0);
});

test('SCRUM-1542 · 🔴 CONGELADO no espera un ciclo: producción quieta canta aunque el hueco se abriera después de la lectura anterior', () => {
  // Deliberado, y es la desviación declarada sobre la propuesta medida: exigir que el hueco
  // existiera ya en la lectura anterior retrasaría el aviso de una parada real una pasada entera
  // (mediana 6,2 h entre dos, máximo 11,3 h).
  const e = hace(7);
  for (const t0 of [hace(8), hace(2)]) {
    const r = ritmoDeDespliegue(antes(PROD_A, MAIN_VIEJO, t0), ahora(PROD_A, e));
    assert.equal(r.ritmo, CONGELADO, `🔴 producción no se ha movido y hay 7 h de hueco: «${r.ritmo}».`);
    assert.equal(salidaConRitmo(atrasado(PROD_A, e), r).salida, 1);
  }
  // También cuando la anterior no vio hueco y el de ahora se abrió justo después de ella.
  const alDia = ritmoDeDespliegue(antes(PROD_A, PROD_A, hace(8)), ahora(PROD_A, e));
  assert.equal(alDia.ritmo, CONGELADO);
});

test('SCRUM-1542 · 🔴 dos lecturas que se CONTRADICEN no cantan ni callan: la anterior no vio hueco y el de ahora dice venir de antes', () => {
  // Es la forma exacta de la cifra inflada. 13-oct 11:38Z: la lectura de las 08:37Z; el vigía
  // fechó el hueco el 9-oct 11:51Z (95,8 h) y salió VERDE por «producción ha cambiado».
  const las0837 = Math.trunc(Date.parse('2026-10-13T08:37:00Z') / 1000);
  const inflado = Math.trunc(Date.parse('2026-10-09T11:51:00Z') / 1000);
  const verde = ritmoDeDespliegue(antes(PROD_A, PROD_A, las0837), ahora(PROD_B, inflado));
  assert.equal(verde.ritmo, NO_SE_SABE,
    `🔴 el 13-oct vuelve a salir «${verde.ritmo}». La lectura de las 08:37Z vio producción y \`main\` en el `
    + 'mismo commit, y el hueco dice venir del 9-oct: una de las dos mide mal.');
  assert.match(verde.motivo, /se CONTRADICEN/);
  assert.equal(salidaConRitmo(atrasado(PROD_B, inflado), verde).salida, 2);
  // Y la falsa alarma del 7-oct (dijo «CONGELADA, 10,1 h» con 15 s de hueco real): misma forma,
  // con producción quieta. Tampoco canta sobre una cifra que no cuadra.
  const falsaAlarma = ritmoDeDespliegue(antes(PROD_A, PROD_A, hace(4)), ahora(PROD_A, hace(10.1)));
  assert.equal(falsaAlarma.ritmo, NO_SE_SABE, `🔴 la falsa alarma del 7-oct vuelve a salir «${falsaAlarma.ritmo}».`);
  assert.match(falsaAlarma.motivo, /se CONTRADICEN/);
  // ✅ SUELO: con la cifra BUENA del 13-oct (entró a las 11:37:13Z, 59 s) no hay nada que calificar.
  const real = atrasado(PROD_B, AHORA - 59);
  assert.equal(real.veredicto, 'al-dia');
  assert.equal(salidaConRitmo(real, ritmoDeDespliegue(antes(PROD_A, PROD_A, las0837), ahora(PROD_B, AHORA - 59))).salida, 0);
});

test('SCRUM-1542 · la holgura: un merge que cae entre el `fetch` y la hora de la lectura anterior no es una contradicción', () => {
  // La anterior dice «sin hueco» con una hora 30 s POSTERIOR a la entrada del merge: es el
  // desfase normal del job, no una cifra que no cuadra. Producción quieta 7 h después: canta.
  const t0 = hace(7) + 30;
  const quieta = ritmoDeDespliegue(antes(PROD_A, PROD_A, t0), ahora(PROD_A, hace(7)));
  assert.equal(quieta.ritmo, CONGELADO, `🔴 30 s de desfase se han leído como contradicción: «${quieta.ritmo}».`);
  // Con producción movida, en cambio, no se sabe: la anterior no vio el hueco.
  const movida = ritmoDeDespliegue(antes(PROD_A, PROD_A, t0), ahora(PROD_B, hace(7)));
  assert.equal(movida.ritmo, NO_SE_SABE);
  assert.doesNotMatch(movida.motivo, /se CONTRADICEN/);
  // ✅ SUELO: pasada la holgura SÍ es contradicción (si no, la holgura lo taparía todo).
  const lejos = ritmoDeDespliegue(antes(PROD_A, PROD_A, hace(7) + HOLGURA_DE_LECTURA_S + 60), ahora(PROD_A, hace(7)));
  assert.match(lejos.motivo, /se CONTRADICEN/);
});

test('SCRUM-1542 · una lectura anterior SIN hora no sirve para decir «despliega» sobre un hueco fechado', () => {
  const r = ritmoDeDespliegue(antes(PROD_A, MAIN_VIEJO, null), ahora(PROD_B, hace(7)));
  assert.equal(r.ritmo, NO_SE_SABE);
  assert.match(r.motivo, /no trae su hora/);
  // Quieta sí: que producción no se ha movido no depende de cuándo fue la lectura.
  assert.equal(ritmoDeDespliegue(antes(PROD_A, MAIN_VIEJO, null), ahora(PROD_A, hace(7))).ritmo, CONGELADO);
  // ✅ Y sin hueco fechado, la pregunta de siempre tiene la respuesta de siempre.
  assert.equal(ritmoDeDespliegue({ versionDeProduccion: PROD_A }, { versionDeProduccion: PROD_B }).ritmo, DESPLIEGA);
  assert.equal(ritmoDeDespliegue({ versionDeProduccion: PROD_A }, { versionDeProduccion: PROD_A }).ritmo, CONGELADO);
});

// ═══ ③ EL AVISO Y SU SIMULACRO ═══════════════════════════════════════════════════════════

test('SCRUM-1542 · el aviso de un simulacro lo dice LO PRIMERO, en el cuerpo y en el título, y sigue llevando la marca', () => {
  const e = { renglon: 'vigía · x', runUrl: 'https://x/run/1', marca: MARCA_DE_CONGELADA };
  const real = componerCuerpo(e);
  const simulado = componerCuerpo({ ...e, simulacro: true });
  assert.ok(simulado.startsWith(AVISO_DE_SIMULACRO), '🔴 el cuerpo del simulacro no empieza diciendo que lo es.');
  assert.equal(simulado.slice(AVISO_DE_SIMULACRO.length), real,
    '🔴 el simulacro no lleva debajo el aviso TAL CUAL: entonces no comprueba el aviso, comprueba otro texto.');
  assert.ok(simulado.trim().endsWith(MARCA_DE_CONGELADA));
  assert.doesNotMatch(real, /SIMULACRO/, '🔴 un aviso de verdad dice que es un simulacro.');
  assert.match(AVISO_DE_SIMULACRO, /PRODUCCIÓN NO ESTÁ CONGELADA/);
  assert.equal(decidirAviso({ ...e, issues: [] }).titulo, TITULO_DEL_AVISO);
  assert.equal(decidirAviso({ ...e, issues: [], simulacro: true }).titulo, TITULO_DEL_SIMULACRO);
  assert.ok(TITULO_DEL_SIMULACRO.startsWith('🧪 SIMULACRO'), '🔴 el asunto del correo no empieza por SIMULACRO.');
  assert.notEqual(TITULO_DEL_SIMULACRO, TITULO_DEL_AVISO);
  // La cifra que el aviso contaba como historia era la inflada: 193 h / 24 ≈ 8 días.
  assert.doesNotMatch(real, /8 días/, '🔴 el aviso vuelve a decir «8 días»: fueron 24,5 h sin un despliegue bueno.');
  assert.match(real, /24,5 h sin un despliegue bueno/);
});

test('SCRUM-1542 · el CLI del aviso sólo hace simulacro con `VIGIA_SIMULACRO=true`, que es lo que le da el workflow', () => {
  const corre = (valor) => JSON.parse(spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'vigia-despliegue-aviso.mjs')], {
    encoding: 'utf8',
    env: entornoDelSujeto({ VIGIA_ISSUES_JSON: '[]', VIGIA_MARCA: MARCA_DE_CONGELADA, VIGIA_RENGLON: 'r', VIGIA_RUN_URL: 'u', VIGIA_SIMULACRO: valor }),
  }).stdout);
  assert.equal(corre('true').titulo, TITULO_DEL_SIMULACRO);
  for (const no of ['', 'false', '1', 'TRUE']) {
    assert.equal(corre(no).titulo, TITULO_DEL_AVISO, `🔴 con VIGIA_SIMULACRO=${JSON.stringify(no)} el aviso sale como simulacro.`);
  }
});

test('SCRUM-1542 · 🔴 la producción fabricada deja un hueco que pasa del margen POR POCO, no uno de hace un mes', () => {
  const e = (sha, horas, padre) => ({ sha: sha.repeat(40), epoch: hace(horas), padre: padre === null ? null : padre.repeat(40) });
  // De la más nueva a la más vieja. 6,2 h pasa del margen (6) pero no del colchón (6,5).
  const entradas = [e('1', 1, '2'), e('2', 3, '3'), e('3', 6.2, '4'), e('4', 7, '5'), e('5', 30, '6'), e('6', 700, '7')];
  const r = elegirProduccionFabricada({ entradas, ahoraEpoch: AHORA });
  assert.equal(r.primeraPendiente, '4'.repeat(40),
    `🔴 se ha elegido ${String(r.primeraPendiente).slice(0, 4)}… y la entrada más NUEVA que pasa de ${MARGEN_HORAS_PROPUESTO + COLCHON_HORAS} h es la de 7 h.`);
  assert.equal(r.produccion, '5'.repeat(40), '🔴 producción se fabrica en el PADRE de esa entrada, para que ella sea lo primero sin desplegar.');
  assert.equal(r.horas.toFixed(1), '7.0');
  // Lo que no se puede fabricar se dice, no se inventa.
  assert.match(elegirProduccionFabricada({ entradas: [], ahoraEpoch: AHORA }).ciego, /ninguna entrada/);
  assert.match(elegirProduccionFabricada({ entradas: entradas.slice(0, 3), ahoraEpoch: AHORA }).ciego, /ninguna de las 3 entradas/);
  assert.match(elegirProduccionFabricada({ entradas: [e('9', 50, null)], ahoraEpoch: AHORA }).ciego, /no tiene padre legible/);
  assert.match(elegirProduccionFabricada({ entradas, ahoraEpoch: NaN }).ciego, /no hay hora/);
});

test('SCRUM-1542 · 🔴 DE PUNTA A PUNTA: el simulacro siembra, y el vigía de verdad CANTA sobre la producción fabricada', async () => {
  // Un `main` de cinco entradas, de 40 h a 1 h. Lineal a propósito: aquí lo que se prueba es la
  // cadena siembra → segunda lectura → CONGELADA, no la forma del grafo (eso es el bloque ①).
  const dir = temporal('scrum1542c-sim-');
  const { g, fechado } = gitEn(dir);
  g('init', '-q'); g('config', 'user.email', 'v@test.local'); g('config', 'user.name', 'vigia');
  const base = Date.now();
  for (const horas of [40, 20, 8, 3, 1]) {
    const iso = new Date(base - horas * 3600 * 1000).toISOString();
    fechado({ GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso }, 'commit', '--allow-empty', '-q', '-m', `entrada-${horas}h`);
  }
  g('update-ref', 'refs/remotes/origin/main', g('rev-parse', 'HEAD'));
  const shaDe = (asunto) => g('log', '--format=%H', '--fixed-strings', '--grep', asunto, '-n', '1');
  const estado = path.join(dir, '.vigia', 'constancias.log');
  const salidaDeActions = path.join(dir, 'salida-del-paso.txt');
  const entorno = entornoDelSujeto({ VIGIA_ESTADO: estado, GITHUB_OUTPUT: salidaDeActions });

  const s = spawnSync(process.execPath, [SIMULACRO], { cwd: dir, encoding: 'utf8', env: entorno });
  assert.equal(s.status, 0, '🔴 el simulacro no pudo fabricarse.\n' + s.stdout + s.stderr);
  const url = (/^url=(.+)$/m.exec(fs.readFileSync(salidaDeActions, 'utf8')) || [])[1];
  assert.ok(url && url.startsWith('data:application/json,'), '🔴 el simulacro no dejó la URL fabricada como salida del paso.');
  // La «producción» fabricada es el PADRE de la entrada de 8 h (la más nueva que pasa de 6,5 h).
  const fabricada = (await (await fetch(url)).json()).version;
  assert.equal(fabricada, shaDe('entrada-20h'),
    '🔴 la producción fabricada no es el padre de la entrada de 8 h: el hueco no sería el que se cree.');
  assert.equal(fs.readFileSync(estado, 'utf8').trim().split('\n').length, 1, '🔴 la siembra no dejó exactamente UN renglón.');

  // La segunda lectura es la del paso normal del workflow: el mismo CLI, sin saber que es un simulacro.
  const p = correElVigia({ cwd: dir, sha: fabricada, estado });
  assert.equal(p.codigo, 1, '🔴 sobre la producción fabricada el vigía NO canta: el paso de aviso no llegaría a correr.\n' + p.salida);
  assert.match(p.salida, /PRODUCCIÓN CONGELADA/);
  assert.match(p.renglon, / · atrasado · .* · hueco=8\.0h · commits=3$/, p.renglon);

  // 🔴 Y no se siembra dos veces ni sobre un historial que ya existe (el del vigía de verdad).
  const otra = spawnSync(process.execPath, [SIMULACRO], { cwd: dir, encoding: 'utf8', env: entorno });
  assert.equal(otra.status, 2, '🔴 el simulacro ha sembrado sobre un historial que ya existía.');
  assert.match(otra.stderr, /sólo corre sobre un historial VACÍO/);
  const sinEstado = spawnSync(process.execPath, [SIMULACRO], { cwd: dir, encoding: 'utf8', env: { ...entorno, VIGIA_ESTADO: '' } });
  assert.equal(sinEstado.status, 2);
});

test('SCRUM-1542 · «¿sonó?» se decide sobre el Issue LEÍDO DE VUELTA, y sólo se cierra lo que el simulacro abrió', () => {
  const issue = (title, body = `texto\n\n${MARCA_DE_CONGELADA}\n`) => ({ number: 7, title, body });
  const base = { salida: '1', accion: 'crear', numero: '7', issue: issue(TITULO_DEL_SIMULACRO), marca: MARCA_DE_CONGELADA, runUrl: 'https://x/run/9' };
  const ok = veredictoDelSimulacro(base);
  assert.equal(ok.sono, true);
  assert.equal(ok.cerrar, true);
  assert.match(ok.resumen, /EL AVISO SUENA.*ABRIÓ el Issue #7/);
  assert.match(ok.comentario, /Producción NO estuvo congelada[\s\S]*https:\/\/x\/run\/9/);
  // Comentó en uno que YA estaba abierto: sonó, pero ése puede ser un aviso de verdad. No se cierra.
  const comento = veredictoDelSimulacro({ ...base, accion: 'comentar', issue: issue(TITULO_DEL_AVISO) });
  assert.equal(comento.sono, true);
  assert.equal(comento.cerrar, false, '🔴 el simulacro cerraría un Issue que no abrió él.');
  assert.equal(veredictoDelSimulacro({ ...base, issue: issue(TITULO_DEL_AVISO) }).cerrar, false);
  // Todo lo que NO es haber sonado, dicho cada uno con su motivo.
  const noSono = {
    'el vigía no cantó': [{ ...base, salida: '2' }, /código «2»/],
    'el vigía no dio código': [{ ...base, salida: '' }, /código «ninguno»/],
    'el paso de aviso no dijo qué hizo': [{ ...base, accion: '' }, /no dejó dicho qué hizo/],
    'sin número de Issue': [{ ...base, numero: '' }, /no dio el número/],
    'GitHub no devuelve el Issue': [{ ...base, issue: null }, /GitHub no lo devuelve/],
    'el Issue no lleva la marca': [{ ...base, issue: issue(TITULO_DEL_SIMULACRO, 'otro cuerpo') }, /no lleva la marca/],
    'no hay marca con la que comprobar': [{ ...base, marca: '' }, /no lleva la marca/],
  };
  for (const [caso, [entrada, motivo]] of Object.entries(noSono)) {
    const v = veredictoDelSimulacro(entrada);
    assert.equal(v.sono, false, `🔴 «${caso}» se ha dado por sonado.`);
    assert.equal(v.cerrar, false);
    assert.match(v.resumen, /EL SIMULACRO NO SONÓ/);
    assert.match(v.resumen, motivo, `🔴 «${caso}» no dice por qué: ${v.resumen}`);
  }
});

// ═══ ④ EL WORKFLOW Y EL LATIDO ═══════════════════════════════════════════════════════════

/** Sólo lo ejecutable del YAML: sus comentarios EXPLICAN el simulacro nombrando sus piezas. */
const soloYaml = (t) => t.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
/** El trozo de un paso: de su `- name:` al siguiente. */
function paso(yaml, nombre) {
  const i = yaml.indexOf(`- name: ${nombre}`);
  assert.ok(i !== -1, `🔴 CIEGO: no hay ningún paso que se llame «${nombre}».`);
  const fin = yaml.indexOf('\n      - name:', i + 10);
  return yaml.slice(i, fin === -1 ? undefined : fin);
}

test('SCRUM-1542 · 🔴 el simulacro pasa por los MISMOS pasos, no toca la memoria del vigía y se recoge', () => {
  const yaml = soloYaml(fs.readFileSync(YAML, 'utf8'));
  assert.ok(yaml.length > 1500, `🔴 CIEGO: el workflow sin comentarios tiene ${yaml.length} caracteres.`);
  assert.match(yaml, /^\s{6}simulacro:\s*\n(?:\s{8}.*\n)*?\s{8}type:\s*boolean\s*$/m, '🔴 no hay casilla `simulacro` (booleana) para lanzarlo a mano.');

  // La memoria: ni se recupera ni se guarda. Una lectura fabricada en la caché callaría un hueco real.
  assert.match(paso(yaml, 'Recuperar la constancia de la ejecución anterior'), /^\s*if:\s*\$\{\{ !inputs\.simulacro \}\}\s*$/m,
    '🔴 el simulacro RECUPERA la caché: compararía su producción fabricada con una lectura de verdad.');
  assert.match(paso(yaml, 'Guardar la constancia de ESTA ejecución (también si el vigía canta)'), /^\s*if:\s*always\(\) && !inputs\.simulacro\s*$/m,
    '🔴 el simulacro GUARDA su lectura: la siguiente pasada de verdad la tomaría por la anterior.');

  // La fabricación sólo corre en simulacro, y el paso que mira recibe de ella la URL por el entorno.
  const fabrica = paso(yaml, 'SIMULACRO · fabricar una producción congelada (no toca la de verdad)');
  assert.match(fabrica, /^\s*if:\s*\$\{\{ inputs\.simulacro \}\}\s*$/m);
  assert.match(fabrica, /^\s*id:\s*simulacro\s*$/m);
  assert.match(fabrica, /node scripts\/equipo\/simulacro-del-vigia\.mjs\s*$/m);
  const mira = paso(yaml, PASO_QUE_MIRA);
  assert.match(mira, /^\s*VIGIA_URL:\s*\$\{\{ steps\.simulacro\.outputs\.url \}\}\s*$/m,
    '🔴 el paso que mira no recibe la producción fabricada: el simulacro leería yaqu.app y no sonaría nunca.');
  assert.doesNotMatch(mira, /simulacro-del-vigia|inputs\.simulacro/,
    '🔴 el paso que mira tiene una rama propia para el simulacro: entonces lo que se comprueba no es el paso de verdad.');

  // El aviso: mismo paso, sin título escrito aquí, y deja dicho qué hizo.
  const avisa = paso(yaml, PASO_QUE_AVISA);
  assert.match(avisa, /^\s*VIGIA_SIMULACRO:\s*\$\{\{ inputs\.simulacro \}\}\s*$/m);
  assert.match(avisa, /--title "\$TITULO"/, '🔴 el título del Issue vuelve a estar escrito en el YAML: el del simulacro no saldría.');
  for (const salida of ['marca=', 'accion=crear', 'accion=comentar', 'numero=']) {
    assert.ok(avisa.includes(salida), `🔴 el paso de aviso no deja «${salida}» como salida: el que comprueba no sabría qué ir a mirar.`);
  }

  // El último: corre SIEMPRE que sea simulacro (también si no sonó), comprueba en GitHub y recoge.
  const comprueba = paso(yaml, 'SIMULACRO · ¿sonó? Se comprueba en GitHub y se recoge');
  assert.match(comprueba, /^\s*if:\s*always\(\) && inputs\.simulacro\s*$/m,
    '🔴 la comprobación no corre si el vigía no cantó: un simulacro que no suena dejaría un run rojo sin decir por qué.');
  assert.match(comprueba, /gh api "repos\/\$REPO\/issues\/\$SIMULACRO_NUMERO"/, '🔴 no se lee el Issue de vuelta en GitHub.');
  assert.match(comprueba, /simulacro-del-vigia\.mjs comprobar/);
  assert.match(comprueba, /gh issue close "\$SIMULACRO_NUMERO"/, '🔴 el Issue del simulacro se queda abierto con la marca: se comería el siguiente aviso de verdad.');
  assert.match(comprueba, /^\s*SIMULACRO_MARCA:\s*\$\{\{ steps\.aviso\.outputs\.marca \}\}\s*$/m);
  assert.ok(yaml.indexOf(`- name: ${PASO_QUE_AVISA}`) < yaml.indexOf('- name: SIMULACRO · ¿sonó?'), '🔴 la comprobación va antes que el aviso.');

  // Su propio grupo: lanzarlo no cancela una lectura de verdad.
  assert.match(yaml, /^\s*group:\s*vigia-despliegue\$\{\{ inputs\.simulacro && '-simulacro' \|\| '' \}\}\s*$/m);
});

test('SCRUM-1542 · 🔴 el latido aparta las corridas de simulacro: no son un veredicto sobre producción', () => {
  const AHORA_MS = Date.parse('2026-10-13T15:30:00Z');
  const corrida = (created_at, conclusion, id, display_title) => ({ id, created_at, status: 'completed', conclusion, display_title, html_url: `https://github.com/o/r/actions/runs/${id}` });
  const SIMULACRO_ROJO = corrida('2026-10-13T15:00:00Z', 'failure', 90, `${TITULO_DE_CORRIDA_DE_SIMULACRO} (producción NO está congelada)`);
  const VERDE = corrida('2026-10-13T13:00:00Z', 'success', 89, 'Vigía del despliegue');
  const noSeLlama = () => { throw new Error('no había que pedirlo'); };

  const v = veredictoDelVigiaDeDespliegue({ corridas: [SIMULACRO_ROJO, VERDE], pasosDe: noSeLlama, issuesAbiertos: noSeLlama, ahora: AHORA_MS });
  assert.equal(v.ciego, undefined);
  assert.equal(v.alertas.length, 0,
    '🔴 el simulacro se ha leído como una corrida del vigía: diría «CANTÓ y NO CONSTA SU AVISO» sobre una producción que nadie ha mirado.');
  assert.match(v.texto, /última corrida hace 2\.5 h, veredicto NO CANTÓ .*\(1 simulacro\(s\) del aviso apartado\(s\): no leen producción\)$/);

  // ✅ SUELO: la MISMA corrida sin ese título SÍ se lee, y pide sus pasos. Si no, el filtro lo aparta todo.
  let pidio = 0;
  const real = veredictoDelVigiaDeDespliegue({
    corridas: [{ ...SIMULACRO_ROJO, display_title: 'Vigía del despliegue' }, VERDE],
    pasosDe: () => { pidio += 1; return [{ name: PASO_QUE_MIRA, conclusion: 'failure' }, { name: PASO_QUE_AVISA, conclusion: 'skipped' }]; },
    ahora: AHORA_MS,
  });
  assert.equal(pidio, 1);
  assert.match(real.alertas[0].linea, /NO SUPO MIRAR/);
  // Sólo simulacros: no hay veredicto, y se dice.
  assert.match(veredictoDelVigiaDeDespliegue({ corridas: [SIMULACRO_ROJO], ahora: AHORA_MS }).ciego, /1 simulacro\(s\)/);

  // El título que el latido busca es el que el workflow pone, y sólo en simulacro.
  const yaml = soloYaml(fs.readFileSync(YAML, 'utf8'));
  const nombre = /^run-name:\s*\$\{\{ inputs\.simulacro && '([^']+)' \|\| '([^']+)' \}\}\s*$/m.exec(yaml);
  assert.ok(nombre, '🔴 CIEGO: el workflow no declara un `run-name` distinto para el simulacro.');
  assert.ok(nombre[1].startsWith(TITULO_DE_CORRIDA_DE_SIMULACRO),
    `🔴 el simulacro se llama «${nombre[1]}» en GitHub y el latido busca «${TITULO_DE_CORRIDA_DE_SIMULACRO}»: no lo apartaría.`);
  assert.ok(!nombre[2].startsWith(TITULO_DE_CORRIDA_DE_SIMULACRO), '🔴 una pasada de verdad se llama como un simulacro: el latido la apartaría.');
});

/** 🔴 LAS MUTACIONES QUE TIENEN QUE TUMBARME (contrato de SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① La cifra vuelve a salir de todo el rango: la fecha de escritura de la rama.
    fichero: 'scripts/vigilante-de-despliegue.mjs',
    de: "git('log', '--first-parent', '--format=%ct', versionDeProduccion + '..' + shaDeMain)",
    a: "git('log', '--format=%ct', versionDeProduccion + '..' + shaDeMain)",
    cae: 'EL CASO DEL 13-oct: una rama escrita hace 96 h y mergeada hace 59 s es un hueco de 0,0 h, no de 96',
  },
  {
    // ② El cambio de producción vuelve a valer para cualquier hueco, también uno posterior.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: '  if (hayHuecoFechado && (e > t0 || laAnteriorNoVioHueco)) {',
    a: '  if (false) {',
    cae: 'producción cambió, pero el hueco se abrió DESPUÉS de la lectura anterior: NO SE SABE (antes salía VERDE)',
  },
  {
    // ③ La contradicción deja de verse: la cifra inflada vuelve a cantar o a callar.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: '      && e < t0 - HOLGURA_DE_LECTURA_S) {',
    a: '      && false) {',
    cae: 'dos lecturas que se CONTRADICEN no cantan ni callan: la anterior no vio hueco y el de ahora dice venir de antes',
  },
  {
    // ④ El latido vuelve a leer un simulacro como una corrida del vigía.
    fichero: 'scripts/equipo/latido.mjs',
    de: 'corridas.filter((c) => c && !esSimulacro(c) && c.status',
    a: 'corridas.filter((c) => c && c.status',
    cae: 'el latido aparta las corridas de simulacro: no son un veredicto sobre producción',
  },
  {
    // ⑤ La producción fabricada deja de mirar la edad: coge la entrada más nueva y no hay hueco.
    fichero: 'scripts/equipo/simulacro-del-vigia.mjs',
    de: '    if (ahoraEpoch - x.epoch < umbral) continue;',
    a: '    if (false) continue;',
    cae: 'la producción fabricada deja un hueco que pasa del margen POR POCO, no uno de hace un mes',
  },
  {
    // ⑥ El simulacro deja de decir que lo es.
    fichero: 'scripts/vigia-despliegue-aviso.mjs',
    de: "  return (simulacro ? AVISO_DE_SIMULACRO : '')",
    a: "  return ('')",
    cae: 'el aviso de un simulacro lo dice LO PRIMERO, en el cuerpo y en el título, y sigue llevando la marca',
  },
];

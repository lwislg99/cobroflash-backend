// SCRUM-1458 · EL VIGÍA DICE CUÁNDO `main` ESTÁ PARADO, y la mención al dueño queda para lo grave.
//
// Medido el 6-oct-2026: `main` estuvo 88,5 h sin un merge (2-oct 18:22Z → 6-oct 10:50Z) y el vigía,
// que corrió durante el parón, comentó tres veces por cuatro PR sin decir nunca «main está parado»:
// miraba PR, no miraba `main`. Y los 43 comentarios de su issue mencionaban al dueño.
//
// 🔴 LA MENCIÓN, CON SUS DOS FECHAS. Este test guarda una decisión que CAMBIA otra:
//   · 15-sep-2026 (SCRUM-839b): la mención va en TODO aviso. La guardaba
//     `tests/scrum839c-la-pasada-se-ejecuta.test.mjs` («…y el aviso menciona a alguien»).
//   · 6-oct-2026 (SCRUM-1458, decisión del orquestador de Luis): va SÓLO si `main` entra parado o
//     cruza un umbral, o si un PR cruza 72 h o más. Los demás avisos salen igual, sin mención.
//
// Dos capas, como en SCRUM-839c: las funciones puras, y la pasada DE VERDAD corrida en un directorio
// propio con un repositorio de git de verdad detrás (la fecha de `main` se lee con `git log`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  filaDeMain, llevaMencion, haEmpeorado, sueloDeLaPasada, umbralDeEdad,
  UMBRAL_MAIN_PARADO_HORAS, UMBRAL_MENCION_HORAS, NUMERO_DE_MAIN, CAUSA_MAIN_PARADO, MARCA_DE_MAIN_PARADO,
  CAUSAS_QUE_SE_ARREGLAN_ESPERANDO,
} from '../scripts/vigia-atascados.mjs';
import { cuerpoNoDebeDespertar } from '../scripts/puerta-avisador-rojo.mjs';
import { seccionVigia, salidaDe, SALIDA_AVISO, SALIDA_OK, SALIDA_CIEGO } from '../scripts/equipo/latido.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASADA = path.join(RAIZ, 'scripts', 'vigia-pasada.mjs');
const H = 3600000;

/** Lo que el meta-guard EJECUTA contra este fichero. Cada una imita un defecto que este ticket viene a impedir. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/vigia-atascados.mjs',
    de: 'export const UMBRAL_MAIN_PARADO_HORAS = 48;',
    a: 'export const UMBRAL_MAIN_PARADO_HORAS = 480; // el parón de 88 h vuelve a pasar sin que nadie lo diga',
    cae: 'SCRUM-1458 · 🔴 EL CASO: el parón del 2-oct sale a las 48 h justas, y una hora y pico antes no',
  },
  {
    fichero: 'scripts/vigia-atascados.mjs',
    de: 'if (!Number.isFinite(t) || !Number.isFinite(ahora)) return { leido: false };',
    a: "if (!Number.isFinite(t) || !Number.isFinite(ahora)) return { leido: true, parado: false, horas: 0, fecha: '' };",
    cae: 'SCRUM-1458 · 🔴 FAIL-CLOSED: una fecha que no se deja leer NO es «main al día»',
  },
  {
    fichero: 'scripts/vigia-atascados.mjs',
    de: 'return { mencion: porMain || prs.length > 0, porMain, prs };',
    a: 'return { mencion: porMain, porMain, prs }; // un PR de 72 h deja de sonar',
    cae: 'SCRUM-1458 · 🔴 LA MENCIÓN, en los dos sentidos: sólo `main` parado y el PR que cruza 72 h o más',
  },
  {
    fichero: 'scripts/vigia-pasada.mjs',
    de: "let a = m.mencion && DUENO ? `@${DUENO} ` : '';",
    a: "let a = DUENO ? `@${DUENO} ` : ''; // la mención vuelve a ir en todo aviso",
    cae: 'SCRUM-1458 · 🔴 LABORATORIO: un PR que entra con 1 h avisa SIN mención; el mismo al cruzar 72 h, CON mención',
  },
  {
    fichero: 'scripts/vigia-pasada.mjs',
    de: ': antes.filter((p) => p.numero === NUMERO_DE_MAIN);',
    a: ': []; // sin leer `main`, se olvida que ya se avisó',
    cae: 'SCRUM-1458 · 🔴 LABORATORIO: sin poder leer `main` la pasada lo DICE, sale en 0 y conserva lo que ya sabía',
  },
  {
    fichero: 'scripts/equipo/latido.mjs',
    de: 'const porMain = deMain(c) && mainSigue !== false;',
    a: 'const porMain = false; // el aviso de `main` parado no lo lee nadie',
    cae: 'SCRUM-1458 · 🔴 EL LECTOR: el latido lee el aviso de `main` parado tal como lo escribe la pasada, y sabe cuándo deja de valer',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 1 · LO PURO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1458 · 🔴 EL CASO: el parón del 2-oct sale a las 48 h justas, y una hora y pico antes no', () => {
  assert.equal(UMBRAL_MAIN_PARADO_HORAS, 48, 'medido: desde el 1-sep sólo los dos parones (136 h y 88,5 h) llegan a 48 h; con 36 h entra un fin de semana');
  const ultimo = '2026-10-02T18:22:00Z';
  const alas48 = filaDeMain({ fecha: ultimo, ahora: Date.parse('2026-10-04T18:22:00Z') });
  assert.equal(alas48.leido, true);
  assert.equal(alas48.parado, true, '🔴 a las 48 h justas `main` está parado');
  assert.deepEqual(
    { numero: alas48.fila.numero, causa: alas48.fila.causa, horas: alas48.fila.horas },
    { numero: NUMERO_DE_MAIN, causa: CAUSA_MAIN_PARADO, horas: 48 },
  );
  assert.match(alas48.fila.detalle, /lleva 48 h sin un merge \(el último, el 2026-10-02 18:22Z\)/, 'la fila dice la edad y la fecha del último merge');
  const antes = filaDeMain({ fecha: ultimo, ahora: Date.parse('2026-10-04T17:00:00Z') });
  assert.deepEqual({ leido: antes.leido, parado: antes.parado, fila: antes.fila }, { leido: true, parado: false, fila: undefined });
  // El borde, sin redondeos: a un minuto de las 48 h todavía no.
  assert.equal(filaDeMain({ fecha: ultimo, ahora: Date.parse('2026-10-04T18:21:00Z') }).parado, false);
  assert.equal(filaDeMain({ fecha: ultimo, ahora: Date.parse('2026-10-03T17:22:00Z') }).parado, false, '47 h antes de las 48: un `main` de 23 h no es un parón');
  // Y la fecha vale con el huso que escribe `git log --format=%cI`.
  assert.equal(filaDeMain({ fecha: '2026-10-02T20:22:00+02:00', ahora: Date.parse('2026-10-04T18:22:00Z') }).parado, true);
});

test('SCRUM-1458 · 🔴 FAIL-CLOSED: una fecha que no se deja leer NO es «main al día»', () => {
  for (const mala of [undefined, null, '', '   ', 'no es una fecha', 0, {}]) {
    assert.deepEqual(filaDeMain({ fecha: mala, ahora: Date.parse('2026-10-04T18:22:00Z') }), { leido: false }, `fecha ${JSON.stringify(mala)}`);
  }
  // SUELO: una fecha buena sí se lee, o lo de arriba sería «no leo nunca nada».
  assert.equal(filaDeMain({ fecha: '2026-10-04T17:22:00Z', ahora: Date.parse('2026-10-04T18:22:00Z') }).leido, true);
});

test('SCRUM-1458 · `main` parado avisa al entrar, calla en el mismo umbral y vuelve a avisar al cruzar 72 h', () => {
  assert.ok(!CAUSAS_QUE_SE_ARREGLAN_ESPERANDO.includes(CAUSA_MAIN_PARADO), 'un `main` parado no se arregla esperando: avisa al entrar');
  const de = (h) => { const f = filaDeMain({ fecha: new Date(0).toISOString(), ahora: h * H }).fila; return [{ numero: f.numero, causa: f.causa, umbral: f.umbral }]; };
  const entra = haEmpeorado([], de(50));
  assert.deepEqual({ empeora: entra.empeora, nuevos: entra.nuevos }, { empeora: true, nuevos: [NUMERO_DE_MAIN] });
  assert.equal(haEmpeorado(de(50), de(55)).empeora, false, '🔴 cinco horas después, en el mismo umbral, no repite');
  assert.equal(haEmpeorado(de(50), de(71)).empeora, false);
  const cruza = haEmpeorado(de(71), de(73));
  assert.deepEqual({ empeora: cruza.empeora, envejecidos: cruza.envejecidos }, { empeora: true, envejecidos: [{ numero: NUMERO_DE_MAIN, umbral: 72 }] });
  assert.equal(haEmpeorado(de(73), de(160)).empeora, false);
  assert.equal(haEmpeorado(de(160), de(170)).empeora, true, 'y a la semana');
  // `main` se mueve: su fila desaparece, y que algo se desatasque no es empeorar.
  assert.equal(haEmpeorado(de(73), []).empeora, false);
});

test('SCRUM-1458 · 🔴 LA MENCIÓN, en los dos sentidos: sólo `main` parado y el PR que cruza 72 h o más', () => {
  assert.equal(UMBRAL_MENCION_HORAS, 72);
  const caso = (antes, ahora) => llevaMencion(haEmpeorado(antes, ahora), ahora).mencion;
  const pr = (umbral, causa = 'SIN-AUTO-MERGE') => [{ numero: 2129, causa, umbral }];
  const main = (umbral) => [{ numero: NUMERO_DE_MAIN, causa: CAUSA_MAIN_PARADO, umbral }];
  // SIN mención: lo que hasta el 6-oct-2026 la llevaba (decisión del 15-sep-2026, SCRUM-839b).
  assert.equal(caso([], pr(0)), false, '🔴 un PR que entra con 1 h avisa, pero no menciona');
  assert.equal(haEmpeorado([], pr(0)).empeora, true, 'SUELO: ese caso SÍ es un aviso; lo que no lleva es la mención');
  assert.equal(caso(pr(0), pr(24)), false, 'cruzar 24 h tampoco');
  assert.equal(caso(pr(24, 'ESPERANDO'), pr(24, 'DIRTY')), false, 'cambiar de causa tampoco');
  // CON mención.
  assert.equal(caso(pr(24), pr(72)), true, '🔴 el mismo PR al cruzar 72 h');
  assert.equal(caso(pr(72), pr(168)), true, 'y al cruzar la semana');
  assert.equal(caso([], main(umbralDeEdad(50))), true, '🔴 `main` entra parado');
  assert.equal(caso(main(24), main(72)), true, '`main` cruza 72 h');
  assert.equal(caso(main(24), [...main(24), ...pr(0)]), false, '🔴 con `main` ya avisado, un PR nuevo de 1 h no hereda su mención');
  // Lectura de la S5, declarada: el que ENTRA ya con 72 h las cruza (es la primera vez que se dice).
  assert.equal(caso([], pr(72)), true);
  // Sin aviso no hay mención que valga.
  assert.deepEqual(llevaMencion(haEmpeorado(pr(72), pr(72)), pr(72)), { mencion: false, porMain: false, prs: [] });
});

test('SCRUM-1458 · el suelo de la pasada lleva el cebo de `main`, en los dos sentidos', () => {
  const s = sueloDeLaPasada();
  assert.equal(s.ok, true);
  assert.match(s.detalle, /cuatro cebos .* `main` de 50 h parado y de 47 h no/);
  assert.match(sueloDeLaPasada.toString(), /main=\$\{main\}/, 'y si se rompe, el mensaje de suelo roto lo nombra');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 2 · EL LABORATORIO: la pasada de verdad, con un `origin/main` de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════════

const haceHoras = (h) => new Date(Date.now() - h * H).toISOString();

/** Un PR del bot, tal y como lo entrega `gh pr list --json …`. */
function pr(numero, { horas = 200, autoMerge = true } = {}) {
  return {
    number: numero, title: 'un PR', author: { login: 'yaqu-bot[bot]' }, isDraft: false, labels: [],
    autoMergeRequest: autoMerge ? { enabledAt: haceHoras(horas) } : null,
    createdAt: haceHoras(horas), updatedAt: haceHoras(horas), headRefOid: 'a'.repeat(40),
  };
}

/**
 * Corre la pasada en un directorio propio. `mainHace`: horas desde el último commit de un
 * `origin/main` de verdad, creado aquí; `null` = sin repositorio (la fecha no se puede leer).
 */
function correrPasada({ prs = [], estados = [], antes = [], mainHace = null, dueno = 'lwislg99' }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigia-1458-'));
  const entorno = { ...process.env };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT', 'GIT_DIR', 'GIT_WORK_TREE']) delete entorno[k];
  // Que `git` no trepe a un repositorio de más arriba: sin esto, «sin repositorio» dependería de dónde viva la carpeta temporal.
  entorno.GIT_CEILING_DIRECTORIES = path.dirname(dir);
  try {
    if (mainHace !== null) {
      // Sin milésimas: es la forma de fecha que `git` lee igual en todas sus versiones.
      const fecha = haceHoras(mainHace).replace(/\.\d+Z$/, 'Z');
      const g =(...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe', env: { ...entorno, GIT_AUTHOR_DATE: fecha, GIT_COMMITTER_DATE: fecha } });
      g('init', '-q');
      g('-c', 'user.name=scrum1458', '-c', 'user.email=scrum1458@test', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'el último merge');
      g('update-ref', 'refs/remotes/origin/main', 'HEAD');
    }
    fs.writeFileSync(path.join(dir, 'prs.json'), JSON.stringify(prs));
    fs.writeFileSync(path.join(dir, 'estados.txt'), estados.join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'reglas.json'), 'null');
    fs.mkdirSync(path.join(dir, 'checks'), { recursive: true });
    for (const p of prs) fs.writeFileSync(path.join(dir, 'checks', `${p.number}.json`), JSON.stringify({ total_count: 0, check_runs: [] }));
    let code = 0; let salida = '';
    try {
      salida = execFileSync(process.execPath, [PASADA], { cwd: dir, encoding: 'utf8', stdio: 'pipe', env: { ...entorno, ANTES: JSON.stringify(antes), DUENO: dueno } });
    } catch (e) {
      code = e.status === undefined ? 1 : e.status;
      salida = String(e.stdout || '') + String(e.stderr || '');
    }
    const leer = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return null; } };
    const cuerpo = leer('cuerpo.md');
    const marca = cuerpo && /<!-- vigia-atascados:estado (.*) -->/.exec(cuerpo);
    return { code, salida, cuerpo, aviso: leer('aviso.md'), veredicto: leer('veredicto.json') && JSON.parse(leer('veredicto.json')), memoria: marca ? JSON.parse(marca[1]) : null };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const MAIN_EN_MEMORIA = (umbral) => ({ numero: NUMERO_DE_MAIN, causa: CAUSA_MAIN_PARADO, umbral });

test('SCRUM-1458 · 🔴 LABORATORIO: con `main` de 50 h la pasada saca MAIN-PARADO, avisa UNA vez y menciona', () => {
  const r = correrPasada({ mainHace: 50 });
  assert.equal(r.code, 0, `la pasada no arranca:\n${r.salida}`);
  assert.match(r.salida, /main: último commit hace 50 h .* → MAIN-PARADO/, 'SUELO: la fecha se leyó de `git log`, no se supuso');
  assert.equal(r.veredicto.empeora, true, '🔴 la primera vez, empeora');
  assert.deepEqual(r.veredicto.nuevos, [NUMERO_DE_MAIN]);
  assert.equal(r.veredicto.atascados, 0, '`main` no es un PR: no se cuenta entre los PR atascados');
  assert.deepEqual(r.memoria, [MAIN_EN_MEMORIA(24)], 'viaja en la MISMA marca del issue: el workflow sólo lee una');
  assert.match(r.cuerpo, /🛑 \*\*`main` está PARADO: 50 h sin un merge\*\* \(el último, el \d{4}-\d{2}-\d{2} \d{2}:\d{2}Z\)/, 'el cuerpo dice la edad y la fecha del último merge');
  assert.match(r.cuerpo, /Ningún PR atascado/, 'y no lo pinta como un PR');
  assert.ok(!/#0\b/.test(r.cuerpo) && !/#0\b/.test(r.aviso), '🔴 `main` no sale como «#0»');
  assert.ok(r.aviso.startsWith(`@lwislg99 🛑 **${MARCA_DE_MAIN_PARADO}: 50 h sin un merge**`), `el aviso:\n${r.aviso}`);
  assert.ok(!r.aviso.includes('la lista de PR atascados'), 'sin PR en el aviso, no habla de una lista de PR');
  assert.ok(cuerpoNoDebeDespertar(r.cuerpo) && cuerpoNoDebeDespertar(r.aviso), 'ninguno de los dos despierta a una sesión');
  // La pasada siguiente, en el mismo umbral: silencio.
  const otra = correrPasada({ mainHace: 55, antes: r.memoria });
  assert.equal(otra.veredicto.empeora, false);
  assert.equal(otra.aviso, null, '🔴 ha vuelto a avisar del mismo parón sin cruzar umbral');
  assert.match(otra.cuerpo, /`main` está PARADO: 55 h/, 'pero el cuerpo se reescribe, con la edad de ahora');
  // Al cruzar 72 h, vuelve a avisar, con mención y diciendo qué umbral.
  const cruza = correrPasada({ mainHace: 73, antes: otra.memoria });
  assert.equal(cruza.veredicto.empeora, true);
  assert.match(cruza.aviso, /^@lwislg99 🛑 \*\*`main` está PARADO: 73 h sin un merge\*\* \(.*\) · cruza 72 h\./);
});

test('SCRUM-1458 · LABORATORIO: un `main` de 47 h no saca fila ni aviso, y uno que se movió sale de la memoria', () => {
  const r = correrPasada({ mainHace: 47 });
  assert.equal(r.code, 0);
  assert.equal(r.veredicto.empeora, false);
  assert.equal(r.aviso, null);
  assert.deepEqual(r.memoria, []);
  assert.match(r.cuerpo, /`main`: último merge hace 47 h \(.*\)\. Se avisa desde las 48 h\./);
  assert.ok(!r.cuerpo.includes(MARCA_DE_MAIN_PARADO));
  const seMovio = correrPasada({ mainHace: 1, antes: [MAIN_EN_MEMORIA(72)] });
  assert.equal(seMovio.veredicto.empeora, false, 'que `main` vuelva a moverse no es empeorar');
  assert.deepEqual(seMovio.memoria, []);
});

test('SCRUM-1458 · 🔴 LABORATORIO: sin poder leer `main` la pasada lo DICE, sale en 0 y conserva lo que ya sabía', () => {
  const r = correrPasada({ mainHace: null, antes: [MAIN_EN_MEMORIA(24)] });
  assert.equal(r.code, 0, `no poder leer \`main\` no tumba la pasada de los PR:\n${r.salida}`);
  assert.match(r.cuerpo, /No se pudo leer la edad de `main`\.\*\* Esta pasada NO dice que `main` esté al día/, '🔴 silencio donde tenía que decir «no pude»');
  assert.ok(!/último merge hace/.test(r.cuerpo), 'y no da una edad que no tiene');
  assert.match(r.salida, /no se pudo leer la fecha del último commit de origin\/main/);
  assert.deepEqual(r.memoria, [MAIN_EN_MEMORIA(24)], '🔴 ha olvidado que ya avisó: al volver a leer `main` repetiría el aviso, con su mención');
  assert.equal(r.aviso, null);
  // Y sin nada en la memoria, sigue sin inventar una fila.
  assert.deepEqual(correrPasada({ mainHace: null }).memoria, []);
});

test('SCRUM-1458 · 🔴 LABORATORIO: un PR que entra con 1 h avisa SIN mención; el mismo al cruzar 72 h, CON mención', () => {
  // El bot lo abrió y no armó el auto-merge: SIN-AUTO-MERGE, que avisa al entrar.
  const elPR = pr(2129, { horas: 1, autoMerge: false });
  const entra = correrPasada({ prs: [elPR], estados: ['2129|CLEAN|3|60|false|0'], mainHace: 2 });
  assert.equal(entra.code, 0, entra.salida);
  assert.equal(entra.veredicto.empeora, true, 'SUELO: entra y avisa');
  assert.match(entra.aviso, /^la lista de PR atascados ha \*\*EMPEORADO\*\*/, '🔴 el aviso de un PR de 1 h empieza por la mención');
  assert.match(entra.aviso, /- \*\*#2129 entra\*\* como \*\*SIN-AUTO-MERGE\*\* \(1 h sin push\)/);
  assert.ok(!entra.aviso.includes('@lwislg99'), '🔴 desde el 6-oct-2026 este aviso no menciona al dueño');
  assert.match(entra.salida, /mención no/);
  // El mismo, quieto, cruza 72 h.
  const viejo = pr(2129, { horas: 74, autoMerge: false });
  const cruza = correrPasada({ prs: [viejo], estados: [`2129|CLEAN|3|${73 * 60}|false|0`], antes: [{ numero: 2129, causa: 'SIN-AUTO-MERGE', umbral: 24 }], mainHace: 2 });
  assert.equal(cruza.veredicto.empeora, true);
  assert.match(cruza.aviso, /^@lwislg99 la lista de PR atascados ha \*\*EMPEORADO\*\*/, '🔴 un PR que cruza 72 h tiene que sonar');
  assert.match(cruza.aviso, /- \*\*#2129 cruza 72 h\*\*/);
  assert.match(cruza.salida, /mención SÍ/);
  // Y al cruzar sólo las 24 h, aviso sin mención.
  const a24 = correrPasada({ prs: [pr(2129, { horas: 26, autoMerge: false })], estados: [`2129|CLEAN|3|${25 * 60}|false|0`], antes: [{ numero: 2129, causa: 'SIN-AUTO-MERGE', umbral: 0 }], mainHace: 2 });
  assert.match(a24.aviso, /- \*\*#2129 cruza 24 h\*\*/);
  assert.ok(!a24.aviso.includes('@lwislg99'));
  for (const x of [entra, cruza, a24]) assert.ok(cuerpoNoDebeDespertar(x.cuerpo) && cuerpoNoDebeDespertar(x.aviso));
});

test('SCRUM-1458 · LABORATORIO: `main` parado y un PR nuevo en la misma pasada van en UN aviso, con las dos partes', () => {
  const r = correrPasada({ prs: [pr(2129, { horas: 1, autoMerge: false })], estados: ['2129|CLEAN|3|60|false|0'], mainHace: 50 });
  assert.deepEqual([...r.veredicto.nuevos].sort((a, b) => a - b), [NUMERO_DE_MAIN, 2129]);
  assert.equal(r.veredicto.atascados, 1);
  assert.ok(r.aviso.startsWith(`@lwislg99 🛑 **${MARCA_DE_MAIN_PARADO}: 50 h`));
  assert.match(r.aviso, /la lista de PR atascados ha \*\*EMPEORADO\*\*/);
  assert.match(r.aviso, /- \*\*#2129 entra\*\*/);
  assert.deepEqual(r.memoria.map((m) => m.numero), [NUMERO_DE_MAIN, 2129]);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 3 · EL LECTOR: quien lee al vigía es el latido, y tiene que saber leer este aviso
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1458 · 🔴 EL LECTOR: el latido lee el aviso de `main` parado tal como lo escribe la pasada, y sabe cuándo deja de valer', () => {
  // El cuerpo NO se escribe aquí a mano: es el que deja la pasada de verdad. Si el formato cambia, esto cae.
  const escrito = correrPasada({ mainHace: 50 }).aviso;
  assert.ok(escrito && escrito.includes(MARCA_DE_MAIN_PARADO), 'SUELO: la pasada ha dejado el aviso de `main`');
  const AHORA = Date.parse('2026-10-06T11:30:00Z');
  const comentario = { id: 201, creado: '2026-10-04T19:00:00Z', autor: 'github-actions[bot]', esBot: true, reacciones: 0, cuerpo: escrito };
  const base = (extra = {}) => ({ issue: 1241, comentarios: [comentario], abiertos: [2001], ahora: AHORA, ...extra });
  // `main` sigue parado: es alerta, y dice cuánto lleva.
  const sigue = seccionVigia(base({ ultimoMerge: { fecha: '2026-10-02T18:22:00Z' } }));
  assert.equal(sigue.pudo, true, `🔴 el latido se ha quedado ciego ante un aviso que no nombra ningún PR: ${sigue.motivo}`);
  assert.equal(sigue.alertas.length, 1);
  assert.match(sigue.alertas[0].linea, /aviso del 2026-10-04T19:00Z SIN LEER desde hace 40\.5 h · dice que main está PARADO, y SIGUE parado \(89\.1 h sin un merge\) · comentario 201/);
  assert.equal(salidaDe([sigue]), SALIDA_AVISO);
  // `main` volvió a moverse: el aviso ya no pide nada. Se cuenta y no se enseña.
  const seMovio = seccionVigia(base({ ultimoMerge: { fecha: '2026-10-06T10:50:00Z' } }));
  assert.equal(seMovio.alertas.length, 0);
  assert.equal(salidaDe([seMovio]), SALIDA_OK);
  // Sin la fecha de `main` no se da por resuelto: sale, y dice que no lo sabe.
  for (const sinFecha of [undefined, null, { fecha: 'no es una fecha' }]) {
    const s = seccionVigia(base({ ultimoMerge: sinFecha }));
    assert.equal(s.alertas.length, 1, `ultimoMerge = ${JSON.stringify(sinFecha)}`);
    assert.match(s.alertas[0].linea, /dice que main está PARADO, y no sé si sigue/);
  }
  // Una reacción en el comentario lo da por leído, como a cualquier otro aviso.
  assert.equal(seccionVigia(base({ comentarios: [{ ...comentario, reacciones: 1 }], ultimoMerge: { fecha: '2026-10-02T18:22:00Z' } })).alertas.length, 0);
  // CONTROL: un aviso que no nombra ni PR ni `main` sigue cegando la sección (el formato cambió).
  const raro = { ...comentario, cuerpo: 'la lista de PR atascados ha **EMPEORADO**.\n\n* el PR 2129 sigue igual' };
  assert.equal(salidaDe([seccionVigia(base({ comentarios: [raro] }))]), SALIDA_CIEGO);
});

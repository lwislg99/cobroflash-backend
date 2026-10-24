// tests/scrum1389c-senal-tres-clases.test.mjs — SCRUM-1389c
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SEÑAL DE NOMBRES CUENTA LAS ENTRADAS DE FICHERO DEL TAP, EN SUS CLASES (salida B de
// SCRUM-1389, decisión del fundador en c.20720: «B: SÍ, la construye J6»; C y A, no).
//
// `node --test` cuenta un proceso que NO SE CREÓ como un test que falla, con el recuento bien
// formado. El TAP sí los separa: la entrada de un fichero cuyo proceso se creó y murió lleva
// `exitCode:`; la de uno que no se creó no lo lleva y trae `error: 'spawn … ENOENT'`. La señal
// lo dice SIEMPRE, también con cero, en una línea propia del informe. Avisa, no bloquea: el
// código de salida del guion no cambia.
//
// 🔴 EL POSITIVO ES SEMBRADO, no prestado del árbol: los nueve TAP de `tests/fixtures/scrum1389c/`
// los dejó node 24 al correr los nueve casos del banco del registro de SCRUM-1389
// (`docs/master/evidencias/scrum1389/capturar-tap.mjs`, mismos ficheros que `banco.mjs`). No los
// he escrito yo: si los escribiera con la función que prueban, el test se comprobaría a sí mismo.
// Y si alguien los quita, el test no sale verde con ceros: dice que no pudo medir.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';
import { senalDeNombres, procesosDelTap, lineaDeProcesos, informe } from '../scripts/_senal-de-nombres.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const GUION = path.join(RAIZ, 'scripts', 'senal-de-nombres.mjs');
const FIXTURES = path.join(RAIZ, 'tests', 'fixtures', 'scrum1389c');
const NL = String.fromCharCode(10);

/**
 * Cada una es un defecto que esta línea promete no tener, y el test que tiene que verlo.
 * Vistas caer una a una antes de entrar: `docs/master/SCRUM-1389.md`, tramo SCRUM-1389c.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // el proceso que NO se creó vuelve a contarse como uno que murió: el defecto de SCRUM-1389
    fichero: 'scripts/_senal-de-nombres.mjs',
    de: "    if (exitCode !== null) murieron.set(exitCode, (murieron.get(exitCode) ?? 0) + 1);",
    a: "    if (exitCode !== null || spawn) murieron.set(exitCode ?? 1, (murieron.get(exitCode ?? 1) ?? 0) + 1);",
    cae: 'SCRUM-1389c · ① EL POSITIVO SEMBRADO: los nueve casos del banco salen cada uno con su clase y su recuento',
  },
  {
    // la línea sólo sale cuando hay algo que contar: su ausencia ya no distingue «cero» de «nadie contó»
    fichero: 'scripts/_senal-de-nombres.mjs',
    de: '  const L = [lineaDeRegistro(r), lineaDeProcesos(r.procesos)];',
    a: '  const L = [lineaDeRegistro(r), ...(r.procesos.entradas ? [lineaDeProcesos(r.procesos)] : [])];',
    cae: 'SCRUM-1389c · ② EL VERDE CON CEROS: la línea sale también cuando no hay ninguna entrada de fichero',
  },
];

const fixture = (n) => fs.readFileSync(path.join(FIXTURES, `caso-${n}.tap`), 'utf8');

// La respuesta, sacada del registro de SCRUM-1389 (tabla de ②: qué trae cada caso en el TAP),
// no de la función.
const ESPERADO = [
  { caso: 1, que: 'control: dos limpios', entradas: 0, noCreadas: 0, murieron: 0, otras: 0, codigos: '-' },
  { caso: 2, que: 'control: un assert que cae dentro de un test', entradas: 0, noCreadas: 0, murieron: 0, otras: 0, codigos: '-' },
  { caso: 3, que: 'se crea y muere: import que no resuelve', entradas: 1, noCreadas: 0, murieron: 1, otras: 0, codigos: '1:1' },
  { caso: 4, que: 'se crea y muere: error de sintaxis', entradas: 1, noCreadas: 0, murieron: 1, otras: 0, codigos: '1:1' },
  { caso: 5, que: 'se crea y muere: throw en la primera línea', entradas: 1, noCreadas: 0, murieron: 1, otras: 0, codigos: '1:1' },
  { caso: 6, que: 'se crea y muere: process.exit(1) mudo', entradas: 1, noCreadas: 0, murieron: 1, otras: 0, codigos: '1:1' },
  { caso: 7, que: 'se crea y sale con 3221225794 mudo', entradas: 1, noCreadas: 0, murieron: 1, otras: 0, codigos: '3221225794:1' },
  { caso: 8, que: 'se crea, pasa un caso y muere a medias', entradas: 1, noCreadas: 0, murieron: 1, otras: 0, codigos: '3221225794:1' },
  { caso: 9, que: 'NO se crea: dos nietos sin binario (ENOENT)', entradas: 2, noCreadas: 2, murieron: 0, otras: 0, codigos: '-' },
];

test('SCRUM-1389c · ① EL POSITIVO SEMBRADO: los nueve casos del banco salen cada uno con su clase y su recuento', () => {
  // población: los nueve ficheros tienen que estar, y enteros (un TAP sin resumen no es un caso)
  assert.deepEqual(fs.readdirSync(FIXTURES).filter((n) => n.endsWith('.tap')).sort(), ESPERADO.map((e) => `caso-${e.caso}.tap`).sort());
  for (const e of ESPERADO) {
    const p = procesosDelTap(fixture(e.caso));
    assert.equal(p.medible, true, `caso ${e.caso} (${e.que}): ${p.motivo}`);
    assert.deepEqual(
      { entradas: p.entradas, noCreadas: p.noCreadas, murieron: p.murieron, otras: p.otras },
      { entradas: e.entradas, noCreadas: e.noCreadas, murieron: e.murieron, otras: e.otras },
      `caso ${e.caso} (${e.que})`,
    );
    // las clases suman el total: si no sumaran, estaríamos contando texto
    assert.equal(p.noCreadas + p.murieron + p.otras, p.entradas, `caso ${e.caso}`);
    assert.equal(lineaDeProcesos(p),
      `[señal de nombres · procesos v1] medible=si entradas_de_fichero=${e.entradas} no_creadas=${e.noCreadas}`
      + ` murieron=${e.murieron} codigos=${e.codigos} otras=${e.otras}`, `caso ${e.caso}`);
  }
  // los dos lados del defecto, en una frase: el caso 9 y el caso 6 dan el MISMO recuento en la
  // tanda (un fallo por fichero) y aquí salen en clases distintas
  assert.match(fixture(9), /^# fail 2$/m);
  assert.match(fixture(6), /^# fail 1$/m);
});

test('SCRUM-1389c · ② EL VERDE CON CEROS: la línea sale también cuando no hay ninguna entrada de fichero', () => {
  for (const n of [1, 2]) {
    const r = senalDeNombres({ fuentes: [{ fichero: 'a.test.mjs', codigo: "test('caso limpio del banco', () => {});" }], tap: fixture(n) });
    const lineas = informe(r).split(NL);
    // la de registro sigue siendo la primera (la lee el vigía); la de procesos va justo detrás
    assert.match(lineas[0], /^\[señal de nombres v1\] /);
    assert.equal(lineas[1], '[señal de nombres · procesos v1] medible=si entradas_de_fichero=0 no_creadas=0 murieron=0 codigos=- otras=0');
  }
});

test('SCRUM-1389c · ③ CIEGO, NO VERDE: sin el TAP, o con uno que no está entero, la línea dice que no pudo contar', () => {
  // el positivo quitado: un TAP vacío (el fichero no está) no da ceros
  for (const [tap, motivo] of [['', /vacío/], [fixture(9).replace(/^# tests \d+$/m, ''), /resumen/]]) {
    const p = procesosDelTap(tap);
    assert.equal(p.medible, false);
    assert.match(p.motivo, motivo);
    assert.equal(lineaDeProcesos(p), '[señal de nombres · procesos v1] medible=no entradas_de_fichero=? no_creadas=? murieron=? codigos=? otras=?');
    const r = senalDeNombres({ fuentes: [{ fichero: 'a.test.mjs', codigo: "test('x', () => {});" }], tap });
    assert.equal(informe(r).split(NL)[1], lineaDeProcesos(p));
  }
});

test('SCRUM-1389c · ④ OTRAS: una entrada de fichero sin `exitCode` y sin `spawn` no se cuelga a ninguna clase', () => {
  // fabricado A MANO a partir del caso 9: se le quita el `error: 'spawn …'` a una de sus dos entradas
  const tap = fixture(9).replace(/  error: 'spawn [^\n]*ENOENT'\n  code: 'ENOENT'\n/, "  error: 'otra cosa'\n");
  assert.notEqual(tap, fixture(9), 'la fabricación tiene que haber cambiado algo');
  const p = procesosDelTap(tap);
  assert.deepEqual([p.entradas, p.noCreadas, p.murieron, p.otras], [2, 1, 0, 1]);
});

/** El guion como lo corre el paso del CI, con el entorno a mano (A21). */
function correr(args) {
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'GITHUB_STEP_SUMMARY']) delete env[k];
  const r = spawnSync(process.execPath, [GUION, ...args], { env, encoding: 'utf8' });
  return { salida: r.status, texto: String(r.stdout) + String(r.stderr) };
}

test('SCRUM-1389c · ⑤ AVISA, NO BLOQUEA: con procesos muertos o no creados y ningún nombre ausente, el guion sale 0 y lo dice', () => {
  // dos árboles fabricados que declaran exactamente lo que su TAP registra: ausentes = 0
  const arboles = [
    { caso: 7, ficheros: { 'limpio.test.mjs': "import test from 'node:test';\ntest('caso limpio del banco', () => {});\n", 'nativo.test.mjs': 'process.exit(3221225794);\n' },
      linea: 'entradas_de_fichero=1 no_creadas=0 murieron=1 codigos=3221225794:1 otras=0' },
    { caso: 9, ficheros: { 'a-renombra.test.mjs': "import test from 'node:test';\ntest('renombra el binario', () => {});\n" },
      linea: 'entradas_de_fichero=2 no_creadas=2 murieron=0 codigos=- otras=0' },
  ];
  for (const a of arboles) {
    const raiz = temporal('scrum1389c-guion-');
    fs.mkdirSync(path.join(raiz, 'tests'));
    for (const [n, c] of Object.entries(a.ficheros)) fs.writeFileSync(path.join(raiz, 'tests', n), c);
    const tap = path.join(raiz, 'tanda.tap');
    fs.writeFileSync(tap, fixture(a.caso));
    const r = correr([tap, '--raiz', raiz]);
    assert.match(r.texto, /^\[señal de nombres v1\] medible=si ausentes=0 /m, `caso ${a.caso}: ${r.texto}`);
    assert.match(r.texto, new RegExp(`^\\[señal de nombres · procesos v1\\] medible=si ${a.linea}$`, 'm'), `caso ${a.caso}`);
    assert.equal(r.salida, 0, `caso ${a.caso}: la línea de procesos avisa y no cambia la salida`);
  }
});

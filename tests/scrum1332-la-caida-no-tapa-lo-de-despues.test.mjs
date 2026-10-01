// tests/scrum1332-la-caida-no-tapa-lo-de-despues.test.mjs — SCRUM-1332
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN PROCESO QUE MUERE AL SALIR NO SE LLEVA POR DELANTE LO QUE VIENE DESPUÉS
//
// EL DEFECTO (1-oct-2026, tanda completa en la máquina del equipo): `scrum1216b` pasó sus 9 casos
// y su PROCESO murió al cerrar con 0xC0000409 (`Assertion failed: !(handle->flags &
// UV_HANDLE_CLOSING), file src\win\async.c`). La tanda salió roja sin que fallara ningún caso.
//
// LA CAUSA, separada por variantes (docs/master/SCRUM-1332.md): no es YaQu ni el orden de la
// tanda. Es el `fetch` global seguido de la salida forzada de `--test-force-exit`, en Windows y
// con la máquina cargada: un servidor http pelado + `fetch` muere 33 de 40; la MISMA petición por
// `http.request`, 0 de 40. El banco de la app real (`_banco-camino-real.mjs`) pedía con `fetch`.
//
// LO QUE FIJA ESTE FICHERO:
//   ① EL CONTROL ④ DEL TICKET, que nadie había fabricado: un fichero que MUERE de verdad (aborto
//      nativo, no un `process.exit`) seguido de otro con un caso que FALLA. El fallo posterior
//      se sigue VIENDO y CONTANDO, y los casos del que murió también. Por el envoltorio de
//      `npm test`, que es por donde pasa la tanda de verdad.
//   ② el banco de la app real no vuelve a pedir con `fetch`. Por AST: se cuentan LLAMADAS, no
//      la palabra (su propia cabecera la nombra cuatro veces para explicar por qué no).
//
// ⚠️ LO QUE NO PUEDE FIJAR, y se dice: la muerte en sí. Es intermitente, pide carga y sólo se ha
// medido en Windows; un test que la esperase sería el rojo intermitente que este ticket retira.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';

const ts = createRequire(import.meta.url)('typescript');
const RAIZ = path.resolve(import.meta.dirname, '..');
const ENVOLTORIO = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');
const BANCO = path.join(RAIZ, 'tests', '_banco-camino-real.mjs');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El banco que vuelve a pedir con el `fetch` global: la muerte al salir de SCRUM-1332.
    fichero: 'tests/_banco-camino-real.mjs',
    de: '        const peticion = http.request(`${base}${ruta}`, {',
    a: '        const peticion = fetch(`${base}${ruta}`, {',
    cae: 'el banco de la app real pide con node:http',
  },
];

/** Sin `NODE_TEST_CONTEXT` (o el hijo no ejecuta nada y sale 0), sin `NODE_OPTIONS`, sin color. */
function entorno() {
  const e = { ...process.env };
  delete e.NODE_TEST_CONTEXT;
  delete e.NODE_OPTIONS;
  delete e.FORCE_COLOR;
  return e;
}

// ═══ ① UN FALLO POSTERIOR A LA CAÍDA SE SIGUE VIENDO ════════════════════════════════════════

// Pasa su caso y, al salir, ABORTA: muerte nativa de verdad, sin pasar por JavaScript. Es lo más
// cerca de la aserción de libuv que se puede fabricar en las dos plataformas.
const MUERE = "import test from 'node:test';\n"
  + "process.on('exit', () => { process.abort(); });\n"
  + "test('caso del que muere, que PASA', () => {});\n";
const FALLA_DESPUES = "import test from 'node:test';\nimport assert from 'node:assert/strict';\n"
  + "test('rojo posterior a la caida', () => assert.equal(1, 2));\n"
  + "test('verde posterior a la caida', () => {});\n";
const SANO = "import test from 'node:test';\ntest('el ultimo, sano', () => {});\n";

/** Los resultados de un TAP de `node --test`, en orden: `[{ ok, nombre }]`. Sólo el nivel superior. */
function resultados(tap) {
  return [...tap.matchAll(/^(not ok|ok) \d+ - (.+?)(?: # .*)?$/gm)].map((m) => ({ ok: m[1] === 'ok', nombre: m[2] }));
}

test('SCRUM-1332 · 🔴 CONTROL ④: un fichero que MUERE al salir no tapa el fallo del fichero siguiente', () => {
  const dir = temporal('yaqu-1332-');
  const ficheros = { 'a-muere.test.mjs': MUERE, 'b-falla-despues.test.mjs': FALLA_DESPUES, 'c-sano.test.mjs': SANO };
  for (const [nombre, codigo] of Object.entries(ficheros)) fs.writeFileSync(path.join(dir, nombre), codigo);

  // De uno en uno, para que «después» sea después de verdad y no sólo en el orden de la salida.
  const r = spawnSync(process.execPath,
    [ENVOLTORIO, 'node', '--test', '--test-force-exit', '--test-concurrency=1', '--test-reporter=tap', ...Object.keys(ficheros)],
    { cwd: dir, env: entorno(), encoding: 'utf8', timeout: 120_000 });
  const vistos = resultados(r.stdout);
  const de = (nombre) => vistos.find((v) => v.nombre === nombre);

  // SUELO (A21): el sujeto MURIÓ. Sin esto, un `a-muere` que saliera bien daría una tanda donde
  // «el fallo posterior se ve» sin que hubiera caída anterior ninguna.
  const muerto = /not ok \d+ - a-muere\.test\.mjs\n {2}---\n([\s\S]*?)\n {2}\.\.\./.exec(r.stdout);
  assert.ok(muerto, `🔴 NO PUDE MIRAR: el fichero que tenía que morir no sale caído. Salida: ${r.stdout.slice(0, 800)} ${r.stderr.slice(0, 300)}`);
  const codigo = Number((/exitCode: (\d+)/.exec(muerto[1]) || [])[1] ?? NaN);
  const senal = (/signal: '?([A-Z]+)'?/.exec(muerto[1]) || [])[1] ?? null;
  assert.ok(senal !== null || (Number.isFinite(codigo) && codigo > 1),
    `🔴 NO PUDE MIRAR: el fichero cayó pero no murió (exitCode ${codigo}, señal ${senal}): un `
    + 'exit 1 corriente no es la caída que se quería fabricar.');
  assert.equal(de('caso del que muere, que PASA')?.ok, true,
    '🔴 el caso del fichero que murió no consta como pasado: la caída se ha llevado sus resultados.');

  // 🔴 LO QUE DECIDE: lo de DESPUÉS de la caída sigue ahí, con su veredicto.
  assert.equal(de('rojo posterior a la caida')?.ok, false,
    `🔴 el fallo POSTERIOR a la caída no se ve: ${JSON.stringify(vistos)}. Un proceso que revienta al `
    + 'salir estaría tapando un rojo de verdad.');
  assert.equal(de('verde posterior a la caida')?.ok, true, '🔴 el verde posterior a la caída no consta.');
  assert.equal(de('el ultimo, sano')?.ok, true, '🔴 el fichero que corre después de los dos no consta.');
  const orden = vistos.map((v) => v.nombre);
  assert.ok(orden.indexOf('a-muere.test.mjs') < orden.indexOf('rojo posterior a la caida'),
    '🔴 el «posterior» no va después de la caída: este caso no mide lo que dice.');

  // Y el RECUENTO, que es lo que el ticket temía perder. Cinco resultados, ni uno menos: el caso
  // del que muere, el fichero que muere, el rojo y el verde posteriores, y el sano.
  assert.equal(vistos.length, 5, `🔴 se esperaban 5 resultados y hay ${vistos.length}: ${JSON.stringify(orden)}`);
  assert.match(r.stdout, /^# tests 5$/m, `🔴 el recuento ha perdido resultados tras la caída: ${(/^# tests \d+$/m.exec(r.stdout) || ['sin recuento'])[0]}`);
  assert.match(r.stdout, /^# pass 3$/m);
  assert.match(r.stdout, /^# fail 2$/m, '🔴 tienen que constar DOS caídos: el fichero que murió y el caso posterior.');
  assert.equal(r.status, 1, `🔴 la tanda con una muerte y un fallo sale ${r.status} por el envoltorio.`);
});

// ═══ ② EL BANCO NO VUELVE A `fetch` ═════════════════════════════════════════════════════════

/** Cuántas LLAMADAS hay a `nombre(…)` y a `objeto.metodo(…)` en un fuente. Por AST, sin comentarios. */
function llamadas(fuente) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const cuenta = new Map();
  (function mirar(n) {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const clave = ts.isIdentifier(e) ? e.text
        : (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) ? `${e.expression.text}.${e.name.text}` : null);
      if (clave) cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }
    ts.forEachChild(n, mirar);
  })(sf);
  return cuenta;
}

test('SCRUM-1332 · 🔴 el banco de la app real pide con node:http, no con el fetch global', () => {
  // CONTROL del contador, en la mano: ve una llamada a `fetch`, y NO cuenta la palabra en un
  // comentario ni en una cadena. Sin esto, un «0 llamadas» no se distingue de «no sé mirar».
  const sintetico = llamadas("// fetch(no)\nconst s = 'fetch(tampoco)';\nconst r = await fetch(url);\nhttp.request(u);");
  assert.equal(sintetico.get('fetch'), 1, '🔴 CIEGO: el contador no ve una llamada a `fetch` que le doy en la mano, o cuenta la de un comentario.');
  assert.equal(sintetico.get('http.request'), 1, '🔴 CIEGO: el contador no ve `http.request(`.');

  const fuente = fs.readFileSync(BANCO, 'utf8');
  const c = llamadas(fuente);
  assert.ok([...c.values()].reduce((a, b) => a + b, 0) > 20,
    `🔴 CIEGO: sólo ${c.size} llamadas distintas en el banco; no lo estoy leyendo.`);
  assert.ok(/\bfetch\b/.test(fuente), '🔴 SUELO: el banco ya no nombra `fetch` ni para explicar por qué no lo usa; revisa que sigo mirando el fichero que es.');

  assert.equal(c.get('http.request') ?? 0, 1,
    '🔴 el banco ya no hace su petición con `http.request`: ¿por dónde pide ahora?');
  assert.equal(c.get('fetch') ?? 0, 0,
    '🔴 el banco de la app real vuelve a pedir con el `fetch` global. Medido en SCRUM-1332: `fetch` + la '
    + 'salida forzada de `npm test` mata el proceso AL SALIR en Windows (33 de 40 con carga), con los '
    + 'casos en verde, y la tanda sale roja sin que falle nada. Con `http.request`, 0 de 40.');
});

// tests/scrum1798c-meta-guard-ve-los-guards-de-navegador.test.mjs — SCRUM-1798c (carril S3)
//
// EL DEFECTO (medido por J6 en SCRUM-1789c, `docs/master/SCRUM-1789.md`): el catálogo de mutaciones
// no llegaba a los guards de navegador, y si llegaba, juzgaba mal.
//   · NO LOS VE: `censoConPoblacion()` lee `tests/*.test.mjs`; sobre `scripts/` da población 0.
//   · JUZGA MAL: `correr()` usa `run()` de node:test, y un script plano da UN caso con el nombre del
//     fichero. Un guard que sale 1 (hallazgo) y otro que sale 2 (CIEGO) salen IGUAL: un «caído». Una
//     declaración con `cae: '<fichero>'` contaría un CIEGO como VIVA (verde falso), y una con
//     `cae: '<texto del hallazgo>'` saldría siempre CIEGA en PUERTA 1 (la base nunca «pasa»).
//
// LA CURA vive en el MEDIDOR (`scripts/meta-guard-mutaciones.mjs`), no en los guards (regla 41): una
// SEGUNDA población (`scripts/guard-*.mjs`) que no mueve la de `tests/` ni sus suelos, y un veredicto
// por CÓDIGO DE SALIDA: 0 = base verde · 1 = hallazgo, cada línea un «caído» · ≥ 2 o sin código = CIEGO.
//
// Todo lo sembrado vive FUERA del árbol (`_temporal.mjs`): crear un guard dentro de `scripts/`
// movería el árbol que el propio meta-guard vigila (SCRUM-754).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mg = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);

const GUARDS_DE_SCRIPTS = fs.readdirSync(path.join(RAIZ, 'scripts')).filter((f) => /^guard-.*\.mjs$/.test(f));

/** Un `scripts/` de mentira, fuera del árbol, con los guards que se le pidan. */
function scriptsSembrados(guards) {
  const dir = path.join(temporal('scrum1798c-'), 'scripts');
  fs.mkdirSync(dir);
  for (const [nombre, codigo] of Object.entries(guards)) fs.writeFileSync(path.join(dir, nombre), codigo);
  return dir;
}
// `correr()` va en un proceso HIJO: dentro de un fichero de node:test, su `run()` no ejecuta ficheros
// («run() is being called recursively within a test file. skipping running files», medido al escribir
// esto), y el rojo de hoy caería por eso y no por el defecto. Así el hijo es un proceso plano, como el
// guion de J6 y como el job de CI.
function correrEnHijo(guard) {
  const codigo = `const mg = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href)});
const r = await mg.correr(${JSON.stringify(guard)});
process.stdout.write('@@' + JSON.stringify({ pasados: r.pasados, caidos: r.caidos, codigo: r.codigo, ciegoDelGuard: r.ciegoDelGuard, vigilada: r.vigilada }) + '@@', () => process.exit(0));`;
  // Y sin `NODE_TEST_CONTEXT`: el hijo lo hereda del `node --test` padre y entonces su `run()` se
  // cree recursivo y tampoco corre nada (medido: caídos [] para salida 1 y para salida 2).
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  // Un FICHERO y no `node -e`: con `-e` el `run()` del hijo tampoco ejecuta nada (medido igual).
  const hijo = path.join(temporal('scrum1798c-hijo-'), 'correr.mjs');
  fs.writeFileSync(hijo, codigo);
  const h = spawnSync(process.execPath, [hijo], { cwd: RAIZ, env, encoding: 'utf8', timeout: 120000 });
  const m = /@@(.*)@@/s.exec(h.stdout || '');
  assert.ok(m, `el hijo no devolvió resultado (salida ${h.status}): ${(h.stderr || '').slice(-400)}`);
  return JSON.parse(m[1]);
}
const sale = (codigo, texto) => `console.log(${JSON.stringify(texto)});\nprocess.exit(${codigo});\n`;
// Una declaración COMPLETA y otra con `de` en plantilla (no literal: SCRUM-757, y lo midió S5 en #3419).
const DECLARA = 'export const MUTACIONES_QUE_ME_TUMBAN = [\n'
  + "  { fichero: 'public/x.css', de: '.a { display:flex;', a: '.a { display:none;', cae: 'no se ve' },\n"
  + '];\n' + sale(0, 'verde');
const DECLARA_PLANTILLA = 'const x = 1;\nexport const MUTACIONES_QUE_ME_TUMBAN = [\n'
  + "  { fichero: 'public/x.css', de: `.a${x}`, a: '.b', cae: 'no se ve' },\n"
  + '];\n' + sale(0, 'verde');

test('control: el árbol TIENE guards de navegador en scripts/ (sin esto, «población 0» no diría nada)', () => {
  assert.ok(GUARDS_DE_SCRIPTS.length > 0, 'no hay ningún scripts/guard-*.mjs: el test mediría sobre la nada');
});

test('🔴 el medidor VE la población de scripts/guard-*.mjs: la cuenta entera, no 0', () => {
  assert.equal(typeof mg.censoDeGuardsDeNavegador, 'function', 'el meta-guard no tiene censo de guards de navegador');
  const r = mg.censoDeGuardsDeNavegador();
  assert.equal(r.poblacion, GUARDS_DE_SCRIPTS.length, `población ${r.poblacion}, y en scripts/ hay ${GUARDS_DE_SCRIPTS.length}`);
  assert.ok(Array.isArray(r.censo));
});

test('🔴 control positivo: un guard sembrado que declara entra en el censo con su mutación; el que no declara, no', () => {
  assert.equal(typeof mg.censoDeGuardsDeNavegador, 'function');
  const dir = scriptsSembrados({ 'guard-declara.mjs': DECLARA, 'guard-calla.mjs': sale(0, 'verde'), 'otro.mjs': DECLARA });
  const r = mg.censoDeGuardsDeNavegador(dir);
  assert.equal(r.poblacion, 2, 'la población son los guard-*.mjs, y sólo ellos');
  assert.equal(r.censo.length, 1);
  assert.equal(r.censo[0].mutaciones.length, 1);
  assert.equal(r.censo[0].mutaciones[0].cae, 'no se ve');
  assert.ok(mg.esGuardDeNavegador(r.censo[0].guard), `el guard del censo (${r.censo[0].guard}) se tiene que juzgar como de navegador`);
});

test('🔴 una declaración con `de` en plantilla NO se descarta en silencio: sale como ilegible', () => {
  assert.equal(typeof mg.censoDeGuardsDeNavegador, 'function');
  const dir = scriptsSembrados({ 'guard-plantilla.mjs': DECLARA_PLANTILLA });
  const r = mg.censoDeGuardsDeNavegador(dir);
  assert.equal(r.censo.length, 1, 'el fichero tiene que estar en el censo aunque su declaración no se pueda leer');
  assert.equal(r.censo[0].mutaciones.length, 0);
  const ilegibles = mg.ilegiblesDelCenso(r.censo);
  assert.equal(ilegibles.length, 1, 'la plantilla tiene que salir como ilegible, que es lo que tumba el arranque');
  assert.match(mg.motivoDeIlegible(ilegibles[0]), /`de`/);
});

test('la ruta decide qué es un guard de navegador, y un test de node:test no lo es', () => {
  assert.equal(typeof mg.esGuardDeNavegador, 'function');
  assert.ok(mg.esGuardDeNavegador('scripts/guard-ficha-de-factura.mjs'));
  assert.ok(mg.esGuardDeNavegador(path.join(RAIZ, 'scripts', 'guard-ficha-de-factura.mjs')));
  assert.ok(!mg.esGuardDeNavegador('scrum1-x.test.mjs'));
  assert.ok(!mg.esGuardDeNavegador('scripts/meta-guard-mutaciones.mjs'));
  assert.ok(!mg.esGuardDeNavegador('scripts/_navegador.mjs'));
});

test('🔴 un guard que sale 2 (NO SUPO MEDIR) es CIEGO, no un «caído»: ninguna `cae` lo puede dar por VIVO', async () => {
  const dir = scriptsSembrados({ 'guard-ciego.mjs': sale(2, 'NO SUPE MEDIR: sembrado') });
  const tras = correrEnHijo(path.join(dir, 'guard-ciego.mjs'));
  assert.ok(!mg.cayo(tras, 'guard-ciego.mjs'), 'el CIEGO salió como caído con el nombre del fichero: una declaración así sería VIVA');
  assert.ok(!mg.cayo(tras, 'NO SUPE MEDIR'), 'el texto de un CIEGO no es un hallazgo');
  assert.match(String(tras.ciegoDelGuard), /NO SUPO MEDIR/);
});

test('🔴 un guard que sale 3 (no arrancó el navegador) también es CIEGO', async () => {
  const dir = scriptsSembrados({ 'guard-sin-arranque.mjs': sale(3, 'NO PUDE ARRANCARLO') });
  const tras = correrEnHijo(path.join(dir, 'guard-sin-arranque.mjs'));
  assert.equal(tras.caidos.length, 0);
  assert.match(String(tras.ciegoDelGuard), /3/);
});

test('🔴 un guard que sale 1 entrega el TEXTO del hallazgo: `cae` casa con su línea', async () => {
  const dir = scriptsSembrados({ 'guard-rojo.mjs': sale(1, '· pending · movil → la línea de progreso no se ve: sembrado') });
  const tras = correrEnHijo(path.join(dir, 'guard-rojo.mjs'));
  assert.ok(mg.cayo(tras, 'la línea de progreso no se ve'), `caídos: ${JSON.stringify(tras.caidos)}`);
  assert.equal(tras.ciegoDelGuard, undefined);
  assert.equal(tras.codigo, 1);
});

test('🔴 un guard que sale 0 es la base verde, y no trae caídos', async () => {
  const dir = scriptsSembrados({ 'guard-verde.mjs': sale(0, '✓ 12 de 12') });
  const tras = correrEnHijo(path.join(dir, 'guard-verde.mjs'));
  assert.equal(tras.codigo, 0);
  assert.equal(tras.caidos.length, 0);
  assert.equal(tras.ciegoDelGuard, undefined);
  assert.equal(tras.vigilada, true, 'la vigilancia de SCRUM-754 se abre igual para un guard de navegador');
});

// PUERTA 1 con un guard de navegador: la base es «salió 0». Se ejercita SIN mutar nada: la declaración
// apunta a un ancla que no existe, así que, si pasa PUERTA 1, se para en «el ancla no está».
const SIN_ANCLA = { fichero: 'package.json', de: ['ancla', 'inexistente', '1798c'].join('-'), a: 'x', cae: 'la línea de progreso no se ve' };
const GUARD_NAV = 'scripts/guard-ficha-de-factura.mjs';

test('🔴 PUERTA 1 · con la base de un guard de navegador en 0, se pasa la puerta (no sale CIEGO por «no pasó»)', async () => {
  const limpia = { codigo: 0, pasados: ['(salida 0)'], caidos: [], saltados: [], errores: {}, movidos: [] };
  const r = await mg.aplicarUna(SIN_ANCLA, GUARD_NAV, limpia);
  assert.equal(r.ok, false);
  assert.match(String(r.ciego), /el ancla no está/, `se quedó en PUERTA 1: ${r.ciego}`);
});

test('🔴 PUERTA 1 · con la base de un guard de navegador CIEGA, no se muta y el motivo es el del guard', async () => {
  const limpia = { codigo: 2, ciegoDelGuard: 'salió 2: NO SUPO MEDIR', pasados: [], caidos: [], saltados: [], errores: {}, movidos: [] };
  const r = await mg.aplicarUna(SIN_ANCLA, GUARD_NAV, limpia);
  assert.equal(r.ok, false);
  assert.match(String(r.ciego), /NO SUPO MEDIR/);
  assert.doesNotMatch(String(r.ciego), /el ancla no está/, 'con la base ciega no se llega a mirar el ancla');
});

test('🔴 el juicio de una mutación sobre un guard de navegador: CIEGA si no midió, VIVA si nombra el hallazgo, MUDA si no', () => {
  assert.equal(typeof mg.juicioDeNavegador, 'function');
  const cae = 'la línea de progreso no se ve';
  const ciega = mg.juicioDeNavegador(mg.resultadoDeNavegador({ status: 2, stdout: `· ${cae}` }), cae);
  assert.ok(!ciega.ok && /NO SUPO MEDIR/.test(ciega.ciego), 'salida 2 con el texto del hallazgo delante: CIEGA, nunca VIVA');
  const sinCodigo = mg.juicioDeNavegador(mg.resultadoDeNavegador({ status: null, signal: 'SIGKILL' }), cae);
  assert.ok(!sinCodigo.ok && /SIGKILL/.test(sinCodigo.ciego));
  const viva = mg.juicioDeNavegador(mg.resultadoDeNavegador({ status: 1, stdout: `✓ otra cosa\n· pending · movil → ${cae}: mide 0` }), cae);
  assert.equal(viva.ok, true);
  assert.equal(viva.colaterales, 1);
  const mudaCero = mg.juicioDeNavegador(mg.resultadoDeNavegador({ status: 0, stdout: '✓ 12 de 12' }), cae);
  assert.ok(!mudaCero.ok && /salió 0/.test(mudaCero.mudo), 'salió 0 con la mutación: MUDA, no CIEGA');
  const mudaOtro = mg.juicioDeNavegador(mg.resultadoDeNavegador({ status: 1, stdout: '· otro hallazgo' }), cae);
  assert.ok(!mudaOtro.ok && /ninguna línea/.test(mudaOtro.mudo));
});

// Cada mitad de la cura, quitada por separado, tumba su caso (las lee el meta-guard por AST; anclas únicas).
// Que `aplicarUna` LLAME a `juicioDeNavegador` no se declara: ejercitarlo exige mutar un fichero del árbol
// desde aquí (lo haría el meta-guard dentro de otro meta-guard). Va medido de punta a punta en el registro.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (tras.ciegoDelGuard) {',
    a: '  if (false) {',
    cae: 'CIEGA si no midió, VIVA si nombra el hallazgo',
  },
  {
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  const ficheros = fs.readdirSync(dir).filter((f) => /^guard-.*\\.mjs$/.test(f));',
    a: "  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs'));",
    cae: 'el medidor VE la población de scripts/guard-*.mjs',
  },
  {
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (esGuardDeNavegador(guard)) {',
    a: '  if (false) {',
    cae: 'un guard que sale 2 (NO SUPO MEDIR) es CIEGO',
  },
  {
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (status === 1) return { ...vacio, codigo: 1, caidos: lineas };',
    a: '  if (status === 1) return { ...vacio, codigo: 1, caidos: [] };',
    cae: 'un guard que sale 1 entrega el TEXTO del hallazgo',
  },
  {
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    if (limpia?.codigo !== 0) {',
    a: '    if (false) {',
    cae: 'con la base de un guard de navegador CIEGA',
  },
];

test('control: la población de tests/ y sus suelos NO se mueven (A12)', () => {
  const { poblacion } = mg.censoConPoblacion();
  const enTests = fs.readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.endsWith('.test.mjs')).length;
  assert.equal(poblacion, enTests);
  assert.equal(mg.SUELO_GUARDS, 20);
  assert.equal(mg.SUELO_DECLARACIONES, 54);
});

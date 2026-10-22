// tests/scrum935d-el-corte-dice-lo-que-deja.test.mjs — SCRUM-935 (tramo 935d) · S3
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 UN META-GUARD CORTADO NO DECÍA «NO HAY FALLOS»: NO DECÍA NADA
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Medido en CI del 15 al 21-oct-2026 (313 jobs, `docs/master/SCRUM-935.md` tramo 935d): 135 murieron
// en el `timeout-minutes` del job, como `cancelled` y sin una línea. ~3.034 veredictos sin emitir
// —siempre la cola del censo— y 39 CIEGAS + 1 FICHERO MUERTO ya impresos y sin código de salida.
//
// Desde 935d el instrumento deja de EMPEZAR trabajo cuando se le acaba el presupuesto (el techo del
// job leído de `ci.yml`, menos un margen medido), nombra lo que no ha juzgado y sale CIEGO.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 El recorrido entero NO se ejercita aquí: correr el meta-guard dentro de la tanda movería el
//    árbol bajo los demás tests (su control de vigilancia crea y borra un fichero en `tests/`, y
//    cada mutación escribe código). Las piezas son puras y se prueban aquí; que el bucle las USA lo
//    comprueba el AST de abajo; y el corte provocado a mano (`META_PRESUPUESTO_S`), corrido de
//    verdad, está en el registro con su salida.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  techoDelJob, presupuestoDelPaso, debeCortar, pendientesDesde, mensajeDeCorte, guardsCaros,
  MARGEN_DEL_JOB_S, GUARD_CARO_S,
} from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI_YML = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return Number.isFinite(presupuesto?.limiteS) && transcurridoS >= presupuesto.limiteS;',
    a: '  return false; // nunca corta, a proposito',
    cae: 'SCRUM-935d · 🔴 con el presupuesto agotado, CORTA; con margen, no' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    const resto = g === guardIdx ? muts.slice(desde) : muts;',
    a: '    const resto = muts; // cuenta otra vez lo ya juzgado, a proposito',
    cae: 'SCRUM-935d · lo pendiente empieza en la mutación del corte, no en la primera del guard' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (mios.length !== 1) return null;',
    a: '  if (!mios.length) return null;',
    cae: 'SCRUM-935d · si DOS jobs corren el instrumento, no sé de cuál soy: sin techo' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    ciegos.push(msg);',
    a: '    void msg; // el corte se imprime y NO cuenta, a proposito',
    cae: 'SCRUM-935d · 🔴 EL BUCLE: mira el presupuesto antes de cada pasada, y el corte sale como CIEGA' },
];

test('SCRUM-935d · el techo se LEE de ci.yml: el job que corre `npm run meta:mutaciones`', () => {
  const techo = techoDelJob(CI_YML);
  assert.ok(Number.isFinite(techo) && techo > 0,
    'NO PUDE MIRAR: no encuentro el `timeout-minutes` del job de `npm run meta:mutaciones` en ci.yml');
  // Segunda vía, independiente: el número escrito en el bloque de ese job, contado a mano.
  const bloque = CI_YML.slice(CI_YML.lastIndexOf('\n  meta-mutaciones:'), CI_YML.indexOf('run: npm run meta:mutaciones'));
  const aMano = /\n {4}timeout-minutes:\s*(\d+)/.exec(bloque);
  assert.ok(aMano, 'el control a mano no encuentra el bloque `meta-mutaciones`: revisa este test, no el instrumento');
  assert.equal(techo, Number(aMano[1]) * 60);
});

test('SCRUM-935d · si DOS jobs corren el instrumento, no sé de cuál soy: sin techo', () => {
  const uno = 'jobs:\n  a:\n    timeout-minutes: 30\n    steps:\n      - run: npm run meta:mutaciones\n';
  assert.equal(techoDelJob(uno), 1800);
  const renombrado = uno.replace('  a:', '  otro-nombre:');
  assert.equal(techoDelJob(renombrado), 1800, 'el job se reconoce por su paso, no por su clave');
  const dos = `${uno}  b:\n    timeout-minutes: 45\n    steps:\n      - run: npm run meta:mutaciones\n`;
  assert.equal(techoDelJob(dos), null);
  assert.equal(techoDelJob('jobs:\n  a:\n    steps:\n      - run: npm run meta:mutaciones\n'), null, 'sin timeout no hay techo');
  assert.equal(techoDelJob('jobs:\n  a:\n    timeout-minutes: 30\n    steps:\n      - run: npm test\n'), null, 'otro job no es el mío');
});

test('SCRUM-935d · el presupuesto: forzado, fuera de CI, y en CI desde ci.yml', () => {
  assert.deepEqual(presupuestoDelPaso({ env: { META_PRESUPUESTO_S: '40' }, ciYml: CI_YML }).limiteS, 40);
  assert.equal(presupuestoDelPaso({ env: {}, ciYml: CI_YML }).limiteS, null, 'en local nadie corta');
  const enCI = presupuestoDelPaso({ env: { GITHUB_ACTIONS: 'true' }, ciYml: CI_YML });
  assert.equal(enCI.limiteS, techoDelJob(CI_YML) - MARGEN_DEL_JOB_S);
  const ciego = presupuestoDelPaso({ env: { GITHUB_ACTIONS: 'true' }, ciYml: '' });
  assert.equal(ciego.limiteS, null);
  assert.match(ciego.origen, /SIN PODER LEER/, 'en CI sin techo legible se DICE, no se calla');
  assert.equal(presupuestoDelPaso({ env: { META_PRESUPUESTO_S: 'mucho' } }).limiteS, null);
});

test('SCRUM-935d · 🔴 con el presupuesto agotado, CORTA; con margen, no', () => {
  const p = { limiteS: 100 };
  assert.equal(debeCortar(99.9, p), false);
  assert.equal(debeCortar(100, p), true);
  assert.equal(debeCortar(5000, p), true);
  assert.equal(debeCortar(5000, { limiteS: null }), false, 'sin presupuesto no se corta');
});

const CENSO = [
  { guard: 'a.test.mjs', mutaciones: [1, 2, 3] },
  { guard: 'b.test.mjs', mutaciones: [] },
  { guard: 'c.test.mjs', mutaciones: [1, 2] },
  { guard: 'd.test.mjs', mutaciones: [1] },
];

test('SCRUM-935d · lo pendiente empieza en la mutación del corte, no en la primera del guard', () => {
  const p = pendientesDesde(CENSO, 0, 2);
  assert.deepEqual(p, [
    { guard: 'a.test.mjs', mutaciones: 1 },
    { guard: 'c.test.mjs', mutaciones: 2 },
    { guard: 'd.test.mjs', mutaciones: 1 },
  ]);
  // Control: juzgadas + pendientes = el censo entero, en cualquier punto de corte.
  const total = CENSO.reduce((n, c) => n + c.mutaciones.length, 0);
  for (const [g, d, juzgadas] of [[0, 0, 0], [0, 2, 2], [2, 1, 4], [3, 0, 5]]) {
    const pend = pendientesDesde(CENSO, g, d).reduce((n, x) => n + x.mutaciones, 0);
    assert.equal(juzgadas + pend, total, `corte en guard ${g}, mutación ${d}`);
  }
});

test('SCRUM-935d · el mensaje del corte nombra CADA guard sin juzgar y cuántas le faltan', () => {
  const pendientes = pendientesDesde(CENSO, 2, 0);
  const m = mensajeDeCorte({ juzgadas: 3, pendientes, transcurridoS: 1651.4, presupuesto: { limiteS: 1650, origen: 'x' } });
  assert.match(m, /CORTO YO/);
  assert.match(m, /Juzgadas 3 de 6 mutaciones\. SIN JUZGAR 3, en 2 guard/);
  assert.match(m, /c\.test\.mjs \(2\)/);
  assert.match(m, /d\.test\.mjs \(1\)/);
  assert.doesNotMatch(m, /a\.test\.mjs/);
});

test('SCRUM-935d · el coste por guard nombra a los que pasan de 60 s, con la población', () => {
  const lineas = guardsCaros([
    { guard: 'barato.test.mjs', mutaciones: 2, inicioS: 0 },
    { guard: 'caro.test.mjs', mutaciones: 26, inicioS: 10 },
    { guard: 'ultimo.test.mjs', mutaciones: 1, inicioS: 10 + GUARD_CARO_S + 50 },
  ], 10 + GUARD_CARO_S + 50 + 5);
  assert.match(lineas[0], /3 guards medidos/);
  assert.match(lineas[0], /1 pasan de 60 s/);
  assert.equal(lineas.length, 2);
  assert.match(lineas[1], /caro\.test\.mjs · 110 s \(26 mutaciones/);
});

/** El código del bloque principal, SIN comentarios (A23 nº 2), impreso por el compilador. */
function bloquePrincipalSinComentarios() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs'), 'utf8');
  const sf = ts.createSourceFile('m.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const si = sf.statements.find((s) => ts.isIfStatement(s) && /ejecutadoDirectamente/.test(s.expression.getText(sf)));
  assert.ok(si, 'NO PUDE MIRAR: no encuentro el bloque `if (ejecutadoDirectamente(…))`');
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, si.thenStatement, sf);
}

test('SCRUM-935d · 🔴 EL BUCLE: mira el presupuesto antes de cada pasada, y el corte sale como CIEGA', () => {
  const c = bloquePrincipalSinComentarios();
  const pos = (s, desde = 0) => c.indexOf(s, desde);
  const limpia = pos('await correr(guard)');
  const mutar = pos('await aplicarUna(mut, guard, limpia)');
  assert.ok(limpia > 0 && mutar > 0, 'NO PUDE MIRAR: no encuentro la pasada limpia o la mutada en el bucle');
  const primero = pos('debeCortar(process.uptime(), presupuesto)');
  assert.ok(primero > 0 && primero < limpia, 'no se mira el presupuesto antes de la pasada limpia');
  const segundo = pos('debeCortar(process.uptime(), presupuesto)', primero + 1);
  assert.ok(segundo > limpia && segundo < mutar, 'no se mira el presupuesto antes de cada mutación');
  assert.ok(pos('break bucle') > segundo && pos('break bucle') < mutar, 'el corte de una mutación no sale del bucle entero');
  const mensaje = pos('mensajeDeCorte(');
  assert.ok(mensaje > mutar, 'el corte no se informa');
  assert.ok(pos('ciegos.push(msg)', mensaje) > mensaje, 'el corte no cuenta como CIEGA: saldría con 0');
  assert.ok(pos('ciegos.push(msg)', mensaje) < pos('sueloDeEjecucion('), 'el corte tiene que contarse antes del suelo de ejecución');
});

// tests/scrum810-el-suelo-a-la-primera.test.mjs — SCRUM-810
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// Un suelo que sólo habla cuando ya se ha perdido la mitad no es un suelo: es una lápida
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// ── LOS DOS NÚMEROS, PEGADOS (es el control que decide) ───────────────────────────────────
// Provocado sobre una COPIA del árbol, quitando declaraciones DE UNA EN UNA:
//     · suelo CABLEADO (20 / 54)  → calla hasta la 63ª pérdida. Habla en la 64ª.
//     · suelo CONTRA MAIN         → habla en la 1ª.
// Sesenta y tres declaraciones —el 54% de la vigilancia de hoy— podían desaparecer en
// silencio. Y la pérdida de a una OCURRE: el 7-sep tres sesiones escribieron un campo no
// literal y el lector descartó su declaración sin decir nada.
//
// ── EL FILO, CONTESTADO ANTES DE ESCRIBIR NADA ────────────────────────────────────────────
// Un número cableado es un censo congelado. Derivarlo de la población de HOY es circular: lo
// que el suelo vigila ES la población. Por eso se deriva de `origin/main`, que es un árbol
// DISTINTO del que se juzga — y que se pone al día solo, sin que nadie recuerde subir nada.
// Crecer no dispara nada; perder habla a la primera; retirar A PROPÓSITO cuesta una línea en
// `RETIRADAS_A_PROPOSITO`, en el mismo commit, y el diff lo dice en voz alta.
//
// 🔴 Y el equilibrio que no se puede perder: UN SUELO QUE SALTA SIEMPRE SE DESACTIVA ANTES QUE
// UNO QUE NO SALTA NUNCA. Por eso el crecimiento es gratis, y hay un test que lo fija.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)
import { sueloDelCenso } from '../scripts/meta-guard-mutaciones.mjs';
import {
  RAMA_DE_REFERENCIA, RETIRADAS_A_PROPOSITO, referenciaDe, declaracionesEn,
  declaracionesEnElArbol, perdidasContraLaReferencia, sueloContraMain,
} from '../scripts/_suelo-contra-main.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_suelo-contra-main.mjs',
    a: '    if (perdidas.length >= 0) return null;',
    de: '  if (perdidas.length === 0) return null;',
    cae: 'perder UNA declaración ya habla, y nombra el guard',
  },
  {
    fichero: 'scripts/_suelo-contra-main.mjs',
    a: '    if (ahora !== antes) perdidas.push({ guard, antes, ahora });',
    de: '    if (ahora < antes) perdidas.push({ guard, antes, ahora });',
    cae: 'CRECER no dispara nada: un suelo que salta siempre se desactiva',
  },
  {
    fichero: 'scripts/_suelo-contra-main.mjs',
    a: '  const eximido = new Set();',
    de: '  const eximido = new Set(retiradas.map((r) => r.guard));',
    cae: 'la retirada A PROPÓSITO se puede hacer sin pelearse con el suelo',
  },
];

// ¿está `origin/main` en este clon? Si no está, los tests que dependen de la ref se SALTAN
// DECLARANDO POR QUÉ — nunca en silencio, y nunca dando por verde lo que no se ha mirado.
const BASE = (() => {
  try {
    execFileSync('git', ['rev-parse', '--verify', RAMA_DE_REFERENCIA], { cwd: RAIZ, stdio: 'ignore' });
    return referenciaDe(RAIZ);
  } catch { return null; }
})();
// 🔴 El motivo va como LITERAL dentro del propio `skip`, no por variable: SCRUM-456 exige que la
// expresión produzca TEXTO legible, porque en el log un salto mudo no se distingue de uno roto.

test('perder UNA declaración ya habla, y nombra el guard', () => {
  // Los DOS números, pegados. La referencia es sintética a propósito: el control mide el
  // MECANISMO, no el árbol de hoy, que cambia cada hora.
  const referencia = new Map([
    ['a.test.mjs', 3],
    ['b.test.mjs', 60],
    ['c.test.mjs', 54],
  ]);
  const total = [...referencia.values()].reduce((s, n) => s + n, 0); // 117, como el árbol real

  // ① EL SUELO VIEJO: se le quitan 63 y sigue callado. Las cifras de guards y declaraciones son
  // las MEDIDAS en el árbol el 7-sep (41 / 117), no inventadas: el mapa de arriba sólo sirve para
  // la mecánica de la pérdida, y con sus 3 guards saltaría el otro suelo, el de guards.
  assert.equal(sueloDelCenso({ guards: 41, declaraciones: total - 63 }), null,
    'el suelo cableado tendría que seguir callado con 63 pérdidas: si no, este control no mide nada');
  assert.ok(sueloDelCenso({ guards: 41, declaraciones: total - 64 }),
    'y en la 64ª tiene que hablar: ahí está la lápida, 63 pérdidas después');

  // ② EL SUELO NUEVO: se le quita UNA y habla.
  const actual = new Map(referencia);
  actual.set('a.test.mjs', 2);
  const r = perdidasContraLaReferencia(actual, referencia);
  assert.equal(r.medible, true);
  assert.deepEqual(r.perdidas, [{ guard: 'a.test.mjs', antes: 3, ahora: 2 }]);
  const dicho = sueloContraMain(r);
  assert.ok(dicho, 'con una declaración perdida el suelo tiene que hablar');
  assert.match(dicho, /a\.test\.mjs: 3 → 2/);

  // y un guard que desaparece ENTERO también
  const sinGuard = new Map(referencia);
  sinGuard.delete('b.test.mjs');
  assert.match(sueloContraMain(perdidasContraLaReferencia(sinGuard, referencia)), /b\.test\.mjs: 60 → 0/);
});

test('CRECER no dispara nada: un suelo que salta siempre se desactiva', () => {
  const referencia = new Map([
    ['a.test.mjs', 3],
    ['b.test.mjs', 5],
  ]);
  const crecido = new Map([
    ['a.test.mjs', 9],
    ['b.test.mjs', 5],
    ['nuevo.test.mjs', 4],
  ]);
  const r = perdidasContraLaReferencia(crecido, referencia);
  assert.equal(r.medible, true);
  assert.deepEqual(r.perdidas, [], 'añadir cobertura NO puede poner el suelo en rojo');
  assert.equal(sueloContraMain(r), null);
});

test('la retirada A PROPÓSITO se puede hacer sin pelearse con el suelo', () => {
  const referencia = new Map([
    ['viejo.test.mjs', 4],
    ['otro.test.mjs', 2],
  ]);
  const actual = new Map([['otro.test.mjs', 2]]); // se retiró `viejo` entero
  assert.ok(sueloContraMain(perdidasContraLaReferencia(actual, referencia)),
    'sin declararla, la retirada tiene que doler');
  const conRetirada = [{ guard: 'viejo.test.mjs', motivo: 'su sujeto se borró del producto', fecha: '2026-09-07' }];
  const r = perdidasContraLaReferencia(actual, referencia, conRetirada);
  assert.deepEqual(r.perdidas, [], 'una retirada declarada NO puede seguir doliendo: si duele, el suelo está mal puesto');
  assert.equal(sueloContraMain(r), null);
});

test('no haber podido mirar la referencia NO es verde', () => {
  const r = perdidasContraLaReferencia(new Map([['a.test.mjs', 1]]), null);
  assert.equal(r.medible, false);
  assert.match(r.motivo, /no he mirado/, 'tiene que decir que no ha mirado, no que no falta nada');
});

test('la lista de retiradas es una lista, y cada renglón dice guard, motivo y fecha', () => {
  assert.ok(Array.isArray(RETIRADAS_A_PROPOSITO));
  for (const r of RETIRADAS_A_PROPOSITO) {
    assert.ok(r.guard && r.motivo && r.fecha, `retirada sin guard/motivo/fecha: ${JSON.stringify(r)}`);
    assert.match(r.fecha, /^\d{4}-\d{2}-\d{2}$/);
  }
});

// 🔴 La referencia es la BASE DE FUSIÓN, no la punta de main. Contra la punta, este mismo test
// salió ROJO la primera vez —main había avanzado con SCRUM-804 y sus 3 declaraciones, y esta
// rama «había perdido» algo que nunca tuvo—. Ir por detrás no es haber perdido cobertura.
test('✅ CONTROL POSITIVO: con el árbol tal cual, el suelo CALLA', {
  skip: BASE ? false : 'sin origin/main en este clon · arréglalo con: git fetch origin main',
}, () => {
  const referencia = declaracionesEn(BASE, RAIZ);
  assert.ok(referencia, `no pude leer la base de fusión ${BASE}`);
  assert.ok(referencia.size >= 1, 'cero guards en la referencia no es un cero: es no haber mirado');
  const r = perdidasContraLaReferencia(declaracionesEnElArbol(RAIZ), referencia);
  assert.equal(sueloContraMain(r), null,
    'el árbol tal cual tiene que estar en verde: un suelo que salta siempre se desactiva');
});

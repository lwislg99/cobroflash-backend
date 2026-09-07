// tests/scrum716-ritmo-de-despliegue.test.mjs — SCRUM-716 (pieza 2 de tres)
//
// Sin gate: módulo puro. Ni BD, ni red, ni git, ni reloj.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CONGELADO Y RETRASADO NO SON LO MISMO, Y «NO SE SABE» NO ES NINGUNO DE LOS DOS.
//
// El 6-sep el vigía pintó igual dos situaciones distintas —producción movida y producción
// quieta— y eso mandó a buscar un healthcheck sano y bloqueó cinco ramas media jornada.
//
// 🔴 EL TERCER VALOR ES EL QUE VIGILA ESTE FICHERO. Devolver dos valores en vez de tres es
// reintroducir, por la otra cara, el defecto que cerró SCRUM-716: allí «no se pudo contar»
// entraba por la misma puerta que «no hay hueco» y el vigía decía «al día» sin haber mirado.
// Aquí sería «no hay lectura anterior» entrando por la puerta de «congelado».
//
// ⚠️ ESTA PIEZA NO LA LLAMA NADIE TODAVÍA, y eso también se vigila abajo: conectarla necesita
// autorización sobre `vigilante-de-despliegue.mjs`, que no está dada.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  ritmoDeDespliegue, DESPLIEGA, CONGELADO, NO_SE_SABE,
} from '../scripts/_ritmo-de-despliegue.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = 'ff4e1c4a14f474d0fb4095cb0643e069388e4935';
const B = '50312d327c0f7ddcf8a0670ab54c46407a7bba9d';
const lect = (v) => ({ versionDeProduccion: v });

// ═══ ① LOS TRES VALORES, CADA UNO PROVOCADO CON SU CASO ══════════════════════════════════

test('SCRUM-716 · 🔴 DESPLIEGA: producción se movió entre las dos lecturas', () => {
  // Es el caso REAL del 6-sep: prod ff4e1c4a → 50312d32 en dos horas. Iba por detrás de `main`,
  // pero se movía; llamar a eso «congelado» fue lo que costó media jornada de cinco ramas.
  const r = ritmoDeDespliegue(lect(A), lect(B));
  assert.equal(r.ritmo, DESPLIEGA,
    `🔴 producción pasó de ${A.slice(0, 8)} a ${B.slice(0, 8)} y el ritmo salió «${r.ritmo}». `
    + 'Se movió: eso es un retraso, no un incidente.');
  assert.match(r.motivo, /ff4e1c4a[\s\S]*50312d32/,
    `🔴 el motivo no nombra los dos commits sobre los que se decidió: ${JSON.stringify(r.motivo)}.`);
});

test('SCRUM-716 · 🔴 CONGELADO: producción NO se movió', () => {
  // Y éste es el incidente: nueve días, treinta healthchecks fallando y la web en pie.
  const r = ritmoDeDespliegue(lect(A), lect(A));
  assert.equal(r.ritmo, CONGELADO,
    `🔴 producción sigue en el mismo commit y el ritmo salió «${r.ritmo}».`);
  assert.match(r.motivo, /ff4e1c4a/, '🔴 el motivo no dice en qué commit se quedó.');
});

test('SCRUM-716 · 🔴 EL QUE DECIDE: sin lectura anterior es NO SE SABE, y NO «congelado»', () => {
  // 🔴 Si esto devolviera CONGELADO, el vigía diría «producción está parada» la primera vez que
  // corriera — y en CI corre siempre por primera vez, porque el runner arranca limpio. Sería una
  // alarma que canta sin haber medido: el defecto de SCRUM-716 con otro traje.
  for (const anterior of [null, undefined]) {
    const r = ritmoDeDespliegue(anterior, lect(A));
    assert.equal(r.ritmo, NO_SE_SABE,
      `🔴 sin lectura anterior (${String(anterior)}) el ritmo salió «${r.ritmo}». Sin dato previo `
      + 'no hay congelado: hay ignorancia, y decirlo es la mitad del valor de esta pieza.');
    assert.match(r.motivo, /no hay lectura anterior/,
      `🔴 el motivo no dice que falta la lectura anterior: ${JSON.stringify(r.motivo)}.`);
  }
});

// ═══ ② EL CONTROL NEGATIVO QUE PIDE EL ENCARGO ═══════════════════════════════════════════

test('SCRUM-716 · ✅ NEGATIVO: dos lecturas IGUALES no devuelven «no se sabe»', () => {
  // Un discriminador que se declara ciego siempre es tan inútil como uno que dice congelado
  // siempre — y se desactiva antes, porque molesta todos los días. Es el mismo control con el que
  // se cerró SCRUM-716.
  const r = ritmoDeDespliegue(lect(A), lect(A));
  assert.notEqual(r.ritmo, NO_SE_SABE,
    '🔴 con las DOS lecturas presentes y legibles, «no se sabe» es una respuesta falsa: sí se '
    + 'sabe, y la respuesta es que no se ha movido.');
  assert.equal(r.ritmo, CONGELADO);
});

test('SCRUM-716 · ✅ NEGATIVO: dos lecturas DISTINTAS tampoco', () => {
  const r = ritmoDeDespliegue(lect(A), lect(B));
  assert.notEqual(r.ritmo, NO_SE_SABE, '🔴 con las dos puntas legibles hay respuesta.');
  assert.equal(r.ritmo, DESPLIEGA);
});

// ═══ ③ LO QUE NO ES UN SHA NO ES UNA LECTURA ═════════════════════════════════════════════

test('SCRUM-716 · 🔴 una lectura ilegible da NO SE SABE, no un veredicto a medias', () => {
  // El fallback de `env.ts` es real y no una hipótesis: `RAILWAY_GIT_COMMIT_SHA || String(Date.now())`.
  // Sin la variable, producción publica un NÚMERO. Compararlo daría «se movió» todas las veces.
  const basura = ['1788742571305', '', '   ', null, undefined, 'no-soy-un-sha', 'zzzzzzzz', 'abc'];
  for (const v of basura) {
    assert.equal(ritmoDeDespliegue(lect(v), lect(A)).ritmo, NO_SE_SABE,
      `🔴 con la lectura ANTERIOR ilegible (${JSON.stringify(v)}) se ha emitido un ritmo.`);
    assert.equal(ritmoDeDespliegue(lect(A), lect(v)).ritmo, NO_SE_SABE,
      `🔴 con la lectura DE AHORA ilegible (${JSON.stringify(v)}) se ha emitido un ritmo.`);
  }
  // ✅ SUELO del propio caso: la basura de arriba tiene que ser basura de verdad. Si `ES_SHA`
  // aceptara cualquier cosa, este test pasaría sin probar nada.
  assert.equal(ritmoDeDespliegue(lect(A), lect(B)).ritmo, DESPLIEGA,
    '🔴 el filtro rechaza también lo bueno: entonces su «no se sabe» no significa nada.');
});

test('SCRUM-716 · 🔴 el sha ABREVIADO es el mismo commit, y el prefijo va declarado', () => {
  // `git` abrevia: una lectura puede traer 8 caracteres (el renglón de constancia) y la otra 40
  // (`/version`). Exigir la misma longitud daría «no se sabe» SIEMPRE en cuanto se comparara una
  // constancia con una lectura fresca, que es justo lo que la pieza tiene que poder hacer.
  assert.equal(ritmoDeDespliegue(lect(A.slice(0, 8)), lect(A)).ritmo, CONGELADO,
    '🔴 `ff4e1c4a` y su sha completo se están leyendo como commits distintos.');
  assert.equal(ritmoDeDespliegue(lect(A), lect(A.slice(0, 8))).ritmo, CONGELADO,
    '🔴 el orden importa, y no debería: la comparación por prefijo es simétrica.');
  // Y mayúsculas/espacios no son un despliegue.
  assert.equal(ritmoDeDespliegue(lect('  ' + A.toUpperCase() + ' '), lect(A)).ritmo, CONGELADO,
    '🔴 un `\\n` o unas mayúsculas se están leyendo como que producción se ha movido.');
});

// ═══ ④ LO QUE ESTA PIEZA **NO** HACE, Y SE VIGILA ════════════════════════════════════════

test('SCRUM-716 · ⛔ NO la llama nadie: la pieza está aislada a propósito', () => {
  // Conectarla al vigía necesita autorización del fundador sobre `vigilante-de-despliegue.mjs`,
  // y no está dada. Este test es el que se pondrá rojo el día que alguien la enchufe sin ella —
  // y ese día se borra A MANO, diciendo quién autorizó.
  const consumidores = [];
  for (const dir of ['scripts', 'tests', 'src']) {
    const base = path.join(RAIZ, dir);
    const pila = [base];
    while (pila.length) {
      const d = pila.pop();
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { pila.push(p); continue; }
        if (!/\.(mjs|js|ts)$/.test(e.name)) continue;
        const rel = path.relative(RAIZ, p).split(path.sep).join('/');
        if (rel === 'scripts/_ritmo-de-despliegue.mjs') continue;   // él mismo
        if (rel === 'tests/scrum716-ritmo-de-despliegue.test.mjs') continue; // este test
        const codigo = fs.readFileSync(p, 'utf8');
        if (!codigo.includes('ritmoDeDespliegue')) continue;
        // Por AST, no por texto: un comentario que nombre la función no es un consumidor.
        const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true,
          /\.ts$/.test(p) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
        let llama = false;
        const v = (n) => {
          if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
            && n.expression.text === 'ritmoDeDespliegue') llama = true;
          ts.forEachChild(n, v);
        };
        v(sf);
        if (llama) consumidores.push(rel);
      }
    }
  }
  assert.deepEqual(consumidores, [],
    `🔴 alguien ha CONECTADO \`ritmoDeDespliegue\`: ${consumidores.join(', ')}. La pieza nace `
    + 'aislada porque enchufarla toca `vigilante-de-despliegue.mjs`, que es del fundador. Si la '
    + 'autorización ya existe, se borra este test A MANO y se dice en la entrada quién la dio.');
});

test('SCRUM-716 · 🔴 SUELO: los tres valores son DISTINTOS entre sí', () => {
  // Un enumerado donde dos constantes valgan lo mismo haría pasar todo lo de arriba sin distinguir
  // nada. Es el suelo del propio vocabulario.
  const vals = [DESPLIEGA, CONGELADO, NO_SE_SABE];
  assert.equal(new Set(vals).size, 3,
    `🔴 los tres valores no son tres: ${JSON.stringify(vals)}. Si dos coinciden, esta pieza dice `
    + 'lo mismo para casos distintos y no discrimina nada.');
  for (const v of vals) assert.equal(typeof v, 'string');
});

/** 🔴 LAS MUTACIONES QUE TIENEN QUE TUMBARME (contrato de SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El defecto que este ticket cerró, por la otra cara: «no hay dato» dicho como «congelado».
    // ⚠️ SUSTITUYE EL BLOQUE ENTERO, y eso se aprendió midiendo: la primera versión cortaba a
    // media llamada y dejaba el fichero SIN CERRAR, así que el runner dictó «EL FICHERO MURIÓ AL
    // MUTAR» — el guard se ponía rojo, pero por un error de sintaxis y no por el defecto. Una
    // mutación con más radio que el defecto que imita no prueba nada.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: "  if (anterior == null) {\n    return noSeSabe('no hay lectura anterior con la que comparar. NO es «congelado»: es que '\n      + 'nadie ha mirado antes. Hoy en CI es el caso normal, porque el runner arranca limpio.');\n  }",
    a: "  if (anterior == null) {\n    return { ritmo: CONGELADO, motivo: 'sin lectura anterior' };\n  }",
    cae: 'EL QUE DECIDE: sin lectura anterior es NO SE SABE, y NO «congelado»',
  },
  {
    // ② El discriminador invertido: lo movido leído como quieto.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: '  if (mismoCommit(antes, ahora)) {',
    a: '  if (!mismoCommit(antes, ahora)) {',
    cae: 'DESPLIEGA: producción se movió entre las dos lecturas',
  },
  {
    // ③ El filtro de lo ilegible, apagado: un número del fallback de `env.ts` pasaría por sha.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: '  if (!ES_SHA.test(s) || TODO_DIGITOS.test(s)) return null;',
    a: '  if (false) return null;',
    cae: 'una lectura ilegible da NO SE SABE, no un veredicto a medias',
  },
];

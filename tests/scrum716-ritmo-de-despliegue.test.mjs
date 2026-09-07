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
  salidaConRitmo, lecturaDeLaConstancia, ultimaLectura,
} from '../scripts/_ritmo-de-despliegue.mjs';
// El veredicto REAL, para no reimplementarlo en los casos de salida: lo que se juzga es la
// combinación de los dos, y con un veredicto de mentira se estaría juzgando la mentira.
import {
  veredictoDeDespliegue, constanciaDeEjecucion,
} from '../scripts/_vigilante-de-despliegue.mjs';

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

// ⚠️ AQUÍ VIVÍA `⛔ NO la llama nadie`, un test por AST que se ponía rojo si alguien conectaba la
// pieza al vigía. Cumplió exactamente su función —impedir que se enchufara antes de tiempo— y se
// retira A MANO, como estaba escrito que había que hacerlo: **el fundador autorizó tocar
// `vigilante-de-despliegue.mjs` el 7-sep-2026, con las palabras «Sí autorizo»**. En su lugar entra
// el de abajo, que ya no vigila que NADIE la llame sino que la llame QUIEN DEBE.

test('SCRUM-716 · 🔴 el vigía SÍ la llama ahora, y por AST', () => {
  // El reverso del que se retiró. Si un merge desconectara la pieza, el vigía volvería a pintar
  // igual un incidente y un retraso — y todo lo demás de este fichero seguiría en verde, porque
  // la función pura seguiría siendo correcta. Sin este test, el defecto vuelve en silencio.
  const rel = 'scripts/vigilante-de-despliegue.mjs';
  const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const llamadas = new Set();
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) llamadas.add(n.expression.text);
    ts.forEachChild(n, v);
  };
  v(sf);
  for (const fn of ['ritmoDeDespliegue', 'salidaConRitmo', 'ultimaLectura']) {
    assert.ok(llamadas.has(fn),
      `🔴 el vigía ya no llama a \`${fn}\`. Sin las tres, vuelve a pintar igual «producción `
      + 'parada» y «producción desplegando despacio», que es lo que costó media jornada el 6-sep.');
  }
  // Y que la salida del proceso sea la CALIFICADA, no la del veredicto suelto: si esto se
  // revierte, el retraso que se cierra solo vuelve a ponerse en rojo.
  assert.match(codigo, /process\.exit\(final\.salida\);/,
    '🔴 el vigía ha vuelto a salir con `v.salida`. Entonces el ritmo se calcula, se imprime… y no '
    + 'decide nada: el 6-sep volvería a bloquear ramas.');
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

// ═══ ⑤ LAS SALIDAS · el ticket entero está aquí ══════════════════════════════════════════

const AHORA = 1757239200;
const PROD_A = 'ff4e1c4a14f474d0fb4095cb0643e069388e4935';
const PROD_B = '50312d327c0f7ddcf8a0670ab54c46407a7bba9d';
const MAIN_1 = '388dc0454f9e8a1b2c3d4e5f60718293a4b5c6d7';
const MAIN_2 = 'c6c8426178695a4b3c2d1e0f9a8b7c6d5e4f3a2b';

/** El veredicto REAL del vigía para una situación, sin reimplementarlo. */
const veredicto = (d) => veredictoDeDespliegue({
  conoceElCommit: true, estaEnMain: true, ahoraEpoch: AHORA, ...d,
});
/** Un hueco de `n` horas, derivado de `AHORA` y no escrito a mano. */
const hace = (n) => AHORA - Math.round(n * 3600);

test('SCRUM-716 · 🔴 EL CASO DEL 6-sep: RETRASADO PERO DESPLEGANDO, y NO bloquea', () => {
  // Reproducido tal cual costó media jornada:
  //   20:21 UTC → prod ff4e1c4a · main 388dc045 · hueco  9,5 h
  //   22:12 UTC → prod 50312d32 · main c6c84261 · hueco 10,4 h
  // Producción SE MOVIÓ. El vigía de entonces pintó las dos igual, «atrasado» con salida 1, y eso
  // mandó a buscar un healthcheck sano y bloqueó cinco ramas.
  const antes = veredicto({
    versionDeProduccion: PROD_A, shaDeMain: MAIN_1,
    commitsPorDelante: 8, epochDelPrimeroSinDesplegar: hace(9.5),
  });
  const ahora = veredicto({
    versionDeProduccion: PROD_B, shaDeMain: MAIN_2,
    commitsPorDelante: 10, epochDelPrimeroSinDesplegar: hace(10.4),
  });

  // ANTES: el veredicto suelto, que es lo que se emitía aquel día.
  assert.equal(ahora.salida, 1,
    '🔴 SUELO: el veredicto suelto ya no da 1 para 10,4 h de hueco, así que este test no está '
    + 'midiendo el caso que dice medir.');
  assert.equal(antes.salida, 1, '🔴 SUELO: la lectura de las 20:21 tampoco.');

  // DESPUÉS: calificado por el ritmo.
  const r = ritmoDeDespliegue({ versionDeProduccion: PROD_A }, { versionDeProduccion: PROD_B });
  assert.equal(r.ritmo, DESPLIEGA, `🔴 producción se movió y el ritmo dice «${r.ritmo}».`);

  const f = salidaConRitmo(ahora, r);
  assert.equal(f.salida, 0,
    `🔴 el 6-sep vuelve a salir con salida ${f.salida}. Un retraso que se está cerrando solo NO `
    + 'puede bloquear cinco ramas media jornada: producción pasó de ff4e1c4a a 50312d32 en dos '
    + 'horas, o sea que desplegaba.');
  assert.equal(f.califica, true, '🔴 el ritmo no ha llegado a calificar este veredicto.');
  assert.match(f.titulo, /RETRASADO, PERO DESPLEGANDO/,
    `🔴 la salida es 0 pero no DICE por qué: ${JSON.stringify(f.titulo)}. Bajar el ruido no es `
    + 'callarse.');
  assert.match(f.detalle, /10\.4 h/, '🔴 no dice cuánto hueco hay, que es la mitad del aviso.');
});

test('SCRUM-716 · 🔴 CONGELADO DE VERDAD pasado el margen: CANTA (salida 1)', () => {
  // 🔴 EL CONTROL QUE PROTEGE LA ALARMA DE LOS NUEVE DÍAS. Si al abaratar el retraso este caso se
  // cayera, el ticket dejaría el vigía PEOR que antes: mudo justo en lo que vino a detectar.
  const v = veredicto({
    versionDeProduccion: PROD_A, shaDeMain: MAIN_2,
    commitsPorDelante: 30, epochDelPrimeroSinDesplegar: hace(9 * 24),
  });
  assert.equal(v.veredicto, 'atrasado', '🔴 SUELO: nueve días de hueco ya no son «atrasado».');

  const r = ritmoDeDespliegue({ versionDeProduccion: PROD_A }, { versionDeProduccion: PROD_A });
  assert.equal(r.ritmo, CONGELADO, '🔴 producción no se movió y el ritmo no lo dice.');

  const f = salidaConRitmo(v, r);
  assert.equal(f.salida, 1,
    `🔴 producción CONGELADA con ${v.horas.toFixed(1)} h de hueco sale con ${f.salida}. Es el caso `
    + 'de los nueve días: treinta despliegues fallando, la web en pie y nadie enterándose. Aquí '
    + 'canta, y este número no se abarata por nada.');
  assert.match(f.titulo, /CONGELADA/, '🔴 el título no nombra lo que pasa.');
});

test('SCRUM-716 · ✅ NO_SE_SABE con hueco: ni verde ni congelado (salida 2)', () => {
  // La primera ejecución en CI, y cada vez que la caché se desaloje. Es el caso NORMAL, no el raro.
  const v = veredicto({
    versionDeProduccion: PROD_B, shaDeMain: MAIN_2,
    commitsPorDelante: 10, epochDelPrimeroSinDesplegar: hace(10.4),
  });
  const r = ritmoDeDespliegue(null, { versionDeProduccion: PROD_B });
  assert.equal(r.ritmo, NO_SE_SABE, '🔴 sin lectura anterior el ritmo no es «no se sabe».');

  const f = salidaConRitmo(v, r);
  assert.notEqual(f.salida, 0,
    '🔴 hay hueco y no se sabe si se está cerrando, y sale VERDE. Es exactamente el defecto del '
    + 'que nació este ticket: confundir ceguera con «al día».');
  assert.notEqual(f.salida, 1,
    '🔴 sale como si estuviera congelada, y eso NO se ha medido: nadie ha mirado antes.');
  assert.equal(f.salida, 2, `🔴 la ceguera tiene su código y es el 2; salió ${f.salida}.`);
});

test('SCRUM-716 · ✅ SIN HUECO sigue verde aunque no haya lectura anterior', () => {
  // 🔴 EL QUE IMPIDE QUE EL VIGÍA SE VUELVA CIEGO SIEMPRE — el modo de fallo que se desactiva
  // antes, porque molesta todos los días. Si no hay hueco no hay nada que diagnosticar, y da
  // igual que la caché se haya perdido.
  const v = veredicto({ versionDeProduccion: PROD_A, shaDeMain: PROD_A, commitsPorDelante: 0 });
  assert.equal(v.salida, 0, '🔴 SUELO: «sin hueco» ya no es salida 0.');
  const f = salidaConRitmo(v, ritmoDeDespliegue(null, { versionDeProduccion: PROD_A }));
  assert.equal(f.salida, 0,
    '🔴 producción está EN lo mismo que `main` y el vigía sale en 2 por no tener caché. Un vigía '
    + 'que se pone ciego siempre es tan inútil como uno que se pone verde siempre.');
  assert.equal(f.califica, false, '🔴 el ritmo no debería pintar nada cuando no hay hueco.');
});

test('SCRUM-716 · ✅ producción FUERA de `main` canta pase lo que pase con el ritmo', () => {
  // Un force-push, un revert o un despliegue a mano. El ritmo no explica eso, así que no lo
  // abarata: aunque producción se esté moviendo, sigue siendo 1.
  const v = veredicto({ versionDeProduccion: PROD_A, shaDeMain: MAIN_2, estaEnMain: false });
  assert.equal(v.salida, 1, '🔴 SUELO: producción fuera de `main` ya no canta por su cuenta.');
  assert.equal(v.horas, null, '🔴 SUELO: este camino debería venir sin hueco medido.');
  for (const r of [
    ritmoDeDespliegue({ versionDeProduccion: PROD_A }, { versionDeProduccion: PROD_B }),
    ritmoDeDespliegue(null, { versionDeProduccion: PROD_B }),
  ]) {
    const f = salidaConRitmo(v, r);
    assert.equal(f.salida, 1,
      `🔴 con ritmo «${r.ritmo}» la salida bajó a ${f.salida}. Producción corriendo algo que no `
      + 'está en `main` no lo explica el ritmo: sigue cantando.');
    assert.equal(f.califica, false, '🔴 el ritmo no debería calificar un hueco sin medir.');
  }
});

test('SCRUM-716 · ✅ un veredicto CIEGO no lo rescata el ritmo', () => {
  const v = veredicto({ versionDeProduccion: null, shaDeMain: MAIN_2 });
  assert.equal(v.salida, 2, '🔴 SUELO: producción sin responder ya no es ciego.');
  const f = salidaConRitmo(v, ritmoDeDespliegue({ versionDeProduccion: PROD_A }, { versionDeProduccion: PROD_B }));
  assert.equal(f.salida, 2,
    '🔴 el veredicto era ciego y el ritmo le ha puesto una salida. Si no se pudo leer producción, '
    + 'no hay nada que calificar.');
});

// ═══ ⑥ LA LECTURA ANTERIOR SE SACA DE LA CONSTANCIA DE VERDAD ════════════════════════════

test('SCRUM-716 · 🔴 el `prod=` se lee de un renglón REAL, no de uno copiado a mano', () => {
  // 🔴 EL RENGLÓN NO SE ESCRIBE AQUÍ: se lo pide a `constanciaDeEjecucion`, que es quien lo
  // produce en el vigía. Con una cadena copiada, el día que cambie el formato este test seguiría
  // verde y el historial estaría leyendo el vacío.
  const datos = {
    versionDeProduccion: PROD_A, shaDeMain: MAIN_2, conoceElCommit: true, estaEnMain: true,
    commitsPorDelante: 8, epochDelPrimeroSinDesplegar: hace(9.5), ahoraEpoch: AHORA,
  };
  const { renglon } = constanciaDeEjecucion(veredictoDeDespliegue(datos), datos);
  const l = lecturaDeLaConstancia(renglon);
  assert.ok(l, `🔴 no se puede sacar la lectura del renglón que escribe el vigía: ${renglon}`);
  assert.ok(PROD_A.startsWith(l.versionDeProduccion),
    `🔴 el \`prod=\` leído (${l.versionDeProduccion}) no es el commit que se escribió (${PROD_A.slice(0, 8)}).`);
  // Y sirve para lo que existe: comparado consigo mismo, congelado.
  assert.equal(ritmoDeDespliegue(l, { versionDeProduccion: PROD_A }).ritmo, CONGELADO,
    '🔴 la lectura sacada del renglón no se puede comparar con una lectura fresca.');
});

test('SCRUM-716 · 🔴 un renglón CIEGO (`prod=?`) no es una lectura, y no tapa a la buena', () => {
  // El vigía escribe `?` cuando no supo leer producción. Tomar eso por una lectura diría
  // «despliega» en cuanto volviera a leerse un sha. Y quedarse sólo con la ÚLTIMA línea tiraría
  // una medición buena por culpa de una ejecución ciega: se recorre hacia atrás.
  const ciego = 'vigía · 2026-09-07T00:00:00Z · no-supe-mirar · prod=? · main=? · hueco=? · commits=?';
  assert.equal(lecturaDeLaConstancia(ciego), null,
    '🔴 `prod=?` se está tomando por una lectura. No lo es: es que no se supo mirar.');
  const bueno = 'vigía · 2026-09-06T20:21:00Z · atrasado · prod=ff4e1c4a · main=388dc045 · hueco=9.5h · commits=8';
  assert.equal(ultimaLectura([bueno, ciego, ''].join('\n')).versionDeProduccion, 'ff4e1c4a',
    '🔴 una ejecución ciega al final del historial ha tapado la última medición buena.');
  assert.equal(ultimaLectura(''), null, '🔴 un historial vacío no es una lectura.');
  assert.equal(ultimaLectura(null), null, '🔴 sin historial no hay lectura.');
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
  {
    // ④ El 6-sep vuelve a pasar: el retraso que se cierra solo se pone otra vez en rojo.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: "      salida: SALIDA_OK, califica: true,\n      titulo: 'RETRASADO, PERO DESPLEGANDO',",
    a: "      salida: SALIDA_CANTA, califica: true,\n      titulo: 'RETRASADO, PERO DESPLEGANDO',",
    cae: 'EL CASO DEL 6-sep: RETRASADO PERO DESPLEGANDO, y NO bloquea',
  },
  {
    // ⑤ 🔴 LA PEOR DE TODAS: la alarma de los nueve días, apagada. Si esta mutación sale muda,
    // este ticket ha dejado el vigía peor de lo que estaba.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: "      salida: SALIDA_CANTA, califica: true,\n      titulo: '🔴 PRODUCCIÓN CONGELADA',",
    a: "      salida: SALIDA_OK, califica: true,\n      titulo: '🔴 PRODUCCIÓN CONGELADA',",
    cae: 'CONGELADO DE VERDAD pasado el margen: CANTA (salida 1)',
  },
  {
    // ⑥ El verde ciego, otra vez: hueco sin poder mirar, dicho como si todo fuera bien. Es el
    // defecto original de SCRUM-716 reintroducido por la puerta nueva.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: "    salida: SALIDA_CIEGO, califica: true,\n    titulo: '⚠️ HAY HUECO Y NO SÉ SI SE ESTÁ CERRANDO',",
    a: "    salida: SALIDA_OK, califica: true,\n    titulo: '⚠️ HAY HUECO Y NO SÉ SI SE ESTÁ CERRANDO',",
    cae: 'NO_SE_SABE con hueco: ni verde ni congelado (salida 2)',
  },
  {
    // ⑦ El otro modo de fallo: el vigía ciego SIEMPRE. Sin la puerta de «sólo califica un
    // atrasado», cada ejecución con la caché vacía saldría en 2 estando todo perfecto.
    fichero: 'scripts/_ritmo-de-despliegue.mjs',
    de: "  if (!v || v.veredicto !== 'atrasado') {",
    a: '  if (false) {',
    cae: 'SIN HUECO sigue verde aunque no haya lectura anterior',
  },
];

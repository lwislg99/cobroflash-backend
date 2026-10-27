// tests/scrum1526-produccion-no-se-reconoce-por-nombre.test.mjs — SCRUM-1526
//
// ¿QUÉ CONTESTA EL CONTROL DE «PRODUCCIÓN EN UN ÁRBOL DE TRABAJO» ANTE UN HOST QUE NO CONOCE?
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, MEDIDO EL 13-OCT-2026 CON ESTE MISMO FICHERO SOBRE EL CÓDIGO SIN ARREGLAR
//
// `comprobarCredencialDeProduccion` reconocía producción comparando el host con UN nombre escrito a
// mano. Con cualquier otro host contestaba `cuadra`. O sea: el día que ese nombre caducara —una
// mudanza, otro proveedor, un rediseño del proxy—, una credencial de producción en un árbol de
// trabajo saldría EN VERDE. No se quedaba mudo: decía que estaba bien. Fallaba ABIERTO.
//
// El arreglo le da la vuelta a la pregunta. Ya no es «¿es éste el host de producción?» sino «¿es éste
// uno de los destinos que tengo DECLARADOS como no-producción, con host Y base?». Lo que no esté en
// esa lista no se aprueba.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL POSITIVO SE SIEMBRA, NO SE TOMA PRESTADO DEL ÁRBOL
//
// Si el control positivo de este fichero fuese «el host de producción de hoy», el día que producción
// se mude este fichero se quedaría mudo: exactamente el defecto que viene a cerrar. Por eso el caso
// que DECIDE lo fabrica la propia sonda (`hostSembrado`): un host que no existe en ninguna tabla. Y
// la sonda comprueba que la siembra ENTRÓ antes de fiarse de ella: sin sembrado, o con un sembrado
// que resulta ser un destino declarado, dice CIEGO — no verde.
//
// La pregunta por el host de producción de hoy se sigue haciendo, pero como TERCERA pregunta: si un
// día deja de tener sentido, las otras dos siguen midiendo.
//
// ⚠️ Este fichero NUNCA lee un `.env` real: todas las URLs son fabricadas (`u:p`, el mismo convenio
// que `scrum418-credencial-de-produccion`), y de un veredicto sólo salen host y base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import * as M from '../scripts/_clave-vs-destino.mjs';
import { comprobarEsteArbol } from '../scripts/comprobar-claves-bd.mjs';
import { medir } from '../scripts/claves-bd-de-todos-los-arboles.mjs';

const {
  OK, NO_CUADRA, NO_PUDE_RESOLVER, PRODUCCION_EN_ARBOL, HOST_PRODUCCION, DESTINOS_ESPERADOS,
  comprobarClaveVsDestino, comprobarCredencialDeProduccion,
} = M;

const url = (host, base) => `postgresql://u:p@${host}:5432/${base}`;
const ARBOL = 'cobroflash-b1';

/** Un host que no está en ninguna tabla. `.invalid` es un TLD reservado: no resuelve nunca. */
const hostSembrado = () => `sembrado-${randomBytes(6).toString('hex')}.invalid`;

/** Todos los hosts que la tabla nombra, sean de lo que sean. Para comprobar que la siembra ENTRÓ. */
const hostsDeLaTabla = () => new Set(Object.values(DESTINOS_ESPERADOS).map((d) => d.host));

const VERDE = 'VERDE';
const ROJO = 'ROJO';
const CIEGO = 'CIEGO';

/**
 * LA SONDA. Tres preguntas a un comprobador, y tres estados posibles — no dos.
 *
 *   · `sembrados`  destinos fabricados que NADIE ha declarado. Tienen que GRITAR. Es el positivo.
 *   · `conocidos`  destinos declarados como no-producción. Tienen que CALLAR. Es el control de cero.
 *   · `deHoy`      el host de producción de hoy. Tiene que gritar, pero NO es el que decide.
 *
 * CIEGO sale cuando no se puede afirmar nada: no hay sembrado, no hay conocido, o un «sembrado»
 * resulta estar en la tabla (la siembra no entró, y su silencio no significaría nada).
 */
function sondear(comprobar, { sembrados, conocidos, deHoy }) {
  const lineas = [];
  if (!sembrados?.length) return { estado: CIEGO, lineas: ['no se sembró ningún positivo'], preguntas: 0 };
  if (!conocidos?.length) return { estado: CIEGO, lineas: ['no hay ningún destino conocido: el control de cero está vacío'], preguntas: 0 };
  const tabla = hostsDeLaTabla();
  const enLaTabla = sembrados.filter((s) => tabla.has(s.host));
  if (enLaTabla.length) {
    return { estado: CIEGO, lineas: enLaTabla.map((s) => `el «sembrado» ${s.host} ESTÁ en la tabla: la siembra no entró`), preguntas: 0 };
  }

  let rojo = false;
  let preguntas = 0;
  for (const s of sembrados) {
    preguntas++;
    const v = comprobar('SEMBRADA', url(s.host, s.base), ARBOL).veredicto;
    if (v === OK) { rojo = true; lineas.push(`🔴 ABIERTO: ${s.host}/${s.base} no lo ha declarado nadie y sale «${v}»`); }
    else lineas.push(`grita: ${s.host}/${s.base} → ${v}`);
  }
  for (const c of conocidos) {
    preguntas++;
    const v = comprobar('CONOCIDA', url(c.host, c.base), ARBOL).veredicto;
    if (v !== OK) { rojo = true; lineas.push(`🔴 un destino declarado como no-producción grita: ${c.host}/${c.base} → ${v}`); }
    else lineas.push(`calla: ${c.host}/${c.base} → ${v}`);
  }
  if (deHoy) {
    preguntas++;
    const v = comprobar('DE_HOY', url(deHoy, 'railway'), ARBOL).veredicto;
    if (v !== PRODUCCION_EN_ARBOL) { rojo = true; lineas.push(`🔴 el host de producción de hoy ya no se nombra como producción: → ${v}`); }
    else lineas.push(`grita: ${deHoy}/railway → ${v}`);
  }
  return { estado: rojo ? ROJO : VERDE, lineas, preguntas };
}

const STAGING = DESTINOS_ESPERADOS.DATABASE_URL_STAGING;
const DEV = DESTINOS_ESPERADOS.DATABASE_URL_DEV;

// ── ① LA SONDA DE LAS TRES PREGUNTAS ─────────────────────────────────────────────────────

test('SCRUM-1526 · 🔴 la sonda de tres preguntas: un host que nadie ha declarado GRITA, staging calla, producción de hoy grita', () => {
  const r = sondear(comprobarCredencialDeProduccion, {
    sembrados: [{ host: hostSembrado(), base: 'railway' }],
    conocidos: [{ host: STAGING.host, base: STAGING.base }],
    deHoy: HOST_PRODUCCION,
  });
  assert.equal(r.preguntas, 3, `🔴 la sonda no hizo sus tres preguntas:\n${r.lineas.join('\n')}`);
  assert.equal(r.estado, VERDE,
    '🔴 el control falla ABIERTO: aprueba un destino que nadie ha declarado. El día que el host de ' +
    `producción cambie de nombre, una credencial suya en un árbol saldrá en verde.\n${r.lineas.join('\n')}`);
});

// ── ② LA SONDA SE COMPRUEBA A SÍ MISMA: SABE DECIR ROJO, Y SABE DECIR CIEGO ───────────────

test('SCRUM-1526 · la sonda SABE DECIR ROJO: contra el algoritmo de antes (un nombre a mano) lo dice', () => {
  // El algoritmo que este ticket retira, reescrito aquí para que la sonda tenga siempre delante algo
  // que la haga caer. No depende de que el árbol conserve ningún defecto.
  const elDeAntes = (clave, u) => {
    const host = new URL(u).hostname;
    return { veredicto: host === HOST_PRODUCCION ? PRODUCCION_EN_ARBOL : OK };
  };
  const r = sondear(elDeAntes, {
    sembrados: [{ host: hostSembrado(), base: 'railway' }],
    conocidos: [{ host: STAGING.host, base: STAGING.base }],
    deHoy: HOST_PRODUCCION,
  });
  assert.equal(r.estado, ROJO, `🔴 la sonda da por bueno el algoritmo que falla abierto:\n${r.lineas.join('\n')}`);
  assert.equal(r.lineas.filter((l) => l.includes('ABIERTO')).length, 1, 'y el rojo es por el sembrado, no por otra pregunta');
});

test('SCRUM-1526 · 🔴 quitando el sembrado la sonda dice CIEGO, no verde', () => {
  const conocidos = [{ host: STAGING.host, base: STAGING.base }];
  for (const sembrados of [[], undefined]) {
    const r = sondear(comprobarCredencialDeProduccion, { sembrados, conocidos, deHoy: HOST_PRODUCCION });
    assert.equal(r.estado, CIEGO, '🔴 sin positivo sembrado la sonda no puede afirmar nada, y ha afirmado algo.');
  }
  // Un «sembrado» que resulta ser un destino de la tabla no es una siembra: su silencio sería correcto
  // y no probaría nada. Vale tanto para un host no-producción como para el de producción de hoy.
  for (const host of [STAGING.host, HOST_PRODUCCION]) {
    const r = sondear(comprobarCredencialDeProduccion, { sembrados: [{ host, base: 'railway' }], conocidos, deHoy: HOST_PRODUCCION });
    assert.equal(r.estado, CIEGO, `🔴 la sonda aceptó «${host}» como sembrado, y está en la tabla.`);
  }
  // Y sin control de cero tampoco: un comprobador que gritara a TODO pasaría por bueno.
  const sinCero = sondear(comprobarCredencialDeProduccion, { sembrados: [{ host: hostSembrado(), base: 'x' }], conocidos: [], deHoy: HOST_PRODUCCION });
  assert.equal(sinCero.estado, CIEGO);
  const gritaATodo = sondear(() => ({ veredicto: PRODUCCION_EN_ARBOL }), {
    sembrados: [{ host: hostSembrado(), base: 'x' }], conocidos, deHoy: HOST_PRODUCCION,
  });
  assert.equal(gritaATodo.estado, ROJO, '🔴 un comprobador que grita a todo, staging incluido, pasa por bueno.');
});

// ── ③ LO QUE NADIE HA DECLARADO GRITA, Y DICE LO JUSTO ───────────────────────────────────

test('SCRUM-1526 · 🔴 un destino no declarado tiene veredicto PROPIO: ni «cuadra», ni «es producción»', () => {
  assert.equal(typeof M.DESTINO_NO_RECONOCIDO, 'string', '🔴 no existe el veredicto para un destino no declarado.');
  const host = hostSembrado();
  const laUrl = url(host, 'railway');
  const r = comprobarCredencialDeProduccion('URL_RARA', laUrl, 'C:/Users/x/cobroflash-b1');

  assert.equal(r.veredicto, M.DESTINO_NO_RECONOCIDO);
  // No se afirma lo que no se sabe: que un host no esté declarado no prueba que SEA producción, y el
  // barrido de todos los árboles escribe una frase fechada con ese veredicto.
  assert.notEqual(r.veredicto, PRODUCCION_EN_ARBOL);
  assert.notEqual(r.veredicto, OK);

  // El mensaje tiene que servir para ACTUAR: árbol, clave y destino.
  assert.match(r.mensaje, /cobroflash-b1/, '🔴 el rojo no nombra el WORKTREE.');
  assert.match(r.mensaje, /URL_RARA/, '🔴 el rojo no nombra la CLAVE.');
  assert.ok(r.mensaje.includes(`${host}/railway`), '🔴 el rojo no nombra el DESTINO.');
  // Y sólo host y base (regla 9, SCRUM-226). El positivo de la negación: la credencial SÍ iba en la URL.
  assert.ok(laUrl.includes('u:p'));
  assert.ok(!r.mensaje.includes('u:p'), '🔴 el mensaje lleva la credencial.');
});

test('SCRUM-1526 · 🔴 parecerse a un destino declarado no es serlo: host Y base, los dos, enteros', () => {
  const declarados = M.DESTINOS_QUE_NO_SON_PRODUCCION;
  assert.ok(Array.isArray(declarados) && declarados.length >= 2,
    `SUELO: no hay destinos declarados sobre los que fabricar parecidos (${declarados?.length ?? 'ninguno'}).`);

  let fabricados = 0;
  for (const { host, base } of declarados) {
    const parecidos = [
      { host, base: `${base}_otra` },                     // host bueno, base que nadie ha declarado
      { host, base: base.slice(0, -1) },                  // un prefijo de la base no es la base
      { host: `${host}.otro-sitio.invalid`, base },       // el host bueno como PREFIJO de otro
      { host: `x${host}`, base },                         // y como SUFIJO
      { host: host.split('.').slice(1).join('.'), base }, // el dominio del proxy sin su nombre
      { host: hostSembrado(), base },                     // base buena en un host que no es nadie
    ];
    for (const p of parecidos) {
      fabricados++;
      const v = comprobarCredencialDeProduccion('PARECIDA', url(p.host, p.base), ARBOL).veredicto;
      assert.notEqual(v, OK, `🔴 «${p.host}/${p.base}» se parece a «${host}/${base}» y ha pasado por él.`);
    }
    // El hermano positivo de cada tanda de parecidos: el de verdad, entero, calla.
    assert.equal(comprobarCredencialDeProduccion('LA_BUENA', url(host, base), ARBOL).veredicto, OK);
  }
  assert.equal(fabricados, declarados.length * 6, 'población: seis parecidos por destino declarado');

  // Un destino declarado SIN base no es un destino: el host solo no identifica nada (SCRUM-383).
  assert.notEqual(comprobarCredencialDeProduccion('SIN_BASE', `postgresql://u:p@${STAGING.host}:5432`, ARBOL).veredicto, OK);
});

// ── ④ LA LISTA DE LO QUE SE APRUEBA, A LA VISTA Y SIN PRODUCCIÓN DENTRO ──────────────────

test('SCRUM-1526 · la lista de no-producción es la declarada, ni una más: ensancharla es una decisión', () => {
  const lista = (M.DESTINOS_QUE_NO_SON_PRODUCCION ?? []).map((d) => `${d.host}/${d.base}`).sort();
  // A mano a propósito. Cada entrada de aquí es un destino que el control APRUEBA sin preguntar; una
  // nueva tiene que escribirse en dos sitios y verse en un diff, no colarse derivada de otra tabla.
  assert.deepEqual(lista, ['acela.proxy.rlwy.net/railway', 'acela.proxy.rlwy.net/yaqu_dev_javier'],
    '🔴 ha cambiado lo que se aprueba como «no es producción». Si es una base nueva de verdad, ' +
    'decláralo aquí también; si no, alguien ha abierto el control.');

  // Y sale de las claves que se declaran no-producción, que no incluyen la de producción.
  assert.deepEqual([...M.CLAVES_QUE_NO_SON_PRODUCCION].sort(),
    ['DATABASE_URL_DEV', 'DATABASE_URL_STAGING', 'DATABASE_URL_TESTS']);
  assert.ok(Object.keys(DESTINOS_ESPERADOS).includes('DATABASE_URL'), 'SUELO: la clave de producción sigue en la tabla');
  assert.ok(!M.CLAVES_QUE_NO_SON_PRODUCCION.includes('DATABASE_URL'), '🔴 la clave de PRODUCCIÓN está declarada como no-producción.');
  for (const d of M.DESTINOS_QUE_NO_SON_PRODUCCION) {
    assert.notEqual(d.host, HOST_PRODUCCION, '🔴 el host de producción está en la lista de lo que se aprueba.');
  }
});

test('SCRUM-1526 · el host de producción de hoy se sigue nombrando como PRODUCCIÓN, con cualquier base', () => {
  // No se ha quitado nada: lo conocido conserva su veredicto y su mensaje. Incluidas las bases que
  // en `acela` son legítimas — la base no rescata a un host de producción.
  for (const base of ['railway', 'yaqu_dev_javier', 'otra']) {
    assert.equal(comprobarCredencialDeProduccion('DATABASE_URL', url(HOST_PRODUCCION, base), ARBOL).veredicto, PRODUCCION_EN_ARBOL);
  }
});

// ── ⑤ SIGUEN SIENDO DOS PREGUNTAS, Y NINGUNA SUSTITUYE A LA OTRA ─────────────────────────

test('SCRUM-1526 · `comprobarClaveVsDestino` sigue contestando OTRA pregunta: discrepan en los dos sentidos', () => {
  const desconocida = url(hostSembrado(), 'railway');
  const casos = [
    // [clave, url, ¿apunta a donde promete?, ¿puede vivir en un árbol?]
    ['DATABASE_URL', url(HOST_PRODUCCION, 'railway'), OK, PRODUCCION_EN_ARBOL],          // coherente y prohibida
    ['DATABASE_URL_STAGING', url(DEV.host, DEV.base), NO_CUADRA, OK],                    // incoherente y permitida
    ['DATABASE_URL_STAGING', url(STAGING.host, STAGING.base), OK, OK],                   // las dos de acuerdo en verde
    ['DATABASE_URL_STAGING', desconocida, NO_CUADRA, M.DESTINO_NO_RECONOCIDO],           // las dos en rojo, por motivos distintos
    ['DATABASE_URL', desconocida, NO_CUADRA, M.DESTINO_NO_RECONOCIDO],                   // «producción» en un host que nadie conoce
  ];
  let discrepan = 0;
  for (const [clave, u, coherencia, enArbol] of casos) {
    assert.equal(comprobarClaveVsDestino(clave, u, ARBOL).veredicto, coherencia, `coherencia de ${clave}`);
    assert.equal(comprobarCredencialDeProduccion(clave, u, ARBOL).veredicto, enArbol, `en el árbol, ${clave}`);
    if ((coherencia === OK) !== (enArbol === OK)) discrepan++;
  }
  assert.equal(discrepan, 2, '🔴 las dos comprobaciones ya no discrepan en ningún caso: una se ha comido a la otra.');
});

// ── ⑥ LOS DOS QUE PREGUNTAN NO LO DEJAN PASAR ────────────────────────────────────────────

const ENV_SANO = Object.freeze({
  DATABASE_URL_STAGING: url(STAGING.host, STAGING.base),
  DATABASE_URL_DEV: url(DEV.host, DEV.base),
  DATABASE_URL_TESTS: url(STAGING.host, STAGING.base),
});

test('SCRUM-1526 · 🔴 el barrido de UN árbol cae con una cadena a un destino no declarado, se llame como se llame', () => {
  const sano = comprobarEsteArbol({ env: { ...ENV_SANO }, raiz: 'C:/Users/x/cobroflash-b1' });
  assert.equal(sano.fallos, 0, `SUELO: el árbol sano ya falla, y el rojo de abajo no probaría nada:\n${sano.salida}`);

  for (const clave of ['DATABASE_URL', 'URL_NUEVA', 'TMP_1']) {
    const r = comprobarEsteArbol({ env: { ...ENV_SANO, [clave]: url(hostSembrado(), 'railway') }, raiz: 'C:/Users/x/cobroflash-b1' });
    assert.ok(r.fallos > 0, `🔴 «${clave}» apunta a un destino que nadie ha declarado y el barrido pasa en verde.`);
    assert.match(r.salida, /DESTINO NO RECONOCIDO/);
    assert.match(r.salida, new RegExp(clave));
  }
});

test('SCRUM-1526 · 🔴 el barrido de TODOS los árboles lo cuenta como «no se pudo decidir»: sale 2 y no escribe la frase', () => {
  const arbol = (ruta, env) => ({ ruta, ficheros: [{ nombre: '.env', env }] });
  const limpio = medir([arbol('D:/wt-a', { ...ENV_SANO })], { ahora: 0 });
  assert.equal(limpio.codigo, 0);
  assert.match(limpio.lineas.join('\n'), /ninguna apunta a producción/);

  const r = medir([arbol('D:/wt-a', { ...ENV_SANO }), arbol('D:/wt-b', { URL_NUEVA: url(hostSembrado(), 'railway') })], { ahora: 0 });
  const t = r.lineas.join('\n');
  assert.equal(r.codigo, 2, t);
  assert.match(t, /· D:\/wt-b · \.env · URL_NUEVA · no se pudo decidir su destino/);
  assert.doesNotMatch(t, /ninguna apunta a producción/, '🔴 con un destino sin reconocer se afirma que ninguna va a producción.');
});

// ── ⑦ EL SUELO DE ANTES SIGUE DONDE ESTABA ───────────────────────────────────────────────

test('SCRUM-1526 · una URL ilegible sigue siendo «no pude resolver», no «no reconocido»', () => {
  for (const ilegible of ['esto-no-es-una-url', '', null, undefined, 'postgresql://[']) {
    assert.equal(comprobarCredencialDeProduccion('X', ilegible, ARBOL).veredicto, NO_PUDE_RESOLVER);
  }
});

// SCRUM-266 · EL TTL DESATADO: `estado` y `tomar` suponían 45 min mientras el runner derivaba
// el suyo de `GATED_CHILD_TIMEOUT_MS`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y ES PEOR QUE DESINFORMAR
//
// El runner deriva su TTL: `ttlParaTanda(GATED)` = `max(45, GATED + 10)`. El CLI suponía **45
// fijos**. Con `GATED_CHILD_TIMEOUT_MS=60` el runner sostiene su turno con TTL **70**, así que
// entre el minuto 45 y el 70 el turno está **vigente para quien lo tiene y rancio para quien lo
// consulta**. La ventana es exactamente `GATED + 10 − 45`.
//
// ⚠️ Y `adquirirLock` decidía con ese mismo TTL supuesto, así que **`turno:tomar` SE LLEVABA EL
// TURNO DE UNA TANDA VIVA** — solo, sin preguntar y sin `exit 5`. Es el fallo que SCRUM-188
// existe para impedir, ocurriendo por dentro de la herramienta que debía protegerlo. Rozó el
// 2-ago-2026: es lo que Javier estuvo a punto de hacer.
//
// Y `estado` llegaba a **contradecirse en la misma pantalla**: el título salía de `estaRancio`
// («⏳ RANCIO, se reclama solo») y dos líneas después la señal de vida de SCRUM-249 decía «VIVO».
// Una herramienta que se contradice a sí misma es peor que una que calla.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ARREGLO: MANDA EL COMPROMISO, NO UN TTL SUPUESTO
//
// Se descartó pasarle el TTL al CLI: **leería SU variable de entorno para adivinar el TTL con el
// que OTRA máquina tomó el turno**. Si quien corre la tanda tiene GATED a 60 y quien consulta no
// la tiene puesta, vuelve a fallar en silencio. Adivinar con más pasos.
//
// El dato correcto ya está publicado desde SCRUM-249: el dueño declara hasta cuándo dará señales,
// y se compara contra el reloj de la BASE. `decidirVigencia` es **la única función que decide**,
// y por eso ya no puede haber dos respuestas distintas en la misma pantalla.
//
// ⚠️ COSTE DECLARADO: un turno tomado por código ANTERIOR a SCRUM-249 no publica compromiso, así
// que para él sigue habiendo ventana — no es evitable sin inventar el TTL ajeno, que es lo que
// este ticket quita. El conjunto **se vacía solo** en cuanto todos los turnos vivos se tomen con
// código actual, y mientras tanto `tomar` **avisa** en vez de reclamar en silencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MARCADOR, componerMarca, componerContexto, decidirVigencia, ttlParaTanda,
  adquirirLock, TTL_POR_DEFECTO_MS, MARGEN_TTL_MS,
} from '../scripts/_staging-lock.mjs';
import { barrer, preguntaAlJuez } from './_decisor-turno.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const T0 = Date.parse('2026-08-03T12:00:00.000Z');
const min = (n) => n * 60 * 1000;
const DUEÑO = 'DESKTOP-A24926K.28436';
const SCHEMA = 'standard public schema';

function clienteFalso({ marca, ahoraMs, comentarioSchema = SCHEMA, db = 'railway' }) {
  const estado = { marca, ahoraMs, db, comentarioSchema, escrituras: [], escriturasSchema: [] };
  const cli = {
    estado,
    async $queryRawUnsafe(sql) {
      if (sql.includes('pg_namespace')) return [{ comentario: estado.comentarioSchema }];
      return [{ db: estado.db, marca: estado.marca, ahora: new Date(estado.ahoraMs) }];
    },
    async $executeRawUnsafe(sql) {
      if (sql.includes('advisory')) return 1;
      const m = /, '([^']*)'\); END \$\$;$/.exec(sql);
      assert.ok(m, `SQL inesperado: ${sql}`);
      if (sql.includes('COMMENT ON SCHEMA')) { estado.escriturasSchema.push(m[1]); estado.comentarioSchema = m[1]; }
      else { estado.escrituras.push(m[1]); estado.marca = m[1]; }
      return 1;
    },
    async $transaction(fn) { return fn(cli); },
  };
  return cli;
}

// ── LA ARITMÉTICA DE LA VENTANA ──────────────────────────────────────────────────────────

test('SCRUM-266 · la ventana existe y mide GATED + 10 − 45', () => {
  // Esto no es decorado: fija el acoplamiento con SCRUM-265. Cualquier régimen que deje
  // GATED por encima de 35 convierte la ventana de ocasional en PERMANENTE, y por eso 266 va
  // ANTES que 265.
  const ttlRunner = ttlParaTanda(min(60));
  assert.equal(ttlRunner, min(70), '🔴 el runner ya no deriva 70 de un GATED de 60');
  assert.equal(ttlRunner - TTL_POR_DEFECTO_MS, min(25),
    '🔴 con GATED=60 la ventana era de 25 min: el runner sostenía 70 y el CLI suponía 45');
  assert.equal(MARGEN_TTL_MS, min(10), '🔴 el margen ya no es 10: la fórmula del ticket cambia');

  // Y el umbral en el que la ventana aparece: GATED + 10 > 45 → GATED > 35.
  assert.equal(ttlParaTanda(min(35)), TTL_POR_DEFECTO_MS,
    '🔴 con GATED=35 el TTL derivado deberia ser exactamente el suelo: ahi NO hay ventana');
  assert.ok(ttlParaTanda(min(36)) > TTL_POR_DEFECTO_MS,
    '🔴 con GATED=36 ya deberia haber ventana');
});

// ── EL CASO REAL DEL TICKET ──────────────────────────────────────────────────────────────

test('SCRUM-266 · un turno de 50 min con GATED=60 es VIGENTE, no rancio', () => {
  // El caso que rozó el 2-ago: turno tomado hace 50 min por una tanda que se sostiene con TTL 70.
  const lock = { dueño: DUEÑO, desdeIso: '', desdeMs: T0 - min(50) };
  const ctx = { dueño: DUEÑO, finIso: '', finMs: T0 + min(20), tipo: 'gated', ref: 'scrum-265',
    señalIso: '2026-08-03T12:20:00.000Z', señalMs: T0 + min(20) };

  const v = decidirVigencia({ lock, contexto: ctx, ahoraMs: T0, ttlSupuestoMs: TTL_POR_DEFECTO_MS });
  assert.equal(v.vigente, true,
    '🔴 SE DECLARA RANCIO UN TURNO VIVO. Es el caso exacto del 2-ago: la tanda se sostiene con ' +
    'TTL derivado de 70 min y el CLI suponía 45, así que a los 50 min lo daba por caducado — y ' +
    '`tomar` se lo llevaba.');
  assert.equal(v.base, 'compromiso',
    '🔴 la decisión no se apoya en el compromiso publicado: si vuelve a apoyarse en un TTL ' +
    'supuesto, el CLI vuelve a adivinar el TTL de otra máquina.');
});

test('SCRUM-266 · y `tomar` ya NO se lo lleva: rechaza con el turno ajeno vivo', () => {
  return (async () => {
    const marcaAjena = componerMarca(DUEÑO, T0 - min(50));
    const ctx = componerContexto({
      dueño: DUEÑO, tipo: 'gated', ref: 'scrum-265',
      finPrevistoMs: T0 + min(20), señalAntesDeMs: T0 + min(20),
    });
    const cli = clienteFalso({ marca: marcaAjena, ahoraMs: T0, comentarioSchema: `${SCHEMA} ${ctx}` });

    // `tomar` usa el TTL supuesto de 45 min: antes de este ticket, eso bastaba para reclamar.
    const r = await adquirirLock(cli, { dueño: 'otra-sesion.1', ttlMs: TTL_POR_DEFECTO_MS, tipo: 'suelto', ref: 'x' });

    assert.equal(r.ok, false,
      '🔴 `turno:tomar` SE HA LLEVADO EL TURNO DE UNA TANDA VIVA.\n\n' +
      '  Es el fallo que SCRUM-188 existe para impedir, ocurriendo por dentro de la herramienta\n' +
      '  que debía protegerlo: sin preguntar, sin exit 5 y sin dejar rastro. La otra tanda seguirá\n' +
      '  escribiendo en la misma base mientras esta cree tener el turno.');
    assert.equal(r.motivo, 'ocupado');
    assert.deepEqual(cli.estado.escrituras, [], '🔴 un rechazo no puede escribir NADA en el marcador');
    assert.equal(r.vigencia?.base, 'compromiso',
      '🔴 el rechazo no dice que se apoyó en el compromiso: quien lo lea no sabrá si fue un dato ' +
      'del dueño o una suposición');
  })();
});

// ── SIN COMPROMISO: SE CAE AL TTL, PERO SE DICE ──────────────────────────────────────────

test('SCRUM-266 · sin compromiso se decide por TTL, y la base lo DECLARA', () => {
  const lock = { dueño: DUEÑO, desdeIso: '', desdeMs: T0 - min(50) };

  // Turno anterior a SCRUM-249: no publica compromiso. Solo queda el TTL supuesto.
  const v = decidirVigencia({ lock, contexto: null, ahoraMs: T0, ttlSupuestoMs: TTL_POR_DEFECTO_MS });
  assert.equal(v.vigente, false, 'con 50 min y TTL supuesto de 45, por TTL está caducado');
  assert.equal(v.base, 'ttl-supuesto',
    '🔴 no marca que la decisión se tomó SUPONIENDO. Ese aviso es lo único que separa «lo reclamé ' +
    'porque su dueño dijo que había terminado» de «lo reclamé porque me lo imaginé».');
  assert.match(v.motivo, /no publica compromiso/,
    '🔴 el motivo no dice por qué se recurrió al TTL');
});

test('SCRUM-266 · `tomar` que RECLAMA sin compromiso deja constancia de con qué decidió', () => {
  return (async () => {
    // Turno viejo (55 min) SIN contexto: se reclama por TTL. Legítimo, pero tiene que decirse.
    const cli = clienteFalso({ marca: componerMarca(DUEÑO, T0 - min(55)), ahoraMs: T0 });
    const r = await adquirirLock(cli, { dueño: 'yo.1', ttlMs: TTL_POR_DEFECTO_MS, tipo: 'suelto', ref: 'x' });

    assert.equal(r.ok, true, 'un turno de 55 min sin compromiso sí se reclama');
    assert.equal(r.reclamado, true);
    assert.equal(r.vigenciaPrevia?.base, 'ttl-supuesto',
      '🔴 se reclamó y NO queda registrado que se decidió por suposición. Sin ese dato, `tomar` ' +
      'vuelve a reclamar en silencio — que es exactamente el defecto de este ticket.');
  })();
});

// ── LA CONTRADICCIÓN EN PANTALLA ─────────────────────────────────────────────────────────

// El guard que había aquí nombraba `turno-staging.mjs` y leía su texto sin comentarios. Se
// sustituye por el barrido estructural de abajo, y el motivo está medido: protegía UNO de los
// diez consumidores del turno, y el defecto seguía vivo en otro (`tests/_staging-db.mjs`).
// Una lista de sitios protegidos se satisface dejando de enumerar.

test('SCRUM-266 · SUELO: el barrido encuentra a los consumidores del turno', () => {
  // Sin esto, «0 decisiones fuera del decisor» significa a la vez «está limpio» y «no miré».
  // El suelo es lo único que distingue las dos cosas.
  const { consumidores } = barrer(RAIZ);

  assert.ok(consumidores.length >= 8,
    `🔴 el barrido solo ve ${consumidores.length} consumidores del turno; se midieron 10 el ` +
    '3-ago-2026. Si han bajado tanto, lo que se rompió es el analizador (o el import del ' +
    'decisor cambió de forma), no el código. Un guard que no encuentra nada no vigila nada.');

  // Dos anclas concretas: el CLI (que SCRUM-266 arregló) y la barrera gateada (que no). No son
  // una lista de excepciones — son la prueba de que el barrido llega a los dos sitios donde el
  // defecto vivió de verdad.
  for (const esperado of ['scripts/turno-staging.mjs', 'tests/_staging-db.mjs']) {
    assert.ok(consumidores.includes(esperado),
      `🔴 el barrido no llega a ${esperado}, que es uno de los sitios donde este ticket ` +
      'encontró el defecto. Si no lo alcanza, su verde no dice nada de él.');
  }
});

test('SCRUM-266 · nadie decide la vigencia del turno fuera de `decidirVigencia`', () => {
  const { decisiones } = barrer(RAIZ);

  assert.deepEqual(decisiones, [],
    '🔴 alguien vuelve a decidir la vigencia del turno con `estaRancio`:\n\n' +
    decisiones.map((d) => `      ${d.fichero}:${d.linea}  (forma: ${d.forma})`).join('\n') +
    '\n\n' +
    '  `estaRancio` necesita un TTL, y un consumidor solo puede SUPONERLO: el TTL de verdad\n' +
    '  es el que usó OTRA máquina al tomar el turno, y el runner lo DERIVA\n' +
    '  (`ttlParaTanda`), así que discrepa del supuesto en cuanto GATED_CHILD_TIMEOUT_MS\n' +
    '  pasa de 35. Decidir con esa suposición es el defecto entero de SCRUM-266.\n\n' +
    '  Pregúntale a `decidirVigencia({ lock, contexto, ahoraMs })`: compara contra el\n' +
    '  compromiso que el dueño PUBLICÓ, que es un dato, no una suposición.\n\n' +
    '  Observar sí se puede (un assert, un log): lo que este guard prohíbe es que el\n' +
    '  resultado llegue al control de flujo.');
});

test('SCRUM-266 · la barrera gateada sigue avisando del turno ajeno', () => {
  // Sin esto, el guard de arriba se satisface BORRANDO el aviso — y el aviso es lo que SCRUM-188
  // puso ahí para que un gateado suelto no escriba a ciegas sobre la base de otra sesión.
  // «Ya no decide mal» no puede conseguirse dejando de decidir.
  const rel = 'tests/_staging-db.mjs';
  const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');

  assert.ok(preguntaAlJuez(rel, codigo),
    '🔴 la barrera gateada ya no le pregunta a `decidirVigencia`. Si el aviso de turno ajeno\n' +
    '  desapareció, un `QA_DB_TEST=1 node --test …` suelto vuelve a crear y borrar merchants\n' +
    '  sobre la base de otra sesión sin decir una palabra.');
});

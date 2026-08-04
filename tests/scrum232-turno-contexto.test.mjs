// SCRUM-232 · EL TURNO DICE QUÉ ESTÁ CORRIENDO, NO SOLO QUIÉN LO TIENE.
//
// ── LA PROPIEDAD QUE SOSTIENE TODO ESTE FICHERO ──────────────────────────────────────────
//
// El marcador de la base NO CAMBIA NI UN BYTE. Esa es la condición que hace seguro el ticket, y
// no es una preferencia de diseño: es lo que impide que el despliegue rompa el turno.
//
// `RE_LOCK` está anclado con `$`, así que un campo de más hace que `parsearLock` devuelva `null`.
// Y en `adquirirLock` la decisión es `if (lock && !estaRancio(…))`: un `null` NO significa
// «ocupado», cae al else y TOMA EL TURNO. O sea que meter el contexto dentro del marcador haría
// que cualquier sesión con el código anterior viese el turno LIBRE y se lo quitase a una tanda
// viva — el «verde por accidente» que SCRUM-188 existe para evitar. Y la ventana duraría hasta
// que cada uno de los ~33 worktrees rebasase, que no lo controla quien despliega.
//
// Por eso el contexto vive en el comentario del schema `public`, y por eso el primer test de
// abajo es el que más importa: si alguien mueve el contexto al marcador «para tenerlo todo
// junto», ese test cae.
//
// ── EL CONTEXTO ES ADVISORY, SIEMPRE ─────────────────────────────────────────────────────
//
// Si falta, si no se entiende o si es de otro dueño, se ignora y el mensaje degrada exactamente
// al de antes de este ticket. Nunca decide si el turno está libre. Verificado contra staging
// real el 30-jul-2026: el turno de otra sesión, tomado con código anterior, sale como
// «NO CONSTA» en vez de romper nada.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARCADOR, componerMarca, parsearLock, esMarcaDeStaging,
  CTX_PREFIJO, TIPOS_EJECUCION, componerContexto, parsearContexto, separarContexto,
  componerComentarioSchema, adquirirLock, soltarLock, mensajeLockAjeno, lineasDeContexto,
} from '../scripts/_staging-lock.mjs';

const T0 = Date.parse('2026-07-30T12:00:00.000Z');
const min = (n) => n * 60 * 1000;
const DUEÑO = 'DESKTOP-T5MONF5.30496';
const SCHEMA_ESTANDAR = 'standard public schema';

/** Doble del cliente: ROUTEA por objeto de catálogo, igual que el de SCRUM-188. */
function clienteFalso({ marca, ahoraMs = T0, db = 'railway', comentarioSchema = SCHEMA_ESTANDAR } = {}) {
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
      assert.ok(m, `SQL de escritura inesperado: ${sql}`);
      if (sql.includes('COMMENT ON SCHEMA')) {
        estado.escriturasSchema.push(m[1]);
        estado.comentarioSchema = m[1];
      } else {
        estado.escrituras.push(m[1]);
        estado.marca = m[1];
      }
      return 1;
    },
    async $transaction(fn) { return fn(cli); },
  };
  return cli;
}

// ── 1 · LA PROPIEDAD INNEGOCIABLE ────────────────────────────────────────────────────────

test('SCRUM-232 · el MARCADOR no cambia ni un byte al añadir contexto', async () => {
  const antes = componerMarca(DUEÑO, T0);
  const cli = clienteFalso({ marca: MARCADOR });
  const r = await adquirirLock(cli, {
    dueño: DUEÑO, ttlMs: min(70), tipo: 'gated', ref: 'scrum-232-turno-contexto',
    finPrevistoMs: T0 + min(27),
  });
  assert.equal(r.ok, true);

  // El marcador escrito tiene que ser EXACTAMENTE el que se escribía antes del ticket.
  assert.equal(cli.estado.marca, antes,
    '🔴 EL MARCADOR HA CAMBIADO. Cualquier sesión con el código anterior lo leería como ILEGIBLE,\n' +
    '  y en `adquirirLock` un lock ilegible NO es «ocupado»: es `null`, cae al else y TOMA EL\n' +
    '  TURNO. O sea que este cambio le quitaría el turno a una tanda viva — el «verde por\n' +
    '  accidente» que SCRUM-188 existe para evitar. El contexto va en el comentario del SCHEMA,\n' +
    '  nunca dentro del marcador.');

  // Y el parser ANTERIOR (el mismo, que no se ha tocado) lo sigue entendiendo.
  const lock = parsearLock(cli.estado.marca);
  assert.ok(lock, '🔴 parsearLock ya no entiende el marcador que escribe el código nuevo');
  assert.equal(lock.dueño, DUEÑO);
  assert.equal(esMarcaDeStaging(cli.estado.marca), true);
});

test('SCRUM-232 · el contexto NO cabe en el marcador — el motivo del diseño, fijado', () => {
  // Este es el experimento que decidió el ticket, convertido en guard: si alguien «junta» las
  // dos cosas, esto documenta exactamente qué se rompe.
  const conContextoDentro = componerMarca(DUEÑO, T0) + ':gated:SCRUM-232';
  assert.equal(esMarcaDeStaging(conContextoDentro), true, 'la BARRERA aguanta (por eso es tentador)');
  assert.equal(parsearLock(conContextoDentro), null,
    '🔴 si esto dejara de ser null, el motivo de que el contexto viva aparte habría cambiado: ' +
    'vuelve a medirlo antes de mover nada.');
});

// ── 2 · SUELO ANTI-VERDE-HUECO ───────────────────────────────────────────────────────────

test('SCRUM-232 · ① el parser de contexto reconoce lo suyo y rechaza lo que no lo es', () => {
  const ctx = componerContexto({ dueño: DUEÑO, tipo: 'gated', ref: 'SCRUM-232', finPrevistoMs: T0 + min(27) });
  const leido = parsearContexto(ctx, DUEÑO);
  assert.ok(leido, '🔴 no se lee lo que él mismo compone: ida y vuelta rota');
  assert.equal(leido.tipo, 'gated');
  assert.equal(leido.ref, 'SCRUM-232');
  assert.equal(leido.finMs, T0 + min(27));

  // Ilegible → null, JAMÁS una excepción ni un «no es staging».
  for (const basura of [null, '', 'cualquier cosa', CTX_PREFIJO, CTX_PREFIJO + 'roto',
    CTX_PREFIJO + DUEÑO + '@no-es-fecha+gated+x']) {
    assert.equal(parsearContexto(basura, DUEÑO), null, `${JSON.stringify(basura)} debería ser null`);
  }

  // Tipo fuera del vocabulario cerrado → null.
  assert.equal(parsearContexto(CTX_PREFIJO + DUEÑO + '@2026-07-30T12:00:00.000Z+inventado+x', DUEÑO), null,
    '🔴 acepta un tipo que no está en el vocabulario cerrado');
  // SCRUM-268 · entra `cedido`: un turno reservado a nombre de alguien que todavía no ha llegado.
  // Este assert existe para que el vocabulario no crezca EN SILENCIO, y ha hecho exactamente eso
  // — salió rojo y obligó a declarar el cambio aquí. Sigue cerrado, ahora con tres.
  assert.deepEqual(TIPOS_EJECUCION, ['gated', 'suelto', 'cedido']);
});

test('SCRUM-232 · ② un contexto HUÉRFANO se descarta: va clavado al dueño', () => {
  const deOtro = componerContexto({ dueño: 'portatil-javier.4242', tipo: 'gated', ref: 'SCRUM-999', finPrevistoMs: T0 });
  assert.ok(parsearContexto(deOtro, 'portatil-javier.4242'), 'para su dueño sí se lee');
  assert.equal(parsearContexto(deOtro, DUEÑO), null,
    '🔴 SE ESTÁ LEYENDO EL CONTEXTO DE OTRA SESIÓN. El código anterior a este ticket toma el ' +
    'turno escribiendo SOLO el marcador, así que puede dejar aquí el contexto del dueño previo. ' +
    'Un contexto que describe una tanda que ya no corre es PEOR que no tener contexto: manda a ' +
    'esperar por algo que terminó.');
});

// ── 3 · NO SE PISA LO QUE HABÍA ──────────────────────────────────────────────────────────

test('SCRUM-232 · el comentario estándar del schema se preserva y se restaura', async () => {
  const cli = clienteFalso({ marca: MARCADOR, comentarioSchema: SCHEMA_ESTANDAR });

  const r = await adquirirLock(cli, {
    dueño: DUEÑO, ttlMs: min(70), tipo: 'suelto', ref: 'npm-install', finPrevistoMs: T0 + min(5),
  });
  assert.equal(r.ok, true);
  assert.ok(cli.estado.comentarioSchema.startsWith(SCHEMA_ESTANDAR),
    `🔴 se ha pisado la descripción estándar de PostgreSQL: ${JSON.stringify(cli.estado.comentarioSchema)}`);
  assert.ok(cli.estado.comentarioSchema.includes(CTX_PREFIJO), 'y el contexto tiene que estar');
  assert.equal(separarContexto(cli.estado.comentarioSchema).base, SCHEMA_ESTANDAR);

  await soltarLock(cli, { marcaPropia: r.marca });
  assert.equal(cli.estado.comentarioSchema, SCHEMA_ESTANDAR,
    '🔴 al soltar el turno no se restauró el comentario del schema tal y como estaba');
  assert.equal(cli.estado.marca, MARCADOR, 'y el marcador queda limpio, como siempre');
});

test('SCRUM-232 · tomar el turno SIN contexto borra el del dueño anterior', async () => {
  // Si no se limpiara, quedaría describiendo una tanda que ya no corre.
  const viejo = componerContexto({ dueño: 'otro.1', tipo: 'gated', ref: 'SCRUM-111', finPrevistoMs: T0 });
  const cli = clienteFalso({ marca: MARCADOR, comentarioSchema: `${SCHEMA_ESTANDAR} ${viejo}` });

  await adquirirLock(cli, { dueño: DUEÑO, ttlMs: min(70) }); // sin tipo: sin contexto
  assert.equal(cli.estado.comentarioSchema, SCHEMA_ESTANDAR,
    '🔴 ha quedado el contexto de la sesión anterior colgando');
});

// ── 4 · LO QUE VE QUIEN LLEGA ────────────────────────────────────────────────────────────

test('SCRUM-232 · el rechazo dice QUÉ corre y cuánto le queda', async () => {
  const marcaAjena = componerMarca('portatil-javier.4242', T0 - min(13));
  const ctx = componerContexto({
    dueño: 'portatil-javier.4242', tipo: 'gated', ref: 'scrum-227-cta-deja-rastro',
    finPrevistoMs: T0 + min(14),
  });
  const cli = clienteFalso({ marca: marcaAjena, comentarioSchema: `${SCHEMA_ESTANDAR} ${ctx}` });

  const r = await adquirirLock(cli, { dueño: DUEÑO, ttlMs: min(70), tipo: 'gated', ref: 'mio' });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'ocupado');
  assert.deepEqual(cli.estado.escrituras, [], 'un rechazo no escribe NADA');
  assert.deepEqual(cli.estado.escriturasSchema, [], 'ni siquiera el contexto');
  assert.ok(r.contexto, '🔴 el rechazo no trae el contexto: quien llega sigue a ciegas');

  const msg = mensajeLockAjeno({ db: r.db, lock: r.lock, ahoraMs: r.ahoraMs, ttlMs: r.ttlMs, contexto: r.contexto });
  assert.match(msg, /portatil-javier\.4242/, 'sigue nombrando al dueño (SCRUM-188)');
  assert.match(msg, /scrum-227-cta-deja-rastro/,
    '🔴 el mensaje no dice QUÉ está corriendo, que es el ticket entero');
  assert.match(msg, /tanda gateada completa/, '🔴 no dice si es tanda larga o comprobación corta');
  assert.match(msg, /~14 min/,
    '🔴 no dice cuánto le queda DE VERDAD. El TTL (1h 10min) no es la duración: confundirlos es ' +
    'lo que hace inútil el mensaje de hoy.');
});

test('SCRUM-232 · sin contexto el mensaje DEGRADA, no se rompe (compatibilidad hacia atrás)', () => {
  const lock = parsearLock(componerMarca('portatil-javier.4242', T0 - min(5)));
  const msg = mensajeLockAjeno({ db: 'railway', lock, ahoraMs: T0, ttlMs: min(70), contexto: null });
  assert.match(msg, /NO CONSTA/,
    '🔴 sin contexto el mensaje tiene que DECIRLO. Callarse deja a quien llega sin saber si es ' +
    'que no hay dato o si es que el dato no se leyó.');
  assert.match(msg, /EL TURNO DE STAGING ESTÁ TOMADO/, 'y el rechazo de SCRUM-188 sigue intacto');
  assert.doesNotThrow(() => lineasDeContexto(null, T0));
});

test('SCRUM-232 · un contexto ya vencido se dice, no se disimula', () => {
  const ctx = { dueño: 'x.1', finIso: '2026-07-30T11:00:00.000Z', finMs: T0 - min(60), tipo: 'gated', ref: 'r' };
  assert.match(lineasDeContexto(ctx, T0), /ya debería haber terminado/,
    '🔴 si la tanda pasó de su estimación, quien espera necesita saberlo: puede haber muerto');
});

// ── 5 · NADA DE ESTO PUEDE LLEGAR A SQL ──────────────────────────────────────────────────

test('SCRUM-232 · una ref con caracteres peligrosos no llega a escribirse', () => {
  const ctx = componerContexto({
    dueño: DUEÑO, tipo: 'suelto', ref: "x'; DROP SCHEMA public; --", finPrevistoMs: T0,
  });
  assert.doesNotMatch(ctx, /['\\$]/, '🔴 han pasado comilla, barra invertida o dólar al sufijo');
  assert.ok(parsearContexto(ctx, DUEÑO), 'y lo saneado sigue siendo legible');

  assert.throws(() => componerComentarioSchema("base con ' comilla", null),
    /charset seguro/, '🔴 un comentario previo con comilla tiene que abortar ANTES de tocar SQL');
});

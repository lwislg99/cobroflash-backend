// SCRUM-249 · SE PUEDE DISTINGUIR UN TURNO VIVO DE UNO HUÉRFANO SIN ESPERAR EL TTL.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CASO REAL, que es el que define el diseño
//
// El 30-jul un runner con **0,25 s de CPU en 29 minutos** tuvo el turno secuestrado media hora.
// El proceso RESPIRABA: estaba colgado, no muerto. Con el TTL de 45 min, las dos únicas conductas
// posibles eran esperar o romper el lock — y romperlo es justo lo que el lock existe para impedir.
//
// ⚠️ POR ESO ESTE TICKET NO ES UN «LATIDO» EN EL SENTIDO HABITUAL, Y ES LO ÚNICO QUE IMPORTA
// ENTENDER DE ESTE FICHERO:
//
//   Un latido por TEMPORIZADOR habría empeorado ese caso exacto. Un `setInterval` en el proceso
//   colgado habría seguido refrescando el turno para siempre, convirtiendo un bloqueo de 45
//   minutos en uno INFINITO. Se habría «arreglado» el ticket haciendo peor el incidente que lo
//   originó.
//
//   La señal tiene que ser de PROGRESO, no de EXISTENCIA. El runner ya lo hace por arquitectura:
//   el padre está bloqueado dentro de `spawnSync` mientras un hijo corre, así que NO HAY bucle de
//   eventos donde poner un temporizador y el único sitio donde puede refrescar es al terminar
//   cada hijo. Un proceso colgado no termina hijos → no renueva → su compromiso vence solo.
//   La limitación del runner resulta ser la garantía.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO SE DECIDE, Y POR QUÉ NO SE MIRA AL PROCESO
//
// El turno lo puede tener OTRA MÁQUINA (pasó con el portátil de Javier). Desde aquí su PID no
// existe, así que cualquier liveness que dependa de inspeccionar el proceso ajeno no resuelve el
// caso que importa. Por eso el que sostiene el turno **PUBLICA UN COMPROMISO** —«vuelvo a dar
// señales antes de las 14:52»— y quien llega solo compara ese instante con `now()` **de la BASE**,
// que es el mismo reloj para todas las máquinas. Sin adivinar y sin esperar el TTL.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DÓNDE VIVE, Y POR QUÉ NO EN EL MARCADOR
//
// En el slot de contexto de SCRUM-232. El marcador NO puede llevarlo: `RE_LOCK` está anclado con
// `$`, un campo de más lo vuelve ilegible, y un marcador ilegible se lee como **LIBRE** — le
// quitaría el turno a una tanda viva. El contexto es ADVISORY: ilegible ahí solo degrada el
// mensaje. Es el mismo razonamiento de 232 y sería el mismo error cometerlo dos veces.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTO NO RESUELVE, declarado aquí y no en una nota al pie
//
// Si el proceso cuelga DENTRO DEL ÚLTIMO HIJO y nadie más intenta lanzar una tanda, el compromiso
// vence y **nadie lo mira hasta que alguien llega**. El dato existe y es correcto desde el
// instante en que vence; lo que no hay es aviso proactivo. Quien llegue lo verá; nadie irá a
// buscarlo. Eso queda fuera de este ticket a propósito — un vigilante que mire el turno sin que
// nadie se lo pida es otro proceso y otro problema.
//
// Y tampoco entra RECLAMAR el turno automáticamente por compromiso vencido: 249 da el dato para
// decidir, no la conducta. Romper un lock ajeno sigue siendo decisión humana y sigue siendo cosa
// de `marcar-staging.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MARCADOR, componerMarca, componerContexto, parsearContexto, estadoDeVida,
  adquirirLock, refrescarLock, lineasDeContexto, mensajeLockAjeno, CTX_PREFIJO,
} from '../scripts/_staging-lock.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const T0 = Date.parse('2026-07-31T12:00:00.000Z');
const min = (n) => n * 60 * 1000;
const DUEÑO = 'DESKTOP-T5MONF5.30496';
const SCHEMA_ESTANDAR = 'standard public schema';

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
      assert.ok(m, `SQL inesperado: ${sql}`);
      if (sql.includes('COMMENT ON SCHEMA')) { estado.escriturasSchema.push(m[1]); estado.comentarioSchema = m[1]; }
      else { estado.escrituras.push(m[1]); estado.marca = m[1]; }
      return 1;
    },
    async $transaction(fn) { return fn(cli); },
  };
  return cli;
}

// ── 1 · LA PROPIEDAD QUE IMPIDE EL LOCK ETERNO ───────────────────────────────────────────

test('SCRUM-249 · NADA refresca el turno por temporizador — la señal es de PROGRESO', () => {
  const runner = fs.readFileSync(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'), 'utf8');
  const lock = fs.readFileSync(path.join(RAIZ, 'scripts', '_staging-lock.mjs'), 'utf8');
  const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  for (const [nombre, fuente] of [['test-staging-gated.mjs', runner], ['_staging-lock.mjs', lock]]) {
    assert.doesNotMatch(sinComentarios(fuente), /setInterval|setTimeout\s*\(/,
      `🔴 HAY UN TEMPORIZADOR EN ${nombre}.\n\n` +
      '  Un latido por temporizador es EXACTAMENTE lo que convierte un lock huérfano en uno\n' +
      '  ETERNO. El caso que originó este ticket era un proceso COLGADO PERO VIVO —0,25 s de CPU\n' +
      '  en 29 minutos—: un `setInterval` habría seguido refrescándole el turno para siempre y el\n' +
      '  bloqueo de 45 minutos habría pasado a ser infinito.\n\n' +
      '  El compromiso se renueva SOLO al terminar un hijo, porque eso es progreso. Si necesitas\n' +
      '  refrescar más a menudo, el arreglo NO es un temporizador: es partir el hijo en trozos más\n' +
      '  cortos, que es progreso de verdad.');
  }

  // Y el refresco cuelga del bucle de hijos, no de un reloj.
  assert.match(sinComentarios(runner), /refrescarTurno\(hijos\[i\]\)/,
    '🔴 el refresco ya no va atado al hijo que se va a lanzar: el compromiso dejaría de ajustarse ' +
    'a lo que ese hijo puede tardar');
});

// ── 2 · SUELO: el analizador de compromiso reconoce lo suyo ──────────────────────────────

test('SCRUM-249 · ① el compromiso se compone, se relee y distingue los cuatro estados', () => {
  const conCompromiso = componerContexto({
    dueño: DUEÑO, tipo: 'gated', ref: 'scrum-249', finPrevistoMs: T0 + min(27),
    señalAntesDeMs: T0 + min(15),
  });
  const ctx = parsearContexto(conCompromiso, DUEÑO);
  assert.ok(ctx, '🔴 no se relee lo que él mismo compone');
  assert.equal(ctx.señalMs, T0 + min(15), '🔴 el compromiso no sobrevive la ida y vuelta');

  assert.equal(estadoDeVida(ctx, T0).estado, 'vivo', 'antes del compromiso: VIVO');
  assert.equal(estadoDeVida(ctx, T0 + min(15)).estado, 'vivo', 'justo en el instante: todavía VIVO');
  const vencido = estadoDeVida(ctx, T0 + min(21));
  assert.equal(vencido.estado, 'vencido', '🔴 pasado el compromiso tiene que salir VENCIDO');
  assert.equal(vencido.retrasoMs, min(6), '🔴 el retraso mal calculado: es el dato que decide si esperas');

  assert.equal(estadoDeVida(null, T0).estado, 'no-consta', 'sin contexto: NO CONSTA');
});

test('SCRUM-249 · ② compatibilidad: un contexto SIN compromiso se lee y se dice, no revienta', () => {
  // Lo que escribe el código anterior a este ticket. Tiene que seguir siendo legible.
  const viejo = componerContexto({ dueño: DUEÑO, tipo: 'gated', ref: 'scrum-232', finPrevistoMs: T0 + min(27) });
  assert.doesNotMatch(viejo, /\+\d{4}-\d{2}-\d{2}T/, 'sin compromiso, el sufijo no lleva el campo');

  const ctx = parsearContexto(viejo, DUEÑO);
  assert.ok(ctx, '🔴 un contexto anterior a SCRUM-249 ha dejado de parsearse: eso rompería SCRUM-232');
  assert.equal(ctx.señalMs, null);
  assert.equal(estadoDeVida(ctx, T0).estado, 'sin-compromiso',
    '🔴 tiene que DECIR que no hay compromiso, no fingir que está vivo ni darlo por muerto');

  assert.match(lineasDeContexto(ctx, T0), /NO CONSTA/,
    '🔴 quien llega tiene que ver que esa sesión no publica compromiso, no un silencio');
});

// ── 3 · LO QUE VE QUIEN LLEGA ────────────────────────────────────────────────────────────

test('SCRUM-249 · un turno VENCIDO se anuncia como probablemente huérfano, con el retraso', () => {
  const ctx = parsearContexto(componerContexto({
    dueño: 'portatil-javier.4242', tipo: 'gated', ref: 'scrum-227',
    finPrevistoMs: T0 + min(20), señalAntesDeMs: T0 - min(9),
  }), 'portatil-javier.4242');

  const texto = lineasDeContexto(ctx, T0);
  assert.match(texto, /VENCIDO hace 9 min/, '🔴 no dice cuánto lleva sin dar señales');
  assert.match(texto, /HUÉRFANO/, '🔴 no nombra la conclusión que quien llega necesita para decidir');
  assert.match(texto, /puede seguir en memoria y estar colgado/,
    '🔴 falta el matiz que costó la tarde del 30-jul: «vivo» no es lo mismo que «avanzando»');
});

test('SCRUM-249 · la decisión NO mira al proceso: solo compara el compromiso con el reloj de la BASE', () => {
  // El mismo contexto, juzgado en dos instantes distintos: lo único que cambia el veredicto es la
  // hora que da la BD. No hay PID, ni hostname, ni nada local — por eso funciona con otra máquina.
  const ctx = parsearContexto(componerContexto({
    dueño: 'maquina-ajena.999', tipo: 'gated', ref: 'x', finPrevistoMs: T0 + min(30),
    señalAntesDeMs: T0 + min(5),
  }), 'maquina-ajena.999');
  assert.equal(estadoDeVida(ctx, T0).estado, 'vivo');
  assert.equal(estadoDeVida(ctx, T0 + min(6)).estado, 'vencido');
  assert.equal(ctx.dueño, 'maquina-ajena.999', 'el dueño se conserva, pero NO se usa para decidir');
});

// ── 4 · EL CICLO COMPLETO CONTRA EL DOBLE ────────────────────────────────────────────────

test('SCRUM-249 · adquirir publica el compromiso y refrescar lo RENUEVA, sin tocar el marcador', () => {
  return (async () => {
    const cli = clienteFalso({ marca: MARCADOR });
    const r = await adquirirLock(cli, {
      dueño: DUEÑO, ttlMs: min(70), tipo: 'gated', ref: 'scrum-249',
      finPrevistoMs: T0 + min(27), señalAntesDeMs: T0 + min(15),
    });
    assert.equal(r.ok, true);
    assert.equal(cli.estado.marca, componerMarca(DUEÑO, T0),
      '🔴 EL MARCADOR HA CAMBIADO. Un campo de más lo vuelve ilegible, y un marcador ilegible se ' +
      'lee como LIBRE: le quitaría el turno a una tanda viva. El compromiso va en el CONTEXTO.');
    assert.match(cli.estado.comentarioSchema, /YAQUCTX:.*\+2026-07-31T12:15:00\.000Z$/,
      '🔴 el compromiso no llegó al slot de contexto');
    assert.ok(cli.estado.comentarioSchema.startsWith(SCHEMA_ESTANDAR), 'y no se pisa lo que había');

    // Refrescar con un compromiso NUEVO: el contexto se actualiza conservando tipo y ref.
    cli.estado.ahoraMs = T0 + min(10);
    const r2 = await refrescarLock(cli, {
      marcaPropia: cli.estado.marca, dueño: DUEÑO, señalAntesDeMs: T0 + min(40),
    });
    assert.equal(r2.ok, true);
    const ctx = parsearContexto(cli.estado.comentarioSchema, DUEÑO);
    assert.equal(ctx.señalMs, T0 + min(40), '🔴 el compromiso no se renovó al refrescar');
    assert.equal(ctx.ref, 'scrum-249', '🔴 se perdió la ref al renovar: el mensaje dejaría de decir qué corre');
    assert.equal(ctx.tipo, 'gated', '🔴 se perdió el tipo');
  })();
});

test('SCRUM-249 · refrescar SIN compromiso no borra el que había (no se degrada por descuido)', () => {
  return (async () => {
    const ctxPrevio = componerContexto({
      dueño: DUEÑO, tipo: 'gated', ref: 'r', finPrevistoMs: T0 + min(27), señalAntesDeMs: T0 + min(15),
    });
    const cli = clienteFalso({ marca: componerMarca(DUEÑO, T0), comentarioSchema: `${SCHEMA_ESTANDAR} ${ctxPrevio}` });
    await refrescarLock(cli, { marcaPropia: cli.estado.marca, dueño: DUEÑO }); // sin señalAntesDeMs
    assert.equal(parsearContexto(cli.estado.comentarioSchema, DUEÑO).señalMs, T0 + min(15),
      '🔴 un refresco sin compromiso ha borrado el que había: el turno pasaría a «sin compromiso» ' +
      'y se perdería justo la señal que este ticket añade');
  })();
});

// ── 5 · LA NOTA LOCAL, la otra mitad del ticket ──────────────────────────────────────────

test('SCRUM-249 · el runner y el CLI comparten la MISMA nota local', () => {
  const runner = fs.readFileSync(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'), 'utf8');
  const cli = fs.readFileSync(path.join(RAIZ, 'scripts', 'turno-staging.mjs'), 'utf8');

  for (const [nombre, fuente] of [['test-staging-gated.mjs', runner], ['turno-staging.mjs', cli]]) {
    assert.match(fuente, /from '\.\/_turno-nota\.mjs'/,
      `🔴 ${nombre} no usa el módulo compartido de la nota. Si cada uno escribe la suya, ` +
      '`turno:soltar` no podrá liberar la tanda del otro — que es exactamente el bloqueo de 30 ' +
      'minutos del 30-jul.');
  }
  assert.match(runner, /guardarNota\(\{ marca: res\.marca/,
    '🔴 el runner gateado no deja nota al tomar el turno: una tanda que muera de forma anómala ' +
    'volvería a quedar irrecuperable sin leer el marcador de la BD a mano');

  // Y que nadie vuelva a inventarse la ruta por su cuenta.
  for (const [nombre, fuente] of [['test-staging-gated.mjs', runner], ['turno-staging.mjs', cli]]) {
    assert.doesNotMatch(fuente, /yaqu-turno-staging\.json/,
      `🔴 ${nombre} vuelve a escribir la ruta de la nota a mano: dos rutas que deben coincidir y ` +
      'nada que las ate es como nació este defecto');
  }
});

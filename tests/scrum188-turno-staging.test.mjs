// SCRUM-188 — el turno de staging, escrito donde una máquina lo lee.
// SIN GATE: corre en `npm test`. No toca BD ni red — el cliente de Postgres se inyecta, así
// que el camino de escritura se ejercita entero contra un doble.
//
// LO QUE ESTO PERSIGUE no es un test rojo: es un VERDE FALSO. R6 («una sola tanda contra
// staging a la vez») era una convención entre personas, invisible para cualquier proceso. Dos
// tandas solapadas crean y BORRAN merchants derivados del id: se los quitan la una a la otra a
// mitad de suite, y el resultado puede salir VERDE por accidente. Un verde que no ejercitó lo
// que dice haber ejercitado es peor que no correr nada.
//
// LOS TRES CASOS QUE ESTE FICHERO EXISTE PARA CUBRIR, y que se verificaron EN ROJO antes de
// darlos por buenos (inyectando el comportamiento malo y viendo fallar el assert):
//   1. turno ajeno VIVO      → la tanda no arranca, y el mensaje NOMBRA al dueño y desde cuándo;
//   2. turno RANCIO          → se reclama solo, sin que nadie borre nada a mano;
//   3. formato del sufijo ROTO → la barrera de SCRUM-118 sigue funcionando igual que antes.
//
// EL 3 ES EL INNEGOCIABLE. El turno vive como sufijo del marcador de staging, que es la
// barrera que decide si alguien puede correr la tanda gateada. Si un sufijo ilegible pudiera
// invalidar el prefijo, un lock mal escrito dejaría a TODAS las sesiones sin poder correr
// tests contra staging hasta que un humano reparase el catálogo a mano. Fail-closed, sí, pero
// caída total. Por eso hay un caso por cada forma de romperlo, no uno de muestra.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';

import {
  MARCADOR,
  SEPARADOR,
  TTL_POR_DEFECTO_MS,
  MARGEN_TTL_MS,
  CODIGO_SALIDA_LOCK_AJENO,
  CODIGO_SALIDA_LOCK_PERDIDO,
  esMarcaDeStaging,
  parsearLock,
  tieneSufijoIlegible,
  idDeSesion,
  componerMarca,
  estaRancio,
  ttlParaTanda,
  mensajeLockAjeno,
  adquirirLock,
  refrescarLock,
  soltarLock,
} from '../scripts/_staging-lock.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const T0 = Date.parse('2026-07-28T12:00:00.000Z');
const min = (n) => n * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────────────────
// DOBLE DEL CLIENTE DE POSTGRES
// Emula la única celda que importa: el comentario de catálogo de la base. `$transaction` le
// pasa el mismo objeto (en Prisma es un cliente de transacción; aquí da igual porque lo que se
// vigila es la SECUENCIA leer→decidir→escribir, no el aislamiento de Postgres).
// ─────────────────────────────────────────────────────────────────────────────────────────
function clienteFalso({ marca, ahoraMs = T0, db = 'railway' } = {}) {
  const estado = { marca, ahoraMs, db, escrituras: [] };
  const cli = {
    estado,
    async $queryRawUnsafe(sql) {
      return [{ db: estado.db, marca: estado.marca, ahora: new Date(estado.ahoraMs) }];
    },
    async $executeRawUnsafe(sql) {
      // El advisory lock pasa por aquí (y no por $queryRaw) porque devuelve `void` y Prisma no
      // sabe deserializar esa columna. No es un detalle de estilo: con $queryRaw el turno no se
      // podía tomar contra una BD real, y ningún doble lo habría delatado.
      if (sql.includes('advisory')) return 1;
      const m = /, '([^']*)'\); END \$\$;$/.exec(sql);
      assert.ok(m, `el SQL de escritura no tiene la forma esperada: ${sql}`);
      estado.escrituras.push(m[1]);
      estado.marca = m[1];
      return 1;
    },
    async $transaction(fn) { return fn(cli); },
  };
  return cli;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · EL CRITERIO INNEGOCIABLE — un sufijo ilegible NUNCA invalida la barrera
// ═════════════════════════════════════════════════════════════════════════════════════════

// Cada uno de estos es una forma REAL de que el sufijo quede ilegible: una escritura a medias,
// un reloj sin milisegundos, un dueño con caracteres raros, otra herramienta escribiendo ahí.
// El sufijo es basura en los ocho; la BD sigue siendo staging en los ocho.
const SUFIJOS_ROTOS = [
  '',                                        // separador y nada detrás
  'lock:',                                   // truncado a mitad de escritura
  'lock:pepe',                               // sin @ ni fecha
  'lock:pepe@',                              // fecha vacía
  'lock:pepe@ayer',                          // fecha que no es ISO
  'lock:pepe@2026-07-28T12:00:00Z',          // ISO sin milisegundos
  'lock:pe pe@2026-07-28T12:00:00.000Z',     // dueño con espacio (fuera del charset)
  'ocupada por javier',                      // alguien escribiendo a mano, sin formato
];

test('SCRUM-188 · un sufijo ilegible NO invalida la barrera de SCRUM-118', () => {
  for (const sufijo of SUFIJOS_ROTOS) {
    const marca = MARCADOR + SEPARADOR + sufijo;
    assert.equal(
      esMarcaDeStaging(marca), true,
      `🔴 ${JSON.stringify(marca)} dejó de reconocerse como staging. Si esto pasa en la BD real, ` +
      'NINGUNA sesión puede correr la tanda gateada hasta que alguien repare el catálogo A MANO. ' +
      'El sufijo es del turno; el prefijo es de la barrera, y la barrera manda.',
    );
    assert.equal(parsearLock(marca), null, `${JSON.stringify(marca)} no debería parsearse como turno válido`);
    assert.equal(tieneSufijoIlegible(marca), true);
  }
});

test('SCRUM-188 · el prefijo se lee con la MISMA exactitud que antes del ticket', () => {
  // Lo que ANTES pasaba el `marca !== MARCADOR`, y solo eso, más el sufijo.
  assert.equal(esMarcaDeStaging(MARCADOR), true);
  assert.equal(esMarcaDeStaging(`${MARCADOR} lock:h.1@2026-07-28T12:00:00.000Z`), true);

  // Y lo que NO. Aquí es donde un `startsWith` flojo o un `includes` convertirían una base
  // cualquiera —producción incluida— en staging a ojos del guard.
  for (const impostor of [
    null, undefined, '', ' ', 0, {},
    'YAQU_STAGINGX',           // sin separador: es OTRA palabra
    'YAQU_STAGING_LOCK',       // idem, con guion bajo
    'xYAQU_STAGING',           // el prefijo tiene que estar al PRINCIPIO
    ' YAQU_STAGING',           // con espacio delante tampoco
    'yaqu_staging',            // mayúsculas: exacto
    'YAQU_STAGIN',             // truncado
    'PROD',
  ]) {
    assert.equal(
      esMarcaDeStaging(impostor), false,
      `🔴 ${JSON.stringify(impostor)} se aceptó como staging. Al otro lado de este fallo están ` +
      'los gateados CREANDO Y BORRANDO merchants contra producción.',
    );
  }
});

test('SCRUM-188 · la barrera decide SIN pasar por el parser del turno (separación estructural)', () => {
  // No es una convención de estilo: es lo que garantiza que un bug en el parseo del lock no
  // pueda tumbar la barrera. Se comprueba leyendo el fuente, no confiando en el comentario.
  const fuente = leerFuente(path.join(RAIZ, 'tests', '_staging-db.mjs'));
  assert.match(fuente, /if \(!esMarcaDeStaging\(marca\)\)/,
    'la barrera debe decidir con esMarcaDeStaging(), que no mira el sufijo');
  assert.doesNotMatch(fuente, /if \(!parsearLock\([^)]*\)\)[\s\S]{0,200}process\.exit/,
    '🔴 el parser del turno NO puede ser lo que aborte la barrera');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · TURNO AJENO VIVO — la tanda no arranca, y se dice DE QUIÉN es
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-188 · turno ajeno VIVO: no se adquiere y no se escribe nada', async () => {
  const ajeno = componerMarca('portatil-javier.4242', T0 - min(7));
  const cli = clienteFalso({ marca: ajeno, ahoraMs: T0 });

  const res = await adquirirLock(cli, { dueño: 'yo.1', ttlMs: min(45) });

  assert.equal(res.ok, false);
  assert.equal(res.motivo, 'ocupado');
  assert.equal(res.lock.dueño, 'portatil-javier.4242');
  assert.deepEqual(
    cli.estado.escrituras, [],
    '🔴 se escribió el marcador teniendo el turno otra sesión: eso es quitarle el turno a una ' +
    'tanda viva, exactamente el choque que este ticket existe para evitar.',
  );
  assert.equal(cli.estado.marca, ajeno, 'el marcador ajeno debe quedar intacto');
});

test('SCRUM-188 · el mensaje NOMBRA al dueño y desde cuándo (si no, no sirve de nada)', () => {
  const lock = parsearLock(componerMarca('portatil-javier.4242', T0 - min(7)));
  const txt = mensajeLockAjeno({ db: 'railway', lock, ahoraMs: T0, ttlMs: min(45) });

  assert.match(txt, /portatil-javier\.4242/, 'tiene que decir QUIÉN lo tiene');
  assert.match(txt, /2026-07-28T11:53:00\.000Z/, 'tiene que decir DESDE CUÁNDO');
  assert.match(txt, /7 min/, 'y cuánto lleva, que es lo que uno mira para decidir si esperar');
  assert.match(txt, /38 min/, 'y cuánto falta para que caduque solo');
  assert.match(txt, /railway/, 'y sobre qué base');
});

test('SCRUM-188 · el código de salida del turno ajeno no se confunde con los ya usados', () => {
  // 1 = hubo rojos · 2 = no se pudo comprobar · 3 = los números no cuadran · 4 = árbol movido.
  assert.equal(new Set([1, 2, 3, 4, CODIGO_SALIDA_LOCK_AJENO, CODIGO_SALIDA_LOCK_PERDIDO]).size, 6);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · TURNO RANCIO — se reclama SOLO. Es el mecanismo principal, no un extra.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-188 · turno RANCIO: se reclama solo, sin tocar nada a mano', async () => {
  const muerto = componerMarca('portatil-que-murio.999', T0 - min(50));
  const cli = clienteFalso({ marca: muerto, ahoraMs: T0 });

  const res = await adquirirLock(cli, { dueño: 'yo.1', ttlMs: min(45) });

  assert.equal(
    res.ok, true,
    '🔴 un turno caducado que no se reclama convierte «otra sesión lo tiene» en «nadie puede ' +
    'correr la tanda hasta que alguien lo borre a mano». El lock nacería siendo el próximo bloqueo.',
  );
  assert.equal(res.reclamado, true);
  assert.equal(res.lockPrevio.dueño, 'portatil-que-murio.999');
  assert.equal(parsearLock(cli.estado.marca).dueño, 'yo.1');
});

test('SCRUM-188 · la frontera del TTL cae donde tiene que caer', () => {
  const lock = parsearLock(componerMarca('otro.1', T0));
  const ttl = min(45);
  // Un minuto ANTES de caducar sigue siendo suyo — el caso que de verdad distingue el
  // mecanismo. Un lock de hace tres horas lo declara rancio cualquier implementación, incluso
  // una rota (la lección del incidente #12: el caso de prueba tiene que caer DENTRO).
  assert.equal(estaRancio(lock, T0 + ttl - min(1), ttl), false);
  assert.equal(estaRancio(lock, T0 + ttl, ttl), true);
  assert.equal(estaRancio(null, T0 + min(999), ttl), false);
});

test('SCRUM-188 · el TTL se DERIVA del hijo más lento (SCRUM-181), nunca por debajo del suelo', () => {
  // Si alguien sube GATED_CHILD_TIMEOUT_MS por encima del TTL y el TTL no le sigue, una tanda
  // legítimamente larga caduca su PROPIO turno a mitad y otra sesión entra a la misma base.
  assert.equal(ttlParaTanda(min(30)), TTL_POR_DEFECTO_MS, '30 min de hijo → manda el suelo (45 min)');
  assert.equal(ttlParaTanda(min(60)), min(60) + MARGEN_TTL_MS, '60 min de hijo → 60 + margen');
  assert.ok(ttlParaTanda(min(60)) > min(60), 'el TTL SIEMPRE por encima del hijo más lento');
  assert.equal(ttlParaTanda(0), TTL_POR_DEFECTO_MS);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ADQUIRIR / REFRESCAR / SOLTAR — el resto del contrato
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-188 · NUNCA marca una base que no lo estuviera ya', async () => {
  // Ésta es la propiedad que impide que el runner se convierta en un segundo marcar-staging
  // capaz de convertir PRODUCCIÓN en falso-staging. Sin ella, tomar el turno marcaría la base.
  for (const marca of [null, 'PROD', 'YAQU_STAGINGX', '']) {
    const cli = clienteFalso({ marca });
    const res = await adquirirLock(cli, { dueño: 'yo.1', ttlMs: min(45) });
    assert.equal(res.ok, false);
    assert.equal(res.motivo, 'no-es-staging');
    assert.deepEqual(
      cli.estado.escrituras, [],
      `🔴 se escribió el marcador sobre una base con marca ${JSON.stringify(marca)}. Marcar una ` +
      'base es responsabilidad de UN solo script (marcar-staging.mjs), con su allowlist de host.',
    );
  }
});

test('SCRUM-188 · una base libre se toma, y el sufijo ilegible se reescribe sin drama', async () => {
  const libre = clienteFalso({ marca: MARCADOR });
  const r1 = await adquirirLock(libre, { dueño: 'yo.1', ttlMs: min(45) });
  assert.equal(r1.ok, true);
  assert.equal(r1.reclamado, false);
  assert.equal(r1.sufijoIgnorado, false);
  assert.equal(parsearLock(libre.estado.marca).dueño, 'yo.1');

  const roto = clienteFalso({ marca: `${MARCADOR} ocupada por javier` });
  const r2 = await adquirirLock(roto, { dueño: 'yo.1', ttlMs: min(45) });
  assert.equal(r2.ok, true);
  assert.equal(r2.sufijoIgnorado, true, 'se debe DECIR que había un sufijo que no se entendía');
  assert.equal(parsearLock(roto.estado.marca).dueño, 'yo.1');
});

test('SCRUM-188 · soltar deja el marcador LIMPIO, y no pisa el de otro', async () => {
  const mia = componerMarca('yo.1', T0);
  const cli = clienteFalso({ marca: mia });
  const s = await soltarLock(cli, { marcaPropia: mia });
  assert.equal(s.soltado, true);
  assert.equal(cli.estado.marca, MARCADOR, 'tras soltar, el marcador vuelve a ser exactamente el de SCRUM-118');

  const ajena = componerMarca('otro.2', T0);
  const cli2 = clienteFalso({ marca: ajena });
  const s2 = await soltarLock(cli2, { marcaPropia: mia });
  assert.equal(s2.soltado, false);
  assert.equal(
    cli2.estado.marca, ajena,
    '🔴 soltó un turno que ya no era suyo. Si otra sesión lo reclamó por rancio, quitárselo al ' +
    'terminar reproduce el solapamiento — y encima justo cuando la otra acaba de empezar.',
  );
});

test('SCRUM-188 · refrescar renueva la fecha; si el turno ya no es mío, lo dice', async () => {
  const mia = componerMarca('yo.1', T0);
  const cli = clienteFalso({ marca: mia, ahoraMs: T0 + min(20) });
  const r = await refrescarLock(cli, { marcaPropia: mia, dueño: 'yo.1' });
  assert.equal(r.ok, true);
  assert.equal(parsearLock(cli.estado.marca).desdeMs, T0 + min(20), 'la fecha tiene que avanzar');

  const robada = componerMarca('otro.2', T0 + min(50));
  const cli2 = clienteFalso({ marca: robada });
  const r2 = await refrescarLock(cli2, { marcaPropia: mia, dueño: 'yo.1' });
  assert.equal(r2.ok, false);
  assert.equal(r2.motivo, 'perdido');
  assert.deepEqual(cli2.estado.escrituras, [], 'perder el turno no se arregla volviendo a escribirlo');
});

test('SCRUM-188 · el reloj que juzga la caducidad es el de la BD, no el del portátil', async () => {
  // Dos sesiones en dos máquinas con relojes distintos tienen que estar de acuerdo en si un
  // turno caducó. El único reloj común es el de Postgres, y por eso `now()` viaja en la MISMA
  // consulta que el marcador.
  const cli = clienteFalso({ marca: MARCADOR, ahoraMs: T0 });
  const res = await adquirirLock(cli, { dueño: 'yo.1', ttlMs: min(45) });
  assert.equal(res.ahoraMs, T0);
  assert.equal(parsearLock(cli.estado.marca).desdeMs, T0, 'la fecha escrita sale del now() de la BD');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// FORMA DEL MARCADOR — que lo que se escribe se pueda volver a leer, y no toque SQL
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-188 · lo que se compone se vuelve a leer igual (ida y vuelta)', () => {
  const marca = componerMarca(idDeSesion('DESKTOP-A1B2C3', 31337), T0);
  const lock = parsearLock(marca);
  assert.equal(lock.dueño, 'DESKTOP-A1B2C3.31337');
  assert.equal(lock.desdeMs, T0);
  assert.equal(esMarcaDeStaging(marca), true);
});

test('SCRUM-188 · el id de sesión no puede romper el formato aunque el hostname sea raro', () => {
  const id = idDeSesion("maq'uina @rara con espacios", 7);
  assert.doesNotMatch(id, /['@ ]/, 'ni comilla, ni arroba, ni espacios: romperían el parseo o el SQL');
  assert.equal(esMarcaDeStaging(componerMarca(id, T0)), true);
  assert.equal(parsearLock(componerMarca(id, T0)).dueño, id);
});

test('SCRUM-188 · una marca con caracteres peligrosos no llega a escribirse', () => {
  // El texto se interpola en un `DO $$ … format('… IS %L', …, '<marca>') … $$`. La defensa NO
  // es escapar: es que el charset permitido no contenga NINGUNO de los tres caracteres con los
  // que se sale de un literal o de un $$-quote de PostgreSQL.
  for (const malo of ["yo'; DROP DATABASE railway; --", 'yo$$x', 'yo\\x', 'yo\nx']) {
    assert.throws(
      () => componerMarca(malo, T0),
      /SCRUM-188/,
      `🔴 componerMarca aceptó ${JSON.stringify(malo)} y eso acaba dentro de una sentencia SQL`,
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RUNNER — que el turno se suelte por TODAS las salidas
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-188 · dentro de tanda() no queda ningún process.exit (se saltaría el finally)', () => {
  // `process.exit()` TERMINA el proceso sin ejecutar los `finally`: un solo exit colado dentro
  // del cuerpo de la tanda dejaría el turno puesto en esa rama concreta —la de un fallo, que es
  // justo cuando más rabia da— y solo lo liberaría el TTL, 45 minutos después.
  //
  // Se mira SOLO LO EJECUTABLE (SCRUM-176/168/3): el literal aparece varias veces en los
  // comentarios que explican por qué está prohibido, y un guard que mire el fichero entero se
  // caza a sí mismo. La cabecera del propio `_guard-texto.mjs` cuenta las cuatro veces que mordió.
  const fuente = leerFuente(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'));
  const i = fuente.indexOf('async function tanda()');
  assert.ok(i > 0, 'no encuentro el cuerpo de la tanda: ¿se renombró la función?');
  const cuerpo = fuente.slice(i);
  assert.doesNotMatch(
    cuerpo, /process\.exit\(/,
    '🔴 hay un process.exit dentro de tanda(): esa rama sale sin soltar el turno. Usa salir(n).',
  );
  // Y la contraparte: que el finally exista de verdad y suelte.
  assert.match(fuente, /finally \{[\s\S]*soltarLock/, 'el finally tiene que soltar el turno');
});

test('SCRUM-188 · el runner toma el turno ANTES del preflight (que ya toca la BD)', () => {
  const fuente = leerFuente(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'));
  const iLock = fuente.indexOf('adquirirLock(');
  const iPreflight = fuente.indexOf('preflight-schema-drift.mjs');
  assert.ok(iLock > 0 && iPreflight > 0);
  assert.ok(
    iLock < iPreflight,
    '🔴 el preflight consulta la BD: si el turno se toma después, la primera consulta de la ' +
    'tanda ya ha ocurrido sin coordinar con nadie.',
  );
});

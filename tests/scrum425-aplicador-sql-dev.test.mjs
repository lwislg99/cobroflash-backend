// tests/scrum425-aplicador-sql-dev.test.mjs — SCRUM-425
//
// LA HERRAMIENTA QUE APLICA SQL A `yaqu_dev_javier` ES UN MECANISMO NUEVO, Y LOS MECANISMOS
// NUEVOS TRAEN SUS ROJOS.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTA HERRAMIENTA NECESITA GUARD PROPIO
//
// `prisma db execute --file` **corre lo que le des**. `--accept-data-loss` no lo protege: esa
// bandera es de `db push` (medido en SCRUM-395). Así que lo único que separa «aplicar una columna
// nueva» de «vaciar una tabla» es el clasificador de `_aplicar-sql-dev.mjs`. Si ese clasificador
// se rompe, se rompe en silencio y con una base al otro lado.
//
// ⚠️ LO QUE ESTE FICHERO NO HACE: **no toca ninguna base de datos**. Prueba la parte PURA —qué
// sentencias se aceptan y cuáles no— que es exactamente la que decide. El destino y el `--go` se
// prueban por texto sobre el CLI, sin ejecutarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { revisar, clasificarSentencias, PERMITIDAS } from '../scripts/_aplicar-sql-dev.mjs';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// ⚠️ SOLO LO EJECUTABLE, y lo cazó este mismo test al primer intento: la prohibición de `--url`
// caía sobre **el comentario que la explica** («Ni `--url`, ni `--from-url`»). Es SCRUM-349 en su
// forma exacta —un guard de texto que se caza a sí mismo— y arreglarlo borrando el comentario
// habría sido cobrarle un impuesto a la claridad del código.
const CLI = soloEjecutable(leer('scripts/aplicar-sql-dev.mjs'), { almohadillaEsComentario: false });
const SQL_425 = 'docs/sql/scrum-425-clave-idempotencia.sql';

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-425 · SUELO: sin fichero, vacío o sin sentencias reconocibles, FALLA declarándose ciego', () => {
  // «No hay sentencias peligrosas» y «no supe leer» no pueden dar el mismo verde. Es el defecto
  // que este proyecto lleva la semana entera desenterrando, y aquí tendría una base al otro lado.
  const ilegible = revisar(null, { ruta: 'x.sql' });
  assert.equal(ilegible.ok, false, '🔴 un fichero ILEGIBLE se da por bueno');
  assert.match(ilegible.mensaje, /SUELO/, '🔴 el rojo no se declara ciego');

  const vacio = revisar('   \n\n  ', { ruta: 'x.sql' });
  assert.equal(vacio.ok, false, '🔴 un fichero VACÍO se da por bueno: «nada que aplicar» y «nada que mirar» no son lo mismo');
  assert.match(vacio.mensaje, /SUELO/, '🔴 el rojo del vacío no se declara ciego');

  // Solo comentarios: cero sentencias reconocidas. Podría ser legítimo, pero NO puede pasar en
  // silencio — si el clasificador se hubiera quedado ciego, éste sería su síntoma exacto.
  const soloComentarios = revisar('-- nada\n/* tampoco */\n', { ruta: 'x.sql' });
  assert.equal(soloComentarios.ok, false, '🔴 un fichero de solo comentarios pasa: si el clasificador está ciego, se ve igual');
  assert.equal(soloComentarios.motivo, 'suelo_sin_sentencias');

  // Y el control que impide que TODO lo de arriba pase por ceguera del propio test:
  assert.equal(revisar(leer(SQL_425), { ruta: SQL_425 }).ok, true,
    '🔴 ESCÁNER CIEGO: el fichero REAL de 425 tampoco pasa, así que los rechazos de arriba no ' +
    'prueban nada: podría estar rechazándolo todo.');
});

// ── CONTROL POSITIVO ─────────────────────────────────────────────────────────────────────────

test('SCRUM-425 · CONTROL POSITIVO: el SQL real de 425 pasa, y se clasifican sus DOS sentencias', () => {
  const r = revisar(leer(SQL_425), { ruta: SQL_425 });
  assert.equal(r.ok, true, `🔴 el SQL que ya se aplicó a las tres bases sería rechazado: ${r.mensaje}`);
  assert.deepEqual(
    r.permitidas.map((p) => p.forma),
    ['ALTER TABLE … ADD COLUMN', 'CREATE [UNIQUE] INDEX'],
    '🔴 no se reconocen las dos formas del fichero real, o se reconocen en otro orden',
  );
  // El índice NO es accesorio: sin el único, la pregunta al constraint no tiene a quién hacerse.
  assert.match(r.permitidas[1].sentencia, /albaranes_merchant_id_clave_idempotencia_key/,
    '🔴 la sentencia del índice no es la que se aplicó');
});

// ── 🔴 ROJO POR EL MECANISMO ─────────────────────────────────────────────────────────────────

test('SCRUM-425 · 🔴 ROJO: un DROP se rechaza NOMBRANDO la sentencia y su línea', () => {
  const sql = [
    '-- una migración con sorpresa',
    'ALTER TABLE "albaranes" ADD COLUMN IF NOT EXISTS "x" VARCHAR(64);',
    '',
    'DROP TABLE "albaranes";',
  ].join('\n');

  const r = revisar(sql, { ruta: 'trampa.sql' });
  assert.equal(r.ok, false, '🔴 UN `DROP TABLE` SE APLICARÍA. `--accept-data-loss` no protege a `db execute` (SCRUM-395): esto es lo único que hay.');
  assert.equal(r.rechazadas.length, 1, '🔴 se rechaza un número de sentencias distinto de 1');
  assert.equal(r.rechazadas[0].linea, 4, `🔴 el rojo dice la línea ${r.rechazadas[0].linea} y el DROP está en la 4: no basta con fallar, hay que decir DÓNDE`);
  assert.match(r.rechazadas[0].sentencia, /DROP TABLE/i, '🔴 el rojo no NOMBRA la sentencia');
  assert.match(r.mensaje, /DROP TABLE/i, '🔴 el mensaje que ve el humano no nombra la sentencia');
  assert.match(r.mensaje, /línea 4/, '🔴 el mensaje no lleva la línea');
});

test('SCRUM-425 · 🔴 ROJO: lo que la lista blanca NO conoce se rechaza — incluido lo que no borra nada', () => {
  // Esto es lo que la lista NEGRA anterior dejaba pasar, y el motivo del cambio: ninguna de las
  // tres borra una fila, y las tres pueden reescribir o bloquear una tabla entera.
  const casos = [
    ['ALTER TABLE "albaranes" DROP CONSTRAINT "x";', 'DROP CONSTRAINT partido de la lista negra'],
    ['ALTER TABLE "albaranes" ALTER COLUMN "numero" TYPE TEXT;', 'ALTER COLUMN … TYPE reescribe la tabla'],
    ['GRANT ALL ON "albaranes" TO PUBLIC;', 'una sentencia que ni siquiera es DDL de forma'],
  ];
  for (const [sentencia, porque] of casos) {
    const r = revisar(sentencia, { ruta: 'x.sql' });
    assert.equal(r.ok, false, `🔴 PASA una sentencia desconocida (${porque}): «${sentencia}». Lo desconocido se RECHAZA, no se permite.`);
  }
});

test('SCRUM-425 · la lista es BLANCA: solo tres formas declaradas, y el rojo las enumera', () => {
  assert.deepEqual(
    PERMITIDAS.map((p) => p.nombre),
    ['ALTER TABLE … ADD COLUMN', 'CREATE [UNIQUE] INDEX', 'CREATE TABLE … ( … )'],
    '🔴 la lista de formas permitidas ha cambiado. Ampliarla es una decisión a conciencia: si de ' +
    'verdad hace falta otra forma, actualiza este test CON su caso — no al revés.',
  );
  const r = revisar('VACUUM FULL;', { ruta: 'x.sql' });
  assert.match(r.mensaje, /Solo se aceptan/, '🔴 el rojo no dice qué SÍ se acepta: un rechazo sin la alternativa deja al que lo lee sin salida (SCRUM-273)');
});

// ── LA TERCERA FORMA · SCRUM-475 (11-ago-2026) ──────────────────────────────────────────────
//
// EL CASO que la trajo: `docs/sql/scrum-475-email-messages.sql`, la tabla `email_messages` que
// genera `prisma migrate diff`. No se podía aplicar porque la lista solo conocía columnas e
// índices, y una TABLA NUEVA no es ninguna de las dos.

test('SCRUM-475 · CREATE TABLE con definición de columnas SE ACEPTA', () => {
  const sql = 'CREATE TABLE IF NOT EXISTS "email_messages" (\n  "id" SERIAL NOT NULL,\n'
    + '  "merchant_id" INTEGER NOT NULL,\n  CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")\n);';
  const r = revisar(sql, { ruta: 'x.sql' });
  assert.equal(r.ok, true, `🔴 la forma que trajo esta ampliación no pasa: ${r.mensaje}`);
  assert.equal(r.permitidas[0].forma, 'CREATE TABLE … ( … )');

  // Y sin `IF NOT EXISTS` también: es la salida literal de `prisma migrate diff`.
  assert.equal(revisar('CREATE TABLE "x" ("id" SERIAL NOT NULL);', { ruta: 'x.sql' }).ok, true);
});

test('SCRUM-475 · 🔴 y la ampliación NO abre la puerta a nada más', () => {
  // La regla de la casa es que lo desconocido se rechaza. Ampliar una lista blanca es donde eso
  // se pierde en silencio: se comprueba que lo de al lado sigue cayendo.
  const casos = [
    ['DROP TABLE "email_messages";', 'un DROP con el mismo nombre de tabla'],
    ['CREATE TABLE "copia" AS SELECT * FROM "invoices";', 'la forma AS SELECT, fuera a propósito'],
    ['CREATE TABLE "x" ("id" INT); DROP TABLE "invoices";', 'un DROP escondido tras una forma válida'],
    ['CREATETABLE "x" ("id" INT);', 'una palabra clave pegada que no es la sentencia'],
    ['ALTER TABLE "email_messages" DROP COLUMN "error";', 'DROP COLUMN sobre la tabla nueva'],
  ];
  for (const [sentencia, porque] of casos) {
    assert.equal(revisar(sentencia, { ruta: 'x.sql' }).ok, false,
      `🔴 PASA algo que no debería (${porque}): «${sentencia}». La ampliación de SCRUM-475 se ` +
      'acotó a `CREATE TABLE … ( … )` justamente para que esto siguiera cayendo.');
  }
});

// ── 🔴 ROJO DE DESTINO, y el `--go` ──────────────────────────────────────────────────────────

test('SCRUM-425 · 🔴 el CLI está ACOTADO a `yaqu_dev_javier` y lo comprueba por MECANISMO', () => {
  // Se lee el CLI por texto: ejecutarlo exigiría credenciales y una base, y este fichero no toca
  // ninguna. Lo que se vigila es que las tres barreras sigan escritas.
  assert.match(CLI, /const CLAVE = 'DATABASE_URL_DEV'/,
    '🔴 la herramienta ya no está acotada a `DATABASE_URL_DEV`. Una herramienta genérica de ' +
    '«aplica este SQL a la base que le digas» es la que un día se apunta a producción.');
  assert.match(CLI, /exigirDestinoCorrecto\(CLAVE, url, WORKTREE\)/,
    '🔴 ya no se comprueba la clave contra su destino declarado (SCRUM-383). `staging` y `dev` ' +
    'COMPARTEN HOST: sin esto, mirar el host las daría por iguales.');
  assert.match(CLI, /bd\.base !== 'yaqu_dev_javier'/,
    '🔴 no se exige el NOMBRE DE BASE. Es el único discriminador entre staging y dev.');
  // Y que el rojo del destino NOMBRE la clave y la base que resolvió, no un «no cuadra» pelado.
  assert.match(CLI, /SOLO aplica a .*yaqu_dev_javier.*\$\{CLAVE\}.*\$\{bd\.base\}/s,
    '🔴 el rojo del destino no nombra la clave Y la base resuelta: «destino incorrecto» a secas ' +
    'obliga a adivinar cuál de las dos falló.');
});

test('SCRUM-425 · 🔴 sin `--go` NO se conecta con nada: el ensayo sale ANTES de lanzar Prisma', () => {
  const iEnsayo = CLI.indexOf('── ENSAYO ──');
  const iSpawn = CLI.indexOf('spawnSync(');
  assert.ok(iEnsayo > 0 && iSpawn > 0, '🔴 ESCÁNER CIEGO: no encuentro el ensayo o el spawn en el CLI');
  assert.ok(iEnsayo < iSpawn,
    '🔴 el bloque de ensayo ya no va ANTES del spawn: sin `--go` podría llegar a conectar.');
  assert.match(CLI, /if \(!GO\) \{[\s\S]*?process\.exit\(0\)/,
    '🔴 sin `--go` ya no se sale: el ensayo dejaría de ser un ensayo.');
});

test('SCRUM-425 · 🔴 la URL nunca viaja en `argv`, y el fallo del lanzamiento se dice', () => {
  // SCRUM-195: un argumento queda en `ps` y dentro del `e.message` de cualquier error.
  assert.ok(!/--url/.test(CLI) && !/--from-url/.test(CLI),
    '🔴 el CLI pasa la URL como argumento. Queda en `ps`, en el historial y en los mensajes de error.');
  assert.match(CLI, /env: \{ \.\.\.process\.env, DATABASE_URL: url \}/,
    '🔴 la URL ya no viaja en el ENTORNO del hijo.');
  // Y el rojo mudo que costó una pasada: `status: null` sin decir que el hijo ni arrancó.
  assert.match(CLI, /if \(r\.error\) morir/,
    '🔴 el error del spawn vuelve a tragarse. `status: null` significa que Prisma no llegó a ' +
    'correr, y reportar solo el código deja sin saber si falló la base o el lanzamiento.');
});

// ── el clasificador, en detalle ──────────────────────────────────────────────────────────────

test('SCRUM-425 · el clasificador no se despista con comentarios ni con líneas partidas', () => {
  // Un comentario que MENCIONA un DROP no es un DROP: cobrarle un impuesto a la claridad del
  // código es la lección de SCRUM-349.
  const conComentario = '-- ojo: aquí NO se puede hacer un DROP TABLE\nALTER TABLE "a" ADD COLUMN "b" INT;';
  assert.equal(revisar(conComentario, { ruta: 'x.sql' }).ok, true,
    '🔴 un DROP mencionado en un COMENTARIO hace caer el fichero');

  // Y una sentencia partida en varias líneas se clasifica igual y reporta la línea de su INICIO.
  const partida = '\n\nCREATE UNIQUE INDEX IF NOT EXISTS "i"\n  ON "a"("b", "c");';
  const r = clasificarSentencias(partida);
  assert.equal(r.permitidas.length, 1, '🔴 una sentencia partida en dos líneas no se reconoce');
  assert.equal(r.permitidas[0].linea, 3, `🔴 la línea reportada es ${r.permitidas[0].linea} y debería ser la del inicio (3)`);
});

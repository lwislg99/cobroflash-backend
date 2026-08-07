// tests/scrum395-preflight-migracion.test.mjs — SCRUM-395
//
// LA PUERTA DE ANTES DE APLICAR UNA MIGRACIÓN. Dos mecanismos, un solo incidente detrás:
// el 7-ago-2026 `prisma migrate diff` propuso BORRAR las cuatro columnas de C5 porque otra
// sesión había movido el worktree de rama, y `--accept-data-loss` NO cubre `db execute --file`.
// Lo único que lo paró fue una persona leyendo el SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clasificarFichero, clasificarSentencia, huellaDeSentencia, desnudar,
  PERMITIDA, RECHAZADA, AUTORIZADA,
} from '../scripts/_clasificador-sql.mjs';
import { compararRama, COINCIDE, NO_COINCIDE, NO_PUDE_LEER } from '../scripts/_preflight-migracion.mjs';

const ADITIVO = `-- AlterTable
ALTER TABLE "albaranes" ADD COLUMN     "fecha_entrega" TIMESTAMP(3),
ADD COLUMN     "lugar_entrega" TEXT;
CREATE INDEX "i" ON "audit_log"("merchant_id");`;

const DESTRUCTIVO = `-- AlterTable
ALTER TABLE "albaranes" DROP COLUMN "fecha_entrega",
DROP COLUMN "lugar_entrega";`;

// ── ① EL CASO REAL: el DROP que casi se ejecuta ──────────────────────────────────────────

test('SCRUM-395 · 🔴 el DROP COLUMN del incidente se RECHAZA, nombrando la sentencia y su línea', () => {
  const r = clasificarFichero(DESTRUCTIVO);
  assert.equal(r.ok, false,
    '🔴 EL CLASIFICADOR DEJÓ PASAR EL SQL EXACTO QUE CASI BORRA C5. Es el caso que existe para cazar.');
  assert.equal(r.rechazadas.length, 1);
  assert.equal(r.rechazadas[0].linea, 2, '🔴 no dice en qué LÍNEA está: sin eso hay que buscarla a mano');
  assert.match(r.rechazadas[0].motivo, /DROP/);
  assert.match(r.rechazadas[0].sql, /albaranes/, '🔴 no nombra la sentencia rechazada');
});

// ── ② CONTROL POSITIVO: probar solo el bloqueo no demuestra que no lo bloquees todo ──────

test('SCRUM-395 · CONTROL POSITIVO: el ALTER aditivo de C5 PASA', () => {
  const r = clasificarFichero(ADITIVO);
  assert.equal(r.ok, true,
    `🔴 se bloqueó un fichero puramente aditivo: ${r.rechazadas.map((s) => s.motivo).join(' · ')}. ` +
    'Un guard que bloquea todo es tan inútil como uno que no bloquea nada, y además se desactiva.');
  assert.equal(r.sentencias.length, 2);
  assert.ok(r.sentencias.every((s) => s.veredicto === PERMITIDA));
});

// ── ③ LO QUE LO DISTINGUE DE UN `grep DROP` ──────────────────────────────────────────────

test('SCRUM-395 · 🔴 «DROP» dentro de un COMENTARIO o de un LITERAL no dispara nada', () => {
  // SCRUM-349: un guard de texto acaba vigilando la explicación en vez del código. Pasó el mismo
  // día del incidente: el auditor improvisado de una sesión se cazó a sí mismo por su comentario.
  const conProsa = `-- Aquí NO hacemos DROP COLUMN, ver SCRUM-395.
/* Ni DROP TABLE ni TRUNCATE: esto es prosa. */
ALTER TABLE "invoices" ADD COLUMN "nota" TEXT;
COMMENT ON COLUMN "invoices"."nota" IS 'no confundir con DROP COLUMN';`;
  const r = clasificarFichero(conProsa);
  assert.equal(r.ok, true,
    '🔴 el clasificador se cazó a sí mismo: la palabra estaba en un comentario o en un literal, ' +
    'no en una sentencia. Eso es un grep, no un clasificador.');
  assert.equal(r.sentencias.length, 2);
});

test('SCRUM-395 · y el DROP de verdad NO se puede esconder detrás de un comentario', () => {
  const camuflado = `/* esto es un comentario */ ALTER TABLE "t" DROP COLUMN "c";`;
  assert.equal(clasificarFichero(camuflado).ok, false,
    '🔴 un comentario delante ha bastado para colar un DROP. El comentario se retira, la ' +
    'sentencia se clasifica igual.');
});

// ── ④ LAS DEMÁS FORMAS DESTRUCTIVAS, UNA A UNA ───────────────────────────────────────────

test('SCRUM-395 · rechaza las seis formas destructivas, y NO rechaza sus parecidas aditivas', () => {
  const malas = {
    'DROP TABLE "t"': /DROP/,
    'ALTER TABLE "t" RENAME COLUMN "a" TO "b"': /RENAME/,
    'ALTER TABLE "t" ALTER COLUMN "a" TYPE INTEGER': /tipo de una columna/,
    'TRUNCATE TABLE "t"': /TRUNCATE/,
    'DELETE FROM "t" WHERE id = 1': /DELETE/,
    'ALTER TABLE "t" ADD COLUMN "c" TEXT NOT NULL': /NOT NULL sin DEFAULT/,
  };
  for (const [sql, re] of Object.entries(malas)) {
    const c = clasificarSentencia(sql);
    assert.equal(c.veredicto, RECHAZADA, `🔴 pasó: ${sql}`);
    assert.match(c.motivo, re, `🔴 el motivo no explica por qué cae: ${sql}`);
  }
  // Las parecidas que SÍ son aditivas. Si alguna cayera, el guard sería inservible en la práctica.
  const buenas = [
    'ALTER TABLE "t" ADD COLUMN "c" TEXT',
    "ALTER TABLE \"t\" ADD COLUMN \"c\" TEXT NOT NULL DEFAULT 'x'",
    'CREATE INDEX "i" ON "t"("c")',
    'CREATE UNIQUE INDEX "i" ON "t"("c")',
    'CREATE TYPE "E" AS ENUM (\'a\')',
    "ALTER TYPE \"E\" ADD VALUE 'b'",   // enum: aditivo, NO es un ALTER COLUMN … TYPE
  ];
  for (const sql of buenas) {
    assert.equal(clasificarSentencia(sql).veredicto, PERMITIDA, `🔴 bloqueó una aditiva: ${sql}`);
  }
});

// ── ⑤ SUELO: «no supe mirar» no puede dar el mismo verde que «no hay nada» ───────────────

test('SCRUM-395 · 🔴 SUELO: lo que no se puede parsear FALLA', () => {
  const ilegibles = [
    "ALTER TABLE \"t\" ADD COLUMN \"c\" TEXT DEFAULT 'sin cerrar;",
    'ALTER TABLE "t" /* sin cerrar el bloque',
    'ALTER TABLE "sin cerrar la comilla ADD COLUMN "c" TEXT;',
  ];
  for (const sql of ilegibles) {
    const r = clasificarFichero(sql);
    assert.equal(r.ok, false, `🔴 dio verde sobre algo que no supo leer: ${sql.slice(0, 40)}`);
    assert.match(r.motivoGlobal, /NO SE PUDO PARSEAR|NO SE RECONOCIÓ/,
      '🔴 el motivo no dice que el problema es de LECTURA. «No encontré nada peligroso» y «no ' +
      'supe mirar» dan el mismo verde y significan lo contrario — aquí el segundo borra datos.');
  }
});

test('SCRUM-395 · 🔴 SUELO: un fichero vacío o solo-comentarios NO es un fichero limpio', () => {
  for (const vacio of ['', '   \n  ', '-- solo un comentario\n/* y otro */']) {
    const r = clasificarFichero(vacio);
    assert.equal(r.ok, false, `🔴 aprobó un fichero sin sentencias: ${JSON.stringify(vacio)}`);
  }
});

test('SCRUM-395 · una forma desconocida se rechaza POR DEFECTO', () => {
  const c = clasificarSentencia('VACUUM FULL "invoices"');
  assert.equal(c.veredicto, RECHAZADA);
  assert.equal(c.forma, 'DESCONOCIDA');
  assert.match(c.motivo, /no la reconozco/i,
    '🔴 el motivo tiene que decir que es por DESCONOCIMIENTO, no inventar un peligro concreto');
});

// ── ⑥ AUTORIZACIÓN: nominal, por sentencia, nunca un interruptor ─────────────────────────

test('SCRUM-395 · una autorización vale para SU sentencia y para ninguna otra', () => {
  const r0 = clasificarFichero(DESTRUCTIVO);
  const huella = r0.rechazadas[0].huella;

  const conAut = clasificarFichero(DESTRUCTIVO, {
    autorizaciones: [{ huella, motivo: 'revertir C5 en dev, pedido por el fundador', autorizadaPor: 'javier' }],
  });
  assert.equal(conAut.ok, true, '🔴 la autorización nominal no surtió efecto');
  assert.equal(conAut.sentencias[0].veredicto, AUTORIZADA);
  assert.match(conAut.sentencias[0].motivo, /revertir C5 en dev/,
    '🔴 no deja escrito el MOTIVO por el que se autorizó: una autorización sin motivo es un interruptor');

  // La misma autorización sobre OTRO DROP no vale: es nominal.
  const otro = 'ALTER TABLE "invoices" DROP COLUMN "vf_estado";';
  assert.equal(clasificarFichero(otro, {
    autorizaciones: [{ huella, motivo: 'x', autorizadaPor: 'y' }],
  }).ok, false,
    '🔴 UNA AUTORIZACIÓN HA VALIDO PARA OTRA SENTENCIA. Eso es un interruptor global disfrazado: ' +
    'se pone una vez «para salir del paso» y ampara todo lo que venga después.');
});

test('SCRUM-395 · la huella cambia con la sentencia y NO con el formato', () => {
  const a = huellaDeSentencia('ALTER TABLE "t" DROP COLUMN "c"');
  const b = huellaDeSentencia('alter   table  "t"\n  drop column "c"');
  assert.equal(a, b, '🔴 un espacio de más invalidaría la autorización: sería inusable');
  assert.notEqual(a, huellaDeSentencia('ALTER TABLE "otra" DROP COLUMN "c"'));
});

// ── ⑦ EL PREFLIGHT DE RAMA ───────────────────────────────────────────────────────────────

test('SCRUM-395 · 🔴 el preflight cae NOMBRANDO la rama encontrada y la esperada', () => {
  const r = compararRama('scrum-300-c5-fusion-rebasada', 'scrum-298-interruptor-verifactu', { worktree: 'cobroflash-b3' });
  assert.equal(r.veredicto, NO_COINCIDE);
  // El caso exacto del 7-ago-2026. Un error genérico obligaría a averiguar cuál es cuál.
  assert.match(r.mensaje, /scrum-300-c5-fusion-rebasada/, '🔴 no dice la rama que DECLARABAS');
  assert.match(r.mensaje, /scrum-298-interruptor-verifactu/, '🔴 no dice la rama ENCONTRADA');
  assert.match(r.mensaje, /cobroflash-b3/, '🔴 no dice en qué WORKTREE');
});

test('SCRUM-395 · CONTROL NEGATIVO: con la rama correcta no molesta', () => {
  const r = compararRama('scrum-395-preflight-migracion', 'scrum-395-preflight-migracion');
  assert.equal(r.veredicto, COINCIDE);
  assert.doesNotMatch(r.mensaje, /🔴/);
});

test('SCRUM-395 · 🔴 SUELO del preflight: sin poder leer la rama NO se aprueba', () => {
  // HEAD separado, git ausente, o nadie declaró nada: los tres son «no lo sé», no «coincide».
  assert.equal(compararRama('x', null).veredicto, NO_PUDE_LEER);
  assert.equal(compararRama('x', '').veredicto, NO_PUDE_LEER);
  assert.equal(compararRama('', 'x').veredicto, NO_PUDE_LEER);
  assert.match(compararRama('x', null).mensaje, /NO SE SABE/);
});

// ── ⑧ El desnudado, que es de donde sale todo lo demás ───────────────────────────────────

test('SCRUM-395 · desnudar conserva las LÍNEAS, para que el número que se reporta sea el real', () => {
  const { desnudo } = desnudar("-- uno\n-- dos\nALTER TABLE \"t\" ADD COLUMN \"c\" TEXT;");
  assert.equal(desnudo.split('\n').length, 3, '🔴 el desnudado se ha comido líneas: los números que reporte serán falsos');
  const r = clasificarFichero("-- uno\n-- dos\nALTER TABLE \"t\" ADD COLUMN \"c\" TEXT;");
  assert.equal(r.sentencias[0].linea, 3);
});

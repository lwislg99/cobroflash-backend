// tests/scrum1223-motivos-de-rechazo.test.mjs — SCRUM-1223
//
// El consejero del SQL de staging/producción (`_clasificador-sql.mjs`) RECHAZABA bien tres sentencias,
// pero dando un MOTIVO falso o vago. Un motivo falso sobre un rechazo manda a la persona a arreglar
// lo que no es:
//   · `ALTER COLUMN … DROP DEFAULT`  → «contiene DROP: destruye datos». No borra nada (SCRUM-797 lo
//     midió: cambia el catálogo, no las filas), y la lista de dev lo ADMITE a propósito.
//   · `ALTER COLUMN … DROP NOT NULL` → el mismo motivo. Tampoco borra: relaja una restricción.
//   · `UPDATE …`                     → «DESCONOCIDA». Sabemos perfectamente lo que hace: modifica filas.
//
// 🔴 SE CORRIGE EL MOTIVO, JAMÁS EL VEREDICTO: los tres siguen RECHAZADOS. Y si en el mismo ALTER hay
// otra acción (un DROP COLUMN, un cambio de TYPE), manda el motivo de la peligrosa: el motivo
// específico sólo sale cuando TODAS las acciones son de estas dos formas.
//
// Cada negación lleva al lado su positivo con el MISMO token (SCRUM-237).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarSentencia, desnudar, RECHAZADA } from '../scripts/_clasificador-sql.mjs';

const ver = (sql) => clasificarSentencia(desnudar(sql).desnudo.replace(/;\s*$/, ''));

test('SCRUM-1223 · el control: una destrucción DE VERDAD sigue diciendo «destruye datos»', () => {
  // El hermano de las negaciones de abajo: el texto existe y sale donde tiene que salir.
  assert.match(ver('ALTER TABLE "invoices" DROP COLUMN "total";').motivo, /destruye datos/);
  assert.match(ver('ALTER TABLE "invoices" DROP COLUMN "total";').forma, /^DROP$/);
});

test('SCRUM-1223 · 🔴 DROP DEFAULT: sigue RECHAZADO, y el motivo ya no dice que destruye datos', () => {
  for (const sql of ['ALTER TABLE "customers" ALTER COLUMN "merchant_id" DROP DEFAULT;', 'ALTER TABLE "customers" ALTER "merchant_id" DROP DEFAULT;']) {
    const c = ver(sql);
    assert.equal(c.veredicto, RECHAZADA, `🔴 dejó de rechazar «${sql}»: se cambió el veredicto, no el motivo.`);
    assert.doesNotMatch(c.motivo, /destruye datos/, `🔴 motivo falso para «${sql}»: «${c.motivo}»`);
    assert.match(c.forma, /DROP DEFAULT/);
    assert.match(c.motivo, /no borra/i);
  }
});

test('SCRUM-1223 · 🔴 DROP NOT NULL: sigue RECHAZADO, y el motivo ya no dice que destruye datos', () => {
  const c = ver('ALTER TABLE "invoices" ALTER COLUMN "total" DROP NOT NULL;');
  assert.equal(c.veredicto, RECHAZADA, '🔴 dejó de rechazar DROP NOT NULL');
  assert.doesNotMatch(c.motivo, /destruye datos/, `🔴 motivo falso: «${c.motivo}»`);
  assert.match(c.forma, /DROP NOT NULL/);
  assert.match(c.motivo, /no borra/i);
});

test('SCRUM-1223 · 🔴 UPDATE: sigue RECHAZADO, y se nombra por lo que es, no como «DESCONOCIDA»', () => {
  const c = ver('UPDATE "invoices" SET "total" = 0 WHERE "id" = 1;');
  assert.equal(c.veredicto, RECHAZADA, '🔴 dejó de rechazar UPDATE');
  assert.notEqual(c.forma, 'DESCONOCIDA', '🔴 UPDATE sigue saliendo como forma desconocida');
  assert.match(c.forma, /^UPDATE$/);
  assert.match(c.motivo, /modifica filas/);
  // El hermano de «DESCONOCIDA»: lo que de verdad no se reconoce SIGUE saliendo así.
  assert.equal(ver('GRANT ALL ON "invoices" TO PUBLIC;').forma, 'DESCONOCIDA');
});

test('SCRUM-1223 · 🔴 si en el MISMO ALTER va algo peligroso, manda el motivo peligroso', () => {
  const casos = [
    'ALTER TABLE "t" ALTER COLUMN "a" DROP DEFAULT, DROP COLUMN "b";',
    'ALTER TABLE "t" ALTER COLUMN "a" DROP NOT NULL, DROP COLUMN "b";',
  ];
  for (const sql of casos) {
    const c = ver(sql);
    assert.equal(c.veredicto, RECHAZADA, `🔴 pasa «${sql}»`);
    assert.match(c.motivo, /destruye datos/, `🔴 «${sql}» lleva un DROP COLUMN y el motivo lo esconde: «${c.motivo}»`);
  }
  // Y un cambio de TYPE junto a un DROP DEFAULT no se cuela como «no borra datos».
  const t = ver('ALTER TABLE "t" ALTER COLUMN "a" DROP DEFAULT, ALTER COLUMN "b" TYPE TEXT;');
  assert.equal(t.veredicto, RECHAZADA);
  assert.doesNotMatch(t.motivo, /no borra/i, `🔴 el motivo tranquiliza sobre un ALTER que cambia un TYPE: «${t.motivo}»`);
});

test('SCRUM-1223 · a pelo (con comillas), como lo llama scrum395, dice lo mismo', () => {
  const c = clasificarSentencia('ALTER TABLE "customers" ALTER COLUMN "merchant_id" DROP DEFAULT');
  assert.equal(c.veredicto, RECHAZADA);
  assert.match(c.forma, /DROP DEFAULT/);
  const u = clasificarSentencia('UPDATE "invoices" SET "total" = 0');
  assert.equal(u.veredicto, RECHAZADA);
  assert.match(u.forma, /^UPDATE$/);
});

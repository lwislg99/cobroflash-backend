// tests/scrum570-cr-en-disco.test.mjs — SCRUM-570
//
// LA TÉCNICA QUE LA CASA EXIGE EN TODOS LOS ENCARGOS MIENTE EN 1.336 FICHEROS.
//
// «Verifica con `Buffer.compare` contra el blob» vale para los ficheros NO normalizados. En los
// normalizados por `.gitattributes` —1.336 de los 1.355 que tienen CR en disco— el blob NO
// describe cómo estaba el disco antes de tocarlo, así que:
//   · comparar contra él da ROJO sobre un fichero que no has cambiado, y
//   · «arreglarlo» escribiendo el blob deja el fichero con 1.504 bytes menos, `git diff` VACÍO
//     y `git status` marcando M. Un cambio que nadie pidió y que el diff no enseña.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO mide el checkout: eso lo hace `npm run cr:censo`, que recorre 1.820 ficheros y tarda.
//    Aquí se vigila que la técnica esté escrita donde se lee y que las piezas discriminen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contarCR, limpiar, TECNICA } from '../scripts/censo-cr-en-disco.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = fs.readFileSync(path.join(RAIZ, '.claude', 'skills', 'cerebro-yaqu', 'SKILL.md'), 'utf8');
const ASESOR = fs.readFileSync(path.join(RAIZ, 'docs', 'ASESOR.md'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① CONTAR CR CON BYTES · nunca con lo que normaliza al leer
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-570 · el contador ve los CR, y sabe decir cero', () => {
  assert.equal(contarCR(Buffer.from('a\r\nb\r\n', 'utf8')), 2);
  assert.equal(contarCR(Buffer.from('a\nb\n', 'utf8')), 0,
    '🔴 cuenta CR donde no los hay: denunciaría ficheros limpios.');
  // Un CR suelto (sin LF detrás) también cuenta: es lo que `text` NO normaliza.
  assert.equal(contarCR(Buffer.from('a\rb', 'utf8')), 1);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL CASO NUEVO · el blob NO sirve de referencia en un fichero normalizado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-570 · 🔴 la comprobación contra el blob NO distingue revertido de cambiado', () => {
  // Se reproduce la aritmética del caso real sin tocar el árbol: un fichero cuyo disco lleva
  // CRLF y cuyo blob está en LF, que es lo que produce `text eol=lf`.
  const DISCO = Buffer.from('uno\r\ndos\r\ntres\r\n', 'utf8');
  const BLOB = Buffer.from('uno\ndos\ntres\n', 'utf8');
  assert.equal(contarCR(DISCO), 3);
  assert.equal(contarCR(BLOB), 0);

  // ① Revertido BIEN: el disco vuelve a sus bytes de partida.
  const revertido = Buffer.from(DISCO);
  assert.equal(Buffer.compare(revertido, DISCO), 0, 'la técnica correcta dice: revertido');
  assert.notEqual(Buffer.compare(revertido, BLOB), 0,
    '🔴 si el blob coincidiera con el disco, este caso no probaría nada: hace falta un fichero\n'
    + '  normalizado, que es justo donde la técnica de la casa falla.');

  // ② «Revertido» escribiendo el blob: la comprobación contra el blob lo da por bueno…
  const trasElBlob = Buffer.from(BLOB);
  assert.equal(Buffer.compare(trasElBlob, BLOB), 0);
  // …y el fichero ha CAMBIADO respecto a como estaba.
  assert.notEqual(Buffer.compare(trasElBlob, DISCO), 0,
    '🔴 el fallo caro no se reproduce: escribir el blob tendría que dejar el fichero distinto\n'
    + '  de como estaba, y la comprobación contra el blob decir que todo bien.');
  assert.equal(contarCR(DISCO) - contarCR(trasElBlob), 3,
    '🔴 no se pierden los CR: el cambio silencioso es justo ése.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ `limpiar` · conserva la edición, y se verifica sin necesitar el blob
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-570 · limpiar quita los CR y CONSERVA lo editado', () => {
  // 🔴 Es el caso que de verdad ocurre: el CR se descubre cuando YA has tocado el fichero y el
  //    guard de SCRUM-533 te ha tumbado la tanda. Quitar el CR del contenido ACTUAL conserva la
  //    edición; lo que la perdería es restaurar el blob.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum570-'));
  try {
    const rel = 'fichero.md';
    const abs = path.join(dir, rel);
    fs.writeFileSync(abs, Buffer.from('uno\r\ndos\r\nMI EDICION\r\n', 'utf8'));

    // Sin repositorio, `git status` no dice nada y `limpiar` cae al camino sin blob: es
    // exactamente el que hay que ejercitar.
    const r = limpiar(dir, rel);
    assert.equal(r.ok, true, '🔴 no ha limpiado: ' + r.motivo);
    assert.equal(r.cr, 3);

    const despues = fs.readFileSync(abs);
    assert.equal(contarCR(despues), 0, '🔴 quedan CR.');
    assert.ok(despues.toString('utf8').includes('MI EDICION'),
      '🔴 SE HA PERDIDO LA EDICIÓN. Es justo lo que no puede pasar: se quitan los 0x0D del\n'
      + '  contenido actual, no se restaura ninguna versión anterior.');
    assert.equal(Buffer.compare(despues, Buffer.from('uno\ndos\nMI EDICION\n', 'utf8')), 0,
      '🔴 lo escrito no es «lo mismo sin CR».');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-570 · limpiar no toca un fichero que ya está limpio', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum570-'));
  try {
    fs.writeFileSync(path.join(dir, 'x.md'), Buffer.from('uno\ndos\n', 'utf8'));
    const r = limpiar(dir, 'x.md');
    assert.equal(r.ok, true);
    assert.equal(r.cr, 0, '🔴 dice haber quitado CR de un fichero que no tenía.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ LA TÉCNICA ESTÁ ESCRITA DONDE LA LEE CADA UNO
// ═════════════════════════════════════════════════════════════════════════════════════════

const PIEZAS = [
  ['CASO A', 'que hay dos casos y no uno'],
  ['CASO B', 'el caso donde el blob no vale'],
  ['NO sirve de referencia', 'que el blob no describe el disco en un fichero normalizado'],
  ['ORIGINAL', 'que hay que guardar los bytes de disco ANTES de tocar'],
  ['SCRUM-533', 'que comprobar el blob no basta: ese guard mira el disco'],
];

test('SCRUM-570 · la técnica está en `cerebro-yaqu`, que se carga sin invocarla', () => {
  // Quien EJECUTA el encargo. Una skill que hay que invocar no sirve aquí: el CR aparece a
  // mitad de una tarea, no al empezarla.
  for (const [trozo, porque] of PIEZAS) {
    assert.ok(SKILL.includes(trozo), `🔴 \`cerebro-yaqu\` no dice ${porque} (falta «${trozo}»).`);
  }
});

test('SCRUM-570 · y en `docs/ASESOR.md`, que es donde vive el machote del encargo', () => {
  // Quien ESCRIBE el encargo: la línea equivocada está en SU plantilla, así que corregirla sólo
  // para quien la ejecuta dejaría el error saliendo en cada encargo nuevo.
  assert.match(ASESOR, /SCRUM-570/, '🔴 `docs/ASESOR.md` no recoge la corrección del machote.');
  for (const trozo of ['Buffer.compare', 'ORIGINAL', '1.336']) {
    assert.ok(ASESOR.includes(trozo), `🔴 falta «${trozo}» en la corrección del machote.`);
  }
});

test('SCRUM-570 · la técnica también se puede LEER con un comando', () => {
  for (const t of ['CASO A', 'CASO B', 'ORIGINAL']) {
    assert.ok(TECNICA.includes(t), `🔴 la técnica que imprime el script no dice «${t}».`);
  }
  assert.equal(PKG.scripts['cr:censo'], 'node scripts/censo-cr-en-disco.mjs');
  assert.equal(PKG.scripts['cr:tecnica'], 'node scripts/censo-cr-en-disco.mjs --tecnica');
  assert.equal(PKG.scripts['cr:limpiar'], 'node scripts/censo-cr-en-disco.mjs --limpiar');
  assert.ok(String(PKG.scripts['//cr:censo'] || '').length > 200, '🔴 falta el //comentario.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ Y LO QUE NO SE ROMPE · las reglas que ya vivían en `cerebro-yaqu`
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-570 · la regla del encargo completo (SCRUM-565) sigue intacta', () => {
  // Añadir un bloque a una skill que se carga siempre es fácil de hacer a costa de otra cosa.
  for (const trozo of ['=== FIN DEL ENCARGO ===', 'ÚLTIMA línea', 'adivines']) {
    assert.ok(SKILL.includes(trozo),
      `🔴 se ha perdido «${trozo}» de la regla de SCRUM-565 al meter la de SCRUM-570.`);
  }
});

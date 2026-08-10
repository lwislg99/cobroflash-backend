// tests/scrum242-restauracion-cubre-todos-los-tipos.test.mjs — SCRUM-242
//
// NINGÚN TIPO DEL SCHEMA PUEDE QUEDARSE SIN DECISIÓN EN LA RESTAURACIÓN.
//
// ── DE DÓNDE SALE, y es de un verde mío ─────────────────────────────────────────────────────
// La primera prueba de restauración se declaró **PROBADA** con un juego de datos de 5 filas. No
// tenía ni un adjunto. Y `attachments.data` es `Bytes` —las FOTOS de los trabajos viven dentro de
// Postgres (MEDIA-1, fallback sin R2)—, así que la restauración se rompía justo ahí:
//
//     column "data" is of type bytea but expression is of type jsonb
//
// 23 tablas restauraban y la única que guarda ficheros de clientes, no. El detector estaba bien; lo
// que estaba incompleto eran los DATOS de la prueba. Un suelo que solo vive en el detector no sirve
// de nada: **el caso que no se ejercita es un verde hueco**.
//
// Y el tamaño del agujero es la parte que da miedo: `Bytes` es **UN campo** en todo el schema, de
// 335. El azar de qué tabla entra en un fixture no puede decidir si las fotos de los clientes se
// recuperan.
//
// ── LA REGLA: EXHAUSTIVIDAD, NO ALLOWLIST ───────────────────────────────────────────────────
// Todo tipo escalar que el schema use tiene que estar NOMBRADO en `backup-restore.mjs`, en uno de
// los tres sitios: lleva cast SQL (`CAST_POR_TIPO`), se reconstruye (`TIPOS_BINARIOS`), o viaja
// intacto por JSON (`SIN_TRATAMIENTO`). No es una lista de exenciones: es un `switch` sin `default`
// silencioso. Un tipo nuevo en el schema pone esto rojo hasta que alguien decida qué hacer con él,
// que es exactamente lo que no pasó con `Bytes`.
//
// Sin gate: lee el DMMF y el fichero. No necesita base de datos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SCRIPT = path.join(RAIZ, 'scripts/backup-restore.mjs');
const CODEC = path.join(RAIZ, 'scripts/_backup-codec.mjs');

/** Los tipos escalares que el schema usa DE VERDAD, con cuántos campos los usan. */
function tiposDelSchema() {
  const cuenta = new Map();
  for (const m of Prisma.dmmf.datamodel.models) {
    for (const f of m.fields) {
      if (f.kind !== 'scalar') continue; // relaciones y enums no viajan como valor propio
      cuenta.set(f.type, (cuenta.get(f.type) || 0) + 1);
    }
  }
  return cuenta;
}

/**
 * Los tipos NOMBRADOS, vengan del script o del códec.
 *
 * Las tres declaraciones ya no viven en el mismo fichero: al pasar los bytes a **base64**, el
 * tratamiento de `Bytes` se mudó a `_backup-codec.mjs` —que comparten volcado y restauración—
 * porque la codificación y la decodificación tienen que ser la misma o el backup no vale. El guard
 * las sigue **donde estén**: si mañana se mueven otra vez, esto se pone rojo en vez de dar verde
 * mirando a un sitio vacío.
 */
function tiposNombrados() {
  const bloques = [
    [SCRIPT, /const CAST_POR_TIPO = \{([^}]*)\}/],
    [CODEC, /export const TIPOS_BINARIOS = Object\.freeze\(new Set\(\[([^\]]*)\]\)\)/],
    [SCRIPT, /export const SIN_TRATAMIENTO = new Set\(\[([^\]]*)\]\)/],
  ];
  const nombrados = new Set();
  for (const [fichero, re] of bloques) {
    let codigo;
    try {
      codigo = fs.readFileSync(fichero, 'utf8');
    } catch (e) {
      assert.fail(
        `🔴 no se pudo leer ${fichero} (${e && e.code ? e.code : e}).\n\n`
        + '  «Todos los tipos están cubiertos» y «no supe leer el fichero» son el mismo verde.');
    }
    // Se acota a CADA declaración: buscar los nombres sueltos por todo el fichero los encontraría
    // en los comentarios que explican el problema — la trampa de autorreferencia de SCRUM-203, que
    // en este repo ya ha mordido cuatro veces.
    const m = codigo.match(re);
    assert.ok(m, `🔴 falta la declaración ${re} en ${path.basename(fichero)}: el guard no puede comprobar nada`);
    for (const ident of m[1].match(/[A-Za-z]+/g) || []) nombrados.add(ident);
  }
  return nombrados;
}

test('SCRUM-242 · SUELO: el schema tiene tipos y el script los declara', () => {
  const cuenta = tiposDelSchema();
  assert.ok(cuenta.size >= 5,
    `🔴 solo ${cuenta.size} tipos escalares leídos del DMMF: el detector no está mirando donde cree`);
  // El caso que originó todo esto tiene que seguir estando: si `Bytes` desapareciera del schema, el
  // guard perdería su motivo y habría que revisarlo, no dejarlo verde por vacío.
  assert.ok(cuenta.has('Bytes'),
    '🔴 ya no hay ningún campo `Bytes` en el schema. Si las fotos han salido de Postgres (R2), este '
    + 'guard sobra y el paso de `bytea` de backup-restore.mjs también: revísalo, no lo dejes flotando');
  assert.ok(tiposNombrados().size >= 5,
    '🔴 el script apenas nombra tipos: o se ha reescrito, o el extractor dejó de leer sus declaraciones');
});

test('SCRUM-242 · todo tipo del schema tiene decisión declarada en la restauración', () => {
  const cuenta = tiposDelSchema();
  const nombrados = tiposNombrados();

  const huerfanos = [...cuenta.entries()]
    .filter(([t]) => !nombrados.has(t))
    .map(([t, n]) => `${t} (${n} campo${n === 1 ? '' : 's'})`);

  assert.deepEqual(
    huerfanos, [],
    '🔴 HAY TIPOS EN EL SCHEMA QUE LA RESTAURACIÓN NO CONTEMPLA: ' + huerfanos.join(', ')
    + '\n\n  Pasó con `Bytes`, que es UN campo de 335 — el de `attachments.data`, donde viven las\n'
    + '  fotos de los trabajos. La restauración iba bien en 23 tablas y moría en esa, y no se vio\n'
    + '  porque el juego de datos de la prueba no tenía adjuntos.\n\n'
    + '  Decide qué hacer con cada uno y NÓMBRALO en backup-restore.mjs:\n'
    + '    · CAST_POR_TIPO   si necesita un cast SQL al insertar,\n'
    + '    · TIPOS_BINARIOS  si hay que reconstruirlo antes de pasarlo al driver,\n'
    + '    · SIN_TRATAMIENTO si viaja por JSON sin perder nada.\n'
    + '  Y si añades uno a SIN_TRATAMIENTO, pruébalo con un dato real: eso es lo que faltó.');
});

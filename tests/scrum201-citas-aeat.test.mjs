// SCRUM-201b · GUARD DE CITAS — docs/legal/SEMAFORO_CALIBRACION.md no puede citar un código
// de error que la AEAT no publica.
//
// POR QUÉ EXISTE
//
// El semáforo de SCRUM-201 clasifica cada validación VERI*FACTU en ROJO/ÁMBAR/VERDE y ancla
// cada fila a un código oficial. Ese anclaje es TODO su valor: una tabla que cita `1204` —un
// código que no existe— parece igual de fundada que una que cita `1205`. Redactando el propio
// documento se coló un `4172` inventado, y lo cazó un cross-check manual, no la revisión.
//
// ⚠️ Y el cross-check manual vivía en el scratchpad de la sesión, fuera del repo: se habría
// borrado solo. Un guard que no está en `npm test` no es un guard, es una comprobación que
// alguien hizo una vez. De ahí este fichero.
//
// QUÉ VIGILA, en dos capas:
//
//   ① PROCEDENCIA — el SHA-256 del listado oficial vendorizado tiene que seguir siendo el que
//     el documento declara. Sin esto, la capa ② se puede "arreglar" cambiando la fuente en vez
//     de la cita, que es exactamente el fallo que haría inútil al guard.
//   ② EXACTITUD — todo código citado en una FILA DE TABLA existe en ese listado.
//
// POR QUÉ SOLO LAS FILAS DE TABLA (`|`), y no el documento entero:
// las afirmaciones de calibración viven en las tablas. La prosa cita a propósito códigos que
// NO existen (`1113`, `1141`, `1204`, `1279`, `1280`) para explicar que la numeración `1xxx`
// tiene huecos — contarlos como cita inválida sería medir de más y daría un rojo permanente.
// Es la misma trampa de `_guard-texto.mjs`: el sitio natural donde se escribe el literal
// prohibido es la prosa que explica por qué está prohibido.
//
// La fuente vendorizada es ISO-8859-1 con CRLF y se guarda BYTE A BYTE (ver .gitattributes):
// normalizarla cambiaría su SHA y rompería la capa ①.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const DOC = path.join(RAIZ, 'docs/legal/SEMAFORO_CALIBRACION.md');
const FUENTE = path.join(RAIZ, 'docs/legal/fuentes/aeat-errores.properties');

// `conComentarios: true` es OBLIGATORIO: en Markdown el `#` es un encabezado, no un
// comentario, y `leerFuente` se planta si no se lo pides explícitamente.
const doc = leerFuente(DOC, { conComentarios: true });

/** Los códigos que la AEAT publica de verdad, del fichero oficial (latin1: no es UTF-8). */
function codigosOficiales() {
  const crudo = fs.readFileSync(FUENTE, 'latin1');
  return new Set([...crudo.matchAll(/^(\d{4}) = /gm)].map((m) => m[1]));
}

/** Los códigos que el documento AFIRMA, que son los de las filas de tabla. */
function codigosCitadosEnTablas() {
  const filas = doc.split('\n').filter((l) => l.trimStart().startsWith('|'));
  return new Set([...filas.join('\n').matchAll(/`(\d{4})`/g)].map((m) => m[1]));
}

test('SCRUM-201b · ① la fuente oficial vendorizada es la que el documento declara', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(FUENTE)).digest('hex').toUpperCase();

  // El documento declara el SHA en su tabla de fuentes (§0). Se lee de ahí, no de una
  // constante en este fichero: si se copiaran los dos, cambiar la fuente y el test a la vez
  // pasaría en verde y nadie se enteraría.
  const declarado = doc.match(/`([A-F0-9]{64})`/g)?.map((s) => s.replaceAll('`', ''));
  assert.ok(declarado?.length, 'el documento debe declarar el SHA-256 de sus fuentes en §0');
  assert.ok(
    declarado.includes(sha),
    `🔴 el listado vendorizado NO es el que cita el documento.\n` +
    `   vendorizado: ${sha}\n   declarados en el doc: ${declarado.join(', ')}\n` +
    `   Si la AEAT publicó una revisión nueva, la calibración se REHACE (no se actualiza el SHA a secas).`,
  );
});

test('SCRUM-201b · ② ninguna fila de tabla cita un código que la AEAT no publica', () => {
  const oficiales = codigosOficiales();
  const citados = codigosCitadosEnTablas();

  // Suelo de cordura: si el parseo se rompiera (formato del .properties distinto, fila de
  // tabla que deja de empezar por `|`), los dos conjuntos saldrían vacíos y la comparación
  // pasaría en VERDE sin comprobar nada. Este assert es lo que impide ese verde hueco.
  assert.equal(oficiales.size, 248, `se esperaban 248 códigos oficiales, se leyeron ${oficiales.size}`);
  assert.ok(citados.size > 100, `se esperaban >100 códigos citados en tablas, se leyeron ${citados.size}`);

  const invalidas = [...citados].filter((c) => !oficiales.has(c)).sort();
  assert.deepEqual(
    invalidas, [],
    `🔴 el documento cita ${invalidas.length} código(s) que NO están en el listado oficial de la AEAT: ` +
    `${invalidas.join(', ')}. Un código inventado se lee igual de fundado que uno real.`,
  );
});

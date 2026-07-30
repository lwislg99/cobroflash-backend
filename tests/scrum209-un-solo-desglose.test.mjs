// SCRUM-209 (guard estructural · sin gate: corre en `npm test`, no toca BD ni red).
//
// UN SOLO CONSTRUCTOR DEL DESGLOSE. El defecto que arregla SCRUM-209 no fue un despiste de
// dos campos: fue que existían DOS plantillas del mismo bloque fiscal, y divergieron sin que
// nada lo notara. Arreglar los campos y dejar las dos plantillas en pie es garantizar la
// reincidencia — así que lo que se vigila aquí no es el síntoma, es la duplicación.
//
// Mira LÍNEAS EJECUTABLES (`leerFuente`): el literal prohibido vive, por definición, en el
// comentario que explica la prohibición — la trampa que mordió cuatro veces en este repo
// (SCRUM-176/168/3/193).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { leerFuente } from './_guard-texto.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(AQUI, '..', 'src');

/** El único sitio autorizado a materializar el bloque `DetalleDesglose`. */
const CONSTRUCTOR_UNICO = 'src/modules/fiscal/verifactu/registro.builder.ts';

function fuentesTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(path.join(AQUI, '..'), p).split(path.sep).join('/');

/** Ficheros de `src/` cuyo código EJECUTABLE materializa el elemento XML dado. */
function ficherosQueEmiten(elemento) {
  const patron = new RegExp(`<[^<>]*:${elemento}>`);
  return fuentesTs(SRC)
    .filter((p) => patron.test(leerFuente(p)))
    .map(rel)
    .sort();
}

test('SCRUM-209 · el bloque DetalleDesglose se construye en UN solo sitio', () => {
  const emisores = ficherosQueEmiten('DetalleDesglose');

  // Guarda de presencia: si el escáner deja de encontrar nada, el assert de abajo pasaría en
  // vacío. Cero emisores no es "todo bien", es "no he mirado".
  assert.ok(
    emisores.length > 0,
    '🔴 ESCÁNER CIEGO: ningún fichero de src/ construye DetalleDesglose. Antes de creerte el ' +
      'verde, comprueba que registro.builder.ts sigue ahí y sigue emitiendo el bloque.',
  );

  assert.deepEqual(
    emisores,
    [CONSTRUCTOR_UNICO],
    `🔴 HA VUELTO A HABER DOS CONSTRUCTORES DEL DESGLOSE.\n\n` +
      `  Lo emiten: ${emisores.join(', ')}\n` +
      `  Debe emitirlo solo: ${CONSTRUCTOR_UNICO}\n\n` +
      '  Esto es exactamente el defecto de SCRUM-209: había dos plantillas del mismo bloque,\n' +
      '  una conforme y otra no, y el .ps1 validaba la que no se enviaba. El resultado fue un\n' +
      '  XML que la AEAT rechaza (errores 1245 y 1195) con la validación en verde.\n\n' +
      '  Si necesitas el desglose en otro sitio, LLAMA a buildDetallesDesgloseXml() — acepta\n' +
      "  el prefijo de namespace ('sf' | 'sum1'). No copies la plantilla.",
  );
});

/**
 * LA DUPLICACIÓN QUE TODAVÍA EXISTE, declarada en vez de escondida.
 *
 * El `RegistroAlta` entero sigue construyéndose en DOS sitios: `registro.builder.ts`
 * (puro, pensado para el SOAP de S1-D) y `verifactu.service.ts` (el que usa la exportación
 * ZIP, y que además resuelve BD, cadena y destinatario). SCRUM-209 unificó el desglose,
 * que es donde habían divergido; unificar el registro completo es un cambio mayor y no
 * estaba en el alcance aprobado.
 *
 * Este assert NO dice que eso esté bien: dice que son DOS y que un TERCERO no entra sin que
 * alguien lo mire. Es un ratchet, no una bendición.
 */
const EMISORES_DE_REGISTRO_CONOCIDOS = [
  'src/modules/fiscal/verifactu/registro.builder.ts',
  'src/modules/invoicing/domain/verifactu.service.ts',
];

test('SCRUM-209 (ratchet) · no aparece un TERCER constructor de registros', () => {
  const emisores = [...new Set([
    ...ficherosQueEmiten('RegistroAlta'),
    ...ficherosQueEmiten('RegistroAnulacion'),
  ])].sort();

  assert.ok(emisores.length > 0, '🔴 ESCÁNER CIEGO: ningún fichero construye RegistroAlta/RegistroAnulacion.');

  assert.deepEqual(
    emisores,
    EMISORES_DE_REGISTRO_CONOCIDOS,
    '🔴 Ha cambiado quién construye registros de facturación.\n\n' +
      `  Encontrado: ${emisores.join(', ')}\n` +
      `  Conocidos:  ${EMISORES_DE_REGISTRO_CONOCIDOS.join(', ')}\n\n` +
      '  Que hoy sean DOS ya es deuda declarada (SCRUM-209): el conforme lo usa el futuro\n' +
      '  SOAP de S1-D y el otro la exportación ZIP. Un TERCERO multiplica la superficie donde\n' +
      '  volver a divergir. Si de verdad hace falta, añádelo aquí Y explica por qué no puede\n' +
      '  reutilizar registro.builder.ts.',
  );
});

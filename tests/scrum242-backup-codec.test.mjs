// tests/scrum242-backup-codec.test.mjs — SCRUM-242
//
// LOS BYTES VUELVEN IGUALES, Y EL TECHO DEL BACKUP TIENE UN NÚMERO QUE ALGUIEN VIGILA.
//
// ── DE DÓNDE SALE ───────────────────────────────────────────────────────────────────────────
// `attachments.data` es `bytea`: las FOTOS de los trabajos viven dentro de Postgres (MEDIA-1,
// fallback sin R2). El volcado entero acaba en UN `JSON.stringify`, así que el límite del backup no
// es el disco: es `MAX_STRING_LENGTH` de V8. Con los bytes escritos como objeto de índices
// —`{"0":137,…}`, ~12,5 caracteres por byte— ese techo caía en **~41 MB de fotos**: OCHO, con
// `FOTO_MAX_BYTES` a 5 MB.
//
// Y no se degradaba: `JSON.stringify` **lanza**, y con el fail-closed de SCRUM-241 no se escribe
// fichero. El día de la foto nº 9 dejaba de haber backup, del todo.
//
// ── LAS DOS COSAS QUE VIGILA, Y POR QUÉ LAS DOS ─────────────────────────────────────────────
//  1. **Ida y vuelta exacta.** Un códec que pierde bytes da un backup que restaura ficheros
//     corruptos, y eso no se nota hasta que alguien abre la foto — meses después, sin vuelta atrás.
//  2. **El factor de expansión, con número.** Un tope sin número es un tope que nadie vigila: si
//     alguien vuelve al objeto de índices, o mete cualquier codificación gorda, el techo se desploma
//     de ~400 MB a ~41 MB **sin que nada cambie de aspecto**. Aquí sale rojo.
//
// Sin gate: el códec es puro y vive aparte precisamente para poder probarlo. `backup-dump.mjs` y
// `backup-restore.mjs` ejecutan al importarlos (leen `process.env`, llaman a `process.exit`), así
// que ningún test puede importarlos — por eso el códec NO vive dentro de ellos.
import test from 'node:test';
import assert from 'node:assert/strict';
import buffer from 'node:buffer';
import {
  FORMATO_ACTUAL, FORMATOS_QUE_SE_RESTAURAN, esBinario,
  codificarBinario, decodificarBinario,
} from '../scripts/_backup-codec.mjs';

/** Casos con los bytes que rompen las codificaciones ingenuas. */
const CASOS = {
  'vacío': Buffer.alloc(0),
  'todos los valores 0-255': Buffer.from(Array.from({ length: 256 }, (_, i) => i)),
  'ceros': Buffer.alloc(64),
  'UTF-8 inválido': Buffer.from([0xc3, 0x28, 0xff, 0xfe, 0x80, 0x00, 0xed, 0xa0, 0x80]),
  'cabecera PNG': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'un byte alto': Buffer.from([0xff]),
};

test('SCRUM-242 · los bytes vuelven EXACTAMENTE iguales, pasando por JSON', () => {
  for (const [nombre, original] of Object.entries(CASOS)) {
    // El viaje real: se codifica, se serializa a JSON, se vuelve a leer y se decodifica. Probar
    // `decodificar(codificar(x))` a secas se saltaría justo el paso que rompió la primera versión.
    const viaje = JSON.parse(JSON.stringify({ d: codificarBinario(original) })).d;
    const vuelta = decodificarBinario(viaje);
    assert.ok(Buffer.isBuffer(vuelta), `🔴 ${nombre}: no vuelve como Buffer, y un bytea no acepta otra cosa`);
    assert.deepEqual(
      [...vuelta], [...original],
      `🔴 ${nombre}: los bytes NO vuelven iguales. Un fichero corrupto restaurado no se nota hasta `
      + 'que alguien abre la foto, y para entonces el backup bueno ya no existe.');
  }
});

test('SCRUM-242 · SUELO: el códec de verdad transforma, y sabe ver lo binario', () => {
  // Sin esto, un códec que devolviera el valor tal cual pasaría el test de ida y vuelta con nota.
  const bytes = CASOS['cabecera PNG'];
  const codificado = codificarBinario(bytes);
  assert.equal(typeof codificado, 'string',
    '🔴 la codificación no produce una CADENA. Si vuelve a producir un objeto de índices, el techo '
    + 'del backup se desploma de ~400 MB a ~41 MB de fotos sin que nada parezca haber cambiado');
  assert.notDeepEqual(codificado, bytes, '🔴 el códec no transforma nada');
  assert.ok(esBinario(bytes) && esBinario(new Uint8Array([1, 2])),
    '🔴 `esBinario` no reconoce lo que Prisma devuelve para un bytea: el volcado no codificaría nada');
  assert.ok(!esBinario('hola') && !esBinario({ a: 1 }) && !esBinario(null),
    '🔴 `esBinario` dice que sí a cosas que no lo son: codificaría columnas normales');
});

// El número. Base64 son 4 caracteres por cada 3 bytes = 1,333…; con las comillas del JSON, 1,34.
// El margen a 1,40 deja sitio a la puntuación sin dejar sitio a otra codificación.
const FACTOR_MAXIMO = 1.40;

test('SCRUM-242 · el factor de expansión se mantiene ≈1,34× — es el techo del backup', () => {
  const n = 512 * 1024;
  // Bytes con distribución de foto comprimida (~uniforme): los ceros comprimirían de más y darían
  // un factor falsamente bueno.
  const foto = Buffer.from(Array.from({ length: n }, (_, i) => (i * 97 + 13) % 256));
  const serializado = JSON.stringify({ d: codificarBinario(foto) });
  const factor = serializado.length / n;

  assert.ok(
    factor <= FACTOR_MAXIMO,
    `🔴 UN BYTE DE FICHERO OCUPA AHORA ${factor.toFixed(2)} CARACTERES (máximo ${FACTOR_MAXIMO}).\n\n`
    + '  El volcado entero acaba en UNA cadena, así que este factor ES el techo del backup. Con el\n'
    + '  objeto de índices (12,5×) el tope eran ~41 MB de fotos, o sea OCHO a 5 MB por foto — y al\n'
    + '  pasarse, `JSON.stringify` LANZA y el fail-closed no escribe fichero: se deja de tener\n'
    + '  backup, del todo y sin avisar.\n\n'
    + '  Si has cambiado el códec a propósito, mide el techo nuevo y escríbelo en docs/RUNBOOKS.md\n'
    + '  §R14 antes de tocar este número. Un tope sin número es un tope que nadie vigila.');

  // Y el techo, calculado con el factor REAL de esta ejecución. Se afirma que sigue siendo de
  // cientos de MB: si alguien baja el margen de arriba sin querer, esto lo dice en MB de fotos.
  const topeMB = buffer.constants.MAX_STRING_LENGTH / factor / (1024 * 1024);
  assert.ok(
    topeMB > 300,
    `🔴 el techo del volcado ha bajado a ${topeMB.toFixed(0)} MB de ficheros almacenados. `
    + 'Con fotos de 5 MB eso son ' + Math.floor(topeMB / 5) + '. Revisa el códec.');
});

test('SCRUM-242 · se sigue leyendo el formato viejo (v1), que guardaba objetos de índices', () => {
  // Un backup que el propio proyecto dejó de entender es la definición de copia inútil. No consta
  // que exista ningún fichero v1 —el volcado no lo dispara nadie: 0 invocaciones medidas—, pero
  // «no consta» no es «no hay», y la rama cuesta tres líneas.
  const original = CASOS['todos los valores 0-255'];
  const comoV1 = JSON.parse(JSON.stringify({ d: new Uint8Array(original) })).d; // {"0":…,"1":…}
  assert.ok(!Array.isArray(comoV1) && typeof comoV1 === 'object',
    'premisa: así es como v1 escribía los bytes');
  assert.deepEqual([...decodificarBinario(comoV1)], [...original],
    '🔴 un backup en formato v1 ya no se puede restaurar: sus ficheros se han vuelto ilegibles');

  assert.ok(FORMATOS_QUE_SE_RESTAURAN.includes('yaqu-logical-v1'),
    '🔴 v1 ha dejado de aceptarse en la restauración');
  assert.ok(FORMATOS_QUE_SE_RESTAURAN.includes(FORMATO_ACTUAL),
    '🔴 la restauración no acepta el formato que el volcado escribe HOY. Es el fallo más caro '
    + 'posible: se harían copias que nadie puede leer, y no se sabría hasta el día del desastre');
});

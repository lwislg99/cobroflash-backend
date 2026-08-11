// tests/scrum415-version-del-sello.test.mjs — SCRUM-415 · un sello de OTRA versión no es una
// manipulación, y no puede decirse igual.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y LO QUE COSTÓ
//
// `scrum297-evidencias-postgres` llevaba días en rojo con este mensaje:
//
//     ALB-…: EL CONTENIDO YA NO ES EL QUE SE FIRMÓ. Sello v:1 guardado a1b2…, recalculado c3d4…
//
// Es la acusación más grave que sabe hacer este verificador — y era falsa. El albarán estaba
// intacto: lo que no encajaba era la VERSIÓN declarada en el sobre. La fixture escribía `v: 1`
// y sellaba con el defecto del sellador, que para entonces ya era v:2.
//
// Localizarlo costó media mañana **porque el mensaje no lo decía**. Con dos versiones vivas, «el
// hash no cuadra» tiene dos causas de gravedad opuesta: *investiga una falsificación* y *arregla
// el número de versión de esa fila*. Salían por el mismo sitio y con el mismo texto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONTROL QUE DECIDE SI ESTO VALE
//
// Que una manipulación DE VERDAD siga saliendo como `hash_no_coincide`. Si el motivo nuevo se
// tragara también las alteraciones reales, habríamos cambiado un diagnóstico malo por uno peor:
// un verificador que suaviza las falsificaciones no sirve para nada.
import test from 'node:test';
import assert from 'node:assert/strict';

const { verificarSobre, RECETAS_POR_VERSION, versionesSoportadas } =
  await import('../dist/modules/jobs/domain/albaranVerificacion.js');

/**
 * Las fuentes llevan A LA VEZ todas las procedencias que alguna versión declara: `jobDireccion`
 * (v:1), `lugarEntrega` (v:2) y el bloque congelado del sobre (v:3). Es el contrato de
 * `FuentesContenido` —elegir es trabajo de la receta— y aquí es además el SUELO del fichero: unas
 * fuentes que no ejercieran el delta entre versiones harían que todo lo de abajo midiera una
 * coincidencia en vez de un despacho.
 *
 * 🔴 SCRUM-438: las cinco del bloque son DISTINTAS de sus homólogas vivas a propósito. Si fueran
 * iguales, una receta v:3 que se equivocara y leyera una fila viva daría el mismo hash y nadie lo
 * vería. Que sean distintas convierte «lee del sobre» en algo comprobable.
 */
const FUENTES = Object.freeze({
  numero: 'ALB-415-1',
  fecha: new Date('2026-05-12T10:00:00.000Z'),
  modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'ud' }],
  notas: null,
  jobDireccion: 'C/ Mayor 1',                    // ← la `obra` de v:1
  lugarEntrega: 'Nave 4, Pol. Industrial Sur',   // ← la `obra` de v:2
  referenciaTrabajo: 'Obra 415',
  cliente: 'Cliente SL',
  emisor: 'YaQu QA',
  emisorNif: 'B00000000',
  fechaEntrega: new Date('2026-05-13T10:00:00.000Z'),
  firmadoPorNombre: 'Ana Pérez',
  firmadoPorCalidad: 'cliente',
  // ← lo que lee v:3, y solo v:3
  contenidoCongelado: Object.freeze({
    obra: 'SELLADO: Nave 4',
    referenciaTrabajo: 'SELLADO: Obra 415',
    cliente: 'SELLADO: Cliente SL',
    emisor: 'SELLADO: YaQu QA',
    emisorNif: 'SELLADO: B00000000',
  }),
});

const sobre = (v, contentHash) => ({ evidencia: { v, hashAlg: 'sha256', contentHash }, contenido: FUENTES });

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-415 · SUELO: hay MÁS DE UNA versión viva, y dan hashes distintos', () => {
  const vs = versionesSoportadas();
  assert.ok(vs.length >= 2,
    `🔴 el recetario solo despacha ${vs.length} versión(es). Con una sola, «declara v:X y su hash ` +
    'es el de v:Y» no puede ocurrir y todo lo de abajo pasaría sin medir nada.');

  const hashes = new Set(vs.map((v) => RECETAS_POR_VERSION[v](FUENTES)));
  assert.equal(hashes.size, vs.length,
    '🔴 dos recetas distintas dan el MISMO hash sobre las mismas fuentes. O las fuentes de prueba ' +
    'no ejercen el delta entre versiones, o dos versiones comparten regla — y eso último haría ' +
    'indistinguibles dos sellos bajo números distintos.');
});

// ── EL DIAGNÓSTICO ───────────────────────────────────────────────────────────────────────────

test('SCRUM-415 · 🔴 un sobre que declara v:1 con hash de v:2 se NOMBRA, no se acusa', () => {
  const hashV2 = RECETAS_POR_VERSION[2](FUENTES);
  const r = verificarSobre(sobre(1, hashV2));

  assert.equal(r.cuadra, false);
  assert.equal(r.motivo, 'hash_de_otra_version',
    `🔴 el motivo es «${r.motivo}». Con «hash_no_coincide» el paquete declara MANIPULADO un ` +
    'albarán intacto: el contenido cuadra al bit con otra regla. Son dos hechos distintos y no ' +
    'pueden salir por el mismo sitio.');

  // El mensaje tiene que NOMBRAR las dos versiones: eso es lo que convierte «algo pasa» en «esto
  // pasa y así se arregla».
  assert.match(r.mensaje, /v:1/, '🔴 el mensaje no dice qué versión DECLARA el sobre.');
  assert.match(r.mensaje, /v:2/, '🔴 el mensaje no dice con qué versión cuadra de verdad el hash.');
  assert.doesNotMatch(r.mensaje, /YA NO ES EL QUE SE FIRM/,
    '🔴 el mensaje sigue acusando de manipulación un documento cuyo contenido está intacto.');
});

test('SCRUM-415 · 🔴 EL CONTROL: una manipulación DE VERDAD sigue siendo hash_no_coincide', () => {
  // Un hash que no es el de NINGUNA receta. Sin este control, el motivo nuevo podría estar
  // tragándose también las alteraciones reales — y un verificador que suaviza las falsificaciones
  // es peor que no tenerlo.
  const r = verificarSobre(sobre(2, 'ff'.padEnd(64, '0')));

  assert.equal(r.motivo, 'hash_no_coincide',
    `🔴 una alteración real sale como «${r.motivo}». El sondeo de otras recetas NO puede convertir ` +
    'una manipulación en un problema de metadatos.');
  assert.match(r.mensaje, /YA NO ES EL QUE SE FIRM/,
    '🔴 se ha perdido la acusación explícita en el único caso donde SÍ corresponde.');
});

test('SCRUM-415 · los sellos v:1 —los de producción— siguen verificando', () => {
  // No se pueden volver a sellar: lo sellado no se toca (regla 29). Si un día dejan de verificar,
  // el que está mal es el verificador, no los documentos.
  const r1 = verificarSobre(sobre(1, RECETAS_POR_VERSION[1](FUENTES)));
  assert.equal(r1.cuadra, true, `🔴 un sello v:1 correcto ya no verifica: ${r1.mensaje}`);

  const r2 = verificarSobre(sobre(2, RECETAS_POR_VERSION[2](FUENTES)));
  assert.equal(r2.cuadra, true, `🔴 un sello v:2 correcto ya no verifica: ${r2.mensaje}`);
});

// ── ⑦ SCRUM-438 · EL BUCLE CRUZADO, YA CON TRES RECETAS ──────────────────────────────────────
//
// v:3 no añade «una receta»: añade una receta Y N comparaciones cruzadas más. El bucle prueba cada
// receta contra cada sobre, así que con tres versiones hay el doble de sondeos que con dos. Lo que
// hay que demostrar es que SIGUE SEPARANDO las dos cosas —«manipulado» y «hash de otra versión»—
// con tres, y no solo con dos: un sondeo más ancho tiene más ocasiones de confundirlas.

test('SCRUM-415 · ⑦ 🔴 con TRES recetas el bucle sigue separando «manipulado» de «otra versión»', () => {
  const vs = versionesSoportadas();
  assert.ok(vs.length >= 3,
    `🔴 el recetario despacha ${vs.length} versión(es). Este test existe para probar el bucle cruzado ` +
    'con TRES, y con menos no prueba lo que dice probar.');

  // Cada versión, declarada bajo el número de OTRA. Las N×(N-1) parejas, no una muestra.
  const cruces = [];
  for (const declarada of vs) {
    for (const real of vs) {
      if (declarada === real) continue;
      const r = verificarSobre(sobre(declarada, RECETAS_POR_VERSION[real](FUENTES)));
      cruces.push(`v:${declarada} con hash de v:${real} → ${r.cuadra ? 'cuadra' : r.motivo}`);
      assert.equal(r.motivo, 'hash_de_otra_version',
        `🔴 un sobre que declara v:${declarada} con el hash de v:${real} sale como «${r.motivo}». ` +
        'Con tres versiones el bucle tiene más parejas que comprobar y no puede perder ninguna: ' +
        'cada una que se le escape se convierte en una acusación de manipulación contra un ' +
        'documento intacto.');
      assert.match(r.mensaje, new RegExp(`v:${real}`),
        `🔴 el mensaje no NOMBRA la versión con la que sí cuadra (v:${real}). Sin ese dato, «algo ` +
        'pasa» no llega a ser «esto pasa y así se arregla», que es todo el valor de este motivo.');
    }
  }
  assert.equal(cruces.length, vs.length * (vs.length - 1),
    `🔴 SUELO: solo se han probado ${cruces.length} cruces de los ${vs.length * (vs.length - 1)} que ` +
    'hay. El bucle de este test se ha quedado corto y su verde no cubre lo que dice cubrir.');

  // 🔴 EL CONTROL, y sin él lo de arriba no vale: con TRES recetas sondeando, una manipulación de
  // verdad tiene tres ocasiones de colarse como «problema de metadatos». No puede colarse.
  const manipulado = verificarSobre(sobre(3, 'ff'.padEnd(64, '0')));
  assert.equal(manipulado.motivo, 'hash_no_coincide',
    `🔴 una alteración real sale como «${manipulado.motivo}» con tres recetas vivas. El sondeo se ha ` +
    'vuelto tan ancho que se traga las falsificaciones: es peor que no tenerlo.');
  assert.match(manipulado.mensaje, /YA NO ES EL QUE SE FIRM/);
});

test('SCRUM-415 · ⑦ v:3 NO lee las fuentes vivas: cambiarlas las seis no mueve su hash', () => {
  // Es lo que hace que el bucle cruzado con tres recetas signifique algo: si v:3 leyera en vivo,
  // «cuadra con la receta de v:3» no distinguiría nada de v:2.
  const antes = RECETAS_POR_VERSION[3](FUENTES);
  const conLasVivasCambiadas = RECETAS_POR_VERSION[3]({
    ...FUENTES,
    jobDireccion: 'OTRA COSA', lugarEntrega: 'OTRA COSA', referenciaTrabajo: 'OTRA COSA',
    cliente: 'OTRA COSA', emisor: 'OTRA COSA', emisorNif: 'OTRA COSA',
  });
  assert.equal(conLasVivasCambiadas, antes,
    '🔴 la receta de v:3 se mueve al cambiar una fila viva: sigue leyendo fuera del sobre, que es ' +
    'el defecto entero que v:3 vino a cerrar.');

  // CONTROL: cambiando el BLOQUE sí se mueve. Si no, este test compararía dos constantes iguales.
  const conElBloqueCambiado = RECETAS_POR_VERSION[3]({
    ...FUENTES, contenidoCongelado: { ...FUENTES.contenidoCongelado, cliente: 'OTRO CLIENTE' },
  });
  assert.notEqual(conElBloqueCambiado, antes,
    '🔴 cambiar el bloque congelado no mueve el hash de v:3: entonces la receta no lo lee y el test ' +
    'de arriba pasaba por no medir nada.');
});

test('SCRUM-415 · el sondeo no inventa versiones: una receta que revienta no dice nada', () => {
  // Si la receta de la otra versión lanza sobre estas fuentes, el sondeo la salta y el veredicto
  // vuelve a ser el de siempre. Una excepción NO puede leerse como «cuadra con la otra».
  const recetarioQueRevienta = Object.freeze({
    1: RECETAS_POR_VERSION[1],
    2: () => { throw new Error('esta receta no aplica'); },
  });
  const r = verificarSobre(sobre(1, 'ab'.padEnd(64, '0')), recetarioQueRevienta);
  assert.equal(r.motivo, 'hash_no_coincide',
    `🔴 el motivo es «${r.motivo}»: una receta que lanza se está leyendo como una coincidencia.`);
});

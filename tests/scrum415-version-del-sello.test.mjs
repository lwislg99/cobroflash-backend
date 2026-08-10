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
 * Las fuentes llevan LAS DOS procedencias de `obra` a la vez —`jobDireccion` (v:1) y
 * `lugarEntrega` (v:2)—, que es el contrato de `FuentesContenido`: elegir es trabajo de la receta.
 * Y son DISTINTAS a propósito: si fuesen iguales, las dos recetas darían el mismo hash y este
 * fichero entero mediría una coincidencia en vez de un despacho.
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

// tests/scrum431-sobre-lee-vivo.test.mjs — SCRUM-431
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CRUCE QUE DECIDE EL TICKET, MEDIDO Y NO SUPUESTO
//
// La receta v:1 saca `obra` de `Job.direccion` — una fila que sigue VIVA. Hasta SCRUM-424 nadie
// escribía ese campo, así que todos los sobres v:1 se sellaron con la obra vacía. SCRUM-424 abre
// la escritura.
//
// Pregunta: ¿qué le pasa a un sobre v:1 antiguo cuando el Job que lo originó gana dirección hoy?
// Medido antes de escribir una línea de arreglo, con la receta CONGELADA y sin base de datos:
//
//     ANTES  (Job sin dirección):   cuadra = true
//     DESPUÉS (Job con dirección):  cuadra = false · hash_no_coincide
//     «ALB-…: EL CONTENIDO YA NO ES EL QUE SE FIRMÓ.»
//
// Sobre una entrega que nadie ha tocado. Un verificador que lee el dato en vivo dice «esto coincide
// con lo que hay AHORA», no «esto es lo que se firmó» — y la segunda es la que le vendemos al
// profesional como su garantía.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// REGLA 29 · LOS VECTORES CONGELADOS
//
// Ninguna evidencia ya emitida puede cambiar de veredicto por este arreglo. Los hashes de abajo
// están escritos a mano: si una receta cambia, cambian ellos y este fichero cae. Es la única forma
// de que «no hemos tocado lo emitido» sea una comprobación y no una promesa.
import test from 'node:test';
import assert from 'node:assert/strict';

const { verificarSobre, RECETAS_POR_VERSION, versionesSoportadas } =
  await import('../dist/modules/jobs/domain/albaranVerificacion.js');

/** Un albarán firmado en marzo, cuando `Job.direccion` no la escribía nadie. */
const fuentes = (extra = {}) => ({
  numero: 'ALB-2026-0007',
  fecha: new Date('2026-03-02T09:00:00.000Z'),
  modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Reparacion', cantidad: 1, unidad: 'ud' }],
  notas: null,
  jobDireccion: null,          // ← vacía al firmar: nadie escribía el campo
  lugarEntrega: null,
  referenciaTrabajo: 'Fuga cocina',
  cliente: 'Cliente SL',
  emisor: 'YaQu QA',
  emisorNif: 'B00000000',
  fechaEntrega: null,
  firmadoPorNombre: null,
  firmadoPorCalidad: null,
  ...extra,
});

const sobreDe = (v, contentHash) => ({ v, hashAlg: 'sha256', contentHash });

// ── VECTORES CONGELADOS (regla 29) ───────────────────────────────────────────────────────────

/**
 * Los hashes que las recetas dan HOY sobre `fuentes()`. Escritos a mano a propósito.
 *
 * 🔴 Si este test cae, NO se actualizan los números: significa que una receta ha cambiado y que
 * todos los sobres emitidos con ella acaban de dejar de verificar. Lo sellado no se toca ni para
 * arreglarlo (regla 29).
 */
const VECTORES = Object.freeze({
  1: '9bae1af19061732e05f5c4643911a9ddd28252dae23418dfcc70963b76863619',
  2: '6a9b61e476cc527be2cf136c5fc6a6170b4a56b9c4ba3db68205f37055f0587b',
});

test('SCRUM-431 · 🔴 REGLA 29: las recetas emitidas dan EXACTAMENTE el mismo hash que antes', () => {
  // Se comprueba la propiedad, no el número copiado de una ejecución: el hash de v:1 sobre estas
  // fuentes tiene que ser ESTABLE entre ejecuciones y NO depender de los campos que v:1 ignora.
  const h1 = RECETAS_POR_VERSION[1](fuentes());
  assert.equal(h1, VECTORES[1],
    '🔴 LA RECETA v:1 HA CAMBIADO. No actualices el número: significa que TODOS los sobres v:1 ' +
    'emitidos acaban de dejar de verificar, y no se pueden volver a sellar (regla 29). El que está ' +
    'mal es el cambio, no el vector.');
  assert.equal(RECETAS_POR_VERSION[2](fuentes()), VECTORES[2],
    '🔴 LA RECETA v:2 HA CAMBIADO. Mismo caso: lo sellado no se toca ni para arreglarlo.');

  // v:1 ignora los tres campos que estrenó v:2: tocarlos NO puede mover su hash. Si lo moviera,
  // cada sobre v:1 emitido cambiaría de veredicto al rellenarse un campo que ni siquiera es suyo.
  const conCamposDeV2 = fuentes({ fechaEntrega: new Date('2026-03-03T00:00:00.000Z'), firmadoPorNombre: 'Ana', firmadoPorCalidad: 'cliente' });
  assert.equal(RECETAS_POR_VERSION[1](conCamposDeV2), h1,
    '🔴 la receta v:1 ha empezado a mirar campos de v:2. Todos los sobres v:1 emitidos cambiarían ' +
    'de veredicto en cuanto esos campos se rellenen — y no se pueden volver a sellar (regla 29).');

  // Y el sobre que cuadraba, sigue cuadrando.
  const r = verificarSobre({ evidencia: sobreDe(1, h1), contenido: fuentes() });
  assert.equal(r.cuadra, true, `🔴 un sobre v:1 correcto ha dejado de verificar: ${r.mensaje}`);
});

test('SCRUM-431 · SUELO: hay dos versiones vivas y dan hashes distintos', () => {
  const vs = versionesSoportadas();
  assert.ok(vs.length >= 2, `🔴 solo ${vs.length} versión(es) viva(s): el fichero mediría otra cosa.`);
  assert.notEqual(RECETAS_POR_VERSION[1](fuentes()), RECETAS_POR_VERSION[2](fuentes()),
    '🔴 las dos recetas dan el mismo hash sobre las mismas fuentes: no se estaría midiendo el ' +
    'despacho por versión sino una coincidencia.');
});

// ── EL CRUCE ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-431 · 🔴 EL CRUCE: un sobre v:1 antiguo DEJA DE VERIFICAR cuando su Job gana dirección', () => {
  const sello = RECETAS_POR_VERSION[1](fuentes());               // se firmó con la obra vacía
  const sobre = sobreDe(1, sello);

  const antes = verificarSobre({ evidencia: sobre, contenido: fuentes() });
  assert.equal(antes.cuadra, true, '🔴 el punto de partida ya no cuadra: el resto no mide nada.');

  // SCRUM-424 abre la escritura de `Job.direccion`. El albarán NO se toca: su fila está congelada.
  const despues = verificarSobre({ evidencia: sobre, contenido: fuentes({ jobDireccion: 'C/ Mayor 1' }) });

  assert.equal(despues.cuadra, false,
    '🔴 SI ESTO PASA A `true`, el defecto se ha arreglado de verdad y este test tiene que cambiar ' +
    'con su motivo escrito. Mientras la receta lea `Job.direccion` en vivo, no puede cuadrar.');
  assert.equal(despues.motivo, 'dato_vivo_cambiado',
    `🔴 el motivo es «${despues.motivo}». Con «hash_no_coincide» el paquete de evidencias declara ` +
    'MANIPULADA una entrega que nadie ha tocado: lo único que ha cambiado es una fila de otra tabla.');
  assert.match(despues.mensaje, /jobDireccion/,
    '🔴 el mensaje no nombra el dato que ha cambiado. «No cuadra» sin decir cuál obliga a quien lo ' +
    'lee a sospechar del documento, del verificador o de sí mismo, sin distinguir.');
  assert.doesNotMatch(despues.mensaje, /YA NO ES EL QUE SE FIRM/,
    '🔴 se sigue acusando de manipulación a un albarán intacto.');
});

test('SCRUM-431 · el mismo defecto existe en v:2 para los OTROS cuatro campos vivos', () => {
  // C5 (SCRUM-300) NO resolvió esto: solo le cambió la fuente a `obra`. `referenciaTrabajo`,
  // `cliente`, `emisor` y `emisorNif` se leen en vivo en LAS DOS versiones, así que subir de
  // versión no protege a los sobres ya firmados.
  for (const v of [1, 2]) {
    const sello = RECETAS_POR_VERSION[v](fuentes({ cliente: null }));
    const r = verificarSobre({ evidencia: sobreDe(v, sello), contenido: fuentes({ cliente: 'Cliente SL' }) });
    assert.equal(r.cuadra, false, `🔴 v:${v}: el punto de partida no mide nada.`);
    assert.equal(r.motivo, 'dato_vivo_cambiado',
      `🔴 v:${v} · corregir la razón social de un cliente sale como «${r.motivo}». Es una operación ` +
      'legítima y normal, y hoy convierte en «manipulados» todos los albaranes firmados que cuelgan ' +
      'de ese cliente. El despacho por versión de C5 NO cubre este caso.');
  }
});

test('SCRUM-431 · 🔴 EL CONTROL: una manipulación DE VERDAD sigue siendo hash_no_coincide', () => {
  // Sin esto, el motivo nuevo podría estar tragándose también las alteraciones reales — y un
  // verificador que suaviza las falsificaciones es peor que no tenerlo.
  const sello = RECETAS_POR_VERSION[1](fuentes());
  const manipulado = fuentes({ lineas: [{ concepto: 'Reparacion', cantidad: 9, unidad: 'ud' }] });
  const r = verificarSobre({ evidencia: sobreDe(1, sello), contenido: manipulado });

  assert.equal(r.motivo, 'hash_no_coincide',
    `🔴 cambiar las LÍNEAS del albarán sale como «${r.motivo}». Las líneas son del propio albarán ` +
    'y no de una fila viva: eso es exactamente lo que el sello existe para detectar.');
  assert.match(r.mensaje, /YA NO ES EL QUE SE FIRM/,
    '🔴 se ha perdido la acusación explícita en el único caso donde SÍ corresponde.');
});

test('SCRUM-431 · el sondeo NO inventa: si el campo ya estaba vacío, no dice nada', () => {
  // Un sobre roto cuyo dato vivo ya venía vacío no puede salir como «cambió un dato vivo»: no hay
  // nada que blanquear, y afirmarlo sería adivinar.
  const r = verificarSobre({ evidencia: sobreDe(1, 'ff'.padEnd(64, '0')), contenido: fuentes() });
  assert.equal(r.motivo, 'hash_no_coincide',
    `🔴 el motivo es «${r.motivo}» con todos los datos vivos ya vacíos: el sondeo está afirmando ` +
    'algo que no ha demostrado.');
});

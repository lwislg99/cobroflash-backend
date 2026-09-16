// tests/scrum369-verificador-sello.test.mjs — SCRUM-369
//
// EL SELLO DE LA FIRMA NO TENÍA VERIFICADOR. `computeAlbaranContentHash` se invocaba en UN SOLO
// SITIO del árbol —al firmar— y nada lo recalculaba: una huella guardada que nadie comparaba con
// nada. Un hash que nadie recalcula no detecta ninguna manipulación.
//
// Lo que este fichero tiene que dejar demostrado, y en este orden:
//
//   ① CONTROL POSITIVO — un albarán firmado y sin tocar verifica OK.
//   ② 🔴 CONTROL NEGATIVO, Y ES *EL* TEST — se cambia UN carácter de UNA línea y el verificador
//      FALLA NOMBRANDO el albarán. Si esto no cae, el verificador no verifica nada.
//   ③ SUELO — con cero albaranes que mirar, el informe dice `no_se_pudo_mirar`, jamás
//      `todo_cuadra`. «Cero manipulados» y «no supe mirar» son el mismo número con significados
//      opuestos.
//   ④ DESPACHO POR VERSIÓN — un sobre se recalcula con la regla de SU versión. Aplicar la de v:2
//      a un sobre v:1 declararía manipulados todos los albaranes anteriores: el peor resultado
//      posible de esta herramienta, peor que no tenerla.
//   ⑤ CENSO POR VERSIÓN medido sobre la población, no supuesto; y una versión sin receta se
//      DECLARA en vez de aproximarse con la más parecida.
//   ⑥ ⚠️ NUNCA SE REESCRIBE UN SOBRE — lo firmado no se toca ni siquiera para arreglarlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS VECTORES CONGELADOS, Y POR QUÉ SON LITERALES Y NO SE RECALCULAN
//
// Los hashes de abajo están escritos A MANO, calculados una vez con el sellador de
// `1ef584cb6f16dad91bbb20fa33d7ad4d62e9165c` y comprobados idénticos contra
// `7503c894d45c8b3f55c6debc6eb12822c56a4191` (SCRUM-367 tocó ese fichero a mitad del ticket: la
// primera cosa que este vector demostró fue que NO cambió el cálculo del sello).
// Es deliberado: un test que compara el resultado del
// sellador contra **el resultado del propio sellador** no puede fallar nunca — si alguien cambia
// el cálculo de v:1, los dos lados se mueven juntos y el verde se mantiene. Ese test mide que la
// función es determinista, no que sigue calculando LO MISMO QUE EN 2026.
//
// Con el literal congelado, cualquier cambio en el cálculo de v:1 —reordenar una clave, extraer un
// helper compartido, normalizar un campo— sale ROJO EN EL COMMIT QUE LO HACE. Que es exactamente
// cuando tiene que salir: el daño de tocar v:1 no se ve en el momento (los ya firmados no se
// vuelven a sellar), aparece años después como un «no coincide» sobre un albarán intacto, o sea
// una acusación de falsificación contra un papel que nadie tocó.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { computeAlbaranContentHash } from '../dist/modules/jobs/domain/albaran.service.js';
import {
  RECETAS_POR_VERSION,
  verificarSobre,
  verificarPoblacion,
  versionesSoportadas,
} from '../dist/modules/jobs/domain/albaranVerificacion.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE_SELLADOR = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaran.service.ts');
const FUENTE_VERIFICADOR = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaranVerificacion.ts');

// ── LA POBLACIÓN DE PRUEBA ───────────────────────────────────────────────────────────────
//
// Tres albaranes firmados en tiempos de v:1, con la forma que tienen de verdad:
//
//  · `completo`   — VALORADO, todos los campos con valor, acentos y decimales. Es el que more
//                   cosas puede romper al recalcular.
//  · `minimo`     — el caso ORDINARIO en producción: `Job.direccion` a null (nadie escribe ese
//                   campo), sin notas, sin cliente ni emisor resueltos.
//  · `notaVacia`  — `notas: ''`. Está para fijar que la cadena vacía de `notas` se selló COMO ''
//                   y no como null: el sellador usa `?? null` con ese campo y `||` con los demás,
//                   y confundir las dos reglas produciría un «no coincide» sobre un papel intacto.
//
// ⚠️ `lugarEntrega` va CON VALOR y DISTINTO de `jobDireccion` en el primero, a propósito. Con las
// dos fuentes a null —lo «realista»— leer una u otra da el mismo hash y el despacho por versión
// pasaría en verde aunque no despachase nada. Un caso mal elegido convierte el guard en decorado.
const FUENTES = {
  completo: {
    numero: 'ALB-2026-0369',
    fecha: new Date('2026-07-14T07:30:00.000Z'),
    modoValoracion: 'VALORADO',
    lineas: [
      { concepto: 'Sustitución de bajante de fibrocemento', cantidad: 12.5, unidad: 'm', precioUnitario: 38.4, tipoIva: 21 },
      { concepto: 'Retirada de escombro y limpieza', cantidad: 1, unidad: 'ud', precioUnitario: 90, tipoIva: 10 },
    ],
    notas: 'Cliente conforme. Se deja llave de paso señalizada.',
    jobDireccion: 'C/ Alcalá 231, 3.º B — Madrid',
    lugarEntrega: 'C/ Nueva 1 (puesto DESPUÉS de firmar)',
    referenciaTrabajo: 'Reforma baño — 2.ª fase',
    cliente: 'Comunidad de Propietarios Alcalá 231',
    emisor: 'Fontanería Pereira S.L.',
    emisorNif: 'B12345678',
  },
  minimo: {
    numero: 'ALB-2026-0002',
    fecha: new Date('2026-03-02T10:00:00.000Z'),
    modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'Revisión de caldera', cantidad: 1, unidad: 'ud' }],
    notas: null,
    jobDireccion: null,
    lugarEntrega: null,
    referenciaTrabajo: null,
    cliente: null,
    emisor: null,
    emisorNif: null,
  },
  notaVacia: {
    numero: 'ALB-2026-0003',
    fecha: '2026-04-19T08:15:00.000Z',
    modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'Desatasco', cantidad: 2, unidad: 'h' }],
    notas: '',
    jobDireccion: null,
    lugarEntrega: null,
    referenciaTrabajo: 'Aviso 4471',
    cliente: 'Bar El Rincón',
    emisor: 'Fontanería Pereira S.L.',
    emisorNif: 'B12345678',
  },
};

/** El hash que el sellador de v:1 escribió en su día. Literales: ver la cabecera. */
const SELLOS_V1_CONGELADOS = {
  completo: '73ff8a377ca43b6fc70292db136e6415b64ac76c06dad09d7b2a6eaa6c8b2d3b',
  minimo: 'dedabe2d7a6074be1f149ef03001046c2dd72b984554324a9e86c3a521638b7d',
  notaVacia: '97496cefe5c58bf801d75349ae80d72c44ac390b58244eb8e766ffd6fda82431',
};

/** Un albarán firmado tal y como llega a verificar: su sobre guardado + su contenido de hoy. */
function firmadoV1(clave, cambios = {}) {
  return {
    evidencia: { v: 1, hashAlg: 'sha256', contentHash: SELLOS_V1_CONGELADOS[clave] },
    contenido: { ...FUENTES[clave], ...cambios },
  };
}

const POBLACION_INTACTA = () => Object.keys(FUENTES).map((k) => firmadoV1(k));

// ── LA POBLACIÓN v:2 (SCRUM-300 · C5) ────────────────────────────────────────────────────
//
// v:2 no añade campos y ya está: **cambia la FUENTE de `obra`**. v:1 la tomaba de
// `Job.direccion` —que no escribe nadie, así que sellaba vacío—; v:2 la toma de
// `Albaran.lugarEntrega`, columna propia. Y añade tres claves al final: `fechaEntrega`,
// `firmadoPorNombre` y `firmadoPorCalidad`.
//
// ⚠️ En `completo` y `libre`, `lugarEntrega` va CON VALOR y DISTINTO de `jobDireccion` a
// propósito: con las dos a null, leer una u otra da el mismo hash y el despacho por versión
// pasaría en verde sin despachar nada. Un caso mal elegido convierte el guard en decorado.
//
// ⚠️ `firmadoPorCalidad` guarda el `id` de la ranura, NO su etiqueta — y en la ranura libre,
// `otro:<texto>`. Es lo que permite que aprobar la microcopy (hoy PENDIENTE) no reescriba el
// sello de ningún documento ya firmado. `libre` fija ese formato dentro del hash.
const FUENTES_V2 = {
  completo: {
    ...FUENTES.completo,
    fechaEntrega: new Date('2026-07-15T00:00:00.000Z'),
    firmadoPorNombre: 'Marta Ruiz Alonso',
    firmadoPorCalidad: 'encargado_o_personal_de_obra',
  },
  // El caso ORDINARIO de un v:2 sin declarar nada: los tres campos son OPCIONALES y un albarán
  // sin ellos es válido. Sella `obra: null` porque `lugarEntrega` está vacío — el SUELO del
  // ticket: vacío se queda vacío, nunca se cae al domicilio fiscal.
  minimo: {
    ...FUENTES.minimo,
    fechaEntrega: null,
    firmadoPorNombre: null,
    firmadoPorCalidad: null,
  },
  libre: {
    numero: 'ALB-2026-0300',
    fecha: '2026-05-09T08:15:00.000Z',
    modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'Desatasco', cantidad: 2, unidad: 'h' }],
    notas: '',
    jobDireccion: null,
    lugarEntrega: 'Nave 4, Pol. Ind. El Cañal',
    referenciaTrabajo: 'Aviso 4471',
    cliente: 'Bar El Rincón',
    emisor: 'Fontanería Pereira S.L.',
    emisorNif: 'B12345678',
    fechaEntrega: '2026-05-09T00:00:00.000Z',
    firmadoPorNombre: 'Vecina del 3.º',
    firmadoPorCalidad: 'otro:Vecina del 3.º',
  },
};

/** El hash que el sellador de v:2 escribe. Literales congelados: misma razón que los de v:1. */
const SELLOS_V2_CONGELADOS = {
  completo: '866c413451feacf51873144670282f26f1af5c4a388d24cf3e640d39f1308628',
  minimo: '7211523af40d0e2c800abc1b60ec8db2beaaabf013a2097f854e9394ba6e87c9',
  libre: '253ba53e410752267d13eaafc09a8f6d47e2aeb9e50164efa3432bd8f4edb55c',
};

function firmadoV2(clave, cambios = {}) {
  return {
    evidencia: { v: 2, hashAlg: 'sha256', contentHash: SELLOS_V2_CONGELADOS[clave] },
    contenido: { ...FUENTES_V2[clave], ...cambios },
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-438 · v:3 — LOS CINCO CAMPOS VIAJAN DENTRO DEL SOBRE
//
// Los tres bloques congelados de abajo son los que sella v:3. Lo que cambia respecto de v:2 no es
// el orden de las claves —es el mismo— sino DE DÓNDE salen sus valores: del sobre, no de las filas
// vivas. Por eso las fuentes vivas de `FUENTES_V3` llevan valores DISTINTOS a los congelados: si
// la receta se equivocara y leyera una fuente viva, el hash no cuadraría con el vector.
const CONGELADOS_V3 = {
  completo: { obra: 'C/ Mayor 12', referenciaTrabajo: 'Reparación fuga', cliente: 'Ana Pérez', emisor: 'Fontanería Torres', emisorNif: 'B12345678' },
  minimo: { obra: null, referenciaTrabajo: null, cliente: null, emisor: null, emisorNif: null },
  libre: { obra: 'Nave 4', referenciaTrabajo: null, cliente: 'Cliente Libre SL', emisor: 'Fontanería Torres', emisorNif: null },
};

/**
 * Vectores congelados de v:3. LITERALES, calculados UNA vez con el SELLADOR
 * (`computeAlbaranContentHash(..., 3)`) el 11-ago-2026 — nunca con el verificador: un vector
 * calculado con el verificador compararía el verificador contra sí mismo y no podría fallar.
 */
const SELLOS_V3_CONGELADOS = {
  completo: '1a826b551aa7b3a8cd09ccb6498cbe322ce43d203bb15fc93f0d025d2031acd0',
  minimo: '3a09d98541b4a3db1b11d2dfcca15f9adb9f0c1e37daeee9196bd70766a637f5',
  libre: '0520aad8d980ccb976d5b821e7e94bd86dcc4662ac4c6221ffc3e49b02ec53e3',
};

const FUENTES_V3 = {
  completo: {
    numero: 'ALB-2026-0369', fecha: new Date('2026-06-01T09:30:00.000Z'), modoValoracion: 'VALORADO',
    lineas: [{ concepto: 'Bajante PVC 110', cantidad: 3, unidad: 'm', precioUnitario: 12.5, tipoIva: 21 }],
    notas: 'Acceso por el patio',
    fechaEntrega: new Date('2026-07-15T00:00:00.000Z'),
    firmadoPorNombre: 'Marta Ruiz Alonso', firmadoPorCalidad: 'encargado_o_personal_de_obra',
    // 🔴 Las fuentes VIVAS dicen otra cosa a propósito: es el control de que v:3 no las lee.
    jobDireccion: 'VIVO-NO-USAR', lugarEntrega: 'VIVO-NO-USAR', referenciaTrabajo: 'VIVO-NO-USAR',
    cliente: 'VIVO-NO-USAR', emisor: 'VIVO-NO-USAR', emisorNif: 'VIVO-NO-USAR',
    contenidoCongelado: CONGELADOS_V3.completo,
  },
  minimo: {
    numero: 'ALB-2026-0001', fecha: '2026-01-02T00:00:00.000Z', modoValoracion: 'SIN_VALORAR',
    lineas: [], notas: null, fechaEntrega: null, firmadoPorNombre: null, firmadoPorCalidad: null,
    jobDireccion: 'VIVO-NO-USAR', lugarEntrega: 'VIVO-NO-USAR', referenciaTrabajo: 'VIVO-NO-USAR',
    cliente: 'VIVO-NO-USAR', emisor: 'VIVO-NO-USAR', emisorNif: 'VIVO-NO-USAR',
    contenidoCongelado: CONGELADOS_V3.minimo,
  },
  libre: {
    numero: 'ALB-2026-0300', fecha: '2026-05-09T08:15:00.000Z', modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'Desatasco', cantidad: 2, unidad: 'h' }], notas: '',
    fechaEntrega: null, firmadoPorNombre: null, firmadoPorCalidad: null,
    jobDireccion: 'VIVO-NO-USAR', lugarEntrega: 'VIVO-NO-USAR', referenciaTrabajo: 'VIVO-NO-USAR',
    cliente: 'VIVO-NO-USAR', emisor: 'VIVO-NO-USAR', emisorNif: 'VIVO-NO-USAR',
    contenidoCongelado: CONGELADOS_V3.libre,
  },
};

function firmadoV3(clave, cambios = {}) {
  return {
    evidencia: { v: 3, hashAlg: 'sha256', contentHash: SELLOS_V3_CONGELADOS[clave] },
    contenido: { ...FUENTES_V3[clave], ...cambios },
  };
}

/**
 * TODOS los vectores congelados, por versión. Es lo que hace que el guard de despacho vigile el
 * INVARIANTE («toda versión del recetario tiene vector») en vez de una lista escrita a mano que
 * solo pide sumar un número cada vez que nace una versión.
 */
const VECTORES_CONGELADOS = {
  1: SELLOS_V1_CONGELADOS,
  2: SELLOS_V2_CONGELADOS,
  3: SELLOS_V3_CONGELADOS,
};

/** Lo que el sellador necesita para reproducir un v:2, desde una fuente de este fichero. */
function paramsSelladorV2(f) {
  return {
    numero: f.numero,
    fecha: f.fecha,
    modoValoracion: f.modoValoracion,
    lineas: f.lineas,
    notas: f.notas,
    obra: f.lugarEntrega, // ⚠️ v:2 sella `Albaran.lugarEntrega` (v:1 sellaba `Job.direccion`)
    referenciaTrabajo: f.referenciaTrabajo,
    cliente: f.cliente,
    emisor: f.emisor,
    emisorNif: f.emisorNif,
    fechaEntrega: f.fechaEntrega,
    firmadoPorNombre: f.firmadoPorNombre,
    firmadoPorCalidad: f.firmadoPorCalidad,
  };
}

// ── ① CONTROL POSITIVO ───────────────────────────────────────────────────────────────────

test('SCRUM-369 · ① un albarán firmado y SIN TOCAR verifica OK', () => {
  for (const clave of Object.keys(FUENTES)) {
    const r = verificarSobre(firmadoV1(clave));
    assert.equal(r.cuadra, true,
      `🔴 «${FUENTES[clave].numero}» está intacto y el verificador dice que NO cuadra ` +
      `(${r.motivo}: ${r.mensaje}).\n\n` +
      '  Éste es el fallo GRAVE de esta herramienta, mucho peor que no detectar una manipulación:\n' +
      '  un «no coincide» sobre un documento intacto se lee como una acusación de falsificación\n' +
      '  contra un papel que nadie tocó.');
    assert.equal(r.v, 1, '🔴 el resultado no declara la versión con la que se recalculó');
  }
});

test('SCRUM-369 · los vectores de v:1 siguen CONGELADOS (sellador y verificador, dos testigos)', () => {
  for (const [clave, f] of Object.entries(FUENTES)) {
    // Testigo 1: el sellador. Se le pasa la versión EXPLÍCITA (en este árbol solo sabe hacer v:1 y
    // el argumento sobra, pero cuando SCRUM-300 traiga el v:2 por defecto seguirá pidiendo v:1).
    const delSellador = computeAlbaranContentHash({
      numero: f.numero,
      fecha: f.fecha,
      modoValoracion: f.modoValoracion,
      lineas: f.lineas,
      notas: f.notas,
      obra: f.jobDireccion, // v:1 selló `Job.direccion`
      referenciaTrabajo: f.referenciaTrabajo,
      cliente: f.cliente,
      emisor: f.emisor,
      emisorNif: f.emisorNif,
    }, 1);

    // Testigo 2: la receta congelada del verificador, escrita entera y aparte a propósito.
    const delVerificador = RECETAS_POR_VERSION[1](f);

    assert.equal(delSellador, SELLOS_V1_CONGELADOS[clave],
      `🔴 EL SELLADOR YA NO CALCULA EL v:1 QUE CALCULABA («${clave}»).\n\n` +
      '  Alguien ha cambiado el contenido canónico de v:1: reordenado una clave, extraído un\n' +
      '  helper, normalizado un campo. `JSON.stringify` serializa por orden de inserción, así que\n' +
      '  cualquiera de las tres cambia el hash.\n\n' +
      '  Hoy no se rompe nada visible —los albaranes ya firmados no se vuelven a sellar—. Se rompe\n' +
      '  DESPUÉS: al verificar un albarán intacto saldrá «no coincide». **Una versión cerrada no se\n' +
      '  refactoriza.** Si el cambio es intencionado, no es v:1: es una versión NUEVA con su número.');

    assert.equal(delVerificador, SELLOS_V1_CONGELADOS[clave],
      `🔴 la receta v:1 DEL VERIFICADOR ya no reproduce el sello congelado («${clave}»). ` +
      'El verificador declararía manipulados albaranes intactos.');

    assert.equal(delVerificador, delSellador,
      `🔴 sellador y verificador discrepan sobre v:1 («${clave}»). Están escritos por separado ` +
      'justamente para que discrepar sea detectable: uno de los dos se ha movido.');
  }
});

// ── ② 🔴 CONTROL NEGATIVO: *EL* TEST ─────────────────────────────────────────────────────

test('SCRUM-369 · ② 🔴 UN CARÁCTER cambiado en UNA LÍNEA y el verificador FALLA NOMBRANDO el albarán', () => {
  // La manipulación más pequeña que se puede hacer sobre el contenido firmado: 12.5 → 12.6 no,
  // una LETRA. «fibrocemento» → «fibrocemenlo».
  const original = FUENTES.completo.lineas[0].concepto;
  const manipulado = original.replace('fibrocemento', 'fibrocemenlo');
  assert.equal(manipulado.length, original.length, 'el sabotaje debe cambiar UN carácter, no la longitud');
  assert.notEqual(manipulado, original, 'el sabotaje no ha cambiado nada: el test no probaría nada');

  const tocado = firmadoV1('completo', {
    lineas: [{ ...FUENTES.completo.lineas[0], concepto: manipulado }, FUENTES.completo.lineas[1]],
  });

  const r = verificarSobre(tocado);
  assert.equal(r.cuadra, false,
    '🔴 SE HA CAMBIADO EL CONTENIDO DE UN ALBARÁN FIRMADO Y EL VERIFICADOR DICE QUE CUADRA.\n\n' +
    '  Entonces no verifica nada: es la misma huella guardada que nadie compara, con una función\n' +
    '  delante que da tranquilidad. Éste es el test que decide si este ticket sirve para algo.');
  assert.equal(r.motivo, 'hash_no_coincide', `🔴 el motivo debería ser hash_no_coincide y es ${r.motivo}`);
  assert.match(r.mensaje, /ALB-2026-0369/,
    '🔴 el rojo NO NOMBRA el albarán. Un informe que dice «hay 1 manipulado» sin decir cuál obliga ' +
    'a revisarlos todos a mano: nombra el documento o no sirve de nada.');

  // Y en la población: cae SOLO el tocado, y los otros dos siguen cuadrando. Si arrastrase a los
  // demás, el rojo no señalaría al culpable — y acusaría a dos albaranes intactos.
  const informe = verificarPoblacion([firmadoV1('minimo'), tocado, firmadoV1('notaVacia')]);
  assert.equal(informe.examinados, 3);
  assert.equal(informe.cuadran, 2, '🔴 la manipulación de uno ha arrastrado a los demás');
  assert.deepEqual(informe.hallazgos.map((h) => h.numero), ['ALB-2026-0369']);
  assert.equal(informe.conclusion, 'hay_hallazgos');
});

test('SCRUM-369 · cada campo sellado está VIGILADO: tocar cualquiera lo detecta', () => {
  // El negativo de arriba prueba UNA línea. Si el hash solo cubriera el número y la fecha, ese
  // test... también pasaría. Esto recorre el resto de campos del contenido sellado.
  const cambios = {
    numero: { numero: 'ALB-2026-0370' },
    fecha: { fecha: new Date('2026-07-15T07:30:00.000Z') },
    modoValoracion: { modoValoracion: 'SIN_VALORAR' },
    notas: { notas: 'Cliente conforme. Se deja llave de paso señalizada..' },
    'obra (Job.direccion, la fuente de v:1)': { jobDireccion: 'C/ Alcalá 232, 3.º B — Madrid' },
    referenciaTrabajo: { referenciaTrabajo: 'Reforma baño — 3.ª fase' },
    cliente: { cliente: 'Comunidad de Propietarios Alcalá 232' },
    emisor: { emisor: 'Fontanería Pereira S.L' },
    emisorNif: { emisorNif: 'B12345679' },
    'línea · cantidad': { lineas: [{ ...FUENTES.completo.lineas[0], cantidad: 12.6 }, FUENTES.completo.lineas[1]] },
    'línea · unidad': { lineas: [{ ...FUENTES.completo.lineas[0], unidad: 'm2' }, FUENTES.completo.lineas[1]] },
    'línea · precioUnitario': { lineas: [{ ...FUENTES.completo.lineas[0], precioUnitario: 38.5 }, FUENTES.completo.lineas[1]] },
    'línea · tipoIva': { lineas: [{ ...FUENTES.completo.lineas[0], tipoIva: 10 }, FUENTES.completo.lineas[1]] },
    'línea · borrada': { lineas: [FUENTES.completo.lineas[0]] },
  };
  for (const [campo, cambio] of Object.entries(cambios)) {
    const r = verificarSobre(firmadoV1('completo', cambio));
    assert.equal(r.cuadra, false,
      `🔴 «${campo}» se puede cambiar DESPUÉS de firmar sin que el sello lo note. ` +
      'Lo que no entra en el hash no está protegido, aunque salga impreso en el papel.');
  }
});

test('SCRUM-369 · lo que el sello NO cubre, DECLARADO: `quoteLineIndex` no entra en el hash', () => {
  // SCRUM-367 entró en `main` mientras se construía esto y añadió `quoteLineIndex` a las líneas del
  // albarán (el enlace con la línea de presupuesto que la originó). NO está sellado. Este test lo
  // fija como DECISIÓN en vez de dejarlo como accidente:
  //
  //  · El contenido canónico enumera claves fijas, así que un campo nuevo en la línea no cambia el
  //    hash. Eso es lo que permite que SCRUM-367 sea aditivo y no rompa ninguna firma anterior.
  //  · La contrapartida, dicha: ese índice se puede cambiar DESPUÉS de firmar sin que el sello lo
  //    note. Es trazabilidad interna, no lo que el cliente firmó (concepto, cantidad, unidad,
  //    precio, IVA).
  //  · Y si algún día tiene que estar protegido, eso NO es tocar v:1 —que rompería los ya
  //    firmados—: es una versión NUEVA con su número. Este rojo es lo que obliga a plantearlo.
  const conOrigen = firmadoV1('completo', {
    lineas: [{ ...FUENTES.completo.lineas[0], quoteLineIndex: 3 }, FUENTES.completo.lineas[1]],
  });
  assert.equal(verificarSobre(conOrigen).cuadra, true,
    '🔴 un campo NUEVO en la línea ha cambiado el hash del contenido. Entonces cada campo que se ' +
    'añada a `AlbaranLinea` rompe la verificación de TODOS los albaranes firmados antes: el ' +
    'canónico tiene que seguir enumerando claves fijas.');
});

// ── ③ SUELO: cero mirados NO es cero manipulados ─────────────────────────────────────────

test('SCRUM-369 · ③ SUELO: con cero albaranes que mirar, el informe NO dice «todo cuadra»', () => {
  const vacio = verificarPoblacion([]);
  assert.equal(vacio.examinados, 0);
  assert.equal(vacio.conclusion, 'no_se_pudo_mirar',
    '🔴 UNA POBLACIÓN VACÍA SE ESTÁ LEYENDO COMO «TODO CUADRA».\n\n' +
    '  «Cero manipulados» y «no supe mirar» son el mismo número con significados opuestos. Un\n' +
    '  verificador que los confunde da tranquilidad medida sobre nada: es el mismo defecto que\n' +
    '  cierra este ticket —un rojo que no se ejecuta se lee igual que uno que pasa— cometido por\n' +
    '  el propio arreglo.');
  assert.equal(vacio.cuadran, 0);

  // Y que las dos respuestas son DISTINGUIBLES: con población intacta sí dice «todo cuadra».
  const lleno = verificarPoblacion(POBLACION_INTACTA());
  assert.equal(lleno.conclusion, 'todo_cuadra');
  assert.equal(lleno.examinados, 3);
  assert.notEqual(vacio.conclusion, lleno.conclusion,
    '🔴 el informe da la misma conclusión con población y sin ella: el suelo no distingue nada');
});

// ── ④ DESPACHO POR VERSIÓN ───────────────────────────────────────────────────────────────

const HASH_DE_OTRA_VERSION = 'f'.repeat(64);
/** Un recetario de DOS versiones para probar el despacho hoy, sin inventarse las reglas de v:2. */
const RECETARIO_DE_DOS = Object.freeze({
  1: RECETAS_POR_VERSION[1],
  2: () => HASH_DE_OTRA_VERSION,
});

test('SCRUM-369 · ④ cada sobre se recalcula con la receta de SU versión, no con la última', () => {
  const sobreV1 = firmadoV1('completo');
  const sobreV2 = { evidencia: { v: 2, hashAlg: 'sha256', contentHash: HASH_DE_OTRA_VERSION }, contenido: FUENTES.completo };

  // Con las dos recetas registradas, cada uno cuadra con la SUYA.
  assert.equal(verificarSobre(sobreV1, RECETARIO_DE_DOS).cuadra, true,
    '🔴 al aparecer una versión nueva, los sobres v:1 han dejado de verificar. Es EL peor resultado ' +
    'posible de esta herramienta: declararía manipulados TODOS los albaranes anteriores.');
  assert.equal(verificarSobre(sobreV2, RECETARIO_DE_DOS).cuadra, true,
    '🔴 el sobre v:2 no se ha recalculado con la receta de v:2');

  // 🔴 Y el fallo que este parámetro existe para evitar: si solo estuviera la receta NUEVA, un
  // sobre v:1 NO se recalcula con ella. Se declara. Aproximar es acusar.
  const soloV2 = Object.freeze({ 2: RECETARIO_DE_DOS[2] });
  const r = verificarSobre(sobreV1, soloV2);
  assert.equal(r.cuadra, false);
  assert.equal(r.motivo, 'version_no_soportada',
    `🔴 un sobre v:1 sin receta de v:1 se ha resuelto como «${r.motivo}» en vez de declararse. ` +
    'Si se hubiera recalculado con la regla de v:2, el informe diría «manipulado» sobre un albarán ' +
    'que nadie tocó — la acusación que no se puede hacer sola.');
  assert.match(r.mensaje, /ALB-2026-0369/, '🔴 tampoco aquí se nombra el albarán');
});

test('SCRUM-369 · TODA versión del recetario tiene vector congelado, y una sin receta se DECLARA', () => {
  // ⚠️ SCRUM-438 · REAPUNTADO AL INVARIANTE. Este test fijaba `[1, 2]` a mano, así que cada versión
  // nueva lo ponía rojo pidiendo que alguien **sumara un número**. Eso no vigila nada: vigila que
  // el número esté escrito dos veces. El invariante que de verdad protegía es el de su propio
  // mensaje —«una versión que se sabe despachar sin vector congelado no está verificada, está
  // declarada»— y ése ya no caduca con v:4.
  const sinVector = versionesSoportadas().filter((v) => !(v in VECTORES_CONGELADOS));
  assert.deepEqual(sinVector, [],
    `🔴 el recetario sabe despachar v:${sinVector.join(', v:')} y no hay vector congelado para ` +
    'esa(s) versión(es). Una versión que se sabe despachar sin vector congelado NO está verificada, ' +
    'está DECLARADA: el test compararía el sellador contra sí mismo y no podría fallar nunca.');
  // Suelo: si el mapa de vectores se quedara vacío, lo de arriba pasaría por no tener nada que casar.
  assert.ok(Object.keys(VECTORES_CONGELADOS).length >= 2,
    `🔴 solo hay ${Object.keys(VECTORES_CONGELADOS).length} vector(es) congelado(s): con menos de dos ` +
    'este guard no distingue «todas cubiertas» de «no hay ninguna».');

  // Y una que NO existe sigue declarándose en vez de aproximarse con la más parecida.
  const r = verificarSobre({ evidencia: { v: 9, contentHash: 'a'.repeat(64) }, contenido: FUENTES.minimo });
  assert.equal(r.motivo, 'version_no_soportada');
  assert.equal(r.v, 9, '🔴 el resultado debe declarar QUÉ versión no supo recalcular');
});

// ── SCRUM-300 (C5) · LA POBLACIÓN v:2 ────────────────────────────────────────────────────

test('SCRUM-300/369 · ① un albarán v:2 firmado y SIN TOCAR verifica OK', () => {
  for (const clave of Object.keys(FUENTES_V2)) {
    const r = verificarSobre(firmadoV2(clave));
    assert.equal(r.cuadra, true,
      `🔴 «${FUENTES_V2[clave].numero}» (v:2) está intacto y el verificador dice que NO cuadra ` +
      `(${r.motivo}: ${r.mensaje}).`);
    assert.equal(r.v, 2, '🔴 el resultado no declara la versión con la que se recalculó');
  }
});

test('SCRUM-300/369 · los vectores de v:2 siguen CONGELADOS (sellador y verificador, dos testigos)', () => {
  for (const [clave, f] of Object.entries(FUENTES_V2)) {
    const delSellador = computeAlbaranContentHash(paramsSelladorV2(f), 2);
    const delVerificador = RECETAS_POR_VERSION[2](f);

    assert.equal(delSellador, SELLOS_V2_CONGELADOS[clave],
      `🔴 EL SELLADOR YA NO CALCULA EL v:2 QUE CALCULABA («${clave}»).\n\n` +
      '  Alguien ha cambiado el contenido canónico de v:2: reordenado una clave, extraído un\n' +
      '  helper, normalizado un campo. Si el cambio es intencionado, no es v:2: es una versión\n' +
      '  NUEVA con su número. **Una versión cerrada no se refactoriza.**');

    assert.equal(delVerificador, SELLOS_V2_CONGELADOS[clave],
      `🔴 la receta v:2 DEL VERIFICADOR ya no reproduce el sello congelado («${clave}»). ` +
      'El verificador declararía manipulados albaranes intactos.');

    assert.equal(delVerificador, delSellador,
      `🔴 sellador y verificador discrepan sobre v:2 («${clave}»). Están escritos por separado ` +
      'justamente para que discrepar sea detectable: uno de los dos se ha movido.');
  }
});

test('SCRUM-300/369 · ② 🔴 UN CARÁCTER cambiado en un v:2 y el verificador FALLA NOMBRANDO el albarán', () => {
  const original = FUENTES_V2.completo.lineas[0].concepto;
  const manipulado = original.replace('fibrocemento', 'fibrocemenlo');
  assert.equal(manipulado.length, original.length, 'el sabotaje debe cambiar UN carácter, no la longitud');
  assert.notEqual(manipulado, original, 'el sabotaje no ha cambiado nada: el test no probaría nada');

  const r = verificarSobre(firmadoV2('completo', {
    lineas: [{ ...FUENTES_V2.completo.lineas[0], concepto: manipulado }, FUENTES_V2.completo.lineas[1]],
  }));
  assert.equal(r.cuadra, false,
    '🔴 SE HA CAMBIADO EL CONTENIDO DE UN ALBARÁN v:2 FIRMADO Y EL VERIFICADOR DICE QUE CUADRA.');
  assert.equal(r.motivo, 'hash_no_coincide');
  assert.match(r.mensaje, /ALB-2026-0369/, '🔴 el rojo NO NOMBRA el albarán');
});

test('SCRUM-300/369 · 🔴 los CUATRO campos que estrena C5 están DENTRO del sello', () => {
  // Ésta es la comprobación que decide si C5 sirve de algo: si `lugarEntrega`, `fechaEntrega` o
  // quién firmó se pudieran cambiar DESPUÉS de firmar sin que el sello lo notara, saldrían
  // impresos en el papel sin estar protegidos por la firma — que es justo lo que el ticket
  // exige comprobar («mide dónde entran y compruébalo»).
  const cambios = {
    'lugarEntrega (la obra, fuente de v:2)': { lugarEntrega: 'C/ Otra 9 — cambiada tras firmar' },
    fechaEntrega: { fechaEntrega: new Date('2026-07-16T00:00:00.000Z') },
    'fechaEntrega · vaciada': { fechaEntrega: null },
    firmadoPorNombre: { firmadoPorNombre: 'Otra Persona Distinta' },
    'firmadoPorCalidad (el id de la ranura)': { firmadoPorCalidad: 'el_propio_cliente' },
  };
  for (const [campo, cambio] of Object.entries(cambios)) {
    const r = verificarSobre(firmadoV2('completo', cambio));
    assert.equal(r.cuadra, false,
      `🔴 «${campo}» se puede cambiar DESPUÉS de firmar sin que el sello lo note. ` +
      'Lo que no entra en el hash no está protegido, aunque salga impreso en el papel.');
  }

  // Y el texto libre de la ranura «otro» también: es lo que el documento DICE de quien firmó.
  const rLibre = verificarSobre(firmadoV2('libre', { firmadoPorCalidad: 'otro:Otra vecina' }));
  assert.equal(rLibre.cuadra, false,
    '🔴 el texto libre de la ranura «otro» se puede cambiar tras firmar sin romper el sello');
});

test('SCRUM-300/369 · 🔴 v:1 y v:2 NO son intercambiables: el mismo contenido da hashes distintos', () => {
  // El motivo de que la versión suba. `obra` cambió de fuente: v:1 la tomaba de `Job.direccion`,
  // v:2 de `Albaran.lugarEntrega`. Con el MISMO contenido delante, las dos recetas tienen que
  // discrepar — si coincidieran, el número de versión no estaría distinguiendo nada y aplicar la
  // regla equivocada pasaría desapercibido.
  const f = FUENTES_V2.completo;
  assert.notEqual(RECETAS_POR_VERSION[1](f), RECETAS_POR_VERSION[2](f),
    '🔴 LAS RECETAS DE v:1 Y v:2 DAN EL MISMO HASH sobre el mismo contenido. Entonces el despacho ' +
    'por versión no protege de nada: dos reglas distintas bajo números distintos deben ser ' +
    'distinguibles, o un sobre mal versionado se leería como bueno.');

  // Y el despacho REAL lo demuestra: un sobre v:2 recalculado con la regla de v:1 no cuadra.
  const conRecetaEquivocada = verificarSobre(firmadoV2('completo'), Object.freeze({ 1: RECETAS_POR_VERSION[1] }));
  assert.equal(conRecetaEquivocada.motivo, 'version_no_soportada',
    '🔴 un sobre v:2 sin receta de v:2 se ha aproximado con la de v:1 en vez de declararse. ' +
    'Aproximar es acusar: diría «manipulado» sobre un albarán que nadie tocó.');
});

test('SCRUM-300/369 · el censo distingue las DOS poblaciones que ahora conviven', () => {
  // Retrocompatibilidad MEDIDA, no supuesta: tras C5 hay albaranes v:1 (los de antes, que no se
  // recalculan ni se migran nunca) y v:2. El informe tiene que contarlos por separado.
  const informe = verificarPoblacion([...POBLACION_INTACTA(), ...Object.keys(FUENTES_V2).map((k) => firmadoV2(k))]);
  assert.deepEqual(informe.censoPorVersion, { 1: 3, 2: 3 });
  assert.equal(informe.examinados, 6);
  assert.equal(informe.cuadran, 6,
    '🔴 al entrar v:2, algún albarán ha dejado de verificar. Si son los v:1, es EL peor resultado ' +
    'posible: declararía manipulados todos los albaranes firmados antes de C5.');
  assert.equal(informe.conclusion, 'todo_cuadra');
  assert.deepEqual(informe.versionesNoSoportadas, []);
});

// ── ⑤ CENSO POR VERSIÓN, y los sobres rotos ──────────────────────────────────────────────

test('SCRUM-369 · ⑤ el censo de versiones se MIDE sobre la población', () => {
  const informe = verificarPoblacion([
    ...POBLACION_INTACTA(),
    { evidencia: { v: 7, contentHash: 'b'.repeat(64) }, contenido: FUENTES.minimo },
    { evidencia: { contentHash: 'c'.repeat(64) }, contenido: FUENTES.minimo },   // sobre sin versión
    { evidencia: null, contenido: FUENTES.minimo },                              // firmado sin sobre
  ]);

  assert.deepEqual(informe.censoPorVersion, { 1: 3, 7: 1, sin_version: 2 },
    '🔴 el censo por versión no refleja la población. Sin censo, la retrocompatibilidad es una ' +
    'suposición: nadie sabe cuántos albaranes hay de cada regla.');
  assert.deepEqual(informe.versionesNoSoportadas, [7],
    '🔴 una versión que el verificador no sabe despachar tiene que salir NOMBRADA en el informe, ' +
    'no diluida entre los fallos de hash: no es una manipulación, es un hueco del verificador.');
  assert.deepEqual(
    informe.hallazgos.map((h) => h.motivo).sort(),
    ['sin_evidencia', 'version_ausente', 'version_no_soportada'],
    '🔴 los tres sobres rotos deberían salir con motivos distintos y distinguibles');
  assert.equal(informe.cuadran, 3);
});

test('SCRUM-369 · el verificador NUNCA lanza: el albarán raro es el que hay que poder nombrar', () => {
  // Un barrido que revienta a mitad deja de ser un censo y pasa a ser un accidente — y se para
  // justo en el documento que más interesa mirar.
  const basura = [
    { evidencia: 'no soy un objeto', contenido: FUENTES.minimo },
    { evidencia: { v: '1', contentHash: 'x' }, contenido: FUENTES.minimo },      // versión no numérica
    { evidencia: { v: 1, contentHash: 42 }, contenido: FUENTES.minimo },         // hash no string
    { evidencia: { v: 1, contentHash: 'd'.repeat(64) }, contenido: { ...FUENTES.minimo, lineas: 'no es un array' } },
  ];
  const informe = verificarPoblacion(basura);
  assert.equal(informe.examinados, 4);
  assert.equal(informe.hallazgos.length, 4);
  assert.equal(informe.conclusion, 'hay_hallazgos');
});

// ── ⑥ ⚠️ LO MÁS IMPORTANTE: NUNCA SE REESCRIBE UN SOBRE ──────────────────────────────────

function congelarHondo(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) congelarHondo(v);
  }
  return o;
}

test('SCRUM-369 · ⑥ ⚠️ verificar NO TOCA nada: ni el sobre, ni el contenido, ni cuando no cuadra', () => {
  const entradas = congelarHondo([
    firmadoV1('completo'),
    firmadoV1('minimo', { notas: 'manipulado después de firmar' }), // éste NO cuadra
    { evidencia: congelarHondo({ v: 9, contentHash: 'e'.repeat(64) }), contenido: FUENTES.notaVacia },
  ]);

  // Prueba de que el candado está echado: si estos objetos no estuvieran congelados, este test
  // pasaría en verde con un verificador que reescribe. El sabotaje lo demuestra en rojo.
  assert.throws(() => { entradas[0].evidencia.contentHash = 'reparado'; }, TypeError,
    '🔴 los objetos no están congelados: este test no puede detectar una reescritura');

  const informe = verificarPoblacion(entradas);
  assert.equal(informe.hallazgos.length, 2, '🔴 la población de prueba no contiene los casos que debía');

  // El que NO cuadra sigue con su sello ORIGINAL. Un verificador que «arregla» lo que encuentra
  // destruye la única prueba de que hubo un incidente: mismo espíritu que la regla 29 con las
  // facturas emitidas — lo firmado no se toca, ni siquiera para arreglarlo.
  assert.equal(entradas[1].evidencia.contentHash, SELLOS_V1_CONGELADOS.minimo,
    '🔴 EL SOBRE DE UN ALBARÁN QUE NO CUADRA HA CAMBIADO. No se recalcula, no se migra, no se ' +
    '«deja bien»: se declara.');
  assert.equal(entradas[1].contenido.notas, 'manipulado después de firmar',
    '🔴 el verificador ha revertido el contenido para hacerlo cuadrar');
  assert.equal(entradas[2].evidencia.v, 9,
    '🔴 la versión de un sobre desconocido se ha reescrito a la actual');
});

test('SCRUM-369 · ⑥ el verificador no PUEDE escribir: no importa nada que escriba', () => {
  // No es una promesa en un comentario: es que el módulo no tiene con qué. Se mide sobre el AST,
  // no sobre el texto — un guard de texto se caza a sí mismo en el comentario que lo explica.
  const imports = importsDe(fs.readFileSync(FUENTE_VERIFICADOR, 'utf8'));
  assert.ok(imports.length > 0,
    '🔴 el analizador no ha encontrado NINGÚN import en el verificador. Con un analizador ciego, ' +
    '«no importa prisma» y «no supe mirar» son la misma respuesta.');
  const escritores = imports.filter((i) => !i.soloTipo && !['crypto'].includes(i.modulo));
  assert.deepEqual(escritores.map((i) => i.modulo), [],
    '🔴 EL VERIFICADOR HA EMPEZADO A IMPORTAR CÓDIGO EJECUTABLE:\n    ' +
    escritores.map((i) => i.modulo).join('\n    ') +
    '\n\n  Hasta ahora no podía reescribir un sobre porque no tenía con qué (solo `crypto` y un\n' +
    '  import de tipos, que se borra al compilar). Si necesita leer de la base, el que lee es\n' +
    '  quien lo llama y le pasa las filas: así el verificador sigue sin poder escribir.');
});

// ── EL GUARD QUE SOBREVIVE A SCRUM-300 ───────────────────────────────────────────────────

/** Los `import` de un fuente TS, marcando los de solo-tipo (que desaparecen al compilar). */
function importsDe(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    out.push({ modulo: s.moduleSpecifier.text, soloTipo: !!s.importClause?.isTypeOnly });
  }
  return out;
}

/**
 * Las versiones de sobre que el SELLADOR puede emitir hoy, leídas del AST: todo literal de objeto
 * con `v: <número>` que además tenga `numero` y `lineas` — la firma del contenido canónico, y lo
 * que la distingue del objeto de evidencias (que tiene `canal` y `firmadoAt`, no líneas).
 *
 * AST y no `grep`: `v: 1` aparece en comentarios de este mismo repo explicando la regla, y un
 * guard de texto se caza a sí mismo en la prosa que lo justifica.
 */
function versionesQueElSelladorPuedeEmitir(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const versiones = new Set();
  const visita = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const props = new Map();
      for (const p of n.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const k = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
        if (k) props.set(k, p.initializer);
      }
      const v = props.get('v');
      if (v && ts.isNumericLiteral(v) && props.has('numero') && props.has('lineas')) versiones.add(Number(v.text));
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return [...versiones].sort((a, b) => a - b);
}

test('SCRUM-369 · SUELO del analizador: encuentra la versión que hay, y ve una nueva si aparece', () => {
  // Sin esto, el guard de abajo pasaría en verde sobre un fichero renombrado o una forma que el
  // analizador no reconoce: «ninguna versión sin receta» y «no supe mirar» son el mismo verde.
  const canonicoV1 = `const canonical = { v: 1, numero: p.numero, fecha: f, lineas: ls };`;
  assert.deepEqual(versionesQueElSelladorPuedeEmitir(canonicoV1), [1],
    '🔴 el analizador no reconoce el objeto canónico que HAY en el árbol');

  // Y EN ROJO: se le pone delante una versión que ningún recetario conoce y tiene que verla.
  const conV3 = canonicoV1 + `\nfunction otra() { return { v: 3, numero: p.numero, fecha: f, lineas: ls }; }`;
  assert.deepEqual(versionesQueElSelladorPuedeEmitir(conV3), [1, 3],
    '🔴 EL ANALIZADOR NO VE UNA VERSIÓN NUEVA. Entonces el guard de abajo no vigila nada: el día ' +
    'que SCRUM-300 traiga el v:2 seguiría en verde y los albaranes v:2 se quedarían sin verificador.');

  // Y no confunde el sobre de evidencias (que también lleva `v`) con el contenido canónico.
  assert.deepEqual(versionesQueElSelladorPuedeEmitir(`return { v: 1, canal: c, firmadoAt: t, contentHash: h };`), [],
    '🔴 el analizador confunde el objeto de EVIDENCIAS con el CONTENIDO canónico');

  assert.deepEqual(importsDe(`import x from 'prisma';\nimport type { T } from './t';`),
    [{ modulo: 'prisma', soloTipo: false }, { modulo: './t', soloTipo: true }],
    '🔴 el lector de imports no distingue un import ejecutable de uno de solo-tipo');
});

test('SCRUM-369 · 🔴 TODA versión que el sellador pueda emitir TIENE receta en el verificador', () => {
  // Este es el guard que sobrevive al ticket. El día que SCRUM-300 entre en `main`, el sellador
  // podrá emitir v:2 y esto se pondrá ROJO hasta que v:2 tenga su receta congelada aquí. No hay que
  // acordarse de nada: la suite lo exige, y lo exige en el commit que trae la versión nueva.
  const puedeEmitir = versionesQueElSelladorPuedeEmitir(fs.readFileSync(FUENTE_SELLADOR, 'utf8'));
  assert.ok(puedeEmitir.length > 0,
    '🔴 no se ha encontrado NINGÚN contenido canónico en albaran.service.ts. O se movió de fichero, ' +
    'o cambió de forma: en cualquiera de los dos casos este guard ha dejado de mirar donde debía.');

  const sinReceta = puedeEmitir.filter((v) => !versionesSoportadas().includes(v));
  assert.deepEqual(sinReceta, [],
    '🔴 EL SELLADOR PUEDE EMITIR SOBRES QUE EL VERIFICADOR NO SABE COMPROBAR: v:' + sinReceta.join(', v:') +
    '\n\n  Cada albarán que se firme con esa versión nace sin verificador — que es exactamente el\n' +
    '  defecto que cierra SCRUM-369, reabierto por la puerta de atrás.\n\n' +
    '  Qué hacer: añadir su receta a `RECETAS_POR_VERSION` (ENTERA y aparte, sin helpers compartidos\n' +
    '  con las demás) y congelar su vector en este fichero. Lo que NO se hace jamás es que la\n' +
    '  versión nueva reutilice la receta de otra: dos hashes con reglas distintas bajo el mismo\n' +
    '  número son indistinguibles.');
});

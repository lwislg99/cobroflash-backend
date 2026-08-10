// tests/scrum438-v3-sobre.test.mjs — SCRUM-438 · v:3, el sobre que se lleva su contenido dentro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ DEFECTO CIERRA, EN UNA FRASE
//
// Hasta v:2 el sobre recalculaba CINCO campos leyéndolos EN VIVO de otras tablas al verificar
// (`obra`, `referenciaTrabajo`, `cliente`, `emisor`, `emisorNif`). Corregir la razón social de un
// cliente —cosa que el producto permite y debe permitir— convertía en «no coincide» todos sus
// albaranes firmados, intactos. O sea: una acusación de falsificación contra papeles que nadie
// tocó, disparada por un cambio legítimo (SCRUM-431).
//
// v:3 los congela DENTRO del sobre. Este fichero prueba las dos mitades de eso:
//
//   ① 🔴 *EL* TEST — sellar en v:3, cambiar los CINCO campos vivos, y seguir cuadrando.
//   ② El mismo escenario en v:1 y v:2 sigue saliendo como salía. Ni mejora ni empeora: sus recetas
//      están congeladas y no se tocan (regla 29).
//   ③ 🔴 CONDICIÓN DURA — v:1 y v:2 imprimen EXACTAMENTE lo que imprimían, carácter a carácter.
//      Con control negativo: el comparador tiene que saber ver un cambio si lo hubiera.
//   ④ Rojos POR EL MECANISMO — el bloque todo-o-nada NOMBRA la clave que falta; el resolvedor
//      LANZA ante una versión que no conoce en vez de adivinar.
//   ⑤ La `v` está DENTRO del contenido hasheado. Medido, no deducido del orden de claves.
//
// ⚠️ EL SELLADO Y LA VERIFICACIÓN SIGUEN SIENDO DOS TESTIGOS. Aquí se sella con
// `computeAlbaranContentHash` (el sellador) y se comprueba con `verificarSobre` (el verificador),
// que no comparten una línea de código. Sellar y comprobar con el mismo lado sería un espejo.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  computeAlbaranContentHash,
  obraSegunVersion,
  ALBARAN_CONTENIDO_VERSION_ACTUAL,
} from '../dist/modules/jobs/domain/albaran.service.js';
import {
  RECETAS_POR_VERSION,
  verificarSobre,
  versionesSoportadas,
} from '../dist/modules/jobs/domain/albaranVerificacion.js';
import {
  contenidoSegunVersion,
  validarContenidoCongelado,
  CLAVES_CONGELADAS,
  FUENTES_POR_VERSION,
} from '../dist/modules/jobs/domain/albaranContenidoFuentes.js';

// ── EL ALBARÁN DE PRUEBA ─────────────────────────────────────────────────────────────────
//
// Lo que NO depende de la versión: el documento en sí. La fila del albarán queda bloqueada al
// firmarse (409 `albaran_locked`), así que estos campos no pueden moverse bajo el sello — y por eso
// no son el problema.
const DOCUMENTO = Object.freeze({
  numero: 'ALB-2026-0438',
  fecha: new Date('2026-08-01T09:00:00.000Z'),
  modoValoracion: 'VALORADO',
  lineas: [{ concepto: 'Sustitución de bajante', cantidad: 4, unidad: 'm', precioUnitario: 18.4, tipoIva: 21 }],
  notas: 'Acceso por el patio interior',
  fechaEntrega: new Date('2026-07-30T00:00:00.000Z'),
  firmadoPorNombre: 'Marta Ruiz Alonso',
  firmadoPorCalidad: 'encargado_o_personal_de_obra',
});

/** Los CINCO, tal y como estaban EL DÍA DE LA FIRMA. Es lo que v:3 congela. */
const EL_DIA_DE_LA_FIRMA = Object.freeze({
  jobDireccion: 'C/ Vieja 9',
  lugarEntrega: 'Nave 4, Pol. Sur',
  referenciaTrabajo: 'Reparación de bajante',
  cliente: 'Comunidad Alcalá 231',
  emisor: 'Fontanería Pereira',
  emisorNif: 'B12345678',
});

/** Lo que dicen esas mismas filas HOY, DESPUÉS de correcciones perfectamente legítimas. */
const HOY_DESPUES_DE_CORREGIR = Object.freeze({
  jobDireccion: 'Calle Vieja, 9',                     // alguien escribió por fin la dirección
  lugarEntrega: 'Nave 4, Polígono Sur',               // se completó la abreviatura
  referenciaTrabajo: 'Reparación de bajante (2ª fase)', // se renombró el Trabajo
  cliente: 'C.P. Alcalá 231',                          // se corrigió a la razón social
  emisor: 'Fontanería Pereira S.L.',                   // el emisor añadió su forma jurídica
  emisorNif: 'B-12345678',                             // se arregló una errata en el NIF
});

/** El bloque que sella v:3: los cinco campos, resueltos como los resuelve el sellador. */
const BLOQUE_SELLADO = Object.freeze({
  obra: EL_DIA_DE_LA_FIRMA.lugarEntrega,
  referenciaTrabajo: EL_DIA_DE_LA_FIRMA.referenciaTrabajo,
  cliente: EL_DIA_DE_LA_FIRMA.cliente,
  emisor: EL_DIA_DE_LA_FIRMA.emisor,
  emisorNif: EL_DIA_DE_LA_FIRMA.emisorNif,
});

/**
 * Sella con EL SELLADOR, que es la única forma honesta de fabricar un albarán firmado. `obra` se
 * le pasa según la fuente de cada versión, igual que hace `buildFirmaEvidencia`.
 */
function sellar(version, vivas, bloque = BLOQUE_SELLADO) {
  return computeAlbaranContentHash(
    {
      ...DOCUMENTO,
      obra: version === 1 ? (vivas.jobDireccion || null) : (vivas.lugarEntrega || null),
      referenciaTrabajo: vivas.referenciaTrabajo,
      cliente: vivas.cliente,
      emisor: vivas.emisor,
      emisorNif: vivas.emisorNif,
      contenidoCongelado: bloque,
    },
    version,
  );
}

/** Lo que el VERIFICADOR recibe: el sobre guardado + las fuentes tal y como están HOY. */
function comprobar(version, contentHash, vivasDeHoy, bloque = BLOQUE_SELLADO) {
  return verificarSobre({
    evidencia: { v: version, hashAlg: 'sha256', contentHash },
    contenido: { ...DOCUMENTO, ...vivasDeHoy, contenidoCongelado: version === 3 ? bloque : undefined },
  });
}

// ── ① 🔴 *EL* TEST ───────────────────────────────────────────────────────────────────────

test('SCRUM-438 · ① 🔴 v:3 sigue cuadrando con los CINCO campos vivos CAMBIADOS después de sellar', () => {
  const sello = sellar(3, EL_DIA_DE_LA_FIRMA);

  // Control positivo primero: sin tocar nada, cuadra. Si esto fallara, lo de abajo no mediría lo
  // que dice medir — mediría que dos cosas rotas coinciden.
  const intacto = comprobar(3, sello, EL_DIA_DE_LA_FIRMA);
  assert.equal(intacto.cuadra, true, `🔴 un v:3 intacto no verifica: ${intacto.mensaje}`);

  // Y AHORA LO QUE EXISTE PARA HACER: las cinco filas vivas dicen otra cosa, y el sobre sigue
  // cuadrando porque su contenido viaja dentro de él.
  const r = comprobar(3, sello, HOY_DESPUES_DE_CORREGIR);
  assert.equal(r.cuadra, true,
    `🔴 v:3 NO cuadra tras cambiar los cinco campos vivos (${r.motivo}: ${r.mensaje}).\n\n` +
    '  Es el defecto entero que este ticket cierra. Si esto sale rojo, corregir la razón social de\n' +
    '  un cliente vuelve a declarar «manipulados» todos sus albaranes firmados e intactos.');

  // SUELO: que el escenario ejerza de verdad los cinco. Si alguno coincidiera con el del día de la
  // firma, este test pasaría por no haber cambiado nada.
  const iguales = Object.keys(EL_DIA_DE_LA_FIRMA)
    .filter((k) => EL_DIA_DE_LA_FIRMA[k] === HOY_DESPUES_DE_CORREGIR[k]);
  assert.deepEqual(iguales, [],
    `🔴 SUELO: ${iguales.join(', ')} vale lo mismo antes y después. El escenario no cambia lo que ` +
    'dice cambiar y el verde de arriba no significa nada.');

  // 🔴 Y EL CONTROL NEGATIVO, que es lo que impide que esto sea un «todo cuadra siempre»: tocar el
  // DOCUMENTO —lo que la firma sí protege— tiene que seguir saliendo como manipulación.
  const manipulado = verificarSobre({
    evidencia: { v: 3, hashAlg: 'sha256', contentHash: sello },
    contenido: { ...DOCUMENTO, notas: 'Acceso por el patio exterior', ...HOY_DESPUES_DE_CORREGIR, contenidoCongelado: BLOQUE_SELLADO },
  });
  assert.equal(manipulado.motivo, 'hash_no_coincide',
    `🔴 se ha cambiado una NOTA del albarán firmado y el veredicto es «${manipulado.motivo}». v:3 ` +
    'congela cinco campos de OTRAS tablas, no el documento: si el documento deja de estar ' +
    'protegido, el sello no sirve para nada.');
});

test('SCRUM-438 · ① el bloque manda sobre la fila viva, no al revés', () => {
  // La otra cara: si el BLOQUE dijera otra cosa que lo sellado, tiene que caer. Sin esto, «cuadra
  // pase lo que pase» sería indistinguible de «lee del sobre».
  const sello = sellar(3, EL_DIA_DE_LA_FIRMA);
  const conElBloqueTocado = comprobar(3, sello, EL_DIA_DE_LA_FIRMA, { ...BLOQUE_SELLADO, cliente: 'OTRO' });
  assert.equal(conElBloqueTocado.cuadra, false,
    '🔴 se ha cambiado el bloque congelado del sobre y sigue cuadrando: entonces la receta de v:3 ' +
    'no lo está leyendo y el hash no protege lo que dice proteger.');
});

// ── ② v:1 Y v:2 NO MEJORAN NI EMPEORAN ───────────────────────────────────────────────────

test('SCRUM-438 · ② el MISMO escenario en v:1 y v:2 sigue sin cuadrar — su comportamiento no cambia', () => {
  for (const v of [1, 2]) {
    const sello = sellar(v, EL_DIA_DE_LA_FIRMA);
    const intacto = comprobar(v, sello, EL_DIA_DE_LA_FIRMA);
    assert.equal(intacto.cuadra, true, `🔴 un v:${v} intacto ha dejado de verificar: ${intacto.mensaje}`);

    const r = comprobar(v, sello, HOY_DESPUES_DE_CORREGIR);
    assert.equal(r.cuadra, false,
      `🔴 un sobre v:${v} cuadra tras cambiar sus fuentes vivas. Sus recetas están CONGELADAS y ` +
      'leen en vivo: si ahora cuadrara, alguien las ha tocado, y tocar la receta de una versión ya ' +
      'emitida es exactamente lo que este sistema no puede permitirse (regla 29).');
  }
});

test('SCRUM-438 · ② v:1 y v:2 siguen dando `dato_vivo_cambiado` cuando corresponde, y v:3 no puede', () => {
  // El caso real de SCRUM-431: el campo estaba VACÍO al firmar y hoy tiene valor. Ahí el
  // verificador puede DEMOSTRAR que el albarán está intacto, y por eso no acusa.
  const alFirmarVacio = { ...EL_DIA_DE_LA_FIRMA, referenciaTrabajo: null };
  for (const v of [1, 2]) {
    const sello = sellar(v, alFirmarVacio);
    const r = comprobar(v, sello, { ...alFirmarVacio, referenciaTrabajo: 'alguien nombró el Trabajo' });
    assert.equal(r.motivo, 'dato_vivo_cambiado',
      `🔴 v:${v} sale como «${r.motivo}» donde antes salía «dato_vivo_cambiado». Ese motivo es lo ` +
      'único que hoy protege a la población vieja de una acusación falsa; v:3 no puede habérselo ' +
      'llevado por delante.');
    assert.match(r.mensaje, /referenciaTrabajo/,
      '🔴 el motivo no NOMBRA el campo que cambió: sin eso nadie sabe dónde mirar.');
  }

  // 🔴 Y EN v:3 ESE BUCLE NO PUEDE CUMPLIRSE, porque la receta no lee ninguno de los cinco en vivo:
  // anularlos no mueve su hash. El razonamiento ya estaba escrito sobre el código; esto lo mide,
  // porque un razonamiento correcto hoy no impide que alguien cambie la receta mañana.
  const selloV3 = sellar(3, alFirmarVacio, { ...BLOQUE_SELLADO, referenciaTrabajo: null });
  const r3 = comprobar(3, selloV3, { ...alFirmarVacio, referenciaTrabajo: 'alguien nombró el Trabajo' },
    { ...BLOQUE_SELLADO, referenciaTrabajo: null });
  assert.equal(r3.cuadra, true,
    `🔴 un v:3 sale como «${r3.motivo}» al cambiar una fila viva. Si v:3 llega siquiera a NECESITAR ` +
    '`dato_vivo_cambiado`, es que volvió a leer fuera del sobre.');
});

// ── ③ 🔴 CONDICIÓN DURA · v:1 Y v:2 IMPRIMEN LO MISMO, CARÁCTER A CARÁCTER ────────────────

/**
 * El comportamiento de AYER, TRANSCRITO LITERAL de `obraSegunVersion` en `scrum-438-atestiguar`:
 *
 *     if (version === 1) return fuentes.jobDireccion || null;
 *     return fuentes.lugarEntrega || null;
 *
 * Está escrito a mano y NO se importa de ningún sitio, por lo mismo que los vectores congelados de
 * SCRUM-369 son literales: un test que compara el código de hoy contra el código de hoy no puede
 * fallar. Con la transcripción, cualquier cambio en el despacho de v:1 o v:2 sale ROJO en el commit
 * que lo hace — que es cuando tiene que salir, porque el daño no se ve en el momento.
 */
const AYER = (version, f) => (version === 1 ? (f.jobDireccion || null) : (f.lugarEntrega || null));

/** Las 36 combinaciones: cuatro versiones × tres valores de cada fuente. Nada de muestreo. */
function rejilla() {
  const casos = [];
  for (const v of [1, 2, undefined, null]) {
    for (const jobDireccion of ['C/ Sol 3', '', null]) {
      for (const lugarEntrega of ['Nave 4', '', null]) casos.push({ v, jobDireccion, lugarEntrega });
    }
  }
  return casos;
}

const BLOQUE_SONDA = Object.freeze({
  obra: 'DEL SOBRE', referenciaTrabajo: 'DEL SOBRE', cliente: 'DEL SOBRE',
  emisor: 'DEL SOBRE', emisorNif: 'DEL SOBRE',
});

test('SCRUM-438 · ③ 🔴 lo que el PDF imprime en v:1, v:2 y sin firmar NO cambia ni un carácter', () => {
  const casos = rejilla();
  assert.equal(casos.length, 36, '🔴 SUELO: la rejilla se ha quedado corta y no cubre lo que dice cubrir');

  const divergen = [];
  for (const { v, jobDireccion, lugarEntrega } of casos) {
    const hoy = obraSegunVersion(v, { jobDireccion, lugarEntrega, contenidoCongelado: BLOQUE_SONDA });
    const ayer = AYER(v, { jobDireccion, lugarEntrega });
    if (!Object.is(hoy, ayer)) {
      divergen.push(`v:${String(v)} jobDireccion=${JSON.stringify(jobDireccion)} ` +
        `lugarEntrega=${JSON.stringify(lugarEntrega)} → ayer ${JSON.stringify(ayer)} · hoy ${JSON.stringify(hoy)}`);
    }
  }

  assert.deepEqual(divergen, [],
    '🔴 EL PDF DE UN ALBARÁN VIEJO IMPRIMIRÍA OTRA COSA:\n    ' + divergen.join('\n    ') +
    '\n\n  Es la condición dura de este ticket. Un albarán firmado hace meses no puede cambiar ni un\n' +
    '  carácter de su papel porque hoy exista una v:3: el documento diría una cosa y su hash\n' +
    '  certificaría otra, que es la forma silenciosa de romper una firma.\n\n' +
    '  El sospechoso habitual es un `??` donde iba un `||`: con `??` una cadena vacía SOBREVIVE\n' +
    '  donde antes moría, y el PDF pasa de no imprimir la línea a imprimirla vacía.');
});

test('SCRUM-438 · ③ SUELO del comparador: sabría ver el cambio si lo hubiera', () => {
  // Sin esto, el test de arriba podría estar comparando dos funciones idénticas por accidente —o
  // dos listas vacías— y su verde no significaría nada.
  const AYER_ROTO = (version, f) => (version === 1 ? (f.jobDireccion ?? null) : (f.lugarEntrega ?? null));
  const divergen = rejilla().filter(({ v, jobDireccion, lugarEntrega }) =>
    !Object.is(obraSegunVersion(v, { jobDireccion, lugarEntrega, contenidoCongelado: BLOQUE_SONDA }),
      AYER_ROTO(v, { jobDireccion, lugarEntrega })));
  assert.ok(divergen.length >= 12,
    `🔴 el comparador solo ve ${divergen.length} diferencias contra un «ayer» con \`??\` en vez de ` +
    '`||`. Ese es EXACTAMENTE el cambio que tiene que cazar: si no lo ve, el test de arriba está ' +
    'verde por no comparar nada.');
});

test('SCRUM-438 · ③ v:1 y v:2 VERIFICAN igual: sus recetas ignoran el bloque congelado', () => {
  // La otra mitad de la condición dura. Un sobre viejo no puede cambiar de veredicto porque ahora
  // exista un bloque: sus recetas están congeladas y no lo miran.
  for (const v of [1, 2]) {
    const sinBloque = RECETAS_POR_VERSION[v]({ ...DOCUMENTO, ...EL_DIA_DE_LA_FIRMA });
    const conBloqueCualquiera = RECETAS_POR_VERSION[v]({
      ...DOCUMENTO, ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: BLOQUE_SONDA,
    });
    assert.equal(conBloqueCualquiera, sinBloque,
      `🔴 la receta de v:${v} se mueve cuando el sobre trae bloque congelado. Entonces lo lee, y ` +
      'todos los sobres v:${v} ya emitidos —que no lo tienen— dejarían de verificar.');
  }

  // Y la declaración lo dice también, que es lo que el guard de SCRUM-371 cara contra las recetas.
  for (const v of [1, 2]) {
    assert.equal(Object.values(FUENTES_POR_VERSION[v]).includes('congelado'), false,
      `🔴 la declaración dice que v:${v} lee del bloque congelado. Ninguna versión ya emitida puede ` +
      'estrenar fuente: eso reescribe el significado de lo que se selló.');
  }
});

// ── ④ LOS ROJOS POR EL MECANISMO ─────────────────────────────────────────────────────────

test('SCRUM-438 · ④ 🔴 TODO O NADA: un bloque incompleto FALLA NOMBRANDO la clave que falta', () => {
  const completo = { ...BLOQUE_SELLADO };

  // Control positivo: el bloque entero pasa. Si no, lo de abajo probaría que todo falla siempre.
  assert.deepEqual(validarContenidoCongelado(completo), completo,
    '🔴 un bloque con las cinco claves no pasa la validación');

  // Las CINCO, una a una. No una muestra: cada clave que falte tiene que decir SU nombre.
  for (const falta of CLAVES_CONGELADAS) {
    const cojo = { ...completo };
    delete cojo[falta];
    assert.throws(() => validarContenidoCongelado(cojo), (e) => {
      assert.equal(e.name, 'ContenidoCongeladoIncompletoError',
        `🔴 falta «${falta}» y el error es ${e.name}, no el del bloque incompleto`);
      assert.deepEqual(e.faltan, [falta], `🔴 el error no nombra «${falta}»: dice ${e.faltan}`);
      assert.match(e.message, new RegExp(falta),
        `🔴 el MENSAJE no nombra «${falta}». Quien lo lea tiene que saber qué falta sin abrir el código.`);
      return true;
    });

    // Y por el camino de verdad: el resolvedor y la receta, cada uno con su copia de la validación.
    assert.throws(() => contenidoSegunVersion(3, { ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: cojo }),
      new RegExp(falta), `🔴 el resolvedor acepta un bloque sin «${falta}»`);
    assert.throws(() => RECETAS_POR_VERSION[3]({ ...DOCUMENTO, ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: cojo }),
      new RegExp(falta), `🔴 la receta de v:3 acepta un bloque sin «${falta}»`);
    assert.throws(() => computeAlbaranContentHash({ ...DOCUMENTO, ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: cojo }, 3),
      new RegExp(falta), `🔴 el SELLADOR sella un v:3 con un bloque sin «${falta}»`);
  }

  // 🔴 Y NO SE COMPLETA CON NULOS, que es la «mejora» evidente y la que rompe el sistema: `null` es
  // un valor legítimo aquí —`obra` lo es en todos los sobres viejos—, así que un hueco rellenado
  // con `null` sería indistinguible de un `null` sellado de verdad.
  const conNulos = { obra: null, referenciaTrabajo: null, cliente: null, emisor: null, emisorNif: null };
  assert.deepEqual(validarContenidoCongelado(conNulos), conNulos,
    '🔴 un bloque con las cinco claves a `null` no pasa: entonces no se puede sellar un albarán sin ' +
    'lugar de obra, que es la mayoría de la población.');
  assert.notEqual(
    computeAlbaranContentHash({ ...DOCUMENTO, ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: conNulos }, 3),
    computeAlbaranContentHash({ ...DOCUMENTO, ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: completo }, 3),
    '🔴 sellar con cinco nulos y sellar con cinco valores da el MISMO hash: el bloque no entra en el ' +
    'contenido y nada de esto protege nada.');

  // Y las formas de «no es un bloque» que un `Json` de la base puede traer.
  for (const basura of [null, undefined, 'texto', 42, [], [1, 2]]) {
    assert.throws(() => validarContenidoCongelado(basura), { name: 'ContenidoCongeladoIncompletoError' },
      `🔴 se acepta ${JSON.stringify(basura) ?? 'undefined'} como bloque congelado`);
  }
});

test('SCRUM-438 · ④ 🔴 el resolvedor LANZA ante una versión que no conoce — no adivina', () => {
  const conocidas = Object.keys(FUENTES_POR_VERSION).map(Number);
  const fuentes = { ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: BLOQUE_SELLADO };

  for (const rara of [4, 99, 0, -1, NaN, Infinity]) {
    assert.equal(conocidas.includes(rara), false, `🔴 v:${rara} está declarada: no sirve de caso raro`);
    assert.throws(() => contenidoSegunVersion(rara, fuentes), (e) => {
      assert.equal(e.name, 'VersionDeSobreDesconocidaError',
        `🔴 con v:${rara} el error es ${e.name}: no es el de versión desconocida`);
      assert.match(e.message, new RegExp(String(rara).replace(/[-]/g, '\\-')),
        `🔴 el mensaje no dice QUÉ versión no conoce (${rara})`);
      return true;
    }, `🔴 con v:${rara} el resolvedor NO lanza: está eligiendo una rama para una versión que no ` +
       'reconoce, o sea adivinando. Un valor adivinado en un documento firmado coincide por ' +
       'accidente hasta el día que no.');
  }

  // 🔴 EL CONTROL NEGATIVO, y sin él lo de arriba sería «lanza siempre»: SIN FIRMAR no es una
  // versión rara. Es un borrador, y confundirlos rompería el PDF de todos los albaranes sin firmar.
  for (const sinFirmar of [null, undefined]) {
    const r = contenidoSegunVersion(sinFirmar, fuentes);
    assert.equal(r.obra, EL_DIA_DE_LA_FIRMA.lugarEntrega,
      `🔴 con v=${String(sinFirmar)} (sin firmar) no manda el campo de HOY: el PDF de un borrador ` +
      'dejaría de imprimir su lugar de obra.');
  }

  // Y las versiones que SÍ conoce no lanzan ninguna: si lanzaran, el bucle de arriba no distinguiría.
  for (const v of conocidas) {
    assert.doesNotThrow(() => contenidoSegunVersion(v, fuentes), `🔴 v:${v} está declarada y lanza`);
  }
});

// ── ⑤ LA MEDICIÓN · ¿ESTÁ LA `v` DENTRO DEL CONTENIDO QUE SE HASHEA? ─────────────────────

test('SCRUM-438 · ⑤ 🔴 la VERSIÓN entra en el hash: dos recetas nunca coinciden sobre el mismo contenido', () => {
  // El orden de claves de v:3 es EL MISMO que el de v:2 (eso es correcto: lo prohibido era
  // compartir el helper, no coincidir en el orden). Así que la pregunta es legítima: con los cinco
  // campos SIN cambiar, ¿daría v:3 el mismo hash que v:2? Se CALCULA, no se deduce del orden.
  const sinCambiarNada = {
    ...DOCUMENTO,
    ...EL_DIA_DE_LA_FIRMA,
    contenidoCongelado: BLOQUE_SELLADO,   // el bloque dice lo MISMO que las filas vivas
  };
  const porVersion = new Map(versionesSoportadas().map((v) => [v, RECETAS_POR_VERSION[v](sinCambiarNada)]));
  assert.equal(new Set(porVersion.values()).size, porVersion.size,
    '🔴 DOS VERSIONES DAN EL MISMO HASH sobre el mismo contenido:\n  ' +
    [...porVersion].map(([v, h]) => `v:${v} → ${h.slice(0, 16)}…`).join('\n  ') +
    '\n\n  Entonces la `v` NO está atada a la huella, y dos sellos calculados con reglas distintas\n' +
    '  serían indistinguibles. Es la propiedad de la que cuelga todo el despacho por versión.');

  // Y por qué: la `v` es la PRIMERA clave del objeto serializado. Se comprueba rehaciendo el
  // serializado a mano —sin importar nada del verificador— y quitándole la `v`.
  const canonicoV3 = JSON.stringify({
    v: 3,
    numero: DOCUMENTO.numero,
    fecha: DOCUMENTO.fecha.toISOString(),
    modoValoracion: DOCUMENTO.modoValoracion,
    obra: BLOQUE_SELLADO.obra,
    referenciaTrabajo: BLOQUE_SELLADO.referenciaTrabajo,
    cliente: BLOQUE_SELLADO.cliente,
    emisor: BLOQUE_SELLADO.emisor,
    emisorNif: BLOQUE_SELLADO.emisorNif,
    notas: DOCUMENTO.notas,
    lineas: DOCUMENTO.lineas.map((l) => ({
      concepto: l.concepto, cantidad: l.cantidad, unidad: l.unidad ?? null,
      precioUnitario: l.precioUnitario ?? null, tipoIva: l.tipoIva ?? null,
    })),
    fechaEntrega: DOCUMENTO.fechaEntrega.toISOString(),
    firmadoPorNombre: DOCUMENTO.firmadoPorNombre,
    firmadoPorCalidad: DOCUMENTO.firmadoPorCalidad,
  });
  const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
  assert.equal(sha(canonicoV3), porVersion.get(3),
    '🔴 el serializado rehecho a mano no da el hash de la receta: o el orden de claves de v:3 ' +
    'cambió, o esta transcripción está mal. En los dos casos hay que mirarlo antes de fiarse.');
  assert.notEqual(sha(canonicoV3.replace(/^\{"v":3,/, '{')), porVersion.get(3),
    '🔴 CONTROL: quitar la `v` del serializado no mueve el hash. Entonces no estaba dentro y esta ' +
    'medición no medía nada.');
});

test('SCRUM-438 · ⑤ 🔴 bajar la `v` guardada de 3 a 2 se DETECTA, y se nombra', () => {
  // La segunda mitad de la medición: si alguien tocara la `v` de la fila sin tocar nada más,
  // ¿pasaría a leer en vivo sin quejarse? No: el hash guardado deja de ser el de la receta que se
  // le aplica, y el bucle cruzado dice con cuál cuadra de verdad.
  const sello = sellar(3, EL_DIA_DE_LA_FIRMA);

  const r = verificarSobre({
    evidencia: { v: 2, hashAlg: 'sha256', contentHash: sello },   // ← la `v` bajada a mano
    contenido: { ...DOCUMENTO, ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: BLOQUE_SELLADO },
  });
  assert.equal(r.cuadra, false,
    '🔴 con la `v` bajada de 3 a 2 el sobre CUADRA. Entonces la versión declarada no está protegida ' +
    'por la huella y cualquiera podría hacer que un sobre congelado volviera a leer en vivo.');
  assert.equal(r.motivo, 'hash_de_otra_version',
    `🔴 sale como «${r.motivo}». El contenido está intacto: lo que no encaja es la versión ` +
    'declarada, y decirlo como «manipulado» es la acusación que SCRUM-415 vino a evitar.');
  assert.match(r.mensaje, /v:3/, '🔴 el mensaje no dice con qué versión cuadra de verdad');
});

// ── COHERENCIA ───────────────────────────────────────────────────────────────────────────

test('SCRUM-438 · la versión ACTUAL es la que este fichero prueba, y la declara el producto', () => {
  // Si el sellador subiera a v:4 sin que este fichero se enterase, todo lo de arriba seguiría verde
  // probando una versión que ya no se emite.
  assert.equal(ALBARAN_CONTENIDO_VERSION_ACTUAL, 3,
    `🔴 el sellador emite hoy v:${ALBARAN_CONTENIDO_VERSION_ACTUAL} y este fichero prueba v:3. ` +
    'Lo de arriba habría dejado de mirar la versión que se está sellando de verdad.');
  assert.ok(versionesSoportadas().includes(ALBARAN_CONTENIDO_VERSION_ACTUAL),
    '🔴 el verificador no sabe recalcular la versión que el sellador emite: cada sobre nuevo ' +
    'nacería como `version_no_soportada`.');
});

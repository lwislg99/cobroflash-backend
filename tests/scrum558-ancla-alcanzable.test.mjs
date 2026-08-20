// tests/scrum558-ancla-alcanzable.test.mjs — SCRUM-558
//
// EL HUECO QUE DESTAPÓ UNA FRASE BIEN ANCLADA.
//
// `gremios[climatizacion]/p#1` («la revisión del año que viene queda anotada sola») pasó el censo
// de SCRUM-551 en verde y es FALSA para todo merchant nuevo. Su ancla estaba bien:
// `runMaintenanceProposals` existe y lo dispara el cron. Lo que faltaba era la segunda pregunta.
//
//     El censo preguntaba «¿existe el símbolo?».
//     Un símbolo que existe NO significa que el usuario pueda llegar a él.
//     Es «apagado ≠ no construido» del revés: CONSTRUIDO ≠ ALCANZABLE.
//
// Las tres que el censo ya cazaba se cazaron porque NO tenían ancla. Ésta la tenía.
//
// ⚠️ Y LO QUE ESTE FICHERO VIGILA CON MÁS CUIDADO ES LO CONTRARIO: que «estar detrás de un flag»
//    NO se convierta en «es mentira». Lo que decide es el VALOR del flag, no su existencia. La
//    tabla P tiene hoy uno encendido por defecto, y una frase detrás de él sería cierta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censar, censarEnDisco, alcanzabilidad, defaultsDeLaTablaP, flagsQueVigilaElFichero,
  elAltaNoEscribeFlags, ANCLAS_F, LANDING, TABLA_P,
} from '../scripts/censo-anclas-bloque-f.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RAIZ, LANDING), 'utf8');

/** El símbolo real que sí está detrás de una puerta apagada. */
const ANCLA_CON_PUERTA = 'src/modules/maintenance/domain/maintenance.service.ts::runMaintenanceProposals';
/** Un ancla real SIN puerta ninguna, para contrastar. */
const ANCLA_SIN_PUERTA = 'src/modules/invoicing/domain/invoiceLines.service.ts::stageLines';

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · no saber leer el valor NO es «está encendido»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-558 · 🔴 SUELO: la tabla P se lee de verdad y trae lo que dice traer', () => {
  const r = defaultsDeLaTablaP(RAIZ);
  assert.equal(r.ok, true, `🔴 CIEGO: no he sabido leer ${TABLA_P}: ${r.motivo}`);
  assert.ok(Object.keys(r.tabla).length >= 8,
    `🔴 CIEGO: sólo ${Object.keys(r.tabla).length} flags. Si el parser lee de menos, cada flag que `
    + 'se le escape queda sin vigilar y nadie lo nota.');
  assert.equal(typeof r.tabla.MAINTENANCE_ENABLED, 'boolean',
    '🔴 CIEGO: no veo `MAINTENANCE_ENABLED` en la tabla. Es el flag del caso que abrió este ticket.');
  // Y que sepa leer los DOS valores: un parser que sólo supiera ver `false` daría el veredicto
  // correcto en este caso por pura suerte, y el contrario en cuanto alguien encienda algo.
  const valores = new Set(Object.values(r.tabla));
  assert.ok(valores.has(true) && valores.has(false),
    '🔴 el parser sólo ve un valor. Con eso, «lo leí» y «lo supuse» dan el mismo resultado.');
});

test('SCRUM-558 · 🔴 SUELO: si no puede leer la tabla, dice NO SUPE MIRAR — no da por encendido', () => {
  // Una raíz que existe y donde `src/core/flags.ts` no está: es el caso de «me han movido el
  // fichero», que es el que de verdad pasa.
  const ciego = defaultsDeLaTablaP(path.join(RAIZ, 'scripts'));
  assert.equal(ciego.ok, false, '🔴 ha dicho que leyó una tabla que no existe.');

  const p = alcanzabilidad('unidad/x', {
    texto: 'Una frase cualquiera.', anclas: [ANCLA_CON_PUERTA],
    tras: [{ flag: 'MAINTENANCE_ENABLED', porDefecto: false, motivo: 'da igual' }],
  }, RAIZ, ciego);

  assert.ok(p.some((x) => x.includes('NO SUPE MIRAR')),
    '🔴 SIN NO SUPE MIRAR. Con la tabla ilegible ha resuelto igual que si la hubiera leído.\n'
    + '  Asumir encendido es el fallo caro: convierte cada fallo de lectura en un aprobado\n'
    + '  silencioso, y justo para las frases que más caro salen si son falsas.\n'
    + `  Dijo: ${JSON.stringify(p)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LO QUE DECIDE ES EL VALOR, NO LA EXISTENCIA DE LA PUERTA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-558 · ✅ una puerta ENCENDIDA por defecto NO convierte la frase en falsa', () => {
  const tabla = defaultsDeLaTablaP(RAIZ);
  const encendidos = Object.entries(tabla.tabla).filter(([, v]) => v === true).map(([k]) => k);
  assert.ok(encendidos.length >= 1,
    '🔴 CIEGO: no hay ni un flag encendido en la tabla P, así que este caso no se está probando\n'
    + '  con nada real. Si algún día no queda ninguno, hay que decirlo aquí en vez de dejar que\n'
    + '  el caso pase por vacío.');

  const p = alcanzabilidad('unidad/x', {
    texto: 'Una frase sostenida por algo que sí está encendido.',
    anclas: [ANCLA_SIN_PUERTA],
    tras: [{ flag: encendidos[0], porDefecto: true, motivo: 'encendido en la tabla P' }],
  }, RAIZ, tabla);

  assert.deepEqual(p, [],
    `🔴 ha marcado como inalcanzable una frase detrás de \`${encendidos[0]}\`, que está ENCENDIDO.\n`
    + '  «Detrás de un flag» no es «mentira»: lo que decide es el valor. Un criterio que marca lo\n'
    + '  que sí es verdad se acaba desactivando entero.');
});

test('SCRUM-558 · 🔴 una puerta APAGADA cae, y nombra la frase Y el flag', () => {
  const p = alcanzabilidad('gremios[climatizacion]/p#1', {
    texto: 'Revisas la caldera antes del invierno.',
    anclas: [ANCLA_CON_PUERTA],
    tras: [{ flag: 'MAINTENANCE_ENABLED', porDefecto: false, motivo: 'opt-in que no se puede activar' }],
  }, RAIZ, defaultsDeLaTablaP(RAIZ));

  assert.equal(p.length, 1, `🔴 esperaba un problema y hay ${p.length}: ${JSON.stringify(p)}`);
  assert.match(p[0], /INALCANZABLE/);
  assert.match(p[0], /MAINTENANCE_ENABLED/, '🔴 el rojo no nombra el flag: sin él nadie sabe qué mirar.');
  assert.match(p[0], /Revisas la caldera/, '🔴 el rojo no cita la frase: sin ella nadie sabe qué texto corregir.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ LAS DOS FORMAS DE ENGAÑAR A ESTE CRITERIO, TAPADAS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-558 · 🔴 declarar un valor que ya no es el de la tabla P no cuela', () => {
  // La foto vieja es el modo de fallo de este registro entero: se declara una vez y el mundo se
  // mueve debajo. Aquí se declara `true` sobre un flag que la tabla tiene en `false`.
  const p = alcanzabilidad('unidad/x', {
    texto: 'Una frase.', anclas: [ANCLA_CON_PUERTA],
    tras: [{ flag: 'MAINTENANCE_ENABLED', porDefecto: true, motivo: 'foto vieja' }],
  }, RAIZ, defaultsDeLaTablaP(RAIZ));

  assert.ok(p.some((x) => x.includes('CADUCÓ')),
    '🔴 se ha tragado un valor declarado que no coincide con la tabla. Entonces `porDefecto` no\n'
    + '  es una medición: es un comentario, y uno que además silencia el veredicto.\n'
    + `  Dijo: ${JSON.stringify(p)}`);
});

test('SCRUM-558 · 🔴 una puerta que está en el código y NO en el registro se canta', () => {
  // Es el caso de este ticket visto desde antes: el ancla puesta, la puerta sin declarar.
  const p = alcanzabilidad('unidad/x', {
    texto: 'Una frase que promete algo con una puerta sin declarar.', anclas: [ANCLA_CON_PUERTA],
  }, RAIZ, defaultsDeLaTablaP(RAIZ));

  const aviso = p.find((x) => x.includes('PUERTA SIN DECLARAR'));
  assert.ok(aviso && aviso.includes('MAINTENANCE_ENABLED'),
    '🔴 el ancla apunta a un fichero que comprueba `MAINTENANCE_ENABLED` y el registro no dice\n'
    + '  nada, y ha pasado. Si declarar la puerta es voluntario, el criterio nuevo sólo protege\n'
    + '  contra los casos que alguien ya se sabía.\n'
    + `  Dijo: ${JSON.stringify(p)}`);

  // 🔴 Y el rojo tiene que ser accionable SIN ir a buscar la otra mitad del dato. Se midió en la
  //    demostración de este ticket: el mensaje nombraba el flag y el fichero, y no decía qué
  //    frase estaba en riesgo ni si el valor era el malo.
  assert.match(aviso, /Una frase que promete/,
    '🔴 el aviso no cita el texto: quien lo lea sabe que hay una puerta y no qué frase corregir.');
  assert.match(aviso, /APAGADO por defecto/,
    '🔴 el aviso no dice cómo está el flag. «Hay una puerta» y «hay una puerta cerrada» piden\n'
    + '  acciones distintas, y el que lee el rojo no tiene por qué ir a la tabla P a averiguarlo.');
});

test('SCRUM-558 · ✅ el detector de puertas sabe decir que NO', () => {
  // Sin esto, «no encontré puertas» y «no sé mirar puertas» dan la misma lista vacía.
  assert.deepEqual(flagsQueVigilaElFichero('src/modules/invoicing/domain/invoiceLines.service.ts', RAIZ), [],
    '🔴 ve una puerta en un fichero que no tiene ninguna.');
  assert.deepEqual(flagsQueVigilaElFichero('src/modules/maintenance/domain/maintenance.service.ts', RAIZ),
    ['MAINTENANCE_ENABLED'],
    '🔴 no ve la puerta que sí está. Con esto ciego, la red de seguridad no cubre nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ LA PREMISA DE LA QUE CUELGA TODO: un merchant nuevo cae al default de la tabla
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-558 · el alta NO escribe flags, que es lo que hace válido leer el default', () => {
  const r = elAltaNoEscribeFlags(RAIZ);
  assert.equal(r.ok, true,
    '🔴 la premisa se ha movido: ' + r.motivo + '\n'
    + '  Si el alta escribe overrides, «default de la tabla P» y «lo que tiene un merchant nuevo»\n'
    + '  dejan de ser lo mismo, y todo el veredicto de alcanzabilidad está medido sobre otra cosa.');
});

test('SCRUM-558 · ✅ y esa comprobación sabe decir que no', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum558-'));
  try {
    const rel = 'src/modules/auth/domain';
    fs.mkdirSync(path.join(dir, rel), { recursive: true });
    // ⚠️ El alta de mentira se escribe SIN el patrón de acceso a datos de verdad: SCRUM-113
    //    vigila que ningún fichero nuevo nazca con él, y un corpus sintético cuenta igual que
    //    código real. Aquí sólo hacen falta las dos señales que mira la comprobación.
    fs.writeFileSync(path.join(dir, rel, 'auth.service.ts'),
      'export async function registerMerchant(p) { return crear({ ...p, flags: {} }); }\n');
    const r = elAltaNoEscribeFlags(dir);
    assert.equal(r.ok, false,
      '🔴 ha dado por buena un alta que SÍ escribe flags. Entonces la comprobación de arriba pasa\n'
      + '  siempre y no está midiendo nada.');
    assert.match(r.motivo, /flags/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ CONTROL POSITIVO SOBRE LA LANDING REAL · si cae todo, el criterio no vale
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Las cinco unidades ancladas que un merchant nuevo SÍ alcanza. Repasadas una a una. */
const ALCANZABLES_HOY = [
  'heroe-f4/h1#1',            // sendWhatsAppTemplate · credenciales de PLATAFORMA, sin flag
  'heroe-f4/p#2',             // planExpiresAt · la prueba de 14 días, sin flag
  'gremios[fontaneria]/p#1',  // signatureData · la firma no tiene puerta
  'gremios[cerrajeria]/p#1',  // signatureData · idem
  'gremios[reformas]/p#1',    // stageLines + canTransitionAlbaran · ninguno tiene puerta
];

test('SCRUM-558 · ✅ CONTROL POSITIVO: las cinco alcanzables siguen pasando', () => {
  const tabla = defaultsDeLaTablaP(RAIZ);
  for (const id of ALCANZABLES_HOY) {
    const reg = ANCLAS_F[id];
    assert.ok(reg, `🔴 «${id}» ya no está en el registro: este control no está mirando nada.`);
    assert.deepEqual(alcanzabilidad(id, reg, RAIZ, tabla), [],
      `🔴 «${id}» sale como inalcanzable y su mecanismo SÍ está al alcance de un merchant nuevo.\n`
      + '  Un criterio que marca las cinco que son verdad no distingue nada: dice lo mismo de\n'
      + '  todas, y el rojo de climatización deja de significar algo.');
  }
});

test('SCRUM-558 · 🔴 en la landing real, la inalcanzable es EXACTAMENTE una', () => {
  const r = censarEnDisco(RAIZ);
  assert.equal(r.ciego, false, '🔴 el censo se declaró ciego: nada de lo de abajo cuenta.');
  assert.deepEqual(r.inalcanzables.map((x) => x.id), ['gremios[climatizacion]/p#1'],
    '🔴 HA CAMBIADO EL CONJUNTO DE FRASES ANCLADAS PERO INALCANZABLES.\n'
    + '  · Si ha aparecido una nueva: hay un texto que promete algo que existe y a lo que el\n'
    + '    usuario no puede llegar. Es tan falso como no tenerlo construido.\n'
    + '  · Si ha desaparecido: o se encendió el flag, o se reescribió el texto. Mira cuál de las\n'
    + '    dos y actualiza este trinquete con el motivo.\n'
    + `  Ahora mismo: ${JSON.stringify(r.inalcanzables.map((x) => x.id))}`);
});

test('SCRUM-558 · el registro inyectado también decide aquí, y se prueba que decide', () => {
  // La rama de alcanzabilidad dentro de `censar` sólo se recorre con un registro que declare
  // puertas. Sin poder inyectarlo, se podría borrar entera con la suite en verde — que es el
  // hueco que documenta SCRUM-388.
  const sinPuerta = JSON.parse(JSON.stringify(ANCLAS_F, (k, v) => (v instanceof RegExp ? String(v) : v)));
  delete sinPuerta['gremios[climatizacion]/p#1'].tras;
  const r = censar({ html, raiz: RAIZ, registro: sinPuerta });
  assert.ok(r.salida.includes('PUERTA SIN DECLARAR'),
    '🔴 quitando la declaración de la puerta, el censo no ha dicho nada. Entonces `censar` no está\n'
    + '  llamando a la red de seguridad y el verde de arriba viene de otro sitio.');
});

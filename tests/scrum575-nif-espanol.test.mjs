// tests/scrum575-nif-espanol.test.mjs — SCRUM-575 (CONT-02)
//
// VALIDACIÓN DE NIF / CIF / NIE: forma y dígito de control. Y EL TRINQUETE DE LA COPIA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTE FICHERO CORRE LAS DOS IMPLEMENTACIONES
//
// La regla vive DOS veces —`src/core/validation/nifEspanol.ts` y
// `public/dashboard/js/nifEspanol.js`— porque el front es vanilla y `tsconfig` fija
// `rootDir: "src"`: el navegador no puede importar del backend. Es la categoría
// `REGLA_COPIADA_AL_FRONT` que el repo ya tiene declarada.
//
// Pero ésta es una regla FISCAL, así que la copia no se documenta y ya: se ATA. Todos los casos
// de abajo se pasan por las DOS y se exige que coincidan. Si alguien toca una y olvida la otra,
// esto cae nombrando el valor donde discrepan — que es la diferencia entre un comentario que se
// olvida y un mecanismo que no.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

const servidor = await import('../dist/core/validation/nifEspanol.js');
const navegador = require_(path.join(RAIZ, 'public/dashboard/js/nifEspanol.js'));

/**
 * EL CORPUS. Cada caso dice qué se espera y por qué está aquí.
 *
 * ⚠️ Los valores son ARITMÉTICA, no documentos de nadie: se construyen para ejercer el algoritmo.
 * `12345678Z` es el ejemplo canónico publicado del DNI —`12345678 % 23 = 14`, y la letra 14 de
 * `TRWAGMYFPDXBNJZSQVHLCKE` es `Z`—, o sea que sirve de ANCLA INDEPENDIENTE: si el módulo lo
 * rechazara, el fallo estaría en la tabla o en el módulo, no en el caso.
 */
const CORPUS = [
  // ── EL CONTROL NEGATIVO QUE MÁS IMPORTA: sigue siendo OPCIONAL ──────────────────────────
  ['', true, 'VACÍO es VÁLIDO — validar no es obligar'],
  ['   ', true, 'sólo espacios sigue siendo vacío'],
  [null, true, 'null es vacío'],
  [undefined, true, 'undefined es vacío'],

  // ── VÁLIDOS DE LOS TRES TIPOS (probar uno solo sería validar un tercio) ─────────────────
  ['12345678Z', true, 'DNI válido — ejemplo canónico, ancla independiente'],
  ['00000000T', true, 'DNI válido con ceros (0 % 23 = 0 → T)'],
  ['X1234567L', true, 'NIE válido con X'],
  ['Y1234567X', true, 'NIE válido con Y'],
  ['Z1234567R', true, 'NIE válido con Z'],
  ['A58818501', true, 'CIF válido con control DÍGITO (entidad A)'],
  ['P1234567D', true, 'CIF válido con control LETRA (entidad P)'],

  // ── INVÁLIDOS: dígito de control ────────────────────────────────────────────────────────
  ['12345678A', false, 'DNI con letra de control equivocada'],
  ['X1234567A', false, 'NIE con letra de control equivocada'],
  ['A58818500', false, 'CIF con control equivocado'],
  ['P12345670', false, 'CIF de entidad P con control DÍGITO — esa entidad exige LETRA'],

  // ── INVÁLIDOS: forma ────────────────────────────────────────────────────────────────────
  ['1234567', false, 'longitud corta'],
  ['123456789Z', false, 'longitud larga'],
  ['1234567AZ', false, 'letra donde va número'],
  ['ABCDEFGHI', false, 'todo letras'],
  ['I1234567J', false, 'entidad `I`, que no existe en CIF'],

  // ── EL BORDE: espacios y minúsculas → SE NORMALIZA, no se rechaza ───────────────────────
  ['  12345678z  ', true, 'válido con espacios alrededor y minúscula'],
  ['12.345.678-Z', true, 'válido con puntos y guion'],
  ['a-5881850 1', true, 'CIF válido con guion, espacio y minúscula'],
];

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-575 · SUELO: las DOS implementaciones responden', () => {
  for (const [nombre, m] of Object.entries({ servidor, navegador })) {
    assert.equal(typeof m.validarNifEspanol, 'function', `🔴 ${nombre} no expone validarNifEspanol`);
    assert.equal(typeof m.normalizarNif, 'function', `🔴 ${nombre} no expone normalizarNif`);
  }
  // Y que DISTINGUEN: si dieran siempre lo mismo, todo lo de abajo pasaría sin medir nada.
  assert.equal(servidor.validarNifEspanol('12345678Z').valido, true);
  assert.equal(servidor.validarNifEspanol('12345678A').valido, false);
});

test('SCRUM-575 · SUELO: el corpus tiene casos de los dos signos', () => {
  const validos = CORPUS.filter(([, ok]) => ok).length;
  const invalidos = CORPUS.length - validos;
  assert.ok(validos >= 8, `🔴 sólo ${validos} casos válidos: no se está probando que ACEPTE`);
  assert.ok(invalidos >= 8, `🔴 sólo ${invalidos} casos inválidos: no se está probando que RECHACE`);
});

// ── LA VALIDACIÓN ────────────────────────────────────────────────────────────────────────

test('SCRUM-575 · el corpus entero, en el SERVIDOR', () => {
  for (const [valor, esperado, porque] of CORPUS) {
    assert.equal(
      servidor.validarNifEspanol(valor).valido, esperado,
      `🔴 ${JSON.stringify(valor)} debería ser ${esperado ? 'VÁLIDO' : 'INVÁLIDO'} — ${porque}`,
    );
  }
});

test('SCRUM-575 · 🔴 EL CONTROL QUE PROTEGE EL «OPCIONAL»: vacío NUNCA es un error', () => {
  // Es el que se rompe sin querer al añadir una validación, y el que convertiría el campo en
  // obligatorio sin que nadie lo hubiera decidido.
  for (const vacio of ['', '   ', null, undefined, '\t']) {
    for (const [nombre, m] of Object.entries({ servidor, navegador })) {
      const r = m.validarNifEspanol(vacio);
      assert.equal(r.valido, true, `🔴 ${nombre}: ${JSON.stringify(vacio)} se está tratando como error`);
      assert.equal(r.motivo, 'vacio', `🔴 ${nombre}: el motivo debería ser «vacio»`);
    }
  }
});

test('SCRUM-575 · el tipo se identifica bien (DNI / NIE / CIF)', () => {
  assert.equal(servidor.validarNifEspanol('12345678Z').tipo, 'DNI');
  assert.equal(servidor.validarNifEspanol('X1234567L').tipo, 'NIE');
  assert.equal(servidor.validarNifEspanol('A58818501').tipo, 'CIF');
  assert.equal(servidor.validarNifEspanol('').tipo, null);
});

test('SCRUM-575 · espacios y minúsculas se NORMALIZAN, no se rechazan', () => {
  // La decisión, dicha: un NIF se escribe con separadores y en minúsculas sin dejar de ser el
  // mismo documento. Hacer fallar a alguien por teclear `b-1234 5678` sería pedantería.
  assert.equal(servidor.normalizarNif('  b-1234 5678 '), 'B12345678');
  assert.equal(servidor.normalizarNif('12.345.678-z'), '12345678Z');
  assert.equal(servidor.normalizarNif(null), '');
});

// ── EL TRINQUETE DE LA COPIA ─────────────────────────────────────────────────────────────

test('SCRUM-575 · 🔴 LAS DOS COPIAS COINCIDEN EN TODO EL CORPUS', () => {
  for (const [valor, , porque] of CORPUS) {
    const a = servidor.validarNifEspanol(valor);
    const b = navegador.validarNifEspanol(valor);
    assert.deepEqual(
      { valido: a.valido, tipo: a.tipo, motivo: a.motivo },
      { valido: b.valido, tipo: b.tipo, motivo: b.motivo },
      `🔴 LAS DOS COPIAS DISCREPAN en ${JSON.stringify(valor)} (${porque}):\n` +
      `   servidor: ${JSON.stringify(a)}\n   navegador: ${JSON.stringify(b)}`,
    );
    assert.equal(servidor.normalizarNif(valor), navegador.normalizarNif(valor),
      `🔴 las dos normalizaciones discrepan en ${JSON.stringify(valor)}`);
  }
});

test('SCRUM-575 · 🔴 el trinquete también sobre un barrido AMPLIO, no sólo sobre el corpus', () => {
  // El corpus lo elegí yo, así que sólo prueba lo que se me ocurrió. Esto recorre los 23 restos
  // posibles del DNI y las 20 letras de entidad del CIF: si las copias divergen en un caso que no
  // se me ocurrió, cae aquí.
  const casos = [];
  for (let i = 0; i < 23; i += 1) casos.push(String(i).padStart(8, '0') + 'TRWAGMYFPDXBNJZSQVHLCKE'[i % 23]);
  for (const letra of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') casos.push(letra + '5881850' + '1');
  for (const letra of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') casos.push(letra + '5881850' + 'A');

  let discrepancias = 0;
  for (const v of casos) {
    const a = servidor.validarNifEspanol(v);
    const b = navegador.validarNifEspanol(v);
    if (a.valido !== b.valido || a.tipo !== b.tipo || a.motivo !== b.motivo) {
      discrepancias += 1;
      assert.fail(`🔴 DISCREPAN en ${v}: servidor ${JSON.stringify(a)} · navegador ${JSON.stringify(b)}`);
    }
  }
  assert.equal(discrepancias, 0);
  // SUELO del barrido: si el corpus generado estuviera vacío esto pasaría sin comparar nada.
  assert.ok(casos.length >= 70, `🔴 el barrido sólo tiene ${casos.length} casos`);
});

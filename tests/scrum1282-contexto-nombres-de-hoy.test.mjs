// tests/scrum1282-contexto-nombres-de-hoy.test.mjs — SCRUM-1282
//
// `sesion.mjs contexto` es la magnitud buena del relevo (input + cache_read + cache_creation del
// último turno del jsonl), y estaba inservible: pasaba por la lista blanca del equipo y rechazaba
// los nombres con los que se trabaja (`s5-29c`, `cobroflash-backend-57`) con NOMBRE-NO-PERMITIDO.
// Lo que se fija aquí: `contexto` acepta esos nombres, sigue rechazando lo que no tiene forma de
// nombre, y la lista blanca estricta NO se afloja para las acciones que actúan sobre procesos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as s from '../scripts/equipo/sesion.mjs';

const RAIZ = path.join(import.meta.dirname, '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "    const malo = validarNombreDeLectura(nombre);\n",
    a: "    const malo = validarNombre(nombre, equipo);\n",
    cae: 'la acción `contexto` valida con la forma, no con la lista blanca',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: 'const NOMBRE_DE_LECTURA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;',
    a: 'const NOMBRE_DE_LECTURA = /./;',
    cae: 'lo que no tiene forma de nombre sigue fuera',
  },
];

test('SCRUM-1282 · 🔴 los nombres con los que trabaja el equipo HOY se pueden medir', () => {
  for (const n of ['s5-29c', 's3-29d', 'cobroflash-backend-57', 'orquestador', 'sesion-5']) {
    assert.equal(s.validarNombreDeLectura(n), null, `🔴 «${n}» no se puede medir: vuelta a restar a mano`);
  }
});

test('SCRUM-1282 · 🔴 CONTROL POSITIVO: lo que no tiene forma de nombre sigue fuera', () => {
  for (const malo of ['', ' ', '../x', '--help', '-x', 'a b', 'a/b', 'a\\b', 'x'.repeat(65), undefined, null, 5]) {
    assert.equal(s.validarNombreDeLectura(malo)?.veredicto, 'NOMBRE-INVALIDO', `🔴 acepta ${JSON.stringify(malo)}`);
  }
});

test('SCRUM-1282 · la lista blanca de las acciones que ACTÚAN no se afloja', () => {
  // Lanzar, relevar, parar u olvidar con un nombre ajeno es actuar sobre el equipo de otro.
  for (const n of ['s5-29c', 'cobroflash-backend-57']) {
    assert.equal(s.validarNombre(n)?.veredicto, 'NOMBRE-NO-PERMITIDO', `🔴 «${n}» entra en la lista blanca`);
  }
});

test('SCRUM-1282 · 🔴 la acción `contexto` valida con la forma, no con la lista blanca', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'scripts', 'equipo', 'sesion.mjs'), 'utf8');
  const i = src.indexOf("if (accion === 'contexto') {");
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro la acción `contexto` en sesion.mjs');
  const bloque = src.slice(i, src.indexOf('\n  }\n', i));
  assert.match(bloque, /validarNombreDeLectura\(nombre\)/);
  assert.doesNotMatch(bloque, /validarNombre\(nombre, equipo\)/,
    '🔴 `contexto` vuelve a pasar por la lista blanca: rechaza los nombres de hoy');
});

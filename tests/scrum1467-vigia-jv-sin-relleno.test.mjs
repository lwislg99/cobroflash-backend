// tests/scrum1467-vigia-jv-sin-relleno.test.mjs — SCRUM-1467
//
// El gemelo de SCRUM-1095. `sesion.mjs` dejó de inventarse qué espera una sesión bloqueada
// (`claude agents --json` no trae nunca `waitingFor`), y `vigia-sesiones-jv.mjs` se quedó atrás:
// con `waitingFor: null` escribía «espera algo interactivo» en un issue de GitHub, un relleno con
// forma de dato. Este fichero ata las dos cosas que pide el ticket:
//   · sin `waitingFor`, el vigía NO afirma qué espera (y con uno de verdad, lo usa tal cual);
//   · la frase sale de UN sitio, `motivoDeBloqueo` de `sesion.mjs`, sin una tercera redacción.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIGIA = path.join(RAIZ, 'scripts', 'vigia-sesiones-jv.mjs');
const vigia = await import(pathToFileURL(VIGIA).href);
const sesion = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'sesion.mjs')).href);

const motivoDe = (bloqueada) => vigia.sesionesQueAvisan({ bloqueadas: [{ id: 'b1', nombre: 'jv-j2', avisar: true, ...bloqueada }] })[0].motivo;

test('sin waitingFor (null, que es lo que entrega hoy sesion.mjs, o ausente), el vigía NO dice qué espera', () => {
  for (const bloqueada of [{ waitingFor: null }, {}]) {
    const motivo = motivoDe(bloqueada);
    assert.doesNotMatch(motivo, /algo interactivo/, `relleno con forma de dato: «${motivo}»`);
    assert.match(motivo, /motivo desconocido/);
  }
});

test('control positivo: con un waitingFor de verdad, se usa tal cual', () => {
  assert.equal(motivoDe({ waitingFor: 'permiso de Bash' }), 'espera permiso de Bash');
});

test('una sola redacción: el vigía dice exactamente lo que dice motivoDeBloqueo de sesion.mjs', () => {
  assert.equal(typeof sesion.motivoDeBloqueo, 'function', 'sesion.mjs no exporta motivoDeBloqueo');
  for (const bloqueada of [{ waitingFor: null }, {}, { waitingFor: 'permiso de Bash' }]) {
    assert.equal(motivoDe(bloqueada), sesion.motivoDeBloqueo(bloqueada));
  }
});

test('y el vigía no lleva una tercera redacción escrita a mano (código sin comentarios)', () => {
  const codigo = fs.readFileSync(VIGIA, 'utf8').split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .map((l) => l.replace(/\s\/\/.*$/, ''))
    .join('\n');
  assert.match(codigo, /\bmotivoDeBloqueo\(/, 'el vigía no llama a motivoDeBloqueo');
  assert.doesNotMatch(codigo, /espera \$\{|algo interactivo|motivo desconocido/);
});

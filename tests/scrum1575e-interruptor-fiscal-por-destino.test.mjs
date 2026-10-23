// tests/scrum1575e-interruptor-fiscal-por-destino.test.mjs — SCRUM-1575e
//
// ¿EL INTERRUPTOR FISCAL MIRA ADÓNDE VA —host Y base— ANTES DE CONECTAR?
//
// Hasta el 23-oct-2026, `scripts/cambiar-flag-fiscal.mjs` sólo exigía `FLAG_CONFIRM=<hostname>`, y
// staging y desarrollo comparten host (`acela`): una `DATABASE_URL` a la base de desarrollo pasaba
// igual que una a staging (medido por jv-j5w, SCRUM-1575 c.20383). Ahora `FLAG_CONFIRM` nombra la
// CLAVE del destino y `exigirDestinoCorrecto` compara host y base sobre la misma URL.
//
// ⚠️ Ningún caso conecta con ninguna base. Las URLs son INVENTADAS, al puerto 1. Los casos que
// pasan el guard van SIN argumentos: el script aborta en «Falta --merchant», que va antes de
// importar nada de `dist/`. El único caso con los argumentos completos usa un loopback al puerto 1,
// y con el arreglo se niega en el guard: si alguien lo quitara, intentaría conectar con 127.0.0.1:1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HOST_PRODUCCION, DESTINOS_ESPERADOS } from '../scripts/_clave-vs-destino.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'cambiar-flag-fiscal.mjs');

// Hosts y bases derivados de la tabla, no copiados: si la tabla cambia, los casos la siguen.
const { DATABASE_URL_STAGING: ST, DATABASE_URL_DEV: DV } = DESTINOS_ESPERADOS;
const fabricar = (host, base) => `postgresql://inventado:inventado@${host}:1/${base}`;
const STAGING = fabricar(ST.host, ST.base);
const DEV = fabricar(DV.host, DV.base);
const PROD = fabricar(HOST_PRODUCCION, 'railway');
const LOOPBACK = fabricar('127.0.0.1', ST.base);
const ARGS = ['--merchant', '1', '--flag', 'INVOICING_ES_ENABLED', '--valor', 'off', '--email', 'nadie@ejemplo.invalid'];

// El hijo NO hereda el entorno: ni NODE_TEST_CONTEXT ni NODE_OPTIONS, ni una DATABASE_URL de verdad.
function correr(url, confirm, args = []) {
  const env = Object.fromEntries(Object.entries({
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL: url, FLAG_CONFIRM: confirm,
  }).filter(([, v]) => v !== undefined));
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: RAIZ, env, encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.error, undefined, `el hijo no arrancó: ${r.error?.message}`);
  const todo = `${r.stdout}\n${r.stderr}`;
  assert.ok(!todo.includes('inventado'), 'la salida imprime la credencial (R7)');
  return { status: r.status, out: r.stdout, err: r.stderr, todo };
}

const PASA_EL_GUARD = /\[destino\] \S+ → /;
const LLEGA_A_LOS_ARGUMENTOS = 'Falta --merchant';

test('SCRUM-1575e · SEMBRADO: la base de DESARROLLO con el host de staging, confirmada como staging, se NIEGA', () => {
  assert.equal(ST.host, DV.host, 'premisa: staging y dev comparten host (si no, este caso no siembra nada)');
  const r = correr(DEV, 'DATABASE_URL_STAGING');
  assert.equal(r.status, 1);
  assert.match(r.err, /LA CLAVE NO APUNTA A DONDE DICE SU NOMBRE/);
  assert.ok(!PASA_EL_GUARD.test(r.out), 'pasó el guard');
  assert.ok(!r.err.includes(LLEGA_A_LOS_ARGUMENTOS), 'no paró en el guard: llegó a leer los argumentos');
});

test('SCRUM-1575e · el FLAG_CONFIRM viejo (hostname) ya no basta: con él, la URL de dev pasaba', () => {
  const r = correr(DEV, DV.host);
  assert.equal(r.status, 1);
  assert.ok(!r.err.includes(LLEGA_A_LOS_ARGUMENTOS), 'el hostname sigue valiendo como confirmación');
  assert.match(r.err, /FLAG_CONFIRM=DATABASE_URL_STAGING/, 'no dice qué valores se aceptan');
});

test('SCRUM-1575e · con los argumentos COMPLETOS, un destino que no cuadra se niega antes de conectar', () => {
  const r = correr(LOOPBACK, 'DATABASE_URL_STAGING', ARGS);
  assert.equal(r.status, 1);
  assert.match(r.err, /LA CLAVE NO APUNTA A DONDE DICE SU NOMBRE/);
  // El sujeto de las dos negaciones de abajo, verificado por contenido: es la salida del guard, no
  // una salida vacía. Su hermano exacto («🎯 Base de datos») sólo saldría pasando el guard y
  // conectando, y este fichero no conecta con nada.
  assert.match(r.todo, /LA CLAVE NO APUNTA A DONDE DICE SU NOMBRE/);
  assert.ok(!/Can't reach|ECONNREFUSED|Cannot find module/.test(r.todo), `pasó del guard: ${r.todo.slice(0, 300)}`);
  assert.ok(!r.todo.includes('🎯 Base de datos'), 'llegó a la parte que habla con la base');
});

test('SCRUM-1575e · producción confirmada como staging se niega', () => {
  const r = correr(PROD, 'DATABASE_URL_STAGING');
  assert.equal(r.status, 1);
  assert.match(r.err, /LA CLAVE NO APUNTA A DONDE DICE SU NOMBRE/);
  assert.ok(!r.err.includes(LLEGA_A_LOS_ARGUMENTOS));
});

test('SCRUM-1575e · POSITIVO: staging como staging y dev como dev PASAN el guard (y paran en los argumentos, sin conectar)', () => {
  for (const [url, clave, d] of [[STAGING, 'DATABASE_URL_STAGING', ST], [DEV, 'DATABASE_URL_DEV', DV]]) {
    const r = correr(url, clave);
    assert.ok(r.out.includes(`[destino] ${clave} → ${d.host}/${d.base} (${d.comoSeLlama}) ✅`), `${clave}: no pasó el guard\n${r.todo}`);
    assert.ok(r.err.includes(LLEGA_A_LOS_ARGUMENTOS), `${clave}: no llegó a los argumentos`);
    assert.equal(r.status, 1);
  }
});

test('SCRUM-1575e · producción NOMBRADA como producción sigue pasando: no cambia lo que hace el interruptor', () => {
  const r = correr(PROD, 'DATABASE_URL');
  assert.ok(r.out.includes(`[destino] DATABASE_URL → ${HOST_PRODUCCION}/railway`), r.todo);
  assert.ok(r.err.includes(LLEGA_A_LOS_ARGUMENTOS));
});

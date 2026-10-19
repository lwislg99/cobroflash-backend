// tests/scrum418c-env-local-en-el-barrido.test.mjs — SCRUM-418c
//
// `comprobar-claves-bd.mjs` es el instrumento que CLAUDE.md manda correr para demostrar que en un árbol
// de trabajo no hay credencial de producción. Cargaba sólo `.env` (`import 'dotenv/config'`), y la app
// carga ANTES `.env.local`, con prioridad (`src/core/config/loadEnv.ts:10`). O sea: una credencial de
// producción en `.env.local` la usaba `npm run dev` y el guard no la veía. Ciego justo en el fichero
// que gana. Hallado por la S0 el 14-oct-2026 al re-fechar las claves de CLAUDE.md (SCRUM-418b).
//
// Contra el `main` de antes de este cambio, R1, R2, R3 y R5 caen (el guard no recibe ni lee ficheros).
//
// ⚠️ Ninguna URL de aquí sale de un `.env` real: todas son inventadas, como en scrum418.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { comprobarEsteArbol, leerFicherosEnv } from '../scripts/comprobar-claves-bd.mjs';

const STAGING = 'postgresql://u:p@acela.proxy.rlwy.net:5432/railway';
const DEV     = 'postgresql://u:p@acela.proxy.rlwy.net:5432/yaqu_dev_javier';
const PROD    = 'postgresql://u:p@autorack.proxy.rlwy.net:5432/railway';
const RARA    = 'postgresql://u:p@db.ejemplo.invalid:5432/otra';

const ENV_SANO = Object.freeze({ DATABASE_URL_STAGING: STAGING, DATABASE_URL_DEV: DEV, DATABASE_URL_TESTS: STAGING });
const EN_B1 = { raiz: 'C:/Users/x/cobroflash-b1' };

test('SCRUM-418c · CONTROL: sin ficheros, el árbol sano sigue en verde (el cambio no añade rojos de la nada)', () => {
  const r = comprobarEsteArbol({ env: { ...ENV_SANO }, ...EN_B1 });
  assert.equal(r.fallos, 0, r.salida);
  const r2 = comprobarEsteArbol({ env: { ...ENV_SANO }, ...EN_B1, ficheros: [{ origen: '.env.local', env: { ...ENV_SANO } }] });
  assert.equal(r2.fallos, 0, r2.salida);
});

test('SCRUM-418c · R1 · producción en `.env.local` CAE aunque el entorno cargado esté sano, y dice en qué fichero', () => {
  const r = comprobarEsteArbol({ env: { ...ENV_SANO }, ...EN_B1, ficheros: [{ origen: '.env.local', env: { DATABASE_URL: PROD } }] });
  assert.ok(r.fallos >= 1, r.salida);
  assert.match(r.salida, /\.env\.local/);
  assert.match(r.salida, /autorack/);
});

test('SCRUM-418c · R2 · un destino que NADIE ha declarado en `.env.local` tampoco pasa (SCRUM-1526)', () => {
  const r = comprobarEsteArbol({ env: { ...ENV_SANO }, ...EN_B1, ficheros: [{ origen: '.env.local', env: { DATABASE_URL_DEV: RARA } }] });
  assert.ok(r.fallos >= 1, r.salida);
  assert.match(r.salida, /\.env\.local/);
});

test('SCRUM-418c · R3 · CONTROL POSITIVO con un `.env.local` de verdad en disco: se lee y salta', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum418c-'));
  try {
    fs.writeFileSync(path.join(dir, '.env.local'), `DATABASE_URL=${PROD}\n`);
    const ficheros = leerFicherosEnv(dir);
    assert.deepEqual(ficheros.map((f) => f.origen), ['.env.local']);
    assert.equal(ficheros[0].env.DATABASE_URL, PROD);
    const r = comprobarEsteArbol({ env: { ...ENV_SANO }, ...EN_B1, ficheros });
    assert.ok(r.fallos >= 1, r.salida);
    assert.match(r.salida, /\.env\.local/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-418c · R4 · lee los DOS ficheros, sin fusionar: lo de `.env` cuenta aunque `.env.local` lo tape', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum418c-'));
  try {
    fs.writeFileSync(path.join(dir, '.env.local'), `DATABASE_URL_DEV=${DEV}\n`);
    fs.writeFileSync(path.join(dir, '.env'), `DATABASE_URL_DEV=${PROD}\n`);
    const ficheros = leerFicherosEnv(dir);
    assert.deepEqual(ficheros.map((f) => f.origen), ['.env.local', '.env']);
    const r = comprobarEsteArbol({ env: { ...ENV_SANO }, ...EN_B1, ficheros });
    assert.ok(r.fallos >= 1, r.salida);
    assert.match(r.salida, /en \.env\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-418c · R5 · un fichero que existe y no se puede leer es un FALLO, no un «no hay nada»', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum418c-'));
  try {
    fs.mkdirSync(path.join(dir, '.env.local'));   // existe, y leerlo como fichero falla (EISDIR)
    const ficheros = leerFicherosEnv(dir);
    assert.equal(ficheros.length, 1);
    assert.ok(ficheros[0].error, JSON.stringify(ficheros));
    const r = comprobarEsteArbol({ env: { ...ENV_SANO }, ...EN_B1, ficheros });
    assert.ok(r.fallos >= 1, r.salida);
    assert.match(r.salida, /NO SE PUDO LEER \.env\.local/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-418c · sin ficheros en el directorio, no se inventa ninguno', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum418c-'));
  try {
    assert.deepEqual(leerFicherosEnv(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// tests/scrum1536b-los-tres-estados-de-los-guiones.test.mjs — SCRUM-1536b
//
// Sin gate: ni BD, ni red, ni navegador, ni `dist/`. Lanza `node` y `git ls-files` como hijos.
//
// Los controles de `docs/master/evidencias/SCRUM-1536/barrido.mjs` dicen TRES cosas (OK, ROTO y
// NO SE PUDO SABER) desde que `tests/scrum622-…` los cazó diciendo dos. Aquí se EJECUTA el guion en
// sus tres estados: tal cual, y sobre las copias que fabrican `mutar-sembrar.mjs` y `mutar-vaciar.mjs`.
//
// Este fichero es además el REGISTRO de ese banco en el catálogo del meta-guard (SCRUM-1387): los dos
// mutadores no llevan lista propia, leen de aquí qué cambiar (las declaraciones con `modo`). Las dos
// últimas declaraciones no las aplica ningún mutador: son el defecto que se vino a arreglar —un
// veredicto que colapsa el tercer estado en OK— puesto a mano en `veredicto.mjs`.
//
// ⚠️ LÍMITE: no cubre `boe.mjs` (pide el texto del BOE, que no vive en el árbol) ni lo que el barrido
// encuentra en el máster; sólo sus dos controles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { veredicto, OK, ROTO, NO_SE } from '../docs/master/evidencias/SCRUM-1536/veredicto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = 'docs/master/evidencias/SCRUM-1536';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La siembra lleva el centinela de cero: el control de cero ve lo que no tenía que ver.
    modo: 'centinela',
    fichero: 'docs/master/evidencias/SCRUM-1536/barrido.mjs',
    de: 'Hacienda Foral · TicketBAI · Batuz · IGIC · ',
    a: 'Hacienda Foral · TicketBAI · Batuz · IGIC · qwzxforalinventado · ',
    cae: 'el guion tal cual: el control de cero dice OK',
  },
  {
    // A la siembra le falta una palabra del catálogo: el positivo no la ve.
    modo: 'sin-igic',
    fichero: 'docs/master/evidencias/SCRUM-1536/barrido.mjs',
    de: 'Hacienda Foral · TicketBAI · Batuz · IGIC · ',
    a: 'Hacienda Foral · TicketBAI · Batuz · ',
    cae: 'el guion tal cual: el positivo sembrado dice OK sobre todas sus palabras',
  },
  {
    // El catálogo se queda sólo con el centinela: el positivo no tiene NADA que esperar.
    modo: 'vaciar',
    fichero: 'docs/master/evidencias/SCRUM-1536/barrido.mjs',
    de: 'const PALABRAS = {',
    a: 'const PALABRAS = { ZZ_CERO: /\\bqwzxforalinventado\\b/ };\nconst FUERA_DEL_CATALOGO = {',
    cae: 'el guion tal cual: el positivo sembrado dice OK sobre todas sus palabras',
  },
  {
    // El defecto de origen: lo que no se pudo mirar sale OK.
    fichero: 'docs/master/evidencias/SCRUM-1536/veredicto.mjs',
    de: 'return NO_SE;',
    a: 'return OK;',
    cae: 'catálogo sólo con el centinela: los dos controles dicen NO SE PUDO SABER',
  },
  {
    // Y el otro colapso: lo roto sale OK.
    fichero: 'docs/master/evidencias/SCRUM-1536/veredicto.mjs',
    de: 'if (roto === true) return ROTO;',
    a: 'if (roto === true) return OK;',
    cae: 'centinela sembrado: el control de cero dice ROTO',
  },
];

// El entorno del hijo, a mano: el de un `node --test` padre o el color del chat cambian la salida.
const ENTORNO = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete ENTORNO[k];
const node = (...args) => spawnSync(process.execPath, args, { cwd: RAIZ, env: ENTORNO, encoding: 'utf8' });

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1536b-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
// Las copias mutadas importan `./veredicto.mjs`: se lleva al lado el del árbol, no uno propio.
fs.copyFileSync(path.join(RAIZ, E, 'veredicto.mjs'), path.join(TMP, 'veredicto.mjs'));

const LINEA = /^CONTROL positivo sembrado: (\d+) de (\d+) (.+?) · cero en la siembra: (.+?) · quitada la siembra: (\d+) \(tiene que ser 0\)$/m;

/** Corre un `barrido` (el del árbol o una copia) sobre UN fichero del árbol y lee su línea de control. */
function barrer(guion) {
  const r = node(guion, RAIZ, path.join(TMP, `hits-${path.basename(guion)}.tsv`), `${E}/veredicto.mjs`);
  const m = LINEA.exec(r.stdout);
  assert.ok(m, `el barrido no ha escrito su línea de CONTROL (salida ${r.status}):\n${r.stdout}\n${r.stderr}`);
  return {
    salida: r.status,
    vistas: Number(m[1]),
    esperadas: Number(m[2]),
    positivo: m[3],
    cero: m[4],
    ciego: /^CIEGO$/m.test(r.stdout),
  };
}

/** Fabrica una copia con uno de los dos mutadores del banco y la barre. */
function barrerMutado(mutador, nombre, ...modo) {
  const copia = path.join(TMP, nombre);
  const f = node(`${E}/${mutador}`, `${E}/barrido.mjs`, copia, ...modo);
  assert.equal(f.status, 0, `${mutador} ${modo.join(' ')} no ha fabricado la copia:\n${f.stdout}\n${f.stderr}`);
  assert.match(f.stdout, /^MUTADO /m);
  return barrer(copia);
}

test('SCRUM-1536b · el guion tal cual: el positivo sembrado dice OK sobre todas sus palabras, y sigue hasta el final', () => {
  const r = barrer(`${E}/barrido.mjs`);
  assert.equal(r.positivo, OK);
  assert.equal(r.vistas, r.esperadas);
  assert.equal(r.esperadas, 14, 'el catálogo del barrido lleva 14 palabras además del centinela');
  assert.equal(r.ciego, false);
  assert.equal(r.salida, 0);
});

test('SCRUM-1536b · el guion tal cual: el control de cero dice OK', () => {
  assert.equal(barrer(`${E}/barrido.mjs`).cero, OK);
});

test('SCRUM-1536b · centinela sembrado: el control de cero dice ROTO, y el guion corta con CIEGO y código 2', () => {
  const r = barrerMutado('mutar-sembrar.mjs', 'b-centinela.mjs', 'centinela');
  assert.equal(r.cero, ROTO);
  assert.equal(r.ciego, true);
  assert.equal(r.salida, 2);
});

test('SCRUM-1536b · siembra sin IGIC: el positivo dice qué palabra FALTA, y el guion corta con CIEGO y código 2', () => {
  const r = barrerMutado('mutar-sembrar.mjs', 'b-sin-igic.mjs', 'sin-igic');
  assert.equal(r.positivo, 'FALTAN igic');
  assert.equal(r.cero, OK);
  assert.equal(r.ciego, true);
  assert.equal(r.salida, 2);
});

test('SCRUM-1536b · catálogo sólo con el centinela: los dos controles dicen NO SE PUDO SABER, y el guion corta con CIEGO y código 2', () => {
  const r = barrerMutado('mutar-vaciar.mjs', 'b-vacio.mjs');
  assert.equal(r.esperadas, 0);
  assert.equal(r.positivo, NO_SE);
  assert.equal(r.cero, NO_SE);
  assert.equal(r.ciego, true);
  assert.equal(r.salida, 2);
});

test('SCRUM-1536b · un mutador al que se le pide un modo que el test no declara no fabrica nada: dice CIEGO', () => {
  const copia = path.join(TMP, 'b-inventado.mjs');
  const f = node(`${E}/mutar-sembrar.mjs`, `${E}/barrido.mjs`, copia, 'modo-inventado');
  assert.equal(f.status, 2);
  assert.match(f.stdout, /^CIEGO: /m);
  assert.equal(fs.existsSync(copia), false);
});

test('SCRUM-1536b · veredicto(): OK sólo con prueba de que se pudo mirar; lo demás que no es ROTO, no se sabe', () => {
  assert.equal(veredicto({ pudoMirar: true, roto: false }), OK);
  assert.equal(veredicto({ pudoMirar: true, roto: true }), ROTO);
  assert.equal(veredicto({ pudoMirar: false, roto: true }), ROTO);
  assert.equal(veredicto({ pudoMirar: false, roto: false }), NO_SE);
  assert.equal(veredicto({ roto: false }), NO_SE);
  assert.equal(veredicto({ pudoMirar: true }), NO_SE);
  assert.equal(veredicto({}), NO_SE);
  // Estricto: un «casi verdadero» no es una prueba.
  assert.equal(veredicto({ pudoMirar: 1, roto: 0 }), NO_SE);
  assert.deepEqual([OK, ROTO, NO_SE], ['OK', 'ROTO', 'NO SE PUDO SABER']);
});

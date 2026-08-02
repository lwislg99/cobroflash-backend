// tests/scrum260-rastro-limpieza.test.mjs — SCRUM-260
//
// La CONSTANCIA de clean-staging: cuando barre merchants @test.local vivos, deja un rastro que
// responde «¿se ejecutó una limpieza durante MI tanda?». Se prueba SIN BD ni turno: la lógica es
// pura y el IO se inyecta (misma doctrina que _staging-lock.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';
import {
  componerEntrada, parsearHistorial, añadirEntrada, registrar, MAX_ENTRADAS,
} from '../scripts/_rastro-limpieza.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const datos = {
  ranAt: '2026-08-02T10:00:00.000Z',
  turnMarker: 'YAQU_STAGING lock:host.111@2026-08-02T09:00:00.000Z',
  applied: true,
  merchantsCount: 2,
  merchantEmails: ['qa-s23-1@test.local', 'qa-s23-2@test.local'],
  jobsCount: 3,
};

// ─── R3 · los cinco campos, y turnMarker null → «NO CONSTA» explícito ───────────────────────────
test('SCRUM-260 · componerEntrada lleva los cinco campos', () => {
  const e = componerEntrada(datos);
  process.stdout.write(`  entrada → ${e}\n`);
  assert.match(e, /2026-08-02T10:00:00\.000Z/);           // ranAt
  assert.match(e, /turno=YAQU_STAGING/);                  // turnMarker
  assert.match(e, /applied=SI/);                          // applied
  assert.match(e, /merchants=2\[qa-s23-1@test\.local,qa-s23-2@test\.local\]/); // count + cuáles
  assert.match(e, /jobs=3/);                              // jobsCount
});

test('SCRUM-260 · turnMarker ausente → NO-CONSTA explícito, nunca vacío', () => {
  const e = componerEntrada({ ...datos, turnMarker: null });
  assert.match(e, /turno=NO-CONSTA/);
  assert.doesNotMatch(e, /turno=\s*\|/); // el token NO-CONSTA existe en positivo arriba → respaldado
});

// ─── R2 · rolling de N, y el descarte SE VE (contador) ──────────────────────────────────────────
test('SCRUM-260 · añadirEntrada apila la más nueva primero y sube total', () => {
  let c = null;
  c = añadirEntrada(c, 'E1');
  c = añadirEntrada(c, 'E2');
  const h = parsearHistorial(c);
  assert.equal(h.total, 2, 'total cuenta TODAS las pasadas, no solo las guardadas');
  assert.deepEqual(h.entradas, ['E2', 'E1'], 'la más nueva va primero');
  assert.equal(h.descartadas, 0);
});

test('SCRUM-260 · cuando se llena, la vieja se pierde pero el descarte QUEDA VISIBLE', () => {
  let c = null;
  for (let i = 1; i <= MAX_ENTRADAS + 3; i++) c = añadirEntrada(c, `E${i}`);
  const h = parsearHistorial(c);
  assert.equal(h.entradas.length, MAX_ENTRADAS, 'nunca guarda más de MAX_ENTRADAS');
  assert.equal(h.total, MAX_ENTRADAS + 3, 'total refleja TODAS las pasadas');
  assert.equal(h.descartadas, 3, 'las 3 que se cayeron se CUENTAN — un log que descarta en silencio es un verde hueco');
  assert.equal(h.entradas[0], `E${MAX_ENTRADAS + 3}`, 'la más nueva sobrevive');
  assert.ok(!h.entradas.includes('E1'), 'la más vieja se fue');
});

// ─── El corazón (rojo-primero): el rastro NO está antes de escribirse, y SÍ después ──────────────
function ioEnMemoria() {
  let store = null;
  return { leer: async () => store, escribir: async (t) => { store = t; }, ver: () => store };
}

test('SCRUM-260 · ROJO→VERDE: el store está VACÍO antes de registrar y contiene la entrada después', async () => {
  const io = ioEnMemoria();
  assert.equal(io.ver(), null, 'ANTES de registrar no hay rastro (el estado que arreglamos)');
  const res = await registrar(io, datos);
  assert.equal(res.ok, true);
  const despues = io.ver();
  assert.notEqual(despues, null, 'DESPUÉS de registrar el rastro existe');
  assert.match(despues, /merchants=2\[qa-s23-1@test\.local/, 'y lleva lo que se barrió');
  process.stdout.write(`  store tras registrar → ${despues}\n`);
});

// ─── R5 · best-effort: nada de esto puede lanzar hacia el script ────────────────────────────────
test('SCRUM-260 · formato roto → historial fresco, sin lanzar', () => {
  for (const basura of [null, undefined, '', 'ruido sin cabecera', 'YAQU_RASTRO_LIMPIEZA roto']) {
    const h = parsearHistorial(basura);
    assert.equal(h.total, 0);
    assert.deepEqual(h.entradas, []);
  }
});

test('SCRUM-260 · si el IO de escritura LANZA, registrar degrada a {ok:false} y NO propaga', async () => {
  const io = { leer: async () => null, escribir: async () => { throw new Error('BD caída'); } };
  const res = await registrar(io, datos); // no debe lanzar
  assert.equal(res.ok, false);
  assert.match(res.motivo, /BD caída/);
});

test('SCRUM-260 · si el IO de LECTURA lanza, se degrada a historial vacío y aun así escribe', async () => {
  let escrito = null;
  const io = { leer: async () => { throw new Error('lectura caída'); }, escribir: async (t) => { escrito = t; } };
  const res = await registrar(io, datos);
  assert.equal(res.ok, true, 'una lectura caída no impide dejar constancia de ESTA pasada');
  assert.match(escrito, /total=1/);
});

// ─── R4 + R6 · estructura de clean-staging: escribir ANTES de borrar; solo imports read-only ─────
test('SCRUM-260 · clean-staging registra el rastro ANTES del bucle de deletes (R4)', () => {
  const src = leerFuente(path.join(RAIZ, 'scripts', 'clean-staging-tests.mjs'));
  const iReg = src.search(/registrar\s*\(/);
  const iDel = src.search(/deleteMany\s*\(/);
  assert.ok(iReg !== -1, 'clean-staging debe llamar a registrar()');
  assert.ok(iDel !== -1, 'clean-staging borra con deleteMany()');
  assert.ok(iReg < iDel, '🔴 el rastro debe escribirse ANTES del primer deleteMany — si un borrado revienta a mitad, la fila ya está a salvo');
});

test('SCRUM-260 · clean-staging lee el marcador SOLO con funciones read-only, sin tocar los ficheros en disputa (R6)', () => {
  const src = leerFuente(path.join(RAIZ, 'scripts', 'clean-staging-tests.mjs'));
  assert.match(src, /import\s*\{[^}]*leerMarcaCruda[^}]*\}\s*from\s*['"]\.\/_staging-lock\.mjs['"]/,
    'el marcador se lee con leerMarcaCruda de _staging-lock.mjs (read-only)');
  assert.doesNotMatch(src, /from\s*['"]\.\/turno-staging\.mjs['"]/,
    'NO importa turno-staging.mjs — ahí chocan 253 y 258');
});

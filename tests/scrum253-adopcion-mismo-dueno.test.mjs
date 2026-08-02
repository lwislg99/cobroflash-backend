// tests/scrum253-adopcion-mismo-dueno.test.mjs — SCRUM-253
//
// EL BUG: `turno:tomar` antes de lanzar la tanda BLOQUEABA tu propia tanda. El dueño era
// `host.PID`, y el PID cambia entre el proceso de `turno:tomar` y el del runner, así que el
// runner veía SU PROPIO turno (de la misma sesión) como AJENO → exit 5 contra sí mismo. La
// herramienta que hicimos para inspeccionar el turno (SCRUM-232) se pisaba a sí misma.
//
// EL ARREGLO abre UNA puerta nueva en `adquirirLock` (adoptar el turno propio) y este test tiene
// que demostrar las DOS caras, porque abrir una puerta hacia el turno propio no puede haber
// abierto también la puerta hacia el ajeno (eso sería romper SCRUM-188):
//   CASO 1 · mismo dueño, no rancio → ADOPTA (ok, adoptado), ya no bloquea.
//   CASO 2 · dueño DISTINTO, no rancio → sigue `ocupado`. Sin este caso, el 1 no prueba nada.
//
// Sin BD: `_staging-lock.mjs` recibe el cliente inyectado, así que el camino de decisión se
// ejercita con un doble (la misma doctrina con la que SCRUM-188 se prueba ungated).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';
import { adquirirLock, componerMarca, MARCADOR, TTL_POR_DEFECTO_MS } from '../scripts/_staging-lock.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Doble del cliente: sirve el marcador que le digas y el reloj que le digas; las escrituras no
// hacen nada (asertamos sobre lo que DEVUELVE adquirirLock, no sobre lo que escribe la BD real).
function clienteFalso({ marca, comentario = null, ahora }) {
  const tx = {
    $queryRawUnsafe: async (sql) => {
      if (/pg_database/.test(sql)) return [{ db: 'railway', marca, ahora }];
      if (/pg_namespace/.test(sql)) return [{ comentario }];
      return []; // pg_advisory_xact_lock y demás
    },
    $executeRawUnsafe: async () => [],
  };
  return { $transaction: async (fn) => fn(tx) };
}

const AHORA = new Date();
const reciente = () => AHORA.getTime() - 1000;                          // hace 1 s → no rancio
const rancio = () => AHORA.getTime() - (TTL_POR_DEFECTO_MS + 60_000);   // pasado el TTL → rancio
const pedir = (cli, dueño) => adquirirLock(cli, { dueño, ttlMs: TTL_POR_DEFECTO_MS, tipo: 'gated', ref: 'x' });

test('SCRUM-253 · CASO 1 — turno del MISMO dueño (no rancio) → ADOPTA, no bloquea', async () => {
  const marca = componerMarca('host.111', reciente()); // lo tiene host.111
  const res = await pedir(clienteFalso({ marca, ahora: AHORA }), 'host.111'); // lo pide host.111
  assert.equal(res.ok, true, '🔴 el turno propio NO debería bloquear (era el auto-bloqueo de scrum253)');
  assert.equal(res.adoptado, true, 'debe marcarse como ADOPTADO');
  assert.equal(res.reclamado, false, 'adoptar el propio NO es reclamar un ajeno rancio');
});

test('SCRUM-253 · CASO 2 — turno de dueño DISTINTO (no rancio) → sigue OCUPADO (SCRUM-188 intacto)', async () => {
  const marca = componerMarca('host.999', reciente()); // lo tiene host.999
  const res = await pedir(clienteFalso({ marca, ahora: AHORA }), 'host.111'); // lo pide host.111
  assert.equal(res.ok, false, '🔴 un turno AJENO vivo TIENE que rechazar — o la adopción abrió la puerta ajena');
  assert.equal(res.motivo, 'ocupado');
});

test('SCRUM-253 · turno LIBRE → toma normal (ni adoptado ni reclamado)', async () => {
  const res = await pedir(clienteFalso({ marca: MARCADOR, ahora: AHORA }), 'host.111');
  assert.equal(res.ok, true);
  assert.equal(res.adoptado, false);
  assert.equal(res.reclamado, false);
});

test('SCRUM-253 · turno AJENO RANCIO → reclama (no adopta): la vía de SCRUM-188 sigue viva', async () => {
  const marca = componerMarca('host.999', rancio());
  const res = await pedir(clienteFalso({ marca, ahora: AHORA }), 'host.111');
  assert.equal(res.ok, true);
  assert.equal(res.reclamado, true, 'un ajeno caducado se reclama');
  assert.equal(res.adoptado, false, 'reclamar un ajeno NO es adoptar el propio — no se confunden');
});

test('SCRUM-253 · el runner y turno:tomar comparten dueño ESTABLE (YAQU_LOCK_DUENO como entrada)', () => {
  // La adopción solo sirve si los dos procesos presentan el MISMO dueño. Eso exige que el dueño
  // salga de YAQU_LOCK_DUENO cuando está, no del PID (que cambia entre procesos).
  const runner = leerFuente(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'));
  const turno = leerFuente(path.join(RAIZ, 'scripts', 'turno-staging.mjs'));
  assert.match(runner, /process\.env\.YAQU_LOCK_DUENO\s*\|\|\s*idDeSesion/,
    '🔴 el runner debe HONRAR YAQU_LOCK_DUENO como entrada, no solo exportarlo a los hijos');
  assert.match(turno, /process\.env\.YAQU_LOCK_DUENO\s*\|\|\s*idDeSesion/,
    '🔴 turno:tomar debe usar el MISMO dueño estable que el runner');
  // Y turno:tomar imprime la línea puente para lanzar la tanda adoptando el turno.
  assert.match(turno, /YAQU_LOCK_DUENO=.*npm run test:staging:gated/,
    '🔴 turno:tomar debe imprimir cómo lanzar la tanda sobre este turno (la línea puente)');
});

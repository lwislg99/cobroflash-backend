// SCRUM-839i · EL LATIDO AVISA DEL PR BLOQUEADO SIN CAUSA — pero sólo si PERSISTE
//
// El caso que nadie nota: el obligatorio en verde, el auto-merge armado y GitHub diciendo BLOCKED. #2449
// estuvo dos días así y sólo se movió porque el fundador y el orquestador lo miraron a mano. Decisión del
// orquestador (16-oct-2026): que el latido lo avise, con una condición — que NO suene por un estado
// pasajero. Medido sobre 78 PR fusionados: del verde del obligatorio al merge, mediana 1,4 min, p95 14,5,
// máximo 55,9. El clasificador sólo afirma BLOQUEADO-SIN-CAUSA desde MINUTOS_PARA_AFIRMAR_SIN_CAUSA.
//
// Los dos sentidos: uno que persiste SÍ avisa; uno pasajero, o del que no se sabe la hora, NO.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seccionPRs, salidaDe, SALIDA_AVISO } from '../scripts/equipo/latido.mjs';
import { MINUTOS_PARA_AFIRMAR_SIN_CAUSA } from '../scripts/vigia-atascados.mjs';

const OBLIG = 'build + tests (con banco desechable)';
const REGLAS = [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: OBLIG }] } }];
const AHORA = Date.parse('2026-10-16T12:00:00Z');
/** El obligatorio en verde, terminado hace `min` minutos (`null` = la API no trajo la hora). */
const verdeHace = (min) => [{ id: 1, name: OBLIG, status: 'completed', conclusion: 'success',
  completed_at: min === null ? null : new Date(AHORA - min * 60_000).toISOString() }];
/** Armado, BLOCKED y mergeable: la forma de #2449. Cada caso cambia UNA cosa. */
const pr = (numero, extra = {}) => ({
  number: numero, headRefName: `scrum-${numero}-x`, author: { login: 'app/yaqu-bot' }, isDraft: false, labels: [],
  autoMergeRequest: { enabledAt: '2026-10-16T09:00:00Z' }, mergeStateStatus: 'BLOCKED', mergeable: 'MERGEABLE', ...extra,
});
const seccion = (verdeMin, pushMin = 180) => seccionPRs({
  prs: [pr(2449)], reglas: REGLAS, checksDe: () => verdeHace(verdeMin), minutosDesdePush: () => pushMin, ahora: AHORA,
});

test('🔴 PERSISTE: verde hace 90 min y aún BLOCKED → el latido AVISA, dice que no sabe por qué y cuánto lleva', () => {
  const s = seccion(90);
  assert.equal(s.filas[0].causa, 'BLOQUEADO-SIN-CAUSA', JSON.stringify(s.filas[0]));
  assert.deepEqual(s.alertas.map((a) => a.numero), [2449], '🔴 la sección sale en ✅ con un PR bloqueado sin causa');
  assert.match(s.alertas[0].linea, /^#2449 scrum-2449-x · BLOQUEADO sin causa: .*hace 90 min.*no sé por qué está bloqueado · 3\.0 h desde su último push$/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('🔴 PASAJERO: verde hace poco y BLOCKED → NO avisa (es la espera normal hasta el auto-merge)', () => {
  for (const min of [1, 15, MINUTOS_PARA_AFIRMAR_SIN_CAUSA - 1]) {
    const s = seccion(min);
    assert.equal(s.filas[0].causa, 'ESPERANDO', `${min} min`);
    assert.deepEqual(s.alertas, [], `🔴 suena por un BLOCKED de ${min} min`);
  }
});

test('sin la hora del verde no se sabe si persiste: NO avisa, y la fila lo dice', () => {
  const s = seccion(null);
  assert.deepEqual(s.alertas, []);
  assert.match(s.filas[0].detalle, /no sé desde cuándo/);
});

test('la persistencia se mide desde el VERDE, no desde el push: un push viejo con un verde reciente no suena', () => {
  const s = seccion(5, 48 * 60);
  assert.deepEqual(s.alertas, [], 'el push puede ser de hace dos días y el CI haberse relanzado hace 5 min');
});

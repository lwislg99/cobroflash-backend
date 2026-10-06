// SCRUM-1453 · EL LATIDO Y EL PR VERDE QUE NADIE VA A MERGEAR
//
// El 6-oct-2026 el latido decía «✅ PR · 4 vigilados» con #2128-#2131 cuatro días verdes, mergeables y
// SIN auto-merge. `causaDelAtasco` ya los clasificaba `SIN-AUTO-MERGE`; la sección no lo convertía en
// aviso. Y «sin armar» a secas se leyó tres veces como «el paso que arma miente»: la línea de tiempo
// decía que los armó `yaqu-bot[bot]` y los desarmó una persona a los 16-35 s.
//
// Como las demás secciones: su ROJO (ve lo que tiene que ver), su NEGATIVO (no acusa a lo que está
// bien) y su CIEGO (si no pudo mirar QUIÉN, lo dice, y no lo convierte en «nunca se armó»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { seccionPRs, origenDelSinArmar, salidaDe, HORAS_DE_ROJO, SALIDA_AVISO } from '../scripts/equipo/latido.mjs';

const OBLIG = 'build + tests (con banco desechable)';
const REGLAS = [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: OBLIG }] } }];
const VERDE = [{ id: 1, name: OBLIG, status: 'completed', conclusion: 'success', started_at: '2026-10-02T06:00:00Z' }];
const BOT = 'yaqu-bot[bot]';

/** Del bot, verde, mergeable y SIN auto-merge: la forma de #2128-#2131. Cada caso cambia UNA cosa. */
const pr = (numero, extra = {}) => ({
  number: numero, headRefName: `scrum-${numero}-x`, author: { login: 'app/yaqu-bot' }, isDraft: false, labels: [],
  autoMergeRequest: null, mergeStateStatus: 'UNSTABLE', mergeable: 'MERGEABLE', ...extra,
});
const armado = (actor, created_at) => ({ event: 'auto_merge_enabled', actor, created_at });
const desarmado = (actor, created_at) => ({ event: 'auto_merge_disabled', actor, created_at });
/** La línea de tiempo real de #2129 (6-oct-2026): dos armados del bot, dos desarmes de una persona. */
const DE_2129 = [
  armado(BOT, '2026-10-02T06:15:16Z'), desarmado('Javierpf28', '2026-10-02T06:15:49Z'),
  armado(BOT, '2026-10-02T06:20:24Z'), desarmado('Javierpf28', '2026-10-02T06:20:42Z'),
];

function seccion({ lista, minutos, eventos = {} }) {
  return seccionPRs({
    prs: lista, reglas: REGLAS, checksDe: () => VERDE, minutosDesdePush: (n) => minutos[n],
    eventosDeArmado: (n) => eventos[n],
  });
}

test('SCRUM-1453 · SUELO: el clasificador prestado llama SIN-AUTO-MERGE al cebo (si no, nada de abajo mide)', () => {
  const s = seccion({ lista: [pr(1)], minutos: { 1: 6000 } });
  assert.equal(s.filas.length, 1, '🔴 CIEGO: el PR del cebo no entra entre los vigilados');
  assert.equal(s.filas[0].causa, 'SIN-AUTO-MERGE', `🔴 CIEGO: un PR verde y sin armar sale ${s.filas[0].causa}`);
});

test('SCRUM-1453 · 🔴 un PR verde y SIN auto-merge de más de 2 h SE AVISA, y dice quién lo desarmó y quién lo había armado', () => {
  assert.equal(HORAS_DE_ROJO, 2, 'el título de este caso lleva escrito el umbral: si cambia, cambia el título');
  const s = seccion({ lista: [pr(2129)], minutos: { 2129: 100 * 60 + 30 * 60 }, eventos: { 2129: DE_2129 } });
  assert.deepEqual(s.alertas.map((a) => a.numero), [2129], '🔴 la sección sale en ✅ con un PR que nadie va a mergear');
  assert.equal(s.alertas[0].origen, 'DESARMADO');
  assert.match(s.alertas[0].linea, /#2129 scrum-2129-x · SIN auto-merge: aunque todo pase a verde, nadie lo va a mergear/);
  assert.match(s.alertas[0].linea, /lo DESARMÓ Javierpf28 el 2026-10-02T06:20 \(lo había armado yaqu-bot\[bot\]\)/, '🔴 manda el ÚLTIMO desarme, con su actor');
  assert.match(s.alertas[0].linea, /130\.0 h desde su último push/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1453 · NEGATIVO: el recién empujado sin armar no se acusa, ni el que SÍ está armado', () => {
  const s = seccion({ lista: [pr(1), pr(2, { autoMergeRequest: {} })], minutos: { 1: 30, 2: 6000 }, eventos: { 1: [] } });
  assert.deepEqual(s.alertas, [], 'a los 30 min su dueño puede estar armándolo; el armado espera a GitHub');
});

test('SCRUM-1453 · 🔴 «nunca se armó» y «no pude mirar» NO son lo mismo, y ninguno acusa a una persona', () => {
  const s = seccion({ lista: [pr(1), pr(2)], minutos: { 1: 600, 2: 600 }, eventos: { 1: [] } });
  const [nunca, ciego] = s.alertas;
  assert.equal(nunca.origen, 'NUNCA');
  assert.match(nunca.linea, /NUNCA se armó/);
  assert.equal(ciego.origen, 'NO-PUDE-MIRAR', '🔴 sin línea de tiempo se dijo algo distinto de «no pude mirar»');
  assert.match(ciego.linea, /NO PUDE MIRAR quién lo desarmó/);
  assert.doesNotMatch(ciego.linea, /NUNCA se armó|DESARMÓ/);
});

test('SCRUM-1453 · el origen: manda el último evento aunque lleguen desordenados, y un armado final DISCREPA de la lista', () => {
  assert.equal(origenDelSinArmar([...DE_2129].reverse()).tipo, 'DESARMADO');
  assert.match(origenDelSinArmar([...DE_2129].reverse()).texto, /06:20/);
  const d = origenDelSinArmar([desarmado('Javierpf28', '2026-10-02T06:15:49Z'), armado(BOT, '2026-10-02T06:20:24Z')]);
  assert.equal(d.tipo, 'DISCREPA', '🔴 con un ARMADO al final no se puede decir «lo desarmó»');
  assert.match(d.texto, /NO SÉ cuál vale/);
  assert.match(origenDelSinArmar([desarmado(undefined, '2026-10-02T06:15:49Z')]).texto, /actor DESCONOCIDO/, 'sin actor no se inventa uno');
  assert.equal(origenDelSinArmar([{ event: 'committed' }, null]).tipo, 'NUNCA', 'los eventos ajenos no cuentan');
});

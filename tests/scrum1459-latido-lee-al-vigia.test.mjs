// SCRUM-1459 · EL LATIDO LEE LO QUE EL VIGÍA ESCRIBE, y la línea de MAIN dice cuánto lleva parado.
//
// Medido el 6-oct-2026: durante un parón de 88 h, `vigia-atascados` comentó tres veces en su issue
// (2, 3 y 5-oct) nombrando #2128-#2131. Los 43 comentarios del issue tenían cero reacciones y ninguna
// respuesta de una persona. Los cuerpos de abajo son los de verdad, recortados.
//
// Sólo lo PURO: la recogida (gh) no se prueba aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seccionVigia, prsDelAviso, edadDelUltimoMerge, seccionMain, salidaDe, SALIDA_CIEGO, SALIDA_AVISO, SALIDA_OK,
} from '../scripts/equipo/latido.mjs';

const AHORA = Date.parse('2026-10-06T11:30:00Z');
const PIE = '\n\nEste aviso solo sale cuando un PR entra o pasa a una causa que no se arregla esperando.';
const aviso = (id, creado, vinetas, extra = {}) => ({
  id, creado, autor: 'github-actions[bot]', esBot: true, reacciones: 0,
  cuerpo: `@lwislg99 la lista de PR atascados ha **EMPEORADO**. El detalle completo está en el cuerpo del issue.\n\n${vinetas.join('\n')}${PIE}`,
  ...extra,
});
const ENTRAN = aviso(101, '2026-10-02T09:04:38Z', ['- **#2129 entra** como **SIN-AUTO-MERGE** (2.7 h sin push)', '- **#2128 entra** como **SIN-AUTO-MERGE** (2.7 h sin push)', '- **#2130 entra** como **SIN-AUTO-MERGE** (2.3 h sin push)', '- **#2131 entra** como **SIN-AUTO-MERGE** (0.9 h sin push)']);
const DIRTY = aviso(102, '2026-10-02T16:54:03Z', ['- **#2134 entra** como **DIRTY** (4.6 h sin push)', '- **#2164 entra** como **DIRTY** (3.2 h sin push)']);
const CRUZAN_24 = aviso(103, '2026-10-03T08:36:48Z', ['- **#2129 cruza 24 h** sin moverse (26.3 h sin push, SIN-AUTO-MERGE)', '- **#2128 cruza 24 h** sin moverse (26.2 h sin push, SIN-AUTO-MERGE)']);
const CRUZAN_72 = aviso(104, '2026-10-05T09:40:28Z', ['- **#2129 cruza 72 h** sin moverse (75.3 h sin push, SIN-AUTO-MERGE)', '- **#2131 cruza 72 h** sin moverse (73.5 h sin push, SIN-AUTO-MERGE)']);
const LOS_CUATRO = [ENTRAN, DIRTY, CRUZAN_24, CRUZAN_72];
const ABIERTOS = [2128, 2129, 2130, 2131, 2001];
const base = (extra = {}) => ({ issue: 1241, comentarios: LOS_CUATRO, abiertos: ABIERTOS, ahora: AHORA, ...extra });

test('SCRUM-1459 · los PR de un aviso se leen de sus viñetas, no de cualquier # del texto', () => {
  assert.deepEqual(prsDelAviso(ENTRAN.cuerpo), [2129, 2128, 2130, 2131]);
  assert.deepEqual(prsDelAviso(CRUZAN_72.cuerpo), [2129, 2131]);
  assert.deepEqual(prsDelAviso('- **#2000 cambia de causa**: ESPERANDO → **DIRTY**'), [2000]);
  assert.deepEqual(prsDelAviso('véase #1241 y el PR #7'), []);
});

test('SCRUM-1459 · 🔴 EL CASO: tres avisos sin leer sobre PR que siguen abiertos salen los tres, con su edad', () => {
  const s = seccionVigia(base());
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 3, 'el del 2-oct, el de las 24 h y el de las 72 h');
  assert.deepEqual(s.alertas.map((a) => a.id), [101, 103, 104]);
  assert.match(s.alertas[0].linea, /aviso del 2026-10-02T09:04Z SIN LEER desde hace 4\.1 días · nombra 4 PR, 4 siguen abiertos: #2129 #2128 #2130 #2131 · comentario 101/);
  assert.match(s.alertas[2].linea, /SIN LEER desde hace 25\.8 h · nombra 2 PR, 2 siguen abiertos/);
  // El de los DIRTY nombra PR que ya no están abiertos: se CUENTA y no se enseña.
  assert.match(s.poblacion, /issue #1241 · 4 comentarios, 4 son avisos del vigía · 4 sin leer \(3 con algún PR aún abierto, 1 ya sin ninguno: no se enseñan\)/);
  assert.match(s.poblacion, /«leído» = una reacción/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1459 · LEÍDO: una reacción en el comentario, o una respuesta posterior de una PERSONA', () => {
  // Con reacción en el del 2-oct, quedan los otros dos.
  const conReaccion = seccionVigia(base({ comentarios: [{ ...ENTRAN, reacciones: 1 }, DIRTY, CRUZAN_24, CRUZAN_72] }));
  assert.deepEqual(conReaccion.alertas.map((a) => a.id), [103, 104]);
  // Una persona contesta el 4-oct: lo anterior está leído, lo del 5 no.
  const persona = { id: 900, creado: '2026-10-04T10:00:00Z', autor: 'lwislg99', esBot: false, reacciones: 0, cuerpo: 'visto' };
  const conRespuesta = seccionVigia(base({ comentarios: [...LOS_CUATRO, persona] }));
  assert.deepEqual(conRespuesta.alertas.map((a) => a.id), [104]);
  // Un bot que comenta después NO es «alguien lo leyó».
  const otroBot = { ...persona, autor: 'yaqu-bot[bot]', esBot: true };
  assert.equal(seccionVigia(base({ comentarios: [...LOS_CUATRO, otroBot] })).alertas.length, 3);
  // Todo leído: sección en verde, y la población lo cuenta.
  const todo = seccionVigia(base({ comentarios: [...LOS_CUATRO, { ...persona, creado: '2026-10-06T11:00:00Z' }] }));
  assert.equal(todo.alertas.length, 0);
  assert.match(todo.poblacion, /0 sin leer/);
  assert.equal(salidaDe([todo]), SALIDA_OK);
});

test('SCRUM-1459 · un aviso cuyos PR ya no están abiertos no es alerta; si se cierran todos, la sección queda en verde', () => {
  const s = seccionVigia(base({ abiertos: [2001] }));
  assert.equal(s.alertas.length, 0);
  assert.match(s.poblacion, /4 sin leer \(0 con algún PR aún abierto, 4 ya sin ninguno/);
  // Sólo queda uno abierto: el aviso sale, y dice CUÁL sigue.
  const uno = seccionVigia(base({ abiertos: [2131] }));
  assert.deepEqual(uno.alertas.map((a) => [a.id, a.siguen]), [[101, [2131]], [104, [2131]]]);
});

test('SCRUM-1459 · CIEGO antes que verde: sin issue, sin comentarios, sin lista de PR o con un formato que no sé leer, NO es «cero avisos»', () => {
  const casos = {
    'no se pudo buscar': base({ issue: undefined }),
    'no hay issue abierto': base({ issue: null }),
    'sin comentarios': base({ comentarios: undefined }),
    'sin lista de PR': base({ abiertos: undefined }),
    'formato cambiado': base({ comentarios: [aviso(105, '2026-10-06T09:00:00Z', ['* el PR 2129 sigue igual'])] }),
  };
  for (const [nombre, e] of Object.entries(casos)) {
    const s = seccionVigia(e);
    assert.equal(s.pudo, false, nombre);
    assert.ok(s.motivo && s.motivo.length > 10, nombre);
    assert.equal(salidaDe([s]), SALIDA_CIEGO, nombre);
  }
  assert.match(seccionVigia(casos['no hay issue abierto']).motivo, /alguien lo cerró/);
  assert.match(seccionVigia(casos['formato cambiado']).motivo, /el formato del vigía ha cambiado/);
  // Un issue con comentarios y NINGÚN aviso sí es un cero legítimo, y la población lo enseña.
  const sinAvisos = seccionVigia(base({ comentarios: [] }));
  assert.equal(sinAvisos.pudo, true);
  assert.match(sinAvisos.poblacion, /0 comentarios, 0 son avisos/);
});

test('SCRUM-1459 · la línea de MAIN dice cuánto hace del último commit; si no se puede leer, la sección es ciega', () => {
  const verde = [{ sha: 'a'.repeat(40), cancelada: false, checkRuns: [{ name: 'build + tests', status: 'completed', conclusion: 'success', started_at: '2026-10-02T17:00:00Z' }] }];
  const parado = seccionMain({ commits: verde, ultimoMerge: { sha: 'b'.repeat(40), fecha: '2026-10-02T19:30:00Z' }, ahora: AHORA });
  assert.equal(parado.pudo, true);
  assert.match(parado.poblacion, /^main no recibe un commit desde hace 3\.7 días \(88 h\) \(bbbbbbbb, 2026-10-02T19:30Z\) · /);
  assert.match(parado.poblacion, /último con el obligatorio VERDE: aaaaaaaa/);
  assert.equal(parado.alertas.length, 0, 'sólo lo dice: el aviso de parón es del vigía');
  assert.match(edadDelUltimoMerge({ sha: 'c'.repeat(40), fecha: '2026-10-06T11:05:00Z' }, AHORA), /desde hace 25 min/);
  assert.match(edadDelUltimoMerge({ sha: 'c'.repeat(40), fecha: '2026-10-06T05:30:00Z' }, AHORA), /desde hace 6\.0 h/);
  // Se preguntó y no se pudo leer: ciega, no una línea sin edad.
  for (const malo of [null, {}, { sha: 'x', fecha: 'ayer' }]) {
    const s = seccionMain({ commits: verde, ultimoMerge: malo, ahora: AHORA });
    assert.equal(s.pudo, false, JSON.stringify(malo));
    assert.match(s.motivo, /no sé cuánto lleva parado/);
  }
  // Y un rojo de main sigue saliendo con la edad delante.
  const rojo = [{ sha: 'd'.repeat(40), cancelada: false, checkRuns: [{ name: 'build + tests', status: 'completed', conclusion: 'failure', started_at: '2026-10-06T10:00:00Z' }] }];
  const r = seccionMain({ commits: rojo, ultimoMerge: { sha: 'd'.repeat(40), fecha: '2026-10-06T10:00:00Z' }, ahora: AHORA });
  assert.equal(r.alertas.length, 1);
  assert.match(r.poblacion, /^main no recibe un commit desde hace 1\.5 h/);
});

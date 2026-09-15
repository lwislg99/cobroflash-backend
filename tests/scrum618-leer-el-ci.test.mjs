// tests/scrum618-leer-el-ci.test.mjs — SCRUM-618
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA RED QUE SÍ CORRE SIEMPRE del lector de CI. Aquí NO se toca la red.
//
// `scripts/ci-de-la-rama.mjs` hace `fetch`, así que vive fuera de `npm test` —misma decisión que
// `censo:alcanzabilidad`—. Lo que se ejercita aquí es su parte PURA, `veredictoDeJobs`, contra
// respuestas **capturadas de la API real** el 15-sep-2026. No son inventadas: son la forma que
// GitHub devuelve de verdad, recortada a los campos que se leen.
//
// ── POR QUÉ ESTE TICKET DEJÓ DE SER LO QUE PARECÍA ─────────────────────────────────────────
//
// SCRUM-618 daba por hecho que «el repositorio es privado, así que tampoco se alcanza por web», y
// de ahí salían las dos vueltas y el fundador pegando logs a mano. **Medido: es PÚBLICO**
// (`"private": false`). El propio árbol lo decía sin que nadie lo cruzara — el comentario de
// SCRUM-836 razona que Actions es gratis *porque* el repositorio es público.
//
//   >>> El trabajo no era construir un puente: era comprobar si el río existía. <<<
//
// ⚠️ Y ESO ES JUSTO LO QUE ESTE FICHERO NO PUEDE VIGILAR. Que el repositorio siga siendo público
// es un hecho de GitHub, no del árbol: comprobarlo exigiría red. Si algún día pasa a privado,
// `ci-de-la-rama` empezará a dar `404`/`403` y **lo dirá como CIEGO**, que es el modo correcto de
// fallar — no un verde. Queda declarado aquí porque un lector de este fichero podría creer que la
// propiedad «es público» está sujeta por un test, y no lo está.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { veredictoDeJobs, duracion, LOGS_REQUIEREN_AUTENTICACION } from '../scripts/ci-de-la-rama.mjs';

/**
 * Capturado de `/actions/runs/34983910213/jobs` el 15-sep-2026 (rama
 * `scrum-505-el-guard-que-mira-dentro`): el CI en ROJO por el meta-guard, con los otros verdes.
 */
const JOBS_CON_UN_ROJO = [
  {
    id: 1, name: 'build + tests (con banco desechable)', status: 'completed', conclusion: 'success',
    started_at: '2026-09-15T14:47:10Z', completed_at: '2026-09-15T14:52:42Z',
    runner_name: 'GitHub Actions 1000007193', labels: ['ubuntu-latest'], steps: [],
  },
  {
    id: 104431232482, name: 'meta-guard · los guards caen cuando deben', status: 'completed',
    conclusion: 'failure', started_at: '2026-09-15T14:47:10Z', completed_at: '2026-09-15T14:54:23Z',
    runner_name: 'GitHub Actions 1000007194', labels: ['ubuntu-latest'],
    steps: [
      { number: 6, name: 'Compilar (tsc)', conclusion: 'success' },
      { number: 7, name: 'Cada guard cae con la mutación que declara', conclusion: 'failure' },
    ],
  },
  {
    id: 3, name: 'vigía del despliegue (informativo)', status: 'completed', conclusion: 'success',
    started_at: '2026-09-15T14:47:10Z', completed_at: '2026-09-15T14:47:19Z',
    runner_name: 'GitHub Actions 1000007196', labels: ['ubuntu-latest'], steps: [],
  },
];

/** El mismo run mientras corre: dos jobs sin terminar. `conclusion` es null, que NO es «verde». */
const JOBS_EN_MARCHA = [
  {
    id: 4, name: 'meta-guard · los guards caen cuando deben', status: 'in_progress', conclusion: null,
    started_at: '2026-09-15T14:57:28Z', completed_at: null,
    runner_name: 'GitHub Actions 1000007228', labels: ['ubuntu-latest'], steps: [],
  },
  {
    id: 5, name: 'constancia del ALTER (informativo)', status: 'completed', conclusion: 'success',
    started_at: '2026-09-15T14:57:28Z', completed_at: '2026-09-15T14:57:57Z',
    runner_name: 'GitHub Actions 1000007230', labels: ['ubuntu-latest'], steps: [],
  },
];

// ═══ 🔴 EL QUE DECIDE ════════════════════════════════════════════════════════════════════════

test('SCRUM-618 · 🔴 EL QUE DECIDE: un job en ROJO se nombra, con su step y su entorno', () => {
  const v = veredictoDeJobs(JOBS_CON_UN_ROJO);
  assert.equal(v.rojos.length, 1,
    `🔴 se esperaba UN job rojo y salen ${v.rojos.length}. Es el caso real de la rama `
    + '`scrum-505` el 15-sep-2026: cuatro verdes y el meta-guard caído.');
  assert.equal(v.rojos[0].nombre, 'meta-guard · los guards caen cuando deben',
    '🔴 acusa al job equivocado. El caso de SCRUM-617 fue exactamente esto: el veredicto GLOBAL '
    + 'no servía de nada, hacía falta saber CUÁL de los cinco.');

  // 🔴 Lo que el comentario del ticket pedía y un `pass/fail` no da:
  assert.equal(v.rojos[0].pasoQueFalla.number, 7, '🔴 no dice QUÉ step falló.');
  assert.equal(v.rojos[0].pasoQueFalla.name, 'Cada guard cae con la mutación que declara');
  assert.equal(v.rojos[0].segundos, 433,
    '🔴 no da el TIEMPO del job. La curva de tiempos es lo único que apuntó a la causa en el '
    + 'caso del WS endpoint de Edge.');
  assert.equal(v.rojos[0].etiquetas, 'ubuntu-latest', '🔴 no dice en qué ENTORNO corrió.');
  assert.match(v.rojos[0].runner, /GitHub Actions/, '🔴 no identifica el runner.');
});

// ═══ ✅ POSITIVO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-618 · ✅ POSITIVO: con todos los jobs en verde NO acusa a nadie', () => {
  // Sin esto, «detecta rojos» y «acusa siempre» dan el mismo resultado y el de arriba no separa
  // una cosa de la otra.
  const verdes = JOBS_CON_UN_ROJO.map((j) => ({ ...j, conclusion: 'success', steps: [] }));
  const v = veredictoDeJobs(verdes);
  assert.deepEqual(v.rojos, [], '🔴 marca como rojo un job que salió bien.');
  assert.equal(v.verdes.length, 3, '🔴 y tampoco los cuenta como verdes: entonces no ve nada.');
});

// ═══ 🔴 EL CUBO QUE EVITA EL VERDE FALSO ════════════════════════════════════════════════════

test('SCRUM-618 · 🔴 «en marcha» NO es «verde»: son cubos distintos', () => {
  // Es la trampa que nombra el ticket: leer un CI a medias y darlo por aprobado. Un job sin
  // terminar tiene `conclusion: null`, y contarlo como éxito es fabricar el verde falso.
  const v = veredictoDeJobs(JOBS_EN_MARCHA);
  assert.equal(v.enMarcha.length, 1, '🔴 no distingue un job que aún corre.');
  assert.equal(v.verdes.length, 1, '🔴 cuenta como verde algo que no ha terminado, o pierde el que sí.');
  assert.deepEqual(v.rojos, [], '🔴 un job en marcha tampoco es un rojo: todavía no se sabe.');
  assert.equal(v.filas.find((f) => f.estado === 'in_progress').segundos, null,
    '🔴 inventa una duración para un job que no ha terminado.');
});

// ═══ 🔴 SUELO ═══════════════════════════════════════════════════════════════════════════════

test('SCRUM-618 · 🔴 SUELO: sin jobs no se inventa un veredicto', () => {
  for (const vacio of [[], null, undefined]) {
    const v = veredictoDeJobs(vacio);
    assert.deepEqual(v.filas, [], `🔴 inventa filas a partir de ${JSON.stringify(vacio)}.`);
    assert.deepEqual(v.rojos, [], '🔴 y encima un veredicto.');
  }
  // El script, además, sale con CIEGO (2) cuando la rama no trae runs: cero runs y «todo bien»
  // se leen igual, y una de las dos lecturas es falsa.
});

test('SCRUM-618 · el cálculo de duración no miente ante datos incompletos', () => {
  assert.equal(duracion({ started_at: '2026-09-15T14:47:10Z', completed_at: '2026-09-15T14:54:23Z' }), 433);
  assert.equal(duracion({ started_at: '2026-09-15T14:47:10Z', completed_at: null }), null,
    '🔴 devuelve un número donde no hay dato. Un 0 aquí se leería como «tardó nada».');
  assert.equal(duracion(null), null, '🔴 no aguanta un job ausente.');
});

test('SCRUM-618 · el LÍMITE está declarado en el propio módulo, no sólo en la prosa', () => {
  // El hueco medido: `GET /actions/jobs/<id>/logs` da 403 anónimo. Que esté en una constante
  // exportada obliga a que quien lo cierre algún día tenga que venir aquí a cambiarlo.
  assert.equal(LOGS_REQUIEREN_AUTENTICACION, true,
    '🔴 si esto ya es `false`, alguien ha encontrado cómo leer el log sin autenticar: hay que '
    + 'medirlo de nuevo y contarlo, no cambiar la constante a secas.');
});
